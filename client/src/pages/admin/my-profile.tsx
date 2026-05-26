import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  User, Brain, Save, Plus, Trash2, Edit2, Eye, EyeOff, Check,
  Sparkles, ChevronDown, ChevronUp, RotateCcw, Globe, Lock, Loader2
} from "lucide-react";

type ProfileSection = {
  id: number;
  key: string;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: string;
};

type TrainingEntry = {
  id: number;
  category: string;
  title: string;
  content: string;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = [
  { value: "story", label: "Story & Background" },
  { value: "values", label: "Values & Beliefs" },
  { value: "projects", label: "Projects & Work" },
  { value: "style", label: "Voice & Style" },
  { value: "vision", label: "Vision & Mission" },
  { value: "general", label: "General Knowledge" },
];

const SECTION_DEFAULTS = [
  { key: "headline", label: "Who I Am", sortOrder: 0 },
  { key: "background", label: "Background & Origins", sortOrder: 1 },
  { key: "journey", label: "My Journey", sortOrder: 2 },
  { key: "coffee_and_dance", label: "Coffee & Dance", sortOrder: 3 },
  { key: "btts", label: "Back to the Street (BTTS)", sortOrder: 4 },
  { key: "vision", label: "Vision & Mission", sortOrder: 5 },
  { key: "values", label: "What I Stand For", sortOrder: 6 },
];

export default function MyProfilePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "ai">("profile");
  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md">
            <User className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">My Profile & AI Identity</h1>
            <p className="text-sm text-muted-foreground">Control how you are represented across the platform and how Urban AI understands you</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border/60 pb-0">
          <button
            onClick={() => setActiveTab("profile")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "profile"
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-profile"
          >
            <span className="flex items-center gap-2"><User className="h-4 w-4" />My Story</span>
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === "ai"
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            data-testid="tab-ai-training"
          >
            <span className="flex items-center gap-2"><Brain className="h-4 w-4" />AI Training</span>
          </button>
        </div>

        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "ai" && <AITrainingTab />}
      </div>
    </AdminLayout>
  );
}

function ProfileTab() {
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<Record<string, string>>({});
  const [draftLabel, setDraftLabel] = useState<Record<string, string>>({});
  const [newSection, setNewSection] = useState<{ key: string; label: string; content: string } | null>(null);

  const { data: sections = [], isLoading } = useQuery<ProfileSection[]>({
    queryKey: ["/api/admin/founder-profile"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, label, content, sortOrder }: { key: string; label: string; content: string; sortOrder?: number }) => {
      const res = await apiRequest(`/api/admin/founder-profile/${key}`, "PATCH", { label, content, sortOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founder-profile"] });
      toast({ title: "Saved", description: "Section updated successfully" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const addSectionMutation = useMutation({
    mutationFn: async (s: { key: string; label: string; content: string }) => {
      const res = await apiRequest(`/api/admin/founder-profile/${s.key}`, "PATCH", { label: s.label, content: s.content, sortOrder: 99 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founder-profile"] });
      setNewSection(null);
      toast({ title: "Added", description: "New section added" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const handleSave = (section: ProfileSection) => {
    saveMutation.mutate({
      key: section.key,
      label: draftLabel[section.key] ?? section.label,
      content: draftContent[section.key] ?? section.content,
      sortOrder: section.sortOrder,
    });
    setEditingKey(null);
  };

  const startEdit = (section: ProfileSection) => {
    setEditingKey(section.key);
    setDraftContent(prev => ({ ...prev, [section.key]: section.content }));
    setDraftLabel(prev => ({ ...prev, [section.key]: section.label }));
  };

  const cancelEdit = (key: string) => {
    setEditingKey(null);
    setDraftContent(prev => { const n = { ...prev }; delete n[key]; return n; });
    setDraftLabel(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const existingKeys = sections.map(s => s.key);
  const missingDefaults = SECTION_DEFAULTS.filter(d => !existingKeys.includes(d.key));

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-violet-700 dark:text-violet-300">
            These sections make up your public profile and are used by Urban AI to represent you accurately. Edit any section, add new ones, or remove anything that doesn't belong. Changes take effect immediately.
          </p>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
            {editingKey === section.key ? (
              <Input
                value={draftLabel[section.key] ?? section.label}
                onChange={e => setDraftLabel(prev => ({ ...prev, [section.key]: e.target.value }))}
                className="h-7 text-sm font-semibold max-w-xs"
                data-testid={`label-input-${section.key}`}
              />
            ) : (
              <span className="text-sm font-semibold">{section.label}</span>
            )}
            <div className="flex items-center gap-2">
              {editingKey === section.key ? (
                <>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelEdit(section.key)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleSave(section)}
                    disabled={saveMutation.isPending}
                    data-testid={`save-section-${section.key}`}
                  >
                    {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => startEdit(section)}
                  data-testid={`edit-section-${section.key}`}
                >
                  <Edit2 className="h-3 w-3" />Edit
                </Button>
              )}
            </div>
          </div>
          <div className="p-4">
            {editingKey === section.key ? (
              <Textarea
                value={draftContent[section.key] ?? section.content}
                onChange={e => setDraftContent(prev => ({ ...prev, [section.key]: e.target.value }))}
                className="min-h-[120px] text-sm resize-y"
                placeholder="Write your story here..."
                data-testid={`content-textarea-${section.key}`}
              />
            ) : (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {section.content || <span className="text-muted-foreground italic">No content yet. Click Edit to add your story.</span>}
              </p>
            )}
          </div>
        </div>
      ))}

      {missingDefaults.length > 0 && sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No profile sections yet. Initialize with the default structure?</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const defaults = SECTION_DEFAULTS.map(d => ({ key: d.key, label: d.label, content: "", sortOrder: d.sortOrder }));
              Promise.all(defaults.map(d => apiRequest(`/api/admin/founder-profile/${d.key}`, "PATCH", d)))
                .then(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/founder-profile"] }));
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />Initialize Default Sections
          </Button>
        </div>
      )}

      {newSection !== null ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Section</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Section ID (lowercase, no spaces)</label>
              <Input
                placeholder="e.g. awards, collaborations"
                value={newSection.key}
                onChange={e => setNewSection(prev => prev ? { ...prev, key: e.target.value.toLowerCase().replace(/\s+/g, "_") } : null)}
                className="h-8 text-sm"
                data-testid="new-section-key"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Section Title</label>
              <Input
                placeholder="e.g. Awards & Recognition"
                value={newSection.label}
                onChange={e => setNewSection(prev => prev ? { ...prev, label: e.target.value } : null)}
                className="h-8 text-sm"
                data-testid="new-section-label"
              />
            </div>
          </div>
          <Textarea
            placeholder="Write the content for this section..."
            value={newSection.content}
            onChange={e => setNewSection(prev => prev ? { ...prev, content: e.target.value } : null)}
            className="min-h-[100px] text-sm resize-y"
            data-testid="new-section-content"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNewSection(null)}>Cancel</Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={!newSection.key.trim() || !newSection.label.trim() || addSectionMutation.isPending}
              onClick={() => newSection && addSectionMutation.mutate(newSection)}
              data-testid="add-section-submit"
            >
              {addSectionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Add Section
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-dashed"
          onClick={() => setNewSection({ key: "", label: "", content: "" })}
          data-testid="add-section-btn"
        >
          <Plus className="h-4 w-4" />Add New Section
        </Button>
      )}
    </div>
  );
}

function AITrainingTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "general", title: "", content: "", isPublic: false });
  const [editForm, setEditForm] = useState<Record<number, { category: string; title: string; content: string; isPublic: boolean }>>({});

  const { data: entries = [], isLoading } = useQuery<TrainingEntry[]>({
    queryKey: ["/api/admin/ai-training"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("/api/admin/ai-training", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-training"] });
      setForm({ category: "general", title: "", content: "", isPublic: false });
      setShowForm(false);
      toast({ title: "Added", description: "Training entry added to Urban AI" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TrainingEntry> }) => {
      const res = await apiRequest(`/api/admin/ai-training/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-training"] });
      setEditingId(null);
      toast({ title: "Updated", description: "Training entry updated" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/admin/ai-training/${id}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-training"] });
      toast({ title: "Deleted", description: "Training entry removed" });
    },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const startEdit = (entry: TrainingEntry) => {
    setEditingId(entry.id);
    setEditForm(prev => ({ ...prev, [entry.id]: { category: entry.category, title: entry.title, content: entry.content, isPublic: entry.isPublic } }));
  };

  const saveEdit = (id: number) => {
    const data = editForm[id];
    if (data) updateMutation.mutate({ id, data });
  };

  const toggleActive = (entry: TrainingEntry) => {
    updateMutation.mutate({ id: entry.id, data: { isActive: !entry.isActive } as Partial<TrainingEntry> });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const active = entries.filter(e => e.isActive);
  const inactive = entries.filter(e => !e.isActive);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">How AI Training Works</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Every entry you add here is fed directly into Urban AI. The AI learns your tone, values, projects, and way of communicating. Entries marked as <strong>Public</strong> can be referenced in AI responses. <strong>Internal</strong> entries shape how the AI thinks about you without being quoted directly.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{active.length} active entries</Badge>
          {inactive.length > 0 && <Badge variant="outline" className="text-xs text-muted-foreground">{inactive.length} paused</Badge>}
        </div>
        {!showForm && (
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)} data-testid="add-training-btn">
            <Plus className="h-4 w-4" />Add Training Entry
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" />New Training Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="training-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Title (optional)</label>
              <Input
                placeholder="Brief title"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="h-8 text-xs"
                data-testid="training-title"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Content</label>
            <Textarea
              placeholder="Write what you want the AI to know and understand about you, your work, your tone, your values..."
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              className="min-h-[120px] text-sm resize-y"
              data-testid="training-content"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isPublic}
                onCheckedChange={v => setForm(p => ({ ...p, isPublic: v }))}
                data-testid="training-ispublic"
              />
              <div className="flex items-center gap-1.5">
                {form.isPublic ? <Globe className="h-3.5 w-3.5 text-green-500" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground">
                  {form.isPublic ? "Public — AI can reference this in responses" : "Internal — shapes AI understanding only"}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                size="sm"
                className="gap-1"
                disabled={!form.content.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
                data-testid="training-submit"
              >
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Brain className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No training entries yet. Start feeding Urban AI with your story, values, and tone.</p>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Your First Entry
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {active.map(entry => (
          <TrainingEntryCard
            key={entry.id}
            entry={entry}
            editingId={editingId}
            editForm={editForm}
            setEditForm={setEditForm}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onToggleActive={toggleActive}
            onDelete={(id) => deleteMutation.mutate(id)}
            updateMutation={updateMutation}
            deleteMutation={deleteMutation}
          />
        ))}
        {inactive.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 select-none py-1">
              <ChevronDown className="h-3 w-3 group-open:hidden" />
              <ChevronUp className="h-3 w-3 hidden group-open:inline" />
              {inactive.length} paused entries
            </summary>
            <div className="space-y-3 mt-2">
              {inactive.map(entry => (
                <TrainingEntryCard
                  key={entry.id}
                  entry={entry}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onToggleActive={toggleActive}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  updateMutation={updateMutation}
                  deleteMutation={deleteMutation}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function TrainingEntryCard({
  entry, editingId, editForm, setEditForm, onStartEdit, onSaveEdit, onCancelEdit, onToggleActive, onDelete, updateMutation, deleteMutation,
}: {
  entry: TrainingEntry;
  editingId: number | null;
  editForm: Record<number, { category: string; title: string; content: string; isPublic: boolean }>;
  setEditForm: (fn: (prev: Record<number, any>) => Record<number, any>) => void;
  onStartEdit: (e: TrainingEntry) => void;
  onSaveEdit: (id: number) => void;
  onCancelEdit: () => void;
  onToggleActive: (e: TrainingEntry) => void;
  onDelete: (id: number) => void;
  updateMutation: { isPending: boolean };
  deleteMutation: { isPending: boolean };
}) {
  const isEditing = editingId === entry.id;
  const ef = editForm[entry.id];
  const catLabel = CATEGORIES.find(c => c.value === entry.category)?.label ?? entry.category;

  return (
    <div className={cn(
      "rounded-xl border bg-card shadow-sm overflow-hidden transition-opacity",
      !entry.isActive && "opacity-50"
    )}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] h-5">{catLabel}</Badge>
          {entry.title && <span className="text-xs font-medium">{entry.title}</span>}
          <div className="flex items-center gap-1">
            {entry.isPublic
              ? <><Globe className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600">Public</span></>
              : <><Lock className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Internal</span></>
            }
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onToggleActive(entry)} title={entry.isActive ? "Pause" : "Activate"}>
            {entry.isActive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          {isEditing ? (
            <>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={onCancelEdit}>Cancel</Button>
              <Button size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => onSaveEdit(entry.id)} disabled={updateMutation.isPending} data-testid={`save-training-${entry.id}`}>
                {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onStartEdit(entry)} data-testid={`edit-training-${entry.id}`}>
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive" onClick={() => onDelete(entry.id)} data-testid={`delete-training-${entry.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="p-4">
        {isEditing && ef ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select value={ef.category} onValueChange={v => setEditForm(p => ({ ...p, [entry.id]: { ...p[entry.id], category: v } }))}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input
                placeholder="Title (optional)"
                value={ef.title}
                onChange={e => setEditForm(p => ({ ...p, [entry.id]: { ...p[entry.id], title: e.target.value } }))}
                className="h-7 text-xs"
              />
            </div>
            <Textarea
              value={ef.content}
              onChange={e => setEditForm(p => ({ ...p, [entry.id]: { ...p[entry.id], content: e.target.value } }))}
              className="min-h-[100px] text-sm resize-y"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={ef.isPublic}
                onCheckedChange={v => setEditForm(p => ({ ...p, [entry.id]: { ...p[entry.id], isPublic: v } }))}
              />
              <span className="text-xs text-muted-foreground">{ef.isPublic ? "Public" : "Internal"}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
        )}
      </div>
    </div>
  );
}
