import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Search, Loader2, Shield, Users, CheckCircle, XCircle } from "lucide-react";

interface SpotUser {
  id: number;
  displayName: string;
  email: string;
  role: string;
  canAddSpots: boolean;
  profilePicture?: string;
  createdAt: string;
}

export default function AdminSpotCreatorsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<number | null>(null);

  const { data: users = [], isLoading } = useQuery<SpotUser[]>({
    queryKey: ["/api/admin/spots/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/spots/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/spots/grant/${userId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/spots/users"] });
      toast({ title: "Spot permission granted" });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to grant permission", variant: "destructive" }); setPendingToggle(null); },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/admin/spots/revoke/${userId}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/spots/users"] });
      toast({ title: "Spot permission revoked" });
      setPendingToggle(null);
    },
    onError: () => { toast({ title: "Failed to revoke permission", variant: "destructive" }); setPendingToggle(null); },
  });

  const toggle = (user: SpotUser) => {
    setPendingToggle(user.id);
    if (user.canAddSpots) revokeMutation.mutate(user.id);
    else grantMutation.mutate(user.id);
  };

  const filtered = users.filter(u =>
    u.role !== "admin" &&
    (u.displayName.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const granted = filtered.filter(u => u.canAddSpots).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Spot Creator Access</h1>
            <p className="text-sm text-muted-foreground">Control which users can submit new community spots</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-600">{granted}</p>
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

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-semibold mb-1">How it works</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Users with Spot Creator access can submit new community spots</li>
            <li>Their submissions go through the approval process (Pending → Approved)</li>
            <li>Admins can approve or reject submissions in the Spots tab</li>
            <li>Admins always have access and their spots are auto-approved</li>
          </ul>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>

        {/* Users list */}
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
                data-testid={`row-user-${u.id}`}>
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={u.profilePicture || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {u.displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.canAddSpots ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-[10px] gap-1">
                      <CheckCircle className="w-2.5 h-2.5" />
                      Spot Creator
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                      <XCircle className="w-2.5 h-2.5" />
                      No access
                    </Badge>
                  )}
                  <Switch
                    checked={u.canAddSpots}
                    onCheckedChange={() => toggle(u)}
                    disabled={pendingToggle === u.id}
                    data-testid={`toggle-spot-access-${u.id}`}
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
