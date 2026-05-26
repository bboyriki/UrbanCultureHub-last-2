import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket, ConnectionStatus, WebSocketMessage } from '@/contexts/WebSocketSingletonContext';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Notification {
  type: string;
  payload: any;
  timestamp: number;
}

export default function NotificationTester() {
  const [loading, setLoading] = useState(false);
  const [notificationType, setNotificationType] = useState('social_like');
  const { toast } = useToast();
  
  // Use the singleton WebSocket context
  const { connectionStatus, isConnected, subscribe, reconnect } = useWebSocket();
  
  // Track local copy of notifications for display
  const [displayNotifications, setDisplayNotifications] = useState<Notification[]>([]);

  // Subscribe to all WebSocket messages
  useEffect(() => {
    const unsubscribe = subscribe((message: WebSocketMessage) => {
      // Add the notification to the display list
      const notification: Notification = {
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp || Date.now()
      };
      
      setDisplayNotifications(prev => {
        // Check if notification is already in our list
        const existingIndex = prev.findIndex(
          n => n.timestamp === notification.timestamp && n.type === notification.type
        );
        
        if (existingIndex === -1) {
          // Show toast for the new notification
          toast({
            title: `${notification.type}`,
            description: notification.payload?.message || 'New notification received',
            variant: 'default'
          });
          
          // Add to front and keep only 10 most recent
          return [notification, ...prev].slice(0, 10);
        }
        
        return prev;
      });
    });
    
    return () => unsubscribe();
  }, [subscribe, toast]);

  // Handle reconnecting to the WebSocket
  const handleReconnect = useCallback(() => {
    reconnect();
    toast({
      title: 'Reconnecting...',
      description: 'Attempting to reconnect to WebSocket server',
    });
  }, [toast, reconnect]);

  const handleTestNotification = async () => {
    setLoading(true);
    try {
      // Use the comprehensive notification API endpoint with selected type
      const response = await apiRequest('/api/notifications/test', 'POST', {
        notificationType: notificationType,
      });
      
      toast({
        title: 'Test notification sent',
        description: `${notificationType} notification sent. Check the notification icon in the top-right corner.`,
      });
      
      console.log('Test notification response:', response);
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test notification'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearNotifications = () => {
    setDisplayNotifications([]);
    toast({
      title: 'Notifications cleared',
      description: 'All notifications have been cleared',
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          WebSocket Notification Tester
        </CardTitle>
        <CardDescription>
          Test real-time notifications and order status updates
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isConnected ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : 
                       "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {!isConnected && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReconnect}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reconnect
            </Button>
          )}
        </div>
        
        <Separator className="my-4" />
        
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notification-type">Notification Type</Label>
            <Select
              value={notificationType}
              onValueChange={setNotificationType}
            >
              <SelectTrigger id="notification-type" className="w-full">
                <SelectValue placeholder="Select notification type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Social</SelectLabel>
                  <SelectItem value="social_like">Like</SelectItem>
                  <SelectItem value="social_comment">Comment</SelectItem>
                  <SelectItem value="social_follow">Follow</SelectItem>
                  <SelectItem value="social_mention">Mention</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Content</SelectLabel>
                  <SelectItem value="content_new">New Content</SelectItem>
                  <SelectItem value="spot_featured">Featured Spot</SelectItem>
                  <SelectItem value="content_update">Content Update</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Services</SelectLabel>
                  <SelectItem value="service_booking">New Booking</SelectItem>
                  <SelectItem value="service_confirmation">Booking Confirmation</SelectItem>
                  <SelectItem value="service_reminder">Booking Reminder</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>System</SelectLabel>
                  <SelectItem value="system_alert">System Alert</SelectItem>
                  <SelectItem value="system_info">System Info</SelectItem>
                  <SelectItem value="account_verification">Account Verification</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Recent Notifications</h3>
          
          {displayNotifications.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No notifications yet. Send a test notification to see it here.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-auto p-1">
              {displayNotifications.map((notification, index) => (
                <div key={index} className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline">{notification.type}</Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs overflow-auto p-1 bg-gray-100 dark:bg-gray-800 rounded-sm">
                    {JSON.stringify(notification.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={clearNotifications} disabled={displayNotifications.length === 0}>
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
        
        <Button onClick={handleTestNotification} disabled={loading || !isConnected}>
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Test Notification
        </Button>
      </CardFooter>
    </Card>
  );
}