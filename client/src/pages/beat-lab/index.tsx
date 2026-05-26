import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Music, Plus, Play, Radio, Upload, Clock, Headphones, Zap, SkipForward } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const GENRES = ["hip-hop", "dnb", "house", "techno", "jungle", "trap", "boom bap", "footwork", "grime", "afrobeats"];

function AudioPlayer({ src, title, onPlay }: { src: string; title: string; onPlay?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); onPlay?.(); }
  };

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} onTimeUpdate={() => {
        if (audioRef.current) setProgress(audioRef.current.currentTime / audioRef.current.duration * 100);
      }} />
      <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0" onClick={toggle} data-testid="btn-play-audio">
        {playing ? <span className="text-xs">⏸</span> : <Play className="w-3.5 h-3.5" />}
      </Button>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function RadioPlayer({ tracks }: { tracks: any[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const current = tracks[currentIdx];

  const nextTrack = () => setCurrentIdx(i => (i + 1) % tracks.length);
  useEffect(() => { if (audioRef.current && playing) audioRef.current.play(); }, [currentIdx]);

  if (!current) return <div className="text-center py-8 text-muted-foreground text-sm">No tracks in the playlist yet.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-gradient-to-r from-purple-900/30 to-blue-900/20 rounded-xl p-4">
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-2xl shrink-0">
          {current.cover_url ? <img src={current.cover_url} alt="" className="w-full h-full object-cover rounded-lg" /> : "🎵"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{current.title}</div>
          <div className="text-sm text-muted-foreground">{current.artist || current.display_name}</div>
          <Badge variant="outline" className="capitalize text-xs mt-1">{current.genre}</Badge>
        </div>
        <audio ref={audioRef} src={current.audio_url} onEnded={nextTrack} onTimeUpdate={() => {
          if (audioRef.current) setProgress(audioRef.current.currentTime / audioRef.current.duration * 100);
        }} />
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" onClick={() => { if (!audioRef.current) return; if (playing) { audioRef.current.pause(); setPlaying(false); } else { audioRef.current.play(); setPlaying(true); } }} data-testid="btn-radio-play">
            {playing ? <span>⏸</span> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={nextTrack}><SkipForward className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} /></div>
      <div className="text-xs text-muted-foreground text-center">Track {currentIdx + 1} of {tracks.length} · Community Radio</div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {tracks.map((t: any, i: number) => (
          <div key={t.id} onClick={() => setCurrentIdx(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${i === currentIdx ? "bg-purple-500/10 border border-purple-500/30" : ""}`}>
            <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{t.title}</div><div className="text-xs text-muted-foreground">{t.artist || t.display_name}</div></div>
            <Badge variant="outline" className="capitalize text-xs">{t.genre}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BeatLabPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [beatDialog, setBeatDialog] = useState(false);
  const [radioDialog, setRadioDialog] = useState(false);
  const [beatForm, setBeatForm] = useState({ title: "", genre: "hip-hop", bpm: "90", audioUrl: "", coverUrl: "" });
  const [radioForm, setRadioForm] = useState({ title: "", artist: "", genre: "hip-hop", audioUrl: "", coverUrl: "" });
  const setB = (k: string, v: any) => setBeatForm(f => ({ ...f, [k]: v }));
  const setR = (k: string, v: any) => setRadioForm(f => ({ ...f, [k]: v }));

  const { data: beats, isLoading: loadingBeats } = useQuery<any[]>({ queryKey: ["/api/beats"] });
  const { data: radioTracks, isLoading: loadingRadio } = useQuery<any[]>({ queryKey: ["/api/radio"] });

  const beatMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/beats", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/beats"] }); setBeatDialog(false); toast({ title: "Beat shared! +30 Cred 🎵" }); },
    onError: () => toast({ title: "Failed to share beat", variant: "destructive" }),
  });

  const radioMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/radio", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/radio"] }); setRadioDialog(false); toast({ title: isAdmin ? "Track added to radio! 📻" : "Mix submitted for review! 📻 +20 Cred" }); },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const playMutation = useMutation({ mutationFn: (id: number) => apiRequest(`/api/beats/${id}/play`, "POST") });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Music className="w-6 h-6 text-green-400" /> Beat Lab & Radio</h1>
          <div className="mt-2"><CultureSectionInfo section="beat-lab" /></div>
          <p className="text-muted-foreground text-sm">Share beats, find loops, tune into the community radio.</p>
        </div>
      </div>

      <Tabs defaultValue="beats">
        <TabsList>
          <TabsTrigger value="beats" className="flex items-center gap-1.5"><Music className="w-4 h-4" /> Beat Lab</TabsTrigger>
          <TabsTrigger value="radio" className="flex items-center gap-1.5"><Radio className="w-4 h-4" /> Community Radio</TabsTrigger>
        </TabsList>

        {/* Beat Lab */}
        <TabsContent value="beats" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {user && (
              <Dialog open={beatDialog} onOpenChange={setBeatDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="btn-share-beat"><Plus className="w-4 h-4 mr-1" /> Share Beat</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share a Beat</DialogTitle>
                    <DialogDescription className="sr-only">Upload your beat with title, genre, BPM and audio URL.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label>Title *</Label><Input value={beatForm.title} onChange={e => setB("title", e.target.value)} placeholder="e.g. Concrete Loop #7" data-testid="input-beat-title" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Genre</Label>
                        <Select value={beatForm.genre} onValueChange={v => setB("genre", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>BPM</Label><Input type="number" value={beatForm.bpm} onChange={e => setB("bpm", e.target.value)} /></div>
                    </div>
                    <div className="space-y-1"><Label>Audio URL *</Label><Input value={beatForm.audioUrl} onChange={e => setB("audioUrl", e.target.value)} placeholder="Direct MP3 / SoundCloud / Cloudinary URL" data-testid="input-beat-url" /></div>
                    <div className="space-y-1"><Label>Cover Image URL</Label><Input value={beatForm.coverUrl} onChange={e => setB("coverUrl", e.target.value)} placeholder="https://..." /></div>
                    <Button className="w-full" onClick={() => beatMutation.mutate({ ...beatForm, bpm: parseInt(beatForm.bpm) })} disabled={!beatForm.title || !beatForm.audioUrl || beatMutation.isPending} data-testid="btn-submit-beat">
                      {beatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Share Beat
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {loadingBeats ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {beats?.map((beat: any) => (
                <Card key={beat.id} data-testid={`beat-card-${beat.id}`}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-900 to-emerald-800 flex items-center justify-center text-xl shrink-0">
                        {beat.cover_url ? <img src={beat.cover_url} alt="" className="w-full h-full object-cover rounded-lg" /> : "🎵"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{beat.title}</div>
                        <div className="text-xs text-muted-foreground">{beat.display_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="capitalize text-xs">{beat.genre}</Badge>
                          {beat.bpm && <span className="text-xs text-muted-foreground">{beat.bpm} BPM</span>}
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Play className="w-2.5 h-2.5" />{beat.play_count}</span>
                        </div>
                      </div>
                    </div>
                    <AudioPlayer src={beat.audio_url} title={beat.title} onPlay={() => playMutation.mutate(beat.id)} />
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(beat.created_at), { addSuffix: true })}</div>
                  </CardContent>
                </Card>
              ))}
              {!beats?.length && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No beats shared yet. Drop the first one!</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Community Radio */}
        <TabsContent value="radio" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {user && (
              <Dialog open={radioDialog} onOpenChange={setRadioDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="btn-submit-radio"><Upload className="w-4 h-4 mr-1" /> {isAdmin ? "Add to Radio" : "Submit Mix"}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{isAdmin ? "Add Track to Radio" : "Submit Your Mix"}</DialogTitle>
                    <DialogDescription className="sr-only">{isAdmin ? "Add a new track to the community radio playlist." : "Submit your mix for admin review to go on air."}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label>Title *</Label><Input value={radioForm.title} onChange={e => setR("title", e.target.value)} placeholder="e.g. Late Night Cypher Vol. 2" data-testid="input-radio-title" /></div>
                    <div className="space-y-1"><Label>DJ / Artist</Label><Input value={radioForm.artist} onChange={e => setR("artist", e.target.value)} placeholder="Your name or alias" /></div>
                    <div className="space-y-1"><Label>Genre</Label>
                      <Select value={radioForm.genre} onValueChange={v => setR("genre", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{GENRES.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Audio URL *</Label><Input value={radioForm.audioUrl} onChange={e => setR("audioUrl", e.target.value)} placeholder="Direct MP3 / Mixcloud / Cloudinary URL" data-testid="input-radio-url" /></div>
                    <div className="space-y-1"><Label>Cover URL</Label><Input value={radioForm.coverUrl} onChange={e => setR("coverUrl", e.target.value)} placeholder="https://..." /></div>
                    {!isAdmin && <p className="text-xs text-muted-foreground">Your mix will be reviewed by an admin before going live.</p>}
                    <Button className="w-full" onClick={() => radioMutation.mutate(radioForm)} disabled={!radioForm.title || !radioForm.audioUrl || radioMutation.isPending} data-testid="btn-submit-radio-confirm">
                      {radioMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} {isAdmin ? "Add Track" : "Submit for Review"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {loadingRadio ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5 text-purple-400" /> 📻 Urban Culture Radio</CardTitle></CardHeader>
              <CardContent><RadioPlayer tracks={radioTracks ?? []} /></CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
