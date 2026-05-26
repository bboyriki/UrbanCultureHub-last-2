import React from 'react';
import NotificationBadge from './NotificationBadge';
import { getNotificationTypesForSection } from '@/lib/notificationTypeMapping';

interface NotificationBadgeWrapperProps {
  section: 'social' | 'service' | 'product' | 'content' | 'admin' | 'chat' | 'user';
  className?: string;
}

/**
 * A wrapper component that converts a section name to a list of notification types
 * and passes them to the NotificationBadge component
 */
const NotificationBadgeWrapper: React.FC<NotificationBadgeWrapperProps> = ({ 
  section,
  className
}) => {
  // Get all notification types for this section
  const notificationTypes = getNotificationTypesForSection(section);
  
  return (
    <NotificationBadge type={notificationTypes} className={className} />
  );
};

export default NotificationBadgeWrapper;