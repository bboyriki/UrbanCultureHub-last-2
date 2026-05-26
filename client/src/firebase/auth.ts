import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Sign up a new user with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string,
  role: string,
  artType?: string
): Promise<FirebaseUser> => {
  try {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    console.log("[Auth] Creating user account with Firebase...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("[Auth] User created successfully:", user.uid);

    // Send email verification
    try {
      console.log("[Auth] Sending email verification...");
      await sendEmailVerification(user);
      console.log("[Auth] Verification email sent");
    } catch (verifyError) {
      console.warn("[Auth] Could not send verification email:", verifyError);
    }

    return user;
  } catch (error: unknown) {
    console.error("[Auth] Signup error:", error);
    throw error;
  }
};

/**
 * Sign in user with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<FirebaseUser> => {
  try {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    console.log("[Auth] Signing in with email...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("[Auth] Login successful:", user.uid);

    // Set persistence to LOCAL (stays logged in even after browser close)
    try {
      await setPersistence(auth, browserLocalPersistence);
      console.log("[Auth] Session persistence enabled");
    } catch (persistError) {
      console.warn("[Auth] Could not set persistence:", persistError);
    }

    return user;
  } catch (error: unknown) {
    console.error("[Auth] Login error:", error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    if (!auth) {
      console.warn("[Auth] Firebase Auth is not initialized");
      return;
    }

    console.log("[Auth] Signing out...");
    await firebaseSignOut(auth);
    console.log("[Auth] User signed out successfully");
  } catch (error: unknown) {
    console.error("[Auth] Signout error:", error);
    throw error;
  }
};

/**
 * Get the currently logged-in user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  if (!auth) {
    return null;
  }
  return auth.currentUser;
};

/**
 * Send a password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    console.log("[Auth] Sending password reset email...");
    await sendPasswordResetEmail(auth, email);
    console.log("[Auth] Password reset email sent");
  } catch (error: unknown) {
    console.error("[Auth] Password reset error:", error);
    throw error;
  }
};

/**
 * Get the Firebase ID token for the current user
 */
export const getFirebaseToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  try {
    if (!auth || !auth.currentUser) {
      return null;
    }

    console.log("[Auth] Getting Firebase ID token...");
    const token = await auth.currentUser.getIdToken(forceRefresh);
    return token;
  } catch (error: unknown) {
    console.error("[Auth] Error getting Firebase token:", error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isUserAuthenticated = (): boolean => {
  if (!auth) {
    return false;
  }
  return auth.currentUser !== null;
};
