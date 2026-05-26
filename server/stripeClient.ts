import Stripe from 'stripe';

// Use environment variables for Stripe keys
function getCredentials() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;

  if (!secretKey || !publishableKey) {
    throw new Error('STRIPE_SECRET_KEY and VITE_STRIPE_PUBLIC_KEY must be set in environment variables');
  }

  return {
    publishableKey,
    secretKey,
  };
}

// WARNING: Never cache this client.
// Always call this function again to get a fresh client.
// Use getUncachableStripeClient() for server-side operations with secret key
export async function getUncachableStripeClient() {
  const { secretKey } = getCredentials();

  return new Stripe(secretKey, {
    // Note that this is the latest API version, don't change it to a old version of the
    // API.
    apiVersion: '2025-02-24.acacia',
  });
}

// Use getStripePublishableKey() for client-side operations
export async function getStripePublishableKey() {
  const { publishableKey } = getCredentials();

  return publishableKey;
}

// Use getStripeSecretKey() for server-side operations requiring the secret key
export async function getStripeSecretKey() {
  const { secretKey } = getCredentials();
  return secretKey;
}

// StripeSync singleton for webhook processing and data sync
let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
