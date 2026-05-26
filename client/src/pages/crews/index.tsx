import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Plus, MapPin, Calendar, Search } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DISCIPLINES = ["breaking", "djing", "graffiti", "beatboxing", "freestyle rap", "popping", "locking", "krumping", "waacking", "house", "mixed"];

export default function CrewsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", discipline: "breaking", city: "", country: "Netherlands", foundedYear: "", instagram: "" });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: crews, isLoading } = useQuery<any[]>({ queryKey: ["/api/crews"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/crews", "POST", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      setDialogOpen(false);
      navigate(`/crews/${data.id}`);
      toast({ title: "Crew created! 👑 +50 Cred" });
    },
    onError: () => toast({ title: "Failed to create crew", variant: "destructive" }),
  });

  const filtered = (crews ?? []).filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchDisc = discipline === "all" || c.discipline === discipline;
    return matchSearch && matchDisc;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Users className="w-6 h-6 text-purple-400" /> Crews</h1>
          <div className="mt-2"><CultureSectionInfo section="crews" /></div>
          <p className="text-muted-foreground text-sm mt-0.5">Find your squad. Build your legacy.</p>
        </div>
        {user && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-create-crew"><Plus className="w-4 h-4 mr-1" /> Create Crew</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create a Crew</DialogTitle>
                <DialogDescription className="sr-only">Fill in the details to start your own crew.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1"><Label>Crew Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Concrete Kings" data-testid="input-crew-name" /></div>
                <div className="space-y-1"><Label>Discipline *</Label>
                  <Select value={form.discipline} onValueChange={v => set("discipline", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="What your crew is about..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Amsterdam" /></div>
                  <div className="space-y-1"><Label>Founded Year</Label><Input type="number" value={form.foundedYear} onChange={e => set("foundedYear", e.target.value)} placeholder="2020" /></div>
                </div>
                <div className="space-y-1"><Label>Instagram</Label><Input value={form.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@crewhandle" /></div>
                <Button className="w-full" onClick={() => createMutation.mutate({ ...form, foundedYear: form.foundedYear ? parseInt(form.foundedYear) : undefined })} disabled={!form.name || createMutation.isPending} data-testid="btn-submit-crew">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Crew
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search crews..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-crews" />
        </div>
        <Select value={discipline} onValueChange={setDiscipline}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All disciplines" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All disciplines</SelectItem>
            {DISCIPLINES.map(d => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((crew: any) => (
            <Card key={crew.id} data-testid={`crew-card-${crew.id}`}
              className="cursor-pointer hover:border-purple-500/40 transition-colors group"
              onClick={() => navigate(`/crews/${crew.id}`)}>
              <div className="h-24 bg-gradient-to-br from-purple-900/40 via-blue-900/20 to-black rounded-t-lg overflow-hidden relative">
                {crew.banner_url ? (
                  <img src={crew.banner_url} alt="" className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="flex items-center justify-center h-full text-4xl">🎯</div>
                )}
              </div>
              <CardContent className="pt-3 pb-4 space-y-2">
                <div className="flex items-start gap-2">
                  {crew.logo_url ? (
                    <img src={crew.logo_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-background -mt-6 shadow-md" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-black text-sm border-2 border-background -mt-6 shadow-md">
                      {crew.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{crew.name}</div>
                    <Badge variant="outline" className="capitalize text-xs">{crew.discipline}</Badge>
                  </div>
                </div>
                {crew.description && <p className="text-sm text-muted-foreground line-clamp-2">{crew.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{crew.memberCount} members</span>
                  {crew.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{crew.city}</span>}
                  {crew.founded_year && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{crew.founded_year}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
          {!filtered.length && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No crews found. Be the first to create one!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
