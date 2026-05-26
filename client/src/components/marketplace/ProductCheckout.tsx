import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Product } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, 
  Loader2, 
  User, 
  MapPin, 
  Phone, 
  ShoppingBag, 
  LockKeyhole,
  ChevronDown,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { BuyerDetailsFormValues } from "./BuyerDetailsForm";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ProductCheckoutProps {
  product: Product;
  quantity: number;
  clientSecret: string;
  onSuccess: (orderId: number) => void;
  buyerDetails?: BuyerDetailsFormValues | null; 
}

// Create a safe product type with default values
interface SafeProduct extends Product {
  images: string[];
}

const ProductCheckout = ({ 
  product: originalProduct, 
  quantity, 
  clientSecret, 
  onSuccess,
  buyerDetails 
}: ProductCheckoutProps) => {
  // Create a safe copy of the product with default values for any missing properties
  const [safeProduct, setSafeProduct] = useState<SafeProduct>({
    ...originalProduct,
    id: originalProduct?.id || 0,
    name: originalProduct?.name || "Product",
    description: originalProduct?.description || "",
    price: originalProduct?.price || "1",
    category: originalProduct?.category || "other",
    images: originalProduct?.images || [],
    stock: originalProduct?.stock || null,
    sellerId: originalProduct?.sellerId || null,
    isDigital: originalProduct?.isDigital || false,
    digitalContentUrl: originalProduct?.digitalContentUrl || null,
    status: originalProduct?.status || "active",
    createdAt: originalProduct?.createdAt || new Date(),
    updatedAt: originalProduct?.updatedAt || new Date(),
  });
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [detailsOpen, setDetailsOpen] = useState(!isMobile);
  const [summaryOpen, setSummaryOpen] = useState(!isMobile);
  
  // Initialize the safeProduct with the original product when the component mounts
  useEffect(() => {
    if (originalProduct) {
      setSafeProduct({
        ...safeProduct,
        ...originalProduct,
        id: originalProduct?.id || 0,
        name: originalProduct?.name || "Product",
        description: originalProduct?.description || "",
        price: originalProduct?.price || "1",
        category: originalProduct?.category || "other",
        images: Array.isArray(originalProduct?.images) ? originalProduct.images : [],
        stock: originalProduct?.stock || null,
        sellerId: originalProduct?.sellerId || null,
        isDigital: originalProduct?.isDigital || false,
        digitalContentUrl: originalProduct?.digitalContentUrl || null,
        status: originalProduct?.status || "active",
        createdAt: originalProduct?.createdAt || new Date(),
        updatedAt: originalProduct?.updatedAt || new Date(),
      });
    } else {
      console.error("ProductCheckout: Product is undefined or null");
      setError("Product information is missing. Please try again.");
    }
  }, [originalProduct]);

  // Log initialization status to help debug loading issues
  useEffect(() => {
    console.log("ProductCheckout component initialization:", {
      stripeLoaded: !!stripe,
      elementsLoaded: !!elements,
      userAuthenticated: !!user,
      clientSecretProvided: !!clientSecret,
      buyerDetailsAvailable: !!buyerDetails,
      stripeKey: !!import.meta.env.VITE_STRIPE_PUBLIC_KEY || 
                !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
                !!import.meta.env.STRIPE_PUBLISHABLE_KEY,
      product: {
        id: safeProduct?.id,
        name: safeProduct?.name,
        hasImages: !!safeProduct?.images,
        imagesLength: safeProduct?.images?.length || 0
      }
    });
  }, [stripe, elements, user, clientSecret, buyerDetails, safeProduct]);
  
  // Calculate subtotal with properly formatted numbers
  let basePrice = 0;
  if (safeProduct?.price) {
    try {
      // First parse as float, then format to 2 decimal places to avoid floating point issues
      basePrice = parseFloat(parseFloat(safeProduct.price).toFixed(2));
    } catch (e) {
      console.error("Error parsing product price in ProductCheckout:", e);
      // Default to 1.00 if parsing fails
      basePrice = 1.00;
    }
  } else {
    // Default to 1.00 if no price is provided
    basePrice = 1.00;
    console.warn("No price found for product in ProductCheckout, using default price of €1.00");
  }
  
  console.log("Product checkout base price:", basePrice, "from original:", safeProduct?.price);
  const subtotalAmount = quantity * basePrice;
  
  // Check if product is digital using multiple methods (similar to CheckoutDialog.tsx)
  const isDigitalProduct = safeProduct?.isDigital === true || 
                          String(safeProduct?.isDigital).toLowerCase() === 'true' || 
                          String(safeProduct?.isDigital).toLowerCase() === 't' ||
                          !!safeProduct?.digitalContentUrl;
  
  // Fixed shipping cost of €7.00 (only for physical products)
  // Special case for test product (ID 11) - no shipping cost
  const shippingCost = isDigitalProduct || safeProduct.id === 11 ? 0 : 7.00;
  
  // Total amount with shipping
  const totalAmount = subtotalAmount + shippingCost;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !user) {
      console.error("Payment prerequisites check failed:", { stripe: !!stripe, elements: !!elements, user: !!user });
      setError("Payment service unavailable. Please try again later.");
      return;
    }
    
    try {
      setProcessing(true);
      setError(null);
      
      console.log("Starting payment process for product:", {
        productId: safeProduct.id,
        isDigital: safeProduct.isDigital,
        price: safeProduct.price,
        quantity: quantity,
        totalAmount: totalAmount
      });
      
      // Get payment intent ID from client secret
      const paymentIntentId = clientSecret.split('_secret_')[0];
      console.log("Payment intent ID:", paymentIntentId);
      
      // Save these details to localStorage immediately before payment submission
      localStorage.setItem('userId', user.id.toString());
      localStorage.setItem('lastProductId', safeProduct.id.toString());
      localStorage.setItem('lastQuantity', quantity.toString());
      localStorage.setItem('lastPaymentIntentId', paymentIntentId);
      
      // Save buyer details to localStorage
      if (buyerDetails) {
        localStorage.setItem('buyerDetails', JSON.stringify(buyerDetails));
      }
      
      // Add iDEAL specific flags to handle bank redirects
      localStorage.setItem('idealPaymentPending', 'true');
      localStorage.setItem('idealPaymentIntentId', paymentIntentId);
      localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
      
      // Store pending product data for iDEAL bank redirect recovery
      const pendingData = {
        productId: safeProduct.id,
        quantity: quantity,
        paymentIntentId: paymentIntentId,
        timestamp: Date.now(),
        paymentMethod: 'ideal',
        paymentMetadata: {
          paymentType: 'iDEAL',
          isMarketplace: true
        }
      };
      
      // Store in localStorage for redirect recovery
      localStorage.setItem('pendingProductData', JSON.stringify(pendingData));
      
      // Build complete URL with all necessary parameters
      const returnUrl = new URL(`${window.location.origin}/marketplace/checkout/success`);
      returnUrl.searchParams.append('product', safeProduct.id.toString());
      returnUrl.searchParams.append('quantity', quantity.toString());
      returnUrl.searchParams.append('payment_intent', paymentIntentId);
      returnUrl.searchParams.append('source', 'ideal'); // Add source=ideal parameter
      
      console.log("Redirecting to:", returnUrl.toString());
      
      // Use confirmPayment with if-needed redirect strategy to better handle errors
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
          payment_method_data: {
            billing_details: buyerDetails ? {
              name: buyerDetails.fullName,
              email: buyerDetails.email,
              phone: buyerDetails.phoneNumber,
              address: isDigitalProduct ? undefined : {
                line1: buyerDetails.shippingAddress,
                postal_code: buyerDetails.shippingPostalCode,
                city: buyerDetails.shippingCity,
                country: buyerDetails.shippingCountry,
                state: "" // Add empty state to fix Stripe validation error
              }
            } : undefined
          }
        },
        redirect: "if_required"
      });
      
      // Check for payment intent result
      if (result.paymentIntent) {
        // Payment succeeded but redirect wasn't triggered
        // Manually navigate to success page
        window.location.href = returnUrl.toString();
        return;
      }
      
      // Handle errors if redirect wasn't triggered
      if (result.error) {
        console.error("Stripe error:", result.error);
        // More specific error messages based on error type
        if (result.error.type === 'card_error') {
          setError(`Card error: ${result.error.message}`);
        } else if (result.error.type === 'validation_error') {
          setError(`Validation error: ${result.error.message}`);
        } else {
          setError(result.error.message || "Payment failed. Please try again.");
        }
        setProcessing(false);
      }
    } catch (err) {
      console.error("Payment error:", err);
      // Try to provide more specific error information
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during payment processing. Please try again later.";
      setError(errorMessage);
      setProcessing(false);
    }
  };
  
  // Handle cases where client secret or stripe isn't properly initialized
  if (!clientSecret || !stripe) {
    return (
      <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <AlertDescription className="text-[10px] sm:text-xs">
          Unable to initialize payment. Please try again later. 
          {!clientSecret && " (Missing payment information)"}
          {!stripe && " (Payment system not loaded)"}
        </AlertDescription>
      </Alert>
    );
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  const formatProductName = (name: string) => {
    if (isMobile) {
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    }
    return name.length > 30 ? name.substring(0, 30) + '...' : name;
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="bg-primary/5 text-[10px] sm:text-xs font-normal">
          <ShoppingBag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
          {quantity} × {formatProductName(safeProduct.name)}
        </Badge>
        {isDigitalProduct ? (
          <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal">
            Digital Product
          </Badge>
        ) : null}
      </div>
      
      <Alert className="bg-primary/10 border-primary/20 p-2 sm:p-3">
        <div className="flex items-start gap-1.5">
          <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 text-primary" />
          <AlertDescription className="text-[10px] sm:text-xs">
            Complete your payment for {quantity} × {formatProductName(safeProduct.name)}
          </AlertDescription>
        </div>
      </Alert>
      
      {/* Buyer details summary */}
      {buyerDetails && (
        <Collapsible 
          open={detailsOpen} 
          onOpenChange={setDetailsOpen}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden"
        >
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-2 sm:p-3 focus:outline-none">
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                <h3 className="text-xs sm:text-sm font-medium text-foreground">Your Details</h3>
              </div>
              {isMobile && (detailsOpen ? 
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : 
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-2 sm:px-3 sm:pb-3">
            <div className="space-y-2 text-[10px] sm:text-xs border-t pt-2">
              <div className="flex items-start gap-1.5">
                <div className="w-3 h-3 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="font-medium">{buyerDetails.fullName}</div>
                  <div className="text-muted-foreground">{buyerDetails.email}</div>
                  <div className="flex items-center text-muted-foreground">
                    <Phone className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                    {buyerDetails.phoneNumber}
                  </div>
                </div>
              </div>
              
              {!isDigitalProduct && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">Shipping Address</div>
                    <div className="text-muted-foreground">{buyerDetails.shippingAddress}</div>
                    <div className="text-muted-foreground">
                      {buyerDetails.shippingPostalCode}, {buyerDetails.shippingCity}
                    </div>
                    <div className="text-muted-foreground">{buyerDetails.shippingCountry}</div>
                  </div>
                </div>
              )}
              
              {buyerDetails.notes && (
                <div className="border-t pt-1.5 mt-1.5">
                  <div className="font-medium text-[9px] sm:text-[10px] mb-0.5">Order Notes</div>
                  <div className="text-muted-foreground text-[9px] sm:text-[10px]">{buyerDetails.notes}</div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      
      {/* Order summary */}
      <Collapsible 
        open={summaryOpen} 
        onOpenChange={setSummaryOpen}
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden"
      >
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-2 sm:p-3 focus:outline-none">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              <h3 className="text-xs sm:text-sm font-medium text-foreground">Order Summary</h3>
            </div>
            {isMobile && (summaryOpen ? 
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : 
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pb-2 sm:px-3 sm:pb-3">
          <div className="space-y-1.5 text-[10px] sm:text-xs border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Product</span>
              <span className="font-medium truncate max-w-[150px] sm:max-w-[180px]">{safeProduct.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span>{quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{isDigitalProduct ? 'Free' : formatCurrency(shippingCost)}</span>
            </div>
            <div className="border-t pt-1.5 mt-1.5 flex justify-between font-medium">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      <form onSubmit={handleSubmit} className="space-y-3">
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
            },
            paymentMethodOrder: ['card', 'ideal', 'bancontact', 'sofort'],
            defaultValues: {
              billingDetails: {
                address: {
                  country: 'NL', // Default to Netherlands for iDEAL
                }
              }
            },
            fields: {
              billingDetails: {
                name: 'auto' as const, 
                email: 'auto' as const, 
                phone: 'auto' as const,
                address: {
                  country: 'auto' as const,
                  postalCode: 'auto' as const,
                  line1: 'auto' as const,
                  line2: 'auto' as const,
                  city: 'auto' as const,
                  state: 'auto' as const, // Set to 'auto' to fix Stripe validation error
                }
              }
            }
          }} />
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-[10px] sm:text-xs">{error}</AlertDescription>
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
    </div>
  );
};

export default ProductCheckout;