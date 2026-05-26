import { MessageType } from '@/contexts/WebSocketSingletonContext';

/**
 * Maps WebSocket message types to notification categories for filtering
 */
export const notificationTypeMapping = {
  // Social notification categories (for Community pages)
  social: [
    MessageType.LIKE_NOTIFICATION,
    MessageType.COMMENT_NOTIFICATION,
    MessageType.REPLY_NOTIFICATION,
    MessageType.SHARE_NOTIFICATION,
    MessageType.MENTION_NOTIFICATION,
    MessageType.FOLLOW_NOTIFICATION,
    'like',
    'comment',
    'reply',
    'share',
    'mention',
    'follow'
  ],
  
  // Service notification categories (for Services pages)
  service: [
    MessageType.SERVICE_BOOKED,
    MessageType.SERVICE_BOOKING_UPDATED,
    MessageType.SERVICE_BOOKING_CANCELED,
    MessageType.SERVICE_REVIEWED,
    'booking',
    'booking_update',
    'booking_canceled',
    'review',
    'service'
  ],
  
  // Product notification categories (for Marketplace pages)
  product: [
    MessageType.PRODUCT_SOLD,
    MessageType.ORDER_STATUS_UPDATE,
    MessageType.PAYMENT_RECEIVED,
    'sale',
    'order_update', 
    'payment',
    'order',
    'product'
  ],
  
  // Content notification categories (for Map and Events pages)
  content: [
    MessageType.SPOT_ADDED,
    MessageType.SPOT_UPDATED,
    MessageType.EVENT_NOTIFICATION,
    MessageType.EVENT_RSVP,
    'spot',
    'spot_update',
    'event',
    'event_rsvp',
    'artwork'
  ],
  
  // Admin notification categories (for Admin pages)
  admin: [
    MessageType.REPORT_ACCEPTED,
    MessageType.REPORT_REJECTED,
    MessageType.ADMIN_ACTION,
    MessageType.VERIFICATION_STATUS,
    'report_accepted',
    'report_rejected',
    'admin_action',
    'verification',
    'system'
  ],
  
  // Chat notification categories (for Chat pages)
  chat: [
    MessageType.CHAT_MESSAGE,
    'message',
    'chat'
  ],
  
  // User notification categories (for Profile pages)
  user: [
    MessageType.ACCOUNT_UPDATE,
    MessageType.MEMBERSHIP_STATUS,
    MessageType.VERIFICATION_STATUS,
    'account',
    'profile',
    'membership',
    'verification',
    'user'
  ]
};

/**
 * Gets the notification types relevant to a specific section of the app
 */
export function getNotificationTypesForSection(section: keyof typeof notificationTypeMapping): string[] {
  return notificationTypeMapping[section] || [];
}

/**
 * Gets the section that a notification type belongs to
 */
export function getSectionForNotificationType(type: string): string | null {
  for (const [section, types] of Object.entries(notificationTypeMapping)) {
    if (types.includes(type)) {
      return section;
    }
  }
  return null;
}