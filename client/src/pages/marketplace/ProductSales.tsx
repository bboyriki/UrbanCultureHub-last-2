import React, { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  ArrowLeft, 
  ShoppingBag, 
  Package, 
  TrendingUp, 
  Users, 
  DollarSign,
  Truck,
  AlertCircle 
} from 'lucide-react';

// Define types for our data
interface Order {
  id: number;
  productId: number;
  userId: number;
  quantity: number;
  totalPrice: number;
  status: string;
  shippingAddress?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
}

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
  sellerId: number;
  categoryId: number;
}

const ProductSales: React.FC = () => {
  const [, params] = useRoute<{ id: string }>('/marketplace/:id/sales');
  const productId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');

  // Fetch product details
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ['/api/products', productId],
    queryFn: async () => {
      if (!productId) return null;
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error('Failed to fetch product');
      return response.json();
    },
    enabled: !!productId
  });

  // Fetch product orders
  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/products/orders', productId],
    queryFn: async () => {
      if (!productId) return [];
      const response = await fetch(`/api/products/${productId}/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!productId
  });

  if (isLoadingProduct || isLoadingOrders) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading product sales data...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Product not found</h2>
          <p>The product you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link to="/marketplace">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Filter orders based on active tab
  const filteredOrders = orders ? orders.filter((order: Order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed') return order.status === 'delivered';
    if (activeTab === 'processing') return order.status === 'processing' || order.status === 'shipped';
    if (activeTab === 'cancelled') return order.status === 'cancelled';
    return true;
  }) : [];

  // Calculate stats
  const totalOrders = orders ? orders.length : 0;
  const totalQuantity = orders ? orders.reduce((sum: number, order: Order) => sum + (order.quantity || 0), 0) : 0;
  const totalRevenue = orders ? orders.reduce((sum: number, order: Order) => {
    return sum + (order.status !== 'cancelled' ? order.totalPrice : 0);
  }, 0) : 0;
  
  const processingCount = orders ? orders.filter((o: Order) => 
    o.status === 'processing' || o.status === 'shipped'
  ).length : 0;
  
  const completedCount = orders ? orders.filter((o: Order) => o.status === 'delivered').length : 0;
  const cancelledCount = orders ? orders.filter((o: Order) => o.status === 'cancelled').length : 0;

  // Helper function to determine status badge
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'delivered':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Delivered</Badge>;
      case 'shipped':
        return <Badge variant="secondary">Shipped</Badge>;
      case 'processing':
        return <Badge variant="default">Processing</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper function to update order status
  const updateOrderStatus = (orderId: number, newStatus: string) => {
    toast({
      title: "Feature coming soon",
      description: "Order status update functionality will be available in the next update.",
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <Link to={`/marketplace/${productId}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Product
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground mb-2">Product sales dashboard</p>
        </div>
      </div>

      <div className="grid gap-6 mb-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalQuantity} total items sold
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">€{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              €{product.price.toFixed(2)} per unit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{processingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Orders to fulfill
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{product.stock}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {product.stock <= 5 && <span className="text-destructive">Low stock!</span>}
              {product.stock > 5 && <span>Units available</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            View and manage orders for {product.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Orders ({totalOrders})</TabsTrigger>
              <TabsTrigger value="processing">Processing ({processingCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({cancelledCount})</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              {filteredOrders.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order: Order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={order.user?.profilePicture} />
                                <AvatarFallback>{order.user?.displayName?.substring(0, 2) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{order.user?.displayName || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{order.user?.email || 'No email'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(order.createdAt), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{order.quantity}</TableCell>
                          <TableCell>€{order.totalPrice.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {order.status === 'processing' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, 'shipped')}
                                >
                                  <Truck className="h-4 w-4 mr-1" />
                                  Ship
                                </Button>
                              )}
                              {order.status === 'shipped' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, 'delivered')}
                                >
                                  <Package className="h-4 w-4 mr-1" />
                                  Delivered
                                </Button>
                              )}
                              {(order.status === 'processing' || order.status === 'shipped') && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                >
                                  <AlertCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center border rounded-md">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-2" />
                  <p className="text-muted-foreground">No orders found</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductSales;