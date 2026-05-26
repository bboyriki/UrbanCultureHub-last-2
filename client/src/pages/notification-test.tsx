import { useState, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { initWebSocket, sendMessage } from "@/lib/websocket";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import NotificationCenter from "@/components/notifications/NotificationCenter";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, MessageSquare, AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";

// Notification types supported by our WebSocket server
enum NotificationType {
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  NEW_ORDER = 'NEW_ORDER',
  TRACKING_UPDATE = 'TRACKING_UPDATE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  CONTENT_SHARED = 'CONTENT_SHARED',
  SERVICE_BOOKING = 'SERVICE_BOOKING',
  BOOKING_STATUS_UPDATE = 'BOOKING_STATUS_UPDATE',
  ADMIN_ORDER_UPDATE = 'ADMIN_ORDER_UPDATE',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  DIGITAL_PRODUCT_READY = 'DIGITAL_PRODUCT_READY'
}

export default function NotificationTestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.SYSTEM_NOTIFICATION);
  const [notificationTitle, setNotificationTitle] = useState("Test Notification");
  const [notificationContent, setNotificationContent] = useState("This is a test notification sent through the WebSocket system");
  const [actionLink, setActionLink] = useState("/dashboard");
  const [actionText, setActionText] = useState("View Details");
  const [targetUserId, setTargetUserId] = useState(user?.id?.toString() || "1");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  
  // Check WebSocket connection status
  const checkConnectionStatus = () => {
    // Get WebSocket status from meta tag
    const metaTag = document.querySelector('meta[name="websocket-status"]');
    setConnected(metaTag?.getAttribute('content') === 'connected');
  };
  
  // Initialize WebSocket connection if needed
  const handleConnect = () => {
    initWebSocket();
    toast({
      title: "Connecting...",
      description: "Attempting to connect to notification system",
    });
    
    // Give it a moment to connect
    setTimeout(() => {
      checkConnectionStatus();
    }, 1000);
  };
  
  // Send a test notification
  const handleSendNotification = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to send notifications",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSending(true);
      addLog(`Sending ${notificationType} notification to user ${targetUserId}`);
      
      // If it's a direct WebSocket notification
      if (['SYSTEM_NOTIFICATION', 'CHAT_MESSAGE'].includes(notificationType)) {
        sendMessage({
          type: notificationType,
          targetUserId: parseInt(targetUserId),
          payload: {
            title: notificationTitle,
            message: notificationContent,
            actionLink,
            actionText,
            timestamp: new Date().toISOString()
          }
        });
        
        toast({
          title: "Notification Sent",
          description: "WebSocket notification has been sent successfully",
        });
        addLog("WebSocket notification sent successfully");
      } 
      // Otherwise use the API for persistent notifications
      else {
        const response = await apiRequest('/api/notifications/send', 'POST', {
          userId: parseInt(targetUserId),
          fromUserId: user.id,
          title: notificationTitle,
          message: notificationContent,
          type: notificationType,
          actionLink,
          actionText
        });
        
        if (response.ok) {
          const data = await response.json();
          toast({
            title: "Notification Sent",
            description: "Persistent notification has been created successfully",
          });
          addLog(`Persistent notification created with ID: ${data.id}`);
        } else {
          const errorData = await response.json();
          toast({
            title: "Error",
            description: errorData.message || "Failed to send notification",
            variant: "destructive",
          });
          addLog(`Error: ${errorData.message || "Failed to send notification"}`);
        }
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while sending the notification",
        variant: "destructive",
      });
      addLog(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSending(false);
    }
  };
  
  // Add a log message with timestamp
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };
  
  // Try to connect on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);
  
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Notification System Test</h1>
        <div className="flex items-center space-x-2">
          <NotificationCenter />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Send Test Notification
            </CardTitle>
            <CardDescription>
              Use this interface to send test notifications through the WebSocket system
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{connected ? 'Connected to WebSocket' : 'Not connected'}</span>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleConnect}
                disabled={connected}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {connected ? 'Connected' : 'Connect'}
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Notification Type */}
              <div className="space-y-2">
                <Label htmlFor="notification-type">Notification Type</Label>
                <Select
                  value={notificationType}
                  onValueChange={(value) => setNotificationType(value as NotificationType)}
                >
                  <SelectTrigger id="notification-type">
                    <SelectValue placeholder="Select notification type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Notification Types</SelectLabel>
                      <SelectItem value={NotificationType.SYSTEM_NOTIFICATION}>System Notification</SelectItem>
                      <SelectItem value={NotificationType.ORDER_STATUS_UPDATE}>Order Status Update</SelectItem>
                      <SelectItem value={NotificationType.NEW_ORDER}>New Order</SelectItem>
                      <SelectItem value={NotificationType.TRACKING_UPDATE}>Tracking Update</SelectItem>
                      <SelectItem value={NotificationType.SERVICE_BOOKING}>Service Booking</SelectItem>
                      <SelectItem value={NotificationType.BOOKING_STATUS_UPDATE}>Booking Status Update</SelectItem>
                      <SelectItem value={NotificationType.CONTENT_SHARED}>Content Shared</SelectItem>
                      <SelectItem value={NotificationType.ADMIN_ORDER_UPDATE}>Admin Order Update</SelectItem>
                      <SelectItem value={NotificationType.CHAT_MESSAGE}>Chat Message</SelectItem>
                      <SelectItem value={NotificationType.DIGITAL_PRODUCT_READY}>Digital Product Ready</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Target User ID */}
              <div className="space-y-2">
                <Label htmlFor="target-user">Target User ID</Label>
                <Input
                  id="target-user"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="User ID to send notification to"
                />
                <p className="text-xs text-muted-foreground">
                  Using your own user ID ({user?.id}) to see the notification instantly
                </p>
              </div>
              
              {/* Notification Title */}
              <div className="space-y-2">
                <Label htmlFor="notification-title">Notification Title</Label>
                <Input
                  id="notification-title"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="Title of the notification"
                />
              </div>
              
              {/* Notification Content */}
              <div className="space-y-2">
                <Label htmlFor="notification-content">Notification Content</Label>
                <Textarea
                  id="notification-content"
                  value={notificationContent}
                  onChange={(e) => setNotificationContent(e.target.value)}
                  placeholder="Content of the notification"
                  className="resize-none h-20"
                />
              </div>
              
              {/* Action Link & Text */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="action-link">Action Link</Label>
                  <Input
                    id="action-link"
                    value={actionLink}
                    onChange={(e) => setActionLink(e.target.value)}
                    placeholder="URL to navigate to when clicked"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="action-text">Action Text</Label>
                  <Input
                    id="action-text"
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    placeholder="Text for the action button"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <div className="w-full p-3 rounded-md bg-blue-50 border border-blue-200">
              <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Digital Product Test
              </h4>
              <p className="text-xs text-blue-600 mb-3">
                Send a digital product notification with download link. This simulates the notification a customer would receive when their digital product is available.
              </p>
              <Button 
                variant="outline" 
                className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-100" 
                onClick={() => {
                  if (!user) return;
                  setNotificationType(NotificationType.DIGITAL_PRODUCT_READY);
                  setNotificationTitle("Your Digital Product is Ready");
                  setNotificationContent("Your digital purchase is now available for download. Click the button below to access your files.");
                  setActionLink("/orders/123");
                  setActionText("Download Now");
                  setTargetUserId(user.id.toString());
                  handleSendNotification();
                }}
                disabled={!connected || sending}
              >
                {sending && notificationType === NotificationType.DIGITAL_PRODUCT_READY ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Test Digital Product Notification
                  </>
                )}
              </Button>
            </div>
            
            <Button 
              onClick={handleSendNotification} 
              disabled={sending || !connected}
              className="w-full"
            >
              {sending && notificationType !== NotificationType.DIGITAL_PRODUCT_READY ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Custom Notification
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Activity Log
            </CardTitle>
            <CardDescription>
              Recent notification activity
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-2 h-[400px] overflow-y-auto">
              {logMessages.length === 0 ? (
                <div className="text-center text-muted-foreground p-4">
                  No activity yet. Send a notification to see logs.
                </div>
              ) : (
                logMessages.map((log, index) => (
                  <div key={index} className="text-xs text-muted-foreground border-l-2 border-muted pl-2 py-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Alert className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How It Works</AlertTitle>
        <AlertDescription>
          <p className="text-sm mt-1">
            This test interface demonstrates real-time notifications using WebSockets. The notification will appear in the notification center in the top-right corner.
          </p>
          <ul className="list-disc list-inside text-sm mt-2 space-y-1">
            <li><strong>System Notification</strong> and <strong>Chat Message</strong> are transient and sent only through WebSockets</li>
            <li>All other notification types are persisted to the database and also sent via WebSockets</li>
            <li><strong>Digital Product</strong> notifications include a special toast with a download button and appear in the notification center</li>
            <li>The notification center displays both transient and persistent notifications</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}