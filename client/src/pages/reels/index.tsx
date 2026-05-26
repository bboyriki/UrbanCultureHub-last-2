import { useState, useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { analytics } from "@/lib/analytics";
import {
  Heart, MessageCircle, Share2, Plus, Volume2, VolumeX,
  ChevronUp, ChevronDown, Loader2, Play, MoreVertical, Trash2, Film,
  Bookmark, UserPlus, UserCheck, Eye, ChevronRight, Flag, Ban, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import CreatorStudio from "./CreatorStudio";
import CommentsDrawer from "./CommentsDrawer";
import ShareSheet from "./ShareSheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/** Route Instagram CDN video URLs through our server proxy to avoid CORS/expiry issues */
function proxyVideoUrl(url: string): string {
  if (!url) return url;
  if (/(cdninstagram\.com|fbcdn\.net)/i.test(url)) {
    return `/api/instagram/proxy-video?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface ReelUser {
  id: number;
  displayName: string;
  profilePicture: string | null;
}

interface ReelData {
  id: number;
  userId: number;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  duration: number | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  createdAt: string;
  user: ReelUser;
}

function getSavedReels(): number[] {
  try {
    return JSON.parse(localStorage.getItem("saved_reels") || "[]");
  } catch {
    return [];
  }
}

function toggleSavedReel(reelId: number): boolean {
  const saved = getSavedReels();
  const idx = saved.indexOf(reelId);
  if (idx >= 0) {
    saved.splice(idx, 1);
    localStorage.setItem("saved_reels", JSON.stringify(saved));
    return false;
  } else {
    saved.push(reelId);
    localStorage.setItem("saved_reels", JSON.stringify(saved));
    return true;
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const CAPTION_LIMIT = 80;

function CaptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > CAPTION_LIMIT;
  const displayed = expanded || !isLong ? text : text.slice(0, CAPTION_LIMIT);

  const renderParts = (str: string) =>
    str.split(/(#\w+)/g).map((part, i) =>
      part.startsWith("#") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  return (
    <p className="text-white text-sm leading-snug drop-shadow pr-2">
      {renderParts(displayed)}
      {isLong && !expanded && (
        <button
          className="text-zinc-400 ml-1 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
        >
          …more
        </button>
      )}
      {isLong && expanded && (
        <button
          className="text-zinc-400 ml-1 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
        >
          {" "}less
        </button>
      )}
    </p>
  );
}

function ReelCard({
  reel,
  isActive,
  muted,
  onMuteToggle,
  onLike,
  onComment,
  onShare,
  onDelete,
  currentUserId,
}: {
  reel: ReelData;
  isActive: boolean;
  muted: boolean;
  onMuteToggle: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onDelete: () => void;
  currentUserId?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(reel.isLiked);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [sharesCount, setSharesCount] = useState(reel.sharesCount);
  const [showMenu, setShowMenu] = useState(false);
  const [showNonOwnerMenu, setShowNonOwnerMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const viewTracked = useRef(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [videoProgress, setVideoProgress] = useState(0);
  const progressRaf = useRef<number>(0);

  const [saved, setSaved] = useState(() => getSavedReels().includes(reel.id));
  const [saveAnim, setSaveAnim] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [heartBursts, setHeartBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTapRef = useRef(0);
  const burstIdRef = useRef(0);
  const doubleTapFiredRef = useRef(false);

  const { data: followStatus } = useQuery<{ isFollowing: boolean; status?: string }>({
    queryKey: [`/api/users/${reel.userId}/is-following`],
    enabled: !!currentUserId && currentUserId !== reel.userId,
    staleTime: 60000,
  });

  const queryClient = useQueryClient();
  const followMutation = useMutation({
    mutationFn: () => apiRequest(`/api/users/${reel.userId}/follow`, "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/users/${reel.userId}/is-following`] }),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => apiRequest(`/api/users/${reel.userId}/follow`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/users/${reel.userId}/is-following`] }),
  });

  const reportMutation = useMutation({
    mutationFn: ({ reason, details }: { reason: string; details: string }) =>
      apiRequest(`/api/reels/${reel.id}/report`, "POST", {
        reason: details ? `${reason}: ${details}` : reason,
      }),
    onSuccess: () => {
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
      toast({ title: "Report submitted", description: "Our moderation team will review this within 24 hours. Thank you." });
    },
    onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: () => apiRequest(`/api/users/${reel.userId}/block`, "POST"),
    onSuccess: () => {
      setShowBlockConfirm(false);
      toast({ title: `@${reel.user?.displayName} blocked`, description: "You won't see their content anymore." });
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
    },
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  const shareMutation = useMutation({
    mutationFn: () => apiRequest(`/api/reels/${reel.id}/share`, "POST"),
  });

  useEffect(() => {
    setLiked(reel.isLiked);
    setLikesCount(reel.likesCount);
    setSharesCount(reel.sharesCount);
  }, [reel.isLiked, reel.likesCount, reel.sharesCount]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
      setPlaying(true);
      if (!viewTracked.current) {
        viewTracked.current = true;
        apiRequest(`/api/reels/${reel.id}/view`, "POST").catch(() => {});
      }
    } else {
      vid.pause();
      setPlaying(false);
    }
  }, [isActive, reel.id]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = muted;
  }, [muted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isActive) return;
    const updateProgress = () => {
      if (vid.duration > 0) setVideoProgress((vid.currentTime / vid.duration) * 100);
      progressRaf.current = requestAnimationFrame(updateProgress);
    };
    progressRaf.current = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(progressRaf.current);
  }, [isActive]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play().catch(() => {}); setPlaying(true); }
    else { vid.pause(); setPlaying(false); }
  };

  const handleLike = () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 400);
    onLike();
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++burstIdRef.current;
      setHeartBursts(prev => [...prev, { id, x, y }]);
      setTimeout(() => setHeartBursts(prev => prev.filter(b => b.id !== id)), 900);
      if (!liked) handleLike();
      doubleTapFiredRef.current = true;
      lastTapRef.current = 0;
    } else {
      doubleTapFiredRef.current = false;
      lastTapRef.current = now;
      const tapTime = now;
      setTimeout(() => {
        if (doubleTapFiredRef.current) return;
        if (lastTapRef.current === tapTime) {
          togglePlay();
          lastTapRef.current = 0;
        }
      }, 360);
    }
  };

  const handleSave = () => {
    const nowSaved = toggleSavedReel(reel.id);
    setSaved(nowSaved);
    setSaveAnim(true);
    setTimeout(() => setSaveAnim(false), 300);
  };

  const handleShareCounted = () => {
    setSharesCount(c => c + 1);
    shareMutation.mutate();
    onShare();
  };

  const isOwner = currentUserId === reel.userId;
  const isFollowing = followStatus?.isFollowing;
  const showFollow = currentUserId && !isOwner && !isFollowing;

  return (
    <div
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      data-testid={`reel-card-${reel.id}`}
    >
      <video
        ref={videoRef}
        src={proxyVideoUrl(reel.videoUrl)}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        poster={reel.thumbnailUrl || undefined}
        onClick={handleVideoClick}
      />

      {/* Double-tap heart bursts */}
      {heartBursts.map(burst => (
        <div
          key={burst.id}
          className="absolute pointer-events-none z-30 animate-heart-burst"
          style={{ left: burst.x - 30, top: burst.y - 30 }}
        >
          <Heart size={60} className="text-red-500 fill-red-500 drop-shadow-lg" />
        </div>
      ))}

      {/* Play overlay */}
      {!playing && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
            <Play size={28} className="text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25 pointer-events-none" />

      {/* Urban Culture Hub watermark — always visible, burns into screen-recordings */}
      <div className="absolute bottom-[68px] sm:bottom-[84px] left-3 sm:left-4 z-10 pointer-events-none select-none">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
          <img
            src="/logo.png"
            alt=""
            className="w-4 h-4 rounded-full object-cover opacity-90"
          />
          <span className="text-white text-[10px] font-semibold tracking-tight opacity-80 leading-none">
            Urban Culture Hub
          </span>
        </div>
      </div>

      {/* Mute button */}
      <button
        onClick={onMuteToggle}
        className="absolute top-[60px] right-3 sm:right-4 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 flex items-center justify-center text-white backdrop-blur-sm z-10"
        data-testid="button-mute-toggle"
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {/* Right action bar */}
      <div className="absolute right-2 sm:right-3 bottom-[72px] sm:bottom-[88px] flex flex-col items-center gap-3 sm:gap-4 z-10">

        {/* Avatar */}
        <button
          onClick={() => navigate(`/profile/${reel.userId}`)}
          className="relative mb-0.5"
          data-testid={`link-reel-avatar-${reel.userId}`}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white overflow-hidden bg-zinc-800">
            {reel.user?.profilePicture ? (
              <img src={reel.user.profilePicture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                {(reel.user?.displayName || "?")[0].toUpperCase()}
              </div>
            )}
          </div>
        </button>

        {/* Follow */}
        {showFollow && (
          <button
            onClick={() => followMutation.mutate()}
            className="flex flex-col items-center gap-0.5 transition-transform active:scale-90"
            data-testid={`button-follow-reel-${reel.userId}`}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center">
              <UserPlus size={12} className="text-white sm:hidden" />
              <UserPlus size={14} className="text-white hidden sm:block" />
            </div>
          </button>
        )}

        {/* Unfollow */}
        {currentUserId && !isOwner && isFollowing && (
          <button
            onClick={() => unfollowMutation.mutate()}
            className="flex flex-col items-center gap-0.5 opacity-70"
            data-testid={`button-following-reel-${reel.userId}`}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-700 flex items-center justify-center">
              <UserCheck size={12} className="text-green-400 sm:hidden" />
              <UserCheck size={14} className="text-green-400 hidden sm:block" />
            </div>
          </button>
        )}

        {/* Like */}
        <button
          onClick={handleLike}
          className={cn("flex flex-col items-center gap-0.5 sm:gap-1 transition-transform", likeAnim && "animate-like-pop")}
          data-testid={`button-like-reel-${reel.id}`}
        >
          <div className={cn(
            "w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-all duration-200",
            liked && "scale-110"
          )}>
            <Heart size={20} className={cn("transition-all duration-200 sm:hidden", liked ? "text-red-500 fill-red-500" : "text-white")} />
            <Heart size={22} className={cn("transition-all duration-200 hidden sm:block", liked ? "text-red-500 fill-red-500" : "text-white")} />
          </div>
          <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg tabular-nums leading-none">{formatCount(likesCount)}</span>
        </button>

        {/* Comment */}
        <button
          onClick={onComment}
          className="flex flex-col items-center gap-0.5 sm:gap-1"
          data-testid={`button-comment-reel-${reel.id}`}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle size={20} className="text-white sm:hidden" />
            <MessageCircle size={22} className="text-white hidden sm:block" />
          </div>
          <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg tabular-nums leading-none">{formatCount(reel.commentsCount)}</span>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className={cn("flex flex-col items-center gap-0.5 sm:gap-1 transition-transform", saveAnim && "scale-125")}
          data-testid={`button-save-reel-${reel.id}`}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Bookmark size={20} className={cn("transition-all duration-200 sm:hidden", saved ? "text-yellow-400 fill-yellow-400" : "text-white")} />
            <Bookmark size={22} className={cn("transition-all duration-200 hidden sm:block", saved ? "text-yellow-400 fill-yellow-400" : "text-white")} />
          </div>
          <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg tabular-nums leading-none">{saved ? "★" : ""}</span>
        </button>

        {/* Share (opens ShareSheet) */}
        <button
          onClick={() => setShowShareSheet(true)}
          className="flex flex-col items-center gap-0.5 sm:gap-1"
          data-testid={`button-share-reel-${reel.id}`}
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Share2 size={18} className="text-white sm:hidden" />
            <Share2 size={20} className="text-white hidden sm:block" />
          </div>
          <span className="text-white text-xs sm:text-sm font-bold drop-shadow-lg tabular-nums leading-none">{formatCount(sharesCount)}</span>
        </button>

        {/* Owner menu */}
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(m => !m)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
              data-testid={`button-more-reel-${reel.id}`}
            >
              <MoreVertical size={18} className="text-white sm:hidden" />
              <MoreVertical size={20} className="text-white hidden sm:block" />
            </button>
            {showMenu && (
              <div className="absolute right-12 bottom-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl z-20 min-w-[130px]">
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  className="flex items-center gap-2 px-4 py-3 text-red-400 hover:bg-zinc-800 text-sm whitespace-nowrap w-full"
                  data-testid={`button-delete-reel-${reel.id}`}
                >
                  <Trash2 size={14} /> Delete reel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Non-owner menu: Report + Block */}
        {!isOwner && currentUserId && (
          <div className="relative">
            <button
              onClick={() => setShowNonOwnerMenu(m => !m)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center"
              data-testid={`button-more-nonowner-${reel.id}`}
            >
              <MoreVertical size={18} className="text-white sm:hidden" />
              <MoreVertical size={20} className="text-white hidden sm:block" />
            </button>
            {showNonOwnerMenu && (
              <div className="absolute right-12 bottom-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-xl z-20 min-w-[180px]" data-testid={`menu-nonowner-${reel.id}`}>
                <button
                  onClick={() => { setShowNonOwnerMenu(false); setShowReportModal(true); setReportReason(""); setReportDetails(""); }}
                  className="flex items-center gap-2.5 px-4 py-3 text-zinc-200 hover:bg-zinc-800 text-sm whitespace-nowrap w-full"
                  data-testid={`button-report-reel-${reel.id}`}
                >
                  <Flag size={14} className="text-orange-400" /> Report
                </button>
                <button
                  onClick={() => { setShowNonOwnerMenu(false); setShowBlockConfirm(true); }}
                  className="flex items-center gap-2.5 px-4 py-3 text-zinc-200 hover:bg-zinc-800 text-sm whitespace-nowrap w-full"
                  data-testid={`button-block-user-${reel.userId}`}
                >
                  <Ban size={14} className="text-red-400" /> Block @{reel.user?.displayName}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="max-w-sm mx-auto" data-testid="dialog-report-reel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Report Reel
            </DialogTitle>
            <DialogDescription>
              Help us understand what's wrong with this content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <RadioGroup value={reportReason} onValueChange={setReportReason} data-testid="report-reason-group">
              {[
                "Nudity or sexual content",
                "Violence or dangerous acts",
                "Harassment or bullying",
                "Hate speech or symbols",
                "Spam or misleading info",
                "Self-harm or suicide",
                "Unauthorized or stolen content",
                "Other",
              ].map(reason => (
                <div key={reason} className="flex items-center gap-2.5">
                  <RadioGroupItem value={reason} id={`reason-${reason}`} data-testid={`report-reason-${reason.toLowerCase().replace(/ /g, "-")}`} />
                  <Label htmlFor={`reason-${reason}`} className="text-sm font-normal cursor-pointer">{reason}</Label>
                </div>
              ))}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Additional details (optional)</Label>
              <Textarea
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                placeholder="Provide any extra context..."
                className="resize-none h-20 text-sm"
                data-testid="input-report-details"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReportModal(false)} disabled={reportMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => reportReason && reportMutation.mutate({ reason: reportReason, details: reportDetails })}
              disabled={!reportReason || reportMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Confirm Modal */}
      <Dialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <DialogContent className="max-w-sm mx-auto" data-testid="dialog-block-user">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" /> Block @{reel.user?.displayName}?
            </DialogTitle>
            <DialogDescription>
              They won't be able to see your profile or content, and their content won't appear in your feed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockConfirm(false)} disabled={blockMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => blockMutation.mutate()}
              disabled={blockMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom info: username, caption, views, time */}
      <div className="absolute bottom-4 sm:bottom-6 left-3 sm:left-4 right-14 sm:right-16 z-10">
        <button
          onClick={() => navigate(`/profile/${reel.userId}`)}
          className="flex items-center gap-2 mb-1.5 group"
          data-testid={`link-reel-user-${reel.userId}`}
        >
          <span className="text-white font-semibold text-sm drop-shadow group-hover:underline">
            @{reel.user?.displayName || "user"}
          </span>
        </button>

        {reel.caption && <CaptionText text={reel.caption} />}

        {/* Meta: views + time */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-zinc-400 text-[11px] drop-shadow">
            <Eye size={11} />
            {formatCount(reel.viewsCount)} views
          </span>
          <span className="text-zinc-500 text-[11px] drop-shadow">
            {formatDistanceToNow(new Date(reel.createdAt), { addSuffix: true })}
            {reel.duration ? ` · ${reel.duration}s` : ""}
          </span>
        </div>
      </div>

      {/* Video progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20">
        <div className="h-full bg-white/80 transition-none" style={{ width: `${videoProgress}%` }} />
      </div>

      {/* ShareSheet */}
      {showShareSheet && (
        <ShareSheet
          reelId={reel.id}
          caption={reel.caption}
          thumbnailUrl={reel.thumbnailUrl}
          videoUrl={reel.videoUrl}
          onClose={() => setShowShareSheet(false)}
          onShareCounted={handleShareCounted}
        />
      )}
    </div>
  );
}

export default function ReelsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [activeComments, setActiveComments] = useState<{ reelId: number; count: number } | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [viewMode, setViewMode] = useState<"feed" | "saved">("feed");
  const [savedIds, setSavedIds] = useState<number[]>(() => getSavedReels());
  const [savedViewIndex, setSavedViewIndex] = useState<number | null>(null);

  const { data: appSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const res = await fetch("/api/app-settings", { cache: "no-store" });
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: savedReelsData = [], isLoading: savedLoading } = useQuery<ReelData[]>({
    queryKey: ["/api/reels/batch", savedIds.sort().join(",")],
    queryFn: async () => {
      if (savedIds.length === 0) return [];
      const res = await fetch(`/api/reels/batch?ids=${savedIds.join(",")}`);
      return res.json();
    },
    enabled: viewMode === "saved" && savedIds.length > 0,
    staleTime: 30_000,
  });

  const reelsGuestsVisible = appSettings?.["reels_guests_visible"] === "true";

  // ── All hooks must be called unconditionally before any early return ──────
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<ReelData[]>({
    queryKey: ["/api/reels"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiRequest(`/api/reels?page=${pageParam}&limit=10`, "GET");
      return res.json() as Promise<ReelData[]>;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 10 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    enabled: !(!user && appSettings && !reelsGuestsVisible),
  });

  const reels: ReelData[] = data?.pages.flat() ?? [];

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const likeMutation = useMutation({
    mutationFn: (reelId: number) => apiRequest(`/api/reels/${reelId}/like`, "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reels"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (reelId: number) => apiRequest(`/api/reels/${reelId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reels"] }),
  });

  const scrollTo = useCallback((idx: number) => {
    slideRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Show swipe hint on first load when reels exist
  useEffect(() => {
    if (reels.length > 1 && !localStorage.getItem("reels_hint_shown")) {
      setShowSwipeHint(true);
      const t = setTimeout(() => {
        setShowSwipeHint(false);
        localStorage.setItem("reels_hint_shown", "1");
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [reels.length]);

  useEffect(() => {
    if (currentIndex >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [currentIndex, reels.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const reel = reels[currentIndex];
    if (reel) analytics.reelView(reel.id);
  }, [currentIndex]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && entry.intersectionRatio > 0.6) setCurrentIndex(i); },
        { threshold: 0.6 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [reels.length]);
  // ─────────────────────────────────────────────────────────────────────────

  // Now safe to do conditional renders
  if (!user && appSettings && !reelsGuestsVisible) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-5 px-8 text-center">
        <Film size={48} className="text-zinc-600" />
        <div>
          <h2 className="text-xl font-bold mb-2">Sign in to watch Reels</h2>
          <p className="text-zinc-400 text-sm">Create an account or sign in to access the Reels feed.</p>
        </div>
        <button
          onClick={() => navigate("/auth")}
          className="bg-primary text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
          data-testid="button-signin-reels"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
          <Film size={28} className="text-primary" />
        </div>
        <Loader2 size={24} className="text-zinc-500 animate-spin" />
        <p className="text-zinc-600 text-sm">Loading reels…</p>
      </div>
    );
  }

  return (
    <div className="relative bg-black" style={{ height: "100dvh" }}>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-bold text-lg drop-shadow">Reels</h1>
          {viewMode === "feed" && reels.length > 0 && (
            <span className="text-zinc-500 text-xs tabular-nums">{currentIndex + 1}/{reels.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (viewMode === "saved") {
                setViewMode("feed");
                setSavedViewIndex(null);
              } else {
                setSavedIds(getSavedReels());
                setViewMode("saved");
                setSavedViewIndex(null);
              }
            }}
            className={cn(
              "flex items-center gap-1.5 backdrop-blur-md text-white text-sm font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95",
              viewMode === "saved"
                ? "bg-yellow-500/30 border-yellow-400/50"
                : "bg-white/10 border-white/20 hover:bg-white/20"
            )}
            data-testid="button-toggle-saved-view"
          >
            <Bookmark size={14} className={cn(viewMode === "saved" ? "text-yellow-400 fill-yellow-400" : "text-white")} />
            <span className="hidden sm:inline">Saved</span>
            {savedIds.length > 0 && viewMode !== "saved" && (
              <span className="bg-yellow-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {savedIds.length > 9 ? "9+" : savedIds.length}
              </span>
            )}
          </button>
          {user && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-sm font-medium px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-all active:scale-95"
              data-testid="button-upload-reel"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SAVED REELS VIEW ── */}
      {viewMode === "saved" && (
        <div className="absolute inset-0 z-10 bg-black overflow-y-auto pt-16" data-testid="saved-reels-view">
          {savedViewIndex !== null ? (
            /* Single-reel fullscreen view */
            <div className="absolute inset-0 z-30">
              <button
                onClick={() => setSavedViewIndex(null)}
                className="absolute top-4 left-4 z-40 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
                data-testid="button-back-saved-reel"
              >
                <ChevronDown size={20} className="text-white rotate-90" />
              </button>
              <ReelCard
                reel={savedReelsData[savedViewIndex]}
                isActive={true}
                muted={muted}
                onMuteToggle={() => setMuted(m => !m)}
                onLike={() => { if (!user) return; likeMutation.mutate(savedReelsData[savedViewIndex].id); }}
                onComment={() => setActiveComments({ reelId: savedReelsData[savedViewIndex].id, count: savedReelsData[savedViewIndex].commentsCount })}
                onShare={() => {}}
                onDelete={() => { deleteMutation.mutate(savedReelsData[savedViewIndex].id); setSavedViewIndex(null); }}
                currentUserId={user?.id}
              />
            </div>
          ) : (
            /* Grid view */
            <div className="px-1 pb-8">
              <div className="flex items-center gap-2 px-4 py-3">
                <Bookmark size={16} className="text-yellow-400 fill-yellow-400" />
                <span className="text-white font-semibold text-sm">
                  Saved Reels
                  {savedIds.length > 0 && <span className="ml-1.5 text-zinc-400 font-normal">{savedIds.length}</span>}
                </span>
              </div>

              {savedLoading ? (
                <div className="flex justify-center pt-16">
                  <Loader2 size={28} className="text-zinc-500 animate-spin" />
                </div>
              ) : savedIds.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-5 px-8 text-center pt-20">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center">
                    <Bookmark size={32} className="text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">No saved reels</h3>
                    <p className="text-zinc-400 text-sm mt-1.5">Tap the 🔖 bookmark on any reel to save it here.</p>
                  </div>
                  <button
                    onClick={() => setViewMode("feed")}
                    className="bg-primary text-white px-5 py-2.5 rounded-full text-sm font-semibold"
                    data-testid="button-browse-reels"
                  >
                    Browse Reels
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {savedReelsData.map((reel, i) => (
                    <button
                      key={reel.id}
                      onClick={() => setSavedViewIndex(i)}
                      className="relative aspect-[9/16] bg-zinc-900 overflow-hidden"
                      data-testid={`saved-reel-thumb-${reel.id}`}
                    >
                      {reel.thumbnailUrl ? (
                        <img src={reel.thumbnailUrl} alt={reel.caption || "Reel"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film size={24} className="text-zinc-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
                          <Play size={16} className="text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-1 left-1 flex items-center gap-1">
                        <Eye size={10} className="text-white/80" />
                        <span className="text-white/80 text-[10px] font-medium">{formatCount(reel.viewsCount)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scroll nav arrows (desktop) */}
      {viewMode === "feed" && currentIndex > 0 && (
        <button
          onClick={() => scrollTo(currentIndex - 1)}
          className="hidden md:flex absolute left-1/2 -translate-x-1/2 top-20 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 transition"
          data-testid="button-scroll-up"
        >
          <ChevronUp size={20} />
        </button>
      )}
      {viewMode === "feed" && currentIndex < reels.length - 1 && (
        <button
          onClick={() => scrollTo(currentIndex + 1)}
          className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-20 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur items-center justify-center text-white hover:bg-black/60 transition"
          data-testid="button-scroll-down"
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* Scroll dots indicator (desktop) */}
      {viewMode === "feed" && reels.length > 1 && (
        <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 flex-col gap-1">
          {reels.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={cn(
                "rounded-full transition-all duration-200",
                i === currentIndex ? "w-1.5 h-4 bg-white" : "w-1 h-1 bg-white/40 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}

      {/* Swipe hint */}
      {viewMode === "feed" && showSwipeHint && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-28 z-20 flex flex-col items-center gap-1 pointer-events-none animate-fade-in">
          <div className="flex flex-col items-center gap-0.5 opacity-90">
            <ChevronUp size={18} className="text-white/70 animate-bounce" />
            <span className="text-white/70 text-xs font-medium tracking-wide">Swipe for more</span>
          </div>
        </div>
      )}

      {/* Main scroll container (feed mode only) */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none", display: viewMode === "feed" ? undefined : "none" }}
      >
        {/* Empty state */}
        {reels.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center gap-6 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center">
              <Film size={36} className="text-primary" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl">No reels yet</h2>
              <p className="text-zinc-400 text-sm mt-2">Be the first to share a reel with the community!</p>
            </div>
            {user && (
              <button
                onClick={() => setShowUpload(true)}
                className="bg-primary text-white px-6 py-3 rounded-full font-semibold flex items-center gap-2 hover:bg-primary/90 transition active:scale-95"
                data-testid="button-first-reel"
              >
                <Plus size={18} />
                Post the first reel
              </button>
            )}
          </div>
        )}

        {/* Reel slides */}
        {reels.map((reel, i) => (
          <div
            key={reel.id}
            ref={(el) => { slideRefs.current[i] = el; }}
            className="snap-start snap-always"
            style={{ height: "100dvh" }}
          >
            <ReelCard
              reel={reel}
              isActive={i === currentIndex}
              muted={muted}
              onMuteToggle={() => setMuted(m => !m)}
              onLike={() => { if (!user) return; likeMutation.mutate(reel.id); }}
              onComment={() => setActiveComments({ reelId: reel.id, count: reel.commentsCount })}
              onShare={() => {}}
              onDelete={() => deleteMutation.mutate(reel.id)}
              currentUserId={user?.id}
            />
          </div>
        ))}

        {isFetchingNextPage && (
          <div className="snap-start flex items-center justify-center h-20 bg-black">
            <Loader2 size={20} className="text-zinc-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Creator Studio */}
      {showUpload && (
        <CreatorStudio
          onClose={() => setShowUpload(false)}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: ["/api/reels"] })}
        />
      )}

      {/* Comments drawer */}
      {activeComments && (
        <CommentsDrawer
          reelId={activeComments.reelId}
          commentsCount={activeComments.count}
          onClose={() => setActiveComments(null)}
        />
      )}
    </div>
  );
}
