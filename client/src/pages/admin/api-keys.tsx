import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Key, Plus, Copy, Trash2, Ban, CheckCircle2, Clock, Activity,
  Code2, Globe, Users, MapPin, AlertTriangle, Eye, EyeOff
} from "lucide-react";
import { format } from "date-fns";

interface ApiKeyRecord {
  id: number;
  name: string;
  keyPrefix: string;
  permissions: string[];
  requestCount: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  userId?: number;
  userName?: string;
  userEmail?: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: "read", label: "Read Events", icon: Globe, description: "Access /api/public/events" },
  { id: "locations", label: "Read Locations", icon: MapPin, description: "Access /api/public/locations" },
  { id: "artists", label: "Read Artists", icon: Users, description: "Access /api/public/artists" },
];

const PUBLIC_ENDPOINTS = [
  { method: "GET", path: "/api/public/events", desc: "List events (limit, offset)" },
  { method: "GET", path: "/api/public/locations", desc: "List city spots/locations" },
  { method: "GET", path: "/api/public/artists", desc: "List artist profiles" },
];

export default function ApiKeysPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(["read"]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const { data: myKeys = [], isLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: ["/api/developer/keys"],
  });

  const { data: allKeys = [] } = useQuery<ApiKeyRecord[]>({
    queryKey: ["/api/admin/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/developer/keys", "POST", { name: newKeyName, permissions: newKeyPerms });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/developer/keys"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setRevealedKey(data.key);
      setShowKeyDialog(true);
      setCreateOpen(false);
      setNewKeyName("");
      setNewKeyPerms(["read"]);
    },
    onError: () => toast({ title: "Failed to create key", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/developer/keys/${id}/revoke`, "PATCH", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/developer/keys"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "Key revoked" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/developer/keys/${id}`, "DELETE", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/developer/keys"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "Key deleted" });
    },
  });

  const adminRevokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/admin/api-keys/${id}/revoke`, "PATCH", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "Key revoked" });
    },
  });

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied to clipboard" });
  };

  const togglePerm = (perm: string) => {
    setNewKeyPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Key className="w-6 h-6 text-primary" />
              API Key Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate and manage API keys to access Urban Culture Connect data programmatically.
            </p>
          </div>
          <Button data-testid="button-create-key" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New API Key
          </Button>
        </div>

        {/* Public API docs card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Public API Endpoints
            </CardTitle>
            <CardDescription>Pass your key as a header or query param on any request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-background border p-3 text-sm font-mono text-muted-foreground">
              Authorization: Bearer uch_your_api_key_here
            </div>
            <div className="rounded-md bg-background border p-3 text-sm font-mono text-muted-foreground">
              GET /api/public/events?api_key=uch_your_key&limit=20&offset=0
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {PUBLIC_ENDPOINTS.map(ep => (
                <div key={ep.path} className="rounded-lg border p-3 bg-background">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono text-green-600 border-green-200">{ep.method}</Badge>
                    <span className="text-xs font-mono font-medium">{ep.path}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ep.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Keys</CardTitle>
            <CardDescription>{myKeys.length} key{myKeys.length !== 1 ? "s" : ""} created</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : myKeys.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No keys yet. Create your first API key to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myKeys.map(k => (
                  <div key={k.id} data-testid={`card-api-key-${k.id}`}
                    className="flex items-start justify-between rounded-xl border p-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{k.name}</span>
                        {k.isActive
                          ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Active</Badge>
                          : <Badge variant="destructive" className="text-xs">Revoked</Badge>
                        }
                        {k.permissions.map(p => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{k.keyPrefix}••••••••••••••••••••</span>
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{k.requestCount} requests</span>
                        {k.lastUsedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Used {format(new Date(k.lastUsedAt), "MMM d")}</span>}
                        <span>Created {format(new Date(k.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {k.isActive && (
                        <Button data-testid={`button-revoke-${k.id}`} variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700"
                          onClick={() => revokeMutation.mutate(k.id)}>
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      <Button data-testid={`button-delete-${k.id}`} variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(k.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin: all keys */}
        {allKeys.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Keys (Admin View)</CardTitle>
              <CardDescription>{allKeys.length} total keys across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allKeys.map(k => (
                  <div key={k.id} data-testid={`card-admin-key-${k.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 gap-4 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{k.name}</span>
                        {k.isActive
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                        }
                        <span className="text-muted-foreground text-xs">{k.userName || k.userEmail || `User ${k.userId}`}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{k.keyPrefix}…</span> · {k.requestCount} req · Created {format(new Date(k.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    {k.isActive && (
                      <Button data-testid={`button-admin-revoke-${k.id}`} variant="outline" size="sm" className="text-xs"
                        onClick={() => adminRevokeMutation.mutate(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                data-testid="input-key-name"
                placeholder="e.g. My App, Website Integration"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              {AVAILABLE_PERMISSIONS.map(({ id, label, icon: Icon, description }) => (
                <div key={id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Checkbox
                    data-testid={`checkbox-perm-${id}`}
                    id={`perm-${id}`}
                    checked={newKeyPerms.includes(id)}
                    onCheckedChange={() => togglePerm(id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={`perm-${id}`} className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-confirm-create"
              onClick={() => createMutation.mutate()}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show new key dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" /> API Key Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Copy this key now. It will never be shown again.
            </p>
            <div className="rounded-lg border bg-muted p-3 flex items-center gap-2">
              <code data-testid="text-new-api-key" className="flex-1 text-sm font-mono break-all select-all">
                {showKey ? revealedKey : "uch_••••••••••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowKey(s => !s)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <Button data-testid="button-copy-key" className="w-full" onClick={() => copyKey(revealedKey!)}>
              <Copy className="w-4 h-4 mr-2" /> Copy Key
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowKeyDialog(false); setRevealedKey(null); setShowKey(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
