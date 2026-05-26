import { useEffect } from "react";
import { useLocation } from "wouter";
import AuthView from "@/components/auth/AuthView";
import { useAuth } from "@/contexts/AuthContext";

const Auth = () => {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !loading) {
      // Redirect to map if already authenticated
      setLocation("/map");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-dark mb-2">
            Urban<span className="text-primary">Culture</span>
          </h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  return <AuthView />;
};

export default Auth;
