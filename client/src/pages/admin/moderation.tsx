import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Flag, Film, FileText, MessageCircle, CheckCircle, XCircle, Shield, Filter, User, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ContentFlag {
  id: number;
  contentType: string;
  contentId: number;
  reason: string;
  status: string;
  createdAt: string;
  reporterId: number | null;
  reviewerId: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reporter: { id: number; displayName: string; profilePicture: string | null } | null;
  contentPreview: { text: string | null; thumbnail?: string | null; authorId?: number } | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  reel: Film,
  post: FileText,
  comment: MessageCircle,
  reel_comment: MessageCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  reviewed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  dismissed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function AdminModerationPage() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");
  const [filterType, setFilterType] = useState<"all" | "reel" | "post" | "comment" | "reel_comment">("all");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: flags, isLoading } = useQuery<ContentFlag[]>({
    queryKey: ["/api/admin/moderation"],
    refetchInterval: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      apiRequest(`/api/admin/moderation/${id}`, "PATCH", { action, reviewNotes: reviewNotes[id] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
      toast({ title: "Flag updated" });
    },
    onError: () => toast({ title: "Failed to update flag", variant: "destructive" }),
  });

  const filtered = (flags ?? []).filter(f => {
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (filterType !== "all" && f.contentType !== filterType) return false;
    return true;
  });

  const counts = {
    pending: (flags ?? []).filter(f => f.status === "pending").length,
    reviewed: (flags ?? []).filter(f => f.status === "reviewed").length,
    dismissed: (flags ?? []).filter(f => f.status === "dismissed").length,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Moderation Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Review reported content and take action</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending", count: counts.pending, color: "text-amber-500", bg: "bg-amber-500/10", status: "pending" as const },
          { label: "Reviewed", count: counts.reviewed, color: "text-blue-500", bg: "bg-blue-500/10", status: "reviewed" as const },
          { label: "Dismissed", count: counts.dismissed, color: "text-gray-500", bg: "bg-gray-500/10", status: "dismissed" as const },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setFilterStatus(filterStatus === s.status ? "all" : s.status)}
            className={cn(
              "rounded-xl p-4 border transition-all text-left",
              filterStatus === s.status ? `${s.bg} border-current ${s.color}` : "border-border bg-card"
            )}
          >
            <p className={cn("text-2xl font-bold", filterStatus === s.status ? "" : "text-foreground")}>{s.count}</p>
            <p className={cn("text-xs font-medium", filterStatus === s.status ? "" : "text-muted-foreground")}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Content type filter */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1"><Filter className="w-3 h-3" /> Type:</span>
        {(["all", "reel", "post", "comment", "reel_comment"] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize",
              filterType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"
            )}
          >
            {t === "reel_comment" ? "Reel Comment" : t}
          </button>
        ))}
      </div>

      {/* Flags list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reports found</p>
          <p className="text-sm mt-1">
            {filterStatus === "pending" ? "All caught up! No pending reports." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(flag => {
            const TypeIcon = TYPE_ICONS[flag.contentType] ?? Flag;
            const isExpanded = expandedId === flag.id;
            const isPending = flag.status === "pending";

            return (
              <div
                key={flag.id}
                data-testid={`flag-${flag.id}`}
                className={cn(
                  "border rounded-2xl overflow-hidden transition-all",
                  isPending ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card"
                )}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Content thumbnail / icon */}
                  <div className="shrink-0">
                    {flag.contentType === "reel" && flag.contentPreview?.thumbnail ? (
                      <div className="w-14 h-20 rounded-lg overflow-hidden bg-muted">
                        <img src={flag.contentPreview.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isPending ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
                      )}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] capitalize">{flag.contentType}</Badge>
                        <Badge className={cn("text-[10px] border capitalize", STATUS_COLORS[flag.status] || "")}>
                          {flag.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
                      </p>
                    </div>

                    <p className="text-sm font-medium text-foreground mt-1.5">
                      "{flag.reason}"
                    </p>

                    {flag.contentPreview?.text && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                        Content: {flag.contentPreview.text}
                      </p>
                    )}

                    {flag.reporter && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          Reported by <span className="font-medium">{flag.reporter.displayName}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isPending && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : flag.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      {isExpanded ? "Hide notes" : "Add review notes"}
                    </button>
                    {isExpanded && (
                      <Textarea
                        placeholder="Optional review notes…"
                        value={reviewNotes[flag.id] ?? ""}
                        onChange={e => setReviewNotes(prev => ({ ...prev, [flag.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        disabled={reviewMutation.isPending}
                        data-testid={`disable-content-${flag.id}`}
                        onClick={() => reviewMutation.mutate({ id: flag.id, action: "disable_content" })}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Disable Content
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        disabled={reviewMutation.isPending}
                        data-testid={`dismiss-${flag.id}`}
                        onClick={() => reviewMutation.mutate({ id: flag.id, action: "dismiss" })}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 gap-1.5"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: flag.id, action: "reviewed" })}
                      >
                        Mark Reviewed
                      </Button>
                    </div>
                  </div>
                )}

                {!isPending && flag.reviewedAt && (
                  <div className="border-t border-border/50 px-4 py-2.5 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-muted-foreground">
                      Reviewed {formatDistanceToNow(new Date(flag.reviewedAt), { addSuffix: true })}
                      {flag.reviewNotes && ` · "${flag.reviewNotes}"`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
