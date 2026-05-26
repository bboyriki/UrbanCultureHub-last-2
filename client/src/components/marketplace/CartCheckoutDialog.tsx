import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useShoppingCart } from "@/contexts/ShoppingCartContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatPrice } from "@/lib/utils";
import StripeWrapper from "@/components/events/StripeWrapper";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import BuyerDetailsForm, { BuyerDetailsFormValues } from "./BuyerDetailsForm";
import { Loader2, ShoppingBag, ArrowLeft, CreditCard, X, ShoppingCart, Package2, LockKeyhole } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { CartItem } from "@/contexts/ShoppingCartContext";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CartCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define checkout steps
type CheckoutStep = "details" | "payment";

// Cart Payment Form Component
interface CartPaymentFormProps {
  clientSecret: string;
  totalAmount: number;
  buyerDetails: BuyerDetailsFormValues | null;
  cartItems: CartItem[];
  onSuccess: (paymentIntentId?: string) => void;
}

const CartPaymentForm = ({ 
  clientSecret, 
  totalAmount, 
  buyerDetails, 
  cartItems,
  onSuccess 
}: CartPaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !user || !buyerDetails) {
      console.error("Payment prerequisites check failed:", { 
        stripe: !!stripe, 
        elements: !!elements, 
        user: !!user,
        buyerDetails: !!buyerDetails
      });
      setPaymentError("Payment service unavailable. Please try again later.");
      return;
    }
    
    try {
      setProcessing(true);
      setPaymentError(null);
      
      console.log("Starting payment process for cart:", {
        items: cartItems.length,
        totalAmount: totalAmount
      });
      
      // Get payment intent ID from client secret
      const paymentIntentId = clientSecret.split('_secret_')[0];
      console.log("Payment intent ID:", paymentIntentId);
      
      // Prepare important product information for order creation
      const productIds = cartItems.map(item => item.product.id).join(",");
      const productQuantities = cartItems.map(item => item.quantity).join(",");
      const hasDigitalProducts = cartItems.some(item => item.product.isDigital);
      const hasPhysicalProducts = cartItems.some(item => !item.product.isDigital);
      
      // Save these details to localStorage immediately before payment submission
      localStorage.setItem('userId', user.id.toString());
      localStorage.setItem('productIds', productIds);
      localStorage.setItem('productQuantities', productQuantities);
      localStorage.setItem('lastPaymentIntentId', paymentIntentId);
      
      // Save buyer details to localStorage
      localStorage.setItem('buyerDetails', JSON.stringify(buyerDetails));
      
      // Build complete URL with all necessary parameters
      const returnUrl = new URL(`${window.location.origin}/marketplace/checkout/success`);
      returnUrl.searchParams.append('payment_intent', paymentIntentId);
      returnUrl.searchParams.append('items', cartItems.length.toString());
      
      console.log("Redirecting to:", returnUrl.toString());
      
      // First submit the elements form to validate
      const submitResult = await elements.submit();
      if (submitResult.error) {
        throw submitResult.error;
      }
      
      // Then confirm payment
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
          payment_method_data: {
            billing_details: {
              name: buyerDetails.fullName,
              email: buyerDetails.email,
              phone: buyerDetails.phoneNumber,
              address: !hasPhysicalProducts ? undefined : {
                line1: buyerDetails.shippingAddress,
                postal_code: buyerDetails.shippingPostalCode,
                city: buyerDetails.shippingCity,
                country: buyerDetails.shippingCountry,
                state: "" // Add empty state to fix Stripe validation error
              }
            }
          }
        },
        redirect: "if_required"
      });
      
      // Check for payment intent result
      if (result.paymentIntent) {
        console.log("Payment succeeded:", result.paymentIntent);
        
        // Call the onSuccess handler with the payment intent ID
        onSuccess(result.paymentIntent.id);
        return;
      }
      
      // Handle errors if redirect wasn't triggered
      if (result.error) {
        console.error("Stripe error:", result.error);
        
        // More specific error messages based on error type
        if (result.error.type === 'card_error') {
          setPaymentError(`Card error: ${result.error.message}`);
        } else if (result.error.type === 'validation_error') {
          setPaymentError(`Validation error: ${result.error.message}`);
        } else {
          setPaymentError(result.error.message || "Payment failed. Please try again.");
        }
      }
    } catch (err) {
      console.error("Payment error:", err);
      
      // Try to provide more specific error information
      const errorMessage = err instanceof Error 
        ? err.message 
        : "An unexpected error occurred during payment processing. Please try again later.";
      
      setPaymentError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Alert className="bg-primary/10 border-primary/20 p-2">
        <div className="flex items-start gap-1.5">
          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 text-primary" />
          <AlertDescription className="text-[10px] sm:text-xs">
            Complete your payment for {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart
          </AlertDescription>
        </div>
      </Alert>
      
      <div className="p-2 sm:p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-1.5 mb-2">
          <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
          <h3 className="text-xs sm:text-sm font-medium text-foreground">Payment Details</h3>
        </div>
        <PaymentElement options={{
          layout: {
            type: 'accordion',
            defaultCollapsed: false,
            radios: false,
            spacedAccordionItems: false
          }
        }} />
      </div>
      
      {paymentError && (
        <Alert variant="destructive" className="p-2">
          <AlertDescription className="text-[10px] sm:text-xs">{paymentError}</AlertDescription>
        </Alert>
      )}
      
      <Button 
        type="submit" 
        className="w-full h-9 sm:h-11 text-xs sm:text-sm font-medium"
        disabled={!stripe || processing}
      >
        {processing ? (
          <span className="flex items-center gap-1.5 justify-center">
            <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
            <span>Processing Payment...</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 justify-center">
            <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Pay {formatCurrency(totalAmount)}</span>
          </span>
        )}
      </Button>
      
      <div className="flex items-center justify-center text-[9px] sm:text-xs text-muted-foreground gap-1">
        <LockKeyhole className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        <p>
          Payment secured by Stripe with 256-bit SSL encryption
        </p>
      </div>
    </form>
  );
};

const CartCheckoutDialog = ({ open, onOpenChange }: CartCheckoutDialogProps) => {
  const { user } = useAuth();
  const { cartItems, getCartTotal, clearCart } = useShoppingCart();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for current checkout step and buyer details
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("details");
  const [buyerDetails, setBuyerDetails] = useState<BuyerDetailsFormValues | null>(null);
  const isMobile = useIsMobile();
  
  // Calculate total amounts
  const subtotalAmount = getCartTotal();
  
  // Determine if we have digital products only, physical products only, or a mix
  const hasDigitalProducts = cartItems.some(item => item.product.isDigital);
  const hasPhysicalProducts = cartItems.some(item => !item.product.isDigital);
  
  // Fixed shipping cost of €7.00 (only if we have physical products)
  // Special case for our test product ID 11 - no shipping cost
  const hasOnlyTestProducts = cartItems.every(item => item.product.id === 11);
  const shippingCost = hasPhysicalProducts && !hasOnlyTestProducts ? 7.00 : 0;
  
  // Calculate total with shipping included
  let totalAmount = subtotalAmount + shippingCost;
  
  // Ensure minimum amount of €0.50 for Stripe
  if (totalAmount < 0.50) {
    totalAmount = 0.50;
  }
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setCurrentStep("details");
      setBuyerDetails(null);
      setClientSecret(null);
      setError(null);
    }
  }, [open]);
  
  // Handle buyer details submission
  const handleBuyerDetailsSubmit = async (details: BuyerDetailsFormValues) => {
    setBuyerDetails(details);
    
    console.log("Buyer details submitted for cart checkout:", { 
      items: cartItems.length,
      subtotal: subtotalAmount,
      shipping: shippingCost,
      total: totalAmount 
    });
    
    // Check if this is a free order (total is 0)
    if (totalAmount === 0) {
      console.log("Free order detected, bypassing payment intent creation");
      // Create the order directly for free products
      await createFreeOrder(details);
    } else {
      // For paid orders, create payment intent as usual
      await createPaymentIntent(details);
    }
  };
  
  // Create a payment intent with buyer details
  const createPaymentIntent = async (details: BuyerDetailsFormValues) => {
    if (!user || cartItems.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert to cents for Stripe (minimum 50 cents)
      const amountInCents = Math.max(Math.round(totalAmount * 100), 50);
      
      // Create a formatted shipping address for metadata
      const formattedAddress = !hasPhysicalProducts ? "Digital Products Only" : 
        `${details.shippingAddress}, ${details.shippingPostalCode}, ${details.shippingCity}, ${details.shippingCountry}`;
      
      // Prepare product information for metadata
      const productIds = cartItems.map(item => item.product.id).join(",");
      const productQuantities = cartItems.map(item => item.quantity).join(",");
      
      console.log("Creating payment intent for cart:", {
        products: cartItems.length,
        amount: amountInCents,
        formattedAddress,
        productIds,
        productQuantities
      });
      
      const response = await apiRequest("/api/payments/create-intent", "POST", {
        amount: amountInCents,
        currency: "eur",
        description: `Purchase of ${cartItems.length} product(s)`,
        metadata: {
          productIds,
          productQuantities,
          userId: user.id,
          type: "cart_purchase",
          hasDigitalProducts: hasDigitalProducts ? "true" : "false",
          hasPhysicalProducts: hasPhysicalProducts ? "true" : "false",
          buyerName: details.fullName,
          buyerEmail: details.email,
          buyerPhone: details.phoneNumber,
          shippingAddress: formattedAddress,
          subtotalAmount: subtotalAmount.toString(),
          shippingCost: shippingCost.toString()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Payment intent created successfully:", data.clientSecret.split('_secret_')[0]);
        
        // Set client secret and move to payment step
        setClientSecret(data.clientSecret);
        setCurrentStep("payment");
      } else {
        const errorData = await response.json();
        console.error("Payment intent creation failed:", errorData);
        setError(errorData.message || "Failed to create payment intent");
        toast({
          title: errorData.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Payment intent error:", err);
      setError("An unexpected error occurred while setting up payment");
      toast({
        title: "Failed to connect to payment service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Create an order directly for free products
  const createFreeOrder = async (details: BuyerDetailsFormValues) => {
    if (!user || cartItems.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Creating free order for cart");
      
      // Create a formatted shipping address for record
      const formattedAddress = !hasPhysicalProducts ? "Digital Products Only" : 
        `${details.shippingAddress}, ${details.shippingPostalCode}, ${details.shippingCity}, ${details.shippingCountry}`;
      
      // Prepare items for order
      const orderItems = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: "0.00",
        totalPrice: "0.00"
      }));
      
      // Free products, create order directly
      const orderResponse = await apiRequest("/api/orders", "POST", {
        buyerId: user.id,
        totalAmount: "0.00",
        subtotalAmount: "0.00",
        shippingCost: "0.00",
        status: "completed",
        shippingAddress: formattedAddress,
        customerNotes: details.notes || "",
        items: orderItems
      });
      
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        console.log("Free order created successfully:", orderData);
        
        // Clear the cart
        clearCart();
        
        // Show success message
        toast({
          title: "Your free order has been processed successfully.",
        });
        
        // Close dialog and redirect to success page
        onOpenChange(false);
        // Use router to navigate to success page with query params
        navigate(`/marketplace/checkout/success?order=${orderData.id}`);
      } else {
        const errorData = await orderResponse.json();
        console.error("Error creating free order:", errorData);
        setError(errorData.message || "Failed to process free order");
        toast({
          title: errorData.message || "Failed to process your order. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Free order error:", err);
      setError("An unexpected error occurred while processing your order");
      toast({
        title: "Failed to process your order. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // This is now only used for free products
  const handlePaymentSuccess = (paymentIntentId?: string) => {
    toast({
      title: "Your order has been successfully processed.",
    });
    clearCart();
    onOpenChange(false);
    
    // Improved navigation with payment intent ID for tracking
    if (paymentIntentId) {
      navigate(`/marketplace/checkout/success?payment_intent=${paymentIntentId}`);
    } else if (clientSecret) {
      navigate(`/marketplace/checkout/success?payment_intent=${clientSecret.split('_secret_')[0]}`);
    } else {
      navigate(`/marketplace/checkout/success`);
    }
  };
  
  // Go back to buyer details step
  const handleBackToDetails = () => {
    setCurrentStep("details");
  };
  
  // Get the dialog title based on current step
  const getDialogTitle = () => {
    switch (currentStep) {
      case "details":
        return "Enter Your Details";
      case "payment":
        return "Complete Purchase";
      default:
        return "Checkout";
    }
  };
  
  // Get the dialog icon based on current step
  const getDialogIcon = () => {
    switch (currentStep) {
      case "details":
        return <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />;
      case "payment":
        return <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />;
      default:
        return <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />;
    }
  };
  
  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  if (cartItems.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center">Your cart is empty</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-6">There are no items in your cart to checkout</p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col p-0 sm:p-0 w-[95%] sm:w-auto overflow-hidden"
        style={{
          maxWidth: "480px",
          maxHeight: "85vh",
          height: isMobile ? "85vh" : "auto"
        }}
      >
        {/* Fixed header section */}
        <div className="bg-background sticky top-0 z-10 flex justify-between items-center p-2 sm:p-3 border-b">
          <DialogHeader className="pb-0 space-y-0.5">
            <DialogTitle className="flex items-center gap-1.5 text-sm sm:text-lg font-semibold">
              {getDialogIcon()}
              {getDialogTitle()}
            </DialogTitle>
            
            <div className="flex gap-1 items-center">
              <Badge variant="outline" className="w-fit px-1.5 py-0 text-[9px] sm:text-xs bg-card border-muted">
                {cartItems.length} items • {formatCurrency(totalAmount)}
                {shippingCost > 0 && ` (${formatCurrency(shippingCost)} ship)`}
              </Badge>
              
              {/* Product type badges */}
              {hasDigitalProducts && (
                <Badge variant="outline" className="w-fit px-1.5 py-0 text-[9px] sm:text-xs bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                  Digital
                </Badge>
              )}
              {hasPhysicalProducts && (
                <Badge variant="outline" className="w-fit px-1.5 py-0 text-[9px] sm:text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                  Physical
                </Badge>
              )}
            </div>
          </DialogHeader>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 sm:h-8 sm:w-8 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
        
        {/* Scrollable content section */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-4 pt-2">
          {/* Cart items summary */}
          <div className="mb-4">
            <h3 className="text-xs sm:text-sm font-medium mb-2 flex items-center gap-1.5">
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              Cart Items
            </h3>
            <ScrollArea className="max-h-[140px] rounded-md border p-2">
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.product.id} className="flex items-center text-xs py-1">
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.product.images && item.product.images.length > 0 ? (
                        <img 
                          src={item.product.images[0]} 
                          alt={item.product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <ShoppingCart className="h-3 w-3 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="ml-2 flex-1">
                      <div className="font-medium line-clamp-1">{item.product.name}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {item.quantity} × {formatCurrency(parseFloat(item.product.price))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(item.quantity * parseFloat(item.product.price))}
                      </div>
                      {item.product.isDigital && (
                        <Badge variant="outline" className="px-1 py-0 text-[8px] bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                          Digital
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{hasPhysicalProducts ? formatCurrency(shippingCost) : 'Free'}</span>
              </div>
              <div className="pt-1 border-t flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
          
          {currentStep === "details" && (
            <div className="pb-4">
              <BuyerDetailsForm 
                onDetailsSubmit={handleBuyerDetailsSubmit} 
                isDigitalProduct={!hasPhysicalProducts}
              />
            </div>
          )}
          
          {currentStep === "payment" && (
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-4 sm:py-6">
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary mb-2 sm:mb-4" />
                  <p className="text-xs sm:text-sm text-muted-foreground">Setting up payment...</p>
                </div>
              ) : error ? (
                <div className="py-4 text-center">
                  <p className="text-red-500 text-xs sm:text-sm mb-3">{error}</p>
                  <Button variant="outline" onClick={handleBackToDetails} size="sm" className="h-7 text-xs">
                    <ArrowLeft className="mr-1.5 h-3 w-3" />
                    Back to Details
                  </Button>
                </div>
              ) : clientSecret ? (
                <div className="space-y-3 pb-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleBackToDetails}
                    className="text-xs h-6 sm:h-7 px-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    <span>Edit Details</span>
                  </Button>
                  
                  <StripeWrapper key={clientSecret} clientSecret={clientSecret}>
                    <CartPaymentForm 
                      clientSecret={clientSecret}
                      totalAmount={totalAmount}
                      buyerDetails={buyerDetails}
                      cartItems={cartItems}
                      onSuccess={handlePaymentSuccess}
                    />
                  </StripeWrapper>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CartCheckoutDialog;