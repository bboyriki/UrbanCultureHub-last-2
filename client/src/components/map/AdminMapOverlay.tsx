import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, MapPin, Star, Crown,
  Download, Eye, EyeOff, X, Navigation,
  Globe, Calendar, Palette, Bot, Send, Loader2,
  Search, Trash2, RefreshCw, Sparkles,
} from "lucide-react";

interface AdminMapOverlayProps {
  viewportNonFeatured: any[];
  viewportFeatured: any[];
  filteredLocations: any[];
  filteredEvents: any[];
  currentZoom: number;
  mapBounds: { south: number; north: number; west: number; east: number };
  spotlights: any[];
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
  showAdminNotes: boolean;
  onToggleAdminNotes: () => void;
  open: boolean;
  onToggle: () => void;
  clusterColor: string;
  onClusterColorChange: (color: string) => void;
  defaultTab?: "stats" | "actions" | "spots" | "ai";
}

const CATEGORY_COLORS: Record<string, string> = {
  skate: "#84CC16", dance: "#EC4899", music: "#6366F1", cafe: "#D97706",
  sport: "#10B981", basketball: "#EA580C", graffiti: "#FF4D00", parkour: "#EAB308",
  art: "#A78BFA", community: "#14B8A6", nightlife: "#8B5CF6", fitness: "#3B82F6",
  bmx: "#0EA5E9", culture: "#7C3AED", other: "#0D9488",
  food: "#F59E0B", coworking: "#6EE7B7", tattoo: "#F43F5E",
};

const PRESET_COLORS = [
  { label: "Teal", value: "#0D9488" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Orange", value: "#EA580C" },
  { label: "Blue", value: "#2563EB" },
  { label: "Pink", value: "#DB2777" },
  { label: "Green", value: "#16A34A" },
  { label: "Red", value: "#DC2626" },
  { label: "Gold", value: "#D97706" },
];

const AI_SUGGESTIONS = [
  "What spots should I feature in this area?",
  "Analyze the current viewport category mix",
  "Which city has the best urban culture coverage?",
  "How can I improve map discovery for skaters?",
  "Suggest an admin note for a graffiti wall",
  "What's missing from this part of the map?",
];

function exportToCSV(spots: any[], label: string) {
  const rows = [
    ["Name", "Category", "Lat", "Lon", "Address", "Opening Hours"],
    ...spots.map(s => [
      (s.name || "").replace(/,/g, ";"),
      s.category || "",
      s.lat ?? "",
      s.lon ?? "",
      (s.address || "").replace(/,/g, ";"),
      (s.opening_hours || "").replace(/,/g, ";"),
    ]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "stats" | "actions" | "spots" | "ai";

export default function AdminMapOverlay({
  viewportNonFeatured,
  viewportFeatured,
  filteredLocations,
  filteredEvents,
  currentZoom,
  mapBounds,
  spotlights,
  onFlyTo,
  showAdminNotes,
  onToggleAdminNotes,
  open,
  onToggle,
  clusterColor,
  onClusterColorChange,
  defaultTab = "stats",
}: AdminMapOverlayProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [spotSearch, setSpotSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultTab !== activeTab && open) setActiveTab(defaultTab);
  }, [defaultTab, open]);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const { data: allCustomSpots = [] } = useQuery<any[]>({
    queryKey: ["/api/city-spots/map-custom"],
    enabled: open,
    staleTime: 60000,
  });

  const activeSpotlights = useMemo(() => (spotlights || []).filter((s: any) => s.active !== false), [spotlights]);
  const superFeatured = useMemo(() => activeSpotlights.filter((s: any) => s.isSuperFeatured), [activeSpotlights]);
  const regularFeatured = useMemo(() => activeSpotlights.filter((s: any) => !s.isSuperFeatured), [activeSpotlights]);
  const totalVisible = viewportNonFeatured.length + viewportFeatured.length;

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    viewportNonFeatured.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [viewportNonFeatured]);

  const inactiveCustom = useMemo(() => allCustomSpots.filter((s: any) => !s.active), [allCustomSpots]);
  const activeCustom = useMemo(() => allCustomSpots.filter((s: any) => s.active), [allCustomSpots]);

  const filteredSpots = useMemo(() => {
    const pool = showInactive ? inactiveCustom : activeCustom;
    if (!spotSearch.trim()) return pool.slice(0, 30);
    const q = spotSearch.toLowerCase();
    return pool.filter((s: any) =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q) ||
      (s.address || "").toLowerCase().includes(q)
    ).slice(0, 40);
  }, [spotSearch, showInactive, inactiveCustom, activeCustom]);

  const unfeatureMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/spotlights/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/map-custom"] });
      toast({ title: "Spot deactivated" });
    },
  });

  const superFeatureMutation = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) =>
      apiRequest(`/api/admin/spotlights/${id}`, "PATCH", { isSuperFeatured: enable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotlights"] });
      toast({ title: "Updated" });
    },
  });

  const activateSpotMutation = useMutation({
    mutationFn: async (spot: any) => {
      return apiRequest(`/api/admin/city-spots/spotlights/${spot.id}`, "PATCH", { active: true });
    },
    onSuccess: (_, spot) => {
      queryClient.invalidateQueries({ queryKey: ["/api/spotlights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/map-custom"] });
      queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
      toast({ title: `"${spot.name}" featured!`, description: "It now appears as a spotlight on the map" });
    },
    onError: () => toast({ title: "Failed to feature spot", variant: "destructive" }),
  });

  const saveClusterColorMutation = useMutation({
    mutationFn: (color: string) =>
      apiRequest("/api/admin/settings", "POST", { key: "mapClusterColor", value: color, label: "Map Cluster Color" }),
    onSuccess: () => toast({ title: "Cluster color saved" }),
  });

  const mapContext = useMemo(() => ({
    zoom: currentZoom,
    inViewport: totalVisible,
    featured: viewportFeatured.length,
    totalSpotlights: activeSpotlights.length,
    superFeatured: superFeatured.length,
    totalCustomSpots: allCustomSpots.length,
    inactiveCustom: inactiveCustom.length,
    events: filteredEvents.length,
    topCategories: categoryBreakdown.slice(0, 5),
    bounds: mapBounds,
  }), [currentZoom, totalVisible, viewportFeatured.length, activeSpotlights.length, superFeatured.length, allCustomSpots.length, inactiveCustom.length, filteredEvents.length, categoryBreakdown, mapBounds]);

  async function sendAiMessage(content: string) {
    if (!content.trim() || aiLoading) return;
    const userMsg = { role: "user" as const, content };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await apiRequest("/api/admin/map/ai", "POST", {
        messages: [...aiMessages, userMsg],
        mapContext,
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: "assistant", content: data.reply || "No response received." }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't reach the AI. Please try again." }]);
    } finally {
      setAiLoading(false);
    }
  }

  if (!open) return null;

  const tabDefs: { id: Tab; label: string; icon: string }[] = [
    { id: "stats", label: "Stats", icon: "📊" },
    { id: "actions", label: "Actions", icon: "⚡" },
    { id: "spots", label: "Spots", icon: "📍" },
    { id: "ai", label: "AI", icon: "✨" },
  ];

  return (
    <div
      className="absolute right-16 z-[1100] w-80"
      style={{ bottom: "80px" }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,7,25,0.97)",
          border: "1px solid rgba(124,58,237,0.4)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.12)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.4),rgba(109,40,217,0.5))" }}
            >
              <Shield className="w-3.5 h-3.5" style={{ color: "#C4B5FD" }} />
            </div>
            <span className="font-bold text-sm text-white">Admin Map Control</span>
            <span
              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(124,58,237,0.2)", color: "#C4B5FD" }}
            >
              Zoom {currentZoom.toFixed(1)}
            </span>
            <button
              onClick={onToggle}
              className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}
              data-testid="button-admin-panel-close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {tabDefs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 text-[10px] font-bold transition-all flex flex-col items-center gap-0.5"
              style={{
                color: activeTab === tab.id ? "#C4B5FD" : "rgba(255,255,255,0.35)",
                borderBottom: activeTab === tab.id ? "2px solid #7C3AED" : "2px solid transparent",
                background: activeTab === tab.id ? "rgba(124,58,237,0.08)" : "transparent",
              }}
              data-testid={`button-admin-tab-${tab.id}`}
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              <span className="uppercase tracking-wider">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>

          {/* ── STATS TAB ── */}
          {activeTab === "stats" && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "In Viewport", value: totalVisible, icon: <Globe className="w-3.5 h-3.5" />, color: "#60A5FA" },
                  { label: "Featured", value: activeSpotlights.length, icon: <Star className="w-3.5 h-3.5" />, color: "#FBBF24" },
                  { label: "My Spots", value: filteredLocations.length, icon: <MapPin className="w-3.5 h-3.5" />, color: "#FF4D00" },
                  { label: "Events", value: filteredEvents.length, icon: <Calendar className="w-3.5 h-3.5" />, color: "#34D399" },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-xl p-2.5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: stat.color }}>
                      {stat.icon}
                      <span className="text-[10px] font-semibold text-white/50">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-black text-white">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Featured breakdown */}
              <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}>
                <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-2">ALL FEATURED SPOTS</p>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-lg font-black text-white">{regularFeatured.length}</div>
                    <div className="text-[10px] text-purple-300">⭐ Featured</div>
                  </div>
                  <div className="w-px h-8" style={{ background: "rgba(124,58,237,0.3)" }} />
                  <div>
                    <div className="text-lg font-black text-white">{superFeatured.length}</div>
                    <div className="text-[10px] text-purple-300">👑 Super</div>
                  </div>
                  <div className="w-px h-8" style={{ background: "rgba(124,58,237,0.3)" }} />
                  <div>
                    <div className="text-lg font-black text-white">{activeSpotlights.length}</div>
                    <div className="text-[10px] text-purple-300">Total</div>
                  </div>
                </div>
              </div>

              {/* Custom spots summary */}
              <div className="rounded-xl p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">CUSTOM SPOTS DATABASE</p>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-lg font-black text-white">{allCustomSpots.length}</div>
                    <div className="text-[10px] text-emerald-400">Total</div>
                  </div>
                  <div className="w-px h-8" style={{ background: "rgba(16,185,129,0.2)" }} />
                  <div>
                    <div className="text-lg font-black text-white">{activeCustom.length}</div>
                    <div className="text-[10px] text-emerald-400">Active</div>
                  </div>
                  <div className="w-px h-8" style={{ background: "rgba(16,185,129,0.2)" }} />
                  <div>
                    <div className="text-lg font-black text-white">{inactiveCustom.length}</div>
                    <div className="text-[10px] text-emerald-400">Inactive</div>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              {categoryBreakdown.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">VIEWPORT CATEGORY MIX</p>
                  <div className="space-y-1.5">
                    {categoryBreakdown.map(([cat, cnt]) => {
                      const pct = Math.round((cnt / Math.max(totalVisible, 1)) * 100);
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="text-[10px] text-white/60 w-20 truncate capitalize">{cat}</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] || "#0D9488" }}
                            />
                          </div>
                          <span className="text-[10px] text-white/50 w-6 text-right">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ACTIONS TAB ── */}
          {activeTab === "actions" && (
            <div className="p-4 space-y-2">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">Map Tools</p>

              {/* Cluster color */}
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                  <span className="text-[11px] font-bold text-white/60">Cluster Color</span>
                  <div className="w-4 h-4 rounded-full ml-auto border border-white/20" style={{ background: clusterColor }} />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_COLORS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => { onClusterColorChange(p.value); saveClusterColorMutation.mutate(p.value); }}
                      className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                      style={{ background: p.value, borderColor: clusterColor === p.value ? "white" : "transparent" }}
                      title={p.label}
                      data-testid={`button-cluster-color-${p.label.toLowerCase()}`}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={clusterColor}
                  onChange={e => onClusterColorChange(e.target.value)}
                  onBlur={e => saveClusterColorMutation.mutate(e.target.value)}
                  className="w-full h-7 rounded-lg cursor-pointer border-0"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                  data-testid="input-cluster-color"
                />
              </div>

              {/* Admin notes toggle */}
              <button
                onClick={onToggleAdminNotes}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: showAdminNotes ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.05)",
                  border: showAdminNotes ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: showAdminNotes ? "#C4B5FD" : "rgba(255,255,255,0.6)",
                }}
                data-testid="button-admin-toggle-notes"
              >
                {showAdminNotes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-xs">{showAdminNotes ? "Admin Notes Visible" : "Show Admin Notes"}</span>
              </button>

              {/* Refresh map data */}
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/city-spots/spotlights"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/city-spots/map-custom"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/events"] });
                  toast({ title: "Map data refreshed" });
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                data-testid="button-admin-refresh-map"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh all map data</span>
              </button>

              {/* Export viewport */}
              <button
                onClick={() => {
                  const all = [...viewportNonFeatured, ...viewportFeatured];
                  if (all.length === 0) { toast({ title: "No spots in viewport", variant: "destructive" }); return; }
                  exportToCSV(all, "viewport_spots");
                  toast({ title: `Exported ${all.length} spots to CSV` });
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                data-testid="button-admin-export-csv"
              >
                <Download className="w-4 h-4" />
                <span>Export Viewport CSV ({viewportNonFeatured.length + viewportFeatured.length})</span>
              </button>

              {/* Export featured */}
              <button
                onClick={() => {
                  if (activeSpotlights.length === 0) { toast({ title: "No featured spots", variant: "destructive" }); return; }
                  exportToCSV(activeSpotlights.map((s: any) => ({ name: s.name, category: s.category, lat: s.lat, lon: s.lon, address: s.address })), "featured_spots");
                  toast({ title: `Exported ${activeSpotlights.length} featured spots` });
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                data-testid="button-admin-export-featured"
              >
                <Star className="w-4 h-4" />
                <span>Export Featured ({activeSpotlights.length})</span>
              </button>

              {/* Quick links */}
              <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Quick Links</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Analytics", href: "/admin/analytics", icon: "📊" },
                    { label: "Spot Assign", href: "/admin/spot-assignments", icon: "👤" },
                    { label: "Settings", href: "/admin/feature-settings", icon: "⚙️" },
                    { label: "Homepage", href: "/admin/homepage-builder", icon: "🏗️" },
                    { label: "Users", href: "/admin/users", icon: "👥" },
                    { label: "City Spots", href: "/admin/city-spots", icon: "🗺️" },
                  ].map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
                      data-testid={`link-admin-map-${link.href.replace(/\//g, "-")}`}
                    >
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SPOTS TAB ── */}
          {activeTab === "spots" && (
            <div className="flex flex-col">
              {/* Toggle: inactive vs active */}
              <div className="flex gap-1 p-3 pb-0">
                <button
                  onClick={() => setShowInactive(true)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: showInactive ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
                    color: showInactive ? "#C4B5FD" : "rgba(255,255,255,0.35)",
                    border: showInactive ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                  data-testid="button-show-inactive-spots"
                >
                  Inactive ({inactiveCustom.length})
                </button>
                <button
                  onClick={() => setShowInactive(false)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  style={{
                    background: !showInactive ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)",
                    color: !showInactive ? "#34D399" : "rgba(255,255,255,0.35)",
                    border: !showInactive ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                  data-testid="button-show-active-spots"
                >
                  Active ({activeCustom.length})
                </button>
              </div>

              {/* Search */}
              <div className="px-3 pt-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                  <input
                    value={spotSearch}
                    onChange={e => setSpotSearch(e.target.value)}
                    placeholder={`Search ${showInactive ? "inactive" : "active"} spots…`}
                    className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
                    data-testid="input-spot-search"
                  />
                  {spotSearch && (
                    <button onClick={() => setSpotSearch("")} className="text-white/30 hover:text-white/60">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Spot list */}
              <div className="px-3 pt-2 pb-3 space-y-1.5" style={{ maxHeight: 300, overflowY: "auto" }}>
                {filteredSpots.length === 0 ? (
                  <div className="text-center py-6">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-white/20" />
                    <p className="text-xs text-white/40">No spots found</p>
                  </div>
                ) : filteredSpots.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    data-testid={`spot-item-${s.id}`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: CATEGORY_COLORS[s.category] || "#0D9488" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{s.name || "Unnamed"}</p>
                      <p className="text-[10px] text-white/40 truncate capitalize">
                        {s.category || "—"}{s.address ? ` · ${s.address.split(",")[0]}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {s.lat && s.lon && (
                        <button
                          onClick={() => onFlyTo(s.lat, s.lon, 17)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                          style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA" }}
                          title="Fly to"
                          data-testid={`button-flyto-spot-${s.id}`}
                        >
                          <Navigation className="w-3 h-3" />
                        </button>
                      )}
                      {showInactive ? (
                        <button
                          onClick={() => activateSpotMutation.mutate(s)}
                          disabled={activateSpotMutation.isPending}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                          style={{ background: "rgba(234,197,52,0.2)", color: "#FBBF24" }}
                          title="Feature this spot"
                          data-testid={`button-activate-spot-${s.id}`}
                        >
                          {activateSpotMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (window.confirm(`Deactivate "${s.name}"?`)) unfeatureMutation.mutate(s.id);
                          }}
                          disabled={unfeatureMutation.isPending}
                          className="w-6 h-6 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                          title="Deactivate"
                          data-testid={`button-deactivate-spot-${s.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!spotSearch && filteredSpots.length === (showInactive ? Math.min(inactiveCustom.length, 30) : Math.min(activeCustom.length, 30)) && (
                  <p className="text-[10px] text-white/30 text-center py-1">
                    Showing first {filteredSpots.length} — search to narrow results
                  </p>
                )}
              </div>

              {/* Featured spots quick list */}
              {activeSpotlights.length > 0 && !showInactive && (
                <div className="px-3 pb-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider py-2">
                    {activeSpotlights.length} Active Spotlights
                  </p>
                  <div className="space-y-1.5">
                    {activeSpotlights.map((s: any) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                        style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}
                      >
                        <span className="text-sm flex-shrink-0">{s.isSuperFeatured ? "👑" : "⭐"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{s.name || "Unnamed"}</p>
                          <p className="text-[10px] text-white/40 truncate">{s.category || "—"}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {s.lat && s.lon && (
                            <button
                              onClick={() => onFlyTo(s.lat, s.lon, 17)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70"
                              style={{ background: "rgba(59,130,246,0.2)", color: "#60A5FA" }}
                              title="Fly to"
                              data-testid={`button-flyto-spotlight-${s.id}`}
                            >
                              <Navigation className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => superFeatureMutation.mutate({ id: s.id, enable: !s.isSuperFeatured })}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70"
                            style={{ background: s.isSuperFeatured ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)", color: s.isSuperFeatured ? "#A78BFA" : "rgba(255,255,255,0.35)" }}
                            title={s.isSuperFeatured ? "Remove crown" : "Crown it"}
                            data-testid={`button-toggle-super-spotlight-${s.id}`}
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`Unfeature "${s.name}"?`)) unfeatureMutation.mutate(s.id); }}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#F87171" }}
                            title="Unfeature"
                            data-testid={`button-unfeature-spotlight-${s.id}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AI TAB ── */}
          {activeTab === "ai" && (
            <div className="flex flex-col" style={{ height: 400 }}>
              {/* AI Header info */}
              <div
                className="mx-3 mt-3 mb-2 px-3 py-2 rounded-xl flex items-center gap-2"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
              >
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A78BFA" }} />
                <p className="text-[10px] text-purple-300 leading-tight">
                  AI knows your map context — {totalVisible} spots in viewport, zoom {currentZoom.toFixed(1)}, {activeSpotlights.length} featured
                </p>
              </div>

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-2">
                {aiMessages.length === 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold mb-2">Quick questions</p>
                    {AI_SUGGESTIONS.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => sendAiMessage(suggestion)}
                        className="w-full text-left px-3 py-2 rounded-xl text-[11px] transition-all hover:opacity-80 active:scale-98"
                        style={{
                          background: "rgba(124,58,237,0.1)",
                          border: "1px solid rgba(124,58,237,0.2)",
                          color: "rgba(196,181,253,0.8)",
                        }}
                        data-testid={`button-ai-suggestion-${i}`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {aiMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                      style={msg.role === "user" ? {
                        background: "rgba(124,58,237,0.35)",
                        color: "#E9D5FF",
                        borderRadius: "12px 12px 4px 12px",
                      } : {
                        background: "rgba(255,255,255,0.07)",
                        color: "rgba(255,255,255,0.85)",
                        borderRadius: "12px 12px 12px 4px",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Bot className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Map AI</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div className="flex justify-start">
                    <div
                      className="px-3 py-2 rounded-xl flex items-center gap-2"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      <span className="text-[11px] text-white/40">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>

              {/* Input area */}
              <div
                className="flex-shrink-0 mx-3 mb-3 flex items-end gap-2 p-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <textarea
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendAiMessage(aiInput);
                    }
                  }}
                  placeholder="Ask about the map…"
                  rows={1}
                  className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none resize-none"
                  style={{ maxHeight: "80px" }}
                  data-testid="input-ai-map-chat"
                />
                <button
                  onClick={() => sendAiMessage(aiInput)}
                  disabled={!aiInput.trim() || aiLoading}
                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "white" }}
                  data-testid="button-ai-send"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Clear chat */}
              {aiMessages.length > 0 && (
                <button
                  onClick={() => setAiMessages([])}
                  className="mx-3 mb-3 -mt-1 text-[10px] text-white/25 hover:text-white/50 flex items-center gap-1 transition-colors"
                  data-testid="button-ai-clear-chat"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear conversation
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
