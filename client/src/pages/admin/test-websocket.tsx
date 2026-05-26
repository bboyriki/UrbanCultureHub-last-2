import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

enum NotificationType {
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  NEW_ORDER = 'NEW_ORDER',
  TRACKING_UPDATE = 'TRACKING_UPDATE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  CONTENT_SHARED = 'CONTENT_SHARED'
}

export default function TestWebSocketPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [notificationType, setNotificationType] = useState<NotificationType>(NotificationType.SYSTEM_NOTIFICATION);
  const [notificationTitle, setNotificationTitle] = useState("Test Notification");
  const [notificationContent, setNotificationContent] = useState("This is a test system notification sent via WebSocket.");
  const [targetUserId, setTargetUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      
      // Send authentication message
      if (user) {
        const authMessage = {
          type: "AUTH",
          userId: user.id,
          role: user.role
        };
        newSocket.send(JSON.stringify(authMessage));
      }

      toast({
        title: "WebSocket Connected",
        description: "Real-time notification system is now active",
      });
    };
    
    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);
        setMessages(prev => [...prev, message]);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    newSocket.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
      
      toast({
        title: "WebSocket Disconnected",
        description: "Real-time notification system connection lost",
        variant: "destructive",
      });
    };
    
    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      
      toast({
        title: "WebSocket Error",
        description: "Error in real-time notification system",
        variant: "destructive",
      });
    };
    
    setSocket(newSocket);
    
    // Cleanup function
    return () => {
      if (newSocket) {
        newSocket.close();
      }
    };
  }, [user]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle sending test notification via WebSocket
  const handleSendNotification = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "WebSocket not connected",
        description: "Cannot send notification while disconnected",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const message = {
      type: notificationType,
      payload: {
        title: notificationTitle,
        message: notificationContent,
        targetUserId: targetUserId ? parseInt(targetUserId) : undefined
      },
      timestamp: Date.now()
    };

    try {
      socket.send(JSON.stringify(message));
      
      toast({
        title: "Notification Sent",
        description: "Test notification was sent successfully",
      });
      
      // Add sent message to the list
      setMessages(prev => [...prev, { 
        ...message, 
        sent: true,
        receivedAt: new Date().toISOString()
      }]);
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
      
      toast({
        title: "Send Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  // Handle sending a share notification via REST API (as alternative)
  const handleSendShareNotification = async () => {
    setIsLoading(true);
    
    try {
      const shareData = {
        contentType: "post",
        contentId: 1,
        platform: "twitter",
        userId: user ? user.id : undefined
      };
      
      const response = await apiRequest("/api/share", undefined, {
        method: "POST",
        body: JSON.stringify(shareData),
      });
      
      toast({
        title: "Share Notification Sent",
        description: "Content shared notification was sent via REST API",
      });
      
      // Add API share notification to list
      setMessages(prev => [...prev, { 
        type: NotificationType.CONTENT_SHARED,
        payload: {
          ...shareData,
          title: "Content Shared",
          message: "A piece of content was shared on twitter"
        },
        timestamp: Date.now(),
        sent: true,
        method: "REST API",
        receivedAt: new Date().toISOString()
      }]);
    } catch (error) {
      console.error("Error sending share notification:", error);
      
      toast({
        title: "Share API Error",
        description: "Failed to send share notification",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  // Clear all messages
  const handleClearMessages = () => {
    setMessages([]);
    toast({
      title: "Messages Cleared",
      description: "All notification messages have been cleared",
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="container mx-auto py-10">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Notification Sender */}
        <Card>
          <CardHeader>
            <CardTitle>WebSocket Test Dashboard</CardTitle>
            <CardDescription>
              Send test notifications to verify WebSocket functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>

            <Separator className="my-2" />
            
            <div className="space-y-2">
              <Label htmlFor="notificationType">Notification Type</Label>
              <Select
                value={notificationType}
                onValueChange={(value) => setNotificationType(value as NotificationType)}
              >
                <SelectTrigger id="notificationType">
                  <SelectValue placeholder="Select notification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NotificationType.SYSTEM_NOTIFICATION}>System Notification</SelectItem>
                  <SelectItem value={NotificationType.ORDER_STATUS_UPDATE}>Order Status Update</SelectItem>
                  <SelectItem value={NotificationType.NEW_ORDER}>New Order</SelectItem>
                  <SelectItem value={NotificationType.TRACKING_UPDATE}>Tracking Update</SelectItem>
                  <SelectItem value={NotificationType.CONTENT_SHARED}>Content Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notificationTitle">Notification Title</Label>
              <Input
                id="notificationTitle"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Enter notification title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notificationContent">Notification Content</Label>
              <Textarea
                id="notificationContent"
                value={notificationContent}
                onChange={(e) => setNotificationContent(e.target.value)}
                placeholder="Enter notification content"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="targetUser">Target User ID (Optional)</Label>
              <Input
                id="targetUser"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="Leave empty to broadcast to all users"
              />
              <p className="text-xs text-muted-foreground">
                If empty, notification will be sent to all connected users
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={handleClearMessages}
            >
              Clear Messages
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={handleSendShareNotification}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test Share API
              </Button>
              <Button 
                onClick={handleSendNotification}
                disabled={isLoading || !connected}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send Notification
              </Button>
            </div>
          </CardFooter>
        </Card>

        {/* Notification Log */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Log</CardTitle>
            <CardDescription>
              WebSocket messages sent and received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] overflow-y-auto border rounded-md p-4 bg-muted/30">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <Alert key={index} variant={msg.sent ? "default" : "destructive"}>
                      <div className="flex justify-between items-start">
                        <div>
                          <AlertTitle className="flex items-center gap-2">
                            {msg.type}
                            {msg.sent && (
                              <Badge variant="outline" className="ml-2">Sent</Badge>
                            )}
                            {!msg.sent && (
                              <Badge variant="outline" className="ml-2">Received</Badge>
                            )}
                          </AlertTitle>
                          <AlertDescription>
                            <div className="font-medium mt-1">
                              {msg.payload?.title || "No title"}
                            </div>
                            <div className="text-sm mt-1">
                              {msg.payload?.message || JSON.stringify(msg.payload)}
                            </div>
                            {msg.method && (
                              <div className="text-xs mt-1 text-muted-foreground">
                                Method: {msg.method}
                              </div>
                            )}
                            <div className="text-xs mt-1 text-muted-foreground">
                              {formatTimestamp(msg.timestamp)}
                            </div>
                          </AlertDescription>
                        </div>
                      </div>
                    </Alert>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}