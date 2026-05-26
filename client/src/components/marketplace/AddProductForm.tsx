import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { insertProductSchema, ProductCategory, type InsertProduct } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import MultiImageUploader from "@/components/shared/MultiImageUploader";
import { Loader2, Save } from "lucide-react";

export default function AddProductForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [images, setImages] = useState<string[]>([]);

  // Create the form
  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "0.00",
      category: ProductCategory.OTHER,
      images: [],
      stock: 1,
      sellerId: user?.id,
      isDigital: false, // Always false as digital products are disabled
      digitalContentUrl: "",
    },
  });

  // Mutation for creating a product
  const createProductMutation = useMutation({
    mutationFn: async (data: InsertProduct) => {
      // Use the correct parameter order for apiRequest
      const res = await apiRequest("/api/products", "POST", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Server error response:", errorData);
        throw new Error(errorData.message || "Failed to create product");
      }
      return await res.json();
    },
    onSuccess: () => {
      // Reset the form
      form.reset();
      setImages([]);
      
      // Invalidate products query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
      // Show success toast
      toast({
        title: "Product created",
        description: "Your product has been created successfully.",
        variant: "default",
      });
    },
    onError: (error) => {
      console.error("Error creating product:", error);
      toast({
        title: "Error",
        description: "Failed to create product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  function onSubmit(data: InsertProduct) {
    // Add the uploaded images
    data.images = images;
    
    // Ensure price is properly formatted as a string
    if (data.price === 0 || data.price === "0" || data.price === "0.00" || data.price === "") {
      data.price = "0.00";
    }
    
    // Make sure digital products are disabled
    data.isDigital = false;
    data.digitalContentUrl = "";
    
    // Ensure data is valid
    console.log("Submitting product data:", data);
    
    // Submit the form
    createProductMutation.mutate(data);
  }

  // Handle images update from ImageUploader
  const handleImagesUpdate = (newImages: string[]) => {
    setImages(newImages);
  };

  // Digital products are completely disabled in this version

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Product</CardTitle>
        <CardDescription>Create a new product for the marketplace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (EUR)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2">€</span>
                          <Input 
                            type="text" 
                            placeholder="0.00"
                            className="pl-7" 
                            {...field}
                            onChange={(e) => {
                              // Allow only valid price format (including 0 and 0.00)
                              const value = e.target.value;
                              if (/^(0|0\.\d{0,2}|\d*\.\d{0,2}|\d+)$/.test(value) || value === '') {
                                field.onChange(value);
                              }
                            }} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Enter price (can be 0 for free products)
                      </FormDescription>
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
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ProductCategory).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {key.charAt(0) + key.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="1" 
                          min="0"
                          {...field}
                          onChange={(e) => {
                            field.onChange(parseInt(e.target.value) || 0);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your product" 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Product Images</FormLabel>
                  <MultiImageUploader 
                    images={images} 
                    onImagesChange={handleImagesUpdate} 
                    maxImages={5}
                  />
                  <FormDescription>
                    Upload up to 5 images of your product. The first image will be used as the product thumbnail.
                  </FormDescription>
                </FormItem>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full md:w-auto"
              disabled={createProductMutation.isPending}
            >
              {createProductMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Product
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}