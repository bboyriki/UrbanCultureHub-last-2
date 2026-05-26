/**
 * Comprehensive test script for the notification system
 * Tests social interactions, event RSVPs, spot updates, and general notifications
 * Run with: node test-notification.js <type>
 * 
 * Available test types:
 * - like (default): Tests post likes notifications
 * - rsvp: Tests event RSVP notifications
 * - spot: Tests spot notifications
 * - comment: Tests post comment notifications
 * - booking: Tests service booking notifications
 * - order: Tests order notifications 
 */
import WebSocket from 'ws';

// Connection details
const BASE_URL = process.env.BASE_URL || 'ws://localhost:5000/ws';

// Test data - replace with actual IDs from your database
const USER_ID = 3;           // The user sending the notification
const TARGET_USER_ID = 9;    // The user receiving the notification

// Test specific IDs
const POST_ID = 1;           // Post ID for like/comment tests
const EVENT_ID = 1;          // Event ID for RSVP tests
const SPOT_ID = 1;           // Spot ID for spot tests
const SERVICE_ID = 1;        // Service ID for booking tests
const ORDER_ID = 1;          // Order ID for order tests

// Get test type from command line arguments
const testType = process.argv[2] || 'like'; // Default to 'like'

// Data for different notification types
const notificationData = {
  like: {
    type: 'POST_LIKE',
    payload: {
      postId: POST_ID,
      likedByUserId: USER_ID,
      message: `User ${USER_ID} liked your post`,
      actionLink: `/community/post/${POST_ID}`
    }
  },
  comment: {
    type: 'POST_COMMENT',
    payload: {
      postId: POST_ID,
      commentId: 1,
      commentedByUserId: USER_ID,
      message: `User ${USER_ID} commented on your post`,
      commentContent: "This is a test comment!",
      actionLink: `/community/post/${POST_ID}#comment-1`
    }
  },
  rsvp: {
    type: 'EVENT_RSVP',
    payload: {
      eventId: EVENT_ID,
      userId: USER_ID,
      status: 'going',
      message: `User ${USER_ID} is going to your event`,
      actionLink: `/events/${EVENT_ID}`
    }
  },
  spot: {
    type: 'SPOT_ADDED',
    payload: {
      spotId: SPOT_ID,
      spotName: 'Test Urban Art Spot',
      spotType: 'Graffiti',
      latitude: 52.377956,
      longitude: 4.897070,
      creatorId: USER_ID,
      message: `New urban culture spot was added near you!`,
      actionLink: `/map?spot=${SPOT_ID}`
    }
  },
  booking: {
    type: 'SERVICE_BOOKING',
    payload: {
      serviceId: SERVICE_ID,
      bookingId: 1,
      customerId: USER_ID,
      serviceName: 'Test Service',
      message: `New booking for your service`,
      bookingDetails: {
        date: new Date().toISOString(),
        time: '14:00',
        status: 'pending'
      },
      actionLink: `/services/bookings/1`
    }
  },
  order: {
    type: 'NEW_ORDER',
    payload: {
      orderId: ORDER_ID,
      buyerId: USER_ID,
      totalAmount: '25.00',
      items: [{
        productId: 1,
        productName: 'Test Product',
        quantity: 1,
        price: '25.00'
      }],
      message: `New order received`,
      actionLink: `/marketplace/orders/${ORDER_ID}`
    }
  }
};

// Connect to WebSocket server
const socket = new WebSocket(BASE_URL);

socket.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // First authenticate
  authenticate();
  
  // Wait a moment for authentication to process
  setTimeout(() => {
    if (notificationData[testType]) {
      sendNotification(testType);
    } else {
      console.log(`Unknown test type: ${testType}. Available types: like, comment, rsvp, spot, booking, order`);
      socket.close();
    }
  }, 1000);
});

socket.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
    
    // Check if we received the notification we sent
    if (message.type === notificationData[testType].type) {
      console.log(`Successfully sent ${testType} notification!`);
      
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

// Function to send specific notification type
function sendNotification(type) {
  const data = {
    type: 'notification',
    notificationType: notificationData[type].type,
    targetUserId: TARGET_USER_ID,
    payload: notificationData[type].payload
  };
  
  socket.send(JSON.stringify(data));
  console.log(`Sent ${type} notification request`);
}