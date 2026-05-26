/**
 * Test script for service booking and status update notifications
 * Run with: node test-service-notifications.js <type>
 * 
 * Available test types:
 * - booking (default): Simulates a new service booking notification to provider
 * - update: Simulates a booking status update notification to customer
 */
import WebSocket from 'ws';

// Connection details
const BASE_URL = process.env.BASE_URL || 'ws://localhost:5000/ws';

// Test data - replace with actual IDs from your database
const USER_ID = 3;           // The user making the booking
const PROVIDER_ID = 9;       // The service provider who will receive booking notifications
const SERVICE_ID = 1;        // A service ID that exists in the database
const BOOKING_ID = 1;        // A booking ID reference

// Get test type from command line arguments
const testType = process.argv[2] || 'booking'; // Default to 'booking'

// Connect to WebSocket server
const socket = new WebSocket(BASE_URL);

socket.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // First authenticate
  authenticate();
  
  // Wait a moment for authentication to process
  setTimeout(() => {
    if (testType === 'booking') {
      simulateNewBooking();
    } else if (testType === 'update') {
      simulateBookingUpdate();
    } else {
      console.log('Unknown test type. Use "booking" or "update"');
      socket.close();
    }
  }, 1000);
});

socket.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
    
    // Handle response based on test type
    if ((testType === 'booking' && message.type === 'SERVICE_BOOKING') || 
        (testType === 'update' && message.type === 'BOOKING_STATUS_UPDATE')) {
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

// Function to simulate a new service booking
function simulateNewBooking() {
  const bookingData = {
    type: 'notification',
    notificationType: 'SERVICE_BOOKING',
    targetUserId: PROVIDER_ID,
    payload: {
      bookingId: BOOKING_ID,
      serviceId: SERVICE_ID,
      serviceName: 'Test Dance Lessons',
      customerId: USER_ID,
      customerName: 'Test Customer',
      date: new Date().toISOString().split('T')[0],
      time: '14:00-15:00',
      message: `New booking for your service "Test Dance Lessons"`,
      actionLink: `/services/manage/${SERVICE_ID}/bookings/${BOOKING_ID}`
    }
  };
  
  socket.send(JSON.stringify(bookingData));
  console.log('Sent new booking notification request');
}

// Function to simulate a booking status update
function simulateBookingUpdate() {
  const updateData = {
    type: 'notification',
    notificationType: 'BOOKING_STATUS_UPDATE',
    targetUserId: USER_ID, // Send to the customer
    payload: {
      bookingId: BOOKING_ID,
      serviceId: SERVICE_ID,
      serviceName: 'Test Dance Lessons',
      providerId: PROVIDER_ID,
      providerName: 'Test Provider',
      newStatus: 'confirmed',
      statusMessage: 'Your booking has been confirmed',
      message: `Your booking for "Test Dance Lessons" has been confirmed`,
      actionLink: `/services/bookings/${BOOKING_ID}`
    }
  };
  
  socket.send(JSON.stringify(updateData));
  console.log('Sent booking update notification request');
}