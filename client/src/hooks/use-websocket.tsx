import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  initWebSocket, 
  addMessageHandler, 
  removeMessageHandler, 
  addErrorHandler, 
  removeErrorHandler, 
  sendMessage, 
  addMessageListener,
  removeMessageListener
} from '@/lib/websocket';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

/**
 * Hook to manage WebSocket connections for React components
 * @param messageTypes Array of message types to listen for
 * @returns Object with messages, error state, and functions to send and manage messages
 */
export function useWebSocket(messageTypes: string[] = []) {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [error, setError] = useState<Event | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messageTypesRef = useRef(messageTypes);
  const connectionInitialized = useRef(false);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const errorHandlerRef = useRef<((event: Event) => void) | null>(null);
  const processedMessageIds = useRef(new Set<string>());
  
  // Update the ref when messageTypes changes
  useEffect(() => {
    messageTypesRef.current = messageTypes;
  }, [messageTypes]);
  
  // Message handler that filters by messageType
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as WebSocketMessage;
      
      // Generate a unique message ID for deduplication
      const messageId = `${data.type}-${data.timestamp}-${JSON.stringify(data.payload).slice(0, 50)}`;
      
      // Skip if we've already processed this message
      if (processedMessageIds.current.has(messageId)) {
        console.log('Skipping duplicate message:', messageId);
        return;
      }
      
      // Add to processed messages and manage set size
      processedMessageIds.current.add(messageId);
      if (processedMessageIds.current.size > 100) {
        // Keep only the most recent 100 message IDs
        const toRemove = Array.from(processedMessageIds.current).slice(0, processedMessageIds.current.size - 100);
        toRemove.forEach(id => processedMessageIds.current.delete(id));
      }
      
      // If connection acknowledgment received, set connected state quietly
      if (data.type === 'SYSTEM_NOTIFICATION' && 
          data.payload?.message?.includes('Connected')) {
        setIsConnected(true);
        // Skip adding system connection messages to our message list
        return;
      }
      
      // If no specific messageTypes are provided, or the message type is in our list
      if (
        messageTypesRef.current.length === 0 || 
        messageTypesRef.current.includes(data.type)
      ) {
        // Use functional update to prevent race conditions and limit array size
        setMessages(prev => {
          // Limit to 50 messages to prevent memory issues
          const newMessages = [data, ...prev];
          return newMessages.slice(0, 50);
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, []);
  
  // Error handler
  const handleError = useCallback((event: Event) => {
    setError(event);
    setIsConnected(false);
  }, []);
  
  // Store the handlers in refs to ensure we remove the same function references
  useEffect(() => {
    messageHandlerRef.current = handleMessage;
    errorHandlerRef.current = handleError;
  }, [handleMessage, handleError]);
  
  // Initialize WebSocket and set up listeners after auth is ready
  useEffect(() => {
    // Only initialize the WebSocket after we know the authentication status
    if (authLoading) {
      return; // Wait until auth is ready
    }
    
    // Function to initialize the connection and handlers
    const setupConnection = () => {
      if (!connectionInitialized.current) {
        connectionInitialized.current = true;
        console.log("Auth ready, initializing WebSocket connection");
        
        // Initialize WebSocket connection
        const newSocket = initWebSocket();
        
        // Set connected status if socket is already open
        if (newSocket && newSocket.readyState === WebSocket.OPEN) {
          console.log("WebSocket already connected");
          setIsConnected(true);
        }
        
        if (messageHandlerRef.current) {
          // Add message and error handlers
          addMessageHandler(messageHandlerRef.current);
          console.log("WebSocket message handler added");
        }
        
        if (errorHandlerRef.current) {
          addErrorHandler(errorHandlerRef.current);
          console.log("WebSocket error handler added");
        }
      }
    };
    
    // Setup connection if user is logged in or for anonymous access
    // For explore page image updates we need to allow anonymous users too
    if (user?.id || messageTypesRef.current.includes('EXPLORE_IMAGE_UPDATE')) {
      setupConnection();
      
      // Check connection status every second for the first few seconds
      const checkInterval = setInterval(() => {
        const status = document.querySelector('meta[name="websocket-status"]')?.getAttribute('content');
        if (status === 'connected') {
          setIsConnected(true);
          clearInterval(checkInterval);
        }
      }, 1000);
      
      // Clear interval after 5 seconds regardless
      setTimeout(() => clearInterval(checkInterval), 5000);
    }
    
    // Clean up when component unmounts or user changes
    return () => {
      if (messageHandlerRef.current) {
        removeMessageHandler(messageHandlerRef.current);
        console.log("WebSocket message handler removed");
      }
      
      if (errorHandlerRef.current) {
        removeErrorHandler(errorHandlerRef.current);
        console.log("WebSocket error handler removed");
      }
      
      // Reset initialization flag if user changes, except for explore image updates
      // Keep connection for anonymous users if they're listening for explore updates
      if (!user?.id && !messageTypesRef.current.includes('EXPLORE_IMAGE_UPDATE')) {
        connectionInitialized.current = false;
      }
    };
  }, [authLoading, user]);
  
  // Function to clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    processedMessageIds.current.clear();
  }, []);
  
  // Send a chat message
  const sendChatMessage = useCallback((recipientId: number, content: string, metadata?: any) => {
    if (!user?.id) return false;
    
    return sendMessage({
      type: 'CHAT_MESSAGE', // Match the enum case (UPPERCASE)
      recipientId,
      content,
      metadata,
      timestamp: Date.now()
    });
  }, [user?.id]);
  
  // Send typing indicator
  const sendTypingIndicator = useCallback((recipientId: number, isTyping: boolean) => {
    if (!user?.id) return false;
    
    return sendMessage({
      type: 'CHAT_TYPING', // Match the enum case (UPPERCASE)
      recipientId,
      isTyping,
      timestamp: Date.now()
    });
  }, [user?.id]);
  
  // Send read receipt
  const sendReadReceipt = useCallback((senderId: number, messageIds: string[]) => {
    if (!user?.id) return false;
    
    return sendMessage({
      type: 'CHAT_READ', // Match the enum case (UPPERCASE)
      senderId,
      messageIds,
      timestamp: Date.now()
    });
  }, [user?.id]);
  
  // Subscribe to WebSocket messages with a direct callback
  // This allows components to handle WebSocket messages without using the messages state
  const subscribe = useCallback((callback: (message: WebSocketMessage) => void) => {
    // Initialize WebSocket if not already connected
    if (!connectionInitialized.current) {
      initWebSocket();
      connectionInitialized.current = true;
    }
    
    // Add the message listener
    addMessageListener(callback);
    
    // Return a cleanup function to remove the listener
    return () => {
      removeMessageListener(callback);
    };
  }, []);
  
  return {
    messages,
    error,
    isConnected,
    clearMessages,
    sendChatMessage,
    sendTypingIndicator,
    sendReadReceipt,
    subscribe
  };
}