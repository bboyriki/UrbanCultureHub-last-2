import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getSportConfig } from "@/lib/competitionSports";
import { ScoreStepper } from "@/components/events/LiveVoting";
import { 
  Gavel, 
  Vote, 
  Trophy,
  Loader2,
  Music,
  Zap,
  Star,
  Target,
  Sparkles,
  CheckCircle,
  Clock,
  Users,
  AlertCircle,
  Plus,
  Minus,
  Undo2,
  Swords,
  ExternalLink,
  Radio,
  Monitor,
} from "lucide-react";
import { Link } from "wouter";

interface Dancer {
  id: number;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  registrationId?: number;
}

interface Matchup {
  id: number;
  eventId: number;
  categoryId: number;
  round: number;
  position: number;
  dancerARegistrationId: number | null;
  dancerBRegistrationId: number | null;
  status: string;
  winnerRegistrationId: number | null;
  bestOf: number;
  currentRound: number;
  dancerARoundWins: number;
  dancerBRoundWins: number;
  liveScoreA: number;
  liveScoreB: number;
  scoreData: any;
  tableNumber?: number | null;
  dancerA: Dancer | null;
  dancerB: Dancer | null;
  winner: Dancer | null;
}

interface JudgeAssignment {
  id: number;
  eventId: number;
  categoryId: number;
  userId: number;
  judgeNumber: number;
  isActive: boolean;
  event: {
    id: number;
    title: string;
    date: string;
    image: string | null;
  };
  category: {
    id: number;
    name: string;
    useJudgeVoting: boolean;
    judgeCount: number;
    competitionSport: string | null;
  };
}

interface VoteRecord {
  id: number;
  matchupId: number;
  roundNumber: number;
  judgeUserId: number;
  votedForRegistrationId: number;
  notes: string | null;
  techniqueScore: number | null;
  vocabularyScore: number | null;
  executionScore: number | null;
  musicalityScore: number | null;
  originalityScore: number | null;
  createdAt: string;
}

const ICON_MAP: Record<string, any> = { Target, Zap, CheckCircle, Music, Sparkles, Star };

const CRITERIA_ICONS = [Target, Zap, CheckCircle, Music, Sparkles];

export default function JudgePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null);
  const [selectedDancer, setSelectedDancer] = useState<number | null>(null);
  // Multi-table TT: which table has this umpire chosen to score?
  const [selectedTableMatchupId, setSelectedTableMatchupId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem('tt_selected_table');
    return stored ? parseInt(stored, 10) : null;
  });
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState({
    technique: 50,
    vocabulary: 50,
    execution: 50,
    musicality: 50,
    originality: 50,
  });
  const [judgeSets, setJudgeSets] = useState<Array<{ a: number; b: number }>>([{ a: 0, b: 0 }]);
  const updateJudgeSet = (i: number, key: "a" | "b", val: number) =>
    setJudgeSets(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: Math.max(0, val) } : s));
  const addJudgeSet = () => setJudgeSets(prev => [...prev, { a: 0, b: 0 }]);
  const removeJudgeSet = (i: number) => setJudgeSets(prev => prev.filter((_, idx) => idx !== i));

  // Fetch judge assignments for current user
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<JudgeAssignment[]>({
    queryKey: [`/api/users/${user?.id}/judge-assignments`],
    enabled: !!user?.id,
  });

  // Fetch active voting matchups for assigned categories
  // TT umpires: show panel regardless of useJudgeVoting (they score points, not votes)
  // Other sports: require useJudgeVoting=true
  const activeAssignment = assignments.find(a => {
    const sport = getSportConfig(a.category?.competitionSport);
    return sport.judgePanel === 'table_tennis' || a.category?.useJudgeVoting;
  });

  // Sport config derived from active assignment
  const sportConfig = getSportConfig(activeAssignment?.category.competitionSport);
  const isTTSport = sportConfig.judgePanel === 'table_tennis';
  const isDanceSport = sportConfig.family === 'dance';
  const matchLabel = isDanceSport ? 'Battle' : 'Match';
  const participantLabel = sportConfig.participantLabel; // dancer, player, team, etc.
  const ParticipantLabel = participantLabel.charAt(0).toUpperCase() + participantLabel.slice(1);
  
  const { data: matchups = [], isLoading: matchupsLoading, refetch: refetchMatchups } = useQuery<Matchup[]>({
    queryKey: [`/api/events/${activeAssignment?.eventId}/categories/${activeAssignment?.categoryId}/matchups`],
    enabled: !!activeAssignment,
    refetchInterval: isTTSport ? 1000 : 5000, // Poll 1s for TT (fast-paced), 5s for others
  });

  // MULTI-TABLE: All active (IN_PROGRESS / VOTING) matchups in this category
  const allActiveMatchups = matchups.filter(m =>
    (m.status === 'VOTING' || m.status === 'IN_PROGRESS') &&
    m.dancerARegistrationId &&
    m.dancerBRegistrationId &&
    !m.winnerRegistrationId
  ).sort((a, b) => (a.tableNumber ?? a.position) - (b.tableNumber ?? b.position));

  // Single-table: keep legacy "currentActiveBattle" (first active matchup)
  const currentActiveBattle = allActiveMatchups[0] ?? null;

  // For TT with multiple simultaneous tables, the umpire must pick their table explicitly.
  // For single-table (or non-TT), we still auto-select the one active match.
  const isMultiTable = isTTSport && allActiveMatchups.length > 1;

  // The matchup this umpire is actually scoring
  const myTableMatchup = isMultiTable
    ? (allActiveMatchups.find(m => m.id === selectedTableMatchupId) ?? null)
    : currentActiveBattle;

  // For backwards compatibility with the dance voting flow, wrap in array if exists
  const votingMatchups = myTableMatchup ? [myTableMatchup] : [];
  
  // Upcoming matchups = SCHEDULED with both dancers (waiting in queue)
  const upcomingMatchups = matchups.filter(m => 
    m.status === 'SCHEDULED' && 
    m.dancerARegistrationId && 
    m.dancerBRegistrationId &&
    !m.winnerRegistrationId
  );
  
  const completedMatchups = matchups.filter(m => m.status === 'COMPLETED' || m.winnerRegistrationId);

  // Fetch existing votes for the selected matchup
  const { data: existingVotes = [] } = useQuery<VoteRecord[]>({
    queryKey: [`/api/matchups/${selectedMatchup?.id}/votes`],
    enabled: !!selectedMatchup,
    refetchInterval: 3000,
  });

  // Get current round for the matchup (default to 1 if not set)
  const currentBattleRound = selectedMatchup?.currentRound || 1;
  const bestOf = selectedMatchup?.bestOf || 1;
  
  // Check if I already voted for the current round
  const myVote = existingVotes.find(v => v.judgeUserId === user?.id && v.roundNumber === currentBattleRound);
  
  // Get all my votes for this matchup (for showing history)
  const myRoundVotes = existingVotes.filter(v => v.judgeUserId === user?.id);
  
  // Get votes for the current round only
  const currentRoundVotes = existingVotes.filter(v => v.roundNumber === currentBattleRound);

  // Submit vote mutation
  const submitVoteMutation = useMutation({
    mutationFn: async (voteData: {
      matchupId: number;
      roundNumber: number;
      votedForRegistrationId: number;
      notes: string;
      techniqueScore: number;
      vocabularyScore: number;
      executionScore: number;
      musicalityScore: number;
      originalityScore: number;
    }) => {
      return await apiRequest(`/api/matchups/${voteData.matchupId}/votes`, 'POST', voteData);
    },
    onSuccess: (response: any) => {
      // Invalidate votes and matchups to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/matchups/${selectedMatchup?.id}/votes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${activeAssignment?.eventId}/categories/${activeAssignment?.categoryId}/matchups`] });
      
      if (response?.allJudgesVoted) {
        if (response?.isTie) {
          toast({ 
            title: `TIE in Round ${response.roundNumber}!`, 
            description: response?.requiresTiebreaker 
              ? `Votes split ${response.dancerARoundVotes}-${response.dancerBRoundVotes}. Moving to tiebreaker Round ${response.nextRound}!`
              : `Votes split ${response.dancerARoundVotes}-${response.dancerBRoundVotes}. Vote again!`,
          });
        } else if (response?.matchupComplete) {
          toast({ 
            title: "Battle Complete!", 
            description: `Final score: ${response.dancerARoundWins}-${response.dancerBRoundWins}. Winner advances!`,
          });
          // Clear selected matchup so user selects next one
          setSelectedMatchup(null);
          setSelectedDancer(null);
        } else if (response?.nextRound) {
          toast({ 
            title: `Round ${response.roundNumber} Complete!`,
            description: `Score: ${response.dancerARoundWins}-${response.dancerBRoundWins}. Moving to Round ${response.nextRound}!`,
          });
        }
      } else {
        toast({ 
          title: `Vote submitted for Round ${response?.roundNumber || currentBattleRound}!`,
          description: `${response?.votesReceived || 1} of ${response?.totalJudges || '?'} judges voted.`
        });
      }
      // Reset form
      setNotes("");
      setScores({ technique: 50, vocabulary: 50, execution: 50, musicality: 50, originality: 50 });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to submit vote", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleSubmitVote = () => {
    if (!selectedMatchup || !selectedDancer) return;
    
    submitVoteMutation.mutate({
      matchupId: selectedMatchup.id,
      roundNumber: currentBattleRound,
      votedForRegistrationId: selectedDancer,
      notes,
      techniqueScore: scores.technique,
      vocabularyScore: scores.vocabulary,
      executionScore: scores.execution,
      musicalityScore: scores.musicality,
      originalityScore: scores.originality,
    });
  };

  // Table Tennis live scoring mutations
  const ttPointMutation = useMutation({
    mutationFn: async ({ matchupId, player }: { matchupId: number; player: 'A' | 'B' }) => {
      const resp = await apiRequest(`/api/matchups/${matchupId}/tt-point`, 'POST', { player });
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${activeAssignment?.eventId}/categories/${activeAssignment?.categoryId}/matchups`] });
      if (data.ttState?.matchComplete) {
        toast({ title: "🏓 Match Complete!", description: "Winner determined. Moving to next match." });
      }
    },
    onError: (e: any) => toast({ title: "Error scoring point", description: e.message, variant: "destructive" }),
  });

  const ttUndoMutation = useMutation({
    mutationFn: async (matchupId: number) => {
      const resp = await apiRequest(`/api/matchups/${matchupId}/tt-undo`, 'POST', {});
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${activeAssignment?.eventId}/categories/${activeAssignment?.categoryId}/matchups`] });
      toast({ title: "↩ Point undone" });
    },
    onError: (e: any) => toast({ title: "Nothing to undo", description: e.message, variant: "destructive" }),
  });

  const getDancerName = (dancer: Matchup['dancerA']) => {
    if (!dancer) return "TBD";
    return dancer.displayName || dancer.username;
  };

  const getDancerInitials = (dancer: Matchup['dancerA']) => {
    if (!dancer) return "?";
    const name = dancer.displayName || dancer.username;
    return name.substring(0, 2).toUpperCase();
  };

  // MATCH-BY-MATCH: Auto-select the active battle
  // For multi-table TT: don't auto-select — the umpire must pick their table.
  // For single-table (and non-TT): keep legacy auto-select behaviour.
  useEffect(() => {
    const target = myTableMatchup;
    if (target && (!selectedMatchup || selectedMatchup.id !== target.id)) {
      setSelectedMatchup(target);
      setSelectedDancer(null);
    } else if (!target && selectedMatchup && !isMultiTable) {
      setSelectedMatchup(null);
      setSelectedDancer(null);
    }
  }, [myTableMatchup?.id, isMultiTable]);

  // Clear stored table selection when match completes or is no longer active
  useEffect(() => {
    if (selectedTableMatchupId && !allActiveMatchups.find(m => m.id === selectedTableMatchupId)) {
      setSelectedTableMatchupId(null);
      sessionStorage.removeItem('tt_selected_table');
    }
  }, [allActiveMatchups, selectedTableMatchupId]);

  // Keep selectedMatchup in sync with the latest polled matchups data
  // This is critical for multi-round voting - when backend advances currentRound,
  // the UI must update to show the new round instead of keeping stale data
  useEffect(() => {
    if (selectedMatchup && matchups.length > 0) {
      const updatedMatchup = matchups.find(m => m.id === selectedMatchup.id);
      if (updatedMatchup) {
        // Only update if there are actual changes to avoid unnecessary re-renders
        if (
          updatedMatchup.currentRound !== selectedMatchup.currentRound ||
          updatedMatchup.dancerARoundWins !== selectedMatchup.dancerARoundWins ||
          updatedMatchup.dancerBRoundWins !== selectedMatchup.dancerBRoundWins ||
          updatedMatchup.bestOf !== selectedMatchup.bestOf ||
          updatedMatchup.status !== selectedMatchup.status ||
          updatedMatchup.winnerRegistrationId !== selectedMatchup.winnerRegistrationId ||
          updatedMatchup.liveScoreA !== selectedMatchup.liveScoreA ||
          updatedMatchup.liveScoreB !== selectedMatchup.liveScoreB
        ) {
          setSelectedMatchup(updatedMatchup);
          // Reset selected dancer when round changes to force re-selection
          if (updatedMatchup.currentRound !== selectedMatchup.currentRound) {
            setSelectedDancer(null);
          }
        }
      } else if (updatedMatchup === undefined) {
        // Matchup was completed or removed, the currentActiveBattle effect will handle selecting new one
        // No action needed here
      }
    }
  }, [matchups, selectedMatchup]);

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Gavel className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Sign in Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to access the Judge Panel</p>
            <Button asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assignmentsLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">No Judge Assignments</h2>
            <p className="text-muted-foreground">You haven't been assigned as a judge for any battles yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Event organizers can assign you as a judge from their event management page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Gavel className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Judge Panel</h1>
          <p className="text-muted-foreground">Your assigned battles and voting interface</p>
        </div>
      </div>

      <Tabs defaultValue="voting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="voting" className="gap-2">
            <Vote className="w-4 h-4" />
            Live Voting
            {currentActiveBattle && (
              <Badge className="ml-1 bg-green-500 animate-pulse">1</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="w-4 h-4" />
            My Assignments
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="w-4 h-4" />
            Vote History
          </TabsTrigger>
        </TabsList>

        {/* Live Voting Tab */}
        <TabsContent value="voting" className="space-y-4 animate-in fade-in duration-300">
          {votingMatchups.length === 0 ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="py-6 sm:py-8 text-center">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-muted-foreground animate-pulse" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Waiting for Active {matchLabel}s</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm">No {matchLabel.toLowerCase()}s are currently in {isDanceSport ? 'voting' : 'scoring'} phase.</p>
                  <p className="text-xs text-muted-foreground mt-1">This page will update automatically when {isDanceSport ? 'voting' : 'scoring'} starts.</p>
                </CardContent>
              </Card>
              
              {/* Show upcoming scheduled matchups */}
              {upcomingMatchups.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                      Upcoming Battles ({upcomingMatchups.length})
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">These battles are scheduled and waiting to start</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {upcomingMatchups.slice(0, 5).map((matchup) => (
                      <div 
                        key={matchup.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 gap-2 rounded-md bg-muted/50 border"
                        data-testid={`upcoming-matchup-${matchup.id}`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <Badge variant="outline" className="text-xs">R{matchup.round}</Badge>
                          <span className="font-medium text-sm">{getDancerName(matchup.dancerA)}</span>
                          <span className="text-muted-foreground text-xs">vs</span>
                          <span className="font-medium text-sm">{getDancerName(matchup.dancerB)}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs w-fit">Scheduled</Badge>
                      </div>
                    ))}
                    {upcomingMatchups.length > 5 && (
                      <p className="text-xs sm:text-sm text-muted-foreground text-center pt-2">
                        +{upcomingMatchups.length - 5} more scheduled battles
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : isTTSport ? (
              /* ── TABLE TENNIS: FULL-WIDTH UMPIRE SCORING PANEL ── */
              <div className="space-y-4 max-w-2xl mx-auto w-full">
                {/* Multi-table selector: shown when multiple tables are active and no table chosen yet */}
                {isMultiTable && !selectedTableMatchupId ? (
                  <div className="space-y-4">
                    <div className="text-center pb-2">
                      <span className="text-4xl block mb-3">🏓</span>
                      <h2 className="text-xl font-bold">Select Your Table</h2>
                      <p className="text-sm text-muted-foreground mt-1">{allActiveMatchups.length} tables are active right now. Tap the table you are umpiring.</p>
                    </div>
                    <div className="grid gap-3">
                      {allActiveMatchups.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedTableMatchupId(m.id);
                            sessionStorage.setItem('tt_selected_table', String(m.id));
                            setSelectedMatchup(m);
                          }}
                          className="w-full text-left rounded-2xl border-2 border-primary/20 hover:border-primary bg-card hover:bg-primary/5 transition-all p-4 shadow-sm"
                          data-testid={`button-select-table-${m.tableNumber ?? m.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                              <span className="text-xs text-primary font-semibold uppercase tracking-wide leading-none">Table</span>
                              <span className="text-2xl font-black text-primary leading-tight">{m.tableNumber ?? (allActiveMatchups.indexOf(m) + 1)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-sm truncate">{getDancerName(m.dancerA)}</span>
                                <span className="text-muted-foreground text-xs shrink-0">vs</span>
                                <span className="font-bold text-sm truncate">{getDancerName(m.dancerB)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">Round {m.round} · Best of {m.bestOf || 5}</p>
                            </div>
                            <Badge className="bg-green-500 text-[10px] shrink-0">LIVE</Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : !selectedMatchup ? (
                  <div className="text-center py-12">
                    <span className="text-5xl block mb-4">🏓</span>
                    <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-pulse" />
                    <p className="font-semibold text-lg">Waiting for active match…</p>
                    <p className="text-sm text-muted-foreground mt-1">You'll see scoring controls here when a match starts</p>
                  </div>
                ) : (() => {
                  const sd: any = selectedMatchup.scoreData || {};
                  const pointLog: string[] = Array.isArray(sd.pointLog) ? sd.pointLog : [];
                  const sets: {a:number;b:number}[] = Array.isArray(sd.sets) ? sd.sets : [];
                  const gamesA = sd.gamesA ?? selectedMatchup.dancerARoundWins ?? 0;
                  const gamesB = sd.gamesB ?? selectedMatchup.dancerBRoundWins ?? 0;
                  const liveA = selectedMatchup.liveScoreA ?? 0;
                  const liveB = selectedMatchup.liveScoreB ?? 0;
                  const bestOfGames = selectedMatchup.bestOf || 5;
                  const totalInSet = liveA + liveB;
                  const isDeuce = liveA >= 10 && liveB >= 10;
                  const serveEvery = isDeuce ? 1 : 2;
                  const serverIsA = Math.floor(totalInSet / serveEvery) % 2 === 0;
                  const isPending = ttPointMutation.isPending || ttUndoMutation.isPending;
                  const isCompleted = selectedMatchup.status === 'COMPLETED';
                  const isGamePoint = (liveA >= 10 || liveB >= 10) && !isDeuce;

                  return (
                    <div className="space-y-4">
                      {/* Top bar: context + table badge + projector link */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl shrink-0">🏓</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-sm truncate">{activeAssignment?.event.title}</p>
                              {isMultiTable && selectedMatchup.tableNumber && (
                                <Badge className="bg-blue-600 text-white text-[10px] px-1.5 shrink-0">
                                  Table {selectedMatchup.tableNumber}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Bracket R{selectedMatchup.round} · Best of {bestOfGames} · Game {sets.length + 1}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-green-500 animate-pulse text-[10px]">● LIVE</Badge>
                          {isMultiTable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs h-8 text-muted-foreground"
                              onClick={() => {
                                setSelectedTableMatchupId(null);
                                sessionStorage.removeItem('tt_selected_table');
                                setSelectedMatchup(null);
                              }}
                              data-testid="button-change-table"
                            >
                              ⇄ Change Table
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs h-8">
                            <a
                              href={`/live-results/${activeAssignment?.eventId}/${activeAssignment?.categoryId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Monitor className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Projector</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        </div>
                      </div>

                      {isCompleted ? (
                        <div className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-10 text-center space-y-3">
                          <Trophy className="w-20 h-20 mx-auto text-amber-500" />
                          <p className="text-3xl font-black">Match Complete!</p>
                          <p className="text-muted-foreground text-lg">
                            {gamesA > gamesB ? getDancerName(selectedMatchup.dancerA) : getDancerName(selectedMatchup.dancerB)} wins {gamesA}–{gamesB}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Match score dots */}
                          <div className="flex items-center justify-center gap-2 py-1">
                            {Array.from({ length: bestOfGames }).map((_, i) => (
                              <div key={i} className={`w-4 h-4 rounded-full transition-all ${
                                i < gamesA ? 'bg-blue-500 shadow-sm shadow-blue-400/50'
                                : i >= bestOfGames - gamesB ? 'bg-red-500 shadow-sm shadow-red-400/50'
                                : 'bg-muted border border-border'
                              }`} />
                            ))}
                            <span className="text-sm font-bold text-muted-foreground ml-1">Match: {gamesA}–{gamesB}</span>
                          </div>

                          {/* Status */}
                          <div className="flex justify-center gap-2">
                            {isDeuce && <Badge variant="destructive" className="animate-pulse font-bold tracking-wider px-4">DEUCE</Badge>}
                            {isGamePoint && <Badge className="bg-amber-500 font-bold tracking-wider animate-pulse px-4">GAME POINT</Badge>}
                            {!isDeuce && !isGamePoint && (
                              <Badge variant="outline" className="text-muted-foreground">First to 11 pts · Game {sets.length + 1}</Badge>
                            )}
                          </div>

                          {/* GIANT SCORING BUTTONS */}
                          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                            {/* Player A */}
                            <button
                              onClick={() => selectedMatchup && ttPointMutation.mutate({ matchupId: selectedMatchup.id, player: 'A' })}
                              disabled={isPending}
                              data-testid="tt-point-a"
                              className="relative flex flex-col items-center justify-center gap-3 rounded-3xl border-4 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/35 active:scale-[0.97] transition-all duration-75 p-4 select-none cursor-pointer min-h-[200px] group touch-manipulation"
                            >
                              <Avatar className="w-16 h-16 border-2 border-blue-400/60 group-hover:border-blue-500 group-active:scale-110 transition-all">
                                <AvatarImage src={selectedMatchup.dancerA?.profilePicture || undefined} />
                                <AvatarFallback className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xl font-black">
                                  {getDancerInitials(selectedMatchup.dancerA)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-bold text-center leading-tight line-clamp-2 text-blue-700 dark:text-blue-300">
                                {getDancerName(selectedMatchup.dancerA)}
                              </span>
                              {serverIsA && (
                                <Badge className="bg-blue-500 text-white text-[10px] px-2">🏓 Serving</Badge>
                              )}
                              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/30 group-active:bg-blue-500/50 transition-colors">
                                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              {isPending && <Loader2 className="absolute bottom-3 right-3 w-4 h-4 animate-spin text-blue-500/60" />}
                            </button>

                            {/* Center score */}
                            <div className="flex flex-col items-center justify-center gap-1.5 min-w-[80px]">
                              <span className={`text-6xl sm:text-7xl font-black tabular-nums leading-none transition-all duration-100 ${liveA > liveB ? 'text-blue-500 scale-110' : 'text-foreground/80'}`}>
                                {liveA}
                              </span>
                              <span className="text-xl text-muted-foreground leading-none font-light">–</span>
                              <span className={`text-6xl sm:text-7xl font-black tabular-nums leading-none transition-all duration-100 ${liveB > liveA ? 'text-red-500 scale-110' : 'text-foreground/80'}`}>
                                {liveB}
                              </span>
                            </div>

                            {/* Player B */}
                            <button
                              onClick={() => selectedMatchup && ttPointMutation.mutate({ matchupId: selectedMatchup.id, player: 'B' })}
                              disabled={isPending}
                              data-testid="tt-point-b"
                              className="relative flex flex-col items-center justify-center gap-3 rounded-3xl border-4 border-red-500/50 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/35 active:scale-[0.97] transition-all duration-75 p-4 select-none cursor-pointer min-h-[200px] group touch-manipulation"
                            >
                              <Avatar className="w-16 h-16 border-2 border-red-400/60 group-hover:border-red-500 group-active:scale-110 transition-all">
                                <AvatarImage src={selectedMatchup.dancerB?.profilePicture || undefined} />
                                <AvatarFallback className="bg-red-500/20 text-red-700 dark:text-red-300 text-xl font-black">
                                  {getDancerInitials(selectedMatchup.dancerB)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-bold text-center leading-tight line-clamp-2 text-red-700 dark:text-red-300">
                                {getDancerName(selectedMatchup.dancerB)}
                              </span>
                              {!serverIsA && (
                                <Badge className="bg-red-500 text-white text-[10px] px-2">🏓 Serving</Badge>
                              )}
                              <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center group-hover:bg-red-500/30 group-active:bg-red-500/50 transition-colors">
                                <Plus className="w-5 h-5 text-red-600 dark:text-red-400" />
                              </div>
                              {isPending && <Loader2 className="absolute bottom-3 left-3 w-4 h-4 animate-spin text-red-500/60" />}
                            </button>
                          </div>

                          {/* Game history + undo row */}
                          <div className="flex items-center gap-3 pt-2 border-t">
                            <div className="flex flex-wrap gap-1.5 flex-1">
                              {sets.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">No completed games yet</span>
                              ) : sets.map((s, i) => (
                                <div key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${s.a > s.b ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300' : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'}`}>
                                  G{i+1}: {s.a}–{s.b}
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectedMatchup && ttUndoMutation.mutate(selectedMatchup.id)}
                              disabled={isPending || pointLog.length === 0}
                              className="gap-1.5 text-xs h-8 shrink-0"
                              data-testid="tt-undo"
                            >
                              <Undo2 className="w-3.5 h-3.5" /> Undo
                            </Button>
                          </div>

                          <p className="text-center text-xs text-muted-foreground">
                            {pointLog.length} point{pointLog.length !== 1 ? 's' : ''} scored · Tap player to add a point
                          </p>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Upcoming matches */}
                {upcomingMatchups.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Up Next ({upcomingMatchups.length} waiting)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {upcomingMatchups.slice(0, 5).map((matchup, index) => (
                        <div key={matchup.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs w-6 h-6 rounded-full p-0 flex items-center justify-center">{index + 1}</Badge>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{getDancerName(matchup.dancerA)}</span>
                            <span className="text-muted-foreground text-xs">vs</span>
                            <span className="text-red-600 dark:text-red-400 font-medium">{getDancerName(matchup.dancerB)}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">R{matchup.round}</Badge>
                        </div>
                      ))}
                      {upcomingMatchups.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">+{upcomingMatchups.length - 5} more</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Current Battle - Match by Match Display */}
              <div className="space-y-4">
                <Card className="border-2 border-green-500/50 bg-gradient-to-br from-green-500/5 to-transparent">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <span className="text-base sm:text-lg">{sportConfig.emoji}</span>
                      Current {matchLabel}
                      <Badge className="bg-green-500 animate-pulse ml-auto text-xs">LIVE</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {isDanceSport ? 'Match-by-match battle in progress' : `Active ${matchLabel.toLowerCase()} — score below`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 sm:p-6 pt-0 sm:pt-0">
                    {currentActiveBattle && (
                      <div
                        className="p-3 sm:p-4 rounded-lg border-2 border-primary bg-primary/5"
                        data-testid={`matchup-current-${currentActiveBattle.id}`}
                      >
                        {/* Mobile: Stacked layout */}
                        <div className="flex flex-col sm:hidden items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-10 h-10 border-2 border-primary">
                              <AvatarImage src={currentActiveBattle.dancerA?.profilePicture || undefined} />
                              <AvatarFallback className="text-sm">{getDancerInitials(currentActiveBattle.dancerA)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-base">{getDancerName(currentActiveBattle.dancerA)}</span>
                          </div>
                          <span className="text-lg font-bold text-muted-foreground">VS</span>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-10 h-10 border-2 border-primary">
                              <AvatarImage src={currentActiveBattle.dancerB?.profilePicture || undefined} />
                              <AvatarFallback className="text-sm">{getDancerInitials(currentActiveBattle.dancerB)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-base">{getDancerName(currentActiveBattle.dancerB)}</span>
                          </div>
                        </div>
                        {/* Desktop: Side by side layout */}
                        <div className="hidden sm:flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-12 h-12 border-2 border-primary">
                              <AvatarImage src={currentActiveBattle.dancerA?.profilePicture || undefined} />
                              <AvatarFallback>{getDancerInitials(currentActiveBattle.dancerA)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-lg">{getDancerName(currentActiveBattle.dancerA)}</span>
                          </div>
                          <span className="text-xl font-bold text-muted-foreground">VS</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-lg">{getDancerName(currentActiveBattle.dancerB)}</span>
                            <Avatar className="w-12 h-12 border-2 border-primary">
                              <AvatarImage src={currentActiveBattle.dancerB?.profilePicture || undefined} />
                              <AvatarFallback>{getDancerInitials(currentActiveBattle.dancerB)}</AvatarFallback>
                            </Avatar>
                          </div>
                        </div>
                        <div className="text-center mt-3 text-xs sm:text-sm text-muted-foreground space-y-1">
                          <div>{isDanceSport ? 'Bracket Round' : 'Round'} {currentActiveBattle.round}</div>
                          {(currentActiveBattle.bestOf || 1) > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                Best of {currentActiveBattle.bestOf || 1}
                              </Badge>
                              <Badge variant="secondary" className="font-mono text-xs">
                                Round {currentActiveBattle.currentRound || 1} | {currentActiveBattle.dancerARoundWins || 0} - {currentActiveBattle.dancerBRoundWins || 0}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upcoming Queue */}
                {upcomingMatchups.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Up Next ({upcomingMatchups.length} waiting)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {upcomingMatchups.slice(0, 3).map((matchup, index) => (
                        <div 
                          key={matchup.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs w-6 h-6 rounded-full p-0 flex items-center justify-center">
                              {index + 1}
                            </Badge>
                            <span>{getDancerName(matchup.dancerA)}</span>
                            <span className="text-muted-foreground text-xs">vs</span>
                            <span>{getDancerName(matchup.dancerB)}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">R{matchup.round}</Badge>
                        </div>
                      ))}
                      {upcomingMatchups.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{upcomingMatchups.length - 3} more in queue
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Voting Interface */}
              {selectedMatchup && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{sportConfig.emoji}</span>
                      <Star className="w-5 h-5" />
                      {isDanceSport ? 'Cast Your Vote' : `Score ${matchLabel}`}
                      {bestOf > 1 && (
                        <Badge variant="secondary" className="ml-auto">
                          {isDanceSport ? 'Round' : 'Set'} {currentBattleRound} of {bestOf}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      {myVote ? (
                        `You've already submitted for ${isDanceSport ? 'Round' : 'Set'} ${currentBattleRound}`
                      ) : (
                        `Select the winner${bestOf > 1 ? ` for ${isDanceSport ? 'Round' : 'Set'} ${currentBattleRound}` : ''}${isDanceSport ? ' and rate their performance' : ''}`
                      )}
                      {bestOf > 1 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-foreground font-medium">
                            Score: {selectedMatchup.dancerARoundWins || 0} - {selectedMatchup.dancerBRoundWins || 0}
                          </span>
                          <span className="text-muted-foreground">
                            (First to {Math.ceil(bestOf / 2)} wins)
                          </span>
                        </div>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {myVote ? (
                      <div className="text-center py-6">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                        <h3 className="font-semibold mb-2">
                          {bestOf > 1 ? `${isDanceSport ? 'Round' : 'Set'} ${currentBattleRound} ${isDanceSport ? 'Vote' : 'Score'} Submitted` : `${isDanceSport ? 'Vote' : 'Score'} Submitted`}
                        </h3>
                        <p className="text-muted-foreground">
                          You {isDanceSport ? 'voted for' : 'scored winner as'}: {
                            myVote.votedForRegistrationId === selectedMatchup.dancerARegistrationId
                              ? getDancerName(selectedMatchup.dancerA)
                              : getDancerName(selectedMatchup.dancerB)
                          }
                        </p>
                        <div className="mt-4 text-sm text-muted-foreground">
                          {isDanceSport ? 'Round' : 'Set'} {currentBattleRound} {isDanceSport ? 'votes' : 'judges'}: {currentRoundVotes.length} / {activeAssignment?.category.judgeCount || 3}
                        </div>
                        {bestOf > 1 && myRoundVotes.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Your {isDanceSport ? 'votes' : 'scores'} this {matchLabel.toLowerCase()}:</p>
                            <div className="flex justify-center gap-2 flex-wrap">
                              {myRoundVotes.map((v) => (
                                <Badge 
                                  key={v.id} 
                                  variant={v.roundNumber === currentBattleRound ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  R{v.roundNumber}: {v.votedForRegistrationId === selectedMatchup.dancerARegistrationId 
                                    ? getDancerName(selectedMatchup.dancerA) 
                                    : getDancerName(selectedMatchup.dancerB)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Dancer Selection */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div
                            onClick={() => setSelectedDancer(selectedMatchup.dancerARegistrationId)}
                            className={`p-2 sm:p-4 rounded-lg border-2 cursor-pointer text-center transition-all ${
                              selectedDancer === selectedMatchup.dancerARegistrationId
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50'
                            }`}
                            data-testid="select-dancer-a-vote"
                          >
                            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2">
                              <AvatarImage src={selectedMatchup.dancerA?.profilePicture || undefined} />
                              <AvatarFallback className="text-sm sm:text-lg">{getDancerInitials(selectedMatchup.dancerA)}</AvatarFallback>
                            </Avatar>
                            <p className="font-semibold text-sm sm:text-base truncate">{getDancerName(selectedMatchup.dancerA)}</p>
                            {selectedDancer === selectedMatchup.dancerARegistrationId && (
                              <Badge className="mt-2 bg-primary text-xs">Selected</Badge>
                            )}
                          </div>
                          <div
                            onClick={() => setSelectedDancer(selectedMatchup.dancerBRegistrationId)}
                            className={`p-2 sm:p-4 rounded-lg border-2 cursor-pointer text-center transition-all ${
                              selectedDancer === selectedMatchup.dancerBRegistrationId
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/50'
                            }`}
                            data-testid="select-dancer-b-vote"
                          >
                            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2">
                              <AvatarImage src={selectedMatchup.dancerB?.profilePicture || undefined} />
                              <AvatarFallback className="text-sm sm:text-lg">{getDancerInitials(selectedMatchup.dancerB)}</AvatarFallback>
                            </Avatar>
                            <p className="font-semibold text-sm sm:text-base truncate">{getDancerName(selectedMatchup.dancerB)}</p>
                            {selectedDancer === selectedMatchup.dancerBRegistrationId && (
                              <Badge className="mt-2 bg-primary text-xs">Selected</Badge>
                            )}
                          </div>
                        </div>

                        {/* Sport-aware Scoring Section */}
                        {selectedDancer && (() => {
                          const sportConfig = getSportConfig(activeAssignment?.category.competitionSport);
                          const judgePanel = sportConfig.judgePanel;

                          // winner_pick: no sliders needed — winner selection above is sufficient
                          if (judgePanel === 'winner') {
                            return (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-center text-sm text-muted-foreground">
                                <span className="text-lg mr-2">{sportConfig.emoji}</span>
                                {sportConfig.label} — select the winner above, then add any notes below.
                              </div>
                            );
                          }

                          // score_entry: enter points for each competitor
                          if (judgePanel === 'score') {
                            return (
                              <div className="space-y-3 pt-4 border-t">
                                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                                  <span>{sportConfig.emoji}</span> {sportConfig.label} — Score Entry
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { name: getDancerName(selectedMatchup.dancerA), key: 'technique' },
                                    { name: getDancerName(selectedMatchup.dancerB), key: 'vocabulary' },
                                  ].map(({ name, key }) => (
                                    <div key={key} className="space-y-1">
                                      <label className="text-xs text-muted-foreground">{name}</label>
                                      <div className="flex items-center gap-1">
                                        <Button size="icon" variant="outline" className="h-7 w-7"
                                          onClick={() => setScores(prev => ({ ...prev, [key]: Math.max(0, (prev[key as keyof typeof scores] ?? 0) - 1) }))}>
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={999}
                                          value={scores[key as keyof typeof scores]}
                                          onChange={e => setScores(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                                          className="text-center h-8 font-bold text-base"
                                        />
                                        <Button size="icon" variant="outline" className="h-7 w-7"
                                          onClick={() => setScores(prev => ({ ...prev, [key]: (prev[key as keyof typeof scores] ?? 0) + 1 }))}>
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          // sets: enter set scores via steppers
                          if (judgePanel === 'sets') {
                            const setsWonA = judgeSets.filter(s => s.a > s.b).length;
                            const setsWonB = judgeSets.filter(s => s.b > s.a).length;
                            return (
                              <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                                  <span>{sportConfig.emoji}</span> {sportConfig.label} — Set Scores
                                </h4>

                                {/* Player names */}
                                <div className="grid grid-cols-2 gap-2 text-sm font-semibold px-1">
                                  <span className="truncate text-center">{getDancerName(selectedMatchup.dancerA)}</span>
                                  <span className="truncate text-center">{getDancerName(selectedMatchup.dancerB)}</span>
                                </div>

                                {/* Per-set stepper rows */}
                                <div className="space-y-3">
                                  {judgeSets.map((set, i) => (
                                    <div key={i} className="space-y-1">
                                      <div className="flex items-center justify-between px-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Set {i + 1}</span>
                                        {judgeSets.length > 1 && (
                                          <button
                                            className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                            onClick={() => removeJudgeSet(i)}
                                          >
                                            <span className="text-xs">✕</span>
                                          </button>
                                        )}
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <ScoreStepper
                                          value={set.a}
                                          onChange={v => updateJudgeSet(i, "a", v)}
                                          highlight={set.a > set.b}
                                          testIdPrefix={`judge-set-${i}-a`}
                                        />
                                        <ScoreStepper
                                          value={set.b}
                                          onChange={v => updateJudgeSet(i, "b", v)}
                                          highlight={set.b > set.a}
                                          testIdPrefix={`judge-set-${i}-b`}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Tally + add set */}
                                <div className="flex items-center justify-between px-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={setsWonA > setsWonB ? "default" : "secondary"} className="text-sm px-3">{setsWonA}</Badge>
                                    <span className="text-xs text-muted-foreground">sets won</span>
                                    <Badge variant={setsWonB > setsWonA ? "default" : "secondary"} className="text-sm px-3">{setsWonB}</Badge>
                                  </div>
                                  <Button size="sm" variant="outline" onClick={addJudgeSet} className="rounded-lg">
                                    <span className="mr-1">+</span> Add Set
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          // dance / boxing: full criteria sliders using sport's own criteria
                          const criteria = sportConfig.criteria.length > 0 ? sportConfig.criteria : [
                            { key: 'technique', label: 'Technique', description: 'Body control and skill' },
                            { key: 'vocabulary', label: 'Vocabulary', description: 'Range of moves' },
                            { key: 'execution', label: 'Execution', description: 'Flow and precision' },
                            { key: 'musicality', label: 'Musicality', description: 'Music interpretation' },
                            { key: 'originality', label: 'Originality', description: 'Creativity and style' },
                          ];

                          const scoreKeyMap: Record<string, keyof typeof scores> = {
                            'techniqueScore': 'technique',
                            'vocabularyScore': 'vocabulary',
                            'executionScore': 'execution',
                            'musicalityScore': 'musicality',
                            'originalityScore': 'originality',
                          };

                          return (
                            <div className="space-y-4 pt-4 border-t">
                              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                                <span>{sportConfig.emoji}</span> Rate Performance (Optional)
                              </h4>
                              {criteria.map((criterion, idx) => {
                                const Icon = CRITERIA_ICONS[idx % CRITERIA_ICONS.length];
                                const scoreKey = scoreKeyMap[criterion.key] || criterion.key.replace('Score', '') as keyof typeof scores;
                                const currentVal = scores[scoreKey] ?? 50;
                                return (
                                  <div key={criterion.key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Icon className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-medium">{criterion.label}</span>
                                      </div>
                                      <span className="text-sm font-bold text-primary">{currentVal}<span className="text-muted-foreground font-normal">/100</span></span>
                                    </div>
                                    <Slider
                                      value={[currentVal]}
                                      onValueChange={([value]) => setScores(prev => ({ ...prev, [scoreKey]: value }))}
                                      max={100}
                                      step={5}
                                      className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">{criterion.description}</p>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Notes */}
                        {selectedDancer && (
                          <div className="space-y-2 pt-4 border-t">
                            <label className="text-sm font-medium">Notes (Optional)</label>
                            <Textarea
                              placeholder={`Add any notes about this ${matchLabel.toLowerCase()}...`}
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              className="min-h-[80px]"
                              data-testid="input-judge-notes"
                            />
                          </div>
                        )}

                        {/* Submit Button */}
                        <Button
                          onClick={handleSubmitVote}
                          disabled={!selectedDancer || submitVoteMutation.isPending}
                          className="w-full gap-2"
                          size="lg"
                          data-testid="button-submit-vote"
                        >
                          {submitVoteMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Vote className="w-4 h-4" />
                              {isDanceSport ? 'Submit Vote' : 'Submit Score'}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {assignment.event.image && (
                      <img 
                        src={assignment.event.image} 
                        alt={assignment.event.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{assignment.event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Category: {assignment.category.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">Judge #{assignment.judgeNumber}</Badge>
                        {assignment.category.useJudgeVoting && (
                          <Badge className="bg-green-500">Voting Enabled</Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/events/${assignment.eventId}`}>View Event</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Vote History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Voting History</CardTitle>
              <CardDescription>Past votes you've cast as a judge</CardDescription>
            </CardHeader>
            <CardContent>
              {completedMatchups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No completed matchups yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedMatchups.map((matchup) => (
                    <div key={matchup.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span>{getDancerName(matchup.dancerA)}</span>
                        <span className="text-muted-foreground">vs</span>
                        <span>{getDancerName(matchup.dancerB)}</span>
                      </div>
                      {matchup.winner && (
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium">{getDancerName(matchup.winner)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
