import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, FileText, Lock, Users, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Link } from "wouter";

interface LegalStats {
  totalUsers: number;
  totalConsents: number;
  termsAccepted: number;
  privacyAccepted: number;
  bothAccepted: number;
}

export default function LegalManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [resetType, setResetType] = useState<"terms" | "privacy" | "all" | null>(null);

  const { data: stats, isLoading } = useQuery<LegalStats>({
    queryKey: ["/api/admin/legal/stats"],
    refetchInterval: 30000,
  });

  const resetMutation = useMutation({
    mutationFn: (type: "terms" | "privacy" | "all") =>
      apiRequest("/api/admin/legal/reset-consents", "POST", { type }),
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/legal/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/legal/user-consents"] });
      const label = type === "all" ? "All consents" : type === "terms" ? "Terms consents" : "Privacy consents";
      toast({
        title: "Consents reset",
        description: `${label} have been reset. All users will be required to re-accept.`,
      });
      setResetType(null);
    },
    onError: () => {
      toast({
        title: "Reset failed",
        description: "Could not reset consents. Please try again.",
        variant: "destructive",
      });
    },
  });

  const statsItems = [
    {
      label: "Total Users",
      value: stats?.totalUsers ?? "—",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Users w/ Consent Record",
      value: stats?.totalConsents ?? "—",
      icon: ShieldCheck,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      label: "Terms Accepted",
      value: stats?.termsAccepted ?? "—",
      icon: FileText,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Privacy Accepted",
      value: stats?.privacyAccepted ?? "—",
      icon: Lock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Both Accepted",
      value: stats?.bothAccepted ?? "—",
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Pending Acceptance",
      value: stats
        ? Math.max(0, stats.totalUsers - stats.bothAccepted)
        : "—",
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  const actions = [
    {
      type: "terms" as const,
      label: "Reset Terms of Service",
      description: "All users who previously accepted the Terms of Service will be required to re-accept them.",
      icon: FileText,
      color: "text-blue-500",
      buttonLabel: "Reset ToS Acceptance",
      variant: "outline" as const,
    },
    {
      type: "privacy" as const,
      label: "Reset Privacy Policy",
      description: "All users who previously accepted the Privacy Policy will be required to re-accept it.",
      icon: Lock,
      color: "text-orange-500",
      buttonLabel: "Reset Privacy Acceptance",
      variant: "outline" as const,
    },
    {
      type: "all" as const,
      label: "Reset All Consents",
      description: "All users will be required to re-accept both the Terms of Service and the Privacy Policy before they can use the platform.",
      icon: AlertTriangle,
      color: "text-red-500",
      buttonLabel: "Reset All Consents",
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Legal Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage legal documents and user consent status
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/terms-of-service">
            <Button variant="outline" size="sm" data-testid="link-view-terms">
              <FileText className="w-4 h-4 mr-2" /> Terms of Service
            </Button>
          </Link>
          <Link href="/privacy-policy">
            <Button variant="outline" size="sm" data-testid="link-view-privacy">
              <Lock className="w-4 h-4 mr-2" /> Privacy Policy
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statsItems.map((item) => (
          <Card key={item.label} className="border border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground leading-none mb-1">{item.label}</p>
                  <p className="text-2xl font-bold leading-none" data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {isLoading ? "…" : item.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Force Re-acceptance Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Force Re-acceptance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            When you update legal documents, use these actions to require all users to accept the new version before they can continue using the platform. The legal acceptance dialog will appear for every user on their next visit.
          </p>
        </div>

        <div className="space-y-3">
          {actions.map((action) => (
            <Card key={action.type} className="border border-border/60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-muted mt-0.5`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant={action.variant}
                        size="sm"
                        className="shrink-0"
                        data-testid={`button-reset-${action.type}`}
                        disabled={resetMutation.isPending}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        {action.buttonLabel}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          Confirm Consent Reset
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {action.description} This action cannot be undone — users will be immediately prompted to accept when they next use the platform.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resetMutation.mutate(action.type)}
                          data-testid={`confirm-reset-${action.type}`}
                        >
                          Yes, reset {action.type === "all" ? "all consents" : action.type === "terms" ? "terms acceptance" : "privacy acceptance"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Current document info */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Current Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" /> Terms of Service
                </CardTitle>
                <Badge variant="secondary" className="text-xs">v2026.2</Badge>
              </div>
              <CardDescription className="text-xs">
                Dutch Law · Netherlands & EU Compliant
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Effective: 1 March 2026 · 25 sections · EN + NL
              </p>
              <Link href="/terms-of-service">
                <Button variant="link" size="sm" className="px-0 mt-1 text-xs h-auto" data-testid="link-terms-detail">
                  View full document →
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-500" /> Privacy Policy
                </CardTitle>
                <Badge variant="secondary" className="text-xs">v2026.2</Badge>
              </div>
              <CardDescription className="text-xs">
                GDPR / AVG Compliant · Dutch & EU Law
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Effective: 1 March 2026 · 19 sections · EN + NL
              </p>
              <Link href="/privacy-policy">
                <Button variant="link" size="sm" className="px-0 mt-1 text-xs h-auto" data-testid="link-privacy-detail">
                  View full document →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: After updating a legal document, use the Force Re-acceptance buttons above to require all users to re-accept the new version.
        </p>
      </div>
    </div>
  );
}
