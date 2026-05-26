import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocket, MessageType } from './WebSocketSingletonContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Notification {
  id: number;
  userId: number;
  fromUserId?: number | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  isSeen: boolean;
  actionLink?: string | null;
  actionText?: string | null;
  thumbnail?: string | null;
  targetId?: number | null;
  targetType?: string | null;
  importance?: string | null;
  expiresAt?: Date | null;
  metadata?: any;
  createdAt: Date;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAsSeen: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAllAsSeen: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refreshNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const queryClient = useQueryClient();
  const { sendMessage } = useWebSocket();
  
  // Fetch notifications from API
  const {
    data: notifications = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/notifications?userId=${user.id}`);
      if (!response.ok) {
        console.error('Failed to fetch notifications:', response.status, response.statusText);
        throw new Error('Failed to fetch notifications');
      }
      return response.json();
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: false,
  });

  // Calculate unread count
  const unreadCount = notifications.filter((notification: Notification) => !notification.isRead).length;

  // Mark a notification as read
  const markAsRead = useCallback(async (id: number) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/notifications/${id}/read?userId=${user.id}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Optimistically update UI
      queryClient.setQueryData(['/api/notifications'], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => 
          notification.id === id ? { ...notification, isRead: true } : notification
        );
      });
      
      // Invalidate the query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    }
  }, [user, queryClient]);

  // Mark a notification as seen
  const markAsSeen = useCallback(async (id: number) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/notifications/${id}/seen?userId=${user.id}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as seen');
      }
      
      // Optimistically update UI
      queryClient.setQueryData(['/api/notifications'], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => 
          notification.id === id ? { ...notification, isSeen: true } : notification
        );
      });
      
      // Invalidate the query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
    } catch (error) {
      console.error('Error marking notification as seen:', error);
      // Don't show a toast for seen status failures as it's less critical
    }
  }, [user, queryClient]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/notifications/read-all?userId=${user.id}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }
      
      // Optimistically update UI
      queryClient.setQueryData(['/api/notifications'], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => ({ ...notification, isRead: true }));
      });
      
      // Invalidate the query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    }
  }, [user, queryClient]);

  // Mark all notifications as seen
  const markAllAsSeen = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/notifications/seen-all?userId=${user.id}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark all notifications as seen');
      }
      
      // Optimistically update UI
      queryClient.setQueryData(['/api/notifications'], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => ({ ...notification, isSeen: true }));
      });
      
      // Invalidate the query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
    } catch (error) {
      console.error('Error marking all notifications as seen:', error);
      // Don't show a toast for seen status failures as it's less critical
    }
  }, [user, queryClient]);
  
  // Delete a notification
  const deleteNotification = useCallback(async (id: number) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/notifications/${id}?userId=${user.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
      
      // Optimistically update UI
      queryClient.setQueryData(['/api/notifications'], (oldData: Notification[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(notification => notification.id !== id);
      });
      
      // Invalidate the query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
    } catch (error) {
      console.error('Error deleting notification:', error);
      toastRef.current({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
    }
  }, [user, queryClient]);

  // Event handlers for WebSocket notifications
  useEffect(() => {
    // Helper to handle new notification events
    const handleNewNotification = (event: CustomEvent) => {
      console.log('Received notification event:', event.type, event.detail);
      
      // Show a toast for the notification
      if (event.detail?.message) {
        toastRef.current({
          title: event.detail.title || 'New Notification',
          description: event.detail.message,
          variant: 'default',
        });
      }
      
      // Refresh notifications from the server
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    };

    // Add event listeners for various notification types
    window.addEventListener('notification:social', handleNewNotification as EventListener);
    window.addEventListener('notification:service', handleNewNotification as EventListener);
    window.addEventListener('notification:product', handleNewNotification as EventListener);
    window.addEventListener('notification:content', handleNewNotification as EventListener);
    window.addEventListener('notification:admin', handleNewNotification as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('notification:social', handleNewNotification as EventListener);
      window.removeEventListener('notification:service', handleNewNotification as EventListener);
      window.removeEventListener('notification:product', handleNewNotification as EventListener);
      window.removeEventListener('notification:content', handleNewNotification as EventListener);
      window.removeEventListener('notification:admin', handleNewNotification as EventListener);
    };
  }, [queryClient]);

  // Context value
  const contextValue: NotificationsContextType = {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsSeen,
    markAllAsRead,
    markAllAsSeen,
    deleteNotification,
    refreshNotifications: refetch,
  };

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};