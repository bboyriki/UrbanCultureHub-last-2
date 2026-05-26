import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trophy, Star, Flame, Zap, Award, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";

const CRED_REASONS: Record<string, { label: string; icon: string; color: string }> = {
  "Created a crew": { label: "Crew Founded", icon: "👑", color: "text-yellow-500" },
  "Joined a crew": { label: "Joined Crew", icon: "🤝", color: "text-blue-400" },
  "Started a cypher": { label: "Cypher Hosted", icon: "🔥", color: "text-orange-500" },
  "Submitted a challenge entry": { label: "Challenge Entry", icon: "🎯", color: "text-purple-400" },
  "Received a vote on challenge entry": { label: "Vote Received", icon: "⭐", color: "text-yellow-400" },
  "Shared a beat in Beat Lab": { label: "Beat Shared", icon: "🎵", color: "text-green-400" },
  "Submitted to Community Radio": { label: "Radio Submission", icon: "📻", color: "text-pink-400" },
  "Added to the Graffiti Wall": { label: "Graffiti Tag", icon: "🎨", color: "text-cyan-400" },
  "Inducted into the Hall of Fame": { label: "Hall of Fame", icon: "🏆", color: "text-amber-400" },
};

function CredBadge({ score }: { score: number }) {
  if (score >= 500) return <Badge className="bg-amber-500 text-black font-bold">Legend ⚡</Badge>;
  if (score >= 200) return <Badge className="bg-purple-600 text-white font-bold">OG 🔥</Badge>;
  if (score >= 100) return <Badge className="bg-blue-600 text-white font-bold">Veteran 🏅</Badge>;
  if (score >= 50) return <Badge className="bg-green-600 text-white font-bold">Rising 🌱</Badge>;
  return <Badge variant="outline">Rookie</Badge>;
}

export default function CredPage() {
  const { user } = useAuth();

  const { data: leaderboard, isLoading: loadingBoard } = useQuery<any[]>({
    queryKey: ["/api/cred/leaderboard"],
  });

  const { data: myData, isLoading: loadingMine } = useQuery<{ score: number; transactions: any[] }>({
    queryKey: ["/api/cred/my-score"],
    enabled: !!user,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Flame className="w-8 h-8 text-orange-500" />
          <h1 className="text-3xl font-black tracking-tight">Street Cred</h1>
          <Flame className="w-8 h-8 text-orange-500" />
        </div>
        <p className="text-muted-foreground">Earn points by being active in the community. Climb the ranks.</p>
        <div className="flex justify-center pt-1"><CultureSectionInfo section="cred" /></div>
      </div>

      {/* How to Earn Cred */}
      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-orange-400 flex items-center gap-2">
            <Zap className="w-4 h-4" /> How to Earn Street Cred
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: "👑", label: "Found a Crew", points: "+50" },
              { icon: "🎯", label: "Submit to Challenge", points: "+25" },
              { icon: "🎵", label: "Share a Beat", points: "+30" },
              { icon: "🔥", label: "Host a Cypher", points: "+20" },
              { icon: "🎨", label: "Tag the Wall", points: "+5" },
              { icon: "🏆", label: "Hall of Fame", points: "+100" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-orange-400 font-bold">{item.points}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My Score */}
        {user && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" /> My Cred</h2>
            {loadingMine ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-black text-orange-500" data-testid="my-cred-score">{myData?.score ?? 0}</div>
                    <div className="text-sm text-muted-foreground mt-1">Street Cred Points</div>
                    <div className="mt-2"><CredBadge score={myData?.score ?? 0} /></div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Recent Activity</div>
                    {myData?.transactions?.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No activity yet. Start earning!</div>
                    )}
                    {myData?.transactions?.map((tx: any) => {
                      const info = CRED_REASONS[tx.reason];
                      return (
                        <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{info?.icon ?? "✨"}</span>
                            <span className="text-sm">{info?.label ?? tx.reason}</span>
                          </div>
                          <span className="text-sm font-bold text-orange-400">+{tx.amount}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard</h2>
          {loadingBoard ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <Card>
              <CardContent className="pt-4 px-3">
                <div className="space-y-1">
                  {leaderboard?.map((u: any, i: number) => (
                    <div
                      key={u.id}
                      data-testid={`leaderboard-row-${u.id}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        i === 0 && "bg-amber-500/10 border border-amber-500/20",
                        i === 1 && "bg-slate-400/10",
                        i === 2 && "bg-orange-700/10",
                        user?.id === u.id && "ring-1 ring-primary/40"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-black",
                        i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-slate-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"
                      )}>
                        {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                      </div>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.display_name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                          {u.display_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{u.display_name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{u.discipline || "breaker"}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-orange-500">{u.cred_score}</div>
                        <CredBadge score={u.cred_score} />
                      </div>
                    </div>
                  ))}
                  {!leaderboard?.length && (
                    <div className="text-sm text-muted-foreground text-center py-8">No one on the board yet. Be the first!</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
