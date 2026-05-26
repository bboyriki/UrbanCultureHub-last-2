import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import CheckoutDialog from '@/components/marketplace/CheckoutDialog';
import { ProductSkeleton } from '@/components/marketplace/ProductSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

interface TestProduct {
  id: number;
  name: string;
  description: string;
  price: string;
  category: string;
  images: string[];
  stock: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sellerId: number | null;
  isDigital: boolean;
  digitalContentUrl: string | null;
}

export default function TestProductPage() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === 'admin';

  // Redirect non-admin users away from this page
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/marketplace');
    }
  }, [user, isAdmin, navigate]);

  // Query for the test product - only for admin users
  const { data: product, isLoading, error } = useQuery<TestProduct>({
    queryKey: ['/api/test-product'],
    retry: 1,
    enabled: !!user && isAdmin,
  });
  
  useEffect(() => {
    // Set document title
    document.title = product ? `Test Product - ${product.name}` : 'Test Product';
  }, [product]);
  
  if (isLoading) return <ProductSkeleton />;
  
  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-500 mb-4">Error Loading Test Product</h2>
              <p className="text-gray-700 mb-4">
                There was an error loading the test product. Please try again later.
              </p>
              <p className="text-sm text-gray-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4">
          <img 
            src={product.images[0] || 'https://placehold.co/600x600?text=Test+Product'} 
            alt={product.name} 
            className="max-h-96 object-contain"
          />
        </div>
        
        {/* Product Details */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{product.name}</CardTitle>
              <CardDescription className="text-lg font-semibold">
                €{parseFloat(product.price).toFixed(2)}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-gray-700">{product.description}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Details</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    <li>Category: {product.category}</li>
                    <li>Product Type: {product.isDigital ? 'Digital' : 'Physical'}</li>
                    <li>Stock: {product.stock} available</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2">Test Product Information</h3>
                  <p className="text-blue-700 text-sm">
                    This is a special test product that costs exactly €1.00. It can be used to test the payment
                    flow without spending a large amount. The payment process works exactly the same as with
                    regular products.
                  </p>
                </div>
              </div>
            </CardContent>
            
            <Separator />
            
            <CardFooter className="pt-4 flex flex-col items-stretch">
              <Button 
                onClick={() => setIsCheckoutOpen(true)} 
                className="w-full mb-2" 
                size="lg"
              >
                Buy Now (€1.00)
              </Button>
              <p className="text-sm text-center text-gray-500">
                Payment handled securely by Stripe
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Checkout Dialog */}
      {isCheckoutOpen && (
        <CheckoutDialog
          product={product}
          quantity={1}
          open={isCheckoutOpen}
          onOpenChange={setIsCheckoutOpen}
        />
      )}
    </div>
  );
}