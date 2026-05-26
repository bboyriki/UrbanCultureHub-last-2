import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Plus, Star, Instagram, Pencil, Trash2 } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const DISCIPLINES = ["breaking", "djing", "graffiti", "beatboxing", "freestyle rap", "popping", "locking", "krumping", "waacking", "house"];

function EntryForm({ initial, onSave, onClose }: { initial?: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    discipline: initial?.discipline ?? "breaking",
    city: initial?.city ?? "",
    country: initial?.country ?? "Netherlands",
    bio: initial?.bio ?? "",
    achievement: initial?.achievement ?? "",
    year: initial?.year ?? new Date().getFullYear(),
    imageUrl: initial?.image_url ?? "",
    instagramHandle: initial?.instagram_handle ?? "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="B-Boy name / DJ alias" data-testid="hof-input-name" /></div>
        <div className="space-y-1"><Label>Discipline *</Label>
          <Select value={form.discipline} onValueChange={v => set("discipline", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Year</Label><Input type="number" value={form.year} onChange={e => set("year", parseInt(e.target.value))} /></div>
        <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Amsterdam" /></div>
        <div className="space-y-1"><Label>Country</Label><Input value={form.country} onChange={e => set("country", e.target.value)} /></div>
        <div className="col-span-2 space-y-1"><Label>Achievement *</Label><Textarea value={form.achievement} onChange={e => set("achievement", e.target.value)} placeholder="What makes this person legendary?" rows={2} /></div>
        <div className="col-span-2 space-y-1"><Label>Bio</Label><Textarea value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Their story..." rows={2} /></div>
        <div className="col-span-2 space-y-1"><Label>Photo URL</Label><Input value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)} placeholder="https://..." /></div>
        <div className="col-span-2 space-y-1"><Label>Instagram</Label><Input value={form.instagramHandle} onChange={e => set("instagramHandle", e.target.value)} placeholder="@handle" /></div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} className="flex-1" data-testid="hof-btn-save">Save Entry</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function HallOfFamePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);

  const { data: entries, isLoading } = useQuery<any[]>({ queryKey: ["/api/hall-of-fame"] });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/hall-of-fame", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/hall-of-fame"] }); setDialogOpen(false); toast({ title: "Legend added to the Hall of Fame! 🏆" }); },
    onError: () => toast({ title: "Failed to add entry", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/hall-of-fame/${id}`, "PATCH", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/hall-of-fame"] }); setEditEntry(null); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/hall-of-fame/${id}`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/hall-of-fame"] }); toast({ title: "Entry removed" }); },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="w-9 h-9 text-amber-400" />
          <h1 className="text-3xl font-black tracking-tight">Hall of Fame</h1>
          <Trophy className="w-9 h-9 text-amber-400" />
        </div>
        <p className="text-muted-foreground">Legends of the Dutch urban culture scene. Curated by the community.</p>
        <div className="flex justify-center pt-1"><CultureSectionInfo section="hall-of-fame" /></div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="mt-2" data-testid="hof-btn-add"><Plus className="w-4 h-4 mr-1" /> Induct a Legend</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Induct a Legend</DialogTitle></DialogHeader>
              <EntryForm onSave={(data) => addMutation.mutate(data)} onClose={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries?.map((entry: any) => (
            <Card key={entry.id} data-testid={`hof-card-${entry.id}`} className="group overflow-hidden border-amber-500/10 hover:border-amber-500/40 transition-colors">
              <div className="relative h-48 bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-black overflow-hidden">
                {entry.image_url ? (
                  <img src={entry.image_url} alt={entry.name} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="flex items-center justify-center h-full text-6xl">🏆</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="text-white font-black text-lg leading-tight">{entry.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-amber-500/90 text-black text-xs capitalize">{entry.discipline}</Badge>
                    {entry.year && <span className="text-amber-300 text-xs">{entry.year}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setEditEntry(entry)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteMutation.mutate(entry.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>
              <CardContent className="pt-4 space-y-2">
                {entry.city && <div className="text-xs text-muted-foreground">📍 {entry.city}, {entry.country}</div>}
                <p className="text-sm font-medium leading-snug line-clamp-3">{entry.achievement}</p>
                {entry.bio && <p className="text-xs text-muted-foreground line-clamp-2">{entry.bio}</p>}
                {entry.instagram_handle && (
                  <a href={`https://instagram.com/${entry.instagram_handle.replace("@","")}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300">
                    <Instagram className="w-3 h-3" />{entry.instagram_handle}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
          {!entries?.length && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>The Hall of Fame is empty. Admins can induct legends.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editEntry} onOpenChange={v => !v && setEditEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Entry</DialogTitle></DialogHeader>
          {editEntry && <EntryForm initial={editEntry} onSave={(data) => editMutation.mutate({ id: editEntry.id, data })} onClose={() => setEditEntry(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
