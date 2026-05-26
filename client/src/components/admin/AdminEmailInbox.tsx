import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Mail, MailOpen, Star, StarOff, Trash2, Search, RefreshCw,
  Building2, User, ChevronRight, ChevronLeft, Reply, AlertCircle,
  Inbox, Link2, CheckCircle, Clock, MessageCircle, Zap,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type InboxEmail = {
  id: number;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  matchedLeadId: number | null;
  leadOrganization: string | null;
  leadType: string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: diff > 86_400_000 * 365 ? "numeric" : undefined });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_COLORS: Record<string, string> = {
  municipality: "bg-blue-100 text-blue-700",
  venue: "bg-orange-100 text-orange-700",
  cultural_org: "bg-purple-100 text-purple-700",
  media: "bg-pink-100 text-pink-700",
  sponsor: "bg-amber-100 text-amber-700",
};

export default function AdminEmailInbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "starred" | "matched">("all");

  const { data: emails = [], isLoading, refetch, isFetching } = useQuery<InboxEmail[]>({
    queryKey: ["/api/admin/inbox"],
    queryFn: async () => {
      const r = await fetch("/api/admin/inbox", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch inbox");
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: routeStatus, refetch: refetchRouteStatus } = useQuery<{
    configured: boolean;
    routeExists: boolean;
    routeId?: string;
    hasPrimaryKey?: boolean;
    permissionError?: boolean;
    staleUrl?: boolean;
    error?: string;
  }>({
    queryKey: ["/api/admin/mailgun/route-status"],
    queryFn: async () => {
      const r = await fetch("/api/admin/mailgun/route-status", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to check route status");
      return r.json();
    },
    staleTime: 60_000,
  });

  const setupRouteMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/mailgun/setup-route", "POST", {}),
    onSuccess: async (data: any) => {
      refetchRouteStatus();
      if (data.alreadyExists) {
        toast({ title: "Route already active", description: "The Mailgun inbound route is already set up and receiving emails." });
      } else {
        toast({ title: "Route created!", description: "Mailgun will now forward incoming emails to this inbox automatically." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Failed to create route", description: err.message, variant: "destructive" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      apiRequest("PATCH", `/api/admin/inbox/${id}/read`, { isRead }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] }),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, isStarred }: { id: number; isStarred: boolean }) =>
      apiRequest("PATCH", `/api/admin/inbox/${id}/star`, { isStarred }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/inbox/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbox"] });
      if (selectedId !== null) setSelectedId(null);
      toast({ title: "Email deleted" });
    },
  });

  const filtered = useMemo(() => {
    let list = emails;
    if (filter === "unread") list = list.filter(e => !e.isRead);
    if (filter === "starred") list = list.filter(e => e.isStarred);
    if (filter === "matched") list = list.filter(e => e.matchedLeadId !== null);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.fromEmail.toLowerCase().includes(q) ||
        (e.fromName || "").toLowerCase().includes(q) ||
        (e.subject || "").toLowerCase().includes(q) ||
        (e.bodyText || "").toLowerCase().includes(q) ||
        (e.leadOrganization || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [emails, filter, search]);

  const selected = emails.find(e => e.id === selectedId) ?? null;
  const unreadCount = emails.filter(e => !e.isRead).length;

  function openEmail(email: InboxEmail) {
    setSelectedId(email.id);
    if (!email.isRead) {
      markReadMutation.mutate({ id: email.id, isRead: true });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-blue-600" />
            Email Inbox
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5">{unreadCount}</span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Incoming emails for riki@dancehealthy.net</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="btn-refresh-inbox"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Setup notice / route status */}
      {routeStatus?.routeExists ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <div className="flex-1 text-xs text-green-800">
            <span className="font-semibold">Mailgun inbound route is active.</span> Emails sent to riki@dancehealthy.net will appear here automatically.
          </div>
        </div>
      ) : routeStatus?.staleUrl ? (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-orange-800">
            <p className="font-semibold mb-1">Mailgun route is pointing to an old server URL.</p>
            <p>Click "Fix Route" to update it to the current server address so emails are delivered correctly.</p>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs"
            onClick={() => setupRouteMutation.mutate()}
            disabled={setupRouteMutation.isPending}
            data-testid="btn-fix-mailgun-route"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 ${setupRouteMutation.isPending ? "animate-pulse" : ""}`} />
            {setupRouteMutation.isPending ? "Fixing…" : "Fix Route"}
          </Button>
        </div>
      ) : routeStatus?.permissionError || (setupRouteMutation.isError && !routeStatus?.hasPrimaryKey) ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <p className="font-semibold mb-1">Your Mailgun API key needs to be the Primary key to manage routes.</p>
              <p className="text-blue-700">The domain sending key you have is only for sending emails. Route management requires the account-level primary key.</p>
            </div>
          </div>
          <div className="bg-white border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800">How to add your Mailgun Primary API Key:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Go to <strong>mailgun.com</strong> → log in → click your account name (top right) → <strong>API Keys</strong></li>
              <li>Under <strong>"Private API key"</strong>, copy the key (starts with <code className="bg-blue-50 px-1 rounded">key-</code>)</li>
              <li>In Replit, go to <strong>Secrets</strong> (lock icon in sidebar) → add a new secret named <code className="bg-blue-50 px-1 rounded">MAILGUN_PRIMARY_KEY</code> with that value</li>
              <li>Come back here and click <strong>"Auto-Setup Route"</strong></li>
            </ol>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
              onClick={() => { refetchRouteStatus(); setupRouteMutation.reset(); }}
              data-testid="btn-recheck-route"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Re-check after adding key
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-800">
            <p className="font-semibold mb-1">Mailgun inbound route not set up yet.</p>
            <p className="mb-2">Incoming emails to riki@dancehealthy.net are not being forwarded to this inbox. Click the button to set it up automatically.</p>
            {routeStatus?.error && !routeStatus.permissionError && (
              <p className="text-red-700 mb-2">Note: {routeStatus.error}</p>
            )}
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs"
            onClick={() => setupRouteMutation.mutate()}
            disabled={setupRouteMutation.isPending}
            data-testid="btn-setup-mailgun-route"
          >
            <Zap className={`w-3.5 h-3.5 mr-1.5 ${setupRouteMutation.isPending ? "animate-pulse" : ""}`} />
            {setupRouteMutation.isPending ? "Setting up…" : "Auto-Setup Route"}
          </Button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by sender, subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="input-inbox-search"
          />
        </div>
        {(["all", "unread", "starred", "matched"] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="h-8 text-xs capitalize"
            onClick={() => setFilter(f)}
            data-testid={`btn-filter-${f}`}
          >
            {f === "matched" ? "From Leads" : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && unreadCount > 0 && <span className="ml-1 bg-white/20 rounded-full px-1">{unreadCount}</span>}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading inbox…</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-border/60">
          <Inbox className="w-12 h-12 text-muted-foreground/25 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No emails yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
            Once you set up the Mailgun inbound route, replies to your outreach emails will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 min-h-[500px]">
          {/* Email list */}
          <div className={`flex flex-col gap-0 bg-white rounded-xl border border-border/60 overflow-hidden ${selected ? "w-80 shrink-0 hidden lg:flex" : "flex-1"}`}>
            {filtered.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-10">
                <p className="text-xs text-muted-foreground">No emails match filter</p>
              </div>
            ) : (
              filtered.map((email, i) => (
                <div
                  key={email.id}
                  onClick={() => openEmail(email)}
                  data-testid={`row-email-${email.id}`}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 cursor-pointer transition-colors
                    ${selectedId === email.id ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-gray-50/70"}
                    ${!email.isRead ? "bg-blue-50/30" : ""}`}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!email.isRead ? (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-xs font-semibold truncate ${!email.isRead ? "text-gray-900" : "text-gray-600"}`}>
                        {email.fromName || email.fromEmail}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtDate(email.receivedAt)}</span>
                    </div>
                    <p className={`text-[11px] truncate ${!email.isRead ? "font-medium text-gray-800" : "text-gray-600"}`}>
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {email.bodyText?.slice(0, 80) || ""}
                    </p>
                    {email.matchedLeadId && (
                      <div className="flex items-center gap-1 mt-1">
                        <Link2 className="w-2.5 h-2.5 text-green-600" />
                        <span className="text-[10px] text-green-700 font-medium truncate">{email.leadOrganization}</span>
                        {email.leadType && (
                          <span className={`text-[9px] px-1 rounded ${TYPE_COLORS[email.leadType] || "bg-gray-100 text-gray-600"}`}>
                            {email.leadType.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {email.isStarred && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-1" />}
                </div>
              ))
            )}
          </div>

          {/* Email detail */}
          {selected && (
            <div className="flex-1 bg-white rounded-xl border border-border/60 overflow-hidden flex flex-col min-w-0">
              {/* Detail header */}
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/60">
                <div className="flex-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground mb-2 -ml-2 lg:hidden"
                    onClick={() => setSelectedId(null)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
                  </Button>
                  <h3 className="text-sm font-bold text-gray-900">{selected.subject || "(no subject)"}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{fmtFull(selected.receivedAt)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 w-8 p-0 ${selected.isStarred ? "text-amber-400" : "text-muted-foreground"}`}
                    onClick={() => starMutation.mutate({ id: selected.id, isStarred: !selected.isStarred })}
                    title={selected.isStarred ? "Unstar" : "Star"}
                    data-testid="btn-star-email"
                  >
                    {selected.isStarred ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                    onClick={() => markReadMutation.mutate({ id: selected.id, isRead: !selected.isRead })}
                    title={selected.isRead ? "Mark as unread" : "Mark as read"}
                    data-testid="btn-toggle-read"
                  >
                    {selected.isRead ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteMutation.mutate(selected.id)}
                    title="Delete email"
                    data-testid="btn-delete-email"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Sender info */}
              <div className="px-5 py-3 bg-gray-50/70 border-b border-border/40 flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">From</p>
                  <p className="text-xs font-medium text-gray-800">
                    {selected.fromName ? `${selected.fromName} ` : ""}<span className="text-blue-600">&lt;{selected.fromEmail}&gt;</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">To</p>
                  <p className="text-xs text-gray-700">{selected.toEmail}</p>
                </div>
                {selected.matchedLeadId && (
                  <div className="ml-auto flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                    <Link2 className="w-3.5 h-3.5 text-green-600" />
                    <div>
                      <p className="text-[10px] text-green-600 font-semibold">Linked to Lead</p>
                      <p className="text-[11px] text-green-800 font-medium">{selected.leadOrganization}</p>
                    </div>
                    {selected.leadType && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${TYPE_COLORS[selected.leadType] || "bg-gray-100 text-gray-600"}`}>
                        {selected.leadType.replace("_", " ")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Reply button */}
              <div className="px-5 py-3 border-b border-border/40">
                <a
                  href={`mailto:${selected.fromEmail}?subject=Re: ${encodeURIComponent(selected.subject || "")}&body=%0A%0A----%0AOriginal message from ${selected.fromEmail}%0A`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors"
                  data-testid="btn-reply-email"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply to {selected.fromEmail}
                </a>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {selected.bodyHtml ? (
                  <iframe
                    srcDoc={selected.bodyHtml}
                    className="w-full min-h-64 border-0"
                    sandbox="allow-same-origin"
                    title="Email content"
                    style={{ height: "500px" }}
                  />
                ) : selected.bodyText ? (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.bodyText}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No email body</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
