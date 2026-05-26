import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmail, signInWithGoogle, getFirebaseToken, sendPasswordReset } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest } from "@/lib/queryClient";
import { isIOSNativeApp } from "@/lib/platformDetect";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type FormValues = z.infer<typeof formSchema>;

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setUser } = useAuth();
  const { isDarkMode } = useTheme();
  const isIOS = isIOSNativeApp();
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange", // Enable real-time validation
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);

    try {
      // Step 1: Sign in with Firebase
      console.log("[LoginForm] Authenticating with Firebase...");
      const firebaseUser = await signInWithEmail(values.email, values.password);
      console.log("[LoginForm] Firebase authentication successful, UID:", firebaseUser.uid);

      // Step 2: Get Firebase ID token
      console.log("[LoginForm] Getting Firebase ID token...");
      const idToken = await firebaseUser.getIdToken();
      console.log("[LoginForm] Firebase ID token obtained");

      // Step 3: Call backend login endpoint
      console.log("[LoginForm] Calling backend /api/auth/login...");
      const response = await apiRequest("/api/auth/login", "POST", {
        idToken,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });

      const data = await response.json();
      console.log("[LoginForm] Backend authentication successful, user:", data.user.id);

      // Step 4: Set user state and redirect
      setUser({ ...data.user, firebaseUser });
      setLocation("/map");

      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.displayName}!`,
      });
    } catch (error: any) {
      console.error("[LoginForm] Error:", error);

      let errorTitle = "Login failed";
      let errorMessage = "Please check your credentials and try again.";

      // Handle service unavailable (503) - authentication system not configured
      if (error.status === 503) {
        errorTitle = "Service unavailable";
        errorMessage = "The authentication service is not properly configured. Please contact the administrator.";
      }
      // Handle invalid credentials (401)
      else if (error.status === 401 || error.message?.includes("Invalid or expired")) {
        errorTitle = "Invalid credentials";
        errorMessage = "The email or password you entered is incorrect. Please try again.";
      }
      // Handle Firebase auth errors with specific messages from authService
      else if (error.message?.includes("No account found")) {
        errorTitle = "Account not found";
        errorMessage = "No account exists with this email. Would you like to sign up instead?";
      }
      else if (error.message?.includes("Incorrect password") || error.code === "auth/wrong-password") {
        errorTitle = "Incorrect password";
        errorMessage = "The password you entered is incorrect. Please try again or reset your password.";
      }
      else if (error.message?.includes("Too many") || error.code === "auth/too-many-requests") {
        setIsLockedOut(true);
        return;
      }
      else if (error.message?.includes("disabled") || error.code === "auth/user-disabled") {
        errorTitle = "Account disabled";
        errorMessage = "This account has been disabled. Please contact support for assistance.";
      }
      else if (error.message?.includes("network") || error.message?.includes("Network") || error.code === "auth/network-request-failed") {
        errorTitle = "Connection error";
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      }
      // Handle generic server errors (500)
      else if (error.status === 500) {
        errorTitle = "Server error";
        errorMessage = "Something went wrong on our end. Please try again in a few moments.";
      }
      // Use the error message from authService if available
      else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      console.log("[LoginForm] Initiating Google Sign-In...");
      const firebaseUser = await signInWithGoogle();
      console.log("[LoginForm] Google sign-in successful, UID:", firebaseUser.uid);

      // Get Firebase ID token
      console.log("[LoginForm] Getting Firebase ID token...");
      const idToken = await getFirebaseToken(true);
      if (!idToken) {
        throw new Error("Could not get Firebase token");
      }
      console.log("[LoginForm] Firebase ID token obtained");

      // Call backend login endpoint
      console.log("[LoginForm] Calling backend /api/auth/login...");
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();
      console.log("[LoginForm] Backend authentication successful, user:", data.user.id);

      // Set user state and redirect
      setUser({ ...data.user, firebaseUser });
      setLocation("/map");

      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.displayName}!`,
      });
    } catch (error: any) {
      console.error("[LoginForm] Google Sign-In error:", error);

      let errorTitle = "Google Sign-In Failed";
      let errorMessage = "Unable to sign in with Google. Please try again.";

      // Handle specific Google sign-in errors
      if (error.message?.includes("cancelled") || error.message?.includes("popup-closed") || error.code === "auth/popup-closed-by-user") {
        errorTitle = "Sign-in cancelled";
        errorMessage = "You closed the sign-in window. Please try again when you're ready.";
      } else if (error.message?.includes("unauthorized") || error.message?.includes("unauthorized-domain") || error.code === "auth/unauthorized-domain") {
        errorTitle = "Domain not authorized";
        errorMessage = "This website is not authorized for Google Sign-In. Please contact support.";
      } else if (error.message?.includes("blocked") || error.message?.includes("popup-blocked") || error.code === "auth/popup-blocked") {
        errorTitle = "Pop-up blocked";
        errorMessage = "Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.";
      } else if (error.message?.includes("one sign-in popup") || error.code === "auth/cancelled-popup-request") {
        errorTitle = "Multiple sign-ins";
        errorMessage = "Please close other sign-in windows and try again.";
      } else if (error.message?.includes("different sign-in method") || error.code === "auth/account-exists-with-different-credential") {
        errorTitle = "Account exists";
        errorMessage = "An account with this email already exists using a different sign-in method. Please use email/password login.";
      } else if (error.message?.includes("network") || error.message?.includes("Network") || error.code === "auth/network-request-failed") {
        errorTitle = "Connection error";
        errorMessage = "Unable to connect to Google. Please check your internet connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1 
      } 
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    }
  };

  const buttonVariants = {
    idle: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.98 }
  };

  const handleSendReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({ title: "Enter your email first", description: "Type your email in the field above, then click reset.", variant: "destructive" });
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      toast({ title: "Reset email sent!", description: `Check ${email} for a password reset link.` });
    } catch {
      toast({ title: "Could not send reset email", description: "Please try Sign in with Google instead.", variant: "destructive" });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <Form {...form}>
      <motion.form 
        onSubmit={form.handleSubmit(onSubmit)} 
        className="space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {isLockedOut && (
          <motion.div variants={itemVariants}>
            <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Account temporarily locked</p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Too many failed attempts. Try one of the options below to get back in.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950"
                  onClick={handleSendReset}
                  disabled={isSendingReset}
                  data-testid="button-send-reset-lockout"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSendingReset ? "animate-spin" : ""}`} />
                  {isSendingReset ? "Sending..." : "Send password reset email"}
                </Button>
                {!isIOS && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                    data-testid="button-google-signin-lockout"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {isGoogleLoading ? "Signing in..." : "Sign in with Google instead"}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Email
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="your.email@example.com" 
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isLoading}
                    className={`h-12 text-base ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400' : ''}`}
                    {...field} 
                    ref={(e) => {
                      field.ref(e);
                      if (e) emailInputRef.current = e;
                    }}
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="••••••••" 
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={isLoading}
                      className={`h-12 text-base pr-11 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400' : ''}`}
                      {...field} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <div className="text-sm mt-1">
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className={`text-primary hover:underline transition-colors ${isDarkMode ? 'text-opacity-90 hover:text-opacity-100' : ''}`}
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <motion.div
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <Button 
              type="submit" 
              className="w-full h-11 font-medium text-base" 
              disabled={isLoading || isLockedOut}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </div>
              ) : "Login"}
            </Button>
          </motion.div>
        </motion.div>
        
        {!isIOS && (
          <>
            <motion.div variants={itemVariants} className="relative">
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                <span className="px-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-transparent">Or</span>
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-medium text-base flex items-center justify-center gap-2"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                data-testid="button-google-signin"
              >
                <Mail className="w-4 h-4" />
                {isGoogleLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : "Sign in with Google"}
              </Button>
            </motion.div>
          </>
        )}
      </motion.form>
    </Form>
  );
};

export default LoginForm;
