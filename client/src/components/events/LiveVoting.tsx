import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { getSportConfig, type SportConfig } from "@/lib/competitionSports";
import {
  Vote,
  Loader2,
  Trophy,
  CheckCircle2,
  Clock,
  Users,
  Play,
  ChevronRight,
  Star,
  Target,
  Plus,
  Minus,
} from "lucide-react";

interface Matchup {
  id: number;
  round: number;
  position: number;
  status: string;
  dancerARegistrationId: number | null;
  dancerBRegistrationId: number | null;
  winnerRegistrationId: number | null;
  bestOf?: number;
  currentRound?: number;
  dancerA?: {
    id: number;
    displayName: string | null;
    user?: {
      username: string;
      profileImage: string | null;
      displayName: string | null;
    } | null;
  } | null;
  dancerB?: {
    id: number;
    displayName: string | null;
    user?: {
      username: string;
      profileImage: string | null;
      displayName: string | null;
    } | null;
  } | null;
}

interface VoteRecord {
  id: number;
  matchupId: number;
  judgeId: number;
  judgeUserId: number;
  votedForRegistrationId: number;
  votedAt: string;
  techniqueScore?: number | null;
  vocabularyScore?: number | null;
  executionScore?: number | null;
  musicalityScore?: number | null;
  originalityScore?: number | null;
  notes?: string | null;
  judge: { judgeNumber: number };
  user: {
    id: number;
    username: string;
    profileImage: string | null;
    displayName: string | null;
  };
}

interface Judge {
  id: number;
  userId: number;
  judgeNumber: number;
  user: {
    id: number;
    username: string;
    profileImage: string | null;
    displayName: string | null;
  };
}

interface LiveVotingProps {
  matchup: Matchup;
  eventId: number;
  categoryId: number;
  competitionSport?: string | null;
  currentUserId?: number;
  isOrganizer?: boolean;
  onVoteComplete?: () => void;
}

function getDancerDisplayName(dancer: Matchup["dancerA"] | Matchup["dancerB"]) {
  if (!dancer) return "TBD";
  if (dancer.displayName) return dancer.displayName;
  if (dancer.user?.displayName) return dancer.user.displayName;
  if (dancer.user?.username) return dancer.user.username;
  return `Dancer #${dancer.id}`;
}

function getDancerImage(dancer: Matchup["dancerA"] | Matchup["dancerB"]) {
  return dancer?.user?.profileImage || null;
}

function getDancerInitials(dancer: Matchup["dancerA"] | Matchup["dancerB"]) {
  const name = getDancerDisplayName(dancer);
  return name.substring(0, 2).toUpperCase();
}

function CriteriaVotingPanel({
  matchup,
  sportConfig,
  isJudge,
  isVoting,
  onSubmit,
  isPending,
}: {
  matchup: Matchup;
  sportConfig: SportConfig;
  isJudge: boolean;
  isVoting: boolean;
  onSubmit: (registrationId: number, scores: Record<string, number>, notes: string) => void;
  isPending: boolean;
}) {
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    sportConfig.criteria.forEach((c) => { init[c.key] = Math.floor((c.min + c.max) / 2); });
    return init;
  });
  const [notes, setNotes] = useState("");

  const totalScore = sportConfig.criteria.reduce((sum, c) => sum + (scores[c.key] || 0), 0);
  const maxScore = sportConfig.criteria.reduce((sum, c) => sum + c.max, 0);
  const canSubmit = selectedWinner !== null && isJudge && isVoting;

  const handleSubmit = () => {
    if (selectedWinner !== null) {
      onSubmit(selectedWinner, scores, notes);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground font-medium">
        {sportConfig.emoji} {sportConfig.label} — Judge Scoring Panel
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { regId: matchup.dancerARegistrationId, dancer: matchup.dancerA, label: "A" },
          { regId: matchup.dancerBRegistrationId, dancer: matchup.dancerB, label: "B" },
        ].map(({ regId, dancer, label }) => (
          <button
            key={label}
            type="button"
            disabled={!isJudge || !isVoting || isPending}
            onClick={() => regId && setSelectedWinner(regId)}
            className={`p-3 rounded-xl border-2 transition-all text-center ${
              selectedWinner === regId
                ? "border-primary bg-primary/10 shadow-md"
                : isJudge && isVoting
                ? "border-border hover:border-primary/40 cursor-pointer"
                : "border-border opacity-70 cursor-not-allowed"
            }`}
            data-testid={`button-pick-winner-${label.toLowerCase()}`}
          >
            <Avatar className="h-12 w-12 mx-auto mb-1.5">
              <AvatarImage src={getDancerImage(dancer) || undefined} />
              <AvatarFallback className="text-sm">{getDancerInitials(dancer)}</AvatarFallback>
            </Avatar>
            <p className="font-semibold text-sm truncate">{getDancerDisplayName(dancer)}</p>
            {selectedWinner === regId && (
              <div className="mt-1 text-xs text-primary flex items-center justify-center gap-1">
                <Trophy className="h-3 w-3" /> Winner pick
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedWinner && isJudge && isVoting && (
        <div className="space-y-3 p-3 bg-muted/40 rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Star className="h-3 w-3" /> Performance Criteria ({totalScore}/{maxScore} pts)
          </p>
          {sportConfig.criteria.map((criterion) => (
            <div key={criterion.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{criterion.label}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">— {criterion.description}</span>
                </div>
                <Badge variant="outline" className="text-xs min-w-[3rem] justify-center">
                  {scores[criterion.key]}/{criterion.max}
                </Badge>
              </div>
              <Slider
                min={criterion.min}
                max={criterion.max}
                step={1}
                value={[scores[criterion.key]]}
                onValueChange={([v]) => setScores((prev) => ({ ...prev, [criterion.key]: v }))}
                className="py-1"
                data-testid={`slider-${criterion.key}`}
              />
            </div>
          ))}
          <Textarea
            placeholder="Optional judge notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm resize-none"
            data-testid="input-judge-notes"
          />
        </div>
      )}

      {isJudge && isVoting && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isPending}
          className="w-full"
          data-testid="button-submit-criteria-vote"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Vote className="h-4 w-4 mr-2" />
          )}
          Submit Judge Decision
        </Button>
      )}
    </div>
  );
}

function ScoreEntryPanel({
  matchup,
  sportConfig,
  isOrganizer,
  onSubmit,
  isPending,
}: {
  matchup: Matchup;
  sportConfig: SportConfig;
  isOrganizer: boolean;
  onSubmit: (registrationId: number, scoreData: object) => void;
  isPending: boolean;
}) {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const winner = scoreA > scoreB ? matchup.dancerARegistrationId : scoreA < scoreB ? matchup.dancerBRegistrationId : null;

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground font-medium">
        {sportConfig.emoji} {sportConfig.label} — Score Entry
      </div>
      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
        <div className="text-center space-y-2">
          <Avatar className="h-12 w-12 mx-auto">
            <AvatarImage src={getDancerImage(matchup.dancerA) || undefined} />
            <AvatarFallback>{getDancerInitials(matchup.dancerA)}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-semibold truncate">{getDancerDisplayName(matchup.dancerA)}</p>
          {isOrganizer ? (
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScoreA(Math.max(0, scoreA - 1))} data-testid="button-dec-score-a">
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-2xl font-bold min-w-[3rem] text-center" data-testid="text-score-a">{scoreA}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScoreA(scoreA + 1)} data-testid="button-inc-score-a">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="text-2xl font-bold" data-testid="text-score-a-view">{scoreA}</span>
          )}
          {winner === matchup.dancerARegistrationId && (
            <Badge className="gap-1"><Trophy className="h-3 w-3" /> Leads</Badge>
          )}
        </div>

        <div className="text-lg font-bold text-muted-foreground">VS</div>

        <div className="text-center space-y-2">
          <Avatar className="h-12 w-12 mx-auto">
            <AvatarImage src={getDancerImage(matchup.dancerB) || undefined} />
            <AvatarFallback>{getDancerInitials(matchup.dancerB)}</AvatarFallback>
          </Avatar>
          <p className="text-sm font-semibold truncate">{getDancerDisplayName(matchup.dancerB)}</p>
          {isOrganizer ? (
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScoreB(Math.max(0, scoreB - 1))} data-testid="button-dec-score-b">
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-2xl font-bold min-w-[3rem] text-center" data-testid="text-score-b">{scoreB}</span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setScoreB(scoreB + 1)} data-testid="button-inc-score-b">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="text-2xl font-bold" data-testid="text-score-b-view">{scoreB}</span>
          )}
          {winner === matchup.dancerBRegistrationId && (
            <Badge className="gap-1"><Trophy className="h-3 w-3" /> Leads</Badge>
          )}
        </div>
      </div>

      {isOrganizer && winner && (
        <Button
          onClick={() => onSubmit(winner, { scoreA, scoreB })}
          disabled={isPending || scoreA === scoreB}
          className="w-full"
          data-testid="button-submit-score"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trophy className="h-4 w-4 mr-2" />}
          Declare Winner ({winner === matchup.dancerARegistrationId ? getDancerDisplayName(matchup.dancerA) : getDancerDisplayName(matchup.dancerB)})
        </Button>
      )}
    </div>
  );
}

export function ScoreStepper({
  value,
  onChange,
  disabled,
  highlight,
  testIdPrefix,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  highlight?: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0 rounded-xl text-lg border-2 active:scale-95 transition-transform"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        data-testid={`${testIdPrefix}-dec`}
      >
        <Minus className="h-5 w-5" />
      </Button>
      <div
        className={`flex-1 min-w-[3rem] text-center py-2.5 rounded-xl font-black text-2xl border-2 transition-colors select-none ${
          highlight
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-muted/30 text-foreground"
        }`}
        data-testid={`${testIdPrefix}-value`}
      >
        {value}
      </div>
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0 rounded-xl text-lg border-2 active:scale-95 transition-transform"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        data-testid={`${testIdPrefix}-inc`}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  );
}

function SetsEntryPanel({
  matchup,
  sportConfig,
  isOrganizer,
  onSubmit,
  isPending,
}: {
  matchup: Matchup;
  sportConfig: SportConfig;
  isOrganizer: boolean;
  onSubmit: (registrationId: number, scoreData: object) => void;
  isPending: boolean;
}) {
  const [sets, setSets] = useState<Array<{ a: number; b: number }>>([{ a: 0, b: 0 }]);

  const setsWonA = sets.filter((s) => s.a > s.b).length;
  const setsWonB = sets.filter((s) => s.b > s.a).length;
  const targetSets = Math.ceil((matchup.bestOf || 3) / 2);
  const winner =
    setsWonA >= targetSets ? matchup.dancerARegistrationId
    : setsWonB >= targetSets ? matchup.dancerBRegistrationId
    : null;

  const addSet = () => setSets((prev) => [...prev, { a: 0, b: 0 }]);
  const removeSet = (i: number) => setSets((prev) => prev.filter((_, idx) => idx !== i));
  const updateSet = (i: number, key: "a" | "b", val: number) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: Math.max(0, val) } : s)));

  const nameA = getDancerDisplayName(matchup.dancerA);
  const nameB = getDancerDisplayName(matchup.dancerB);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center text-sm text-muted-foreground font-medium">
        {sportConfig.emoji} {sportConfig.label} — Set Scores
      </div>

      {/* Player name row */}
      <div className="grid grid-cols-2 gap-2 text-sm font-semibold px-1">
        <span className="truncate text-center">{nameA}</span>
        <span className="truncate text-center">{nameB}</span>
      </div>

      {/* Set rows — stepper per player */}
      <div className="space-y-3">
        {sets.map((set, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Set {i + 1}
              </span>
              {isOrganizer && sets.length > 1 && (
                <button
                  className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  onClick={() => removeSet(i)}
                  data-testid={`button-remove-set-${i}`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ScoreStepper
                value={set.a}
                onChange={(v) => updateSet(i, "a", v)}
                disabled={!isOrganizer}
                highlight={set.a > set.b}
                testIdPrefix={`set-${i}-a`}
              />
              <ScoreStepper
                value={set.b}
                onChange={(v) => updateSet(i, "b", v)}
                disabled={!isOrganizer}
                highlight={set.b > set.a}
                testIdPrefix={`set-${i}-b`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sets tally + Add Set */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2">
          <Badge variant={setsWonA > setsWonB ? "default" : "secondary"} className="text-sm px-3 py-1">
            {setsWonA}
          </Badge>
          <span className="text-xs text-muted-foreground">sets won</span>
          <Badge variant={setsWonB > setsWonA ? "default" : "secondary"} className="text-sm px-3 py-1">
            {setsWonB}
          </Badge>
        </div>
        {isOrganizer && !winner && (
          <Button size="sm" variant="outline" onClick={addSet} data-testid="button-add-set" className="rounded-lg">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Set
          </Button>
        )}
      </div>

      {/* Winner declaration */}
      {isOrganizer && winner && (
        <Button
          onClick={() => onSubmit(winner, { sets, setsWonA, setsWonB })}
          disabled={isPending}
          className="w-full rounded-xl h-12 text-base font-bold gap-2"
          data-testid="button-submit-sets"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
          Declare Winner — {winner === matchup.dancerARegistrationId ? nameA : nameB}
          {" "}({setsWonA > setsWonB ? setsWonA : setsWonB}–{setsWonA > setsWonB ? setsWonB : setsWonA})
        </Button>
      )}
    </div>
  );
}

export function LiveVoting({
  matchup,
  eventId,
  categoryId,
  competitionSport,
  currentUserId,
  isOrganizer = false,
  onVoteComplete,
}: LiveVotingProps) {
  const { toast } = useToast();
  const [selectedDancer, setSelectedDancer] = useState<number | null>(null);
  const sportConfig = getSportConfig(competitionSport);

  const { data: judges = [] } = useQuery<Judge[]>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}/judges`],
  });

  const { data: votes = [], refetch: refetchVotes } = useQuery<VoteRecord[]>({
    queryKey: [`/api/matchups/${matchup.id}/votes`],
    refetchInterval: matchup.status === "VOTING" ? 3000 : false,
  });

  const isJudge = judges.some((j) => j.userId === currentUserId);
  const myVote = votes.find((v) => v.judgeUserId === currentUserId);
  const votesForA = votes.filter((v) => v.votedForRegistrationId === matchup.dancerARegistrationId).length;
  const votesForB = votes.filter((v) => v.votedForRegistrationId === matchup.dancerBRegistrationId).length;
  const totalJudges = judges.length;
  const allVotesIn = votes.length >= totalJudges && totalJudges > 0;

  useEffect(() => {
    if (myVote && !selectedDancer) {
      setSelectedDancer(myVote.votedForRegistrationId);
    }
  }, [myVote, selectedDancer]);

  const startVotingMutation = useMutation({
    mutationFn: async () => apiRequest(`/api/matchups/${matchup.id}/start-voting`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: "Voting started!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to start voting", description: error.message, variant: "destructive" });
    },
  });

  const submitVoteMutation = useMutation({
    mutationFn: async (payload: {
      votedForRegistrationId: number;
      techniqueScore?: number;
      vocabularyScore?: number;
      executionScore?: number;
      musicalityScore?: number;
      originalityScore?: number;
      notes?: string;
    }) => apiRequest(`/api/matchups/${matchup.id}/votes`, "POST", payload),
    onSuccess: (data: any) => {
      refetchVotes();
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      if (data.allJudgesVoted) {
        toast({ title: "Winner determined!", description: `${data.dancerAVotes} - ${data.dancerBVotes}` });
        onVoteComplete?.();
      } else {
        toast({ title: "Vote recorded", description: `${data.votesReceived} of ${data.totalJudges} votes in` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit vote", description: error.message, variant: "destructive" });
    },
  });

  const declareWinnerMutation = useMutation({
    mutationFn: async ({ winnerId, scoreData }: { winnerId: number; scoreData?: object }) =>
      apiRequest(`/api/matchups/${matchup.id}/result`, "PUT", { winnerRegistrationId: winnerId, scoreData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: "Winner declared!" });
      onVoteComplete?.();
    },
    onError: (error: any) => {
      toast({ title: "Failed to declare winner", description: error.message, variant: "destructive" });
    },
  });

  const handleCriteriaVote = (registrationId: number, scores: Record<string, number>, notes: string) => {
    setSelectedDancer(registrationId);
    submitVoteMutation.mutate({
      votedForRegistrationId: registrationId,
      techniqueScore: scores.techniqueScore,
      vocabularyScore: scores.vocabularyScore,
      executionScore: scores.executionScore,
      musicalityScore: scores.musicalityScore,
      originalityScore: scores.originalityScore,
      notes: notes || undefined,
    });
  };

  const handleSimpleVote = (registrationId: number) => {
    setSelectedDancer(registrationId);
    submitVoteMutation.mutate({ votedForRegistrationId: registrationId });
  };

  const handleScoreSubmit = (registrationId: number, scoreData: object) => {
    declareWinnerMutation.mutate({ winnerId: registrationId, scoreData });
  };

  if (!matchup.dancerARegistrationId || !matchup.dancerBRegistrationId) return null;

  const isVoting = matchup.status === "VOTING";
  const isCompleted = matchup.status === "COMPLETED";
  const format = sportConfig.format;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">{sportConfig.emoji}</span>
            <div>
              <CardTitle className="text-base">{sportConfig.label} — Live Judging</CardTitle>
              <CardDescription className="flex items-center gap-2">
                {isVoting && (
                  <>
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Voting in progress
                  </>
                )}
                {isCompleted && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Battle complete
                  </>
                )}
                {!isVoting && !isCompleted && (
                  <>
                    <Clock className="h-3 w-3" />
                    Waiting to start
                  </>
                )}
              </CardDescription>
            </div>
          </div>

          {isOrganizer && !isVoting && !isCompleted && format === "judge_criteria" && (
            <Button
              size="sm"
              onClick={() => startVotingMutation.mutate()}
              disabled={startVotingMutation.isPending || judges.length === 0}
              data-testid="button-start-voting"
            >
              {startVotingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start Voting
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* === CRITERIA VOTING (dance, boxing, etc.) === */}
        {format === "judge_criteria" && (
          <>
            {!isCompleted && !myVote ? (
              <CriteriaVotingPanel
                matchup={matchup}
                sportConfig={sportConfig}
                isJudge={isJudge}
                isVoting={isVoting}
                onSubmit={handleCriteriaVote}
                isPending={submitVoteMutation.isPending}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { regId: matchup.dancerARegistrationId, dancer: matchup.dancerA, votesCount: votesForA },
                  { regId: matchup.dancerBRegistrationId, dancer: matchup.dancerB, votesCount: votesForB },
                ].map(({ regId, dancer, votesCount }) => (
                  <div
                    key={regId}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      matchup.winnerRegistrationId === regId
                        ? "border-primary bg-primary/10"
                        : matchup.winnerRegistrationId
                        ? "border-border opacity-60"
                        : selectedDancer === regId
                        ? "border-primary/60 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <Avatar className="h-12 w-12 mx-auto mb-2">
                      <AvatarImage src={getDancerImage(dancer) || undefined} />
                      <AvatarFallback>{getDancerInitials(dancer)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-sm truncate">{getDancerDisplayName(dancer)}</p>
                    {(isVoting || isCompleted) && (
                      <Badge variant={matchup.winnerRegistrationId === regId ? "default" : "secondary"} className="mt-1">
                        {votesCount} vote{votesCount !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {matchup.winnerRegistrationId === regId && (
                      <div className="flex items-center justify-center gap-1 text-yellow-500 mt-1">
                        <Trophy className="h-4 w-4" />
                        <span className="text-xs font-medium">Winner</span>
                      </div>
                    )}
                    {selectedDancer === regId && myVote && (
                      <div className="mt-1 text-xs text-primary flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Your vote
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(isVoting || isCompleted) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-4 w-4" /> Votes received
                    </span>
                    <span className="font-medium">{votes.length} / {totalJudges}</span>
                  </div>
                  <Progress value={totalJudges > 0 ? (votes.length / totalJudges) * 100 : 0} className="h-2" />
                  <div className="flex flex-wrap gap-2 mt-1">
                    {judges.map((judge) => {
                      const judgeVote = votes.find((v) => v.judgeId === judge.id);
                      return (
                        <div key={judge.id} className="flex items-center gap-1" title={judge.user.displayName || judge.user.username}>
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={judge.user.profileImage || undefined} />
                            <AvatarFallback className="text-xs">{judge.judgeNumber}</AvatarFallback>
                          </Avatar>
                          {judgeVote ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {isJudge && isVoting && !myVote && (
              <div className="p-3 bg-primary/10 rounded-md text-center">
                <p className="text-sm font-medium">You are a judge</p>
                <p className="text-xs text-muted-foreground">Pick the winner above, then rate their performance</p>
              </div>
            )}
            {isJudge && myVote && (
              <div className="p-3 bg-green-500/10 rounded-md text-center">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Vote submitted
                </p>
                <p className="text-xs text-muted-foreground">Your decision has been recorded</p>
              </div>
            )}
            {!isJudge && isVoting && (
              <div className="p-3 bg-muted rounded-md text-center">
                <p className="text-sm text-muted-foreground">Waiting for judges to vote...</p>
              </div>
            )}
          </>
        )}

        {/* === SCORE ENTRY (basketball 3v3, etc.) === */}
        {format === "score_entry" && !isCompleted && (
          <ScoreEntryPanel
            matchup={matchup}
            sportConfig={sportConfig}
            isOrganizer={isOrganizer}
            onSubmit={handleScoreSubmit}
            isPending={declareWinnerMutation.isPending}
          />
        )}

        {/* === SET ENTRY (table tennis, padel, etc.) === */}
        {format === "sets" && !isCompleted && (
          <SetsEntryPanel
            matchup={matchup}
            sportConfig={sportConfig}
            isOrganizer={isOrganizer}
            onSubmit={handleScoreSubmit}
            isPending={declareWinnerMutation.isPending}
          />
        )}

        {/* === WINNER PICK (arm wrestling, chess, etc.) === */}
        {format === "winner_pick" && !isCompleted && (
          <div className="space-y-3">
            <div className="text-center text-sm text-muted-foreground">{sportConfig.emoji} {sportConfig.label} — Select Winner</div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { regId: matchup.dancerARegistrationId, dancer: matchup.dancerA, testId: "button-vote-dancer-a" },
                { regId: matchup.dancerBRegistrationId, dancer: matchup.dancerB, testId: "button-vote-dancer-b" },
              ].map(({ regId, dancer, testId }) => (
                <button
                  key={testId}
                  type="button"
                  onClick={() => isJudge && isVoting && !submitVoteMutation.isPending && regId && handleSimpleVote(regId)}
                  disabled={!isJudge || !isVoting || submitVoteMutation.isPending}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    selectedDancer === regId ? "border-primary bg-primary/10" : isJudge && isVoting ? "border-border hover:border-primary/40 cursor-pointer" : "border-border opacity-70"
                  }`}
                  data-testid={testId}
                >
                  <Avatar className="h-16 w-16 mx-auto mb-2">
                    <AvatarImage src={getDancerImage(dancer) || undefined} />
                    <AvatarFallback className="text-lg">{getDancerInitials(dancer)}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold">{getDancerDisplayName(dancer)}</p>
                  {selectedDancer === regId && myVote && (
                    <div className="mt-2 text-xs text-primary flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Your vote
                    </div>
                  )}
                </button>
              ))}
            </div>
            {isOrganizer && !isVoting && !isCompleted && judges.length === 0 && (
              <Button className="w-full" onClick={() => startVotingMutation.mutate()} disabled={startVotingMutation.isPending} data-testid="button-start-voting-pick">
                {startVotingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Start Judging
              </Button>
            )}
          </div>
        )}

        {/* === COMPLETED STATE (all formats) === */}
        {isCompleted && (
          <div className="text-center py-4 space-y-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Winner</p>
              <p className="text-lg font-bold">
                {matchup.winnerRegistrationId === matchup.dancerARegistrationId
                  ? getDancerDisplayName(matchup.dancerA)
                  : getDancerDisplayName(matchup.dancerB)}
              </p>
            </div>
            {format === "judge_criteria" && (
              <div className="text-sm text-muted-foreground">
                Final vote: {votesForA} – {votesForB}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
