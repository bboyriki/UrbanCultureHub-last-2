import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket, WebSocketMessage as SingletonWebSocketMessage } from '@/contexts/WebSocketSingletonContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useRoute, Link } from 'wouter';
import { isSellerNotification, getSellerRedirectUrl } from '@/lib/notificationRedirects';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bell,
  ChevronRight,
  PackageCheck,
  Check,
  X,
  Clock,
  Share2,
  MessageSquare,
  AlertCircle,
  ShoppingCart,
  Calendar,
  LineChart,
  MoveRight,
  Briefcase,
  MapPin
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';

// Type definitions 
interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  isSeen: boolean;
  createdAt: string;
  actionLink?: string;
  actionText?: string;
  metadata?: {
    targetId?: number;
    eventId?: number;
    serviceId?: number;
    productId?: number;
    spotId?: number;
    orderId?: number;
    bookingId?: number;
    [key: string]: any;
  };
}

interface WebSocketNotification {
  type: string;
  payload: {
    title: string;
    message: string;
    actionLink?: string;
    actionText?: string;
    metadata?: {
      targetId?: number;
      eventId?: number;
      serviceId?: number;
      productId?: number;
      spotId?: number;
      orderId?: number;
      bookingId?: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
  timestamp: number;
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [wsNotifications, setWsNotifications] = useState<WebSocketNotification[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  
  // Load persistent notifications from the server
  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<Notification[]>;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true
  });
  
  // Process notifications when they change
  useEffect(() => {
    if (notifications) {
      notificationsRef.current = notifications;
      updateUnreadCount();
    }
  }, [notifications]);
  
  // Update the unread count
  const updateUnreadCount = () => {
    if (notificationsRef.current) {
      const unread = notificationsRef.current.filter(notification => !notification.isRead).length;
      setUnreadCount(unread);
    }
  };
  
  // Track processed notifications to prevent duplicates
  const processedNotifications = useRef(new Set<string>());
  
  // Set up WebSocket connection and message handling
  useEffect(() => {
    if (!user?.id) return;
    
    // Subscribe using the singleton context
    const unsubscribe = subscribe((wsMessage: SingletonWebSocketMessage) => {
      // Convert to the expected format
      const message: WebSocketNotification = {
        type: wsMessage.type,
        payload: wsMessage.payload || {},
        timestamp: wsMessage.timestamp || Date.now()
      };
      
      console.log('Notification received:', message);
      
      // Generate a notification ID to check for duplicates
      const notificationId = `${message.type}-${message.payload.title}-${message.timestamp}`;
      
      // Skip if we've already processed this notification
      if (processedNotifications.current.has(notificationId)) {
        console.log('Skipping duplicate notification:', notificationId);
        return;
      }
      
      // Add to processed notifications
      processedNotifications.current.add(notificationId);
      
      // Limit size of processed notifications set (keep last 50)
      if (processedNotifications.current.size > 50) {
        const toRemove = Array.from(processedNotifications.current).slice(0, processedNotifications.current.size - 50);
        toRemove.forEach(id => processedNotifications.current.delete(id));
      }
      
      // Add the notification to the list (debounce using setTimeout to prevent excessive re-renders)
      setTimeout(() => {
        setWsNotifications(prev => {
          // Check if this notification is already in the list (extra safety check)
          const exists = prev.some(n => 
            n.type === message.type && 
            n.payload.title === message.payload.title && 
            n.timestamp === message.timestamp
          );
          
          if (exists) return prev;
          
          // Limit to 10 most recent notifications
          return [message, ...prev.slice(0, 9)];
        });
      }, 10);
      
      // Show a toast notification (only if not already shown)
      toast({
        title: message.payload.title,
        description: message.payload.message,
        action: (
          <div className="flex flex-col gap-2">
            {message.payload.actionLink && (
              <Link to={message.payload.actionLink}>
                <Button variant="outline" size="sm">
                  {message.payload.actionText || 'View'}
                </Button>
              </Link>
            )}
            {/* Add seller dashboard link if this is a seller notification */}
            {isSellerNotification(message.type) && (
              <Link to={getSellerRedirectUrl(
                message.type,
                // Extract the targetId from metadata when available
                message.payload.metadata ? 
                  (message.payload.metadata.targetId || 
                   message.payload.metadata.eventId || 
                   message.payload.metadata.serviceId || 
                   message.payload.metadata.productId || 
                   message.payload.metadata.spotId || null) : null
              ) || "#"}>
                <Button variant="default" size="sm" className="flex items-center">
                  <LineChart className="h-3 w-3 mr-1" /> 
                  {message.type.toLowerCase().includes('event') ? 'Event Dashboard' : 
                   message.type.toLowerCase().includes('service') ? 'Service Dashboard' : 
                   message.type.toLowerCase().includes('product') || message.type.toLowerCase().includes('order') ? 'Sales Dashboard' : 
                   message.type.toLowerCase().includes('spot') ? 'Spot Management' : 'Dashboard'}
                </Button>
              </Link>
            )}
          </div>
        ),
      });
      
      // Debounce refetch to prevent excessive API calls
      const shouldRefetch = !['SYSTEM_NOTIFICATION', 'CHAT_MESSAGE'].includes(message.type);
      if (shouldRefetch) {
        const debounceTime = 500; // 500ms debounce
        setTimeout(() => {
          refetch();
        }, debounceTime);
      }
      
      // Handle digital product notifications specially
      if (message.type === 'DIGITAL_PRODUCT_READY') {
        toast({
          title: "Digital Product Ready",
          description: message.payload.message,
          action: (
            <div className="flex flex-col gap-2">
              {message.payload.actionLink && (
                <Link to={message.payload.actionLink}>
                  <Button variant="outline" size="sm">
                    Download
                  </Button>
                </Link>
              )}
              {/* Add seller dashboard link for digital products */}
              <Link to={getSellerRedirectUrl(
                'PRODUCT_SOLD',
                message.payload.metadata ? 
                  (message.payload.metadata.targetId || 
                   message.payload.metadata.productId || null) : null
              ) || "/marketplace/sales"}>
                <Button variant="default" size="sm" className="flex items-center">
                  <LineChart className="h-3 w-3 mr-1" /> 
                  Sales Dashboard
                </Button>
              </Link>
            </div>
          ),
          duration: 10000, // Show for longer (10 seconds)
        });
      }
    });
    
    // Clean up listener on unmount
    return () => {
      unsubscribe();
      processedNotifications.current.clear();
    };
  }, [user?.id, toast, refetch, subscribe]);
  
  // Handle marking all notifications as read
  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest('/api/notifications/mark-all-read', 'POST', {
        userId: user.id
      });
      
      if (response.ok) {
        // Clear unread count and update UI
        setUnreadCount(0);
        
        // Update local notification state
        notificationsRef.current = notificationsRef.current.map(notification => ({
          ...notification,
          isRead: true
        }));
        
        // Refetch the notifications
        refetch();
        
        toast({
          title: "Success",
          description: "All notifications marked as read",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to mark notifications as read",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Handle marking a single notification as read
  const handleMarkAsRead = async (id: number) => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest(`/api/notifications/${id}/read`, 'POST', {
        userId: user.id
      });
      
      if (response.ok) {
        // Update local notification state
        notificationsRef.current = notificationsRef.current.map(notification => 
          notification.id === id ? { ...notification, isRead: true } : notification
        );
        
        // Update unread count
        updateUnreadCount();
        
        // Refetch the notifications
        refetch();
      } else {
        toast({
          title: "Error",
          description: "Failed to mark notification as read",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Get the appropriate icon for a notification type
  const getNotificationIcon = (type: string) => {
    switch (type.toUpperCase()) {
      // Order and product notifications
      case 'ORDER_STATUS_UPDATE':
      case 'TRACKING_UPDATE':
        return <PackageCheck className="h-5 w-5 text-primary" />;
      case 'NEW_ORDER':
      case 'PRODUCT_SOLD':
      case 'ORDER':
        return <ShoppingCart className="h-5 w-5 text-primary" />;
        
      // Service and booking notifications
      case 'SERVICE_BOOKING':
      case 'SERVICE_BOOKED':
      case 'BOOKING_STATUS_UPDATE':
      case 'EVENT_NOTIFICATION':
      case 'EVENT_RSVP':
      case 'EVENT':
        return <Calendar className="h-5 w-5 text-primary" />;
        
      // Social notifications
      case 'CONTENT_SHARED':
      case 'SHARE_NOTIFICATION':
      case 'SHARE':
        return <Share2 className="h-5 w-5 text-primary" />;
      
      case 'LIKE_NOTIFICATION':
      case 'POST_LIKE':
      case 'LIKE':
        return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>;
        
      case 'COMMENT_NOTIFICATION':
      case 'POST_COMMENT':
      case 'COMMENT':
      case 'REPLY_NOTIFICATION': 
      case 'COMMENT_REPLY':
      case 'REPLY':
        return <MessageSquare className="h-5 w-5 text-primary" />;
        
      // Chat and message notifications
      case 'CHAT_MESSAGE':
      case 'MESSAGE':
      case 'CHAT':
        return <MessageSquare className="h-5 w-5 text-primary" />;
        
      // Digital product notifications
      case 'DIGITAL_PRODUCT_READY':
        return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
        
      // System and admin notifications
      case 'SYSTEM_NOTIFICATION':
      case 'ADMIN_ORDER_UPDATE':
      case 'ADMIN_ACTION':
      default:
        return <Bell className="h-5 w-5 text-primary" />;
    }
  };
  
  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Format WebSocket notification timestamp
  const formatWsTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return formatRelativeTime(date.toISOString());
  };
  
  // Render a single notification
  const renderNotification = (notification: Notification, isWebSocket = false) => (
    <div key={notification.id} className={`p-4 border-b ${!notification.isRead ? 'bg-muted/50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{notification.title}</h4>
            {!isWebSocket && !notification.isRead && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleMarkAsRead(notification.id);
                }}
              >
                <Check className="h-3 w-3" />
                <span className="sr-only">Mark as read</span>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{notification.message}</p>
          
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {isWebSocket 
                ? formatWsTimestamp(notification.createdAt as unknown as number) 
                : formatRelativeTime(notification.createdAt)}
            </span>
            
            {notification.actionLink && (
              <Link to={notification.actionLink}>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                  {notification.actionText || 'View'}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
          
          {/* Show seller dashboard links in popup for seller notifications */}
          {isSellerNotification(notification.type) && (
            <div className="mt-1 flex justify-end">
              <Link to={getSellerRedirectUrl(
                notification.type, 
                // Try to extract targetId from metadata or use null
                notification.metadata ? 
                  (notification.metadata.targetId || notification.metadata.eventId || 
                   notification.metadata.serviceId || notification.metadata.productId || 
                   notification.metadata.spotId || null) : null
              ) || "#"}>
                <Button variant="outline" size="sm" className="text-xs h-6 flex items-center">
                  <LineChart className="h-3 w-3 mr-1" /> 
                  {notification.type.toLowerCase().includes('event') ? 'Events' : 
                   notification.type.toLowerCase().includes('service') ? 'Services' : 
                   notification.type.toLowerCase().includes('product') || notification.type.toLowerCase().includes('order') ? 'Sales' : 
                   notification.type.toLowerCase().includes('spot') ? 'Spot Management' : 'Dashboard'}
                  <MoveRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1 min-w-[1.1rem] h-[1.1rem] text-[0.65rem] flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="p-4 flex items-center justify-between border-b">
          <h3 className="font-medium">Notifications</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleMarkAllAsRead}
            className="h-7 text-xs"
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
        
        <Tabs defaultValue="all" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b">
            <TabsList className="w-full justify-start px-4 pt-2 h-auto bg-transparent">
              <TabsTrigger value="all" className="data-[state=active]:bg-muted">All</TabsTrigger>
              <TabsTrigger value="unread" className="data-[state=active]:bg-muted">Unread {unreadCount > 0 && `(${unreadCount})`}</TabsTrigger>
              <TabsTrigger value="realtime" className="data-[state=active]:bg-muted">Real-time</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="all" className="p-0 m-0">
            <ScrollArea className="h-[320px]">
              {!notifications || notifications.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification: Notification) => renderNotification(notification))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="unread" className="p-0 m-0">
            <ScrollArea className="h-[320px]">
              {!notifications || !notifications.filter((n: Notification) => !n.isRead).length ? (
                <div className="py-8 px-4 text-center">
                  <Check className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No unread notifications</p>
                </div>
              ) : (
                notifications
                  .filter((notification: Notification) => !notification.isRead)
                  .map((notification: Notification) => renderNotification(notification))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="realtime" className="p-0 m-0">
            <ScrollArea className="h-[320px]">
              {!wsNotifications.length ? (
                <div className="py-8 px-4 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No real-time notifications yet</p>
                </div>
              ) : (
                wsNotifications.map((notification: WebSocketNotification, index: number) => 
                  renderNotification({
                    id: -index - 1, // Negative IDs to avoid conflicts with persistent notifications
                    title: notification.payload.title,
                    message: notification.payload.message,
                    type: notification.type,
                    isRead: false,
                    isSeen: false,
                    createdAt: notification.timestamp.toString(),
                    actionLink: notification.payload.actionLink,
                    actionText: notification.payload.actionText,
                    metadata: notification.payload.metadata // Pass metadata to the notification object
                  }, true)
                )
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="p-2 border-t flex justify-center">
          <Button variant="link" size="sm" className="h-auto text-xs text-muted-foreground">
            <Link to="/profile/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}