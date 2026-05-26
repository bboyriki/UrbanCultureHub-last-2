import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Share2, Search, Loader2, Users, CheckCircle, XCircle } from "lucide-react";

interface ShareUser {
  id: number;
  displayName: string;
  email: string;
  role: string;
  canShareContent: boolean;
  profilePicture?: string;
  createdAt: string;
}

export default function AdminSharePermissionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<ShareUser[]>({
    queryKey: ["/api/admin/share-permissions/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/share-permissions/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/share-permissions/grant/${userId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/share-permissions/users"] });
      toast({ title: "Share permission granted" });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to grant permission", variant: "destructive" }); setPendingToggle(null); },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/share-permissions/revoke/${userId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/share-permissions/users"] });
      toast({ title: "Share permission revoked" });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to revoke permission", variant: "destructive" }); setPendingToggle(null); },
  });

  const toggle = (user: ShareUser) => {
    setPendingToggle(user.id);
    if (user.canShareContent) revokeMutation.mutate(user.id);
    else grantMutation.mutate(user.id);
  };

  const filtered = users.filter(u =>
    u.role !== "admin" &&
    (u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const granted = filtered.filter(u => u.canShareContent).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Share Access</h1>
            <p className="text-sm text-muted-foreground">Control which users can share posts and reels externally</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-cyan-600">{granted}</p>
            <p className="text-xs text-muted-foreground mt-1">With access</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{filtered.length - granted}</p>
            <p className="text-xs text-muted-foreground mt-1">Without access</p>
          </div>
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total users</p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-semibold mb-1">How it works</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Sharing posts in the community feed and reels is locked by default</li>
            <li>Only admins can grant share access to individual users from this page</li>
            <li>Users without access will see a "Sharing locked" message when they tap the share button</li>
            <li>Admins always have share access</li>
          </ul>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9"
            data-testid="input-search-share-users"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                data-testid={`row-share-user-${u.id}`}>
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={u.profilePicture || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {u.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" data-testid={`text-name-${u.id}`}>{u.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.canShareContent ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-[10px] gap-1">
                      <CheckCircle className="w-2.5 h-2.5" />
                      Can Share
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                      <XCircle className="w-2.5 h-2.5" />
                      Locked
                    </Badge>
                  )}
                  <Switch
                    checked={u.canShareContent}
                    onCheckedChange={() => toggle(u)}
                    disabled={pendingToggle === u.id}
                    data-testid={`toggle-share-access-${u.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
