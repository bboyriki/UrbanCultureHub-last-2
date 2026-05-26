import React from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { canManageProduct } from '@/lib/permissions';
import EditProductForm from '@/components/marketplace/EditProductForm';
import { PageHeader } from '@/components/ui/page-header';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@/components/ui/breadcrumb';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function EditProductPage() {
  const [match, params] = useRoute<{ id: string }>('/marketplace/edit/:id');
  const productId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  
  // Fetch product data to verify ownership
  const { data: product, isLoading, error } = useQuery({
    queryKey: [`/api/products/${productId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!productId,
  });
  
  // Check if the current user can manage this product
  const canManage = product ? canManageProduct(user, product.sellerId) : false;
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading product details...</p>
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="container py-8">
        <PageHeader heading="Product Not Found" text="The product you are looking for could not be found" />
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error 
              ? error.message 
              : "We couldn't find the product you're looking for. It may have been removed or you might have followed an invalid link."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!canManage) {
    return (
      <div className="container py-8">
        <PageHeader heading="Access Denied" text="You don't have permission to edit this product" />
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unauthorized</AlertTitle>
          <AlertDescription>
            You don't have permission to edit this product. Only the product owner or administrators can edit product details.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink href="/marketplace">Marketplace</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/marketplace/${productId}`}>{product.name}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>Edit</BreadcrumbItem>
      </Breadcrumb>
      
      <PageHeader 
        heading="Edit Product" 
        text={`Update information for ${product.name}`} 
      />
      
      <div className="mt-6">
        <EditProductForm 
          productId={productId} 
          onSuccess={() => window.history.back()}
        />
      </div>
    </div>
  );
}