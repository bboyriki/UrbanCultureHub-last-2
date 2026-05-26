import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Sparkles, Users, Dna, Star, Zap, TrendingUp,
  Activity, Mic2, Copy, RefreshCw, Flame, Music, Brain
} from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DISCIPLINES = ["breaking", "djing", "graffiti", "beatboxing", "freestyle rap", "popping", "locking", "krumping", "waacking", "house"];

function ProgressBar({ value, label, color = "bg-purple-500" }: { value: number; label: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function CultureToolsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [matchForm, setMatchForm] = useState({ discipline: "breaking", skills: "", bio: "", lookingFor: "" });
  const [matchResult, setMatchResult] = useState<any>(null);

  const [dnaForm, setDnaForm] = useState({ discipline: "breaking", bio: "", skills: "", favoriteMoves: "", influences: "", yearsActive: "" });
  const [dnaResult, setDnaResult] = useState<any>(null);

  const [syncForm, setSyncForm] = useState({ bpm: "90", videoDuration: "30", genre: "hip-hop" });
  const [syncResult, setSyncResult] = useState<any>(null);

  const [freestyleForm, setFreestyleForm] = useState({ topic: "", mood: "hype", style: "battle rap", bars: "8" });
  const [freestyleResult, setFreestyleResult] = useState<any>(null);
  const [copiedLyrics, setCopiedLyrics] = useState(false);

  const matchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/style-match", "POST", data).then((r: any) => r.json ? r.json() : r),
    onSuccess: (data: any) => setMatchResult(data),
    onError: () => toast({ title: "Style Match failed", variant: "destructive" }),
  });

  const dnaMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/style-dna", "POST", data).then((r: any) => r.json ? r.json() : r),
    onSuccess: (data: any) => setDnaResult(data),
    onError: () => toast({ title: "Style DNA failed", variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/sync-to-beat", "POST", data).then((r: any) => r.json ? r.json() : r),
    onSuccess: (data: any) => setSyncResult(data),
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const freestyleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/freestyle-generator", "POST", data).then((r: any) => r.json ? r.json() : r),
    onSuccess: (data: any) => setFreestyleResult(data),
    onError: () => toast({ title: "Freestyle generation failed", variant: "destructive" }),
  });

  const copyLyrics = () => {
    if (freestyleResult?.lyrics) {
      navigator.clipboard.writeText(freestyleResult.lyrics);
      setCopiedLyrics(true);
      setTimeout(() => setCopiedLyrics(false), 2000);
      toast({ title: "Copied to clipboard!" });
    }
  };

  const dnaBreakdownColors: Record<string, string> = {
    power: "bg-red-500", musicality: "bg-blue-500", creativity: "bg-purple-500",
    technicalPrecision: "bg-cyan-500", footwork: "bg-green-500", freezeGame: "bg-orange-500",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-violet-950/30 to-gray-950 border-b border-border/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,_#7c3aed22,_transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
        <div className="absolute top-6 right-12 text-8xl opacity-5 font-black select-none rotate-12">AI</div>
        <div className="container mx-auto px-4 py-10 relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">AI-Powered</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
            Culture <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Tools</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-lg">
            AI-powered creative tools built for the urban culture community. Style analysis, collaboration matching, beat sync, and lyric generation.
          </p>
          <div className="mt-3"><CultureSectionInfo section="culture-tools" /></div>
          <div className="flex gap-3 mt-4">
            {[
              { icon: Users, label: "Style Match", color: "text-violet-400" },
              { icon: Dna, label: "Style DNA", color: "text-green-400" },
              { icon: Zap, label: "Beat Sync", color: "text-yellow-400" },
              { icon: Mic2, label: "Freestyle Gen", color: "text-orange-400" },
            ].map(tool => {
              const Icon = tool.icon;
              return (
                <div key={tool.label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300">
                  <Icon className={cn("w-3.5 h-3.5", tool.color)} />
                  <span className="hidden sm:inline">{tool.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="style-match">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1 rounded-xl">
            <TabsTrigger value="style-match" className="flex flex-col sm:flex-row items-center gap-1 text-[11px] sm:text-sm py-2.5">
              <Users className="w-4 h-4" />
              <span>Style Match</span>
            </TabsTrigger>
            <TabsTrigger value="style-dna" className="flex flex-col sm:flex-row items-center gap-1 text-[11px] sm:text-sm py-2.5">
              <Dna className="w-4 h-4" />
              <span>Style DNA</span>
            </TabsTrigger>
            <TabsTrigger value="sync-beat" className="flex flex-col sm:flex-row items-center gap-1 text-[11px] sm:text-sm py-2.5">
              <Zap className="w-4 h-4" />
              <span>Beat Sync</span>
            </TabsTrigger>
            <TabsTrigger value="freestyle" className="flex flex-col sm:flex-row items-center gap-1 text-[11px] sm:text-sm py-2.5">
              <Mic2 className="w-4 h-4" />
              <span>Freestyle</span>
            </TabsTrigger>
          </TabsList>

          {/* Style Match */}
          <TabsContent value="style-match" className="mt-5 space-y-4">
            <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <Users className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Find Your Collab Match</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">AI finds community members whose style complements yours</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label>Your Discipline</Label>
                    <Select value={matchForm.discipline} onValueChange={v => setMatchForm(f => ({ ...f, discipline: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Your Skills / Specialties</Label>
                    <Textarea value={matchForm.skills} onChange={e => setMatchForm(f => ({ ...f, skills: e.target.value }))} rows={2} placeholder="e.g. power moves, windmills, musicality, transitions" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Short Bio</Label>
                    <Textarea value={matchForm.bio} onChange={e => setMatchForm(f => ({ ...f, bio: e.target.value }))} rows={2} placeholder="Tell us about yourself..." />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Looking For</Label>
                    <Input value={matchForm.lookingFor} onChange={e => setMatchForm(f => ({ ...f, lookingFor: e.target.value }))} placeholder="e.g. DJ to practice with, graffiti collab, dance battle partner" />
                  </div>
                </div>
                <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => matchMutation.mutate(matchForm)} disabled={matchMutation.isPending} data-testid="btn-style-match">
                  {matchMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Finding matches...</> : <><Sparkles className="w-4 h-4 mr-2" /> Find My Matches</>}
                </Button>
              </CardContent>
            </Card>

            {matchResult && (
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" /> Your Top Matches</h3>
                {matchResult.matches?.map((match: any, i: number) => (
                  <Card key={match.userId} data-testid={`match-card-${match.userId}`} className="border-violet-500/20 hover:border-violet-500/40 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {match.avatarUrl ? (
                            <img src={match.avatarUrl} alt={match.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {match.name?.charAt(0)}
                            </div>
                          )}
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold">{match.name}</div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <Badge variant="outline" className="capitalize text-xs">{match.discipline}</Badge>
                            <Badge className="bg-violet-600 text-white text-xs">{match.matchScore}% match</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{match.reason}</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full" style={{ width: `${match.matchScore}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!matchResult.matches?.length && (
                  <div className="text-center py-6 text-muted-foreground text-sm">No matches found. Try updating your profile with more details.</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Style DNA */}
          <TabsContent value="style-dna" className="mt-5 space-y-4">
            <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Dna className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Decode Your Style DNA</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">AI analyzes your style and builds your unique profile</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Discipline</Label>
                    <Select value={dnaForm.discipline} onValueChange={v => setDnaForm(f => ({ ...f, discipline: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Years Active</Label>
                    <Input value={dnaForm.yearsActive} onChange={e => setDnaForm(f => ({ ...f, yearsActive: e.target.value }))} placeholder="e.g. 5" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Bio / Background</Label>
                    <Textarea value={dnaForm.bio} onChange={e => setDnaForm(f => ({ ...f, bio: e.target.value }))} rows={2} placeholder="How did you start, what's your journey..." />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Signature Moves / Techniques</Label>
                    <Textarea value={dnaForm.skills} onChange={e => setDnaForm(f => ({ ...f, skills: e.target.value }))} rows={2} placeholder="e.g. airflares, headspins, transition game..." />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Influences / Inspirations</Label>
                    <Input value={dnaForm.influences} onChange={e => setDnaForm(f => ({ ...f, influences: e.target.value }))} placeholder="e.g. Hong 10, Lilou, AI Bboy, ..." />
                  </div>
                </div>
                <Button className="w-full bg-green-700 hover:bg-green-600" onClick={() => dnaMutation.mutate(dnaForm)} disabled={dnaMutation.isPending} data-testid="btn-style-dna">
                  {dnaMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</> : <><Dna className="w-4 h-4 mr-2" /> Generate My Style DNA</>}
                </Button>
              </CardContent>
            </Card>

            {dnaResult && (
              <Card className="border-green-500/30 bg-gradient-to-br from-green-950/20 to-emerald-950/10" data-testid="dna-result">
                <CardContent className="pt-6 space-y-5">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🧬</div>
                    <div className="text-2xl font-black text-green-400">{dnaResult.styleTitle}</div>
                    <div className="flex flex-wrap justify-center gap-2 mt-3">
                      {dnaResult.dnaStrands?.map((strand: string) => (
                        <Badge key={strand} className="bg-green-600 text-white">{strand}</Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground text-center italic">{dnaResult.description}</p>
                  {dnaResult.breakdown && (
                    <div className="space-y-2.5">
                      <div className="text-sm font-semibold">Style Breakdown</div>
                      {Object.entries(dnaResult.breakdown).map(([key, val]: any) => (
                        <ProgressBar key={key} label={key.replace(/([A-Z])/g, ' $1').trim()} value={val} color={dnaBreakdownColors[key] || "bg-green-500"} />
                      ))}
                    </div>
                  )}
                  {dnaResult.comparisons?.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold mb-2">Your Style Echoes</div>
                      <div className="flex gap-2 flex-wrap">
                        {dnaResult.comparisons.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}
                      </div>
                    </div>
                  )}
                  {dnaResult.growthTip && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-400 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Growth Tip</div>
                      <p className="text-sm">{dnaResult.growthTip}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Sync to Beat */}
          <TabsContent value="sync-beat" className="mt-5 space-y-4">
            <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Sync to Beat</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Calculate perfect cut points for your reel based on BPM</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>BPM</Label>
                    <Input type="number" value={syncForm.bpm} onChange={e => setSyncForm(f => ({ ...f, bpm: e.target.value }))} placeholder="90" data-testid="input-bpm" />
                  </div>
                  <div className="space-y-1">
                    <Label>Video Length (s)</Label>
                    <Input type="number" value={syncForm.videoDuration} onChange={e => setSyncForm(f => ({ ...f, videoDuration: e.target.value }))} placeholder="30" />
                  </div>
                  <div className="space-y-1">
                    <Label>Genre</Label>
                    <Select value={syncForm.genre} onValueChange={v => setSyncForm(f => ({ ...f, genre: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                        <SelectItem value="dnb">DnB</SelectItem>
                        <SelectItem value="house">House</SelectItem>
                        <SelectItem value="trap">Trap</SelectItem>
                        <SelectItem value="breakbeat">Breakbeat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full bg-yellow-600 hover:bg-yellow-500 text-black" onClick={() => syncMutation.mutate(syncForm)} disabled={syncMutation.isPending} data-testid="btn-sync-beat">
                  {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />} Calculate Sync Points
                </Button>
              </CardContent>
            </Card>

            {syncResult && (
              <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-transparent" data-testid="sync-result">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-yellow-400" /> Sync Points for {syncResult.bpm} BPM</CardTitle>
                  <p className="text-xs text-muted-foreground">{syncResult.tip}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {syncResult.syncPoints?.map((pt: any) => (
                      <div key={pt.time} data-testid={`sync-point-${pt.beat}`} className="text-center bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 hover:bg-yellow-500/20 transition-colors cursor-default">
                        <div className="text-[10px] text-muted-foreground">{pt.label}</div>
                        <div className="font-bold text-yellow-400">{pt.time}s</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Cut your video at these timestamps to stay perfectly on beat. Every marker = {(60/syncResult.bpm).toFixed(2)}s per beat.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Freestyle Generator */}
          <TabsContent value="freestyle" className="mt-5 space-y-4">
            <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                    <Mic2 className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Freestyle Generator</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">AI-generated bars and rhymes for your freestyle battles</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label>Topic / Theme</Label>
                    <Input
                      value={freestyleForm.topic}
                      onChange={e => setFreestyleForm(f => ({ ...f, topic: e.target.value }))}
                      placeholder="e.g. street life, breaking battles, my crew, Amsterdam…"
                      data-testid="input-freestyle-topic"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Vibe / Mood</Label>
                    <Select value={freestyleForm.mood} onValueChange={v => setFreestyleForm(f => ({ ...f, mood: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hype">Hype 🔥</SelectItem>
                        <SelectItem value="chill">Chill 😌</SelectItem>
                        <SelectItem value="battle">Battle 🥊</SelectItem>
                        <SelectItem value="motivational">Motivational 💪</SelectItem>
                        <SelectItem value="storytelling">Storytelling 📖</SelectItem>
                        <SelectItem value="braggadocious">Braggadocious 👑</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Style</Label>
                    <Select value={freestyleForm.style} onValueChange={v => setFreestyleForm(f => ({ ...f, style: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="battle rap">Battle Rap</SelectItem>
                        <SelectItem value="old school hip-hop">Old School</SelectItem>
                        <SelectItem value="trap">Trap</SelectItem>
                        <SelectItem value="conscious hip-hop">Conscious</SelectItem>
                        <SelectItem value="lyrical">Lyrical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Number of Bars</Label>
                    <Select value={freestyleForm.bars} onValueChange={v => setFreestyleForm(f => ({ ...f, bars: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 bars (quick)</SelectItem>
                        <SelectItem value="8">8 bars (verse)</SelectItem>
                        <SelectItem value="16">16 bars (full)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => freestyleMutation.mutate(freestyleForm)}
                  disabled={freestyleMutation.isPending || !freestyleForm.topic.trim()}
                  data-testid="btn-freestyle-generate"
                >
                  {freestyleMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating bars...</>
                    : <><Flame className="w-4 h-4 mr-2" /> Generate Freestyle</>
                  }
                </Button>
              </CardContent>
            </Card>

            {freestyleResult && (
              <Card className="border-orange-500/30 bg-gradient-to-br from-orange-950/20 to-red-950/10" data-testid="freestyle-result">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mic2 className="w-4 h-4 text-orange-400" /> Your Freestyle
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => freestyleMutation.mutate(freestyleForm)}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={copyLyrics} data-testid="btn-copy-lyrics">
                        <Copy className="w-3.5 h-3.5 mr-1" /> {copiedLyrics ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {freestyleResult.lyrics && (
                    <div className="bg-black/20 rounded-xl p-4 font-mono text-sm leading-relaxed whitespace-pre-line text-foreground border border-orange-500/20">
                      {freestyleResult.lyrics}
                    </div>
                  )}
                  {freestyleResult.tip && (
                    <div className="mt-3 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <div className="text-xs font-semibold text-orange-400 mb-1 flex items-center gap-1">
                        <Music className="w-3 h-3" /> Flow Tip
                      </div>
                      <p className="text-xs text-muted-foreground">{freestyleResult.tip}</p>
                    </div>
                  )}
                  {freestyleResult.rhymeScheme && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rhyme scheme:</span>
                      <Badge variant="outline" className="text-xs">{freestyleResult.rhymeScheme}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
