import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Lock, Globe, MapPin, ArrowLeft, Loader2, Send, Heart,
  MessageCircle, Shield, Crown, UserMinus, Settings, CheckCircle,
  XCircle, MoreHorizontal, Trash2, UserCheck, Edit3, Clock, Bell,
  Layers, Star, Music2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

type Tab = "feed" | "members" | "requests" | "settings";

function PostCard({
  post, user, groupId, isGroupAdmin, onDelete,
}: {
  post: any; user: any; groupId: string; isGroupAdmin: boolean; onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(post.viewerLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likesCount ?? 0);
  const [showMenu, setShowMenu] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${groupId}/posts/${post.id}/like`, "POST", {});
      return r.json();
    },
    onSuccess: (data) => {
      setLiked(data.liked);
      setLikeCount(data.count);
    },
  });

  const canDelete = user && (user.id === post.userId || isGroupAdmin || ["admin", "super_admin"].includes(user.role));

  return (
    <Card className="mb-3 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            {post.profilePicture && <AvatarImage src={post.profilePicture} />}
            <AvatarFallback className="text-xs font-semibold">{(post.displayName || "?")[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-sm font-semibold">{post.displayName}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
              {canDelete && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
                    data-testid={`button-post-menu-${post.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 top-7 z-20 bg-background border border-border rounded-xl shadow-lg min-w-[140px] py-1">
                      <button
                        onClick={() => { onDelete(post.id); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        data-testid={`button-delete-post-${post.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete post
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
            {post.image && (
              <img src={post.image} alt="" className="mt-2 rounded-xl max-h-80 object-cover w-full" />
            )}
            {/* Actions */}
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/40">
              <button
                onClick={() => user && likeMutation.mutate()}
                disabled={!user || likeMutation.isPending}
                className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-red-400"}`}
                data-testid={`button-like-post-${post.id}`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                <span>{likeCount > 0 ? likeCount : ""} {likeCount === 1 ? "Like" : likeCount > 1 ? "Likes" : "Like"}</span>
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const isPlatformAdmin = user && ["admin", "super_admin"].includes(user.role);

  const { data: group, isLoading } = useQuery<any>({
    queryKey: [`/api/groups/${id}`],
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<any[]>({
    queryKey: [`/api/groups/${id}/posts`],
    enabled: !!group,
  });

  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/my/groups"],
    enabled: !!user,
  });

  const { data: joinRequests = [] } = useQuery<any[]>({
    queryKey: [`/api/groups/${id}/join-requests`],
    queryFn: async () => {
      const r = await apiRequest(`/api/groups/${id}/join-requests`, "GET");
      return r.json();
    },
    enabled: !!group && !!(isPlatformAdmin || (myGroups.find((g: any) => g.id === parseInt(id))?.myRole === "admin")),
  });

  const isMember = myGroups.some((g: any) => g.id === parseInt(id));
  const myMembership = myGroups.find((g: any) => g.id === parseInt(id));
  const isGroupAdmin = myMembership?.myRole === "admin" || !!isPlatformAdmin;
  const members = group?.members || [];

  // Show requests tab only for group admins of private groups
  const showRequestsTab = isGroupAdmin && group?.isPrivate;

  // ── Mutations ─────────────────────────────────────────────────────────

  const joinMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${id}/join`, "POST", {});
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/groups"] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: data.status === "pending" ? "🕐 Request sent!" : "✅ Joined!", description: data.message });
    },
    onError: () => toast({ title: "Failed to join", variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${id}/leave`, "POST", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/groups"] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "Left group" });
      navigate("/community/groups");
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/posts", "POST", {
        content: newPost.trim(),
        privacy: "public",
        groupId: parseInt(id),
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/posts`] });
      setNewPost("");
      toast({ title: "Posted!" });
    },
    onError: () => toast({ title: "Failed to post", variant: "destructive" }),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      await apiRequest(`/api/groups/${id}/posts/${postId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/posts`] });
      toast({ title: "Post deleted" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${id}/approve`, "POST", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "Group approved!" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${id}/reject`, "POST", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "Group rejected" });
      navigate("/community/groups");
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/groups/${id}/join-requests/${userId}/approve`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/join-requests`] });
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "✅ Member approved" });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/groups/${id}/join-requests/${userId}/reject`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}/join-requests`] });
      toast({ title: "Request rejected" });
    },
  });

  const kickMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest(`/api/groups/${id}/members/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "Member removed" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      await apiRequest(`/api/groups/${id}/members/${userId}`, "PATCH", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      toast({ title: "Role updated" });
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/groups/${id}`, "PATCH", editForm);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/groups/${id}`] });
      setShowEditModal(false);
      toast({ title: "✅ Group updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/groups/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({ title: "Group archived" });
      navigate("/community/groups");
    },
  });

  // ── Loading / Not found ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Group not found</p>
        <Button variant="ghost" onClick={() => navigate("/community/groups")} className="mt-3">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Groups
        </Button>
      </div>
    );
  }

  const isPending = group.status === "pending";

  const openEdit = () => {
    setEditForm({
      name: group.name,
      description: group.description || "",
      city: group.city || "",
      coverImage: group.coverImage || "",
      isPrivate: group.isPrivate,
    });
    setShowEditModal(true);
  };

  // ── Tabs config ───────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "feed", label: "Feed", icon: MessageCircle },
    { id: "members", label: "Members", icon: Users, badge: members.length },
    ...(showRequestsTab ? [{ id: "requests" as Tab, label: "Requests", icon: Clock, badge: joinRequests.length }] : []),
    ...(isGroupAdmin ? [{ id: "settings" as Tab, label: "Settings", icon: Settings }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24">
      {/* Back */}
      <button
        onClick={() => navigate("/community/groups")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        data-testid="button-back-groups"
      >
        <ArrowLeft className="h-4 w-4" /> All Groups
      </button>

      {/* Admin pending notice */}
      {isPlatformAdmin && isPending && (
        <div className="mb-4 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">⏳ Pending Approval</p>
            <p className="text-xs text-muted-foreground">This group is awaiting admin review.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} className="h-8 gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Group header */}
      <div className="rounded-2xl border border-border overflow-hidden mb-5 shadow-sm">
        {group.coverImage ? (
          <div className="h-36 sm:h-48 relative">
            <img src={group.coverImage} alt={group.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4">
              <div className="flex items-center gap-2 mb-1">
                {typeIcon(group.type)}
                <h1 className="text-xl font-bold text-white">{group.name}</h1>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-20 bg-gradient-to-br from-primary/25 to-primary/5 flex items-center px-4 gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary/60" />
            </div>
            <div className="flex items-center gap-2">
              {typeIcon(group.type)}
              <h1 className="text-xl font-bold">{group.name}</h1>
            </div>
          </div>
        )}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {group.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
              {group.isPrivate ? "Private" : "Public"} · {group.type}
            </div>
            {group.discipline && (
              <Badge variant="outline" className={`text-xs border ${DISCIPLINE_COLORS[group.discipline] || DISCIPLINE_COLORS.other}`}>
                {group.discipline}
              </Badge>
            )}
            {group.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {group.city}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Users className="h-3 w-3" /> {group.memberCount || members.length} members
            </span>
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{group.description}</p>
          )}
          {group.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {group.tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex gap-2 mt-2 flex-wrap">
            {user && !isMember && group.status === "active" && (
              <Button
                size="sm"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
                className="gap-1.5"
                data-testid="button-join-group"
              >
                {joinMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                {group.isPrivate ? "Request to Join" : "Join Group"}
              </Button>
            )}
            {isMember && myMembership?.myRole !== "admin" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { if (confirm("Leave this group?")) leaveMutation.mutate(); }}
                disabled={leaveMutation.isPending}
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                data-testid="button-leave-group"
              >
                <UserMinus className="h-3.5 w-3.5" /> Leave
              </Button>
            )}
            {isGroupAdmin && (
              <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5" data-testid="button-edit-group">
                <Edit3 className="h-3.5 w-3.5" /> Edit Group
              </Button>
            )}
            {isMember && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 h-8 px-3 flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {myMembership?.myRole === "admin" ? "Admin" : myMembership?.myRole === "moderator" ? "Mod" : "Member"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60 mb-4 overflow-x-auto scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-[1px] ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-group-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-primary text-primary-foreground">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Feed Tab ── */}
      {activeTab === "feed" && (
        <div>
          {/* Post composer */}
          {user && isMember && (
            <Card className="mb-4 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {user.profilePicture && <AvatarImage src={user.profilePicture} />}
                    <AvatarFallback className="text-xs font-semibold">{(user.displayName || "?")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      value={newPost}
                      onChange={e => setNewPost(e.target.value)}
                      placeholder={`Share something with ${group.name}…`}
                      className="resize-none mb-2 text-sm min-h-[70px]"
                      rows={2}
                      data-testid="input-group-post"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => postMutation.mutate()}
                        disabled={!newPost.trim() || postMutation.isPending}
                        className="gap-1.5 h-8"
                        data-testid="button-submit-group-post"
                      >
                        {postMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Post
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {postsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No posts yet</p>
              {isMember && <p className="text-sm mt-1">Be the first to post in this group!</p>}
              {!isMember && <p className="text-sm mt-1">Join the group to see and post here.</p>}
            </div>
          ) : (
            posts.map((p: any) => (
              <PostCard
                key={p.id} post={p} user={user} groupId={id}
                isGroupAdmin={isGroupAdmin}
                onDelete={(postId) => {
                  if (confirm("Delete this post?")) deletePostMutation.mutate(postId);
                }}
              />
            ))
          )}
        </div>
      )}

      {/* ── Members Tab ── */}
      {activeTab === "members" && (
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No members yet</p>
          ) : (
            members.map((m: any) => (
              <div key={m.userId} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors" data-testid={`card-member-${m.userId}`}>
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {m.profilePicture && <AvatarImage src={m.profilePicture} />}
                  <AvatarFallback className="text-xs font-semibold">{(m.displayName || "?")[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.displayName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {m.role === "admin" && (
                      <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-600 bg-yellow-500/5 py-0 h-4 px-1.5">
                        <Crown className="h-2.5 w-2.5 mr-0.5" /> Admin
                      </Badge>
                    )}
                    {m.role === "moderator" && (
                      <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 bg-blue-500/5 py-0 h-4 px-1.5">
                        <Shield className="h-2.5 w-2.5 mr-0.5" /> Mod
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Group admin controls */}
                {isGroupAdmin && m.userId !== user?.id && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {m.role === "member" && (
                      <button
                        onClick={() => promoteMutation.mutate({ userId: m.userId, role: "moderator" })}
                        disabled={promoteMutation.isPending}
                        className="text-xs px-2 py-1 rounded-lg border border-border/50 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                        title="Promote to Moderator"
                        data-testid={`button-promote-${m.userId}`}
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {m.role === "moderator" && (
                      <button
                        onClick={() => promoteMutation.mutate({ userId: m.userId, role: "member" })}
                        disabled={promoteMutation.isPending}
                        className="text-xs px-2 py-1 rounded-lg border border-border/50 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                        title="Demote to Member"
                        data-testid={`button-demote-${m.userId}`}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm(`Remove ${m.displayName} from group?`)) kickMemberMutation.mutate(m.userId); }}
                      disabled={kickMemberMutation.isPending}
                      className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove from group"
                      data-testid={`button-kick-${m.userId}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Join Requests Tab ── */}
      {activeTab === "requests" && showRequestsTab && (
        <div className="space-y-3">
          {joinRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">No pending requests</p>
              <p className="text-xs mt-1">New join requests will appear here</p>
            </div>
          ) : (
            joinRequests.map((req: any) => (
              <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50" data-testid={`card-request-${req.userId}`}>
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {req.profilePicture && <AvatarImage src={req.profilePicture} />}
                  <AvatarFallback className="text-xs font-semibold">{(req.displayName || "?")[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{req.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDistanceToNow(new Date(req.joinedAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => approveRequestMutation.mutate(req.userId)}
                    disabled={approveRequestMutation.isPending}
                    data-testid={`button-approve-request-${req.userId}`}
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => rejectRequestMutation.mutate(req.userId)}
                    disabled={rejectRequestMutation.isPending}
                    data-testid={`button-reject-request-${req.userId}`}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === "settings" && isGroupAdmin && (
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border/50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" /> Group Settings
            </h3>
            <Button variant="outline" onClick={openEdit} className="w-full gap-2" data-testid="button-open-edit">
              <Edit3 className="h-4 w-4" /> Edit Group Info
            </Button>
            {isPlatformAdmin && (
              <Button
                variant="destructive"
                onClick={() => { if (confirm("Archive this group? This cannot be undone.")) deleteGroupMutation.mutate(); }}
                disabled={deleteGroupMutation.isPending}
                className="w-full gap-2"
                data-testid="button-delete-group"
              >
                <Trash2 className="h-4 w-4" /> Archive Group
              </Button>
            )}
          </div>

          {/* Group stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-border/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{group.memberCount || members.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Members</div>
            </div>
            <div className="border border-border/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold">{posts.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Posts</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Group Modal ── */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs">Group Name</Label>
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                  className="mt-1 h-9"
                  data-testid="input-edit-group-name"
                />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                  className="mt-1 resize-none"
                  rows={3}
                  data-testid="input-edit-group-description"
                />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={editForm.city}
                  onChange={e => setEditForm((f: any) => ({ ...f, city: e.target.value }))}
                  className="mt-1 h-9"
                  placeholder="e.g. Amsterdam"
                  data-testid="input-edit-group-city"
                />
              </div>
              <div>
                <Label className="text-xs">Cover Image URL</Label>
                <Input
                  value={editForm.coverImage}
                  onChange={e => setEditForm((f: any) => ({ ...f, coverImage: e.target.value }))}
                  className="mt-1 h-9"
                  placeholder="https://..."
                  data-testid="input-edit-group-cover"
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                <input
                  type="checkbox"
                  id="edit-private"
                  checked={editForm.isPrivate}
                  onChange={e => setEditForm((f: any) => ({ ...f, isPrivate: e.target.checked }))}
                  className="w-4 h-4"
                  data-testid="checkbox-edit-private"
                />
                <label htmlFor="edit-private" className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Private Group
                  </p>
                  <p className="text-xs text-muted-foreground">Members must request to join</p>
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => saveEditMutation.mutate()}
                  disabled={!editForm.name?.trim() || saveEditMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-edit-group"
                >
                  {saveEditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
