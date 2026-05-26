import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { PROGRAMME_CATEGORY_LABELS } from "@shared/schema";
import {
  ArrowLeft, Plus, Users, Calendar, Building2,
  Trash2, Eye, EyeOff, Search, RefreshCw, ChevronDown, ChevronUp,
  Clock, BarChart3, TrendingUp, Euro, Activity, Award, Pencil,
  CheckCircle2, XCircle, AlertCircle, CreditCard, X
} from "lucide-react";

const VENUE_TYPES = [
  { value: "venue", label: "Venue" },
  { value: "cafe", label: "Café" },
  { value: "club", label: "Club / Bar" },
  { value: "gallery", label: "Gallery" },
  { value: "studio", label: "Studio" },
  { value: "outdoor", label: "Outdoor Space" },
  { value: "sports", label: "Sports Facility" },
  { value: "community", label: "Community Center" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABELS_SHORT: Record<string, string> = PROGRAMME_CATEGORY_LABELS;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  reserved:        { label: "Reserved",        color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",   icon: CheckCircle2 },
  paid:            { label: "Paid",            color: "text-green-600 bg-green-50 dark:bg-green-950/30", icon: CreditCard },
  pending_payment: { label: "Pending Payment", color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30", icon: AlertCircle },
  confirmed:       { label: "Confirmed",       color: "text-green-600 bg-green-50 dark:bg-green-950/30", icon: CheckCircle2 },
  cancelled:       { label: "Cancelled",       color: "text-red-500 bg-red-50 dark:bg-red-950/30",      icon: XCircle },
};

function formatDateTime(dt: string | Date) {
  return new Date(dt).toLocaleString("nl-NL", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
function formatDate(dt: string | Date) {
  return new Date(dt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

interface AccessGrant {
  id: number; userId: number; venueName: string; venueType: string;
  isEnabled: boolean; grantedByAdminId: number | null; grantedAt: string;
  notes: string | null; userDisplayName: string | null; userEmail: string | null;
  userProfilePicture: string | null;
}

interface AdminProgrammeItem {
  id: number; userId: number; title: string; category: string;
  startTime: string; endTime: string; isPublic: boolean; isActive: boolean;
  isRecurring: boolean; capacity: number | null; ticketPrice: string | null;
  createdAt: string; userDisplayName: string | null; venueName: string | null;
  description: string | null; locationId: number | null;
}

interface AdminRegistration {
  id: number; userId: number; programmeItemId: number;
  occurrenceDate: string; occurrenceStart: string | null;
  status: string; amountPaid: string | null; stripeSessionId: string | null;
  createdAt: string; itemTitle: string | null; itemCategory: string | null;
  itemTicketPrice: string | null; itemCapacity: number | null;
  userName: string | null; userEmail: string | null; venueName: string | null;
}

interface AvailableUser {
  id: number; displayName: string; email: string;
  profilePicture: string | null; role: string;
}

interface AnalyticsData {
  totalRegistrations: number; confirmed: number; pending: number;
  cancelled: number; totalRevenue: number; totalVenues: number;
  totalClasses: number;
  topClasses: { title: string; venue: string; category: string; count: number; revenue: number }[];
  topVenues: { venueName: string; count: number; revenue: number }[];
  weeklyTrend: { week: string; count: number; revenue: number }[];
}

const BLANK_ITEM_FORM = {
  userId: "", title: "", description: "", category: "breaking",
  startTime: "", endTime: "", isRecurring: false, recurrenceType: "weekly",
  recurrenceEnd: "", isPublic: true, capacity: "", ticketPrice: "", spotName: "",
};

export default function AdminProgrammePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"analytics" | "access" | "items" | "reservations">("analytics");
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState<AccessGrant | null>(null);
  const [grantForm, setGrantForm] = useState({ userId: "", venueName: "", venueType: "venue", notes: "" });
  const [userSearch, setUserSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [regSearch, setRegSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");
  const [expandedGrant, setExpandedGrant] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<AdminProgrammeItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ ...BLANK_ITEM_FORM });

  const { data: grants = [], isLoading: grantsLoading } = useQuery<AccessGrant[]>({
    queryKey: ["/api/admin/programme/access"],
  });
  const { data: allItems = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery<AdminProgrammeItem[]>({
    queryKey: ["/api/admin/programme/items"],
  });
  const { data: availableUsers = [] } = useQuery<AvailableUser[]>({
    queryKey: ["/api/admin/programme/users"],
    enabled: showGrantForm || showItemForm,
  });
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/programme/analytics"],
    enabled: activeTab === "analytics",
  });
  const { data: registrations = [], isLoading: regsLoading, refetch: refetchRegs } = useQuery<AdminRegistration[]>({
    queryKey: ["/api/admin/programme/registrations"],
    enabled: activeTab === "reservations",
  });

  // All users (including those with grants) for item creation
  const allVenueUsers = grants.filter(g => g.isEnabled);

  /* ── Mutations ── */
  const grantMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/programme/access", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/users"] });
      toast({ title: "Access granted" });
      setShowGrantForm(false);
      setGrantForm({ userId: "", venueName: "", venueType: "venue", notes: "" });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to grant access", variant: "destructive" }),
  });

  const updateGrantMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/admin/programme/access/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/access"] });
      toast({ title: "Updated" });
      setEditingGrant(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const revokeGrantMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/programme/access/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/access"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/users"] });
      toast({ title: "Access revoked" });
    },
    onError: () => toast({ title: "Failed to revoke", variant: "destructive" }),
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/programme/items/${id}/active`, "PATCH", { isActive }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/items"] }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const editItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/admin/programme/items/${id}`, "PATCH", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/items"] });
      toast({ title: "Item updated" });
      setEditingItem(null);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/programme/items/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/items"] });
      toast({ title: "Item deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/admin/programme/items", "POST", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/items"] });
      toast({ title: "Class created" });
      setShowItemForm(false);
      setItemForm({ ...BLANK_ITEM_FORM });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed to create", variant: "destructive" }),
  });

  const patchRegMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest(`/api/admin/programme/registrations/${id}`, "PATCH", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/analytics"] });
      toast({ title: "Reservation updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteRegMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/programme/registrations/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/programme/analytics"] });
      toast({ title: "Reservation removed" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  /* ── Handlers ── */
  const handleGrant = () => {
    if (!grantForm.userId || !grantForm.venueName.trim()) {
      toast({ title: "Select a user and enter venue name", variant: "destructive" }); return;
    }
    grantMutation.mutate({ userId: parseInt(grantForm.userId), venueName: grantForm.venueName, venueType: grantForm.venueType, notes: grantForm.notes || null });
  };

  const handleUpdateGrant = (grant: AccessGrant, updates: Partial<AccessGrant>) => {
    updateGrantMutation.mutate({ id: grant.id, data: updates });
  };

  const handleCreateItem = () => {
    if (!itemForm.userId || !itemForm.title.trim() || !itemForm.startTime || !itemForm.endTime) {
      toast({ title: "Venue owner, title, start/end time required", variant: "destructive" }); return;
    }
    createItemMutation.mutate({
      userId: parseInt(itemForm.userId),
      title: itemForm.title,
      description: itemForm.description || null,
      category: itemForm.category,
      startTime: itemForm.startTime,
      endTime: itemForm.endTime,
      isRecurring: itemForm.isRecurring,
      recurrenceType: itemForm.isRecurring ? itemForm.recurrenceType : null,
      recurrenceEnd: itemForm.isRecurring && itemForm.recurrenceEnd ? itemForm.recurrenceEnd : null,
      isPublic: itemForm.isPublic,
      capacity: itemForm.capacity ? parseInt(itemForm.capacity) : null,
      ticketPrice: itemForm.ticketPrice ? itemForm.ticketPrice : null,
      spotName: itemForm.spotName || null,
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    editItemMutation.mutate({ id: editingItem.id, data: {
      title: editingItem.title,
      description: editingItem.description,
      category: editingItem.category,
      startTime: editingItem.startTime,
      endTime: editingItem.endTime,
      isPublic: editingItem.isPublic,
      isActive: editingItem.isActive,
      capacity: editingItem.capacity,
      ticketPrice: editingItem.ticketPrice,
    }});
  };

  /* ── Filtered data ── */
  const filteredGrants = grants.filter(g =>
    !userSearch || (g.userDisplayName || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (g.userEmail || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    g.venueName.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredItems = allItems.filter(item =>
    !itemSearch || item.title.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.venueName || "").toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.userDisplayName || "").toLowerCase().includes(itemSearch.toLowerCase())
  );

  const filteredRegs = registrations.filter(r => {
    const matchSearch = !regSearch ||
      (r.userName || "").toLowerCase().includes(regSearch.toLowerCase()) ||
      (r.userEmail || "").toLowerCase().includes(regSearch.toLowerCase()) ||
      (r.itemTitle || "").toLowerCase().includes(regSearch.toLowerCase()) ||
      (r.venueName || "").toLowerCase().includes(regSearch.toLowerCase());
    const matchStatus = regStatusFilter === "all" || r.status === regStatusFilter;
    return matchSearch && matchStatus;
  });

  /* ── Tabs config ── */
  const tabs = [
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "access", label: `Venues (${grants.length})`, icon: Building2 },
    { id: "items", label: `Classes (${allItems.length})`, icon: Calendar },
    { id: "reservations", label: "Reservations", icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-lg hover:bg-muted" data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-base">Programme Management</h1>
          <p className="text-xs text-muted-foreground">{grants.length} venues · {allItems.length} classes</p>
        </div>
        {activeTab === "access" && (
          <Button size="sm" onClick={() => setShowGrantForm(true)} className="gap-1.5 rounded-xl" data-testid="button-grant-access">
            <Plus className="w-4 h-4" /> Add Venue
          </Button>
        )}
        {activeTab === "items" && (
          <Button size="sm" onClick={() => setShowItemForm(true)} className="gap-1.5 rounded-xl" data-testid="button-add-item">
            <Plus className="w-4 h-4" /> Add Class
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-2 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-${id}`}
          >
            <span className="flex items-center gap-1.5"><Icon className="w-4 h-4" /> {label}</span>
          </button>
        ))}
      </div>

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (
        <div className="px-4 py-4 space-y-4">
          {analyticsLoading ? (
            <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !analytics ? (
            <div className="text-center py-16 text-muted-foreground"><BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No data available yet</p></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Bookings", value: analytics.totalRegistrations, icon: Activity, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
                  { label: "Revenue", value: `€${analytics.totalRevenue.toFixed(2)}`, icon: Euro, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
                  { label: "Active Venues", value: analytics.totalVenues, icon: Building2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
                  { label: "Active Classes", value: analytics.totalClasses, icon: Calendar, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`rounded-xl border p-3 ${bg}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-background/60">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <p className="text-xl font-bold leading-tight">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-4 bg-card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Booking Status</h3>
                <div className="space-y-2">
                  {[
                    { label: "Confirmed / Paid", count: analytics.confirmed, color: "bg-green-500" },
                    { label: "Pending payment", count: analytics.pending, color: "bg-yellow-500" },
                    { label: "Cancelled", count: analytics.cancelled, color: "bg-red-400" },
                  ].map(({ label, count, color }) => {
                    const pct = analytics.totalRegistrations > 0 ? Math.round((count / analytics.totalRegistrations) * 100) : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {analytics.weeklyTrend.length > 0 && (
                <div className="rounded-xl border p-4 bg-card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Bookings — Last 8 Weeks</h3>
                  <div className="flex items-end gap-1 h-20">
                    {analytics.weeklyTrend.map((w, i) => {
                      const maxCount = Math.max(...analytics.weeklyTrend.map(x => x.count), 1);
                      const heightPct = Math.max((w.count / maxCount) * 100, w.count > 0 ? 5 : 0);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">{w.count > 0 ? w.count : ""}</span>
                          <div className="w-full rounded-t-sm bg-primary/70 transition-all" style={{ height: `${heightPct}%`, minHeight: w.count > 0 ? 4 : 0 }} />
                          <span className="text-[9px] text-muted-foreground">{new Date(w.week).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {analytics.topClasses.length > 0 && (
                <div className="rounded-xl border p-4 bg-card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> Most Booked Classes</h3>
                  <div className="space-y-2">
                    {analytics.topClasses.slice(0, 5).map((cls, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cls.title}</p>
                          <p className="text-xs text-muted-foreground">{cls.venue}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{cls.count} bookings</p>
                          {cls.revenue > 0 && <p className="text-xs text-green-600">€{cls.revenue.toFixed(2)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.topVenues.length > 0 && (
                <div className="rounded-xl border p-4 bg-card">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Top Venues</h3>
                  <div className="space-y-2">
                    {analytics.topVenues.map((v, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{v.venueName}</p></div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{v.count}</p>
                          {v.revenue > 0 && <p className="text-xs text-green-600">€{v.revenue.toFixed(2)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Access Tab ── */}
      {activeTab === "access" && (
        <div className="px-4 py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by user or venue…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" data-testid="input-user-search" />
          </div>

          {grantsLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredGrants.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No venue access granted yet</p>
              <button onClick={() => setShowGrantForm(true)} className="text-xs text-primary mt-1 font-medium" data-testid="button-grant-first">Grant access to a user →</button>
            </div>
          ) : (
            filteredGrants.map(grant => (
              <div key={grant.id} className={`rounded-xl border overflow-hidden transition-all ${grant.isEnabled ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"}`} data-testid={`grant-${grant.id}`}>
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {grant.userProfilePicture ? (
                      <img src={grant.userProfilePicture} alt="" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <span className="font-bold text-primary text-sm">{(grant.userDisplayName || "?")[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" data-testid={`text-user-${grant.id}`}>{grant.userDisplayName || "Unknown"}</p>
                      <Badge variant={grant.isEnabled ? "default" : "secondary"} className="text-xs">{grant.isEnabled ? "Active" : "Suspended"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{grant.userEmail}</p>
                    <p className="text-xs font-medium mt-0.5">🏢 {grant.venueName} · <span className="text-muted-foreground capitalize">{grant.venueType}</span></p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={grant.isEnabled} onCheckedChange={v => handleUpdateGrant(grant, { isEnabled: v })} data-testid={`toggle-enabled-${grant.id}`} />
                    <button onClick={() => setExpandedGrant(expandedGrant === grant.id ? null : grant.id)} className="p-1.5 rounded-lg hover:bg-muted" data-testid={`button-expand-${grant.id}`}>
                      {expandedGrant === grant.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedGrant === grant.id && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Venue Name</Label>
                      <Input defaultValue={grant.venueName} onBlur={e => e.target.value !== grant.venueName && handleUpdateGrant(grant, { venueName: e.target.value })} className="text-sm h-8" data-testid={`input-venue-name-${grant.id}`} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Venue Type</Label>
                      <Select defaultValue={grant.venueType} onValueChange={v => handleUpdateGrant(grant, { venueType: v })}>
                        <SelectTrigger className="h-8 text-sm" data-testid={`select-venue-type-${grant.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{VENUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Admin Notes</Label>
                      <Textarea defaultValue={grant.notes || ""} onBlur={e => e.target.value !== (grant.notes || "") && handleUpdateGrant(grant, { notes: e.target.value })} rows={2} className="resize-none text-sm" placeholder="Internal notes…" data-testid={`textarea-notes-${grant.id}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">Granted: {formatDate(grant.grantedAt)}</p>
                    <Button variant="destructive" size="sm" className="w-full gap-1.5" onClick={() => { if (confirm(`Revoke programme access for ${grant.userDisplayName}?`)) revokeGrantMutation.mutate(grant.id); }} data-testid={`button-revoke-${grant.id}`}>
                      <Trash2 className="w-3.5 h-3.5" /> Revoke Access
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Items Tab ── */}
      {activeTab === "items" && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search classes or venues…" value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="pl-9" data-testid="input-item-search" />
            </div>
            <button onClick={() => refetchItems()} className="p-2 rounded-xl border border-border hover:bg-muted" data-testid="button-refresh-items">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {itemsLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No programme classes found</p>
              <button onClick={() => setShowItemForm(true)} className="text-xs text-primary mt-1 font-medium" data-testid="button-add-first-item">Add a class →</button>
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className={`rounded-xl border p-4 transition-all ${!item.isActive ? "opacity-50 bg-muted/20" : "bg-card"}`} data-testid={`admin-item-${item.id}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm">{item.title}</p>
                      {!item.isActive && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                      {item.isRecurring && <Badge variant="outline" className="text-xs gap-1"><RefreshCw className="w-3 h-3" /> Recurring</Badge>}
                      {item.ticketPrice && parseFloat(item.ticketPrice) > 0 && <Badge variant="outline" className="text-xs text-green-600">€{parseFloat(item.ticketPrice).toFixed(2)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">🏢 {item.venueName || "—"} · {item.userDisplayName || "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(item.startTime)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABELS_SHORT[item.category] || item.category}</Badge>
                      {item.capacity && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {item.capacity}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setEditingItem(item)} className="p-2 rounded-xl border border-border hover:bg-muted" title="Edit" data-testid={`edit-item-${item.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleItemMutation.mutate({ id: item.id, isActive: !item.isActive })}
                      className={`p-2 rounded-xl border transition-all ${item.isActive ? "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      title={item.isActive ? "Hide" : "Show"}
                      data-testid={`toggle-item-${item.id}`}
                    >
                      {item.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${item.title}"? This will also remove all reservations.`)) deleteItemMutation.mutate(item.id); }}
                      className="p-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      title="Delete"
                      data-testid={`delete-item-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Reservations Tab ── */}
      {activeTab === "reservations" && (
        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search user, class, venue…" value={regSearch} onChange={e => setRegSearch(e.target.value)} className="pl-9" data-testid="input-reg-search" />
            </div>
            <button onClick={() => refetchRegs()} className="p-2 rounded-xl border border-border hover:bg-muted" data-testid="button-refresh-regs">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Status filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", "paid", "reserved", "pending_payment", "cancelled"].map(s => (
              <button
                key={s}
                onClick={() => setRegStatusFilter(s)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${regStatusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
                data-testid={`filter-status-${s}`}
              >
                {s === "all" ? "All" : s === "pending_payment" ? "Pending Payment" : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== "all" && <span className="ml-1.5 text-[10px] opacity-70">{registrations.filter(r => r.status === s).length}</span>}
              </button>
            ))}
          </div>

          {regsLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredRegs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{regSearch || regStatusFilter !== "all" ? "No matching reservations" : "No reservations yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{filteredRegs.length} reservation{filteredRegs.length !== 1 ? "s" : ""}</p>
              {filteredRegs.map(reg => {
                const cfg = STATUS_CONFIG[reg.status] || STATUS_CONFIG.reserved;
                const StatusIcon = cfg.icon;
                return (
                  <div key={reg.id} className="rounded-xl border bg-card p-3.5" data-testid={`reg-${reg.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold text-sm truncate">{reg.itemTitle || "Unknown class"}</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">🏢 {reg.venueName || "—"}</p>
                        <p className="text-xs text-muted-foreground">👤 {reg.userName || "Unknown"} · {reg.userEmail || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">📅 {reg.occurrenceDate} · Booked {formatDate(reg.createdAt)}</p>
                        {reg.amountPaid && parseFloat(reg.amountPaid) > 0 && (
                          <p className="text-xs text-green-600 font-medium mt-0.5">€{parseFloat(reg.amountPaid).toFixed(2)} paid</p>
                        )}
                        {!reg.amountPaid && reg.itemTicketPrice && parseFloat(reg.itemTicketPrice) > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">€{parseFloat(reg.itemTicketPrice).toFixed(2)} due</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {/* Quick status actions */}
                        {reg.status !== "paid" && reg.status !== "confirmed" && (
                          <button
                            onClick={() => patchRegMutation.mutate({ id: reg.id, data: { status: "paid" } })}
                            className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/20 whitespace-nowrap"
                            data-testid={`button-mark-paid-${reg.id}`}
                          >
                            Mark Paid
                          </button>
                        )}
                        {reg.status !== "cancelled" && (
                          <button
                            onClick={() => patchRegMutation.mutate({ id: reg.id, data: { status: "cancelled" } })}
                            className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground border border-border hover:bg-muted/80 whitespace-nowrap"
                            data-testid={`button-cancel-reg-${reg.id}`}
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm(`Remove this reservation?`)) deleteRegMutation.mutate(reg.id); }}
                          className="text-xs px-2 py-1 rounded-lg text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 whitespace-nowrap"
                          data-testid={`button-delete-reg-${reg.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Grant Access Sheet ── */}
      <Sheet open={showGrantForm} onOpenChange={v => { if (!v) { setShowGrantForm(false); setGrantForm({ userId: "", venueName: "", venueType: "venue", notes: "" }); } }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
          <h2 className="font-bold text-base mb-1">Grant Programme Access</h2>
          <p className="text-xs text-muted-foreground mb-5">Give a user access to the programme planner for their venue.</p>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">User *</Label>
              <Select value={grantForm.userId} onValueChange={v => setGrantForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger data-testid="select-user"><SelectValue placeholder="Select user…" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">All users already have access</div>
                  ) : (
                    availableUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        <span className="flex items-center gap-2">
                          {u.role === "spot_owner" && <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">Spot Owner</span>}
                          {u.displayName} <span className="text-muted-foreground text-xs">({u.email})</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Venue Name *</Label>
              <Input value={grantForm.venueName} onChange={e => setGrantForm(f => ({ ...f, venueName: e.target.value }))} placeholder="e.g. Shelter Amsterdam" data-testid="input-grant-venue-name" />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Venue Type</Label>
              <Select value={grantForm.venueType} onValueChange={v => setGrantForm(f => ({ ...f, venueType: v }))}>
                <SelectTrigger data-testid="select-grant-venue-type"><SelectValue /></SelectTrigger>
                <SelectContent>{VENUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Admin Notes (optional)</Label>
              <Textarea value={grantForm.notes} onChange={e => setGrantForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal note…" rows={2} className="resize-none text-sm" data-testid="textarea-grant-notes" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowGrantForm(false)} className="flex-1" data-testid="button-cancel-grant">Cancel</Button>
            <Button onClick={handleGrant} disabled={grantMutation.isPending} className="flex-1" data-testid="button-confirm-grant">
              {grantMutation.isPending ? "Granting…" : "Grant Access"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add Class Sheet (Admin creates for any venue) ── */}
      <Sheet open={showItemForm} onOpenChange={v => { if (!v) { setShowItemForm(false); setItemForm({ ...BLANK_ITEM_FORM }); } }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
          <h2 className="font-bold text-base mb-1">Add Class to Venue</h2>
          <p className="text-xs text-muted-foreground mb-5">Create a class or session on behalf of a venue owner.</p>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Venue Owner *</Label>
              <Select value={itemForm.userId} onValueChange={v => setItemForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger data-testid="select-item-user"><SelectValue placeholder="Select venue owner…" /></SelectTrigger>
                <SelectContent>
                  {allVenueUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No active venues yet — grant access first</div>
                  ) : (
                    allVenueUsers.map(g => (
                      <SelectItem key={g.userId} value={String(g.userId)}>
                        {g.venueName} {g.userDisplayName ? `(${g.userDisplayName})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Title *</Label>
              <Input value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Breaking Fundamentals" data-testid="input-item-title" />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Description</Label>
              <Textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none text-sm" placeholder="What's this class about?" data-testid="textarea-item-desc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Start *</Label>
                <Input type="datetime-local" value={itemForm.startTime} onChange={e => setItemForm(f => ({ ...f, startTime: e.target.value }))} className="text-sm" data-testid="input-item-start" />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">End *</Label>
                <Input type="datetime-local" value={itemForm.endTime} onChange={e => setItemForm(f => ({ ...f, endTime: e.target.value }))} className="text-sm" data-testid="input-item-end" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Capacity</Label>
                <Input type="number" value={itemForm.capacity} onChange={e => setItemForm(f => ({ ...f, capacity: e.target.value }))} placeholder="Unlimited" className="text-sm" data-testid="input-item-capacity" />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Price (€)</Label>
                <Input type="number" step="0.01" value={itemForm.ticketPrice} onChange={e => setItemForm(f => ({ ...f, ticketPrice: e.target.value }))} placeholder="Free" className="text-sm" data-testid="input-item-price" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isRecurring} onCheckedChange={v => setItemForm(f => ({ ...f, isRecurring: v }))} data-testid="switch-recurring" />
              <Label className="text-sm">Recurring</Label>
            </div>
            {itemForm.isRecurring && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Frequency</Label>
                  <Select value={itemForm.recurrenceType} onValueChange={v => setItemForm(f => ({ ...f, recurrenceType: v }))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Ends on</Label>
                  <Input type="date" value={itemForm.recurrenceEnd} onChange={e => setItemForm(f => ({ ...f, recurrenceEnd: e.target.value }))} className="text-sm" data-testid="input-item-recurrence-end" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.isPublic} onCheckedChange={v => setItemForm(f => ({ ...f, isPublic: v }))} data-testid="switch-public" />
              <Label className="text-sm">Visible to public</Label>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowItemForm(false)} className="flex-1" data-testid="button-cancel-item">Cancel</Button>
            <Button onClick={handleCreateItem} disabled={createItemMutation.isPending} className="flex-1" data-testid="button-confirm-item">
              {createItemMutation.isPending ? "Creating…" : "Create Class"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit Item Sheet ── */}
      <Sheet open={!!editingItem} onOpenChange={v => { if (!v) setEditingItem(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-5 pb-10">
          {editingItem && (
            <>
              <div className="mx-auto w-10 h-1 rounded-full bg-muted mb-5 mt-2" />
              <h2 className="font-bold text-base mb-1">Edit Class</h2>
              <p className="text-xs text-muted-foreground mb-5">🏢 {editingItem.venueName || "—"} · {editingItem.userDisplayName || "—"}</p>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Title</Label>
                  <Input value={editingItem.title} onChange={e => setEditingItem(prev => prev ? { ...prev, title: e.target.value } : null)} data-testid="input-edit-title" />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Description</Label>
                  <Textarea value={editingItem.description || ""} onChange={e => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)} rows={2} className="resize-none text-sm" data-testid="textarea-edit-desc" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Start</Label>
                    <Input type="datetime-local" value={new Date(editingItem.startTime).toISOString().slice(0, 16)} onChange={e => setEditingItem(prev => prev ? { ...prev, startTime: e.target.value } : null)} className="text-sm" data-testid="input-edit-start" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">End</Label>
                    <Input type="datetime-local" value={new Date(editingItem.endTime).toISOString().slice(0, 16)} onChange={e => setEditingItem(prev => prev ? { ...prev, endTime: e.target.value } : null)} className="text-sm" data-testid="input-edit-end" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Capacity</Label>
                    <Input type="number" value={editingItem.capacity ?? ""} onChange={e => setEditingItem(prev => prev ? { ...prev, capacity: e.target.value ? parseInt(e.target.value) : null } : null)} placeholder="Unlimited" className="text-sm" data-testid="input-edit-capacity" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">Price (€)</Label>
                    <Input type="number" step="0.01" value={editingItem.ticketPrice ?? ""} onChange={e => setEditingItem(prev => prev ? { ...prev, ticketPrice: e.target.value || null } : null)} placeholder="Free" className="text-sm" data-testid="input-edit-price" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editingItem.isPublic} onCheckedChange={v => setEditingItem(prev => prev ? { ...prev, isPublic: v } : null)} />
                  <Label className="text-sm">Public</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editingItem.isActive} onCheckedChange={v => setEditingItem(prev => prev ? { ...prev, isActive: v } : null)} />
                  <Label className="text-sm">Active (visible)</Label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setEditingItem(null)} className="flex-1" data-testid="button-cancel-edit">Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={editItemMutation.isPending} className="flex-1" data-testid="button-save-edit">
                  {editItemMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
