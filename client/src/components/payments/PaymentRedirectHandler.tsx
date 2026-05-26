import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { reportPurchase } from "@/lib/adsTracking";

/**
 * This component handles payment redirects from iDEAL and other redirect-based payment methods.
 * It intercepts URL parameters after a redirect from Stripe and processes the pending payment.
 * It's designed to be mounted at the app level to catch redirects from any page.
 */
export default function PaymentRedirectHandler() {
  // Navigation and UI hooks
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Payment processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'checking' | 'failed' | 'success'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  useEffect(() => {
    // Check if there's pending payment data to process
    const processPendingPayment = async () => {
      try {
        setProcessingStatus('checking');
        setStatusMessage('Reading payment data...');
        
        // Check for both main pendingBookingData and backup flags
        const pendingBookingDataString = localStorage.getItem('pendingBookingData');
        const pendingProductDataString = localStorage.getItem('pendingProductData');
        const idealPaymentPending = localStorage.getItem('idealPaymentPending');
        const idealPaymentId = localStorage.getItem('idealPaymentIntentId');
        const idealPaymentTimestamp = localStorage.getItem('idealPaymentTimestamp');
        
        // Get URL parameters for direct payment validation
        const urlParams = new URLSearchParams(window.location.search);
        const urlPaymentIntentId = urlParams.get('payment_intent');
        const redirectStatus = urlParams.get('redirect_status');
        const paymentSource = urlParams.get('source');
        
        // Check if this is a product purchase rather than a booking
        const productId = urlParams.get('product');
        const quantity = urlParams.get('quantity');
        const isProductPurchase = !!productId && !!quantity;
        
        console.log("Payment processing - data sources:", {
          hasPendingBookingData: !!pendingBookingDataString,
          hasPendingProductData: !!pendingProductDataString,
          idealPaymentPending,
          idealPaymentId,
          idealPaymentTimestamp,
          urlPaymentIntentId,
          redirectStatus,
          paymentSource,
          isProductPurchase
        });
        
        // If we have a direct URL payment intent and it's iDEAL, we need to handle it even if no pendingBookingData
        const isDirectIdealRedirect = (paymentSource === 'ideal' || idealPaymentPending === 'true') && urlPaymentIntentId;
        
        // Check for successful redirect
        if (redirectStatus === 'succeeded' || redirectStatus === 'success') {
          console.log("URL indicates successful payment redirected from bank");
          setStatusMessage('Payment successful! Processing your booking...');
        }
        
        if (!pendingBookingDataString && !pendingProductDataString) {
          console.log("No pending payment data found in localStorage");
          
          // Check if this is a direct iDEAL payment redirect from URL
          if (isDirectIdealRedirect) {
            console.log("Detected direct iDEAL payment redirect with payment_intent:", urlPaymentIntentId);
            setStatusMessage(`Detected iDEAL payment redirect. Processing...`);
            
            // Try to handle the direct iDEAL redirect
            const paymentId = urlPaymentIntentId;
            
            if (paymentId) {
              try {
                // Try to get payment status and metadata
                const statusResponse = await fetch(`/api/ideal-payment-status/${paymentId}`);
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  console.log("Retrieved iDEAL payment status:", statusData);
                  
                  if (statusData.status === 'succeeded') {
                    // Check if the payment intent has metadata we can use to create the booking
                    if (statusData.metadata && statusData.metadata.serviceId) {
                      setStatusMessage('Payment confirmed! Attempting to create your booking...');
                      
                      // Construct booking data from metadata
                      const bookingData = {
                        serviceId: parseInt(statusData.metadata.serviceId),
                        paymentIntentId: paymentId,
                        isPaid: true,
                        emailTrigger: true,
                        status: "payment_successful",
                        userId: statusData.metadata.userId ? parseInt(statusData.metadata.userId) : undefined,
                        startTime: statusData.metadata.startTime,
                        endTime: statusData.metadata.endTime
                      };
                      
                      console.log("Creating booking from iDEAL payment metadata:", bookingData);
                      
                      // Try to create the booking
                      try {
                        const response = await fetch('/api/service-bookings', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify(bookingData)
                        });
                        
                        if (response.ok) {
                          const bookingResult = await response.json();
                          console.log("Successfully created booking from iDEAL redirect:", bookingResult);
                          
                          setProcessingStatus('success');
                          setStatusMessage('Your booking has been successfully created!');

                          // Google Ads purchase conversion (iDEAL direct flow).
                          reportPurchase({
                            value: typeof statusData?.amount === "number" ? statusData.amount / 100 : undefined,
                            currency: (statusData?.currency || "EUR").toUpperCase(),
                            transactionId: paymentId,
                            conversionType: "service_booking",
                          });
                          
                          // Show toast and redirect
                          toast({
                            title: "Booking Successful",
                            description: "Your payment has been processed and booking created.",
                            variant: "default"
                          });
                          
                          setTimeout(() => {
                            navigate("/bookings");
                          }, 2000);
                          
                        } else {
                          const error = await response.json();
                          console.error("Failed to create booking:", error);
                          throw new Error(error.message || "Booking creation failed");
                        }
                      } catch (bookingError) {
                        console.error("Error creating booking from iDEAL metadata:", bookingError);
                        setProcessingStatus('failed');
                        setStatusMessage(`Payment verified but booking creation failed. Please contact support with reference: ${paymentId}`);
                      }
                    } else {
                      setProcessingStatus('failed');
                      setStatusMessage(`Payment successful but insufficient data to create booking. Please contact support with reference: ${paymentId}`);
                    }
                  } else {
                    setProcessingStatus('failed');
                    setStatusMessage(`Payment verification failed: ${statusData.status}. Please try booking again.`);
                  }
                } else {
                  throw new Error("Payment status check failed");
                }
              } catch (statusError) {
                console.error("Error checking iDEAL payment status:", statusError);
                setProcessingStatus('failed');
                setStatusMessage(`Unable to verify your payment. Please contact support with reference: ${paymentId}`);
              }
              
              setIsProcessing(false);
              return;
            }
          }
          
          // If we have the backup flags but no main data, something's wrong
          if (idealPaymentPending === 'true' && (idealPaymentId || urlPaymentIntentId)) {
            console.warn("Found iDEAL pending flag but missing main payment data. This might be fixable.");
            setStatusMessage(`Attempting to recover payment data...`);
            
            // Wait briefly to show the message
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try to get payment status from payment_intent ID 
            const paymentId = idealPaymentId || urlPaymentIntentId;
            if (paymentId) {
              try {
                const statusResponse = await fetch(`/api/ideal-payment-status/${paymentId}`);
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  console.log("Retrieved payment status:", statusData);
                  
                  if (statusData.status === 'succeeded') {
                    setStatusMessage('Payment confirmed! Creating your booking...');
                    // Continue with booking creation using the payment ID
                  } else {
                    setProcessingStatus('failed');
                    setStatusMessage(`Payment verification failed: ${statusData.status}. Please try booking again.`);
                  }
                } else {
                  throw new Error("Payment status check failed");
                }
              } catch (statusError) {
                console.error("Error checking payment status:", statusError);
                setProcessingStatus('failed');
                setStatusMessage(`Unable to verify your payment. Please contact support with reference: ${paymentId}`);
              }
            }
          } else {
            setProcessingStatus('failed');
            setStatusMessage('No payment data found. Please return to service booking.');
          }
          
          setIsProcessing(false);
          return;
        }

        // Parse the stored data
        let pendingData;
        try {
          // Check if we have product data or booking data
          if (pendingProductDataString) {
            pendingData = JSON.parse(pendingProductDataString);
            console.log("Found pending product order data:", pendingData);
          } else {
            pendingData = JSON.parse(pendingBookingDataString);
            console.log("Found pending booking data:", pendingData);
          }
          
          // Validate that this is iDEAL payment data
          if (pendingData.paymentMethod === 'ideal' || 
              (pendingData.paymentMetadata && pendingData.paymentMetadata.paymentType === 'iDEAL')) {
            console.log("Confirmed iDEAL payment data format");
          } else {
            console.log("Payment data found but not explicitly marked as iDEAL:", pendingData);
          }
        } catch (parseError) {
          console.error("Error parsing pending payment data:", parseError);
          localStorage.removeItem('pendingBookingData');
          localStorage.removeItem('idealPaymentPending');
          localStorage.removeItem('idealPaymentTimestamp');
          localStorage.removeItem('idealPaymentIntentId');
          
          setProcessingStatus('failed');
          setStatusMessage('Invalid payment data format.');
          return;
        }
        
        // Validate if it's recent (less than 1 hour old)
        const now = Date.now();
        const timestamp = pendingData.timestamp || 0;
        if (now - timestamp > 3600000) { // 1 hour in milliseconds
          console.log("Pending payment data is too old, removing it");
          localStorage.removeItem('pendingBookingData');
          setProcessingStatus('failed');
          setStatusMessage('Payment session expired. Please start a new booking.');
          return;
        }

        // Verify required fields based on payment type
        if (pendingProductDataString) {
          // Product order validation 
          if (!pendingData.productId || !pendingData.quantity || !pendingData.paymentIntentId) {
            console.error("Pending product order data is missing required fields");
            localStorage.removeItem('pendingProductData');
            setProcessingStatus('failed');
            setStatusMessage('Incomplete product order data. Required fields are missing.');
            return;
          }
        } else {
          // Service booking validation
          if (!pendingData.serviceId || !pendingData.paymentIntentId) {
            console.error("Pending booking data is missing required fields");
            localStorage.removeItem('pendingBookingData');
            setProcessingStatus('failed');
            setStatusMessage('Incomplete booking data. Required fields are missing.');
            return;
          }
        }
        
        // Prevent redirect loops by checking if we're already processing
        if (isProcessing) return;
        setIsProcessing(true);
        
        // Log redirectUrl if it exists (helpful for debugging)
        if (pendingData.redirectUrl) {
          console.log("Original redirect URL was:", pendingData.redirectUrl);
        }
        
        setStatusMessage('Verifying payment status...');
        
        // Check payment status using our enhanced status endpoints
        let paymentStatusVerified = false;
        try {
          console.log(`Checking payment intent status for: ${pendingData.paymentIntentId}`);
          
          // Try the enhanced iDEAL specific payment intent status endpoint first
          let statusResponse = await fetch(`/api/ideal-payment-status/${pendingData.paymentIntentId}?t=${Date.now()}`);
          
          // First fallback to generic status endpoint
          if (!statusResponse.ok) {
            console.log("iDEAL specific payment endpoint failed, trying standard status endpoint...");
            statusResponse = await fetch(`/api/payment-intent-status/${pendingData.paymentIntentId}?t=${Date.now()}`);
          }
          
          // Second fallback to the legacy endpoint if both enhanced endpoints fail
          if (!statusResponse.ok) {
            console.log("Standard payment intent status endpoint failed, trying legacy endpoint...");
            statusResponse = await fetch(`/api/payment-intents/${pendingData.paymentIntentId}/status?t=${Date.now()}`);
          }
          
          if (!statusResponse.ok) {
            throw new Error(`Failed to check payment status: ${statusResponse.status} ${statusResponse.statusText}`);
          }
          
          const statusData = await statusResponse.json();
          console.log("Payment status response:", statusData);
          
          // Check if this intent already has an associated booking
          if (statusData.hasBooking && statusData.bookingDetails) {
            console.log("Payment intent already has an associated booking:", statusData.bookingDetails);
            
            // Show a toast with the info
            toast({
              title: "Booking Already Exists",
              description: "This payment has already been processed and a booking exists.",
              variant: "default"
            });
            
            // Wait 1.5 seconds then redirect to the booking
            setProcessingStatus('success');
            setStatusMessage('Your booking already exists! Redirecting you to your bookings page...');
            
            setTimeout(() => {
              navigate(`/bookings?bookingId=${statusData.bookingDetails.bookingId}`);
            }, 1500);
            
            // Clean up and exit
            localStorage.removeItem('pendingBookingData');
            setIsProcessing(false);
            return;
          }
          
          // Check payment status and respond appropriately
          if (statusData.status !== 'succeeded' && 
              statusData.status !== 'processing' && 
              statusData.status !== 'requires_capture') {
              
            console.warn(`Payment not successful, current status: ${statusData.status}`);
            
            // Handle different status codes with specific messages
            let statusMessage = "Your payment could not be completed.";
            if (statusData.status === 'requires_payment_method') {
              statusMessage = "Your payment method was declined. Please try another payment method.";
            } else if (statusData.status === 'canceled') {
              statusMessage = "This payment was canceled.";
            } else if (statusData.status === 'requires_confirmation') {
              statusMessage = "Payment requires confirmation from the payment provider.";
            } else if (statusData.status === 'requires_action') {
              statusMessage = "Your payment requires additional action. Please check your email or try again.";
            } else {
              statusMessage = `Payment status: ${statusData.status}. Please contact support if this issue persists.`;
            }
            
            // Show toast notification
            toast({
              title: "Payment Not Completed",
              description: statusMessage,
              variant: "destructive"
            });
            
            // Set failed state
            setProcessingStatus('failed');
            setStatusMessage(statusMessage);
            localStorage.removeItem('pendingBookingData');
            setIsProcessing(false);
            return;
          }
          
          console.log(`Payment confirmed with status: ${statusData.status}`);
          paymentStatusVerified = true;
          // Set pendingData.status from the API response for record-keeping
          pendingData.status = statusData.status;
          
          // Add payment metadata if available
          if (statusData.metadata) {
            console.log("Payment intent has metadata:", statusData.metadata);
            pendingData.metadata = statusData.metadata;
          }
          
        } catch (statusError) {
          console.error("Error checking payment status:", statusError);
          toast({
            title: "Payment Status Check Failed",
            description: "Couldn't verify payment status, but proceeding with transaction completion.",
            variant: "default"
          });
          // We'll continue with transaction processing even if status check fails
          // This fallback helps when the backend status endpoint has issues
        }
        
        // Handle different transaction types (product order vs service booking)
        let orderData = null;
        let bookingData = null;
        
        if (pendingProductDataString) {
          // Product order flow
          // Prepare order data with all needed flags
          orderData = {
            productId: pendingData.productId,
            quantity: pendingData.quantity,
            paymentIntentId: pendingData.paymentIntentId,
            isPaid: true,
            emailTrigger: true, // Ensure email notifications are sent
            status: "processing",
            totalAmount: pendingData.totalAmount || pendingData.amount,
            shippingAddress: pendingData.shippingAddress || "",
            buyerDetails: pendingData.buyerDetails || {}
          };
          
          console.log("Creating order after redirect with data:", orderData);
          
          setStatusMessage('Creating your order...');
        } else {
          // Service booking flow
          // Prepare booking data with all needed flags
          bookingData = {
            ...(pendingData.bookingData || {}),
            serviceId: pendingData.serviceId,
            paymentIntentId: pendingData.paymentIntentId,
            isPaid: true,
            emailTrigger: true, // Ensure email notifications are sent
            status: "payment_successful"
          };
          
          console.log("Creating booking after redirect with data:", bookingData);
          
          setStatusMessage('Creating your booking...');
        }
        
        // Create the transaction record with retry logic
        let response;
        let retryCount = 0;
        const maxRetries = 2; // Try up to 3 times total (initial + 2 retries)
        
        while (retryCount <= maxRetries) {
          try {
            if (pendingProductDataString) {
              // Product order creation
              response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
              });
            } else {
              // Service booking creation
              response = await fetch('/api/service-bookings', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
              });
            }
            
            // If successful, break out of the retry loop
            if (response.ok) {
              break;
            }
            
            // If we get here, the request failed but returned a response
            const errorData = await response.json();
            
            if (pendingProductDataString) {
              console.error(`Order creation attempt ${retryCount + 1} failed:`, errorData);
              
              // Check if this is a duplicate order error (which means it actually succeeded)
              if (errorData.message && errorData.message.includes('duplicate')) {
                console.log("Detected duplicate order - this likely means the order was already created");
                
                // Let's try to fetch the existing order instead
                try {
                  const existingOrders = await fetch(`/api/orders?paymentIntentId=${pendingData.paymentIntentId}`);
                  const ordersData = await existingOrders.json();
                  
                  if (ordersData && ordersData.length > 0) {
                    console.log("Found existing order:", ordersData[0]);
                    // Use the existing order as our success result
                    response = {
                      ok: true,
                      json: () => Promise.resolve(ordersData[0])
                    };
                    break;
                  }
                } catch (findError) {
                  console.error("Error finding existing order:", findError);
                }
              }
            } else {
              console.error(`Booking creation attempt ${retryCount + 1} failed:`, errorData);
              
              // Check if this is a duplicate booking error (which means it actually succeeded)
              if (errorData.message && errorData.message.includes('duplicate')) {
                console.log("Detected duplicate booking - this likely means the booking was already created");
                
                // Let's try to fetch the existing booking instead
                try {
                  const existingBookings = await fetch(`/api/service-bookings?serviceId=${pendingData.serviceId}&paymentIntentId=${pendingData.paymentIntentId}`);
                  const bookingsData = await existingBookings.json();
                  
                  if (bookingsData && bookingsData.length > 0) {
                    console.log("Found existing booking:", bookingsData[0]);
                    // Use the existing booking as our success result
                    response = {
                      ok: true,
                      json: () => Promise.resolve(bookingsData[0])
                    };
                    break;
                  }
                } catch (findError) {
                  console.error("Error finding existing booking:", findError);
                }
              }
            }
            
            // If we've reached the max retries, let the error handling below take over
            if (retryCount === maxRetries) {
              break;
            }
            
            // Otherwise, increment retry count and wait before trying again
            retryCount++;
            setStatusMessage(`Retrying booking creation (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
            
          } catch (fetchError) {
            console.error(`Booking creation network error on attempt ${retryCount + 1}:`, fetchError);
            
            // If we've reached the max retries, break and let error handling below take over
            if (retryCount === maxRetries) {
              break;
            }
            
            // Otherwise, increment retry count and wait before trying again
            retryCount++;
            setStatusMessage(`Network error, retrying (attempt ${retryCount + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
        }
        
        // After all retry attempts, check if we have a successful response
        if (!response || !response.ok) {
          let errorMessage = pendingProductDataString 
            ? "There was an error creating your order after payment."
            : "There was an error creating your booking after payment.";
          try {
            if (response) {
              const errorData = await response.json();
              errorMessage = errorData.message || errorMessage;
              
              // Special handling for iDEAL payments - check if this might be a duplicate booking error
              if (pendingData.paymentMethod === 'ideal' || 
                  (pendingData.paymentMetadata && pendingData.paymentMetadata.paymentType === 'iDEAL')) {
                console.log("[iDEAL] Error might be related to duplicate booking, trying to find existing booking");
                
                // For iDEAL payments, check if a booking already exists despite the error
                // This is a common issue with redirect-based payment methods
                try {
                  // Check if a booking with this payment intent exists
                  const existingBookingCheck = await fetch(`/api/service-bookings?paymentIntentId=${pendingData.paymentIntentId}`);
                  if (existingBookingCheck.ok) {
                    const existingBookings = await existingBookingCheck.json();
                    if (existingBookings && existingBookings.length > 0) {
                      console.log("[iDEAL] Found existing booking despite error:", existingBookings[0]);
                      
                      // Show success message instead of error
                      toast({
                        title: "Booking Already Exists",
                        description: "Your booking was already created successfully. Redirecting to your bookings.",
                        variant: "default"
                      });
                      
                      // Clean up localStorage
                      localStorage.removeItem('pendingBookingData');
                      localStorage.removeItem('idealPaymentPending');
                      localStorage.removeItem('idealPaymentTimestamp');
                      localStorage.removeItem('idealPaymentIntentId');
                      
                      // Redirect to bookings page
                      setTimeout(() => {
                        navigate('/bookings');
                      }, 1500);
                      
                      return;
                    }
                  }
                } catch (checkError) {
                  console.error("[iDEAL] Error checking for existing bookings:", checkError);
                }
              }
            }
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
          
          console.error("Failed to create transaction record after all retry attempts");
          toast({
            title: pendingProductDataString ? "Order Creation Failed" : "Booking Creation Failed",
            description: errorMessage,
            variant: "destructive"
          });
          
          setProcessingStatus('failed');
          setStatusMessage(`${errorMessage} Your payment has been processed but we couldn't create your record. Please contact support with your payment ID: ${pendingData.paymentIntentId}`);
          setIsProcessing(false);
          return;
        }
        
        const bookingResult = await response.json();
        console.log("Booking created successfully after redirect:", bookingResult);
        
        // Clear all stored payment data including backup flags to prevent duplicate processing
        localStorage.removeItem('pendingBookingData');
        localStorage.removeItem('pendingProductData');
        localStorage.removeItem('idealPaymentPending');
        localStorage.removeItem('idealPaymentTimestamp');
        localStorage.removeItem('idealPaymentIntentId');

        // Google Ads purchase conversion (general iDEAL/redirect success path).
        // bookingResult is the API response from /api/orders or /api/service-bookings;
        // its totalAmount is a string in EUR (e.g. "57.00"), not cents.
        const rawTotal: unknown = (bookingResult as any)?.totalAmount ?? (bookingResult as any)?.paymentAmount;
        const purchaseValue = typeof rawTotal === "string"
          ? parseFloat(rawTotal)
          : (typeof rawTotal === "number" ? rawTotal : undefined);
        reportPurchase({
          value: typeof purchaseValue === "number" && !isNaN(purchaseValue) ? purchaseValue : undefined,
          currency: "EUR",
          transactionId: (pendingData as any)?.paymentIntentId,
          conversionType: pendingProductDataString ? "product_order" : "service_booking",
        });

        // Set success status
        setProcessingStatus('success');
        
        if (pendingProductDataString) {
          // Product order success flow
          setStatusMessage('Your order is confirmed! You will receive an email confirmation shortly.');
          
          // Show success message
          toast({
            title: "Order Confirmed",
            description: "Your payment was successful and order has been confirmed. You'll receive an email confirmation shortly.",
            variant: "default"
          });
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
          
          // Redirect immediately to orders page with success parameter
          navigate(`/orders?success=true&orderId=${bookingResult.id}`);
        } else {
          // Service booking success flow
          setStatusMessage('Your booking is confirmed! You will receive an email confirmation shortly.');
          
          // Show success message
          toast({
            title: "Booking Confirmed",
            description: "Your payment was successful and booking has been confirmed. You'll receive an email confirmation shortly.",
            variant: "default"
          });
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
          
          // Redirect immediately to bookings page with success parameter
          navigate(`/bookings?success=true&bookingId=${bookingResult.id}`);
        }
      } catch (error) {
        console.error("Error processing pending payment:", error);
        
        // Clean up all pending payment data to prevent getting stuck
        try {
          localStorage.removeItem('pendingBookingData');
          localStorage.removeItem('pendingProductData');
          localStorage.removeItem('idealPaymentPending');
          localStorage.removeItem('idealPaymentTimestamp');
          localStorage.removeItem('idealPaymentIntentId');
          console.log("Removed all payment data from localStorage after error");
        } catch (cleanupError) {
          console.error("Error cleaning up localStorage:", cleanupError);
        }
        
        // Set specific error message and status
        setProcessingStatus('failed');
        
        let errorMessage = "There was an unexpected error processing your payment.";
        if (error instanceof Error) {
          errorMessage = error.message || errorMessage;
        }
        
        setStatusMessage(errorMessage + " Please try again or contact support if this issue persists.");
        
        // Show toast notification
        toast({
          title: "Payment Processing Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setIsProcessing(false);
      }
    };
    
    // Check for Stripe redirect URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasPaymentParams = urlParams.has('payment_intent') || 
                            urlParams.has('payment_intent_client_secret') || 
                            urlParams.has('redirect_status');
    
    // Get the redirect status from URL if available
    const redirectStatus = urlParams.get('redirect_status');
    
    if (hasPaymentParams && !isProcessing) {
      setIsProcessing(true); // Prevent multiple processing attempts
      
      console.log("Detected payment redirect URL parameters:", {
        payment_intent: urlParams.get('payment_intent'),
        redirect_status: redirectStatus,
        payment_intent_client_secret: urlParams.has('payment_intent_client_secret') ? 'present' : 'absent',
        source: urlParams.get('source')
      });
      
      // Also check localStorage for the iDEAL pending payment flag
      const idealPaymentPending = localStorage.getItem('idealPaymentPending');
      console.log("iDEAL payment pending flag in localStorage:", idealPaymentPending);
      
      // If URL explicitly indicates a failed payment, show error immediately
      if (redirectStatus === 'failed') {
        console.warn("URL indicates failed payment");
        setProcessingStatus('failed');
        setStatusMessage('Your payment failed according to the payment provider. Please try again or use a different payment method.');
        // We'll still attempt to process in case our backend has different information
        processPendingPayment();
      } else if (redirectStatus === 'succeeded' || redirectStatus === 'success') {
        console.log("URL indicates successful payment completion");
        setProcessingStatus('checking');
        setStatusMessage('Payment successful! Processing your booking...');
        processPendingPayment();
      } else {
        // Otherwise proceed with normal processing
        console.log("Processing payment with status:", redirectStatus || 'unknown');
        setProcessingStatus('checking');
        setStatusMessage('Verifying payment status...');
        processPendingPayment();
      }
    }
  }, [location, navigate, toast, isProcessing]);
  
  // Show appropriate UI based on processing status
  if (processingStatus === 'checking' || isProcessing) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
          <p className="text-2xl font-semibold text-blue-700">Processing Payment</p>
          <p className="text-muted-foreground mt-2">{statusMessage}</p>
          <div className="mt-6 border-t pt-4">
            <div className="flex justify-center space-x-2 items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-300"></div>
            </div>
            <p className="text-gray-500 mt-2">
              This may take a few moments. Please don't close this window.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (processingStatus === 'failed') {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <p className="text-2xl font-semibold text-red-700">Payment Failed</p>
          <p className="text-muted-foreground mt-2">{statusMessage}</p>
          <div className="mt-6 border-t pt-4">
            <p className="text-gray-500 mb-4">
              Your payment couldn't be processed. You have not been charged.
            </p>
            <div className="flex space-x-3 justify-center">
              <button 
                onClick={() => window.location.href = '/services'}
                className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Browse Services
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (processingStatus === 'success') {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <p className="text-2xl font-semibold text-green-700">Payment Successful!</p>
          <p className="text-muted-foreground mt-2">{statusMessage}</p>
          <div className="mt-6 border-t pt-4">
            <p className="text-gray-500">
              An email confirmation has been sent to your registered email address.
            </p>
            <p className="text-muted-foreground mt-4 text-sm animate-pulse">
              {localStorage.getItem('pendingProductData') 
                ? "Redirecting you to your orders..." 
                : "Redirecting you to your bookings..."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}