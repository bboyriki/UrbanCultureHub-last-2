import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { ProductCategory } from '@shared/schema';

const editProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").optional().or(z.literal("")),
  price: z.string().min(1, "Price is required"),
  category: z.string().min(1, "Category is required"),
  images: z.array(z.string()).optional(),
  stock: z.number().int().min(0, "Stock must be 0 or greater").optional().nullable(),
  isDigital: z.boolean().optional(),
  digitalContentUrl: z.string().url("Must be a valid URL").optional()
    .or(z.literal(""))
    .refine((val) => {
      // If empty string, treat as undefined
      return val === "" ? true : true;
    }),
});

type EditProductFormValues = z.infer<typeof editProductSchema>;

interface EditProductFormProps {
  productId: number;
  onSuccess?: () => void;
}

export default function EditProductForm({ productId, onSuccess }: EditProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch product data
  const { data: product, isLoading, error } = useQuery({
    queryKey: [`/api/products/${productId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!productId,
  });
  
  const form = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      category: "",
      images: [],
      stock: 0,
      isDigital: false, // Always false as digital products are disabled
      digitalContentUrl: "",
    },
  });
  
  // Update form values when product data is loaded
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description || "",
        price: product.price,
        category: product.category,
        images: product.images || [],
        stock: product.stock !== null ? product.stock : 0,
        isDigital: false, // Always false as digital products are disabled
        digitalContentUrl: "", // Digital products are disabled
      });
    }
  }, [product, form]);
  
  // Mutation to update the product
  const updateProductMutation = useMutation({
    mutationFn: (data: EditProductFormValues) => {
      return apiRequest(`/api/products/${productId}`, 'PATCH', {
        data: data,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      // Invalidate cache for this product and products list
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      
      toast({
        title: "Product updated successfully",
        description: "Your product has been updated in the marketplace.",
        variant: "default",
      });
      
      setIsSubmitting(false);
      
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast({
        title: "Failed to update product",
        description: "There was an error updating your product. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  const onSubmit = (data: EditProductFormValues) => {
    setIsSubmitting(true);
    
    // Convert empty strings to null for optional fields
    const formattedData = {
      ...data,
      description: data.description === "" ? null : data.description,
      digitalContentUrl: null, // Digital products are disabled
      
      // Digital products are disabled
      isDigital: false,
      
      // Convert price to proper format (string representation of a number)
      price: data.price.toString(),
    };
    
    updateProductMutation.mutate(formattedData);
  };
  
  // This function is now handled directly in the ImageUploader component
  // through the onImageUploaded callback
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !product) {
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
        <p className="font-medium">Error loading product</p>
        <p className="text-sm mt-1">There was an error loading the product information. Please try again later.</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Product</CardTitle>
        <CardDescription>
          Update your product information in the marketplace
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ProductCategory.ARTWORK}>Artwork</SelectItem>
                        <SelectItem value={ProductCategory.CLOTHING}>Clothing</SelectItem>
                        <SelectItem value={ProductCategory.ACCESSORIES}>Accessories</SelectItem>
                        {/* DIGITAL category removed - digital products disabled */}
                        <SelectItem value={ProductCategory.PERFORMANCE}>Performance</SelectItem>
                        <SelectItem value={ProductCategory.WORKSHOP}>Workshop</SelectItem>
                        <SelectItem value={ProductCategory.LESSON}>Lesson</SelectItem>
                        <SelectItem value={ProductCategory.EVENT_SERVICE}>Event Service</SelectItem>
                        <SelectItem value={ProductCategory.TECHNICAL}>Technical</SelectItem>
                        <SelectItem value={ProductCategory.OTHER}>Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        placeholder="29.99" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the price in euros (e.g., 29.99)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Available</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="10" 
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter 0 for out of stock items or leave empty for unlimited stock
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your product..." 
                        className="min-h-[120px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormControl>
                      <ImageUploader 
                        initialImage={field.value && field.value.length > 0 ? field.value[0] : undefined}
                        onImageUploaded={(imageUrl, publicId) => {
                          const updatedImages = field.value ? [...field.value, imageUrl] : [imageUrl];
                          form.setValue('images', updatedImages);
                        }}
                        folder="products"
                      />
                    </FormControl>
                    <FormDescription>
                      Upload images of your product (PNG, JPG, WEBP, max 5MB each)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <CardFooter className="px-0 pb-0 pt-6 flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}