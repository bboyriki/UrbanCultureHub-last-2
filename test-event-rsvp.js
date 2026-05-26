/**
 * Test script for event RSVP notifications
 * Run with: node test-event-rsvp.js
 */
import WebSocket from 'ws';

// Connection details
const BASE_URL = process.env.BASE_URL || 'ws://localhost:5000/ws';

// Test data - replace with actual IDs from your database
const USER_ID = 3;           // The user RSVPing to the event
const EVENT_ID = 1;          // The event being RSVPed to
const ORGANIZER_ID = 9;      // The event organizer who will receive the notification
const RSVP_STATUS = 'going'; // The RSVP status (going, maybe, not_going)

// Connect to WebSocket server
const socket = new WebSocket(BASE_URL);

socket.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // First authenticate
  authenticate();
  
  // Wait a moment for authentication to process
  setTimeout(() => {
    sendEventRsvpNotification();
  }, 1000);
});

socket.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('Received message:', message);
    
    // Handle response
    if (message.type === 'EVENT_RSVP' || message.type === 'event_rsvp' || 
        message.type.includes('rsvp') || message.type.includes('event')) {
      console.log('Successfully sent event RSVP notification!');
      
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

// Function to simulate an event RSVP notification
function sendEventRsvpNotification() {
  const rsvpData = {
    type: 'EVENT_RSVP',
    payload: {
      eventId: EVENT_ID,
      userId: USER_ID,
      organizerId: ORGANIZER_ID,
      status: RSVP_STATUS,
      message: `User ${USER_ID} is ${RSVP_STATUS} to your event`,
      timestamp: new Date().toISOString(),
      actionLink: `/events/${EVENT_ID}`,
      targetType: 'event',
      targetId: EVENT_ID
    }
  };
  
  socket.send(JSON.stringify(rsvpData));
  console.log('Sent event RSVP notification request');
}