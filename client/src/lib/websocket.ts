// WebSocket client connection management
import { useEffect, useState, useCallback, useRef } from 'react';

// Connection status enum for WebSocket
export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

// WebSocket hook options
export interface WebSocketOptions {
  autoReconnect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (data: string) => void;
  onError?: (error: Error) => void;
}

// NotificationType enum mirroring the server-side enum
export enum NotificationType {
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  NEW_ORDER = 'NEW_ORDER',
  TRACKING_UPDATE = 'TRACKING_UPDATE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  CONTENT_SHARED = 'CONTENT_SHARED',
  SERVICE_BOOKING = 'SERVICE_BOOKING',
  BOOKING_STATUS_UPDATE = 'BOOKING_STATUS_UPDATE',
  ADMIN_ORDER_UPDATE = 'ADMIN_ORDER_UPDATE',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_TYPING = 'CHAT_TYPING',
  CHAT_READ = 'CHAT_READ',
  CHAT_MESSAGE_READ = 'CHAT_MESSAGE_READ',
  CHAT_MESSAGES_READ_BATCH = 'CHAT_MESSAGES_READ_BATCH',
  DIGITAL_PRODUCT_READY = 'DIGITAL_PRODUCT_READY',
  CONTENT_REPORTED = 'CONTENT_REPORTED',
  CONTENT_MODERATION = 'CONTENT_MODERATION',
  EXPLORE_IMAGE_UPDATE = 'EXPLORE_IMAGE_UPDATE',
  TERMS_PROMPT = 'TERMS_PROMPT',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_ERROR = 'MESSAGE_ERROR'
}

let socket: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // Start with 1 second delay
let messageQueue: any[] = [];
let messageListeners: ((message: any) => void)[] = [];
let errorListeners: ((error: Event) => void)[] = [];
let messageHandlers: ((event: MessageEvent) => void)[] = [];
// Track sent notifications to prevent duplicates
let sentNotifications: Set<string> = new Set();

/**
 * Initialize the WebSocket connection
 * @returns The WebSocket instance or null if creation failed
 */
export function initWebSocket(): WebSocket | null {
  // Don't initialize if already connecting or connected
  if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) {
    console.log("WebSocket already connecting or connected");
    return socket;
  }
  
  isConnecting = true;
  console.log("Initializing WebSocket connection...");
  
  try {
    // Always prefer secure WebSocket. Plain ws is only allowed for local
    // development on http://localhost (where TLS is not available).
    const isLocalhost = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '[::1]';
    const isSecurePage = window.location.protocol === 'https:';
    const protocol = (isSecurePage || !isLocalhost) ? 'wss:' : 'ws:';
    // Add timestamp parameter to prevent caching issues and force a new connection
    const timestamp = Date.now();
    // Get user ID from localStorage if available
    const user = getUserFromLocalStorage();
    const userId = user?.id || 0;
    // EMERGENCY FIX: Use different query parameter format to bypass any potential caching issues
    const wsUrl = `${protocol}//${window.location.host}/ws?timestamp=${timestamp}&id=${userId}&force=true`;
    
    console.log('Connecting to WebSocket at:', wsUrl);
    
    // Create a new WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Add event listeners to the WebSocket
    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
    
    console.log('WebSocket message handler added');
    console.log('WebSocket error handler added');
    
    // Add a meta tag to indicate the WebSocket status
    let statusMeta = document.querySelector('meta[name="websocket-status"]');
    if (!statusMeta) {
      statusMeta = document.createElement('meta');
      statusMeta.setAttribute('name', 'websocket-status');
      document.head.appendChild(statusMeta);
    }
    statusMeta.setAttribute('content', 'connecting');
    
    // Create an interval to check connection status and update meta tag
    const statusCheckInterval = setInterval(() => {
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          console.log("WebSocket connection is now OPEN");
          statusMeta?.setAttribute('content', 'connected');
          clearInterval(statusCheckInterval);
        } else if (socket.readyState === WebSocket.CLOSED) {
          console.log("WebSocket connection CLOSED");
          statusMeta?.setAttribute('content', 'disconnected');
          clearInterval(statusCheckInterval);
        }
      } else {
        clearInterval(statusCheckInterval);
      }
    }, 500);
    
    // Clear interval after 10 seconds to prevent memory leaks
    setTimeout(() => clearInterval(statusCheckInterval), 10000);
    
    return socket;
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    isConnecting = false;
    
    // Update the meta tag to indicate failed status
    const statusMeta = document.querySelector('meta[name="websocket-status"]');
    if (statusMeta) {
      statusMeta.setAttribute('content', 'failed');
    }
    
    return null;
  }
}

/**
 * Handle WebSocket open event
 */
function handleOpen(event: Event): void {
  console.log('WebSocket connection established');
  isConnecting = false;
  reconnectAttempts = 0;
  
  // Send any queued messages
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
  
  // If user is logged in, send authentication message
  const user = getUserFromLocalStorage();
  if (user && user.id) {
    sendAuthMessage(user.id, user.role || 'user');
  }
  
  // Update the meta tag to indicate connected status
  const statusMeta = document.querySelector('meta[name="websocket-status"]');
  if (statusMeta) {
    statusMeta.setAttribute('content', 'connected');
  }
}

/**
 * Handle WebSocket message event
 */
function handleMessage(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data);
    console.log('WebSocket message received:', data);
    
    // Generate a notification ID to track duplicates
    const notificationId = generateNotificationId(data);
    
    // Skip if we've already processed this notification recently
    if (sentNotifications.has(notificationId)) {
      console.log('Skipping duplicate notification:', notificationId);
      return;
    }
    
    // Add to our set of processed notifications
    sentNotifications.add(notificationId);
    
    // Clean up old notifications (keep only last 50)
    if (sentNotifications.size > 50) {
      const toRemove = Array.from(sentNotifications).slice(0, sentNotifications.size - 50);
      toRemove.forEach(id => sentNotifications.delete(id));
    }
    
    // Notify all listeners
    messageListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
    
    // Call all message handlers with the raw event
    messageHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error);
  }
}

/**
 * Generate a unique ID for a notification to prevent duplicates
 */
function generateNotificationId(data: any): string {
  try {
    // Extract key pieces of the notification to form an ID
    const type = data.type || 'unknown';
    const timestamp = data.timestamp || Date.now();
    const payload = data.payload || {};
    const title = payload.title || '';
    const message = payload.message || '';
    
    // Create a unique string based on notification content
    return `${type}-${title}-${message}-${timestamp}`;
  } catch (error) {
    // Fallback to timestamp + random for malformed notifications
    return `${Date.now()}-${Math.random()}`;
  }
}

/**
 * Handle WebSocket close event
 */
function handleClose(event: CloseEvent): void {
  console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
  
  // Check if connection was closed cleanly (status code 1000)
  const isCleanClose = event.code === 1000;
  
  // Perform cleanup operations
  if (socket) {
    // Remove all event listeners from the socket to prevent memory leaks
    socket.removeEventListener('open', handleOpen);
    socket.removeEventListener('message', handleMessage);
    socket.removeEventListener('close', handleClose);
    socket.removeEventListener('error', handleError);
    
    // Clear reference to this socket
    socket = null;
  }
  
  isConnecting = false;
  
  // Clear message queue if it was a clean close or we've reached max attempts
  if (isCleanClose || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('Clearing message queue due to clean close or max attempts reached');
    messageQueue = [];
  }
  
  // Update the meta tag to indicate disconnected status
  const statusMeta = document.querySelector('meta[name="websocket-status"]');
  if (statusMeta) {
    statusMeta.setAttribute('content', 'disconnected');
  }
  
  // Try to reconnect if not intentionally closed and not max attempts
  if (!isCleanClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    // Use exponential backoff with a bit of randomness to prevent thundering herd
    const baseDelay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = baseDelay + jitter;
    
    console.log(`Attempting to reconnect in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    
    // Clear any existing timers to avoid multiple reconnection attempts
    if (window.reconnectTimer) {
      clearTimeout(window.reconnectTimer);
    }
    
    // Store the timer ID on the window object to ensure it can be cancelled
    // @ts-ignore - Adding reconnectTimer to Window object
    window.reconnectTimer = setTimeout(() => {
      console.log('Executing reconnection attempt');
      // @ts-ignore - Removing reconnectTimer from Window object
      delete window.reconnectTimer;
      
      // Try to refresh user credentials before reconnecting
      try {
        // Refresh user data from localStorage if possible
        const userJson = localStorage.getItem('user');
        if (userJson) {
          // Successfully refreshed user data
          console.log('User credentials refreshed before reconnection');
        }
      } catch (error) {
        console.error('Error refreshing user credentials:', error);
      }
      
      initWebSocket();
    }, delay);
  } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please refresh the page.`);
    
    // Dispatch a custom event so the application UI can show an error message
    const connectionFailedEvent = new CustomEvent('websocket:connection-failed', {
      detail: { 
        attempts: reconnectAttempts,
        lastError: event
      }
    });
    window.dispatchEvent(connectionFailedEvent);
  }
}

/**
 * Handle WebSocket error event
 */
function handleError(event: Event): void {
  console.error('WebSocket error:', event);
  
  // Update the meta tag to indicate error status
  const statusMeta = document.querySelector('meta[name="websocket-status"]');
  if (statusMeta) {
    statusMeta.setAttribute('content', 'error');
  }
  
  // Notify all error listeners
  errorListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in error listener:', error);
    }
  });
}

/**
 * Send a message through the WebSocket
 */
export function sendMessage(message: any): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    // Queue the message to send when connection is established
    messageQueue.push(message);
    
    // Try to initialize the WebSocket if it's not already connecting
    if (!isConnecting && (!socket || socket.readyState === WebSocket.CLOSED)) {
      initWebSocket();
    }
  }
}

/**
 * Send an authentication message to the WebSocket server
 */
function sendAuthMessage(userId: number, role: string): void {
  // Create a unique connection ID to help with server-side connection tracking
  const connectionId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Add device and browser information for better connection management
  const deviceInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    devicePixelRatio: window.devicePixelRatio
  };
  
  // Get additional user information if available in localStorage
  let username = '';
  let displayName = '';
  let email = '';
  
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      username = user.username || '';
      displayName = user.displayName || '';
      email = user.email || '';
    }
  } catch (error) {
    console.error('Failed to get additional user info:', error);
  }
  
  sendMessage({
    type: 'auth', // Use lowercase to match server expectation
    userId,
    role,
    username,
    displayName,
    email,
    connectionId,
    deviceInfo,
    timestamp: Date.now()
  });
  
  console.log('Sent enhanced auth message with connection ID:', connectionId);
}

/**
 * Add a message listener to receive WebSocket messages
 */
export function addMessageListener(listener: (message: any) => void): void {
  messageListeners.push(listener);
}

/**
 * Remove a message listener
 */
export function removeMessageListener(listener: (message: any) => void): void {
  messageListeners = messageListeners.filter(l => l !== listener);
}

/**
 * Close the WebSocket connection
 */
export function closeWebSocket(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
}

/**
 * Get the user from localStorage
 */
function getUserFromLocalStorage(): { id: number, role?: string } | null {
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      return JSON.parse(userJson);
    }
  } catch (error) {
    console.error('Failed to parse user from localStorage:', error);
  }
  return null;
}

/**
 * Get WebSocket connection status
 */
export function getWebSocketStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' | 'failed' {
  if (!socket) {
    return 'disconnected';
  }
  
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return 'connecting';
    case WebSocket.OPEN:
      return 'connected';
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
    default:
      return 'disconnected';
  }
}

/**
 * Add an error handler to handle WebSocket errors
 */
export function addErrorHandler(handler: (error: Event) => void): void {
  errorListeners.push(handler);
}

/**
 * Remove an error handler
 */
export function removeErrorHandler(handler: (error: Event) => void): void {
  errorListeners = errorListeners.filter(h => h !== handler);
}

/**
 * Add a message handler to receive raw WebSocket messages
 * This is different from messageListener which receives the parsed data
 */
export function addMessageHandler(handler: (event: MessageEvent) => void): void {
  messageHandlers.push(handler);
}

/**
 * Remove a message handler
 */
export function removeMessageHandler(handler: (event: MessageEvent) => void): void {
  messageHandlers = messageHandlers.filter(h => h !== handler);
}

// Initialize the WebSocket connection when this module is loaded
// Call this from your application's entry point or authentication flow
// initWebSocket();

/**
 * Custom hook for WebSocket functionality
 * Provides a simplified interface for components to interact with WebSockets
 */
export function useWebSocket(options: WebSocketOptions = {}) {
  const { 
    autoReconnect = true,
    onOpen,
    onClose,
    onMessage,
    onError 
  } = options;
  
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const localSocket = useRef<WebSocket | null>(null);
  const messageListenerRef = useRef<((message: any) => void) | null>(null);
  const errorHandlerRef = useRef<((error: Event) => void) | null>(null);
  
  // Function to update status based on socket state
  const updateStatus = useCallback(() => {
    if (!socket) {
      setStatus(ConnectionStatus.DISCONNECTED);
      return;
    }
    
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        setStatus(ConnectionStatus.CONNECTING);
        break;
      case WebSocket.OPEN:
        setStatus(ConnectionStatus.CONNECTED);
        break;
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
      default:
        setStatus(ConnectionStatus.DISCONNECTED);
        break;
    }
  }, []);
  
  // Initialize connection
  const connect = useCallback(() => {
    if (localSocket.current && localSocket.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    localSocket.current = initWebSocket();
    updateStatus();
  }, [updateStatus]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    if (localSocket.current) {
      closeWebSocket();
      localSocket.current = null;
      setStatus(ConnectionStatus.DISCONNECTED);
    }
  }, []);
  
  // Send message
  const send = useCallback((message: any) => {
    sendMessage(message);
  }, []);
  
  // Setup event listeners
  useEffect(() => {
    // Message handler
    if (onMessage) {
      messageListenerRef.current = (data: any) => {
        onMessage(JSON.stringify(data));
      };
      addMessageListener(messageListenerRef.current);
    }
    
    // Error handler
    if (onError) {
      errorHandlerRef.current = (event: Event) => {
        setStatus(ConnectionStatus.ERROR);
        onError(new Error("WebSocket error occurred"));
      };
      addErrorHandler(errorHandlerRef.current);
    }
    
    // Open status checker
    const openChecker = () => {
      const statusMeta = document.querySelector('meta[name="websocket-status"]');
      if (statusMeta && statusMeta.getAttribute('content') === 'connected') {
        setStatus(ConnectionStatus.CONNECTED);
        if (onOpen) onOpen();
      }
    };
    
    // Close status checker
    const closeChecker = () => {
      const statusMeta = document.querySelector('meta[name="websocket-status"]');
      if (statusMeta && statusMeta.getAttribute('content') === 'disconnected') {
        setStatus(ConnectionStatus.DISCONNECTED);
        if (onClose) onClose();
      }
    };
    
    // Create mutation observer to watch for status changes via meta tag
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' && 
          mutation.attributeName === 'content' &&
          mutation.target instanceof HTMLMetaElement
        ) {
          const status = mutation.target.getAttribute('content');
          if (status === 'connected') {
            openChecker();
          } else if (status === 'disconnected') {
            closeChecker();
          } else if (status === 'error') {
            setStatus(ConnectionStatus.ERROR);
            if (onError) onError(new Error("WebSocket error occurred"));
          }
        }
      });
    });
    
    // Find or create the meta tag
    let statusMeta = document.querySelector('meta[name="websocket-status"]');
    if (!statusMeta) {
      statusMeta = document.createElement('meta');
      statusMeta.setAttribute('name', 'websocket-status');
      statusMeta.setAttribute('content', 'disconnected');
      document.head.appendChild(statusMeta);
    }
    
    // Start observing
    if (statusMeta) {
      observer.observe(statusMeta, { attributes: true });
      
      // Check initial state
      const initialStatus = statusMeta.getAttribute('content');
      if (initialStatus === 'connected') {
        openChecker();
      }
    }
    
    // Auto-connect if enabled
    if (autoReconnect) {
      connect();
    }
    
    // Cleanup function
    return () => {
      observer.disconnect();
      
      if (messageListenerRef.current) {
        removeMessageListener(messageListenerRef.current);
      }
      
      if (errorHandlerRef.current) {
        removeErrorHandler(errorHandlerRef.current);
      }
      
      if (!autoReconnect) {
        disconnect();
      }
    };
  }, [connect, disconnect, onClose, onError, onMessage, onOpen, autoReconnect]);
  
  // Provide public API
  return {
    status,
    connect,
    disconnect,
    sendMessage: send,
    isReady: status === ConnectionStatus.CONNECTED
  };
}