import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Users, Zap, MapPin, TrendingUp, Clock, BarChart2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  findMySpot:   { label: "Find My Spot",   color: "#F59E0B", emoji: "✨" },
  spotAgent:    { label: "Spot Agent",     color: "#EC4899", emoji: "🤖" },
  nearbyGuide:  { label: "Nearby Guide",   color: "#10B981", emoji: "🗺️" },
  eventRecommend: { label: "Event AI",     color: "#3B82F6", emoji: "📅" },
  trendingTopics: { label: "Trending",     color: "#8B5CF6", emoji: "🔥" },
};

const CATEGORY_EMOJI: Record<string, string> = {
  dance: "💃", breakdance: "🕺", music: "🎵", skate: "🛹", parkour: "🤸",
  sport: "🏋️", fitness: "💪", museum: "🏛️", art: "🎨", graffiti: "✍️",
  community: "🤝", restaurant: "🍽️", cafe: "☕", other: "📍",
};

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
        style={{ background: `${color}18`, border: `1.5px solid ${color}30` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-black leading-tight" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AIMapAnalytics() {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/admin/ai-analytics"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-analytics"] });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Laden…</span>
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-sm">Geen data beschikbaar. Gebruik de AI map features om te beginnen met tracken.</p>
    </div>
  );

  const featureEntries = Object.entries(data.featureBreakdown || {}) as [string, number][];
  const totalFeatureCalls = featureEntries.reduce((s, [, v]) => s + v, 0);

  const categoryEntries = Object.entries(data.categoryCounts || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10) as [string, number][];

  const dailyEntries = Object.entries(data.dailyCounts || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7) as [string, number][];
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v as number), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-base">AI Map Analytics</h2>
            <p className="text-xs text-muted-foreground">Live usage — reset bij server herstart</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5 rounded-full text-xs h-8">
          <RefreshCw className="w-3.5 h-3.5" /> Vernieuwen
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Zap}        label="Totaal AI calls"  value={data.total}     sub="Alle tijd"   color="#F59E0B" />
        <StatCard icon={TrendingUp} label="Vandaag"          value={data.today}     sub="Last 24h"    color="#10B981" />
        <StatCard icon={Clock}      label="Deze week"        value={data.thisWeek}  sub="Last 7 days" color="#3B82F6" />
        <StatCard icon={Sparkles}   label="Deze maand"       value={data.thisMonth} sub="Last 30 days" color="#8B5CF6" />
      </div>

      {/* Feature breakdown */}
      {featureEntries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            Feature gebruik
          </h3>
          <div className="space-y-2.5">
            {featureEntries
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([feature, count]) => {
                const cfg = FEATURE_LABELS[feature] || { label: feature, color: "#64748B", emoji: "🔧" };
                const pct = totalFeatureCalls > 0 ? Math.round((count / totalFeatureCalls) * 100) : 0;
                return (
                  <div key={feature} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cfg.emoji}</span>
                        <span className="text-xs font-semibold">{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-xs font-bold" style={{ color: cfg.color }}>{count}×</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: cfg.color }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Daily chart */}
      {dailyEntries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Dagelijkse activiteit (7 dagen)
          </h3>
          <div className="flex items-end gap-1.5 h-20">
            {dailyEntries.map(([day, count]) => {
              const h = Math.max(8, Math.round(((count as number) / maxDaily) * 80));
              const d = new Date(day);
              const label = d.toLocaleDateString("nl-NL", { weekday: "short" });
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md transition-all duration-300 bg-gradient-to-t from-blue-600 to-blue-400"
                    style={{ height: `${h}px` }} title={`${day}: ${count} calls`} />
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                  <span className="text-[8px] font-bold text-blue-500">{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top users */}
      {data.topUsers?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-pink-500" />
            Meest actieve gebruikers
          </h3>
          <div className="space-y-2">
            {data.topUsers.slice(0, 10).map((u: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={i === 0 ? { background: "#F59E0B", color: "white" } :
                         i === 1 ? { background: "#94A3B8", color: "white" } :
                         i === 2 ? { background: "#D97706", color: "white" } :
                         { background: "#F1F5F9", color: "#475569" }}>
                  {i + 1}
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{(u.name || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{u.name}</p>
                  {u.lastSeen && (
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(u.lastSeen), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <span className="text-xs font-black text-violet-600 dark:text-violet-400 shrink-0">
                  {u.count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spot category breakdown */}
      {categoryEntries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-500" />
            Spot Agent — populaire categorieën
          </h3>
          <div className="flex flex-wrap gap-2">
            {categoryEntries.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/50 border border-border/60">
                <span className="text-sm">{CATEGORY_EMOJI[cat] || "📍"}</span>
                <span className="text-xs font-semibold capitalize">{cat}</span>
                <span className="text-xs font-black text-muted-foreground">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity log */}
      {data.recentEvents?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            Recente activiteit
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.recentEvents.slice(0, 30).map((e: any) => {
              const cfg = FEATURE_LABELS[e.feature] || { label: e.feature, color: "#64748B", emoji: "🔧" };
              return (
                <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-base shrink-0">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      {e.displayName && <span className="text-muted-foreground font-normal"> · {e.displayName}</span>}
                    </p>
                    {(e.category || e.placeTypes?.length) && (
                      <p className="text-[10px] text-muted-foreground">
                        {e.category || e.placeTypes?.join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.total === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-sm font-semibold">Nog geen activiteit</p>
          <p className="text-xs mt-1">Gebruik Find My Spot of de AI Spot Agent om activiteit te zien.</p>
        </div>
      )}
    </div>
  );
}
