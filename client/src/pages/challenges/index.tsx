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
import { Loader2, Zap, Trophy, ThumbsUp, Upload, Plus, Clock } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isAfter, isBefore } from "date-fns";

const DISCIPLINES = ["breaking", "djing", "graffiti", "beatboxing", "freestyle rap", "popping", "locking", "mixed"];

export default function ChallengesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [newChallenge, setNewChallenge] = useState({ title: "", description: "", theme: "", discipline: "breaking", startDate: "", endDate: "" });
  const setNC = (k: string, v: any) => setNewChallenge(f => ({ ...f, [k]: v }));

  const { data: active, isLoading: loadingActive } = useQuery<any>({ queryKey: ["/api/challenges/active"] });
  const { data: entries, isLoading: loadingEntries } = useQuery<any[]>({
    queryKey: ["/api/challenges", active?.id, "entries"],
    queryFn: () => fetch(`/api/challenges/${active?.id}/entries`).then(r => r.json()),
    enabled: !!active?.id,
  });
  const { data: allChallenges } = useQuery<any[]>({ queryKey: ["/api/challenges"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/challenges", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges"] }); queryClient.invalidateQueries({ queryKey: ["/api/challenges/active"] }); setCreateOpen(false); toast({ title: "Challenge created! 🎯" }); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/challenges/${active?.id}/entries`, "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/challenges", active?.id, "entries"] }); setSubmitOpen(false); setVideoUrl(""); setCaption(""); toast({ title: "Entry submitted! +25 Cred 🎯" }); },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const voteMutation = useMutation({
    mutationFn: (entryId: number) => apiRequest(`/api/challenges/entries/${entryId}/vote`, "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/challenges", active?.id, "entries"] }),
    onError: () => toast({ title: "Failed to vote", variant: "destructive" }),
  });

  const now = new Date();
  const timeLeft = active ? formatDistanceToNow(new Date(active.end_date), { addSuffix: true }) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Zap className="w-6 h-6 text-yellow-400" /> Freestyle Challenges</h1>
          <div className="mt-2"><CultureSectionInfo section="challenges" /></div>
          <p className="text-muted-foreground text-sm">Weekly themes. Community votes. One winner.</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="btn-create-challenge"><Plus className="w-4 h-4 mr-1" /> New Challenge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Weekly Challenge</DialogTitle>
                <DialogDescription className="sr-only">Set up a new weekly challenge for the community.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Title *</Label><Input value={newChallenge.title} onChange={e => setNC("title", e.target.value)} placeholder="e.g. Floor Work Friday" /></div>
                <div className="space-y-1"><Label>Theme</Label><Input value={newChallenge.theme} onChange={e => setNC("theme", e.target.value)} placeholder="e.g. No Hands" /></div>
                <div className="space-y-1"><Label>Description *</Label><Textarea value={newChallenge.description} onChange={e => setNC("description", e.target.value)} rows={2} /></div>
                <div className="space-y-1"><Label>Discipline</Label>
                  <Select value={newChallenge.discipline} onValueChange={v => setNC("discipline", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Start *</Label><Input type="datetime-local" value={newChallenge.startDate} onChange={e => setNC("startDate", e.target.value)} /></div>
                  <div className="space-y-1"><Label>End *</Label><Input type="datetime-local" value={newChallenge.endDate} onChange={e => setNC("endDate", e.target.value)} /></div>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate(newChallenge)} disabled={!newChallenge.title || !newChallenge.description || createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Challenge
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active Challenge */}
      {loadingActive ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : active ? (
        <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-yellow-500 text-black animate-pulse">🔴 LIVE</Badge>
                  <Badge variant="outline" className="capitalize">{active.discipline}</Badge>
                  {active.theme && <Badge variant="outline">Theme: {active.theme}</Badge>}
                </div>
                <h2 className="text-xl font-black">{active.title}</h2>
                <p className="text-muted-foreground text-sm mt-1">{active.description}</p>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> Ends {timeLeft}
                </div>
              </div>
              {user && (
                <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="btn-submit-entry"><Upload className="w-4 h-4 mr-1" /> Submit Entry</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Submit Your Entry</DialogTitle>
                      <DialogDescription className="sr-only">Submit a video entry for the active challenge.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1"><Label>Video URL *</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube, Vimeo, or Cloudinary URL" data-testid="input-entry-url" /></div>
                      <div className="space-y-1"><Label>Caption</Label><Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="Say something about your entry..." /></div>
                      <Button className="w-full" onClick={() => submitMutation.mutate({ videoUrl, caption })} disabled={!videoUrl || submitMutation.isPending} data-testid="btn-submit-entry-confirm">
                        {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Submit
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12 text-muted-foreground">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No active challenge right now. Check back soon!</p>
          </CardContent>
        </Card>
      )}

      {/* Entries */}
      {active && (
        <div className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Entries ({entries?.length ?? 0})</h2>
          {loadingEntries ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {entries?.map((entry: any, idx: number) => (
                <Card key={entry.id} data-testid={`entry-card-${entry.id}`} className={idx === 0 ? "border-yellow-500/40" : ""}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      {entry.avatar_url ? <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : (
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">{entry.display_name?.charAt(0)}</div>
                      )}
                      <div>
                        <div className="font-medium text-sm">{entry.display_name}</div>
                        <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</div>
                      </div>
                      {idx === 0 && <Badge className="ml-auto bg-yellow-500 text-black">🥇 Top</Badge>}
                    </div>
                    {entry.caption && <p className="text-sm text-muted-foreground">{entry.caption}</p>}
                    <div className="aspect-video bg-muted rounded overflow-hidden">
                      <iframe src={entry.video_url} className="w-full h-full" allowFullScreen title="entry video" />
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => voteMutation.mutate(entry.id)} data-testid={`btn-vote-${entry.id}`}>
                      <ThumbsUp className="w-4 h-4 mr-1" /> Vote · {entry.vote_count}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {!entries?.length && (
                <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No entries yet. Be the first!</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past Challenges */}
      {allChallenges && allChallenges.filter(c => c.status !== "active" || isBefore(new Date(c.end_date), now)).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-bold text-base text-muted-foreground">Past Challenges</h2>
          <div className="space-y-2">
            {allChallenges.filter(c => isBefore(new Date(c.end_date), now) && c.id !== active?.id).map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 border border-border/50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground capitalize">{c.discipline} · ended {formatDistanceToNow(new Date(c.end_date), { addSuffix: true })}</div>
                </div>
                <Badge variant="secondary">Ended</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
