import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function LegalAcceptanceDialog() {
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: consent, isLoading } = useQuery({
    queryKey: ["/api/legal/user-consent"],
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!user || isLoading) return;
    const c = consent as any;
    if (!c?.termsAccepted || !c?.privacyAccepted) {
      setShow(true);
    }
  }, [user, consent, isLoading]);

  const handleAccept = async () => {
    if (!termsChecked || !privacyChecked) {
      toast({
        title: "Both agreements required",
        description: "Please check both boxes before continuing.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (user?.id) headers["x-user-id"] = String(user.id);

      const c = consent as any;
      if (!c?.termsAccepted) {
        await fetch("/api/legal/accept-terms", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: user?.id }),
        });
      }
      if (!c?.privacyAccepted) {
        await fetch("/api/legal/accept-privacy", {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: user?.id }),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consent"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consents"] });

      toast({
        title: "Agreements accepted",
        description: "Thank you. Your acceptance has been recorded.",
      });
      setShow(false);
    } catch (err) {
      console.error("Failed to record legal acceptance:", err);
      toast({
        title: "Error",
        description: "Could not record your acceptance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || isLoading || !show) return null;

  const c = consent as any;
  if (c?.termsAccepted && c?.privacyAccepted) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full sm:max-w-2xl sm:mx-4 bg-background border border-border shadow-2xl sm:rounded-xl flex flex-col"
           style={{ maxHeight: "calc(100dvh - env(safe-area-inset-bottom, 0px))", height: "100dvh" }}
      >
        <div className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto mt-3 flex-shrink-0" />

        <div className="flex-shrink-0 px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary flex-shrink-0" />
            <h2 className="text-base font-semibold leading-tight">Legal Agreement Required</h2>
            <Badge variant="outline" className="text-xs font-normal hidden sm:inline-flex">Netherlands 2026</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            Before using Urban Culture, read and accept our Terms of Service and Privacy Policy (Dutch law &amp; EU GDPR compliant).
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-sm">Terms of Service — Summary</h3>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground space-y-1.5 border border-border/50">
              <p><strong>Who:</strong> Urban Culture, Herenstraat 32, Zaandam, Netherlands.</p>
              <p><strong>Eligibility:</strong> Must be at least 16 years old. Ages 16–18 require parental consent.</p>
              <p><strong>Your content:</strong> You keep ownership. You grant us a license to display it. You are responsible for what you post.</p>
              <p><strong>Prohibited:</strong> Hate speech, harassment, illegal content, pornography, doxxing, spam — immediate removal.</p>
              <p><strong>Marketplace:</strong> Buyers have a 14-day cooling-off period (Wet koop op afstand).</p>
              <p><strong>Liability:</strong> Limited to amounts paid or €100, whichever is greater. Excludes gross negligence.</p>
              <p><strong>Disputes:</strong> Dutch law. Rechtbank Noord-Holland. EU ODR platform available.</p>
              <p><strong>Effective:</strong> 1 January 2026 — Version 2026.1</p>
            </div>
          </section>

          <Separator />

          <section>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <h3 className="font-semibold text-sm">Privacy Policy (AVG/GDPR) — Summary</h3>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground space-y-1.5 border border-border/50">
              <p><strong>Controller:</strong> Urban Culture, Herenstraat 32, Zaandam (riki@dancehealthy.net).</p>
              <p><strong>Data collected:</strong> Account info, profile, content you create, location (with consent), device/IP, payment references, consent records.</p>
              <p><strong>Legal basis (AVG Art. 6):</strong> Contract, legitimate interest, consent, legal obligation.</p>
              <p><strong>Retention:</strong> Account 2 years post-deletion; financial 7 years; consent records 5 years; location 24 hours.</p>
              <p><strong>Sub-processors:</strong> Firebase, Neon, Stripe, Cloudinary, Mailgun (all with DPAs, AVG Art. 28).</p>
              <p><strong>Your rights (AVG Art. 15–22):</strong> Access, rectification, erasure, restriction, portability, objection. Reply within 30 days.</p>
              <p><strong>Complaints:</strong> Autoriteit Persoonsgegevens — www.autoriteitpersoonsgegevens.nl</p>
              <p><strong>Effective:</strong> 1 January 2026 — Version 2026.1</p>
            </div>
          </section>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <Checkbox
                id="accept-tos"
                checked={termsChecked}
                onCheckedChange={(v) => setTermsChecked(!!v)}
                data-testid="checkbox-accept-tos"
                className="mt-0.5 flex-shrink-0"
              />
              <Label htmlFor="accept-tos" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the <strong>Terms of Service</strong> (v2026.1) and confirm I am at least 16 years old.
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <Checkbox
                id="accept-privacy"
                checked={privacyChecked}
                onCheckedChange={(v) => setPrivacyChecked(!!v)}
                data-testid="checkbox-accept-privacy"
                className="mt-0.5 flex-shrink-0"
              />
              <Label htmlFor="accept-privacy" className="text-sm leading-relaxed cursor-pointer">
                I have read and agree to the <strong>Privacy Policy</strong> (AVG/GDPR, v2026.1) and consent to the processing of my personal data.
              </Label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground pb-2">
            Acceptance is recorded with timestamp, IP address, and browser info as evidence under Dutch law.
          </p>
        </div>

        <div className="flex-shrink-0 px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-background">
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Required to use the platform.</span>
            </div>
            <Button
              onClick={handleAccept}
              disabled={!termsChecked || !privacyChecked || submitting}
              data-testid="button-accept-legal"
              className="w-full sm:w-auto sm:min-w-36"
              size="lg"
            >
              {submitting ? "Recording..." : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I Accept Both
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
