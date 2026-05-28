import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { IStorage } from './storage';
import { Order, User, MessageStatus, ChatMessage } from '@shared/schema';
import { sendPushToUser } from './push';
import { verifyFirebaseToken } from './firebase';
import { db } from './db';
import { users as usersTable } from '@shared/schema';
import { inArray } from 'drizzle-orm';

// Different notification types that can be sent over WebSocket
export enum NotificationType {
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  NEW_ORDER = 'NEW_ORDER',
  TRACKING_UPDATE = 'TRACKING_UPDATE',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  CONTENT_SHARED = 'CONTENT_SHARED',
  SERVICE_BOOKING = 'SERVICE_BOOKING',
  BOOKING_STATUS_UPDATE = 'BOOKING_STATUS_UPDATE',
  ADMIN_ORDER_UPDATE = 'ADMIN_ORDER_UPDATE', // Admin order updates
  DIGITAL_PRODUCT_READY = 'DIGITAL_PRODUCT_READY', // Digital product is ready for download
  CONTENT_REPORTED = 'CONTENT_REPORTED',      // When content is reported for moderation
  CONTENT_MODERATION = 'CONTENT_MODERATION',  // When content moderation action is taken
  EXPLORE_IMAGE_UPDATE = 'EXPLORE_IMAGE_UPDATE', // When explore page images are updated
  TERMS_PROMPT = 'TERMS_PROMPT',               // Terms of service prompt from admin
  EVENT_RSVP = 'EVENT_RSVP',                  // When a user RSVPs to an event
  FOLLOW_REQUEST = 'FOLLOW_REQUEST',           // When a user follows another user
  FOLLOW_ACCEPT = 'FOLLOW_ACCEPT',             // When a follow request is accepted
  PROFILE_UPDATE = 'PROFILE_UPDATE',           // When a user updates their profile
  STOCK_UPDATE = 'STOCK_UPDATE',               // When product stock is updated
  
  // Real-time message status notifications
  MESSAGE_DELIVERED = 'message_delivered',    // Message was delivered to recipient
  MESSAGE_SEEN = 'message_seen',              // Message was seen by recipient
  CHAT_PRESENCE_UPDATE = 'chat_presence_update', // User's online/offline status changed
  
  // Social interactions
  POST_LIKE = 'POST_LIKE',                     // When a user likes a post
  POST_COMMENT = 'POST_COMMENT',               // When a user comments on a post
  COMMENT_REPLY = 'COMMENT_REPLY',             // When a user replies to a comment
  
  // Product purchase notifications
  PRODUCT_PURCHASED = 'PRODUCT_PURCHASED',     // When a user purchases a product
  PRODUCT_REVIEW = 'PRODUCT_REVIEW',           // When a product receives a review
  
  // Event notifications
  EVENT_BOOKED = 'EVENT_BOOKED',               // When a user books an event
  EVENT_REMINDER = 'EVENT_REMINDER',           // Reminder for upcoming event
  EVENT_CANCELLED = 'EVENT_CANCELLED',         // When an event is cancelled
  
  // Spot notifications
  SPOT_ADDED = 'SPOT_ADDED',                   // When a new spot is added near user's location
  SPOT_UPDATED = 'SPOT_UPDATED',               // When a spot is updated
  
  // Chat message types
  CHAT_MESSAGE = 'CHAT_MESSAGE',               // New chat message
  CHAT_MESSAGE_DELIVERED = 'CHAT_MESSAGE_DELIVERED', // Message was delivered to recipient
  CHAT_MESSAGE_READ = 'CHAT_MESSAGE_READ',     // Message was read by recipient
  CHAT_MESSAGES_READ_BATCH = 'CHAT_MESSAGES_READ_BATCH', // Multiple messages were read in a batch
  CHAT_TYPING = 'CHAT_TYPING',                 // User is typing in chat
  CHAT_STOPPED_TYPING = 'CHAT_STOPPED_TYPING', // User stopped typing
  CHAT_CONVERSATION_CREATED = 'CHAT_CONVERSATION_CREATED', // New conversation created
  CHAT_USER_ONLINE = 'CHAT_USER_ONLINE',       // User is online
  CHAT_USER_OFFLINE = 'CHAT_USER_OFFLINE',     // User went offline

  // Competition / live scoring
  TT_SCORE_UPDATE = 'TT_SCORE_UPDATE',         // Table tennis point scored — broadcast to all spectators

  // Poll / voting
  POLL_UPDATE = 'POLL_UPDATE',                 // Poll vote cast — broadcast live results to event viewers
  POLL_STATUS_CHANGE = 'POLL_STATUS_CHANGE',   // Poll opened/paused/closed by admin
}

// Message structure for WebSocket communication
interface WebSocketMessage {
  type: NotificationType;
  payload: any;
  timestamp: number;
}

// Client connection with additional metadata
interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  role?: string;
  isAlive: boolean;
  username?: string;
  // Add additional user fields
  displayName?: string;
  email?: string;
  profilePicture?: string;
  lastActivity?: Date;
}

// Map to store connected clients
const clientsByUser = new Map<number, ExtendedWebSocket[]>();
const adminClients: ExtendedWebSocket[] = [];
const anonymousClients: ExtendedWebSocket[] = [];

// ── Active call session registry ─────────────────────────────────────────────
// When a CALL_OFFER is forwarded, the full payload is stored here so the server
// can re-deliver it directly on CALL_PICKUP — without needing the caller to still
// be in a "calling" state. This is the critical fix for iOS WebView cold-start:
// the callee's app is killed, push arrives, user taps it → WebView cold-starts,
// WS reconnects, callee sends CALL_PICKUP → server re-delivers the stored offer.
const CALL_SESSION_TTL_MS = 90_000; // 90 s — typical ring timeout

interface ActiveCallSession {
  fromUserId: number;
  toUserId: number;
  offer: any;
  callType: string;
  fromDisplayName: string;
  fromAvatar?: string;
  timestamp: number;
  expiryTimer: ReturnType<typeof setTimeout>;
}

// Keyed by "callerUserId:calleeUserId"
const activeCalls = new Map<string, ActiveCallSession>();

function callSessionKey(caller: number, callee: number) {
  return `${caller}:${callee}`;
}

function clearCallSession(key: string) {
  const s = activeCalls.get(key);
  if (s) { clearTimeout(s.expiryTimer); activeCalls.delete(key); }
}

let storage: IStorage;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(httpServer: Server, storageInstance: IStorage): WebSocketServer {
  storage = storageInstance;

  // Create WebSocket server on a specific path to avoid conflicts with Vite's HMR
  // Use clientTracking for improved connection management
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true
  });

  console.log('WebSocket server initialized on path: /ws');

  // Per-client connection rate tracking — limits rapid reconnection floods (DoS protection)
  const connectionTracker = new Map<string, { count: number; lastConnect: number }>();
  const CONN_RESET_TIME  = 60_000; // reset counter after 1 minute of quiet
  // In production all traffic comes through a proxy (127.0.0.1), so we use the
  // real client IP from X-Forwarded-For and a higher per-user limit.
  const MAX_RAPID_CONNECTIONS = 60; // per real client per minute (raised from 20 — token refresh reconnects are legitimate)

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;

    // Prefer the real client IP from X-Forwarded-For (set by Replit's proxy).
    // Use the uid query param as a fallback so each user gets their own bucket.
    const forwarded = req.headers['x-forwarded-for'];
    const rawIP = req.socket.remoteAddress || 'unknown';
    const url = new URL(req.url || '/', `ws://localhost`);
    const uid = url.searchParams.get('uid') || '';
    const clientKey = (forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
      : rawIP) + (uid ? `:${uid}` : '');

    const now = Date.now();

    let tracking = connectionTracker.get(clientKey);
    if (!tracking) {
      tracking = { count: 1, lastConnect: now };
      connectionTracker.set(clientKey, tracking);
    } else {
      if (now - tracking.lastConnect > CONN_RESET_TIME) {
        tracking.count = 1;
      } else {
        tracking.count++;
      }
      tracking.lastConnect = now;
    }

    if (tracking.count > MAX_RAPID_CONNECTIONS) {
      console.warn(`[WS] Rate limit exceeded from ${clientKey} (${tracking.count} connections/min) — closing`);
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    console.log('New WebSocket connection established');

    // Send immediate welcome message with connection info
    try {
      ws.send(JSON.stringify({
        type: NotificationType.SYSTEM_NOTIFICATION,
        payload: { message: 'Connected to real-time messaging system' },
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }

    // Handle pings to keep connection alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages from clients
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);

        // ── Application-level JSON ping ────────────────────────────────────
        // The client sends `{type:'ping'}` every 30s. Without this handler the
        // server never marks the socket as alive on the next heartbeat sweep
        // and the connection is killed with code 1006. Reply with a pong so
        // the client also gets a round-trip latency signal.
        if (data.type === 'ping') {
          ws.isAlive = true;
          try {
            ws.send(JSON.stringify({
              type: 'pong',
              payload: { ts: data.payload?.timestamp ?? Date.now() },
              timestamp: Date.now(),
            }));
          } catch {}
          return;
        }

        // Authentication message to identify the client
        if (data.type === 'auth' || data.type === 'identify') {
          const payload = data.payload || data;

          // ── Preferred path: Firebase ID token verification ─────────────────
          // Client sends { payload: { idToken, userId, role, displayName, ... } }
          // We verify the token server-side so the server never trusts client claims.
          const idToken = payload.idToken as string | undefined;
          if (idToken) {
            try {
              const decoded = await verifyFirebaseToken(idToken);
              const user = await storage.getUserByFirebaseUid(decoded.uid);
              if (!user) {
                console.warn(`[WS] Auth rejected — no user found for Firebase UID ${decoded.uid}`);
                ws.close(4001, 'User not found');
                return;
              }
              handleAuthentication(ws, user.id, user.role || 'user', user.displayName || '', payload);
            } catch (tokenErr: any) {
              const errCode: string = tokenErr?.errorInfo?.code || tokenErr?.code || '';
              const isExpired = errCode === 'auth/id-token-expired' || tokenErr.message?.includes('expired');
              if (isExpired) {
                // Tell client to refresh token — use custom code 4401 so client can distinguish
                console.warn('[WS] Token expired — notifying client to refresh');
                try {
                  ws.send(JSON.stringify({
                    type: 'auth_error',
                    payload: { code: 'token_expired', message: 'Firebase token expired — refresh and reconnect' },
                    timestamp: Date.now(),
                  }));
                } catch {}
                ws.close(4401, 'Token expired');
              } else {
                console.warn('[WS] Auth rejected — invalid Firebase token:', tokenErr.message);
                ws.close(4003, 'Invalid token');
              }
            }
            return; // handled
          }

          // ── No fallback: idToken is REQUIRED ──────────────────────────────
          // Previously we had a backward-compat path that trusted client-provided
          // userId/role. That allowed any client to claim { userId: 1, role: "admin" }
          // and impersonate other users for presence, RSVP and broadcast paths.
          // Closing the socket here forces clients to send a verified Firebase token.
          console.warn('[WS] Auth rejected — idToken is required for WebSocket auth');
          ws.close(4003, 'Authentication required');
          return;
        }
        // Message forwarding for admins and sellers
        else if (data.type === 'notification' && (ws.role === 'admin' || ws.role === 'seller')) {
          broadcastNotification(data.notificationType, data.payload, data.targetUserId);
        }
        // Event RSVP notifications - direct WebSocket message from client to client
        else if ((data.type === 'EVENT_RSVP' || data.type === 'event_rsvp') && ws.userId) {
          console.log('[EVENT] Processing direct EVENT_RSVP message from client', data);
          
          // Send the RSVP notification to the event organizer
          if (data.payload && data.payload.organizerId) {
            notifyEventRsvp(
              ws.userId,
              data.payload.eventId,
              data.payload.organizerId,
              data.payload.status || 'interested'
            );
          }
        }
        // Event RSVP forwarding - from WebSocketSingletonContext to server
        else if (data.type === 'forward_event_rsvp' && ws.userId) {
          console.log('[EVENT] Processing forwarded EVENT_RSVP from context', data);
          
          if (data.payload && data.payload.eventId && data.payload.organizerId) {
            notifyEventRsvp(
              ws.userId,
              data.payload.eventId,
              data.payload.organizerId,
              data.payload.status || 'interested'
            );
          }
        }
        // Chat message handling
        else if (data.type === 'chat_message' && ws.userId) {
          handleChatMessage(ws, data);
        }
        // Message delivery status handling
        else if (data.type === 'message_delivered' && ws.userId) {
          handleMessageDelivered(ws, data);
        }
        // Message read status handling
        else if (data.type === 'message_seen' && ws.userId) {
          handleMessageSeen(ws, data);
        }
        // User presence updates
        else if ((data.type === 'user_online' || data.type === 'user_offline' || data.type === 'user_away') && ws.userId) {
          handlePresenceUpdate(ws, data, data.type);
        }
        // Chat typing indicator
        else if (data.type === 'chat_typing' && ws.userId) {
          handleChatTyping(ws, data.conversationId, true);
        }
        // Chat stopped typing indicator
        else if (data.type === 'chat_stopped_typing' && ws.userId) {
          handleChatTyping(ws, data.conversationId, false);
        }
        // Mark message as read
        else if (data.type === 'mark_message_read' && ws.userId) {
          markMessageAsRead(ws.userId, data.messageId, data.conversationId);
        }
        // Mark multiple messages as read (batch operation)
        else if (data.type === 'mark_messages_read_batch' && ws.userId) {
          markMessagesReadBatch(ws.userId, data.messageIds, data.conversationId);
        }
        // Create new conversation
        else if (data.type === 'create_conversation' && ws.userId) {
          createConversation(ws, data);
        }
        // ── WebRTC Call Signaling ─────────────────────────────────────────────
        else if (data.type === 'CALL_OFFER' && ws.userId) {
          const { toUserId, offer, callType, fromDisplayName, fromAvatar } = data.payload || {};
          if (!toUserId) return;
          const callerName = ws.displayName || fromDisplayName || `User ${ws.userId}`;
          const callKind = callType || 'voice';
          const fromUserId = ws.userId;
          const offerPayload = { fromUserId, fromDisplayName: callerName, fromAvatar, offer, callType: callKind };

          // Forward to callee if connected
          const calleeClients = clientsByUser.get(toUserId) || [];
          calleeClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_OFFER', payload: offerPayload })); });

          // ── Store session for cold-start CALL_PICKUP recovery ──────────────
          // The callee's app may be closed; we keep the offer server-side so we
          // can re-deliver it when the callee reconnects and sends CALL_PICKUP.
          const key = callSessionKey(fromUserId, toUserId);
          clearCallSession(key); // Remove stale session for same pair
          activeCalls.set(key, {
            fromUserId,
            toUserId,
            offer,
            callType: callKind,
            fromDisplayName: callerName,
            fromAvatar,
            timestamp: Date.now(),
            expiryTimer: setTimeout(() => activeCalls.delete(key), CALL_SESSION_TTL_MS),
          });

          // ALWAYS send a push for incoming calls so the iOS WebView wrapper / web user
          // gets notified even if their socket isn't open (app backgrounded / device asleep).
          const isVideo = callKind === 'video';
          const callTitle = isVideo ? '📹 Incoming video call' : '📞 Incoming call';
          const callBody = `${callerName} is calling you...`;
          storage.createUserNotification({
            userId: toUserId,
            type: isVideo ? 'incoming_video_call' : 'incoming_call',
            title: callTitle,
            message: callBody,
            targetId: fromUserId,
            targetType: 'user',
            actionLink: `/chat?call_from=${fromUserId}`,
          }).catch(() => {});
          sendPushToUser(toUserId, {
            title: callTitle,
            body: callBody,
            icon: fromAvatar || '/logo.jpg',
            url: `/chat?call_from=${fromUserId}`,
            requireInteraction: true,
            data: {
              type: 'incoming_call',
              callType: callKind,
              fromUserId: String(fromUserId),
              fromDisplayName: callerName,
              priority: 'high',
            },
          }).catch(err => console.error('[Push] incoming_call failed:', err));
        }
        else if (data.type === 'CALL_ANSWER' && ws.userId) {
          const { toUserId, answer } = data.payload || {};
          if (!toUserId) return;
          // Clear stored session — call was answered
          clearCallSession(callSessionKey(toUserId, ws.userId));
          const targets = clientsByUser.get(toUserId) || [];
          targets.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_ANSWER', payload: { fromUserId: ws.userId, answer } })); });
        }
        else if (data.type === 'CALL_ICE' && ws.userId) {
          const { toUserId, candidate } = data.payload || {};
          if (!toUserId) return;
          const targets = clientsByUser.get(toUserId) || [];
          targets.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_ICE', payload: { fromUserId: ws.userId, candidate } })); });
        }
        else if (data.type === 'CALL_REJECT' && ws.userId) {
          const { toUserId } = data.payload || {};
          if (!toUserId) return;
          // Clear stored session — call was declined
          clearCallSession(callSessionKey(toUserId, ws.userId));
          const targets = clientsByUser.get(toUserId) || [];
          targets.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_REJECT', payload: { fromUserId: ws.userId } })); });
        }
        else if (data.type === 'CALL_HANG_UP' && ws.userId) {
          const { toUserId } = data.payload || {};
          if (!toUserId) return;
          // Clear stored session in both directions
          clearCallSession(callSessionKey(ws.userId, toUserId));
          clearCallSession(callSessionKey(toUserId, ws.userId));
          const targets = clientsByUser.get(toUserId) || [];
          targets.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_HANG_UP', payload: { fromUserId: ws.userId } })); });
        }
        else if (data.type === 'CALL_PICKUP' && ws.userId) {
          // Callee opened the app from a push notification (WebView cold-start).
          // Strategy 1 (primary): re-deliver the stored CALL_OFFER directly from the
          //   server — does NOT require the caller to still be in "calling" state.
          // Strategy 2 (backup): also forward CALL_PICKUP to the caller so they can
          //   re-send a fresh offer with updated ICE candidates if they're still alive.
          const { toUserId } = data.payload || {};
          if (!toUserId) return;

          const key = callSessionKey(toUserId, ws.userId); // caller:callee
          const session = activeCalls.get(key);
          const calleeId = ws.userId;

          if (session && (Date.now() - session.timestamp) < CALL_SESSION_TTL_MS) {
            // Re-deliver stored CALL_OFFER directly to the callee
            const calleeClients = clientsByUser.get(calleeId) || [];
            calleeClients.forEach(c => {
              if (c.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({
                  type: 'CALL_OFFER',
                  payload: {
                    fromUserId: session.fromUserId,
                    fromDisplayName: session.fromDisplayName,
                    fromAvatar: session.fromAvatar,
                    callType: session.callType,
                    offer: session.offer,
                  },
                }));
              }
            });
            console.log(`[Call] CALL_PICKUP from ${calleeId}: re-delivered stored offer (caller=${toUserId})`);
          }

          // Also forward CALL_PICKUP to caller as backup (so they can re-send with fresh ICE)
          const callerClients = clientsByUser.get(toUserId) || [];
          callerClients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) {
              c.send(JSON.stringify({ type: 'CALL_PICKUP', payload: { fromUserId: calleeId } }));
            }
          });
        }
        else if (data.type === 'CALL_BUSY' && ws.userId) {
          const { toUserId } = data.payload || {};
          if (!toUserId) return;
          const targets = clientsByUser.get(toUserId) || [];
          targets.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify({ type: 'CALL_BUSY', payload: { fromUserId: ws.userId } })); });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      if (ws.userId) {
        const userClients = clientsByUser.get(ws.userId) || [];
        const updatedClients = userClients.filter(client => client !== ws);

        if (updatedClients.length > 0) {
          // User still has other connections, keep them in the map
          clientsByUser.set(ws.userId, updatedClients);
        } else {
          // User has no more connections, remove from map and broadcast offline status
          clientsByUser.delete(ws.userId);
          
          // Broadcast offline status to ALL connected users
          broadcastToAllUsers({
            type: NotificationType.CHAT_USER_OFFLINE,
            payload: {
              userId: ws.userId,
              displayName: ws.displayName || `User ${ws.userId}`,
              offlineSince: new Date().toISOString()
            },
            timestamp: Date.now()
          });
          
          console.log(`User ${ws.userId} is now offline (all connections closed)`);
        }
      }

      if (ws.role === 'admin') {
        const index = adminClients.indexOf(ws);
        if (index !== -1) {
          adminClients.splice(index, 1);
        }
      } else if (!ws.userId) {
        const index = anonymousClients.indexOf(ws);
        if (index !== -1) {
          anonymousClients.splice(index, 1);
        }
      }
    });

    // Initially add to anonymous clients until authenticated
    anonymousClients.push(ws);
  });

  // ── Memory hygiene: prune stale connection-tracker buckets every 5 min
  // Without this the Map grows unbounded as new client IPs / uids appear.
  const trackerSweep = setInterval(() => {
    const cutoff = Date.now() - CONN_RESET_TIME * 5; // 5 min idle
    for (const [k, v] of connectionTracker.entries()) {
      if (v.lastConnect < cutoff) connectionTracker.delete(k);
    }
  }, 5 * 60 * 1000);

  // Setup a heartbeat interval to detect broken connections
  const PING_INTERVAL = 15000; // More frequent checks
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.isAlive === false) {
        console.log('Terminating inactive WebSocket connection');
        return ws.terminate();
      }

      ws.isAlive = false;
      try {
        ws.ping();
      } catch (error) {
        console.error('Error sending ping:', error);
        ws.terminate();
      }
    });
  }, PING_INTERVAL); // Check every 15 seconds

  // Clear intervals on server close
  wss.on('close', () => {
    clearInterval(interval);
    clearInterval(trackerSweep);
  });

  return wss;
}

/**
 * Handle client authentication - with safeguards against duplicate connections
 * Enhanced to support more user details for better messaging experience
 */
function handleAuthentication(ws: ExtendedWebSocket, userId: number, role: string, username?: string, data?: any) {
  if (!userId) {
    // Keep in anonymous clients if no user ID provided
    return;
  }

  // Check if this socket is already authenticated for this user
  if (ws.userId === userId) {
    // Already authenticated as this user, just send a confirmation
    sendMessage(ws, {
      type: NotificationType.SYSTEM_NOTIFICATION,
      payload: { message: 'Already connected to real-time messaging system' },
      timestamp: Date.now()
    });
    return;
  }

  // Remove from anonymous clients
  const anonIndex = anonymousClients.indexOf(ws);
  if (anonIndex !== -1) {
    anonymousClients.splice(anonIndex, 1);
  }

  // If socket was previously authenticated as a different user, clean up that association
  if (ws.userId) {
    const previousUserClients = clientsByUser.get(ws.userId) || [];
    const updatedPreviousClients = previousUserClients.filter(client => client !== ws);
    
    if (updatedPreviousClients.length > 0) {
      clientsByUser.set(ws.userId, updatedPreviousClients);
    } else {
      clientsByUser.delete(ws.userId);
    }
    
    // Also remove from adminClients if necessary
    if (ws.role === 'admin' || ws.role === 'seller') {
      const adminIndex = adminClients.indexOf(ws);
      if (adminIndex !== -1) {
        adminClients.splice(adminIndex, 1);
      }
    }
  }

  // Extract additional user details from payload if available
  const displayName = data?.displayName || username || `User ${userId}`;
  const email = data?.email;
  const profilePicture = data?.profilePicture;

  // Update client metadata with enhanced details
  ws.userId = userId;
  ws.role = role;
  ws.username = displayName; // Use displayName as the primary username
  ws.displayName = displayName; // Also store separately
  ws.email = email;
  ws.profilePicture = profilePicture;
  ws.lastActivity = new Date();

  // Add to appropriate collections
  if (role === 'admin' || role === 'seller') {
    // Ensure no duplicate entries in adminClients
    if (!adminClients.includes(ws)) {
      adminClients.push(ws);
    }
  }

  // Add to user-specific collection
  const userClients = clientsByUser.get(userId) || [];
  // Ensure no duplicate entries
  if (!userClients.includes(ws)) {
    userClients.push(ws);
    clientsByUser.set(userId, userClients);
  }

  // Notify ALL other users that this user is now online (presence indicators)
  broadcastToAllUsers({
    type: NotificationType.CHAT_USER_ONLINE,
    payload: {
      userId,
      displayName,
      profilePicture,
      lastActivity: new Date().toISOString()
    },
    timestamp: Date.now()
  });

  // Send explicit auth success message for client to recognize
  // EMERGENCY FIX: Send both formats of auth success to ensure client receives it
  // First format: Simple "auth_success" type
  sendMessage(ws, {
    type: 'auth_success',  // This specific message type is watched for by the client
    payload: { 
      userId: userId,
      role: role,
      displayName: displayName,
      profilePicture: profilePicture,
      authenticated: true,
      message: 'Authentication successful'
    },
    timestamp: Date.now()
  });
  
  // Second format: Using AUTH_SUCCESS enum for clients that check using the enum
  sendMessage(ws, {
    type: 'AUTH_SUCCESS',  // Uppercase variant for clients using enum 
    payload: { 
      userId: userId,
      role: role,
      displayName: displayName,
      profilePicture: profilePicture,
      authenticated: true,
      message: 'Authentication successful'
    },
    timestamp: Date.now()
  });
  
  // Also send the system notification
  sendMessage(ws, {
    type: NotificationType.SYSTEM_NOTIFICATION,
    payload: { 
      message: 'Connected to real-time messaging system',
      userId: userId,
      role: role,
      displayName: displayName,
      profilePicture: profilePicture
    },
    timestamp: Date.now()
  });

  console.log(`WebSocket client authenticated: User ID ${userId}, Role: ${role}, Name: ${displayName}`);
}

/**
 * Returns the IDs of all currently connected/authenticated users
 */
export function getOnlineUserIds(): number[] {
  return Array.from(clientsByUser.keys());
}

/**
 * Broadcast an order status update notification to relevant clients
 */
export function notifyOrderStatusUpdate(order: Order, statusMessage: string) {
  if (!order || !order.buyerId) return;

  const payload = {
    orderId: order.id,
    status: order.status,
    message: statusMessage,
    updatedAt: order.updatedAt || new Date()
  };

  // Notify the buyer
  broadcastNotification(NotificationType.ORDER_STATUS_UPDATE, payload, order.buyerId);

  // Also notify all admins about the update
  broadcastToAdmins({
    type: NotificationType.ORDER_STATUS_UPDATE,
    payload,
    timestamp: Date.now()
  });
}

/**
 * Notify about a new tracking number
 */
export function notifyTrackingUpdate(order: Order) {
  if (!order || !order.buyerId) return;

  const payload = {
    orderId: order.id,
    trackingNumber: order.trackingNumber,
    courierName: order.courierName || 'PostNL',
    trackingUrl: order.trackingUrl,
    updatedAt: order.updatedAt || new Date()
  };

  // Notify the buyer
  broadcastNotification(NotificationType.TRACKING_UPDATE, payload, order.buyerId);
}

/**
 * Notify about a new order
 */
export function notifyNewOrder(order: Order) {
  if (!order) return;

  // Notify all admins about the new order via WebSocket
  broadcastToAdmins({
    type: NotificationType.NEW_ORDER,
    payload: {
      orderId: order.id,
      buyerId: order.buyerId,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt || new Date()
    },
    timestamp: Date.now()
  });

  // Also create persistent notifications for admins in the database
  if (storage) {
    // Find admin users to notify
    storage.getUsersByRole("admin").then(admins => {
      if (admins && admins.length > 0) {
        // Get buyer information
        if (order.buyerId) {
          storage.getUser(order.buyerId).then(buyer => {
            const buyerName = buyer ? buyer.displayName || buyer.email : "Customer";

            // Create notifications for each admin
            admins.forEach(admin => {
              storage.createUserNotification({
                userId: admin.id,
                type: NotificationType.NEW_ORDER,
                title: `New Order #${order.id}`,
                message: `${buyerName} has placed a new order for ${order.totalAmount}. Status: ${order.status}`,
                actionLink: `/orders/${order.id}`,
                actionText: "View Order"
              }).catch(err => {
                console.error(`Failed to create admin notification for order #${order.id}:`, err);
              });
            });
          }).catch(err => {
            console.error(`Failed to get buyer info for order #${order.id}:`, err);
          });
        } else {
          // If no buyer ID, still notify admins
          admins.forEach(admin => {
            storage.createUserNotification({
              userId: admin.id,
              type: NotificationType.NEW_ORDER,
              title: `New Order #${order.id}`,
              message: `A new order has been placed for ${order.totalAmount}. Status: ${order.status}`,
              actionLink: `/orders/${order.id}`,
              actionText: "View Order"
            }).catch(err => {
              console.error(`Failed to create admin notification for order #${order.id}:`, err);
            });
          });
        }
      }
    }).catch(err => {
      console.error("Failed to get admin users for notification:", err);
    });
  }
}

/**
 * Notify when content is shared 
 * @param contentType The type of content being shared (event, location, service, product, post)
 * @param contentId The ID of the content being shared
 * @param userId The ID of the user who shared the content (if authenticated)
 * @param platform The platform where content was shared (twitter, facebook, etc)
 */
export function notifyContentShared(
  contentType: string, 
  contentId: number, 
  userId?: number,
  platform?: string
) {
  // Create notification payload
  const payload = {
    contentType,
    contentId,
    userId: userId || null,
    platform: platform || 'unknown',
    timestamp: new Date()
  };

  // Notify admins about the share
  broadcastToAdmins({
    type: NotificationType.CONTENT_SHARED,
    payload,
    timestamp: Date.now()
  });

  // If content has an owner (like a service provider or event organizer)
  // we could notify them too in the future
}

/**
 * Notify about a new service booking
 * @param providerId The ID of the service provider
 * @param booking The booking details
 * @param customer The customer who made the booking
 * @param service The service that was booked
 */
export function notifyServiceBooking(
  providerId: number,
  booking: any,
  customer: any,
  service: any
) {
  if (!providerId || !booking || !customer || !service) return;

  const payload = {
    bookingId: booking.id,
    serviceId: service.id,
    serviceName: service.name,
    customerName: customer.displayName,
    customerId: customer.id,
    bookingDate: booking.bookingDate,
    status: booking.status,
    price: service.price,
    message: `${customer.displayName} has booked your service ${service.name}`,
    createdAt: booking.createdAt || new Date()
  };

  // Notify the service provider
  broadcastNotification(NotificationType.SERVICE_BOOKING, payload, providerId);

  // Persist + push to provider
  storage.createUserNotification({
    userId: providerId,
    type: 'service_booking',
    title: 'New service booking',
    message: payload.message,
    targetId: booking.id,
    targetType: 'booking',
    actionLink: `/provider/bookings/${booking.id}`,
  }).catch(err => console.error('Failed to create service booking notification:', err));

  sendPushToUser(providerId, {
    title: '📅 New service booking',
    body: payload.message,
    icon: customer.profilePicture || '/logo.jpg',
    url: `/provider/bookings/${booking.id}`,
    data: { type: 'service_booking', bookingId: String(booking.id), serviceId: String(service.id) },
  }).catch(err => console.error('[Push] service_booking failed:', err));

  // Also persist + push for the customer (confirmation)
  storage.createUserNotification({
    userId: customer.id,
    type: 'service_booking_confirmed',
    title: 'Booking received',
    message: `Your booking for ${service.name} has been received.`,
    targetId: booking.id,
    targetType: 'booking',
    actionLink: `/bookings/${booking.id}`,
  }).catch(() => {});

  sendPushToUser(customer.id, {
    title: '✅ Booking received',
    body: `Your booking for ${service.name} has been received.`,
    url: `/bookings/${booking.id}`,
    data: { type: 'service_booking_confirmed', bookingId: String(booking.id) },
  }).catch(err => console.error('[Push] service_booking customer failed:', err));

  // Also notify all admins about the new booking
  broadcastToAdmins({
    type: NotificationType.SERVICE_BOOKING,
    payload,
    timestamp: Date.now()
  });
}

/**
 * Notify about a booking status update
 * @param userId The customer to notify
 * @param providerId The service provider who updated the status
 * @param booking The updated booking
 * @param service The service details
 * @param statusMessage Custom message about the status change
 */
export function notifyBookingStatusUpdate(
  userId: number,
  providerId: number,
  booking: any,
  service: any,
  statusMessage: string
) {
  if (!userId || !booking || !service) return;

  const payload = {
    bookingId: booking.id,
    serviceId: service.id,
    serviceName: service.name,
    providerId: providerId,
    status: booking.status,
    message: statusMessage,
    updatedAt: booking.updatedAt || new Date()
  };

  // Notify the customer
  broadcastNotification(NotificationType.BOOKING_STATUS_UPDATE, payload, userId);

  storage.createUserNotification({
    userId,
    type: 'booking_status_update',
    title: `Booking ${booking.status}`,
    message: statusMessage,
    targetId: booking.id,
    targetType: 'booking',
    actionLink: `/bookings/${booking.id}`,
  }).catch(() => {});

  sendPushToUser(userId, {
    title: `Booking ${booking.status}`,
    body: statusMessage,
    url: `/bookings/${booking.id}`,
    data: { type: 'booking_status', bookingId: String(booking.id), status: String(booking.status) },
  }).catch(err => console.error('[Push] booking_status failed:', err));

  // Also notify service provider if status was updated by system or admin
  if (providerId !== booking.providerId) {
    broadcastNotification(NotificationType.BOOKING_STATUS_UPDATE, payload, booking.providerId);
    sendPushToUser(booking.providerId, {
      title: `Booking ${booking.status}`,
      body: statusMessage,
      url: `/provider/bookings/${booking.id}`,
      data: { type: 'booking_status', bookingId: String(booking.id), status: String(booking.status) },
    }).catch(err => console.error('[Push] booking_status provider failed:', err));
  }

  // Notify admins
  broadcastToAdmins({
    type: NotificationType.BOOKING_STATUS_UPDATE,
    payload,
    timestamp: Date.now()
  });
}

/**
 * Send an admin order status update notification to a user
 * This creates both a WebSocket notification and persists it to the database
 * @param userId The user ID to send the notification to
 * @param orderId The order ID being updated
 * @param status The new status of the order
 * @param adminId The admin ID who is sending the notification
 * @param message Custom status message to show to the user
 */
/**
 * Notify a user that their digital product is ready for download
 * @param userId The user ID to send the notification to
 * @param orderId The order ID that contains the digital product
 * @param productId The ID of the digital product
 * @param productName The name of the digital product
 */
export function notifyDigitalProductReady(
  userId: number,
  orderId: number,
  productId: number,
  productName: string
) {
  if (!userId || !orderId || !productId) return;

  const payload = {
    orderId,
    productId,
    productName,
    message: `Your digital product "${productName}" is ready for download.`,
    timestamp: new Date()
  };

  // Send WebSocket notification to the user
  broadcastNotification(NotificationType.DIGITAL_PRODUCT_READY, payload, userId);

  // Create persistent notification in database
  try {
    if (storage) {
      storage.createUserNotification({
        userId,
        type: "DIGITAL_PRODUCT_READY",
        title: "Digital Product Ready",
        message: `Your digital product "${productName}" is ready for download.`,
        actionLink: `/orders/${orderId}`,
        actionText: "View Product"
      }).catch(err => {
        console.error(`Failed to create digital product notification:`, err);
      });
    }
  } catch (error) {
    console.error("Error creating digital product notification:", error);
  }
}

/**
 * Notify when a user purchases a product
 * @param userId The user who made the purchase 
 * @param product The product that was purchased
 * @param sellerId The seller who needs to be notified
 * @param quantity Number of items purchased
 * @param orderId The ID of the created order
 */
export function notifyProductPurchased(
  userId: number,
  product: any,
  sellerId: number,
  quantity: number = 1,
  orderId: number
) {
  if (!userId || !product || !sellerId || !orderId) return;

  // Don't notify if user purchases their own product
  if (userId === sellerId) return;
  
  // Get user info to show in notification
  storage.getUser(userId).then(user => {
    if (!user) return;
    
    // Prepare notification for the seller
    const sellerPayload = {
      productId: product.id,
      productName: product.name,
      quantity,
      buyerId: userId,
      buyerName: user.displayName || 'Someone',
      orderId,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} purchased ${quantity > 1 ? quantity + ' units of' : ''} your product "${product.name}"`,
      actionLink: `/marketplace/seller/orders/${orderId}`
    };
    
    // Notify the seller about the purchase
    broadcastNotification(NotificationType.PRODUCT_PURCHASED, sellerPayload, sellerId);
    
    // Create a persistent notification in the database for the seller
    storage.createUserNotification({
      userId: sellerId,
      type: NotificationType.PRODUCT_PURCHASED.toLowerCase(),
      title: 'New Product Sale',
      message: sellerPayload.message,
      targetId: orderId,
      targetType: 'order',
      actionLink: sellerPayload.actionLink
    }).catch(err => {
      console.error('Failed to create product purchase notification for seller:', err);
    });
    
    // Also send a confirmation notification to the buyer
    const buyerPayload = {
      productId: product.id,
      productName: product.name,
      quantity,
      sellerId,
      orderId,
      timestamp: new Date(),
      message: `You have successfully purchased ${quantity > 1 ? quantity + ' units of' : ''} "${product.name}"`,
      actionLink: `/marketplace/orders/${orderId}`
    };
    
    broadcastNotification(NotificationType.PRODUCT_PURCHASED, buyerPayload, userId);
    
    // Create persistent notification for the buyer
    storage.createUserNotification({
      userId,
      type: NotificationType.PRODUCT_PURCHASED.toLowerCase(),
      title: 'Purchase Confirmation',
      message: buyerPayload.message,
      targetId: orderId,
      targetType: 'order',
      actionLink: buyerPayload.actionLink
    }).catch(err => {
      console.error('Failed to create purchase confirmation notification for buyer:', err);
    });
  }).catch(err => {
    console.error('Failed to get user info for product purchase notification:', err);
  });
}

/**
 * Notify users about a product review
 * @param userId The user who wrote the review
 * @param productId The product that was reviewed
 * @param sellerId The seller to notify
 * @param reviewId The ID of the created review
 * @param rating The star rating given (1-5)
 * @param reviewContent The content of the review (optional)
 */
export function notifyProductReview(
  userId: number,
  productId: number,
  sellerId: number,
  reviewId: number,
  rating: number,
  reviewContent?: string
) {
  if (!userId || !productId || !sellerId || !reviewId) return;
  
  // Don't notify if user reviews their own product
  if (userId === sellerId) return;
  
  // Get user info and product info
  Promise.all([
    storage.getUser(userId),
    storage.getProduct(productId)
  ]).then(([user, product]) => {
    if (!user || !product) return;
    
    // Prepare notification for the seller
    const ratingText = rating === 1 ? '1 star' : `${rating} stars`;
    let truncatedContent = '';
    if (reviewContent) {
      truncatedContent = reviewContent.length > 50 
        ? `${reviewContent.substring(0, 47)}...` 
        : reviewContent;
    }
    
    const payload = {
      productId,
      productName: product.name,
      reviewId,
      userId,
      userName: user.displayName || 'Someone',
      rating,
      reviewContent: truncatedContent,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} rated your product "${product.name}" ${ratingText}${truncatedContent ? `: "${truncatedContent}"` : ''}`,
      actionLink: `/marketplace/product/${productId}/reviews#review-${reviewId}`
    };
    
    // Notify the seller about the review
    broadcastNotification(NotificationType.PRODUCT_REVIEW, payload, sellerId);
    
    // Create a persistent notification in the database
    storage.createUserNotification({
      userId: sellerId,
      type: NotificationType.PRODUCT_REVIEW.toLowerCase(),
      title: 'New Product Review',
      message: payload.message,
      targetId: productId,
      targetType: 'product',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error('Failed to create product review notification:', err);
    });
  }).catch(err => {
    console.error('Failed to get user/product info for review notification:', err);
  });
}

/**
 * Notify users about a new spot added to the map
 * @param spot The spot that was added
 * @param creatorId The user who created the spot
 * @param notifyRadius Radius in kilometers to notify users (default: 10)
 */
export function notifySpotAdded(
  spot: any,
  creatorId: number,
  notifyRadius: number = 10
) {
  if (!spot || !spot.id) return;
  
  const payload = {
    spotId: spot.id,
    spotName: spot.name,
    spotType: spot.type,
    latitude: spot.latitude,
    longitude: spot.longitude,
    creatorId,
    timestamp: new Date(),
    message: `New ${spot.type || 'urban culture'} spot "${spot.name}" was added near you!`,
    actionLink: `/map?spot=${spot.id}`
  };
  
  // TODO: Implement geospatial query to find users within the radius
  // For now, we'll broadcast to all users
  
  // Notify all users (except the creator)
  clientsByUser.forEach((clients, userId) => {
    // Skip the creator
    if (userId === creatorId) return;
    
    // Send WebSocket notification
    broadcastNotification(NotificationType.SPOT_ADDED, payload, userId);
    
    // Create persistent notification
    storage.createUserNotification({
      userId,
      type: NotificationType.SPOT_ADDED.toLowerCase(),
      title: 'New Spot Nearby',
      message: payload.message,
      targetId: spot.id,
      targetType: 'spot',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error(`Failed to create spot added notification for user ${userId}:`, err);
    });
  });
  
  console.log(`Notified users about new spot "${spot.name}" (ID: ${spot.id})`);
}

/**
 * Notify users about an updated spot on the map
 * @param spot The spot that was updated
 * @param updaterId The user who updated the spot
 */
export function notifySpotUpdated(
  spot: any,
  updaterId: number
) {
  if (!spot || !spot.id) return;
  
  const payload = {
    spotId: spot.id,
    spotName: spot.name,
    spotType: spot.type,
    latitude: spot.latitude,
    longitude: spot.longitude,
    updaterId,
    updateTimestamp: new Date(),
    message: `The ${spot.type || 'urban culture'} spot "${spot.name}" has been updated with new information!`,
    actionLink: `/map?spot=${spot.id}`
  };
  
  // Only notify users who have interacted with this spot
  // TODO: Implement a way to track which users have interacted with a spot
  // For now, notify all admins and the creator if available
  
  // Notify admins about the update
  broadcastToAdmins({
    type: NotificationType.SPOT_UPDATED,
    payload,
    timestamp: Date.now()
  });
  
  // If spot has a creator ID and it's different from the updater, notify them too
  if (spot.createdBy && spot.createdBy !== updaterId) {
    broadcastNotification(NotificationType.SPOT_UPDATED, payload, spot.createdBy);
    
    // Create persistent notification for the creator
    storage.createUserNotification({
      userId: spot.createdBy,
      type: NotificationType.SPOT_UPDATED.toLowerCase(),
      title: 'Spot Updated',
      message: payload.message,
      targetId: spot.id,
      targetType: 'spot',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error(`Failed to create spot updated notification for user ${spot.createdBy}:`, err);
    });
  }
  
  console.log(`Notified about updated spot "${spot.name}" (ID: ${spot.id})`);
}

/**
 * Notify all users about a product stock update
 * This broadcasts to all users and shows notifications if a product is running low on stock
 * or has gone out of stock
 * @param stockData Information about the stock update
 * @param stockData.productId The ID of the product
 * @param stockData.productName The name of the product
 * @param stockData.newStock The new stock level
 * @param stockData.isOutOfStock True if the product is now out of stock
 */
export function notifyStockUpdate(stockData: {
  productId: number,
  productName: string,
  newStock: number,
  isOutOfStock: boolean
}) {
  if (!stockData.productId) return;

  // Create notification payload with complete stock status info
  const payload = {
    productId: stockData.productId,
    productName: stockData.productName,
    stock: stockData.newStock,
    isOutOfStock: stockData.isOutOfStock,
    isLowStock: stockData.newStock > 0 && stockData.newStock <= 5,
    timestamp: new Date()
  };

  // Broadcast to all connected users - this is a public notification
  // that will be handled by client-side code to update UI
  broadcastToAll({
    type: NotificationType.STOCK_UPDATE,
    payload,
    timestamp: Date.now()
  });

  // Create persistent notification for admins and the seller
  try {
    if (storage) {
      // Get the product to find seller
      storage.getProduct(stockData.productId).then(product => {
        if (product && product.sellerId) {
          // Create notification for seller
          storage.createUserNotification({
            userId: product.sellerId,
            type: "STOCK_UPDATE",
            title: stockData.isOutOfStock ? "Product Out of Stock" : "Product Low on Stock",
            message: stockData.isOutOfStock 
              ? `Your product "${stockData.productName}" is now out of stock.`
              : `Your product "${stockData.productName}" is running low on stock (${stockData.newStock} remaining).`,
            actionLink: `/marketplace/${stockData.productId}`,
            actionText: "View Product"
          }).catch(err => {
            console.error(`Failed to create seller stock notification:`, err);
          });
        }

        // Also notify admins about the stock change
        storage.getUsersByRole("admin").then(admins => {
          if (admins && admins.length > 0) {
            admins.forEach(admin => {
              storage.createUserNotification({
                userId: admin.id,
                type: "STOCK_UPDATE",
                title: stockData.isOutOfStock ? "Product Out of Stock" : "Product Low on Stock",
                message: stockData.isOutOfStock 
                  ? `Product "${stockData.productName}" is now out of stock.`
                  : `Product "${stockData.productName}" is running low on stock (${stockData.newStock} remaining).`,
                actionLink: `/marketplace/${stockData.productId}`,
                actionText: "View Product"
              }).catch(err => {
                console.error(`Failed to create admin stock notification:`, err);
              });
            });
          }
        }).catch(err => {
          console.error("Failed to get admin users for stock notification:", err);
        });
      }).catch(err => {
        console.error(`Failed to get product ${stockData.productId} for stock notification:`, err);
      });
    }
  } catch (error) {
    console.error("Error creating stock update notification:", error);
  }
}

/**
 * Send a Terms of Service prompt to users
 * @param targetUsers Users to receive the terms prompt ('all', 'active', or specific role)
 * @param title Title for the terms prompt
 * @param message Message to display to users
 * @param requireAction Whether users must accept/decline to continue
 * @param adminId ID of the admin sending the prompt
 * @param termsVersion Version of terms to show ('current' or 'draft')
 */
export function notifyTermsOfServicePrompt(
  targetUsers: string,
  title: string,
  message: string,
  requireAction: boolean = true,
  adminId?: number,
  termsVersion: string = 'current'
) {
  // Create notification payload
  const payload = {
    title,
    message,
    requireAction,
    adminId: adminId || null,
    termsVersion,
    timestamp: new Date()
  };

  // Determine which users to notify based on target
  if (targetUsers === 'all') {
    // Send to all connected users
    broadcastToAllUsers({
      type: NotificationType.TERMS_PROMPT,
      payload,
      timestamp: Date.now()
    });
    
    // Also persist to DB for offline users if storage is available
    if (storage) {
      storage.getUsersByRole('all').then(users => {
        users.forEach(user => {
          storage.createUserNotification({
            userId: user.id,
            type: "TERMS_PROMPT",
            title: title,
            message: message,
            actionLink: "/terms-of-service",
            actionText: "View Terms",
            fromAdminId: adminId
          }).catch(err => {
            console.error(`Failed to create terms notification for user #${user.id}:`, err);
          });
        });
      }).catch(err => {
        console.error("Failed to get users for terms notifications:", err);
      });
    }
  } 
  else if (targetUsers === 'active') {
    // Send only to currently connected users
    broadcastToAllUsers({
      type: NotificationType.TERMS_PROMPT,
      payload,
      timestamp: Date.now()
    });
  }
  else if (targetUsers === 'notAccepted') {
    // Get users who haven't accepted latest terms
    if (storage) {
      storage.getUsersWithoutLatestTermsAcceptance().then(users => {
        // Send WebSocket notifications to connected users in this list
        users.forEach(user => {
          broadcastNotification(NotificationType.TERMS_PROMPT, payload, user.id);
          
          // Also create persistent notification
          storage.createUserNotification({
            userId: user.id,
            type: "TERMS_PROMPT",
            title: title,
            message: message,
            actionLink: "/terms-of-service",
            actionText: "View Terms",
            fromAdminId: adminId
          }).catch(err => {
            console.error(`Failed to create terms notification for user #${user.id}:`, err);
          });
        });
      }).catch(err => {
        console.error("Failed to get users without latest terms acceptance:", err);
      });
    }
  }
  else {
    // Specific user role (e.g. 'artists', 'enthusiasts', etc.)
    if (storage) {
      storage.getUsersByRole(targetUsers).then(users => {
        users.forEach(user => {
          broadcastNotification(NotificationType.TERMS_PROMPT, payload, user.id);
          
          // Also create persistent notification
          storage.createUserNotification({
            userId: user.id,
            type: "TERMS_PROMPT",
            title: title,
            message: message,
            actionLink: "/terms-of-service",
            actionText: "View Terms",
            fromAdminId: adminId
          }).catch(err => {
            console.error(`Failed to create terms notification for user #${user.id}:`, err);
          });
        });
      }).catch(err => {
        console.error(`Failed to get users with role ${targetUsers} for terms notifications:`, err);
      });
    }
  }

  // Log action
  console.log(`Terms of service prompt sent to ${targetUsers} users by admin #${adminId || 'system'}`);
}

export async function notifyAdminOrderUpdate(
  userId: number,
  orderId: number,
  status: string,
  adminId: number,
  message: string
) {
  if (!userId || !orderId) return;

  const payload = {
    orderId,
    status,
    adminId,
    message,
    timestamp: new Date()
  };

  // Notify the user about the admin update
  broadcastNotification(NotificationType.ADMIN_ORDER_UPDATE, payload, userId);

  // Also notify all other admins about this action
  broadcastToAdmins({
    type: NotificationType.ADMIN_ORDER_UPDATE,
    payload: {
      ...payload,
      targetUserId: userId,
      adminAction: true
    },
    timestamp: Date.now()
  });

  // Create persistent database notification
  try {
    if (storage) {
      const actionLink = `/orders/${orderId}`;
      const title = `Order #${orderId} Update`;

      await storage.createUserNotification({
        message,
        title,
        type: NotificationType.ADMIN_ORDER_UPDATE,
        userId: userId,
        fromUserId: adminId,
        actionLink,
        actionText: 'View Order'
      });
      console.log(`Created persistent notification for user ${userId} about order ${orderId}`);
    }
  } catch (error) {
    console.error('Failed to create persistent order notification:', error);
  }
}

/**
 * Broadcast a notification to a specific user
 */
function broadcastNotification(type: NotificationType, payload: any, targetUserId?: number) {
  if (!targetUserId) return;

  const message: WebSocketMessage = {
    type,
    payload,
    timestamp: Date.now()
  };

  const targetClients = clientsByUser.get(targetUserId) || [];

  targetClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      sendMessage(client, message);
    }
  });
}

/**
 * Broadcast a message to all admin clients
 */
function broadcastToAdmins(message: WebSocketMessage) {
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      sendMessage(client, message);
    }
  });
}

/**
 * Broadcast a message to all connected users
 */
function broadcastToAllUsers(message: WebSocketMessage) {
  // Send to all authenticated users
  for (const [userId, clients] of clientsByUser.entries()) {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendMessage(client, message);
      }
    });
  }
  
  // Also send to anonymous users if appropriate
  if (message.type === NotificationType.SYSTEM_NOTIFICATION || 
      message.type === NotificationType.TERMS_PROMPT) {
    anonymousClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendMessage(client, message);
      }
    });
  }
}

/**
 * Broadcast a message to all connected clients, including both authenticated and anonymous users
 * This is used for global notifications like stock updates
 */
function broadcastToAll(message: WebSocketMessage) {
  // Send to all authenticated users
  for (const [userId, clients] of clientsByUser.entries()) {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendMessage(client, message);
      }
    });
  }
  
  // Send to all anonymous users as well
  anonymousClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      sendMessage(client, message);
    }
  });
  
  // And make sure admins get it too
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      sendMessage(client, message);
    }
  });
}

/**
 * Handle a chat message from one user to another
 * @param senderId The user ID of the sender
 * @param recipientId The user ID of the recipient
 * @param content The message content
 * @param metadata Optional additional metadata about the message
 */
// Use our improved implementation from chat-fix.ts - removed duplicate import
// The import is already at the top of the file

// Chat functionality has been removed

// Chat functionality has been removed
// Function handleTypingIndicator has been removed

// Chat functionality has been removed
// Function handleReadReceipt has been removed

// Chat functionality has been removed
// Function handleGroupChatMessage has been removed

/**
 * Send a message to a specific client
 */
/**
 * Handle a follow request from one user to another
 * @param followerId The ID of the user initiating the follow
 * @param followedId The ID of the user being followed
 */
export function notifyFollowRequest(followerId: number, followedId: number) {
  if (!followerId || !followedId) return;
  
  // First get the follower info to include in the notification
  if (storage) {
    storage.getUser(followerId).then(follower => {
      if (!follower) {
        console.error(`Cannot find follower with ID ${followerId}`);
        return;
      }
      
      // Create persistent notification
      try {
        storage.createUserNotification({
          userId: followedId,
          type: "FOLLOW_REQUEST",
          title: "New Follower",
          message: `${follower.displayName || 'Someone'} started following you.`,
          actionLink: `/profile/${followerId}`,
          actionText: "View Profile"
        }).catch(err => {
          console.error(`Failed to create follow notification:`, err);
        });
      } catch (error) {
        console.error("Error creating follow notification:", error);
      }
    }).catch(err => {
      console.error(`Failed to get follower info:`, err);
    });
  }
}

/**
 * Notify the follower when their follow request is accepted
 * @param followerId The ID of the user who initiated the follow
 * @param followedId The ID of the user who accepted the follow request
 */
export function notifyFollowAccept(followerId: number, followedId: number) {
  if (!followerId || !followedId) return;
  
  // Get information about the user who accepted the follow request
  if (storage) {
    storage.getUser(followedId).then(followed => {
      if (!followed) {
        console.error(`Cannot find user with ID ${followedId}`);
        return;
      }
      
      // Create persistent notification
      try {
        storage.createUserNotification({
          userId: followerId,
          type: "FOLLOW_ACCEPT",
          title: "Follow Accepted",
          message: `${followed.displayName || 'Someone'} accepted your follow request.`,
          actionLink: `/profile/${followedId}`,
          actionText: "View Profile"
        }).catch(err => {
          console.error(`Failed to create follow acceptance notification:`, err);
        });
      } catch (error) {
        console.error("Error creating follow acceptance notification:", error);
      }
    }).catch(error => {
      console.error(`Error getting user ${followedId}:`, error);
    });
  }
}

/**
 * Placeholder for message handling functionality
 * Chat functionality has been removed from the application
 */

/**
 * Placeholder for conversation functionality
 * Chat functionality has been removed from the application
 */

/**
 * Send a message to a client with improved error handling and connection state checking
 */
function sendMessage(client: WebSocket, message: WebSocketMessage) {
  if (!client) {
    console.warn('Attempted to send message to null/undefined client');
    return;
  }
  
  if (client.readyState === WebSocket.OPEN) {
    try {
      // Generate a unique message ID if not present
      const messageWithId = {
        ...message,
        messageId: message.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
      };
      
      client.send(JSON.stringify(messageWithId));
    } catch (error) {
      console.error('Error sending message to client:', error);
      
      // Attempt to close the connection cleanly if we can't send messages
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1011, 'Error sending message');
        }
      } catch (closeError) {
        console.error('Error closing problematic WebSocket connection:', closeError);
      }
    }
  } else if (client.readyState === WebSocket.CLOSING) {
    console.log('Cannot send message - WebSocket is closing');
  } else if (client.readyState === WebSocket.CLOSED) {
    console.log('Cannot send message - WebSocket is closed');
  } else {
    console.log('Cannot send message - WebSocket is still connecting');
  }
}

/**
 * Send a custom notification to a specific user
 * @param userId User ID to send the notification to
 * @param type Notification type from NotificationType enum
 * @param data Any data to include in the notification payload
 */
/**
 * Notify admins about new content that has been reported for moderation
 * @param flag The content flag object 
 * @param reporter The user who reported the content (if available)
 */
export function notifyContentReported(
  flag: any,
  reporter?: any
) {
  if (!flag) return;
  
  const payload = {
    flagId: flag.id,
    contentType: flag.contentType,
    contentId: flag.contentId,
    reason: flag.reason,
    reporterId: flag.reporterId,
    reporterName: reporter?.displayName || 'Anonymous User',
    timestamp: flag.createdAt || new Date(),
    status: flag.status || 'pending'
  };
  
  // Send notification to all admins
  broadcastToAdmins({
    type: NotificationType.CONTENT_REPORTED,
    payload,
    timestamp: Date.now()
  });

  // Push to all admins (web + iOS) so they get notified even if dashboard is closed
  (async () => {
    try {
      const admins = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(inArray(usersTable.role, ['admin', 'super_admin', 'moderator']));
      const msg = `${payload.reporterName} reported ${flag.contentType} #${flag.contentId}: ${payload.reason || 'no reason'}`;
      await Promise.allSettled(
        admins.map(a => {
          // persist in-app notification
          storage.createUserNotification({
            userId: a.id,
            type: 'content_reported',
            title: '🚩 New content report',
            message: msg,
            targetId: flag.contentId,
            targetType: flag.contentType,
            actionLink: `/admin/moderation`,
          }).catch(() => {});
          return sendPushToUser(a.id, {
            title: '🚩 New content report',
            body: msg,
            url: '/admin/moderation',
            data: { type: 'content_reported', flagId: String(flag.id), contentType: String(flag.contentType), contentId: String(flag.contentId) },
          });
        })
      );
    } catch (err) {
      console.error('[Push] content_reported admin push failed:', err);
    }
  })();
  
  console.log(`Sent content moderation notification to admins for ${flag.contentType} #${flag.contentId}`);
}

/**
 * Notify users and admins about a content moderation action
 * @param flag The content flag that was reviewed
 * @param reviewerId The ID of the admin who reviewed the flag
 * @param action The action taken ('approved' or 'rejected')
 */
export function notifyContentModerationAction(
  flag: any,
  reviewerId: number,
  action: 'approved' | 'rejected'
) {
  if (!flag) return;
  
  const payload = {
    flagId: flag.id,
    contentType: flag.contentType,
    contentId: flag.contentId,
    reviewerId: reviewerId,
    action: action,
    timestamp: new Date(),
    notes: flag.reviewNotes || ''
  };
  
  // Notify the reporter if available
  if (flag.reporterId) {
    broadcastNotification(NotificationType.CONTENT_MODERATION, {
      ...payload,
      message: action === 'approved' 
        ? `Your report about ${flag.contentType} #${flag.contentId} has been reviewed and action has been taken.` 
        : `Your report about ${flag.contentType} #${flag.contentId} has been reviewed but no action was needed.`
    }, flag.reporterId);
  }
  
  // Notify all admins
  broadcastToAdmins({
    type: NotificationType.CONTENT_MODERATION,
    payload,
    timestamp: Date.now()
  });
  
  console.log(`Sent content moderation action notification for ${flag.contentType} #${flag.contentId}, action: ${action}`);
}



/**
 * Notify a user when their comment has been deleted
 * @param userId The user ID of the comment owner
 * @param commentId The ID of the deleted comment
 * @param reason The reason for deletion (optional)
 * @param deletedByAdmin Whether it was deleted by an admin
 */
/**
 * Notify when a user likes a post
 * @param postId ID of the post that was liked
 * @param likedByUserId ID of the user who liked the post
 * @param postOwnerId ID of the post owner to notify
 */
export function notifyPostLike(postId: number, likedByUserId: number, postOwnerId: number) {
  if (!postId || !likedByUserId || !postOwnerId) return;
  
  // Don't notify users of their own actions
  if (likedByUserId === postOwnerId) return;
  
  // Get user info to show in notification
  storage.getUser(likedByUserId).then(user => {
    if (!user) return;
    
    const payload = {
      postId,
      likedByUserId,
      likedByUserName: user.displayName || 'Someone',
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} liked your post`,
      actionLink: `/community/post/${postId}`
    };
    
    // Send real-time notification via WebSocket
    broadcastNotification(NotificationType.POST_LIKE, payload, postOwnerId);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: postOwnerId,
      type: 'social_like',
      title: 'New Like',
      message: payload.message,
      targetId: postId,
      targetType: 'post',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error('Failed to create like notification:', err);
    });

    // Push notification (web + iOS WTN + android)
    sendPushToUser(postOwnerId, {
      title: 'New like ❤️',
      body: payload.message,
      icon: user.profilePicture || '/logo.jpg',
      url: payload.actionLink,
      data: { type: 'post_like', postId: String(postId), fromUserId: String(likedByUserId) },
    }).catch(err => console.error('[Push] post_like failed:', err));
  }).catch(err => {
    console.error('Failed to get user info for like notification:', err);
  });
}

/**
 * Notify when a user comments on a post
 * @param postId ID of the post that was commented on
 * @param commentId ID of the new comment
 * @param commentedByUserId ID of the user who commented
 * @param postOwnerId ID of the post owner to notify
 * @param commentContent The content of the comment (truncated if needed)
 */
export function notifyPostComment(
  postId: number, 
  commentId: number, 
  commentedByUserId: number, 
  postOwnerId: number,
  commentContent?: string
) {
  if (!postId || !commentId || !commentedByUserId || !postOwnerId) return;
  
  // Don't notify users of their own actions
  if (commentedByUserId === postOwnerId) return;
  
  // Get user info to show in notification
  storage.getUser(commentedByUserId).then(user => {
    if (!user) return;
    
    // Truncate comment content if provided and too long
    let truncatedContent = '';
    if (commentContent) {
      truncatedContent = commentContent.length > 50 
        ? `${commentContent.substring(0, 47)}...` 
        : commentContent;
    }
    
    const payload = {
      postId,
      commentId,
      commentedByUserId,
      commentedByUserName: user.displayName || 'Someone',
      commentContent: truncatedContent,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} commented on your post${truncatedContent ? `: "${truncatedContent}"` : ''}`,
      actionLink: `/community/post/${postId}#comment-${commentId}`
    };
    
    // Send real-time notification via WebSocket
    broadcastNotification(NotificationType.POST_COMMENT, payload, postOwnerId);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: postOwnerId,
      type: NotificationType.POST_COMMENT.toLowerCase(),
      title: 'New Comment',
      message: payload.message,
      targetId: postId,
      targetType: 'post',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error('Failed to create comment notification:', err);
    });

    sendPushToUser(postOwnerId, {
      title: 'New comment 💬',
      body: payload.message,
      icon: user.profilePicture || '/logo.jpg',
      url: payload.actionLink,
      data: { type: 'post_comment', postId: String(postId), commentId: String(commentId), fromUserId: String(commentedByUserId) },
    }).catch(err => console.error('[Push] post_comment failed:', err));
  }).catch(err => {
    console.error('Failed to get user info for comment notification:', err);
  });
}

/**
 * Notify when a user books an event ticket
 * @param userId ID of the user who booked the event
 * @param event The event that was booked
 * @param ticketId ID of the ticket that was created
 * @param organizerId ID of the event organizer to notify
 * @param ticketQuantity Number of tickets purchased
 */
export function notifyEventBooked(
  userId: number,
  event: any,
  ticketId: number,
  organizerId: number,
  ticketQuantity: number = 1
) {
  if (!userId || !event || !ticketId || !organizerId) return;
  
  // Don't notify if the user booked their own event
  if (userId === organizerId) return;
  
  // Get user info to show in notification
  storage.getUser(userId).then(user => {
    if (!user) return;
    
    const payload = {
      eventId: event.id,
      ticketId,
      ticketQuantity,
      userId,
      userName: user.displayName || 'Someone',
      eventTitle: event.title,
      eventDate: event.date,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} booked ${ticketQuantity > 1 ? ticketQuantity + ' tickets' : 'a ticket'} for your event "${event.title}"`,
      actionLink: `/events/${event.id}/tickets`
    };
    
    // Send real-time notification via WebSocket to the organizer
    broadcastNotification(NotificationType.EVENT_BOOKED, payload, organizerId);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: organizerId,
      type: NotificationType.EVENT_BOOKED.toLowerCase(),
      title: 'New Event Booking',
      message: payload.message,
      targetId: event.id,
      targetType: 'event',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error('Failed to create event booking notification:', err);
    });

    sendPushToUser(organizerId, {
      title: '🎟️ New event booking',
      body: payload.message,
      url: payload.actionLink,
      data: { type: 'event_booked', eventId: String(event.id), ticketId: String(ticketId) },
    }).catch(err => console.error('[Push] event_booked organizer failed:', err));
    
    // Also send a confirmation notification to the user who booked
    const userPayload = {
      eventId: event.id,
      ticketId,
      ticketQuantity,
      eventTitle: event.title,
      eventDate: event.date,
      timestamp: new Date(),
      message: `You have successfully booked ${ticketQuantity > 1 ? ticketQuantity + ' tickets' : 'a ticket'} for "${event.title}"`,
      actionLink: `/events/${event.id}/my-tickets/${ticketId}`
    };
    
    broadcastNotification(NotificationType.EVENT_BOOKED, userPayload, userId);
    
    // Create persistent notification for the user
    storage.createUserNotification({
      userId,
      type: NotificationType.EVENT_BOOKED.toLowerCase(),
      title: 'Event Booking Confirmed',
      message: userPayload.message,
      targetId: event.id,
      targetType: 'event',
      actionLink: userPayload.actionLink
    }).catch(err => {
      console.error('Failed to create user booking confirmation notification:', err);
    });

    sendPushToUser(userId, {
      title: '✅ Booking confirmed',
      body: userPayload.message,
      url: userPayload.actionLink,
      data: { type: 'event_booking_confirmed', eventId: String(event.id), ticketId: String(ticketId) },
    }).catch(err => console.error('[Push] event_booked confirm failed:', err));
  }).catch(err => {
    console.error('Failed to get user info for event booking notification:', err);
  });
}

/**
 * Notify event organizer when a user RSVPs to their event
 * @param userId User ID who RSVPed to the event
 * @param eventId ID of the event
 * @param organizerId ID of the event organizer to notify
 * @param status RSVP status (going, maybe, not going)
 */
export function notifyEventRsvp(
  userId: number,
  eventId: number,
  organizerId: number,
  status: string
) {
  if (!userId || !eventId || !organizerId) return;
  
  // Don't notify if the user RSVPed to their own event
  if (userId === organizerId) return;
  
  // Get user info and event info
  Promise.all([
    storage.getUser(userId),
    storage.getEvent(eventId)
  ]).then(([user, event]) => {
    if (!user || !event) return;
    
    let statusText = 'is interested in';
    if (status === 'going') {
      statusText = 'is going to';
    } else if (status === 'maybe') {
      statusText = 'might attend';
    } else if (status === 'not going') {
      statusText = 'declined';
    }
    
    const payload = {
      eventId,
      userId,
      userName: user.displayName || 'Someone',
      eventTitle: event.title,
      status,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} ${statusText} your event "${event.title}"`,
      actionLink: `/events/${eventId}`
    };
    
    // Send real-time notification via WebSocket to the organizer
    broadcastNotification(NotificationType.EVENT_RSVP, payload, organizerId);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: organizerId,
      type: NotificationType.EVENT_RSVP.toLowerCase(),
      title: 'New Event RSVP',
      message: payload.message,
      targetId: eventId,
      targetType: 'event',
      actionLink: `/events/${eventId}`
    }).catch(err => {
      console.error('Failed to create event RSVP notification:', err);
    });

    sendPushToUser(organizerId, {
      title: '👥 New event RSVP',
      body: payload.message,
      icon: user.profilePicture || '/logo.jpg',
      url: `/events/${eventId}`,
      data: { type: 'event_rsvp', eventId: String(eventId), status, fromUserId: String(userId) },
    }).catch(err => console.error('[Push] event_rsvp failed:', err));
  }).catch(err => {
    console.error('Failed to get information for event RSVP notification:', err);
  });
}

/**
 * Send reminder notifications for upcoming events
 * @param event The event to send reminders for
 * @param ticketUsers List of users who have tickets
 * @param daysUntilEvent Number of days until the event
 */
export function notifyEventReminder(
  event: any,
  ticketUsers: any[],
  daysUntilEvent: number
) {
  if (!event || !ticketUsers || ticketUsers.length === 0) return;
  
  // Prepare the reminder message based on how many days until the event
  let reminderTitle = '';
  let reminderMessage = '';
  
  if (daysUntilEvent === 0) {
    reminderTitle = 'Event Today!';
    reminderMessage = `"${event.title}" is happening today!`;
  } else if (daysUntilEvent === 1) {
    reminderTitle = 'Event Tomorrow';
    reminderMessage = `"${event.title}" is happening tomorrow!`;
  } else {
    reminderTitle = 'Upcoming Event';
    reminderMessage = `"${event.title}" is happening in ${daysUntilEvent} days.`;
  }
  
  // Send reminders to all users with tickets
  ticketUsers.forEach(user => {
    if (!user.id) return;
    
    const payload = {
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      daysUntilEvent,
      timestamp: new Date(),
      message: reminderMessage,
      actionLink: `/events/${event.id}/my-tickets`
    };
    
    // Send real-time notification via WebSocket
    broadcastNotification(NotificationType.EVENT_REMINDER, payload, user.id);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: user.id,
      type: NotificationType.EVENT_REMINDER.toLowerCase(),
      title: reminderTitle,
      message: reminderMessage,
      targetId: event.id,
      targetType: 'event',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error(`Failed to create event reminder notification for user ${user.id}:`, err);
    });

    sendPushToUser(user.id, {
      title: `⏰ ${reminderTitle}`,
      body: reminderMessage,
      url: payload.actionLink,
      data: { type: 'event_reminder', eventId: String(event.id), daysUntilEvent: String(daysUntilEvent) },
    }).catch(err => console.error('[Push] event_reminder failed:', err));
  });
  
  console.log(`Sent event reminders to ${ticketUsers.length} users for event "${event.title}" (${daysUntilEvent} days until event)`);
}

/**
 * Notify users when an event is cancelled
 * @param event The event that was cancelled
 * @param ticketUsers List of users who have tickets
 * @param reason The reason for cancellation (optional)
 */
export function notifyEventCancelled(
  event: any,
  ticketUsers: any[],
  reason?: string
) {
  if (!event || !ticketUsers || ticketUsers.length === 0) return;
  
  const cancellationMessage = reason 
    ? `Event "${event.title}" has been cancelled. Reason: ${reason}`
    : `Event "${event.title}" has been cancelled.`;
  
  // Send cancellation notifications to all ticket holders
  ticketUsers.forEach(user => {
    if (!user.id) return;
    
    const payload = {
      eventId: event.id,
      eventTitle: event.title,
      reason,
      timestamp: new Date(),
      message: cancellationMessage,
      actionLink: `/events/cancelled/${event.id}`
    };
    
    // Send real-time notification via WebSocket
    broadcastNotification(NotificationType.EVENT_CANCELLED, payload, user.id);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: user.id,
      type: NotificationType.EVENT_CANCELLED.toLowerCase(),
      title: 'Event Cancelled',
      message: cancellationMessage,
      targetId: event.id,
      targetType: 'event',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error(`Failed to create event cancellation notification for user ${user.id}:`, err);
    });
  });
  
  console.log(`Sent event cancellation notifications to ${ticketUsers.length} users for event "${event.title}"`);
}

/**
 * Notify when a user replies to a comment
 * @param postId ID of the post containing the comment
 * @param parentCommentId ID of the comment being replied to
 * @param replyId ID of the reply comment
 * @param repliedByUserId ID of the user who replied
 * @param commentOwnerId ID of the comment owner to notify
 * @param replyContent The content of the reply (truncated if needed)
 */
export function notifyCommentReply(
  postId: number,
  parentCommentId: number,
  replyId: number,
  repliedByUserId: number,
  commentOwnerId: number,
  replyContent?: string
) {
  if (!postId || !parentCommentId || !replyId || !repliedByUserId || !commentOwnerId) return;
  
  // Don't notify users of their own actions
  if (repliedByUserId === commentOwnerId) return;
  
  // Get user info to show in notification
  storage.getUser(repliedByUserId).then(user => {
    if (!user) return;
    
    // Truncate reply content if provided and too long
    let truncatedContent = '';
    if (replyContent) {
      truncatedContent = replyContent.length > 50 
        ? `${replyContent.substring(0, 47)}...` 
        : replyContent;
    }
    
    const payload = {
      postId,
      parentCommentId,
      replyId,
      repliedByUserId,
      repliedByUserName: user.displayName || 'Someone',
      replyContent: truncatedContent,
      timestamp: new Date(),
      message: `${user.displayName || 'Someone'} replied to your comment${truncatedContent ? `: "${truncatedContent}"` : ''}`,
      actionLink: `/community/post/${postId}#comment-${replyId}`
    };
    
    // Send real-time notification via WebSocket
    broadcastNotification(NotificationType.COMMENT_REPLY, payload, commentOwnerId);
    
    // Also create a persistent notification in the database
    storage.createUserNotification({
      userId: commentOwnerId,
      type: NotificationType.COMMENT_REPLY.toLowerCase(),
      title: 'New Reply',
      message: payload.message,
      targetId: postId,
      targetType: 'comment',
      actionLink: payload.actionLink
    }).catch(err => {
      console.error('Failed to create reply notification:', err);
    });

    sendPushToUser(commentOwnerId, {
      title: 'New reply 💬',
      body: payload.message,
      icon: user.profilePicture || '/logo.jpg',
      url: payload.actionLink,
      data: { type: 'comment_reply', postId: String(postId), commentId: String(parentCommentId), replyId: String(replyId), fromUserId: String(repliedByUserId) },
    }).catch(err => console.error('[Push] comment_reply failed:', err));
  }).catch(err => {
    console.error('Failed to get user info for reply notification:', err);
  });
}

export function notifyCommentDeleted(userId: number, commentId: number, reason?: string, deletedByAdmin: boolean = false) {
  if (!userId || !commentId) return;
  
  const payload = {
    commentId,
    reason: reason || "This comment violated our community guidelines.",
    deletedByAdmin,
    timestamp: new Date()
  };
  
  // Send real-time WebSocket notification to the user
  broadcastNotification(NotificationType.CONTENT_MODERATION, {
    ...payload,
    contentType: 'comment',
    action: 'deleted',
    message: deletedByAdmin 
      ? `Your comment has been removed by a moderator for violating community guidelines.` 
      : `Your comment has been deleted.`
  }, userId);
  
  // Create persistent notification in database
  try {
    if (storage) {
      storage.createUserNotification({
        userId,
        type: NotificationType.CONTENT_MODERATION.toLowerCase(),
        title: "Comment Removed",
        message: deletedByAdmin 
          ? `Your comment has been removed by a moderator for violating community guidelines.` 
          : `Your comment has been deleted.`
      }).catch(err => {
        console.error(`Failed to create comment deletion notification:`, err);
      });
    }
  } catch (error) {
    console.error("Error creating comment deletion notification:", error);
  }
  
  console.log(`Sent comment deletion notification to user ${userId} for comment ${commentId}`);
}

/**
 * Notify clients about updates to explore page images
 * This sends real-time updates to admins and anonymous browsers
 * @param section The section of explore images that was updated
 * @param action The action performed (add, update, delete, reorder)
 * @param adminId The ID of the admin who made the change
 */
export function notifyExploreImageUpdate(
  section: string,
  action: 'add' | 'update' | 'delete' | 'reorder',
  adminId?: number
) {
  try {
    // Create notification payload with unique timestamp to prevent caching
    const currentTimestamp = Date.now();
    const payload = {
      section,
      action,
      adminId: adminId || null,
      timestamp: currentTimestamp,
      hasImages: action !== 'delete', // Indicate whether there are still images in this section
      cacheBreaker: Math.random().toString(36).substring(2, 15) // Add random string to force cache invalidation
    };

    // Log the notification being sent
    console.log(`Sending explore image update notification: ${action} in section ${section} at ${new Date(currentTimestamp).toISOString()}`);

    // Prepare the message once
    const message = {
      type: NotificationType.EXPLORE_IMAGE_UPDATE,
      payload,
      timestamp: currentTimestamp
    };

    // Send to all admins
    let adminCount = 0;
    adminClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendMessage(client, message);
        adminCount++;
      }
    });
    console.log(`Sent explore image update to ${adminCount} admin clients`);

    // Send to all anonymous clients (for public viewing of the explore page)
    let anonCount = 0;
    anonymousClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        sendMessage(client, message);
        anonCount++;
      }
    });
    console.log(`Sent explore image update to ${anonCount} anonymous clients`);

    // Send to all authenticated users (who might be browsing the explore page)
    let userCount = 0;
    clientsByUser.forEach((clients, userId) => {
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          sendMessage(client, message);
          userCount++;
        }
      });
    });
    console.log(`Sent explore image update to ${userCount} authenticated user clients`);
    
    // Send a follow-up broadcast after a short delay to ensure all clients receive it
    setTimeout(() => {
      console.log(`Sending delayed follow-up explore image update notification`);
      broadcastToAllUsers({
        type: NotificationType.EXPLORE_IMAGE_UPDATE,
        payload: {
          ...payload,
          timestamp: Date.now(), // Update timestamp for the delayed message
          isFollowUp: true
        },
        timestamp: Date.now()
      });
    }, 1000);
  } catch (error) {
    console.error('Error sending explore image update notification:', error);
  }
}

export function notifyUserWithData(
  userId: number,
  type: NotificationType,
  data: any
) {
  if (!userId) return;

  const payload = {
    ...data,
    timestamp: data.timestamp || new Date()
  };

  broadcastNotification(type, payload, userId);
}

/**
 * Broadcast a table tennis score update to every connected client (authenticated + anonymous).
 * Called each time the umpire taps a point or undoes a point.
 */
export function notifyTTScoreUpdate(payload: {
  eventId: number;
  categoryId: number;
  matchupId: number;
  liveScoreA: number;
  liveScoreB: number;
  gamesA: number;
  gamesB: number;
  sets: { a: number; b: number }[];
  currentSetLog: string[];
  pointLog: string[];
  status: string;
  winnerRegistrationId: number | null;
}) {
  broadcastToAll({
    type: NotificationType.TT_SCORE_UPDATE,
    payload,
    timestamp: Date.now()
  });
}

/**
 * Handle a new chat message from a client
 * This function creates a new chat message in the database and sends it to recipients
 */
async function handleChatMessage(ws: ExtendedWebSocket, data: any) {
  if (!ws.userId || !data.conversationId || !data.content) {
    console.error("Invalid chat message data:", data);
    return;
  }

  try {
    // Start several operations in parallel to reduce latency
    
    // 1. First, send an immediate acknowledgment to the sender that we received the message
    // This gives instant feedback even before database operations complete
    if (data.tempId) {
      sendMessage(ws, {
        type: 'chat_message_ack',
        payload: {
          tempId: data.tempId,
          conversationId: data.conversationId,
          status: 'received',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });
    }
    
    // 2. Start the database operations in parallel
    // All these promises will run concurrently
    const [message, participants, sender] = await Promise.all([
      // Save message to database
      storage.createChatMessage({
        conversationId: data.conversationId,
        senderId: ws.userId,
        content: data.content,
        contentType: data.contentType || 'text',
        metadata: data.metadata || null
      }),
      
      // Get conversation participants
      storage.getChatParticipants(data.conversationId),
      
      // Get sender information
      storage.getUser(ws.userId)
    ]);

    if (!message) {
      console.error("Failed to create chat message");
      return;
    }

    if (!participants || participants.length === 0) {
      console.error(`No participants found for conversation ${data.conversationId}`);
      return;
    }

    if (!sender) {
      console.error(`Sender user ${ws.userId} not found`);
      return;
    }

    // Create message payload first so it can be sent while other updates happen
    const messagePayload = {
      id: message.id,
      tempId: data.tempId, // Include tempId for client-side correlation
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: sender.displayName,
      senderProfilePic: sender.profilePicture,
      content: message.content,
      contentType: message.contentType || 'text',
      metadata: message.metadata,
      timestamp: message.createdAt,
      isDelivered: false,
      isRead: false
    };
    
    // 3. Immediately broadcast to recipients for real-time experience
    // Don't wait for delivery status creation before sending the message
    const recipientIds = participants
      .filter(participant => participant.userId !== ws.userId)
      .map(participant => participant.userId);
      
    // Broadcast to all recipients simultaneously
    const onlineIds = new Set(getOnlineUserIds());
    recipientIds.forEach(recipientId => {
      broadcastNotification(
        NotificationType.CHAT_MESSAGE,
        messagePayload,
        recipientId
      );
      // If recipient is offline, send a push notification
      if (!onlineIds.has(recipientId)) {
        const previewText = data.contentType === 'voice'
          ? '🎤 Voice message'
          : (data.content?.length > 60 ? data.content.slice(0, 57) + '...' : data.content);
        sendPushToUser(recipientId, {
          title: sender.displayName || 'New message',
          body: previewText,
          icon: sender.profilePicture || '/logo.jpg',
          conversationId: data.conversationId,
          url: `/chat?conversation=${data.conversationId}`,
          data: { conversationId: String(data.conversationId) },
        }).catch(err => console.error('[Push] chat push failed:', err));
      }
    });

    // 4. Send confirmation back to sender immediately
    sendMessage(ws, {
      type: NotificationType.CHAT_MESSAGE,
      payload: {
        ...messagePayload,
        isSender: true
      },
      timestamp: Date.now()
    });

    // 5. Handle database updates in the background
    // These operations don't need to block the message delivery
    
    // Start all the background tasks in parallel
    Promise.all([
      // Create delivery status records for all participants
      Promise.all(
        participants
          .filter(participant => participant.userId !== ws.userId)
          .map(participant => 
            storage.createMessageDelivery({
              messageId: message.id,
              userId: participant.userId,
              isDelivered: false,
              isRead: false,
              deliveredAt: null,
              readAt: null
            })
          )
      ),
      
      // Update the conversation's last message and activity
      storage.updateChatConversation(data.conversationId, {
        lastMessageId: message.id,
        lastActivity: new Date()
      })
    ]).catch(err => {
      console.error("Error in background chat message processing:", err);
    });

    console.log(`Chat message sent from ${ws.userId} to conversation ${data.conversationId}`);
  } catch (error) {
    console.error("Error handling chat message:", error);
    
    // Send error back to sender
    if (data.tempId) {
      sendMessage(ws, {
        type: 'chat_message_error',
        payload: {
          tempId: data.tempId,
          conversationId: data.conversationId,
          error: "Failed to process message"
        },
        timestamp: Date.now()
      });
    }
  }
}

/**
 * Handle typing indicators
 */
/**
 * Handle message delivery status updates
 */
function handleMessageDelivered(ws: ExtendedWebSocket, data: any) {
  const messageId = data.messageId ?? data.payload?.messageId;
  const conversationId = data.conversationId ?? data.payload?.conversationId;
  if (!ws.userId || !messageId || !conversationId) {
    console.error("Invalid message delivery data", data);
    return;
  }
  data = { ...data, messageId, conversationId };
  
  try {
    console.log(`Processing message delivery: Message ${data.messageId} delivered to user ${ws.userId}`);
    
    // Update message delivery status in database
    storage.updateMessageDeliveryStatus(data.messageId, ws.userId, {
      status: 'delivered',
      deliveredAt: new Date()
    }).then(() => {
      // Get the message to determine the sender
      storage.getChatMessage(data.messageId).then(message => {
        if (!message) {
          console.error(`Message ${data.messageId} not found`);
          return;
        }
        
        console.log(`Sending delivery confirmation for message ${data.messageId} to sender ${message.senderId}`);
        
        // Notify the sender that the message was delivered
        const deliveryPayload = {
          messageId: data.messageId,
          conversationId: data.conversationId,
          deliveredBy: ws.userId,
          deliveredAt: new Date().toISOString()
        };
        
        // Send to the message sender
        broadcastNotification(
          NotificationType.CHAT_MESSAGE_DELIVERED,
          deliveryPayload,
          message.senderId
        );
        
        // Send ACK back to the client who reported delivery
        sendMessage(ws, {
          type: 'delivery_ack',
          payload: {
            messageId: data.messageId,
            status: 'delivered',
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      });
    });
  } catch (error) {
    console.error("Error handling message delivery:", error);
  }
}

/**
 * Handle message seen/read status updates
 */
function handleMessageSeen(ws: ExtendedWebSocket, data: any) {
  if (!ws.userId || !data.messageId || !data.conversationId) {
    console.error("Invalid message seen data", data);
    return;
  }
  
  try {
    // Update message seen status in database
    storage.updateMessageDeliveryStatus(data.messageId, ws.userId, {
      status: 'read',
      readAt: new Date()
    }).then(() => {
      // Get the message to determine the sender
      storage.getChatMessage(data.messageId).then(message => {
        if (!message) return;
        
        // Notify the sender that the message was seen
        const seenPayload = {
          messageId: data.messageId,
          conversationId: data.conversationId,
          seenBy: ws.userId,
          seenAt: new Date().toISOString()
        };
        
        // Send to the message sender
        broadcastNotification(
          NotificationType.CHAT_MESSAGE_READ,
          seenPayload,
          message.senderId
        );
      });
    });
  } catch (error) {
    console.error("Error handling message seen status:", error);
  }
}

/**
 * Handle user presence updates (online, offline, away)
 */
function handlePresenceUpdate(ws: ExtendedWebSocket, data: any, presenceType: string) {
  if (!ws.userId) return;
  
  try {
    // Get user's conversations to notify participants
    storage.getUserConversations(ws.userId).then(conversations => {
      if (!conversations || conversations.length === 0) return;
      
      // For each conversation, notify the other participants
      conversations.forEach(async (conversation) => {
        // Get all participants except the current user
        const participants = await storage.getChatParticipants(conversation.id);
        if (!participants || participants.length === 0) return;
        
        // Create presence payload
        const presencePayload = {
          userId: ws.userId,
          status: presenceType === 'user_online' ? 'online' : 
                presenceType === 'user_away' ? 'away' : 'offline',
          conversationId: conversation.id,
          lastSeen: presenceType === 'user_offline' ? new Date().toISOString() : null
        };
        
        // Broadcast to all other participants
        participants.forEach(participant => {
          if (participant.userId !== ws.userId) {
            broadcastNotification(
              NotificationType.CHAT_PRESENCE_UPDATE,
              presencePayload,
              participant.userId
            );
          }
        });
      });
    });
  } catch (error) {
    console.error("Error handling presence update:", error);
  }
}

function handleChatTyping(ws: ExtendedWebSocket, conversationId: number, isTyping: boolean) {
  if (!ws.userId || !conversationId) return;

  // Get username from socket to display "User is typing..."
  const username = ws.username;
  
  const notificationType = isTyping 
    ? NotificationType.CHAT_TYPING 
    : NotificationType.CHAT_STOPPED_TYPING;
  
  const payload = {
    conversationId,
    userId: ws.userId,
    username: username || "A user"
  };

  // Send typing indicator to all conversation participants except sender
  try {
    storage.getChatParticipants(conversationId).then(participants => {
      if (!participants) return;
      
      participants.forEach(participant => {
        if (participant.userId !== ws.userId) {
          broadcastNotification(notificationType, payload, participant.userId);
        }
      });
    });
  } catch (error) {
    console.error("Error broadcasting typing indicator:", error);
  }
}

/**
 * Mark a message as read
 */
async function markMessageAsRead(userId: number, messageId: number, conversationId: number) {
  if (!userId || !messageId) return;

  try {
    // Update delivery status in database
    await storage.updateMessageDeliveryStatus(messageId, userId, {
      status: 'read',
      readAt: new Date()
    });

    // Get the original message to notify the sender
    const message = await storage.getChatMessage(messageId);
    
    if (!message) {
      console.error(`Message ${messageId} not found`);
      return;
    }

    // Only notify if the reader is not the sender
    if (message.senderId !== userId) {
      const readPayload = {
        messageId,
        conversationId,
        readerId: userId,
        timestamp: new Date()
      };

      // Notify sender that message was read
      broadcastNotification(
        NotificationType.CHAT_MESSAGE_READ,
        readPayload,
        message.senderId
      );
    }
  } catch (error) {
    console.error("Error marking message as read:", error);
  }
}

/**
 * Mark multiple messages as read in a batch operation
 * This improves performance by reducing the number of database operations
 */
async function markMessagesReadBatch(userId: number, messageIds: number[], conversationId: number) {
  if (!userId || !messageIds || messageIds.length === 0) return;

  try {
    // Track which senders need to be notified about read messages
    const senderNotifications = new Map<number, number[]>();
    
    // Process messages in batch
    for (const messageId of messageIds) {
      // Update delivery status in database for each message
      await storage.updateMessageDeliveryStatus(messageId, userId, {
        status: 'read',
        readAt: new Date()
      });

      // Get message details to determine the sender
      const message = await storage.getChatMessage(messageId);
      if (!message) continue;
      
      // Only track notifications if the reader is not the sender
      if (message.senderId !== userId) {
        // Group message IDs by sender for efficient notification
        if (!senderNotifications.has(message.senderId)) {
          senderNotifications.set(message.senderId, []);
        }
        senderNotifications.get(message.senderId)?.push(messageId);
      }
    }
    
    // Send batch read notifications to each sender
    for (const [senderId, readMessageIds] of senderNotifications.entries()) {
      const batchReadPayload = {
        messageIds: readMessageIds,
        conversationId,
        readerId: userId,
        timestamp: new Date()
      };
      
      // Notify sender about all their messages that were read
      broadcastNotification(
        NotificationType.CHAT_MESSAGES_READ_BATCH,
        batchReadPayload,
        senderId
      );
    }
  } catch (error) {
    console.error("Error in batch marking messages as read:", error);
  }
}

/**
 * Create a new conversation
 */
async function createConversation(ws: ExtendedWebSocket, data: any) {
  if (!ws.userId || !data.participants || data.participants.length === 0) {
    console.error("Invalid conversation data:", data);
    return;
  }

  try {
    // Ensure creator is included in participants
    const participantIds = data.participants.includes(ws.userId) 
      ? data.participants 
      : [...data.participants, ws.userId];
    
    // For direct chats, we only need two participants
    if (participantIds.length === 2) {
      // Check if a direct conversation already exists between these two users
      const existingConversation = await storage.findDirectConversation(
        participantIds[0], 
        participantIds[1]
      );
      
      if (existingConversation) {
        // Return the existing conversation instead of creating a new one
        const participants = await storage.getChatParticipants(existingConversation.id);
        
        const payload = {
          conversation: {
            ...existingConversation,
            participants: participants
          },
          createdBy: ws.userId,
          isExisting: true
        };
        
        sendMessage(ws, {
          type: NotificationType.CHAT_CONVERSATION_CREATED,
          payload,
          timestamp: Date.now()
        });
        
        console.log(`Returning existing conversation between ${participantIds[0]} and ${participantIds[1]}`);
        return;
      }
    }
    
    // Create the conversation
    const isGroupChat = participantIds.length > 2;
    const conversation = await storage.createChatConversation({
      status: "active",
      participantOneId: participantIds[0],
      participantTwoId: participantIds.length > 1 ? participantIds[1] : null,
      createdBy: ws.userId,
      title: data.title || null,
      lastActivity: new Date()
    });

    if (!conversation) {
      console.error("Failed to create conversation");
      return;
    }

    // Add participants to the conversation
    for (const participantId of participantIds) {
      await storage.createChatParticipant({
        conversationId: conversation.id,
        userId: participantId,
        isAdmin: participantId === ws.userId, // Creator is admin
        nickname: null,
        isMuted: false
      });
    }

    // Get the full participant list with user details  
    const participants = await storage.getChatParticipants(conversation.id);
    const participantsWithDetails = await Promise.all(
      participants.map(async (p) => {
        const user = await storage.getUser(p.userId);
        return {
          ...p,
          displayName: user?.displayName,
          profilePicture: user?.profilePicture
        };
      })
    );

    // Create system message if it's a group chat
    if (isGroupChat) {
      const creator = await storage.getUser(ws.userId);
      
      if (creator) {
        await storage.createChatMessage({
          conversationId: conversation.id,
          senderId: null, // System message
          content: `${creator.displayName} created this group`,
          contentType: 'system',
          metadata: null
        });
      }
    }

    // Send notification to all participants
    const payload = {
      conversation: {
        ...conversation,
        participants: participantsWithDetails,
        isGroupChat
      },
      createdBy: ws.userId
    };

    // Notify all participants about the new conversation
    participantIds.forEach(participantId => {
      if (participantId !== ws.userId) { // Skip creator
        broadcastNotification(
          NotificationType.CHAT_CONVERSATION_CREATED,
          payload,
          participantId
        );
      }
    });

    // Send confirmation to creator
    sendMessage(ws, {
      type: NotificationType.CHAT_CONVERSATION_CREATED,
      payload,
      timestamp: Date.now()
    });

    console.log(`New conversation created by ${ws.userId} with participants ${participantIds.join(', ')}`);
  } catch (error) {
    console.error("Error creating conversation:", error);
  }
}