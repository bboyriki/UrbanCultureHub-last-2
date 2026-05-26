import { Lock, Sparkles, Mail, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIAccess } from "@/hooks/useAIAccess";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface AIPremiumGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function AIPremiumGate({ children, feature = "This AI feature" }: AIPremiumGateProps) {
  const access = useAIAccess();
  const { toast } = useToast();
  const [checkingOut, setCheckingOut] = useState(false);

  if (access.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (access.hasAccess) return <>{children}</>;

  const handleSubscribe = async () => {
    setCheckingOut(true);
    try {
      const res = await apiRequest("/api/ai-premium/checkout", "POST", {});
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Couldn't start checkout", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Please try again", variant: "destructive" });
    } finally {
      setCheckingOut(false);
    }
  };

  const isSubscriptionMode = access.mode === "subscription" && access.subscriptionEnabled;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock className="w-7 h-7 text-primary" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-base">Premium AI Feature</h3>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          {feature} is exclusive to premium members. Unlock to get AI-powered recommendations, smart spot descriptions and more.
        </p>
      </div>

      {isSubscriptionMode ? (
        <div className="space-y-3 w-full max-w-xs">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Monthly subscription</p>
            <p className="text-2xl font-bold text-foreground">€{access.monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          </div>
          <Button
            onClick={handleSubscribe}
            disabled={checkingOut}
            className="w-full gap-2"
            data-testid="button-subscribe-ai-premium"
          >
            {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {checkingOut ? "Opening checkout…" : "Upgrade to Premium"}
          </Button>
          <p className="text-xs text-muted-foreground">Secure payment via Stripe · Cancel anytime</p>
        </div>
      ) : (
        <div className="space-y-3 w-full max-w-xs">
          <div className="bg-muted/50 border border-border rounded-xl p-4 text-left space-y-1">
            <p className="text-sm font-medium">How to get access</p>
            <p className="text-xs text-muted-foreground">Contact the admin to request AI Premium access. Once granted, all AI features unlock instantly.</p>
          </div>
          <a
            href="mailto:admin@dancehealthy.net"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium"
            data-testid="link-contact-admin"
          >
            <Mail className="w-4 h-4" /> Contact admin
          </a>
        </div>
      )}
    </div>
  );
}

export function useAIPremiumGate() {
  const access = useAIAccess();
  return { hasAccess: access.hasAccess, access };
}
