import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  onAuthStateChanged,
  getIdToken,
  User as FirebaseUser,
  Unsubscribe,
} from "firebase/auth";
import { auth, googleProvider } from "@/firebase";

/**
 * Sign up a new user with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string,
  role: string,
  artType: string | null = null
): Promise<FirebaseUser> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Check your configuration.");
  }

  try {
    console.log("[AuthService] Creating Firebase account...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("[AuthService] Account created successfully, UID:", user.uid);

    // Send email verification
    try {
      console.log("[AuthService] Sending verification email...");
      await sendEmailVerification(user);
      console.log("[AuthService] Verification email sent successfully");
    } catch (err: any) {
      console.warn("[AuthService] Could not send verification email:", err.message);
      // Don't fail signup if verification email fails
    }

    return user;
  } catch (error: any) {
    console.error("[AuthService] Signup error:", error.code, error.message);
    
    // Map Firebase error codes to user-friendly messages
    if (error.code === "auth/email-already-in-use") {
      throw new Error("An account with this email already exists. Please sign in instead.");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password is too weak. Use at least 6 characters with uppercase, lowercase, and numbers.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (error.code === "auth/operation-not-allowed") {
      throw new Error("Email/password sign up is not enabled. Please contact support.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.");
    }
    
    throw new Error(error.message || "An unexpected error occurred during signup. Please try again.");
  }
};

/**
 * Sign in user with email and password
 */
export const signInWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Check your configuration.");
  }

  try {
    console.log("[AuthService] Signing in with email...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log("[AuthService] Login successful, UID:", user.uid);
    return user;
  } catch (error: any) {
    console.error("[AuthService] Login error:", error.code, error.message);
    
    // Map Firebase error codes to user-friendly messages
    if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email address. Please sign up first.");
    } else if (error.code === "auth/wrong-password") {
      throw new Error("Incorrect password. Please try again or reset your password.");
    } else if (error.code === "auth/invalid-credential") {
      throw new Error("Invalid email or password. Please check your credentials and try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed login attempts. Please wait a few minutes and try again.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (error.code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Please contact support.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.");
    }
    
    throw new Error(error.message || "An unexpected error occurred during login. Please try again.");
  }
};

/**
 * Sign in user with Google
 */
export const signInWithGoogle = async (): Promise<FirebaseUser> => {
  if (!auth || !googleProvider) {
    throw new Error("Firebase Auth is not initialized. Check your configuration.");
  }

  try {
    console.log("[AuthService] Initiating Google Sign-In...");
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    console.log("[AuthService] Google login successful, UID:", user.uid);
    return user;
  } catch (error: any) {
    console.error("[AuthService] Google login error:", error.code, error.message);
    
    // Handle common Google Sign-In errors
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in was cancelled. Please try again.");
    } else if (error.code === "auth/popup-blocked") {
      throw new Error("Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.");
    } else if (error.code === "auth/unauthorized-domain") {
      throw new Error("This domain is not authorized for Google Sign-In. Please contact support.");
    } else if (error.code === "auth/cancelled-popup-request") {
      throw new Error("Only one sign-in popup can be open at a time.");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your internet connection and try again.");
    } else if (error.code === "auth/account-exists-with-different-credential") {
      throw new Error("An account already exists with this email using a different sign-in method.");
    }
    
    throw new Error(error.message || "Google Sign-In failed. Please try again.");
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
  if (!auth) {
    console.warn("[AuthService] Firebase Auth is not initialized");
    return;
  }

  try {
    console.log("[AuthService] Signing out...");
    await firebaseSignOut(auth);
    console.log("[AuthService] Sign out successful");
  } catch (error: any) {
    console.error("[AuthService] Sign out error:", error);
    throw new Error("Failed to sign out. Please try again.");
  }
};

/**
 * Subscribe to auth state changes
 */
export const subscribeToAuthState = (callback: (user: FirebaseUser | null) => void): Unsubscribe => {
  if (!auth) {
    console.warn("[AuthService] Firebase Auth is not initialized");
    callback(null);
    return () => {};
  }

  console.log("[AuthService] Setting up auth state listener...");
  return onAuthStateChanged(auth, callback);
};

/**
 * Get the currently logged-in user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth ? auth.currentUser : null;
};

/**
 * Get Firebase ID token for current user
 */
export const getFirebaseToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  if (!auth || !auth.currentUser) {
    console.log("[AuthService] No current user, cannot get token");
    return null;
  }

  try {
    console.log("[AuthService] Getting Firebase ID token...");
    const token = await getIdToken(auth.currentUser, forceRefresh);
    return token;
  } catch (error: any) {
    console.error("[AuthService] Error getting Firebase token:", error);
    return null;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }

  try {
    console.log("[AuthService] Sending password reset email...");
    await sendPasswordResetEmail(auth, email);
    console.log("[AuthService] Password reset email sent successfully");
  } catch (error: any) {
    console.error("[AuthService] Password reset error:", error);
    
    if (error.code === "auth/user-not-found") {
      throw new Error("No account found with this email address.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many requests. Please wait a few minutes and try again.");
    }
    
    throw new Error(error.message || "Failed to send password reset email. Please try again.");
  }
};

/**
 * Check if user is authenticated
 */
export const isUserAuthenticated = (): boolean => {
  return auth !== null && auth.currentUser !== null;
};
