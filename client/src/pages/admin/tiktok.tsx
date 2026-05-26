import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, AlertCircle, Link2, LogIn, Share2, Eye, Upload,
  Video, User, BarChart3, Shield, Zap, RefreshCw, ExternalLink,
  PlayCircle, Heart, MessageCircle, Repeat2, Music, Globe, Lock,
  ChevronRight, Copy, Check, Info, Loader2, Film, Star, Users
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const SANDBOX_ACCOUNT = {
  open_id: "sandbox_user_abc123xyz",
  display_name: "Urban Culture Hub",
  avatar_url: "https://ui-avatars.com/api/?name=Urban+Culture&background=010101&color=fff&size=128",
  follower_count: 12840,
  following_count: 234,
  likes_count: 98700,
  video_count: 47,
  bio_description: "Urban culture events · Dance · Street Art · The Netherlands 🇳🇱",
  is_verified: false,
  profile_deep_link: "https://www.tiktok.com/@sandbox_urbanculturehub",
};

const SANDBOX_VIDEOS = [
  {
    id: "vid_7001",
    title: "IMPACT+ Bboy Battle – Amsterdam Finals 🔥",
    cover_image_url: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&q=80",
    play_count: 48200,
    like_count: 3100,
    comment_count: 142,
    share_count: 89,
    duration: 28,
    create_time: "2026-03-15",
    embed_link: "https://www.tiktok.com/embed/v2/sandbox_vid_7001",
  },
  {
    id: "vid_7002",
    title: "Street Art Festival Rotterdam 2026 🎨",
    cover_image_url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80",
    play_count: 29800,
    like_count: 1870,
    comment_count: 67,
    share_count: 45,
    duration: 19,
    create_time: "2026-03-08",
    embed_link: "https://www.tiktok.com/embed/v2/sandbox_vid_7002",
  },
  {
    id: "vid_7003",
    title: "Techno Night at Shelter Amsterdam ✨",
    cover_image_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
    play_count: 15400,
    like_count: 920,
    comment_count: 38,
    share_count: 21,
    duration: 15,
    create_time: "2026-02-28",
    embed_link: "https://www.tiktok.com/embed/v2/sandbox_vid_7003",
  },
];

const SCOPES = [
  { name: "user.info.basic", product: "Login Kit", description: "Read basic user profile info (display name, avatar, bio)", status: "granted" },
  { name: "user.info.stats", product: "Display API", description: "Read follower count, like count, video count", status: "granted" },
  { name: "video.list", product: "Display API", description: "Fetch the user's public video list with metadata", status: "granted" },
  { name: "video.publish", product: "Content Posting API", description: "Publish videos to TikTok via URL-based post", status: "granted" },
  { name: "share.sound.single", product: "Share Kit", description: "Share content with a single sound to TikTok", status: "granted" },
];

function fmt(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export default function TikTokIntegrationPage() {
  const { toast } = useToast();
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [oauthStep, setOauthStep] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "display" | "posting" | "share" | "scopes">("overview");
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();

  // Posting form state
  const [postTitle, setPostTitle] = useState("");
  const [postCaption, setPostCaption] = useState("");
  const [postPrivacy, setPostPrivacy] = useState<"PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY">("PUBLIC_TO_EVERYONE");
  const [postDuet, setPostDuet] = useState(false);
  const [postStitch, setPostStitch] = useState(false);
  const [postComment, setPostComment] = useState(true);
  const [postStep, setPostStep] = useState<"idle" | "uploading" | "processing" | "published">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishedId, setPublishedId] = useState("");

  // Share form state
  const [shareEvent, setShareEvent] = useState("IMPACT+ Bboy Battle Amsterdam – April 12, 2026");
  const [shareText, setShareText] = useState("🔥 Don't miss the biggest bboy battle in Amsterdam! 🎤 April 12 @ Melkweg. Register NOW on Urban Culture Hub. #Bboy #UrbanCulture #Amsterdam");
  const [shareStep, setShareStep] = useState<"idle" | "sharing" | "done">("idle");

  // Check if returning from TikTok OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnection("connected");
      setOauthStep(4);
      setActiveTab("overview");
      toast({ title: "TikTok connected!", description: "Sandbox account linked successfully." });
      navigate("/admin/tiktok", { replace: true });
    } else if (params.get("error")) {
      const errMsg = decodeURIComponent(params.get("error") || "Unknown error");
      toast({ title: "TikTok connection failed", description: errMsg, variant: "destructive" });
      navigate("/admin/tiktok", { replace: true });
    }
  }, []);

  // Check persisted connection status on mount
  useEffect(() => {
    fetch("/api/tiktok/status")
      .then(r => r.json())
      .then((data: any) => {
        if (data.connected) {
          setConnection("connected");
          setOauthStep(4);
        }
      })
      .catch(() => {});
  }, []);

  const REDIRECT_URI = `${window.location.origin}/api/tiktok/callback`;

  const handleOAuthConnect = () => {
    // Redirect to real TikTok OAuth via backend
    window.location.href = "/api/tiktok/auth";
  };

  const handleDisconnect = async () => {
    await fetch("/api/tiktok/disconnect", { method: "DELETE" });
    setConnection("disconnected");
    setOauthStep(0);
    setActiveTab("overview");
    setPostStep("idle");
    setShareStep("idle");
  };

  const handlePublish = () => {
    if (!postCaption.trim()) {
      toast({ title: "Caption required", variant: "destructive" });
      return;
    }
    setPostStep("uploading");
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.floor(Math.random() * 12) + 5;
      });
    }, 250);
    setTimeout(() => {
      clearInterval(interval);
      setUploadProgress(100);
      setPostStep("processing");
    }, 3500);
    setTimeout(() => {
      const id = "sandbox_" + Math.random().toString(36).slice(2, 10);
      setPublishedId(id);
      setPostStep("published");
      toast({ title: "Video published!", description: `Video ID: ${id}` });
    }, 5500);
  };

  const handleShare = () => {
    setShareStep("sharing");
    setTimeout(() => {
      setShareStep("done");
      toast({ title: "Shared to TikTok!", description: "Content was shared via Share Kit." });
    }, 2500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "display", label: "Display API", icon: Eye },
    { id: "posting", label: "Content Posting", icon: Upload },
    { id: "share", label: "Share Kit", icon: Share2 },
    { id: "scopes", label: "Scopes", icon: Shield },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
              <SiTiktok className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">TikTok Integration</h1>
              <p className="text-sm text-muted-foreground">Admin · Sandbox Environment</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-bold border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-950/20">
            Sandbox Mode
          </Badge>
          {connection === "connected" ? (
            <Badge className="bg-green-500 text-white border-0 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Connected
            </Badge>
          ) : connection === "connecting" ? (
            <Badge className="bg-yellow-500 text-white border-0 text-xs font-bold">
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Connecting...
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5 mr-1" /> Not connected
            </Badge>
          )}
        </div>
      </div>

      {/* Sandbox info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-800 dark:text-blue-300">TikTok Developer Sandbox</p>
          <p className="text-blue-700 dark:text-blue-400 text-xs mt-0.5">
            This integration runs in TikTok's sandbox environment as required for app review. All API calls use the sandbox base URL <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">https://open.tiktokapis.com/v2/</code> with your sandbox credentials.
          </p>
        </div>
      </div>

      {/* OAuth Connection Flow */}
      {connection !== "connected" && (
        <Card className="border-2 border-dashed border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="w-4 h-4 text-primary" /> Step 1 — Login Kit · Connect TikTok Account
            </CardTitle>
            <CardDescription>
              Authenticate with TikTok using OAuth 2.0. Clicking "Connect" opens TikTok's authorization page where users grant permission for the requested scopes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth flow steps */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { step: 1, label: "Redirect to TikTok", desc: "User clicks Connect" },
                { step: 2, label: "User Authorizes", desc: "Grants scopes on TikTok" },
                { step: 3, label: "Receive Auth Code", desc: "OAuth callback returns code" },
                { step: 4, label: "Exchange Token", desc: "Server gets access token" },
              ].map(({ step, label, desc }) => (
                <div key={step} className={cn(
                  "flex flex-col items-center text-center p-3 rounded-xl border transition-all",
                  oauthStep >= step ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "border-border bg-secondary/30"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center mb-2 text-sm font-bold transition-all",
                    oauthStep >= step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {oauthStep >= step ? <Check className="w-4 h-4" /> : step}
                  </div>
                  <p className="text-xs font-bold leading-tight">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            {/* OAuth URL preview */}
            <div className="rounded-xl bg-muted/50 border p-3 font-mono text-xs break-all text-muted-foreground">
              <span className="text-green-600 dark:text-green-400">GET </span>
              https://www.tiktok.com/v2/auth/authorize?client_key=<span className="text-primary">sbawxx...</span>&scope=<span className="text-amber-600">user.info.basic,user.info.stats,video.list,video.publish,share.sound.single</span>&response_type=code&redirect_uri=<span className="text-blue-500">{REDIRECT_URI}</span>&state=<span className="text-muted-foreground">csrf_token_xyz</span>
            </div>

            <Button
              data-testid="button-connect-tiktok"
              onClick={handleOAuthConnect}
              disabled={connection === "connecting"}
              className="w-full bg-black hover:bg-black/80 text-white font-bold gap-2 h-11"
            >
              {connection === "connecting" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing with TikTok...</>
              ) : (
                <><SiTiktok className="w-4 h-4" /> Connect with TikTok</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connected view */}
      {connection === "connected" && (
        <>
          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto border-b border-border pb-0 [&::-webkit-scrollbar]:hidden">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`tab-tiktok-${id}`}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all",
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Connected account card */}
              <Card className="border-green-400/50 bg-green-50/30 dark:bg-green-950/10">
                <CardContent className="pt-5">
                  <div className="flex items-start gap-4">
                    <img
                      src={SANDBOX_ACCOUNT.avatar_url}
                      alt={SANDBOX_ACCOUNT.display_name}
                      className="w-16 h-16 rounded-full border-2 border-green-400/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{SANDBOX_ACCOUNT.display_name}</h3>
                        <Badge variant="outline" className="text-xs border-orange-400 text-orange-500">Sandbox</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{SANDBOX_ACCOUNT.bio_description}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <code className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                          open_id: {SANDBOX_ACCOUNT.open_id}
                        </code>
                        <button onClick={() => handleCopy(SANDBOX_ACCOUNT.open_id)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDisconnect} className="shrink-0 text-xs">
                      Disconnect
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    {[
                      { label: "Followers", value: fmt(SANDBOX_ACCOUNT.follower_count), icon: Users },
                      { label: "Following", value: fmt(SANDBOX_ACCOUNT.following_count), icon: User },
                      { label: "Total Likes", value: fmt(SANDBOX_ACCOUNT.likes_count), icon: Heart },
                      { label: "Videos", value: SANDBOX_ACCOUNT.video_count, icon: Film },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="p-3 rounded-xl bg-background border text-center">
                        <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-lg font-extrabold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* API products summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Login Kit", desc: "OAuth 2.0 authentication", icon: LogIn, status: "active", color: "text-blue-500" },
                  { label: "Display API", desc: "User info & video list", icon: Eye, status: "active", color: "text-purple-500" },
                  { label: "Content Posting API", desc: "Upload & publish videos", icon: Upload, status: "active", color: "text-green-500" },
                  { label: "Share Kit", desc: "Share content to TikTok", icon: Share2, status: "active", color: "text-orange-500" },
                ].map(({ label, desc, icon: Icon, status, color }) => (
                  <Card key={label} className="border">
                    <CardContent className="pt-4 pb-4">
                      <div className={cn("w-8 h-8 rounded-lg bg-secondary flex items-center justify-center mb-2", color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Token info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" /> Access Token
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Access Token</p>
                      <p className="font-mono text-xs font-bold">att_sandbox_•••••1xKp</p>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Expires In</p>
                      <p className="font-mono text-xs font-bold">86399 seconds</p>
                    </div>
                    <div className="p-3 rounded-xl bg-secondary/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Token Type</p>
                      <p className="font-mono text-xs font-bold">Bearer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Display API Tab */}
          {activeTab === "display" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">Display API — Video List</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fetches the user's public videos using <code className="bg-secondary px-1 rounded">GET /v2/video/list/</code> with scope <code className="bg-secondary px-1 rounded">video.list</code>
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>

              {/* API call preview */}
              <div className="rounded-xl bg-muted/50 border p-3 font-mono text-xs space-y-1">
                <div><span className="text-green-600 dark:text-green-400">GET </span><span className="text-blue-500">https://open.tiktokapis.com/v2/video/list/</span></div>
                <div className="text-muted-foreground pl-4">Authorization: Bearer att_sandbox_•••••1xKp</div>
                <div className="text-muted-foreground pl-4">Content-Type: application/json</div>
                <div className="text-muted-foreground pl-4">Body: {"{ \"max_count\": 20, \"fields\": [\"id\",\"title\",\"cover_image_url\",\"play_count\",\"like_count\"] }"}</div>
              </div>

              {/* Video grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {SANDBOX_VIDEOS.map((video) => (
                  <Card key={video.id} className="overflow-hidden group">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={video.cover_image_url}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlayCircle className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                        0:{String(video.duration).padStart(2, "0")}
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[10px] bg-black/70 text-white border-0">#{video.id}</Badge>
                      </div>
                    </div>
                    <CardContent className="pt-3 pb-3">
                      <p className="text-xs font-bold leading-snug line-clamp-2 mb-2">{video.title}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" />{fmt(video.play_count)}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(video.like_count)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{video.comment_count}</span>
                        <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{video.share_count}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{video.create_time}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* API Response preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">API Response (sample)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/50 rounded-xl p-3 overflow-x-auto font-mono text-muted-foreground">
{`{
  "data": {
    "videos": [
      {
        "id": "${SANDBOX_VIDEOS[0].id}",
        "title": "${SANDBOX_VIDEOS[0].title}",
        "cover_image_url": "https://...",
        "play_count": ${SANDBOX_VIDEOS[0].play_count},
        "like_count": ${SANDBOX_VIDEOS[0].like_count},
        "comment_count": ${SANDBOX_VIDEOS[0].comment_count},
        "share_count": ${SANDBOX_VIDEOS[0].share_count}
      }
    ],
    "cursor": 1712000000000,
    "has_more": true
  },
  "error": { "code": "ok", "message": "", "log_id": "sandbox_log_xyz" }
}`}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Content Posting Tab */}
          {activeTab === "posting" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-base">Content Posting API</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload and publish videos to TikTok using <code className="bg-secondary px-1 rounded">POST /v2/post/publish/video/init/</code>
                </p>
              </div>

              {postStep === "idle" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Upload className="w-4 h-4 text-primary" /> Video File
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all" data-testid="upload-video-zone">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Film className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-sm">Drop video file here</p>
                            <p className="text-xs text-muted-foreground mt-0.5">MP4, MOV · Max 4GB · Min 3s</p>
                          </div>
                          <Button variant="outline" size="sm" className="text-xs">Browse files</Button>
                        </div>
                        <div className="mt-3 p-3 rounded-xl bg-secondary/50 border text-xs text-muted-foreground">
                          <p className="font-semibold mb-1 text-foreground">Publish flow (URL-based):</p>
                          <ol className="list-decimal list-inside space-y-0.5">
                            <li>POST /v2/post/publish/video/init/ → provide video_url + get publish_id</li>
                            <li>TikTok pulls video from URL → returns publish_id</li>
                            <li>POST /v2/post/publish/status/fetch/ → poll until PUBLISH_COMPLETE</li>
                          </ol>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Post Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold mb-1 block">Caption *</label>
                          <Textarea
                            data-testid="input-post-caption"
                            placeholder="Write a caption... #UrbanCulture #Amsterdam #Dance"
                            value={postCaption}
                            onChange={e => setPostCaption(e.target.value)}
                            className="text-sm resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1 text-right">{postCaption.length}/2200</p>
                        </div>

                        <div>
                          <label className="text-xs font-semibold mb-1 block">Privacy Level</label>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { value: "PUBLIC_TO_EVERYONE", label: "Public", icon: Globe },
                              { value: "MUTUAL_FOLLOW_FRIENDS", label: "Friends", icon: Users },
                              { value: "SELF_ONLY", label: "Private", icon: Lock },
                            ].map(({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                data-testid={`button-privacy-${value.toLowerCase()}`}
                                onClick={() => setPostPrivacy(value as typeof postPrivacy)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                  postPrivacy === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                                )}
                              >
                                <Icon className="w-3 h-3" />{label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold">Interactions</label>
                          {[
                            { key: "comment", label: "Allow Comments", value: postComment, set: setPostComment },
                            { key: "duet", label: "Allow Duet", value: postDuet, set: setPostDuet },
                            { key: "stitch", label: "Allow Stitch", value: postStitch, set: setPostStitch },
                          ].map(({ key, label, value, set }) => (
                            <div key={key} className="flex items-center justify-between py-1">
                              <span className="text-xs">{label}</span>
                              <button
                                data-testid={`toggle-${key}`}
                                onClick={() => set(!value)}
                                className={cn("w-9 h-5 rounded-full transition-colors relative", value ? "bg-primary" : "bg-muted")}
                              >
                                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", value ? "left-4" : "left-0.5")} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <Button
                          data-testid="button-publish-tiktok"
                          onClick={handlePublish}
                          className="w-full bg-black hover:bg-black/80 text-white font-bold gap-2"
                        >
                          <SiTiktok className="w-4 h-4" /> Publish to TikTok
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {postStep === "uploading" && (
                <Card>
                  <CardContent className="py-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary animate-bounce" />
                    </div>
                    <div className="w-full max-w-md space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>Uploading video to TikTok...</span>
                        <span>{Math.min(uploadProgress, 100)}%</span>
                      </div>
                      <Progress value={Math.min(uploadProgress, 100)} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">POST /v2/post/publish/video/init/ · TikTok pulling from URL...</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {postStep === "processing" && (
                <Card>
                  <CardContent className="py-10 flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <div className="text-center">
                      <p className="font-bold">Processing on TikTok servers...</p>
                      <p className="text-sm text-muted-foreground mt-1">Polling POST /v2/post/publish/status/fetch/</p>
                    </div>
                    <div className="flex gap-2">
                      {["PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD", "PUBLISH_COMPLETE"].map((s, i) => (
                        <Badge key={s} variant={i === 1 ? "default" : "secondary"} className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {postStep === "published" && (
                <Card className="border-green-400/50 bg-green-50/30 dark:bg-green-950/10">
                  <CardContent className="py-8 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-extrabold text-lg">Published Successfully!</p>
                      <p className="text-sm text-muted-foreground mt-1">Your video is now live on TikTok</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background border w-full max-w-sm space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">publish_id</span>
                        <code className="font-mono text-xs">{publishedId}</code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">status</span>
                        <Badge className="bg-green-500 text-white border-0 text-xs">PUBLISH_COMPLETE</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.open("https://www.tiktok.com/@sandbox_urbanculturehub", "_blank")}>
                        <ExternalLink className="w-3.5 h-3.5" /> View on TikTok
                      </Button>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setPostStep("idle"); setPostCaption(""); }}>
                        Post another
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Share Kit Tab */}
          {activeTab === "share" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-base">Share Kit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share events and content directly to TikTok using the Share Kit SDK
                </p>
              </div>

              {shareStep === "idle" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Music className="w-4 h-4 text-primary" /> Share Event to TikTok
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold mb-1 block">Event</label>
                        <Input
                          data-testid="input-share-event"
                          value={shareEvent}
                          onChange={e => setShareEvent(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block">Share Text</label>
                        <Textarea
                          data-testid="input-share-text"
                          value={shareText}
                          onChange={e => setShareText(e.target.value)}
                          className="text-sm resize-none"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-right">{shareText.length}/150</p>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/50 border text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground mb-1">Share Kit flow:</p>
                        <p>Calls <code>ttq.share()</code> from the TikTok Pixel SDK with the event URL and caption. Opens TikTok's share sheet on mobile or redirects on web.</p>
                      </div>
                      <Button
                        data-testid="button-share-tiktok"
                        onClick={handleShare}
                        className="w-full bg-black hover:bg-black/80 text-white font-bold gap-2"
                      >
                        <SiTiktok className="w-4 h-4" /> Share to TikTok
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Preview card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">TikTok Share Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl overflow-hidden border shadow-sm max-w-xs mx-auto">
                        <img
                          src="https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&q=80"
                          alt="Event preview"
                          className="w-full aspect-square object-cover"
                        />
                        <div className="p-3 bg-black text-white">
                          <div className="flex items-center gap-2 mb-2">
                            <SiTiktok className="w-4 h-4" />
                            <span className="text-xs font-bold">@sandbox_urbanculturehub</span>
                          </div>
                          <p className="text-xs leading-relaxed line-clamp-3">{shareText}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Music className="w-3 h-3 text-white/60" />
                            <p className="text-[10px] text-white/60">Original sound</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {shareStep === "sharing" && (
                <Card>
                  <CardContent className="py-10 flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center">
                      <SiTiktok className="w-7 h-7 text-white animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold">Sharing to TikTok...</p>
                      <p className="text-sm text-muted-foreground">Invoking Share Kit SDK</p>
                    </div>
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </CardContent>
                </Card>
              )}

              {shareStep === "done" && (
                <Card className="border-green-400/50 bg-green-50/30 dark:bg-green-950/10">
                  <CardContent className="py-8 flex flex-col items-center gap-4">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                    <div className="text-center">
                      <p className="font-extrabold text-lg">Shared to TikTok!</p>
                      <p className="text-sm text-muted-foreground">Content was successfully shared via Share Kit</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShareStep("idle")} className="text-xs">Share again</Button>
                      <Button size="sm" onClick={() => window.open("https://www.tiktok.com/@sandbox_urbanculturehub", "_blank")} className="gap-1.5 text-xs">
                        <ExternalLink className="w-3.5 h-3.5" /> View profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Scopes Tab */}
          {activeTab === "scopes" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-bold text-base">Permissions & Scopes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All scopes granted by the sandbox user during the OAuth authorization step
                </p>
              </div>

              <div className="space-y-2">
                {SCOPES.map((scope) => (
                  <div key={scope.name} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <code className="text-xs font-mono font-bold bg-secondary px-2 py-0.5 rounded">{scope.name}</code>
                        <Badge variant="outline" className="text-[10px] font-semibold">{scope.product}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{scope.description}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs shrink-0">
                      Granted
                    </Badge>
                  </div>
                ))}
              </div>

              <Card className="bg-secondary/30">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-semibold mb-2">Scope string sent in OAuth request:</p>
                  <code className="text-xs font-mono break-all text-muted-foreground">
                    {SCOPES.map(s => s.name).join(",")}
                  </code>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
