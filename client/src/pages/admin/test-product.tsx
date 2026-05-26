import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function TestProductPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [productName, setProductName] = useState("Test Product");
  const [productDescription, setProductDescription] = useState("This is a test product for admin verification");
  const [productPrice, setProductPrice] = useState("19.99");
  const [productCategory, setProductCategory] = useState("art_supplies");
  const [productStock, setProductStock] = useState("10");
  const [isDigital, setIsDigital] = useState(false);
  const [digitalContentUrl, setDigitalContentUrl] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await apiRequest("/api/products", undefined, {
        method: "POST",
        body: JSON.stringify(productData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Test product created",
        description: "The test product has been added to the marketplace",
      });
      setIsLoading(false);
      navigate("/marketplace");
    },
    onError: (error: any) => {
      console.error("Error creating product:", error);
      toast({
        title: "Error",
        description: error.message || "Could not create product",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const handleCreateProduct = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a product",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const productData = {
      name: productName,
      description: productDescription,
      price: productPrice,
      category: productCategory,
      stock: parseInt(productStock),
      sellerId: user.id,
      isDigital: isDigital,
      digitalContentUrl: isDigital ? digitalContentUrl : null,
      images: imageUrls ? imageUrls.split(",").map(url => url.trim()) : [],
    };

    createProductMutation.mutate(productData);
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Admin Test Product Creator</CardTitle>
          <CardDescription>
            Create a test product to verify the marketplace functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Describe your product"
              rows={4}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (€)</Label>
              <Input
                id="price"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder="19.99"
                type="number"
                step="0.01"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                value={productStock}
                onChange={(e) => setProductStock(e.target.value)}
                placeholder="10"
                type="number"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={productCategory}
              onValueChange={(value) => setProductCategory(value)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="art_supplies">Art Supplies</SelectItem>
                <SelectItem value="clothing">Clothing</SelectItem>
                <SelectItem value="music">Music</SelectItem>
                <SelectItem value="books">Books</SelectItem>
                <SelectItem value="digital">Digital Goods</SelectItem>
                <SelectItem value="merchandise">Merchandise</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="digital"
                checked={isDigital}
                onCheckedChange={setIsDigital}
              />
              <Label htmlFor="digital">Digital Product</Label>
            </div>
          </div>
          
          {isDigital && (
            <div className="space-y-2">
              <Label htmlFor="digitalUrl">Digital Content URL</Label>
              <Input
                id="digitalUrl"
                value={digitalContentUrl}
                onChange={(e) => setDigitalContentUrl(e.target.value)}
                placeholder="https://example.com/digital-content"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="images">Image URLs (comma separated)</Label>
            <Textarea
              id="images"
              value={imageUrls}
              onChange={(e) => setImageUrls(e.target.value)}
              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
              rows={2}
            />
            <p className="text-sm text-muted-foreground">
              For testing, you can use: https://placehold.co/600x400, https://placehold.co/600x400/orange/white
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateProduct} 
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Create Test Product"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}