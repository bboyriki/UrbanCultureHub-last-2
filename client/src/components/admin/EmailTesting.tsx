import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, MailOpen, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

export function EmailTesting() {
  const [email, setEmail] = useState("");
  const [emailType, setEmailType] = useState("plain");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Function to check if user has admin privileges
  const hasAdminPrivileges = (): boolean => {
    return !!user && !!user.id && (user.role === 'admin' || user.role === 'moderator' || user.role === 'super_admin');
  };
  
  const handleSendTestEmail = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an email address",
      });
      return;
    }
    
    if (!hasAdminPrivileges()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Admin authentication required. Please sign in with admin privileges.",
      });
      return;
    }
    
    try {
      setLoading(true);
      setResult(null);
      
      // We already validated user exists and has admin privileges
      const adminId = user!.id;
      
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          type: emailType,
          adminId, // Add admin ID for authentication
        }),
      });
      
      const data = await response.json();
      
      setResult(data);
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Test email sent successfully",
          variant: "default",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to send test email",
        });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
      
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send test email",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Email System Testing</CardTitle>
        <CardDescription>
          Test the email system by sending test emails to verify functionality
        </CardDescription>
      </CardHeader>
      
      {!hasAdminPrivileges() && (
        <Alert variant="destructive" className="mx-6 mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Admin Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in with admin privileges to use this feature.
          </AlertDescription>
        </Alert>
      )}
      
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              disabled={loading}
              autoComplete="email"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="emailType">Test Type</Label>
            <Select 
              value={emailType} 
              onValueChange={setEmailType}
              disabled={loading}
            >
              <SelectTrigger id="emailType">
                <SelectValue placeholder="Select type of test email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plain">Simple Test Email</SelectItem>
                <SelectItem value="booking">Booking Confirmation</SelectItem>
                <SelectItem value="ticket">Ticket Confirmation</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {emailType === "plain" && "Sends a simple HTML email to test connectivity"}
              {emailType === "booking" && "Tests the booking confirmation email with PDF attachment"}
              {emailType === "ticket" && "Tests the ticket confirmation email with QR code and PDF attachment"}
            </p>
          </div>
        </div>
        
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 mt-1" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-1" />
              )}
              <div>
                <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
                <AlertDescription className="mt-1 whitespace-pre-wrap">
                  {result.message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          onClick={handleSendTestEmail}
          disabled={loading || !email || !hasAdminPrivileges()}
          className="w-full"
          title={!hasAdminPrivileges() ? "Admin privileges required" : ""}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <MailOpen className="mr-2 h-4 w-4" />
              Send Test Email
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}