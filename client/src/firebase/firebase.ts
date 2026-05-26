import { initializeApp, FirebaseApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.appId;

// Initialize Firebase only if configured (handle hot reload duplicate app)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    // Check if app already exists (for hot reload scenarios)
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    db = getFirestore(app);
    console.log("✅ Firebase initialized successfully");
    console.log("📧 Auth Domain:", firebaseConfig.authDomain);
    console.log("🔑 Project ID:", firebaseConfig.projectId);
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
  }
} else {
  console.error("❌ Firebase is NOT configured!");
  console.error("📋 Missing environment variables:");
  if (!import.meta.env.VITE_FIREBASE_API_KEY) console.error("  - VITE_FIREBASE_API_KEY");
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) console.error("  - VITE_FIREBASE_PROJECT_ID");
  if (!import.meta.env.VITE_FIREBASE_APP_ID) console.error("  - VITE_FIREBASE_APP_ID");
  console.error("⚠️  Authentication will NOT work!");
}

export { auth, storage, db };
export default app;
