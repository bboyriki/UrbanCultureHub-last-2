// Simpler ES module-compliant test script for notifications
import WebSocket from 'ws';
// Use native fetch which is built into Node.js now
// No need to import

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

// Test function to log notifications
async function testNotifications() {
  console.log('Starting notification test...');
  
  // Create WebSocket connection to listen for notifications
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', function open() {
    console.log('WebSocket connection established');
    
    // Authenticate with fixed user ID 3
    const authMessage = {
      type: 'auth', // Server expects 'auth' or 'identify', not 'authenticate'
      userId: 3, // Using artist ID
      role: 'artist'
    };
    
    ws.send(JSON.stringify(authMessage));
  });
  
  // Listen for messages
  ws.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'notification') {
        console.log('🔔 NOTIFICATION RECEIVED:', JSON.stringify(message.data, null, 2));
      } else if (message.type === 'auth_success') {
        console.log('✅ WebSocket authentication successful');
        
        // After authentication, manually trigger a post like
        triggerLike();
      } else {
        console.log('📩 Other message:', message);
      }
    } catch (e) {
      console.error('Error parsing message:', e, data);
    }
  });
  
  // Set up error handler
  ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err);
  });
  
  // Set up close handler
  ws.on('close', function close() {
    console.log('WebSocket connection closed');
  });
}

// Function to trigger a like on a post
async function triggerLike() {
  try {
    console.log('Finding a post to like...');
    
    // First find posts
    const postsRes = await fetch(`${BASE_URL}/api/posts`);
    const posts = await postsRes.json();
    
    // Find an admin post (userId 9)
    const adminPost = posts.find(post => post.userId === 9);
    
    if (adminPost) {
      console.log(`Found admin post with ID ${adminPost.id}, creating like...`);
      
      // Create a like
      const likeRes = await fetch(`${BASE_URL}/api/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postId: adminPost.id,
          userId: 3 // Our test user
        })
      });
      
      const likeData = await likeRes.json();
      console.log('👍 Like created:', likeData);
      
      // Wait to see notification
      console.log('Waiting 5 seconds for notification...');
      setTimeout(() => {
        console.log('Test complete, closing connection');
        process.exit(0); // Force exit after test
      }, 5000);
    } else {
      console.log('No admin posts found to like, test failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error triggering like:', error);
    process.exit(1);
  }
}

// Run the test
testNotifications().catch(console.error);