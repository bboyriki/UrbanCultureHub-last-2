import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { reportPurchase } from "@/lib/adsTracking";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/utils";
import { Membership } from "@shared/schema";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Make sure to call loadStripe outside of a component's render to avoid recreating the Stripe object
// on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

type MembershipPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
  tier: "free" | "premium";
};

const plans: MembershipPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Basic features for casual users",
    price: 0,
    yearlyPrice: 0,
    tier: "free",
    features: [
      "Basic location browsing",
      "View community events",
      "Limited number of map filters",
      "Standard service booking"
    ]
  },
  {
    id: "premium",
    name: "Premium",
    description: "Advanced features for urban culture enthusiasts",
    price: 10.00,
    yearlyPrice: 90.00,
    tier: "premium",
    popular: true,
    features: [
      "Unlimited location browsing",
      "Advanced map filtering options",
      "Early access to events",
      "Discounted event tickets",
      "Priority booking for services",
      "No booking fees",
      "Create unlimited locations"
    ]
  }
];

function PaymentForm({ 
  clientSecret, 
  onSuccess, 
  loading
}: { 
  clientSecret: string; 
  onSuccess: (paymentIntentId?: string) => void;
  loading: boolean;
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
        return_url: window.location.origin + "/membership?success=true",
      },
      redirect: "if_required"
    });
    
    if (result.error) {
      setError(result.error.message || "Payment failed");
      setProcessing(false);
    } else {
      onSuccess(result.paymentIntent?.id);
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
        disabled={!stripe || processing || loading}
      >
        {processing ? "Processing..." : "Subscribe Now"}
      </Button>
    </form>
  );
}

function SubscriptionDialog({ 
  plan, 
  isYearly, 
  isOpen, 
  setIsOpen
}: { 
  plan: MembershipPlan; 
  isYearly: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { mutate: createSubscription, isPending } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      
      const price = isYearly ? plan.yearlyPrice : plan.price;
      const period = isYearly ? "yearly" : "monthly";
      
      const response = await apiRequest("/api/subscriptions/create", "POST", {
        userId: user.id,
        tier: plan.tier,
        period
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create subscription");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.subscription.clientSecret);
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription Error",
        description: error.message,
        variant: "destructive"
      });
      setIsOpen(false);
    }
  });
  
  const handleClose = () => {
    setIsOpen(false);
    // Reset state
    setClientSecret(null);
  };
  
  const handleSuccess = (paymentIntentId?: string) => {
    toast({
      title: "Payment Successful",
      description: "Your premium membership is now active",
    });
    setIsOpen(false);
    
    // Refetch membership data
    queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "membership"] });

    // Google Ads purchase conversion. Use plan price (monthly or yearly) as value.
    // Prefer the real Stripe payment intent id as the transaction id; fall back
    // to a per-(user, plan, period) synthetic key if Stripe didn't return one.
    const value = isYearly ? (plan.yearlyPrice ?? plan.price) : plan.price;
    reportPurchase({
      value: typeof value === "number" ? value : undefined,
      currency: "EUR",
      transactionId: paymentIntentId || `membership:${user?.id ?? "anon"}:${plan.tier}:${isYearly ? "yearly" : "monthly"}`,
      conversionType: `membership_${plan.tier}`,
      userId: user?.id,
    });
  };
  
  useEffect(() => {
    if (isOpen && plan.tier !== "free" && !clientSecret && !isPending) {
      createSubscription();
    }
  }, [isOpen, plan, createSubscription, clientSecret, isPending]);
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {plan.name}</DialogTitle>
          <DialogDescription>
            {isYearly ? "Annual subscription" : "Monthly subscription"} to {plan.name} plan
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm 
                clientSecret={clientSecret} 
                onSuccess={handleSuccess}
                loading={isPending}
              />
            </Elements>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubscriptionDialog({ 
  isOpen, 
  setIsOpen, 
  membershipId 
}: { 
  isOpen: boolean; 
  setIsOpen: (open: boolean) => void;
  membershipId: number;
}) {
  const { toast } = useToast();
  
  const { mutate: cancelSubscription, isPending } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/memberships/${membershipId}/cancel`, "POST");
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel subscription");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your membership will remain active until the end of the billing period",
      });
      setIsOpen(false);
      
      // Refetch membership data
      queryClient.invalidateQueries({ queryKey: ["/api/users", null, "membership"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your premium membership? 
            You will continue to have access until the end of your current billing period.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Keep Subscription
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => cancelSubscription()}
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : "Cancel Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MembershipPage() {
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  
  const { data: membership, isLoading } = useQuery<Membership | any>({
    queryKey: ["/api/users", user?.id, "membership"],
    queryFn: async () => {
      if (!user) return null;
      
      const response = await apiRequest(`/api/users/${user.id}/membership`, "GET");
      
      if (response.status === 404) {
        return { tier: "free" };
      }
      
      return await response.json();
    },
    enabled: !!user
  });
  
  const handlePlanSelect = (plan: MembershipPlan) => {
    // If free plan, just show toast
    if (plan.tier === "free" && membership?.tier !== "free") {
      setIsCancelDialogOpen(true);
      return;
    }
    
    // If already on this plan, do nothing
    if (membership?.tier === plan.tier) {
      return;
    }
    
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  };
  
  const savingPercentage = Math.round(((12 * plans[1].price - plans[1].yearlyPrice) / (12 * plans[1].price)) * 100);
  
  if (!user) {
    return (
      <div className="container py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Membership Plans</h1>
          <p className="text-lg mb-8">Please log in to view and manage your membership.</p>
          <Button asChild>
            <a href="/auth">Log In</a>
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">Premium Membership</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Enhance your urban culture experience with premium features
          </p>
          
          {membership && !isLoading && (
            <div className="mb-8">
              <h2 className="text-xl mb-2">Your Current Plan: <span className="font-bold">{membership.tier === "free" ? "Free" : "Premium"}</span></h2>
              {membership.tier !== "free" && (
                <div className="flex flex-col items-center gap-2">
                  <Badge variant={membership.status === "active" ? "default" : "outline"}>
                    {membership.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                  {membership.endDate && (
                    <p className="text-sm text-muted-foreground">
                      Renews on {new Date(membership.endDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className={isYearly ? "text-muted-foreground" : ""}>Monthly</span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <span className={!isYearly ? "text-muted-foreground" : ""}>
              Yearly <Badge variant="outline" className="ml-1">Save {savingPercentage}%</Badge>
            </span>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? "border-primary" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary hover:bg-primary">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.price === 0 ? "Free" : formatPrice(isYearly ? plan.yearlyPrice : plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground ml-1">
                      /{isYearly ? "year" : "month"}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handlePlanSelect(plan)}
                  disabled={isLoading || (membership?.tier === plan.tier && plan.tier !== "free")}
                  variant={plan.tier === "premium" ? "default" : "outline"}
                >
                  {isLoading ? (
                    <Skeleton className="h-4 w-20" />
                  ) : membership?.tier === plan.tier ? (
                    "Current Plan"
                  ) : plan.tier === "free" && membership?.tier !== "free" ? (
                    "Cancel Premium"
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      {plan.tier === "free" ? "Continue with Free" : "Upgrade to Premium"}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Premium Membership Benefits</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join our premium membership to unlock the full potential of the Urban Culture platform.
            Get exclusive access to special features, early event access, and much more.
          </p>
        </div>
      </div>
      
      {selectedPlan && (
        <SubscriptionDialog 
          plan={selectedPlan} 
          isYearly={isYearly}
          isOpen={isDialogOpen}
          setIsOpen={setIsDialogOpen}
        />
      )}
      
      {membership && membership.id && (
        <CancelSubscriptionDialog 
          isOpen={isCancelDialogOpen}
          setIsOpen={setIsCancelDialogOpen}
          membershipId={membership.id}
        />
      )}
    </div>
  );
}