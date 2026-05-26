import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useNotifications, Notification } from '@/contexts/NotificationsContext';

interface NotificationBadgeProps {
  type: string | string[];
  className?: string;
  max?: number;
}

/**
 * A reusable notification badge component that displays a count
 * of unread notifications for specific notification types
 */
const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
  type, 
  className = '',
  max = 99
}) => {
  const { notifications } = useNotifications();
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // No notifications or empty type array - nothing to count
    if (!notifications || (!type || (Array.isArray(type) && !type.length))) {
      setCount(0);
      return;
    }
    
    // Filter notifications based on the type(s)
    const typeArray = Array.isArray(type) ? type : [type];
    const filteredCount = notifications.filter(
      (notification) => 
        !notification.isRead && 
        typeArray.includes(notification.type)
    ).length;
    
    setCount(filteredCount);
  }, [notifications, type]);
  
  // No unread notifications, don't show the badge
  if (count === 0) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-xs min-w-[1.2rem] h-5 flex items-center justify-center ${className}`}
    >
      {count > max ? `${max}+` : count}
    </Badge>
  );
};

export default NotificationBadge;