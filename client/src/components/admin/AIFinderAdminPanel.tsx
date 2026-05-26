import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Plus, Trash2, ToggleLeft, ToggleRight,
  Search, Star, TrendingUp, Zap, MapPin, Eye, EyeOff,
} from "lucide-react";

interface Promotion {
  id: number;
  spotRef: string;
  spotName: string;
  spotCategory: string | null;
  boostScore: number;
  adminNote: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SpotOption {
  ref: string;
  name: string;
  category: string;
  source: string;
}

interface Spotlight {
  id: number;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  active: boolean;
  adminNote: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "café", label: "☕ Café" },
  { value: "restaurant", label: "🍽️ Restaurant" },
  { value: "bar", label: "🍺 Bar" },
  { value: "nightlife", label: "🌙 Nightlife" },
  { value: "club", label: "🎉 Club" },
  { value: "music_venue", label: "🎵 Music Venue" },
  { value: "gallery", label: "🎨 Gallery/Art" },
  { value: "museum", label: "🏛️ Museum" },
  { value: "skate_spot", label: "🛹 Skate Spot" },
  { value: "dance_studio", label: "💃 Dance Studio" },
  { value: "community", label: "🤝 Community" },
  { value: "outdoor", label: "🌳 Outdoor" },
];

const CATEGORY_EMOJI: Record<string, string> = {
  café: "☕", restaurant: "🍽️", bar: "🍺", nightlife: "🌙", club: "🎉",
  music_venue: "🎵", gallery: "🎨", museum: "🏛️", skate_spot: "🛹",
  dance_studio: "💃", community: "🤝", outdoor: "🌳",
};

const PAGE_SIZE = 20;

export default function AIFinderAdminPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"promotions" | "featured">("featured");

  // --- Promotions state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpot, setSelectedSpot] = useState<SpotOption | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newBoost, setNewBoost] = useState(85);
  const [newNote, setNewNote] = useState("");
  const [spotSearch, setSpotSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // --- Featured spots state ---
  const [featSearch, setFeatSearch] = useState("");
  const [featCategory, setFeatCategory] = useState("");
  const [featPage, setFeatPage] = useState(0);

  // --- Data ---
  const { data: promotions = [], isLoading: promoLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/admin/ai-finder/promotions"],
  });

  const { data: spotOptions = [] } = useQuery<SpotOption[]>({
    queryKey: ["/api/admin/ai-finder/spot-options", spotSearch],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/ai-finder/spot-options?q=${encodeURIComponent(spotSearch)}&limit=20`, "GET");
      return res.json();
    },
    enabled: showPicker,
  });

  const { data: allSpotlights = [], isLoading: spotsLoading } = useQuery<Spotlight[]>({
    queryKey: ["/api/admin/city-spots/spotlights"],
  });

  // --- Computed ---
  const filteredSpotlights = allSpotlights.filter(s => {
    const matchName = !featSearch || s.name.toLowerCase().includes(featSearch.toLowerCase());
    const matchCat = !featCategory || s.category === featCategory;
    return matchName && matchCat;
  });
  const totalPages = Math.ceil(filteredSpotlights.length / PAGE_SIZE);
  const pagedSpotlights = filteredSpotlights.slice(featPage * PAGE_SIZE, (featPage + 1) * PAGE_SIZE);
  const activeSpotlights = allSpotlights.filter(s => s.active).length;

  const filteredPromos = promotions.filter(p =>
    !searchQuery || p.spotName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activePromos = promotions.filter(p => p.isActive).length;

  // --- Mutations: promotions ---
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSpot) throw new Error("Select a spot first");
      const res = await apiRequest("/api/admin/ai-finder/promotions", "POST", {
        spotRef: selectedSpot.ref,
        spotName: selectedSpot.name,
        spotCategory: newCategory || null,
        boostScore: newBoost,
        adminNote: newNote || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-finder/promotions"] });
      toast({ title: "⭐ Spot promoted!", description: "It will now appear first in AI Finder results." });
      setSelectedSpot(null); setNewNote(""); setNewCategory(""); setNewBoost(85); setShowPicker(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest(`/api/admin/ai-finder/promotions/${id}`, "PATCH", { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-finder/promotions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/admin/ai-finder/promotions/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-finder/promotions"] });
      toast({ title: "Removed", description: "Promotion deleted." });
    },
  });

  // --- Mutations: featured spots ---
  const toggleSpotlightMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest(`/api/admin/city-spots/spotlights/${id}`, "PATCH", { active });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/city-spots/spotlights"] });
      toast({
        title: vars.active ? "✅ Spot enabled" : "⏸ Spot hidden",
        description: vars.active
          ? "This spot will now appear in AI Finder results."
          : "This spot is hidden from AI Finder.",
      });
    },
    onError: () => toast({ title: "Failed", description: "Could not update spot", variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Tab toggle */}
      <div className="flex rounded-xl border border-border/60 overflow-hidden bg-muted/30 p-1 gap-1">
        <button
          onClick={() => setActiveTab("featured")}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
            activeTab === "featured"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-featured-spots"
        >
          <MapPin className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
          Featured Spots
        </button>
        <button
          onClick={() => setActiveTab("promotions")}
          className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg transition-all ${
            activeTab === "promotions"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-promotions"
        >
          <Star className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
          Boost Promotions
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          FEATURED SPOTS TAB
      ═══════════════════════════════════════════════ */}
      {activeTab === "featured" && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{allSpotlights.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total featured</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeSpotlights}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active in AI</div>
            </div>
            <div className="bg-gradient-to-br from-slate-500/10 to-gray-500/5 border border-slate-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{allSpotlights.length - activeSpotlights}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Hidden</div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <Eye className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">What does Active mean?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Active spots appear as <strong>Featured</strong> options when users search with the AI Finder.
                They get priority placement and are shown with a ⭐ badge. Inactive spots still exist in the database
                but are completely hidden from AI results and the map spotlight layer.
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search spots by name…"
                value={featSearch}
                onChange={e => { setFeatSearch(e.target.value); setFeatPage(0); }}
                className="pl-8 h-9 text-sm"
                data-testid="input-featured-search"
              />
            </div>
            <select
              value={featCategory}
              onChange={e => { setFeatCategory(e.target.value); setFeatPage(0); }}
              className="h-9 px-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
              data-testid="select-featured-category"
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Results info */}
          {(featSearch || featCategory) && (
            <p className="text-xs text-muted-foreground">
              {filteredSpotlights.length} spot{filteredSpotlights.length !== 1 ? "s" : ""} found
              {featCategory && ` in ${featCategory}`}
              {featSearch && ` matching "${featSearch}"`}
            </p>
          )}

          {/* Spots list */}
          {spotsLoading ? (
            <div className="text-sm text-muted-foreground text-center py-10">Loading featured spots…</div>
          ) : pagedSpotlights.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No spots match your search.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pagedSpotlights.map(spot => (
                <div
                  key={spot.id}
                  className={`border rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all ${
                    spot.active
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border/40 bg-muted/10 opacity-70"
                  }`}
                  data-testid={`row-spotlight-${spot.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{spot.name}</span>
                      {spot.active && (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {CATEGORY_EMOJI[spot.category] || "📍"} {spot.category}
                      </span>
                      {spot.address && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">· {spot.address}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleSpotlightMutation.mutate({ id: spot.id, active: !spot.active })}
                    disabled={toggleSpotlightMutation.isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                      spot.active
                        ? "text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 dark:text-emerald-400"
                        : "text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground"
                    }`}
                    title={spot.active ? "Hide from AI Finder" : "Show in AI Finder"}
                    data-testid={`button-toggle-spotlight-${spot.id}`}
                  >
                    {spot.active ? (
                      <><Eye className="w-3.5 h-3.5" /> Visible</>
                    ) : (
                      <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline" size="sm"
                onClick={() => setFeatPage(p => Math.max(0, p - 1))}
                disabled={featPage === 0}
                data-testid="button-prev-page"
              >
                ← Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {featPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => setFeatPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={featPage >= totalPages - 1}
                data-testid="button-next-page"
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          PROMOTIONS TAB
      ═══════════════════════════════════════════════ */}
      {activeTab === "promotions" && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{promotions.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total promotions</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activePromos}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active boosts</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">36K+</div>
              <div className="text-xs text-muted-foreground mt-0.5">Spots in pool</div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
            <Zap className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">How AI Finder Promotions work</p>
              <p className="text-xs text-muted-foreground mt-1">
                Promoted spots are always included at the top of AI Finder results when the selected category matches.
                They appear with a ⭐ boost badge. GPT-4o receives a special instruction to prioritize and write richer descriptions for these spots.
                When AI is unavailable, the smart fallback still honors all promotions.
              </p>
            </div>
          </div>

          {/* Add new promotion */}
          <div className="border border-border/60 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" /> Promote a spot
            </h3>

            {/* Spot picker */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select spot</label>
              {selectedSpot ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{selectedSpot.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedSpot.ref} · {selectedSpot.source}</p>
                  </div>
                  <button onClick={() => setSelectedSpot(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60">
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search featured spots or community locations…"
                      value={spotSearch}
                      onChange={e => { setSpotSearch(e.target.value); setShowPicker(true); }}
                      onFocus={() => setShowPicker(true)}
                      className="pl-8 h-9 text-sm"
                      data-testid="input-ai-finder-spot-search"
                    />
                  </div>
                  {showPicker && spotOptions.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden shadow-lg bg-background max-h-52 overflow-y-auto">
                      {spotOptions.map(opt => (
                        <button
                          key={opt.ref}
                          onClick={() => { setSelectedSpot(opt); setShowPicker(false); setSpotSearch(""); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 text-left"
                          data-testid={`button-select-spot-${opt.ref}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{opt.name}</p>
                            <p className="text-xs text-muted-foreground">{opt.ref} · {opt.category}</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${opt.source === "Featured" ? "border-amber-500/40 text-amber-600" : "border-blue-500/40 text-blue-600"}`}>
                            {opt.source}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category + boost */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category filter</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="select-ai-finder-category"
                >
                  {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Boost score (60-99)</label>
                <Input
                  type="number" min={60} max={99}
                  value={newBoost}
                  onChange={e => setNewBoost(parseInt(e.target.value) || 85)}
                  className="h-9 text-sm"
                  data-testid="input-ai-finder-boost"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin note (shown to AI as description)</label>
              <Textarea
                placeholder="Why promote this spot? e.g. 'Premium partner venue, great for skate community events'"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                className="text-sm resize-none"
                data-testid="input-ai-finder-note"
              />
            </div>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedSpot || addMutation.isPending}
              className="w-full gap-2"
              data-testid="button-add-promotion"
            >
              <Star className="w-4 h-4" />
              {addMutation.isPending ? "Adding…" : "Add to Promotions"}
            </Button>
          </div>

          {/* Search existing */}
          {promotions.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search promotions…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          )}

          {/* Promotions list */}
          {promoLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
          ) : filteredPromos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No promoted spots yet.</p>
              <p className="text-xs mt-1">Add a spot above to boost it in AI Finder results.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{filteredPromos.length} promotion{filteredPromos.length !== 1 ? "s" : ""}</p>
              {filteredPromos.map(p => (
                <div
                  key={p.id}
                  className={`border rounded-xl p-4 transition-all ${p.isActive ? "border-border/60 bg-background" : "border-border/30 bg-muted/20 opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{p.spotName}</p>
                        {p.isActive && <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15">Active</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">{p.spotRef}</span>
                        {p.spotCategory && <span className="text-[10px] text-muted-foreground">{p.spotCategory}</span>}
                        <span className="text-[10px] text-amber-600 font-semibold">⭐ {p.boostScore}</span>
                      </div>
                      {p.adminNote && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{p.adminNote}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => togglePromoMutation.mutate({ id: p.id, isActive: !p.isActive })}
                        disabled={togglePromoMutation.isPending}
                        className={`p-1.5 rounded-lg transition-colors ${p.isActive ? "text-emerald-500 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-muted/60"}`}
                        title={p.isActive ? "Deactivate" : "Activate"}
                        data-testid={`button-toggle-promotion-${p.id}`}
                      >
                        {p.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Remove promotion for "${p.spotName}"?`)) deleteMutation.mutate(p.id); }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        data-testid={`button-delete-promotion-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analytics hint */}
          <div className="bg-muted/40 border border-border/40 rounded-xl p-4 flex gap-3">
            <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">AI Finder Analytics</p>
              <p className="text-xs text-muted-foreground mt-1">
                Search usage is tracked automatically. Visit the Analytics section to see which categories users search most,
                top recommended spots, and click-through rates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
