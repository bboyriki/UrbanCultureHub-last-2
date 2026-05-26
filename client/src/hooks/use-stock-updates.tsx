import { useState, useEffect, useCallback } from 'react';
import { useWebSocket, WebSocketMessage } from '@/contexts/WebSocketSingletonContext';

export interface StockUpdateData {
  productId: number;
  productName: string;
  stock: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
  timestamp: Date;
}

/**
 * Hook to receive real-time product stock updates via WebSockets
 * 
 * @param productId Optional - listen for updates for a specific product only
 * @returns Object containing the latest stock updates and a reset function
 */
export function useStockUpdates(productId?: number) {
  const [stockUpdates, setStockUpdates] = useState<Record<number, StockUpdateData>>({});
  const { subscribe } = useWebSocket();

  // Handle incoming stock update notifications
  const handleStockUpdate = useCallback((message: WebSocketMessage) => {
    if (message.type === 'STOCK_UPDATE') {
      const updateData = message.payload as StockUpdateData;
      
      // If we're listening for a specific product and this is not it, ignore
      if (productId !== undefined && updateData.productId !== productId) {
        return;
      }
      
      console.log('Received stock update for product:', updateData.productId, updateData);
      
      setStockUpdates(prev => ({
        ...prev,
        [updateData.productId]: updateData
      }));
    }
  }, [productId]);

  // Subscribe to stock update messages
  useEffect(() => {
    const unsubscribe = subscribe(handleStockUpdate);
    return () => {
      unsubscribe();
    };
  }, [subscribe, handleStockUpdate]);

  // Function to reset the stock updates state
  const resetStockUpdates = useCallback(() => {
    setStockUpdates({});
  }, []);

  // Check if a specific product has a stock update
  const hasStockUpdate = useCallback((id: number) => {
    return !!stockUpdates[id];
  }, [stockUpdates]);

  // Get stock update for a specific product
  const getStockUpdate = useCallback((id: number) => {
    return stockUpdates[id] || null;
  }, [stockUpdates]);

  return {
    stockUpdates,
    resetStockUpdates,
    hasStockUpdate,
    getStockUpdate
  };
}