import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, Brain, RefreshCw, Play, AlertTriangle, Activity, Database, Trash2, DollarSign, Gauge, Image as ImageIcon } from "lucide-react";

type Provider = "openai" | "anthropic";
interface RoleConfig {
  provider: Provider;
  model: string;
  fallbackProvider?: Provider;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
}
interface Role { id: string; label: string; description: string; recommendedTier: "fast" | "balanced" | "powerful" }
interface CacheCfg { enabled: boolean; ttlSeconds: number; maxEntries: number; perRole: Record<string, boolean | undefined> }
interface ImageModel {
  id: string;
  label: string;
  provider: Provider;
  tier: "fast" | "balanced" | "powerful";
  defaultSize: string;
  defaultQuality: string;
  pricePerImageUsd: number;
  description: string;
}
interface ImageCfg { model: string; size?: string; quality?: string }
interface ConfigResponse {
  config: Record<string, RoleConfig>;
  smartRouting: boolean;
  cache: CacheCfg;
  cacheSize: number;
  roles: Role[];
  providers: { id: Provider; label: string }[];
  availableModels: Record<Provider, { id: string; label: string; tier: string }[]>;
  availableImageModels: ImageModel[];
  imageConfig: ImageCfg;
  pricing: Record<string, { input: number; output: number }>;
}
interface UsageRow {
  calls: number; failures: number; fallbackHits: number; cacheHits: number;
  avgLatencyMs: number; successRate: number; cacheHitRate: number;
  estimatedCostUsd: number; inputTokens: number; outputTokens: number;
  lastUsedAt: string; lastError?: string;
}
interface UsageResponse {
  byRole: Record<string, UsageRow>;
  totals: { calls: number; cacheHits: number; cacheHitRate: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  updatedAt: string;
}

const TIER_LABEL: Record<string, string> = { fast: "Fast", balanced: "Balanced", powerful: "Powerful" };
const TIER_COLOR: Record<string, string> = { fast: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", balanced: "bg-blue-500/15 text-blue-700 dark:text-blue-400", powerful: "bg-purple-500/15 text-purple-700 dark:text-purple-400" };
const fmtUsd = (n: number) => "$" + (n ?? 0).toFixed(n < 0.01 && n > 0 ? 5 : 4);

export default function AiControlPage() {
  const { toast } = useToast();
  const { data: cfg, isLoading: cfgLoading } = useQuery<ConfigResponse>({ queryKey: ["/api/admin/ai/config"] });
  const { data: usage, isLoading: usageLoading } = useQuery<UsageResponse>({ queryKey: ["/api/admin/ai/usage"], refetchInterval: 10_000 });

  const [pending, setPending] = useState<Record<string, RoleConfig>>({});

  const saveRole = useMutation({
    mutationFn: async (updates: Record<string, RoleConfig>) => apiRequest("/api/admin/ai/config", "PATCH", { config: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      setPending({});
      toast({ title: "Saved", description: "AI configuration updated." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleRouting = useMutation({
    mutationFn: async (enabled: boolean) => apiRequest("/api/admin/ai/smart-routing", "POST", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] }),
  });

  const resetUsage = useMutation({
    mutationFn: async () => apiRequest("/api/admin/ai/usage/reset", "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/usage"] });
      toast({ title: "Usage stats reset" });
    },
  });

  const saveCache = useMutation({
    mutationFn: async (updates: Partial<CacheCfg>) => apiRequest("/api/admin/ai/cache", "POST", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      toast({ title: "Cache settings updated" });
    },
  });

  const saveImageConfig = useMutation({
    mutationFn: async (updates: Partial<ImageCfg>) => apiRequest("/api/admin/ai/image-config", "POST", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      toast({ title: "Image model updated", description: "LinkedIn auto-post will use the new model on the next post." });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const clearCache = useMutation({
    mutationFn: async () => apiRequest("/api/admin/ai/cache/clear", "POST", {}),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/config"] });
      r.json?.().then((d: any) => toast({ title: "Cache cleared", description: `Removed ${d.cleared ?? 0} entries.` })).catch(() => toast({ title: "Cache cleared" }));
    },
  });

  if (cfgLoading || !cfg) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const updateLocal = (roleId: string, patch: Partial<RoleConfig>) => {
    const base = pending[roleId] ?? cfg.config[roleId];
    setPending(p => ({ ...p, [roleId]: { ...base, ...patch } }));
  };
  const isDirty = (roleId: string) => pending[roleId] && JSON.stringify(pending[roleId]) !== JSON.stringify(cfg.config[roleId]);
  const dirtyCount = Object.keys(pending).filter(isDirty).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-ai-control">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3"><Brain className="w-8 h-8 text-primary" /> AI Control Panel</h1>
        <p className="text-muted-foreground mt-1">Central brain for every AI feature in the app — pick provider and model per role, monitor performance, configure smart routing & caching.</p>
      </div>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Activity className="w-4 h-4" />} label="Total calls" value={(usage?.totals.calls ?? 0).toLocaleString()} testId="kpi-calls" />
        <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Estimated cost" value={fmtUsd(usage?.totals.estimatedCostUsd ?? 0)} testId="kpi-cost" />
        <KpiCard icon={<Database className="w-4 h-4" />} label="Cache hit rate" value={`${usage?.totals.cacheHitRate ?? 0}%`} hint={`${cfg.cacheSize} entries cached`} testId="kpi-cache" />
        <KpiCard icon={<Gauge className="w-4 h-4" />} label="Tokens (in / out)" value={`${(usage?.totals.inputTokens ?? 0).toLocaleString()} / ${(usage?.totals.outputTokens ?? 0).toLocaleString()}`} testId="kpi-tokens" />
      </div>

      {/* Master controls */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Smart Routing</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-fallback when a provider fails</p>
            <p className="text-sm text-muted-foreground">If the primary call errors (rate limit, outage, timeout), retry once with the configured backup provider/model.</p>
          </div>
          <Switch checked={cfg.smartRouting} onCheckedChange={(v) => toggleRouting.mutate(v)} data-testid="switch-smart-routing" />
        </CardContent>
      </Card>

      {/* Cache panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Response cache</CardTitle>
          <CardDescription>Cache identical AI calls to slash cost & latency. Same prompt + same model + same temperature returns instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable cache (global)</p>
              <p className="text-sm text-muted-foreground">Per-role overrides below take precedence.</p>
            </div>
            <Switch checked={cfg.cache.enabled} onCheckedChange={(v) => saveCache.mutate({ enabled: v })} data-testid="switch-cache-enabled" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">TTL (seconds)</label>
              <Input type="number" min={10} max={86400} defaultValue={cfg.cache.ttlSeconds} onBlur={(e) => { const v = Number(e.target.value); if (v && v !== cfg.cache.ttlSeconds) saveCache.mutate({ ttlSeconds: v }); }} data-testid="input-cache-ttl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Max entries</label>
              <Input type="number" min={50} max={10000} defaultValue={cfg.cache.maxEntries} onBlur={(e) => { const v = Number(e.target.value); if (v && v !== cfg.cache.maxEntries) saveCache.mutate({ maxEntries: v }); }} data-testid="input-cache-max" />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => clearCache.mutate()} disabled={clearCache.isPending} className="w-full" data-testid="button-clear-cache">
                <Trash2 className="w-4 h-4 mr-2" /> Clear cache ({cfg.cacheSize})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image generation panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Image generation model</CardTitle>
          <CardDescription>
            Used by the LinkedIn auto-poster (and any other feature that generates images). All calls go through your own OpenAI API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const current = cfg.imageConfig?.model ?? "gpt-image-1";
            const meta = cfg.availableImageModels.find(m => m.id === current);
            const effectiveSize = cfg.imageConfig?.size || meta?.defaultSize || "1024x1024";
            const effectiveQuality = cfg.imageConfig?.quality || meta?.defaultQuality || "standard";
            const sizesFor = (id: string) => {
              if (id === "gpt-image-1") return ["1024x1024", "1024x1536", "1536x1024"];
              if (id === "dall-e-3") return ["1024x1024", "1024x1792", "1792x1024"];
              return ["256x256", "512x512", "1024x1024"];
            };
            const qualitiesFor = (id: string) => {
              if (id === "gpt-image-1") return ["low", "medium", "high", "auto"];
              if (id === "dall-e-3") return ["standard", "hd"];
              return ["standard"];
            };
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Model</label>
                    <Select
                      value={current}
                      onValueChange={(v) => {
                        const newMeta = cfg.availableImageModels.find(m => m.id === v);
                        saveImageConfig.mutate({ model: v, size: newMeta?.defaultSize, quality: newMeta?.defaultQuality });
                      }}
                    >
                      <SelectTrigger data-testid="select-image-model"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cfg.availableImageModels.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Size</label>
                    <Select value={effectiveSize} onValueChange={(v) => saveImageConfig.mutate({ model: current, size: v, quality: effectiveQuality })}>
                      <SelectTrigger data-testid="select-image-size"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sizesFor(current).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Quality</label>
                    <Select value={effectiveQuality} onValueChange={(v) => saveImageConfig.mutate({ model: current, size: effectiveSize, quality: v })}>
                      <SelectTrigger data-testid="select-image-quality"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {qualitiesFor(current).map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {meta && (
                  <div className="border rounded-lg p-3 bg-muted/30 space-y-1.5" data-testid="text-image-model-info">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={TIER_COLOR[meta.tier]}>{TIER_LABEL[meta.tier]}</Badge>
                      <Badge variant="outline">~{fmtUsd(meta.pricePerImageUsd)}/image</Badge>
                      <Badge variant="outline">{meta.provider}</Badge>
                      {saveImageConfig.isPending && <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving…</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                    {current === "dall-e-2" && effectiveSize !== "1024x1024" && effectiveSize !== "512x512" && effectiveSize !== "256x256" && (
                      <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> DALL·E 2 only supports square sizes — landscape requests will fall back to 1024x1024.</p>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Role grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Role → Model assignment</CardTitle>
            <CardDescription>Each AI feature in the app runs through a "role". Change provider/model and it takes effect instantly across the platform.</CardDescription>
          </div>
          {dirtyCount > 0 && (
            <Button onClick={() => saveRole.mutate(pending)} disabled={saveRole.isPending} data-testid="button-save-config">
              {saveRole.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save {dirtyCount} change{dirtyCount > 1 ? "s" : ""}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {cfg.roles.map(role => {
            const live = pending[role.id] ?? cfg.config[role.id];
            if (!live) return null;
            const u = usage?.byRole[role.id];
            const cacheOverride = cfg.cache.perRole[role.id];
            const effectiveCache = typeof cacheOverride === "boolean" ? cacheOverride : cfg.cache.enabled;
            return (
              <div key={role.id} className="border rounded-lg p-4 space-y-3" data-testid={`row-role-${role.id}`}>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold" data-testid={`text-role-${role.id}`}>{role.label}</h3>
                      <Badge variant="outline" className={TIER_COLOR[role.recommendedTier]}>Recommended: {TIER_LABEL[role.recommendedTier]}</Badge>
                      {isDirty(role.id) && <Badge variant="secondary">Unsaved</Badge>}
                      {effectiveCache && <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700">Cache on</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                  </div>
                  {u && (
                    <div className="text-xs text-muted-foreground text-right">
                      <div>{u.calls} calls · {u.successRate}% ok · {u.avgLatencyMs}ms avg</div>
                      <div>{fmtUsd(u.estimatedCostUsd)} · {u.cacheHitRate}% cache</div>
                      {u.fallbackHits > 0 && <div className="text-amber-600">{u.fallbackHits} fallbacks</div>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Primary provider</label>
                    <Select value={live.provider} onValueChange={(v: Provider) => updateLocal(role.id, { provider: v, model: cfg.availableModels[v][0]?.id })}>
                      <SelectTrigger data-testid={`select-provider-${role.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{cfg.providers.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Primary model</label>
                    <Select value={live.model} onValueChange={(v) => updateLocal(role.id, { model: v })}>
                      <SelectTrigger data-testid={`select-model-${role.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{cfg.availableModels[live.provider].map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fallback provider</label>
                    <Select value={live.fallbackProvider ?? "none"} onValueChange={(v) => updateLocal(role.id, v === "none" ? { fallbackProvider: undefined, fallbackModel: undefined } : { fallbackProvider: v as Provider, fallbackModel: cfg.availableModels[v as Provider][0]?.id })}>
                      <SelectTrigger data-testid={`select-fallback-provider-${role.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {cfg.providers.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Fallback model</label>
                    <Select value={live.fallbackModel ?? "none"} onValueChange={(v) => updateLocal(role.id, { fallbackModel: v === "none" ? undefined : v })} disabled={!live.fallbackProvider}>
                      <SelectTrigger data-testid={`select-fallback-model-${role.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {live.fallbackProvider && cfg.availableModels[live.fallbackProvider].map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">Cache for this role:</span>
                  <Select
                    value={cacheOverride === true ? "on" : cacheOverride === false ? "off" : "default"}
                    onValueChange={(v) => {
                      const next: any = { ...cfg.cache.perRole };
                      if (v === "default") delete next[role.id]; else next[role.id] = v === "on";
                      saveCache.mutate({ perRole: next });
                    }}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs" data-testid={`select-cache-${role.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use global setting</SelectItem>
                      <SelectItem value="on">Force ON</SelectItem>
                      <SelectItem value="off">Force OFF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {u?.lastError && (
                  <div className="text-xs text-destructive flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Last error: {u.lastError}</div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Usage panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Live usage</CardTitle>
            <CardDescription>Auto-refreshes every 10 seconds. Last update: {usage?.updatedAt ? new Date(usage.updatedAt).toLocaleTimeString() : "—"}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => resetUsage.mutate()} disabled={resetUsage.isPending} data-testid="button-reset-usage">
            <RefreshCw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </CardHeader>
        <CardContent>
          {usageLoading || !usage ? <Skeleton className="h-32" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left py-2">Role</th>
                    <th className="text-right">Calls</th>
                    <th className="text-right">Success</th>
                    <th className="text-right">Avg latency</th>
                    <th className="text-right">Cache</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(usage.byRole).length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No AI calls yet — usage will appear here as features run.</td></tr>
                  ) : Object.entries(usage.byRole).map(([role, s]) => (
                    <tr key={role} className="border-t" data-testid={`row-usage-${role}`}>
                      <td className="py-2 font-medium">{cfg.roles.find(r => r.id === role)?.label ?? role}</td>
                      <td className="text-right">{s.calls}</td>
                      <td className="text-right"><span className={s.successRate >= 95 ? "text-emerald-600" : s.successRate >= 80 ? "text-amber-600" : "text-destructive"}>{s.successRate}%</span></td>
                      <td className="text-right">{s.avgLatencyMs}ms</td>
                      <td className="text-right">{s.cacheHitRate}%</td>
                      <td className="text-right text-xs text-muted-foreground">{(s.inputTokens ?? 0).toLocaleString()}/{(s.outputTokens ?? 0).toLocaleString()}</td>
                      <td className="text-right">{fmtUsd(s.estimatedCostUsd)}</td>
                      <td className="text-right text-xs text-muted-foreground">{new Date(s.lastUsedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test playground */}
      <TestPlayground roles={cfg.roles} />
    </div>
  );
}

function KpiCard({ icon, label, value, hint, testId }: { icon: React.ReactNode; label: string; value: string; hint?: string; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function TestPlayground({ roles }: { roles: Role[] }) {
  const [role, setRole] = useState(roles[0]?.id ?? "default");
  const [prompt, setPrompt] = useState("Say hello and identify which model you are.");
  const [result, setResult] = useState<{ text: string; provider: string; model: string; usedFallback: boolean; latencyMs: number } | null>(null);
  const { toast } = useToast();

  const test = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/admin/ai/test", "POST", { role, prompt });
      return res.json();
    },
    onSuccess: (r: any) => {
      if (r?.ok === false) toast({ title: "Test failed", description: r.error || "AI call failed", variant: "destructive" });
      else setResult(r);
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Play className="w-5 h-5" /> Test playground</CardTitle><CardDescription>Quick prompt against any role to verify it's wired correctly.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-test-role"><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea className="md:col-span-2" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter a test prompt..." data-testid="input-test-prompt" />
        </div>
        <Button onClick={() => test.mutate()} disabled={test.isPending || !prompt.trim()} data-testid="button-run-test">
          {test.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />} Run test
        </Button>
        {result && (
          <div className="border rounded-lg p-4 space-y-2" data-testid="text-test-result">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>{result.provider}</Badge>
              <Badge variant="outline">{result.model}</Badge>
              <Badge variant="outline">{result.latencyMs}ms</Badge>
              {result.usedFallback && <Badge variant="secondary" className="bg-amber-500/15 text-amber-700">Fallback used</Badge>}
            </div>
            <div className="text-sm whitespace-pre-wrap">{result.text}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
