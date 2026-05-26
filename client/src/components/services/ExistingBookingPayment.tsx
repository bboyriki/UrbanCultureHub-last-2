import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Service, ServiceBooking } from '@shared/schema';
import StripeWrapper from '../events/StripeWrapper';

export interface ExistingBookingPaymentProps {
  booking: ServiceBooking;
  service: Service;
  onPaymentSuccess: () => void;
}

export function ExistingBookingPayment({ booking, service, onPaymentSuccess }: ExistingBookingPaymentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const createPaymentIntent = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/service-bookings/${booking.id}/payment-intent`);
      return response.json();
    },
  });

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      if (!stripe || !elements) {
        throw new Error('Stripe has not been initialized');
      }
      
      const cardElement = elements.getElement(CardElement);
      
      if (!cardElement) {
        throw new Error('Card element not found');
      }
      
      // Create payment intent
      const { clientSecret } = await createPaymentIntent.mutateAsync();
      
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });
      
      if (stripeError) {
        throw new Error(stripeError.message);
      }
      
      if (paymentIntent.status === 'succeeded') {
        toast({
          title: 'Payment Successful',
          description: 'Your booking has been confirmed and is awaiting approval. You\'ll receive an email confirmation shortly.',
        });
        
        console.log("Updating booking with payment data:", {
          bookingId: booking.id,
          paymentIntentId: paymentIntent.id,
          status: 'payment_successful',
          isPaid: true
        });
        
        // Update the booking status with API
        await apiRequest('POST', `/api/service-bookings/${booking.id}/payment`, {
          paymentIntentId: paymentIntent.id,
          status: 'payment_successful',
          isPaid: true // Add isPaid flag to ensure email sending is triggered
        });
        
        // Invalidate queries to refresh bookings data
        queryClient.invalidateQueries({ queryKey: ["/api/service-bookings"] });
        
        // Call the success callback
        onPaymentSuccess();
        
        // Redirect to the bookings page
        window.location.href = '/bookings';
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: 'Payment Failed',
        description: err instanceof Error ? err.message : 'There was an issue processing your payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="max-w-full sm:max-w-md md:max-w-lg mx-auto">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl md:text-2xl text-center">Complete Payment</CardTitle>
        <CardDescription className="text-sm md:text-base text-center">Make a secure payment to confirm your booking</CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-5">
          <div className="font-medium text-sm mb-1 text-muted-foreground">Amount Due:</div>
          <div className="text-xl sm:text-2xl font-bold">{formatPrice(Number(booking.totalPrice))}</div>
        </div>
        <div className="space-y-4">
          <div className="border rounded-md p-3 sm:p-4 bg-white">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
              }}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded-md">{error}</div>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 sm:p-6 pt-2">
        <Button 
          className="w-full py-2 sm:py-3 text-base" 
          onClick={handlePayment}
          disabled={isProcessing || !stripe || !elements}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> 
              Processing Payment...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" /> 
              Complete Payment
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ExistingBookingPaymentWithStripe(props: ExistingBookingPaymentProps) {
  return (
    <div className="max-w-full sm:max-w-xl md:max-w-2xl mx-auto p-4">
      <h2 className="text-xl md:text-2xl font-semibold text-center mb-4">Complete Your Booking Payment</h2>
      <StripeWrapper>
        <ExistingBookingPayment {...props} />
      </StripeWrapper>
      <p className="text-xs text-center mt-4 text-muted-foreground">
        Your payment is processed securely by Stripe
      </p>
    </div>
  );
}

export default ExistingBookingPaymentWithStripe;