/**
 * Test script to verify AI error handling.
 * This file can be run to simulate API key missing scenarios.
 */

async function testAIErrorHandling() {
  console.log('Testing AI error handling...');
  
  // Test endpoints
  const endpoints = [
    {
      url: '/api/ai/suggest-content',
      payload: {
        contentType: 'post',
        keywords: ['test', 'graffiti'],
        style: 'casual'
      }
    },
    {
      url: '/api/ai/analyze',
      payload: {
        text: 'This is a test of the content analysis feature.'
      }
    },
    {
      url: '/api/ai/recommendations',
      payload: {
        userInterests: ['graffiti', 'dance'],
        itemType: 'events',
        count: 3
      }
    },
    {
      url: '/api/ai/completion',
      payload: {
        prompt: 'Write a short description of urban art.',
        maxTokens: 100
      }
    }
  ];
  
  // Temporarily backup real API key
  const originalApiKey = process.env.OPENAI_API_KEY;
  
  try {
    // Test with API key present
    console.log('\nTesting with API key present:');
    for (const endpoint of endpoints) {
      await testEndpoint(endpoint.url, endpoint.payload, true);
    }
    
    // Test with API key missing
    console.log('\nTesting with API key missing:');
    process.env.OPENAI_API_KEY = '';
    for (const endpoint of endpoints) {
      await testEndpoint(endpoint.url, endpoint.payload, false);
    }
    
  } finally {
    // Restore API key
    process.env.OPENAI_API_KEY = originalApiKey;
  }
}

async function testEndpoint(url, payload, expectSuccess) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    if (expectSuccess && response.ok) {
      console.log(`✅ ${url}: Success (${response.status})`);
    } else if (!expectSuccess && response.status === 503 && data.error === 'OPENAI_API_KEY_MISSING') {
      console.log(`✅ ${url}: Correct error handling (${response.status}): ${data.message}`);
    } else {
      console.log(`❌ ${url}: Unexpected response: (${response.status})`, data);
    }
  } catch (error) {
    console.error(`❌ ${url}: Error:`, error.message);
  }
}

// This script can be run directly to test the error handling
// Note: This is for development purposes only
console.log('NOTE: This is a test script and not meant for production use.');
console.log('It will only work when run in an environment with the server running.');
console.log('To use: restart the server, then run this script to verify error handling behavior.');