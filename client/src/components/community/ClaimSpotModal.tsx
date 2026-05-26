import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X, Building2, MapPin, Mail, Phone, Globe, Shield, Check,
  Loader2, ChevronRight, Award, FileText, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimSpotModalProps {
  open: boolean;
  onClose: () => void;
  spotRef: string;
  spotName: string;
  spotCategory?: string;
  spotAddress?: string;
}

type Step = 1 | 2 | 3;

interface FormData {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  role: string;
  websiteUrl: string;
  kvkNumber: string;
  verificationNote: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner", desc: "I own this location/business" },
  { value: "manager", label: "Manager", desc: "I manage this location" },
  { value: "organizer", label: "Organizer", desc: "I organize events here" },
  { value: "representative", label: "Representative", desc: "I represent this spot" },
];

export default function ClaimSpotModal({
  open, onClose, spotRef, spotName, spotCategory, spotAddress,
}: ClaimSpotModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    businessName: "", businessEmail: "", businessPhone: "",
    role: "owner", websiteUrl: "", kvkNumber: "", verificationNote: "",
  });

  const set = (patch: Partial<FormData>) => setForm(f => ({ ...f, ...patch }));

  const submitMut = useMutation({
    mutationFn: () => apiRequest("/api/spot-claims", "POST", {
      spotRef,
      spotName,
      spotCategory: spotCategory || null,
      spotAddress: spotAddress || null,
      businessName: form.businessName || null,
      businessEmail: form.businessEmail || null,
      businessPhone: form.businessPhone || null,
      role: form.role,
      verificationNote: form.verificationNote || null,
      websiteUrl: form.websiteUrl || null,
      kvkNumber: form.kvkNumber || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-claims/my"] });
      setStep(3);
    },
    onError: async (err: any) => {
      const msg = err?.message || "Failed to submit claim";
      toast({ title: "Claim failed", description: msg, variant: "destructive" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg flex flex-col rounded-t-3xl sm:rounded-3xl bg-background shadow-2xl border border-border/50 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        style={{ maxHeight: "min(92dvh, calc(100dvh - 64px - env(safe-area-inset-bottom,0px)))" }}>

        {/* Drag handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-2 pb-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: "linear-gradient(135deg, #7C3AED20, #10B98120)", border: "1.5px solid rgba(124,58,237,0.2)" }}>
                <Award className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h2 className="font-black text-base text-foreground leading-tight">Claim This Spot</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Become the verified owner of</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors mt-0.5 flex-shrink-0"
              data-testid="btn-close-claim-modal">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Spot info */}
          <div className="mt-3 rounded-2xl bg-muted/40 border border-border/40 px-3 py-2.5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground line-clamp-1">{spotName}</p>
              {spotAddress && <p className="text-[11px] text-muted-foreground truncate">{spotAddress}</p>}
            </div>
            {spotCategory && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                {spotCategory}
              </span>
            )}
          </div>

          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center gap-2 mt-3">
              {([1, 2] as const).map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                    step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {step > s ? <Check className="w-3 h-3" /> : s}
                  </div>
                  <span className={cn("text-xs", step === s ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    {s === 1 ? "Your role" : "Verification"}
                  </span>
                  {s < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4">

            {/* Step 1: Role & Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-2">Your role at this spot *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r.value} onClick={() => set({ role: r.value })}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-2xl border text-left transition-all",
                          form.role === r.value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/40 bg-muted/20 hover:bg-muted/40"
                        )}
                        data-testid={`btn-role-${r.value}`}>
                        <span className={cn("text-xs font-bold", form.role === r.value ? "text-primary" : "text-foreground")}>{r.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Business / Venue name</label>
                    <Input value={form.businessName} onChange={e => set({ businessName: e.target.value })}
                      placeholder={spotName} className="mt-1 rounded-xl text-sm" data-testid="input-business-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Business email</label>
                      <Input type="email" value={form.businessEmail} onChange={e => set({ businessEmail: e.target.value })}
                        placeholder="info@venue.nl" className="mt-1 rounded-xl text-sm" data-testid="input-business-email" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Phone</label>
                      <Input type="tel" value={form.businessPhone} onChange={e => set({ businessPhone: e.target.value })}
                        placeholder="+31 6..." className="mt-1 rounded-xl text-sm" data-testid="input-business-phone" />
                    </div>
                  </div>
                </div>

                <Button onClick={() => setStep(2)} className="w-full rounded-xl h-11 gap-2 font-bold"
                  data-testid="btn-step1-next">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Step 2: Verification */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 p-3 flex gap-2">
                  <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Help us verify your connection to <strong>{spotName}</strong>. This information is reviewed by our admin team.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Globe className="w-3 h-3" />Website URL
                    </label>
                    <Input value={form.websiteUrl} onChange={e => set({ websiteUrl: e.target.value })}
                      placeholder="https://www.yourspot.nl" className="mt-1 rounded-xl text-sm" data-testid="input-website" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />KvK Number <span className="text-muted-foreground/60 font-normal">(optional)</span>
                    </label>
                    <Input value={form.kvkNumber} onChange={e => set({ kvkNumber: e.target.value })}
                      placeholder="Dutch Chamber of Commerce number" className="mt-1 rounded-xl text-sm" data-testid="input-kvk" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Why are you the owner / how can we verify? *</label>
                    <Textarea
                      value={form.verificationNote}
                      onChange={e => set({ verificationNote: e.target.value })}
                      placeholder="Describe your connection to this spot. E.g. 'I am the owner of this café since 2019. You can verify via our website or by calling us.'"
                      rows={4}
                      className="mt-1 resize-none rounded-xl text-sm"
                      data-testid="textarea-verification"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl h-11"
                    data-testid="btn-step2-back">Back</Button>
                  <Button
                    onClick={() => submitMut.mutate()}
                    disabled={!form.verificationNote.trim() || submitMut.isPending}
                    className="flex-1 rounded-xl h-11 gap-2 font-bold"
                    data-testid="btn-submit-claim">
                    {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                    Submit Claim
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto shadow-lg">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">Claim Submitted!</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[280px] mx-auto">
                    Your claim for <strong>{spotName}</strong> has been received. Our team will review it and get back to you shortly.
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 border border-border/40 p-4 text-left space-y-2">
                  <p className="text-xs font-bold text-foreground">What happens next?</p>
                  {[
                    "Our admin reviews your claim",
                    "We may reach out to verify details",
                    "Once approved, you get owner access",
                    "Manage schedules, photos & info",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={onClose} className="w-full rounded-xl h-11 font-bold" data-testid="btn-close-success">
                  Got it, thanks!
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
