import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/contexts/WebSocketSingletonContext';

export interface UnreadMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderImage: string | null;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useUnreadMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();

  const { data: unreadMessages = [], refetch } = useQuery({
    queryKey: ['/api/chat/messages/unread'],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const response = await apiRequest({ url: '/api/chat/messages/unread', method: 'GET' });
        const data = await response.json();
        console.log('Unread messages data:', data);
        return data.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          senderName: msg.sender?.displayName || `User ${msg.senderId}`,
          senderImage: msg.sender?.profilePicture || null,
          message: msg.content,
          timestamp: msg.createdAt,
          read: false
        }));
      } catch (error) {
        console.error('Error fetching unread messages:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user?.id || !subscribe) return;

    const unsub = subscribe((wsMsg: any) => {
      const type = wsMsg.type;

      if (type === 'CHAT_MESSAGE' || type === 'chat_message') {
        const msg = wsMsg.payload;
        if (!msg) return;
        if (msg.senderId === user.id) return;

        queryClient.setQueryData(['/api/chat/messages/unread'], (old: UnreadMessage[] | undefined) => {
          const existing = old || [];
          if (existing.some(m => m.id === msg.id)) return existing;
          const newEntry: UnreadMessage = {
            id: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            senderName: msg.senderName || `User ${msg.senderId}`,
            senderImage: msg.senderProfilePic || null,
            message: msg.content,
            timestamp: msg.createdAt || msg.timestamp || new Date().toISOString(),
            read: false
          };
          return [newEntry, ...existing];
        });

        queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      }

      if (
        type === 'CHAT_MESSAGE_READ' ||
        type === 'CHAT_MESSAGE_DELIVERED' ||
        type === 'chat_message_read'
      ) {
        queryClient.invalidateQueries({ queryKey: ['/api/chat/messages/unread'] });
        queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      }
    });

    return unsub;
  }, [user?.id, subscribe, queryClient]);

  const markAsRead = async (messageId: number) => {
    if (!user?.id) return;
    try {
      await apiRequest({ url: `/api/chat/messages/${messageId}/read`, method: 'PUT' });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages/unread'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const markMultipleAsRead = async (messageIds: number[], conversationId?: number) => {
    if (!user?.id || messageIds.length === 0) return;
    try {
      await apiRequest({
        url: '/api/chat/messages/read-batch',
        method: 'PUT',
        data: { messageIds, conversationId }
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages/unread'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    } catch (error) {
      console.error('Error marking messages as read in batch:', error);
    }
  };

  return {
    unreadMessages,
    markAsRead,
    markMultipleAsRead,
    refetchUnreadMessages: refetch
  };
}
