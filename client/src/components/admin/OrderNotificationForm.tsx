import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface OrderNotificationFormProps {
  orderId?: number;
  onSuccess?: () => void;
}

export default function OrderNotificationForm({ orderId: initialOrderId, onSuccess }: OrderNotificationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [orderId, setOrderId] = useState<string>(initialOrderId?.toString() || '');
  const [message, setMessage] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if the user is an admin
  useEffect(() => {
    if (user && user.role === 'admin') {
      setIsAdminAuthenticated(true);
      setAuthError(null);
    } else {
      setIsAdminAuthenticated(false);
      setAuthError("Admin authentication required to send notifications");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdminAuthenticated) {
      toast({
        title: "Authentication required",
        description: "You must be logged in as an admin to send notifications",
        variant: "destructive"
      });
      return;
    }
    
    if (!orderId || !orderId.trim()) {
      toast({
        title: "Order ID required",
        description: "Please enter a valid order ID",
        variant: "destructive"
      });
      return;
    }

    if (!message || !message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a notification message",
        variant: "destructive"
      });
      return;
    }

    if (!user || !user.id) {
      toast({
        title: "Authentication error",
        description: "Your user ID could not be determined. Please log in again.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Include admin ID in the payload
      const payload: Record<string, any> = { 
        message,
        adminId: user.id  // Add the admin ID from the authenticated user
      };
      
      if (status && status !== 'none') {
        payload.status = status;
      }

      console.log("Sending order notification with payload:", payload);

      const response = await fetch(`/api/admin/orders/${orderId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.message || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const data = await response.json();

      toast({
        title: "Notification sent successfully",
        description: `Order #${orderId} notification sent to user`,
      });

      // Reset form fields except orderId which might be needed for multiple notifications
      setMessage('');
      setStatus('');

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({
        title: "Error sending notification",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Send Order Notification</CardTitle>
        <CardDescription>
          Send a custom notification to a customer about their order
        </CardDescription>
      </CardHeader>

      {authError && (
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>
              {authError}. You must be logged in as an admin to use this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderId">Order ID</Label>
            <Input 
              id="orderId" 
              placeholder="Enter order ID" 
              value={orderId} 
              onChange={(e) => setOrderId(e.target.value)}
              required
              disabled={isLoading || !isAdminAuthenticated}
            />
            {orderId && (
              <p className="text-xs text-muted-foreground mt-1">
                Sending notification to customer of order #{orderId}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Notification Message</Label>
            <Textarea 
              id="message" 
              placeholder="Enter the message to send to the customer"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              disabled={isLoading || !isAdminAuthenticated}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This message will be sent as a real-time notification to the customer's browser
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Update Order Status (Optional)</Label>
            <Select 
              value={status} 
              onValueChange={setStatus} 
              disabled={isLoading || !isAdminAuthenticated}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Keep current status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keep current status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {status && status !== 'none' 
                ? `The order status will be updated to "${status}"`
                : "The order status will remain unchanged"}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            type="submit" 
            disabled={isLoading || !isAdminAuthenticated} 
            className="w-full"
          >
            {isLoading ? "Sending..." : "Send Notification"}
          </Button>
          {!isAdminAuthenticated && (
            <p className="text-xs text-muted-foreground text-center">
              Please log in as an admin to send notifications
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}