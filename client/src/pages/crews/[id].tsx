import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, MapPin, Calendar, Instagram, ArrowLeft, Crown, UserPlus, UserMinus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CrewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: crew, isLoading } = useQuery<any>({ queryKey: ["/api/crews", parseInt(id)] });

  const isMember = crew?.members?.some((m: any) => m.user_id === user?.id);
  const isFounder = crew?.founder_id === user?.id;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const joinMutation = useMutation({
    mutationFn: () => apiRequest(`/api/crews/${id}/join`, "POST"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crews", parseInt(id)] }); toast({ title: "Joined crew! +10 Cred 🤝" }); },
    onError: () => toast({ title: "Failed to join", variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest(`/api/crews/${id}/leave`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/crews", parseInt(id)] }); toast({ title: "Left crew" }); },
  });

  const kickMutation = useMutation({
    mutationFn: (userId: number) => apiRequest(`/api/crews/${id}/members/${userId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crews", parseInt(id)] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/crews/${id}`, "DELETE"),
    onSuccess: () => { navigate("/crews"); toast({ title: "Crew deleted" }); },
  });

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!crew) return <div className="text-center py-24 text-muted-foreground">Crew not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/crews")} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> All Crews
      </Button>

      {/* Banner + Header */}
      <div className="relative rounded-xl overflow-hidden">
        <div className="h-48 bg-gradient-to-br from-purple-900 via-blue-900 to-black">
          {crew.banner_url && <img src={crew.banner_url} alt="" className="w-full h-full object-cover opacity-50" />}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
          {crew.logo_url ? (
            <img src={crew.logo_url} alt="" className="w-20 h-20 rounded-xl object-cover border-4 border-background shadow-xl" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-black text-3xl border-4 border-background shadow-xl">
              {crew.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white drop-shadow">{crew.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="capitalize bg-purple-600">{crew.discipline}</Badge>
              {crew.city && <span className="text-white/70 text-sm flex items-center gap-1"><MapPin className="w-3 h-3" />{crew.city}</span>}
              {crew.founded_year && <span className="text-white/70 text-sm flex items-center gap-1"><Calendar className="w-3 h-3" />{crew.founded_year}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {user && !isMember && !isFounder && (
          <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending} data-testid="btn-join-crew">
            {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Join Crew
          </Button>
        )}
        {user && isMember && !isFounder && (
          <Button variant="outline" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending} data-testid="btn-leave-crew">
            <UserMinus className="w-4 h-4 mr-1" /> Leave Crew
          </Button>
        )}
        {crew.instagram && (
          <a href={`https://instagram.com/${crew.instagram.replace("@","")}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline"><Instagram className="w-4 h-4 mr-1" />{crew.instagram}</Button>
          </a>
        )}
        {(isFounder || isAdmin) && (
          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} className="ml-auto" data-testid="btn-delete-crew">
            <Trash2 className="w-4 h-4 mr-1" /> Delete Crew
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* About */}
        <div className="lg:col-span-2 space-y-4">
          {crew.description && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">About</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{crew.description}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Members */}
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" /> Members ({crew.members?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {crew.members?.map((m: any) => (
                <div key={m.id} data-testid={`member-row-${m.user_id}`} className="flex items-center gap-2 group">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.display_name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                      {m.display_name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1">
                      {m.display_name}
                      {m.role === "founder" && <Crown className="w-3 h-3 text-yellow-400" />}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{m.discipline || m.role}</div>
                  </div>
                  {(isFounder || isAdmin) && m.role !== "founder" && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => kickMutation.mutate(m.user_id)}>
                      <UserMinus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
