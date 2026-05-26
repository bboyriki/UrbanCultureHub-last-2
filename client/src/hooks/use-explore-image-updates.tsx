import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/contexts/WebSocketSingletonContext';

/**
 * Hook to listen for real-time updates to explore page images
 * and invalidate the cache when changes occur
 */
export function useExploreImageUpdates() {
  const queryClient = useQueryClient();
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [processingUpdate, setProcessingUpdate] = useState<boolean>(false);
  
  // Subscribe to EXPLORE_IMAGE_UPDATE websocket messages
  const { subscribe } = useWebSocket();
  
  // Function to handle cache invalidation and refetching
  const handleExploreImageUpdate = useCallback((message: any) => {
    if (!message || message.type !== 'EXPLORE_IMAGE_UPDATE') return;
    
    try {
      // Get message data
      const payload = message.payload || {};
      const { section, action, timestamp, cacheBreaker, isFollowUp } = payload;
      const messageTime = timestamp || message.timestamp || Date.now();
      
      // Only process if:
      // 1. This is a newer message than the last one processed
      // 2. It's a follow-up message specifically for ensuring updates are applied
      // 3. It's been more than 2 seconds since the last update (to prevent stuck state)
      const shouldProcess = 
        messageTime > lastUpdateTime || 
        isFollowUp === true || 
        (Date.now() - lastUpdateTime > 2000);
      
      if (shouldProcess && !processingUpdate) {
        console.log(`Processing explore image ${action} for section "${section}" (${isFollowUp ? 'follow-up' : 'initial'})`, { 
          cacheBreaker, 
          messageTime: new Date(messageTime).toISOString()
        });
        
        // Set processing flag to prevent multiple concurrent updates
        setProcessingUpdate(true);
        
        // Immediate cache invalidation
        console.log('Invalidating explore image queries');
        queryClient.invalidateQueries({ 
          queryKey: ['/api/explore-images'],
          refetchType: 'all'
        });
        
        // If we have a specific section, invalidate its query too
        if (section) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/explore-images/${section}`],
            refetchType: 'all'
          });
        }
        
        // Add a small delay and refetch again to ensure we get fresh data
        setTimeout(() => {
          console.log('First refetch after delay');
          queryClient.refetchQueries({ 
            queryKey: ['/api/explore-images'],
            exact: false
          });
          
          // Add another delay for a second refetch attempt
          setTimeout(() => {
            console.log('Second refetch after delay');
            queryClient.refetchQueries({ 
              queryKey: ['/api/explore-images'],
              exact: false
            });
            
            // Clear processing flag
            setProcessingUpdate(false);
          }, 1000);
        }, 500);
        
        // Update last processed timestamp
        setLastUpdateTime(messageTime);
      } else {
        console.log('Skipping explore image update message', { 
          reason: processingUpdate ? 'Already processing an update' : 'Older or duplicate message',
          messageTime: new Date(messageTime).toISOString(),
          lastUpdateTime: new Date(lastUpdateTime).toISOString()
        });
      }
    } catch (err) {
      console.error('Error processing explore image update notification:', err);
      setProcessingUpdate(false);
    }
  }, [queryClient, lastUpdateTime, processingUpdate]);
  
  // Set up a direct message handler for updates
  useEffect(() => {
    // Subscribe to immediate updates
    const unsubscribe = subscribe((message) => {
      if (message.type === 'EXPLORE_IMAGE_UPDATE') {
        console.log('Direct subscription received image update:', message);
        handleExploreImageUpdate(message);
      }
    });
    
    return unsubscribe;
  }, [subscribe, handleExploreImageUpdate]);
  
  // Set up an interval to periodically refetch explore images
  // to ensure we have the latest data even if WebSocket notifications fail
  useEffect(() => {
    const interval = setInterval(() => {
      if (!processingUpdate) {
        console.log('Periodic refetch of explore images');
        queryClient.invalidateQueries({
          queryKey: ['/api/explore-images'],
          refetchType: 'all'
        });
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [queryClient, processingUpdate]);
  
  // This hook doesn't return anything as it just sets up the
  // listeners and handles cache invalidation automatically
  return null;
}