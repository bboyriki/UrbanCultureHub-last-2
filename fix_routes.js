import fs from 'fs';

// Read the routes file
const routesFilePath = 'server/routes.ts';
const content = fs.readFileSync(routesFilePath, 'utf8');

// Define the sections to remove (from AI Integration to just before the httpServer)
const startMarker = '  // AI Integration Endpoints';
const endMarker = '  const httpServer = createServer(app);';

// Find the positions in the file
const startPos = content.indexOf(startMarker);
const endPos = content.indexOf(endMarker);

if (startPos !== -1 && endPos !== -1) {
  // Create the new content by removing the problematic section
  const newContent = content.slice(0, startPos) + content.slice(endPos);
  
  // Write back to the file
  fs.writeFileSync(routesFilePath, newContent);
  console.log('Successfully removed duplicate AI routes section');
} else {
  console.log('Could not find markers to safely remove code.');
  console.log('Start marker found:', startPos !== -1);
  console.log('End marker found:', endPos !== -1);
}