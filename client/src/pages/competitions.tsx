import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getSportConfig, SPORT_CONFIGS, SPORT_FAMILIES, type SportFamily } from "@/lib/competitionSports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, Search, Calendar, MapPin, Users, Zap, ChevronRight,
  Shield, Star, Clock, Filter,
} from "lucide-react";
import AuthWrapper from "@/components/layout/AuthWrapper";
import { motion, AnimatePresence } from "framer-motion";

interface Competition {
  id: number;
  title: string;
  description: string | null;
  location: string;
  date: string;
  endDate: string | null;
  image: string | null;
  category: string;
  isCompetition: boolean;
  status: string;
  categories: Array<{
    id: number;
    name: string;
    competitionSport: string | null;
    participantLabel: string | null;
    maxDancers: number | null;
    isActive: boolean;
  }>;
  sports: string[];
  participantCount: number;
}

const FAMILY_TABS: { key: SportFamily | 'all'; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '🏆' },
  { key: 'dance', label: 'Dance', emoji: '💃' },
  { key: 'racket', label: 'Racket', emoji: '🏓' },
  { key: 'sport', label: 'Team Sports', emoji: '🏀' },
  { key: 'combat', label: 'Combat', emoji: '🥊' },
  { key: 'mind', label: 'Mind', emoji: '♟️' },
];

function CompetitionCard({ comp, idx }: { comp: Competition; idx: number }) {
  const sports = comp.sports.map(s => getSportConfig(s));
  const primarySport = sports[0];
  const isUpcoming = new Date(comp.date) > new Date();
  const isLive = !isUpcoming && (!comp.endDate || new Date(comp.endDate) > new Date());

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.05 }}
    >
      <Link href={`/events/${comp.id}`}>
        <div className="group bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-border hover:shadow-lg transition-all duration-200 cursor-pointer">
          {/* Image / gradient header */}
          <div className={`relative h-40 bg-gradient-to-br ${primarySport?.color || 'from-primary/40 to-primary/20'} flex items-center justify-center overflow-hidden`}>
            {comp.image ? (
              <img src={comp.image} alt={comp.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Sport badges */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1">
              {sports.slice(0, 3).map(s => (
                <span key={s.key} className="text-xs font-semibold bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                  {s.emoji} {s.label}
                </span>
              ))}
              {sports.length > 3 && (
                <span className="text-xs font-semibold bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                  +{sports.length - 3}
                </span>
              )}
            </div>

            {/* Status */}
            <div className="absolute top-3 right-3">
              {isLive ? (
                <span className="flex items-center gap-1 text-xs font-bold bg-red-500 text-white px-2 py-1 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                  LIVE
                </span>
              ) : isUpcoming ? (
                <span className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground px-2 py-1 rounded-full">
                  <Clock className="h-3 w-3" /> Upcoming
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">
                  <Shield className="h-3 w-3" /> Completed
                </span>
              )}
            </div>

            {/* Big sport emoji */}
            <span className="text-5xl drop-shadow-lg select-none">{primarySport?.emoji || '🏆'}</span>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-bold text-base leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">{comp.title}</h3>
            {comp.description && (
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{comp.description}</p>
            )}
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                {format(new Date(comp.date), 'EEE, MMM d, yyyy · HH:mm')}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span className="truncate">{comp.location}</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <div className="flex items-center gap-1 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{comp.participantCount}</span>
                  <span className="text-muted-foreground">participants</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{comp.categories.length}</span>
                  <span className="text-muted-foreground">categories</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function CompetitionsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<SportFamily | 'all'>('all');

  const { data: competitions = [], isLoading } = useQuery<Competition[]>({
    queryKey: ['/api/competitions'],
    staleTime: 30000,
  });

  const filtered = competitions.filter(c => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase());
    const matchesFamily = familyFilter === 'all' || c.sports.some(s => {
      const cfg = SPORT_CONFIGS[s];
      return cfg?.family === familyFilter;
    });
    return matchesSearch && matchesFamily;
  });

  const upcoming = filtered.filter(c => new Date(c.date) > new Date());
  const past = filtered.filter(c => new Date(c.date) <= new Date());

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-background">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-border/30 pb-6">
          <div className="max-w-4xl mx-auto px-4 pt-8 pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Competitions</h1>
                <p className="text-sm text-muted-foreground">Official tournaments across all disciplines</p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1.5 bg-card border border-border/50 px-3 py-1.5 rounded-xl">
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">{competitions.length}</span>
                <span className="text-muted-foreground">competitions</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border/50 px-3 py-1.5 rounded-xl">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">{upcoming.length}</span>
                <span className="text-muted-foreground">upcoming</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border/50 px-3 py-1.5 rounded-xl">
                <Users className="h-3.5 w-3.5 text-green-500" />
                <span className="font-semibold">{competitions.reduce((s, c) => s + c.participantCount, 0)}</span>
                <span className="text-muted-foreground">participants</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search competitions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-card"
              data-testid="input-search-competitions"
            />
          </div>

          {/* Family filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FAMILY_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFamilyFilter(tab.key as SportFamily | 'all')}
                data-testid={`filter-${tab.key}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                  familyFilter === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
                }`}>
                <span>{tab.emoji}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border/50">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming */}
          {!isLoading && upcoming.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Upcoming Competitions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcoming.map((c, i) => <CompetitionCard key={c.id} comp={c} idx={i} />)}
              </div>
            </section>
          )}

          {/* Past */}
          {!isLoading && past.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" /> Past Competitions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {past.map((c, i) => <CompetitionCard key={c.id} comp={c} idx={i} />)}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-5">
                <Trophy className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No competitions found</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {search ? 'Try a different search term.' : 'No competitions have been set up yet. Check back soon!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AuthWrapper>
  );
}
