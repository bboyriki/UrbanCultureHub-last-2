import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { subscribeToAuthState, signOutUser, getFirebaseToken } from "@/services/authService";
import { User } from "@shared/schema";

interface AuthContextType {
  user: (User & { firebaseUser?: FirebaseUser }) | null;
  setUser: (user: (User & { firebaseUser?: FirebaseUser }) | null) => void;
  loading: boolean;
  token: string | null;
  getToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  loading: true,
  token: null,
  getToken: async () => null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<(User & { firebaseUser?: FirebaseUser }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  /**
   * Get a fresh Firebase ID token
   */
  const getToken = async (): Promise<string | null> => {
    try {
      console.log("[AuthContext] Getting fresh Firebase ID token...");
      const idToken = await getFirebaseToken(true);
      if (idToken) {
        console.log("[AuthContext] Got fresh Firebase ID token");
        setToken(idToken);
      }
      return idToken;
    } catch (error) {
      console.error("[AuthContext] Error getting Firebase token:", error);
      return null;
    }
  };

  /**
   * Logout handler
   */
  const logout = async (): Promise<void> => {
    try {
      console.log("[AuthContext] Logging out...");
      // Try to sign out from Firebase, but don't fail if it doesn't work
      try {
        await signOutUser();
        console.log("[AuthContext] Firebase sign out successful");
      } catch (firebaseError) {
        console.warn("[AuthContext] Firebase sign out failed (non-blocking):", firebaseError);
        // Continue with local cleanup even if Firebase sign out fails
      }
      
      // Always clear local state
      console.log("[AuthContext] Clearing local auth state...");
      setUser(null);
      setToken(null);
      localStorage.removeItem("userId");
      localStorage.removeItem("user");
      localStorage.removeItem("authToken");
      window.__URBAN_CULTURE_USER__ = undefined;
      console.log("[AuthContext] Logout successful - all local state cleared");
    } catch (error) {
      console.error("[AuthContext] Unexpected logout error:", error);
      // Clear state anyway on unexpected error
      setUser(null);
      setToken(null);
      localStorage.clear();
      throw error;
    }
  };

  /**
   * Watch for Firebase auth state changes
   */
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Get fresh token
          const idToken = await getFirebaseToken(true);
          if (idToken) {
            setToken(idToken);
          }

          // Call login endpoint to establish session AND get user profile.
          // Token is sent in the Authorization header — not in the request body —
          // to prevent it from appearing in server logs or request body serialisers.
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
            }),
          });

          if (loginResponse.ok) {
            const { user: userProfile } = await loginResponse.json();

            const combinedUser = { ...userProfile, firebaseUser };
            setUser(combinedUser);

            // Store only non-sensitive display data in localStorage.
            // Role is intentionally excluded — all authorization checks happen server-side.
            if (userProfile.id) {
              localStorage.setItem("userId", userProfile.id.toString());
              localStorage.setItem(
                "user",
                JSON.stringify({
                  id: userProfile.id,
                  displayName: userProfile.displayName,
                })
              );

              // Global scope for WebSocket (display data only, not role)
              window.__URBAN_CULTURE_USER__ = {
                id: userProfile.id,
                role: userProfile.role, // kept for runtime UI gating only — not persisted
                displayName: userProfile.displayName,
              };
            }
          } else {
            // Fallback: fetch user profile without session
            const response = await fetch(`/api/users/firebase/${firebaseUser.uid}`);
            if (response.ok) {
              const userProfile = await response.json();
              const combinedUser = { ...userProfile, firebaseUser };
              setUser(combinedUser);
              if (userProfile.id) {
                localStorage.setItem("userId", userProfile.id.toString());
                localStorage.setItem("user", JSON.stringify({ id: userProfile.id, displayName: userProfile.displayName }));
                window.__URBAN_CULTURE_USER__ = {
                  id: userProfile.id,
                  role: userProfile.role,
                  displayName: userProfile.displayName,
                };
              }
            } else {
              setUser(null);
              localStorage.removeItem("userId");
              localStorage.removeItem("user");
            }
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem("userId");
          localStorage.removeItem("user");
          window.__URBAN_CULTURE_USER__ = undefined;
        }
      } catch (error) {
        console.error("[AuthContext] Error during auth state change:", error);
        setUser(null);
        setToken(null);
        localStorage.removeItem("user");
        window.__URBAN_CULTURE_USER__ = undefined;
      } finally {
        setLoading(false);
      }
    });

    return () => {
      console.log("[AuthContext] Cleaning up Firebase auth listener");
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, token, getToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
