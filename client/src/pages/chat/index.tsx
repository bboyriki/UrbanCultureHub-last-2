import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle, Plus, Search, ArrowLeft, Send, Check, CheckCheck,
  Clock, User, Crown, Megaphone, X, MoreVertical, Trash2, Mic,
  Play, Pause, Image as ImageIcon, Smile, Reply, PenLine,
  Bot, Lock, Sparkles, Phone, Video, PhoneOff, PhoneIncoming,
  MicOff, VideoOff, Volume2, VolumeX, PhoneMissed,
  Star, Forward, Archive, Pin, PinOff, Users, Copy, ArchiveRestore,
  Info, LogOut, ImagePlus, Headphones,
} from "lucide-react";
import { formatDuration, type CallType } from "@/lib/useWebRTC";
import { useCallAudio } from "@/lib/useCallAudio";
import { useCallContext } from "@/contexts/CallContext";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket, ConnectionStatus } from "@/contexts/WebSocketSingletonContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import AuthWrapper from "@/components/layout/AuthWrapper";

/* ─────────────────────────────────────────────── types ─── */
interface Conversation {
  id: number;
  participantOneId: number;
  participantTwoId: number;
  status: string;
  lastActivity: string;
  lastMessageId: number | null;
  lastMessage?: Message;
  participants?: UserInfo[];
  unreadCount?: number;
  isGroupChat?: boolean;
  isGroup?: boolean;
  title?: string;
  groupAvatarUrl?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

interface DeliveryStatus {
  userId: number;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  contentType?: string;
  attachmentType?: string;
  type?: string;
  status?: string;
  isDelivered?: boolean;
  isRead?: boolean;
  createdAt: string;
  deliveryStatus?: DeliveryStatus[];
  replyToId?: number;
  replyToContent?: string;
  replyToSenderName?: string;
  isForwarded?: boolean;
  deletedAt?: string | null;
}

interface UserInfo {
  id: number;
  displayName: string;
  profilePicture?: string;
  role?: string;
}

/* ─────────────────────────────────────────── constants ─── */
const EMOJI_GRID = [
  '😀','😂','😍','🥰','😎','🤔','😢','😡','🤯','🥳',
  '👍','👎','❤️','🔥','✨','💯','🎉','👏','🙏','💪',
  '😊','😉','🤣','😭','😤','🙄','😏','🥺','😮','🤗',
  '👋','🤝','👀','💀','🤦','🤷','🎵','🏆','⚡','🌟',
  '🍕','🎯','💎','🚀','🌈','🦋','🐉','🏄','🎨','🌙',
];

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😍', '👏', '💯', '😢', '😡'];

const MAX_RECORDING = 90;

/* ──────────────────────────────────────────── helpers ──── */
function getMessageStatus(msg: Message, userId: number): 'sending' | 'sent' | 'delivered' | 'read' {
  if (msg.senderId !== userId) return 'sent';
  // Optimistic messages have negative IDs or explicit 'sending' status
  if ((msg as any).id < 0 || (msg as any).status === 'sending') return 'sending';
  const ds = msg.deliveryStatus || [];
  if (ds.some(d => d.readAt || d.status === 'read')) return 'read';
  if (ds.some(d => d.deliveredAt || d.status === 'delivered')) return 'delivered';
  return 'sent';
}

function StatusIcon({ status }: { status: 'sending' | 'sent' | 'delivered' | 'read' }) {
  if (status === 'sending') {
    return (
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
        <Clock className="h-3 w-3 text-primary-foreground/50" />
      </motion.div>
    );
  }
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-blue-300" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/60" />;
  return <Check className="h-3 w-3 text-primary-foreground/50" />;
}

function fmtMsgTime(ts: string) {
  try {
    const d = new Date(ts);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'MMM d, HH:mm');
  } catch { return ''; }
}

function fmtListTime(ts: string) {
  try {
    const d = new Date(ts);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch { return ''; }
}

function fmtDateSep(ts: string) {
  try {
    const d = new Date(ts);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMM d');
  } catch { return ''; }
}

function linkify(text: string): React.ReactNode[] {
  const urlRe = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRe).map((part, i) =>
    urlRe.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
          onClick={e => e.stopPropagation()}>{part}</a>
      : <span key={i}>{part}</span>
  );
}

/* ────────────────────────── sub-components (stable refs) ── */

function VoicePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cur, setCur] = useState(0);

  if (url === '[voice_expired]') {
    return (
      <div className={`flex items-center gap-2 min-w-[140px] opacity-60 ${isOwn ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
        <Mic className="h-4 w-4" />
        <span className="text-xs italic">Voice expired</span>
      </div>
    );
  }

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className={`flex items-center gap-2 min-w-[180px] ${isOwn ? 'text-primary-foreground' : 'text-foreground'}`}>
      <audio ref={audioRef} src={url}
        onTimeUpdate={e => { const a = e.currentTarget; if (a.duration) { setProgress((a.currentTime / a.duration) * 100); setCur(a.currentTime); } }}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); setCur(0); }} />
      <button onClick={toggle}
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/10 hover:bg-primary/20'}`}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={`h-1.5 rounded-full overflow-hidden cursor-pointer ${isOwn ? 'bg-white/20' : 'bg-muted'}`}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
          }}>
          <div className={`h-full rounded-full transition-all ${isOwn ? 'bg-white/80' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-70 font-mono">{playing ? fmt(cur) : duration ? fmt(duration) : ''}</span>
      </div>
    </div>
  );
}

function InlineImage({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  if (err) return <div className="flex items-center gap-2 text-xs opacity-60"><ImageIcon className="h-4 w-4" /> Unavailable</div>;
  return (
    <div className="relative max-w-[220px] overflow-hidden rounded-xl">
      {!loaded && <div className="h-32 w-[180px] bg-black/10 animate-pulse rounded-xl" />}
      <img src={url} alt="Photo" className={`max-w-full rounded-xl object-cover cursor-pointer transition-opacity ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
        style={{ maxHeight: 260 }}
        onLoad={() => setLoaded(true)} onError={() => setErr(true)}
        onClick={() => window.open(url, '_blank')} />
    </div>
  );
}

/* ═══════════════════════════════════════════ main page ════ */
export default function ChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { connectionStatus: wsStatus, sendMessage, subscribe, isConnected } = useWebSocket();
  const [location, setLocation] = useLocation();

  const deepLinkUserId = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("userId");
    return r ? parseInt(r, 10) : null;
  }, [location]);

  // ── state ──
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<number, boolean>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reactions, setReactions] = useState<Record<number, Record<string, number[]>>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);

  // ── WebRTC calling (global instance from CallContext) ──
  const webRTC = useCallContext();

  // ── Call audio (ring tones) ──
  const { playRingTone, stopAudio } = useCallAudio();
  const prevCallStateRef = useRef<string>("idle");

  useEffect(() => {
    const prev = prevCallStateRef.current;
    const curr = webRTC.callState;
    prevCallStateRef.current = curr;

    if (curr === prev) return;

    if (curr === "calling") {
      // Caller: check if target user is online for different ring tone
      const targetParticipant = selectedConv?.participants?.find((p: any) => p.id !== userIdRef.current);
      const targetUserId = targetParticipant?.id ?? null;
      const targetIsOnline = targetUserId ? onlineUsers.has(targetUserId) : false;
      playRingTone(targetIsOnline ? "outgoing_online" : "outgoing_offline");
    } else if (curr === "ringing") {
      // Receiver: incoming call ring
      playRingTone("incoming");
    } else if (curr === "connected") {
      stopAudio();
      if (prev === "calling" || prev === "ringing") {
        playRingTone("connected");
      }
    } else if (curr === "ended") {
      stopAudio();
      if (prev !== "idle") {
        if (webRTC.endReason === "declined" || webRTC.endReason === "busy") {
          playRingTone("declined");
        } else {
          playRingTone("ended");
        }
      }
    } else if (curr === "idle") {
      stopAudio();
    }
  }, [webRTC.callState, webRTC.endReason, selectedConv, onlineUsers, playRingTone, stopAudio]);

  // ── AI Assistant ──
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const aiEndRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Group chat ──
  const [showGroupModal, setShowGroupModal] = useState(false);

  // ── Archive / Pinned ──
  const [showArchived, setShowArchived] = useState(false);
  const [localPinned, setLocalPinned] = useState<Record<number, boolean>>({});
  const [localArchived, setLocalArchived] = useState<Record<number, boolean>>({});

  // ── Message actions ──
  const [starredMsgIds, setStarredMsgIds] = useState<Set<number>>(new Set());
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [msgContextMenu, setMsgContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);

  // ── Media gallery + group info panels ──
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // ── refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const prevWsStatus = useRef<ConnectionStatus | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // stable ref so subscribe closure always sees latest value without re-subscribing
  const selectedConvIdRef = useRef<number | null>(null);
  const userIdRef = useRef<number | null>(null);

  useEffect(() => { selectedConvIdRef.current = selectedConv?.id ?? null; }, [selectedConv?.id]);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user?.id]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // ── queries ──
  const { data: convs = [], isLoading: loadingConvs, refetch: refetchConvs } = useQuery<Conversation[]>({
    queryKey: ['/api/chat/conversations'],
    enabled: !!user,
    staleTime: 15000,
    refetchInterval: false,
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery<Message[]>({
    queryKey: [`/api/chat/conversations/${selectedConv?.id}/messages`],
    enabled: !!selectedConv?.id,
    staleTime: 60000,
    refetchInterval: false,
  });

  // ── Media gallery (lazy, only load when panel is open) ──
  const { data: mediaItems = [], isLoading: loadingMedia } = useQuery<any[]>({
    queryKey: [`/api/chat/conversations/${selectedConv?.id}/media`],
    enabled: !!selectedConv?.id && showMediaGallery,
    staleTime: 60000,
  });

  // ── mutations ──
  const sendMsgMutation = useMutation({
    mutationFn: async ({ content, contentType, replyToId, _tempId }: { content: string; contentType: string; replyToId?: number; _tempId?: number }) => {
      const res = await apiRequest({
        url: `/api/chat/conversations/${selectedConv!.id}/messages`,
        method: 'POST',
        data: { content, contentType, replyToId }
      });
      return { msg: await res.json(), _tempId };
    },
    // Optimistic update — show message instantly
    onMutate: async ({ content, contentType, replyToId }) => {
      const convId = selectedConv?.id;
      if (!convId) return {};
      const qKey = [`/api/chat/conversations/${convId}/messages`];
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Message[]>(qKey);
      const tempId = -(Date.now());
      const optimistic: Message = {
        id: tempId,
        conversationId: convId,
        senderId: user!.id,
        content,
        contentType,
        type: contentType,
        status: 'sending',
        createdAt: new Date().toISOString(),
        deliveryStatus: [],
        replyToId,
        replyToContent: replyTo?.content,
        replyToSenderName: replyTo ? 'You' : undefined,
      };
      queryClient.setQueryData(qKey, (old: Message[] | undefined) => [...(old || []), optimistic]);
      return { previous, tempId, qKey };
    },
    onSuccess: ({ msg, _tempId }, _vars, context: any) => {
      if (!msg) return;
      const qKey = context?.qKey || [`/api/chat/conversations/${selectedConv?.id}/messages`];
      queryClient.setQueryData(qKey, (old: Message[] | undefined) => {
        const msgs = old || [];
        // Replace optimistic with real message
        const filtered = msgs.filter(m => m.id !== (context?.tempId ?? _tempId));
        if (filtered.some(m => m.id === msg.id)) return filtered;
        return [...filtered, { ...msg, deliveryStatus: [] }];
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
    },
    onError: (_err, _vars, context: any) => {
      // Roll back optimistic update
      if (context?.previous && context?.qKey) {
        queryClient.setQueryData(context.qKey, context.previous);
      }
      toast({ title: "Failed to send", variant: "destructive" });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: (convId: number) => apiRequest({ url: `/api/chat/conversations/${convId}/read`, method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] })
  });

  const deleteConvMutation = useMutation({
    mutationFn: (convId: number) => apiRequest({ url: `/api/chat/conversations/${convId}`, method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConv(null);
      setMobileChat(false);
      toast({ title: "Conversation deleted" });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: ({ convId, archive }: { convId: number; archive: boolean }) =>
      apiRequest({ url: `/api/chat/conversations/${convId}/archive`, method: archive ? 'POST' : 'DELETE' }),
    onSuccess: (_, { convId, archive }) => {
      setLocalArchived(p => ({ ...p, [convId]: archive }));
      if (archive && selectedConv?.id === convId) { setSelectedConv(null); setMobileChat(false); }
      toast({ title: archive ? "Conversation archived" : "Conversation unarchived" });
    }
  });

  const pinMutation = useMutation({
    mutationFn: ({ convId, pin }: { convId: number; pin: boolean }) =>
      apiRequest({ url: `/api/chat/conversations/${convId}/pin`, method: pin ? 'POST' : 'DELETE' }),
    onSuccess: (_, { convId, pin }) => {
      setLocalPinned(p => ({ ...p, [convId]: pin }));
      toast({ title: pin ? "Conversation pinned" : "Conversation unpinned" });
    }
  });

  const deleteMsgMutation = useMutation({
    mutationFn: ({ msgId, convId, forEveryone }: { msgId: number; convId: number; forEveryone: boolean }) =>
      apiRequest({ url: `/api/chat/messages/${msgId}`, method: 'DELETE', data: { deleteForEveryone: forEveryone } }),
    onSuccess: (_, { msgId, convId }) => {
      queryClient.setQueryData([`/api/chat/conversations/${convId}/messages`], (old: Message[] | undefined) =>
        old?.filter(m => m.id !== msgId)
      );
      toast({ title: "Message deleted" });
    }
  });

  const forwardMsgMutation = useMutation({
    mutationFn: ({ msgId, targetConvId }: { msgId: number; targetConvId: number }) =>
      apiRequest({ url: `/api/chat/messages/${msgId}/forward`, method: 'POST', data: { targetConversationId: targetConvId } }),
    onSuccess: () => { setForwardMsg(null); toast({ title: "Message forwarded" }); }
  });

  const toggleStarMutation = useMutation({
    mutationFn: ({ msgId, star, convId }: { msgId: number; star: boolean; convId: number }) =>
      apiRequest({ url: `/api/chat/messages/${msgId}/star`, method: star ? 'POST' : 'DELETE', data: { conversationId: convId } }),
    onSuccess: (_, { msgId, star }) => {
      setStarredMsgIds(prev => { const s = new Set(prev); star ? s.add(msgId) : s.delete(msgId); return s; });
      toast({ title: star ? "⭐ Message starred" : "Star removed" });
    }
  });

  const leaveGroupMutation = useMutation({
    mutationFn: (convId: number) =>
      apiRequest({ url: `/api/chat/conversations/${convId}`, method: 'DELETE' }),
    onSuccess: () => {
      setShowGroupInfo(false);
      setSelectedConv(null);
      setMobileChat(false);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      toast({ title: "Left the group" });
    },
    onError: () => toast({ title: "Failed to leave group", variant: "destructive" })
  });

  const uploadAudioMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('audio', blob, 'voice-message.webm');
      const { auth } = await import("@/firebase/firebase");
      const headers: Record<string, string> = {};
      if (auth.currentUser) {
        try { headers["Authorization"] = `Bearer ${await auth.currentUser.getIdToken()}`; } catch {}
      }
      const res = await fetch('/api/upload/audio', { method: 'POST', headers, credentials: 'include', body: formData });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.url) {
        sendMsgMutation.mutate({ content: data.url, contentType: 'voice' });
        cancelRecording();
      }
    },
    onError: () => toast({ title: "Voice message failed", variant: "destructive" })
  });

  // ── WebSocket: online users on connect ──
  useEffect(() => {
    if (wsStatus === ConnectionStatus.CONNECTED && prevWsStatus.current !== ConnectionStatus.CONNECTED) {
      apiRequest({ url: '/api/chat/online-users', method: 'GET' })
        .then(r => r.json())
        .then((ids: number[]) => setOnlineUsers(new Set(ids)))
        .catch(() => {});
    }
    prevWsStatus.current = wsStatus;
  }, [wsStatus]);

  // ── WebSocket: messages (uses refs so subscribe never re-creates) ──
  useEffect(() => {
    if (!subscribe) return;
    const unsub = subscribe((wsMsg: any) => {
      const convId = selectedConvIdRef.current;
      const uid = userIdRef.current;

      if (wsMsg.type === 'CHAT_MESSAGE' || wsMsg.type === 'chat_message') {
        const inc = wsMsg.payload;
        if (!inc) return;

        if (inc.conversationId && convId && inc.conversationId === convId) {
          // Update local cache immediately — no server round-trip needed
          queryClient.setQueryData(
            [`/api/chat/conversations/${convId}/messages`],
            (old: Message[] | undefined) => {
              if (!old) return old;
              const exists = old.some(m =>
                m.id === inc.id ||
                (m.senderId === inc.senderId && m.content === inc.content &&
                  Math.abs(new Date(m.createdAt).getTime() - new Date(inc.createdAt || Date.now()).getTime()) < 5000)
              );
              if (exists) return old;
              return [...old, {
                id: inc.id || Date.now(),
                conversationId: inc.conversationId,
                senderId: inc.senderId,
                content: inc.content,
                contentType: inc.contentType || inc.type || 'text',
                type: inc.type || inc.contentType || 'text',
                createdAt: inc.createdAt || new Date().toISOString(),
                deliveryStatus: inc.deliveryStatus || [],
              }];
            }
          );
          // Update conversation list preview in background (no await)
          queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
        } else if (inc.conversationId) {
          // Message for a different conversation — just refresh the list badge
          queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
        }
        return;
      }

      if (wsMsg.type === 'CHAT_MESSAGE_DELIVERED') {
        const { messageId, conversationId, deliveredBy, deliveredAt } = wsMsg.payload || {};
        if (conversationId && messageId) {
          queryClient.setQueryData(
            [`/api/chat/conversations/${conversationId}/messages`],
            (old: Message[] | undefined) => old?.map(m => {
              if (m.id !== messageId) return m;
              const ds = m.deliveryStatus || [];
              if (ds.some(d => d.status === 'delivered' || d.deliveredAt)) return m;
              return { ...m, deliveryStatus: [...ds, { status: 'delivered', deliveredAt: deliveredAt || new Date().toISOString(), userId: deliveredBy }] };
            })
          );
        }
        return;
      }

      if (wsMsg.type === 'CHAT_MESSAGE_READ') {
        const { conversationId, readBy, timestamp } = wsMsg.payload || {};
        if (conversationId) {
          queryClient.setQueryData(
            [`/api/chat/conversations/${conversationId}/messages`],
            (old: Message[] | undefined) => old?.map(m => {
              if (m.senderId !== uid) return m;
              const ds = m.deliveryStatus || [];
              if (ds.some(d => d.readAt || d.status === 'read')) return m;
              return { ...m, deliveryStatus: [...ds, { status: 'read', readAt: timestamp || new Date().toISOString(), userId: readBy }] };
            })
          );
        }
        return;
      }

      if (wsMsg.type === 'CHAT_TYPING') {
        const { conversationId, userId: tid } = wsMsg.payload || {};
        if (tid !== uid && conversationId === convId) {
          setTypingUsers(p => ({ ...p, [conversationId]: true }));
          setTimeout(() => setTypingUsers(p => ({ ...p, [conversationId]: false })), 3000);
        }
        return;
      }

      if (wsMsg.type === 'CHAT_USER_ONLINE') { setOnlineUsers(p => new Set([...p, wsMsg.payload?.userId])); return; }
      if (wsMsg.type === 'CHAT_USER_OFFLINE') { setOnlineUsers(p => { const n = new Set(p); n.delete(wsMsg.payload?.userId); return n; }); return; }
    });
    return () => unsub();
  }, [subscribe, queryClient]); // intentionally no selectedConv dep — using ref

  // ── smart scroll to bottom ────────────────────────────────────────────────
  // Only auto-scroll when the user is already near the bottom OR the newest
  // message is from them. This stops the dreaded "I tried to read history and
  // got yanked back to the bottom" bug. On conversation switch we always jump
  // to the bottom instantly (no smooth animation).
  const lastConvIdScrollRef = useRef<number | null>(null);
  useEffect(() => {
    const container = messagesContainerRef.current;
    const end = messagesEndRef.current;
    if (!end) return;
    const convId = selectedConv?.id ?? null;
    const convChanged = convId !== lastConvIdScrollRef.current;
    lastConvIdScrollRef.current = convId;
    if (convChanged) {
      // jump immediately on conv switch
      requestAnimationFrame(() => end.scrollIntoView({ behavior: 'instant' as ScrollBehavior }));
      return;
    }
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    const isOwnMessage = lastMsg?.senderId === user?.id;
    const nearBottom = !container ||
      (container.scrollHeight - container.scrollTop - container.clientHeight) < 200;
    if (isOwnMessage || nearBottom) {
      end.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedConv?.id, user?.id]);

  // ── mobile keyboard: push messages up ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (messagesContainerRef.current) {
        const kbHeight = window.innerHeight - vv.height;
        messagesContainerRef.current.style.paddingBottom = kbHeight > 50 ? `${kbHeight}px` : '';
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // ── deep link: open conversation from ?userId=xxx ──
  const openByUserIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!deepLinkUserId || !user || loadingConvs) return;
    if (openByUserIdRef.current === deepLinkUserId) return;
    openByUserIdRef.current = deepLinkUserId;
    const clear = () => setLocation("/chat", { replace: true } as any);
    const existing = convs.find(c => c.participants?.some((p: any) => p.id === deepLinkUserId));
    if (existing) { openConv(existing); clear(); return; }
    apiRequest({ url: '/api/chat/conversations', method: 'POST', data: { participants: [deepLinkUserId] } })
      .then((res: any) => res.json?.() ?? res)
      .then(async (body: any) => {
        const id = (body?.data || body)?.id;
        await queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
        const all = queryClient.getQueryData<Conversation[]>(['/api/chat/conversations']) || [];
        const found = all.find(c => c.id === id) || all.find(c => c.participants?.some((p: any) => p.id === deepLinkUserId));
        if (found) openConv(found);
        else if (id) openConv({ id } as any);
      })
      .catch(() => {})
      .finally(clear);
  }, [deepLinkUserId, user, loadingConvs, convs]);

  // ── handlers ──
  const openConv = useCallback((conv: Conversation) => {
    setSelectedConv(conv);
    setMobileChat(true);
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (conv.id) markReadMutation.mutate(conv.id);
    setTimeout(() => textareaRef.current?.focus(), 120);
  }, [markReadMutation]);

  const handleSend = useCallback(() => {
    const content = msgText.trim();
    if (!content || sendMsgMutation.isPending || !selectedConv) return;
    setMsgText("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    sendMsgMutation.mutate({ content, contentType: 'text', replyToId: replyTo?.id });
    // Reset textarea height
    setTimeout(() => {
      if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.focus(); }
    }, 0);
  }, [msgText, sendMsgMutation, selectedConv, replyTo]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMsgText(e.target.value);
    // auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    // typing indicator
    if (wsStatus === ConnectionStatus.CONNECTED && selectedConvIdRef.current) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendMessage?.('CHAT_TYPING', { conversationId: selectedConvIdRef.current, userId: userIdRef.current });
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage?.('CHAT_STOPPED_TYPING', { conversationId: selectedConvIdRef.current, userId: userIdRef.current });
      }, 2500);
    }
  }, [wsStatus, sendMessage]);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleImagePick = useCallback(() => fileInputRef.current?.click(), []);

  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: "Please select an image file", variant: "destructive" }); return; }
    if (file.size > 20 * 1024 * 1024) { toast({ title: "Image too large (max 20MB)", variant: "destructive" }); return; }
    setUploadingImage(true);
    try {
      const { auth } = await import("@/firebase/firebase");
      let token = '';
      if (auth.currentUser) { try { token = await auth.currentUser.getIdToken(); } catch {} }
      const sigRes = await fetch('/api/stories/upload-signature', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' });
      if (!sigRes.ok) throw new Error();
      const { signature, timestamp, apiKey, cloudName, folder } = await sigRes.json();
      const fd = new FormData();
      fd.append('file', file);
      fd.append('signature', signature);
      fd.append('timestamp', String(timestamp));
      fd.append('api_key', apiKey);
      fd.append('folder', folder || 'urban-culture/chat');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const { secure_url } = await res.json();
      sendMsgMutation.mutate({ content: secure_url, contentType: 'image' });
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }, [sendMsgMutation, toast]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (s >= MAX_RECORDING - 1) { stopRecording(); return MAX_RECORDING; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setRecordingSeconds(0);
  }, [stopRecording]);

  const sendVoiceMessage = useCallback(() => {
    if (!audioBlob) return;
    uploadAudioMutation.mutate(audioBlob);
  }, [audioBlob, uploadAudioMutation]);

  // ── AI assistant mutation ──
  const aiMutation = useMutation({
    mutationFn: (messages: { role: string; content: string }[]) =>
      apiRequest<{ reply: string }>({ method: "POST", url: "/api/chat/ai-message", data: { messages } }),
    onSuccess: (data) => {
      setAiHistory(h => [...h, { role: "assistant", content: data.reply }]);
    },
    onError: (e: any) => {
      const msg = e?.message || "AI assistant unavailable";
      setAiHistory(h => [...h, { role: "assistant", content: `⚠️ ${msg}` }]);
    },
  });

  const sendAiMessage = useCallback(() => {
    const text = aiInput.trim();
    if (!text || aiMutation.isPending) return;
    const next = [...aiHistory, { role: "user" as const, content: text }];
    setAiHistory(next);
    setAiInput("");
    aiMutation.mutate(next);
    setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [aiInput, aiHistory, aiMutation]);

  useEffect(() => {
    if (aiHistory.length > 0) {
      setTimeout(() => aiEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [aiHistory.length]);

  const toggleReaction = useCallback((msgId: number, emoji: string) => {
    setReactions(prev => {
      const r = { ...(prev[msgId] || {}) };
      const users = r[emoji] ? [...r[emoji]] : [];
      const idx = users.indexOf(user!.id);
      if (idx >= 0) users.splice(idx, 1); else users.push(user!.id);
      if (users.length === 0) delete r[emoji]; else r[emoji] = users;
      return { ...prev, [msgId]: r };
    });
    setReactionPickerFor(null);
  }, [user?.id]);

  // ── derived ──
  const getOther = useCallback((conv: Conversation): UserInfo | null =>
    conv.participants?.find(p => p.id !== user?.id) || null,
  [user?.id]);

  const getConvName = useCallback((conv: Conversation): string => {
    if (conv.isGroupChat || conv.isGroup || conv.title) return conv.title || 'Group Chat';
    return getOther(conv)?.displayName || 'Unknown';
  }, [getOther]);

  const getConvAvatar = useCallback((conv: Conversation): string | undefined => {
    if (conv.isGroupChat || conv.isGroup) return (conv as any).groupAvatarUrl || undefined;
    return getOther(conv)?.profilePicture || undefined;
  }, [getOther]);

  const isConvPinned = useCallback((conv: Conversation) =>
    localPinned[conv.id] ?? (conv as any).isPinned ?? false,
  [localPinned]);

  const isConvArchived = useCallback((conv: Conversation) =>
    localArchived[conv.id] ?? (conv as any).isArchived ?? false,
  [localArchived]);

  const filtered = useMemo(() => {
    const visible = convs.filter(c => {
      const archived = isConvArchived(c);
      if (showArchived) return archived;
      return !archived;
    });
    if (!searchQuery) return visible;
    return visible.filter(c => {
      const name = getConvName(c);
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [convs, searchQuery, getConvName, showArchived, isConvArchived]);

  // Pinned conversations always float to top
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ap = isConvPinned(a) ? 1 : 0;
      const bp = isConvPinned(b) ? 1 : 0;
      return bp - ap;
    });
  }, [filtered, isConvPinned]);

  const isOnline = useCallback((conv: Conversation) => {
    const o = getOther(conv);
    return o ? onlineUsers.has(o.id) : false;
  }, [getOther, onlineUsers]);

  const hasUnread = useCallback((conv: Conversation) => {
    if (conv.unreadCount != null) return conv.unreadCount > 0;
    if (!conv.lastMessage || conv.lastMessage.senderId === user?.id) return false;
    const ds = conv.lastMessage.deliveryStatus || [];
    return !ds.find(d => d.userId === user?.id)?.readAt;
  }, [user?.id]);

  const isVoice = (msg: Message) =>
    msg.contentType === 'voice' || msg.attachmentType === 'voice' || msg.type === 'voice'
    || msg.content === '[voice_expired]'
    || (msg.content?.includes('cloudinary.com') && msg.content?.includes('/video/upload/') && msg.content?.includes('voice-messages'));

  const isImage = (msg: Message) =>
    msg.contentType === 'image' || msg.attachmentType === 'image' || msg.type === 'image'
    || (msg.content?.includes('cloudinary.com') && msg.content?.includes('/image/upload/') && !msg.content?.includes('voice-messages'));

  /* ══════════════════════════════════════════ render ══════ */
  const other = selectedConv ? getOther(selectedConv) : null;
  const typing = selectedConv ? typingUsers[selectedConv.id] : false;
  const online = other ? onlineUsers.has(other.id) : false;

  // Group messages by date for separators
  const groupedMessages = useMemo(() => {
    return messages.reduce<{ date: string; messages: Message[] }[]>((acc, msg) => {
      const key = format(new Date(msg.createdAt), 'yyyy-MM-dd');
      const last = acc[acc.length - 1];
      if (last && last.date === key) last.messages.push(msg);
      else acc.push({ date: key, messages: [msg] });
      return acc;
    }, []);
  }, [messages]);

  /* ─────────────────────── render: conversation list ──── */
  const renderConvList = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            {showArchived ? '📦 Archived' : 'Messages'}
          </h1>
          <div className="flex gap-1">
            {showArchived ? (
              <Button variant="ghost" size="icon" onClick={() => setShowArchived(false)}
                className="h-8 w-8 text-muted-foreground hover:text-primary" title="Back to chats">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => setShowBroadcastModal(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary" data-testid="button-admin-broadcast">
                    <Megaphone className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowGroupModal(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-primary" title="New group chat" data-testid="button-new-group">
                  <Users className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowNewModal(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-primary" data-testid="button-new-conversation">
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder={showArchived ? "Search archived…" : "Search conversations…"}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-9 bg-muted/50 border border-transparent rounded-lg text-sm focus:outline-none focus:border-border transition-colors"
            data-testid="input-search-conversations"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingConvs ? (
          <div className="p-3 space-y-1">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : sortedFiltered.length > 0 ? (
          sortedFiltered.map(conv => {
            const o = getOther(conv);
            const convName = getConvName(conv);
            const convAvatarUrl = getConvAvatar(conv);
            const isGroup = conv.isGroupChat || conv.isGroup;
            const active = selectedConv?.id === conv.id;
            const unread = hasUnread(conv);
            const tip = typingUsers[conv.id];
            const online2 = isOnline(conv);
            const pinned = isConvPinned(conv);
            const archived = isConvArchived(conv);
            return (
              <div key={conv.id} className="relative group/conv">
                <button
                  onClick={() => openConv(conv)}
                  data-testid={`conversation-${conv.id}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/30 ${active ? 'bg-primary/8' : 'hover:bg-muted/40'}`}>
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                      {convAvatarUrl ? <AvatarImage src={convAvatarUrl} /> : null}
                      <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold">
                        {isGroup ? <Users className="h-5 w-5" /> : (convName?.[0]?.toUpperCase() || <User className="h-4 w-4" />)}
                      </AvatarFallback>
                    </Avatar>
                    {!isGroup && online2 && (
                      <span className="absolute bottom-0 right-0 flex h-3 w-3 ring-2 ring-background rounded-full">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                      </span>
                    )}
                    {pinned && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Pin className="h-2 w-2 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isGroup && <Users className="h-3 w-3 text-primary/60 flex-shrink-0" />}
                        <span className={`text-sm truncate ${unread ? 'font-bold text-foreground' : 'font-semibold text-foreground/85'}`}>
                          {convName}
                        </span>
                      </div>
                      {conv.lastMessage && (
                        <span className={`text-[10px] flex-shrink-0 ${unread ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                          {fmtListTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {tip ? (
                          <span className="text-primary flex items-center gap-1"><PenLine className="h-3 w-3" />Typing…</span>
                        ) : conv.lastMessage ? (
                          <>
                            {conv.lastMessage.senderId === user?.id && <span className="opacity-60">You: </span>}
                            {isVoice(conv.lastMessage) ? '🎤 Voice message'
                              : isImage(conv.lastMessage) ? '📷 Photo'
                              : (conv.lastMessage.content?.slice(0, 40) + (conv.lastMessage.content?.length > 40 ? '…' : ''))}
                          </>
                        ) : <span className="italic opacity-50">No messages yet</span>}
                      </p>
                      {unread && (
                        <span className="flex-shrink-0 flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                          {(conv.unreadCount ?? 0) > 99 ? '99+' : (conv.unreadCount ?? 0) > 0 ? conv.unreadCount : '●'}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Quick context menu (visible on hover) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 border border-border/50 flex items-center justify-center opacity-0 group-hover/conv:opacity-100 transition-opacity shadow-sm z-10"
                      data-testid={`conv-menu-${conv.id}`}>
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => pinMutation.mutate({ convId: conv.id, pin: !pinned })}>
                      {pinned ? <PinOff className="h-3.5 w-3.5 mr-2" /> : <Pin className="h-3.5 w-3.5 mr-2" />}
                      {pinned ? 'Unpin' : 'Pin to top'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => archiveMutation.mutate({ convId: conv.id, archive: !archived })}>
                      {archived ? <ArchiveRestore className="h-3.5 w-3.5 mr-2" /> : <Archive className="h-3.5 w-3.5 mr-2" />}
                      {archived ? 'Unarchive' : 'Archive'}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive"
                      onClick={() => deleteConvMutation.mutate(conv.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              {showArchived ? <Archive className="h-8 w-8 text-muted-foreground" /> : <MessageCircle className="h-8 w-8 text-muted-foreground" />}
            </div>
            <p className="font-medium mb-1">{showArchived ? 'No archived chats' : 'No conversations yet'}</p>
            {!showArchived && (
              <>
                <p className="text-sm text-muted-foreground mb-4">Start a new conversation to connect</p>
                <Button size="sm" onClick={() => setShowNewModal(true)} data-testid="button-start-first-chat">
                  <Plus className="h-4 w-4 mr-1.5" /> New Chat
                </Button>
              </>
            )}
          </div>
        )}

        {/* Archived conversations toggle */}
        {!showArchived && (
          <button onClick={() => setShowArchived(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors border-t"
            data-testid="button-show-archived">
            <Archive className="h-3.5 w-3.5" />
            Archived Chats
            {convs.filter(isConvArchived).length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {convs.filter(isConvArchived).length}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="px-4 py-2.5 border-t flex items-center gap-2 flex-shrink-0">
        {wsStatus === ConnectionStatus.CONNECTED ? (
          <span className="flex items-center gap-1.5 text-xs text-green-500">
            <span className="relative flex h-2 w-2 rounded-full">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-amber-500">
            <motion.span className="block h-2 w-2 rounded-full bg-amber-500"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            {wsStatus === ConnectionStatus.CONNECTING ? 'Connecting…' : 'Offline'}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{sortedFiltered.length} chat{sortedFiltered.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );

  /* ─────────────────────── render: chat area ────────────── */
  const renderChatArea = () => {
    if (!selectedConv) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-muted/5 text-center p-8">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 mx-auto">
              <MessageCircle className="h-12 w-12 text-primary/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Your messages</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">Send private messages to other members of the community</p>
            <Button onClick={() => setShowNewModal(true)} data-testid="button-start-conversation">
              <Plus className="h-4 w-4 mr-2" /> New Conversation
            </Button>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        {(() => {
          const isGroup = selectedConv?.isGroupChat || selectedConv?.isGroup;
          const convName = selectedConv ? getConvName(selectedConv) : '';
          const convAvatar = selectedConv ? getConvAvatar(selectedConv) : undefined;
          const pinned = selectedConv ? isConvPinned(selectedConv) : false;
          return (
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card flex-shrink-0">
              <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-8 w-8"
                onClick={() => { setMobileChat(false); setSelectedConv(null); }} data-testid="button-back-to-list">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="relative flex-shrink-0">
                <Avatar className="h-10 w-10">
                  {convAvatar ? <AvatarImage src={convAvatar} /> : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold text-sm">
                    {isGroup ? <Users className="h-5 w-5" /> : (convName?.[0]?.toUpperCase() || <User className="h-4 w-4" />)}
                  </AvatarFallback>
                </Avatar>
                {!isGroup && online && (
                  <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5 ring-2 ring-background rounded-full">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{convName}</h3>
                  {pinned && <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                  {!isGroup && other?.role === 'admin' && (
                    <span className="text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" /> Admin
                    </span>
                  )}
                  <span className="text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="End-to-end encrypted">
                    <Lock className="h-2.5 w-2.5" /> E2E
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isGroup
                    ? `${selectedConv?.participants?.length || 0} members`
                    : typing
                      ? <motion.span className="text-primary" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1, repeat: Infinity }}>Typing…</motion.span>
                      : online ? <span className="text-green-500">Online</span> : 'Offline'}
                </p>
              </div>
              {/* Call buttons — only for DMs */}
              {!isGroup && (
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors"
                    title="Voice call"
                    data-testid="button-voice-call"
                    onClick={() => other && webRTC.startCall(other.id, other.displayName, other.profilePicture, "voice")}
                    disabled={webRTC.callState !== "idle"}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                    title="Video call"
                    data-testid="button-video-call"
                    onClick={() => other && webRTC.startCall(other.id, other.displayName, other.profilePicture, "video")}
                    disabled={webRTC.callState !== "idle"}
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid="button-chat-menu">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isGroup && (
                    <DropdownMenuItem onClick={() => setShowGroupInfo(true)} data-testid="button-group-info">
                      <Info className="h-4 w-4 mr-2" /> Group Info
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setShowMediaGallery(true)} data-testid="button-view-media">
                    <ImagePlus className="h-4 w-4 mr-2" /> View Media
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectedConv && pinMutation.mutate({ convId: selectedConv.id, pin: !pinned })}>
                    {pinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                    {pinned ? 'Unpin' : 'Pin Chat'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectedConv && archiveMutation.mutate({ convId: selectedConv.id, archive: true })}>
                    <Archive className="h-4 w-4 mr-2" /> Archive Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive text-sm"
                    onClick={() => selectedConv && deleteConvMutation.mutate(selectedConv.id)}
                    disabled={deleteConvMutation.isPending} data-testid="button-delete-conversation">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteConvMutation.isPending ? 'Deleting…' : 'Delete Conversation'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })()}

        {/* Offline banner */}
        {wsStatus !== ConnectionStatus.CONNECTED && (
          <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex-shrink-0">
            <motion.span className="h-1.5 w-1.5 rounded-full bg-amber-500"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            {wsStatus === ConnectionStatus.CONNECTING ? 'Connecting live chat…' : 'Offline — you can still send messages'}
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/3 via-background to-background"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          onClick={() => { setShowEmojiPicker(false); setReactionPickerFor(null); }}
        >
          {loadingMsgs ? (
            <div className="space-y-4 pt-4">
              {[1,2,3].map(i => (
                <div key={i} className={`flex ${i % 2 ? 'justify-start' : 'justify-end'}`}>
                  <Skeleton className="h-10 w-40 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No messages yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Say hello to start the conversation</p>
            </div>
          ) : (
            <>
              {groupedMessages.map(({ date, messages: dayMsgs }) => (
                <div key={date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[11px] text-muted-foreground font-medium px-2">{fmtDateSep(dayMsgs[0].createdAt)}</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  {dayMsgs.map((msg, idx) => {
                    const isOwn = msg.senderId === user?.id;
                    const prev = dayMsgs[idx - 1];
                    const next = dayMsgs[idx + 1];
                    const isFirst = !prev || prev.senderId !== msg.senderId;
                    const isLast = !next || next.senderId !== msg.senderId;
                    const status = isOwn ? getMessageStatus(msg, user!.id) : 'sent';
                    const voice = isVoice(msg);
                    const image = isImage(msg);
                    const msgReactions = reactions[msg.id] || {};

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isFirst ? 'mt-3' : 'mt-0.5'} group relative`}
                        data-testid={`message-${msg.id}`}
                        onMouseEnter={() => setHoveredMsg(msg.id)}
                        onMouseLeave={() => setHoveredMsg(null)}
                      >
                        {!isOwn && (
                          <div className="flex-shrink-0 w-7 self-end">
                            {isLast && (
                              <Avatar className="h-7 w-7">
                                {other?.profilePicture ? <AvatarImage src={other.profilePicture} /> : null}
                                <AvatarFallback className="text-[10px] bg-muted">{other?.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}

                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%] ${status === 'sending' ? 'opacity-70' : 'opacity-100'} transition-opacity`}>
                          {/* Reply quote */}
                          {msg.replyToId && msg.replyToContent && (
                            <div className={`text-[10px] px-2 py-1 mb-0.5 rounded-lg border-l-2 opacity-70 max-w-full truncate ${
                              isOwn ? 'bg-primary/20 border-primary/50 text-primary-foreground' : 'bg-muted border-border text-muted-foreground'
                            }`}>
                              <span className="font-medium">{msg.replyToSenderName || 'Reply'}: </span>
                              {msg.replyToContent.slice(0, 60)}{msg.replyToContent.length > 60 ? '…' : ''}
                            </div>
                          )}

                          {/* Forwarded indicator */}
                          {msg.isForwarded && (
                            <div className={`flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <Forward className="h-2.5 w-2.5" /> Forwarded
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={`
                            px-3 py-2 rounded-2xl text-sm break-words relative
                            ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border/50 text-foreground rounded-bl-sm shadow-sm'}
                            ${voice ? 'py-2.5' : ''} ${image ? 'p-1.5' : ''}
                          `}>
                            {voice ? <VoicePlayer url={msg.content} isOwn={isOwn} />
                              : image ? <InlineImage url={msg.content} />
                              : <p className="whitespace-pre-wrap leading-relaxed">{linkify(msg.content)}</p>}
                            {/* Starred badge */}
                            {starredMsgIds.has(msg.id) && (
                              <span className="absolute -top-1.5 -right-1.5 text-amber-400 text-[10px]">⭐</span>
                            )}
                          </div>

                          {/* Time + status */}
                          {isLast && (
                            <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                              <span className="text-[10px] text-muted-foreground">{fmtMsgTime(msg.createdAt)}</span>
                              {isOwn && <StatusIcon status={status} />}
                            </div>
                          )}

                          {/* Reactions */}
                          {Object.keys(msgReactions).length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              {Object.entries(msgReactions).map(([em, users]) => (
                                <button key={em} onClick={() => toggleReaction(msg.id, em)}
                                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                    users.includes(user!.id) ? 'bg-primary/15 border-primary/30' : 'bg-muted border-border hover:bg-muted/80'
                                  }`}>
                                  {em} <span className="text-[10px] font-medium">{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Hover actions */}
                        {hoveredMsg === msg.id && msg.id > 0 && (
                          <div className={`absolute top-0 ${isOwn ? 'right-full mr-1' : 'left-full ml-1'} flex items-center gap-0.5 z-10`}>
                            <button
                              onClick={() => { setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 50); }}
                              className="h-6 w-6 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center" title="Reply">
                              <Reply className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id); }}
                              className="h-6 w-6 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center" title="React">
                              <Smile className="h-3 w-3 text-muted-foreground" />
                            </button>
                            {/* More options */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-6 w-6 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center" title="More">
                                  <MoreVertical className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-44">
                                <DropdownMenuItem onClick={() => { setReplyTo(msg); setTimeout(() => textareaRef.current?.focus(), 50); }}>
                                  <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const starred = starredMsgIds.has(msg.id);
                                  toggleStarMutation.mutate({ msgId: msg.id, star: !starred, convId: selectedConv!.id });
                                }}>
                                  <Star className={`h-3.5 w-3.5 mr-2 ${starredMsgIds.has(msg.id) ? 'fill-amber-400 text-amber-400' : ''}`} />
                                  {starredMsgIds.has(msg.id) ? 'Unstar' : 'Star'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setForwardMsg(msg)}>
                                  <Forward className="h-3.5 w-3.5 mr-2" /> Forward
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  navigator.clipboard.writeText(msg.content || '').then(() => toast({ title: "Copied!" }));
                                }}>
                                  <Copy className="h-3.5 w-3.5 mr-2" /> Copy
                                </DropdownMenuItem>
                                {isOwn && (
                                  <DropdownMenuItem className="text-destructive" onClick={() =>
                                    deleteMsgMutation.mutate({ msgId: msg.id, convId: selectedConv!.id, forEveryone: true })
                                  }>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        {/* Reaction picker */}
                        {reactionPickerFor === msg.id && (
                          <div
                            className={`absolute top-6 z-20 flex gap-1 bg-card border border-border rounded-2xl px-2 py-1.5 shadow-lg ${isOwn ? 'right-0' : 'left-7'}`}
                            onClick={e => e.stopPropagation()}>
                            {REACTION_EMOJIS.map(em => (
                              <button key={em} onClick={() => toggleReaction(msg.id, em)}
                                className="text-base hover:scale-125 transition-transform active:scale-110">{em}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Typing indicator */}
          {typing && (
            <div className="flex items-end gap-2 mt-3">
              <Avatar className="h-7 w-7 flex-shrink-0">
                {other?.profilePicture ? <AvatarImage src={other.profilePicture} /> : null}
                <AvatarFallback className="text-[10px] bg-muted">{other?.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-4">
                  {[0,1,2].map(i => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                      animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* AI Assistant Panel */}
        <AnimatePresence>
          {showAiPanel && (
            <motion.div
              key="ai-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 280, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-t bg-muted/30 flex-shrink-0 overflow-hidden flex flex-col"
            >
              {/* AI panel header */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-background/80">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">AI Assistant</span>
                  <span className="text-[10px] text-muted-foreground">— GPT-4o mini</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {aiHistory.length > 0 && (
                    <button
                      onClick={() => setAiHistory([])}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
                      data-testid="button-clear-ai-history"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => setShowAiPanel(false)}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-close-ai-panel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* AI messages */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {aiHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <Bot className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Ask me anything about Urban Culture Hub, events, or just chat!</p>
                  </div>
                ) : (
                  aiHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/50 text-foreground rounded-bl-sm shadow-sm"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                {aiMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border/50 px-3 py-2 rounded-xl rounded-bl-sm shadow-sm">
                      <motion.div
                        className="flex gap-1 items-center"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </motion.div>
                    </div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>

              {/* AI input */}
              <div className="px-3 py-2 border-t bg-background/80 flex items-end gap-2">
                <textarea
                  ref={aiInputRef}
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); }
                  }}
                  placeholder="Ask the AI assistant…"
                  rows={1}
                  className="flex-1 bg-muted/50 rounded-xl px-3 py-1.5 text-xs border border-transparent focus:border-primary/30 focus:outline-none resize-none max-h-[60px] leading-relaxed"
                  data-testid="input-ai-message"
                />
                <Button
                  size="icon"
                  className="h-7 w-7 rounded-full flex-shrink-0"
                  onClick={sendAiMessage}
                  disabled={!aiInput.trim() || aiMutation.isPending}
                  data-testid="button-send-ai-message"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="border-t bg-card flex-shrink-0" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
          {/* Emoji picker */}
          {showEmojiPicker && (
            <div className="border-b bg-card p-3" onClick={e => e.stopPropagation()}>
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_GRID.map(em => (
                  <button key={em}
                    onMouseDown={e => { e.preventDefault(); setMsgText(t => t + em); }} // mouseDown fires before blur
                    className="text-lg hover:scale-125 transition-transform active:scale-110 py-0.5 rounded hover:bg-muted">
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply strip */}
          {replyTo && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
              <Reply className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-primary">
                  Replying to {replyTo.senderId === user?.id ? 'yourself' : (other?.displayName || 'message')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content.slice(0, 60)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="flex-shrink-0 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="px-2 py-2 sm:px-3">
            {recording ? (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive flex-shrink-0" onClick={cancelRecording}><X className="h-4 w-4" /></Button>
                <div className="flex-1 flex items-center gap-2 bg-red-50 dark:bg-red-950/20 rounded-full px-4 py-2">
                  <motion.span className="flex h-2 w-2 rounded-full bg-red-500 flex-shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">Recording</span>
                  <span className="ml-auto text-sm font-mono text-muted-foreground">{recordingSeconds}s</span>
                  <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                    <motion.div className="h-full bg-red-500 rounded-full" animate={{ width: `${(recordingSeconds / MAX_RECORDING) * 100}%` }} transition={{ duration: 0.1 }} />
                  </div>
                </div>
                <Button size="sm" className="rounded-full h-9 px-4 bg-primary flex-shrink-0" onClick={stopRecording}>
                  <Check className="h-4 w-4 mr-1" /> Done
                </Button>
              </div>
            ) : audioPreviewUrl ? (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground flex-shrink-0" onClick={cancelRecording}><X className="h-4 w-4" /></Button>
                <div className="flex-1 bg-muted/50 rounded-2xl px-3 py-2"><VoicePlayer url={audioPreviewUrl} isOwn={false} /></div>
                <Button size="icon" className="h-9 w-9 rounded-full bg-primary flex-shrink-0"
                  onClick={sendVoiceMessage} disabled={uploadAudioMutation.isPending} data-testid="button-send-voice">
                  {uploadAudioMutation.isPending
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Clock className="h-4 w-4" /></motion.div>
                    : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2 w-full">
                {/* Left: attach button */}
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageFileChange} />
                <button onClick={handleImagePick} disabled={uploadingImage}
                  className="h-11 w-11 min-w-[44px] rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors flex-shrink-0"
                  data-testid="button-attach-image" title="Attach image">
                  {uploadingImage
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Clock className="h-5 w-5" /></motion.div>
                    : <ImageIcon className="h-5 w-5" />}
                </button>

                {/* Center: input pill — emoji inside, flex-1 but constrained */}
                <div className="flex-1 min-w-0 flex flex-col bg-muted/60 rounded-3xl border border-transparent focus-within:border-primary/30 transition-colors">
                  <div className="flex items-end px-3 py-2 gap-1 min-h-[44px]">
                    <textarea
                      ref={textareaRef}
                      value={msgText}
                      onChange={handleTextareaChange}
                      onKeyDown={handleTextareaKeyDown}
                      onPaste={async e => {
                        const items = Array.from(e.clipboardData?.items || []);
                        const imgItem = items.find(i => i.type.startsWith('image/'));
                        if (imgItem) {
                          e.preventDefault();
                          const file = imgItem.getAsFile();
                          if (file) await handleImageFileChange({ target: { files: [file] } } as any);
                        }
                      }}
                      placeholder="Message…"
                      rows={1}
                      className="flex-1 min-w-0 border-0 bg-transparent p-0 focus:outline-none text-[15px] resize-none max-h-[120px] leading-[1.4] self-center"
                      style={{ height: 'auto', overflowY: 'hidden' }}
                      data-testid="input-message"
                    />
                    {/* Emoji + AI inside pill */}
                    <div className="flex gap-0.5 flex-shrink-0 self-end">
                      <button
                        onMouseDown={e => { e.preventDefault(); setShowEmojiPicker(p => !p); }}
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${showEmojiPicker ? 'text-primary' : 'text-muted-foreground'}`}
                        data-testid="button-emoji-picker" title="Emoji">
                        <Smile className="h-5 w-5" />
                      </button>
                      <button
                        onMouseDown={e => { e.preventDefault(); setShowAiPanel(p => !p); }}
                        className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${showAiPanel ? 'text-primary' : 'text-muted-foreground'}`}
                        data-testid="button-ai-assistant" title="AI Assistant">
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {msgText.length > 500 && (
                    <div className={`text-right text-[10px] px-3 pb-1 ${msgText.length > 1000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {msgText.length}/1000
                    </div>
                  )}
                </div>

                {/* Right: mic AND send — both always in DOM, toggled by visibility */}
                <div className="flex-shrink-0 relative h-11 w-11 min-w-[44px]">
                  {/* Mic button — visible when no text */}
                  <button
                    onClick={startRecording}
                    data-testid="button-record-voice"
                    title="Record voice message"
                    className={`absolute inset-0 h-11 w-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md transition-all duration-150 ${msgText.trim() ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                  {/* Send button — visible when has text */}
                  <button
                    onClick={handleSend}
                    disabled={sendMsgMutation.isPending}
                    data-testid="button-send-message"
                    className={`absolute inset-0 h-11 w-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md transition-all duration-150 ${msgText.trim() ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
                  >
                    {sendMsgMutation.isPending
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Clock className="h-4 w-4" /></motion.div>
                      : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── New conversation modal ── */
  const renderNewModal = () => (
    <NewConversationModal
      open={showNewModal}
      onClose={() => setShowNewModal(false)}
      onConvCreated={conv => {
        setShowNewModal(false);
        refetchConvs();
        setTimeout(() => openConv(conv), 200);
      }}
    />
  );

  /* ── Group chat creation modal ── */
  const [groupName, setGroupName] = useState("");
  const [groupParticipants, setGroupParticipants] = useState<number[]>([]);
  const { data: allUsers } = useQuery<UserInfo[]>({ queryKey: ['/api/users'] });

  const createGroupMutation = useMutation({
    mutationFn: (data: { title: string; participantIds: number[] }) =>
      apiRequest({ url: '/api/chat/conversations', method: 'POST', data: { ...data, isGroup: true } }),
    onSuccess: (conv: Conversation) => {
      setShowGroupModal(false);
      setGroupName("");
      setGroupParticipants([]);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setTimeout(() => openConv(conv), 200);
    },
    onError: () => toast({ title: "Failed to create group", variant: "destructive" })
  });

  const renderGroupModal = () => (
    <AnimatePresence>
      {showGroupModal && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowGroupModal(false)}>
          <motion.div className="bg-card rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-base flex items-center gap-2"><Users className="h-4 w-4" /> New Group Chat</h2>
              <button onClick={() => setShowGroupModal(false)} className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 border-b">
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Group name…"
                className="w-full h-9 px-3 bg-muted/50 rounded-lg text-sm border border-transparent focus:outline-none focus:border-primary/30"
                data-testid="input-group-name"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs text-muted-foreground px-2 mb-2 font-medium">Select members</p>
              {(allUsers || []).filter(u => u.id !== user?.id).map(u => {
                const sel = groupParticipants.includes(u.id);
                return (
                  <button key={u.id}
                    onClick={() => setGroupParticipants(p => sel ? p.filter(id => id !== u.id) : [...p, u.id])}
                    data-testid={`group-member-${u.id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${sel ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                    <Avatar className="h-9 w-9">
                      {u.profilePicture ? <AvatarImage src={u.profilePicture} /> : null}
                      <AvatarFallback className="text-xs">{u.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium text-left">{u.displayName}</span>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                      {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t">
              <Button className="w-full" disabled={!groupName.trim() || groupParticipants.length < 1 || createGroupMutation.isPending}
                onClick={() => createGroupMutation.mutate({ title: groupName.trim(), participantIds: groupParticipants })}
                data-testid="button-create-group">
                {createGroupMutation.isPending ? 'Creating…' : `Create Group (${groupParticipants.length} member${groupParticipants.length !== 1 ? 's' : ''})`}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ── Forward message modal ── */
  const renderForwardModal = () => (
    <AnimatePresence>
      {forwardMsg && (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setForwardMsg(null)}>
          <motion.div className="bg-card rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[70vh]"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-base flex items-center gap-2"><Forward className="h-4 w-4" /> Forward Message</h2>
              <button onClick={() => setForwardMsg(null)} className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground truncate">
              "{forwardMsg.content?.slice(0, 80)}{(forwardMsg.content?.length || 0) > 80 ? '…' : ''}"
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <p className="text-xs text-muted-foreground px-2 mb-2 font-medium">Forward to…</p>
              {convs.filter(c => c.id !== selectedConv?.id).map(c => {
                const o = getOther(c);
                const name = getConvName(c);
                const isGroup = c.isGroupChat || c.isGroup;
                return (
                  <button key={c.id}
                    onClick={() => forwardMsgMutation.mutate({ msgId: forwardMsg.id, targetConvId: c.id })}
                    disabled={forwardMsgMutation.isPending}
                    data-testid={`forward-to-${c.id}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9">
                      {isGroup ? null : (o?.profilePicture ? <AvatarImage src={o.profilePicture} /> : null)}
                      <AvatarFallback className="text-xs">
                        {isGroup ? <Users className="h-4 w-4" /> : name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium text-left">{name}</span>
                    <Forward className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ── Media gallery panel ── */
  const renderMediaGallery = () => (
    <AnimatePresence>
      {showMediaGallery && selectedConv && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowMediaGallery(false)}
        >
          <motion.div
            className="bg-card rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col"
            style={{ maxHeight: '80dvh' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-primary" />
                Shared Media
              </h2>
              <button onClick={() => setShowMediaGallery(false)}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMedia ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6].map(i => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : mediaItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium mb-1">No shared media yet</p>
                  <p className="text-xs text-muted-foreground">Photos and voice messages will appear here</p>
                </div>
              ) : (
                <>
                  {/* Images */}
                  {mediaItems.filter(m => m.content_type === 'image' || m.type === 'image').length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5" /> Photos
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {mediaItems.filter(m => m.content_type === 'image' || m.type === 'image').map(m => (
                          <div key={m.id} className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(m.content, '_blank')}>
                            <img src={m.content} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Voice messages */}
                  {mediaItems.filter(m => m.content_type === 'voice' || m.type === 'voice').length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Headphones className="h-3.5 w-3.5" /> Voice Messages
                      </p>
                      <div className="space-y-2">
                        {mediaItems.filter(m => m.content_type === 'voice' || m.type === 'voice').map(m => (
                          <div key={m.id} className="bg-muted/50 rounded-xl px-3 py-2">
                            <VoicePlayer url={m.content} isOwn={m.sender_id === user?.id} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ── Group info panel ── */
  const renderGroupInfo = () => (
    <AnimatePresence>
      {showGroupInfo && selectedConv && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowGroupInfo(false)}
        >
          <motion.div
            className="bg-card rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col"
            style={{ maxHeight: '80dvh' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Group Info
              </h2>
              <button onClick={() => setShowGroupInfo(false)}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Group name + avatar */}
            <div className="flex flex-col items-center py-6 px-5 border-b flex-shrink-0">
              <Avatar className="h-20 w-20 mb-3">
                {selectedConv.groupAvatarUrl ? <AvatarImage src={selectedConv.groupAvatarUrl} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary">
                  <Users className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-lg">{getConvName(selectedConv)}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedConv.participants?.length || 0} members
              </p>
            </div>

            {/* Members list */}
            <div className="flex-1 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-5 pt-4 pb-2">Members</p>
              {(selectedConv.participants || []).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar className="h-10 w-10">
                    {p.profilePicture ? <AvatarImage src={p.profilePicture} /> : null}
                    <AvatarFallback className="text-sm">{p.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.displayName}</p>
                    {p.id === user?.id && (
                      <p className="text-xs text-muted-foreground">You</p>
                    )}
                  </div>
                  {p.id === selectedConv.createdBy && (
                    <span className="text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="h-2.5 w-2.5" /> Admin
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t flex-shrink-0 space-y-2">
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => leaveGroupMutation.mutate(selectedConv.id)}
                disabled={leaveGroupMutation.isPending}
                data-testid="button-leave-group"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {leaveGroupMutation.isPending ? 'Leaving…' : 'Leave Group'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  /* ═══════════════════════════════════ layout ═══ */
  return (
    <AuthWrapper>
      {/* ── Incoming Call Dialog ── */}
      <AnimatePresence>
        {webRTC.incomingCall && (
          <motion.div
            key="incoming-call"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl p-8 w-80 text-center shadow-2xl border border-white/10"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Animated rings */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden">
                {[1, 2, 3].map(i => (
                  <motion.div key={i}
                    className="absolute inset-0 rounded-3xl border-2 border-green-400/30"
                    animate={{ scale: [1, 1.1 + i * 0.06], opacity: [0.6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
                  />
                ))}
              </div>

              <div className="relative">
                <div className="flex items-center justify-center mb-2">
                  <div className="text-xs font-medium uppercase tracking-widest text-green-400 flex items-center gap-1.5">
                    {webRTC.incomingCall.callType === "video" ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                    Incoming {webRTC.incomingCall.callType} call
                  </div>
                </div>
                <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-green-500/40 ring-offset-2 ring-offset-gray-900">
                  {webRTC.incomingCall.fromAvatar ? <AvatarImage src={webRTC.incomingCall.fromAvatar} /> : null}
                  <AvatarFallback className="text-2xl bg-gray-700 text-white">
                    {webRTC.incomingCall.fromDisplayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-white text-lg font-bold mb-1">{webRTC.incomingCall.fromDisplayName}</p>
                <p className="text-gray-400 text-sm mb-8">is calling you</p>
                <div className="flex justify-center gap-8">
                  <button
                    onClick={() => webRTC.rejectCall(webRTC.incomingCall!)}
                    className="flex flex-col items-center gap-2 group"
                    data-testid="button-reject-call"
                  >
                    <div className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/30">
                      <PhoneOff className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-200">Decline</span>
                  </button>
                  <button
                    onClick={() => webRTC.answerCall(webRTC.incomingCall!)}
                    className="flex flex-col items-center gap-2 group"
                    data-testid="button-accept-call"
                  >
                    <div className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg shadow-green-500/30">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-200">Accept</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── In-Call Overlay ── */}
      <AnimatePresence>
        {(webRTC.callState === "calling" || webRTC.callState === "connected") && (
          <motion.div
            key="in-call"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed inset-0 z-[90] flex flex-col bg-gradient-to-b from-gray-900 via-gray-950 to-black"
          >
            {/* Remote audio is now globally mounted in CallProvider (always in DOM) */}

            {/* Remote video (full screen background) */}
            <div className="absolute inset-0">
              {webRTC.callType === "video" && (
                <video
                  ref={webRTC.remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
              )}
              {webRTC.callType !== "video" && (
                <div className="w-full h-full flex items-center justify-center">
                  <motion.div
                    className="w-64 h-64 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>

            {/* Local video (picture-in-picture) */}
            {webRTC.callType === "video" && (
              <div className="absolute top-16 right-4 w-28 h-40 rounded-2xl overflow-hidden bg-gray-800 border-2 border-white/20 shadow-xl z-10">
                <video ref={webRTC.localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                {webRTC.isCameraOff && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <VideoOff className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
            )}

            {/* Top info bar */}
            <div className="relative z-20 pt-12 pb-4 px-6 flex flex-col items-center">
              <Avatar className="h-20 w-20 ring-2 ring-white/20 ring-offset-2 ring-offset-gray-900 mb-3">
                {webRTC.remoteAvatar ? <AvatarImage src={webRTC.remoteAvatar} /> : null}
                <AvatarFallback className="text-2xl bg-gray-700 text-white">
                  {webRTC.remoteDisplayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-white text-xl font-bold">{webRTC.remoteDisplayName}</h2>
              <div className="mt-1 text-sm">
                {webRTC.callState === "calling" ? (
                  <motion.p
                    className="text-green-400 font-medium"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Calling…
                  </motion.p>
                ) : (
                  <p className="text-white/70 font-mono text-lg">{formatDuration(webRTC.callDuration)}</p>
                )}
              </div>
            </div>

            {/* Bottom controls */}
            <div className="relative z-20 mt-auto px-8 pb-16">
              <div className="flex items-center justify-center gap-6">
                {/* Mute */}
                <button
                  onClick={webRTC.toggleMute}
                  className={`flex flex-col items-center gap-2 group`}
                  data-testid="button-toggle-mute"
                >
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${webRTC.isMuted ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                    {webRTC.isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </div>
                  <span className="text-xs text-white/50">{webRTC.isMuted ? "Unmute" : "Mute"}</span>
                </button>

                {/* Hang Up */}
                <button
                  onClick={webRTC.hangUp}
                  className="flex flex-col items-center gap-2"
                  data-testid="button-hang-up"
                >
                  <div className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-xl shadow-red-500/40">
                    <PhoneOff className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-xs text-white/50">End</span>
                </button>

                {/* Camera toggle (video only) */}
                {webRTC.callType === "video" ? (
                  <button
                    onClick={webRTC.toggleCamera}
                    className="flex flex-col items-center gap-2"
                    data-testid="button-toggle-camera"
                  >
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${webRTC.isCameraOff ? 'bg-white text-gray-900' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                      {webRTC.isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                    </div>
                    <span className="text-xs text-white/50">{webRTC.isCameraOff ? "Camera On" : "Camera Off"}</span>
                  </button>
                ) : (
                  <button
                    onClick={webRTC.toggleSpeaker}
                    className="flex flex-col items-center gap-2"
                    data-testid="button-toggle-speaker"
                  >
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${webRTC.isSpeakerOn ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white text-gray-900'}`}>
                      {webRTC.isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                    </div>
                    <span className="text-xs text-white/50">Speaker</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call Ended Toast (ended state) ── */}
      <AnimatePresence>
        {webRTC.callState === "ended" && (
          <motion.div
            key="call-ended"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-gray-900 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-xl"
          >
            <PhoneMissed className="h-4 w-4 text-red-400" />
            Call ended
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[calc(100dvh-3.5rem-60px)] md:h-[calc(100dvh-4rem)] flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${mobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r flex-shrink-0`}>
          {renderConvList()}
        </div>
        {/* Chat area */}
        <div className={`${mobileChat ? 'flex' : 'hidden md:flex'} flex-col flex-1 overflow-hidden`}>
          {renderChatArea()}
        </div>
      </div>

      {renderNewModal()}
      {renderGroupModal()}
      {renderForwardModal()}
      {renderMediaGallery()}
      {renderGroupInfo()}

      {showBroadcastModal && isAdmin && (
        <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-amber-500" /> Admin Broadcast
              </DialogTitle>
              <DialogDescription>Send a message to all users on the platform.</DialogDescription>
            </DialogHeader>
            <BroadcastForm onClose={() => setShowBroadcastModal(false)} />
          </DialogContent>
        </Dialog>
      )}
    </AuthWrapper>
  );
}

/* ─── New conversation modal (stable top-level component) ── */
function NewConversationModal({ open, onClose, onConvCreated }: {
  open: boolean;
  onClose: () => void;
  onConvCreated: (conv: any) => void;
}) {
  const { toast } = useToast();
  const [searchUsers, setSearchUsers] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: allContacts = [], isLoading: loadingContacts } = useQuery<any[]>({
    queryKey: ['/api/chat/contacts'],
    queryFn: async () => {
      const { auth } = await import("@/firebase/firebase");
      const headers: Record<string, string> = {};
      if (auth.currentUser) { try { headers["Authorization"] = `Bearer ${await auth.currentUser.getIdToken()}`; } catch {} }
      const res = await fetch('/api/chat/contacts', { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: open,
  });

  const { data: searchResults = [], isLoading: searching } = useQuery<any[]>({
    queryKey: ['/api/chat/users/search', searchUsers],
    queryFn: async () => {
      const { auth } = await import("@/firebase/firebase");
      const headers: Record<string, string> = {};
      if (auth.currentUser) { try { headers["Authorization"] = `Bearer ${await auth.currentUser.getIdToken()}`; } catch {} }
      const res = await fetch(`/api/chat/users/search?q=${encodeURIComponent(searchUsers)}`, { credentials: 'include', headers });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: searchUsers.length >= 2,
  });

  const users = searchUsers.length >= 2 ? searchResults : allContacts;
  const loading = searchUsers.length >= 2 ? searching : loadingContacts;

  const createConvMutation = useMutation({
    mutationFn: (userId: number) => apiRequest({ url: '/api/chat/conversations', method: 'POST', data: { participants: [userId] } }),
    onSuccess: (res: any) => {
      const conv = res?.data || res;
      onConvCreated(conv);
      toast({ title: "Conversation started!" });
    },
    onError: () => toast({ title: "Failed to create conversation", variant: "destructive" })
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Find someone to message</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input placeholder="Search by name…" value={searchUsers} onChange={e => setSearchUsers(e.target.value)}
              className="w-full pl-9 pr-3 h-10 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              data-testid="input-search-users" />
          </div>
          <div className="max-h-[280px] overflow-y-auto space-y-0.5">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            ) : users.length > 0 ? users.map(u => (
              <button key={u.id} onClick={() => setSelectedUser(u)} data-testid={`user-option-${u.id}`}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${selectedUser?.id === u.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`}>
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {u.profilePicture ? <AvatarImage src={u.profilePicture} /> : null}
                  <AvatarFallback className="text-sm">{u.displayName?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{u.displayName}</p>
                  {u.role && <p className="text-xs text-muted-foreground capitalize">{u.role}</p>}
                </div>
                {selectedUser?.id === u.id && <Check className="ml-auto h-4 w-4 text-primary" />}
              </button>
            )) : (
              <p className="text-center text-sm text-muted-foreground py-6">
                {searchUsers.length >= 2 ? 'No users found' : 'Search to find someone'}
              </p>
            )}
          </div>
          {selectedUser && (
            <Button className="w-full" onClick={() => createConvMutation.mutate(selectedUser.id)}
              disabled={createConvMutation.isPending} data-testid="button-start-chat">
              {createConvMutation.isPending ? 'Starting…' : `Message ${selectedUser.displayName}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const res = await apiRequest({ url: '/api/admin/broadcast', method: 'POST', data: { message: msg.trim() } });
      if ((res as any).ok || (res as any).status < 400) { toast({ title: "Broadcast sent!" }); onClose(); }
      else throw new Error();
    } catch {
      toast({ title: "Failed to send broadcast", variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <textarea value={msg} onChange={e => setMsg(e.target.value)}
        placeholder="Type your broadcast message…" rows={4}
        className="w-full rounded-lg border border-border bg-muted/30 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
        data-testid="input-broadcast-message" />
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={send} disabled={!msg.trim() || sending} data-testid="button-send-broadcast">
          {sending ? 'Sending…' : <><Megaphone className="h-4 w-4 mr-2" />Broadcast</>}
        </Button>
      </div>
    </div>
  );
}
