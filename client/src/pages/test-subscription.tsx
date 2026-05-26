import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function PaymentForm({ 
  clientSecret, 
  onSuccess 
}: { 
  clientSecret: string; 
  onSuccess: () => void; 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + "/test-subscription?success=true",
      },
      redirect: "if_required"
    });
    
    if (result.error) {
      setError(result.error.message || "Payment failed");
      setProcessing(false);
    } else {
      onSuccess();
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <PaymentElement />
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button 
        type="submit" 
        className="w-full" 
        disabled={!stripe || processing}
      >
        {processing ? "Processing..." : "Pay Now"}
      </Button>
    </form>
  );
}

export default function TestSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subscribedSuccessfully, setSubscribedSuccessfully] = useState(false);
  
  const createSubscription = async (period: "monthly" | "yearly") => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to subscribe",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await apiRequest("/api/subscriptions/create", "POST", {
        userId: user.id,
        tier: "premium",
        period
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create subscription");
      }
      
      const data = await response.json();
      setClientSecret(data.subscription.clientSecret);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSuccess = () => {
    setSubscribedSuccessfully(true);
    setClientSecret(null);
    toast({
      title: "Success",
      description: "You have successfully subscribed to premium!"
    });
  };
  
  // Check if the URL has a success parameter
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  
  if (success) {
    return (
      <div className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Successful!</CardTitle>
            <CardDescription>
              Thank you for subscribing to our premium plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Your subscription is now active. Enjoy all premium benefits!</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <a href="/membership">View Membership Details</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-12">
      <Card>
        <CardHeader>
          <CardTitle>Test Subscription</CardTitle>
          <CardDescription>
            Use this page to test the subscription flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!clientSecret && !subscribedSuccessfully && (
            <div className="space-y-4">
              <Button 
                onClick={() => createSubscription("monthly")} 
                disabled={isLoading}
                className="mr-4"
              >
                {isLoading ? "Loading..." : "Subscribe Monthly"}
              </Button>
              <Button 
                onClick={() => createSubscription("yearly")} 
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Subscribe Yearly"}
              </Button>
            </div>
          )}
          
          {clientSecret && (
            <div className="mt-6">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm clientSecret={clientSecret} onSuccess={handleSuccess} />
              </Elements>
            </div>
          )}
          
          {subscribedSuccessfully && (
            <Alert className="mt-4">
              <AlertDescription>
                Subscription successful! You are now a premium member.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}