import { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import StripeWrapper from '../events/StripeWrapper';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ServiceBooking, Service } from '@shared/schema';
import { formatPrice } from '@/lib/utils';
import { AlertCircle, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { reportPurchase } from '@/lib/adsTracking';


interface BookingPaymentProps {
  service: Service;
  bookingData: Partial<ServiceBooking>;
  onSuccess?: () => void;
}

export const BookingPayment = ({ service, bookingData, onSuccess }: BookingPaymentProps) => {
  const [clientSecret, setClientSecret] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const { toast } = useToast();

  // Check for and process pending booking data from localStorage (after iDEAL redirect)
  useEffect(() => {
    const checkPendingPayment = async () => {
      try {
        // Check for both the primary data object and backup flags
        const pendingDataString = localStorage.getItem('pendingBookingData');
        const idealPaymentPending = localStorage.getItem('idealPaymentPending');
        const idealPaymentId = localStorage.getItem('idealPaymentIntentId');
        const idealPaymentTimestamp = localStorage.getItem('idealPaymentTimestamp');
        
        // Log all available iDEAL payment data for debugging
        console.log("iDEAL payment check - status:", { 
          hasMainData: !!pendingDataString,
          idealPaymentPending,
          idealPaymentId,
          idealPaymentTimestamp: idealPaymentTimestamp ? new Date(parseInt(idealPaymentTimestamp)).toISOString() : null
        });
        
        if (!pendingDataString) {
          console.log("No pending booking data found in localStorage");
          
          // If we have the backup flags but no main data, log this error condition
          if (idealPaymentPending === 'true' && idealPaymentId) {
            console.error("Found iDEAL pending flag but missing main payment data. This indicates a storage corruption issue.");
            
            // Clear the backup data since it's orphaned
            localStorage.removeItem('idealPaymentPending');
            localStorage.removeItem('idealPaymentTimestamp');
            localStorage.removeItem('idealPaymentIntentId');
            
            toast({
              title: "Payment Data Issue",
              description: "We detected an incomplete payment record. If you completed a payment, please check your bookings to see if it was processed.",
              variant: "destructive"
            });
          }
          
          return false;
        }
        
        console.log("Raw pendingBookingData from localStorage:", pendingDataString);
        
        let pendingData;
        try {
          pendingData = JSON.parse(pendingDataString);
          console.log("Parsed pending booking data:", pendingData);
          
          // Validate that this is iDEAL payment data
          if (pendingData.paymentMethod === 'ideal' || 
              (pendingData.paymentMetadata && pendingData.paymentMetadata.paymentType === 'iDEAL')) {
            console.log("Confirmed iDEAL payment data format");
          } else {
            console.log("Payment data found but not explicitly marked as iDEAL:", pendingData);
          }
        } catch (parseError) {
          console.error("Error parsing pendingBookingData JSON:", parseError);
          localStorage.removeItem('pendingBookingData');
          localStorage.removeItem('idealPaymentPending');
          localStorage.removeItem('idealPaymentTimestamp');
          localStorage.removeItem('idealPaymentIntentId');
          console.log("Removed invalid pendingBookingData from localStorage");
          return false;
        }
        
        // Validate the stored data
        if (!pendingData || !pendingData.paymentIntentId || !pendingData.serviceId) {
          console.error("Invalid pendingData structure - missing required fields:", pendingData);
          localStorage.removeItem('pendingBookingData');
          console.log("Removed incomplete pendingBookingData from localStorage");
          return false;
        }
        
        // Check if this is for the current service
        if (pendingData.serviceId !== service.id) {
          console.log("Pending booking is for a different service:", pendingData.serviceId, "vs current:", service.id);
          return false;
        }
        
        // Check if the data is too old (more than 1 hour)
        const storedTime = pendingData.timestamp;
        const currentTime = Date.now();
        if (!storedTime || (currentTime - storedTime) > 3600000) {
          console.log("Pending booking data is expired - stored time:", storedTime ? new Date(storedTime).toISOString() : "null");
          localStorage.removeItem('pendingBookingData');
          console.log("Removed expired pendingBookingData from localStorage");
          return false;
        }
        
        console.log("Found valid pending booking data after payment redirect:", pendingData);
        
        // Log specific fields for debugging
        console.log("iDEAL payment details:", {
          paymentIntentId: pendingData.paymentIntentId,
          serviceId: pendingData.serviceId,
          isPaid: pendingData.isPaid,
          emailTrigger: pendingData.emailTrigger || false,
          status: pendingData.status || "payment_successful",
          timestamp: new Date(pendingData.timestamp).toISOString(),
          bookingDataFields: pendingData.bookingData ? Object.keys(pendingData.bookingData) : "missing"
        });
        
        // Validate booking data
        if (!pendingData.bookingData) {
          console.error("Missing bookingData in pendingData");
          localStorage.removeItem('pendingBookingData');
          console.log("Removed invalid pendingBookingData (missing bookingData) from localStorage");
          return false;
        }
        
        // Create the booking with the stored payment intent ID
        // Print the booking data being sent for debug purposes
        const bookingRequestData = {
          ...pendingData.bookingData,
          serviceId: service.id,
          paymentIntentId: pendingData.paymentIntentId,
          isPaid: true,
          // Include the user ID directly from the bookingData
          userId: pendingData.bookingData.userId,
          // Include the provider ID directly from the bookingData
          providerId: pendingData.bookingData.providerId || service.providerId,
          // Include emailTrigger and status from localStorage if present
          emailTrigger: true, // Always explicitly set to true for consistent behavior
          status: "payment_successful" // Always explicitly set to payment_successful to ensure emails are sent
        };
        console.log("Sending iDEAL booking request data:", bookingRequestData);
        
        try {
          // Add explicit emailTrigger=true parameter to trigger email sending
          // Also include status with "payment_successful" to ensure emails are sent
          const response = await fetch('/api/service-bookings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingRequestData)
          });

          console.log("iDEAL booking response status:", response.status);
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error("iDEAL booking creation error:", errorData);
            throw new Error(errorData.message || 'Payment was successful but booking creation failed');
          }
          
          // Get booking details for debugging
          const bookingResult = await response.json();
          console.log("iDEAL booking created successfully:", bookingResult);
          console.log("iDEAL booking result - isPaid:", bookingResult.isPaid, "status:", bookingResult.status);
          
          // Send analytics event for successful iDEAL booking
          console.log("iDEAL payment successful - booking created with ID:", bookingResult.id);
        } catch (fetchError) {
          console.error("Error during iDEAL booking fetch:", fetchError);
          throw fetchError;
        } finally {
          // Always remove all pending data and backup flags once processed to prevent duplication
          localStorage.removeItem('pendingBookingData');
          localStorage.removeItem('idealPaymentPending');
          localStorage.removeItem('idealPaymentTimestamp');
          localStorage.removeItem('idealPaymentIntentId');
          console.log("Removed all iDEAL payment data from localStorage after processing");
        }
        
        // Show success message
        toast({
          title: "Booking Confirmed",
          description: "Your payment was successful and booking has been confirmed. You'll receive an email confirmation shortly.",
          variant: "default"
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["/api/service-bookings"] });
        
        // Set payment success and redirect to the bookings page after a short delay
        setPaymentSuccess(true);
        
        // Add a slight delay before redirect to ensure toast is seen
        setTimeout(() => {
          window.location.href = '/bookings';
        }, 1500);
        
        return true;
      } catch (err: any) {
        console.error("Error processing pending payment:", err);
        
        // If we get an error, clean up all localStorage data to prevent getting stuck
        try {
          localStorage.removeItem('pendingBookingData');
          localStorage.removeItem('idealPaymentPending');
          localStorage.removeItem('idealPaymentTimestamp');
          localStorage.removeItem('idealPaymentIntentId');
          console.log("Removed all iDEAL payment data from localStorage after error");
        } catch (cleanupError) {
          console.error("Error cleaning up localStorage:", cleanupError);
        }
        
        return false;
      }
    };

    const createPaymentIntent = async () => {
      try {
        // First check if we have a pending payment from iDEAL redirect
        const pendingProcessed = await checkPendingPayment();
        if (pendingProcessed) return;
        
        // No pending payment, create a new payment intent
        const response = await fetch('/api/service-bookings/direct-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceId: service.id,
            amount: typeof service.price === 'number' ? Math.round(service.price * 100) : 100 // Convert to cents safely
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create payment intent');
        }

        const data = await response.json();
        
        if (data && data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error("No client secret returned from payment intent API");
        }
      } catch (err: any) {
        console.error('Payment intent creation error:', err);
        setError(err.message || "Failed to create payment intent");
        toast({
          title: "Payment Setup Error",
          description: err.message || "Failed to create payment intent",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (service && service.id) {
      createPaymentIntent();
    } else {
      setLoading(false);
      setError("Invalid service data");
    }
  }, [service, toast, bookingData]);

  if (paymentSuccess) {
    // Show success message and redirect to bookings page
    useEffect(() => {
      // Add slight delay before redirect to let the user see the success message
      const redirectTimer = setTimeout(() => {
        window.location.href = '/bookings';
      }, 2500);
      
      return () => clearTimeout(redirectTimer);
    }, []);
    
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
          <CheckCircle className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-semibold text-center">Payment Successful!</h2>
        <p className="text-gray-600 text-center">
          Your booking has been confirmed. You'll receive an email confirmation shortly.
        </p>
        <p className="text-gray-500 text-sm text-center">
          Redirecting to your bookings page...
        </p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Setting up payment form...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Payment Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!clientSecret) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Payment Unavailable</AlertTitle>
        <AlertDescription>Unable to initialize the payment system. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  return (
    <StripeWrapper clientSecret={clientSecret}>
      <PaymentForm 
        clientSecret={clientSecret}
        service={service}
        bookingData={bookingData}
        onSuccess={onSuccess}
      />
    </StripeWrapper>
  );
};

const PaymentForm = ({ 
  clientSecret,
  service, 
  bookingData, 
  onSuccess 
}: BookingPaymentProps & { clientSecret: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe not initialized");
      return;
    }

    setProcessing(true);

    try {
      // First submit the elements form to validate
      const submitResult = await elements.submit();
      if (submitResult.error) {
        console.error("Element validation error:", submitResult.error);
        throw submitResult.error;
      }
      
      console.log("Elements validated successfully, proceeding with payment confirmation");
      
      // Use a dedicated payment redirect URL that works for both regular and iDEAL payments
      const returnUrl = `${window.location.origin}/payments/redirect`;
      console.log("Using return URL for payments:", returnUrl);
      
      // Store service and booking data in localStorage for retrieval after redirect
      if (service && bookingData) {
        try {
          localStorage.setItem('pendingBookingData', JSON.stringify({
            serviceId: service.id,
            bookingData: bookingData,
            timestamp: Date.now(),
            paymentIntentId: clientSecret.split('_secret_')[0],
            redirectUrl: window.location.href // Save original URL for reference
          }));
          
          localStorage.setItem('idealPaymentPending', 'true');
          localStorage.setItem('idealPaymentIntentId', clientSecret.split('_secret_')[0]);
          localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
          
          console.log("Saved booking data to localStorage for redirect handling");
        } catch (err) {
          console.error("Failed to save booking data to localStorage:", err);
        }
      }
      
      // Then confirm the payment with the validated data
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl, // Use the payments/redirect URL for consistency
          payment_method_data: {
            billing_details: {} // Collect from form
          },
        },
        redirect: "if_required"
      });
      
      console.log("Payment confirmation result:", { 
        hasError: !!error, 
        errorType: error?.type,
        paymentIntentStatus: paymentIntent?.status,
        hasNextAction: !!paymentIntent?.next_action,
        nextActionType: paymentIntent?.next_action?.type
      });

      if (error) {
        throw error;
      }

      // Handle both successful payments and payments that need additional actions (like iDEAL)
      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "requires_capture" || 
          paymentIntent?.status === "processing" || paymentIntent?.next_action?.type === "redirect_to_url") {
        
        // For iDEAL and other payment methods that require additional actions
        if (paymentIntent?.next_action?.type === "redirect_to_url" && paymentIntent?.next_action?.redirect_to_url?.url) {
          console.log("Payment requires redirect:", paymentIntent.next_action.redirect_to_url.url);
          
          // First try to create the booking with the pending payment intent
          try {
            console.log("Attempting to create booking before redirect for iDEAL payment");
            
            // Prepare booking data with debug info
            const preRedirectBookingData = {
              ...bookingData,
              serviceId: service.id,
              paymentIntentId: paymentIntent.id,
              isPaid: true, // This matches credit card flow
              emailTrigger: true, // Explicitly request email to be sent
              status: "processing" // Add processing status for iDEAL payments
            };
            
            console.log("Pre-redirect booking request data:", preRedirectBookingData);
            
            const preRedirectResponse = await fetch('/api/service-bookings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(preRedirectBookingData)
            });
            
            console.log("Pre-redirect booking response status:", preRedirectResponse.status);
            
            if (preRedirectResponse.ok) {
              const preRedirectResult = await preRedirectResponse.json();
              console.log("Booking created before iDEAL redirect:", preRedirectResult);
              console.log("Pre-redirect booking result - isPaid:", preRedirectResult.isPaid, "status:", preRedirectResult.status);
            } else {
              const errorData = await preRedirectResponse.json();
              console.error("Failed to create booking before iDEAL redirect:", errorData);
            }
          } catch (preRedirectError) {
            console.error("Error creating booking before iDEAL redirect:", preRedirectError);
            // Continue with redirect even if pre-booking fails
          }
          
          // Store enhanced booking data and payment intent in localStorage for retrieval after redirect
          const pendingData = {
            bookingData,
            serviceId: service.id,
            paymentIntentId: paymentIntent.id,
            isPaid: true,
            emailTrigger: true, // Add explicit email trigger flag to localStorage data
            status: "pending_ideal", // Specific status for iDEAL payments
            paymentMethod: "ideal", // Explicitly record the payment method
            redirectUrl: paymentIntent.next_action.redirect_to_url.url,
            timestamp: Date.now(),
            paymentAmount: service.price ? Math.round(parseFloat(service.price.toString()) * 100) : 0,
            serviceName: service.name,
            paymentMetadata: {
              paymentType: "iDEAL",
              currency: paymentIntent.currency || "eur",
              clientSecret: clientSecret.split('_secret_')[0] + '_secret_[REDACTED]' // Store partial client secret for debug - redact sensitive part
            }
          };
          
          console.log("Storing enhanced pending booking data for iDEAL payment:", pendingData);
          
          // Clear any existing pending data to avoid conflicts
          localStorage.removeItem('pendingBookingData');
          
          try {
            localStorage.setItem('pendingBookingData', JSON.stringify(pendingData));
            console.log("Successfully stored pending payment data in localStorage");
            
            // Also store backup flags to help with troubleshooting
            localStorage.setItem('idealPaymentPending', 'true');
            localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
            localStorage.setItem('idealPaymentIntentId', paymentIntent.id);
            
            // Pre-check to ensure we can access the enhanced endpoint for better diagnostics
            try {
              const checkEndpoint = await fetch(`/api/ideal-payment-status/${paymentIntent.id}`);
              if (checkEndpoint.ok) {
                console.log("✅ iDEAL payment validation endpoint is accessible");
                const statusData = await checkEndpoint.json();
                console.log("Initial payment status:", statusData.status);
              } else {
                console.warn("⚠️ iDEAL payment validation endpoint returned error:", 
                  await checkEndpoint.text());
              }
            } catch (endpointError) {
              console.error("❌ Could not verify iDEAL payment endpoint:", endpointError);
              // Continue with redirect even if validation endpoint check fails
            }
          } catch (storageError) {
            console.error("Error storing payment data in localStorage:", storageError);
          }
          
          // Modify the redirect URL to go through our custom redirect handler
          // This extracts the original redirect URL from the payment intent
          let redirectUrl = paymentIntent.next_action.redirect_to_url.url;
          
          // Find the return_url parameter in the original redirect URL
          const originalUrl = new URL(redirectUrl);
          const returnUrlParam = originalUrl.searchParams.get('return_url');
          
          if (returnUrlParam) {
            // Parse the return URL
            const returnUrl = new URL(returnUrlParam);
            
            // Extract the payment intent ID from the return URL
            const paymentIntentId = returnUrl.searchParams.get('payment_intent');
            
            if (paymentIntentId) {
              console.log(`Using custom redirect handler for iDEAL payment: ${paymentIntentId}`);
              
              // Use our custom API endpoint as the return URL in the redirect
              // Include the source=ideal parameter to help identify this as an iDEAL payment
              const newReturnUrl = `${window.location.origin}/api/ideal-payment-redirect/${paymentIntentId}?source=ideal`;
              
              // Update the return_url parameter in the original redirect URL
              originalUrl.searchParams.set('return_url', newReturnUrl);
              
              // Use the modified URL for the redirect
              redirectUrl = originalUrl.toString();
              console.log("Modified redirect URL with custom return handler:", redirectUrl);
            }
          }
          
          // Redirect to the payment provider's page (possibly with our modified return URL)
          window.location.href = redirectUrl;
          return;
        }
        
        // Create booking after successful payment
        console.log("Creating booking after successful direct payment");
        
        // Prepare booking data with debug info
        const directPaymentBookingData = {
          ...bookingData,
          serviceId: service.id,
          paymentIntentId: paymentIntent.id,
          isPaid: true, // Add isPaid flag to trigger direct payment flow
          emailTrigger: true, // Explicitly set email trigger flag
          status: "payment_successful" // Set consistent status for successful payments
        };
        
        console.log("Direct payment booking request data:", directPaymentBookingData);
        
        const response = await fetch('/api/service-bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(directPaymentBookingData)
        });

        console.log("Direct payment booking response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Direct payment booking creation error:", errorData);
          throw new Error(errorData.message || 'Payment was successful but booking creation failed');
        }

        // Get the created booking data
        const bookingResult = await response.json();
        console.log("Booking created successfully:", bookingResult);
        console.log("Direct payment booking result - isPaid:", bookingResult.isPaid, "status:", bookingResult.status);
        
        // Detailed logging to track email triggers
        console.log("Booking payment data (with isPaid and emailTrigger):", {
          paymentIntent: paymentIntent.id,
          serviceId: service.id,
          isPaid: true,
          emailTrigger: true,
          status: "payment_successful",
          bookingData
        });

        toast({
          title: "Booking Confirmed",
          description: "Your payment was successful and booking has been confirmed. You'll receive an email confirmation shortly.",
          variant: "default"
        });

        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ["/api/service-bookings"] });

        // Google Ads purchase conversion. Use the Stripe payment intent id as the
        // transaction id so duplicate iDEAL/3DS callbacks don't double-report.
        reportPurchase({
          value: typeof service.price === "number" ? service.price : (service.price ? parseFloat(service.price.toString()) : undefined),
          currency: "EUR",
          transactionId: paymentIntent?.id || undefined,
          conversionType: "service_booking",
        });
        
        // Redirect to the bookings page
        window.location.href = '/bookings';
        
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Payment Status",
          description: `Payment status: ${paymentIntent?.status || 'unknown'}. Please contact support if you see this message.`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      
      // Detailed error handling
      let errorMessage = "An unexpected error occurred";
      let errorTitle = "Payment Error";
      
      if (err.type === 'validation_error') {
        errorMessage = "Please check your payment information and try again.";
        errorTitle = "Invalid Payment Information";
      } else if (err.type === 'card_error') {
        errorMessage = err.message || "Your card was declined. Please try another payment method.";
        errorTitle = "Card Declined";
      } else if (err.code === 'incomplete_payment_details') {
        errorMessage = "Please select a payment method to pay with.";
        errorTitle = "Payment Information Required";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-full md:max-w-3xl mx-auto">
      <Alert className="bg-primary/10 border-primary/20">
        <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
        <AlertDescription className="text-sm sm:text-base">
          Please complete your payment information below to confirm your booking.
        </AlertDescription>
      </Alert>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-2 sm:p-4 rounded-md bg-white">
          <PaymentElement />
        </div>
        <Button 
          type="submit" 
          className="w-full text-base md:text-lg py-2 md:py-3"
          disabled={!stripe || processing}
        >
          {processing ? (
            <span className="flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
              Processing Payment...
            </span>
          ) : (
            "Complete Payment"
          )}
        </Button>
      </form>
    </div>
  );
};

export default BookingPayment;