import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import AdsHubBrain from "@/components/admin/AdsHubBrain";
import AdsHubConnections from "@/components/admin/AdsHubConnections";
import {
  Loader2, Sparkles, Plus, Copy, Trash2, Play, Pause, Square, RefreshCw,
  TrendingUp, Target, MousePointer, Users, DollarSign, Lightbulb,
  Brain, Link2, ChevronDown, ChevronUp, FlaskConical, CheckCircle2,
} from "lucide-react";
import { reportPurchase } from "@/lib/adsTracking";

const PLATFORMS = [
  { value: "google", label: "Google Ads", color: "bg-blue-500" },
  { value: "meta", label: "Meta (IG + FB)", color: "bg-pink-500" },
  { value: "tiktok", label: "TikTok", color: "bg-cyan-500" },
  { value: "linkedin", label: "LinkedIn", color: "bg-sky-700" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-300 border-gray-500/40",
    ready: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    live: "bg-green-500/20 text-green-300 border-green-500/40",
    paused: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    ended: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  return <Badge variant="outline" className={`text-[10px] uppercase ${map[status] || map.draft}`}>{status}</Badge>;
}

function buildUtmUrl(landingUrl: string, utmSource: string, utmMedium: string, utmCampaign: string): string {
  try {
    const base = landingUrl?.startsWith("http") ? landingUrl : `${window.location.origin}${landingUrl || "/"}`;
    const url = new URL(base);
    url.searchParams.set("utm_source", utmSource);
    url.searchParams.set("utm_medium", utmMedium);
    url.searchParams.set("utm_campaign", utmCampaign);
    return url.toString();
  } catch { return landingUrl; }
}

export default function AdsHubPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("drafter");

  // ── Drafter state
  const [showCustomize, setShowCustomize] = useState(false);
  const [draft, setDraft] = useState<any>({
    angle: "", featureFocus: "", audienceOverride: "", language: "", tonalTwist: "", useContext: true,
    platform: "meta",
    goal: "signups",
    productPitch: "Urban Culture Hub – the home for breakers, hip-hop heads, graffiti artists, DJs and dancers. Find crews, join cyphers, share reels, get street cred.",
    audience: "16-34 urban-culture lovers in EU, especially NL/BE/DE/FR",
    dailyBudgetEur: 5,
  });
  const [draftResult, setDraftResult] = useState<any>(null);

  const draftMutation = useMutation({
    mutationFn: (d: typeof draft) => apiRequest("/api/admin/ads/draft", "POST", d).then(r => r.json()),
    onSuccess: (data) => {
      if (data.error) return toast({ title: "Draft failed", description: data.error, variant: "destructive" });
      setDraftResult(data);
      toast({ title: "Draft generated", description: "Review below, then save as campaign." });
    },
    onError: (e: any) => toast({ title: "Draft failed", description: e.message, variant: "destructive" }),
  });

  // ── Campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/ads/campaigns"],
  });

  const createCampaign = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/ads/campaigns", "POST", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/campaigns"] });
      toast({ title: "Campaign saved" });
      setDraftResult(null);
      setTab("campaigns");
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const updateCampaign = useMutation({
    mutationFn: ({ id, ...patch }: any) => apiRequest(`/api/admin/ads/campaigns/${id}`, "PATCH", patch).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/campaigns"] }),
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/ads/campaigns/${id}`, "DELETE").then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/campaigns"] });
      toast({ title: "Deleted" });
    },
  });

  function saveDraftAsCampaign() {
    if (!draftResult) return;
    createCampaign.mutate({
      name: draftResult.name || `${draft.platform} ${draft.goal}`,
      platform: draft.platform,
      goal: draft.goal,
      status: "draft",
      dailyBudget: Math.round((draftResult.recommendedDailyBudgetEur || draft.dailyBudgetEur) * 100),
      audience: draftResult.audience,
      creative: draftResult.creative,
      utmSource: draftResult.utm?.source || draft.platform,
      utmMedium: draftResult.utm?.medium || "cpc",
      utmCampaign: draftResult.utm?.campaign || `${draft.platform}_${Date.now()}`,
      landingUrl: "/",
    });
  }

  // ── Analytics
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<any>({
    queryKey: ["/api/admin/ads/analytics"],
  });

  // ── Insights
  const { data: latestInsight, refetch: refetchInsight } = useQuery<any>({
    queryKey: ["/api/admin/ads/insights/latest"],
  });
  const generateInsights = useMutation({
    mutationFn: () => apiRequest("/api/admin/ads/insights", "POST", { days: 7 }).then(r => r.json()),
    onSuccess: () => { refetchInsight(); toast({ title: "AI insights generated" }); },
    onError: (e: any) => toast({ title: "Insights failed", description: e.message, variant: "destructive" }),
  });

  // ── Spend log
  const [spendInputs, setSpendInputs] = useState<Record<number, { date: string; amountEur: string; impressions: string; clicks: string }>>({});
  const logSpend = useMutation({
    mutationFn: ({ id, body }: any) => apiRequest(`/api/admin/ads/campaigns/${id}/spend`, "POST", body).then(r => r.json()),
    onSuccess: (_d, vars: any) => {
      toast({ title: "Spend logged" });
      setSpendInputs(prev => ({ ...prev, [vars.id]: { date: "", amountEur: "", impressions: "", clicks: "" } }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/analytics"] });
    },
  });

  function copy(text: string) { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }

  // ── Conversion tracking smoke test ────────────────────────────────────
  // Fires a real Google Ads Purchase conversion with a unique transaction id
  // every time, so Tag Assistant / GA Debugger can verify wiring without a
  // real purchase. The unique id also bypasses the per-session dedup guard.
  const [lastFireAt, setLastFireAt] = useState<string | null>(null);
  function fireTestConversion() {
    const txnId = `test:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    reportPurchase({
      value: 1.0,
      currency: "EUR",
      transactionId: txnId,
      conversionType: "diagnostic_test",
    });
    setLastFireAt(new Date().toLocaleTimeString());
    toast({
      title: "Test conversion fired",
      description: `Transaction id: ${txnId}. Tag Assistant should show a Purchase event within ~1s.`,
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4" data-testid="page-ads-hub">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Target className="w-6 h-6 text-violet-400" /> Ads Hub
          </h1>
          <p className="text-sm text-muted-foreground">AI drafts your campaigns. You launch and track. AI watches the numbers.</p>
        </div>
      </div>

      {/* ── Conversion tracking diagnostics ─────────────────────────────── */}
      <Card className="border-violet-500/30 bg-violet-500/[0.03]" data-testid="card-conversion-diagnostics">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4.5 h-4.5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                Google Ads conversion tracking
                <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                  Live · AW-18115227469
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fires a real Purchase event so Tag Assistant can verify wiring without a real sale. Each click uses a unique transaction id (€1.00 EUR, type <code className="text-[10px]">diagnostic_test</code>).
              </p>
              {lastFireAt && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5" data-testid="text-last-fire">
                  <CheckCircle2 className="w-3 h-3" /> Last fired at {lastFireAt}
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={fireTestConversion}
            className="bg-violet-600 hover:bg-violet-700 shrink-0"
            data-testid="button-fire-test-conversion"
          >
            <FlaskConical className="w-4 h-4 mr-2" /> Fire test conversion
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="drafter" data-testid="tab-drafter"><Sparkles className="w-3.5 h-3.5 mr-1" />Drafter</TabsTrigger>
          <TabsTrigger value="brain" data-testid="tab-brain"><Brain className="w-3.5 h-3.5 mr-1" />Brain</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights"><Lightbulb className="w-3.5 h-3.5 mr-1" />Insights</TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections"><Link2 className="w-3.5 h-3.5 mr-1" />Connect</TabsTrigger>
        </TabsList>

        <TabsContent value="brain" className="mt-4"><AdsHubBrain /></TabsContent>
        <TabsContent value="connections" className="mt-4"><AdsHubConnections /></TabsContent>

        {/* ── DRAFTER ───────────────────────────────────────────── */}
        <TabsContent value="drafter" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">AI Campaign Drafter</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Platform</Label>
                <Select value={draft.platform} onValueChange={v => setDraft(d => ({ ...d, platform: v }))}>
                  <SelectTrigger data-testid="select-platform"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Goal</Label>
                <Select value={draft.goal} onValueChange={v => setDraft(d => ({ ...d, goal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signups">User signups</SelectItem>
                    <SelectItem value="event">Promote event</SelectItem>
                    <SelectItem value="premium">Premium subs</SelectItem>
                    <SelectItem value="awareness">Awareness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Daily budget (€)</Label>
                <Input type="number" min={1} value={draft.dailyBudgetEur}
                  onChange={e => setDraft(d => ({ ...d, dailyBudgetEur: Number(e.target.value) }))}
                  data-testid="input-daily-budget" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Target audience hints</Label>
                <Input value={draft.audience} onChange={e => setDraft(d => ({ ...d, audience: e.target.value }))} data-testid="input-audience" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>What you're promoting</Label>
                <Textarea rows={3} value={draft.productPitch} onChange={e => setDraft(d => ({ ...d, productPitch: e.target.value }))} data-testid="input-pitch" placeholder="Optional override — leave blank to use the Marketing Brain pitch" />
              </div>

              <div className="col-span-2 border rounded-md">
                <button type="button" onClick={() => setShowCustomize(s => !s)} className="w-full flex items-center justify-between p-3 text-sm font-medium hover-elevate" data-testid="btn-toggle-customize">
                  <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Customize this campaign (focus, angle, language…)</span>
                  {showCustomize ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showCustomize && (
                  <div className="p-3 pt-0 space-y-3 border-t">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Feature focus</Label>
                        <Input placeholder="e.g. Spots Map, Cyphers, Beat Lab" value={draft.featureFocus} onChange={e => setDraft((d: any) => ({ ...d, featureFocus: e.target.value }))} data-testid="input-feature-focus" />
                        <p className="text-[10px] text-muted-foreground mt-1">Make this feature the hero of the ad.</p>
                      </div>
                      <div>
                        <Label className="text-xs">Angle</Label>
                        <Input placeholder="e.g. 'discover non-touristy Amsterdam', 'beat the algorithm'" value={draft.angle} onChange={e => setDraft((d: any) => ({ ...d, angle: e.target.value }))} data-testid="input-angle" />
                      </div>
                      <div>
                        <Label className="text-xs">Audience override</Label>
                        <Input placeholder="e.g. food lovers visiting Amsterdam" value={draft.audienceOverride} onChange={e => setDraft((d: any) => ({ ...d, audienceOverride: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Language</Label>
                        <Select value={draft.language || "auto"} onValueChange={v => setDraft((d: any) => ({ ...d, language: v === "auto" ? "" : v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (use Brain default)</SelectItem>
                            <SelectItem value="English">English</SelectItem>
                            <SelectItem value="Dutch (Nederlands)">Dutch</SelectItem>
                            <SelectItem value="French">French</SelectItem>
                            <SelectItem value="German">German</SelectItem>
                            <SelectItem value="Spanish">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Tone twist (optional)</Label>
                        <Input placeholder="e.g. 'extra playful', 'bold and provocative', 'gentle, welcoming'" value={draft.tonalTwist} onChange={e => setDraft((d: any) => ({ ...d, tonalTwist: e.target.value }))} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={draft.useContext} onChange={e => setDraft((d: any) => ({ ...d, useContext: e.target.checked }))} />
                      Use Marketing Brain (recommended) <span className="text-muted-foreground">— turn off only for raw, generic copy</span>
                    </label>
                  </div>
                )}
              </div>
              <Button className="md:col-span-2 bg-violet-600 hover:bg-violet-700"
                onClick={() => draftMutation.mutate(draft)}
                disabled={draftMutation.isPending}
                data-testid="btn-generate-draft">
                {draftMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Drafting…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate AI Draft</>}
              </Button>
            </CardContent>
          </Card>

          {draftResult && (
            <Card className="border-violet-500/30" data-testid="draft-result">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{draftResult.name}</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => draftMutation.mutate(draft)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={saveDraftAsCampaign} disabled={createCampaign.isPending} data-testid="btn-save-draft">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Save as Campaign
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DraftSection title="Audience" copy={() => copy(JSON.stringify(draftResult.audience, null, 2))}>
                  <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(draftResult.audience, null, 2)}</pre>
                </DraftSection>
                {draftResult.creative?.headlines?.length > 0 && (
                  <DraftSection title={`Headlines (${draftResult.creative.headlines.length})`} copy={() => copy(draftResult.creative.headlines.join("\n"))}>
                    <ul className="space-y-1">{draftResult.creative.headlines.map((h: string, i: number) => <li key={i} className="bg-muted/30 rounded px-2 py-1 text-xs">{h}</li>)}</ul>
                  </DraftSection>
                )}
                {draftResult.creative?.descriptions?.length > 0 && (
                  <DraftSection title={`Descriptions (${draftResult.creative.descriptions.length})`} copy={() => copy(draftResult.creative.descriptions.join("\n"))}>
                    <ul className="space-y-1">{draftResult.creative.descriptions.map((h: string, i: number) => <li key={i} className="bg-muted/30 rounded px-2 py-1 text-xs">{h}</li>)}</ul>
                  </DraftSection>
                )}
                {draftResult.creative?.primaryText?.length > 0 && (
                  <DraftSection title="Primary text" copy={() => copy((draftResult.creative.primaryText || []).join("\n\n"))}>
                    <ul className="space-y-1">{draftResult.creative.primaryText.map((h: string, i: number) => <li key={i} className="bg-muted/30 rounded px-2 py-1 text-xs whitespace-pre-line">{h}</li>)}</ul>
                  </DraftSection>
                )}
                {draftResult.creative?.keywords?.length > 0 && (
                  <DraftSection title="Keywords" copy={() => copy(draftResult.creative.keywords.join(", "))}>
                    <div className="flex flex-wrap gap-1">{draftResult.creative.keywords.map((k: string) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}</div>
                  </DraftSection>
                )}
                {draftResult.creative?.hashtags?.length > 0 && (
                  <DraftSection title="Hashtags" copy={() => copy(draftResult.creative.hashtags.join(" "))}>
                    <div className="flex flex-wrap gap-1">{draftResult.creative.hashtags.map((k: string) => <Badge key={k} className="bg-pink-500/20 text-pink-300 text-[10px]">{k}</Badge>)}</div>
                  </DraftSection>
                )}
                {draftResult.creative?.imagePrompt && (
                  <DraftSection title="Image prompt" copy={() => copy(draftResult.creative.imagePrompt)}>
                    <p className="text-xs italic">{draftResult.creative.imagePrompt}</p>
                  </DraftSection>
                )}
                {draftResult.creative?.videoScript && (
                  <DraftSection title="Video script" copy={() => copy(draftResult.creative.videoScript)}>
                    <pre className="text-xs whitespace-pre-wrap">{draftResult.creative.videoScript}</pre>
                  </DraftSection>
                )}
                {draftResult.tips?.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                    <div className="text-xs font-semibold text-yellow-400 mb-1">Pro tips</div>
                    <ul className="text-xs space-y-1 list-disc pl-4">{draftResult.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Recommended daily budget: <strong>€{draftResult.recommendedDailyBudgetEur}</strong> · Expected signups/wk: <strong>{draftResult.expectedSignupsPerWeek}</strong>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CAMPAIGNS ─────────────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-3 mt-4">
          {campaignsLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          {!campaignsLoading && campaigns.length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              No campaigns yet. Generate one in the Drafter tab.
            </CardContent></Card>
          )}
          {campaigns.map((c: any) => {
            const utmUrl = buildUtmUrl(c.landingUrl || "/", c.utmSource, c.utmMedium, c.utmCampaign);
            const platform = PLATFORMS.find(p => p.value === c.platform);
            const inp = spendInputs[c.id] || { date: new Date().toISOString().slice(0, 10), amountEur: "", impressions: "", clicks: "" };
            return (
              <Card key={c.id} data-testid={`campaign-${c.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${platform?.color}`} />
                        <h3 className="font-bold truncate">{c.name}</h3>
                        <StatusBadge status={c.status} />
                        <Badge variant="outline" className="text-[10px]">{platform?.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Daily budget: €{((c.dailyBudget || 0) / 100).toFixed(2)} · UTM: <code>{c.utmCampaign}</code>
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {c.status !== "live" && (
                        <Button size="sm" variant="outline" onClick={() => updateCampaign.mutate({ id: c.id, status: "live" })} title="Mark as live">
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {c.status === "live" && (
                        <Button size="sm" variant="outline" onClick={() => updateCampaign.mutate({ id: c.id, status: "paused" })} title="Pause">
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => updateCampaign.mutate({ id: c.id, status: "ended" })} title="End">
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this campaign?")) deleteCampaign.mutate(c.id); }} title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded p-2 flex items-center gap-2">
                    <code className="text-[10px] flex-1 truncate" data-testid={`utm-url-${c.id}`}>{utmUrl}</code>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(utmUrl)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                    <div>
                      <Label className="text-[10px]">Date</Label>
                      <Input type="date" value={inp.date} onChange={e => setSpendInputs(p => ({ ...p, [c.id]: { ...inp, date: e.target.value } }))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Spend €</Label>
                      <Input type="number" step="0.01" value={inp.amountEur} placeholder="5.00" onChange={e => setSpendInputs(p => ({ ...p, [c.id]: { ...inp, amountEur: e.target.value } }))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Impressions</Label>
                      <Input type="number" value={inp.impressions} onChange={e => setSpendInputs(p => ({ ...p, [c.id]: { ...inp, impressions: e.target.value } }))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Clicks</Label>
                      <Input type="number" value={inp.clicks} onChange={e => setSpendInputs(p => ({ ...p, [c.id]: { ...inp, clicks: e.target.value } }))} className="h-8 text-xs" />
                    </div>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!inp.amountEur || !inp.date}
                      onClick={() => logSpend.mutate({
                        id: c.id,
                        body: {
                          date: inp.date,
                          amountCents: Math.round(parseFloat(inp.amountEur) * 100),
                          impressions: parseInt(inp.impressions) || 0,
                          clicks: parseInt(inp.clicks) || 0,
                        },
                      })}
                      data-testid={`btn-log-spend-${c.id}`}
                    >Log spend</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── ANALYTICS ─────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetchAnalytics()} disabled={analyticsLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${analyticsLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {analytics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KPI icon={DollarSign} label="Total spend" value={`€${(analytics.totals?.spendEur || 0).toFixed(2)}`} />
                <KPI icon={MousePointer} label="Clicks" value={analytics.totals?.clicks || 0} />
                <KPI icon={TrendingUp} label="Landings" value={analytics.totals?.landings || 0} />
                <KPI icon={Users} label="Signups" value={analytics.totals?.signups || 0} />
                <KPI icon={Target} label="Cost / signup" value={analytics.totals?.costPerSignup != null ? `€${analytics.totals.costPerSignup}` : "—"} />
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">By platform</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(analytics.byPlatform || {}).length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
                  {Object.entries(analytics.byPlatform || {}).map(([p, v]: any) => (
                    <div key={p} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                      <span className="capitalize font-semibold">{p}</span>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>€{v.spendEur.toFixed(2)} spent</span>
                        <span>{v.signups} signups</span>
                        <span className="text-green-400">{v.costPerSignup != null ? `€${v.costPerSignup}/signup` : "—"}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Per campaign</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {analytics.campaigns?.length === 0 && <p className="text-xs text-muted-foreground">No campaigns yet.</p>}
                  {analytics.campaigns?.map((c: any) => (
                    <div key={c.id} className="text-xs border-b last:border-0 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{c.name}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="flex gap-3 text-muted-foreground mt-1 flex-wrap">
                        <span>€{c.spendEur.toFixed(2)} spent</span>
                        <span>{c.impressions} impr</span>
                        <span>{c.clicks} clicks ({c.ctr ?? 0}% CTR)</span>
                        <span>{c.landings} landings</span>
                        <span className="text-green-400">{c.signups} signups</span>
                        <span>{c.costPerSignup != null ? `€${c.costPerSignup}/signup` : "—"}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── INSIGHTS ──────────────────────────────────────────── */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending} data-testid="btn-generate-insights">
              {generateInsights.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Analyzing…</> : <><Sparkles className="w-4 h-4 mr-1" />Generate AI insights</>}
            </Button>
          </div>
          {!latestInsight && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No insights yet. Click "Generate AI insights".</CardContent></Card>}
          {latestInsight && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400" /> AI Recommendations</CardTitle>
                <p className="text-xs text-muted-foreground">Generated {new Date(latestInsight.generatedAt).toLocaleString()} · last {latestInsight.periodDays} days</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm bg-muted/40 rounded p-3">{latestInsight.summary}</p>
                <div className="space-y-2">
                  {(latestInsight.recommendations || []).map((r: any, i: number) => (
                    <div key={i} className="border-l-4 pl-3 py-1" style={{ borderColor: r.priority === "high" ? "#ef4444" : r.priority === "medium" ? "#eab308" : "#6b7280" }}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{r.priority}</Badge>
                        <Badge className="text-[10px] capitalize bg-violet-500/20 text-violet-300">{r.platform}</Badge>
                      </div>
                      <p className="text-sm font-semibold mt-1">{r.action}</p>
                      <p className="text-xs text-muted-foreground">{r.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value }: any) {
  return (
    <Card><CardContent className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </CardContent></Card>
  );
}

function DraftSection({ title, copy, children }: any) {
  return (
    <div className="border rounded p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase text-muted-foreground">{title}</span>
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copy}><Copy className="w-3 h-3" /></Button>
      </div>
      {children}
    </div>
  );
}
