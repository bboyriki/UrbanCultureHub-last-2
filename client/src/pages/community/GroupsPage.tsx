import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Search, Plus, Lock, Globe, MapPin, Music2, Layers,
  Loader2, Star, ChevronRight, Shield, Pencil
} from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";

const DISCIPLINE_OPTIONS = [
  { value: "all", label: "All Disciplines" },
  { value: "breaking", label: "Breaking" },
  { value: "graffiti", label: "Graffiti" },
  { value: "skate", label: "Skate" },
  { value: "hiphop", label: "Hip-Hop" },
  { value: "bmx", label: "BMX" },
  { value: "parkour", label: "Parkour" },
  { value: "dj", label: "DJ / Beats" },
  { value: "rap", label: "Rap / MC" },
  { value: "other", label: "Other" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "topic", label: "Topic" },
  { value: "city", label: "City" },
  { value: "discipline", label: "Discipline" },
  { value: "crew", label: "Crew" },
  { value: "artist", label: "Artist" },
];

const DISCIPLINE_COLORS: Record<string, string> = {
  breaking: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  graffiti: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  skate: "bg-green-500/10 text-green-600 border-green-500/30",
  hiphop: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  bmx: "bg-red-500/10 text-red-600 border-red-500/30",
  parkour: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  dj: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  rap: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

const typeIcon = (type: string) => {
  switch (type) {
    case "city": return <MapPin className="h-3.5 w-3.5" />;
    case "crew": return <Shield className="h-3.5 w-3.5" />;
    case "artist": return <Star className="h-3.5 w-3.5" />;
    case "discipline": return <Layers className="h-3.5 w-3.5" />;
    default: return <Music2 className="h-3.5 w-3.5" />;
  }
};

export default function GroupsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [type, setType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", type: "topic", discipline: "", city: "",
    tags: "", isPrivate: false, coverImage: "",
  });

  const disciplineFilter = discipline !== "all" ? discipline : "";
  const typeFilter = type !== "all" ? type : "";
  const params = new URLSearchParams();
  if (disciplineFilter) params.set("discipline", disciplineFilter);
  if (typeFilter) params.set("type", typeFilter);
  if (search) params.set("search", search);

  const { data: groups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", disciplineFilter, typeFilter, search],
    queryFn: async () => {
      const r = await fetch(`/api/groups?${params.toString()}`);
      return r.json();
    },
  });

  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/my/groups"],
    enabled: !!user,
  });

  const myGroupIds = new Set(myGroups.map((g: any) => g.id));

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/groups", "POST", {
        ...form,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/groups"] });
      toast({ title: "Group created!", description: "It will be visible once approved by our team." });
      setShowCreate(false);
      setForm({ name: "", description: "", type: "topic", discipline: "", city: "", tags: "", isPrivate: false, coverImage: "" });
    },
    onError: (e: any) => toast({ title: "Failed to create group", description: e?.message, variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/groups/${id}/join`, "POST", {});
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/groups"] });
      toast({ title: data.status === "pending" ? "Join request sent" : "Joined!", description: data.message });
    },
    onError: (e: any) => toast({ title: "Failed to join", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Groups
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Connect with crews, disciplines, and local scenes</p>
          <div className="mt-2"><CultureSectionInfo section="groups" /></div>
        </div>
        {user && (
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="button-create-group">
            <Plus className="h-4 w-4" /> Create Group
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-group-search"
          />
        </div>
        <Select value={discipline} onValueChange={setDiscipline}>
          <SelectTrigger className="h-9 w-44" data-testid="select-group-discipline">
            <SelectValue placeholder="Discipline" />
          </SelectTrigger>
          <SelectContent>
            {DISCIPLINE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-36" data-testid="select-group-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* My Groups bar */}
      {myGroups.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Your Groups</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {myGroups.map((g: any) => (
              <button
                key={g.id}
                onClick={() => navigate(`/community/groups/${g.id}`)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-sm font-medium"
                data-testid={`link-my-group-${g.id}`}
              >
                <span>{g.name}</span>
                {g.myRole === "admin" && <Pencil className="h-3 w-3 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Groups grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No groups found</p>
          <p className="text-sm mt-1">Be the first to create one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((g: any) => (
            <Card
              key={g.id}
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/community/groups/${g.id}`)}
              data-testid={`card-group-${g.id}`}
            >
              {g.coverImage && (
                <div className="h-28 overflow-hidden">
                  <img src={g.coverImage} alt={g.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              {!g.coverImage && (
                <div className="h-16 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary/40" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {typeIcon(g.type)}
                      <h3 className="font-semibold text-base truncate">{g.name}</h3>
                      {g.isPrivate && <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      {!g.isPrivate && <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    </div>
                    {g.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {g.discipline && (
                    <Badge variant="outline" className={`text-xs border ${DISCIPLINE_COLORS[g.discipline] || DISCIPLINE_COLORS.other}`}>
                      {g.discipline}
                    </Badge>
                  )}
                  {g.city && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{g.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                    <Users className="h-3 w-3" />{g.memberCount || 0}
                  </span>
                </div>
                {user && !myGroupIds.has(g.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 h-8 text-xs"
                    onClick={e => { e.stopPropagation(); joinMutation.mutate(g.id); }}
                    disabled={joinMutation.isPending}
                    data-testid={`button-join-group-${g.id}`}
                  >
                    {g.isPrivate ? <><Lock className="h-3 w-3 mr-1" />Request to Join</> : "Join Group"}
                  </Button>
                )}
                {myGroupIds.has(g.id) && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
                    <Users className="h-3 w-3" /> Member
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Group Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Amsterdam Breakers"
                className="mt-1 h-9"
                data-testid="input-group-name"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What's this group about?"
                className="mt-1 resize-none"
                rows={3}
                data-testid="input-group-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.filter(o => o.value).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Discipline</Label>
                <Select value={form.discipline} onValueChange={v => setForm(f => ({ ...f, discipline: v }))}>
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINE_OPTIONS.filter(o => o.value).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">City (optional)</Label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="e.g., Rotterdam"
                className="mt-1 h-9"
                data-testid="input-group-city"
              />
            </div>
            <div>
              <Label className="text-xs">Tags (comma separated)</Label>
              <Input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g., competitions, training, beginners"
                className="mt-1 h-9"
                data-testid="input-group-tags"
              />
            </div>
            <div>
              <Label className="text-xs">Cover Image URL (optional)</Label>
              <Input
                value={form.coverImage}
                onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                placeholder="https://..."
                className="mt-1 h-9"
                data-testid="input-group-cover-image"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <input
                type="checkbox"
                id="group-private"
                checked={form.isPrivate}
                onChange={e => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
                className="w-4 h-4"
                data-testid="checkbox-group-private"
              />
              <label htmlFor="group-private" className="flex-1 cursor-pointer">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Private Group
                </p>
                <p className="text-xs text-muted-foreground">Members must request to join</p>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.name.trim() || createMutation.isPending}
                className="flex-1"
                data-testid="button-submit-group"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
