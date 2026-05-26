// Test script for event-related notifications
import { WebSocket } from 'ws';

// Configuration
const WS_URL = 'ws://localhost:5000/ws';
const USER_ID = 3; // User ID who will receive the notification
const ADMIN_ID = 9; // Admin ID who will send the notification
const EVENT_ID = 1; // Example event ID

// Create a WebSocket connection
const ws = new WebSocket(WS_URL);

// Handle connection open
ws.on('open', function open() {
  console.log('Connected to the WebSocket server');
  
  // First send authentication
  const authMessage = {
    type: 'auth',
    payload: {
      userId: ADMIN_ID,
      role: 'admin',
      username: 'Admin User'
    }
  };
  
  ws.send(JSON.stringify(authMessage));
  console.log('Sent authentication');
  
  // Wait a bit before sending the test notifications
  setTimeout(() => {
    // Send event booking notification
    const eventBookingNotification = {
      type: 'event_notification',
      payload: {
        title: 'New Event Booking',
        message: 'Your ticket for "Urban Dance Festival" has been confirmed',
        userId: USER_ID,
        eventId: EVENT_ID,
        ticketId: 123,
        actionLink: `/events/${EVENT_ID}`,
        actionText: 'View Event'
      },
      timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(eventBookingNotification));
    console.log('Sent event booking notification');
    
    // Wait before sending the next notification
    setTimeout(() => {
      // Send event update notification
      const eventUpdateNotification = {
        type: 'event_notification',
        payload: {
          title: 'Event Update',
          message: 'The "Urban Dance Festival" location has been updated',
          userId: USER_ID,
          eventId: EVENT_ID,
          actionLink: `/events/${EVENT_ID}`,
          actionText: 'View Updates'
        },
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(eventUpdateNotification));
      console.log('Sent event update notification');
      
      // Close connection after all tests
      setTimeout(() => {
        ws.close();
        console.log('Test completed');
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

console.log('Starting WebSocket test for event notifications...');