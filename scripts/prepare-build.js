#!/usr/bin/env node

/**
 * Pre-build script to generate .env.production from secrets
 * This ensures Vite has access to VITE_* environment variables during build
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envProductionPath = path.join(rootDir, '.env.production');

console.log('🔧 Preparing production environment variables for Vite build...');

// These Firebase values are safe to expose in client-side code
// They are NOT sensitive - Firebase uses them for client initialization
const envVars = {
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
  VITE_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY,
  VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY,
};

// Check which variables are available
const missingVars = [];
const availableVars = [];

for (const [key, value] of Object.entries(envVars)) {
  if (value) {
    availableVars.push(key);
  } else {
    missingVars.push(key);
  }
}

console.log('✅ Available environment variables:', availableVars.length);
console.log('⚠️  Missing environment variables:', missingVars.length);

if (missingVars.length > 0) {
  console.warn('⚠️  Warning: The following environment variables are not set:');
  missingVars.forEach(key => console.warn(`   - ${key}`));
}

// Generate .env.production file
const envContent = Object.entries(envVars)
  .filter(([_, value]) => value) // Only include vars that have values
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

const fileContent = `# Auto-generated from secrets during build - DO NOT COMMIT
# Generated at: ${new Date().toISOString()}
${envContent}
`;

try {
  fs.writeFileSync(envProductionPath, fileContent, 'utf8');
  console.log('✅ Created .env.production file successfully');
  console.log('📁 Location:', envProductionPath);
  console.log('📝 Variables written:', availableVars.length);
} catch (error) {
  console.error('❌ Failed to create .env.production file:', error);
  process.exit(1);
}

console.log('✅ Build preparation complete!');
