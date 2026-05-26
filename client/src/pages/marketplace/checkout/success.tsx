import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Product, Order, OrderItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Check, 
  CheckCircle,
  Download, 
  FileText, 
  Loader2,
  Mail,
  MapPin, 
  Package2, 
  RefreshCw,
  ShoppingBag,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatPrice } from "@/lib/utils";
import { reportPurchase } from "@/lib/adsTracking";

export default function CheckoutSuccessPage() {
  const [location] = useLocation();
  const [orderId, setOrderId] = useState<number | null>(null);
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const productId = searchParams.get('product') ? parseInt(searchParams.get('product') as string) : null;
  const quantity = searchParams.get('quantity') ? parseInt(searchParams.get('quantity') as string) : 1;
  
  // Query for order by ID if available
  const { data: order, isLoading: orderLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!orderId,
  });
  
  // Query for order items
  const { data: orderItems, isLoading: itemsLoading } = useQuery<OrderItem[]>({
    queryKey: [`/api/orders/${orderId}/items`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!orderId,
  });
  
  // Query for product details
  const { data: product, isLoading: productLoading } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!productId,
  });
  
  // Find the latest order with the product ID from URL parameter
  useEffect(() => {
    // Extract paymentIntentId if present in URL (Stripe will add this)
    const paymentIntentId = searchParams.get('payment_intent');
    
    // Auto-send email logic 
    const sendEmailForOrder = async (orderId: number, userId: string) => {
      try {
        console.log(`Auto-sending confirmation email for order ${orderId}...`);
        const emailResponse = await fetch('/api/orders/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            userId: parseInt(userId)
          })
        });
        
        if (emailResponse.ok) {
          console.log("Auto-email sending successful");
        } else {
          console.error("Auto-email sending failed:", await emailResponse.text());
        }
      } catch (emailErr) {
        console.error("Error in auto-email sending:", emailErr);
      }
    };
    
    // Create a new order if we have a payment_intent but no order yet
    const handlePaymentSuccess = async () => {
      try {
        // First check if order exists with this payment intent
        if (paymentIntentId) {
          console.log("Payment intent ID from URL:", paymentIntentId);
          const response = await fetch(`/api/orders?payment_intent=${paymentIntentId}`);
          
          if (response.ok) {
            const orders = await response.json();
            
            // If we found a matching order, use it
            if (orders && orders.length > 0) {
              console.log("Found existing order with payment intent:", orders[0]);
              setOrderId(orders[0].id);
              return;
            }
          } else {
            console.error("Failed to check for existing orders:", await response.text());
          }
        } else {
          console.error("No payment intent ID found in URL");
        }
        
        // If we got here, we need to create a new order with the successful payment
        // Try to get payment intent ID from URL or localStorage
        const finalPaymentIntentId = paymentIntentId || localStorage.getItem('lastPaymentIntentId');
        
        // Try to get product ID from URL or localStorage
        const finalProductId = productId || (localStorage.getItem('lastProductId') ? 
          parseInt(localStorage.getItem('lastProductId') || '0') : null);
        
        const finalQuantity = quantity || (localStorage.getItem('lastQuantity') ? 
          parseInt(localStorage.getItem('lastQuantity') || '1') : 1);
        
        // Get user ID from localStorage
        const userId = localStorage.getItem('userId');
        
        if (finalProductId && userId) {
          console.log("Attempting to create order with available information:");
          console.log("- Product ID:", finalProductId);
          console.log("- Quantity:", finalQuantity);
          console.log("- User ID:", userId);
          console.log("- Payment Intent ID:", finalPaymentIntentId || "Not available");
          
          // Try to get product information for price
          let productPrice = "0";
          let productData = null;
          
          if (!product) {
            try {
              const productResponse = await fetch(`/api/products/${finalProductId}`);
              if (productResponse.ok) {
                productData = await productResponse.json();
                productPrice = productData.price || "0";
                console.log("Fetched product price:", productPrice);
              } else {
                console.error("Could not fetch product info");
              }
            } catch (err) {
              console.error("Error fetching product:", err);
            }
          } else {
            productPrice = product.price;
            productData = product;
          }
          
          if (!productPrice || productPrice === "0") {
            console.error("Invalid product price. Cannot create order.");
            return;
          }
          
          // Calculate subtotal amount
          const subtotalAmount = (parseFloat(productPrice) * finalQuantity).toString();
          console.log("Subtotal amount:", subtotalAmount);
          
          // Fixed shipping cost of €7.00
          const shippingCost = "7.00";
          console.log("Shipping cost:", shippingCost);
          
          // Calculate total amount with shipping
          const totalAmount = (parseFloat(subtotalAmount) + parseFloat(shippingCost)).toString();
          console.log("Total amount (with shipping):", totalAmount);
          
          // Create the order
          try {
            const orderResponse = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                buyerId: parseInt(userId),
                totalAmount: totalAmount,
                subtotalAmount: subtotalAmount,
                shippingCost: shippingCost,
                paymentIntentId: finalPaymentIntentId || undefined,
                status: "completed"
              })
            });
            
            if (orderResponse.ok) {
              const newOrder = await orderResponse.json();
              console.log("Created new order:", newOrder);
              
              // Create the order item
              if (newOrder && finalProductId) {
                console.log("Creating order item for product:", finalProductId);
                const itemResponse = await fetch('/api/order-items', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: newOrder.id,
                    productId: finalProductId, 
                    quantity: finalQuantity,
                    priceAtPurchase: productPrice
                  })
                });
                
                if (itemResponse.ok) {
                  const orderItem = await itemResponse.json();
                  console.log("Created order item:", orderItem);
                  
                  // Try to trigger an email directly from client if it hasn't been sent
                  try {
                    // Send order confirmation email
                    if (productData) {
                      console.log("Attempting to send order confirmation email directly");
                      const emailResponse = await fetch('/api/orders/send-confirmation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderId: newOrder.id,
                          userId: parseInt(userId)
                        })
                      });
                      
                      if (emailResponse.ok) {
                        console.log("Successfully requested email send");
                      } else {
                        console.warn("Email request failed but order was created:", await emailResponse.text());
                      }
                    }
                  } catch (emailErr) {
                    console.error("Email request error (non-critical):", emailErr);
                  }
                  
                  setOrderId(newOrder.id);
                  // Clean up localStorage items
                  localStorage.removeItem('lastProductId');
                  localStorage.removeItem('lastQuantity');
                  localStorage.removeItem('lastPaymentIntentId');
                  return;
                } else {
                  console.error("Failed to create order item:", await itemResponse.text());
                }
              }
            } else {
              console.error("Failed to create order:", await orderResponse.text());
            }
          } catch (orderError) {
            console.error("Error creating order:", orderError);
          }
        } else {
          console.error("Missing essential data: productId=", finalProductId, "userId=", userId);
        }
        
        // Last resort fallback - get latest order for this user
        console.log("Using fallback: fetching latest order");
        if (userId) {
          try {
            const response = await fetch(`/api/orders?buyerId=${parseInt(userId)}`);
            if (response.ok) {
              const orders = await response.json();
              // Find the most recent order
              if (orders && orders.length > 0) {
                // Sort by creation date, most recent first
                orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latestOrder = orders[0];
                if (latestOrder) {
                  console.log("Using latest order:", latestOrder);
                  setOrderId(latestOrder.id);
                  
                  // Always attempt to send confirmation email for the latest order
                  // if it hasn't been sent yet
                  if (!latestOrder.emailSent) {
                    try {
                      console.log("Attempting to send confirmation email for latest order:", latestOrder.id);
                      fetch('/api/orders/send-confirmation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderId: latestOrder.id,
                          userId: parseInt(userId)
                        })
                      }).then(response => {
                        if (response.ok) {
                          console.log("Email confirmation sent automatically for latest order");
                        } else {
                          console.error("Failed to send automatic email confirmation for latest order");
                        }
                      });
                    } catch (emailErr) {
                      console.error("Error sending confirmation email for latest order:", emailErr);
                    }
                  }
                }
              } else {
                console.log("No orders found for user");
              }
            } else {
              console.error("Failed to fetch user orders:", await response.text());
            }
          } catch (fallbackErr) {
            console.error("Error in fallback order fetch:", fallbackErr);
          }
        } else {
          console.error("No user ID found in localStorage for fallback");
        }
      } catch (error) {
        console.error('Error handling payment success:', error);
      }
    };

    if (!orderId) {
      handlePaymentSuccess();
    }
  }, [orderId, searchParams, productId, quantity, product]);
  
  // Google Ads purchase conversion (marketplace orders).
  // Fires once per order id thanks to the dedup inside reportPurchase.
  useEffect(() => {
    if (order && order.id && order.totalAmount) {
      const value = parseFloat(order.totalAmount);
      reportPurchase({
        value: !isNaN(value) ? value : undefined,
        currency: "EUR",
        transactionId: `order:${order.id}`,
        conversionType: "product_order",
      });
    }
  }, [order]);

  // State for email sending
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Function to manually trigger sending the confirmation email
  const handleSendConfirmationEmail = async () => {
    if (!orderId) return;
    
    try {
      setSendingEmail(true);
      setEmailError(null);
      
      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      const response = await fetch('/api/orders/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userId: parseInt(userId)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send confirmation email');
      }
      
      setEmailSent(true);
      console.log('Confirmation email sent successfully');
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      setEmailError(error instanceof Error ? error.message : 'Failed to send confirmation email');
    } finally {
      setSendingEmail(false);
    }
  };
  
  const isLoading = orderLoading || itemsLoading || productLoading;
  
  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <div className="space-y-6">
          <Skeleton className="h-12 w-full max-w-md" />
          <div className="grid grid-cols-1 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  const orderDate = order && order.createdAt ? new Date(order.createdAt).toLocaleString() : '';
  
  // Format currency with Euro symbol
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Check className="text-green-500" />
            Order Confirmed
          </h1>
          <p className="text-muted-foreground mt-1">
            Thank you for your purchase!
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/marketplace">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shop
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5" />
                Order Summary
              </CardTitle>
              {order && (
                <CardDescription>
                  Order #{order.id} • Placed on {orderDate}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {orderItems && orderItems.length > 0 ? (
                <div className="space-y-4">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      {product && product.images && product.images.length > 0 ? (
                        <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={product.images[0]} 
                            alt={product.name} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium">{product?.name}</h3>
                        <p className="text-muted-foreground text-sm">
                          Quantity: {item.quantity}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatPrice(parseFloat(item.priceAtPurchase || "0"))} each
                          </span>
                          {product?.isDigital && (
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">
                          {formatPrice(parseFloat(item.priceAtPurchase || "0") * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No items found in this order
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col border-t pt-6">
              <div className="flex justify-between w-full">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{order?.subtotalAmount ? formatPrice(parseFloat(order.subtotalAmount)) : (order ? formatPrice(parseFloat(order.totalAmount) - 7) : '-')}</span>
              </div>
              <div className="flex justify-between w-full mt-2">
                <span className="text-muted-foreground">Shipping</span>
                <span>{product?.isDigital ? 'Free' : (order?.shippingCost ? formatPrice(parseFloat(order.shippingCost)) : formatPrice(7))}</span>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between w-full font-semibold text-lg">
                <span>Total</span>
                <span>{order ? formatPrice(parseFloat(order.totalAmount)) : '-'}</span>
              </div>
            </CardFooter>
          </Card>
          
          {!product?.isDigital && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Attempt to retrieve buyer details from localStorage */}
                {(() => {
                  try {
                    const buyerDetailsString = localStorage.getItem('buyerDetails');
                    if (buyerDetailsString) {
                      const buyerDetails = JSON.parse(buyerDetailsString);
                      if (buyerDetails) {
                        return (
                          <div className="mb-4 p-3 bg-muted/50 rounded-md">
                            <h4 className="font-medium mb-2">Delivery Address</h4>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p className="font-semibold text-foreground">{buyerDetails.fullName}</p>
                              <p>{buyerDetails.shippingAddress}</p>
                              <p>{buyerDetails.shippingPostalCode}, {buyerDetails.shippingCity}</p>
                              <p>{buyerDetails.shippingCountry}</p>
                              <p className="mt-2">
                                <span className="inline-block mr-4">📱 {buyerDetails.phoneNumber}</span>
                                <span>✉️ {buyerDetails.email}</span>
                              </p>
                              {buyerDetails.notes && (
                                <div className="mt-2 pt-2 border-t border-border">
                                  <p className="font-medium text-xs mb-1">Order Notes</p>
                                  <p className="italic">{buyerDetails.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  } catch (error) {
                    console.error("Error parsing buyer details:", error);
                    return null;
                  }
                })()}
                
                <div className="space-y-2 text-muted-foreground">
                  <p>Your order will be processed within 1-2 business days.</p>
                  <p>Estimated delivery: 3-5 business days.</p>
                  <p>You will receive a shipping confirmation email once your order ships.</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Email confirmation section with retry button */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Order Confirmation Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  A confirmation email with your order details and receipt has been sent to your registered email address.
                </p>
                
                {emailSent && (
                  <Alert>
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertTitle>Email Sent Successfully</AlertTitle>
                    <AlertDescription>
                      Your order confirmation email has been sent successfully.
                    </AlertDescription>
                  </Alert>
                )}
                
                {emailError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Sending Email</AlertTitle>
                    <AlertDescription>
                      {emailError}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSendConfirmationEmail} 
                    disabled={sendingEmail || emailSent}
                    variant={emailSent ? "outline" : "default"}
                    size="sm"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : emailSent ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Email Sent
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resend Confirmation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span>Credit Card</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">Paid</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {order?.paymentIntentId ? order.paymentIntentId.slice(0, 10) + '...' : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm mb-4">
                If you have any questions about your order, please contact our customer support team.
              </p>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}