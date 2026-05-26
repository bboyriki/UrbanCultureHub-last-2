import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users, Zap, Loader2, Crown, Swords, ChevronRight, Vote, Settings2, Clock } from "lucide-react";
import { getSportConfig } from "@/lib/competitionSports";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { LiveVoting } from "./LiveVoting";
import { useAuth } from "@/contexts/AuthContext";

interface Dancer {
  id: number;
  username: string;
  displayName: string | null;
  profilePicture: string | null;
  isExternal?: boolean;
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
  dancerA: Dancer | null;
  dancerB: Dancer | null;
  winner: Dancer | null;
  bestOf: number;
  dancerARoundWins?: number;
  dancerBRoundWins?: number;
}

interface BracketVisualizationProps {
  eventId: number;
  categoryId: number;
  isOrganizer: boolean;
}

export function BracketVisualization({ eventId, categoryId, isOrganizer }: BracketVisualizationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedMatchup, setSelectedMatchup] = useState<Matchup | null>(null);
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [showVotingDialog, setShowVotingDialog] = useState(false);
  const [votingMatchup, setVotingMatchup] = useState<Matchup | null>(null);

  const { data: matchups = [], isLoading } = useQuery<Matchup[]>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`],
  });
  
  const { data: category } = useQuery<{ id: number; useJudgeVoting: boolean; judgeCount: number; competitionSport: string | null }>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}`],
  });

  const { data: registrations = [] } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}/registrations`],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/events/${eventId}/categories/${categoryId}/generate-brackets`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: "Brackets generated successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate brackets", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateResultMutation = useMutation({
    mutationFn: async ({ matchupId, winnerId }: { matchupId: number; winnerId: number }) => {
      return apiRequest(`/api/matchups/${matchupId}/result`, "PUT", { winnerRegistrationId: winnerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: "Winner declared! Advancing to next round." });
      setSelectedMatchup(null);
      setWinnerId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update result", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateBestOfMutation = useMutation({
    mutationFn: async ({ matchupId, bestOf }: { matchupId: number; bestOf: number }) => {
      return apiRequest(`/api/matchups/${matchupId}`, "PATCH", { bestOf });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: "Battle format updated successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update battle format", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleBestOfChange = (matchupId: number, value: string) => {
    const bestOf = parseInt(value, 10);
    if (!isNaN(bestOf)) {
      updateBestOfMutation.mutate({ matchupId, bestOf });
    }
  };

  const handleDeclareWinner = () => {
    if (selectedMatchup && winnerId) {
      updateResultMutation.mutate({ matchupId: selectedMatchup.id, winnerId });
    }
  };

  const openMatchupDialog = (matchup: Matchup) => {
    if (!isOrganizer || matchup.status === 'COMPLETED') return;
    if (!matchup.dancerARegistrationId && !matchup.dancerBRegistrationId) return;
    setSelectedMatchup(matchup);
    if (matchup.dancerARegistrationId && !matchup.dancerBRegistrationId) {
      setWinnerId(matchup.dancerARegistrationId);
    } else if (!matchup.dancerARegistrationId && matchup.dancerBRegistrationId) {
      setWinnerId(matchup.dancerBRegistrationId);
    } else {
      setWinnerId(matchup.winnerRegistrationId);
    }
  };

  const isByeMatchup = (matchup: Matchup) => {
    return (matchup.dancerARegistrationId && !matchup.dancerBRegistrationId) ||
           (!matchup.dancerARegistrationId && matchup.dancerBRegistrationId);
  };

  const getDancerName = (dancer: Dancer | null) => {
    if (!dancer) return "TBD";
    return dancer.displayName || dancer.username;
  };

  const getDancerInitials = (dancer: Dancer | null) => {
    if (!dancer) return "?";
    const name = dancer.displayName || dancer.username;
    return name.substring(0, 2).toUpperCase();
  };

  const sportConfig = getSportConfig(category?.competitionSport);
  const participantLabel = sportConfig.participantLabel;
  const participantLabelPlural = sportConfig.participantLabelPlural;
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const matchupsByRound = matchups.reduce((acc, matchup) => {
    if (!acc[matchup.round]) {
      acc[matchup.round] = [];
    }
    acc[matchup.round].push(matchup);
    return acc;
  }, {} as Record<number, Matchup[]>);

  const rounds = Object.keys(matchupsByRound).map(Number).sort((a, b) => a - b);
  const maxRound = Math.max(...rounds, 0);

  const getRoundName = (round: number) => {
    const matchupsInRound = matchupsByRound[round]?.length || 0;
    const matchesRemaining = matchupsInRound * 2; // Each matchup has 2 dancers
    
    // Last round is always Finals
    if (round === maxRound && matchupsInRound === 1) return "Finals";
    
    // Semifinals: 4 dancers (2 matchups)
    if (matchupsInRound === 2) return "Semifinals";
    
    // Quarterfinals: 8 dancers (4 matchups)
    if (matchupsInRound === 4) return "Quarterfinals";
    
    // For other rounds, show "Round of X"
    return `Round of ${matchesRemaining}`;
  };

  const isFinal = (round: number) => round === maxRound && (matchupsByRound[round]?.length || 0) === 1;

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading bracket...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confirmedCount = registrations.filter((r: any) => r.status === 'CONFIRMED').length;

  if (matchups.length === 0) {
    return (
      <Card className="border-2 border-dashed bg-gradient-to-br from-background to-muted/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Swords className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {sportConfig.emoji} Tournament Bracket
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confirmedCount >= 2 ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">
                    {confirmedCount} {confirmedCount === 1 ? capitalize(participantLabel) : capitalize(participantLabelPlural)} Ready
                  </span>
                </div>
                <p className="text-muted-foreground max-w-sm">
                  All participants are registered. Generate the bracket to start the tournament!
                </p>
              </div>
              {isOrganizer && (
                <Button
                  size="lg"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="gap-2"
                  data-testid="button-generate-brackets"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate Tournament Bracket
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-muted-foreground">
                  Need at least 2 confirmed registrations
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Currently: {confirmedCount} registered
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const champion = matchups.find(m => isFinal(m.round) && m.status === 'COMPLETED')?.winner;

  const MatchupCard = ({ matchup, size = "normal" }: { matchup: Matchup; size?: "normal" | "compact" }) => {
    const hasBothDancers = matchup.dancerARegistrationId && matchup.dancerBRegistrationId;
    const isBye = isByeMatchup(matchup);
    const isVoting = matchup.status === 'VOTING';
    const isInProgress = matchup.status === 'IN_PROGRESS';
    const isCurrentActive = isVoting || isInProgress;
    const hasWinner = matchup.status === 'COMPLETED';
    const useJudgeVoting = category?.useJudgeVoting && hasBothDancers;
    const sportFormat = sportConfig.format;
    const needsVotingPanel = (useJudgeVoting || sportFormat === 'score_entry' || sportFormat === 'sets') && hasBothDancers;
    const isClickable = isOrganizer && !hasWinner && (hasBothDancers || isBye);
    const isVotingClickable = needsVotingPanel && (isVoting || (!hasWinner && hasBothDancers));
    const isLastRound = isFinal(matchup.round);
    const isCompact = size === "compact";

    const handleClick = () => {
      if (needsVotingPanel && hasBothDancers && !hasWinner) {
        setVotingMatchup(matchup);
        setShowVotingDialog(true);
      } else {
        openMatchupDialog(matchup);
      }
    };

    return (
      <Card 
        className={`transition-colors duration-200 ${
          isClickable || isVotingClickable ? 'cursor-pointer border-primary/40 active:bg-primary/5' : ''
        } ${hasWinner ? 'bg-muted/30' : ''} ${isLastRound ? 'border-primary/50' : ''} ${isCurrentActive ? 'ring-2 ring-green-500/50 border-green-500/50 bg-gradient-to-br from-green-500/5 to-transparent' : ''} ${isVoting ? 'animate-pulse' : ''}`}
        onClick={handleClick}
        data-testid={`card-matchup-${matchup.id}`}
      >
        <CardContent className={`${isCompact ? 'p-2.5' : 'p-3'} space-y-2`}>
          <div 
            className={`flex items-center gap-2 ${isCompact ? 'p-1.5' : 'p-2'} rounded-md transition-colors ${
              matchup.winnerRegistrationId === matchup.dancerARegistrationId 
                ? 'bg-gradient-to-r from-primary/20 to-primary/10' 
                : matchup.winnerRegistrationId && matchup.winnerRegistrationId !== matchup.dancerARegistrationId
                ? 'opacity-50'
                : 'bg-muted/50'
            }`}
          >
            <Avatar className={`${isCompact ? 'w-7 h-7' : 'w-8 h-8'} border border-border shrink-0`}>
              <AvatarImage src={matchup.dancerA?.profilePicture || undefined} />
              <AvatarFallback className="text-xs">{getDancerInitials(matchup.dancerA)}</AvatarFallback>
            </Avatar>
            <span className={`flex-1 font-medium ${isCompact ? 'text-sm' : 'text-sm'} truncate`}>
              {getDancerName(matchup.dancerA)}
            </span>
            {matchup.winnerRegistrationId === matchup.dancerARegistrationId && (
              <Trophy className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-bold text-muted-foreground px-1">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div 
            className={`flex items-center gap-2 ${isCompact ? 'p-1.5' : 'p-2'} rounded-md transition-colors ${
              matchup.winnerRegistrationId === matchup.dancerBRegistrationId 
                ? 'bg-gradient-to-r from-primary/20 to-primary/10' 
                : matchup.winnerRegistrationId && matchup.winnerRegistrationId !== matchup.dancerBRegistrationId
                ? 'opacity-50'
                : 'bg-muted/50'
            }`}
          >
            <Avatar className={`${isCompact ? 'w-7 h-7' : 'w-8 h-8'} border border-border shrink-0`}>
              <AvatarImage src={matchup.dancerB?.profilePicture || undefined} />
              <AvatarFallback className="text-xs">{getDancerInitials(matchup.dancerB)}</AvatarFallback>
            </Avatar>
            <span className={`flex-1 font-medium ${isCompact ? 'text-sm' : 'text-sm'} truncate`}>
              {getDancerName(matchup.dancerB)}
            </span>
            {matchup.winnerRegistrationId === matchup.dancerBRegistrationId && (
              <Trophy className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>

          {isOrganizer && hasBothDancers && !hasWinner && (
            <div 
              className="flex items-center justify-center gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Settings2 className="w-3 h-3 text-muted-foreground" />
              <Select 
                value={String(matchup.bestOf || 1)} 
                onValueChange={(value) => handleBestOfChange(matchup.id, value)}
              >
                <SelectTrigger 
                  className="h-7 w-24 text-xs"
                  data-testid={`select-bestof-${matchup.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Round</SelectItem>
                  <SelectItem value="3">Best of 3</SelectItem>
                  <SelectItem value="5">Best of 5</SelectItem>
                  <SelectItem value="7">Best of 7</SelectItem>
                  <SelectItem value="9">Best of 9</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {hasBothDancers && !hasWinner && (matchup.dancerARoundWins || matchup.dancerBRoundWins) && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>{matchup.dancerARoundWins || 0}</span>
              <span>-</span>
              <span>{matchup.dancerBRoundWins || 0}</span>
              <span className="text-xs">({matchup.bestOf || 1} rounds)</span>
            </div>
          )}

          <div className="flex justify-center pt-1">
            {/* MATCH-BY-MATCH: Show LIVE for active battles (IN_PROGRESS or VOTING) */}
            {isCurrentActive && (
              <Badge className="text-xs gap-1 bg-green-500">
                <Vote className="w-3 h-3" />
                {isVoting ? 'Voting Live' : 'LIVE'}
              </Badge>
            )}
            {/* Show "Waiting" for scheduled matchups with both dancers */}
            {!isCurrentActive && !hasWinner && hasBothDancers && matchup.status === 'SCHEDULED' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Clock className="w-3 h-3" />
                In Queue
              </Badge>
            )}
            {!isCurrentActive && needsVotingPanel && hasBothDancers && !hasWinner && matchup.status !== 'SCHEDULED' && (
              <Badge variant="outline" className="text-xs gap-1">
                {useJudgeVoting ? <Vote className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {useJudgeVoting ? 'Tap to vote' : sportFormat === 'sets' ? 'Enter sets' : sportFormat === 'score_entry' ? 'Enter score' : 'Enter result'}
              </Badge>
            )}
            {!needsVotingPanel && isClickable && isBye && (
              <Badge variant="outline" className="text-xs gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                <ChevronRight className="w-3 h-3" />
                BYE
              </Badge>
            )}
            {!needsVotingPanel && isClickable && !isBye && !isCurrentActive && (
              <Badge variant="outline" className="text-xs gap-1">
                <ChevronRight className="w-3 h-3" />
                Tap to set winner
              </Badge>
            )}
            {hasWinner && (
              <Badge className="text-xs">Complete</Badge>
            )}
            {!hasWinner && !isClickable && !isVotingClickable && !matchup.dancerARegistrationId && !matchup.dancerBRegistrationId && (
              <Badge variant="secondary" className="text-xs">Awaiting</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-bold">
                {sportConfig.emoji} Tournament Bracket
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">{matchups.length} matches · {sportConfig.label}</p>
            </div>
          </div>
          {isOrganizer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-regenerate-brackets"
            >
              {generateMutation.isPending ? "..." : "Regenerate"}
            </Button>
          )}
        </div>

        {champion && (
          <Card className="bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 border-yellow-500/30">
            <CardContent className="py-4 md:py-6">
              <div className="flex flex-col items-center gap-3 md:gap-4">
                <div className="relative">
                  <div className="absolute -top-2 md:-top-3 left-1/2 -translate-x-1/2">
                    <Crown className="w-6 h-6 md:w-8 md:h-8 text-yellow-500 drop-shadow-lg" />
                  </div>
                  <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-yellow-500/50 shadow-xl">
                    <AvatarImage src={champion.profilePicture || undefined} />
                    <AvatarFallback className="text-xl md:text-2xl bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
                      {getDancerInitials(champion)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="text-center">
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white mb-2">
                    Champion
                  </Badge>
                  <h4 className="text-lg md:text-xl font-bold">{getDancerName(champion)}</h4>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="md:hidden space-y-4">
          {rounds.map((round) => {
            const roundMatchups = matchupsByRound[round] || [];
            const isLastRound = isFinal(round);
            
            return (
              <div key={round} className="space-y-2">
                <div className={`flex items-center gap-2 pb-2 border-b-2 ${isLastRound ? 'border-primary' : 'border-border'}`}>
                  <Badge 
                    variant={isLastRound ? "default" : "secondary"}
                    className={isLastRound ? "bg-primary" : ""}
                  >
                    {getRoundName(round)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">({roundMatchups.length} matches)</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {roundMatchups.map((matchup) => (
                    <MatchupCard key={matchup.id} matchup={matchup} size="compact" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {rounds.map((round, roundIndex) => {
              const roundMatchups = matchupsByRound[round] || [];
              const isLastRound = isFinal(round);
              
              return (
                <div key={round} className="flex flex-col min-w-[200px] lg:min-w-[220px]">
                  <div className={`text-center mb-4 pb-2 border-b-2 ${isLastRound ? 'border-primary' : 'border-border'}`}>
                    <Badge 
                      variant={isLastRound ? "default" : "secondary"}
                      className={isLastRound ? "bg-primary" : ""}
                    >
                      {getRoundName(round)}
                    </Badge>
                  </div>
                  <div 
                    className="flex flex-col justify-around flex-1 gap-4"
                    style={{ 
                      paddingTop: roundIndex > 0 ? `${Math.pow(2, roundIndex) * 20}px` : '0',
                      paddingBottom: roundIndex > 0 ? `${Math.pow(2, roundIndex) * 20}px` : '0'
                    }}
                  >
                    {roundMatchups.map((matchup, matchupIndex) => (
                      <div 
                        key={matchup.id} 
                        className="relative"
                        style={{ 
                          marginTop: matchupIndex > 0 && roundIndex > 0 ? `${Math.pow(2, roundIndex) * 40}px` : '0'
                        }}
                      >
                        {roundIndex < rounds.length - 1 && (
                          <div className="absolute right-0 top-1/2 w-4 h-0.5 bg-border -translate-y-1/2 translate-x-full" />
                        )}
                        <MatchupCard matchup={matchup} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isOrganizer && selectedMatchup && (
        <Dialog open={!!selectedMatchup} onOpenChange={() => setSelectedMatchup(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                {isByeMatchup(selectedMatchup) ? "Advance BYE Winner" : "Declare Match Winner"}
              </DialogTitle>
              <DialogDescription>
                {isByeMatchup(selectedMatchup) 
                  ? "This is a BYE matchup. The participant will automatically advance to the next round."
                  : "Select the winner to advance them to the next round"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid gap-3">
                {selectedMatchup.dancerARegistrationId && (
                  <div
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      winnerId === selectedMatchup.dancerARegistrationId
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    }`}
                    onClick={() => setWinnerId(selectedMatchup.dancerARegistrationId)}
                    data-testid="select-dancer-a"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={selectedMatchup.dancerA?.profilePicture || undefined} />
                      <AvatarFallback>{getDancerInitials(selectedMatchup.dancerA)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{getDancerName(selectedMatchup.dancerA)}</p>
                      <p className="text-sm text-muted-foreground">Tap to select as winner</p>
                    </div>
                    {winnerId === selectedMatchup.dancerARegistrationId && (
                      <Trophy className="w-6 h-6 text-primary" />
                    )}
                  </div>
                )}

                {selectedMatchup.dancerBRegistrationId && (
                  <div
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      winnerId === selectedMatchup.dancerBRegistrationId
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    }`}
                    onClick={() => setWinnerId(selectedMatchup.dancerBRegistrationId)}
                    data-testid="select-dancer-b"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={selectedMatchup.dancerB?.profilePicture || undefined} />
                      <AvatarFallback>{getDancerInitials(selectedMatchup.dancerB)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{getDancerName(selectedMatchup.dancerB)}</p>
                      <p className="text-sm text-muted-foreground">Tap to select as winner</p>
                    </div>
                    {winnerId === selectedMatchup.dancerBRegistrationId && (
                      <Trophy className="w-6 h-6 text-primary" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMatchup(null)}
                  data-testid="button-cancel-winner"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeclareWinner}
                  disabled={!winnerId || updateResultMutation.isPending}
                  className="gap-2"
                  data-testid="button-save-winner"
                >
                  {updateResultMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Advancing...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4" />
                      {isByeMatchup(selectedMatchup) ? 'Advance' : 'Declare Winner'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {votingMatchup && (
        <Dialog open={showVotingDialog} onOpenChange={(open) => {
          setShowVotingDialog(open);
          if (!open) setVotingMatchup(null);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vote className="w-5 h-5 text-primary" />
                Live Voting
              </DialogTitle>
              <DialogDescription>
                {votingMatchup.status === 'VOTING' 
                  ? 'Judges are voting on this matchup' 
                  : 'View or start voting for this matchup'}
              </DialogDescription>
            </DialogHeader>
            <LiveVoting
              matchup={votingMatchup}
              eventId={eventId}
              categoryId={categoryId}
              competitionSport={category?.competitionSport ?? null}
              currentUserId={user?.id}
              isOrganizer={isOrganizer}
              onVoteComplete={() => {
                setShowVotingDialog(false);
                setVotingMatchup(null);
                queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
