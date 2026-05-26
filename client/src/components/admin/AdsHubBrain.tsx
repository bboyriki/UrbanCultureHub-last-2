import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RotateCcw, Plus, Trash2, Brain, BookOpen } from "lucide-react";

type Feature = { name: string; description: string; audienceFit?: string };
type Persona = { name: string; description: string; painPoints?: string[]; motivators?: string[] };

export default function AdsHubBrain() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/ads/context"] });
  const [draft, setDraft] = useState<any>(null);
  useEffect(() => { if (data) setDraft(JSON.parse(JSON.stringify(data))); }, [data]);

  const save = useMutation({
    mutationFn: (body: any) => apiRequest("/api/admin/ads/context", "PATCH", body).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/context"] }); toast({ title: "Marketing Brain saved" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
  const reset = useMutation({
    mutationFn: () => apiRequest("/api/admin/ads/context/reset", "POST").then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/ads/context"] }); toast({ title: "Reset to defaults" }); },
  });

  if (isLoading || !draft) return <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  const update = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const features: Feature[] = draft.features || [];
  const personas: Persona[] = draft.audiencePersonas || [];
  const arr = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

  return (
    <div className="space-y-4" data-testid="ads-brain">
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Brain className="w-4 h-4 text-violet-400" /> Marketing Brain</CardTitle>
            <p className="text-xs text-muted-foreground">The AI uses this for every draft. The richer this is, the better the ads.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => save.mutate(draft)} disabled={save.isPending} data-testid="btn-save-brain">
              {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Brand basics</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">App name</Label><Input value={draft.appName || ""} onChange={e => update("appName", e.target.value)} /></div>
            <div><Label className="text-xs">Tagline</Label><Input value={draft.tagline || ""} onChange={e => update("tagline", e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Pitch (1–2 paragraphs the AI quotes from)</Label><Textarea rows={5} value={draft.pitch || ""} onChange={e => update("pitch", e.target.value)} data-testid="textarea-pitch" /></div>
          <div><Label className="text-xs">Unique value (why we win vs. competitors)</Label><Textarea rows={3} value={draft.uniqueValue || ""} onChange={e => update("uniqueValue", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Geographic focus</Label><Input value={draft.geographicFocus || ""} onChange={e => update("geographicFocus", e.target.value)} /></div>
            <div><Label className="text-xs">Languages (comma-sep)</Label><Input value={(draft.languages || []).join(", ")} onChange={e => update("languages", arr(e.target.value))} /></div>
          </div>
          <div><Label className="text-xs">Competitors / why we win</Label><Textarea rows={2} value={draft.competitors || ""} onChange={e => update("competitors", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Features the AI knows about ({features.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => update("features", [...features, { name: "", description: "", audienceFit: "" }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add feature
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="border rounded p-2 space-y-2" data-testid={`feature-${i}`}>
              <div className="flex gap-2">
                <Input placeholder="Feature name" value={f.name} onChange={e => { const c = [...features]; c[i] = { ...f, name: e.target.value }; update("features", c); }} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => update("features", features.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
              </div>
              <Textarea rows={2} placeholder="What it does" value={f.description} onChange={e => { const c = [...features]; c[i] = { ...f, description: e.target.value }; update("features", c); }} />
              <Input placeholder="Audience fit (e.g. Tourists, locals, dancers)" value={f.audienceFit || ""} onChange={e => { const c = [...features]; c[i] = { ...f, audienceFit: e.target.value }; update("features", c); }} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Audience personas ({personas.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => update("audiencePersonas", [...personas, { name: "", description: "", painPoints: [], motivators: [] }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add persona
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {personas.map((p, i) => (
            <div key={i} className="border rounded p-2 space-y-2" data-testid={`persona-${i}`}>
              <div className="flex gap-2">
                <Input placeholder="Persona name (e.g. City explorer 16-35)" value={p.name} onChange={e => { const c = [...personas]; c[i] = { ...p, name: e.target.value }; update("audiencePersonas", c); }} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => update("audiencePersonas", personas.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
              </div>
              <Textarea rows={2} placeholder="Description" value={p.description} onChange={e => { const c = [...personas]; c[i] = { ...p, description: e.target.value }; update("audiencePersonas", c); }} />
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px]">Pain points (comma-sep)</Label><Input value={(p.painPoints || []).join(", ")} onChange={e => { const c = [...personas]; c[i] = { ...p, painPoints: arr(e.target.value) }; update("audiencePersonas", c); }} /></div>
                <div><Label className="text-[10px]">Motivators (comma-sep)</Label><Input value={(p.motivators || []).join(", ")} onChange={e => { const c = [...personas]; c[i] = { ...p, motivators: arr(e.target.value) }; update("audiencePersonas", c); }} /></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4" /> Voice & guardrails</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Brand voice</Label><Textarea rows={3} value={draft.brandVoice || ""} onChange={e => update("brandVoice", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">DO say (comma-sep)</Label>
              <Textarea rows={2} value={(draft.doSay || []).join(", ")} onChange={e => update("doSay", arr(e.target.value))} />
              <div className="flex flex-wrap gap-1 mt-1">{(draft.doSay || []).map((s: string) => <Badge key={s} className="bg-green-500/20 text-green-300 text-[10px]">{s}</Badge>)}</div>
            </div>
            <div>
              <Label className="text-xs">DON'T say (comma-sep)</Label>
              <Textarea rows={2} value={(draft.dontSay || []).join(", ")} onChange={e => update("dontSay", arr(e.target.value))} />
              <div className="flex flex-wrap gap-1 mt-1">{(draft.dontSay || []).map((s: string) => <Badge key={s} variant="outline" className="text-[10px] line-through">{s}</Badge>)}</div>
            </div>
          </div>
          <div><Label className="text-xs">Example of copy that works for you (one paragraph)</Label><Textarea rows={3} value={draft.exampleWinningCopy || ""} onChange={e => update("exampleWinningCopy", e.target.value)} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
