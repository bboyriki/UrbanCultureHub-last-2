import { FC, useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Eye, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, Notification } from '@/contexts/NotificationsContext';
import { useWebSocket, MessageType } from '@/contexts/WebSocketSingletonContext';
import { useLocation } from 'wouter';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NotificationCenter: FC = () => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAsSeen, 
    markAllAsRead, 
    markAllAsSeen,
    deleteNotification 
  } = useNotifications();

  // Mark all notifications as seen when popover opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllAsSeen();
    }
  }, [open, unreadCount, markAllAsSeen]);

  // Build the correct navigation URL based on notification type and target
  const getNavigationUrl = useCallback((notification: Notification): string | null => {
    const { type, targetId, targetType, actionLink } = notification;
    const typeLower = type?.toLowerCase() || '';
    const targetTypeLower = targetType?.toLowerCase() || '';
    
    // Comment notifications should navigate to the content and scroll to comments
    const isCommentNotification = typeLower === 'comment' || 
                                   typeLower.includes('comment') ||
                                   typeLower === 'reply';
    
    // Determine the base URL based on target type
    if (targetId) {
      // Post-related notifications
      if (targetTypeLower === 'post' || typeLower.includes('post')) {
        const baseUrl = `/community?post=${targetId}`;
        return isCommentNotification ? `${baseUrl}&showComments=true` : baseUrl;
      }
      
      // Spot/Location-related notifications
      if (targetTypeLower === 'spot' || targetTypeLower === 'location' || 
          typeLower.includes('spot') || typeLower === 'spot_comment' || typeLower === 'spot_like') {
        const baseUrl = `/locations/${targetId}`;
        return isCommentNotification ? `${baseUrl}?showComments=true` : baseUrl;
      }
      
      // Event-related notifications
      if (targetTypeLower === 'event' || typeLower.includes('event') || 
          typeLower === 'event_rsvp' || typeLower === 'event_update') {
        const baseUrl = `/events/${targetId}`;
        return isCommentNotification ? `${baseUrl}?showComments=true` : baseUrl;
      }
      
      // Artwork-related notifications
      if (targetTypeLower === 'artwork' || typeLower.includes('artwork')) {
        const baseUrl = `/artwork/${targetId}`;
        return isCommentNotification ? `${baseUrl}?showComments=true` : baseUrl;
      }
      
      // Service-related notifications
      if (targetTypeLower === 'service' || typeLower.includes('service') || 
          typeLower === 'service_booked' || typeLower === 'service_reviewed') {
        return `/services/${targetId}`;
      }
      
      // Ticket-related notifications
      if (typeLower.includes('ticket')) {
        return `/events/${targetId}`;
      }
      
      // User/Profile-related notifications
      if (targetTypeLower === 'user' || targetTypeLower === 'profile' || 
          typeLower === 'follow' || typeLower === 'follow_request') {
        return `/profile/${targetId}`;
      }
    }
    
    // Fall back to actionLink if no specific URL could be built
    return actionLink || null;
  }, []);

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    const url = getNavigationUrl(notification);
    if (url) {
      setOpen(false);
      if (url.startsWith('https://')) {
        window.location.href = url;
      } else if (!url.startsWith('http://') && !url.startsWith('javascript:')) {
        navigate(url);
      }
    }
  };

  // Render notification icon based on type
  const getNotificationIcon = (type: string) => {
    // Handle WebSocket notification types
    if (type === 'ORDER_STATUS_UPDATE' || type === 'NEW_ORDER') {
      return '🛒';
    } else if (type === 'TRACKING_UPDATE') {
      return '📦';
    } else if (type === 'SYSTEM_NOTIFICATION') {
      return '⚙️';
    } else if (type === 'CONTENT_SHARED') {
      return '🔗';
    } else if (type === 'ACCOUNT_UPDATE') {
      return '👤';
    } else if (type === 'MEMBERSHIP_STATUS') {
      return '👑';
    } else if (type === 'VERIFICATION_STATUS') {
      return '✅';
    }
    
    // Handle standard notification types
    switch (type) {
      case 'event':
        return '🗓️';
      case 'message':
        return '💬';
      case 'system':
        return '🔔';
      case 'booking':
        return '📅';
      case 'ticket':
        return '🎟️';
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'artwork':
        return '🎨';
      case 'spot':
        return '📍';
      case 'verification':
        return '✅';
      case 'account':
        return '👤';
      case 'profile':
        return '👤';
      case 'membership':
        return '👑';
      case 'user':
        return '👤';
      default:
        return '📣';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative p-2" aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs min-w-[1.2rem] h-5 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {notifications?.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsRead()}
              className="text-xs flex gap-1 h-8"
            >
              <CheckCheck size={14} />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <p>Loading notifications...</p>
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 p-4 text-center">
              <Bell size={24} className="text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification: Notification) => (
                <div key={notification.id} className="relative">
                  <div 
                    className={cn(
                      "p-4 hover:bg-muted/50 cursor-pointer transition-colors flex gap-3",
                      !notification.isRead && "bg-muted/30"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="text-2xl mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{notification.title}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 absolute top-2 right-2 opacity-70 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleDateString()} 
                          {' · '}
                          {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {notification.actionText && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                            data-testid={`button-notification-action-${notification.id}`}
                          >
                            {notification.actionText}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;