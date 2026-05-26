import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Loader2, TrendingUp, Film, FileText, Users, Eye, Heart, Play, Flame, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface TrendingReel {
  id: number; userId: number; caption: string | null; thumbnailUrl: string | null;
  viewsCount: number; likesCount: number; sharesCount: number; createdAt: string;
  user: { id: number; displayName: string; profilePicture: string | null };
}
interface TrendingPost {
  id: number; userId: number; content: string | null; imageUrl?: string | null; createdAt: string;
  user: { id: number; displayName: string; profilePicture: string | null };
  likeCount: number;
}
interface TopCreator {
  id: number; displayName: string; profilePicture: string | null;
  totalViews: number; reelCount: number;
}
interface TrendingData {
  reels: TrendingReel[];
  posts: TrendingPost[];
  topCreators: TopCreator[];
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TrendingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<TrendingData>({
    queryKey: ["/api/trending"],
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading trending content…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Trending</h1>
          <p className="text-xs text-muted-foreground">Most popular content this week</p>
        </div>
      </div>

      {/* Top Creators */}
      {data.topCreators.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> Top Creators
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {data.topCreators.map((creator, i) => (
              <button
                key={creator.id}
                data-testid={`creator-${creator.id}`}
                onClick={() => navigate(`/profile/${creator.id}`)}
                className="flex flex-col items-center gap-2 shrink-0 w-20"
              >
                <div className="relative">
                  <div className={cn(
                    "w-16 h-16 rounded-full overflow-hidden border-2",
                    i === 0 ? "border-amber-400" : i === 1 ? "border-gray-400" : i === 2 ? "border-amber-700" : "border-primary/40"
                  )}>
                    {creator.profilePicture
                      ? <img src={creator.profilePicture} alt={creator.displayName} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-primary">{creator.displayName[0]?.toUpperCase()}</span>
                        </div>
                    }
                  </div>
                  {i < 3 && (
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white",
                      i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-400" : "bg-amber-700"
                    )}>#{i + 1}</span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-foreground truncate w-full">{creator.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCount(creator.totalViews)} views</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trending Reels */}
      {data.reels.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <Film className="w-4 h-4 text-purple-500" /> Hot Reels
            </h2>
            <button
              onClick={() => navigate("/reels")}
              className="text-xs text-primary flex items-center gap-0.5"
            >
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {data.reels.slice(0, 6).map((reel, i) => (
              <button
                key={reel.id}
                data-testid={`trending-reel-${reel.id}`}
                onClick={() => navigate(`/reels?id=${reel.id}`)}
                className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 group"
              >
                {reel.thumbnailUrl
                  ? <img src={reel.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <Film className="w-8 h-8 text-zinc-600" />
                    </div>
                }
                {/* Rank badge */}
                {i < 3 && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                    <span className="text-[10px] font-black text-zinc-900">#{i + 1}</span>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-4 h-4 rounded-full overflow-hidden bg-white/20">
                      {reel.user.profilePicture
                        ? <img src={reel.user.profilePicture} alt="" className="w-full h-full object-cover" />
                        : null
                      }
                    </div>
                    <span className="text-white text-[10px] font-semibold truncate">{reel.user.displayName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="flex items-center gap-0.5 text-[10px]"><Eye className="w-2.5 h-2.5" />{formatCount(reel.viewsCount)}</span>
                    <span className="flex items-center gap-0.5 text-[10px]"><Heart className="w-2.5 h-2.5" />{formatCount(reel.likesCount)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trending Posts */}
      {data.posts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Trending Posts
            </h2>
          </div>
          <div className="space-y-3">
            {data.posts.slice(0, 5).map((post, i) => (
              <div
                key={post.id}
                data-testid={`trending-post-${post.id}`}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card"
              >
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5",
                  i === 0 ? "bg-amber-400 text-zinc-900" : "bg-muted text-muted-foreground"
                )}>#{i + 1}</span>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                    {post.user.profilePicture
                      ? <img src={post.user.profilePicture} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground">{post.user.displayName[0]?.toUpperCase()}</span>
                        </div>
                    }
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{post.user.displayName}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500" />{formatCount(post.likeCount)}</span>
                    <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {data.reels.length === 0 && data.posts.length === 0 && (
        <div className="text-center py-20">
          <Flame className="w-12 h-12 mx-auto mb-3 text-orange-500/30" />
          <p className="font-semibold text-foreground">Nothing trending yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to post a reel or share content!</p>
        </div>
      )}
    </div>
  );
}
