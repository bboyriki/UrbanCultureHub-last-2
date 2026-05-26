import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket, ConnectionStatus } from '@/lib/websocket';
import { apiRequest } from '@/lib/queryClient';
import { Check, Info, AlertTriangle, X, RefreshCw, Send, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ServiceBookingNotifications } from '@/components/services/ServiceBookingNotifications';

// Define message types for visual differentiation
interface Message {
  id: string;
  text: string;
  type: 'system' | 'sent' | 'received' | 'error';
  timestamp: Date;
}

interface TestNotification {
  id: string;
  userId: number;
  serviceName: string;
  customerName: string;
  price: string;
  bookingId: number;
  createdAt: string;
}

/**
 * WebSocket Demo Page
 * 
 * This page demonstrates the real-time websocket functionality integrated into the application,
 * allowing users to:
 * 1. Test the WebSocket connection
 * 2. Monitor the connection status
 * 3. Send and receive real-time messages
 * 4. Simulate system notifications
 */
export default function WebSocketDemoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [notificationType, setNotificationType] = useState('SERVICE_BOOKING');
  const [customNotification, setCustomNotification] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    status,
    sendMessage,
    connect,
    disconnect,
    isReady
  } = useWebSocket({
    autoReconnect,
    onOpen: () => {
      addMessage('WebSocket connection established', 'system');
    },
    onClose: () => {
      addMessage('WebSocket connection closed', 'system');
    },
    onError: (error) => {
      addMessage(`WebSocket error: ${error.message}`, 'error');
    },
    onMessage: (data) => {
      try {
        const parsedData = JSON.parse(data);
        addMessage(`Received: ${JSON.stringify(parsedData, null, 2)}`, 'received');
      } catch (e) {
        addMessage(`Received: ${data}`, 'received');
      }
    }
  });

  // Automatically scroll to the bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add a new message to the chat
  const addMessage = (text: string, type: Message['type']) => {
    setMessages(prev => [
      ...prev, 
      { 
        id: crypto.randomUUID(), 
        text, 
        type, 
        timestamp: new Date() 
      }
    ]);
  };

  // Handle sending a message via WebSocket
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    if (isReady) {
      // Send as a structured message object
      const messageObj = {
        type: 'MESSAGE',
        text: inputMessage,
        timestamp: new Date().toISOString()
      };
      sendMessage(messageObj);
      addMessage(`Sent: ${inputMessage}`, 'sent');
      setInputMessage('');
    } else {
      addMessage('Cannot send message: WebSocket not connected', 'error');
      toast({
        title: "Connection Error",
        description: "WebSocket is not connected. Try reconnecting first.",
        variant: "destructive"
      });
    }
  };

  // Send a test service booking notification
  const sendTestServiceBookingNotification = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to send test notifications",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate a unique test notification
      const testNotification: TestNotification = {
        id: crypto.randomUUID(),
        userId: user.id,
        serviceName: "Test Service Booking",
        customerName: "Test Customer",
        price: "€99.99",
        bookingId: Math.floor(Math.random() * 1000) + 1,
        createdAt: new Date().toISOString()
      };

      // Log the notification in UI
      addMessage(`Sending test notification: ${JSON.stringify(testNotification, null, 2)}`, 'sent');

      // Send the test notification via WebSocket
      const messageToSend = {
        type: 'TEST_NOTIFICATION',
        notificationType: notificationType,
        payload: customNotification ? JSON.parse(customNotification) : testNotification
      };
      
      // Send via WebSocket if connected, otherwise use API
      if (status === ConnectionStatus.CONNECTED) {
        sendMessage(messageToSend);
        toast({
          title: "Notification Sent",
          description: "Test notification has been sent via WebSocket",
          variant: "default"
        });
      } else {
        // Fallback to API if WebSocket not connected
        await fetch('/api/notifications/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messageToSend)
        });
        
        toast({
          title: "Notification Sent",
          description: "Test notification has been sent via API (WebSocket not connected)",
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Notification Failed",
        description: `Failed to send test notification: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // Create a status badge with appropriate colors
  const getStatusBadge = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return (
          <Badge className="bg-green-500">
            <Check className="mr-1 h-3 w-3" /> Connected
          </Badge>
        );
      case ConnectionStatus.CONNECTING:
        return (
          <Badge className="bg-yellow-500">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Connecting
          </Badge>
        );
      case ConnectionStatus.DISCONNECTED:
        return (
          <Badge className="bg-gray-500">
            <X className="mr-1 h-3 w-3" /> Disconnected
          </Badge>
        );
      case ConnectionStatus.RECONNECTING:
        return (
          <Badge className="bg-blue-500">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Reconnecting
          </Badge>
        );
      case ConnectionStatus.ERROR:
        return (
          <Badge className="bg-red-500" variant="destructive">
            <AlertTriangle className="mr-1 h-3 w-3" /> Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Info className="mr-1 h-3 w-3" /> Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">WebSocket Demo</h1>
        {getStatusBadge()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Real-time Communication</CardTitle>
              <CardDescription>
                Test WebSocket messaging and view the communication log
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <Tabs defaultValue="messages">
                <TabsList className="mb-4">
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="connection">Connection</TabsTrigger>
                </TabsList>
                
                <TabsContent value="messages" className="h-full">
                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          No messages yet. Connect to the WebSocket and send a message.
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div 
                            key={message.id} 
                            className={`p-3 rounded-lg ${
                              message.type === 'system' 
                                ? 'bg-secondary/50 text-secondary-foreground' 
                                : message.type === 'sent' 
                                ? 'bg-primary/10 border-primary/30 border' 
                                : message.type === 'received' 
                                ? 'bg-green-500/10 border-green-500/30 border' 
                                : 'bg-destructive/10 border-destructive/30 border'
                            }`}
                          >
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{message.type.toUpperCase()}</span>
                              <span>{format(message.timestamp, 'HH:mm:ss')}</span>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm font-mono">
                              {message.text}
                            </pre>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  
                  <div className="flex gap-2 mt-4">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={status !== ConnectionStatus.CONNECTED}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={status !== ConnectionStatus.CONNECTED || !inputMessage.trim()}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="connection">
                  <div className="space-y-4">
                    <Alert variant={status === ConnectionStatus.CONNECTED ? "default" : "destructive"}>
                      <Wifi className="h-4 w-4" />
                      <AlertTitle>Connection Status</AlertTitle>
                      <AlertDescription>
                        {status === ConnectionStatus.CONNECTED 
                          ? "Successfully connected to the WebSocket server." 
                          : status === ConnectionStatus.CONNECTING
                          ? "Attempting to connect to the WebSocket server..."
                          : status === ConnectionStatus.RECONNECTING
                          ? "Connection lost. Attempting to reconnect..."
                          : status === ConnectionStatus.ERROR
                          ? "Error connecting to the WebSocket server."
                          : "Disconnected from the WebSocket server."}
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="auto-reconnect" 
                          checked={autoReconnect}
                          onCheckedChange={setAutoReconnect}
                        />
                        <Label htmlFor="auto-reconnect">Auto-reconnect</Label>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={connect}
                          disabled={status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING}
                          variant="default"
                        >
                          <Wifi className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                        <Button 
                          onClick={disconnect}
                          disabled={status === ConnectionStatus.DISCONNECTED}
                          variant="outline"
                        >
                          <WifiOff className="h-4 w-4 mr-2" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="text-sm text-muted-foreground">
                WebSocket URL: {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`}
              </div>
            </CardFooter>
          </Card>
        </div>

        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Test Notifications</CardTitle>
              <CardDescription>
                Send test notifications to see real-time updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="notification-type">Notification Type</Label>
                <Select 
                  value={notificationType} 
                  onValueChange={setNotificationType}
                >
                  <SelectTrigger id="notification-type">
                    <SelectValue placeholder="Select notification type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICE_BOOKING">Service Booking</SelectItem>
                    <SelectItem value="COMMENT">Comment</SelectItem>
                    <SelectItem value="LIKE">Like</SelectItem>
                    <SelectItem value="FOLLOW">Follow</SelectItem>
                    <SelectItem value="SYSTEM">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label htmlFor="custom-notification">Custom Notification (Optional)</Label>
                <Textarea 
                  id="custom-notification"
                  placeholder="Enter custom JSON notification payload (leave empty for defaults)"
                  value={customNotification}
                  onChange={(e) => setCustomNotification(e.target.value)}
                  rows={4}
                />
              </div>
              
              <Button 
                onClick={sendTestServiceBookingNotification}
                className="w-full" 
                disabled={!user}
              >
                Send Test Notification
              </Button>
              
              {!user && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle>Authentication Required</AlertTitle>
                  <AlertDescription>
                    You must be logged in to send test notifications
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardHeader className="border-t pt-6">
              <CardTitle>Notification Component</CardTitle>
              <CardDescription>
                Real-time booking notification example
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center py-6">
              <ServiceBookingNotifications />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}