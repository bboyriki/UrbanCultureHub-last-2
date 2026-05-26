import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, ShoppingCart, Bell, AlertTriangle } from "lucide-react";
import OrderNotificationForm from '@/components/admin/OrderNotificationForm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TestOrderNotificationPage() {
  const [isCreatingTestOrder, setIsCreatingTestOrder] = useState(false);
  const [testOrderId, setTestOrderId] = useState<number | null>(null);
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const createTestOrder = async () => {
    setIsCreatingTestOrder(true);
    try {
      // Make a request to create a test order or get test order
      const response = await fetch('/api/test/notification', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create test order: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success && data.order) {
        setTestOrderId(data.order.id);
        toast({
          title: "Test order created",
          description: `Order #${data.order.id} ready for notifications`,
        });
      } else {
        toast({
          title: "Error creating test order",
          description: "Could not create test order",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating test order:", error);
      toast({
        title: "Error creating test order",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTestOrder(false);
    }
  };

  const useManualOrderId = () => {
    if (manualOrderId && !isNaN(parseInt(manualOrderId))) {
      setTestOrderId(parseInt(manualOrderId));
      toast({
        title: "Order ID set",
        description: `Using order ID #${manualOrderId} for notifications`,
      });
    } else {
      toast({
        title: "Invalid Order ID",
        description: "Please enter a valid numeric Order ID",
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    toast({
      title: "Success!",
      description: "Notification was successfully sent to the user. Check the notifications icon in the upper right.",
    });
  };

  return (
    <div className="container max-w-screen-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Admin Order Notification System
          </CardTitle>
          <CardDescription>
            Test and manage real-time WebSocket notifications to users about their orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {!isAdmin && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Authentication Required</AlertTitle>
              <AlertDescription>
                You must be logged in as an admin to use the order notification system.
                Please log in with an admin account to continue.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <InfoIcon className="h-5 w-5 text-blue-500" /> How the Notification System Works
            </h3>
            <p className="text-sm mb-4">
              This system allows administrators to send real-time notifications to users about their orders.
              Notifications are delivered instantly via WebSockets and also stored in the database for persistence.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-card p-4 rounded-md border">
                <h4 className="font-medium mb-2">1. Get Order ID</h4>
                <p className="text-muted-foreground">First, obtain an order ID either by creating a test order or entering an existing order ID.</p>
              </div>
              <div className="bg-card p-4 rounded-md border">
                <h4 className="font-medium mb-2">2. Compose Message</h4>
                <p className="text-muted-foreground">Create a notification message and optionally change the order status.</p>
              </div>
              <div className="bg-card p-4 rounded-md border">
                <h4 className="font-medium mb-2">3. Send Notification</h4>
                <p className="text-muted-foreground">The notification is sent in real-time and stored in the database for the customer.</p>
              </div>
            </div>
          </div>

          <Separator />

          <Tabs defaultValue="test-order">
            <TabsList className="mb-4">
              <TabsTrigger value="test-order">Create Test Order</TabsTrigger>
              <TabsTrigger value="existing-order">Use Existing Order</TabsTrigger>
            </TabsList>
            
            <TabsContent value="test-order">
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" /> Get a Test Order
                </h3>
                <p className="text-muted-foreground">
                  Create a test order with sample data to use for notifications testing
                </p>

                <Button 
                  onClick={createTestOrder} 
                  disabled={isCreatingTestOrder}
                  variant="default"
                  className="mb-4"
                >
                  {isCreatingTestOrder ? "Creating..." : "Create Test Order"}
                </Button>

                {testOrderId && (
                  <Alert className="bg-green-50 border-green-200">
                    <ShoppingCart className="h-4 w-4 text-green-500" />
                    <AlertTitle className="text-green-700">Test Order Created!</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Order ID: <span className="font-semibold">{testOrderId}</span>
                      <br />
                      <span className="text-sm text-green-600">
                        This order ID will be automatically used in the notification form below.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="existing-order">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Use an Existing Order</h3>
                <p className="text-muted-foreground">
                  Enter an existing order ID to send notifications to the actual owner
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter Order ID"
                    value={manualOrderId}
                    onChange={(e) => setManualOrderId(e.target.value)}
                  />
                  <Button onClick={useManualOrderId} disabled={!manualOrderId}>
                    Use This ID
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Bell className="h-5 w-5" /> Send Notification
            </h3>
            <p className="text-muted-foreground">
              Compose and send a notification to the customer who owns the order
            </p>

            <OrderNotificationForm orderId={testOrderId || undefined} onSuccess={handleSuccess} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}