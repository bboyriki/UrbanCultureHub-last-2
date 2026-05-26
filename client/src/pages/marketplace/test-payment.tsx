import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import ProductCheckout from '@/components/marketplace/ProductCheckout';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function TestPaymentPage() {
  const [productId, setProductId] = useState<number>(1); // Default to first product
  const [quantity, setQuantity] = useState<number>(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { user } = useAuth();

  const createPaymentIntent = async () => {
    if (!user) {
      toast({
        title: 'Please log in first',
        description: 'You need to be logged in to make a purchase',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Get product details
      const productResponse = await fetch(`/api/products/${productId}`);
      if (!productResponse.ok) {
        throw new Error('Failed to fetch product');
      }
      const product = await productResponse.json();
      
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: parseFloat(product.price) * quantity * 100, // Convert to cents
          productId,
          metadata: {
            product_id: productId,
            product_name: product.name,
            quantity: quantity
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Payment initiation failed');
      }
      
      const data = await response.json();
      setClientSecret(data.clientSecret);
      
      console.log('Created payment intent:', data);
      
      // Store user ID in localStorage (backup for redirects)
      localStorage.setItem('userId', user.id.toString());
      
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast({
        title: 'Payment Initialization Failed',
        description: error instanceof Error ? error.message : 'Failed to create payment',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetPayment = () => {
    setClientSecret(null);
  };

  const handleSuccess = (orderId: number) => {
    toast({
      title: 'Payment Successful',
      description: `Order #${orderId} has been created`,
    });
  };

  return (
    <div className="container py-10 max-w-3xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Payment Processing</CardTitle>
          <CardDescription>
            Use this page to test the Stripe payment integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!clientSecret ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="productId">Product ID</Label>
                <Input
                  id="productId"
                  type="number"
                  value={productId}
                  onChange={(e) => setProductId(parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                />
              </div>
              
              <Separator />
              
              <Button 
                onClick={createPaymentIntent} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Initializing Payment...' : 'Create Payment Intent'}
              </Button>
            </div>
          ) : (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <ProductCheckout 
                product={{
                  id: productId,
                  name: 'Test Product',
                  description: 'Test product for payment processing',
                  price: '9.99',
                  category: 'test',
                  sellerId: 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  images: null,
                  stock: 10,
                  isDigital: false,
                  digitalContentUrl: null
                }}
                quantity={quantity}
                clientSecret={clientSecret}
                onSuccess={handleSuccess}
              />
              <Button 
                variant="outline" 
                onClick={resetPayment} 
                className="mt-6 w-full"
              >
                Reset Payment Form
              </Button>
            </Elements>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 text-xs text-muted-foreground p-3">
          <div className="space-y-1">
            <p>This is a test page for Stripe payment processing.</p>
            <p>Test card number: 4242 4242 4242 4242</p>
            <p>Expiry: Any future date (e.g., 12/25)</p>
            <p>CVC: Any 3 digits (e.g., 123)</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default TestPaymentPage;