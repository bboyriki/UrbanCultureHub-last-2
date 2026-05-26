import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PostCard from "./PostCard";
import ArtistsView from "./ArtistsView";
import SpotsView from "./SpotsView";
import CommunityActivityFeed from "./CommunityActivityFeed";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Post } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Bell, Loader2, PenSquare, Globe, Users as UsersIcon, Lock, Rss,
  Heart, ArrowUp, ImageIcon, X, Sparkles, MapPin, Calendar,
  TrendingUp, UserPlus, Activity, Flame, Star, Zap, Music,
  Palette, MessageCircle, Trophy, Users2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { apiRequest } from "@/lib/queryClient";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import StoryCircles from "@/components/stories/StoryCircles";
import AICommunityCaption from "@/components/ai/AICommunityCaption";
import CommunityAIStudio from "@/components/community/CommunityAIStudio";

const MAX_POST_LENGTH = 1000;

function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-4 space-y-3 animate-pulse border border-border/30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/5" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3.5 bg-muted rounded w-full" />
        <div className="h-3.5 bg-muted rounded w-5/6" />
        <div className="h-3.5 bg-muted rounded w-4/6" />
      </div>
      <div className="flex gap-4 pt-2">
        <div className="h-3 bg-muted rounded w-16" />
        <div className="h-3 bg-muted rounded w-20" />
      </div>
    </div>
  );
}

const TAG_COLORS = [
  "text-orange-500", "text-purple-500", "text-blue-500",
  "text-green-500", "text-pink-500", "text-amber-500",
  "text-red-500", "text-teal-500", "text-indigo-500", "text-rose-500",
];

const QUICK_LINKS = [
  { label: "Community Feed", icon: Globe, tab: "posts" },
  { label: "My Feed", icon: Rss, tab: "feed", authRequired: true },
  { label: "Artists", icon: Palette, tab: "artists" },
  { label: "Urban Spots", icon: MapPin, tab: "spots" },
  { label: "Groups", icon: Users2, tab: "groups", href: "/community/groups" },
];

function LeftSidebar({ user, activeTab, onTabChange }: { user: any; activeTab: string; onTabChange: (t: string) => void }) {
  const [, navigate] = useLocation();
  const { data: upcomingEvents } = useQuery<any[]>({ queryKey: ["/api/events"] });
  const { data: userStats } = useQuery<{ postsCount: number; followingCount: number; followersCount: number }>({
    queryKey: ["/api/users", user?.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user.id}/stats`);
      if (!res.ok) return { postsCount: 0, followingCount: 0, followersCount: 0 };
      return res.json();
    },
    enabled: !!user?.id,
  });
  const nextEvent = upcomingEvents?.[0];

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
      {/* User Profile Card */}
      {user && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 overflow-hidden shadow-sm">
          <div className="h-16 bg-gradient-to-r from-primary/80 via-primary/60 to-primary/40" />
          <div className="px-4 pb-4 -mt-7">
            <Avatar className="w-14 h-14 border-4 border-white dark:border-gray-900 mb-2">
              <AvatarImage src={user.profilePicture || undefined} alt={user.displayName || "You"} />
              <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">
                {(user.displayName || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="font-bold text-sm">{user.displayName}</div>
            <div className="text-xs text-muted-foreground capitalize flex items-center gap-1 mt-0.5">
              {user.role === "artist" && <Palette className="w-3 h-3 text-purple-400" />}
              {user.role === "athlete" && <Zap className="w-3 h-3 text-orange-400" />}
              {user.role === "admin" || user.role === "super_admin" ? <Star className="w-3 h-3 text-yellow-400" /> : null}
              {user.artType || user.role}
              {user.isVerified && <Badge className="ml-1 text-[9px] py-0 px-1 h-4 bg-blue-500">Verified</Badge>}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-border/40">
              <div className="text-center" data-testid="stat-posts">
                <div className="text-sm font-bold">{userStats?.postsCount ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Posts</div>
              </div>
              <div className="text-center" data-testid="stat-following">
                <div className="text-sm font-bold">{userStats?.followingCount ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Following</div>
              </div>
              <div className="text-center" data-testid="stat-followers">
                <div className="text-sm font-bold">{userStats?.followersCount ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Followers</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 shadow-sm p-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Navigate</div>
        {QUICK_LINKS.filter(l => !l.authRequired || user).map(link => {
          const Icon = link.icon;
          const isActive = (link as any).href ? false : activeTab === link.tab;
          return (
            <button
              key={link.tab}
              onClick={() => (link as any).href ? navigate((link as any).href) : onTabChange(link.tab)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/60"
              )}
              data-testid={`nav-${link.tab}`}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </button>
          );
        })}
        {user && (user.role === "admin" || user.role === "super_admin") && (
          <button
            onClick={() => onTabChange("ai-studio")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
              activeTab === "ai-studio"
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted/60"
            )}
          >
            <Sparkles className="w-4 h-4" />
            AI Studio
          </button>
        )}
      </div>

      {/* Next Event */}
      {nextEvent && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Upcoming Event</span>
          </div>
          <div className="font-bold text-sm line-clamp-2">{nextEvent.title}</div>
          {nextEvent.date && (
            <div className="text-xs text-muted-foreground mt-1">{new Date(nextEvent.date).toLocaleDateString()}</div>
          )}
          <Link href="/events">
            <Button size="sm" className="mt-3 w-full h-8 text-xs">View Events</Button>
          </Link>
        </div>
      )}
    </aside>
  );
}

function RightSidebar({ onCreatePost, user }: { onCreatePost: () => void; user: any }) {
  const { data: artists } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: trendingTags, isLoading: tagsLoading } = useQuery<{ tag: string; count: number }[]>({
    queryKey: ["/api/community/trending-tags"],
    queryFn: async () => {
      const res = await fetch("/api/community/trending-tags");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: communityStats } = useQuery<{ members: number; postsToday: number; events: number; spots: number }>({
    queryKey: ["/api/community/stats"],
    queryFn: async () => {
      const res = await fetch("/api/community/stats");
      if (!res.ok) return { members: 0, postsToday: 0, events: 0, spots: 0 };
      return res.json();
    },
  });

  const { data: followingList } = useQuery<any[]>({
    queryKey: ["/api/users", user?.id, "following"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/following`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const suggestedArtists = useMemo(() => {
    if (!artists) return [];
    const followingIds = new Set((followingList || []).map((f: any) => f.followedId ?? f.following?.id ?? f.id));
    return artists
      .filter(a => a.role === "artist" && a.id !== user?.id && a.isActive !== false && !followingIds.has(a.id))
      .slice(0, 4);
  }, [artists, user, followingList]);

  const formatTagCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-72 shrink-0">
      {/* Trending Tags */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          <span className="font-bold text-sm">Trending in Community</span>
        </div>
        {tagsLoading ? (
          <div className="space-y-2.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-12" />
              </div>
            ))}
          </div>
        ) : trendingTags && trendingTags.length > 0 ? (
          <div className="space-y-2.5">
            {trendingTags.map((item, i) => (
              <div key={item.tag} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span className={cn("text-sm font-medium", TAG_COLORS[i % TAG_COLORS.length])}>{item.tag}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatTagCount(item.count)} posts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No trending tags yet</p>
        )}
      </div>

      {/* Suggested Artists */}
      {suggestedArtists.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">Artists to Follow</span>
          </div>
          <div className="space-y-3">
            {suggestedArtists.map(artist => (
              <div key={artist.id} className="flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={artist.profilePicture || undefined} alt={artist.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-xs font-bold">
                    {(artist.displayName || "A").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{artist.displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">{artist.artType || "Artist"}</div>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs shrink-0" data-testid={`button-follow-${artist.id}`}>
                  Follow
                </Button>
              </div>
            ))}
          </div>
          <Link href="/community?tab=artists">
            <button className="text-xs text-primary hover:underline mt-3 block">
              See all artists →
            </button>
          </Link>
        </div>
      )}

      {/* Community Stats */}
      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl border border-orange-500/20 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="font-bold text-sm">Community Stats</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Members", value: communityStats?.members, icon: UsersIcon, color: "text-blue-500" },
            { label: "Posts Today", value: communityStats?.postsToday, icon: MessageCircle, color: "text-green-500" },
            { label: "Events", value: communityStats?.events, icon: Trophy, color: "text-amber-500" },
            { label: "Spots", value: communityStats?.spots, icon: MapPin, color: "text-purple-500" },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center bg-white/50 dark:bg-gray-900/50 rounded-xl p-2.5">
                <Icon className={cn("w-4 h-4 mb-1", stat.color)} />
                <div className="font-bold text-sm" data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
                  {stat.value !== undefined ? stat.value : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

const CommunityView = () => {
  const [activeTab, setActiveTab] = useState("posts");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState("");
  const [postPrivacy, setPostPrivacy] = useState<"public" | "friends_only">("public");
  const [newPostsAvailable, setNewPostsAvailable] = useState(0);
  const seenPostCountRef = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      highlightedPostId: searchParams.get('post') ? parseInt(searchParams.get('post')!, 10) : null,
      showComments: searchParams.get('showComments') === 'true',
    };
  }, [location]);

  useEffect(() => {
    if (urlParams.highlightedPostId) setActiveTab("posts");
  }, [urlParams.highlightedPostId]);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["/api/posts"],
    queryFn: async ({ queryKey }) => {
      const url = queryKey[0];
      const userId = user?.id;
      try {
        const endpoint = userId ? `${url}?userId=${userId}` : url;
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            ...(userId ? { 'x-user-id': userId.toString() } : {})
          }
        });
        if (!response.ok) return [];
        return await response.json();
      } catch { return []; }
    },
    enabled: true,
    retry: 2,
    refetchInterval: 120000,
  });

  useEffect(() => {
    if (!posts || !Array.isArray(posts)) return;
    const count = posts.length;
    if (seenPostCountRef.current === null) {
      seenPostCountRef.current = count;
    } else if (count > seenPostCountRef.current) {
      setNewPostsAvailable(count - seenPostCountRef.current);
    }
  }, [posts]);

  const handleLoadNewPosts = () => {
    seenPostCountRef.current = Array.isArray(posts) ? posts.length : 0;
    setNewPostsAvailable(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { data: feedPosts, isLoading: feedLoading } = useQuery({
    queryKey: ["/api/posts/feed"],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const response = await fetch(`/api/posts/feed?userId=${user.id}`, {
          headers: { 'Accept': 'application/json', 'x-user-id': user.id.toString() },
          credentials: 'include',
        });
        if (!response.ok) return [];
        return await response.json();
      } catch { return []; }
    },
    enabled: !!user,
  });

  const createPost = async (content: string, image: string, privacy: "public" | "friends_only") => {
    if (!user) throw new Error("You must be logged in to create a post");
    if (!content.trim()) throw new Error("Post content cannot be empty");
    if (content.length > MAX_POST_LENGTH) throw new Error(`Post too long (max ${MAX_POST_LENGTH} characters)`);
    return await apiRequest("/api/posts", "POST", {
      userId: user.id, content: content.trim(), image: image || null, privacy,
    });
  };

  const createPostMutation = useMutation({
    mutationFn: () => createPost(postContent, postImage, postPrivacy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/trending-tags"] });
      if (user?.id) queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "stats"] });
      setPostContent(""); setPostImage(""); setPostPrivacy("public"); setIsDialogOpen(false);
      toast({ title: "Post published", description: "Your post is now live in the community" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create post", description: error.message || "Could not create your post", variant: "destructive" });
    },
  });

  const handleCreatePost = () => {
    if (!user) {
      toast({ title: "Authentication required", description: "Please login to create posts", variant: "destructive" });
      return;
    }
    setIsDialogOpen(true);
  };

  const handleTabChange = (value: string) => setActiveTab(value);
  const charsLeft = MAX_POST_LENGTH - postContent.length;
  const isOverLimit = charsLeft < 0;

  return (
    <div className="flex-1 pb-16 pt-4">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-primary" />
            Community
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Connect with urban culture enthusiasts worldwide</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className={cn("relative gap-2 transition-all duration-300", unreadCount > 0 && "border-primary/50 bg-primary/5")}
            onClick={() => setIsActivityFeedOpen(true)}
            data-testid="button-activity-feed"
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Activity</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[1rem] items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex items-center justify-center rounded-full h-4 min-w-[1rem] bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              </span>
            )}
          </Button>
          {user && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleCreatePost} data-testid="button-header-create-post">
              <PenSquare className="h-3.5 w-3.5" />
              Post
            </Button>
          )}
        </div>
      </div>

      <CommunityActivityFeed isOpen={isActivityFeedOpen} onOpenChange={setIsActivityFeedOpen} />

      {/* 3-column Layout */}
      <div className="flex gap-5 px-4 items-start">
        {/* Left Sidebar */}
        <LeftSidebar user={user} activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Center Feed */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Stories Strip */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-border/40 shadow-sm overflow-hidden">
            <StoryCircles />
          </div>

          {/* Mobile tab bar */}
          <div className="lg:hidden">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none bg-white dark:bg-gray-900 rounded-2xl border border-border/40 shadow-sm p-2">
              {[
                { value: "posts", label: "Community", icon: Globe },
                ...(user ? [{ value: "feed", label: "My Feed", icon: Rss }] : []),
                { value: "artists", label: "Artists", icon: Palette },
                { value: "spots", label: "Spots", icon: MapPin },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => handleTabChange(tab.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                      activeTab === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
              {/* Groups — navigates to dedicated groups page */}
              <Link href="/community/groups">
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                    location === "/community/groups"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                  data-testid="tab-mobile-groups"
                >
                  <Users2 className="w-3.5 h-3.5" />
                  Groups
                </button>
              </Link>
            </div>
          </div>

          {/* Post Composer */}
          {user && activeTab === "posts" && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4 border border-border/40">
              <div className="flex gap-3">
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={user.profilePicture || undefined} alt={user.displayName || "You"} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                    {(user.displayName || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button
                  className="flex-1 text-left px-4 py-3 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground text-sm transition-colors cursor-pointer border border-border/30"
                  onClick={handleCreatePost}
                  data-testid="button-inline-compose"
                >
                  What's on your mind, {user.displayName?.split(" ")[0]}?
                </button>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-border/40">
                <button
                  onClick={handleCreatePost}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                  data-testid="button-add-photo"
                >
                  <ImageIcon className="h-4 w-4 text-green-500" />
                  Photo
                </button>
                <button
                  onClick={handleCreatePost}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  AI Assist
                </button>
                <button
                  onClick={handleCreatePost}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  Feeling
                </button>
              </div>
            </div>
          )}

          {/* New posts indicator */}
          {newPostsAvailable > 0 && (
            <div className="flex justify-center animate-in slide-in-from-top-3 duration-300">
              <button
                onClick={handleLoadNewPosts}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                data-testid="button-load-new-posts"
              >
                <ArrowUp size={12} className="animate-bounce" />
                {newPostsAvailable} new {newPostsAvailable === 1 ? "post" : "posts"} — tap to load
              </button>
            </div>
          )}

          {/* Content area */}
          <div>
            {/* Community Posts Tab */}
            {activeTab === "posts" && (
              <div className="space-y-4">
                {/* AI Caption */}
                <AICommunityCaption
                  onInsert={(text) => {
                    setPostContent(text.slice(0, MAX_POST_LENGTH));
                    handleCreatePost();
                  }}
                />
                {isLoading ? (
                  <div className="space-y-4">{[...Array(4)].map((_, i) => <PostSkeleton key={i} />)}</div>
                ) : posts && Array.isArray(posts) && posts.length > 0 ? (
                  posts.map((post: Post) => {
                    const specialAuthor = post.userId === 1 ? {
                      id: 1, displayName: "Oudai Admin", role: "admin",
                      profilePicture: "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
                    } : undefined;
                    const isHighlighted = urlParams.highlightedPostId === post.id;
                    const autoShowComments = isHighlighted && urlParams.showComments;
                    return (
                      <PostCard key={post.id} post={post} author={specialAuthor} isHighlighted={isHighlighted} autoShowComments={autoShowComments} />
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-border/40">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <PenSquare className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">No posts yet</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">Be the first to share something with the community!</p>
                    {user && <Button onClick={handleCreatePost} data-testid="button-create-first-post">Create a post</Button>}
                  </div>
                )}
              </div>
            )}

            {/* My Feed Tab */}
            {activeTab === "feed" && (
              <div className="space-y-4">
                {feedLoading ? (
                  <div className="space-y-4">{[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}</div>
                ) : feedPosts && Array.isArray(feedPosts) && feedPosts.length > 0 ? (
                  feedPosts.map((post: Post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-border/40">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Your feed is empty</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                      Follow artists and members to see their posts here.
                    </p>
                    <button onClick={() => handleTabChange("artists")} className="text-sm text-primary underline underline-offset-4" data-testid="link-discover-artists">
                      Discover artists to follow
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "artists" && <ArtistsView />}
            {activeTab === "spots" && <SpotsView />}
            {activeTab === "ai-studio" && user && (user.role === "admin" || user.role === "super_admin") && <CommunityAIStudio />}
          </div>
        </div>

        {/* Right Sidebar */}
        <RightSidebar onCreatePost={handleCreatePost} user={user} />
      </div>

      {/* Create Post Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!createPostMutation.isPending && !isUploading) setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.profilePicture || undefined} alt={user?.displayName || "You"} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {(user?.displayName || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base leading-tight">{user?.displayName || "Create a Post"}</DialogTitle>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => setPostPrivacy("public")}
                    className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all", postPrivacy === "public" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
                    data-testid="button-privacy-public"
                  >
                    <Globe className="h-3 w-3" /> Everyone
                  </button>
                  <button
                    onClick={() => setPostPrivacy("friends_only")}
                    className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all", postPrivacy === "friends_only" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
                    data-testid="button-privacy-friends"
                  >
                    <Lock className="h-3 w-3" /> Friends
                  </button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={`What's on your mind, ${user?.displayName?.split(" ")[0] || "you"}?`}
              className="min-h-[140px] resize-none border-0 shadow-none focus-visible:ring-0 text-base p-0"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={createPostMutation.isPending}
              maxLength={MAX_POST_LENGTH + 50}
              data-testid="textarea-post-content"
            />
            <div className={cn("text-xs text-right", charsLeft < 50 ? (isOverLimit ? "text-destructive font-medium" : "text-amber-500") : "text-muted-foreground")}>
              {charsLeft < 100 && `${charsLeft} characters left`}
            </div>

            {postImage && (
              <div className="relative">
                <img src={postImage} alt="Post preview" className="w-full max-h-56 object-cover rounded-xl" />
                <button
                  onClick={() => setPostImage("")}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="border border-border/40 rounded-xl p-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">Add to your post</div>
              <div className="flex gap-2">
                <ImageUploader
                  onImageUploaded={(url) => { setPostImage(url); setIsUploading(false); }}
                  onUploadStart={() => setIsUploading(true)}
                  buttonText="Add Photo"
                  folder="community-posts"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => createPostMutation.mutate()}
              disabled={createPostMutation.isPending || isOverLimit || !postContent.trim() || isUploading}
              className="w-full"
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Publishing…</>
              ) : (
                "Publish Post"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityView;
