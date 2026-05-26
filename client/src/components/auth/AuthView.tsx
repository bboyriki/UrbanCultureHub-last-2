import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

const AuthView = () => {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isDarkMode } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    if (user) setLocation("/map");
  }, [user, setLocation]);

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ minHeight: '100dvh' }}
    >
      {/* Top branding area */}
      <div className="flex-shrink-0 pt-10 pb-6 px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </motion.div>
        <motion.h1
          className="font-heading text-3xl font-bold mb-1"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          Urban<span className="text-primary">Culture</span>
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {t("app.tagline")}
        </motion.p>
      </div>

      {/* Main card — fills remaining space, scrollable */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex-1 bg-card border-t border-border rounded-t-3xl px-5 pt-5 pb-8 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Drag handle hint */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
          {(['login', 'signup'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAuthMode(mode)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                authMode === mode
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'login' ? t("auth.signIn") : t("auth.signUp")}
            </button>
          ))}
        </div>

        {/* Form content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={authMode}
            initial={{ opacity: 0, x: authMode === "login" ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: authMode === "login" ? 16 : -16 }}
            transition={{ duration: 0.2 }}
          >
            {authMode === "login" ? <LoginForm /> : <SignupForm />}
          </motion.div>
        </AnimatePresence>

        {/* Explore without account */}
        <button
          className="w-full mt-5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          onClick={() => setLocation("/explore")}
        >
          {t("explore.title")} →
        </button>
      </motion.div>
    </div>
  );
};

export default AuthView;
