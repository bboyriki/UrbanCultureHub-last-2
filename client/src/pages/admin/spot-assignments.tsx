import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin, Search, Users, Calendar, ChevronLeft, ChevronRight,
  UserCheck, UserX, ExternalLink, Loader2, Building2, X, Star,
  Bot, Send, Sparkles, CheckCircle2, XCircle, Clock, Shield,
  Eye, RotateCcw, Award, MessageSquare, ChevronDown, Plus,
  TrendingUp, AlertCircle, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

// ── Constants ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  dance: "Dance", skate: "Skate", parkour: "Parkour", graffiti: "Graffiti",
  music: "Music", training: "Training", fitness: "Fitness", bmx: "BMX",
  basketball: "Basketball", table_tennis: "Table Tennis", cafe: "Café",
  restaurant: "Restaurant", wellness: "Wellness", nightlife: "Nightlife",
  cultural_hub: "Cultural Hub", open_mic: "Open Mic", workshop: "Workshop",
  street_sports: "Street Sports", bouldering: "Bouldering", padel: "Padel",
  rap: "Rap", beatbox: "Beatbox", performance: "Performance", other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  dance: "bg-pink-100 text-pink-700", skate: "bg-orange-100 text-orange-700",
  parkour: "bg-yellow-100 text-yellow-700", graffiti: "bg-purple-100 text-purple-700",
  music: "bg-blue-100 text-blue-700", training: "bg-green-100 text-green-700",
  fitness: "bg-emerald-100 text-emerald-700", bmx: "bg-red-100 text-red-700",
  basketball: "bg-amber-100 text-amber-700", cafe: "bg-stone-100 text-stone-700",
  nightlife: "bg-violet-100 text-violet-700", cultural_hub: "bg-teal-100 text-teal-700",
  other: "bg-slate-100 text-slate-700",
};

// ── Types ──────────────────────────────────────────────────────────────
type SpotRow = {
  id: number | null; osmId?: number | null; name: string; category: string;
  address: string | null; lat?: number | null; lon?: number | null;
  active: boolean; isSuperFeatured: boolean; ownedByUserId: number | null;
  linkedLocationId: number | null; ownerDisplayName: string | null;
  ownerEmail: string | null; isSpotlighted: boolean;
};

type UserRow = { id: number; displayName: string; email: string; role: string; avatar?: string };

type ClaimRow = {
  claim: {
    id: number; spotRef: string; spotName: string; spotCategory?: string; spotAddress?: string;
    claimantId: number; businessName?: string; businessEmail?: string; businessPhone?: string;
    role?: string; verificationNote?: string; websiteUrl?: string; kvkNumber?: string;
    status: string; adminNote?: string; aiSummary?: string; claimedAt: string;
  };
  claimantName: string; claimantEmail: string; claimantAvatar?: string;
};

type OwnershipRow = {
  ownership: {
    id: number; spotRef: string; spotName: string; spotCategory?: string; spotAddress?: string;
    ownerId: number; businessName?: string; role: string; grantedAt: string;
  };
  ownerName: string; ownerEmail: string; ownerAvatar?: string;
};

type ChatMessage = { role: "user" | "assistant"; text: string; ts: number };

// ── UserPicker ─────────────────────────────────────────────────────────
function UserPicker({ onSelect, onClose }: { onSelect: (u: UserRow) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["/api/admin/users-list", search],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users-list?search=${encodeURIComponent(search)}`, { credentials: "include" });
      return res.json();
    },
  });
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email..." className="pl-9" value={search}
          onChange={e => setSearch(e.target.value)} autoFocus data-testid="input-user-search" />
      </div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {users.slice(0, 20).map(u => (
            <button key={u.id} onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted text-left transition-colors"
              data-testid={`select-user-${u.id}`}>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" /> : <Users className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs">{u.role}</Badge>
            </button>
          ))}
          {users.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No users found</p>}
        </div>
      )}
    </div>
  );
}

// ── ClaimCard ─────────────────────────────────────────────────────────
function ClaimCard({ row, onApprove, onReject, onAiAssist, aiLoading }: {
  row: ClaimRow;
  onApprove: (id: number, note: string) => void;
  onReject: (id: number, note: string) => void;
  onAiAssist: (id: number, action: string) => void;
  aiLoading: boolean;
}) {
  const { claim, claimantName, claimantEmail } = row;
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(claim.adminNote || "");

  const statusColor = claim.status === "approved" ? "text-green-600 bg-green-50 border-green-200"
    : claim.status === "rejected" ? "text-red-600 bg-red-50 border-red-200"
    : "text-amber-600 bg-amber-50 border-amber-200";

  return (
    <Card className={cn("p-4 space-y-3 transition-all", claim.status !== "pending" && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-foreground">{claim.spotName}</p>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", statusColor)}>
              {claim.status === "approved" ? "✓ Approved" : claim.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{claim.spotRef} · {claim.spotAddress || "Address unknown"}</p>
          <div className="flex items-center gap-2 mt-1">
            <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium">{claimantName}</span>
            <span className="text-xs text-muted-foreground">({claimantEmail})</span>
            {claim.businessName && <Badge variant="outline" className="text-[10px] h-4">{claim.businessName}</Badge>}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {/* AI Summary */}
      {claim.aiSummary && (
        <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 p-3 flex gap-2">
          <Bot className="h-4 w-4 text-purple-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-purple-800 dark:text-purple-300 leading-relaxed">{claim.aiSummary}</p>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {claim.businessEmail && <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{claim.businessEmail}</span></div>}
            {claim.businessPhone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{claim.businessPhone}</span></div>}
            {claim.kvkNumber && <div><span className="text-muted-foreground">KvK:</span> <span className="font-medium">{claim.kvkNumber}</span></div>}
            {claim.websiteUrl && <div><span className="text-muted-foreground">Website:</span> <a href={claim.websiteUrl} target="_blank" className="text-primary hover:underline truncate">{claim.websiteUrl}</a></div>}
            {claim.role && <div><span className="text-muted-foreground">Role:</span> <span className="font-medium">{claim.role}</span></div>}
          </div>
          {claim.verificationNote && (
            <div className="rounded-lg bg-muted/50 p-2.5">
              <p className="text-xs text-muted-foreground font-medium mb-1">Verification note:</p>
              <p className="text-xs text-foreground leading-relaxed">{claim.verificationNote}</p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Submitted: {new Date(claim.claimedAt).toLocaleDateString("nl-NL", { dateStyle: "long" })}</p>
        </div>
      )}

      {/* Admin actions */}
      {claim.status === "pending" && (
        <div className="space-y-2 border-t border-border/40 pt-2">
          <Input
            placeholder="Admin note (optional)..."
            className="h-8 text-xs rounded-xl"
            value={note}
            onChange={e => setNote(e.target.value)}
            data-testid={`input-admin-note-${claim.id}`}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => onAiAssist(claim.id, "verify")}
              disabled={aiLoading}
              variant="outline" className="h-7 text-xs gap-1 rounded-full border-purple-300 text-purple-700 hover:bg-purple-50 flex-shrink-0"
              data-testid={`btn-ai-verify-${claim.id}`}>
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              AI Verify
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => onReject(claim.id, note)}
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
              data-testid={`btn-reject-${claim.id}`}>
              <XCircle className="h-3 w-3" />Reject
            </Button>
            <Button size="sm" onClick={() => onApprove(claim.id, note)}
              className="h-7 text-xs gap-1 rounded-full bg-green-600 hover:bg-green-700 text-white"
              data-testid={`btn-approve-${claim.id}`}>
              <CheckCircle2 className="h-3 w-3" />Approve
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Edmond AI Chat ────────────────────────────────────────────────────
function EdmondChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "👋 Hi! I'm **Edmond**, your AI assistant for the Urban Culture Hub. I can help you:\n\n• Review spot ownership claims\n• Find which user should own which spot\n• Check if a business is legitimate\n• Draft approval/rejection messages\n\nWhat do you need help with?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg, ts: Date.now() }]);
    setLoading(true);
    try {
      const res = await apiRequest("/api/spot-claims/ai-chat", "POST", {
        message: userMsg,
        context: "Admin spot ownership panel — Edmond AI assistant",
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", text: data.reply || "I couldn't generate a response.", ts: Date.now() }]);
    } catch {
      toast({ title: "Edmond is unavailable", variant: "destructive" });
      setMessages(m => [...m, { role: "assistant", text: "Sorry, I'm having trouble right now. Please try again.", ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-black text-sm text-foreground">Edmond AI</p>
          <p className="text-[10px] text-muted-foreground">Your smart spot ownership assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Online</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2 max-w-[88%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}
              <div className={cn(
                "rounded-2xl px-3 py-2 text-xs leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted/60 text-foreground rounded-bl-sm"
              )}>
                {msg.text.split("\n").map((line, j) => (
                  <span key={j}>
                    {line.replace(/\*\*(.*?)\*\*/g, (_, t) => t).split(/\*\*(.*?)\*\*/).map((part, k) =>
                      k % 2 === 1 ? <strong key={k}>{part}</strong> : part
                    )}
                    {j < msg.text.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-3 py-2">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/40 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask Edmond anything about spot ownership..."
          className="flex-1 rounded-xl text-sm h-9 border-border/60 bg-muted/40 focus:bg-background"
          disabled={loading}
          data-testid="input-edmond-chat"
        />
        <Button size="sm" onClick={send} disabled={!input.trim() || loading}
          className="h-9 w-9 p-0 rounded-xl flex-shrink-0" data-testid="btn-edmond-send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Direct Assignment Tool ─────────────────────────────────────────────
function DirectAssignTool() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [spotRef, setSpotRef] = useState("");
  const [spotName, setSpotName] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [showUserPicker, setShowUserPicker] = useState(false);

  const { data: userResults = [], isLoading: userLoading } = useQuery<UserRow[]>({
    queryKey: ["/api/users/search", userSearch],
    queryFn: async () => {
      if (userSearch.length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`, { credentials: "include" });
      return res.json();
    },
    enabled: userSearch.length >= 2,
  });

  const assignMut = useMutation({
    mutationFn: () => apiRequest("/api/spot-ownerships/assign", "POST", {
      spotRef: spotRef.trim(),
      spotName: spotName.trim(),
      ownerId: selectedUser?.id,
      businessName: selectedUser?.displayName,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-ownerships/all"] });
      toast({ title: "✅ Spot assigned!", description: `${spotName} → ${selectedUser?.displayName}` });
      setSpotRef(""); setSpotName(""); setSelectedUser(null); setUserSearch("");
    },
    onError: () => toast({ title: "Assignment failed", variant: "destructive" }),
  });

  return (
    <div className="rounded-2xl border border-border/50 p-4 space-y-3 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Award className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="font-bold text-sm">Direct Assignment</p>
          <p className="text-[11px] text-muted-foreground">Assign any spot to any user instantly</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Spot Reference *</label>
          <Input value={spotRef} onChange={e => setSpotRef(e.target.value)}
            placeholder="city-34, osm-12345, user-7"
            className="rounded-xl text-xs h-9" data-testid="input-spot-ref" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Spot Name *</label>
          <Input value={spotName} onChange={e => setSpotName(e.target.value)}
            placeholder="e.g. Shelter Amsterdam"
            className="rounded-xl text-xs h-9" data-testid="input-spot-name" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">Assign to user *</label>
        {selectedUser ? (
          <div className="flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-muted/30">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full rounded-full object-cover" /> : <Users className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{selectedUser.displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selectedUser.email}</p>
            </div>
            <button onClick={() => { setSelectedUser(null); setUserSearch(""); }}
              className="p-1 rounded-lg hover:bg-muted transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <Input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Type name or email to search..."
              className="rounded-xl text-xs h-9" data-testid="input-assign-user-search" />
            {userSearch.length >= 2 && (
              <div className="rounded-xl border border-border/50 bg-card shadow-sm divide-y divide-border/30 overflow-hidden max-h-40 overflow-y-auto">
                {userLoading ? <div className="p-3 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  : userResults.length === 0 ? <p className="text-xs text-muted-foreground p-3 text-center">No users found</p>
                  : userResults.map(u => (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setUserSearch(""); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{u.displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        )}
      </div>

      <Button onClick={() => assignMut.mutate()}
        disabled={!spotRef.trim() || !spotName.trim() || !selectedUser || assignMut.isPending}
        className="w-full rounded-xl h-9 gap-2 font-bold text-sm" data-testid="btn-assign-spot">
        {assignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
        Assign Ownership
      </Button>
    </div>
  );
}

// ── Active Ownerships ─────────────────────────────────────────────────
function ActiveOwnerships() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<OwnershipRow[]>({
    queryKey: ["/api/spot-ownerships/all"],
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/spot-ownerships/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-ownerships/all"] });
      toast({ title: "Ownership revoked" });
    },
    onError: () => toast({ title: "Failed to revoke", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return (
    <div className="text-center py-8 text-muted-foreground">
      <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No active ownerships yet</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {rows.map(({ ownership, ownerName, ownerEmail }) => (
        <div key={ownership.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground line-clamp-1">{ownership.spotName}</p>
            <p className="text-[10px] text-muted-foreground">{ownership.spotRef}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <UserCheck className="h-3 w-3 text-green-500 flex-shrink-0" />
              <span className="text-xs font-medium">{ownerName}</span>
              <span className="text-[10px] text-muted-foreground">({ownerEmail})</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-[10px]">{ownership.role}</Badge>
            <button onClick={() => revokeMut.mutate(ownership.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 text-muted-foreground transition-colors"
              data-testid={`btn-revoke-${ownership.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Legacy Spot List (existing functionality) ──────────────────────────
function SpotList() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "spotlighted" | "osm_only">("all");
  const [assigningSpot, setAssigningSpot] = useState<SpotRow | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ spots: SpotRow[]; total: number; pages: number; page: number }>({
    queryKey: ["/api/admin/spot-assignments", debouncedSearch, page, filter],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/spot-assignments?search=${encodeURIComponent(debouncedSearch)}&page=${page}&filter=${filter}`,
        { credentials: "include" }
      );
      return res.json();
    },
  });

  const assignOwnerMutation = useMutation({
    mutationFn: async ({ spotId, userId }: { spotId: number; userId: number }) => {
      const res = await apiRequest(`/api/admin/spot-assignments/${spotId}/assign-owner`, "POST", { userId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/spot-assignments"] });
      toast({ title: "Owner assigned" });
      setAssigningSpot(null);
    },
    onError: () => toast({ title: "Failed to assign owner", variant: "destructive" }),
  });

  const spots = data?.spots || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search spots..." className="pl-9" value={search}
            onChange={e => { setSearch(e.target.value); setDebouncedSearch(e.target.value); setPage(1); }}
            data-testid="input-spot-search" />
          {search && <button onClick={() => { setSearch(""); setDebouncedSearch(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </div>
        <div className="flex gap-1.5 text-xs">
          {(["all", "spotlighted", "osm_only"] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full border transition-colors",
                filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
              data-testid={`filter-${f}`}>
              {f === "all" ? "All Spots" : f === "spotlighted" ? "⭐ Featured" : "🗺 OSM Only"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{total.toLocaleString()} spots</p>
      </div>

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <>
          <div className="space-y-2">
            {spots.map((spot, idx) => {
              const catLabel = CATEGORY_LABELS[spot.category] || spot.category;
              const catColor = CATEGORY_COLORS[spot.category] || CATEGORY_COLORS.other;
              const rowKey = spot.id != null ? `sl-${spot.id}` : `osm-${spot.osmId ?? idx}`;
              return (
                <div key={rowKey} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card hover:bg-muted/20 transition-colors">
                  <MapPin className={cn("h-4 w-4 flex-shrink-0 hidden sm:block", spot.isSpotlighted ? "text-yellow-500" : "text-muted-foreground/40")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{spot.name}</p>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", catColor)}>{catLabel}</span>
                      {spot.isSpotlighted && <Badge className="text-[10px] h-4 bg-yellow-100 text-yellow-700 border-yellow-200 border">⭐ Featured</Badge>}
                    </div>
                    {spot.address && <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {spot.address}</p>}
                    {spot.ownedByUserId
                      ? <div className="flex items-center gap-1 mt-1"><UserCheck className="h-3 w-3 text-green-600" /><span className="text-xs text-green-700 font-medium">{spot.ownerDisplayName}</span></div>
                      : <div className="flex items-center gap-1 mt-1"><UserX className="h-3 w-3 text-muted-foreground/50" /><span className="text-xs text-muted-foreground">No owner</span></div>
                    }
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-full flex-shrink-0"
                    onClick={() => setAssigningSpot(spot)} data-testid={`btn-assign-${rowKey}`}>
                    <UserCheck className="h-3 w-3" />Assign
                  </Button>
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0 rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">Page {page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0 rounded-full">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Assign dialog */}
      {assigningSpot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAssigningSpot(null)} />
          <div className="relative w-full max-w-md bg-card rounded-2xl border border-border/50 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Assign owner to</h3>
              <button onClick={() => setAssigningSpot(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm font-semibold text-foreground bg-muted/40 rounded-xl px-3 py-2">{assigningSpot.name}</p>
            <UserPicker
              onSelect={u => assigningSpot.id != null && assignOwnerMutation.mutate({ spotId: assigningSpot.id, userId: u.id })}
              onClose={() => setAssigningSpot(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
type Tab = "claims" | "assign" | "ownerships" | "spots" | "edmond";

export default function SpotAssignmentsPage() {
  const [tab, setTab] = useState<Tab>("edmond");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [claimStatusFilter, setClaimStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);

  const { data: claims = [], isLoading: claimsLoading } = useQuery<ClaimRow[]>({
    queryKey: ["/api/spot-claims", claimStatusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/spot-claims?status=${claimStatusFilter}`, { credentials: "include" });
      return res.json();
    },
  });

  const pendingCount = claims.filter(c => c.claim.status === "pending").length;

  const approveMut = useMutation({
    mutationFn: ({ id, adminNote }: { id: number; adminNote: string }) =>
      apiRequest(`/api/spot-claims/${id}/approve`, "PATCH", { adminNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-claims"] });
      qc.invalidateQueries({ queryKey: ["/api/spot-ownerships/all"] });
      toast({ title: "✅ Claim approved!", description: "Owner access granted for this spot." });
    },
    onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, adminNote }: { id: number; adminNote: string }) =>
      apiRequest(`/api/spot-claims/${id}/reject`, "PATCH", { adminNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spot-claims"] });
      toast({ title: "Claim rejected" });
    },
    onError: () => toast({ title: "Failed to reject", variant: "destructive" }),
  });

  const aiAssistMut = useMutation({
    mutationFn: ({ claimId, action }: { claimId: number; action: string }) =>
      apiRequest("/api/spot-claims/ai-assist", "POST", { claimId, action }),
    onSuccess: (_, { claimId }) => {
      qc.invalidateQueries({ queryKey: ["/api/spot-claims"] });
      setAiLoadingId(null);
      toast({ title: "Edmond analyzed the claim", description: "AI verification complete." });
    },
    onError: () => { setAiLoadingId(null); toast({ title: "AI analysis failed", variant: "destructive" }); },
  });

  const TABS: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: "edmond", label: "Edmond AI", icon: Bot },
    { key: "claims", label: "Claims", icon: Clock, badge: claimStatusFilter === "pending" ? pendingCount : undefined },
    { key: "assign", label: "Quick Assign", icon: Award },
    { key: "ownerships", label: "Active Owners", icon: UserCheck },
    { key: "spots", label: "All Spots", icon: MapPin },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Edmond</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Smart spot ownership system for 32,000+ Urban Culture Hub spots
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pending Claims", value: pendingCount, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", icon: Clock },
            { label: "Active Owners", value: "—", color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", icon: UserCheck },
            { label: "Total Spots", value: "32K+", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", icon: MapPin },
          ].map(stat => (
            <div key={stat.label} className={cn("rounded-2xl p-3 flex items-center gap-3", stat.bg)}>
              <div className="flex flex-col min-w-0">
                <span className={cn("text-xl font-black", stat.color)}>{stat.value}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl border border-border/40 bg-muted/30 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all relative",
                tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${t.key}`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "edmond" && <EdmondChat />}

        {tab === "claims" && (
          <div className="space-y-4">
            <div className="flex gap-1.5 flex-wrap">
              {(["pending", "approved", "rejected", "all"] as const).map(s => (
                <button key={s} onClick={() => setClaimStatusFilter(s)}
                  className={cn("px-3 py-1 rounded-full text-xs font-bold border transition-colors",
                    claimStatusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
                  data-testid={`filter-claim-${s}`}>
                  {s === "pending" ? "⏳ Pending" : s === "approved" ? "✓ Approved" : s === "rejected" ? "✗ Rejected" : "All"}
                </button>
              ))}
            </div>
            {claimsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              : claims.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No {claimStatusFilter} claims</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map(row => (
                    <ClaimCard
                      key={row.claim.id}
                      row={row}
                      onApprove={(id, note) => approveMut.mutate({ id, adminNote: note })}
                      onReject={(id, note) => rejectMut.mutate({ id, adminNote: note })}
                      onAiAssist={(id, action) => {
                        setAiLoadingId(id);
                        aiAssistMut.mutate({ claimId: id, action });
                      }}
                      aiLoading={aiLoadingId === row.claim.id && aiAssistMut.isPending}
                    />
                  ))}
                </div>
              )}
          </div>
        )}

        {tab === "assign" && <DirectAssignTool />}
        {tab === "ownerships" && <ActiveOwnerships />}
        {tab === "spots" && <SpotList />}
      </div>
    </AdminLayout>
  );
}
