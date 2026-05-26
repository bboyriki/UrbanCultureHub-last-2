
import { useLocation, useSearch } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { reportPurchase } from '@/lib/adsTracking';

export default function TicketSuccess() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const search = useSearch();
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [isPolling, setIsPolling] = useState(true);
  const [failedEventId, setFailedEventId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const ticketId = params.get('ticketId');
    const paymentIntentId = params.get('paymentIntentId');
    // Stripe appends these when redirecting back from bank payment
    const redirectStatus = params.get('redirect_status');
    const paymentIntent = params.get('payment_intent');

    // Use payment_intent param from Stripe redirect if paymentIntentId not set
    const intentId = paymentIntentId || paymentIntent;

    // If Stripe redirected back with a failed status, show retry instead of polling
    if (redirectStatus && redirectStatus !== 'succeeded') {
      setPaymentFailed(true);
      setIsPolling(false);
      setError('Your payment was not completed. Please try again.');
      return;
    }

    if (ticketId) {
      fetch(`/api/tickets/${ticketId}`)
        .then(res => res.json())
        .then(data => {
          setTicket(data);
          setIsPolling(false);
          if (data && data.id) {
            reportPurchase({
              value: typeof data.purchaseAmount === "number" ? data.purchaseAmount / 100 : undefined,
              currency: "EUR",
              transactionId: `ticket:${data.id}`,
              conversionType: "ticket",
              userId: user?.id,
            });
          }
        })
        .catch(() => { setError('Failed to load ticket'); setIsPolling(false); });
    } else if (intentId) {
      let attempts = 0;
      const maxAttempts = 15;

      const pollForTicket = async () => {
        try {
          const res = await fetch(`/api/tickets/by-payment-intent/${intentId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.id) {
              setTicket(data);
              setIsPolling(false);
              setError(null);
              reportPurchase({
                value: typeof data.purchaseAmount === "number" ? data.purchaseAmount / 100 : undefined,
                currency: "EUR",
                transactionId: `ticket:${data.id}`,
                conversionType: "ticket",
                userId: user?.id,
              });
              return;
            }
          }
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(pollForTicket, 1500);
          } else {
            setIsPolling(false);
            setError('Your ticket is being processed. Please check your email or visit your tickets page in a moment.');
          }
        } catch {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(pollForTicket, 1500);
          } else {
            setIsPolling(false);
            setError('Your ticket is being processed. Please check your email or visit your tickets page in a moment.');
          }
        }
      };

      pollForTicket();
    } else {
      setIsPolling(false);
      setError('No ticket information found');
    }
  }, [search]);

  if (isPolling) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Confirming your payment...</p>
        <p className="text-sm text-muted-foreground">This will only take a moment.</p>
      </div>
    );
  }

  if (paymentFailed) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" /> Payment Not Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your payment was cancelled or failed. No charge was made.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => navigate('/events')}>
                Back to Events
              </Button>
              <Button variant="outline" onClick={() => navigate('/profile/tickets')}>
                My Tickets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            {error && !ticket ? (
              <><AlertCircle className="h-6 w-6 text-amber-500" /> Processing Payment</>
            ) : (
              <><Check className="h-6 w-6 text-green-500" /> Ticket Purchase Successful</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {error && !ticket ? (
            <p className="mb-6 text-amber-600">{error}</p>
          ) : (
            <p className="mb-6">
              Your ticket has been purchased. A confirmation email has been sent to your email address.
            </p>
          )}

          {ticket && (
            <div className="mb-6 p-4 bg-secondary rounded-lg text-left">
              <h3 className="font-semibold mb-3">Ticket Details</h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Ticket ID:</span> #{ticket.id}</p>
                {ticket.event && (
                  <>
                    <p><span className="text-muted-foreground">Event:</span> {ticket.event.title}</p>
                    <p><span className="text-muted-foreground">Date:</span> {new Date(ticket.event.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p><span className="text-muted-foreground">Location:</span> {ticket.event.location}</p>
                  </>
                )}
                <p><span className="text-muted-foreground">Quantity:</span> {ticket.ticketQuantity}</p>
                <p><span className="text-muted-foreground">Amount paid:</span> €{(ticket.purchaseAmount / 100).toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            {ticket ? (
              <>
                <Button onClick={() => navigate(`/tickets/${ticket.id}`)}>
                  View Ticket
                </Button>
                <Button variant="outline" onClick={() => navigate('/profile/tickets')}>
                  All My Tickets
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/profile/tickets')}>
                  View My Tickets
                </Button>
                <Button variant="outline" onClick={() => navigate('/events')}>
                  Back to Events
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
