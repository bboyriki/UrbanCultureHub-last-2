import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Product } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatPrice } from "@/lib/utils";
import StripeWrapper from "@/components/events/StripeWrapper";
import ProductCheckout from "./ProductCheckout";
import BuyerDetailsForm, { BuyerDetailsFormValues } from "./BuyerDetailsForm";
import { Loader2, ShoppingBag, ArrowLeft, CreditCard, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

interface CheckoutDialogProps {
  product: Product;
  quantity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define checkout steps
type CheckoutStep = "details" | "payment";

const CheckoutDialog = ({ product, quantity, open, onOpenChange }: CheckoutDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Add state for current checkout step and buyer details
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("details");
  const [buyerDetails, setBuyerDetails] = useState<BuyerDetailsFormValues | null>(null);
  const isMobile = useIsMobile();
  
  // Calculate subtotal from product price and quantity, with safeguards for missing values
  let basePrice = 0;
  if (product?.price) {
    try {
      // First parse as float, then format to 2 decimal places to avoid floating point issues
      basePrice = parseFloat(parseFloat(product.price).toFixed(2));
    } catch (e) {
      console.error("Error parsing product price:", e);
      // Default to 1.00 if parsing fails
      basePrice = 1.00; 
    }
  } else {
    // Default to 1.00 if no price is provided
    basePrice = 1.00;
    console.warn("No price found for product, using default price of €1.00");
  }
  
  console.log("Product base price:", basePrice, "from original:", product?.price);
  const subtotalAmount = quantity * basePrice;
  
  // Ensure we're working with a single product object, not an array
  const productItem = Array.isArray(product) ? product.find(p => p.id === product[0].id) : product;
  
  // Check if product is digital using multiple methods (similar to server-side logic)
  // This handles cases where isDigital might be stored as string 'true', boolean true, etc.
  let itemPrice = 0;
  if (productItem?.price) {
    try {
      // First parse as float, then format to 2 decimal places to avoid floating point issues
      itemPrice = parseFloat(parseFloat(productItem.price).toFixed(2));
    } catch (e) {
      console.error("Error parsing product item price:", e);
      // Default to 1.00 if parsing fails
      itemPrice = 1.00;
    }
  } else {
    // Default to 1.00 if no price is provided
    itemPrice = 1.00;
    console.warn("No price found for product item, using default price of €1.00");
  }
  
  console.log("Item price:", itemPrice, "from original:", productItem?.price);
  
  // Get the isDigital property directly from the product
  const isDigitalProduct = productItem?.isDigital === true || 
                      String(productItem?.isDigital).toLowerCase() === 'true' || 
                      String(productItem?.isDigital).toLowerCase() === 't' ||
                      !!productItem?.digitalContentUrl;
                      
  console.log("Product detailed info in CheckoutDialog:", {
    productId: productItem?.id,
    price: productItem?.price,
    parsedPrice: itemPrice,
    isDigital: productItem?.isDigital,
    isDigitalType: typeof productItem?.isDigital,
    isDigitalParsed: isDigitalProduct
  });
  
  // Fixed shipping cost of €7.00 (only for physical products)
  // Special case for test product (ID 11) - no shipping cost
  const shippingCost = isDigitalProduct || productItem?.id === 11 ? 0 : 7.00;
  
  // Log product type for debugging with detailed info
  console.log("Product checkout - DETAILED:", { 
    quantity,
    subtotal: subtotalAmount,
    shipping: shippingCost,
    total: subtotalAmount + shippingCost,
    isDigital: productItem?.isDigital,
    isDigitalType: typeof productItem?.isDigital,
    digitalUrl: productItem?.digitalContentUrl,
    usingDigitalLogic: isDigitalProduct,
    productId: productItem?.id,
    product: productItem // Only log the single product, not the array
  });
  
  // Log product type for debugging
  console.log("Product checkout: ", { 
    productId: product?.id, 
    name: product?.name, 
    price: product?.price, 
    isDigital: product?.isDigital,
    quantity,
    subtotal: subtotalAmount,
    shipping: shippingCost,
    total: subtotalAmount + shippingCost
  });
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
    
    console.log("Buyer details submitted for product:", { 
      productId: product?.id, 
      isDigital: product?.isDigital, 
      price: product?.price,
      totalAmount 
    });
    
    // Check if this is a free product (price is 0)
    let productPrice = 0;
    if (product?.price) {
      try {
        productPrice = parseFloat(parseFloat(product.price).toFixed(2));
      } catch (e) {
        console.error("Error parsing product price in handleBuyerDetailsSubmit:", e);
        // Default to 1.00 if parsing fails
        productPrice = 1.00;
      }
    } else {
      // Default to 1.00 if no price is provided
      productPrice = 1.00;
      console.warn("No price found for product in handleBuyerDetailsSubmit, using default price of €1.00");
    }
    
    console.log("Checking if product is free:", productPrice);
    
    if (productPrice === 0) {
      console.log("Free product detected, bypassing payment intent creation");
      // Create the order directly for free products
      await createFreeOrder(details);
    } else {
      // For paid products, create payment intent as usual
      // setCurrentStep("payment") is called inside createPaymentIntent on success
      await createPaymentIntent(details);
    }
  };
  
  // Create a payment intent with buyer details
  const createPaymentIntent = async (details: BuyerDetailsFormValues) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert to cents for Stripe (minimum 50 cents)
      const amountInCents = Math.max(Math.round(totalAmount * 100), 50);
      
      // Create a formatted shipping address for metadata with proper country code format
      const formattedAddress = isDigitalProduct ? "Digital Product" : 
        `${details.shippingAddress}, ${details.shippingPostalCode}, ${details.shippingCity}, ${details.shippingCountry}`;
      
      console.log("Creating payment intent for:", {
        productId: product?.id,
        isDigital: product?.isDigital,
        amount: amountInCents,
        formattedAddress
      });
      
      const response = await apiRequest("/api/payments/create-intent", "POST", {
        amount: amountInCents,
        currency: "eur",
        description: `Purchase of ${quantity}x ${product?.name || 'Product'}`,
        metadata: {
          productId: product?.id,
          quantity,
          userId: user.id,
          type: "product_purchase",
          isDigital: isDigitalProduct ? "true" : "false",
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
          title: "Error",
          description: errorData.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Payment intent error:", err);
      setError("An unexpected error occurred while setting up payment");
      toast({
        title: "Error",
        description: "Failed to connect to payment service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Create an order directly for free products
  const createFreeOrder = async (details: BuyerDetailsFormValues) => {
    if (!user || !product?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Creating free order for product:", product.id);
      
      // Create a formatted shipping address for record with proper country code format
      const formattedAddress = isDigitalProduct ? "Digital Product" : 
        `${details.shippingAddress}, ${details.shippingPostalCode}, ${details.shippingCity}, ${details.shippingCountry}`;
      
      // Free product, create order directly
      const orderResponse = await apiRequest("/api/orders", "POST", {
        buyerId: user.id,
        totalAmount: "0.00",
        subtotalAmount: "0.00",
        shippingCost: "0.00", // Changed from shippingAmount to shippingCost to match schema
        status: "completed",
        shippingAddress: formattedAddress,
        customerNotes: details.notes || "",
        items: [
          {
            productId: product.id,
            quantity: quantity,
            unitPrice: "0.00",
            totalPrice: "0.00"
          }
        ]
      });
      
      if (orderResponse.ok) {
        const orderData = await orderResponse.json();
        console.log("Free order created successfully:", orderData);
        
        // Save data to localStorage for success page
        localStorage.setItem('userId', user.id.toString());
        localStorage.setItem('lastProductId', product?.id?.toString() || '');
        localStorage.setItem('lastQuantity', quantity.toString());
        
        // Show success message
        toast({
          title: "Order Completed!",
          description: "Your free product order has been processed successfully.",
        });
        
        // Close dialog and redirect to success page
        onOpenChange(false);
        navigate(`/marketplace/checkout/success?product=${product?.id || ''}&quantity=${quantity}`);
      } else {
        const errorData = await orderResponse.json();
        console.error("Error creating free order:", errorData);
        setError(errorData.message || "Failed to process free order");
        toast({
          title: "Error",
          description: errorData.message || "Failed to process your order. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Free order error:", err);
      setError("An unexpected error occurred while processing your order");
      toast({
        title: "Error",
        description: "Failed to process your order. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleSuccess = (orderId: number) => {
    toast({
      title: "Order Completed!",
      description: "Your order has been successfully processed.",
    });
    onOpenChange(false);
    navigate(`/marketplace/checkout/success?product=${product?.id || ''}&quantity=${quantity}`);
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
  
  const formatProductName = (name: string) => {
    if (isMobile) {
      return name.length > 15 ? name.substring(0, 15) + '...' : name;
    }
    return name.length > 25 ? name.substring(0, 25) + '...' : name;
  };
  
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
                {product?.name ? formatProductName(product.name) : 'Product'} × {quantity} • {formatPrice(totalAmount)}
                {shippingCost > 0 && ` (${formatPrice(shippingCost)} ship)`}
              </Badge>
              
              {/* Digital product badge */}
              {isDigitalProduct && (
                <Badge variant="outline" className="w-fit px-1.5 py-0 text-[9px] sm:text-xs bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
                  Digital
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
          {currentStep === "details" && (
            <div className="pb-4">
              <BuyerDetailsForm 
                onDetailsSubmit={handleBuyerDetailsSubmit} 
                isDigitalProduct={isDigitalProduct}
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
                  
                  {/* Stripe Payment Form with error handling */}
                  <div className="relative">
                    <StripeWrapper clientSecret={clientSecret}>
                      <ProductCheckout
                        product={product}
                        quantity={quantity}
                        clientSecret={clientSecret}
                        onSuccess={handleSuccess}
                        buyerDetails={buyerDetails}
                      />
                    </StripeWrapper>
                    
                    {/* Fallback error message that appears if Stripe fails to render */}
                    <div 
                      id="stripe-error-fallback" 
                      className="hidden absolute inset-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex flex-col items-center justify-center"
                    >
                      <p className="text-red-600 dark:text-red-400 text-sm mb-2">
                        Payment system couldn't be loaded
                      </p>
                      <Button variant="outline" onClick={handleBackToDetails} size="sm">
                        <ArrowLeft className="mr-1.5 h-3 w-3" />
                        Back to Details
                      </Button>
                    </div>
                    
                    {/* Script to detect if Stripe form fails to render and show the fallback */}
                    <script dangerouslySetInnerHTML={{ __html: `
                      setTimeout(() => {
                        // Check if Stripe Elements form is rendered
                        const stripeForm = document.querySelector('[data-elements-internal-frame-id]');
                        if (!stripeForm) {
                          // If not found, show the fallback error
                          const fallback = document.getElementById('stripe-error-fallback');
                          if (fallback) fallback.classList.remove('hidden');
                        }
                      }, 2000);
                    `}} />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;