import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket, MessageType } from '@/contexts/WebSocketSingletonContext';

interface ServiceBookingNotification {
  bookingId: number;
  serviceId: number;
  serviceName: string;
  customerName: string;
  customerId: number;
  bookingDate: string;
  status: string;
  price: string;
  message: string;
  createdAt: string;
}

/**
 * Hook for handling service booking notifications
 * This allows any component to easily listen for real-time service booking notifications
 */
export function useServiceBookingNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookingNotifications, setBookingNotifications] = useState<ServiceBookingNotification[]>([]);
  const { subscribe } = useWebSocket();

  // Handle incoming booking notifications
  const handleBookingNotification = useCallback((notification: ServiceBookingNotification) => {
    // Update the state with the new notification
    setBookingNotifications(prevNotifications => [notification, ...prevNotifications]);
    
    // Show a toast notification
    toast({
      title: 'New Service Booking',
      description: `${notification.customerName} has booked your service "${notification.serviceName}"`,
      duration: 5000,
    });
  }, [toast]);

  // Subscribe to booking notifications
  useEffect(() => {
    if (!user?.id) return;
    
    // Set up subscription to WebSocket messages
    const unsubscribe = subscribe((message) => {
      if (message.type === MessageType.SERVICE_BOOKED || message.type === 'service_booked') {
        // Only process if this notification is for the current user
        if (user.id === message.payload.providerId) {
          handleBookingNotification(message.payload);
        }
      }
    });
    
    // Cleanup on unmount
    return unsubscribe;
  }, [user?.id, subscribe, handleBookingNotification]);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setBookingNotifications([]);
  }, []);

  return {
    bookingNotifications,
    clearNotifications
  };
}