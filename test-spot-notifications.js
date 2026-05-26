/**
 * Test script for spot notifications
 * Run with: node test-spot-notifications.js
 */
const WebSocket = require('ws');

// Connection details
const BASE_URL = process.env.BASE_URL || 'ws://localhost:5000/ws';

// Test data - replace with actual IDs from your database
const USER_ID = 3;           // The user creating or updating the spot
const SPOT_ID = 1;           // A spot ID that exists in the database
const TARGET_USER_ID = 9;    // A user who will receive the notification

// Connect to WebSocket server
const socket = new WebSocket(BASE_URL);

// Command line arguments to determine test type
const testType = process.argv[2] || 'add'; // Default to 'add', can be 'add' or 'update'

socket.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // First authenticate
  authenticate();
  
  // Wait a moment for authentication to process
  setTimeout(() => {
    if (testType === 'add') {
      simulateNewSpot();
    } else if (testType === 'update') {
      simulateSpotUpdate();
    } else {
      console.log('Unknown test type. Use "add" or "update"');
      socket.close();
    }
  }, 1000);
});

socket.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
    
    // Handle response based on test type
    if ((testType === 'add' && message.type === 'SPOT_ADDED') || 
        (testType === 'update' && message.type === 'SPOT_UPDATED')) {
      console.log(`Successfully sent ${testType} spot notification!`);
      
      // Wait a bit to ensure message is delivered, then close
      setTimeout(() => {
        socket.close();
        console.log('Test completed.');
      }, 1000);
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
});

socket.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

socket.on('close', function close() {
  console.log('Disconnected from WebSocket server');
});

// Function to authenticate as the user
function authenticate() {
  const authMessage = {
    type: 'auth',
    userId: USER_ID,
    role: 'user',
    timestamp: Date.now()
  };
  
  socket.send(JSON.stringify(authMessage));
  console.log('Sent authentication message');
}

// Function to simulate a new spot being added
function simulateNewSpot() {
  const spotData = {
    type: 'notification',
    notificationType: 'SPOT_ADDED',
    targetUserId: TARGET_USER_ID,
    payload: {
      spotId: SPOT_ID,
      spotName: 'Test Urban Art Spot',
      spotType: 'Graffiti',
      latitude: 52.377956,
      longitude: 4.897070,
      creatorId: USER_ID,
      timestamp: new Date().toISOString(),
      message: `New urban culture spot "Test Urban Art Spot" was added near you!`,
      actionLink: `/map?spot=${SPOT_ID}`
    }
  };
  
  socket.send(JSON.stringify(spotData));
  console.log('Sent new spot notification request');
}

// Function to simulate a spot being updated
function simulateSpotUpdate() {
  const updateData = {
    type: 'notification',
    notificationType: 'SPOT_UPDATED',
    targetUserId: TARGET_USER_ID,
    payload: {
      spotId: SPOT_ID,
      spotName: 'Updated Urban Art Spot',
      spotType: 'Graffiti',
      latitude: 52.377956,
      longitude: 4.897070,
      updaterId: USER_ID,
      updateTimestamp: new Date().toISOString(),
      message: `The urban culture spot "Test Urban Art Spot" has been updated with new information!`,
      actionLink: `/map?spot=${SPOT_ID}`
    }
  };
  
  socket.send(JSON.stringify(updateData));
  console.log('Sent spot update notification request');
}