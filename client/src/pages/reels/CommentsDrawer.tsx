import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Trash2, Flag, MoreHorizontal, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CommentsDrawerProps {
  reelId: number;
  commentsCount: number;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "violence", label: "Violence or threats" },
  { value: "other", label: "Other" },
];

export default function CommentsDrawer({ reelId, commentsCount, onClose }: CommentsDrawerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDone, setReportDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const { data: comments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reels", reelId, "comments"],
    queryFn: async () => {
      const res = await apiRequest(`/api/reels/${reelId}/comments`, "GET");
      return res.json();
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest(`/api/reels/${reelId}/comments`, "POST", { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reels", reelId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      setText("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) =>
      apiRequest(`/api/reels/comments/${commentId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reels", reelId, "comments"] });
      setMenuOpen(null);
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({ commentId, reason }: { commentId: number; reason: string }) =>
      apiRequest(`/api/reels/comments/${commentId}/report`, "POST", { reason }),
    onSuccess: (_, { commentId }) => {
      setReportDone(prev => new Set(prev).add(commentId));
      setReportTarget(null);
      setReportReason("");
      toast({ title: "Report submitted", description: "Thanks — our team will review this comment." });
    },
    onError: () => {
      toast({ title: "Report failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!text.trim() || postMutation.isPending) return;
    postMutation.mutate(text.trim());
  };

  const handleReport = () => {
    if (!reportReason || !reportTarget) return;
    reportMutation.mutate({ commentId: reportTarget, reason: reportReason });
  };

  return (
    <div className="fixed inset-0 z-[90]" onClick={close}>
      {/* Backdrop */}
      <div className={cn("absolute inset-0 bg-black/60 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")} />

      {/* Drawer */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 bg-zinc-950 rounded-t-3xl border-t border-zinc-800 flex flex-col",
          "transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h3 className="text-white font-semibold text-sm">
            {isLoading ? commentsCount : comments.length}{" "}
            {(isLoading ? commentsCount : comments.length) === 1 ? "comment" : "comments"}
          </h3>
          <button onClick={close} className="text-zinc-400 hover:text-white" data-testid="button-close-comments">
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" onClick={() => setMenuOpen(null)}>
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="text-zinc-500 animate-spin" />
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <div className="text-center py-10">
              <p className="text-zinc-500 text-sm">No comments yet. Be the first!</p>
            </div>
          )}

          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-3 relative" data-testid={`comment-item-${c.id}`}>
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden">
                {c.user?.profilePicture ? (
                  <img src={c.user.profilePicture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400 font-bold">
                    {(c.user?.displayName || "?")[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-xs font-semibold">{c.user?.displayName || "User"}</span>
                  <span className="text-zinc-600 text-[10px]">
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-zinc-300 text-sm mt-0.5 break-words">{c.content}</p>
              </div>

              {/* Actions: 3-dot menu */}
              {user && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === c.id ? null : c.id); }}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
                    data-testid={`button-comment-menu-${c.id}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {menuOpen === c.id && (
                    <div className="absolute right-0 top-6 z-10 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl min-w-[130px] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}>
                      {/* Report option (for other users' comments) */}
                      {c.userId !== user.id && (
                        <button
                          onClick={() => { setReportTarget(c.id); setMenuOpen(null); }}
                          disabled={reportDone.has(c.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors",
                            reportDone.has(c.id)
                              ? "text-zinc-600 cursor-default"
                              : "text-orange-400 hover:bg-zinc-800"
                          )}
                          data-testid={`button-report-comment-${c.id}`}
                        >
                          <Flag size={12} />
                          {reportDone.has(c.id) ? "Reported" : "Report"}
                        </button>
                      )}

                      {/* Delete option (own comments or admin) */}
                      {(c.userId === user.id || user.role === "admin") && (
                        <button
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-zinc-800 transition-colors text-left"
                          data-testid={`button-delete-comment-${c.id}`}
                        >
                          {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-zinc-800 flex gap-3 items-center"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          {user ? (
            <>
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400 font-bold">
                    {(user.displayName || "?")[0].toUpperCase()}
                  </div>
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Add a comment…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                className="flex-1 bg-zinc-900 text-white text-sm rounded-full px-4 py-2 outline-none border border-zinc-700 focus:border-primary/50 placeholder:text-zinc-500"
                data-testid="input-comment"
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || postMutation.isPending}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  text.trim() ? "bg-primary text-white" : "bg-zinc-800 text-zinc-600"
                )}
                data-testid="button-submit-comment"
              >
                {postMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </>
          ) : (
            <p className="text-zinc-500 text-sm text-center w-full py-1">Sign in to comment</p>
          )}
        </div>
      </div>

      {/* Report reason sheet */}
      {reportTarget !== null && (
        <div className="absolute inset-0 z-[100] flex items-end justify-center" onClick={() => setReportTarget(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg bg-zinc-900 rounded-t-3xl border-t border-zinc-700 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-white font-semibold text-sm">Report comment</h4>
              <button onClick={() => setReportTarget(null)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-zinc-500 text-xs">Why are you reporting this comment?</p>

            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReportReason(r.value)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-all",
                    reportReason === r.value
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  )}
                  data-testid={`report-reason-${r.value}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleReport}
              disabled={!reportReason || reportMutation.isPending}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
              Submit Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
