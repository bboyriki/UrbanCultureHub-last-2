import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import Stripe from 'stripe';
import { createTicketWithQR } from './ticketing';
import { storage } from './storage';

export class StripeWebhookHandlers {

  // ─── Main entry point ────────────────────────────────────────────────────────
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // ── Step 1: Verify signature via stripe-replit-sync ──────────────────────
    // This MUST happen first. If the signature is invalid it throws, and we
    // never reach the business logic below — protecting against spoofed events.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    // ── Step 2: Signature verified — now safe to parse and act on the event ──
    let event: Stripe.Event;
    try {
      event = JSON.parse(payload.toString('utf-8')) as Stripe.Event;
    } catch (parseErr) {
      console.error('Webhook: failed to parse verified payload as JSON:', parseErr);
      return;
    }

    console.log(`🔔 Webhook verified — processing event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await StripeWebhookHandlers.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent
          );
          break;

        case 'checkout.session.completed':
          await StripeWebhookHandlers.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case 'checkout.session.async_payment_succeeded':
          // Async payment methods (e.g. bank transfers) complete here
          await StripeWebhookHandlers.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case 'payment_intent.payment_failed':
          await StripeWebhookHandlers.handlePaymentFailed(
            event.data.object as Stripe.PaymentIntent
          );
          break;

        default:
          // Stripe sync already handled the event above; nothing extra needed
          break;
      }
    } catch (handlerErr) {
      // Log but don't rethrow — the sync already responded 200.
      // Re-throwing here would cause Stripe to retry, potentially creating duplicate tickets.
      console.error(`Webhook business-logic error for ${event.type} (${event.id}):`, handlerErr);
    }
  }

  // ─── payment_intent.succeeded ────────────────────────────────────────────────
  static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const metadata = paymentIntent.metadata || {};

    if (metadata.type !== 'event_ticket') {
      console.log(`💳 payment_intent.succeeded [${paymentIntent.id}] — type: ${metadata.type || 'unset'}, skipping ticket creation`);
      return;
    }

    console.log(`🎫 Ticket payment succeeded: ${paymentIntent.id}`);

    const { eventId, ticketQuantity, userId, customerEmail, customerName } = metadata;

    if (!eventId || !ticketQuantity || !userId) {
      console.error('🎫 Missing required ticket metadata:', metadata);
      return;
    }

    // Idempotency check — never create a duplicate ticket for the same payment
    const existing = await storage.getTicketByPaymentIntentId(paymentIntent.id);
    if (existing) {
      console.log(`🎫 Ticket already exists for payment ${paymentIntent.id} — skipping`);
      return;
    }

    try {
      const ticketNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const ticket = await createTicketWithQR({
        userId:          parseInt(userId),
        eventId:         parseInt(eventId),
        paymentIntentId: paymentIntent.id,
        purchaseAmount:  paymentIntent.amount,
        ticketQuantity:  parseInt(ticketQuantity),
        ticketNumber,
        isPaid:          true,
        isValid:         true,
      });

      console.log(`✅ Ticket created: id=${ticket.id}, event=${eventId}, user=${userId}`);
      // Email is already sent by createTicketWithQR → no duplicate send needed here
    } catch (ticketErr) {
      console.error('Failed to create ticket:', ticketErr);
      throw ticketErr; // Re-throw so the outer handler logs it with the event ID
    }
  }

  // ─── checkout.session.completed ──────────────────────────────────────────────
  static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    console.log(`🛒 checkout.session.completed: ${session.id}, status: ${session.payment_status}`);

    // Only act on sessions that have been paid
    if (session.payment_status !== 'paid') {
      console.log(`🛒 Session ${session.id} not yet paid (status: ${session.payment_status}) — skipping`);
      return;
    }

    // If the session has a payment_intent, check the metadata on it
    if (session.payment_intent) {
      const piId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;

      // Check idempotency — payment_intent.succeeded fires too, which may have already created the ticket
      const existing = await storage.getTicketByPaymentIntentId(piId);
      if (existing) {
        console.log(`🛒 Ticket already exists for payment_intent ${piId} — skipping`);
        return;
      }

      // Retrieve the full payment intent from Stripe to access its metadata
      try {
        const stripe = await getUncachableStripeClient();
        const pi = await stripe.paymentIntents.retrieve(piId);
        const metadata = pi.metadata || {};

        if (metadata.type === 'event_ticket') {
          // Delegate to the payment intent handler which handles ticket creation
          await StripeWebhookHandlers.handlePaymentIntentSucceeded(pi);
        } else if (metadata.type) {
          console.log(`🛒 checkout.session.completed [${session.id}] — type: ${metadata.type}, no additional action`);
        }
      } catch (piErr) {
        console.error(`🛒 Failed to retrieve payment_intent ${piId}:`, piErr);
      }
      return;
    }

    // For sessions without a payment_intent (e.g. subscription setups), check session metadata
    const metadata = session.metadata || {};
    if (metadata.type === 'event_ticket') {
      console.log(`🛒 Ticket checkout session without payment_intent — metadata:`, metadata);
      // The ticket will be handled when payment_intent.succeeded fires
    }
  }

  // ─── payment_intent.payment_failed ───────────────────────────────────────────
  static async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const metadata = paymentIntent.metadata || {};
    const lastErr  = (paymentIntent as any).last_payment_error;
    console.warn(`❌ Payment failed: ${paymentIntent.id}, type: ${metadata.type || 'unset'}, reason: ${lastErr?.message || 'unknown'}`);
    // Future: notify user, release reserved seats, etc.
  }
}
