import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Vote, Trophy, Users, Clock, Eye, EyeOff, CheckCircle2,
  Pause, Play, BarChart3, Lock, Star, Share2, TrendingUp, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useLocation } from "wouter";

interface PollOption {
  label: string;
  value: string;
}

interface PollWithResults {
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
  results: Record<string, number> | null;
  userVote: string | null;
  showResults: boolean;
  createdAt: string;
}

interface EventPollSectionProps {
  eventId: number;
}

function getPollOptions(poll: PollWithResults): PollOption[] {
  if (poll.pollType === "yes_no") {
    return [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ];
  }
  if (poll.pollType === "rating") {
    return ["1", "2", "3", "4", "5"].map((v) => ({ label: v, value: v }));
  }
  return (poll.options || []).map((o) => ({ label: o, value: o }));
}

function getWinner(results: Record<string, number>): string | null {
  const entries = Object.entries(results);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v));
  if (max === 0) return null;
  const winners = entries.filter(([, v]) => v === max);
  if (winners.length > 1) return null;
  return winners[0][0];
}

function getAverageRating(results: Record<string, number>, totalVotes: number): number | null {
  if (totalVotes === 0) return null;
  let sum = 0;
  for (const [key, count] of Object.entries(results)) {
    sum += parseInt(key) * count;
  }
  return sum / totalVotes;
}

function CountdownTimer({ closesAt }: { closesAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const target = new Date(closesAt);
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft("Closing...");
        setIsUrgent(true);
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setIsUrgent(diff < 5 * 60 * 1000);
      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return (
    <span
      className={cn(
        "flex items-center gap-1 tabular-nums font-mono text-xs font-bold px-2 py-0.5 rounded-full",
        isUrgent
          ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400 animate-pulse"
          : "bg-secondary text-muted-foreground"
      )}
    >
      <Clock className="h-3 w-3 flex-shrink-0" />
      {timeLeft}
    </span>
  );
}

function StarRatingDisplay({
  results,
  totalVotes,
  userVote,
  canVote,
  onVote,
  isPending,
}: {
  results: Record<string, number>;
  totalVotes: number;
  userVote: string | null;
  canVote: boolean;
  onVote: (v: string) => void;
  isPending: boolean;
}) {
  const [hovered, setHovered] = useState<number>(0);
  const avg = getAverageRating(results, totalVotes);
  const userRating = userVote ? parseInt(userVote) : 0;

  return (
    <div className="space-y-4">
      {/* Star rating input */}
      {canVote && (
        <div className="flex flex-col items-center gap-3 py-3">
          <p className="text-sm text-muted-foreground font-medium">Tap a star to rate</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                data-testid={`button-star-${star}`}
                disabled={isPending}
                onClick={() => onVote(String(star))}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className={cn(
                  "transition-all duration-150 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "hover:scale-125 active:scale-95"
                )}
              >
                <Star
                  className={cn(
                    "h-9 w-9 transition-colors duration-100",
                    star <= (hovered || userRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40"
                  )}
                />
              </button>
            ))}
          </div>
          {hovered > 0 && (
            <p className="text-xs text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][hovered]}
            </p>
          )}
        </div>
      )}

      {/* Results bars */}
      {!canVote && (
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = results[String(star)] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isMyVote = userVote === String(star);
            return (
              <div key={star} className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 w-20 shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        "h-3 w-3",
                        s <= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <Progress
                    value={pct}
                    className={cn(
                      "h-2 transition-all duration-700",
                      isMyVote && "[&>div]:bg-primary"
                    )}
                  />
                </div>
                <span className={cn("text-xs font-bold w-8 text-right tabular-nums", isMyVote ? "text-primary" : "text-muted-foreground")}>
                  {pct}%
                </span>
                {isMyVote && <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Average score */}
      {avg !== null && totalVotes > 0 && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-base font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
            {avg.toFixed(1)}
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-500">/ 5.0 average</span>
        </div>
      )}
    </div>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    const start = prevRef.current;
    const end = value;
    const diff = end - start;
    const steps = Math.min(Math.abs(diff), 20);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplayed(Math.round(start + (diff * step) / steps));
      if (step >= steps) {
        clearInterval(interval);
        prevRef.current = end;
      }
    }, 30);
    return () => clearInterval(interval);
  }, [value]);

  return <span className="tabular-nums">{displayed}</span>;
}

function PollCard({ poll, eventId }: { poll: PollWithResults; eventId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [justVoted, setJustVoted] = useState(false);

  const options = getPollOptions(poll);
  const results = poll.results || {};
  const winner = poll.status === "closed" ? getWinner(results) : null;
  const totalVotes = poll.totalVotes;

  const voteMutation = useMutation({
    mutationFn: async (option: string) => {
      return apiRequest(`/api/polls/${poll.id}/vote`, "POST", { option });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "polls"] });
      setJustVoted(true);
      setTimeout(() => setJustVoted(false), 2000);
      toast({ title: "Vote cast!", description: "Your vote has been recorded." });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to cast vote";
      if (msg.includes("already voted")) {
        toast({ title: "Already voted", description: "You've already cast your vote.", variant: "destructive" });
      } else if (msg.includes("not active")) {
        toast({ title: "Poll not active", description: "This poll is not accepting votes right now.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const handleVote = (option: string) => {
    if (!user) { navigate("/auth"); return; }
    if (poll.userVote || poll.status !== "active") return;
    voteMutation.mutate(option);
  };

  const handleShare = async () => {
    const text = `Poll: ${poll.question} — vote now!`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: poll.question, text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast({ title: "Link copied!", description: "Share it with others." });
    }
  };

  const isActive = poll.status === "active";
  const isClosed = poll.status === "closed";
  const isPaused = poll.status === "paused";
  const hasVoted = !!poll.userVote;
  const canVote = isActive && !hasVoted && !!user && poll.pollType !== "rating";
  const canRateVote = isActive && !hasVoted && !!user && poll.pollType === "rating";
  const showResults = poll.showResults && (hasVoted || isClosed || !isActive);

  const yesCount = results["yes"] || 0;
  const noCount = results["no"] || 0;
  const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 50;
  const noPct = totalVotes > 0 ? 100 - yesPct : 50;

  return (
    <Card
      className={cn(
        "border transition-all duration-300 overflow-hidden",
        isActive && "border-primary/40 shadow-lg shadow-primary/10",
        isClosed && "border-border opacity-90",
        isPaused && "border-yellow-500/30",
        justVoted && "scale-[1.01]",
      )}
    >
      {/* Active poll top accent bar */}
      {isActive && (
        <div className="h-0.5 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isActive && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
                  Live
                </span>
              )}
              {isPaused && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500 text-white">
                  <Pause className="h-3 w-3" /> Paused
                </span>
              )}
              {isClosed && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-muted-foreground/70 text-white">
                  <Lock className="h-3 w-3" /> Closed
                </span>
              )}
              <Badge variant="outline" className="text-xs capitalize font-medium">
                {poll.pollType === "yes_no" ? "Yes / No" : poll.pollType === "rating" ? "⭐ Rating" : "Choice"}
              </Badge>
              {poll.resultsVisibility === "after_close" && !isClosed && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <EyeOff className="h-3 w-3" /> Hidden until close
                </span>
              )}
            </div>
            <CardTitle className="text-base font-bold leading-snug">{poll.question}</CardTitle>
            {poll.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{poll.description}</p>
            )}
          </div>
          <button
            data-testid={`button-share-poll-${poll.id}`}
            onClick={handleShare}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
            title="Share poll"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Winner banner */}
        {isClosed && winner && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Winning answer</p>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {poll.pollType === "yes_no"
                  ? winner.charAt(0).toUpperCase() + winner.slice(1)
                  : poll.pollType === "rating"
                  ? `${winner} star${winner !== "1" ? "s" : ""}`
                  : winner}
              </p>
            </div>
          </div>
        )}

        {isClosed && !winner && totalVotes > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 border">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-medium">It's a tie!</p>
          </div>
        )}

        {/* ── Rating Poll ── */}
        {poll.pollType === "rating" && (
          <StarRatingDisplay
            results={results}
            totalVotes={totalVotes}
            userVote={poll.userVote}
            canVote={canRateVote}
            onVote={handleVote}
            isPending={voteMutation.isPending}
          />
        )}

        {/* ── Yes/No Poll — split bar UI ── */}
        {poll.pollType === "yes_no" && (
          <div className="space-y-3">
            {showResults ? (
              <>
                {/* Visual split bar */}
                <div className="relative h-10 rounded-xl overflow-hidden flex">
                  <div
                    className={cn(
                      "flex items-center justify-start pl-3 transition-all duration-700 ease-out font-bold text-sm text-white",
                      poll.userVote === "yes" ? "bg-primary" : "bg-green-500"
                    )}
                    style={{ width: `${Math.max(yesPct, 8)}%` }}
                  >
                    {yesPct >= 20 && `${yesPct}%`}
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-end pr-3 transition-all duration-700 ease-out font-bold text-sm text-white",
                      poll.userVote === "no" ? "bg-primary" : "bg-red-400"
                    )}
                    style={{ width: `${Math.max(noPct, 8)}%` }}
                  >
                    {noPct >= 20 && `${noPct}%`}
                  </div>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    {poll.userVote === "yes" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    Yes · {yesCount} votes
                  </span>
                  <span className="flex items-center gap-1.5">
                    No · {noCount} votes
                    {poll.userVote === "no" && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex gap-3">
                {[{ label: "Yes", value: "yes", color: "bg-green-500 hover:bg-green-600 text-white" }, { label: "No", value: "no", color: "bg-red-400 hover:bg-red-500 text-white" }].map((opt) => (
                  <button
                    key={opt.value}
                    data-testid={`button-vote-${opt.value}`}
                    onClick={() => handleVote(opt.value)}
                    disabled={!canVote || voteMutation.isPending}
                    className={cn(
                      "flex-1 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border-2 border-transparent",
                      canVote ? `${opt.color} active:scale-95` : "bg-secondary text-muted-foreground cursor-default",
                      voteMutation.isPending && voteMutation.variables === opt.value && "opacity-60"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Custom Poll ── */}
        {poll.pollType === "custom" && (
          <div className="space-y-2">
            {options.map((opt) => {
              const count = results[opt.value] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              const isMyVote = poll.userVote === opt.value;
              const isWinner = winner === opt.value && isClosed;

              return (
                <div key={opt.value} className="space-y-1.5">
                  <button
                    data-testid={`button-vote-${opt.value}`}
                    onClick={() => handleVote(opt.value)}
                    disabled={!canVote || voteMutation.isPending}
                    className={cn(
                      "w-full relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-200",
                      canVote && "hover:border-primary hover:bg-primary/5 cursor-pointer active:scale-[0.98]",
                      !canVote && "cursor-default",
                      isMyVote && "border-primary bg-primary/10 text-primary",
                      isWinner && !isMyVote && "border-amber-400 bg-amber-50 dark:bg-amber-950/20",
                      !isMyVote && !isWinner && "border-border bg-card",
                    )}
                  >
                    <span className="flex items-center gap-2.5 text-left">
                      {isMyVote && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                      {isWinner && !isMyVote && <Trophy className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                      {!isMyVote && !isWinner && canVote && (
                        <span className="w-4 h-4 rounded-full border-2 border-current opacity-30 flex-shrink-0" />
                      )}
                      <span>{opt.label}</span>
                    </span>
                    {showResults && (
                      <span className={cn("text-xs font-bold tabular-nums shrink-0", isMyVote ? "text-primary" : "text-muted-foreground")}>
                        {pct}%
                      </span>
                    )}
                  </button>

                  {showResults && (
                    <div className="px-1">
                      <Progress
                        value={pct}
                        className={cn(
                          "h-1.5 transition-all duration-700",
                          isMyVote && "[&>div]:bg-primary",
                          isWinner && !isMyVote && "[&>div]:bg-amber-400",
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Results hidden notice */}
        {!poll.showResults && hasVoted && poll.pollType !== "rating" && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary/50 border border-dashed text-sm text-muted-foreground">
            <EyeOff className="h-4 w-4 flex-shrink-0" />
            <span>Results will be revealed when the poll closes.</span>
          </div>
        )}

        {/* Just voted confirmation */}
        {justVoted && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 text-sm font-medium text-green-700 dark:text-green-400 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 className="h-4 w-4" />
            Your vote is in!
          </div>
        )}

        {/* Login CTA */}
        {!user && isActive && (
          <button
            data-testid="button-login-to-vote"
            onClick={() => navigate("/auth")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all text-sm font-semibold text-primary"
          >
            <Vote className="h-4 w-4" />
            Log in to cast your vote — it's free!
          </button>
        )}

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <AnimatedCount value={totalVotes} />
            <span>{totalVotes === 1 ? "vote" : "votes"}</span>
            {poll.voterAccess === "attendees" && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-secondary text-xs">Attendees only</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {poll.closesAt && !isClosed && !isPast(new Date(poll.closesAt)) && (
              <CountdownTimer closesAt={poll.closesAt} />
            )}
            {poll.closesAt && isClosed && (
              <span className="text-xs text-muted-foreground">
                Closed {formatDistanceToNow(new Date(poll.closesAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventPollSection({ eventId }: EventPollSectionProps) {
  const queryClient = useQueryClient();
  const { data: polls = [], isLoading } = useQuery<PollWithResults[]>({
    queryKey: ["/api/events", eventId, "polls"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/polls`);
      if (!res.ok) throw new Error("Failed to fetch polls");
      return res.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket | null = null;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (
            (msg.type === "POLL_UPDATE" || msg.type === "POLL_STATUS_CHANGE") &&
            (msg.payload?.eventId === eventId || !msg.payload?.eventId)
          ) {
            queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "polls"] });
          }
        } catch {}
      };
      ws.onclose = () => {
        retryTimeout = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => {
      ws?.close();
      clearTimeout(retryTimeout);
    };
  }, [eventId, queryClient]);

  const activePolls = polls.filter((p) => p.status === "active");
  const pausedPolls = polls.filter((p) => p.status === "paused");
  const closedPolls = polls.filter((p) => p.status === "closed");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-secondary/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <BarChart3 className="h-8 w-8 text-primary" />
        </div>
        <p className="font-bold text-base mb-1">No polls yet</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          The organizer hasn't added any polls yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active polls */}
      {activePolls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Polls
              </span>
              <Badge variant="secondary" className="text-xs font-bold">
                {activePolls.length}
              </Badge>
            </h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Live results
            </span>
          </div>
          {activePolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} eventId={eventId} />
          ))}
        </div>
      )}

      {/* Paused polls */}
      {pausedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Pause className="h-3.5 w-3.5 text-yellow-500" />
            Paused
          </h3>
          {pausedPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} eventId={eventId} />
          ))}
        </div>
      )}

      {/* Closed polls */}
      {closedPolls.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Past Polls
          </h3>
          {closedPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} eventId={eventId} />
          ))}
        </div>
      )}
    </div>
  );
}

export function useEventPollCount(eventId: number) {
  const { data: polls = [] } = useQuery<PollWithResults[]>({
    queryKey: ["/api/events", eventId, "polls"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/polls`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });
  return {
    total: polls.length,
    active: polls.filter((p) => p.status === "active").length,
  };
}
