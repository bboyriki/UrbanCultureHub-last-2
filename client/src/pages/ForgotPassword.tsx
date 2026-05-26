import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendPasswordReset } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Mail } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type FormValues = z.infer<typeof formSchema>;

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isDarkMode } = useTheme();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    
    try {
      await sendPasswordReset(values.email);
      setEmailSent(true);
      toast({
        title: "Password reset email sent",
        description: "Check your email for instructions to reset your password.",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast({
        title: "Failed to send reset email",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1,
      y: 0,
      transition: { 
        duration: 0.5,
        ease: "easeOut"
      } 
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'}`}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        <Card className={isDarkMode ? 'bg-gray-800 border-gray-700' : ''}>
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/auth")}
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </div>
            <CardTitle className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {emailSent ? "Check your email" : "Forgot your password?"}
            </CardTitle>
            <CardDescription className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              {emailSent 
                ? "We've sent password reset instructions to your email address."
                : "Enter your email address and we'll send you instructions to reset your password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                          Email
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <Input 
                              placeholder="your.email@example.com" 
                              type="email" 
                              disabled={isLoading}
                              className={`h-11 pl-10 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400' : ''}`}
                              data-testid="input-reset-email"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 font-medium text-base" 
                    disabled={isLoading}
                    data-testid="button-send-reset-email"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </div>
                    ) : "Send reset instructions"}
                  </Button>

                  <div className="text-center mt-4">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setLocation("/auth")}
                      className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}
                      data-testid="link-back-to-login"
                    >
                      Back to login
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                    If an account exists with the email <strong>{form.getValues("email")}</strong>, you will receive password reset instructions shortly.
                  </p>
                </div>
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/auth")}
                  data-testid="button-return-to-login"
                >
                  Return to login
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setEmailSent(false);
                      form.reset();
                    }}
                    className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
                    data-testid="link-try-different-email"
                  >
                    Try a different email
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
