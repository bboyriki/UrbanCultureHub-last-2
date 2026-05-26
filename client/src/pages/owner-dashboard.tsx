import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import SpotScheduleModal from "@/components/community/SpotScheduleModal";
import {
  Building2, MapPin, Calendar, Clock, Award, Settings,
  Loader2, Plus, Star, ChevronRight, UserCheck, Shield,
  ExternalLink, Eye, BarChart3, Bell, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type Ownership = {
  id: number; spotRef: string; spotName: string; spotCategory?: string;
  spotAddress?: string; businessName?: string; role: string;
  grantedAt: string; permissions: string[];
};

type MyClaim = {
  id: number; spotRef: string; spotName: string; spotAddress?: string;
  status: string; claimedAt: string; adminNote?: string; spotCategory?: string;
};

const PERMISSION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  schedule: { label: "Schedule", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Calendar },
  info: { label: "Edit Info", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: Settings },
  photos: { label: "Photos", color: "text-violet-600 bg-violet-50 border-violet-200", icon: Star },
};

function OwnershipCard({ ownership, onManageSchedule }: {
  ownership: Ownership;
  onManageSchedule: (o: Ownership) => void;
}) {
  const perms = Array.isArray(ownership.permissions) ? ownership.permissions : ["schedule"];
  const mapHref = `/map?q=${encodeURIComponent(ownership.spotName)}`;

  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center flex-shrink-0 border border-primary/10">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-sm text-foreground line-clamp-1">{ownership.spotName}</h3>
            <Badge variant="outline" className="text-[10px] h-5 capitalize border-primary/30 text-primary">
              {ownership.role}
            </Badge>
          </div>
          {ownership.spotAddress && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground truncate">{ownership.spotAddress}</p>
            </div>
          )}
          {ownership.businessName && (
            <p className="text-[11px] text-muted-foreground mt-0.5">🏢 {ownership.businessName}</p>
          )}
        </div>
      </div>

      {/* Permissions */}
      <div className="flex flex-wrap gap-1.5">
        {perms.map(p => {
          const def = PERMISSION_LABELS[p];
          if (!def) return null;
          return (
            <span key={p} className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", def.color)}>
              {def.label}
            </span>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onManageSchedule(ownership)}
          className="flex-1 h-8 text-xs gap-1.5 rounded-xl font-bold"
          data-testid={`btn-manage-schedule-${ownership.id}`}>
          <Calendar className="w-3.5 h-3.5" />
          Manage Schedule
        </Button>
        <Button asChild size="sm" variant="outline"
          className="h-8 text-xs gap-1.5 rounded-xl border-border/60"
          data-testid={`btn-map-${ownership.id}`}>
          <Link href={mapHref}>
            <MapPin className="w-3.5 h-3.5" />Map
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function ClaimStatusCard({ claim }: { claim: MyClaim }) {
  const statusMap = {
    pending: { color: "text-amber-600 bg-amber-50 border-amber-200", icon: Clock, label: "Pending Review" },
    approved: { color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2, label: "Approved" },
    rejected: { color: "text-red-600 bg-red-50 border-red-200", icon: XCircle, label: "Rejected" },
    assigned: { color: "text-blue-600 bg-blue-50 border-blue-200", icon: Award, label: "Assigned" },
  };
  const st = statusMap[claim.status as keyof typeof statusMap] || statusMap.pending;
  const Icon = st.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card/50">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border", st.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground line-clamp-1">{claim.spotName}</p>
        <p className="text-[10px] text-muted-foreground">{claim.spotRef}</p>
        {claim.adminNote && <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{claim.adminNote}"</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", st.color)}>{st.label}</span>
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(claim.claimedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
        </p>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduleOwnership, setScheduleOwnership] = useState<Ownership | null>(null);
  const [tab, setTab] = useState<"spots" | "claims">("spots");

  const { data: ownerships = [], isLoading: ownerLoading } = useQuery<Ownership[]>({
    queryKey: ["/api/spot-ownerships/my"],
    enabled: !!user,
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<MyClaim[]>({
    queryKey: ["/api/spot-claims/my"],
    enabled: !!user,
  });

  const pendingClaims = claims.filter(c => c.status === "pending");
  const approvedClaims = claims.filter(c => c.status === "approved");

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <p className="font-bold text-foreground">Login required</p>
          <p className="text-sm text-muted-foreground">Please sign in to access your owner dashboard</p>
          <Button asChild className="rounded-xl"><Link href="/auth">Sign In</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-6">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-primary/8 via-violet-500/5 to-transparent border-b border-border/40 px-4 pt-6 pb-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Award className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-foreground leading-tight">Owner Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {ownerships.length > 0
                  ? `Managing ${ownerships.length} spot${ownerships.length !== 1 ? "s" : ""}`
                  : "Your spot management hub"}
              </p>
            </div>
          </div>

          {/* Stats */}
          {(ownerships.length > 0 || claims.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "Your Spots", value: ownerships.length, color: "text-primary" },
                { label: "Pending Claims", value: pendingClaims.length, color: "text-amber-500" },
                { label: "Approved", value: approvedClaims.length, color: "text-green-500" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl bg-card/80 border border-border/40 p-3 text-center">
                  <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl border border-border/40 bg-muted/30">
          <button onClick={() => setTab("spots")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all",
              tab === "spots" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            data-testid="tab-my-spots">
            <Building2 className="w-3.5 h-3.5" />
            My Spots ({ownerships.length})
          </button>
          <button onClick={() => setTab("claims")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all",
              tab === "claims" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            data-testid="tab-my-claims">
            <Clock className="w-3.5 h-3.5" />
            My Claims ({claims.length})
            {pendingClaims.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                {pendingClaims.length}
              </span>
            )}
          </button>
        </div>

        {/* My Spots tab */}
        {tab === "spots" && (
          <div className="space-y-3">
            {ownerLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : ownerships.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto">
                  <Building2 className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="font-bold text-foreground">No spots yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
                    Claim a spot from the community list to get owner access
                  </p>
                </div>
                <Button asChild className="rounded-xl gap-2" data-testid="btn-find-spots">
                  <Link href="/community">
                    <MapPin className="w-4 h-4" />Find Spots to Claim
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {ownerships.map(o => (
                    <OwnershipCard key={o.id} ownership={o} onManageSchedule={setScheduleOwnership} />
                  ))}
                </div>
                <div className="flex items-center justify-center pt-2">
                  <Button asChild variant="outline" size="sm" className="rounded-full gap-2 text-xs" data-testid="btn-find-more-spots">
                    <Link href="/community">
                      <Plus className="w-3.5 h-3.5" />Claim Another Spot
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* My Claims tab */}
        {tab === "claims" && (
          <div className="space-y-3">
            {claimsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : claims.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="font-bold text-foreground">No claims submitted</p>
                  <p className="text-sm text-muted-foreground mt-1">Browse spots and click "Claim" to get started</p>
                </div>
                <Button asChild className="rounded-xl gap-2">
                  <Link href="/community"><MapPin className="w-4 h-4" />Browse Spots</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingClaims.length > 0 && (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                      <strong>{pendingClaims.length} claim{pendingClaims.length !== 1 ? "s" : ""} pending</strong> — Our team is reviewing your submission. This usually takes 1-2 business days.
                    </p>
                  </div>
                )}
                {claims.map(c => <ClaimStatusCard key={c.id} claim={c} />)}
              </div>
            )}
          </div>
        )}

        {/* Help box */}
        <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-bold text-foreground">Need help?</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            As a verified owner you can manage schedules, add photos, and keep your spot info up to date.
            Contact us at <a href="mailto:riki@coffeeanddance.nl" className="text-primary hover:underline">riki@coffeeanddance.nl</a> for support.
          </p>
        </div>
      </div>

      {/* Schedule modal for owner */}
      {scheduleOwnership && (
        <SpotScheduleModal
          open={!!scheduleOwnership}
          onClose={() => setScheduleOwnership(null)}
          spotRef={scheduleOwnership.spotRef}
          spotName={scheduleOwnership.spotName}
          spotAddress={scheduleOwnership.spotAddress}
        />
      )}
    </div>
  );
}
