import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
// Note: In browser environments, WebSocket is global, we don't need to import it

// Simplified Message Type Enum
export enum MessageType {
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_TYPING = 'CHAT_TYPING',
  CHAT_STOPPED_TYPING = 'CHAT_STOPPED_TYPING',
  PING = 'ping',
  ERROR = 'error',
  
  // Enhanced real-time chat status
  CHAT_USER_ONLINE = 'CHAT_USER_ONLINE',
  CHAT_USER_OFFLINE = 'CHAT_USER_OFFLINE',
  CHAT_MESSAGE_DELIVERED = 'CHAT_MESSAGE_DELIVERED',
  CHAT_MESSAGE_READ = 'CHAT_MESSAGE_READ',
  
  // Social and notification types
  LIKE_NOTIFICATION = 'like_notification',
  COMMENT_NOTIFICATION = 'comment_notification',
  REPLY_NOTIFICATION = 'reply_notification',
  SHARE_NOTIFICATION = 'share_notification',
  MENTION_NOTIFICATION = 'mention_notification',
  FOLLOW_NOTIFICATION = 'follow_notification',
  
  // Service and booking types
  SERVICE_BOOKED = 'service_booked',
  SERVICE_BOOKING_UPDATED = 'service_booking_updated',
  SERVICE_BOOKING_CANCELED = 'service_booking_canceled',
  SERVICE_REVIEWED = 'service_reviewed',
  
  // Product and marketplace types
  PRODUCT_SOLD = 'product_sold',
  ORDER_STATUS_UPDATE = 'order_status_update',
  PAYMENT_RECEIVED = 'payment_received',
  
  // Map and events types
  SPOT_ADDED = 'spot_added',
  SPOT_UPDATED = 'spot_updated',
  EVENT_NOTIFICATION = 'event_notification',
  EVENT_RSVP = 'EVENT_RSVP',
  
  // Admin and system types
  REPORT_ACCEPTED = 'report_accepted',
  REPORT_REJECTED = 'report_rejected',
  ADMIN_ACTION = 'admin_action',
  VERIFICATION_STATUS = 'verification_status',
  TERMS_PROMPT = 'terms_prompt',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
}

// Connection status enum
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// Message interface
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Context interface
interface WebSocketContextType {
  // Core functionality
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  lastActivity: number;
  
  // Messaging functions
  sendMessage: (type: string, payload: any) => boolean;
  sendChatMessage: (recipientId: number, content: string, metadata?: any) => boolean;
  sendTypingIndicator: (recipientId: number, isTyping: boolean) => boolean;
  notifyTyping: (conversationId: number) => boolean;
  notifyStoppedTyping: (conversationId: number) => boolean;
  sendReadReceipt: (senderId: number, messageIds: string[]) => boolean;
  
  // Subscription functionality
  subscribe: (callback: (message: WebSocketMessage) => void) => () => void;
  
  // Manual reconnection
  reconnect: () => void;
}

// Default context values
const defaultContext: WebSocketContextType = {
  connectionStatus: ConnectionStatus.DISCONNECTED,
  isConnected: false,
  lastActivity: 0,
  
  sendMessage: () => false,
  sendChatMessage: () => false,
  sendTypingIndicator: () => false,
  notifyTyping: () => false,
  notifyStoppedTyping: () => false,
  sendReadReceipt: () => false,
  
  subscribe: () => () => {},
  reconnect: () => {},
};

// Create context
const WebSocketContext = createContext<WebSocketContextType>(defaultContext);

// Global singleton WebSocket instance (outside of React component lifecycle)
let globalSocket: WebSocket | null = null;
let globalIsConnecting = false;
let globalReconnectTimer: NodeJS.Timeout | null = null;
let globalSubscribers: ((message: WebSocketMessage) => void)[] = [];
let globalLastConnectionAttempt = 0;
let globalProcessedMessageIds = new Set<string>();
let globalConnectionId = '';
let globalIsAuthenticated = false;

// Provider props interface
interface WebSocketProviderProps {
  children: React.ReactNode;
}

// The Provider component
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user, token, getToken } = useAuth();
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    // Initialise from the real socket state so the very first render is correct
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN && globalIsAuthenticated) {
      return ConnectionStatus.CONNECTED;
    }
    if (globalSocket && globalSocket.readyState === WebSocket.CONNECTING) {
      return ConnectionStatus.CONNECTING;
    }
    return ConnectionStatus.DISCONNECTED;
  });
  const [lastActivity, setLastActivity] = useState<number>(0);
  
  // Keep track of connection attempts
  const connectionErrorsRef = useRef<number>(0);
  
  // Generate a new connection ID only once per component lifecycle
  useEffect(() => {
    if (!globalConnectionId) {
      globalConnectionId = `user-${user?.id || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }, [user]);
  
  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    // Don't try to connect if already connecting or no user
    if (globalIsConnecting || !user) {
      return false;
    }
    
    // Only attempt if we have a reasonable time since last attempt (500ms)
    const now = Date.now();
    if (now - globalLastConnectionAttempt < 500) {
      console.log('Throttling connection attempt - too soon since last attempt');
      return false;
    }
    globalLastConnectionAttempt = now;
    
    // Check if we already have a working connection
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping initialization');
      setConnectionStatus(ConnectionStatus.CONNECTED);
      return true;
    }
    
    // Clean up any existing connection
    if (globalSocket) {
      try {
        // Remove handlers to prevent duplicate reconnection
        globalSocket.onclose = null;
        globalSocket.onerror = null;
        globalSocket.onmessage = null;
        globalSocket.onopen = null;
        globalSocket.close();
      } catch (err) {
        // Ignore errors during cleanup
      }
      globalSocket = null;
    }
    
    // Clear any pending reconnect timer
    if (globalReconnectTimer) {
      clearTimeout(globalReconnectTimer);
      globalReconnectTimer = null;
    }
    
    // Set connecting state
    globalIsConnecting = true;
    setConnectionStatus(ConnectionStatus.CONNECTING);
    
    try {
      // Construct WebSocket URL with unique identifiers to prevent caching
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const uniqueParams = `t=${Date.now()}&r=${Math.random()}&cid=${globalConnectionId}&uid=${user?.id || 'anon'}`;
      const wsUrl = `${protocol}//${host}/ws?${uniqueParams}`;
      
      console.log('🔄 Connecting to WebSocket:', wsUrl);
      
      // Create new socket connection
      const socket = new WebSocket(wsUrl);
      globalSocket = socket;
      
      // Set binary type for optimized transfers
      socket.binaryType = 'arraybuffer';
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout');
          socket.close();
          setConnectionStatus(ConnectionStatus.ERROR);
          connectionErrorsRef.current += 1;
          globalIsConnecting = false;
          
          // Schedule reconnection after delay
          scheduleReconnect(5000);
        }
      }, 10000);
      
      // Connection opened handler
      socket.onopen = async () => {
        console.log('🌐 WebSocket connection established');
        clearTimeout(connectionTimeout);
        
        // Send authentication immediately
        if (user) {
          // Get a fresh Firebase ID token to include in auth payload.
          // The server verifies this token before trusting any userId/role claims.
          let freshToken: string | null = token;
          if (!freshToken) {
            try { freshToken = await getToken(); } catch { freshToken = null; }
          }
          const authData: Record<string, any> = {
            userId: user.id,
            role: user.role || 'user',
            displayName: user.displayName || (user as any).email,
            connectionId: globalConnectionId,
            timestamp: Date.now(),
          };
          if (freshToken) {
            authData.idToken = freshToken;
          }
          
          const { idToken: _omit, ...authDataSafe } = authData;
          console.log('🔑 Sending authentication data', authDataSafe);
          
          // Send auth message with retries to ensure delivery
          const sendAuth = () => {
            if (socket.readyState === WebSocket.OPEN) {
              sendJsonMessage(socket, 'auth', authData);
              console.log('💬 Auth message sent, waiting for confirmation...');
            } else {
              console.warn('⚠️ Socket not open when trying to send auth message');
            }
          };
          
          // Reset auth state for new connection
          globalIsAuthenticated = false;

          // Send immediately
          sendAuth();

          // Single retry after 2s — only if socket is still open AND we still
          // haven't got auth_success. The previous version could fire while the
          // socket was already closed (or already authed mid-flight), causing
          // the server to see a duplicate auth → drop the connection.
          const retryTimer = setTimeout(() => {
            if (globalIsAuthenticated) return;
            if (socket.readyState !== WebSocket.OPEN) return;
            console.log('⚠️ Still not authenticated after delay, retrying auth...');
            sendAuth();
          }, 2000);
          // Stash on socket so onmessage can clear it the moment auth_success arrives
          (socket as any).__authRetryTimer = retryTimer;
          
          // Wait for auth success in onmessage
          // Don't set CONNECTED state yet
        } else {
          console.warn('⚠️ No user available for authentication');
          setConnectionStatus(ConnectionStatus.ERROR);
        }
      };
      
      // Message handler
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          // Update last activity timestamp
          setLastActivity(Date.now());
          
          // Handle auth success with more verbose logging
          if (data.type === 'auth_success' || data.type === 'AUTH_SUCCESS') {
            console.log('🎉 Authentication successful - transitioning to CONNECTED state');

            // Mark as authenticated immediately to prevent retry
            globalIsAuthenticated = true;
            // Cancel any pending auth retry — we're already authed
            const t = (socket as any).__authRetryTimer;
            if (t) { clearTimeout(t); (socket as any).__authRetryTimer = null; }
            
            // CRITICAL FIX: Update connection state and ensure UI updates
            // This is a critical section that must guarantee the UI updates
            setTimeout(() => {
              // First update the React state
              setConnectionStatus(ConnectionStatus.CONNECTED);
              
              // Reset error count and update global state
              connectionErrorsRef.current = 0;
              globalIsConnecting = false;
              
              // Dispatch a DOM event for any non-React components 
              const authEvent = new CustomEvent('websocket:authenticated', {
                detail: { timestamp: Date.now() }
              });
              window.dispatchEvent(authEvent);
              
              // Dispatch a second event specifically for connection status components
              const statusEvent = new CustomEvent('websocket:connected', {
                detail: { 
                  status: ConnectionStatus.CONNECTED,
                  timestamp: Date.now() 
                }
              });
              window.dispatchEvent(statusEvent);
              
              console.log('🔔 Dispatched connection events to update UI components');
            }, 0);
            
            // Ping to verify connection after a delay
            setTimeout(() => {
              if (socket && socket.readyState === WebSocket.OPEN) {
                console.log('🔄 Sending ping to verify connection');
                sendJsonMessage(socket, 'ping', { timestamp: Date.now() });
              }
            }, 500);
          }
          
          // Create a standardized message object
          const message: WebSocketMessage = {
            type: data.type,
            payload: data.payload || data,
            timestamp: data.timestamp || Date.now()
          };
          
          // Generate unique message ID for deduplication
          const messageId = generateMessageId(message);
          
          // Skip if duplicate
          if (globalProcessedMessageIds.has(messageId)) {
            console.log('Skipping duplicate message:', messageId);
            return;
          }
          
          // Add to processed messages
          globalProcessedMessageIds.add(messageId);
          
          // Limit set size to avoid memory issues
          if (globalProcessedMessageIds.size > 200) {
            const values = Array.from(globalProcessedMessageIds);
            const toRemove = values.slice(0, values.length - 150);
            toRemove.forEach(id => globalProcessedMessageIds.delete(id));
          }
          
          // Notify all subscribers
          notifySubscribers(message);
          
          // Handle specific message types
          handleSpecificMessageTypes(socket, message, user?.id);
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };
      
      // Error handler
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        
        // Clear timeout
        clearTimeout(connectionTimeout);
        
        // Update state
        setConnectionStatus(ConnectionStatus.ERROR);
        connectionErrorsRef.current += 1;
        globalIsConnecting = false;
        
        // Schedule reconnect (no toast — reconnect bar in chat UI shows status)
        scheduleReconnect();
      };
      
      // Close handler
      socket.onclose = (event) => {
        console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
        
        // Clear timeout
        clearTimeout(connectionTimeout);
        
        // Update state
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
        globalIsConnecting = false;
        globalIsAuthenticated = false;
        
        // Schedule reconnect if not a clean close
        if (event.code !== 1000 || !event.wasClean) {
          scheduleReconnect();
        }
      };
      
      return true;
    } catch (err) {
      console.error('Error initializing WebSocket:', err);
      
      // Reset state
      setConnectionStatus(ConnectionStatus.ERROR);
      globalIsConnecting = false;
      
      // Schedule reconnect
      scheduleReconnect();
      
      return false;
    }
  }, [user, toast]);
  
  // Schedule a reconnection attempt
  const scheduleReconnect = useCallback((delay?: number) => {
    if (globalReconnectTimer) {
      clearTimeout(globalReconnectTimer);
    }
    
    // Calculate delay based on connection errors (exponential backoff)
    const baseDelay = delay || Math.min(1000 * Math.pow(1.5, connectionErrorsRef.current), 30000);
    const jitter = Math.random() * 1000;
    const finalDelay = baseDelay + jitter;
    
    console.log(`Scheduling reconnect in ${Math.round(finalDelay)}ms (attempt ${connectionErrorsRef.current})`);
    
    globalReconnectTimer = setTimeout(() => {
      console.log('Executing scheduled reconnection');
      initializeWebSocket();
    }, finalDelay);
  }, [initializeWebSocket]);
  
  // Send a JSON message through WebSocket
  const sendJsonMessage = (socket: WebSocket, type: string, payload: any): boolean => {
    if (socket.readyState !== WebSocket.OPEN) {
      console.log('Cannot send message - socket not open. Current state:', socket.readyState);
      return false;
    }
    
    try {
      const message = {
        type,
        payload,
        timestamp: Date.now(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      };
      
      socket.send(JSON.stringify(message));
      console.log('Message sent:', message);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  };
  
  // Generate a unique message ID for deduplication.
  //
  // ── KEY FIX: prefer the SERVER-PROVIDED id ────────────────────────────────
  // Previously this composite included `message.timestamp` which resolves to
  // `Date.now()` on the receiving side when the server omits a timestamp.
  // Result: every retransmit / cross-device fan-out was treated as a new
  // message and shown twice in the chat. Now we use the server's UUID first
  // and only fall back to a content hash for legacy events.
  const generateMessageId = (message: WebSocketMessage): string => {
    const anyMsg: any = message as any;
    if (anyMsg.messageId) return `srv-${anyMsg.messageId}`;
    // Special handling for chat messages
    if (message.type === MessageType.CHAT_MESSAGE || message.type === 'CHAT_MESSAGE') {
      const msgId = message.payload?.id || '';
      if (msgId) return `chat-${msgId}`;
      const convId = message.payload?.conversationId || '';
      const contentSample = message.payload?.content
        ? String(message.payload.content).substring(0, 40)
        : '';
      return `chat-${convId}-${contentSample.replace(/\s+/g, '')}-${message.timestamp}`;
    }
    // Special handling for notifications
    else if (message.type.includes('NOTIFICATION') || message.type.includes('notification')) {
      const notifId = message.payload.id || '';
      const userId = message.payload.userId || message.payload.toUserId || '';
      const msgSample = message.payload.message 
        ? message.payload.message.substring(0, 20) 
        : '';
      return `notif-${notifId}-${userId}-${msgSample.replace(/\\s+/g, '')}-${message.timestamp}`;
    }
    // Default message ID
    return `${message.type}-${message.timestamp}-${JSON.stringify(message.payload).slice(0, 20)}`;
  };
  
  // Notify all subscribers about a new message
  const notifySubscribers = (message: WebSocketMessage): void => {
    globalSubscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  };
  
  // Handle specific message types with special logic
  const handleSpecificMessageTypes = (socket: WebSocket, message: WebSocketMessage, userId?: number): void => {
    // Handle chat messages
    if (message.type === MessageType.CHAT_MESSAGE || message.type === 'CHAT_MESSAGE') {
      // Send delivery confirmation if we're not the sender
      if (message.payload.senderId !== userId) {
        console.log('Sending delivery confirmation for message:', message.payload.id);
        
        sendJsonMessage(socket, 'message_delivered', {
          messageId: message.payload.id,
          conversationId: message.payload.conversationId,
          timestamp: Date.now()
        });
      }
      
      // Dispatch event for UI components
      const chatEvent = new CustomEvent('chat:message-received', {
        detail: message.payload
      });
      window.dispatchEvent(chatEvent);
    }
    
    // Handle delivery confirmations
    else if (message.type === MessageType.CHAT_MESSAGE_DELIVERED || message.type === 'CHAT_MESSAGE_DELIVERED') {
      const deliveryEvent = new CustomEvent('chat:message-delivered', {
        detail: message.payload
      });
      window.dispatchEvent(deliveryEvent);
    }
    
    // Handle read confirmations
    else if (message.type === MessageType.CHAT_MESSAGE_READ || message.type === 'CHAT_MESSAGE_READ') {
      const readEvent = new CustomEvent('chat:message-seen', {
        detail: message.payload
      });
      window.dispatchEvent(readEvent);
    }
    
    // Handle typing indicators
    else if (message.type === MessageType.CHAT_TYPING || message.type === 'CHAT_TYPING') {
      const typingEvent = new CustomEvent('chat:typing', {
        detail: message.payload
      });
      window.dispatchEvent(typingEvent);
    }
    
    // Handle event RSVP notifications (direct WebSocket messages from client to client)
    else if (message.type === MessageType.EVENT_RSVP || 
             message.type === 'EVENT_RSVP' || 
             message.type === 'event_rsvp') {
      console.log('[EVENT] Processing direct EVENT_RSVP notification', message.payload);
      
      // If this message is intended for us (we're the event organizer)
      if (message.payload.organizerId === userId) {
        // Forward to notifyEventRsvp on server for persistence
        sendJsonMessage(socket, 'forward_event_rsvp', {
          ...message.payload,
          timestamp: Date.now(),
          forwarded: true
        });
      }
      
      // Dispatch event for UI components
      const rsvpEvent = new CustomEvent('notification:event-rsvp', {
        detail: message.payload
      });
      window.dispatchEvent(rsvpEvent);
    }
    
    // Handle stopped typing
    else if (message.type === MessageType.CHAT_STOPPED_TYPING || message.type === 'CHAT_STOPPED_TYPING') {
      const stoppedTypingEvent = new CustomEvent('chat:stopped-typing', {
        detail: message.payload
      });
      window.dispatchEvent(stoppedTypingEvent);
    }
  };
  
  // Public API: Send a message
  const sendMessage = useCallback((type: string, payload: any): boolean => {
    if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) {
      console.log('Cannot send message - not connected');
      
      // Attempt to reconnect if possible
      initializeWebSocket();
      return false;
    }
    
    return sendJsonMessage(globalSocket, type, payload);
  }, [initializeWebSocket]);
  
  // Public API: Send a chat message
  const sendChatMessage = useCallback((recipientId: number, content: string, metadata?: any): boolean => {
    return sendMessage(MessageType.CHAT_MESSAGE, {
      recipientId,
      content,
      metadata,
      timestamp: Date.now()
    });
  }, [sendMessage]);
  
  // Public API: Send typing indicator
  const sendTypingIndicator = useCallback((recipientId: number, isTyping: boolean): boolean => {
    const messageType = isTyping ? MessageType.CHAT_TYPING : MessageType.CHAT_STOPPED_TYPING;
    return sendMessage(messageType, {
      recipientId,
      timestamp: Date.now()
    });
  }, [sendMessage]);
  
  // Public API: Notify typing in a conversation
  const notifyTyping = useCallback((conversationId: number): boolean => {
    return sendMessage(MessageType.CHAT_TYPING, {
      conversationId,
      timestamp: Date.now()
    });
  }, [sendMessage]);
  
  // Public API: Notify stopped typing in a conversation
  const notifyStoppedTyping = useCallback((conversationId: number): boolean => {
    return sendMessage(MessageType.CHAT_STOPPED_TYPING, {
      conversationId,
      timestamp: Date.now()
    });
  }, [sendMessage]);
  
  // Public API: Send read receipt
  const sendReadReceipt = useCallback((senderId: number, messageIds: string[]): boolean => {
    return sendMessage(MessageType.CHAT_MESSAGE_READ, {
      senderId,
      messageIds,
      timestamp: Date.now()
    });
  }, [sendMessage]);
  
  // Public API: Subscribe to messages
  const subscribe = useCallback((callback: (message: WebSocketMessage) => void) => {
    globalSubscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      globalSubscribers = globalSubscribers.filter(cb => cb !== callback);
    };
  }, []);
  
  // Initialize connection when user is available.
  //
  // ── KEY FIX: depend ONLY on user.id ────────────────────────────────────────
  // The previous dep array `[user, initializeWebSocket]` re-fired on every
  // render because the `user` object reference and the `initializeWebSocket`
  // callback both change frequently. That caused the "User available,
  // initializing WebSocket connection" log to spam dozens of times per second
  // and flooded the server with reconnection attempts (rate-limit hits).
  useEffect(() => {
    if (!user?.id) return;
    console.log('User available, initializing WebSocket connection');
    initializeWebSocket();

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
        sendJsonMessage(globalSocket, 'ping', { timestamp: Date.now() });
      }
    }, 30000); // 30 second ping

    return () => {
      clearInterval(pingInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  
  // Define context value
  const contextValue: WebSocketContextType = {
    connectionStatus,
    isConnected: connectionStatus === ConnectionStatus.CONNECTED,
    lastActivity,
    
    sendMessage,
    sendChatMessage,
    sendTypingIndicator,
    notifyTyping,
    notifyStoppedTyping,
    sendReadReceipt,
    
    subscribe,
    reconnect: initializeWebSocket,
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook for using the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};