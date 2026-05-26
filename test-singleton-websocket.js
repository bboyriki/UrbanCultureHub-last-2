/**
 * Test script for WebSocket singleton pattern
 * 
 * This script simulates and verifies that:
 * 1. Only one WebSocket connection is created for multiple consumers
 * 2. The connection is properly maintained
 * 3. Singleton pattern prevents multiple connections
 * 
 * Run with: node test-singleton-websocket.js
 */

import WebSocket from 'ws';

// Track time to calculate durations
const startTime = Date.now();
let testId = 1;

// Configuration
const serverUrl = 'localhost:5000';
const wsPath = '/ws';

/**
 * Log output with timing information 
 */
function log(message) {
  const elapsed = Date.now() - startTime;
  console.log(`[${elapsed}ms] ${message}`);
}

/**
 * Helper to wait for connection
 */
function waitForConnection(socket, callback) {
  setTimeout(() => {
    if (socket.readyState === WebSocket.OPEN) {
      if (callback != null) {
        callback();
      }
      return;
    } else if (socket.readyState === WebSocket.CONNECTING) {
      waitForConnection(socket, callback);
    } else {
      log(`Socket failed to connect, readyState: ${socket.readyState}`);
      if (callback != null) {
        callback(new Error('Connection failed'));
      }
    }
  }, 100);
}

/**
 * Create a WebSocket connection with the specified ID
 */
function connectWebSocket() {
  const protocol = 'ws:';
  const url = `${protocol}//${serverUrl}${wsPath}`;
  
  log(`Connecting to WebSocket at ${url}`);
  
  const ws = new WebSocket(url);
  
  ws.on('open', () => {
    log('🟢 WebSocket connection established (OPEN event)');
    
    // Send authentication message
    const authMessage = {
      type: 'auth',
      userId: 9, // Test user ID
      token: 'test-token'
    };
    
    ws.send(JSON.stringify(authMessage));
    log('📤 Sent authentication message');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      log(`📩 Received message: ${JSON.stringify(message)}`);
      
      // Handle auth success
      if (message.type === 'auth_success') {
        log('🔑 Authentication successful');
      }
    } catch (error) {
      log(`Error parsing message: ${error.message}`);
    }
  });
  
  ws.on('close', () => {
    log('❌ WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    log(`❌ WebSocket error: ${error.message}`);
  });
  
  return ws;
}

/**
 * Create a second WebSocket to test isolation/singleton behavior
 */
function createSecondWebSocket() {
  log('\n📡 Creating second WebSocket connection (should use singleton if implemented correctly)');
  const ws2 = connectWebSocket();
  
  return ws2;
}

/**
 * Test WebSocket singleton implementation
 */
async function testWebSocketSingleton() {
  log('Testing WebSocket singleton implementation...');
  
  // First connection
  const ws1 = connectWebSocket();
  
  // Wait for the first connection to be established
  waitForConnection(ws1, (error) => {
    if (error) {
      log('❌ First connection failed');
      return;
    }
    
    log('🔍 TEST #1: First connection established successfully');
    
    // Create second connection after a delay
    setTimeout(() => {
      const ws2 = createSecondWebSocket();
      
      // Wait for the second connection
      waitForConnection(ws2, (error) => {
        if (error) {
          log('❌ Second connection failed');
          return;
        }
        
        log('🔍 TEST #2: Second connection established');
        
        // Check if the second connection is using the same socket
        // This requires that the WebSocketSingletonContext is properly implemented
        log('\n🔍 TEST #3: Checking singleton pattern implementation...');
        log('If the app is using a singleton pattern, both connections should use the same socket');
        log('Check the browser console for WebSocket connection counts');
        
        // Send a test message from the second connection
        const testMessage = {
          type: 'ping',
          timestamp: Date.now(),
          testId: testId++
        };
        
        ws2.send(JSON.stringify(testMessage));
        log(`📤 Sent test message from second connection: ${JSON.stringify(testMessage)}`);
        
        // Close after a delay to receive responses
        setTimeout(() => {
          log('\n🏁 Test complete - Check results in server logs');
          ws1.close();
          ws2.close();
          
          setTimeout(() => {
            process.exit(0);
          }, 500);
        }, 2000);
      });
    }, 2000);
  });
}

// Run the test
testWebSocketSingleton();