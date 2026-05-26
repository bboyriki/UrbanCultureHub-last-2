import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Film, Flag, Eye, Heart, Share2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface AdminReel {
  id: number;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  status: "active" | "disabled";
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  reportCount: number;
  createdAt: string;
  user: { id: number; displayName: string; profilePicture: string | null };
}

export default function AdminReelsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "disabled" | "reported">("all");

  const { data: reels, isLoading } = useQuery<AdminReel[]>({
    queryKey: ["/api/admin/reels"],
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "active" | "disabled" }) =>
      apiRequest(`/api/admin/reels/${id}/visibility`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reels"] });
      toast({ title: "Reel updated" });
    },
    onError: () => toast({ title: "Failed to update reel", variant: "destructive" }),
  });

  const filtered = (reels ?? []).filter(r => {
    const matchSearch = !search ||
      (r.caption ?? "").toLowerCase().includes(search.toLowerCase()) ||
      r.user.displayName.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "reported" ? r.reportCount > 0 :
      r.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: reels?.length ?? 0,
    active: reels?.filter(r => r.status === "active").length ?? 0,
    disabled: reels?.filter(r => r.status === "disabled").length ?? 0,
    reported: reels?.filter(r => r.reportCount > 0).length ?? 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reels Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review, moderate, and manage all video reels</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
          { label: "Active", value: stats.active, color: "bg-green-500/10 text-green-600 dark:text-green-400" },
          { label: "Disabled", value: stats.disabled, color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
          { label: "Reported", value: stats.reported, color: "bg-red-500/10 text-red-600 dark:text-red-400" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-reel-search"
            placeholder="Search by caption or creator…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "disabled", "reported"] as const).map(f => (
            <Button
              key={f}
              data-testid={`filter-${f}`}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
              {f === "reported" && stats.reported > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 text-[10px]">{stats.reported}</Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Reels List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No reels found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(reel => (
            <div
              key={reel.id}
              data-testid={`card-reel-${reel.id}`}
              className="flex gap-4 bg-card border border-border rounded-xl p-4 items-start"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-muted relative">
                {reel.thumbnailUrl ? (
                  <img
                    src={reel.thumbnailUrl}
                    alt="thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                {reel.status === "disabled" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold uppercase tracking-wide">Disabled</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {reel.caption || <span className="italic text-muted-foreground">No caption</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by <span className="font-medium">{reel.user.displayName}</span>
                      {" · "}
                      {formatDistanceToNow(new Date(reel.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {reel.reportCount > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1 text-xs" data-testid={`badge-reports-${reel.id}`}>
                        <Flag className="w-3 h-3" />
                        {reel.reportCount}
                      </Badge>
                    )}
                    <Badge variant={reel.status === "active" ? "default" : "secondary"} data-testid={`badge-status-${reel.id}`}>
                      {reel.status}
                    </Badge>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{reel.viewsCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{reel.likesCount.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{reel.sharesCount.toLocaleString()}</span>
                </div>

                {/* Toggle */}
                <div className="flex items-center gap-2 mt-3">
                  <Switch
                    data-testid={`toggle-reel-${reel.id}`}
                    checked={reel.status === "active"}
                    disabled={toggleMutation.isPending}
                    onCheckedChange={checked =>
                      toggleMutation.mutate({ id: reel.id, status: checked ? "active" : "disabled" })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {reel.status === "active" ? "Visible to users" : "Hidden from feed"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
