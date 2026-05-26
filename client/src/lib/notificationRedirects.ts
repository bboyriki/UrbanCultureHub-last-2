import { getSectionForNotificationType } from './notificationTypeMapping';

/**
 * Returns the appropriate redirect URL for seller/creator notifications
 * 
 * This function is used to redirect notifications to the appropriate
 * seller dashboard based on the notification type and target
 */
export function getSellerRedirectUrl(
  notificationType: string,
  targetId?: number | null,
  targetType?: string | null
): string | null {
  const section = getSectionForNotificationType(notificationType);
  
  // Handle specific notification types differently
  switch (notificationType.toLowerCase()) {
    // Event related notifications
    case 'event_rsvp':
    case 'event_update':
    case 'event_canceled':
      return targetId ? `/events/${targetId}/sales` : `/events`;
      
    // Ticket related notifications
    case 'ticket_purchased':
    case 'ticket_canceled':
    case 'ticket_refunded':
      return targetId ? `/events/${targetId}/tickets` : `/events`;
      
    // Service related notifications  
    case 'service_booked':
    case 'service_booking_updated':
    case 'service_booking_canceled':
    case 'service_booking_completed':
    case 'service_reviewed':
      return targetId ? `/services/${targetId}/sales` : `/services`;
      
    // Marketplace related notifications
    case 'product_sold':
    case 'order_status_update':
    case 'payment_received':
    case 'stock_update':
      return targetId ? `/marketplace/${targetId}/sales` : `/marketplace/sales`;
    
    // Spot related notifications
    case 'spot_like':
    case 'spot_comment':
    case 'spot_added':
    case 'spot_updated':
      return targetId ? `/map/spots/${targetId}/manage` : `/map`;
      
    // Default redirection based on section
    default:
      if (section && targetType) {
        switch (section) {
          case 'content':
            if (targetType === 'event') {
              return targetId ? `/events/${targetId}/sales` : `/events`;
            } else if (targetType === 'spot') {
              return targetId ? `/map/spots/${targetId}/manage` : `/map`;
            }
            return null;
            
          case 'service':
            return targetId ? `/services/${targetId}/sales` : `/services`;
            
          case 'product':
            return targetId ? `/marketplace/${targetId}/sales` : `/marketplace/sales`;
            
          default:
            return null;
        }
      }
      return null;
  }
}

/**
 * Determines if a notification is a seller/creator notification
 * 
 * This is used to show additional action buttons on notifications
 * that should redirect to seller dashboards
 */
export function isSellerNotification(notificationType: string): boolean {
  const section = getSectionForNotificationType(notificationType);
  
  // These notification types are always related to seller dashboards
  const sellerTypes = [
    'event_rsvp',
    'service_booked',
    'service_booking_updated',
    'service_booking_completed',
    'product_sold',
    'order_status_update',
    'payment_received',
    'spot_like',
    'spot_comment',
    'service_reviewed',
    'stock_update',
    'ticket_purchased',
    'ticket_canceled',
    'ticket_refunded'
  ];
  
  // Check if this is a seller notification type
  if (sellerTypes.includes(notificationType.toLowerCase())) {
    return true;
  }
  
  // Check if this belongs to a seller section
  return ['service', 'product', 'content'].includes(section || '');
}