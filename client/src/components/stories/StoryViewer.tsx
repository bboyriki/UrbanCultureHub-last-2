import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Eye, Trash2, Volume2, VolumeX, Send,
  Heart, MoreVertical, ChevronLeft, ChevronRight, Share2
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const IMAGE_STORY_DURATION = 7000; // 7s for images and text

const QUICK_REACTIONS = ["❤️", "🔥", "😂", "😍", "👏", "💯"];

export interface StoryUser {
  userId: number;
  displayName: string;
  profilePicture?: string | null;
  isOwn: boolean;
  hasUnviewed: boolean;
  stories: Array<{
    id: number;
    mediaUrl: string;
    mediaType: string;
    caption?: string | null;
    bgColor?: string | null;
    viewCount: number;
    createdAt: string;
    expiresAt: string;
    viewed: boolean;
  }>;
}

interface Props {
  users: StoryUser[];
  startUserIndex: number;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StoryViewer({ users, startUserIndex, onClose }: Props) {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [userIdx, setUserIdx] = useState(startUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [muted, setMuted] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = users[userIdx];
  const currentStory = currentUser?.stories[storyIdx];
  const isOwn = currentUser?.userId === me?.id;
  const isVideo = currentStory?.mediaType === "video";
  const isText = currentStory?.mediaType === "text";

  const viewMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/stories/${id}/view`, "POST"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/stories/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stories/feed"] });
      toast({ title: "Story deleted" });
      goNextStory();
    },
  });

  const { data: viewers = [] } = useQuery<any[]>({
    queryKey: [`/api/stories/${currentStory?.id}/viewers`],
    enabled: isOwn && showViewers && !!currentStory,
  });

  const goNextStory = useCallback(() => {
    if (!currentUser) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (storyIdx < currentUser.stories.length - 1) {
      setStoryIdx(i => i + 1);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    } else if (userIdx < users.length - 1) {
      setUserIdx(i => i + 1);
      setStoryIdx(0);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    } else {
      onClose();
    }
  }, [currentUser, storyIdx, userIdx, users.length, onClose]);

  const goPrevStory = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    } else if (userIdx > 0) {
      setUserIdx(i => i - 1);
      setStoryIdx(0);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    }
  }, [storyIdx, userIdx]);

  const goNextUser = useCallback(() => {
    if (userIdx < users.length - 1) {
      setUserIdx(i => i + 1);
      setStoryIdx(0);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    } else {
      onClose();
    }
  }, [userIdx, users.length, onClose]);

  const goPrevUser = useCallback(() => {
    if (userIdx > 0) {
      setUserIdx(i => i - 1);
      setStoryIdx(0);
      setProgress(0); progressRef.current = 0;
      setImgLoaded(false); setVideoDuration(null);
    }
  }, [userIdx]);

  // Progress timer for non-video stories
  useEffect(() => {
    if (!currentStory || isVideo) return;
    if (paused || showReply || showViewers) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const isReady = isText || imgLoaded;
    if (!isReady) return;

    const step = 50;
    const duration = IMAGE_STORY_DURATION;
    intervalRef.current = setInterval(() => {
      progressRef.current += (step / duration) * 100;
      setProgress(progressRef.current);
      if (progressRef.current >= 100) {
        clearInterval(intervalRef.current!);
        goNextStory();
      }
    }, step);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentStory?.id, paused, imgLoaded, isVideo, isText, goNextStory, showReply, showViewers]);

  // Video progress sync
  const handleVideoTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = (v.currentTime / v.duration) * 100;
    setProgress(pct);
    progressRef.current = pct;
  }, []);

  const handleVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setVideoDuration(v.duration);
    setImgLoaded(true);
    if (!paused) v.play().catch(() => {});
  }, [paused]);

  // Pause/resume video on hold
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    if (paused) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [paused, isVideo]);

  // Mark viewed + reset on story change
  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      viewMutation.mutate(currentStory.id);
    }
    setProgress(0);
    progressRef.current = 0;
    setImgLoaded(false);
    setVideoDuration(null);
    setSentReaction(null);
  }, [currentStory?.id]);

  // Mute state sync to video element
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  // Touch / swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    holdTimerRef.current = setTimeout(() => setPaused(true), 150);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    const dx = e.changedTouches[0].clientX - (touchStartXRef.current ?? 0);
    const dy = e.changedTouches[0].clientY - (touchStartYRef.current ?? 0);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Was holding (paused)
    if (paused) {
      setPaused(false);
      return;
    }

    // Swipe up: show reply
    if (absDy > 60 && dy < 0 && absDy > absDx) {
      setShowReply(true);
      return;
    }

    // Swipe left: next user
    if (absDx > 80 && absDx > absDy && dx < 0) {
      goNextUser();
      return;
    }

    // Swipe right: prev user
    if (absDx > 80 && absDx > absDy && dx > 0) {
      goPrevUser();
      return;
    }

    // Tap: navigate within story
    const x = e.changedTouches[0].clientX;
    const width = (e.currentTarget as HTMLElement).offsetWidth;
    if (x < width * 0.35) goPrevStory();
    else goNextStory();
  };

  // Click handler (desktop)
  const handleClick = (e: React.MouseEvent) => {
    if (showReply || showViewers) return;
    const x = e.clientX;
    const width = (e.currentTarget as HTMLElement).offsetWidth;
    if (x < width * 0.35) goPrevStory();
    else goNextStory();
  };

  const sendReaction = (emoji: string) => {
    setSentReaction(emoji);
    toast({ title: `Reacted with ${emoji}`, description: "Sent to story creator." });
    setTimeout(() => setSentReaction(null), 1500);
  };

  const sendReply = () => {
    if (!replyText.trim()) return;
    toast({ title: "Reply sent!", description: `"${replyText}" sent to ${currentUser?.displayName}.` });
    setReplyText("");
    setShowReply(false);
  };

  if (!currentUser || !currentStory) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[300] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative w-full max-w-md h-full overflow-hidden">

        {/* Story content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${userIdx}-${storyIdx}`}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
          >
            {isText ? (
              <div
                className="w-full h-full flex items-center justify-center px-8"
                style={{ background: currentStory.bgColor || "linear-gradient(135deg,#667eea,#764ba2)" }}
              >
                <p
                  className="text-white text-3xl font-black text-center leading-snug"
                  style={{ textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
                >
                  {currentStory.caption}
                </p>
              </div>
            ) : isVideo ? (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
                    <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={currentStory.mediaUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted={muted}
                  playsInline
                  loop={false}
                  onEnded={goNextStory}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onLoadedMetadata={handleVideoLoaded}
                  onError={() => {
                    toast({ title: "Video failed to load", variant: "destructive" });
                    setImgLoaded(true);
                  }}
                />
              </>
            ) : (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={currentStory.mediaUrl}
                  alt="story"
                  className="w-full h-full object-cover"
                  onLoad={() => setImgLoaded(true)}
                  style={{ opacity: imgLoaded ? 1 : 0 }}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Tap / swipe interaction layer */}
        <div
          className="absolute inset-0 z-10"
          onClick={handleClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseDown={() => { holdTimerRef.current = setTimeout(() => setPaused(true), 150); }}
          onMouseUp={() => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); if (paused) setPaused(false); }}
          onMouseLeave={() => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); if (paused) setPaused(false); }}
        />

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2">
          {currentUser.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${Math.min(progress, 100)}%` : "0%",
                }}
                transition={{ duration: 0 }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-3 pt-6 pb-4
          bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
          <Avatar className="w-9 h-9 ring-2 ring-white shrink-0 pointer-events-auto">
            <AvatarImage src={currentUser.profilePicture || undefined} />
            <AvatarFallback className="text-xs bg-primary text-white font-bold">
              {currentUser.displayName?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 pointer-events-none">
            <p className="text-white text-sm font-bold truncate drop-shadow">{currentUser.displayName}</p>
            <p className="text-white/60 text-[11px]">{timeAgo(currentStory.createdAt)}</p>
          </div>

          {/* Mute toggle (video only) */}
          {isVideo && (
            <button
              onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white pointer-events-auto"
              data-testid="btn-story-mute"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Viewers (own story) */}
          {isOwn && (
            <button
              onClick={e => { e.stopPropagation(); setShowViewers(v => !v); }}
              className="flex items-center gap-1 text-white/80 text-xs pointer-events-auto"
              data-testid="btn-story-viewers"
            >
              <Eye className="w-4 h-4" />
              <span>{currentStory.viewCount}</span>
            </button>
          )}

          {/* Options menu */}
          <div className="relative pointer-events-auto">
            <button
              onClick={e => { e.stopPropagation(); setShowOptions(v => !v); }}
              className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white"
              data-testid="btn-story-options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  className="absolute right-0 top-9 bg-gray-900 border border-white/10 rounded-xl shadow-xl w-36 overflow-hidden z-50"
                  onClick={e => e.stopPropagation()}
                >
                  {isOwn && (
                    <button
                      onClick={() => { setShowOptions(false); deleteMutation.mutate(currentStory.id); }}
                      className="flex items-center gap-2 w-full px-4 py-3 text-red-400 text-sm hover:bg-white/5"
                      data-testid="btn-story-delete"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete story
                    </button>
                  )}
                  <button
                    onClick={() => { setShowOptions(false); onClose(); }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-white/70 text-sm hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white pointer-events-auto"
            data-testid="btn-story-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-user side navigation */}
        {userIdx > 0 && (
          <button
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
            onClick={e => { e.stopPropagation(); goPrevUser(); }}
            data-testid="btn-story-prev-user"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}
        {userIdx < users.length - 1 && (
          <button
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
            onClick={e => { e.stopPropagation(); goNextUser(); }}
            data-testid="btn-story-next-user"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}

        {/* Caption overlay */}
        {currentStory.caption && !isText && (
          <div className="absolute bottom-20 left-0 right-0 z-20 px-5 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2">
              <p className="text-white text-sm font-medium text-center leading-snug">
                {currentStory.caption}
              </p>
            </div>
          </div>
        )}

        {/* Reaction sent animation */}
        <AnimatePresence>
          {sentReaction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 0 }}
              animate={{ opacity: 1, scale: 1.5, y: -60 }}
              exit={{ opacity: 0, scale: 2, y: -120 }}
              transition={{ duration: 0.5 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 text-5xl"
            >
              {sentReaction}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar: reactions + reply */}
        {!isOwn && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-4 px-4">
            {/* Quick reactions */}
            <div className="flex justify-center gap-3 mb-3">
              {QUICK_REACTIONS.map(emoji => (
                <motion.button
                  key={emoji}
                  whileTap={{ scale: 0.8 }}
                  onClick={e => { e.stopPropagation(); sendReaction(emoji); }}
                  className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors"
                  data-testid={`btn-story-react-${emoji}`}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>

            {/* Reply input */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onFocus={() => { setShowReply(true); setPaused(true); }}
                  onBlur={() => { setShowReply(false); setPaused(false); }}
                  placeholder={`Reply to ${currentUser.displayName.split(" ")[0]}…`}
                  className="flex-1 bg-transparent text-white placeholder:text-white/40 text-sm outline-none"
                  data-testid="input-story-reply"
                  onKeyDown={e => { if (e.key === "Enter") sendReply(); }}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              {replyText.trim() && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={e => { e.stopPropagation(); sendReply(); }}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                  data-testid="btn-story-send-reply"
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Own story bottom bar */}
        {isOwn && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent pb-6 pt-4 px-4 flex items-center justify-center">
            <button
              onClick={e => { e.stopPropagation(); setShowViewers(v => !v); }}
              className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2"
              data-testid="btn-story-view-count"
            >
              <Eye className="w-4 h-4 text-white/70" />
              <span className="text-white/80 text-sm font-medium">
                {currentStory.viewCount} {currentStory.viewCount === 1 ? "view" : "views"}
              </span>
            </button>
          </div>
        )}

        {/* Viewers panel (own story) */}
        <AnimatePresence>
          {showViewers && isOwn && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 z-30 bg-gray-950/95 backdrop-blur-md rounded-t-2xl max-h-72 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-white/60" />
                  <span className="text-white text-sm font-bold">{currentStory.viewCount} views</span>
                </div>
                <button onClick={() => setShowViewers(false)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {viewers.length === 0 ? (
                  <div className="py-8 text-center text-white/40 text-sm">No viewers yet</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {viewers.map((v: any) => (
                      <div key={v.viewer.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={v.viewer.profilePicture || undefined} />
                          <AvatarFallback className="text-xs bg-gray-700 text-white">
                            {v.viewer.displayName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white text-sm flex-1">{v.viewer.displayName}</span>
                        <span className="text-white/40 text-xs">{timeAgo(v.viewedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause indicator */}
        <AnimatePresence>
          {paused && !showReply && !showViewers && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-15 bg-black/20 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-7 bg-white rounded-full" />
                  <div className="w-1.5 h-7 bg-white rounded-full" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
