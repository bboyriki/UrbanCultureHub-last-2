/**
 * Test script for AI assistant file analysis and model switching
 * This script tests the admin AI assistant's capabilities with file path analysis and model selection
 */

async function testFileAnalysis() {
  console.log('Testing AI assistant file analysis and model switching...');
  
  const testFilePath = '/client/src/components/admin/AdminAiAssistant.tsx';
  
  // Test OpenAI model
  await testAiAssistantWithFile('openai', testFilePath);
  
  // Test Claude model
  await testAiAssistantWithFile('anthropic', testFilePath);
}

async function testAiAssistantWithFile(modelType, filePath) {
  console.log(`\nTesting file analysis with model: ${modelType}`);
  
  try {
    // 1. First, get the file content (the actual API will do this on the server side)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
    const fileContentResponse = await fetch(`${baseUrl}/api/admin/files/content?path=${encodeURIComponent(filePath)}`);
    
    if (!fileContentResponse.ok) {
      throw new Error(`Could not retrieve file content: ${fileContentResponse.status}`);
    }
    
    const fileContent = await fileContentResponse.text();
    console.log(`Retrieved file content: ${fileContent.length} characters`);
    
    // 2. Now analyze the file with the selected model
    const analysisResponse = await fetch(`${baseUrl}/api/admin/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: `Analyze this file: ${filePath}\n\nPlease identify any code quality issues or potential bugs.`,
        adminId: 9, // Admin ID for testing
        sessionId: `test_session_${Date.now()}`,
        code: fileContent,
        language: filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        filePath: filePath,
        stream: false,
        modelType: modelType
      })
    });
    
    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      throw new Error(`API error (${analysisResponse.status}): ${JSON.stringify(errorData)}`);
    }
    
    const result = await analysisResponse.text();
    console.log(`✅ File analysis successful with ${modelType} model`);
    console.log(`Response length: ${result.length} characters`);
    console.log(`First 150 characters: ${result.substring(0, 150)}...`);
    
  } catch (error) {
    console.error(`❌ Error testing file analysis with ${modelType}:`, error.message);
  }
}

// Run the tests
console.log('NOTE: This test script requires admin privileges to run.');
console.log('Make sure you are logged in as an admin before running this test.');
testFileAnalysis();