import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Store, Package, ShoppingCart, DollarSign, Star, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';

// UI Components
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Heading from '@/components/ui/heading';
import { useToast } from '@/hooks/use-toast';
import { ConnectionStatusBadge } from '@/components/ui/connection-status-badge';
import { useWebSocket } from '@/contexts/WebSocketSingletonContext';

interface Order {
  id: number;
  productId: number;
  buyerId: number;
  buyerName: string;
  status: string;
  createdAt: string;
  productName: string;
  quantity: number;
  totalAmount: number;
}

interface ProductStats {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalOrders: number;
  averageRating: number;
  pendingShipments: number;
}

const MarketplaceSeller: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { connectionStatus } = useWebSocket();
  const [stats, setStats] = useState<ProductStats>({
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalOrders: 0,
    averageRating: 0,
    pendingShipments: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  // Fetch products listed by the current user
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products/seller', user?.id],
    enabled: !!user?.id
  });

  // Fetch orders for products sold by this user
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/products/seller/orders', user?.id],
    enabled: !!user?.id
  });

  // Calculate stats when data is loaded
  useEffect(() => {
    if (products && Array.isArray(products) && orders && Array.isArray(orders)) {
      // Calculate total sales and revenue
      const totalSaleCount = orders.reduce((sum: number, order: any) => sum + order.quantity, 0);
      const totalRevenue = orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0);
      
      // Calculate average rating
      const reviewedProducts = products.filter((product: any) => product.reviewCount > 0);
      const avgRating = reviewedProducts.length > 0 
        ? reviewedProducts.reduce((sum: number, product: any) => sum + product.rating, 0) / reviewedProducts.length 
        : 0;
      
      // Count pending shipments
      const pendingShipments = orders.filter((order: any) => 
        order.status === 'paid' || order.status === 'processing'
      ).length;
      
      setStats({
        totalProducts: products.length,
        totalSales: totalSaleCount,
        totalRevenue: totalRevenue,
        totalOrders: orders.length,
        averageRating: parseFloat(avgRating.toFixed(1)),
        pendingShipments: pendingShipments
      });
    }
  }, [products, orders]);

  // Set up recent orders
  useEffect(() => {
    if (orders && Array.isArray(orders)) {
      const sortedOrders = [...orders]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentOrders(sortedOrders);
    }
  }, [orders]);

  // Listen for real-time order notifications
  useEffect(() => {
    const handleOrderNotification = (event: CustomEvent<any>) => {
      console.log('[ORDER] Received order notification:', event.detail);
      
      // Show toast notification
      toast({
        title: event.detail.title || 'New Order',
        description: event.detail.message || 'You have a new order',
        variant: 'default',
      });

      // Refresh the orders data
      queryClient.invalidateQueries({ queryKey: ['/api/products/seller/orders', user?.id] });
      
      // Also refresh the specific product data
      if (event.detail.productId) {
        queryClient.invalidateQueries({ queryKey: [`/api/products/${event.detail.productId}`] });
      }
    };

    // Add the event listener for product notification events
    window.addEventListener('notification:product', handleOrderNotification);
    
    return () => {
      window.removeEventListener('notification:product', handleOrderNotification);
    };
  }, [queryClient, toast, user?.id]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p>Please log in to view your marketplace seller dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <Heading as="h1">Marketplace Seller Dashboard</Heading>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge status={connectionStatus} />
          <Link href="/marketplace?sell=true">
            <Button>
              <Store className="mr-2 h-4 w-4" />
              Add New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Products</p>
              <h3 className="text-2xl font-bold">{stats.totalProducts}</h3>
            </div>
            <Store className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <h3 className="text-2xl font-bold">{stats.totalOrders}</h3>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Items Sold</p>
              <h3 className="text-2xl font-bold">{stats.totalSales}</h3>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <h3 className="text-2xl font-bold">€{stats.totalRevenue}</h3>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <h3 className="text-2xl font-bold">{stats.averageRating}/5</h3>
            </div>
            <Star className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">To Ship</p>
              <h3 className="text-2xl font-bold">{stats.pendingShipments}</h3>
            </div>
            <Package className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="products">My Products</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Recent Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <Table>
              <TableCaption>Recent orders for your products</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>#{order.id}</TableCell>
                      <TableCell>{order.buyerName}</TableCell>
                      <TableCell>
                        <span className="truncate block max-w-xs">
                          {order.productName} x{order.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            order.status === 'completed' || order.status === 'delivered'
                              ? 'default' 
                              : order.status === 'processing' || order.status === 'paid'
                                ? 'outline' 
                                : order.status === 'shipped'
                                  ? 'secondary'
                                  : 'destructive'
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>€{order.totalAmount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/marketplace/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">Details</Button>
                          </Link>
                          {(order.status === 'paid' || order.status === 'processing') && (
                            <Button variant="outline" size="sm">Ship Now</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No orders yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* My Products Tab */}
        <TabsContent value="products">
          <Card>
            <Table>
              <TableCaption>All products you're selling</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Sales</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products && Array.isArray(products) && products.length > 0 ? (
                  products.map((product: any) => {
                    const productOrders = orders?.filter((o: any) => o.productId === product.id) || [];
                    const totalSold = productOrders.reduce((sum: number, order: any) => sum + order.quantity, 0);
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>€{product.price}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>{product.stockQuantity || 'Unlimited'}</TableCell>
                        <TableCell>{totalSold}</TableCell>
                        <TableCell>
                          {product.rating > 0 ? (
                            <span className="flex items-center">
                              {product.rating.toFixed(1)}
                              <Star className="h-4 w-4 text-amber-500 ml-1" />
                            </span>
                          ) : (
                            'No ratings'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/marketplace/products/${product.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                            <Link href={`/marketplace/products/${product.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      {productsLoading ? 'Loading products...' : 'No products found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Shipping Tab */}
        <TabsContent value="shipping">
          <Card className="p-6">
            <div className="flex items-center mb-4 gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Orders to Ship</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              {stats.pendingShipments > 0 ? (
                <Card className="p-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <h4 className="font-medium text-yellow-700">Pending Shipments</h4>
                  </div>
                  <p className="text-sm text-yellow-700 mb-4">
                    You have {stats.pendingShipments} orders waiting to be shipped. Please process them as soon as possible.
                  </p>
                  <Link href="/marketplace/orders/pending">
                    <Button variant="outline" size="sm">View Pending Orders</Button>
                  </Link>
                </Card>
              ) : (
                <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-900/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-green-700">All Caught Up!</h4>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    You have no pending shipments. All orders have been processed.
                  </p>
                </Card>
              )}
            </div>
            
            <div className="mt-8">
              <h4 className="font-medium mb-2">Shipping Methods</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Estimated Delivery</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Standard Shipping</TableCell>
                    <TableCell>3-5 business days</TableCell>
                    <TableCell>€4.99</TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Express Shipping</TableCell>
                    <TableCell>1-2 business days</TableCell>
                    <TableCell>€9.99</TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Free Shipping</TableCell>
                    <TableCell>5-7 business days</TableCell>
                    <TableCell>€0.00</TableCell>
                    <TableCell>
                      <Badge variant="outline">Active for orders over €50</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card className="p-6">
            <div className="flex items-center mb-4 gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Sales Analytics</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Track your sales performance and customer behavior over time.
            </p>
            
            <div className="border rounded-md p-4 h-64 flex items-center justify-center">
              <p className="text-muted-foreground">Sales chart will appear here</p>
            </div>
            
            <div className="mt-6">
              <h4 className="font-medium mb-2">Sales Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h5 className="text-sm font-medium mb-2">Top Products</h5>
                  <ul className="space-y-2">
                    {products && Array.isArray(products) && products.length > 0 ? (
                      products
                        .slice(0, 3)
                        .map((product: any) => (
                          <li key={product.id} className="flex justify-between items-center">
                            <span className="truncate max-w-[200px]">{product.name}</span>
                            <Badge variant="outline">{product.sold || 0} sold</Badge>
                          </li>
                        ))
                    ) : (
                      <li className="text-muted-foreground">No products data</li>
                    )}
                  </ul>
                </Card>
                
                <Card className="p-4">
                  <h5 className="text-sm font-medium mb-2">Best Days</h5>
                  <ul className="space-y-2">
                    <li className="flex justify-between items-center">
                      <span>Saturday</span>
                      <Badge variant="outline">32% of sales</Badge>
                    </li>
                    <li className="flex justify-between items-center">
                      <span>Friday</span>
                      <Badge variant="outline">28% of sales</Badge>
                    </li>
                    <li className="flex justify-between items-center">
                      <span>Sunday</span>
                      <Badge variant="outline">15% of sales</Badge>
                    </li>
                  </ul>
                </Card>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketplaceSeller;