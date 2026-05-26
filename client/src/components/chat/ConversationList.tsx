import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { 
  User, 
  Users, 
  Check, 
  CheckCheck, 
  MoreHorizontal, 
  PenLine,
  Clock
} from "lucide-react";
import { useWebSocket, ConnectionStatus, MessageType } from "@/contexts/WebSocketSingletonContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionStatusBadge } from "@/components/ui/connection-status-badge";

interface ConversationListProps {
  conversations: any[];
  isLoading: boolean;
  selectedConversationId: number | null;
  onSelectConversation: (conversation: any) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  isLoading,
  selectedConversationId,
  onSelectConversation,
}) => {
  const { user } = useAuth();
  const { connectionStatus } = useWebSocket();
  const [typingUsers, setTypingUsers] = useState<Record<number, Set<number>>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  
  // Listen for typing indicators and online status updates
  useEffect(() => {
    // Setup typing indicators event listeners
    const onTyping = (event: CustomEvent) => {
      const { conversationId, userId } = event.detail;
      
      if (userId === user?.id) return; // Ignore our own typing
      
      setTypingUsers(prev => {
        const updatedTypingUsers = { ...prev };
        
        if (!updatedTypingUsers[conversationId]) {
          updatedTypingUsers[conversationId] = new Set();
        }
        
        updatedTypingUsers[conversationId].add(userId);
        return updatedTypingUsers;
      });
    };
    
    const onStoppedTyping = (event: CustomEvent) => {
      const { conversationId, userId } = event.detail;
      
      setTypingUsers(prev => {
        const updatedTypingUsers = { ...prev };
        
        if (!updatedTypingUsers[conversationId]) return prev;
        
        updatedTypingUsers[conversationId].delete(userId);
        return updatedTypingUsers;
      });
    };
    
    // Online status event listeners
    const onUserOnline = (event: CustomEvent) => {
      const { userId } = event.detail;
      if (userId === user?.id) return; // Ignore our own status
      
      setOnlineUsers(prev => {
        const updatedOnlineUsers = new Set(prev);
        updatedOnlineUsers.add(userId);
        return updatedOnlineUsers;
      });
    };
    
    const onUserOffline = (event: CustomEvent) => {
      const { userId } = event.detail;
      
      setOnlineUsers(prev => {
        const updatedOnlineUsers = new Set(prev);
        updatedOnlineUsers.delete(userId);
        return updatedOnlineUsers;
      });
    };
    
    // Register event listeners
    window.addEventListener('chat:typing', onTyping as EventListener);
    window.addEventListener('chat:stopped-typing', onStoppedTyping as EventListener);
    window.addEventListener('chat:user-online', onUserOnline as EventListener);
    window.addEventListener('chat:user-offline', onUserOffline as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('chat:typing', onTyping as EventListener);
      window.removeEventListener('chat:stopped-typing', onStoppedTyping as EventListener);
      window.removeEventListener('chat:user-online', onUserOnline as EventListener);
      window.removeEventListener('chat:user-offline', onUserOffline as EventListener);
    };
  }, [user?.id]);

  // Get conversation title or participants' names
  const getConversationTitle = (conversation: any) => {
    // If conversation has a name property, use it
    if (conversation.title) return conversation.title;
    
    // For 1-on-1 conversations
    if (Array.isArray(conversation.participants) && conversation.participants.length > 0) {
      // Try to get the other participant from participants array
      const otherParticipant = conversation.participants.find(
        (p: any) => p && p.id !== user?.id
      );
      if (otherParticipant && otherParticipant.displayName) return otherParticipant.displayName;
      if (otherParticipant && otherParticipant.id) return `User ${otherParticipant.id}`;
    }
    
    // Fallback to direct participant IDs from conversation
    if (conversation.participantOneId !== undefined || conversation.participantTwoId !== undefined) {
      const otherUserId = conversation.participantOneId === user?.id ? 
        conversation.participantTwoId : conversation.participantOneId;
      
      return otherUserId ? `User ${otherUserId}` : "Unknown User";
    }
    
    // Last resort fallback
    return "Chat";
  };
  
  // Get typing indicator message
  const getTypingIndicator = (conversation: any) => {
    if (!typingUsers[conversation.id] || typingUsers[conversation.id].size === 0) {
      return null;
    }
    
    // Get names of typing users
    const typingUserIds = Array.from(typingUsers[conversation.id]);
    
    // Try to get user names from participants array
    let typingUserNames: string[] = [];
    
    if (Array.isArray(conversation.participants) && conversation.participants.length > 0) {
      typingUserNames = typingUserIds.map(userId => {
        const participant = conversation.participants.find((p: any) => p && p.id === userId);
        return participant && participant.displayName 
               ? participant.displayName 
               : (participant && participant.id ? `User ${participant.id}` : "Someone");
      });
    } else {
      // Fallback to simple "Someone is typing"
      typingUserNames = ["Someone"];
    }
    
    if (typingUserNames.length === 1) {
      return `${typingUserNames[0]} is typing...`;
    } else if (typingUserNames.length === 2) {
      return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    } else {
      return "Several people are typing...";
    }
  };

  // Get the last message to display
  const getLastMessagePreview = (conversation: any) => {
    // Check for typing indicator first
    const typingText = getTypingIndicator(conversation);
    if (typingText) {
      return typingText;
    }
    
    if (!conversation.lastMessage) return "No messages yet";
    
    if (conversation.lastMessage.contentType === 'system') {
      return conversation.lastMessage.content;
    }
    
    const messageText = conversation.lastMessage.content.length > 30
      ? `${conversation.lastMessage.content.substring(0, 30)}...`
      : conversation.lastMessage.content;
    
    return messageText;
  };
  
  // Format the time - showing relative time for recent messages
  const formatMessageTime = (timestamp: string) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === messageDate.toDateString();
    const isWithinWeek = new Date(now.setDate(now.getDate() - 6)).getTime() <= messageDate.getTime();
    
    if (isToday) {
      // If less than an hour ago, show "X minutes ago"
      if (now.getTime() - messageDate.getTime() < 3600000) {
        return formatDistanceToNow(messageDate, { addSuffix: true });
      }
      return format(messageDate, "HH:mm");
    } else if (isYesterday) {
      return "Yesterday";
    } else if (isWithinWeek) {
      return format(messageDate, "E"); // Day of week
    } else {
      return format(messageDate, "MMM d"); // Month and day
    }
  };

  // Render message status icon for the last message
  const renderLastMessageStatus = (conversation: any) => {
    if (!conversation.lastMessage || conversation.lastMessage.senderId !== user?.id) {
      return null;
    }
    
    const deliveryStatuses = conversation.lastMessage.deliveryStatus || [];
    const allDelivered = deliveryStatuses.length > 0 && 
      deliveryStatuses.every((status: any) => status.deliveredAt !== null);
    
    const allRead = deliveryStatuses.length > 0 && 
      deliveryStatuses.every((status: any) => status.readAt !== null);
    
    if (allRead) {
      return <CheckCheck className="h-3 w-3 text-primary" />;
    }
    
    if (allDelivered) {
      return <Check className="h-3 w-3 text-muted-foreground" />;
    }
    
    return <Check className="h-3 w-3 text-muted-foreground opacity-50" />;
  };

  // Check if a conversation has any unread messages
  const hasUnreadMessages = (conversation: any) => {
    if (!conversation.lastMessage || conversation.lastMessage.senderId === user?.id) {
      return false;
    }
    
    // Check if the current user has read the last message
    const userStatus = conversation.lastMessage.deliveryStatus?.find(
      (status: any) => status.userId === user?.id
    );
    
    return !userStatus || !userStatus.readAt;
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <ScrollArea className="flex-1 border rounded-lg">
        <div className="p-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 flex items-center gap-3 border-b last:border-b-0">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 border rounded-lg">
      {conversations.length > 0 ? (
        <div>
          {conversations.map((conversation) => {
            const isSelected = selectedConversationId === conversation.id;
            const title = getConversationTitle(conversation);
            const isUnread = hasUnreadMessages(conversation);
            const isTyping = typingUsers[conversation.id] && typingUsers[conversation.id].size > 0;
            
            return (
              <div
                key={conversation.id}
                className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected 
                    ? "bg-muted/80" 
                    : "hover:bg-muted/40"
                } ${isUnread ? "font-medium" : ""} border-b last:border-b-0`}
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="relative">
                  <Avatar>
                    {Array.isArray(conversation.participants) && 
                     conversation.participants.length > 0 && 
                     conversation.participants.find((p: any) => p && p.id !== user?.id)?.profilePicture ? (
                      <AvatarImage 
                        src={conversation.participants.find((p: any) => p && p.id !== user?.id)?.profilePicture} 
                        alt={title}
                      />
                    ) : (
                      <AvatarFallback>
                        {title && title[0] ? title[0] : <User />}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  {/* Online status indicator with pulse animation */}
                  {Array.isArray(conversation.participants) && 
                   conversation.participants.length > 0 && 
                   conversation.participants.find((p: any) => p && p.id !== user?.id)?.id && (
                    onlineUsers.has(conversation.participants.find((p: any) => p && p.id !== user?.id)?.id) ? (
                      <span className="absolute bottom-0 right-0 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border border-background"></span>
                      </span>
                    ) : (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-gray-300 border border-background opacity-75" />
                    )
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-medium truncate">{title}</h4>
                    {conversation.lastMessage && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatMessageTime(conversation.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <p className={`text-sm truncate flex items-center ${
                      isUnread ? "text-foreground" : "text-muted-foreground"
                    } ${isTyping ? "text-primary" : ""}`}>
                      {isTyping && <PenLine className="h-3 w-3 mr-1 animate-pulse" />}
                      {getLastMessagePreview(conversation)}
                    </p>
                    <div className="ml-2 flex items-center">
                      {renderLastMessageStatus(conversation)}
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary ml-1"></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center h-[200px] text-center p-4 gap-2">
          <Users className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground">
            Start a new conversation to connect with others
          </p>
        </div>
      )}
      
      <div className="p-2 flex items-center justify-center border-t">
        <ConnectionStatusBadge 
          status={connectionStatus} 
          animated={true}
          size="sm"
          variant="pill"
          className="mx-auto"
        />
      </div>
    </ScrollArea>
  );
};

export default ConversationList;