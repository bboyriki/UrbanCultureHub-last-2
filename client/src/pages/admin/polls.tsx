import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  BarChart3, Vote, Plus, Play, Pause, X, Trash2, RotateCcw,
  Eye, EyeOff, Users, Trophy, Search, CheckCircle2, Shield,
  Copy, Download, Pencil, TrendingUp, Clock, Star, ChevronDown,
  AlertTriangle, Layers,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PollWithMeta {
  id: number;
  eventId: number;
  question: string;
  description: string | null;
  pollType: "yes_no" | "custom" | "rating";
  options: string[];
  status: "draft" | "active" | "paused" | "closed";
  resultsVisibility: "live" | "after_close";
  voterAccess: "all" | "attendees";
  closesAt: string | null;
  totalVotes: number;
  createdAt: string;
  event: { id: number; title: string };
  creator: { id: number; displayName: string };
}

interface EventOption {
  id: number;
  title: string;
  date: string | null;
}

interface UserWithPolls {
  id: number;
  displayName: string;
  email: string;
  role: string;
  canCreatePolls: boolean;
}

interface Voter {
  userId: number;
  displayName: string;
  option: string;
  votedAt: string;
}

interface PollAnalytics {
  poll: PollWithMeta;
  results: Record<string, number>;
  timeline: Array<{ hour: string; count: number }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", dot: "bg-gray-400" },
  active: { label: "Active", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", dot: "bg-green-500" },
  paused: { label: "Paused", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "bg-yellow-500" },
  closed: { label: "Closed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-400" },
};

const POLL_TYPE_LABELS: Record<string, string> = {
  yes_no: "Yes / No",
  custom: "Multiple Choice",
  rating: "Star Rating",
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// ── Event Search Picker ──────────────────────────────────────────────────────
function EventPicker({ value, onChange }: { value: string; onChange: (id: string, title: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState("");

  const { data: events = [], isFetching } = useQuery<EventOption[]>({
    queryKey: ["/api/admin/events/search", search],
    queryFn: async () => {
      const res = await fetch(`/api/admin/events/search?q=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
    staleTime: 30000,
  });

  return (
    <div className="relative">
      <div
        data-testid="button-event-picker"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent"
      >
        <span className={selectedTitle ? "text-foreground" : "text-muted-foreground"}>
          {selectedTitle || "Search and select an event…"}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <Input
              data-testid="input-event-search"
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isFetching ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Searching…</div>
            ) : events.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">No events found</div>
            ) : (
              events.map((ev) => (
                <button
                  key={ev.id}
                  data-testid={`option-event-${ev.id}`}
                  onClick={() => {
                    onChange(String(ev.id), ev.title);
                    setSelectedTitle(ev.title);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-start gap-2",
                    value === String(ev.id) && "bg-primary/10 text-primary",
                  )}
                >
                  <div>
                    <p className="font-medium">{ev.title}</p>
                    {ev.date && (
                      <p className="text-xs text-muted-foreground">{format(new Date(ev.date), "MMM d, yyyy")}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create / Edit Poll Dialog ────────────────────────────────────────────────
function PollFormDialog({
  editPoll,
  onClose,
}: {
  editPoll?: PollWithMeta | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!editPoll;

  const [eventId, setEventId] = useState(isEdit ? String(editPoll!.eventId) : "");
  const [question, setQuestion] = useState(isEdit ? editPoll!.question : "");
  const [description, setDescription] = useState(isEdit ? (editPoll!.description || "") : "");
  const [pollType, setPollType] = useState<"yes_no" | "custom" | "rating">(isEdit ? editPoll!.pollType : "yes_no");
  const [customOptions, setCustomOptions] = useState<string[]>(
    isEdit && editPoll!.options.length > 0 ? editPoll!.options : ["", ""],
  );
  const [resultsVisibility, setResultsVisibility] = useState<"live" | "after_close">(
    isEdit ? editPoll!.resultsVisibility : "live",
  );
  const [voterAccess, setVoterAccess] = useState<"all" | "attendees">(isEdit ? editPoll!.voterAccess : "all");
  const [closesAt, setClosesAt] = useState(
    isEdit && editPoll!.closesAt ? format(new Date(editPoll!.closesAt), "yyyy-MM-dd'T'HH:mm") : "",
  );
  const [autoActivate, setAutoActivate] = useState(!isEdit);

  const mutation = useMutation({
    mutationFn: async () => {
      const options =
        pollType === "custom" ? customOptions.filter((o) => o.trim().length > 0) :
        pollType === "rating" ? ["1", "2", "3", "4", "5"] :
        [];

      if (pollType === "custom" && options.length < 2) {
        throw new Error("At least 2 options required for multiple choice polls");
      }

      const payload = {
        question: question.trim(),
        description: description.trim() || null,
        pollType,
        options,
        resultsVisibility,
        voterAccess,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        ...(!isEdit && { status: autoActivate ? "active" : "draft" }),
      };

      if (isEdit) {
        return apiRequest(`/api/polls/${editPoll!.id}`, "PATCH", payload);
      } else {
        return apiRequest(`/api/events/${eventId}/polls`, "POST", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] });
      toast({ title: isEdit ? "Poll updated" : "Poll created", description: isEdit ? "Changes saved." : "The poll is ready." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    },
  });

  const isValid = question.trim().length > 0 && (isEdit || eventId);

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          {isEdit ? "Edit Poll" : "Create New Poll"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {!isEdit && (
          <div className="space-y-1.5">
            <Label>Event *</Label>
            <EventPicker
              value={eventId}
              onChange={(id) => setEventId(id)}
            />
            <p className="text-xs text-muted-foreground">Search and select the event this poll belongs to</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="poll-question">Poll Question *</Label>
          <Input
            id="poll-question"
            data-testid="input-poll-question"
            placeholder="e.g. Who should win tonight's battle?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="poll-description">Description (optional)</Label>
          <Textarea
            id="poll-description"
            data-testid="input-poll-description"
            placeholder="Add context or instructions for voters…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Poll Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["yes_no", "custom", "rating"] as const).map((type) => (
              <button
                key={type}
                data-testid={`button-poll-type-${type}`}
                onClick={() => setPollType(type)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all",
                  pollType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground",
                )}
              >
                {type === "yes_no" && <CheckCircle2 className="h-4 w-4" />}
                {type === "custom" && <Layers className="h-4 w-4" />}
                {type === "rating" && <Star className="h-4 w-4" />}
                <span>{POLL_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>

        {pollType === "custom" && (
          <div className="space-y-2">
            <Label>Answer Options (min. 2, max. 8)</Label>
            {customOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  data-testid={`input-poll-option-${idx}`}
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...customOptions];
                    next[idx] = e.target.value;
                    setCustomOptions(next);
                  }}
                />
                {customOptions.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {customOptions.length < 8 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomOptions([...customOptions, ""])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Option
              </Button>
            )}
          </div>
        )}

        {pollType === "rating" && (
          <div className="flex items-center gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-300">
            <Star className="h-3.5 w-3.5 flex-shrink-0" />
            Voters will rate from 1 to 5 stars. Average score will be displayed.
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Results Visibility</Label>
            <Select value={resultsVisibility} onValueChange={(v) => setResultsVisibility(v as any)}>
              <SelectTrigger data-testid="select-results-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="live">
                  <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Live — show results in real-time</span>
                </SelectItem>
                <SelectItem value="after_close">
                  <span className="flex items-center gap-2"><EyeOff className="h-3.5 w-3.5" /> After close — reveal when poll ends</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Who can vote?</Label>
            <Select value={voterAccess} onValueChange={(v) => setVoterAccess(v as any)}>
              <SelectTrigger data-testid="select-voter-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Everyone with an account</span>
                </SelectItem>
                <SelectItem value="attendees">
                  <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Registered attendees only</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="poll-closes-at">Auto-close At (optional)</Label>
            <Input
              id="poll-closes-at"
              data-testid="input-poll-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border">
              <div>
                <p className="text-sm font-semibold">Activate immediately</p>
                <p className="text-xs text-muted-foreground">Start accepting votes right away</p>
              </div>
              <Switch
                data-testid="switch-auto-activate"
                checked={autoActivate}
                onCheckedChange={setAutoActivate}
              />
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          data-testid="button-submit-poll"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !isValid}
        >
          {mutation.isPending ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Poll")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Analytics Dialog ──────────────────────────────────────────────────────────
function AnalyticsDialog({ poll, onClose }: { poll: PollWithMeta; onClose: () => void }) {
  const { data, isLoading } = useQuery<PollAnalytics>({
    queryKey: ["/api/admin/polls", poll.id, "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/polls/${poll.id}/analytics`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: voters = [], isLoading: votersLoading } = useQuery<Voter[]>({
    queryKey: ["/api/admin/polls", poll.id, "voters"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/polls/${poll.id}/voters`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [tab, setTab] = useState<"results" | "timeline" | "voters">("results");

  const options = poll.pollType === "yes_no"
    ? [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]
    : poll.pollType === "rating"
    ? ["1", "2", "3", "4", "5"].map((v) => ({ label: `⭐ ${v}`, value: v }))
    : poll.options.map((o) => ({ label: o, value: o }));

  const results = data?.results || {};
  const totalVotes = poll.totalVotes;

  const chartData = options.map((o) => ({
    name: o.label,
    votes: results[o.value] || 0,
    pct: totalVotes > 0 ? Math.round(((results[o.value] || 0) / totalVotes) * 100) : 0,
  }));

  const avgRating =
    poll.pollType === "rating" && totalVotes > 0
      ? (Object.entries(results).reduce((sum, [k, v]) => sum + parseInt(k) * v, 0) / totalVotes).toFixed(2)
      : null;

  const winner = (() => {
    const entries = Object.entries(results);
    if (!entries.length) return null;
    const max = Math.max(...entries.map(([, v]) => v));
    if (!max) return null;
    const ws = entries.filter(([, v]) => v === max);
    return ws.length === 1 ? ws[0][0] : null;
  })();

  const timelineData = (data?.timeline || []).map((t) => ({
    time: format(new Date(t.hour), "HH:mm"),
    votes: t.count,
  }));

  const exportVotersCSV = () => {
    if (!voters.length) return;
    const header = "Name,Vote,Time\n";
    const rows = voters
      .map((v) => `"${v.displayName}","${v.option}","${format(new Date(v.votedAt), "yyyy-MM-dd HH:mm")}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poll-${poll.id}-voters.csv`;
    a.click();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Poll Analytics
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <p className="font-bold text-base">{poll.question}</p>
          {poll.description && <p className="text-sm text-muted-foreground mt-0.5">{poll.description}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", STATUS_CONFIG[poll.status]?.color)}>
              {STATUS_CONFIG[poll.status]?.label}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {totalVotes} total votes
            </span>
            {avgRating && (
              <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                <Star className="h-3 w-3" /> Avg: {avgRating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {(["results", "timeline", "voters"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-semibold border-b-2 transition-colors capitalize",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "timeline" ? "Vote Timeline" : t === "voters" ? `Voters (${voters.length})` : "Results"}
            </button>
          ))}
        </div>

        {/* Results tab */}
        {tab === "results" && (
          <div className="space-y-4">
            {winner && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <Trophy className="h-6 w-6 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Leading Option</p>
                  <p className="font-bold text-amber-800 dark:text-amber-300">{winner}</p>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="h-40 animate-pulse bg-secondary/40 rounded-xl" />
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(val: any) => [`${val} votes`, "Votes"]} />
                      <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {chartData.map((d, idx) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{d.name}</span>
                        <span className="text-muted-foreground">{d.votes} votes ({d.pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${d.pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Timeline tab */}
        {tab === "timeline" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="h-40 animate-pulse bg-secondary/40 rounded-xl" />
            ) : timelineData.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground text-sm">
                <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
                No vote activity yet
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(val: any) => [`${val} votes`, "Votes"]} />
                    <Bar dataKey="votes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">Vote counts grouped by hour</p>
          </div>
        )}

        {/* Voters tab */}
        {tab === "voters" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{voters.length} voter{voters.length !== 1 ? "s" : ""}</p>
              {voters.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportVotersCSV}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                </Button>
              )}
            </div>
            {votersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse bg-secondary/40 rounded-lg" />)}
              </div>
            ) : voters.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                No votes cast yet
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Voter</TableHead>
                      <TableHead className="text-xs">Vote</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voters.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{v.displayName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{v.option}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(v.votedAt), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Bulk Action Bar ───────────────────────────────────────────────────────────
function BulkActionBar({
  selected,
  onAction,
  onClear,
  isPending,
}: {
  selected: number[];
  onAction: (action: string) => void;
  onClear: () => void;
  isPending: boolean;
}) {
  if (selected.length === 0) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 flex-wrap">
      <span className="text-sm font-semibold text-primary">{selected.length} selected</span>
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        <Button size="sm" variant="outline" onClick={() => onAction("active")} disabled={isPending}>
          <Play className="h-3.5 w-3.5 mr-1" /> Activate
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("paused")} disabled={isPending}>
          <Pause className="h-3.5 w-3.5 mr-1" /> Pause
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction("closed")} disabled={isPending}>
          <X className="h-3.5 w-3.5 mr-1" /> Close
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onAction("delete")} disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={isPending}>
          Clear
        </Button>
      </div>
    </div>
  );
}

// ── Main Admin Polls Page ─────────────────────────────────────────────────────
export default function AdminPollsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editPoll, setEditPoll] = useState<PollWithMeta | null>(null);
  const [analyticsPoll, setAnalyticsPoll] = useState<PollWithMeta | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"polls" | "analytics" | "permissions">("polls");
  const [selected, setSelected] = useState<number[]>([]);

  const { data: polls = [], isLoading } = useQuery<PollWithMeta[]>({
    queryKey: ["/api/admin/polls"],
    queryFn: async () => {
      const res = await fetch("/api/admin/polls");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithPolls[]>({
    queryKey: ["/api/admin/users-poll-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?limit=500");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ pollId, status }: { pollId: number; status: string }) =>
      apiRequest(`/api/polls/${pollId}`, "PATCH", { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] }); toast({ title: "Poll updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (pollId: number) => apiRequest(`/api/polls/${pollId}`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] }); toast({ title: "Poll deleted" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: (pollId: number) => apiRequest(`/api/polls/${pollId}/reset`, "POST"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] }); toast({ title: "Votes reset" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (pollId: number) => apiRequest(`/api/polls/${pollId}/duplicate`, "POST"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] }); toast({ title: "Poll duplicated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ pollIds, action }: { pollIds: number[]; action: string }) =>
      apiRequest("/api/admin/polls/bulk", "POST", { pollIds, action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/polls"] });
      setSelected([]);
      toast({ title: "Bulk action complete" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const grantMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/admin/users/${userId}/grant-poll-creator`, "POST"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users-poll-permissions"] }); toast({ title: "Permission granted" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/admin/users/${userId}/revoke-poll-creator`, "POST"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users-poll-permissions"] }); toast({ title: "Permission revoked" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const filteredPolls = polls.filter((p) => {
    const matchesSearch =
      p.question.toLowerCase().includes(search.toLowerCase()) ||
      p.event?.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter((u) =>
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()),
  );

  const stats = useMemo(() => {
    const totalVotes = polls.reduce((acc, p) => acc + p.totalVotes, 0);
    const avgVotes = polls.length > 0 ? (totalVotes / polls.length).toFixed(1) : "0";
    const engagement = polls.length > 0
      ? Math.round((polls.filter((p) => p.totalVotes > 0).length / polls.length) * 100)
      : 0;
    return {
      total: polls.length,
      active: polls.filter((p) => p.status === "active").length,
      totalVotes,
      closed: polls.filter((p) => p.status === "closed").length,
      avgVotes,
      engagement,
    };
  }, [polls]);

  // Analytics overview data
  const topPolls = [...polls].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 5);
  const statusBreakdown = [
    { name: "Active", value: stats.active, color: "#10b981" },
    { name: "Draft", value: polls.filter((p) => p.status === "draft").length, color: "#6b7280" },
    { name: "Paused", value: polls.filter((p) => p.status === "paused").length, color: "#f59e0b" },
    { name: "Closed", value: stats.closed, color: "#ef4444" },
  ];

  const exportAllCSV = () => {
    const header = "ID,Question,Event,Status,Type,Total Votes,Created\n";
    const rows = filteredPolls
      .map((p) =>
        `${p.id},"${p.question}","${p.event?.title || ""}","${p.status}","${p.pollType}",${p.totalVotes},"${format(new Date(p.createdAt), "yyyy-MM-dd")}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polls-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === filteredPolls.length) {
      setSelected([]);
    } else {
      setSelected(filteredPolls.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Poll Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, monitor and analyze event polls</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportAllCSV} data-testid="button-export-polls">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button data-testid="button-open-create-poll" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Poll
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Polls", value: stats.total, icon: Vote, color: "text-primary" },
          { label: "Active Now", value: stats.active, icon: Play, color: "text-green-500" },
          { label: "Total Votes", value: stats.totalVotes, icon: Users, color: "text-blue-500" },
          { label: "Closed", value: stats.closed, icon: Trophy, color: "text-amber-500" },
          { label: "Avg Votes", value: stats.avgVotes, icon: BarChart3, color: "text-purple-500" },
          { label: "Engagement", value: `${stats.engagement}%`, icon: TrendingUp, color: "text-rose-500" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-secondary", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold leading-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["polls", "analytics", "permissions"] as const).map((t) => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            onClick={() => setActiveTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize flex items-center gap-1.5",
              activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "polls" && <Vote className="h-4 w-4" />}
            {t === "analytics" && <TrendingUp className="h-4 w-4" />}
            {t === "permissions" && <Shield className="h-4 w-4" />}
            {t === "analytics" ? "Analytics" : t === "permissions" ? "Permissions" : "All Polls"}
          </button>
        ))}
      </div>

      {/* ── Polls tab ── */}
      {activeTab === "polls" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-search-polls"
                placeholder="Search polls or events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <BulkActionBar
            selected={selected}
            onAction={(action) => bulkMutation.mutate({ pollIds: selected, action })}
            onClear={() => setSelected([])}
            isPending={bulkMutation.isPending}
          />

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-secondary/50 rounded-xl" />)}
            </div>
          ) : filteredPolls.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Vote className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold">No polls found</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first poll to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.length === filteredPolls.length && filteredPolls.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Votes</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolls.map((poll) => {
                    const cfg = STATUS_CONFIG[poll.status];
                    const isSelected = selected.includes(poll.id);
                    return (
                      <TableRow
                        key={poll.id}
                        data-testid={`row-poll-${poll.id}`}
                        className={cn(isSelected && "bg-primary/5")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(poll.id)}
                            data-testid={`checkbox-poll-${poll.id}`}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-medium truncate">{poll.question}</p>
                          {poll.description && (
                            <p className="text-xs text-muted-foreground truncate">{poll.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">by {poll.creator?.displayName}</p>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/events/${poll.eventId}`}
                            className="text-sm text-primary hover:underline line-clamp-1"
                          >
                            {poll.event?.title || `#${poll.eventId}`}
                          </a>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", cfg?.color)}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", cfg?.dot)} />
                            {cfg?.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {POLL_TYPE_LABELS[poll.pollType] || poll.pollType}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-sm">{poll.totalVotes}</span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {poll.resultsVisibility === "live" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {poll.resultsVisibility === "live" ? "Live" : "On close"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Analytics */}
                            <Button
                              data-testid={`button-analytics-${poll.id}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="View analytics"
                              onClick={() => setAnalyticsPoll(poll)}
                            >
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                            </Button>

                            {/* Edit */}
                            <Button
                              data-testid={`button-edit-${poll.id}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit poll"
                              onClick={() => setEditPoll(poll)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            {/* Duplicate */}
                            <Button
                              data-testid={`button-duplicate-${poll.id}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Duplicate poll"
                              onClick={() => duplicateMutation.mutate(poll.id)}
                              disabled={duplicateMutation.isPending}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>

                            {/* Status controls */}
                            {poll.status === "draft" && (
                              <Button
                                data-testid={`button-activate-${poll.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                title="Activate"
                                onClick={() => updateStatusMutation.mutate({ pollId: poll.id, status: "active" })}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            {poll.status === "active" && (
                              <>
                                <Button
                                  data-testid={`button-pause-${poll.id}`}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-yellow-600"
                                  title="Pause"
                                  onClick={() => updateStatusMutation.mutate({ pollId: poll.id, status: "paused" })}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                                <Button
                                  data-testid={`button-close-${poll.id}`}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  title="Close"
                                  onClick={() => updateStatusMutation.mutate({ pollId: poll.id, status: "closed" })}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {poll.status === "paused" && (
                              <Button
                                data-testid={`button-resume-${poll.id}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                title="Resume"
                                onClick={() => updateStatusMutation.mutate({ pollId: poll.id, status: "active" })}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Reset */}
                            <Button
                              data-testid={`button-reset-${poll.id}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-orange-500"
                              title="Reset votes"
                              onClick={() => {
                                if (confirm("Reset all votes for this poll?")) resetMutation.mutate(poll.id);
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>

                            {/* Delete */}
                            <Button
                              data-testid={`button-delete-${poll.id}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Delete"
                              onClick={() => {
                                if (confirm("Delete this poll? This cannot be undone.")) deleteMutation.mutate(poll.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ── Analytics Overview tab ── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Poll Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusBreakdown} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {statusBreakdown.map((s, idx) => (
                          <Cell key={idx} fill={s.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top polls by votes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" /> Most Engaged Polls
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topPolls.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No polls yet</p>
                ) : (
                  <div className="space-y-2">
                    {topPolls.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className={cn(
                          "text-xs font-black w-5 text-center",
                          i === 0 && "text-amber-500",
                          i === 1 && "text-gray-400",
                          i === 2 && "text-orange-400",
                        )}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.question}</p>
                          <p className="text-xs text-muted-foreground">{p.event?.title}</p>
                        </div>
                        <span className="text-sm font-bold text-primary flex-shrink-0">
                          {p.totalVotes} votes
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Poll type breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Poll Types Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {(["yes_no", "custom", "rating"] as const).map((type) => {
                  const count = polls.filter((p) => p.pollType === type).length;
                  const pct = polls.length > 0 ? Math.round((count / polls.length) * 100) : 0;
                  return (
                    <div key={type} className="text-center p-4 rounded-xl bg-secondary/40 border">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm font-medium mt-0.5">{POLL_TYPE_LABELS[type]}</p>
                      <p className="text-xs text-muted-foreground">{pct}% of total</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Click any poll to deep-dive */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Deep-dive Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Select any poll for detailed analytics, vote timeline, and voter list.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {polls.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`button-deep-analytics-${p.id}`}
                    onClick={() => setAnalyticsPoll(p)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.question}</p>
                      <p className="text-xs text-muted-foreground">{p.event?.title}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", STATUS_CONFIG[p.status]?.color)}>
                        {STATUS_CONFIG[p.status]?.label}
                      </span>
                      <span className="text-sm font-bold text-primary">{p.totalVotes}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Permissions tab ── */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-sm">
            <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-700 dark:text-blue-300">
              Grant users the ability to create polls on events. Admins always have full access.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-users"
              placeholder="Search users…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {usersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-secondary/40 rounded-xl" />)}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Poll Creator</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isAdmin = ["admin", "super_admin"].includes(u.role);
                    return (
                      <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                        <TableCell>
                          <p className="font-medium text-sm">{u.displayName}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs capitalize">
                            {u.role || "user"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Always
                            </span>
                          ) : u.canCreatePolls ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Granted
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No access</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isAdmin && (
                            u.canCreatePolls ? (
                              <Button
                                data-testid={`button-revoke-${u.id}`}
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => revokeMutation.mutate(u.id)}
                                disabled={revokeMutation.isPending}
                              >
                                Revoke
                              </Button>
                            ) : (
                              <Button
                                data-testid={`button-grant-${u.id}`}
                                size="sm"
                                onClick={() => grantMutation.mutate(u.id)}
                                disabled={grantMutation.isPending}
                              >
                                Grant Access
                              </Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        {showCreate && <PollFormDialog onClose={() => setShowCreate(false)} />}
      </Dialog>

      <Dialog open={!!editPoll} onOpenChange={(open) => !open && setEditPoll(null)}>
        {editPoll && <PollFormDialog editPoll={editPoll} onClose={() => setEditPoll(null)} />}
      </Dialog>

      <Dialog open={!!analyticsPoll} onOpenChange={(open) => !open && setAnalyticsPoll(null)}>
        {analyticsPoll && <AnalyticsDialog poll={analyticsPoll} onClose={() => setAnalyticsPoll(null)} />}
      </Dialog>
    </div>
  );
}
