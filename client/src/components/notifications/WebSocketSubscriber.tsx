import React, { useEffect, useRef } from 'react';
import { useWebSocket, MessageType } from '@/contexts/WebSocketSingletonContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A component that subscribes to WebSocket notifications and dispatches 
 * events for different notification types to be handled by the application.
 * This component doesn't render anything - it just handles the subscription logic.
 */
const WebSocketSubscriber: React.FC = () => {
  const { subscribe } = useWebSocket();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const notifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidateNotifications = () => {
    if (notifDebounceRef.current) clearTimeout(notifDebounceRef.current);
    notifDebounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    }, 800);
  };

  useEffect(() => {
    if (!user) return;

    // Subscribe to WebSocket messages
    const unsubscribe = subscribe((message) => {
      console.log('[NOTIFICATION] WebSocket message received:', message.type, message.payload);
      
      // Handle any message type containing "_notification"
      if (typeof message.type === 'string' && 
          (message.type.toLowerCase().includes('notification') || 
           message.type.toLowerCase().includes('like') ||
           message.type.toLowerCase().includes('comment'))) {
        console.log('[NOTIFICATION] Processing notification message:', message.type);
      }
      
      // Handle different message types
      switch (message.type) {
        // Social notifications
        case MessageType.LIKE_NOTIFICATION:
        case 'like_notification':  // Handle both enum and string versions
          console.log('[NOTIFICATION] Processing like notification');
          dispatchCustomEvent('notification:social', {
            type: 'like',
            title: 'New Like',
            message: message.payload?.message || 'Someone liked your content',
            important: true, // Important notifications show toasts
            ...message.payload
          });
          
          // Refresh relevant data
          if (message.payload?.postId) {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/${message.payload.postId}`] });
          }
          break;
        
        case MessageType.COMMENT_NOTIFICATION:
        case 'comment_notification':
          console.log('[NOTIFICATION] Processing comment notification');
          dispatchCustomEvent('notification:social', {
            type: 'comment',
            title: 'New Comment',
            message: message.payload?.message || 'Someone commented on your content',
            important: true,
            ...message.payload
          });
          
          // Refresh relevant data
          if (message.payload?.postId) {
            queryClient.invalidateQueries({ queryKey: [`/api/posts/${message.payload.postId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/posts/${message.payload.postId}/comments`] });
          }
          break;
        
        case MessageType.REPLY_NOTIFICATION:
        case 'reply_notification':
          console.log('[NOTIFICATION] Processing reply notification');
          dispatchCustomEvent('notification:social', {
            type: 'reply',
            title: 'New Reply',
            message: message.payload?.message || 'Someone replied to your comment',
            ...message.payload
          });
          break;
          
        case MessageType.SHARE_NOTIFICATION:
          dispatchCustomEvent('notification:social', {
            type: 'share',
            title: 'Content Shared',
            message: message.payload?.message || 'Someone shared your content',
            ...message.payload
          });
          break;
        
        case MessageType.MENTION_NOTIFICATION:
          dispatchCustomEvent('notification:social', {
            type: 'mention',
            title: 'You were mentioned',
            message: message.payload?.message || 'Someone mentioned you',
            ...message.payload
          });
          break;
        
        case MessageType.FOLLOW_NOTIFICATION:
          dispatchCustomEvent('notification:social', {
            type: 'follow',
            title: 'New Follower',
            message: message.payload?.message || 'Someone started following you',
            ...message.payload
          });
          break;
          
        // Service and booking notifications
        case MessageType.SERVICE_BOOKED:
          dispatchCustomEvent('notification:service', {
            type: 'booking',
            title: 'New Booking',
            message: message.payload?.message || 'Your service was booked',
            ...message.payload
          });
          break;
          
        case MessageType.SERVICE_BOOKING_UPDATED:
          dispatchCustomEvent('notification:service', {
            type: 'booking_update',
            title: 'Booking Updated',
            message: message.payload?.message || 'A booking was updated',
            ...message.payload
          });
          break;
          
        case MessageType.SERVICE_BOOKING_CANCELED:
          dispatchCustomEvent('notification:service', {
            type: 'booking_canceled',
            title: 'Booking Canceled',
            message: message.payload?.message || 'A booking was canceled',
            ...message.payload
          });
          break;
          
        case MessageType.SERVICE_REVIEWED:
          dispatchCustomEvent('notification:service', {
            type: 'review',
            title: 'New Review',
            message: message.payload?.message || 'Your service received a review',
            ...message.payload
          });
          break;
          
        // Product and sales notifications
        case MessageType.PRODUCT_SOLD:
          dispatchCustomEvent('notification:product', {
            type: 'sale',
            title: 'Product Sold',
            message: message.payload?.message || 'Your product was purchased',
            ...message.payload
          });
          break;
          
        case MessageType.ORDER_STATUS_UPDATE:
          dispatchCustomEvent('notification:product', {
            type: 'order_update',
            title: 'Order Update',
            message: message.payload?.message || 'Your order status has changed',
            ...message.payload
          });
          break;
          
        case MessageType.PAYMENT_RECEIVED:
          dispatchCustomEvent('notification:product', {
            type: 'payment',
            title: 'Payment Received',
            message: message.payload?.message || 'You received a payment',
            ...message.payload
          });
          break;
          
        // Content and spot notifications
        case MessageType.SPOT_ADDED:
          dispatchCustomEvent('notification:content', {
            type: 'spot',
            title: 'New Spot Added',
            message: message.payload?.message || 'A new spot was added near you',
            ...message.payload
          });
          break;
          
        case MessageType.SPOT_UPDATED:
          dispatchCustomEvent('notification:content', {
            type: 'spot_update',
            title: 'Spot Updated',
            message: message.payload?.message || 'A spot you follow was updated',
            ...message.payload
          });
          break;
          
        case MessageType.EVENT_NOTIFICATION:
          dispatchCustomEvent('notification:content', {
            type: 'event',
            title: 'Event Update',
            message: message.payload?.message || 'An event you\'re interested in was updated',
            ...message.payload
          });
          break;
          
        case MessageType.EVENT_RSVP:
        case 'EVENT_RSVP':
        case 'event_rsvp':
          dispatchCustomEvent('notification:content', {
            type: 'event_rsvp',
            title: 'New Event RSVP',
            message: message.payload?.message || 'Someone RSVPed to your event',
            ...message.payload
          });
          
          // Also refresh event data if it's for an organizer
          if (message.payload?.targetType === 'event' && message.payload?.targetId) {
            queryClient.invalidateQueries({ queryKey: [`/api/events/${message.payload.targetId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/events/${message.payload.targetId}/tickets`] });
          }
          break;
          
        // Admin actions
        case MessageType.REPORT_ACCEPTED:
          dispatchCustomEvent('notification:admin', {
            type: 'report_accepted',
            title: 'Report Accepted',
            message: message.payload?.message || 'Your report was accepted',
            ...message.payload
          });
          break;
          
        case MessageType.REPORT_REJECTED:
          dispatchCustomEvent('notification:admin', {
            type: 'report_rejected',
            title: 'Report Rejected',
            message: message.payload?.message || 'Your report was rejected',
            ...message.payload
          });
          break;
          
        case MessageType.ADMIN_ACTION:
          dispatchCustomEvent('notification:admin', {
            type: 'admin_action',
            title: 'Admin Action',
            message: message.payload?.message || 'An admin took action on your content',
            ...message.payload
          });
          break;
          
        case MessageType.VERIFICATION_STATUS:
          dispatchCustomEvent('notification:admin', {
            type: 'verification',
            title: 'Verification Update',
            message: message.payload?.message || 'Your verification status has changed',
            ...message.payload
          });
          break;
          
        case MessageType.SYSTEM_NOTIFICATION:
          // Don't show a toast for system notifications unless they are important
          if (message.payload?.important) {
            toast({
              title: message.payload?.title || 'System Notification',
              description: message.payload?.message || 'System update',
              variant: message.payload?.variant || 'default'
            });
          }
          break;
          
        case MessageType.TERMS_PROMPT:
          // Special notification that should show a toast and possibly a modal
          toast({
            title: message.payload?.title || 'Terms Updated',
            description: message.payload?.message || 'Please review our updated terms',
            variant: 'destructive'
          });
          break;
      }
      
      // Debounced invalidation — coalesces rapid WebSocket bursts into a single refetch
      debouncedInvalidateNotifications();
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [subscribe, queryClient, toast, user]);

  // Helper to dispatch custom events
  const dispatchCustomEvent = (eventType: string, data: any) => {
    const event = new CustomEvent(eventType, { detail: data });
    window.dispatchEvent(event);
    
    // For important notifications, also show a toast
    if (data.important) {
      toast({
        title: data.title,
        description: data.message,
        variant: data.variant || 'default'
      });
    }
  };

  // This component doesn't render anything
  return null;
};

export default WebSocketSubscriber;