import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, Users, Calendar, Search, CheckCircle, Clock, BarChart2,
  ChevronDown, ChevronRight, Eye, ExternalLink, Building2, Map, Star, Loader2, XCircle
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface SpotOwner {
  id: number;
  displayName: string;
  email: string;
  role: string;
  artType: string | null;
  canAddSpots: boolean;
  profilePicture: string | null;
  createdAt: string;
  totalSpots: number;
  approvedSpots: number;
  pendingSpots: number;
  programmeAccess: { isEnabled: boolean; venueName: string | null } | null;
  programmeItemCount: number;
  activeItemCount: number;
  spots: Array<{
    id: number;
    name: string;
    type: string | null;
    address: string | null;
    approvalStatus: string | null;
    isVisible: boolean | null;
    createdAt: string;
  }>;
}

interface GlobalStats {
  totalSpotOwners: number;
  totalCommunitySpots: number;
  approvedSpots: number;
  pendingSpots: number;
  totalProgrammeItems: number;
  ownersWithProgrammeAccess: number;
}

interface OverviewData {
  owners: SpotOwner[];
  globalStats: GlobalStats;
  allSpots: any[];
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function SpotActionRow({
  spot,
  onApprove,
  onReject,
}: {
  spot: SpotOwner["spots"][number];
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div className="rounded-md bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{spot.name}</p>
            <p className="text-xs text-muted-foreground truncate">{spot.type} · {spot.address || "No address"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {spot.approvalStatus === "approved" ? (
            <Badge variant="default" className="bg-green-500 text-xs">Approved</Badge>
          ) : spot.approvalStatus === "rejected" ? (
            <Badge variant="destructive" className="text-xs">Rejected</Badge>
          ) : (
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">Pending</Badge>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => onApprove(spot.id)}
                data-testid={`button-approve-spot-${spot.id}`}
              >
                <CheckCircle className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => setShowReject(!showReject)}
                data-testid={`button-reject-spot-${spot.id}`}
              >
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </div>
          )}
          <Link href={`/locations/${spot.id}`}>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
              <Eye className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {showReject && (
        <div className="px-3 pb-3 space-y-2 border-t bg-red-50/60 dark:bg-red-950/20">
          <p className="text-xs text-muted-foreground pt-2">Optional: reason for rejection (shown to submitter)</p>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Duplicate spot, unclear location, inappropriate content..."
            className="text-xs h-16 resize-none"
            data-testid={`textarea-reject-reason-${spot.id}`}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => { onReject(spot.id, rejectReason); setShowReject(false); }}
              data-testid={`button-confirm-reject-${spot.id}`}
            >
              Confirm Rejection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerCard({
  owner,
  onApproveSpot,
  onRejectSpot,
}: {
  owner: SpotOwner;
  onApproveSpot: (id: number) => void;
  onRejectSpot: (id: number, reason: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`owner-card-${owner.id}`}
      >
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={owner.profilePicture || ""} />
          <AvatarFallback>{owner.displayName?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{owner.displayName}</span>
            {owner.role === "spot_owner" && <Badge variant="secondary" className="text-xs">Spot Owner</Badge>}
            {owner.pendingSpots > 0 && (
              <Badge className="text-xs bg-yellow-500 text-white">{owner.pendingSpots} pending</Badge>
            )}
            {owner.programmeAccess?.isEnabled && (
              <Badge className="text-xs bg-green-500 text-white">Calendar Active</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {owner.totalSpots} spots
          </span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t">
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{owner.approvedSpots}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-yellow-600">{owner.pendingSpots}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-blue-600">{owner.programmeItemCount}</p>
              <p className="text-xs text-muted-foreground">Programme Items</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-purple-600">{owner.activeItemCount}</p>
              <p className="text-xs text-muted-foreground">Active Public</p>
            </div>
          </div>

          {owner.spots.length > 0 && (
            <div className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Their Spots</p>
              {owner.spots.map((spot) => (
                <SpotActionRow
                  key={spot.id}
                  spot={spot}
                  onApprove={onApproveSpot}
                  onReject={onRejectSpot}
                />
              ))}
            </div>
          )}

          <div className="p-4 pt-0 flex gap-2 flex-wrap">
            {!owner.programmeAccess?.isEnabled && (
              <Link href="/admin/programme">
                <Button size="sm" variant="outline" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" /> Grant Calendar Access
                </Button>
              </Link>
            )}
            <Link href={`/admin/spot-creators`}>
              <Button size="sm" variant="ghost" className="text-xs gap-1">
                <Users className="h-3 w-3" /> Manage Permissions
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminSpotsOverviewPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/admin/spots/overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/spots/overview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (spotId: number) => {
      return apiRequest(`/api/locations/${spotId}`, "PATCH", { approvalStatus: "approved", isVisible: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/spots/overview"] });
      toast({ title: "Spot approved and visible on map" });
    },
    onError: () => toast({ title: "Failed to approve spot", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ spotId, reason }: { spotId: number; reason: string }) => {
      return apiRequest(`/api/locations/${spotId}/reject`, "POST", { reason: reason || "Rejected by admin" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/spots/overview"] });
      toast({ title: "Spot rejected", description: "The submitter has been notified." });
    },
    onError: () => toast({ title: "Failed to reject spot", variant: "destructive" }),
  });

  const owners = data?.owners || [];
  const stats = data?.globalStats;
  const allSpots = data?.allSpots || [];

  const filteredOwners = owners.filter(o =>
    !search ||
    o.displayName.toLowerCase().includes(search.toLowerCase()) ||
    o.email.toLowerCase().includes(search.toLowerCase())
  );

  const pendingSpots = allSpots.filter((s: any) => s.approvalStatus === "pending");

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Spots Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">All spot owners, their venues, and programme analytics</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Spot Owners" value={stats?.totalSpotOwners || 0} icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30" />
              <StatCard label="Total Spots" value={stats?.totalCommunitySpots || 0} icon={MapPin} color="bg-orange-100 text-orange-600 dark:bg-orange-900/30" />
              <StatCard label="Approved" value={stats?.approvedSpots || 0} icon={CheckCircle} color="bg-green-100 text-green-600 dark:bg-green-900/30" />
              <StatCard label="Pending Review" value={stats?.pendingSpots || 0} icon={Clock} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30" />
              <StatCard label="Programme Items" value={stats?.totalProgrammeItems || 0} icon={Calendar} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30" />
              <StatCard label="Calendar Active" value={stats?.ownersWithProgrammeAccess || 0} icon={Star} color="bg-pink-100 text-pink-600 dark:bg-pink-900/30" />
            </div>

            <Tabs defaultValue="owners">
              <TabsList>
                <TabsTrigger value="owners" data-testid="tab-owners">Spot Owners ({owners.length})</TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending Spots
                  {pendingSpots.length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 text-xs">{pendingSpots.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all-spots">All Spots ({allSpots.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="owners" className="space-y-3 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search-owners"
                  />
                </div>
                {filteredOwners.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No spot owners found</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {filteredOwners.map(owner => (
                      <OwnerCard
                        key={owner.id}
                        owner={owner}
                        onApproveSpot={(id) => approveMutation.mutate(id)}
                        onRejectSpot={(id, reason) => rejectMutation.mutate({ spotId: id, reason })}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                {pendingSpots.length === 0 ? (
                  <Card className="p-8 text-center">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-70" />
                    <p className="text-muted-foreground">No spots pending review</p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {pendingSpots.map((spot: any) => (
                      <SpotActionRow
                        key={spot.id}
                        spot={spot}
                        onApprove={(id) => approveMutation.mutate(id)}
                        onReject={(id, reason) => rejectMutation.mutate({ spotId: id, reason })}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="mt-4">
                <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <span>As admin you can manage the schedule for <strong>any</strong> spot. Click <strong>Schedule</strong> to open the spot and add or remove sessions at the bottom of the page.</span>
                </div>
                <div className="space-y-2">
                  {allSpots.slice(0, 100).map((spot: any) => (
                    <Card key={spot.id} className="p-3 flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{spot.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{spot.type} · {spot.address || "No address"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {spot.approvalStatus === "approved" ? (
                          <Badge variant="default" className="bg-green-500 text-xs">Approved</Badge>
                        ) : spot.approvalStatus === "rejected" ? (
                          <Badge variant="destructive" className="text-xs">Rejected</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                        <Link href={`/locations/${spot.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10" data-testid={`button-manage-schedule-all-${spot.id}`}>
                            <Calendar className="h-3 w-3" /> Schedule
                          </Button>
                        </Link>
                        <Link href={`/locations/${spot.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                  {allSpots.length > 100 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      Showing 100 of {allSpots.length} spots
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
