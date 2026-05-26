/**
 * Test script for social interaction notifications (post likes)
 * Run with: node test-like-notification.js
 */
import WebSocket from 'ws';

// Connection details
const BASE_URL = process.env.BASE_URL || 'ws://localhost:5000/ws';

// Test data - replace with actual IDs from your database
const USER_ID = 3;         // The user liking the post
const POST_ID = 1;         // The post being liked
const POST_OWNER_ID = 9;   // The post owner who will receive the notification

// Connect to WebSocket server
const socket = new WebSocket(BASE_URL);

socket.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // First authenticate
  authenticate();
  
  // Wait a moment for authentication to process
  setTimeout(() => {
    sendLikeNotification();
  }, 1000);
});

socket.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
    
    // Handle response for any confirmation message
    if (message.type === 'like_notification' || message.type === 'like_notification_success' || 
        message.type === 'notification_sent' || message.type === 'notification_delivered') {
      console.log('Successfully sent like notification!');
      
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

// Function to simulate a post like notification
function sendLikeNotification() {
  const likeData = {
    type: 'like_notification',
    payload: {
      postId: POST_ID,
      userId: USER_ID,
      targetUserId: POST_OWNER_ID,
      message: `User ${USER_ID} liked your post`,
      timestamp: new Date().toISOString(),
      actionLink: `/community/post/${POST_ID}`
    }
  };
  
  socket.send(JSON.stringify(likeData));
  console.log('Sent like notification request');
}