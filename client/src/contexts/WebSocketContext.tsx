import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Define message types that match the server-side enum
export enum MessageType {
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_TYPING = 'CHAT_TYPING',
  CHAT_STOPPED_TYPING = 'CHAT_STOPPED_TYPING',
  MARK_MESSAGE_READ = 'MARK_MESSAGE_READ',
  MARK_MESSAGES_READ_BATCH = 'CHAT_MESSAGES_READ_BATCH',
  CREATE_CONVERSATION = 'CHAT_CONVERSATION_CREATED',
  PING = 'ping',
  ERROR = 'error',
  
  // Enhanced real-time chat status
  // Match the server enums exactly
  CHAT_USER_ONLINE = 'CHAT_USER_ONLINE',
  CHAT_USER_OFFLINE = 'CHAT_USER_OFFLINE',
  USER_AWAY = 'USER_AWAY',
  CHAT_MESSAGE_DELIVERED = 'CHAT_MESSAGE_DELIVERED',
  CHAT_MESSAGE_READ = 'CHAT_MESSAGE_READ',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  CHAT_PRESENCE_UPDATE = 'CHAT_PRESENCE_UPDATE',
  
  // Social interactions
  LIKE_NOTIFICATION = 'like_notification',
  COMMENT_NOTIFICATION = 'comment_notification',
  REPLY_NOTIFICATION = 'reply_notification',
  SHARE_NOTIFICATION = 'share_notification',
  MENTION_NOTIFICATION = 'mention_notification',
  FOLLOW_NOTIFICATION = 'follow_notification',
  
  // Service and booking notifications
  SERVICE_BOOKED = 'service_booked',
  SERVICE_BOOKING_UPDATED = 'service_booking_updated',
  SERVICE_BOOKING_CANCELED = 'service_booking_canceled',
  SERVICE_REVIEWED = 'service_reviewed',
  
  // Product and sales notifications
  PRODUCT_SOLD = 'product_sold',
  ORDER_STATUS_UPDATE = 'order_status_update',
  PAYMENT_RECEIVED = 'payment_received',
  
  // Content and spot notifications
  SPOT_ADDED = 'spot_added',
  SPOT_UPDATED = 'spot_updated',
  EVENT_NOTIFICATION = 'event_notification',
  EVENT_RSVP = 'event_rsvp',
  
  // Admin actions
  REPORT_ACCEPTED = 'report_accepted',
  REPORT_REJECTED = 'report_rejected',
  ADMIN_ACTION = 'admin_action',
  VERIFICATION_STATUS = 'verification_status',
  
  // User profile notifications
  ACCOUNT_UPDATE = 'account_update',
  MEMBERSHIP_STATUS = 'membership_status',
  
  // General system notifications
  SYSTEM_NOTIFICATION = 'system_notification',
  TERMS_PROMPT = 'terms_prompt',
  EXPLORE_IMAGE_UPDATE = 'explore_image_update',
}

// Socket connection status for better state management
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// Message type for WebSocket messages
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Enhanced interface for WebSocketContext to unify both implementations
interface WebSocketContextType {
  // Core functionality
  socket: WebSocket | null;
  connectionStatus: ConnectionStatus;
  lastPing: number;
  sendMessage: (type: string, payload: any) => boolean;
  reconnect: () => void;
  
  // Added functionality from hooks/use-websocket
  messages: WebSocketMessage[];
  clearMessages: () => void;
  error: Event | null;
  isConnected: boolean;
  
  // Enhanced messaging functions
  sendChatMessage: (recipientId: number, content: string, metadata?: any) => boolean;
  sendTypingIndicator: (recipientId: number, isTyping: boolean) => boolean;
  notifyTyping: (conversationId: number) => boolean;
  notifyStoppedTyping: (conversationId: number) => boolean;
  sendReadReceipt: (senderId: number, messageIds: string[]) => boolean;
  
  // Subscription functionality
  subscribe: (callback: (message: WebSocketMessage) => void) => () => void;
}

const defaultContext: WebSocketContextType = {
  socket: null,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lastPing: 0,
  sendMessage: () => false,
  reconnect: () => {},
  
  // Default values for added functionality
  messages: [],
  clearMessages: () => {},
  error: null,
  isConnected: false,
  
  // Default values for enhanced messaging
  sendChatMessage: () => false,
  sendTypingIndicator: () => false,
  sendReadReceipt: () => false,
  notifyTyping: () => false,
  notifyStoppedTyping: () => false,
  
  // Default subscription function
  subscribe: () => () => {},
};

const WebSocketContext = createContext<WebSocketContextType>(defaultContext);

interface WebSocketProviderProps {
  children: React.ReactNode;
  filterTypes?: string[];
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, filterTypes }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [lastPing, setLastPing] = useState(0);
  const [connectionErrors, setConnectionErrors] = useState(0);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<Event | null>(null);
  
  // Using refs to keep track of reconnection state
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastConnectionAttemptRef = useRef<number>(0);
  const messageTypesRef = useRef(filterTypes || []);
  const processedMessageIds = useRef(new Set<string>());
  const subscribersRef = useRef<((message: WebSocketMessage) => void)[]>([]);
  
  // CRITICAL FIX: Connection parameters optimized for stable connections
  // Set to extremely conservative values to prioritize stability over speed
  const minTimeBetweenConnections = 100; // Minimal delay between connection attempts
  const maxReconnectAttempts = 3;  // Severely limit reconnection attempts to avoid flooding
  const baseReconnectDelay = 2000; // Start with 2 second delay
  const maxReconnectDelay = 30000; // Maximum 30 seconds between attempts
  
  // Connection ID to make each connection unique
  const connectionId = useRef<string>(`${user?.id || 'anon'}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`);
  
  // Initialize WebSocket connection with debounce to prevent rapid connections/disconnections
  const initializeWebSocket = useCallback(() => {
    // Don't initialize if there's no user
    if (!user) {
      return;
    }
    
    // Prevent multiple parallel connection attempts
    // This is critical to avoid connection storms
    if (socketRef.current && 
       (socketRef.current.readyState === WebSocket.CONNECTING || 
        socketRef.current.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connecting or connected, skipping initialization');
      return;
    }
    
    // Check if we've had too many connection errors in a short period
    if (connectionErrors > 5) {
      console.log('Too many connection errors in a short period, applying extended rate limiting');
      handleRateLimiting(60000); // Wait a full minute before trying again
      
      toast({
        title: "Connection Problem",
        description: "Having trouble connecting to chat server. Waiting before retrying...",
        duration: 5000,
        variant: "destructive"
      });
      
      return;
    }
    
    // CRITICAL FIX: Completely disabled client-side connection throttling
    // This has been identified as the root cause of connection problems
    // Simply update the connection timestamp and proceed with connecting
    const now = Date.now();
    lastConnectionAttemptRef.current = now - 5000; // Set to 5 seconds ago to prevent any future throttling
    
    // Update last connection attempt timestamp
    lastConnectionAttemptRef.current = now;
    
    // If we're in the middle of a reconnect timeout, clear it
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    try {
      // Update connection status first
      setConnectionStatus(ConnectionStatus.CONNECTING);
      
      // Use secure protocol when appropriate
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Make sure we use the correct host (important for Replit)
      const host = window.location.host;
      // CRITICAL FIX: Add unique connection ID to prevent cached connections
      // Also add a forced timestamp to prevent browser caching of WebSocket connections
      const uniqueConnectionId = connectionId.current || `${user?.id || 'anon'}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const wsUrl = `${protocol}//${host}/ws?t=${Date.now()}&r=${Math.random()}&cid=${uniqueConnectionId}&userId=${user?.id || '0'}`;
      
      console.log('Initializing WebSocket connection to:', wsUrl, 'User ID:', user?.id);
      
      // Create new socket connection with proper timeout handling
      const newSocket = new WebSocket(wsUrl);
      socketRef.current = newSocket;
      
      // Connection timeout handler to avoid hanging in CONNECTING state
      const connectionTimeout = setTimeout(() => {
        if (newSocket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout after 10 seconds');
          newSocket.close();
          setConnectionStatus(ConnectionStatus.ERROR);
          setConnectionErrors(prev => prev + 1);
          attemptReconnect();
        }
      }, 10000); // 10 second connection timeout
      
      // Handle successful connection with optimized connection and authentication
      newSocket.onopen = () => {
        console.log('WebSocket connection is now OPEN');
        reconnectAttemptRef.current = 0;
        setConnectionErrors(0);
        
        // Clear the connection timeout
        clearTimeout(connectionTimeout);
        
        // Set socket buffer size to optimize binary transfers
        newSocket.binaryType = 'arraybuffer';
        
        // Wait a moment before setting to CONNECTED (we'll set it after auth success)
        setConnectionStatus(ConnectionStatus.CONNECTING);
        console.log('Connection status updated to CONNECTING, readyState:', newSocket.readyState);
        
        // Authenticate immediately without delay
        if (user) {
          console.log('WebSocket connection established, authenticating immediately');
          
          try {
            // Send auth message immediately - remove delay to improve responsiveness
            if (newSocket && newSocket.readyState === WebSocket.OPEN) {
              console.log('Sending authentication to WebSocket server');
              const authData = { 
                userId: user.id,
                role: user.role || 'user',
                username: user.displayName || user.email,
                displayName: user.displayName,
                email: user.email,
                profilePicture: user.profilePicture,
                clientTimestamp: Date.now() // Add timestamp for latency calculation
              };
              
              console.log('Auth data being sent:', authData);
              
              // Send auth message with minimal delay to improve responsiveness
              // Try immediate auth first, then retry with delay if needed
              const sendAuthData = () => {
                if (newSocket.readyState === WebSocket.OPEN) {
                  // Add a unique connection ID to help with connection tracking on server
                  const enhancedAuthData = {
                    ...authData,
                    connectionId: `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    deviceInfo: {
                      userAgent: navigator.userAgent,
                      language: navigator.language,
                      platform: navigator.platform,
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                  };
                  
                  // CRITICAL: Send the auth data with the exact string 'auth' that the server expects
                  sendMessageWithSocket(newSocket, 'auth', enhancedAuthData);
                  
                  // Log the exact auth data sent to help with debugging
                  console.log('Auth data being sent:', {
                    type: 'auth',
                    ...enhancedAuthData
                  });
                  
                  console.log('Sent enhanced auth message with connection ID:', enhancedAuthData.connectionId);
                  
                  // Wait for auth_success before setting the status to connected
                  // This will be handled by the onmessage handler
                  // DO NOT set connected status here anymore
                  
                  // Send a ping immediately to measure and establish connection latency
                  setTimeout(() => {
                    if (newSocket.readyState === WebSocket.OPEN) {
                      sendMessageWithSocket(newSocket, MessageType.PING, { timestamp: Date.now() });
                    }
                  }, 500);
                  
                  return true;
                }
                return false;
              };
              
              // Try to send auth immediately
              if (!sendAuthData()) {
                // If failed, retry with delay
                setTimeout(() => {
                  if (!sendAuthData() && newSocket.readyState === WebSocket.OPEN) {
                    // Last attempt with simplified auth data - use 'auth' string
                    sendMessageWithSocket(newSocket, 'auth', {
                      userId: user.id,
                      role: user.role || 'user',
                      timestamp: Date.now()
                    });
                    // Don't set connection status here, wait for auth_success
                  }
                }, 300);
              }
            } else {
              console.log('Socket not ready for authentication, connection state:', 
                newSocket ? newSocket.readyState : 'null');
              setConnectionStatus(ConnectionStatus.ERROR);
            }
          } catch (err) {
            console.error('Error during WebSocket authentication:', err);
            setConnectionStatus(ConnectionStatus.ERROR);
          }
        }
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          // Check for auth success message and update connection status
          if (data.type === 'auth_success' || data.type === 'AUTH_SUCCESS') {
            console.log('✅ Authentication successful, setting connection status to CONNECTED');
            setConnectionStatus(ConnectionStatus.CONNECTED);
            
            // Dispatch custom event for components to update
            const authEvent = new CustomEvent('websocket:authenticated', {
              detail: { timestamp: Date.now() }
            });
            window.dispatchEvent(authEvent);
            
            // Send a ping to verify connection is fully functional
            setTimeout(() => {
              if (newSocket.readyState === WebSocket.OPEN) {
                sendMessageWithSocket(newSocket, MessageType.PING, { timestamp: Date.now() });
              }
            }, 200);
          }
          
          // Enhanced logging for delivery status
          else if (data.type === 'CHAT_MESSAGE_DELIVERED' || data.type === MessageType.CHAT_MESSAGE_DELIVERED) {
            console.log('💬 Message delivery confirmation received:', data.payload);
            
            // Dispatch custom event for UI components to update
            const deliveryEvent = new CustomEvent('chat:message-delivered', {
              detail: data.payload
            });
            window.dispatchEvent(deliveryEvent);
            
          } else if (data.type === 'CHAT_MESSAGE_READ' || data.type === MessageType.CHAT_MESSAGE_READ) {
            console.log('👀 Message read confirmation received:', data.payload);
            
            // Dispatch custom event for UI components to update
            const readEvent = new CustomEvent('chat:message-seen', {
              detail: data.payload
            });
            window.dispatchEvent(readEvent);
            
          } else if (data.type === 'CHAT_USER_ONLINE' || data.type === MessageType.CHAT_USER_ONLINE) {
            console.log('🟢 User online notification received:', data.payload);
          } else if (data.type === 'CHAT_USER_OFFLINE' || data.type === MessageType.CHAT_USER_OFFLINE) {
            console.log('⚪ User offline notification received:', data.payload);
          } else if (data.type === 'CHAT_TYPING' || data.type === MessageType.CHAT_TYPING) {
            console.log('⌨️ User typing notification received:', data.payload);
          } else if (data.type === 'CHAT_STOPPED_TYPING' || data.type === MessageType.CHAT_STOPPED_TYPING) {
            console.log('🛑 User stopped typing notification received:', data.payload);
          } else if (data.type === 'CHAT_MESSAGE' || data.type === MessageType.CHAT_MESSAGE) {
            console.log('📨 Chat message received:', data.payload);
            
            // Auto-send delivery confirmation if we're not the sender
            const currentUserId = localStorage.getItem('userId');
            if (data.payload?.senderId !== parseInt(currentUserId || '0', 10)) {
              console.log("Automatically sending delivery confirmation for message:", data.payload.id);
              
              // Send delivery confirmation
              sendMessageWithSocket(newSocket, 'message_delivered', {
                messageId: data.payload.id,
                conversationId: data.payload.conversationId,
                timestamp: Date.now()
              });
            }
          }
          
          // Ensure connection status is set to CONNECTED if we're receiving messages
          if (connectionStatus !== ConnectionStatus.CONNECTED) {
            console.log('Correcting connection status to CONNECTED based on received message');
            setConnectionStatus(ConnectionStatus.CONNECTED);
          }
          
          // Process the message for both the main context and subscribers
          const message: WebSocketMessage = {
            type: data.type,
            payload: data.payload || data,
            timestamp: data.timestamp || Date.now()
          };
          
          // Generate a more reliable unique message ID for deduplication
          // Enhanced to be more robust for different message types
          let messageId: string;
          
          // Special handling for chat messages to prevent duplicates
          if (message.type === MessageType.CHAT_MESSAGE || 
              message.type === 'CHAT_MESSAGE' || 
              message.type === 'chat_message') {
            // For chat messages, use a combination of id, conversation and content hash if available
            const msgId = message.payload.id || '';
            const convId = message.payload.conversationId || '';
            const contentSample = message.payload.content 
              ? message.payload.content.substring(0, 20) 
              : '';
            // Create a unique hash for each message combining multiple properties
            messageId = `chat-${msgId}-${convId}-${contentSample.replace(/\s+/g, '')}-${message.timestamp}`;
          } 
          // Special handling for notification messages
          else if (message.type.includes('NOTIFICATION') || message.type.includes('notification')) {
            // For notifications, combine key identifying info if available
            const notifId = message.payload.id || '';
            const userId = message.payload.userId || message.payload.toUserId || '';
            const msgSample = message.payload.message 
              ? message.payload.message.substring(0, 20) 
              : '';
            messageId = `notif-${notifId}-${userId}-${msgSample.replace(/\s+/g, '')}-${message.timestamp}`;
          }
          // Default for other message types
          else {
            messageId = `${message.type}-${message.timestamp}-${message.payload.id || ''}-${JSON.stringify(message.payload).slice(0, 20)}`;
          }
          
          // Add a check for extra recent duplicates (within last 5 seconds)
          const isDuplicate = processedMessageIds.current.has(messageId);
          const now = Date.now();
          const recentDuplicate = message.type === 'CHAT_MESSAGE' && 
            Array.from(processedMessageIds.current).some(id => {
              // Check if there's a similar message in the last 5 seconds
              if (id.startsWith('chat-') && id.includes(message.payload.conversationId)) {
                const idTimestamp = parseInt(id.split('-').pop() || '0');
                return (now - idTimestamp) < 5000; // Within last 5 seconds
              }
              return false;
            });
          
          // Skip processing if duplicate
          if (isDuplicate || recentDuplicate) {
            console.log('Skipping duplicate or recent similar message:', messageId);
            return;
          }
          
          // Add to processed messages
          processedMessageIds.current.add(messageId);
          
          // Manage set size - keep only most recent messages
          if (processedMessageIds.current.size > 200) { // Increased to 200 for better coverage
            const values = Array.from(processedMessageIds.current);
            const toRemove = values.slice(0, values.length - 150); // Remove older entries
            toRemove.forEach(id => processedMessageIds.current.delete(id));
          }
          
          // Skip system connection messages in the message list but still handle them
          if (message.type === 'SYSTEM_NOTIFICATION' && 
              message.payload?.message?.includes('Connected')) {
            // Don't add to messages list
          } else {
            // Filter by message type if needed
            if (messageTypesRef.current.length === 0 || messageTypesRef.current.includes(message.type)) {
              // Update messages state with functional update to prevent race conditions
              setMessages(prev => {
                // Limit to 50 messages to prevent memory issues
                const newMessages = [message, ...prev];
                return newMessages.slice(0, 50);
              });
            }
          }
          
          // Notify all subscribers about the message
          subscribersRef.current.forEach(callback => {
            try {
              callback(message);
            } catch (error) {
              console.error('Error in subscriber callback:', error);
            }
          });
          
          // Handle pings/pongs
          if (data.type === 'pong' || data.type === 'PONG') {
            setLastPing(Date.now());
          }
          // Handle typed chat events
          else if (data.type === MessageType.CHAT_TYPING || 
                   data.type === 'CHAT_TYPING' || 
                   data.type === 'chat_typing') {
            // Dispatch a synthetic event that others can listen for
            const typingEvent = new CustomEvent('chat:typing', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(typingEvent);
          }
          else if (data.type === MessageType.CHAT_STOPPED_TYPING || 
                   data.type === 'CHAT_STOPPED_TYPING' || 
                   data.type === 'chat_stopped_typing') {
            const stoppedTypingEvent = new CustomEvent('chat:stopped-typing', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(stoppedTypingEvent);
          }
          else if (data.type === MessageType.CHAT_MESSAGE || 
                   data.type === 'CHAT_MESSAGE' || 
                   data.type === 'chat_message') {
            console.log('Received chat message via WebSocket:', data);
            // Dispatch both the WebSocket message event and chat-specific event
            // This provides real-time updates without waiting for API calls
            
            // First, create a custom event that chat components can listen for
            const messageEvent = new CustomEvent('chat:new-message', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(messageEvent);
            
            // Additionally dispatch a message delivery event to sender
            // This tells the sender the message has reached the server
            if (data.payload?.senderId && data.payload?.senderId !== user?.id) {
              // Only send delivery confirmation for messages from others
              setTimeout(() => {
                if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                  sendMessage(MessageType.CHAT_MESSAGE_DELIVERED, {
                    messageId: data.payload.id,
                    conversationId: data.payload.conversationId,
                    deliveredAt: new Date().toISOString()
                  });
                }
              }, 300); // Small delay to simulate network time
            }
          }
          else if (data.type === MessageType.CHAT_MESSAGE_DELIVERED || 
                   data.type === 'message_delivered' || 
                   data.type === 'CHAT_MESSAGE_DELIVERED') {
            console.log('Message delivery confirmation:', data.payload);
            // Update the UI to show the message has been delivered
            const deliveryEvent = new CustomEvent('chat:message-delivered', {
              detail: data.payload || data
            });
            window.dispatchEvent(deliveryEvent);
            
            // Also invalidate message status in the UI
            queryClient.invalidateQueries({
              queryKey: ['/api/chat/conversations', data.payload?.conversationId, 'messages'],
              exact: true
            });
          }
          else if (data.type === MessageType.CHAT_MESSAGE_READ || 
                   data.type === 'message_seen' || 
                   data.type === 'CHAT_MESSAGE_READ') {
            console.log('Message seen confirmation:', data.payload);
            // Update the UI to show the message has been seen
            const seenEvent = new CustomEvent('chat:message-seen', {
              detail: data.payload || data
            });
            window.dispatchEvent(seenEvent);
            
            // Also invalidate message status in the UI
            queryClient.invalidateQueries({
              queryKey: ['/api/chat/conversations', data.payload?.conversationId, 'messages'],
              exact: true
            });
          }
          else if (data.type === MessageType.MARK_MESSAGE_READ || 
                   data.type === 'MARK_MESSAGE_READ' || 
                   data.type === 'mark_message_read') {
            console.log('Message read notification:', data.payload);
            const readEvent = new CustomEvent('chat:message-read', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(readEvent);
          }
          else if (data.type === MessageType.MARK_MESSAGES_READ_BATCH || 
                   data.type === 'CHAT_MESSAGES_READ_BATCH' || 
                   data.type === 'chat_messages_read_batch') {
            console.log('Batch message read notification:', data.payload);
            // Handle batch read events more efficiently than individual updates
            const batchReadEvent = new CustomEvent('chat:messages-read-batch', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(batchReadEvent);
          }
          else if (data.type === MessageType.CHAT_USER_ONLINE || 
                   data.type === 'user_online' || 
                   data.type === 'CHAT_USER_ONLINE') {
            console.log('User online notification:', data.payload);
            // Update UI to show user is online
            const onlineEvent = new CustomEvent('chat:user-online', {
              detail: data.payload || data
            });
            window.dispatchEvent(onlineEvent);
          }
          else if (data.type === MessageType.CHAT_USER_OFFLINE || 
                   data.type === 'user_offline' || 
                   data.type === 'CHAT_USER_OFFLINE') {
            console.log('User offline notification:', data.payload);
            // Update UI to show user is offline
            const offlineEvent = new CustomEvent('chat:user-offline', {
              detail: data.payload || data
            });
            window.dispatchEvent(offlineEvent);
          }
          else if (data.type === MessageType.CHAT_PRESENCE_UPDATE || 
                   data.type === 'chat_presence_update' || 
                   data.type === 'CHAT_PRESENCE_UPDATE') {
            console.log('Chat presence update:', data.payload);
            // Update UI with presence information
            const presenceEvent = new CustomEvent('chat:presence-update', {
              detail: data.payload || data
            });
            window.dispatchEvent(presenceEvent);
          }
          // Handle server errors, including rate limiting
          else if (data.type === MessageType.ERROR || 
                   data.type === 'error' || 
                   data.type === 'ERROR') {
            console.error('WebSocket server error:', data);
            
            // Check if this is a rate limiting error
            const message = data.payload?.message || data.message || '';
            if (message.toLowerCase().includes('rate limit') || 
                message.toLowerCase().includes('too many') || 
                message.toLowerCase().includes('connection limit')) {
              
              // Handle the rate limiting case specially
              handleRateLimiting(data.payload?.retryAfter || 60000);
              
              toast({
                title: "Connection Rate Limited",
                description: "Too many connection attempts. Waiting before trying again.",
                variant: "destructive",
                duration: 5000
              });
            }
            // Only show toast for critical errors, not routine ones
            else if (data.payload?.critical || data.critical) {
              toast({
                title: "WebSocket Error",
                description: data.payload?.message || data.message || "An error occurred with the connection",
                variant: "destructive"
              });
            }
          }
          // Handle system notifications
          else if (data.type === MessageType.SYSTEM_NOTIFICATION || 
                   data.type === 'SYSTEM_NOTIFICATION') {
            // Don't need to show a toast, just log it
            console.log('System notification:', data.payload?.message || 'System message');
          }
          // Handle social interactions
          else if (
            data.type === MessageType.LIKE_NOTIFICATION || 
            data.type === MessageType.COMMENT_NOTIFICATION ||
            data.type === MessageType.REPLY_NOTIFICATION ||
            data.type === MessageType.SHARE_NOTIFICATION ||
            data.type === MessageType.MENTION_NOTIFICATION ||
            data.type === MessageType.FOLLOW_NOTIFICATION
          ) {
            // Log social notification details for debugging
            console.log(`Received social notification: ${data.type}`, data.payload);
            
            // Create a more specific notification type based on interaction type
            const specificType = data.type.toLowerCase().replace('_notification', '');
            
            // Dispatch specific event for this social interaction type
            const specificEvent = new CustomEvent(`notification:${specificType}`, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(specificEvent);
            
            // Also dispatch the general social notification event for components that listen to all
            const notificationEvent = new CustomEvent('notification:social', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(notificationEvent);
            
            // Additionally dispatch a global notification event for the notification center
            const globalEvent = new CustomEvent('notification:new', {
              detail: {
                ...data.payload,
                notificationType: data.type,
                timestamp: Date.now()
              }
            });
            window.dispatchEvent(globalEvent);
          }
          // Handle service and booking notifications
          else if (
            data.type === MessageType.SERVICE_BOOKED || 
            data.type === MessageType.SERVICE_BOOKING_UPDATED ||
            data.type === MessageType.SERVICE_BOOKING_CANCELED ||
            data.type === MessageType.SERVICE_REVIEWED
          ) {
            // Log service notification details for debugging
            console.log(`Received service notification: ${data.type}`, data.payload);
            
            // Create a more specific notification type based on service type
            const specificType = data.type.toLowerCase().replace('_', ':');
            
            // Dispatch specific event for this service interaction type
            const specificEvent = new CustomEvent(specificType, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(specificEvent);
            
            // Also dispatch the general service notification event for components that listen to all
            const notificationEvent = new CustomEvent('notification:service', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(notificationEvent);
            
            // Additionally dispatch a global notification event for the notification center
            const globalEvent = new CustomEvent('notification:new', {
              detail: {
                ...data.payload,
                notificationType: data.type,
                timestamp: Date.now(),
                category: 'service'
              }
            });
            window.dispatchEvent(globalEvent);
          }
          // Handle product and sales notifications
          else if (
            data.type === MessageType.PRODUCT_SOLD || 
            data.type === MessageType.ORDER_STATUS_UPDATE ||
            data.type === MessageType.PAYMENT_RECEIVED
          ) {
            // Log product notification details for debugging
            console.log(`Received product/sales notification: ${data.type}`, data.payload);
            
            // Create a more specific notification type
            const specificType = data.type.toLowerCase().replace('_', ':');
            
            // Dispatch specific event for this product interaction type
            const specificEvent = new CustomEvent(specificType, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(specificEvent);
            
            // Also dispatch the general product notification event
            const notificationEvent = new CustomEvent('notification:product', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(notificationEvent);
            
            // Additionally dispatch a global notification event for the notification center
            const globalEvent = new CustomEvent('notification:new', {
              detail: {
                ...data.payload,
                notificationType: data.type,
                timestamp: Date.now(),
                category: 'product'
              }
            });
            window.dispatchEvent(globalEvent);
          }
          // Handle content and spot notifications
          else if (
            data.type === MessageType.SPOT_ADDED || 
            data.type === MessageType.SPOT_UPDATED ||
            data.type === MessageType.EVENT_NOTIFICATION ||
            data.type === MessageType.EVENT_RSVP
          ) {
            // Log content notification details for debugging
            console.log(`Received content/spot notification: ${data.type}`, data.payload);
            
            // Create a more specific notification type
            const specificType = data.type.toLowerCase().replace('_', ':');
            
            // Create a category based on type
            const category = data.type.includes('EVENT') ? 'event' : 
                            data.type.includes('SPOT') ? 'spot' : 'content';
            
            // Dispatch specific event for this content interaction type
            const specificEvent = new CustomEvent(specificType, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(specificEvent);
            
            // Also dispatch the general content notification event
            const notificationEvent = new CustomEvent(`notification:${category}`, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(notificationEvent);
            
            // For backward compatibility
            const legacyContentEvent = new CustomEvent('notification:content', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(legacyContentEvent);
            
            // Additionally dispatch a global notification event for the notification center
            const globalEvent = new CustomEvent('notification:new', {
              detail: {
                ...data.payload,
                notificationType: data.type,
                timestamp: Date.now(),
                category: category
              }
            });
            window.dispatchEvent(globalEvent);
          }
          // Handle admin action notifications
          else if (
            data.type === MessageType.REPORT_ACCEPTED || 
            data.type === MessageType.REPORT_REJECTED ||
            data.type === MessageType.ADMIN_ACTION ||
            data.type === MessageType.VERIFICATION_STATUS
          ) {
            // Log admin notification details for debugging
            console.log(`Received admin notification: ${data.type}`, data.payload);
            
            // Create a more specific notification type
            const specificType = data.type.toLowerCase().replace('_', ':');
            
            // Dispatch specific event for this admin interaction type
            const specificEvent = new CustomEvent(specificType, { 
              detail: data.payload || data 
            });
            window.dispatchEvent(specificEvent);
            
            // Also dispatch the general admin notification event
            const notificationEvent = new CustomEvent('notification:admin', { 
              detail: data.payload || data 
            });
            window.dispatchEvent(notificationEvent);
            
            // Additionally dispatch a global notification event for the notification center
            const globalEvent = new CustomEvent('notification:new', {
              detail: {
                ...data.payload,
                notificationType: data.type,
                timestamp: Date.now(),
                category: 'admin',
                priority: data.type.includes('REPORT') ? 'high' : 'normal'
              }
            });
            window.dispatchEvent(globalEvent);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
        socketRef.current = null;
        
        // Only attempt reconnect if it wasn't a normal closure
        if (event.code !== 1000) {
          attemptReconnect();
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus(ConnectionStatus.ERROR);
        setConnectionErrors(prev => prev + 1);
        
        // If we've had a few errors, show a toast once
        if (connectionErrors === 2) {
          toast({
            title: "Connection Issues",
            description: "Having trouble connecting to the chat server. Will keep trying.",
            variant: "destructive"
          });
        }
      };

      // Update state with new socket
      setSocket(newSocket);
      
      // Set up ping interval for keeping connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      pingIntervalRef.current = setInterval(() => {
        if (newSocket && newSocket.readyState === WebSocket.OPEN) {
          try {
            sendMessageWithSocket(newSocket, MessageType.PING, { timestamp: Date.now() });
          } catch (error) {
            console.error('Error sending ping:', error);
          }
        }
      }, 25000); // Send ping every 25 seconds
      
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setConnectionStatus(ConnectionStatus.ERROR);
      attemptReconnect();
    }
  }, [user, toast, connectionStatus]); // Include connectionStatus so we can update it properly

  // Clean up function to properly close socket connections
  const cleanUp = useCallback(() => {
    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close socket connection
    if (socketRef.current) {
      try {
        // Only close if not already closing or closed
        if (socketRef.current.readyState === WebSocket.OPEN || 
            socketRef.current.readyState === WebSocket.CONNECTING) {
          socketRef.current.close();
        }
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      socketRef.current = null;
    }
    
    setSocket(null);
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  // Helper to send messages through the socket with enhanced error handling
  const sendMessageWithSocket = (ws: WebSocket, type: string, payload: any): boolean => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('Cannot send message - WebSocket is not in OPEN state');
      return false;
    }

    try {
      // Generate a unique message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Create message in format the server expects (type + payload structure)
      const message = JSON.stringify({
        type: type,
        payload: payload,
        timestamp: Date.now(),
        messageId: messageId
      });
      
      ws.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      
      // If we encounter a serious error, trigger a reconnect
      if (error instanceof Error && error.message.includes('network')) {
        setTimeout(() => reconnect(), 1000);
      }
      
      return false;
    }
  };

  // Function to send messages that will be exposed in the context
  const sendMessage = useCallback((type: string, payload: any): boolean => {
    return socketRef.current ? 
      sendMessageWithSocket(socketRef.current, type, payload) : 
      false;
  }, []);

  // Handle rate limiting by pausing reconnection for a longer period
  const handleRateLimiting = useCallback((retryAfter?: number) => {
    // If rate limited, use a much longer delay and only try once more
    const backoffDelay = retryAfter || 30000; // At least 30 seconds
    
    console.log(`Rate limiting detected, will pause reconnection attempts for ${backoffDelay/1000} seconds`);
    toast({
      title: "Connection Limited",
      description: "Server is busy. Waiting before reconnecting...",
      duration: 5000
    });
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Reset the reconnection counter to avoid rapid reconnections
    reconnectAttemptRef.current = 0;
    
    // Set a timeout to try again after a significant delay
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting reconnection after rate limiting pause');
      initializeWebSocket();
    }, backoffDelay);
  }, [toast, initializeWebSocket, reconnectTimeoutRef, reconnectAttemptRef]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    // Check if we've reached the maximum number of reconnection attempts
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      // Only show the toast once when we give up
      toast({
        title: "Connection Issue",
        description: "Unable to connect to the chat system after multiple attempts. You may need to refresh the page.",
        variant: "destructive"
      });
      return;
    }
    
    // Avoid duplicate reconnection timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Use exponential backoff with jitter to prevent reconnection stampedes
    const jitter = Math.random() * 0.3 + 0.85; // Random value between 0.85 and 1.15
    const delay = Math.min(
      baseReconnectDelay * Math.pow(1.5, reconnectAttemptRef.current) * jitter,
      maxReconnectDelay
    );
    
    console.log(`Attempting to reconnect in ${Math.floor(delay)}ms (attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts})`);
    
    // Set up the reconnection timer
    reconnectTimeoutRef.current = setTimeout(() => {
      // Increment the attempt counter
      reconnectAttemptRef.current += 1;
      
      // Force localStorage refresh before reconnecting to ensure credentials are current
      const currentUserId = localStorage.getItem('userId');
      if (currentUserId) {
        console.log('Refreshing connection with userId:', currentUserId);
      }
      
      // For persistent reconnection issues, try more aggressive cleanup
      if (reconnectAttemptRef.current > 3) {
        console.log('Multiple reconnection attempts failed, performing aggressive cleanup');
        if (socketRef.current) {
          try {
            socketRef.current.onclose = null; // Prevent triggering another reconnect
            socketRef.current.onerror = null;
            socketRef.current.onmessage = null;
            socketRef.current.onopen = null;
            socketRef.current.close();
          } catch (err) {
            console.log('Error during socket cleanup:', err);
          }
          socketRef.current = null;
        }
      }
      
      // Make sure we clean up before attempting to connect again
      cleanUp();
      
      // Try to reconnect
      initializeWebSocket();
    }, delay);
  }, [initializeWebSocket, cleanUp, toast, reconnectTimeoutRef, reconnectAttemptRef]);

  // Manual reconnect function exposed in the context
  const reconnect = useCallback(() => {
    cleanUp();
    reconnectAttemptRef.current = 0;
    setConnectionErrors(0);
    initializeWebSocket();
  }, [cleanUp, initializeWebSocket, reconnectAttemptRef, setConnectionErrors]);
  
  // Function to clear messages from the state
  const clearMessages = useCallback(() => {
    setMessages([]);
    processedMessageIds.current.clear();
  }, []);
  
  // Send a chat message with enhanced functionality
  const sendChatMessage = useCallback((recipientId: number, content: string, metadata?: any) => {
    if (!user?.id) return false;
    
    return sendMessage(MessageType.CHAT_MESSAGE, {
      recipientId,
      content,
      metadata,
      timestamp: Date.now()
    });
  }, [user?.id, sendMessage]);
  
  // Send typing indicator
  const sendTypingIndicator = useCallback((recipientId: number, isTyping: boolean) => {
    if (!user?.id) return false;
    
    return sendMessage(isTyping ? MessageType.CHAT_TYPING : MessageType.CHAT_STOPPED_TYPING, {
      recipientId,
      isTyping,
      timestamp: Date.now()
    });
  }, [user?.id, sendMessage]);
  
  // Notify typing status for a specific conversation
  const notifyTyping = useCallback((conversationId: number) => {
    if (!user?.id) return false;
    
    return sendMessage(MessageType.CHAT_TYPING, {
      conversationId,
      userId: user.id,
      timestamp: Date.now()
    });
  }, [user?.id, sendMessage]);
  
  // Notify stopped typing status for a specific conversation
  const notifyStoppedTyping = useCallback((conversationId: number) => {
    if (!user?.id) return false;
    
    return sendMessage(MessageType.CHAT_STOPPED_TYPING, {
      conversationId,
      userId: user.id,
      timestamp: Date.now()
    });
  }, [user?.id, sendMessage]);
  
  // Send read receipt
  const sendReadReceipt = useCallback((senderId: number, messageIds: string[]) => {
    if (!user?.id) return false;
    
    // Use MARK_MESSAGE_READ for single messages and MARK_MESSAGES_READ_BATCH for multiple
    const messageType = messageIds.length === 1 ? 
      MessageType.MARK_MESSAGE_READ : 
      MessageType.MARK_MESSAGES_READ_BATCH;
    
    return sendMessage(messageType, {
      senderId,
      messageIds,
      timestamp: Date.now()
    });
  }, [user?.id, sendMessage]);
  
  // Subscribe to WebSocket messages with a direct callback
  const subscribe = useCallback((callback: (message: WebSocketMessage) => void) => {
    // Add the subscriber to our list
    subscribersRef.current.push(callback);
    
    // If not already connected, try to connect
    if (connectionStatus !== ConnectionStatus.CONNECTED && 
        connectionStatus !== ConnectionStatus.CONNECTING) {
      initializeWebSocket();
    }
    
    // Return a cleanup function to remove the subscriber
    return () => {
      subscribersRef.current = subscribersRef.current.filter(cb => cb !== callback);
    };
  }, [connectionStatus, initializeWebSocket]);

  // Set up WebSocket when user is authenticated
  useEffect(() => {
    // Only initialize if we don't already have a connection and user is present
    if (user) {
      console.log('User authenticated, initializing WebSocket connection');
      
      // Clean up any existing connections first to ensure a fresh start
      cleanUp();
      
      // Reset connection state
      setConnectionStatus(ConnectionStatus.CONNECTING);
      reconnectAttemptRef.current = 0;
      setConnectionErrors(0);
      
      // Initialize a new connection
      initializeWebSocket();
      
      // Set up a ping interval to keep the connection alive
      const pingInterval = setInterval(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          console.log('Sending ping to keep connection alive');
          sendMessageWithSocket(socketRef.current, MessageType.PING, { timestamp: Date.now() });
        }
      }, 30000); // Send ping every 30 seconds
      
      // Store the interval ID
      pingIntervalRef.current = pingInterval;
    } else if (!user && socketRef.current) {
      console.log('User logged out, cleaning up WebSocket connection');
      cleanUp();
    }
    
    // Clean up on unmount or when dependencies change
    return () => {
      console.log('Cleaning up WebSocket connection and intervals');
      cleanUp();
    };
  }, [user, initializeWebSocket, cleanUp]);

  // Context value
  const contextValue: WebSocketContextType = {
    // Core functionality
    socket,
    connectionStatus,
    lastPing,
    sendMessage,
    reconnect,
    
    // Messages and error state
    messages,
    clearMessages,
    error: null,
    isConnected: connectionStatus === ConnectionStatus.CONNECTED,
    
    // Enhanced messaging functions
    sendChatMessage,
    sendTypingIndicator,
    notifyTyping,
    notifyStoppedTyping,
    sendReadReceipt,
    
    // Subscription functionality
    subscribe
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Enhanced WebSocket hook that combines functionality from both implementations
 * 
 * @param filterTypes Optional array of message types to filter on
 * @returns WebSocket context with all functionality
 */
export const useWebSocket = (filterTypes?: string[]) => {
  const context = useContext(WebSocketContext);
  const [filteredMessages, setFilteredMessages] = useState<WebSocketMessage[]>([]);
  
  // If filterTypes is provided, filter the messages accordingly
  useEffect(() => {
    if (filterTypes && filterTypes.length > 0) {
      setFilteredMessages(
        context.messages.filter(msg => filterTypes.includes(msg.type))
      );
    } else {
      setFilteredMessages(context.messages);
    }
  }, [context.messages, filterTypes]);
  
  // Return the filtered messages if filterTypes is provided
  return {
    ...context,
    messages: filterTypes && filterTypes.length > 0 ? filteredMessages : context.messages
  };
};