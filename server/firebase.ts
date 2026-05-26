import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import * as z from "zod";
import * as dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Define the shape of the decoded token using zod
export const decodedTokenSchema = z.object({
  uid: z.string(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
  auth_time: z.number().optional(),
  user_id: z.string().optional(),
  sub: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  firebase: z
    .object({
      identities: z.record(z.array(z.string())).optional(),
      sign_in_provider: z.string().optional(),
    })
    .optional(),
});

export type DecodedToken = z.infer<typeof decodedTokenSchema>;

// Initialize Firebase Admin SDK
let firebaseAdminInitialized = false;
let initializationError: Error | null = null;

/**
 * Load Firebase service account credentials from multiple sources
 * Priority: process.env → fallback mechanisms
 */
function loadFirebaseCredentials(): ServiceAccount | null {
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!envVar) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT not found in environment variables");
    console.error("📋 Available env vars containing 'FIREBASE':", 
      Object.keys(process.env).filter(k => k.includes('FIREBASE')).join(', ') || 'none'
    );
    console.error("📋 All env vars:", Object.keys(process.env).length);
    return null;
  }
  
  try {
    console.log("✅ FIREBASE_SERVICE_ACCOUNT found, parsing JSON...");
    const parsed = JSON.parse(envVar);
    
    // Validate required fields (Google uses snake_case in service account JSON)
    const projectId = parsed.project_id || parsed.projectId;
    const privateKey = parsed.private_key || parsed.privateKey;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    
    if (!projectId || !privateKey || !clientEmail) {
      console.error("Service account structure:", Object.keys(parsed).join(', '));
      throw new Error("Service account JSON is missing required fields (project_id/projectId, private_key/privateKey, or client_email/clientEmail)");
    }
    
    console.log("✅ Service account credentials validated successfully");
    console.log(`📧 Service account email: ${clientEmail}`);
    console.log(`🔑 Project ID: ${projectId}`);
    
    return parsed as ServiceAccount;
  } catch (parseError) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", parseError);
    if (parseError instanceof Error) {
      console.error("Parse error details:", parseError.message);
    }
    return null;
  }
}

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return;
  }

  try {
    console.log("🔥 Starting Firebase Admin SDK initialization...");
    
    const serviceAccount = loadFirebaseCredentials();
    
    if (!serviceAccount) {
      const errorMsg = "CRITICAL: Firebase credentials not available. Authentication will not work.";
      console.error(`❌ ${errorMsg}`);
      initializationError = new Error(errorMsg);
      
      // FAIL FAST in production - throw to prevent server from starting without auth
      if (process.env.NODE_ENV === 'production') {
        console.error("🛑 Production deployment CANNOT start without Firebase credentials");
        throw initializationError;
      }
      
      console.warn("⚠️  Development mode: Server will start but authentication will fail");
      return;
    }

    // Initialize the app with credentials
    initializeApp({
      credential: cert(serviceAccount),
    });
    
    firebaseAdminInitialized = true;
    initializationError = null;
    console.log("✅ Firebase Admin SDK initialized successfully");
    console.log("✅ Authentication system is READY");
  } catch (error) {
    console.error("❌ FATAL: Error initializing Firebase Admin SDK:", error);
    initializationError = error instanceof Error ? error : new Error(String(error));
    
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      if ('stack' in error) {
        console.error("Stack trace:", error.stack);
      }
    }
    
    // FAIL FAST - re-throw to prevent server startup
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

/**
 * Get Firebase initialization status
 * @returns Object with initialization status and any error
 */
export function getFirebaseStatus() {
  return {
    initialized: firebaseAdminInitialized,
    error: initializationError?.message || null,
  };
}

// Initialize Firebase on module load for better error visibility
console.log("🔥 Initializing Firebase Admin SDK at startup...");
initializeFirebaseAdmin();

// Token verification cache — avoids repeated network calls to Google for the same token.
// Firebase tokens are valid for 1 hour; we cache for 4 minutes to stay safely within that window.
// Key: SHA-256 hash of the token (NEVER the raw token) so a heap dump can't leak credentials.
const tokenVerifyCache = new Map<string, { decoded: DecodedToken; expiresAt: number }>();
function tokenCacheKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Periodically clean up expired entries so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tokenVerifyCache) {
    if (v.expiresAt <= now) tokenVerifyCache.delete(k);
  }
}, 5 * 60 * 1000).unref();

/**
 * Verify a Firebase token
 * Cached for 4 minutes per token to eliminate repeated network round-trips to Google.
 * @param token Firebase ID token to verify
 * @returns The decoded token information
 */
export async function verifyFirebaseToken(token: string): Promise<DecodedToken> {
  try {
    // Return cached result if still valid
    const now = Date.now();
    const cacheKey = tokenCacheKey(token);
    const cached = tokenVerifyCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.decoded;
    }

    // Check if Firebase Admin SDK is initialized
    if (!firebaseAdminInitialized) {
      console.error("CRITICAL: Firebase Admin SDK not initialized - cannot verify tokens");
      if (initializationError) {
        throw new Error(`Authentication service unavailable: ${initializationError.message}`);
      }
      throw new Error("Authentication service unavailable - Firebase not initialized");
    }

    // Verify with Firebase Admin SDK (network call to Google — ~300-800ms)
    const decodedToken = await getAuth().verifyIdToken(token);
    const parsed = decodedTokenSchema.parse(decodedToken);

    // Cache the result for 4 minutes (keyed by hash, not raw token)
    tokenVerifyCache.set(cacheKey, { decoded: parsed, expiresAt: now + 4 * 60 * 1000 });

    return parsed;
  } catch (error: any) {
    console.error("[Firebase] Token verification error:", error.message);
    if (error.message?.includes("Authentication service unavailable")) {
      throw error;
    }
    throw new Error("Invalid or expired token");
  }
}