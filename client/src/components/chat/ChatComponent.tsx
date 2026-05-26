import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket, MessageType, ConnectionStatus } from "@/contexts/WebSocketSingletonContext";
import { useState as useReactState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { 
  Send, 
  MoreVertical, 
  User, 
  Users, 
  WifiOff,
  RefreshCcw,
  Check,
  CheckCheck,
  ChevronUp,
  ArrowUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionStatusBadge } from "@/components/ui/connection-status-badge";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface ChatComponentProps {
  conversation: any;
  onConversationUpdate: () => void;
}

interface MessageStatus {
  userId: number;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ conversation, onConversationUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(1);
  const { 
    connectionStatus, 
    sendMessage, 
    notifyTyping, 
    notifyStoppedTyping,
    reconnect,
    isConnected
  } = useWebSocket();

  // Fetch messages for the conversation
  const { 
    data: messages = [], 
    isLoading,
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['/api/chat/conversations', conversation?.id, 'messages', { page }],
    queryFn: async () => {
      if (!conversation?.id) return [];
      
      const response = await apiRequest<any[]>({
        url: `/api/chat/conversations/${conversation.id}/messages?page=${page}&limit=50`,
        method: 'GET'
      });
      
      return response.data;
    },
    enabled: !!conversation?.id,
    staleTime: 10000
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!conversation?.id) return;
      
      return apiRequest({
        url: `/api/chat/conversations/${conversation.id}/read`,
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages/unread'] });
      onConversationUpdate();
    }
  });

  // Leave conversation
  const leaveConversationMutation = useMutation({
    mutationFn: async () => {
      if (!conversation?.id) return;
      
      return apiRequest({
        url: `/api/chat/conversations/${conversation.id}/leave`,
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      toast({
        title: "Left conversation",
        description: "You have left the conversation successfully.",
      });
    }
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversation?.id || !content.trim()) return;
      
      return apiRequest({
        url: `/api/chat/conversations/${conversation.id}/messages`,
        method: 'POST',
        data: { content, type: 'text' }
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations', conversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      onConversationUpdate();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error?.message || "An error occurred while sending your message.",
        variant: "destructive"
      });
    }
  });

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newMessage.trim() && connectionStatus === ConnectionStatus.CONNECTED) {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
        notifyStoppedTyping(conversation.id);
      }
      
      // WebSocket send (real-time update)
      sendMessage(MessageType.CHAT_MESSAGE, {
        conversationId: conversation.id,
        content: newMessage.trim(),
        contentType: 'text',
        recipientId: conversation.participants?.find(p => p.id !== user?.id)?.id || null,
        timestamp: Date.now()
      });
      
      // API call (persistence)
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  // Handle typing notification
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Only send typing notifications if connected
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Notify typing
      notifyTyping(conversation.id);
      
      // Set timeout to notify stopped typing after 2 seconds of inactivity
      const timeout = setTimeout(() => {
        notifyStoppedTyping(conversation.id);
        setTypingTimeout(null);
      }, 2000);
      
      setTypingTimeout(timeout as unknown as NodeJS.Timeout);
    }
  };

  // Load more messages
  const handleLoadMoreMessages = () => {
    if (loadingMoreMessages || messages.length === 0) return;
    
    setLoadingMoreMessages(true);
    setPage(prev => prev + 1);
    
    // We'll set loadingMoreMessages back to false when the data is loaded in useEffect
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && !loadingMoreMessages) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // If we were loading more messages, set it back to false
    if (loadingMoreMessages) {
      setLoadingMoreMessages(false);
      
      // If we got fewer messages than the limit, we've reached the end
      if (messages.length < 50) {
        setHasMoreMessages(false);
      }
    }
  }, [messages, loadingMoreMessages]);

  // Mark messages as read when conversation changes
  useEffect(() => {
    if (conversation?.id) {
      markAsReadMutation.mutate();
    }
    
    // Reset pagination when conversation changes
    setPage(1);
    setHasMoreMessages(true);
    
    // Focus the input when conversation changes
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [conversation?.id]);
  
  // Setup event listeners for message delivery and read confirmations
  useEffect(() => {
    // Handle message delivery confirmations
    const handleMessageDelivered = (event: CustomEvent) => {
      console.log('Message delivery confirmation received:', event.detail);
      
      // If the event relates to the current conversation, refetch messages
      if (event.detail.conversationId === conversation?.id) {
        refetchMessages();
      }
    };
    
    // Handle message read confirmations
    const handleMessageRead = (event: CustomEvent) => {
      console.log('Message read confirmation received:', event.detail);
      
      // If the event relates to the current conversation, refetch messages
      if (event.detail.conversationId === conversation?.id) {
        refetchMessages();
      }
    };
    
    // Add the event listeners
    window.addEventListener('chat:message-delivered', handleMessageDelivered as EventListener);
    window.addEventListener('chat:message-seen', handleMessageRead as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('chat:message-delivered', handleMessageDelivered as EventListener);
      window.removeEventListener('chat:message-seen', handleMessageRead as EventListener);
    };
  }, [conversation?.id, refetchMessages]);

  // Get the conversation title
  const getConversationTitle = () => {
    if (!conversation) return "Chat";
    
    if (conversation.name) return conversation.name;
    
    // For direct conversations, show the other participant's name
    if (Array.isArray(conversation.participants)) {
      const otherParticipant = conversation.participants.find((p: any) => p && p.id !== user?.id);
      return otherParticipant?.displayName || otherParticipant?.username || "Chat";
    }
    
    return "Chat";
  };

  // Get the participant's online status (for direct conversations)
  const getParticipantOnlineStatus = () => {
    if (!conversation || !Array.isArray(conversation.participants)) return null;
    
    const otherParticipant = conversation.participants.find((p: any) => p && p.id !== user?.id);
    if (!otherParticipant) return null;
    
    // Online status is either stored directly in the participant object,
    // or in a separate online status array in the conversation
    const isOnline = otherParticipant.isOnline || conversation.onlineStatus?.[otherParticipant.id] === 'online';
    const isAway = otherParticipant.isAway || conversation.onlineStatus?.[otherParticipant.id] === 'away';
    
    if (isOnline) {
      return {
        status: 'online',
        text: 'Online',
        color: 'text-green-500'
      };
    } else if (isAway) {
      return {
        status: 'away',
        text: 'Away',
        color: 'text-amber-500'
      };
    } else {
      const lastSeen = otherParticipant.lastSeen || otherParticipant.lastActive;
      let text = 'Offline';
      
      if (lastSeen) {
        try {
          const lastSeenDate = new Date(lastSeen);
          text = `Last seen ${format(lastSeenDate, 'MMM d, h:mm a')}`;
        } catch (e) {
          console.error("Error formatting last seen date:", e);
        }
      }
      
      return {
        status: 'offline',
        text,
        color: 'text-gray-400'
      };
    }
  };

  // Helper to render message status indicators
  const renderMessageStatus = (message: any) => {
    if (message.messageStatus === 'sending' || !message.deliveryStatus) {
      return <RefreshCcw className="h-3 w-3 text-muted-foreground animate-spin" />;
    }
    
    // Check if all participants have read the message
    const allRead = Array.isArray(message.deliveryStatus) && message.deliveryStatus.length > 0 && 
      message.deliveryStatus.every((status: MessageStatus) => status.userId !== user?.id && status.readAt !== null);
    
    if (allRead) {
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    }
    
    // Check if all participants have received the message
    const allDelivered = Array.isArray(message.deliveryStatus) && message.deliveryStatus.length > 0 && 
      message.deliveryStatus.every((status: MessageStatus) => status.userId !== user?.id && status.deliveredAt !== null);
    
    if (allDelivered) {
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    }
    
    return <Check className="h-3 w-3 text-muted-foreground opacity-50" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header with improved connection status */}
      <div className="px-3 py-2 sm:p-3 border-b flex flex-col">
        {/* Connection status banner with animated badge */}
        <div className="w-full flex items-center justify-between mb-2">
          <ConnectionStatusBadge 
            status={connectionStatus} 
            animated={true}
            size="md"
            variant="pill"
            className="mx-auto"
          />
          
          {/* Only show reconnect button for error or disconnected states */}
          {(connectionStatus === ConnectionStatus.ERROR || connectionStatus === ConnectionStatus.DISCONNECTED) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2 text-xs h-7 px-2"
              onClick={() => reconnect()}
            >
              <RefreshCcw className="h-3 w-3 mr-1.5" />
              Reconnect
            </Button>
          )}
        </div>
        
        {/* Conversation details */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                {Array.isArray(conversation.participants) && 
                 conversation.participants.length > 0 &&
                 conversation.participants.find((p: any) => p && p.id !== user?.id)?.profilePicture ? (
                  <AvatarImage 
                    src={conversation.participants.find((p: any) => p && p.id !== user?.id)?.profilePicture} 
                    alt={getConversationTitle()} 
                  />
                ) : (
                  <AvatarFallback><User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></AvatarFallback>
                )}
              </Avatar>
              
              {/* Enhanced online status indicator directly on avatar */}
              {(() => {
                const onlineStatus = getParticipantOnlineStatus();
                if (onlineStatus?.status === 'online') {
                  return (
                    <span className="absolute bottom-0 right-0 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 border border-background"></span>
                    </span>
                  );
                } else if (onlineStatus?.status === 'away') {
                  return (
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-amber-500 border border-background"></span>
                  );
                } else if (onlineStatus?.status === 'offline') {
                  return (
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-gray-400 border border-background"></span>
                  );
                }
                return null;
              })()}
            </div>
            
            <div>
              <h3 className="font-medium text-sm sm:text-base leading-tight">{getConversationTitle()}</h3>
              {/* User online status text */}
              {(() => {
                const onlineStatus = getParticipantOnlineStatus();
                return onlineStatus ? (
                  <p className={`text-[10px] sm:text-xs leading-tight ${onlineStatus.color}`}>
                    {onlineStatus.text}
                  </p>
                ) : (
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                    Private conversation
                  </p>
                );
              })()}
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Reconnect button for disconnected state */}
            {connectionStatus !== ConnectionStatus.CONNECTED && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={reconnect}
                      className={`h-7 px-2 flex items-center gap-1 text-xs ${
                        connectionStatus === ConnectionStatus.ERROR 
                          ? 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950/50' 
                          : 'text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-900 dark:hover:bg-amber-950/50'
                      }`}
                    >
                      {connectionStatus === ConnectionStatus.CONNECTING ? (
                        <RefreshCcw className="h-3 w-3 animate-spin" />
                      ) : connectionStatus === ConnectionStatus.ERROR ? (
                        <WifiOff className="h-3 w-3" />
                      ) : (
                        <RefreshCcw className="h-3 w-3" />
                      )}
                      <span>Reconnect</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {connectionStatus === ConnectionStatus.ERROR 
                        ? "Connection error. Click to reconnect." 
                        : connectionStatus === ConnectionStatus.CONNECTING
                          ? "Connecting to chat server..."
                          : "Disconnected. Click to reconnect."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Conversation options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs">Conversation Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => leaveConversationMutation.mutate()} className="text-xs">
                  Leave Conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 py-2 px-1 sm:px-2 md:px-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p>Loading messages...</p>
          </div>
        ) : (messages && messages.length > 0) ? (
          <div className="space-y-1">
            {/* Load More Messages Button */}
            {hasMoreMessages && (
              <div className="flex justify-center pt-1 pb-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={loadingMoreMessages}
                  onClick={handleLoadMoreMessages}
                  className="text-xs flex items-center h-7"
                >
                  {loadingMoreMessages ? (
                    <>
                      <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Load Older Messages
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {messages.map((message: any) => {
              const isOwnMessage = message.senderId === user?.id;
              
              // Get sender info directly from participants array
              // Handle both data structures: participants with 'id' or 'userId'
              const sender = conversation.participants?.find(
                (p: any) => p && (p.id === message.senderId || p.userId === message.senderId)
              );
              
              // If sender not found in participants, create a minimal sender object
              const effectiveSender = sender || { 
                id: message.senderId, 
                userId: message.senderId,
                displayName: `User ${message.senderId}`
              };
              
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  sender={effectiveSender}
                  userId={user?.id || 0} // Provide a fallback value of 0 for userId
                />
              );
            })}
            
            {/* Typing indicators */}
            {Array.isArray(conversation.typingUsers) && conversation.typingUsers.map((typingUserId: number) => {
              if (!typingUserId || typingUserId === user?.id) return null;
              
              // Get the typing user directly from participants array
              let typingUser = null;
              
              if (Array.isArray(conversation.participants)) {
                typingUser = conversation.participants.find(
                  (p: any) => p && (p.id === typingUserId || p.userId === typingUserId)
                );
              }
              
              // Create a fallback user object if user info not found
              if (!typingUser) {
                typingUser = {
                  id: typingUserId,
                  userId: typingUserId,
                  displayName: `User ${typingUserId}`,
                  profilePicture: null
                };
              }
              
              return (
                <TypingIndicator key={`typing-${typingUserId}`} user={typingUser} />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex justify-center items-center h-full text-center text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
      </ScrollArea>
      
      {/* Message input */}
      <form onSubmit={handleSendMessage} className="p-2 sm:p-3 border-t">
        <div className="flex gap-1.5">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleTyping}
            placeholder="Type a message..."
            className="flex-1 h-9 sm:h-10 text-sm"
            disabled={connectionStatus !== ConnectionStatus.CONNECTED}
          />
          <Button 
            type="submit" 
            disabled={
              !newMessage.trim() || 
              sendMessageMutation.isPending || 
              connectionStatus !== ConnectionStatus.CONNECTED
            }
            size="icon"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
        {connectionStatus !== ConnectionStatus.CONNECTED && (
          <p className={`text-xs mt-1 text-center ${
            connectionStatus === ConnectionStatus.ERROR ? 'text-red-500' : 
            connectionStatus === ConnectionStatus.CONNECTING ? 'text-amber-500' : 
            'text-gray-500'
          }`}>
            {connectionStatus === ConnectionStatus.ERROR ? 'Connection error. Reconnecting...' : 
             connectionStatus === ConnectionStatus.CONNECTING ? 'Connecting to chat server...' : 
             'Disconnected from chat server. Messages cannot be sent.'}
          </p>
        )}
      </form>
    </div>
  );
};

export default ChatComponent;