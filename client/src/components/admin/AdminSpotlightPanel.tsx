import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Star, StarOff, Plus, MapPin, ExternalLink, Pencil, X,
  Eye, EyeOff, Search, Globe, List, Sparkles, CircleSlash,
} from "lucide-react";

const CITY_SPOT_CATEGORIES = [
  { key: "cafe",       emoji: "☕", label: "Café",        color: "#D97706" },
  { key: "food",       emoji: "🍕", label: "Food",        color: "#F97316" },
  { key: "sport",      emoji: "🏋️", label: "Sport",       color: "#10B981" },
  { key: "skate",      emoji: "🛹", label: "Skate",       color: "#84CC16" },
  { key: "dance",      emoji: "💃", label: "Dance",       color: "#EC4899" },
  { key: "music",      emoji: "🎵", label: "Music",       color: "#6366F1" },
  { key: "nightlife",  emoji: "🌙", label: "Nightlife",   color: "#8B5CF6" },
  { key: "comedy",     emoji: "😄", label: "Comedy",      color: "#F59E0B" },
  { key: "cinema",     emoji: "🎬", label: "Cinema",      color: "#0EA5E9" },
  { key: "art",        emoji: "🎨", label: "Art",         color: "#A78BFA" },
  { key: "community",  emoji: "🤝", label: "Community",   color: "#14B8A6" },
  { key: "fitness",    emoji: "💪", label: "Fitness",     color: "#3B82F6" },
  { key: "basketball", emoji: "🏀", label: "Basketball",  color: "#EA580C" },
  { key: "parkour",    emoji: "🤸", label: "Parkour",     color: "#EAB308" },
  { key: "other",      emoji: "📍", label: "Other",       color: "#0D9488" },
];

const getCat = (key: string) => CITY_SPOT_CATEGORIES.find(c => c.key === key) || CITY_SPOT_CATEGORIES[CITY_SPOT_CATEGORIES.length - 1];

const EMPTY_FORM = { name: "", lat: "", lon: "", category: "dance", address: "", website: "", adminNote: "", osmId: "" };

function detectCity(address: string, lat: number): string {
  const a = (address || "").toLowerCase();
  if (a.includes("zaandam") || a.includes("zaanstad")) return "Zaandam";
  if (a.includes("haarlem")) return "Haarlem";
  if (lat > 52.43) return "Zaandam";
  if (lat < 52.395 && lat > 52.30 && !a.includes("amsterdam")) return "Haarlem";
  return "Amsterdam";
}

interface SpotFormProps {
  value: typeof EMPTY_FORM;
  onChange: (v: typeof EMPTY_FORM) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function SpotForm({ value, onChange, onSubmit, onCancel, loading, submitLabel }: SpotFormProps) {
  const [geocoding, setGeocoding] = useState(false);
  const { toast } = useToast();

  const geocode = async () => {
    if (!value.address.trim()) { toast({ title: "Enter an address first", variant: "destructive" }); return; }
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value.address)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "UrbanCultureConnect/1.0" } });
      const data = await res.json();
      if (data.length > 0) {
        onChange({ ...value, lat: data[0].lat, lon: data[0].lon });
        toast({ title: "Coordinates found", description: `${parseFloat(data[0].lat).toFixed(5)}, ${parseFloat(data[0].lon).toFixed(5)}` });
      } else {
        toast({ title: "Address not found", variant: "destructive" });
      }
    } catch { toast({ title: "Geocoding failed", variant: "destructive" }); }
    finally { setGeocoding(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Place Name *</label>
          <Input placeholder="e.g. Wladimir Dance Studios" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} data-testid="input-spotlight-name" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={value.category} onChange={e => onChange({ ...value, category: e.target.value })} data-testid="select-spotlight-category">
            {CITY_SPOT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Website</label>
          <Input placeholder="https://..." value={value.website} onChange={e => onChange({ ...value, website: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Address</label>
          <div className="flex gap-2">
            <Input placeholder="Street, City — click Find to auto-fill coordinates" value={value.address} onChange={e => onChange({ ...value, address: e.target.value })} className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={geocode} disabled={geocoding} className="flex-shrink-0 gap-1.5" data-testid="button-geocode">
              <Globe className="h-3.5 w-3.5" />{geocoding ? "..." : "Find"}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Latitude *</label>
          <Input placeholder="52.3676" value={value.lat} onChange={e => onChange({ ...value, lat: e.target.value })} data-testid="input-spotlight-lat" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Longitude *</label>
          <Input placeholder="4.9041" value={value.lon} onChange={e => onChange({ ...value, lon: e.target.value })} data-testid="input-spotlight-lon" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description / Famous for (shown in popup)</label>
          <Input placeholder="e.g. Best breakdance spot in Amsterdam — weekly jams every Friday" value={value.adminNote} onChange={e => onChange({ ...value, adminNote: e.target.value })} data-testid="input-spotlight-note" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">OSM ID (optional)</label>
          <Input placeholder="OpenStreetMap element ID" value={value.osmId} onChange={e => onChange({ ...value, osmId: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={loading} size="sm" data-testid="button-add-spotlight">{loading ? "Saving..." : submitLabel}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminSpotlightPanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"featured" | "all">("featured");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [featureNote, setFeatureNote] = useState<Record<number, string>>({});
  const [unfeatureAllOpen, setUnfeatureAllOpen] = useState(false);

  // Admin endpoint shows ALL spotlights (active + inactive)
  const { data: spotlights = [], isLoading: loadingSpotlights } = useQuery<any[]>({
    queryKey: ["/api/admin/city-spots/spotlights"],
    staleTime: 30000,
  });

  // All OSM city spots
  const { data: citySpots = [], isLoading: loadingCitySpots } = useQuery<any[]>({
    queryKey: ["/api/city-spots"],
    staleTime: 3 * 60 * 60 * 1000,
    enabled: tab === "all",
  });

  // Set of spotlighted OSM IDs and custom spots
  const spotlightedOsmIds = useMemo(() => new Set(spotlights.filter((s: any) => s.osmId != null).map((s: any) => s.osmId)), [spotlights]);
  const getSpotlightByOsmId = (osmId: number) => spotlights.find((s: any) => s.osmId === osmId);

  const addMutation = useMutation({
    mutationFn: (body: any) => apiRequest("/api/admin/city-spots/spotlights", "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: "Place added to map" });
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest(`/api/admin/city-spots/spotlights/${id}`, "PATCH", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      setEditingId(null);
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/city-spots/spotlights/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: "Removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const unfeatureAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/city-spots/spotlights/unfeature-all", "POST"),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      setUnfeatureAllOpen(false);
      toast({ title: `${data.count} spots minimized`, description: "All spots stay on the map as regular markers. Re-feature any individually." });
    },
    onError: () => toast({ title: "Failed to unfeature all", variant: "destructive" }),
  });

  const featureCitySpot = (spot: any) => {
    const note = featureNote[spot.id] || "";
    addMutation.mutate({
      name: spot.name,
      lat: spot.lat,
      lon: spot.lon,
      category: spot.category,
      address: spot.address || "",
      website: spot.website || "",
      adminNote: note,
      osmId: String(spot.id),
    });
  };

  const unfeatureCitySpot = (osmId: number) => {
    const s = getSpotlightByOsmId(osmId);
    if (s) deleteMutation.mutate(s.id);
  };

  const toggleActive = (s: any) => updateMutation.mutate({ id: s.id, active: !s.active });
  const toggleSuperFeatured = (s: any) => updateMutation.mutate({ id: s.id, isSuperFeatured: !s.isSuperFeatured });

  const handleAdd = () => {
    if (!addForm.name || !addForm.lat || !addForm.lon) { toast({ title: "Name, latitude and longitude are required", variant: "destructive" }); return; }
    addMutation.mutate(addForm);
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditForm({ name: s.name || "", lat: String(s.lat || ""), lon: String(s.lon || ""), category: s.category || "other", address: s.address || "", website: s.website || "", adminNote: s.adminNote || "", osmId: s.osmId ? String(s.osmId) : "" });
  };

  const handleUpdate = () => {
    if (!editForm.name || !editForm.lat || !editForm.lon) { toast({ title: "Name, latitude and longitude are required", variant: "destructive" }); return; }
    updateMutation.mutate({ id: editingId, ...editForm });
  };

  // ── Featured tab filters ────────────────────────────────────────────────────
  const filteredSpotlights = spotlights.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !(s.address || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && s.category !== filterCat) return false;
    if (filterCity !== "all") { if (detectCity(s.address || "", s.lat) !== filterCity) return false; }
    return true;
  });

  const cityGroups: Record<string, any[]> = {};
  filteredSpotlights.forEach(s => {
    const city = detectCity(s.address || "", s.lat);
    if (!cityGroups[city]) cityGroups[city] = [];
    cityGroups[city].push(s);
  });

  // ── All-spots tab filters ───────────────────────────────────────────────────
  const filteredCitySpots = useMemo(() => {
    return citySpots.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCat !== "all" && s.category !== filterCat) return false;
      return true;
    }).slice(0, 200);
  }, [citySpots, search, filterCat]);

  const totalActive = spotlights.filter(s => s.active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" /> City Spotlights
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Feature places on the map with a gold ⭐ marker.
          </p>
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs text-emerald-600 font-medium">{totalActive} featured</span>
            <span className="text-xs text-muted-foreground">{spotlights.length} total managed</span>
          </div>
        </div>
        {tab === "featured" && (
          <div className="flex gap-2 flex-shrink-0">
            {totalActive > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnfeatureAllOpen(true)}
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                data-testid="button-unfeature-all"
              >
                <CircleSlash className="h-4 w-4" /> Unfeature All
              </Button>
            )}
            <Button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Custom
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "featured" ? "border-amber-500 text-amber-700 dark:text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("featured")}
          data-testid="tab-featured-spots"
        >
          <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
          Managed ({spotlights.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "all" ? "border-amber-500 text-amber-700 dark:text-amber-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("all")}
          data-testid="tab-all-spots"
        >
          <List className="h-3.5 w-3.5 inline mr-1.5" />
          Browse All Spots {citySpots.length > 0 && `(${citySpots.length})`}
        </button>
      </div>

      {/* ── FEATURED TAB ─────────────────────────────────────────────────────── */}
      {tab === "featured" && (
        <>
          {showAdd && (
            <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300 mb-3">Add Custom Place</h3>
              <SpotForm value={addForm} onChange={setAddForm} onSubmit={handleAdd} onCancel={() => setShowAdd(false)} loading={addMutation.isPending} submitLabel="Add to Map" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={filterCity} onChange={e => setFilterCity(e.target.value)}>
              {["all", "Amsterdam", "Zaandam", "Haarlem"].map(c => <option key={c} value={c}>{c === "all" ? "All cities" : c}</option>)}
            </select>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">All categories</option>
              {CITY_SPOT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
            </select>
          </div>

          {loadingSpotlights ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Loading...</div>
          ) : filteredSpotlights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{spotlights.length === 0 ? "No places yet. Add one above." : "No results match your filters."}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(cityGroups).sort(([a], [b]) => a.localeCompare(b)).map(([city, spots]) => (
                <div key={city}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{city}</span>
                    <span className="text-xs text-muted-foreground">({spots.length})</span>
                  </div>
                  <div className="space-y-2">
                    {spots.map((s: any) => {
                      const cfg = getCat(s.category);
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className={`border rounded-xl p-3 bg-background transition-all ${!s.active ? "opacity-50 border-dashed" : ""}`} data-testid={`spotlight-item-${s.id}`}>
                          {isEditing ? (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-muted-foreground">Editing: {s.name}</span>
                                <button className="p-1 rounded hover:bg-muted" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                              </div>
                              <SpotForm value={editForm} onChange={setEditForm} onSubmit={handleUpdate} onCancel={() => setEditingId(null)} loading={updateMutation.isPending} submitLabel="Save Changes" />
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: `${cfg.color}20`, border: `1.5px solid ${cfg.color}` }}>{cfg.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-sm">{s.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: cfg.color, color: cfg.color }}>{cfg.emoji} {cfg.label}</Badge>
                                      {!s.active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Regular</Badge>}
                                      {s.active && s.isSuperFeatured && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30">👑 Super</Badge>}
                                      {s.osmId && <span className="text-[10px] text-muted-foreground">OSM #{s.osmId}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button className={`p-1 rounded transition-colors ${s.active ? "text-emerald-600 hover:bg-muted" : "text-muted-foreground hover:bg-muted"}`} onClick={() => toggleActive(s)} title={s.active ? "Remove gold star (stays on map)" : "Add gold star"} data-testid={`button-toggle-spotlight-${s.id}`}>
                                      {s.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                    </button>
                                    {s.active && (
                                      <button
                                        className={`p-1 rounded transition-colors ${s.isSuperFeatured ? "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30" : "text-muted-foreground hover:bg-muted"}`}
                                        onClick={() => toggleSuperFeatured(s)}
                                        title={s.isSuperFeatured ? "Remove Super Feature (👑 → ⭐)" : "Upgrade to Super Feature (⭐ → 👑)"}
                                        data-testid={`button-toggle-super-${s.id}`}
                                      >
                                        <span className="text-sm leading-none">👑</span>
                                      </button>
                                    )}
                                    <button className="p-1 rounded hover:bg-muted" onClick={() => startEdit(s)} data-testid={`button-edit-spotlight-${s.id}`}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                    <button className="px-2 py-1 rounded-md text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/30 transition-colors flex items-center gap-1" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-spotlight-${s.id}`}><StarOff className="h-3 w-3" />Unfeature</button>
                                  </div>
                                </div>
                                {s.address && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3 w-3 flex-shrink-0" />{s.address}</p>}
                                {s.adminNote && <p className="text-xs mt-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-md line-clamp-2">⭐ {s.adminNote}</p>}
                                {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"><ExternalLink className="h-3 w-3" />{s.website.replace(/^https?:\/\//, "").split("/")[0]}</a>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ALL SPOTS TAB ────────────────────────────────────────────────────── */}
      {tab === "all" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search city spots..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">All categories</option>
              {CITY_SPOT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
            </select>
          </div>

          {loadingCitySpots ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Loading city spots...</div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {filteredCitySpots.length} of {citySpots.length} spots from OpenStreetMap.
                Click <strong>⭐ Feature</strong> to highlight a spot on the map with a gold marker.
              </p>
              <div className="space-y-2">
                {filteredCitySpots.map((spot: any) => {
                  const cfg = getCat(spot.category);
                  const isFeatured = spotlightedOsmIds.has(spot.id);
                  const existingSpotlight = getSpotlightByOsmId(spot.id);
                  const isActive = existingSpotlight?.active ?? false;
                  return (
                    <div key={spot.id} className={`border rounded-xl p-3 bg-background flex items-start gap-3 transition-all ${isFeatured ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10" : ""}`} data-testid={`city-spot-item-${spot.id}`}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ backgroundColor: `${cfg.color}20`, border: `1.5px solid ${cfg.color}` }}>{cfg.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{spot.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: cfg.color, color: cfg.color }}>{cfg.emoji} {cfg.label}</Badge>
                              {isFeatured && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white border-0">
                                  ⭐ Featured{!isActive ? " (hidden)" : ""}
                                </Badge>
                              )}
                            </div>
                            {spot.address && <p className="text-xs text-muted-foreground mt-0.5 truncate"><MapPin className="h-3 w-3 inline mr-0.5" />{spot.address}</p>}
                          </div>
                          <div className="flex-shrink-0">
                            {isFeatured ? (
                              <div className="flex gap-1">
                                <button
                                  className="p-1 rounded hover:bg-muted"
                                  onClick={() => existingSpotlight && startEdit(existingSpotlight)}
                                  title="Edit feature"
                                  data-testid={`button-edit-featured-${spot.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1"
                                  onClick={() => toggleActive(existingSpotlight)}
                                  data-testid={`button-toggle-featured-${spot.id}`}
                                >
                                  {isActive ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                                </button>
                                <button
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors"
                                  onClick={() => unfeatureCitySpot(spot.id)}
                                  data-testid={`button-unfeature-${spot.id}`}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <button
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-1"
                                onClick={() => featureCitySpot(spot)}
                                disabled={addMutation.isPending}
                                data-testid={`button-feature-${spot.id}`}
                              >
                                <Star className="h-3 w-3" /> Feature
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Note input for featuring */}
                        {!isFeatured && (
                          <input
                            type="text"
                            placeholder="Add a description (optional)..."
                            className="mt-1.5 w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1 outline-none focus:border-amber-400"
                            value={featureNote[spot.id] || ""}
                            onChange={e => setFeatureNote({ ...featureNote, [spot.id]: e.target.value })}
                            data-testid={`input-feature-note-${spot.id}`}
                          />
                        )}
                        {isFeatured && existingSpotlight?.adminNote && (
                          <p className="text-xs mt-1 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-md line-clamp-1">⭐ {existingSpotlight.adminNote}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Unfeature All confirmation dialog */}
      <AlertDialog open={unfeatureAllOpen} onOpenChange={setUnfeatureAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CircleSlash className="h-5 w-5 text-destructive" />
              Unfeature All Places?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will remove the ⭐ gold star from <strong>{totalActive} featured spot{totalActive !== 1 ? "s" : ""}</strong> at once.
              </span>
              <span className="block text-amber-700/80 dark:text-amber-400/80 font-medium">
                All spots stay visible on the map as regular markers — they are just no longer highlighted. You can re-feature any individually afterwards.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-unfeature-all">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unfeatureAllMutation.mutate()}
              disabled={unfeatureAllMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="button-confirm-unfeature-all"
            >
              {unfeatureAllMutation.isPending ? "Minimizing..." : `Yes, minimize all ${totalActive}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
