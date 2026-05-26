import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, Search, CheckCircle, XCircle, Globe, Lock, Clock,
  MapPin, Layers, Shield, Star, Music2, Trash2, ExternalLink, Eye,
} from "lucide-react";
import { useLocation } from "wouter";

const DISCIPLINE_COLORS: Record<string, string> = {
  breaking: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  graffiti: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  skate: "bg-green-500/10 text-green-600 border-green-500/30",
  hiphop: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  bmx: "bg-red-500/10 text-red-600 border-red-500/30",
  parkour: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  dj: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  rap: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

const typeIcon = (type: string) => {
  switch (type) {
    case "city": return <MapPin className="h-3.5 w-3.5" />;
    case "crew": return <Shield className="h-3.5 w-3.5" />;
    case "artist": return <Star className="h-3.5 w-3.5" />;
    case "discipline": return <Layers className="h-3.5 w-3.5" />;
    default: return <Music2 className="h-3.5 w-3.5" />;
  }
};

export default function AdminGroupsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [search, setSearch] = useState("");

  const { data: pendingGroups = [], isLoading: pendingLoading } = useQuery<any[]>({
    queryKey: ["/api/groups/pending"],
    queryFn: async () => {
      const r = await apiRequest("/api/groups/pending", "GET");
      return r.json();
    },
  });

  const { data: activeGroups = [], isLoading: activeLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", "", "", ""],
    queryFn: async () => {
      const r = await fetch("/api/groups");
      return r.json();
    },
    enabled: tab === "active",
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/groups/${id}/approve`, "POST", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "✅ Group approved", description: "It is now live on the platform." });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/groups/${id}/reject`, "POST", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/pending"] });
      toast({ title: "Group rejected" });
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/groups/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/pending"] });
      toast({ title: "Group archived", description: "The group has been removed from the platform." });
    },
    onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
  });

  const filteredActive = activeGroups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingGroups.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{tab === "active" ? activeGroups.length || "—" : "—"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {tab === "active" ? activeGroups.reduce((sum: number, g: any) => sum + (g.memberCount || 0), 0) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Members</div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl border border-border/60 overflow-hidden bg-muted/30 p-1 gap-1">
        <button
          onClick={() => setTab("pending")}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
            tab === "pending" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-pending-groups"
        >
          <Clock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
          Pending
          {pendingGroups.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-yellow-500 text-white">
              {pendingGroups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("active")}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
            tab === "active" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-active-groups"
        >
          <CheckCircle className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
          Active
        </button>
      </div>

      {/* Pending tab */}
      {tab === "pending" && (
        <>
          {pendingLoading ? (
            <div className="text-sm text-muted-foreground text-center py-10">Loading…</div>
          ) : pendingGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-sm">No pending groups</p>
              <p className="text-xs mt-1">All groups have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingGroups.map((g: any) => (
                <div
                  key={g.id}
                  className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4"
                  data-testid={`card-pending-group-${g.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {g.coverImage ? (
                        <img src={g.coverImage} alt={g.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-primary/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="flex items-center gap-1 text-sm font-semibold">
                          {typeIcon(g.type)}
                          <span>{g.name}</span>
                        </div>
                        {g.isPrivate ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" /> Private
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Globe className="h-2.5 w-2.5" /> Public
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/community/groups/${g.id}`)}
                          className="ml-auto text-muted-foreground hover:text-primary p-0.5"
                          title="View group"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {g.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{g.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 items-center">
                        {g.discipline && (
                          <Badge variant="outline" className={`text-[10px] border ${DISCIPLINE_COLORS[g.discipline] || DISCIPLINE_COLORS.other}`}>
                            {g.discipline}
                          </Badge>
                        )}
                        {g.city && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" /> {g.city}
                          </span>
                        )}
                        {g.creatorUsername && (
                          <span className="text-[10px] text-muted-foreground">by {g.creatorUsername}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="flex-1 h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => approveMutation.mutate(g.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-group-${g.id}`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 gap-1.5"
                      onClick={() => rejectMutation.mutate(g.id)}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-group-${g.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Active tab */}
      {tab === "active" && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search active groups…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-testid="input-admin-group-search"
            />
          </div>
          {activeLoading ? (
            <div className="text-sm text-muted-foreground text-center py-10">Loading…</div>
          ) : filteredActive.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active groups found</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {filteredActive.length} group{filteredActive.length !== 1 ? "s" : ""}
              </p>
              {filteredActive.map((g: any) => (
                <div
                  key={g.id}
                  className="border border-border/50 rounded-xl px-4 py-3 flex items-center gap-3"
                  data-testid={`card-active-group-${g.id}`}
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5">
                    {g.coverImage ? (
                      <img src={g.coverImage} alt={g.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {typeIcon(g.type)}
                      <span className="truncate">{g.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {g.discipline && (
                        <Badge variant="outline" className={`text-[9px] py-0 h-4 px-1 border ${DISCIPLINE_COLORS[g.discipline] || DISCIPLINE_COLORS.other}`}>
                          {g.discipline}
                        </Badge>
                      )}
                      {g.city && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{g.city}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                        <Users className="h-2.5 w-2.5" />{g.memberCount || 0} members
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {g.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <button
                      onClick={() => navigate(`/community/groups/${g.id}`)}
                      className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="View group"
                      data-testid={`button-view-group-${g.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Archive "${g.name}"? This will remove it from the platform.`)) {
                          archiveMutation.mutate(g.id);
                        }
                      }}
                      disabled={archiveMutation.isPending}
                      className="p-1 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Archive group"
                      data-testid={`button-archive-group-${g.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
