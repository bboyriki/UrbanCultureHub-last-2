/**
 * Test script to verify event RSVP notifications
 * 
 * This script simulates a user RSVPing to an event to test the notification
 * functionality for event organizers.
 */
import axios from 'axios';

// Configuration
const API_URL = 'http://localhost:5000';
const EVENT_ID = 8; // Use an existing event ID for "Amsterdam 750" (organizer ID: 1)
const USER_ID = 10;  // Use user ID 10 "Maestro Barto" who has not yet RSVPed to this event
const RSVP_STATUS = 'going'; // 'going', 'maybe', or 'not going'

// Create RSVP and test notification
async function testRsvpNotification() {
  try {
    console.log(`Creating RSVP for user ${USER_ID} for event ${EVENT_ID} with status "${RSVP_STATUS}"...`);
    
    // Send RSVP request
    const response = await axios.post(`${API_URL}/api/rsvps`, {
      userId: USER_ID,
      eventId: EVENT_ID,
      status: RSVP_STATUS
    });
    
    console.log('RSVP created successfully!');
    console.log('Response:', response.data);
    console.log('\n✅ RSVP notification test complete');
    
    console.log('\nA notification should have been sent to the event organizer');
    console.log('Check the notifications panel in the app for the event organizer to confirm');
  } catch (error) {
    console.error('Error sending RSVP:', error.response?.data || error.message);
  }
}

// Run the test
testRsvpNotification();