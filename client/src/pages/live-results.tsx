import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, 
  Loader2, 
  Users, 
  Swords,
  Crown,
  ChevronRight,
  Maximize,
  Minimize,
  RefreshCw,
  Zap,
  CheckCircle,
  Clock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Dancer {
  id: number;
  username?: string;
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

interface Vote {
  id: number;
  matchupId: number;
  roundNumber: number;
  judgeId: number;
  votedForRegistrationId: number;
  judge: {
    id: number;
    username?: string;
    displayName: string | null;
  } | null;
}

interface Category {
  id: number;
  name: string;
  style?: string;
  useJudgeVoting?: boolean;
  judgeCount?: number;
}

interface Event {
  id: number;
  title: string;
  date: string;
  image: string | null;
}

interface LiveState {
  event: Event;
  categories: Category[];
  currentCategory: Category | null;
  competitionSport: string | null;
  matchups: Matchup[];
  currentMatchup: Matchup | null;
  allActiveTables?: Matchup[];
  votes: Vote[];
}

function getRoundName(round: number, totalRounds: number): string {
  const remainingRounds = totalRounds - round;
  if (remainingRounds === 0) return "FINAL";
  if (remainingRounds === 1) return "SEMI-FINAL";
  if (remainingRounds === 2) return "QUARTER-FINAL";
  return `ROUND ${round + 1}`;
}

function getDancerDisplayName(dancer: Dancer | null): string {
  if (!dancer) return "TBD";
  return dancer.displayName || dancer.username || `Dancer #${dancer.id}`;
}

export default function LiveResults() {
  const { eventId, categoryId: urlCategoryId } = useParams<{ eventId: string; categoryId?: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  // Initialize from URL parameter if provided, guard against NaN
  const parsedCategoryId = urlCategoryId ? parseInt(urlCategoryId, 10) : null;
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    parsedCategoryId !== null && !isNaN(parsedCategoryId) ? parsedCategoryId : null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);
  const [lastWinnerId, setLastWinnerId] = useState<number | null>(null);
  const [winnerName, setWinnerName] = useState<string>("");
  const [completedMatchupInfo, setCompletedMatchupInfo] = useState<{
    id: number;
    winnerName: string;
    dancerA: Dancer | null;
    dancerB: Dancer | null;
    round: number;
  } | null>(null);
  const [showingCompletedMatchup, setShowingCompletedMatchup] = useState(false);
  const shownWinnerMatchupIdsRef = useRef<Set<number>>(new Set());
  const previousMatchupsRef = useRef<Matchup[]>([]);

  // WebSocket — instant TT score push (no 1-second polling delay)
  const { messages: wsMessages } = useWebSocket(['TT_SCORE_UPDATE']);
  useEffect(() => {
    if (!wsMessages.length) return;
    const latest = wsMessages[wsMessages.length - 1];
    if (latest.type !== 'TT_SCORE_UPDATE') return;
    const p = latest.payload;
    if (String(p.eventId) !== String(eventId)) return;

    // Patch the cached live-state immediately
    queryClient.setQueryData(
      ['/api/events', eventId, 'live-state', selectedCategoryId],
      (old: LiveState | undefined) => {
        if (!old) return old;
        const updatedMatchups = old.matchups.map((m) => {
          if (m.id !== p.matchupId) return m;
          return {
            ...m,
            liveScoreA: p.liveScoreA,
            liveScoreB: p.liveScoreB,
            dancerARoundWins: p.gamesA,
            dancerBRoundWins: p.gamesB,
            status: p.status,
            winnerRegistrationId: p.winnerRegistrationId,
            scoreData: {
              sets: p.sets,
              gamesA: p.gamesA,
              gamesB: p.gamesB,
              liveScoreA: p.liveScoreA,
              liveScoreB: p.liveScoreB,
              currentSetLog: p.currentSetLog,
              pointLog: p.pointLog,
            },
          };
        });
        const updatedCurrentMatchup =
          old.currentMatchup?.id === p.matchupId
            ? updatedMatchups.find((m) => m.id === p.matchupId) || old.currentMatchup
            : old.currentMatchup;
        return { ...old, matchups: updatedMatchups, currentMatchup: updatedCurrentMatchup };
      }
    );
  }, [wsMessages, eventId, selectedCategoryId]);

  const { data: liveState, isLoading, error, refetch } = useQuery<LiveState>({
    queryKey: ['/api/events', eventId, 'live-state', selectedCategoryId],
    queryFn: async () => {
      const url = selectedCategoryId 
        ? `/api/events/${eventId}/live-state?categoryId=${selectedCategoryId}`
        : `/api/events/${eventId}/live-state`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch live state');
      return response.json();
    },
    enabled: !!eventId,
    refetchInterval: (query) => {
      if (showWinnerAnimation || showingCompletedMatchup) return false;
      const data = query.state.data as LiveState | undefined;
      if (data?.competitionSport === 'TABLE_TENNIS' || data?.competitionSport === 'TABLE_TENNIS_DOUBLES') return 1000;
      return 3000;
    },
  });

  // Track matchup ID to reset winner detection when matchup changes
  const [lastMatchupId, setLastMatchupId] = useState<number | null>(null);
  
  // Watch for completed matchups in the matchups list to detect winners
  useEffect(() => {
    if (!liveState?.matchups) return;
    
    // Skip if we're currently showing an animation
    if (showWinnerAnimation) return;
    
    // Find matchups that just transitioned to COMPLETED with a winner
    // and we haven't shown the animation for yet
    const newlyCompletedMatchup = liveState.matchups.find(m => {
      // Must have a winner and be completed
      if (!m.winnerRegistrationId || m.status !== 'COMPLETED') return false;
      
      // Must not have been shown already
      if (shownWinnerMatchupIdsRef.current.has(m.id)) return false;
      
      // Check if this matchup previously didn't have a winner (just completed)
      // or if it wasn't in our previous state at all
      const prevMatchup = previousMatchupsRef.current.find(pm => pm.id === m.id);
      if (!prevMatchup) return true; // New matchup we haven't seen
      if (!prevMatchup.winnerRegistrationId && m.winnerRegistrationId) return true; // Just got winner
      if (prevMatchup.status !== 'COMPLETED' && m.status === 'COMPLETED') return true; // Just completed
      
      return false;
    });
    
    // Also check if current matchup has a winner that we haven't shown
    const currentMatchup = liveState.currentMatchup;
    const hasCurrentWinner = currentMatchup?.winnerRegistrationId && 
                             currentMatchup.status === 'COMPLETED' &&
                             !shownWinnerMatchupIdsRef.current.has(currentMatchup.id);
    
    const matchupToShow = hasCurrentWinner ? currentMatchup : newlyCompletedMatchup;
    
    if (matchupToShow && matchupToShow.winnerRegistrationId) {
      // Mark this matchup as shown (ref mutation — no re-render, no loop)
      shownWinnerMatchupIdsRef.current = new Set([...shownWinnerMatchupIdsRef.current, matchupToShow.id]);
      
      // Save the completed matchup info for display during winner animation
      setCompletedMatchupInfo({
        id: matchupToShow.id,
        winnerName: getDancerDisplayName(matchupToShow.winner),
        dancerA: matchupToShow.dancerA,
        dancerB: matchupToShow.dancerB,
        round: matchupToShow.round
      });
      setWinnerName(getDancerDisplayName(matchupToShow.winner));
      setShowWinnerAnimation(true);
      setShowingCompletedMatchup(true);
      setLastMatchupId(matchupToShow.id);
      setLastWinnerId(matchupToShow.winnerRegistrationId);
    }
    
    // Update ref for next comparison (no state update → no loop)
    previousMatchupsRef.current = liveState.matchups;
  }, [liveState?.matchups, liveState?.currentMatchup, showWinnerAnimation]);

  // Auto-dismiss winner overlay after 5 seconds, then refresh to show next matchup
  useEffect(() => {
    if (showWinnerAnimation) {
      const timer = setTimeout(() => {
        setShowWinnerAnimation(false);
        setShowingCompletedMatchup(false);
        // Force refetch to get the new active matchup
        refetch();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showWinnerAnimation, refetch]);

  // Only set category from API if no valid URL parameter was provided and no category selected yet
  const hasValidUrlCategory = parsedCategoryId !== null && !isNaN(parsedCategoryId);
  useEffect(() => {
    if (liveState?.currentCategory && selectedCategoryId === null && !hasValidUrlCategory) {
      setSelectedCategoryId(liveState.currentCategory.id);
    }
  }, [liveState?.currentCategory, selectedCategoryId, hasValidUrlCategory]);

  // Reset shown winner matchup IDs when category changes to prevent stale state
  useEffect(() => {
    shownWinnerMatchupIdsRef.current = new Set();
    previousMatchupsRef.current = [];
    setCompletedMatchupInfo(null);
    setShowWinnerAnimation(false);
    setShowingCompletedMatchup(false);
  }, [selectedCategoryId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xl text-muted-foreground">Loading live results...</p>
        </div>
      </div>
    );
  }

  if (error || !liveState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl text-destructive">Failed to load live results</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const { event, categories, currentCategory, competitionSport, matchups, currentMatchup, allActiveTables, votes } = liveState;
  const isTT = competitionSport === 'TABLE_TENNIS' || competitionSport === 'TABLE_TENNIS_DOUBLES';
  const isMultiTableView = isTT && Array.isArray(allActiveTables) && allActiveTables.length > 1;

  // Table Tennis live score extraction
  const ttSD: any = currentMatchup?.scoreData || {};
  const ttSets: {a:number;b:number}[] = Array.isArray(ttSD.sets) ? ttSD.sets : [];
  const ttLiveA = currentMatchup?.liveScoreA ?? 0;
  const ttLiveB = currentMatchup?.liveScoreB ?? 0;
  const ttGamesA = ttSD.gamesA ?? currentMatchup?.dancerARoundWins ?? 0;
  const ttGamesB = ttSD.gamesB ?? currentMatchup?.dancerBRoundWins ?? 0;

  // Multi-round voting support
  const currentBattleRound = currentMatchup?.currentRound || 1;
  const bestOf = currentMatchup?.bestOf || 5;
  const dancerARoundWins = currentMatchup?.dancerARoundWins || 0;
  const dancerBRoundWins = currentMatchup?.dancerBRoundWins || 0;
  const roundsToWin = Math.ceil(bestOf / 2);

  // Filter votes for current round only
  const currentRoundVotes = votes.filter(v => v.roundNumber === currentBattleRound);
  const votesForA = currentRoundVotes.filter(v => v.votedForRegistrationId === currentMatchup?.dancerARegistrationId).length;
  const votesForB = currentRoundVotes.filter(v => v.votedForRegistrationId === currentMatchup?.dancerBRegistrationId).length;
  const totalVotes = votesForA + votesForB;
  const judgeCount = currentCategory?.judgeCount || 5;
  const votingComplete = totalVotes >= judgeCount;

  const totalRounds = Math.max(...matchups.map(m => m.round), 0) + 1;

  const nextMatchup = matchups.find(m => 
    (m.status === 'pending' || m.status === 'PENDING' || m.status === 'SCHEDULED') && 
    m.id !== currentMatchup?.id &&
    m.dancerARegistrationId && 
    m.dancerBRegistrationId
  );

  const completedMatchups = matchups.filter(m => m.status === 'completed' || m.status === 'COMPLETED').length;
  const totalMatchups = matchups.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">
      {/* BIG WINNER ANNOUNCEMENT OVERLAY */}
      {showWinnerAnimation && winnerName && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black/95 via-amber-950/20 to-black/95 backdrop-blur-md"
          data-testid="winner-announcement-overlay"
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-amber-400/30 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          
          {/* Radial glow effect */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] bg-gradient-radial from-amber-500/20 via-orange-500/10 to-transparent rounded-full animate-pulse" />
          </div>

          <div className="text-center relative z-10 animate-in zoom-in-90 slide-in-from-bottom-4 duration-700">
            {/* Decorative top border */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="h-px w-32 bg-gradient-to-r from-transparent via-amber-400/50 to-amber-400" />
              <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
              <div className="h-px w-32 bg-gradient-to-l from-transparent via-amber-400/50 to-amber-400" />
            </div>
            
            {/* Crown with enhanced animation */}
            <div className="mb-8 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 bg-amber-400/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              <Crown className="w-28 h-28 mx-auto text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)] animate-bounce" style={{ animationDuration: '1.5s' }} />
            </div>
            
            {/* Show the battle matchup */}
            {completedMatchupInfo && (
              <div className="mb-8 flex items-center justify-center gap-6 text-2xl animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
                <span className={`transition-all duration-500 ${completedMatchupInfo.winnerName === getDancerDisplayName(completedMatchupInfo.dancerA) 
                  ? "text-amber-400 font-bold scale-110" 
                  : "text-gray-600 line-through opacity-60 scale-90"}`}>
                  {getDancerDisplayName(completedMatchupInfo.dancerA)}
                </span>
                <span className="text-gray-700 text-lg">vs</span>
                <span className={`transition-all duration-500 ${completedMatchupInfo.winnerName === getDancerDisplayName(completedMatchupInfo.dancerB) 
                  ? "text-amber-400 font-bold scale-110" 
                  : "text-gray-600 line-through opacity-60 scale-90"}`}>
                  {getDancerDisplayName(completedMatchupInfo.dancerB)}
                </span>
              </div>
            )}
            
            {/* Winner label with glow */}
            <h1 className="text-4xl font-bold text-amber-400 mb-6 uppercase tracking-[0.3em] drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-in fade-in duration-500 delay-500">
              Winner
            </h1>
            
            {/* Winner name with dramatic entrance */}
            <div className="relative mb-8">
              <h2 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400 drop-shadow-2xl animate-in zoom-in-50 duration-700 delay-700">
                {winnerName}
              </h2>
              {/* Subtle underline glow */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full animate-pulse" />
            </div>
            
            {/* Trophy divider */}
            <div className="flex items-center justify-center gap-6 animate-in fade-in duration-1000 delay-1000">
              <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-amber-400/60 to-amber-400" />
              <Trophy className="w-14 h-14 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]" />
              <div className="h-0.5 w-32 bg-gradient-to-l from-transparent via-amber-400/60 to-amber-400" />
            </div>
            
            {/* Show "Up Next" info if there's a next matchup */}
            {liveState?.matchups && (() => {
              const upcomingMatchups = liveState.matchups.filter(m => 
                m.status !== 'COMPLETED' && 
                m.id !== completedMatchupInfo?.id &&
                m.dancerARegistrationId && 
                m.dancerBRegistrationId
              );
              const nextMatchup = upcomingMatchups[0];
              
              if (nextMatchup) {
                return (
                  <div className="mt-12 pt-8 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-1000" style={{ animationDelay: '1500ms' }}>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <ChevronRight className="w-4 h-4 text-gray-500 animate-pulse" />
                      <p className="text-gray-500 text-sm uppercase tracking-[0.2em]">Up Next</p>
                      <ChevronRight className="w-4 h-4 text-gray-500 animate-pulse" />
                    </div>
                    <p className="text-xl text-white/90">
                      {getDancerDisplayName(nextMatchup.dancerA)} 
                      <span className="text-amber-400 mx-3 font-bold">vs</span> 
                      {getDancerDisplayName(nextMatchup.dancerB)}
                    </p>
                  </div>
                );
              }
              return null;
            })()}
            
            {/* Countdown indicator */}
            <div className="mt-8 flex items-center justify-center gap-2 animate-in fade-in duration-1000" style={{ animationDelay: '2000ms' }}>
              <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-400/60 rounded-full" 
                  style={{ 
                    animation: 'shrink 5s linear forwards',
                    width: '100%'
                  }} 
                />
              </div>
            </div>
          </div>
          
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
              50% { transform: translateY(-20px) rotate(180deg); opacity: 0.6; }
            }
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
        </div>
      )}
      
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Swords className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient-gold">{event.title}</h1>
                <p className="text-sm text-gray-400">Live Results</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {categories.length > 1 && (
              <Select
                value={selectedCategoryId?.toString() || ""}
                onValueChange={(val) => setSelectedCategoryId(parseInt(val))}
              >
                <SelectTrigger className="w-48 bg-white/5 border-white/20 text-white" data-testid="select-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Badge 
              variant="outline" 
              className="bg-white/5 border-white/20 text-gray-300 px-3 py-1"
            >
              {completedMatchups}/{totalMatchups} Completed
            </Badge>

            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => refetch()}
              className="text-gray-400 hover:text-white"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleFullscreen}
              className="text-gray-400 hover:text-white"
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        <main className="p-8">
          {currentCategory && (
            <div className="text-center mb-8">
              <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30 px-6 py-2 text-lg font-semibold">
                {currentCategory.name}
                {currentMatchup && (
                  <span className="ml-3 text-amber-400">
                    {getRoundName(currentMatchup.round, totalRounds)}
                  </span>
                )}
              </Badge>
            </div>
          )}

          {/* ── MULTI-TABLE TT GRID ── shown on projector when multiple tables play simultaneously */}
          {isMultiTableView ? (
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 text-green-400 text-sm uppercase tracking-widest font-semibold">
                  <span className="text-xl">🏓</span>
                  <span>{allActiveTables!.length} Tables Live</span>
                  <span className="text-xl">🏓</span>
                </div>
              </div>
              <div className={`grid gap-4 ${allActiveTables!.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : allActiveTables!.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
                {allActiveTables!.map((m) => {
                  const sd: any = m.scoreData || {};
                  const la = m.liveScoreA ?? 0;
                  const lb = m.liveScoreB ?? 0;
                  const ga = sd.gamesA ?? m.dancerARoundWins ?? 0;
                  const gb = sd.gamesB ?? m.dancerBRoundWins ?? 0;
                  const sets: {a:number;b:number}[] = Array.isArray(sd.sets) ? sd.sets : [];
                  const isDeuce = la >= 10 && lb >= 10;
                  const isGamePt = (la >= 10 || lb >= 10) && !isDeuce;
                  const tableNo = m.tableNumber ?? (allActiveTables!.indexOf(m) + 1);
                  const nameA = m.dancerA?.displayName || m.dancerA?.username || '?';
                  const nameB = m.dancerB?.displayName || m.dancerB?.username || '?';
                  const isCompleted = m.status === 'COMPLETED';
                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl border p-5 space-y-3 transition-all ${isCompleted ? 'border-amber-500/40 bg-amber-500/5' : 'border-green-500/30 bg-white/5 hover:bg-white/8'}`}
                      data-testid={`card-table-${tableNo}`}
                    >
                      {/* Table header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-green-500/20 flex flex-col items-center justify-center">
                            <span className="text-[9px] text-green-400 font-bold uppercase leading-none">TBL</span>
                            <span className="text-base font-black text-green-300 leading-tight">{tableNo}</span>
                          </div>
                          <span className="text-xs text-gray-400">R{m.round} · Bo{m.bestOf || 5} · G{sets.length + 1}</span>
                        </div>
                        {isCompleted ? (
                          <Badge className="bg-amber-500/20 text-amber-300 text-[10px] border-amber-500/30">Done</Badge>
                        ) : (
                          <Badge className="bg-green-600/80 text-white text-[10px] animate-pulse">● LIVE</Badge>
                        )}
                      </div>

                      {/* Players + live score */}
                      <div className="flex items-center gap-2">
                        {/* Player A */}
                        <div className={`flex-1 text-right ${la > lb ? 'text-blue-300' : 'text-gray-400'}`}>
                          <p className="font-bold text-sm truncate">{nameA}</p>
                          <p className="text-xs text-gray-500">Games: {ga}</p>
                        </div>
                        {/* Score block */}
                        <div className="flex flex-col items-center shrink-0 min-w-[80px]">
                          <div className="flex items-center gap-2">
                            <span className={`text-4xl font-black tabular-nums ${la > lb ? 'text-blue-300' : 'text-white/60'}`}>{la}</span>
                            <span className="text-gray-600 text-xl">–</span>
                            <span className={`text-4xl font-black tabular-nums ${lb > la ? 'text-red-300' : 'text-white/60'}`}>{lb}</span>
                          </div>
                          {isDeuce && <span className="text-red-400 text-[10px] font-bold animate-pulse">DEUCE</span>}
                          {isGamePt && <span className="text-amber-400 text-[10px] font-bold">GAME PT</span>}
                        </div>
                        {/* Player B */}
                        <div className={`flex-1 ${lb > la ? 'text-red-300' : 'text-gray-400'}`}>
                          <p className="font-bold text-sm truncate">{nameB}</p>
                          <p className="text-xs text-gray-500">Games: {gb}</p>
                        </div>
                      </div>

                      {/* Set history */}
                      {sets.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {sets.map((s, i) => (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${s.a > s.b ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                              {s.a}–{s.b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : currentMatchup ? (
            <div className="max-w-6xl mx-auto">
              <div className={`grid grid-cols-3 gap-8 items-center ${showWinnerAnimation ? 'animate-pulse' : ''}`}>
                <DancerCard 
                  dancer={currentMatchup.dancerA}
                  votes={votesForA}
                  totalVotes={totalVotes}
                  roundWins={dancerARoundWins}
                  bestOf={bestOf}
                  isWinner={currentMatchup.winnerRegistrationId === currentMatchup.dancerARegistrationId}
                  showWinnerAnimation={showWinnerAnimation && currentMatchup.winnerRegistrationId === currentMatchup.dancerARegistrationId}
                  side="left"
                />

                <div className="flex flex-col items-center justify-center">
                  {isTT ? (
                    /* ── TABLE TENNIS LIVE CENTER DISPLAY ── */
                    <div className="flex flex-col items-center gap-3 w-full">
                      {/* Sport badge */}
                      <div className="flex items-center gap-2 text-green-400">
                        <span className="text-2xl">🏓</span>
                        <span className="text-xs uppercase tracking-widest font-semibold">Live</span>
                      </div>

                      {/* Current game live score — huge */}
                      <div className="flex items-center gap-4">
                        <span className={`text-7xl font-black tabular-nums transition-all duration-150 ${ttLiveA > ttLiveB ? 'text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]' : 'text-white/70'}`}>
                          {ttLiveA}
                        </span>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-600 text-2xl font-light">–</span>
                          {ttLiveA >= 10 && ttLiveB >= 10 && (
                            <span className="text-red-400 text-xs font-bold animate-pulse mt-1">DEUCE</span>
                          )}
                          {(ttLiveA >= 10 || ttLiveB >= 10) && !(ttLiveA >= 10 && ttLiveB >= 10) && (
                            <span className="text-amber-400 text-xs font-bold mt-1">GAME PT</span>
                          )}
                        </div>
                        <span className={`text-7xl font-black tabular-nums transition-all duration-150 ${ttLiveB > ttLiveA ? 'text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.5)]' : 'text-white/70'}`}>
                          {ttLiveB}
                        </span>
                      </div>

                      {/* Game (set) score */}
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <span className="font-black text-blue-400 text-xl">{ttGamesA}</span>
                        <span className="text-gray-600">games</span>
                        <span className="font-black text-red-400 text-xl">{ttGamesB}</span>
                      </div>
                      <div className="text-xs text-gray-500">Best of {bestOf} · Game {ttSets.length + 1}</div>

                      {/* Set history */}
                      {ttSets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                          {ttSets.map((s, i) => (
                            <div key={i} className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${s.a > s.b ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                              {s.a}–{s.b}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                  <>
                  <div className="text-5xl font-black text-gradient-gold mb-4">VS</div>
                  
                  {/* Multi-round score display */}
                  {bestOf > 1 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <span className="text-3xl font-black text-amber-400">{dancerARoundWins}</span>
                        <span className="text-gray-500 text-xl">-</span>
                        <span className="text-3xl font-black text-amber-400">{dancerBRoundWins}</span>
                      </div>
                      <div className="text-center text-sm text-gray-400">
                        Best of {bestOf} | First to {roundsToWin}
                      </div>
                      {/* Round indicators */}
                      <div className="flex justify-center gap-1 mt-2">
                        {Array.from({ length: bestOf }).map((_, i) => {
                          const roundNum = i + 1;
                          const isCurrentRound = roundNum === currentBattleRound;
                          const isCompleted = roundNum < currentBattleRound;
                          return (
                            <div 
                              key={i}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isCurrentRound 
                                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-2 ring-amber-300/50 animate-pulse' 
                                  : isCompleted
                                  ? 'bg-gray-600 text-gray-300'
                                  : 'bg-gray-800 text-gray-500 border border-gray-700'
                              }`}
                            >
                              {roundNum}
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-center text-xs text-gray-500 mt-1">
                        Round {currentBattleRound}
                      </div>
                    </div>
                  )}
                  
                  {currentMatchup.status === 'completed' && currentMatchup.winner ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Crown className="h-6 w-6 text-amber-400" />
                        <span className="text-amber-400 font-bold text-lg">WINNER</span>
                        <Crown className="h-6 w-6 text-amber-400" />
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {getDancerDisplayName(currentMatchup.winner)}
                      </p>
                      {bestOf > 1 && (
                        <p className="text-sm text-gray-400 mt-1">
                          Final Score: {dancerARoundWins} - {dancerBRoundWins}
                        </p>
                      )}
                    </div>
                  ) : currentCategory?.useJudgeVoting ? (
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Users className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-300 font-medium">
                          {bestOf > 1 ? `Round ${currentBattleRound}: ` : ''}{totalVotes} / {judgeCount} votes
                        </span>
                      </div>
                      
                      <div className="flex gap-2 justify-center">
                        {Array.from({ length: judgeCount }).map((_, i) => (
                          <div 
                            key={i}
                            className={`w-4 h-4 rounded-full transition-all duration-300 ${
                              i < totalVotes 
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30' 
                                : 'bg-gray-700 border border-gray-600'
                            }`}
                          />
                        ))}
                      </div>

                      {votingComplete && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {bestOf > 1 ? `Round ${currentBattleRound} Complete` : 'All Votes In'}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Clock className="h-4 w-4 mr-1" />
                      {currentMatchup.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </Badge>
                  )}
                  </>
                  )}
                </div>

                <DancerCard 
                  dancer={currentMatchup.dancerB}
                  votes={votesForB}
                  totalVotes={totalVotes}
                  roundWins={dancerBRoundWins}
                  bestOf={bestOf}
                  isWinner={currentMatchup.winnerRegistrationId === currentMatchup.dancerBRegistrationId}
                  showWinnerAnimation={showWinnerAnimation && currentMatchup.winnerRegistrationId === currentMatchup.dancerBRegistrationId}
                  side="right"
                />
              </div>

              {nextMatchup && (
                <div className="mt-12 pt-8 border-t border-white/10">
                  <div className="flex items-center justify-center gap-4 text-gray-400">
                    <span className="text-sm uppercase tracking-wider">Up Next</span>
                    <ChevronRight className="h-4 w-4" />
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">
                        {getDancerDisplayName(nextMatchup.dancerA)}
                      </span>
                      <span className="text-amber-400 font-bold">vs</span>
                      <span className="text-white font-medium">
                        {getDancerDisplayName(nextMatchup.dancerB)}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-white/20 text-gray-400">
                      {getRoundName(nextMatchup.round, totalRounds)}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto text-center py-20">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-600/20 flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-amber-400" />
              </div>
              <h2 className="text-3xl font-bold mb-4">No Active Battle</h2>
              <p className="text-gray-400 text-lg">
                {matchups.length === 0 
                  ? "Brackets have not been generated yet."
                  : completedMatchups === totalMatchups
                  ? "All battles have been completed!"
                  : "Waiting for the next battle to begin..."
                }
              </p>
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 left-0 right-0 px-6 py-3 border-t border-white/10 backdrop-blur-sm bg-black/30">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Urban Culture Live Results</span>
            <span>Auto-refreshing every 3 seconds</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface DancerCardProps {
  dancer: Dancer | null;
  votes: number;
  totalVotes: number;
  roundWins?: number;
  bestOf?: number;
  isWinner: boolean;
  showWinnerAnimation: boolean;
  side: 'left' | 'right';
}

function DancerCard({ dancer, votes, totalVotes, roundWins = 0, bestOf = 1, isWinner, showWinnerAnimation, side }: DancerCardProps) {
  const votePercentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  
  return (
    <div 
      className={`relative p-8 rounded-2xl transition-all duration-500 ${
        showWinnerAnimation 
          ? 'scale-105 shadow-2xl shadow-amber-500/30' 
          : 'hover:scale-102'
      } ${
        isWinner 
          ? 'bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent border-2 border-amber-500/50' 
          : 'bg-white/5 border border-white/10'
      }`}
    >
      {isWinner && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/30">
            <Crown className="h-4 w-4 text-white" />
            <span className="text-white font-bold text-sm">WINNER</span>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <Avatar className="h-32 w-32 mb-4 border-4 border-white/20 shadow-xl">
          <AvatarImage src={dancer?.profilePicture || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-gray-700 to-gray-800 text-4xl font-bold text-white">
            {getDancerDisplayName(dancer).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h3 className="text-2xl font-bold text-white mb-2">
          {getDancerDisplayName(dancer)}
        </h3>

        {/* Round wins display for multi-round battles */}
        {bestOf > 1 && (
          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: roundWins }).map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full bg-gradient-to-br from-amber-400 to-orange-500"
              />
            ))}
            {Array.from({ length: Math.ceil(bestOf / 2) - roundWins }).map((_, i) => (
              <div 
                key={i}
                className="w-3 h-3 rounded-full bg-gray-700 border border-gray-600"
              />
            ))}
          </div>
        )}

        {totalVotes > 0 && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-black text-gradient-gold">{votes}</span>
              <span className="text-lg text-gray-400">{votePercentage}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  isWinner 
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500' 
                    : 'bg-gradient-to-r from-gray-500 to-gray-400'
                }`}
                style={{ width: `${votePercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
