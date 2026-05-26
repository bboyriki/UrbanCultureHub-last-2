import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

/**
 * A wrapper component that conditionally renders children based on authentication status.
 * If requireAuth is true, it will only render children if the user is authenticated.
 * If requireAdmin is true, it will only render children if the user is an admin.
 * Otherwise, it renders a guest mode banner with login/signup button.
 */
export default function AuthWrapper({ 
  children, 
  requireAuth = false,
  requireAdmin = false,
  fallback 
}: AuthWrapperProps) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  // If loading, show nothing
  if (loading) {
    return null;
  }

  // If auth is required and user is not logged in, show login button or custom fallback
  if ((requireAuth || requireAdmin) && !user) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <h2 className="text-2xl font-bold text-center">
          {t("auth.requiredTitle")}
        </h2>
        <p className="text-center text-muted-foreground">
          {t("auth.requiredDescription")}
        </p>
        <Button onClick={() => navigate("/auth")}>
          {t("nav.signIn")}
        </Button>
      </div>
    );
  }

  // If admin is required and user is not admin, redirect to home
  if (requireAdmin && user?.role !== "admin" && user?.role !== "super_admin") {
    navigate("/");
    return null;
  }

  // If not requiring auth, or user is logged in, show children
  return (
    <>
      {/* Show guest mode banner when not authenticated */}
      {!user && !requireAuth && !requireAdmin && (
        <div className="bg-primary/10 p-3 flex flex-col sm:flex-row items-center justify-between rounded-lg mb-4">
          <div className="text-sm text-center sm:text-left mb-2 sm:mb-0">
            <span className="font-medium">{t("auth.guestMode")}</span>{" "}
            <span className="text-muted-foreground">{t("auth.guestModeDescription")}</span>
          </div>
          <Button size="sm" onClick={() => navigate("/auth")}>
            {t("nav.signIn")}
          </Button>
        </div>
      )}
      
      {children}
    </>
  );
}