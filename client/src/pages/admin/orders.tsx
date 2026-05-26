import React from 'react';
import { Helmet } from 'react-helmet';
import OrderManagement from '@/components/admin/OrderManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, BarChart3, Calendar, Package, Users } from 'lucide-react';

export default function AdminOrdersPage() {
  // Get some basic stats for the dashboard cards
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });

  return (
    <div className="container py-8">
      <Helmet>
        <title>Order Management | Urban Culture Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-muted-foreground">
            Manage customer orders, update statuses, and handle shipping information.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Orders
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '—' : stats?.orderCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                All-time orders
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Revenue
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '—' : stats?.totalRevenue ? 
                  new Intl.NumberFormat('nl-NL', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(parseFloat(stats.totalRevenue)) : 
                  '€0,00'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Total sales revenue
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Customers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '—' : stats?.activeCustomers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Unique customers
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Orders
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? '—' : stats?.recentOrders || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="shipped">Shipped</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <OrderManagement />
          </TabsContent>
          <TabsContent value="pending" className="mt-4">
            <OrderManagement statusFilter="pending" />
          </TabsContent>
          <TabsContent value="processing" className="mt-4">
            <OrderManagement statusFilter="processing" />
          </TabsContent>
          <TabsContent value="shipped" className="mt-4">
            <OrderManagement statusFilter="shipped" />
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            <OrderManagement statusFilter="completed" />
          </TabsContent>
        </Tabs>

        <Alert variant="default" className="mt-4 bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Important Note</AlertTitle>
          <AlertDescription className="text-amber-700">
            When updating order status to "Shipped", make sure to include tracking information so customers can monitor their deliveries.
            All status updates will trigger email notifications to customers automatically.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}