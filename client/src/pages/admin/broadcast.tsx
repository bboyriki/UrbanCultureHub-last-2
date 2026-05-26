import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, Users, Star, UserCheck, CheckCircle, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BroadcastLog {
  id: number;
  title: string;
  message: string;
  target: string;
  actionLink: string | null;
  recipientCount: number;
  sentAt: string;
  adminName: string;
}

const TARGET_OPTIONS = [
  { value: "all", label: "All Users", icon: Users, desc: "Send to every registered user", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { value: "premium", label: "Premium Members", icon: Star, desc: "Only paid subscribers", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { value: "free", label: "Free Users", icon: UserCheck, desc: "Non-premium users only", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
];

export default function AdminBroadcastPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all" | "premium" | "free">("all");
  const [actionLink, setActionLink] = useState("");
  const [actionText, setActionText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sentResult, setSentResult] = useState<{ recipientCount: number } | null>(null);

  const { data: history, isLoading: historyLoading } = useQuery<BroadcastLog[]>({
    queryKey: ["/api/admin/broadcast/history"],
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/broadcast", "POST", {
      title, message, target,
      actionLink: actionLink || undefined,
      actionText: actionText || undefined,
    }),
    onSuccess: async (res: any) => {
      const data = await res.json().catch(() => ({}));
      setSentResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/broadcast/history"] });
      toast({ title: `Broadcast sent to ${data.recipientCount?.toLocaleString() ?? "?"} users` });
      setTitle(""); setMessage(""); setActionLink(""); setActionText("");
    },
    onError: () => toast({ title: "Failed to send broadcast", variant: "destructive" }),
  });

  const selectedTarget = TARGET_OPTIONS.find(t => t.value === target)!;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Send className="w-6 h-6 text-primary" />
          Broadcast Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Send in-app notifications to your users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Target selector */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Target Audience</p>
            <div className="grid grid-cols-3 gap-3">
              {TARGET_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const active = target === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTarget(opt.value as any)}
                    data-testid={`target-${opt.value}`}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-3.5 rounded-xl border transition-all text-left",
                      active ? `${opt.color} border-current` : "border-border bg-card hover:bg-accent"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", active ? "" : "text-muted-foreground")} />
                    <span className={cn("text-sm font-semibold leading-none", active ? "" : "text-foreground")}>{opt.label}</span>
                    <span className={cn("text-[10px] leading-tight", active ? "opacity-80" : "text-muted-foreground")}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Notification Title</label>
            <Input
              data-testid="input-broadcast-title"
              placeholder="Urban Culture Hub Update"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/80</p>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Message</label>
            <Textarea
              data-testid="input-broadcast-message"
              placeholder="Write your message here…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/500</p>
          </div>

          {/* Advanced (action link) */}
          <div>
            <button
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced(s => !s)}
            >
              <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
              Advanced options (optional CTA)
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3 pl-6 border-l border-border">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Action Link (URL path)</label>
                  <Input data-testid="input-action-link" placeholder="/reels" value={actionLink} onChange={e => setActionLink(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Button Label</label>
                  <Input data-testid="input-action-text" placeholder="View Now" value={actionText} onChange={e => setActionText(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Send button */}
          <Button
            data-testid="button-send-broadcast"
            onClick={() => sendMutation.mutate()}
            disabled={!title.trim() || !message.trim() || sendMutation.isPending}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {sendMutation.isPending ? "Sending…" : `Send to ${selectedTarget.label}`}
          </Button>

          {/* Success state */}
          {sentResult && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Broadcast delivered!</p>
                <p className="text-xs text-muted-foreground">Sent to {sentResult.recipientCount.toLocaleString()} users</p>
              </div>
              <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSentResult(null)}>Dismiss</button>
            </div>
          )}
        </div>

        {/* Broadcast history */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Broadcast History
          </h2>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No broadcasts sent yet</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {history.map(b => (
                <div key={b.id} className="border border-border rounded-xl p-3 space-y-1.5" data-testid={`broadcast-${b.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-tight">{b.title}</p>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{b.target}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{b.message}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                    <span>{b.recipientCount.toLocaleString()} recipients</span>
                    <span>{formatDistanceToNow(new Date(b.sentAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
