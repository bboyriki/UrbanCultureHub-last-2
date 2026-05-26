// Test script for marketplace-related notifications
import { WebSocket } from 'ws';

// Configuration
const WS_URL = 'ws://localhost:5000/ws';
const BUYER_ID = 3; // Buyer User ID
const SELLER_ID = 9; // Seller User ID
const PRODUCT_ID = 9; // Example product ID
const ORDER_ID = 1; // Example order ID

// Create a WebSocket connection
const ws = new WebSocket(WS_URL);

// Handle connection open
ws.on('open', function open() {
  console.log('Connected to the WebSocket server');
  
  // First send authentication
  const authMessage = {
    type: 'auth',
    payload: {
      userId: SELLER_ID,
      role: 'admin',
      username: 'Seller'
    }
  };
  
  ws.send(JSON.stringify(authMessage));
  console.log('Sent authentication');
  
  // Wait a bit before sending the test notifications
  setTimeout(() => {
    // Send product sold notification to seller
    const productSoldNotification = {
      type: 'product_sold',
      payload: {
        title: 'New Sale',
        message: 'Your product "Test Product" has been purchased',
        userId: SELLER_ID,
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        buyerId: BUYER_ID,
        actionLink: `/marketplace/orders/${ORDER_ID}`,
        actionText: 'View Order'
      },
      timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(productSoldNotification));
    console.log('Sent product sold notification to seller');
    
    // Send order confirmation to buyer after a short delay
    setTimeout(() => {
      // Authenticate as system to send to buyer
      const reAuthMessage = {
        type: 'auth',
        payload: {
          userId: 0, // System user
          role: 'system',
          username: 'System'
        }
      };
      
      ws.send(JSON.stringify(reAuthMessage));
      
      const orderConfirmationNotification = {
        type: 'order_status_update',
        payload: {
          title: 'Order Confirmed',
          message: 'Your order for "Test Product" has been confirmed',
          userId: BUYER_ID,
          productId: PRODUCT_ID,
          orderId: ORDER_ID,
          status: 'confirmed',
          actionLink: `/marketplace/orders/${ORDER_ID}`,
          actionText: 'View Order'
        },
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(orderConfirmationNotification));
      console.log('Sent order confirmation notification to buyer');
      
      // Send shipping update notification after a short delay
      setTimeout(() => {
        const shippingUpdateNotification = {
          type: 'order_status_update',
          payload: {
            title: 'Order Shipped',
            message: 'Your order for "Test Product" has been shipped',
            userId: BUYER_ID,
            productId: PRODUCT_ID,
            orderId: ORDER_ID,
            status: 'shipped',
            trackingNumber: 'TRK123456789',
            actionLink: `/marketplace/orders/${ORDER_ID}`,
            actionText: 'Track Order'
          },
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(shippingUpdateNotification));
        console.log('Sent shipping update notification');
        
        // Close connection after all tests
        setTimeout(() => {
          ws.close();
          console.log('Test completed');
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
});

// Handle messages received from the server
ws.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message from server:', message);
  } catch (e) {
    console.log('Received non-JSON message:', data.toString());
  }
});

// Handle errors
ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

// Handle connection close
ws.on('close', function close() {
  console.log('Disconnected from the WebSocket server');
});

console.log('Starting WebSocket test for marketplace notifications...');