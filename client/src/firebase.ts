import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";

/**
 * Clean Firebase Configuration
 * Uses environment variables with VITE_ prefix (set during build)
 */
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId: projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Validate configuration
const isConfigured = (): boolean => {
  const required: (keyof FirebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter(key => !firebaseConfig[key]);
  
  if (missing.length > 0) {
    console.error('Firebase is NOT properly configured');
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    // Set persistence to LOCAL (user stays logged in after browser close)
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('[Firebase] Could not set persistence:', err);
    });
    
    console.log('Firebase initialized successfully');
    console.log('Auth Domain:', firebaseConfig.authDomain);
    console.log('Project ID:', firebaseConfig.projectId);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    console.error('Please verify all environment variables are set correctly');
  }
} else {
  console.error('Firebase authentication will NOT work!');
  console.error('Required environment variables (set during build):');
  console.error('  - VITE_FIREBASE_API_KEY');
  console.error('  - VITE_FIREBASE_AUTH_DOMAIN');
  console.error('  - VITE_FIREBASE_PROJECT_ID');
  console.error('  - VITE_FIREBASE_STORAGE_BUCKET');
  console.error('  - VITE_FIREBASE_MESSAGING_SENDER_ID');
  console.error('  - VITE_FIREBASE_APP_ID');
}

export { app, auth, googleProvider };
export default app;
