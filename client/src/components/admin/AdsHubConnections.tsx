import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, RefreshCw, AlertCircle, Check, ExternalLink, Save } from "lucide-react";

export default function AdsHubConnections() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ["/api/admin/ads/connections"] });
  const conn = (data?.connections || []).find((c: any) => c.platform === "google");
  const oauthConfigured = data?.env?.googleOauthConfigured;

  const [form, setForm] = useState({ customerId: "", loginCustomerId: "", refreshToken: "", developerToken: "" });

  const saveCreds = useMutation({
    mutationFn: (body: any) => apiRequest("/api/admin/ads/connections/google", "PUT", body).then(r => r.json()),
    onSuccess: (d: any) => {
      if (d.error) return toast({ title: "Save failed", description: d.error, variant: "destructive" });
      toast({ title: "Credentials saved" });
      setForm({ customerId: "", loginCustomerId: "", refreshToken: "", developerToken: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/connections"] });
    },
  });
  const testConn = useMutation({
    mutationFn: () => apiRequest("/api/admin/ads/connections/google/test", "POST").then(r => r.json()),
    onSuccess: (d: any) => {
      if (d.error) return toast({ title: "Test failed", description: d.error, variant: "destructive" });
      toast({ title: "Connected!", description: `Customer: ${d.customer?.descriptiveName || d.customer?.id}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/connections"] });
    },
  });
  const sync = useMutation({
    mutationFn: () => apiRequest("/api/admin/ads/sync/google", "POST", { days: 7 }).then(r => r.json()),
    onSuccess: (d: any) => {
      if (d.error) return toast({ title: "Sync failed", description: d.error, variant: "destructive" });
      toast({ title: "Synced", description: `${d.synced} rows updated, ${d.skipped} skipped (no matching campaign)` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/connections"] });
    },
  });
  const disconnect = useMutation({
    mutationFn: () => apiRequest("/api/admin/ads/connections/google", "DELETE").then(r => r.json()),
    onSuccess: () => { toast({ title: "Disconnected" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/connections"] }); },
  });

  if (isLoading) return <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  const isConnected = conn?.status === "connected";
  const hasError = conn?.status === "error";

  return (
    <div className="space-y-4">
      {/* Google Ads */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Google Ads
              {isConnected && <Badge className="bg-green-500/20 text-green-300 text-[10px]"><Check className="w-3 h-3 mr-1" />Connected</Badge>}
              {hasError && <Badge className="bg-red-500/20 text-red-300 text-[10px]"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>}
              {!conn && <Badge variant="outline" className="text-[10px]">Disconnected</Badge>}
            </CardTitle>
            {conn && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testConn.mutate()} disabled={testConn.isPending} data-testid="btn-test-google">
                  {testConn.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} data-testid="btn-sync-google">
                  {sync.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}Sync now
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (confirm("Disconnect?")) disconnect.mutate(); }}>
                  <Unlink className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          {conn?.lastSyncAt && <p className="text-xs text-muted-foreground">Last sync: {new Date(conn.lastSyncAt).toLocaleString()}</p>}
          {hasError && conn?.lastSyncError && <p className="text-xs text-red-400 mt-1">{conn.lastSyncError}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          {!oauthConfigured && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-xs space-y-1">
              <div className="font-semibold text-yellow-400">Setup needed: Google OAuth client</div>
              <p>Set <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> in your environment, then refresh this page. Get them from <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline">Google Cloud Console → Credentials</a> → OAuth 2.0 Client (type: Web application).</p>
            </div>
          )}

          <details className="text-xs bg-muted/30 rounded p-3">
            <summary className="cursor-pointer font-semibold">📖 How to connect (one-time, ~10 min)</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1.5">
              <li>In <a href="https://ads.google.com" target="_blank" rel="noreferrer" className="underline">Google Ads</a> → Tools → API Center → request a <strong>Developer Token</strong> (test access works immediately for your own account; basic access needs Google review for accessing other accounts).</li>
              <li>Find your <strong>Customer ID</strong> at the top-right of Google Ads (format: 123-456-7890).</li>
              <li>Get a <strong>Refresh Token</strong> using <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" className="underline">Google's OAuth Playground <ExternalLink className="w-3 h-3 inline" /></a>: in settings, paste your OAuth client ID + secret, select scope <code>https://www.googleapis.com/auth/adwords</code>, authorize, exchange code → copy the <code>refresh_token</code>.</li>
              <li>Paste all four values below and hit Save, then Test.</li>
            </ol>
          </details>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Customer ID</Label><Input placeholder="123-456-7890" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} data-testid="input-customer-id" /></div>
            <div className="space-y-1"><Label className="text-xs">Login Customer ID (MCC, optional)</Label><Input placeholder="987-654-3210" value={form.loginCustomerId} onChange={e => setForm(f => ({ ...f, loginCustomerId: e.target.value }))} /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Developer Token</Label><Input type="password" placeholder="••••••••••••" value={form.developerToken} onChange={e => setForm(f => ({ ...f, developerToken: e.target.value }))} data-testid="input-dev-token" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Refresh Token {conn?.hasRefreshToken && <span className="text-green-400">(stored — leave blank to keep)</span>}</Label><Input type="password" placeholder={conn?.hasRefreshToken ? "•••••• (already saved)" : "1//0g..."} value={form.refreshToken} onChange={e => setForm(f => ({ ...f, refreshToken: e.target.value }))} data-testid="input-refresh-token" /></div>
          </div>

          <Button onClick={() => saveCreds.mutate(form)} disabled={saveCreds.isPending || !form.customerId || !form.developerToken} className="w-full" data-testid="btn-save-google">
            {saveCreds.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{conn ? "Update credentials" : "Save & connect"}
          </Button>

          {isConnected && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-xs">
              <div className="font-semibold text-blue-400 mb-1">How auto-sync works</div>
              <p>Click <strong>Sync now</strong> to pull live spend / impressions / clicks from Google Ads. To match a Google Ads campaign to a Hub campaign, paste the Google campaign ID into the Hub campaign's <code>externalCampaignId</code> field. Set up a daily cron to run sync automatically (coming soon).</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other platforms placeholders */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Meta · TikTok · LinkedIn</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          API integration for these platforms is on the roadmap. For now, manually log spend on each campaign card. Once you see which platform actually converts, ping the dev team and we'll wire that platform's API next.
        </CardContent>
      </Card>
    </div>
  );
}
