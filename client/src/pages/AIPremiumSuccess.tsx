import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { reportPurchase } from "@/lib/adsTracking";

export default function AIPremiumSuccess() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"activating" | "success" | "error">("activating");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("No session ID found. Please contact support.");
      return;
    }

    apiRequest(`/api/ai-premium/activate?session_id=${sessionId}`, "GET")
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          queryClient.invalidateQueries({ queryKey: ["/api/ai-access/status"] });
          // Google Ads purchase conversion. Use the Stripe Checkout session id as the
          // transaction id so reloads of this page won't double-report.
          reportPurchase({
            value: typeof data?.amount === "number" ? data.amount : undefined,
            currency: data?.currency || "EUR",
            transactionId: sessionId,
            conversionType: "ai_premium",
            userId: data?.userId,
          });
        } else {
          setStatus("error");
          setMessage(data.message || "Activation failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please contact support.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {status === "activating" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-xl font-bold mb-1">Activating your premium access…</h1>
              <p className="text-sm text-muted-foreground">Just a moment while we verify your payment.</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold">Welcome to AI Premium!</h1>
              </div>
              <p className="text-sm text-muted-foreground">All AI features are now unlocked. Go explore the map and find your perfect spot.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/map")} className="w-full gap-2">
                <Sparkles className="w-4 h-4" /> Try Find My Spot
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                Back to home
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold mb-1">Activation issue</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/map")} className="w-full">
              Back to map
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
