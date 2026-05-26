import { verifyFirebaseToken } from "./firebase";
import { storage } from "./storage";

// Cache user lookups by Firebase UID for 60 seconds.
// Eliminates 2-3 DB queries on every repeated login within a session.
const userByUidCache = new Map<string, { user: any; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of userByUidCache) {
    if (v.expiresAt <= now) userByUidCache.delete(k);
  }
}, 60_000).unref();

/**
 * Verify Firebase ID token and return the decoded token
 */
export async function verifyFirebaseIdToken(idToken: string) {
  try {
    // Use the existing Firebase verification from firebase.ts
    const decodedToken = await verifyFirebaseToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("[Auth] Error verifying Firebase ID token:", error);
    throw new Error("Invalid or expired Firebase token");
  }
}

/**
 * Get or create a user by Firebase UID
 * This ensures users can log in even if they don't exist in our database yet
 */
export async function getOrCreateUserByFirebaseUid(firebaseUid: string, firebaseUserData?: {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  try {
    // Check user cache first (avoids DB round-trip on repeated logins within 60s)
    const now = Date.now();
    const cachedEntry = userByUidCache.get(firebaseUid);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return cachedEntry.user;
    }

    // Try to find existing user by Firebase UID
    let user = await storage.getUserByFirebaseUid(firebaseUid);
    
    if (user) {
      userByUidCache.set(firebaseUid, { user, expiresAt: now + 60_000 });
      return user;
    }
    
    // User doesn't exist by Firebase UID - check if email exists
    if (!firebaseUserData || !firebaseUserData.email) {
      throw new Error("Cannot create user without email");
    }
    
    console.log(`[Auth] Looking up user by email: ${firebaseUserData.email}`);
    user = await storage.getUserByEmail(firebaseUserData.email);
    
    if (user) {
      // User exists by email but no Firebase UID - update it
      const updatedUser = await storage.updateUser(user.id, {
        firebaseUid: firebaseUid,
        displayName: firebaseUserData.displayName || user.displayName,
        profilePicture: firebaseUserData.photoURL || user.profilePicture,
      });
      if (updatedUser) {
        userByUidCache.set(firebaseUid, { user: updatedUser, expiresAt: Date.now() + 60_000 });
        return updatedUser;
      }
      throw new Error("Failed to update user with Firebase UID");
    }
    
    // User doesn't exist - create one
    const newUserData = {
      email: firebaseUserData.email,
      displayName: firebaseUserData.displayName || `User_${Math.floor(Math.random() * 10000)}`,
      role: "user" as const,
      firebaseUid: firebaseUid,
      profilePicture: firebaseUserData.photoURL || null,
      password: null,
      bio: null,
      artType: null,
      organizationName: null,
      kvkNumber: null,
      btwNumber: null,
      kvkVerificationStatus: "pending" as const,
      kvkVerifiedAt: null,
      kvkVerificationFailReason: null,
      location: null,
      stripeCustomerId: null,
      status: "active" as const,
      tosAccepted: false,
      tosAcceptedAt: null,
      tosVersion: null,
    };
    
    user = await storage.createUser(newUserData);
    userByUidCache.set(firebaseUid, { user, expiresAt: Date.now() + 60_000 });
    return user;
  } catch (error) {
    console.error(`[Auth] Error in getOrCreateUserByFirebaseUid:`, error);
    throw error;
  }
}
