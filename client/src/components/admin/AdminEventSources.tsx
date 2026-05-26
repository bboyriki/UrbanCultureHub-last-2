import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  RefreshCw, CheckCircle, XCircle, Clock, Trash2, ExternalLink,
  Info, Zap, Archive, CalendarCheck, Wifi, WifiOff, Play, Link, AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow, formatDistance } from "date-fns";
import { nl } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────────
interface SourceStatus {
  configured: boolean;
  hasKey: boolean;
  keyPreview?: string | null;
  lastSync?: string | null;
  eventCount?: number;
}
interface SourcesStatus {
  eventbrite: SourceStatus;
  ticketmaster: SourceStatus;
  meetup: SourceStatus;
}
interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  isConfigured: boolean;
  message: string;
}
interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  lastSync: string | null;
  nextSync: string | null;
  lastArchive: string | null;
  lastArchiveCount: number;
  totalSynced: number;
  totalArchived: number;
  syncIntervalHours: number;
  recentLogs: Array<{ source: string; synced: number; skipped: number; errors: string[]; at: string }>;
}

// ── Source config ──────────────────────────────────────────────────────────────
const SOURCE_CONFIG = [
  {
    id: "eventbrite",
    name: "Eventbrite",
    icon: "🎟",
    color: "orange",
    description: "Importeer specifieke Eventbrite evenementen via URL — de publieke zoek-API is in 2023 stopgezet",
    setupUrl: "https://www.eventbrite.com/platform/api-keys",
    envVar: "EVENTBRITE_API_KEY",
    free: true,
    comingSoon: false,
    apiDeprecated: true,
  },
  {
    id: "ticketmaster",
    name: "Ticketmaster",
    icon: "🎫",
    color: "blue",
    description: "Concerten en grote events via Ticketmaster Discovery API (gratis)",
    setupUrl: "https://developer.ticketmaster.com/products-and-docs/apis/getting-started/",
    envVar: "TICKETMASTER_API_KEY",
    free: true,
    comingSoon: false,
    apiDeprecated: false,
  },
  {
    id: "meetup",
    name: "Meetup",
    icon: "📍",
    color: "red",
    description: "Community-evenementen en kleinschalige bijeenkomsten via Meetup",
    setupUrl: "https://www.meetup.com/api/general/",
    envVar: "MEETUP_API_KEY",
    free: false,
    comingSoon: true,
    apiDeprecated: false,
  },
] as const;

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(targetISO: string | null): string {
  const [label, setLabel] = useState("–");
  useEffect(() => {
    if (!targetISO) { setLabel("–"); return; }
    const tick = () => {
      const diff = new Date(targetISO).getTime() - Date.now();
      if (diff <= 0) { setLabel("Nu bezig…"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}u ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return label;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminEventSources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncingSource, setSyncingSource] = useState<string | null>(null);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, SyncResult>>({});
  const [ebUrl, setEbUrl] = useState("");
  const [ebImportResult, setEbImportResult] = useState<{ message: string; ok: boolean } | null>(null);

  const { data: sources, isLoading: sourcesLoading } = useQuery<SourcesStatus>({
    queryKey: ["/api/admin/events/sources/status"],
    refetchInterval: 30000,
  });

  const { data: scheduler, refetch: refetchScheduler } = useQuery<SchedulerStatus>({
    queryKey: ["/api/admin/events/scheduler/status"],
    refetchInterval: 10000,
  });

  const countdown = useCountdown(scheduler?.nextSync ?? null);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const syncNowMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/events/scheduler/sync-now", "POST").then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "✅ Auto-sync gestart", description: "Ticketmaster + Eventbrite worden gesynchroniseerd" });
    },
    onError: (err: any) => toast({ title: "Sync mislukt", description: err.message, variant: "destructive" }),
  });

  const archiveNowMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/events/scheduler/archive-now", "POST").then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/scheduler/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: `📦 ${data.archived} evenementen gearchiveerd` });
    },
    onError: (err: any) => toast({ title: "Archiveren mislukt", description: err.message, variant: "destructive" }),
  });

  const toggleSchedulerMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("/api/admin/events/scheduler/toggle", "POST", { enabled }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/scheduler/status"] });
      toast({ title: data.enabled ? "▶ Scheduler geactiveerd" : "⏸ Scheduler gepauzeerd" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (source: string) => {
      const res = await apiRequest(`/api/admin/events/sync/${source}`, "POST");
      return res.json() as Promise<SyncResult>;
    },
    onSuccess: (data, source) => {
      setLastResults(prev => ({ ...prev, [source]: data }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/sources/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: data.isConfigured
          ? (data.synced > 0 ? `✅ ${data.synced} evenementen gesynchroniseerd` : "Sync voltooid")
          : "API sleutel niet geconfigureerd",
        description: data.message,
        variant: data.isConfigured ? "default" : "destructive",
      });
      setSyncingSource(null);
    },
    onError: (err: any) => {
      toast({ title: "Sync mislukt", description: err.message, variant: "destructive" });
      setSyncingSource(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (source: string) => {
      const res = await apiRequest(`/api/admin/events/source/${source}`, "DELETE");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/sources/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: `🗑 ${data.deleted} evenementen verwijderd` });
      setDeletingSource(null);
    },
    onError: (err: any) => {
      toast({ title: "Verwijderen mislukt", description: err.message, variant: "destructive" });
      setDeletingSource(null);
    },
  });

  const ebImportMutation = useMutation({
    mutationFn: (input: string) => {
      const parts = input.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
      const body = parts.length === 1 ? { url: parts[0] } : { urls: parts };
      return apiRequest("/api/admin/events/import/eventbrite-url", "POST", body).then(r => r.json());
    },
    onSuccess: (data: any) => {
      setEbImportResult({ message: data.message, ok: true });
      setEbUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events/sources/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: data.message });
    },
    onError: (err: any) => {
      const msg = err.message || "Import mislukt";
      setEbImportResult({ message: msg, ok: false });
      toast({ title: "Import mislukt", description: msg, variant: "destructive" });
    },
  });

  const colorMap: Record<string, string> = {
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800",
    blue:   "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
    red:    "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800",
  };
  const badgeMap: Record<string, string> = {
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    blue:   "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    red:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold">Event Sources & Auto-Sync</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Automatisch nieuwe evenementen ophalen van Ticketmaster en Eventbrite — verlopen events worden automatisch gearchiveerd
        </p>
      </div>

      {/* ── Scheduler status card ── */}
      <Card className={cn(
        "border-2",
        scheduler?.enabled ? "border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800" : "border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800"
      )}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 p-2 rounded-full", scheduler?.enabled ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30")}>
                {scheduler?.running
                  ? <RefreshCw className="h-5 w-5 text-green-600 animate-spin" />
                  : scheduler?.enabled
                    ? <Wifi className="h-5 w-5 text-green-600" />
                    : <WifiOff className="h-5 w-5 text-amber-600" />
                }
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-base">Auto-Sync Scheduler</h3>
                  <Badge className={scheduler?.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>
                    {scheduler?.running ? "🔄 Bezig..." : scheduler?.enabled ? "✅ Actief" : "⏸ Gepauzeerd"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Elke {scheduler?.syncIntervalHours ?? 6} uur worden automatisch nieuwe events opgehaald van alle geconfigureerde bronnen.
                  Verlopen events worden dagelijks gearchiveerd.
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/70 dark:bg-black/20 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold">{scheduler?.totalSynced ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Totaal gesync'd</div>
                  </div>
                  <div className="bg-white/70 dark:bg-black/20 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold">{scheduler?.totalArchived ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Gearchiveerd</div>
                  </div>
                  <div className="bg-white/70 dark:bg-black/20 rounded-lg p-2.5 text-center">
                    <div className="text-sm font-bold">
                      {scheduler?.lastSync
                        ? formatDistanceToNow(new Date(scheduler.lastSync), { addSuffix: true, locale: nl })
                        : "Nooit"}
                    </div>
                    <div className="text-xs text-muted-foreground">Laatste sync</div>
                  </div>
                  <div className="bg-white/70 dark:bg-black/20 rounded-lg p-2.5 text-center">
                    <div className="text-sm font-bold tabular-nums">{countdown}</div>
                    <div className="text-xs text-muted-foreground">Volgende sync</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{scheduler?.enabled ? "Aan" : "Uit"}</span>
                <Switch
                  checked={scheduler?.enabled ?? true}
                  onCheckedChange={(checked) => toggleSchedulerMutation.mutate(checked)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => syncNowMutation.mutate()}
                disabled={syncNowMutation.isPending || scheduler?.running}
                className="gap-1.5 text-xs"
                data-testid="button-sync-now"
              >
                <Zap className={cn("h-3.5 w-3.5", syncNowMutation.isPending && "animate-spin")} />
                {syncNowMutation.isPending ? "Bezig..." : "Nu synchroniseren"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => archiveNowMutation.mutate()}
                disabled={archiveNowMutation.isPending}
                className="gap-1.5 text-xs"
                data-testid="button-archive-now"
              >
                <Archive className="h-3.5 w-3.5" />
                {archiveNowMutation.isPending ? "Bezig..." : "Verlopen archiveren"}
              </Button>
            </div>
          </div>

          {/* Recent sync logs */}
          {scheduler?.recentLogs && scheduler.recentLogs.length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Recente sync-activiteit</p>
              <div className="space-y-1">
                {scheduler.recentLogs.slice(0, 5).map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{format(new Date(log.at), "HH:mm")}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded font-medium",
                      log.source === "eventbrite" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    )}>{log.source}</span>
                    <span>+{log.synced} nieuw, {log.skipped} overgeslagen</span>
                    {log.errors.length > 0 && <span className="text-red-500">({log.errors.length} fouten)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── How it works banner ── */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800">
        <CardContent className="p-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Hoe werkt het?</p>
            <p>De scheduler haalt automatisch nieuwe Dutch events op van Ticketmaster en Eventbrite. Events die meer dan 3 dagen geleden zijn afgelopen worden automatisch gearchiveerd zodat het platform altijd actueel blijft.</p>
            <p className="text-xs">API-sleutels zijn <strong>gratis</strong> voor beide platformen. Voeg ze toe via Replit Secrets om live-data te activeren.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Source cards ── */}
      <div>
        <h3 className="font-semibold text-base mb-3">Databronnen</h3>
        <div className="grid gap-4">
          {SOURCE_CONFIG.map(source => {
            const src = sources?.[source.id as keyof SourcesStatus];
            const isConfigured = src?.configured ?? false;
            const lastResult = lastResults[source.id];
            const isSyncing = syncingSource === source.id;
            const isDeleting = deletingSource === source.id;

            return (
              <Card key={source.id} className={cn("border-2", colorMap[source.color])}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-3xl">{source.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-base">{source.name}</h3>
                          {source.free && (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Gratis API
                            </Badge>
                          )}
                          {source.comingSoon ? (
                            <Badge variant="secondary" className="text-xs">Binnenkort</Badge>
                          ) : isConfigured ? (
                            <Badge className={cn("text-xs", badgeMap[source.color])}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Verbonden
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <XCircle className="h-3 w-3 mr-1" /> Niet geconfigureerd
                            </Badge>
                          )}
                          {(src?.eventCount ?? 0) > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <CalendarCheck className="h-3 w-3 mr-1" /> {src!.eventCount} events
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{source.description}</p>

                        {/* Setup instructions */}
                        {!isConfigured && !source.comingSoon && (
                          <div className="text-xs bg-white/60 dark:bg-black/20 rounded-lg p-3 mb-3 border border-dashed border-current/20 space-y-1.5">
                            <p className="font-semibold text-foreground">Setup — 2 minuten:</p>
                            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                              <li>Ga naar <a href={source.setupUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">{source.name} Developer <ExternalLink className="h-2.5 w-2.5" /></a> en maak gratis account aan</li>
                              <li>Kopieer je API-sleutel</li>
                              <li>Voeg toe in Replit Secrets: <code className="bg-muted px-1.5 rounded font-mono">{source.envVar}</code></li>
                              <li>Herstart de server — auto-sync doet de rest ✅</li>
                            </ol>
                          </div>
                        )}

                        {isConfigured && src?.keyPreview && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Sleutel: <code className="font-mono bg-muted px-1 rounded">{src.keyPreview}</code>
                          </p>
                        )}

                        {src?.lastSync && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                            <Clock className="h-3 w-3" />
                            Laatste sync: {format(new Date(src.lastSync), "d MMM yyyy HH:mm", { locale: nl })}
                          </div>
                        )}

                        {/* Eventbrite URL import form */}
                        {source.id === "eventbrite" && isConfigured && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5">
                              <Info className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                Token verbonden. Plak één of meerdere Eventbrite URLs (één per regel) om events te importeren.
                                De zoek-API is stopgezet — URL-import werkt altijd.
                              </span>
                            </div>
                            <textarea
                              data-testid="input-eventbrite-url"
                              placeholder={"https://www.eventbrite.nl/e/event-naam-123456789\nhttps://www.eventbrite.com/e/another-event-987654321"}
                              value={ebUrl}
                              onChange={e => { setEbUrl(e.target.value); setEbImportResult(null); }}
                              rows={3}
                              className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                            <Button
                              data-testid="button-import-eventbrite-url"
                              size="sm"
                              onClick={() => {
                                const urls = ebUrl.trim().split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
                                if (!urls.length) return;
                                ebImportMutation.mutate(urls.length === 1 ? urls[0] : urls.join("\n"));
                              }}
                              disabled={ebImportMutation.isPending || !ebUrl.trim()}
                              className="gap-1 text-xs h-8 w-full"
                            >
                              <Link className="h-3 w-3" />
                              {ebImportMutation.isPending ? "Bezig met importeren..." : "Importeer events"}
                            </Button>
                            {ebImportResult && (
                              <p className={cn("text-xs px-2 py-1.5 rounded", ebImportResult.ok ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20" : "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20")}>
                                {ebImportResult.message}
                              </p>
                            )}
                          </div>
                        )}

                        {lastResult && (
                          <div className={cn(
                            "text-xs rounded-lg p-2.5 mt-2",
                            lastResult.isConfigured ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          )}>
                            <p className="font-semibold">{lastResult.message}</p>
                            {lastResult.errors.slice(0, 3).map((e, i) => <p key={i} className="mt-0.5">⚠ {e}</p>)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      {!source.comingSoon ? (
                        <Button
                          data-testid={`button-sync-${source.id}`}
                          size="sm"
                          onClick={() => { setSyncingSource(source.id); syncMutation.mutate(source.id); }}
                          disabled={isSyncing || isDeleting}
                          className={cn("gap-1.5 text-xs", !isConfigured && "opacity-70")}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                          {isSyncing ? "Syncing..." : "Synchroniseer"}
                        </Button>
                      ) : (
                        <Button size="sm" disabled variant="outline" className="text-xs opacity-50">
                          <Play className="h-3.5 w-3.5 mr-1" /> Binnenkort
                        </Button>
                      )}
                      {(src?.eventCount ?? 0) > 0 && (
                        <Button
                          data-testid={`button-delete-source-${source.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!confirm(`Verwijder alle ${source.name} events?`)) return;
                            setDeletingSource(source.id);
                            deleteMutation.mutate(source.id);
                          }}
                          disabled={isDeleting || isSyncing}
                          className="gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30"
                        >
                          <Trash2 className="h-3 w-3" />
                          {isDeleting ? "Verwijderen..." : `Verwijder (${src?.eventCount})`}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Summary ── */}
      {!sourcesLoading && sources && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Events per bron</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {SOURCE_CONFIG.map(s => {
              const src = sources[s.id as keyof SourcesStatus];
              return (
                <div key={s.id} className="text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-lg font-bold">{src?.eventCount ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                  <Badge variant={src?.configured ? "default" : "secondary"} className="text-xs mt-1">
                    {src?.configured ? "Actief" : s.comingSoon ? "Soon" : "Inactief"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
