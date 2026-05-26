import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Plus, Flame, Clock, Users, X } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isBefore } from "date-fns";

const DISCIPLINES = ["breaking", "djing", "graffiti", "beatboxing", "freestyle rap", "popping", "locking", "mixed"];

const DISCIPLINE_COLORS: Record<string, string> = {
  breaking: "bg-orange-500", djing: "bg-blue-500", graffiti: "bg-green-500",
  beatboxing: "bg-yellow-500", "freestyle rap": "bg-purple-500", popping: "bg-pink-500",
  locking: "bg-red-500", mixed: "bg-cyan-500",
};

export default function CyphersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", discipline: "breaking", description: "", lat: "", lon: "", locationName: "", startsAt: "", endsAt: "" });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: cyphers, isLoading } = useQuery<any[]>({ queryKey: ["/api/cyphers"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/cyphers", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cyphers"] }); setDialogOpen(false); toast({ title: "Cypher started! 🔥 +20 Cred" }); },
    onError: () => toast({ title: "Failed to start cypher", variant: "destructive" }),
  });

  const endMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/cyphers/${id}`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/cyphers"] }); toast({ title: "Cypher ended" }); },
  });

  const attendMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/cyphers/${id}/attend`, "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cyphers"] }),
  });

  const tryGetLocation = () => {
    navigator.geolocation?.getCurrentPosition(pos => {
      set("lat", pos.coords.latitude.toString());
      set("lon", pos.coords.longitude.toString());
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Flame className="w-6 h-6 text-orange-500" /> Cypher Finder</h1>
          <div className="mt-2"><CultureSectionInfo section="cyphers" /></div>
          <p className="text-muted-foreground text-sm">Live sessions happening near you right now.</p>
        </div>
        {user && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-start-cypher"><Plus className="w-4 h-4 mr-1" /> Start Cypher</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start a Cypher</DialogTitle>
                <DialogDescription className="sr-only">Host a live cypher session by sharing your location and time.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Vondelpark Sunday Session" data-testid="input-cypher-title" /></div>
                <div className="space-y-1"><Label>Discipline</Label>
                  <Select value={form.discipline} onValueChange={v => set("discipline", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} /></div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Location</Label>
                    <Button size="sm" variant="ghost" onClick={tryGetLocation} className="text-xs h-6"><MapPin className="w-3 h-3 mr-1" /> Use My Location</Button>
                  </div>
                  <Input value={form.locationName} onChange={e => set("locationName", e.target.value)} placeholder="Vondelpark, Amsterdam" />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="Latitude" data-testid="input-lat" />
                    <Input value={form.lon} onChange={e => set("lon", e.target.value)} placeholder="Longitude" data-testid="input-lon" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Starts *</Label><Input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)} /></div>
                  <div className="space-y-1"><Label>Ends</Label><Input type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)} /></div>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.lat || !form.startsAt || createMutation.isPending} data-testid="btn-submit-cypher">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Start Cypher
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {cyphers?.map((cyph: any) => {
            const startsIn = formatDistanceToNow(new Date(cyph.starts_at), { addSuffix: true });
            const endsIn = cyph.ends_at ? formatDistanceToNow(new Date(cyph.ends_at), { addSuffix: true }) : null;
            const isLive = isBefore(new Date(cyph.starts_at), new Date());
            const isHost = cyph.host_id === user?.id;

            return (
              <Card key={cyph.id} data-testid={`cypher-card-${cyph.id}`} className="overflow-hidden">
                <div className={`h-1.5 ${DISCIPLINE_COLORS[cyph.discipline] || "bg-purple-500"}`} />
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isLive && <Badge className="bg-red-500 animate-pulse text-xs">🔴 Live</Badge>}
                        <Badge variant="outline" className="capitalize text-xs">{cyph.discipline}</Badge>
                      </div>
                      <h3 className="font-bold mt-1 truncate">{cyph.title}</h3>
                    </div>
                    {isHost && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-red-400" onClick={() => endMutation.mutate(cyph.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {cyph.description && <p className="text-sm text-muted-foreground">{cyph.description}</p>}
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {cyph.location_name && <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{cyph.location_name}</div>}
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{isLive ? `Started ${startsIn}` : `Starts ${startsIn}`}{endsIn ? ` · ends ${endsIn}` : ""}</div>
                    <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{cyph.attendee_count} attending</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      {cyph.host_avatar ? <img src={cyph.host_avatar} alt="" className="w-5 h-5 rounded-full" /> : (
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{cyph.host_name?.charAt(0)}</div>
                      )}
                      <span className="text-xs text-muted-foreground">by {cyph.host_name}</span>
                    </div>
                    {user && !isHost && (
                      <Button size="sm" variant="outline" onClick={() => attendMutation.mutate(cyph.id)} data-testid={`btn-attend-${cyph.id}`}>
                        I'm coming 🔥
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!cyphers?.length && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Flame className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No active cyphers nearby.</p>
              <p className="text-sm mt-1">Start one and light up the streets!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
