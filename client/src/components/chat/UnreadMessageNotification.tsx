import React, { useEffect, useState, useRef } from "react";
import { 
  MessageSquare, 
  Bell,
  X
} from "lucide-react";
import { Link } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderImage: string | null;
  message: string;
  timestamp: string;
  read: boolean;
}

interface UnreadMessageNotificationProps {
  unreadMessages: Notification[];
  onMarkAsRead: (id: number) => void;
  onMarkMultipleAsRead?: (ids: number[], conversationId?: number) => void;
}

export const UnreadMessageNotification: React.FC<UnreadMessageNotificationProps> = ({
  unreadMessages,
  onMarkAsRead,
  onMarkMultipleAsRead
}) => {
  const [open, setOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  
  // Use a ref for processedMessageIds to prevent re-renders on changes
  const processedMessageIds = useRef<Set<number>>(new Set());
  // Track last notification timestamp for throttling
  const [lastNotificationTime, setLastNotificationTime] = useState<number>(0);
  // Constants for throttling notifications
  const NOTIFICATION_THROTTLE_MS = 3000; // Minimum 3 seconds between notifications
  
  // Process incoming messages to de-duplicate efficiently
  useEffect(() => {
    if (unreadMessages.length > 0) {
      // Create a filtered array of only new messages not yet processed
      const newUnreadMessages = unreadMessages.filter(
        message => !processedMessageIds.current.has(message.id)
      );
      
      // If we have new messages, process them
      if (newUnreadMessages.length > 0) {
        const now = Date.now();
        
        // Add all new message IDs to our processed set
        newUnreadMessages.forEach(message => {
          processedMessageIds.current.add(message.id);
        });
        
        // Prevent the set from growing too large by removing oldest entries
        if (processedMessageIds.current.size > 100) {
          const values = Array.from(processedMessageIds.current);
          processedMessageIds.current = new Set(values.slice(values.length - 100));
        }
        
        // Update last notification timestamp
        setLastNotificationTime(now);
      }
      
      // Never show the popup notification
      setShowNotification(false);
    }
  }, [unreadMessages]);
  
  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {unreadMessages.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="font-medium">Unread Messages</h3>
            {unreadMessages.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  // If batch marking is available, use it for better performance
                  if (onMarkMultipleAsRead) {
                    // Group messages by conversation for more efficient updates
                    const messagesByConversation = unreadMessages.reduce((acc, msg) => {
                      if (!acc[msg.conversationId]) {
                        acc[msg.conversationId] = [];
                      }
                      acc[msg.conversationId].push(msg.id);
                      return acc;
                    }, {} as Record<number, number[]>);
                    
                    // Mark messages as read in batches by conversation
                    Object.entries(messagesByConversation).forEach(([conversationId, messageIds]) => {
                      onMarkMultipleAsRead(messageIds, parseInt(conversationId));
                    });
                  } else {
                    // Fallback to single message marking if batch not available
                    unreadMessages.forEach(msg => onMarkAsRead(msg.id));
                  }
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {unreadMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
                <p>No unread messages</p>
              </div>
            ) : (
              <div className="divide-y">
                {unreadMessages.map((notification) => (
                  <div key={notification.id} className="flex items-start gap-3 p-3 hover:bg-muted/50">
                    <Avatar className="h-8 w-8">
                      {notification.senderImage ? (
                        <AvatarImage src={notification.senderImage} alt={notification.senderName} />
                      ) : (
                        <AvatarFallback>
                          {notification.senderName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notification.senderName}</p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <Link to={`/chat?conversation=${notification.conversationId}`}>
                          <Button variant="ghost" size="sm">
                            View Chat
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onMarkAsRead(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Visible notification indicator when new messages arrive */}
      {showNotification && unreadMessages.length > 0 && (
        <div 
          className={cn(
            "fixed bottom-4 right-4 bg-primary text-primary-foreground rounded-lg shadow-lg z-50",
            "animate-in slide-in-from-bottom-10 duration-300",
            "sm:max-w-sm max-w-[calc(100vw-2rem)]",
            "p-3 sm:p-4" // Responsive padding
          )}
        >
          <div className="flex items-start gap-2 sm:gap-3">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
              {unreadMessages[0].senderImage ? (
                <AvatarImage src={unreadMessages[0].senderImage} alt={unreadMessages[0].senderName} />
              ) : (
                <AvatarFallback>
                  {unreadMessages[0].senderName.charAt(0).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base truncate">{unreadMessages[0].senderName}</p>
              <p className="text-xs sm:text-sm opacity-90 line-clamp-2 break-words">{unreadMessages[0].message}</p>
              <div className="mt-2 flex justify-between gap-2">
                <Button 
                  size="sm" 
                  variant="secondary"
                  className="text-xs px-2 py-1 h-auto sm:h-8 sm:px-3 sm:py-1 sm:text-sm"
                  onClick={() => {
                    window.location.href = `/chat?conversation=${unreadMessages[0].conversationId}`;
                  }}
                >
                  Reply
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-xs px-2 py-1 h-auto sm:h-8 sm:px-3 sm:py-1 sm:text-sm"
                  onClick={() => setShowNotification(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            {/* Add close button on top right for easier dismissal */}
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 absolute top-1 right-1 rounded-full p-0"
              onClick={() => setShowNotification(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnreadMessageNotification;