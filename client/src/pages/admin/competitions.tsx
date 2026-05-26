import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { getSportConfig, SPORT_CONFIGS, isDanceSport } from "@/lib/competitionSports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Users, Gavel, Zap, Search, Settings, Eye, ToggleLeft, ToggleRight,
  TrendingUp, CheckCircle, Clock, Shield, ChevronRight, Star, BarChart3,
  Calendar, MapPin, Filter, RefreshCw, ExternalLink, Vote, Activity,
} from "lucide-react";
import { motion } from "framer-motion";

interface CompetitionStats {
  totalCompetitions: number;
  totalParticipants: number;
  totalMatchups: number;
  totalJudges: number;
  sportBreakdown: Record<string, number>;
  competitions: CompWithStats[];
}

interface CompWithStats {
  id: number;
  title: string;
  location: string;
  date: string;
  status: string;
  isCompetition: boolean;
  image: string | null;
  categories: Array<{
    id: number;
    name: string;
    competitionSport: string | null;
    participantLabel: string | null;
    isActive: boolean;
    useJudgeVoting: boolean;
  }>;
  stats: {
    categoryCount: number;
    participantCount: number;
    matchupCount: number;
    completedMatchups: number;
    judgeCount: number;
    voteCount: number;
  };
}

interface PlainEvent {
  id: number;
  title: string;
  location: string;
  date: string;
  status: string;
  isCompetition: boolean | null;
  category: string;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className={`bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-4`}>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

interface LiveState {
  event: { id: number; title: string };
  category: { id: number; name: string; competitionSport: string | null } | null;
  currentMatchup: {
    id: number;
    status: string;
    dancerARegistrationId: number | null;
    dancerBRegistrationId: number | null;
    winnerRegistrationId: number | null;
    round: number;
  } | null;
  matchups: Array<{ id: number; status: string; round: number }>;
  votes: Array<{ id: number; judgeUserId: number; votedForRegistrationId: number }>;
  dancers: {
    dancerA: { displayName?: string; user?: { displayName?: string; username?: string; profileImage?: string | null } } | null;
    dancerB: { displayName?: string; user?: { displayName?: string; username?: string; profileImage?: string | null } } | null;
  } | null;
  judgeCount: number;
}

function LiveMatchupCard({ comp }: { comp: CompWithStats }) {
  const firstCatId = comp.categories[0]?.id;
  const { data: liveState } = useQuery<LiveState>({
    queryKey: [`/api/events/${comp.id}/live-state`, firstCatId],
    queryFn: () => {
      const url = firstCatId
        ? `/api/events/${comp.id}/live-state?categoryId=${firstCatId}`
        : `/api/events/${comp.id}/live-state`;
      return fetch(url).then(r => r.json());
    },
    refetchInterval: 5000,
    enabled: !!firstCatId,
  });

  if (!liveState?.currentMatchup) return null;

  const { currentMatchup, dancers, votes, judgeCount, category } = liveState;
  const sportConfig = getSportConfig(category?.competitionSport);
  const isVoting = currentMatchup.status === 'VOTING';
  const isInProgress = ['IN_PROGRESS', 'in_progress', 'SCHEDULED'].includes(currentMatchup.status) && !isVoting;
  const totalMatchups = liveState.matchups.length;
  const completedCount = liveState.matchups.filter(m => m.status === 'COMPLETED').length;
  const pct = totalMatchups > 0 ? Math.round((completedCount / totalMatchups) * 100) : 0;

  const votesA = votes.filter(v => v.votedForRegistrationId === currentMatchup.dancerARegistrationId).length;
  const votesB = votes.filter(v => v.votedForRegistrationId === currentMatchup.dancerBRegistrationId).length;

  function getDancerImg(dancer: { user?: { profileImage?: string | null } } | null) {
    return dancer?.user?.profileImage || null;
  }
  function initials(name: string) { return name.substring(0, 2).toUpperCase(); }

  const nameA = dancers?.dancerA ? (dancers.dancerA.displayName || dancers.dancerA.user?.displayName || dancers.dancerA.user?.username || 'A') : 'TBD';
  const nameB = dancers?.dancerB ? (dancers.dancerB.displayName || dancers.dancerB.user?.displayName || dancers.dancerB.user?.username || 'B') : 'TBD';

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3" data-testid={`card-live-comp-${comp.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{sportConfig.emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{comp.title}</p>
            <p className="text-xs text-muted-foreground">{category?.name || 'Category'} · Round {currentMatchup.round}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isVoting && (
            <Badge className="bg-green-500 text-white gap-1 animate-pulse text-xs">
              <Vote className="h-3 w-3" /> LIVE
            </Badge>
          )}
          {isInProgress && !isVoting && (
            <Badge variant="outline" className="gap-1 text-xs border-orange-400 text-orange-500">
              <Activity className="h-3 w-3" /> Active
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/events/${comp.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
        <div className="text-center space-y-1">
          <Avatar className="h-9 w-9 mx-auto">
            <AvatarImage src={getDancerImg(dancers?.dancerA) || undefined} />
            <AvatarFallback className="text-xs">{initials(nameA)}</AvatarFallback>
          </Avatar>
          <p className="text-xs font-medium truncate">{nameA}</p>
          {isVoting && judgeCount > 0 && (
            <Badge variant="secondary" className="text-xs">{votesA} vote{votesA !== 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="text-center">
          <span className="text-xs font-bold text-muted-foreground">VS</span>
        </div>
        <div className="text-center space-y-1">
          <Avatar className="h-9 w-9 mx-auto">
            <AvatarImage src={getDancerImg(dancers?.dancerB) || undefined} />
            <AvatarFallback className="text-xs">{initials(nameB)}</AvatarFallback>
          </Avatar>
          <p className="text-xs font-medium truncate">{nameB}</p>
          {isVoting && judgeCount > 0 && (
            <Badge variant="secondary" className="text-xs">{votesB} vote{votesB !== 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      {isVoting && judgeCount > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Votes received</span>
            <span>{votes.length}/{judgeCount}</span>
          </div>
          <Progress value={(votes.length / judgeCount) * 100} className="h-1.5" />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{completedCount}/{totalMatchups} matches done</span>
        <div className="flex items-center gap-1">
          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function LiveResultsPanel({ competitions }: { competitions: CompWithStats[] }) {
  const now = new Date();
  const activeComps = competitions.filter(c => {
    const isPast = new Date(c.date) <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const hasMatchups = c.stats.matchupCount > 0;
    const notComplete = c.stats.completedMatchups < c.stats.matchupCount;
    return isPast && hasMatchups && notComplete && c.categories.length > 0;
  });

  if (activeComps.length === 0) return null;

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4">
      <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-green-500" />
        Live Results
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeComps.map(comp => (
          <LiveMatchupCard key={comp.id} comp={comp} />
        ))}
      </div>
    </div>
  );
}

export default function AdminCompetitionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventsSearch, setEventsSearch] = useState('');

  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery<CompetitionStats>({
    queryKey: ['/api/admin/competitions/stats'],
    staleTime: 10000,
  });

  const { data: allEvents = [], isLoading: loadingEvents } = useQuery<PlainEvent[]>({
    queryKey: ['/api/events'],
    staleTime: 30000,
    enabled: showAddModal,
  });

  const toggleCompetitionMutation = useMutation({
    mutationFn: ({ eventId, isCompetition }: { eventId: number; isCompetition: boolean }) =>
      apiRequest({ url: `/api/admin/events/${eventId}/toggle-competition`, method: 'PATCH', data: { isCompetition } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/competitions/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/competitions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({ title: "Competition status updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const filtered = (stats?.competitions || []).filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase())
  );

  const nonCompEvents = allEvents.filter(e =>
    !e.isCompetition &&
    (!eventsSearch || e.title.toLowerCase().includes(eventsSearch.toLowerCase()))
  );

  const topSports = Object.entries(stats?.sportBreakdown || {})
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Competition Control Centre</h1>
              <p className="text-xs text-muted-foreground">Advanced admin management for all competitions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchStats()} data-testid="button-refresh-stats">
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)} data-testid="button-add-competition">
              <Zap className="h-4 w-4 mr-1.5" /> Mark Event as Competition
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Trophy} label="Total Competitions" value={stats?.totalCompetitions ?? 0} color="bg-primary" />
            <StatCard icon={Users} label="Participants" value={stats?.totalParticipants ?? 0} color="bg-emerald-500" />
            <StatCard icon={Zap} label="Matchups" value={stats?.totalMatchups ?? 0} color="bg-orange-500" />
            <StatCard icon={Gavel} label="Active Judges" value={stats?.totalJudges ?? 0} color="bg-violet-500" />
          </div>
        )}

        {/* Sport breakdown */}
        {topSports.length > 0 && (
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Sport Breakdown
            </h2>
            <div className="flex flex-wrap gap-2">
              {topSports.map(([sport, count]) => {
                const cfg = getSportConfig(sport);
                return (
                  <div key={sport} className={`flex items-center gap-2 bg-gradient-to-r ${cfg.color} text-white px-3 py-1.5 rounded-xl text-sm font-medium`}>
                    <span>{cfg.emoji}</span> {cfg.label} <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search competitions…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-card" data-testid="input-search-admin-competitions" />
        </div>

        {/* Competitions table */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> All Competitions ({filtered.length})
            </h2>
          </div>
          {loadingStats ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No competitions found. Mark events as competitions to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30">
                    <TableHead>Competition</TableHead>
                    <TableHead>Sports</TableHead>
                    <TableHead className="text-center">Cats.</TableHead>
                    <TableHead className="text-center">Participants</TableHead>
                    <TableHead className="text-center">Matchups</TableHead>
                    <TableHead className="text-center">Judges</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(comp => {
                    const sports = comp.categories.map(c => getSportConfig(c.competitionSport));
                    const uniqueSports = [...new Map(sports.map(s => [s.key, s])).values()];
                    const completionPct = comp.stats.matchupCount > 0
                      ? Math.round((comp.stats.completedMatchups / comp.stats.matchupCount) * 100)
                      : 0;
                    const isUpcoming = new Date(comp.date) > new Date();
                    return (
                      <TableRow key={comp.id} className="border-border/20 hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${uniqueSports[0]?.color || 'from-primary/30 to-primary/10'} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-sm">{uniqueSports[0]?.emoji || '🏆'}</span>
                            </div>
                            <div>
                              <p className="font-medium text-sm leading-tight line-clamp-1">{comp.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{comp.location.slice(0, 30)}{comp.location.length > 30 ? '…' : ''}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />{format(new Date(comp.date), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {uniqueSports.slice(0, 2).map(s => (
                              <span key={s.key} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{s.emoji} {s.label}</span>
                            ))}
                            {uniqueSports.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{uniqueSports.length - 2}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{comp.stats.categoryCount}</TableCell>
                        <TableCell className="text-center font-semibold">{comp.stats.participantCount}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-semibold text-sm">{comp.stats.completedMatchups}/{comp.stats.matchupCount}</span>
                            {comp.stats.matchupCount > 0 && (
                              <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${completionPct}%` }} />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{comp.stats.judgeCount}</TableCell>
                        <TableCell className="text-center">
                          {isUpcoming ? (
                            <Badge variant="outline" className="text-xs border-blue-300 text-blue-600 dark:text-blue-400">
                              <Clock className="h-3 w-3 mr-1" /> Upcoming
                            </Badge>
                          ) : completionPct === 100 ? (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" /> Complete
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 dark:text-orange-400">
                              <Zap className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/events/${comp.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => toggleCompetitionMutation.mutate({ eventId: comp.id, isCompetition: false })}
                              disabled={toggleCompetitionMutation.isPending}
                              title="Remove competition flag">
                              <ToggleLeft className="h-4 w-4" />
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

        {/* Live Results Panel */}
        {stats?.competitions && stats.competitions.length > 0 && (
          <LiveResultsPanel competitions={stats.competitions} />
        )}

        {/* Judge assignments summary */}
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" /> Judge Panel Notes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">💃</span>
              <div>
                <p className="font-medium">Dance Sports</p>
                <p className="text-xs text-muted-foreground">Full 5-criteria judge panel: Technique, Vocabulary, Execution, Musicality, Originality (1–10 scale)</p>
              </div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">🏓</span>
              <div>
                <p className="font-medium">Racket & Team Sports</p>
                <p className="text-xs text-muted-foreground">Set/score entry panel — enter the score for each set or game directly</p>
              </div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">🥊</span>
              <div>
                <p className="font-medium">Boxing</p>
                <p className="text-xs text-muted-foreground">Round-by-round criteria scoring: Clean Punching, Aggression, Defense, Ring Generalship</p>
              </div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl">💪</span>
              <div>
                <p className="font-medium">Combat & Mind Sports</p>
                <p className="text-xs text-muted-foreground">Direct winner selection with optional notes</p>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/judge-panel">
                <Gavel className="h-4 w-4 mr-1.5" /> Open Judge Panel
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Add competition dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Mark Event as Competition</DialogTitle>
            <DialogDescription>
              Select an existing event to designate it as a competition. This enables bracket management, judge assignment, and live scoring.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search events…" value={eventsSearch} onChange={e => setEventsSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {loadingEvents ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)
            ) : nonCompEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">All events are already marked as competitions</p>
            ) : nonCompEvents.map(ev => (
              <button key={ev.id}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 text-left transition-colors"
                onClick={() => {
                  toggleCompetitionMutation.mutate({ eventId: ev.id, isCompetition: true });
                  setShowAddModal(false);
                }}
                data-testid={`event-option-${ev.id}`}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{ev.location.slice(0, 35)}{ev.location.length > 35 ? '…' : ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">{ev.category}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
