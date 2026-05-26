/**
 * Test script to verify WebSocket connection is fixed
 * Run with: node test-fixed-websocket.js
 */

// Import WebSocket client for Node.js environment
const WebSocket = require('ws');

// Connect to the WebSocket server
function connectWebSocket() {
  // Create WebSocket URL (adjust if needed)
  const wsUrl = 'ws://localhost:5000/ws';
  
  console.log(`Connecting to WebSocket at ${wsUrl}...`);
  
  // Create a new WebSocket connection
  const socket = new WebSocket(wsUrl);
  
  // Connection opened handler
  socket.on('open', function() {
    console.log('✅ Connected to WebSocket server!');
    
    // Send authentication message
    const authData = {
      type: 'auth',
      payload: {
        userId: 1,  // Test user ID
        role: 'user',
        displayName: 'Test User',
        connectionId: `test-${Date.now()}`,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    };
    
    console.log('Sending authentication message...');
    socket.send(JSON.stringify(authData));
    
    // Send a test message after authentication
    setTimeout(() => {
      const testMessage = {
        type: 'ping',
        payload: {
          message: 'Hello server!',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      };
      
      console.log('Sending test ping message...');
      socket.send(JSON.stringify(testMessage));
    }, 1000);
  });
  
  // Message handler
  socket.on('message', function(data) {
    try {
      const message = JSON.parse(data);
      console.log('📩 Received message from server:', message);
      
      // If we get an auth_success message, connection is working properly
      if (message.type === 'auth_success' || message.type === 'AUTH_SUCCESS') {
        console.log('🎉 Authentication successful!');
      }
      
      // If we get a pong message, server is responsive
      if (message.type === 'pong') {
        console.log('🏓 Server responded to ping!');
        
        // Close the connection after successful test
        console.log('Test completed successfully, closing connection...');
        setTimeout(() => {
          socket.close();
          process.exit(0);
        }, 1000);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  // Error handler
  socket.on('error', function(error) {
    console.error('❌ WebSocket error:', error);
  });
  
  // Close handler
  socket.on('close', function(code, reason) {
    console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason || 'None'}`);
  });
  
  // Set timeout to close the connection if test doesn't complete
  setTimeout(() => {
    if (socket.readyState === WebSocket.OPEN) {
      console.log('Test timed out, closing connection...');
      socket.close();
      process.exit(1);
    }
  }, 10000);
}

// Run the test
connectWebSocket();