import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export default function TestOrderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Order details
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [shippingAddress, setShippingAddress] = useState("Test Address");
  const [shippingPostalCode, setShippingPostalCode] = useState("1234AB");
  const [shippingCity, setShippingCity] = useState("Test City");
  const [shippingCountry, setShippingCountry] = useState("Netherlands");
  const [notes, setNotes] = useState("This is a test order");

  // Order tracking
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [courierName, setCourierName] = useState("PostNL");
  const [selectedOrder, setSelectedOrder] = useState<string>("");

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Fetch orders
  const { data: orders, refetch: refetchOrders } = useQuery({
    queryKey: ["/api/orders"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest("/api/orders", undefined, {
        method: "POST",
        body: JSON.stringify(orderData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Test order created",
        description: "The test order has been added to the system",
      });
      setIsLoading(false);
      refetchOrders();
    },
    onError: (error: any) => {
      console.error("Error creating order:", error);
      toast({
        title: "Error",
        description: error.message || "Could not create order",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  // Update tracking information mutation
  const updateTrackingMutation = useMutation({
    mutationFn: async ({id, trackingData}: {id: string, trackingData: any}) => {
      const response = await apiRequest(`/api/orders/${id}/tracking`, undefined, {
        method: "POST",
        body: JSON.stringify(trackingData),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Tracking updated",
        description: "The tracking information has been updated",
      });
      setIsLoading(false);
      refetchOrders();
    },
    onError: (error: any) => {
      console.error("Error updating tracking:", error);
      toast({
        title: "Error",
        description: error.message || "Could not update tracking",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  // Mark as delivered mutation
  const markDeliveredMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/orders/${id}/delivered`, undefined, {
        method: "POST",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order delivered",
        description: "The order has been marked as delivered",
      });
      setIsLoading(false);
      refetchOrders();
    },
    onError: (error: any) => {
      console.error("Error marking as delivered:", error);
      toast({
        title: "Error",
        description: error.message || "Could not mark as delivered",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  // Reject order mutation
  const rejectOrderMutation = useMutation({
    mutationFn: async ({id, reason}: {id: string, reason: string}) => {
      const response = await apiRequest(`/api/orders/${id}/reject`, undefined, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order rejected",
        description: "The order has been rejected",
      });
      setIsLoading(false);
      refetchOrders();
    },
    onError: (error: any) => {
      console.error("Error rejecting order:", error);
      toast({
        title: "Error",
        description: error.message || "Could not reject order",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const handleCreateOrder = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create an order",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProduct) {
      toast({
        title: "Product required",
        description: "Please select a product for this order",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const product = products.find((p: any) => p.id.toString() === selectedProduct);
    const orderData = {
      totalAmount: (parseFloat(product.price) * parseInt(quantity)).toString(),
      shippingAddress,
      shippingPostalCode,
      shippingCity,
      shippingCountry,
      notes,
      buyerId: user.id,
      items: [
        {
          productId: parseInt(selectedProduct),
          quantity: parseInt(quantity),
          priceAtPurchase: product.price,
        }
      ],
      status: "processing"
    };

    createOrderMutation.mutate(orderData);
  };

  const handleUpdateTracking = () => {
    if (!selectedOrder) {
      toast({
        title: "Order required",
        description: "Please select an order to update",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const trackingData = {
      trackingNumber,
      trackingUrl,
      courierName
    };

    updateTrackingMutation.mutate({id: selectedOrder, trackingData});
  };

  const handleMarkDelivered = () => {
    if (!selectedOrder) {
      toast({
        title: "Order required",
        description: "Please select an order to mark as delivered",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    markDeliveredMutation.mutate(selectedOrder);
  };

  const handleRejectOrder = () => {
    if (!selectedOrder) {
      toast({
        title: "Order required",
        description: "Please select an order to reject",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    rejectOrderMutation.mutate({id: selectedOrder, reason: "Test rejection reason"});
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-3xl mx-auto mb-8">
        <CardHeader>
          <CardTitle>Admin Test Order Creator</CardTitle>
          <CardDescription>
            Create a test order to verify the order processing functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Select Product</Label>
            <Select
              value={selectedProduct}
              onValueChange={setSelectedProduct}
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products && products.map((product: any) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name} - €{product.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              type="number"
              min="1"
            />
          </div>

          <Separator className="my-4" />
          
          <div className="space-y-2">
            <Label htmlFor="shippingAddress">Shipping Address</Label>
            <Textarea
              id="shippingAddress"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Enter shipping address"
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={shippingPostalCode}
                onChange={(e) => setShippingPostalCode(e.target.value)}
                placeholder="1234AB"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                placeholder="Amsterdam"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={shippingCountry}
              onChange={(e) => setShippingCountry(e.target.value)}
              placeholder="Netherlands"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional order information"
              rows={2}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateOrder} 
            disabled={isLoading || !selectedProduct}
          >
            {isLoading ? 
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 
              "Create Test Order"}
          </Button>
        </CardFooter>
      </Card>

      {/* Order Management Card */}
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            Update tracking, mark delivered or reject orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderSelect">Select Order</Label>
            <Select
              value={selectedOrder}
              onValueChange={setSelectedOrder}
            >
              <SelectTrigger id="orderSelect">
                <SelectValue placeholder="Select an order" />
              </SelectTrigger>
              <SelectContent>
                {orders && orders.map((order: any) => (
                  <SelectItem key={order.id} value={order.id.toString()}>
                    Order #{order.id} - {order.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="trackingNumber">Tracking Number</Label>
            <Input
              id="trackingNumber"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="3SXXXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trackingUrl">Tracking URL</Label>
            <Input
              id="trackingUrl"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://postnl.nl/track-and-trace/3SXXXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="courierName">Courier</Label>
            <Input
              id="courierName"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="PostNL"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={handleRejectOrder}
              disabled={isLoading || !selectedOrder}
            >
              Reject Order
            </Button>
            <Button 
              variant="outline" 
              onClick={handleMarkDelivered}
              disabled={isLoading || !selectedOrder}
            >
              Mark Delivered
            </Button>
          </div>
          <Button 
            onClick={handleUpdateTracking} 
            disabled={isLoading || !selectedOrder || !trackingNumber}
          >
            {isLoading ? 
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : 
              "Update Tracking"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}