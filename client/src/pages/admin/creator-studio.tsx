import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { useLocation } from "wouter";
import {
  Film, Upload, Scissors, Type, Sparkles, Gauge, SlidersHorizontal,
  Wand2, Plus, Trash2, VolumeX, Volume2, RotateCcw, Zap,
  Music, Smile, Palette, Layers, Play, Pause, Square, Sun, Droplets,
  Wind, FlipHorizontal2, Mic, Clapperboard, Layers3, Music2, Bot,
  Send, ChevronDown, ChevronUp, TrendingUp, BarChart2, Hash, Share2, Paintbrush,
  Shuffle, Copy, Check, Star, Target, Bookmark, AlignLeft,
  Calendar, Clock, Globe, CheckCircle2, ChevronLeft, ChevronRight,
  ListChecks, Archive, BarChart3, Crown, Smartphone, Monitor, Lock,
  RefreshCw, Download, Eye, Heart, PlusCircle, X, Image, Cpu,
  Radio, Layers2, GitBranch, Database, Bell, SkipBack, SkipForward,
  MapPin, Search, Maximize2, MessageSquare, Drum, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { uploadVideoToCloudinary, FULL_HD_TRANSFORM } from "@/lib/cloudinaryUpload";

// ── Types ────────────────────────────────────────────────────────────────────
type AdminStep = "pick" | "edit" | "caption" | "uploading" | "done";
type EditTab = "templates"|"motion"|"export"|"viral"|"transitions"|"brand"|"trim"|"filters"|"adjust"|"speed"|"audio"|"sounds"|"text"|"stickers"|"aitools"|"schedule"|"batch"|"library"|"analytics"|"captions"|"smartedit";
type AspectRatio = "9:16"|"1:1"|"4:5"|"16:9";
type TextAnimation = "none"|"slide-up"|"bounce"|"fade"|"typewriter"|"glitch"|"zoom-in"|"neon-pulse"|"shake"|"blur-in";
type TextFont = "default"|"bold"|"handwriting"|"mono";
type CaptionStyle = "bold"|"minimal"|"neon"|"subtitle"|"karaoke"|"outline";
type ExportQuality = "4k"|"1080p"|"720p"|"480p";
type ExportFormat = "mp4"|"webm"|"mov";
type MapVisualStyle = "cinematic"|"cartoon"|"neon"|"3d-route"|"social";
type MapVehicle = "plane"|"car"|"train"|"ship";

// ── AI Smart Editor analysis types ───────────────────────────────────────────
interface SmartClipSuggestion {
  clipIndex: number;
  action: "keep" | "trim" | "cut";
  newTrimStart?: number;
  newTrimEnd?: number;
  reason: string;
  issue?: string;
  confidence: number;
}
interface SmartTextSuggestion {
  action: "add" | "remove";
  layerId?: number | null;
  text?: string;
  startTime?: number;
  endTime?: number;
  position?: "top" | "center" | "bottom";
  reason: string;
}
interface SmartEditAnalysis {
  summary: string;
  hookScore: number;
  hookIssue?: string | null;
  paceScore: number;
  overallReadiness: number;
  readinessIssues: string[];
  transitionRecommendation: string;
  clipAnalysis: SmartClipSuggestion[];
  globalSuggestions: string[];
  textSuggestions: SmartTextSuggestion[];
}

interface TextLayer { id: number; text: string; color: string; size: number; position: "top"|"center"|"bottom"; animation: TextAnimation; font: TextFont; fromTemplate?: boolean; fromMotion?: string; x?: number; y?: number; startTime?: number; endTime?: number; }
interface StickerLayer { id: number; emoji: string; x: number; y: number; size: number; }
interface AiMessage { role: "user"|"assistant"; content: string; }
interface BatchItem { id: string; file: File; previewUrl: string; caption: string; status: "queued"|"uploading"|"done"|"error"; }
interface SavedCaption { id: string; title: string; caption: string; tags: string; platform: string; createdAt: string; }
interface ClipItem { id: string; url: string; name: string; duration: number; trimStart: number; trimEnd: number; }
interface MapWaypointItem { id: string; city: string; lat: number; lon: number; flag: string; country: string; }
interface EffectRegion { id: string; type: "template"|"motion"|"overlay"; effectId: string; label: string; emoji: string; color: string; startTime: number; endTime: number; posX?: number; posY?: number; cameraPresetId?: string; motionIntensity?: "low"|"medium"|"high"; aiReason?: string; }
interface AiMotionEvent { time: number; duration: number; cameraPresetId: string; motionPresetId: string; reason: string; intensity: "low"|"medium"|"high"; }
interface AiMotionResult { contentType: string; contentSubType: string; energy: string; globalCameraMove: string; recommendedMotionPreset: string; recommendedTemplate: string; motionEvents: AiMotionEvent[]; }
interface CaptionLayer { id: number; text: string; x: number; y: number; startTime: number; endTime: number; style: CaptionStyle; fontSize: number; color: string; bg: boolean; }
interface AudioEffects { bassBoost: boolean; echo: boolean; reverb: boolean; normalize: boolean; fadeIn: boolean; fadeOut: boolean; }
interface OverlayPos { x: number; y: number; }

// ── Shared constants (all from user studio + admin extras) ───────────────────
const URBAN_STICKERS = [
  "🔥","💯","🎯","👑","🤸","💫","⚡","🌊","🎵","🎤","🏆","🦁",
  "✨","🕺","👊","🙌","🔮","🌀","🎭","🛹","🎨","💥","🌟","🔥",
  "🤙","👐","💪","🎶","🌈","🏙️","🎪","🧨","🥇","🔑","🚀","💎",
  "🎬","🎧","📸","🌆","🦋","🌺","❤️‍🔥","🎯","🏄","🤺","🥊","👾",
  "🪄","🎸","🥁","🎹","🪩","🏆","🌙","☀️",
];
const TEXT_FONTS: { id: TextFont; label: string; style: string }[] = [
  { id: "default",     label: "Default",  style: "system-ui, sans-serif" },
  { id: "bold",        label: "Impact",   style: "'Arial Black', Impact, sans-serif" },
  { id: "handwriting", label: "Script",   style: "Pacifico, cursive" },
  { id: "mono",        label: "Mono",     style: "'Courier New', monospace" },
];
const TEXT_ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: "none",        label: "None"      }, { id: "slide-up",  label: "Slide Up"  },
  { id: "bounce",      label: "Bounce"    }, { id: "fade",      label: "Fade In"   },
  { id: "typewriter",  label: "Typewrite" }, { id: "glitch",    label: "Glitch"    },
  { id: "zoom-in",     label: "Zoom In"   }, { id: "neon-pulse",label: "Neon Glow" },
  { id: "shake",       label: "Shake"     }, { id: "blur-in",   label: "Blur In"   },
];
const TEXT_COLORS = ["#ffffff","#000000","#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#39ff14","#ff6b35"];
const SPEED_OPTIONS = [0.3, 0.5, 0.75, 1, 1.5, 2, 3];
const SPEED_LABELS: Record<number, string> = { 0.3: "0.3×", 0.5: "0.5×", 0.75: "0.75×", 1: "1×", 1.5: "1.5×", 2: "2×", 3: "3×" };
const ASPECT_RATIOS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: "9:16", label: "Reel", w: 9, h: 16 }, { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "4:5", label: "Portrait", w: 4, h: 5 }, { id: "16:9", label: "Wide", w: 16, h: 9 },
];
const MUSIC_TRACKS = [
  { id: "hiphop1", label: "Street Cipher",    genre: "Hip Hop",    bpm: 95,  key: "Am", mood: "aggressive", emoji: "🎤", url: "https://www.bensound.com/bensound-music/bensound-hip-hop.mp3" },
  { id: "break1",  label: "B-Boy Session",    genre: "Breakbeats", bpm: 130, key: "Dm", mood: "energetic",  emoji: "🕺", url: "https://www.bensound.com/bensound-music/bensound-dubstep.mp3" },
  { id: "urban1",  label: "Amsterdam Nights", genre: "Urban",      bpm: 108, key: "Fm", mood: "intense",    emoji: "🏙️", url: "https://www.bensound.com/bensound-music/bensound-energy.mp3" },
  { id: "trap1",   label: "Concrete Jungle",  genre: "Trap",       bpm: 140, key: "Em", mood: "dark",       emoji: "🔫", url: "https://www.bensound.com/bensound-music/bensound-dance.mp3" },
  { id: "soul1",   label: "Groove Therapy",   genre: "Soul/Funk",  bpm: 88,  key: "Gm", mood: "smooth",     emoji: "🎷", url: "https://www.bensound.com/bensound-music/bensound-funkyelement.mp3" },
  { id: "drill1",  label: "Daily Grind",      genre: "Drill",      bpm: 145, key: "Cm", mood: "gritty",     emoji: "💪", url: "https://www.bensound.com/bensound-music/bensound-moose.mp3" },
  { id: "afro1",   label: "Lagos to AMS",     genre: "Afrobeats",  bpm: 112, key: "Dm", mood: "vibrant",    emoji: "🌍", url: "https://www.bensound.com/bensound-music/bensound-anewbeginning.mp3" },
  { id: "jazz1",   label: "Midnight Jazz",    genre: "Jazz/Lofi",  bpm: 76,  key: "Cm", mood: "relaxed",    emoji: "🎷", url: "https://www.bensound.com/bensound-music/bensound-jazzy-frenchy.mp3" },
  { id: "grime1",  label: "Grime Season",     genre: "Grime",      bpm: 140, key: "Em", mood: "hard",       emoji: "🎤", url: "https://www.bensound.com/bensound-music/bensound-tenderness.mp3" },
  { id: "house1",  label: "Club Amsterdam",   genre: "House",      bpm: 128, key: "Am", mood: "euphoric",   emoji: "💃", url: "https://www.bensound.com/bensound-music/bensound-house.mp3" },
];
const INTRO_HOOKS = [
  { id: "air-horn",       label: "Air Horn",       emoji: "📢", desc: "DJ air horn blast — instant attention",     bestFor: "hype moments" },
  { id: "record-scratch", label: "Record Scratch",  emoji: "🎧", desc: "Vinyl scratch + rewind — classic DJ move",  bestFor: "hip-hop/urban" },
  { id: "countdown-drop", label: "3-2-1 Drop",      emoji: "🚨", desc: "Countdown beeps then bass explosion",       bestFor: "reveals / battles" },
  { id: "bass-rumble",    label: "Bass Rumble",      emoji: "💥", desc: "Sub bass build → explosive snap hit",       bestFor: "power moves" },
  { id: "siren-rise",     label: "Siren Rise",       emoji: "🔊", desc: "Rising alarm siren — maximum attention",    bestFor: "announcements" },
  { id: "crowd-cheer",    label: "Crowd Cheer",      emoji: "🙌", desc: "Stadium crowd reaction noise",              bestFor: "wins / highlights" },
  { id: "dj-rewind",      label: "DJ Rewind",        emoji: "⏪", desc: "Vinyl spin-up rewind effect",               bestFor: "drill / grime" },
  { id: "trap-intro",     label: "Trap Stutter",     emoji: "🔫", desc: "808 kick + rapid hi-hat trap pattern",      bestFor: "trap content" },
  { id: "whoosh-impact",  label: "Whoosh Impact",    emoji: "💨", desc: "Cinematic sweep → deep bass hit",           bestFor: "cinematics" },
  { id: "glitch-snap",    label: "Glitch Snap",      emoji: "⚡", desc: "Digital glitch burst → snap hit",           bestFor: "urban / tech" },
];
const SOUND_CATEGORIES = [
  { id: "intro",     label: "Intro Hook",  emoji: "🎬" },
  { id: "whoosh",   label: "Whoosh",      emoji: "💨" },
  { id: "impact",   label: "Impact",      emoji: "💥" },
  { id: "bass",     label: "Bass",        emoji: "🔊" },
  { id: "rise",     label: "Rise",        emoji: "🚀" },
  { id: "cinematic",label: "Cinematic",   emoji: "🎞️" },
  { id: "urban",    label: "Urban",       emoji: "🎧" },
  { id: "ambient",  label: "Ambient",     emoji: "🌆" },
];
const SOUND_LIBRARY = [
  { id: "intro-airhorn",  label: "Air Horn Blast",   category: "intro",     emoji: "📢", duration: "1.1s", mood: "hype" },
  { id: "intro-scratch",  label: "Record Scratch",   category: "intro",     emoji: "🎧", duration: "0.8s", mood: "hip-hop" },
  { id: "intro-countdown",label: "3-2-1 Drop",       category: "intro",     emoji: "🚨", duration: "2.1s", mood: "dramatic" },
  { id: "intro-bass",     label: "Bass Rumble",       category: "intro",     emoji: "💥", duration: "0.9s", mood: "power" },
  { id: "intro-siren",    label: "Siren Rise",        category: "intro",     emoji: "🔊", duration: "1.6s", mood: "alert" },
  { id: "whoosh-1",       label: "Air Whoosh",        category: "whoosh",    emoji: "💨", duration: "0.8s", mood: "transition" },
  { id: "whoosh-2",       label: "Power Whoosh",      category: "whoosh",    emoji: "🌬️", duration: "1.2s", mood: "dramatic" },
  { id: "whoosh-3",       label: "Speed Rush",        category: "whoosh",    emoji: "🌀", duration: "0.6s", mood: "fast" },
  { id: "impact-1",       label: "Bass Punch",        category: "impact",    emoji: "💥", duration: "0.6s", mood: "aggressive" },
  { id: "impact-2",       label: "Metal Hit",         category: "impact",    emoji: "🔩", duration: "0.8s", mood: "industrial" },
  { id: "impact-3",       label: "Cinematic Boom",    category: "impact",    emoji: "💣", duration: "1.0s", mood: "epic" },
  { id: "bass-1",         label: "808 Drop",          category: "bass",      emoji: "📻", duration: "2.0s", mood: "urban" },
  { id: "bass-2",         label: "Sub Bass Wave",     category: "bass",      emoji: "🔊", duration: "1.8s", mood: "deep" },
  { id: "bass-3",         label: "Trap 808",          category: "bass",      emoji: "🔫", duration: "1.5s", mood: "trap" },
  { id: "rise-1",         label: "Cinematic Rise",    category: "rise",      emoji: "🚀", duration: "3.0s", mood: "epic" },
  { id: "rise-2",         label: "Power Build",       category: "rise",      emoji: "📈", duration: "2.5s", mood: "intense" },
  { id: "rise-3",         label: "Tension Build",     category: "rise",      emoji: "⚡", duration: "2.0s", mood: "suspense" },
  { id: "cin-1",          label: "Epic Stinger",      category: "cinematic", emoji: "🎬", duration: "1.2s", mood: "cinematic" },
  { id: "cin-2",          label: "Drama Horn",        category: "cinematic", emoji: "🎺", duration: "2.0s", mood: "dramatic" },
  { id: "cin-3",          label: "Orchestral Hit",    category: "cinematic", emoji: "🎻", duration: "1.5s", mood: "grand" },
  { id: "urb-1",          label: "Record Scratch",    category: "urban",     emoji: "🎧", duration: "0.8s", mood: "hip hop" },
  { id: "urb-2",          label: "Vinyl Crackle",     category: "urban",     emoji: "📀", duration: "1.0s", mood: "nostalgic" },
  { id: "urb-3",          label: "DJ Rewind",         category: "urban",     emoji: "⏪", duration: "0.7s", mood: "rewind" },
  { id: "amb-1",          label: "City Ambience",     category: "ambient",   emoji: "🌆", duration: "5.0s", mood: "chill" },
  { id: "amb-2",          label: "Rain Drops",        category: "ambient",   emoji: "🌧️", duration: "5.0s", mood: "relaxed" },
  { id: "amb-3",          label: "Underground Hum",   category: "ambient",   emoji: "🚇", duration: "4.0s", mood: "urban chill" },
];
const FILTER_PRESETS = [
  { id: "normal",   label: "Normal",   brightness: 0,   contrast: 0,  saturation: 0,   sepia: 0,  hueRotate: 0   },
  { id: "vivid",    label: "Vivid",    brightness: 5,   contrast: 15, saturation: 50,  sepia: 0,  hueRotate: 0   },
  { id: "warm",     label: "Warm",     brightness: 10,  contrast: 5,  saturation: 20,  sepia: 30, hueRotate: 0   },
  { id: "cool",     label: "Cool",     brightness: 5,   contrast: 5,  saturation: 10,  sepia: 0,  hueRotate: 200 },
  { id: "dramatic", label: "Dramatic", brightness: -10, contrast: 50, saturation: -20, sepia: 0,  hueRotate: 0   },
  { id: "faded",    label: "Faded",    brightness: 20,  contrast: -20,saturation: -30, sepia: 0,  hueRotate: 0   },
  { id: "bw",       label: "B&W",      brightness: 0,   contrast: 20, saturation: -100,sepia: 0,  hueRotate: 0   },
  { id: "cinema",   label: "Cinema",   brightness: -5,  contrast: 30, saturation: -15, sepia: 10, hueRotate: 0   },
  { id: "matte",    label: "Matte",    brightness: 10,  contrast: -10,saturation: -25, sepia: 5,  hueRotate: 0   },
  { id: "analog",   label: "Analog",   brightness: 8,   contrast: 5,  saturation: -10, sepia: 25, hueRotate: 5   },
  { id: "chrome",   label: "Chrome",   brightness: 5,   contrast: 25, saturation: 30,  sepia: 0,  hueRotate: 0   },
  { id: "pastel",   label: "Pastel",   brightness: 15,  contrast: -5, saturation: 20,  sepia: 10, hueRotate: 0   },
];
const PLATFORM_PROFILES = [
  { id: "tiktok",   label: "TikTok",    emoji: "🎵", aspectRatio: "9:16" as AspectRatio, width: 1080, height: 1920, fps: 60, maxDuration: 60,  maxSizeMB: 287,    color: "#010101", bgClass: "from-zinc-900 to-zinc-800",           tips: ["First 3 seconds are make-or-break","Use trending audio for 3× reach","Post between 6–10 PM local time"] },
  { id: "ig-reels", label: "IG Reels",  emoji: "📸", aspectRatio: "9:16" as AspectRatio, width: 1080, height: 1920, fps: 30, maxDuration: 90,  maxSizeMB: 250,    color: "#C13584", bgClass: "from-purple-900/40 to-pink-900/30",    tips: ["Hashtags boost discovery up to 40%","Share to Story for 2× views","Keep text in safe zones (top/bottom 15%)"] },
  { id: "ig-story", label: "IG Story",  emoji: "⭕", aspectRatio: "9:16" as AspectRatio, width: 1080, height: 1920, fps: 30, maxDuration: 15,  maxSizeMB: 100,    color: "#FCAF45", bgClass: "from-orange-900/30 to-yellow-900/20",  tips: ["15-second max — cut tight","Add polls/questions for engagement","Use stickers for algorithm boost"] },
  { id: "yt-shorts",label: "YT Shorts", emoji: "▶️", aspectRatio: "9:16" as AspectRatio, width: 1080, height: 1920, fps: 60, maxDuration: 60,  maxSizeMB: 10000,  color: "#FF0000", bgClass: "from-red-900/30 to-zinc-900",          tips: ["60-second max for full Shorts distribution","Strong first frame = higher CTR","Add #Shorts in title for reach"] },
  { id: "youtube",  label: "YouTube",   emoji: "📺", aspectRatio: "16:9" as AspectRatio, width: 1920, height: 1080, fps: 60, maxDuration: 0,   maxSizeMB: 128000, color: "#FF0000", bgClass: "from-red-950/30 to-zinc-900",          tips: ["Custom thumbnail = 90% of success","Chapters boost watch time by 40%","SEO-optimized titles get 3× more clicks"] },
  { id: "linkedin", label: "LinkedIn",  emoji: "💼", aspectRatio: "1:1" as AspectRatio,  width: 1080, height: 1080, fps: 30, maxDuration: 600, maxSizeMB: 200,    color: "#0A66C2", bgClass: "from-blue-900/30 to-zinc-900",          tips: ["Native video gets 3× more engagement","First 5 seconds must hook professionals","Captions essential — 85% watch muted"] },
];
const TRANSITIONS = [
  { id: "hard-cut",       label: "Hard Cut",      emoji: "✂️", category: "cut",      description: "Instant raw switch",        timing: "0.0s", bestFor: "Fast-paced battles" },
  { id: "cross-dissolve", label: "Cross Dissolve",emoji: "🌫️", category: "cut",      description: "Smooth blend",              timing: "0.3s", bestFor: "Emotional moments" },
  { id: "fade-black",     label: "Fade to Black", emoji: "⬛", category: "cut",      description: "Classic fade out",           timing: "0.5s", bestFor: "Scene endings" },
  { id: "fade-white",     label: "Fade to White", emoji: "⬜", category: "cut",      description: "Bright flash transition",   timing: "0.3s", bestFor: "Dream sequences" },
  { id: "dip-color",      label: "Dip to Color",  emoji: "🎨", category: "cut",      description: "Dip to brand color",        timing: "0.4s", bestFor: "Brand content" },
  { id: "whip-pan",       label: "Whip Pan",      emoji: "💫", category: "motion",   description: "High-speed sweep",          timing: "0.2s", bestFor: "Action, energy" },
  { id: "zoom-punch",     label: "Zoom Punch",    emoji: "🔍", category: "motion",   description: "Rapid zoom in",             timing: "0.15s",bestFor: "Reaction moments" },
  { id: "spin",           label: "360° Spin",     emoji: "🌀", category: "motion",   description: "Full rotation",             timing: "0.4s", bestFor: "Fun content" },
  { id: "slide-left",     label: "Slide Left",    emoji: "⬅️", category: "motion",   description: "Clip slides from right",   timing: "0.3s", bestFor: "Tutorial steps" },
  { id: "slide-up",       label: "Slide Up",      emoji: "⬆️", category: "motion",   description: "Swipe up reveal",          timing: "0.3s", bestFor: "Builds, reveals" },
  { id: "glitch",         label: "Glitch Cut",    emoji: "📺", category: "creative", description: "Digital distortion",       timing: "0.2s", bestFor: "Urban, tech" },
  { id: "light-leak",     label: "Light Leak",    emoji: "💡", category: "creative", description: "Warm light burst",         timing: "0.5s", bestFor: "Vintage look" },
  { id: "color-flash",    label: "Color Flash",   emoji: "⚡", category: "creative", description: "Bright color burst",       timing: "0.1s", bestFor: "High energy" },
  { id: "warp",           label: "Warp",          emoji: "🌊", category: "creative", description: "Ripple distortion",        timing: "0.4s", bestFor: "Dreamy, abstract" },
  { id: "blur-trans",     label: "Motion Blur",   emoji: "💨", category: "creative", description: "Speed blur streak",        timing: "0.3s", bestFor: "Speed, urgency" },
  { id: "prism",          label: "Prism Split",   emoji: "🔮", category: "creative", description: "RGB prism dispersion",     timing: "0.35s",bestFor: "Artistic content" },
  { id: "freeze-frame",   label: "Freeze Frame",  emoji: "📸", category: "urban",    description: "Momentary freeze",         timing: "0.5s", bestFor: "Highlight moments" },
  { id: "echo",           label: "Echo Trail",    emoji: "🔊", category: "urban",    description: "Ghost trail echo",         timing: "0.4s", bestFor: "Dance highlights" },
  { id: "flash-cut",      label: "Flash Cut",     emoji: "✨", category: "urban",    description: "Rapid-fire cuts",          timing: "0.1s", bestFor: "Battle montage" },
  { id: "strobe",         label: "Strobe",        emoji: "🔦", category: "urban",    description: "Rapid flash effect",       timing: "0.2s", bestFor: "Club content" },
  { id: "film-burn",      label: "Film Burn",     emoji: "🔥", category: "urban",    description: "Vintage film burn",        timing: "0.6s", bestFor: "Old-school vibe" },
  { id: "beat-cut",       label: "Beat Cut",      emoji: "🥁", category: "beat",     description: "Snaps to beat marker",     timing: "auto", bestFor: "Music-driven" },
  { id: "bass-hit",       label: "Bass Hit",      emoji: "🔈", category: "beat",     description: "Flash on bass drop",       timing: "auto", bestFor: "Trap/drill beats" },
  { id: "rhythm-cut",     label: "Rhythm Cut",    emoji: "🎵", category: "beat",     description: "Cuts matched to BPM",      timing: "auto", bestFor: "Fast BPM content" },
  { id: "drop-sync",      label: "Drop Sync",     emoji: "🎚️", category: "beat",    description: "Jump cut on the drop",     timing: "auto", bestFor: "EDM, house" },
];
const TRANSITION_CATEGORIES = [
  { id: "cut",      label: "Cut",      emoji: "✂️" }, { id: "motion",   label: "Motion",   emoji: "💫" },
  { id: "creative", label: "Creative", emoji: "🎨" }, { id: "urban",    label: "Urban",    emoji: "🏙️" },
  { id: "beat",     label: "Beat Sync",emoji: "🥁" },
];
const HOOK_CATEGORIES = [
  { id: "curiosity", label: "Curiosity",      emoji: "🤔" }, { id: "shock",     label: "Shock/Surprise", emoji: "😱" },
  { id: "fomo",      label: "FOMO",           emoji: "🏃" }, { id: "urban",     label: "Urban Culture",  emoji: "🏙️" },
  { id: "challenge", label: "Challenge",      emoji: "💪" },
];
const HOOK_LIBRARY = [
  { id: "h1",  category: "curiosity", text: "Nobody talks about this but it changed everything for me..." },
  { id: "h2",  category: "curiosity", text: "Wait for the end — this one surprised everyone 👀" },
  { id: "h3",  category: "curiosity", text: "I tested this for 30 days. The result shocked me." },
  { id: "h4",  category: "curiosity", text: "POV: You discover something the internet keeps hidden 🔍" },
  { id: "h5",  category: "curiosity", text: "The reason most people fail at this (and how to fix it)" },
  { id: "h6",  category: "curiosity", text: "What happens when you combine these two things? 🤯" },
  { id: "h7",  category: "shock",     text: "I can't believe this actually worked 💀" },
  { id: "h8",  category: "shock",     text: "This video got 10 million views overnight. Here's why." },
  { id: "h9",  category: "shock",     text: "They told me this was impossible. Then I did it." },
  { id: "h10", category: "shock",     text: "The most insane skill you'll see today 🔥" },
  { id: "h11", category: "shock",     text: "Wait... did that just happen?! 😱 Watch again." },
  { id: "h12", category: "shock",     text: "Nobody expected this from a kid from Amsterdam" },
  { id: "h13", category: "fomo",      text: "This trend is taking over in 2025. Don't miss it." },
  { id: "h14", category: "fomo",      text: "Everyone in Amsterdam is doing this now. Are you?" },
  { id: "h15", category: "fomo",      text: "Save this now — you'll need it later 📌" },
  { id: "h16", category: "fomo",      text: "The underground scene nobody knows about (until now)" },
  { id: "h17", category: "fomo",      text: "This event sold out in 4 minutes. Watch why 👇" },
  { id: "h18", category: "fomo",      text: "If you live in NL and don't know this spot, you're missing out" },
  { id: "h19", category: "urban",     text: "The streets raised me and this is proof 🏙️" },
  { id: "h20", category: "urban",     text: "Real recognize real. This is what culture looks like." },
  { id: "h21", category: "urban",     text: "Amsterdam breaking scene hits different at night 🌃" },
  { id: "h22", category: "urban",     text: "From the cyphers to the screens — this is our story" },
  { id: "h23", category: "urban",     text: "The graffiti speaks what words can't say 🎨" },
  { id: "h24", category: "urban",     text: "B-boys don't need a stage. The street IS the stage. 🔥" },
  { id: "h25", category: "challenge", text: "Try to watch this without feeling inspired. I dare you." },
  { id: "h26", category: "challenge", text: "Can you beat this? Drop your version below 👇 #Challenge" },
  { id: "h27", category: "challenge", text: "30 days. Zero experience. This is what happened." },
  { id: "h28", category: "challenge", text: "They said I couldn't. Watch what happened next 💪" },
  { id: "h29", category: "challenge", text: "Drop everything. Watch this 60-second transformation." },
  { id: "h30", category: "challenge", text: "This took 1000 tries. It was worth every single one." },
];
const HASHTAG_PACKS = [
  { id: "breaking",      label: "Breaking / B-Boy",  emoji: "🤸", platform: "IG+TT",    tags: ["#breaking","#bboy","#bgirl","#breakdance","#cypher","#streetdance","#UrbanCulture","#headspin","#windmill","#powermoves","#footwork","#bboylife","#1on1","#breakingolympics","#breakingculture"] },
  { id: "hiphop",        label: "Hip-Hop Culture",   emoji: "🎤", platform: "All",       tags: ["#hiphop","#hiphopculture","#rap","#emcee","#freestyle","#bars","#cypher","#underground","#hiphophead","#dj","#beatmaking","#producer","#hiphoplife","#streetvibes","#microphone"] },
  { id: "graffiti",      label: "Graffiti / Art",    emoji: "🎨", platform: "Instagram", tags: ["#graffiti","#streetart","#urbanart","#spraypaint","#mural","#graff","#graffwriter","#artistsoninstagram","#instagraffiti","#aerosol","#bombing","#wholecar","#pieceoftheday","#wallart","#streetartistry"] },
  { id: "amsterdam",     label: "Amsterdam Urban",   emoji: "🇳🇱", platform: "All",       tags: ["#amsterdam","#amsterdamstreet","#netherlands","#dutch","#amsterdam020","#streetamsterdam","#damsko","#iamsterdam","#020vibes","#urbanamsterdam","#streetculturenl","#nederlandsurban","#dutchcreatives","#hollandstreet"] },
  { id: "dance",         label: "Street Dance",      emoji: "💃", platform: "TT+IG",     tags: ["#streetdance","#dance","#dancer","#dancing","#choreography","#popping","#locking","#waacking","#krump","#dancevideo","#dancelife","#urbandance","#hiphopDance","#danceculture","#freestyle"] },
  { id: "reels-boost",   label: "Reels Boost",       emoji: "🚀", platform: "Instagram", tags: ["#reels","#reelsinstagram","#reelsvideo","#instareels","#reelitfeelit","#viralreels","#reelsofinstagram","#trendingreels","#explorepage","#explore","#viral","#trending","#fyp","#instadaily","#instagood"] },
  { id: "tiktok-foryou", label: "TikTok FYP",        emoji: "🎵", platform: "TikTok",    tags: ["#fyp","#foryou","#foryoupage","#viral","#trending","#tiktok","#tiktokviral","#viralvideo","#tiktokdance","#fypシ","#xyzbca","#duet","#stitch","#tiktoktrend","#tiktokeurope"] },
  { id: "urban-culture", label: "Urban Culture",     emoji: "🏙️", platform: "All",       tags: ["#urbanculture","#streetculture","#urbanlifestyle","#citylife","#streetstyle","#urbanfashion","#streetsofeurope","#urbanvibes","#cityphotography","#urbanphotography","#streetphotography","#streetlife","#cityvibes","#culturalmovement","#underground"] },
];
const LOWER_THIRDS_STYLES = [
  { id: "bold-bar",     label: "Bold Bar",      preview: "bg-primary" },
  { id: "minimal-line", label: "Minimal Line",  preview: "border-b-2 border-white bg-transparent" },
  { id: "glass",        label: "Glassmorphism", preview: "bg-white/20 backdrop-blur" },
  { id: "neon-border",  label: "Neon Border",   preview: "border border-primary" },
  { id: "broadcast",    label: "Broadcast",     preview: "bg-red-600" },
  { id: "urban-tag",    label: "Urban Tag",     preview: "bg-yellow-400" },
];
const MOTION_PRESETS = [
  { id: "kinetic-drop",    label: "Kinetic Drop",    emoji: "💥", description: "Bold text drops in with impact",    sampleText: "NO DAYS OFF",           textStyle: { color: "#ffffff", size: 36, position: "center" as const, animation: "slide-up" as TextAnimation,  font: "bold" as TextFont } },
  { id: "neon-glow",       label: "Neon Glow",       emoji: "🔮", description: "Pulsing neon glow effect",          sampleText: "AMSTERDAM VIBES",       textStyle: { color: "#39ff14", size: 28, position: "center" as const, animation: "neon-pulse" as TextAnimation, font: "bold" as TextFont } },
  { id: "street-tag",      label: "Street Tag",      emoji: "🎨", description: "Graffiti-style spray reveal",       sampleText: "Real Recognize Real",   textStyle: { color: "#ffcc00", size: 30, position: "bottom" as const, animation: "blur-in" as TextAnimation,   font: "handwriting" as TextFont } },
  { id: "cinematic-title", label: "Cinematic Title", emoji: "🎬", description: "Wide letterbox title reveal",        sampleText: "THE STREETS SPEAK",     textStyle: { color: "#ffffff", size: 22, position: "center" as const, animation: "fade" as TextAnimation,      font: "mono" as TextFont } },
  { id: "social-hook",     label: "Social Hook",     emoji: "🎯", description: "Bold attention-grabbing hook",      sampleText: "YOU NEED TO SEE THIS", textStyle: { color: "#ff3b30", size: 32, position: "top" as const,    animation: "zoom-in" as TextAnimation,   font: "bold" as TextFont } },
  { id: "urban-flash",     label: "Urban Flash",     emoji: "⚡", description: "Quick flash-in with energy",        sampleText: "STAY FOCUSED",          textStyle: { color: "#ff9500", size: 34, position: "center" as const, animation: "zoom-in" as TextAnimation,   font: "bold" as TextFont } },
  { id: "heat-wave",       label: "Heat Wave",       emoji: "🌊", description: "Distorted glitch wave effect",      sampleText: "LEVEL UP",              textStyle: { color: "#ff6b35", size: 36, position: "center" as const, animation: "glitch" as TextAnimation,    font: "bold" as TextFont } },
  { id: "beat-drop",       label: "Beat Drop",       emoji: "🥁", description: "Shake on the beat drop",            sampleText: "DROP IT 🔊",            textStyle: { color: "#af52de", size: 32, position: "bottom" as const, animation: "shake" as TextAnimation,     font: "bold" as TextFont } },
  // ── Advanced Graphic Overlay Presets ──
  { id: "map-route",      label: "Map Route",       emoji: "🗺️",  description: "City route animation with pin drop",      sampleText: "AMSTERDAM",      textStyle: { color: "#39ff14", size: 22, position: "bottom" as const, animation: "slide-up" as TextAnimation,  font: "bold" as TextFont } },
  { id: "year-journey",   label: "Year Journey",    emoji: "📅",  description: "Animated year counter — tell your story", sampleText: "EST. 2015",      textStyle: { color: "#ffd700", size: 28, position: "top" as const,    animation: "fade" as TextAnimation,      font: "mono" as TextFont } },
  { id: "money-counter",  label: "Money Counter",   emoji: "💰",  description: "Revenue/income animated number ticker",   sampleText: "€10.000",        textStyle: { color: "#22c55e", size: 26, position: "center" as const, animation: "zoom-in" as TextAnimation,   font: "bold" as TextFont } },
  { id: "stats-burst",    label: "Stats Burst",     emoji: "📊",  description: "Multi-stat animated reveal overlay",     sampleText: "10K FANS 🔥",    textStyle: { color: "#ff9500", size: 26, position: "center" as const, animation: "slide-up" as TextAnimation,  font: "bold" as TextFont } },
  { id: "timeline-story", label: "Story Timeline",  emoji: "⏳",  description: "Chapter-by-chapter progression bar",     sampleText: "CHAPTER 1",      textStyle: { color: "#ffffff", size: 20, position: "top" as const,    animation: "fade" as TextAnimation,      font: "mono" as TextFont } },
  { id: "pin-drop",       label: "Pin Drop",        emoji: "📍",  description: "Location pin drops onto city map",       sampleText: "AMSTERDAM",      textStyle: { color: "#ff3b30", size: 22, position: "bottom" as const, animation: "blur-in" as TextAnimation,   font: "bold" as TextFont } },
  { id: "neon-city",      label: "Neon City",       emoji: "🌆",  description: "Glowing city skyline neon overlay",      sampleText: "CITY LIFE",      textStyle: { color: "#ff00ff", size: 28, position: "center" as const, animation: "neon-pulse" as TextAnimation, font: "bold" as TextFont } },
  { id: "split-reveal",   label: "Split Reveal",    emoji: "🪟",  description: "Dramatic diagonal split-screen reveal",  sampleText: "BEFORE / AFTER", textStyle: { color: "#ffffff", size: 22, position: "center" as const, animation: "zoom-in" as TextAnimation,   font: "mono" as TextFont } },
];
const STUDIO_TEMPLATES = [
  { id: "reel-hook",     label: "Reel Hook",     emoji: "🎯", description: "High-energy opener to stop the scroll",  category: "Social",    settings: { filterPresetId: "vivid",    contrast: 15, saturation: 30, brightness: 5,  warmth: 10                           }, textLayers: [{ text: "WATCH TILL THE END 👀", color: "#ffffff", size: 26, position: "top" as const, animation: "slide-up" as TextAnimation, font: "bold" as TextFont }] },
  { id: "cinematic",     label: "Cinematic",     emoji: "🎬", description: "Dark & dramatic film aesthetic",         category: "Cinematic", settings: { filterPresetId: "cinema",   contrast: 25, saturation:-15, vignette: 25,  shadows: 20, highlights: -15, grain: 20 }, textLayers: [{ text: "THE STREETS DON'T LIE", color: "#ffffff", size: 24, position: "center" as const, animation: "fade" as TextAnimation, font: "mono" as TextFont }] },
  { id: "event-promo",   label: "Event Promo",   emoji: "🎪", description: "Bold colors for events & announcements", category: "Promo",     settings: { filterPresetId: "vivid",    brightness: 10, saturation: 40, contrast: 20                                       }, textLayers: [{ text: "SAVE THE DATE", color: "#ffcc00", size: 30, position: "top" as const, animation: "zoom-in" as TextAnimation, font: "bold" as TextFont }] },
  { id: "urban-culture", label: "Urban Culture", emoji: "🏙️", description: "Warm authentic street aesthetic",        category: "Culture",   settings: { filterPresetId: "warm",     warmth: 30, saturation: 20, shadows: 10, vignette: 15                              }, textLayers: [{ text: "Culture Never Sleeps", color: "#ff9500", size: 26, position: "bottom" as const, animation: "slide-up" as TextAnimation, font: "handwriting" as TextFont }] },
  { id: "bboy-battle",   label: "B-Boy Battle",  emoji: "🤸", description: "Raw power for breaking content",         category: "Breaking",  settings: { filterPresetId: "dramatic", contrast: 30, saturation:-10, vignette: 30,  shadows: 25                           }, textLayers: [{ text: "CYPHER SEASON 🔥", color: "#ff3b30", size: 28, position: "top" as const, animation: "glitch" as TextAnimation, font: "bold" as TextFont }] },
  { id: "city-night",    label: "City Night",    emoji: "🌃", description: "Cool blue mystery & night energy",       category: "Night",     settings: { filterPresetId: "cool",     brightness:-10, contrast: 20, saturation: 10, vignette: 20                         }, textLayers: [{ text: "After Dark", color: "#007aff", size: 30, position: "center" as const, animation: "blur-in" as TextAnimation, font: "handwriting" as TextFont }] },
  { id: "matte-viral",   label: "Matte Viral",   emoji: "🎞️", description: "Trendy desaturated matte finish",       category: "Trending",  settings: { filterPresetId: "matte",    highlights:-20, shadows: 10, saturation:-20, vignette: 10                         }, textLayers: [{ text: "this changed me", color: "#e8e8e8", size: 22, position: "bottom" as const, animation: "fade" as TextAnimation, font: "default" as TextFont }] },
  { id: "analog-retro",  label: "Analog Retro",  emoji: "📼", description: "Warm 90s VHS film aesthetic",           category: "Retro",     settings: { filterPresetId: "analog",   warmth: 40, grain: 35, vignette: 20, saturation:-10                                }, textLayers: [{ text: "OLD SCHOOL STILL RULES", color: "#ffd700", size: 24, position: "center" as const, animation: "typewriter" as TextAnimation, font: "mono" as TextFont }] },
];

// Admin-exclusive data
const ADMIN_CAPTION_TEMPLATES: SavedCaption[] = [
  { id: "evt1", title: "Event Announcement", caption: "🔥 Big things are coming to Amsterdam! Save the date — we're bringing the culture back to the streets.", tags: "#amsterdam #urbanculture #breaking #streetdance #event", platform: "All", createdAt: "2025-01-01" },
  { id: "evt2", title: "Battle Promo",       caption: "The stage is set. The crews are ready. Who's taking the title? 🏆 Drop your crew tag below 👇", tags: "#bboylife #cypher #breaking #battle #streetdance", platform: "TikTok", createdAt: "2025-01-01" },
  { id: "evt3", title: "Community Post",     caption: "This is what culture looks like when it stays true to its roots. 🙌 Real recognize real.", tags: "#urbanculture #hiphop #streetlife #community #amsterdam", platform: "IG Reels", createdAt: "2025-01-01" },
];
const BEST_POSTING_TIMES = [
  { platform: "TikTok",    slots: ["6:00 AM", "12:00 PM", "7:00 PM", "9:00 PM"], bestDay: "Tue–Thu", reach: "Highest organic", color: "text-zinc-300" },
  { platform: "IG Reels",  slots: ["9:00 AM", "11:00 AM", "7:00 PM", "8:00 PM"], bestDay: "Mon–Wed", reach: "Strong discovery", color: "text-pink-400" },
  { platform: "YT Shorts", slots: ["2:00 PM", "4:00 PM", "8:00 PM"],             bestDay: "Thu–Sat", reach: "Long-tail search", color: "text-red-400" },
  { platform: "LinkedIn",  slots: ["8:00 AM", "12:00 PM", "5:00 PM"],            bestDay: "Tue–Thu", reach: "Professional reach", color: "text-blue-400" },
];
const ADMIN_AI_QUICK_ACTIONS = [
  { label: "Platform strategy",  prompt: "As admin of Urban Culture Connect, what's our optimal multi-platform content strategy for 2025 to grow the Dutch urban culture community?" },
  { label: "Caption template",   prompt: "Write 3 versatile caption templates for urban culture event promotions that work on TikTok, Instagram, and LinkedIn." },
  { label: "Hashtag strategy",   prompt: "What are the best tiered hashtag strategies for Dutch urban culture? Give 5 big (1M+), 5 medium (100K–1M), and 5 niche (<100K) hashtags." },
  { label: "Engagement boost",   prompt: "What 5 proven tactics can we implement this week to boost engagement on our urban culture platform content?" },
  { label: "Hook for event",     prompt: "Write 3 high-converting hook lines for promoting a breakdancing event in Amsterdam to a Gen Z audience." },
  { label: "Competitor analysis",prompt: "What content formats are Dutch urban culture platforms using successfully right now? What should we be doing differently?" },
  { label: "Content calendar",   prompt: "Give me a 2-week content calendar for an urban culture social platform: what to post each day, which platform, and what format." },
  { label: "Growth audit",       prompt: "What 5 critical improvements should an urban culture platform make to its video/reels content strategy right now?" },
  { label: "Collaboration ideas",prompt: "Suggest 5 high-impact collaboration ideas between Urban Culture Connect and Dutch urban artists/brands." },
  { label: "Viral prediction",   prompt: "What video format or trend from urban culture is most likely to go viral in the Netherlands in the next 30 days?" },
  { label: "SEO optimization",   prompt: "How should we optimize our YouTube video titles, descriptions, and tags for Dutch urban culture content to maximize search visibility?" },
  { label: "Analytics insights", prompt: "What KPIs should an urban culture platform track for its video content, and what benchmarks should we aim for?" },
];

const ADMIN_AI_EDITOR_COMMANDS = [
  { label: "🗺️ Neon route",       prompt: "__cmd__ neon map style with glowing route Amsterdam → Rotterdam → Berlin" },
  { label: "✈️ World flight",      prompt: "__cmd__ cinematic map route Amsterdam → Dubai → Tokyo → New York with plane" },
  { label: "🎨 Cartoon map",       prompt: "__cmd__ cartoon map style colorful route Amsterdam → Paris → Madrid" },
  { label: "🎬 Cinematic filter",  prompt: "__cmd__ apply cinematic filter and add bold title text 'URBAN CULTURE'" },
  { label: "📱 Instagram ready",   prompt: "__cmd__ set 9:16 aspect ratio export for Instagram Reels" },
  { label: "⚡ Bass + echo FX",    prompt: "__cmd__ enable bass boost and echo audio effects" },
  { label: "🌍 Europe tour",       prompt: "__cmd__ map route Amsterdam → Paris → Barcelona → Rome → Berlin cartoon style" },
  { label: "🔤 Add neon text",     prompt: "__cmd__ add neon text overlay 'AMSTERDAM 2025' white color top position" },
];

const MAX_CAPTION = 300;
const COMPRESS_THRESHOLD = 80 * 1024 * 1024;
const THUMBNAIL_COUNT = 6;

// ── CSS filter builder ───────────────────────────────────────────────────────
function buildCssFilter(preset: typeof FILTER_PRESETS[0], bri = 0, con = 0, sat = 0, warm = 0): string {
  const b = 1 + (preset.brightness + bri) / 100;
  const c = 1 + (preset.contrast + con) / 100;
  const s = 1 + (preset.saturation + sat) / 100;
  const sp = preset.sepia / 100;
  const hr = preset.hueRotate + warm * 0.5;
  return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)}) saturate(${Math.max(0, s).toFixed(2)}) sepia(${sp.toFixed(2)}) hue-rotate(${hr.toFixed(0)}deg)`;
}
function formatTime(secs: number) { const m = Math.floor(secs / 60); const s = Math.floor(secs % 60); return `${m}:${s.toString().padStart(2, "0")}`; }
function formatSize(bytes: number) { if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function getAnimClass(anim: TextAnimation) {
  return { "slide-up": "studio-text-slide-up", "bounce": "studio-text-bounce", "fade": "studio-text-fade",
    "typewriter": "studio-text-typewriter", "glitch": "studio-text-glitch", "zoom-in": "studio-text-zoom-in",
    "neon-pulse": "studio-text-neon-pulse", "shake": "studio-text-shake", "blur-in": "studio-text-blur-in", "none": "" }[anim] || "";
}

const CAMERA_MOVE_PRESETS = [
  { id: "slow-zoom-in",   label: "Slow Zoom In",   emoji: "🔍", desc: "Ken Burns zoom in",       cls: "admin-cam-slow-zoom-in" },
  { id: "slow-zoom-out",  label: "Slow Zoom Out",  emoji: "🔭", desc: "Pull-back reveal",         cls: "admin-cam-slow-zoom-out" },
  { id: "pan-left",       label: "Pan Left",       emoji: "◀",  desc: "Smooth horizontal pan",    cls: "admin-cam-pan-left" },
  { id: "pan-right",      label: "Pan Right",      emoji: "▶",  desc: "Smooth horizontal pan",    cls: "admin-cam-pan-right" },
  { id: "drone-pullback", label: "Drone Pullback", emoji: "🚁", desc: "Aerial pullback",           cls: "admin-cam-drone" },
  { id: "handheld",       label: "Handheld",       emoji: "🎥", desc: "Natural camera wobble",     cls: "admin-cam-handheld" },
  { id: "beat-shake",     label: "Beat Shake",     emoji: "🥁", desc: "Shake to the beat",        cls: "admin-cam-beat-shake" },
  { id: "orbit",          label: "Orbit",          emoji: "🌀", desc: "Slow orbital drift",        cls: "admin-cam-orbit" },
];
const TRANSLATION_LANGUAGES = [
  { id: "nl", label: "Dutch",      flag: "🇳🇱" },
  { id: "en", label: "English",    flag: "🇬🇧" },
  { id: "fr", label: "French",     flag: "🇫🇷" },
  { id: "de", label: "German",     flag: "🇩🇪" },
  { id: "es", label: "Spanish",    flag: "🇪🇸" },
  { id: "ar", label: "Arabic",     flag: "🇸🇦" },
  { id: "pt", label: "Portuguese", flag: "🇵🇹" },
  { id: "tr", label: "Turkish",    flag: "🇹🇷" },
  { id: "ja", label: "Japanese",   flag: "🇯🇵" },
  { id: "id", label: "Indonesian", flag: "🇮🇩" },
];

const STUDIO_KEYFRAMES = `
@keyframes adminStudioSlideUp { 0% { opacity:0; transform:translateY(30px) } 100% { opacity:1; transform:translateY(0) } }
@keyframes adminStudioFade { 0% { opacity:0 } 100% { opacity:1 } }
@keyframes adminStudioZoomIn { 0% { opacity:0; transform:scale(0.5) } 100% { opacity:1; transform:scale(1) } }
@keyframes adminStudioBounce { 0%,20%,50%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-12px) } 60% { transform:translateY(-6px) } }
@keyframes adminStudioGlitch { 0%,100% { transform:translate(0) } 20% { transform:translate(-3px,3px) } 40% { transform:translate(3px,-3px) } 60% { transform:translate(-3px,-3px) } 80% { transform:translate(3px,3px) } }
@keyframes adminStudioNeonPulse { 0%,100% { text-shadow:0 0 8px currentColor,0 0 20px currentColor } 50% { text-shadow:0 0 3px currentColor } }
@keyframes adminStudioShake { 0%,100% { transform:translateX(0) } 20%,60% { transform:translateX(-4px) } 40%,80% { transform:translateX(4px) } }
@keyframes adminStudioBlurIn { 0% { opacity:0; filter:blur(12px) } 100% { opacity:1; filter:blur(0) } }
@keyframes adminProgressBar { 0% { width:0% } 100% { width:100% } }
@keyframes adminStepSlide { 0% { opacity:0; transform:translateX(16px) } 100% { opacity:1; transform:translateX(0) } }
@keyframes adminViralCount { 0% { opacity:0; transform:scale(0.6) } 100% { opacity:1; transform:scale(1) } }
.admin-text-slide-up   { animation: adminStudioSlideUp   0.5s ease forwards }
.admin-text-bounce     { animation: adminStudioBounce     1.2s ease infinite }
.admin-text-fade       { animation: adminStudioFade       0.7s ease forwards }
.admin-text-typewriter { animation: adminStudioFade       1.5s ease forwards }
.admin-text-glitch     { animation: adminStudioGlitch     0.5s linear infinite }
.admin-text-zoom-in    { animation: adminStudioZoomIn     0.4s ease forwards }
.admin-text-neon-pulse { animation: adminStudioNeonPulse  1.5s ease-in-out infinite }
.admin-text-shake      { animation: adminStudioShake      0.5s linear infinite }
.admin-text-blur-in    { animation: adminStudioBlurIn     0.7s ease forwards }
.admin-step-slide      { animation: adminStepSlide        0.25s ease both }
.admin-viral-count     { animation: adminViralCount       0.6s cubic-bezier(.34,1.56,.64,1) forwards }
.admin-progress-bar    { animation: adminProgressBar      3s linear infinite }
@keyframes adminVidKenBurns { 0%{transform:scale(1) translate(0,0)} 100%{transform:scale(1.13) translate(-3%,-2%)} }
@keyframes adminVidShake { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-5px,2px)} 50%{transform:translate(5px,-3px)} 75%{transform:translate(-3px,3px)} }
@keyframes adminVidPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
@keyframes adminVidDrift { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(8px,-6px) rotate(0.5deg)} }
@keyframes adminVidBounce { 0%,100%{transform:translateY(0) scale(1)} 45%{transform:translateY(-10px) scale(1.04)} 65%{transform:translateY(-5px)} }
.admin-vid-motion-kinetic-drop    { animation: adminVidShake    0.4s linear infinite; transform-origin:center }
.admin-vid-motion-neon-glow       { animation: adminVidPulse    2s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-street-tag      { animation: adminVidDrift    5s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-cinematic-title { animation: adminVidKenBurns 9s ease-in-out infinite alternate; transform-origin:center }
.admin-vid-motion-social-hook     { animation: adminVidBounce   1.2s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-urban-flash     { animation: adminVidShake    0.3s linear infinite; transform-origin:center }
.admin-vid-motion-heat-wave       { animation: adminVidPulse    0.9s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-beat-drop       { animation: adminVidBounce   0.5s ease-in-out infinite; transform-origin:center }
@keyframes adminMapRoute { 0%{stroke-dashoffset:300} 100%{stroke-dashoffset:0} }
@keyframes adminPinDrop { 0%{transform:translateY(-60px) scale(0);opacity:0} 60%{transform:translateY(4px) scale(1.1);opacity:1} 80%{transform:translateY(-3px) scale(1)} 100%{transform:translateY(0) scale(1);opacity:1} }
@keyframes adminWavePulse { 0%{transform:scaleY(0.4)} 100%{transform:scaleY(1.2)} }
@keyframes adminNeonCityPulse { 0%,100%{opacity:0.9;filter:drop-shadow(0 0 5px #39ff14)} 50%{opacity:0.5;filter:drop-shadow(0 0 2px #39ff14)} }
@keyframes adminSplitReveal { 0%,100%{clip-path:polygon(0 0,48% 0,33% 100%,0 100%)} 50%{clip-path:polygon(0 0,54% 0,38% 100%,0 100%)} }
@keyframes adminStatsSlide { 0%{transform:translateX(-20px);opacity:0} 100%{transform:translateX(0);opacity:1} }
@keyframes adminCountUp { 0%{transform:translateY(8px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes adminMapDraw { 0%{stroke-dashoffset:2000;opacity:0} 5%{opacity:1} 100%{stroke-dashoffset:0} }
@keyframes adminMapFadeIn { 0%{opacity:0;transform:translateY(4px)} 100%{opacity:1;transform:translateY(0)} }
.admin-vid-motion-map-route      { animation: adminVidDrift     6s ease-in-out infinite alternate; transform-origin:center }
.admin-vid-motion-year-journey   { animation: adminVidKenBurns  12s ease-in-out infinite alternate; transform-origin:center }
.admin-vid-motion-money-counter  { animation: adminVidPulse     3s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-stats-burst    { animation: adminVidPulse     2s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-timeline-story { animation: adminVidKenBurns  15s ease-in-out infinite alternate; transform-origin:center }
.admin-vid-motion-pin-drop       { animation: adminVidBounce    2s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-neon-city      { animation: adminVidPulse     1.5s ease-in-out infinite; transform-origin:center }
.admin-vid-motion-split-reveal   { animation: adminVidDrift     8s ease-in-out infinite alternate; transform-origin:center }
.studio-video-panel { height: clamp(260px, 50vh, 460px) }
@media (min-width: 1024px) { .studio-video-panel { height: 100% !important } }
@keyframes adminCamSlowZoomIn { 0%{transform:scale(1) translate(0,0)} 100%{transform:scale(1.14) translate(-1%,-1%)} }
@keyframes adminCamSlowZoomOut { 0%{transform:scale(1.14) translate(-1%,-1%)} 100%{transform:scale(1) translate(0,0)} }
@keyframes adminCamPanLeft { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-5%)} }
@keyframes adminCamPanRight { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5%)} }
@keyframes adminCamDrone { 0%{transform:scale(1.18) translateY(-5%)} 100%{transform:scale(1) translateY(0)} }
@keyframes adminCamHandheld { 0%,100%{transform:translate(0,0) rotate(0deg)} 20%{transform:translate(0.6%,0.4%) rotate(0.18deg)} 40%{transform:translate(-0.4%,0.7%) rotate(-0.12deg)} 60%{transform:translate(0.5%,-0.4%) rotate(0.1deg)} 80%{transform:translate(-0.3%,0.3%) rotate(-0.15deg)} }
@keyframes adminCamBeatShake { 0%,100%{transform:translate(0,0) scale(1)} 12%{transform:translate(-1.2%,0) scale(1.01)} 25%{transform:translate(1.2%,0) scale(1.01)} 37%{transform:translate(-0.6%,-0.4%) scale(1)} 50%{transform:translate(0.6%,0.4%)} }
@keyframes adminCamOrbit { 0%{transform:translate(0,0) rotate(0deg)} 25%{transform:translate(3%,-2%) rotate(0.3deg)} 50%{transform:translate(0,-4%) rotate(0deg)} 75%{transform:translate(-3%,-2%) rotate(-0.3deg)} 100%{transform:translate(0,0) rotate(0deg)} }
.admin-cam-slow-zoom-in  { animation: adminCamSlowZoomIn  10s ease-in-out infinite alternate; transform-origin:center }
.admin-cam-slow-zoom-out { animation: adminCamSlowZoomOut 10s ease-in-out infinite alternate; transform-origin:center }
.admin-cam-pan-left      { animation: adminCamPanLeft      8s ease-in-out infinite; transform-origin:center }
.admin-cam-pan-right     { animation: adminCamPanRight     8s ease-in-out infinite; transform-origin:center }
.admin-cam-drone         { animation: adminCamDrone        6s ease-out both; transform-origin:center }
.admin-cam-handheld      { animation: adminCamHandheld     4s linear infinite; transform-origin:center }
.admin-cam-beat-shake    { animation: adminCamBeatShake    0.6s ease-in-out infinite; transform-origin:center }
.admin-cam-orbit         { animation: adminCamOrbit        12s linear infinite; transform-origin:center }
@keyframes adminNeonCitySign { 0%,100%{opacity:1} 45%{opacity:0.3} 55%{opacity:0.9} 60%{opacity:0.5} 65%{opacity:1} }
@keyframes adminNeonCityPulse { 0%,100%{opacity:1;transform:none} 50%{opacity:0.75;transform:scaleY(1.01)} }
@keyframes adminStatsBurstIn { 0%{transform:scale(0.5) translateY(20px);opacity:0} 60%{transform:scale(1.05) translateY(-4px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
`;


// ── Edit tabs config ─────────────────────────────────────────────────────────
const EDIT_TABS: { id: EditTab; label: string; icon: typeof Film; adminOnly?: boolean }[] = [
  { id: "templates",   label: "Templates",   icon: Clapperboard },
  { id: "motion",      label: "Motion",      icon: Layers3      },
  { id: "export",      label: "Export",      icon: Share2       },
  { id: "viral",       label: "Viral IQ",    icon: TrendingUp   },
  { id: "transitions", label: "Transitions", icon: Shuffle      },
  { id: "brand",       label: "Brand Kit",   icon: Paintbrush   },
  { id: "trim",        label: "Trim",        icon: Scissors     },
  { id: "filters",     label: "Filters",     icon: SlidersHorizontal },
  { id: "adjust",      label: "Adjust",      icon: Palette      },
  { id: "speed",       label: "Speed",       icon: Gauge        },
  { id: "audio",       label: "Audio",       icon: Music        },
  { id: "sounds",      label: "Sounds",      icon: Music2       },
  { id: "text",        label: "Text",        icon: Type         },
  { id: "stickers",    label: "Stickers",    icon: Smile        },
  { id: "captions",    label: "Captions",    icon: MessageSquare },
  { id: "smartedit",   label: "Smart Edit",  icon: Bot          },
  { id: "aitools",     label: "AI Tools",    icon: Sparkles     },
  { id: "schedule",    label: "Schedule",    icon: Calendar,    adminOnly: true },
  { id: "batch",       label: "Batch",       icon: ListChecks,  adminOnly: true },
  { id: "library",     label: "Library",     icon: Archive,     adminOnly: true },
  { id: "analytics",   label: "Analytics",   icon: BarChart3,   adminOnly: true },
];

// ── Advanced Map Route Studio constants ──────────────────────────────────────
const MAP_CITIES_DB: Array<Omit<MapWaypointItem, "id">> = [
  { city: "Amsterdam",   lat: 52.37, lon: 4.90,    flag: "🇳🇱", country: "Netherlands" },
  { city: "Rotterdam",   lat: 51.92, lon: 4.48,    flag: "🇳🇱", country: "Netherlands" },
  { city: "The Hague",   lat: 52.08, lon: 4.30,    flag: "🇳🇱", country: "Netherlands" },
  { city: "London",      lat: 51.51, lon: -0.13,   flag: "🇬🇧", country: "UK" },
  { city: "Paris",       lat: 48.86, lon: 2.35,    flag: "🇫🇷", country: "France" },
  { city: "Berlin",      lat: 52.52, lon: 13.40,   flag: "🇩🇪", country: "Germany" },
  { city: "Barcelona",   lat: 41.39, lon: 2.15,    flag: "🇪🇸", country: "Spain" },
  { city: "Madrid",      lat: 40.42, lon: -3.70,   flag: "🇪🇸", country: "Spain" },
  { city: "Rome",        lat: 41.90, lon: 12.50,   flag: "🇮🇹", country: "Italy" },
  { city: "Milan",       lat: 45.46, lon: 9.19,    flag: "🇮🇹", country: "Italy" },
  { city: "Brussels",    lat: 50.85, lon: 4.35,    flag: "🇧🇪", country: "Belgium" },
  { city: "Vienna",      lat: 48.21, lon: 16.37,   flag: "🇦🇹", country: "Austria" },
  { city: "Warsaw",      lat: 52.23, lon: 21.01,   flag: "🇵🇱", country: "Poland" },
  { city: "Lisbon",      lat: 38.72, lon: -9.14,   flag: "🇵🇹", country: "Portugal" },
  { city: "Stockholm",   lat: 59.33, lon: 18.07,   flag: "🇸🇪", country: "Sweden" },
  { city: "Copenhagen",  lat: 55.68, lon: 12.57,   flag: "🇩🇰", country: "Denmark" },
  { city: "Zurich",      lat: 47.38, lon: 8.54,    flag: "🇨🇭", country: "Switzerland" },
  { city: "Prague",      lat: 50.08, lon: 14.44,   flag: "🇨🇿", country: "Czechia" },
  { city: "Athens",      lat: 37.98, lon: 23.73,   flag: "🇬🇷", country: "Greece" },
  { city: "Dubai",       lat: 25.20, lon: 55.27,   flag: "🇦🇪", country: "UAE" },
  { city: "New York",    lat: 40.71, lon: -74.01,  flag: "🇺🇸", country: "USA" },
  { city: "Los Angeles", lat: 34.05, lon: -118.24, flag: "🇺🇸", country: "USA" },
  { city: "Miami",       lat: 25.77, lon: -80.19,  flag: "🇺🇸", country: "USA" },
  { city: "Chicago",     lat: 41.88, lon: -87.63,  flag: "🇺🇸", country: "USA" },
  { city: "Tokyo",       lat: 35.69, lon: 139.69,  flag: "🇯🇵", country: "Japan" },
  { city: "Singapore",   lat: 1.35,  lon: 103.82,  flag: "🇸🇬", country: "Singapore" },
  { city: "Sydney",      lat: -33.87,lon: 151.21,  flag: "🇦🇺", country: "Australia" },
  { city: "Toronto",     lat: 43.65, lon: -79.38,  flag: "🇨🇦", country: "Canada" },
  { city: "São Paulo",   lat: -23.55,lon: -46.63,  flag: "🇧🇷", country: "Brazil" },
  { city: "Cape Town",   lat: -33.93,lon: 18.42,   flag: "🇿🇦", country: "S. Africa" },
  { city: "Mumbai",      lat: 19.08, lon: 72.88,   flag: "🇮🇳", country: "India" },
  { city: "Delhi",       lat: 28.61, lon: 77.21,   flag: "🇮🇳", country: "India" },
  { city: "Beijing",     lat: 39.91, lon: 116.39,  flag: "🇨🇳", country: "China" },
  { city: "Shanghai",    lat: 31.23, lon: 121.47,  flag: "🇨🇳", country: "China" },
  { city: "Moscow",      lat: 55.75, lon: 37.62,   flag: "🇷🇺", country: "Russia" },
  { city: "Istanbul",    lat: 41.01, lon: 28.98,   flag: "🇹🇷", country: "Turkey" },
  { city: "Cairo",       lat: 30.04, lon: 31.24,   flag: "🇪🇬", country: "Egypt" },
  { city: "Lagos",       lat: 6.46,  lon: 3.38,    flag: "🇳🇬", country: "Nigeria" },
  { city: "Nairobi",     lat: -1.29, lon: 36.82,   flag: "🇰🇪", country: "Kenya" },
  { city: "Seoul",       lat: 37.57, lon: 126.98,  flag: "🇰🇷", country: "S. Korea" },
  { city: "Bangkok",     lat: 13.75, lon: 100.50,  flag: "🇹🇭", country: "Thailand" },
  { city: "Jakarta",     lat: -6.21, lon: 106.85,  flag: "🇮🇩", country: "Indonesia" },
  { city: "Mexico City", lat: 19.43, lon: -99.13,  flag: "🇲🇽", country: "Mexico" },
  { city: "Buenos Aires",lat: -34.60,lon: -58.38,  flag: "🇦🇷", country: "Argentina" },
];

const geoToSvg = (lat: number, lon: number) => ({ x: lon + 180, y: 90 - lat });

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371, d = (deg: number) => deg * Math.PI / 180;
  const a = Math.sin(d(lat2 - lat1) / 2) ** 2 + Math.cos(d(lat1)) * Math.cos(d(lat2)) * Math.sin(d(lon2 - lon1) / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const MAP_CONTINENT_PATHS = [
  { name: "n-am", d: "M20,18 L128,18 L130,38 L125,60 L105,78 L80,92 L55,108 L40,112 L25,95 L12,68 L12,42 Z" },
  { name: "s-am", d: "M97,77 L148,77 L154,95 L152,118 L140,148 L122,165 L104,150 L92,122 L90,95 Z" },
  { name: "eur",  d: "M165,19 L185,18 L205,19 L215,22 L220,30 L218,42 L210,52 L195,60 L178,62 L170,55 L165,45 L165,35 Z" },
  { name: "afr",  d: "M165,53 L230,53 L235,72 L232,100 L220,122 L198,142 L178,138 L160,118 L156,92 L160,68 Z" },
  { name: "asia", d: "M205,13 L355,13 L355,28 L348,55 L338,78 L315,88 L295,85 L262,78 L238,82 L218,72 L204,55 L200,35 Z" },
  { name: "aus",  d: "M290,101 L335,100 L340,118 L328,132 L305,136 L290,125 L285,112 Z" },
  { name: "grn",  d: "M128,8 L162,8 L165,22 L148,28 L125,24 L125,16 Z" },
];

const MAP_COUNTRY_SHAPES: Record<string, { name: string; flag: string; flagColors: [string, string, string]; path: string }> = {
  "Netherlands":    { name: "Netherlands",    flag: "🇳🇱", flagColors: ["#ae1c28","#ffffff","#21468b"], path: "M183.3,36.5 L186.8,36.2 L187.5,37.0 L187.8,37.8 L187.2,38.5 L186.0,39.0 L184.5,39.3 L183.5,39.0 L183.0,38.2 L183.0,37.2 Z" },
  "Germany":        { name: "Germany",        flag: "🇩🇪", flagColors: ["#000000","#dd0000","#ffce00"], path: "M186,35.0 L192,34.5 L195,35.0 L196.5,36.5 L196,39 L194.5,42.5 L192,43.5 L189,43.5 L187,42 L186,39.5 L185.5,37.5 L186,35.5 Z" },
  "France":         { name: "France",         flag: "🇫🇷", flagColors: ["#002395","#ffffff","#ed2939"], path: "M174.5,39.5 L183.3,39.0 L186,40 L188,41.5 L188.5,43.5 L187.5,46.5 L185.5,48.5 L182.5,50 L178.5,50 L175.5,48.5 L173.5,45.5 L173.5,42.5 Z" },
  "United Kingdom": { name: "UK",             flag: "🇬🇧", flagColors: ["#012169","#ffffff","#c8102e"], path: "M174.2,31.0 L179,31 L180.5,33.5 L180.5,37 L179,40 L176.5,41 L174,40 L173.2,37.5 L173.5,34 Z" },
  "Spain":          { name: "Spain",          flag: "🇪🇸", flagColors: ["#c60b1e","#ffc400","#c60b1e"], path: "M169,41 L183.3,41 L184.5,43.5 L183.5,47 L180.5,51.5 L176,54.5 L171.5,55 L167,53 L164.5,49.5 L165,44.5 L167.5,41.5 Z" },
  "Italy":          { name: "Italy",          flag: "🇮🇹", flagColors: ["#009246","#ffffff","#ce2b37"], path: "M188.5,43 L193.5,42.5 L195.5,43.5 L196.5,45.5 L198,47.5 L199.5,49.5 L201.5,51.5 L203,53.5 L201.5,56 L199,57.5 L196.5,55.5 L194.5,52.5 L192.5,49.5 L190.5,46.5 L188.8,44.5 Z M199,53.5 L203.5,55.5 L205.5,58.5 L203,61 L200,60 L198.5,57 Z" },
  "Belgium":        { name: "Belgium",        flag: "🇧🇪", flagColors: ["#000000","#fae042","#ef3340"], path: "M182.5,38.5 L186,38.5 L186.5,40.2 L186,40.8 L182.5,40.8 L182,40 Z" },
  "Portugal":       { name: "Portugal",       flag: "🇵🇹", flagColors: ["#006600","#ff0000","#006600"], path: "M169,41.5 L172.5,41.5 L173,44 L172.5,47.5 L171.5,50 L169.5,51.5 L167.5,50 L167,47 L167.5,43.5 Z" },
  "UAE":            { name: "UAE",            flag: "🇦🇪", flagColors: ["#00732f","#ffffff","#ff0000"], path: "M234.8,52.0 L242,52 L243.5,54.5 L243,58.5 L240,60.5 L236.5,60 L234.5,57.5 L234,54.5 Z" },
  "Japan":          { name: "Japan",          flag: "🇯🇵", flagColors: ["#ffffff","#bc002d","#ffffff"], path: "M319.7,36.0 L322.5,36.5 L323,39.5 L321.5,42 L319.5,42.5 L318,40.5 L318,37.5 Z" },
  "USA":            { name: "United States",  flag: "🇺🇸", flagColors: ["#b22234","#ffffff","#3c3b6e"], path: "M30,38 L128,38 L128,65 L90,72 L70,75 L45,72 L28,65 L28,45 Z" },
  "Australia":      { name: "Australia",      flag: "🇦🇺", flagColors: ["#00008b","#ffffff","#ff0000"], path: "M290,101 L335,100 L340,118 L328,132 L305,136 L290,125 L285,112 Z" },
};

const MAP_ROUTE_TEMPLATES = [
  { label: "🌍 Europe Tour",   cities: ["Amsterdam","Paris","Barcelona","Rome","Berlin"] },
  { label: "✈️ World Flight",  cities: ["Amsterdam","Dubai","Singapore","Tokyo","Los Angeles"] },
  { label: "🏖️ US Hop",       cities: ["New York","Miami","Chicago","Los Angeles"] },
  { label: "🌏 Asia Journey",  cities: ["Dubai","Mumbai","Singapore","Bangkok","Tokyo"] },
  { label: "🏡 NL Cities",    cities: ["Amsterdam","Rotterdam","The Hague","Brussels"] },
];

// ── MapRouteOverlay — Advanced 5-style cinematic animated map ────────────────
function MapRouteOverlay({
  waypoints, lineColor, showDistance, showFlags, mapLineStyle, mapVisualStyle, mapVehicle, mapAnimSpeed,
}: {
  waypoints: MapWaypointItem[];
  lineColor: string;
  showDistance: boolean;
  showFlags: boolean;
  mapLineStyle: "solid"|"dashed"|"dotted"|"glowing";
  mapVisualStyle: MapVisualStyle;
  mapVehicle: MapVehicle;
  mapAnimSpeed: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let _raf: number;
    let _fallback: ReturnType<typeof setTimeout>;

    _raf = requestAnimationFrame(() => {
    const el = containerRef.current;
    if (!el || waypoints.length < 2) return;

    if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    delete (el as any)._leaflet_id;
    el.innerHTML = "";

    if (!document.getElementById("lf-css")) {
      const lk = document.createElement("link");
      lk.id = "lf-css"; lk.rel = "stylesheet";
      lk.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(lk);
    }
    if (!document.getElementById("arc-kf3")) {
      const s = document.createElement("style"); s.id = "arc-kf3";
      s.textContent = [
        "@keyframes arcDraw{to{stroke-dashoffset:0}}",
        "@keyframes arcIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}",
        "@keyframes markerBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}",
        "@keyframes cartoonBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
        "@keyframes neonFlicker{0%,100%{opacity:1;filter:brightness(1)}45%{opacity:0.85;filter:brightness(1.4)}55%{opacity:0.9}}",
        "@keyframes trailMove{0%{opacity:0.7;stroke-width:4}100%{opacity:0;stroke-width:0.5}}",
      ].join("");
      document.head.appendChild(s);
    }

    // Tile layers per visual style
    const TILE_SETS: Record<MapVisualStyle, Array<{ url: string; opts: Record<string, any> }>> = {
      cinematic:  [
        { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", opts: { maxZoom: 14 } },
        { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", opts: { maxZoom: 14, opacity: 0.82 } },
      ],
      cartoon: [
        { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd", maxZoom: 19 } },
      ],
      neon: [
        { url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd", maxZoom: 19 } },
      ],
      "3d-route": [
        { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}", opts: { maxZoom: 13 } },
        { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", opts: { maxZoom: 13, opacity: 0.65 } },
      ],
      social: [
        { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd", maxZoom: 19 } },
      ],
    };

    const map = (L as any).map(el, {
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, keyboard: false,
      fadeAnimation: false,
    });
    mapRef.current = map;

    (TILE_SETS[mapVisualStyle] || TILE_SETS.cinematic).forEach(t =>
      (L as any).tileLayer(t.url, t.opts).addTo(map)
    );

    const lls = waypoints.map(w => [w.lat, w.lon]);
    map.fitBounds((L as any).latLngBounds(lls), { padding: [55, 55] });

    map.once("moveend", () => {
      map.invalidateSize();
      const NS = "http://www.w3.org/2000/svg";
      const XL = "http://www.w3.org/1999/xlink";
      const box = el.getBoundingClientRect();
      const svg = document.createElementNS(NS, "svg");
      svg.style.cssText = `position:absolute;top:0;left:0;width:${box.width}px;height:${box.height}px;pointer-events:none;z-index:450;overflow:visible;`;
      const defs = document.createElementNS(NS, "defs");

      // Style config per theme
      type StyleCfg = { lw: number; glowR: number; glowO: number; vSize: number; bend: number; pill: string; textColor: string; labelStroke: string };
      const STYLE_CFG: Record<MapVisualStyle, StyleCfg> = {
        cinematic:  { lw: 3,  glowR: 7,  glowO: 0.28, vSize: 32, bend: 0.44, pill: "rgba(0,0,0,0.85)",  textColor: "#ffffff", labelStroke: lineColor },
        cartoon:    { lw: 9,  glowR: 3,  glowO: 0.55, vSize: 38, bend: 0.54, pill: "rgba(20,20,40,0.9)", textColor: "#ffffff", labelStroke: lineColor },
        neon:       { lw: 2.5,glowR: 16, glowO: 0.45, vSize: 34, bend: 0.40, pill: "rgba(0,0,0,0.92)",  textColor: lineColor,  labelStroke: lineColor },
        "3d-route": { lw: 5,  glowR: 9,  glowO: 0.30, vSize: 28, bend: 0.50, pill: "rgba(0,0,0,0.80)",  textColor: "#ffffff", labelStroke: lineColor },
        social:     { lw: 4,  glowR: 5,  glowO: 0.25, vSize: 28, bend: 0.36, pill: "rgba(255,255,255,0.93)", textColor: "#111827", labelStroke: lineColor },
      };
      const cfg = STYLE_CFG[mapVisualStyle] || STYLE_CFG.cinematic;
      const spd = Math.max(0.3, mapAnimSpeed || 1);

      const VEHICLES: Record<MapVehicle, string> = { plane: "✈", car: "🚗", train: "🚂", ship: "🚢" };
      const vh = VEHICLES[mapVehicle] || "✈";

      // Three layered glow filters (outer bloom → mid → inner)
      [24, 10, 4].forEach((stdDev, gi) => {
        const flt = document.createElementNS(NS, "filter");
        flt.id = `sfG${gi}`;
        flt.setAttribute("x", "-200%"); flt.setAttribute("y", "-200%");
        flt.setAttribute("width", "500%"); flt.setAttribute("height", "500%");
        const fb = document.createElementNS(NS, "feGaussianBlur");
        fb.setAttribute("in", "SourceGraphic"); fb.setAttribute("stdDeviation", `${stdDev}`);
        fb.setAttribute("result", "blur");
        const fm = document.createElementNS(NS, "feMerge");
        ["blur","SourceGraphic"].forEach(inp => {
          const n = document.createElementNS(NS, "feMergeNode"); n.setAttribute("in", inp); fm.appendChild(n);
        });
        flt.appendChild(fb); flt.appendChild(fm);
        defs.appendChild(flt);
      });
      svg.appendChild(defs);
      el.appendChild(svg);

      // ── Draw each route segment ──────────────────────────────────────────
      waypoints.slice(0, -1).forEach((wp, i) => {
        const next = waypoints[i + 1];
        const A = map.latLngToContainerPoint([wp.lat, wp.lon]);
        const B = map.latLngToContainerPoint([next.lat, next.lon]);
        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const Cx = (A.x + B.x) / 2 - dy * 0.28;
        const Cy = (A.y + B.y) / 2 - Math.max(len * cfg.bend, 32);
        const d = `M${A.x},${A.y} Q${Cx},${Cy} ${B.x},${B.y}`;
        const dl = Math.ceil(len * 1.9);
        const delay = i * (1.1 / spd);

        const pd = document.createElementNS(NS, "path");
        pd.setAttribute("id", `sp${i}`); pd.setAttribute("d", d);
        defs.appendChild(pd);

        // Outer bloom + mid glow halos (neon gets extra intensity)
        if (mapLineStyle !== "dotted") {
          const glowPasses = mapVisualStyle === "neon" ? 3 : mapVisualStyle === "cartoon" ? 1 : 2;
          for (let g = glowPasses - 1; g >= 0; g--) {
            const gh = document.createElementNS(NS, "path");
            gh.setAttribute("d", d); gh.setAttribute("fill", "none");
            gh.setAttribute("stroke", lineColor);
            gh.setAttribute("stroke-width", `${cfg.lw * (g === 0 ? 14 : g === 1 ? 6 : 2.5)}`);
            gh.setAttribute("opacity", `${cfg.glowO / (g + 1)}`);
            gh.setAttribute("filter", `url(#sfG${g})`);
            gh.setAttribute("stroke-linecap", "round");
            svg.appendChild(gh);
          }
        }

        // 3D shadow effect (3d-route style only)
        if (mapVisualStyle === "3d-route") {
          const shadow = document.createElementNS(NS, "path");
          shadow.setAttribute("d", `M${A.x+4},${A.y+5} Q${Cx+4},${Cy+5} ${B.x+4},${B.y+5}`);
          shadow.setAttribute("fill", "none"); shadow.setAttribute("stroke", "rgba(0,0,0,0.4)");
          shadow.setAttribute("stroke-width", `${cfg.lw + 2}`); shadow.setAttribute("stroke-linecap", "round");
          svg.insertBefore(shadow, svg.firstChild);
        }

        // Main arc line
        const arc = document.createElementNS(NS, "path");
        arc.setAttribute("d", d); arc.setAttribute("fill", "none");
        arc.setAttribute("stroke", lineColor); arc.setAttribute("stroke-width", `${cfg.lw}`);
        arc.setAttribute("stroke-linecap", "round");
        if (mapLineStyle === "dashed") {
          arc.setAttribute("stroke-dasharray", "20 11");
        } else if (mapLineStyle === "dotted") {
          arc.setAttribute("stroke-dasharray", "4 15");
        } else {
          arc.setAttribute("stroke-dasharray", `${dl}`);
          arc.setAttribute("stroke-dashoffset", `${dl}`);
          arc.style.animation = `arcDraw ${(2.2 + i * 0.25) / spd}s cubic-bezier(.4,0,.2,1) ${delay}s forwards`;
        }
        if (mapVisualStyle === "neon") {
          arc.style.filter = `drop-shadow(0 0 4px ${lineColor}) drop-shadow(0 0 10px ${lineColor})`;
          arc.style.animation = [arc.style.animation, "neonFlicker 3s ease-in-out infinite 2s"].filter(Boolean).join(", ");
        }
        svg.appendChild(arc);

        // ── Animated vehicle (SMIL animateMotion) ───────────────────────
        const vehicleStart = mapLineStyle === "dashed" || mapLineStyle === "dotted" ? delay : delay + (0.7 / spd);
        const vehicleDur = (3.8 + i * 0.5) / spd;

        const pl = document.createElementNS(NS, "text");
        pl.setAttribute("font-size", `${cfg.vSize}`);
        pl.setAttribute("text-anchor", "middle");
        pl.setAttribute("dominant-baseline", "middle");
        if (mapVisualStyle === "neon") pl.setAttribute("filter", "url(#sfG1)");
        pl.textContent = vh;

        const mot = document.createElementNS(NS, "animateMotion");
        mot.setAttribute("dur", `${vehicleDur}s`);
        mot.setAttribute("begin", `${vehicleStart}s`);
        mot.setAttribute("repeatCount", "indefinite");
        mot.setAttribute("rotate", mapVehicle === "plane" || mapVehicle === "ship" ? "auto" : "0");
        mot.setAttribute("calcMode", "spline");
        mot.setAttribute("keyTimes", "0;0.5;1");
        mot.setAttribute("keySplines", "0.42 0 0.58 1;0.42 0 0.58 1");
        const mp = document.createElementNS(NS, "mpath");
        mp.setAttributeNS(XL, "xlink:href", `#sp${i}`);
        mot.appendChild(mp); pl.appendChild(mot);

        // Smooth fade in → hold → fade out
        const oa = document.createElementNS(NS, "animate");
        oa.setAttribute("attributeName", "opacity");
        oa.setAttribute("values", "0;0;1;1;1;0.9;0");
        oa.setAttribute("keyTimes", "0;0.05;0.12;0.5;0.88;0.95;1");
        oa.setAttribute("dur", `${vehicleDur}s`);
        oa.setAttribute("begin", `${vehicleStart}s`);
        oa.setAttribute("repeatCount", "indefinite");
        pl.appendChild(oa);

        // Cartoon style: add bounce animation on vehicle
        if (mapVisualStyle === "cartoon") {
          pl.style.animation = `cartoonBounce ${vehicleDur * 0.3}s ease-in-out infinite ${vehicleStart}s`;
        }
        svg.appendChild(pl);

        // Distance badge
        if (showDistance) {
          const km = haversineKm(wp.lat, wp.lon, next.lat, next.lon);
          const mx = 0.25 * A.x + 0.5 * Cx + 0.25 * B.x;
          const my = 0.25 * A.y + 0.5 * Cy + 0.25 * B.y;
          const lbl = `${vh} ${km.toLocaleString()} km`;
          const bw = lbl.length * 6.8 + 14;
          const bg = document.createElementNS(NS, "g");
          bg.style.animation = `arcIn 0.4s ease ${delay + 1.2 / spd}s both`;
          const br = document.createElementNS(NS, "rect");
          br.setAttribute("x", `${mx - bw / 2}`); br.setAttribute("y", `${my - 13}`);
          br.setAttribute("width", `${bw}`); br.setAttribute("height", "24");
          br.setAttribute("rx", "10"); br.setAttribute("fill", cfg.pill);
          br.setAttribute("stroke", lineColor); br.setAttribute("stroke-width", "1.5");
          if (mapVisualStyle === "neon") { br.setAttribute("filter", "url(#sfG2)"); br.setAttribute("stroke-width", "2"); }
          bg.appendChild(br);
          const bt = document.createElementNS(NS, "text");
          bt.setAttribute("x", `${mx}`); bt.setAttribute("y", `${my + 3}`);
          bt.setAttribute("text-anchor", "middle"); bt.setAttribute("dominant-baseline", "middle");
          bt.setAttribute("fill", cfg.textColor === lineColor ? lineColor : "#ffffff");
          bt.setAttribute("font-size", mapVisualStyle === "cartoon" ? "12" : "10.5");
          bt.setAttribute("font-weight", "700");
          bt.setAttribute("font-family", "'Courier New',monospace");
          bt.textContent = lbl; bg.appendChild(bt);
          svg.appendChild(bg);
        }
      });

      // ── City markers ─────────────────────────────────────────────────────
      waypoints.forEach((wp, i) => {
        const pt = map.latLngToContainerPoint([wp.lat, wp.lon]);
        const isStart = i === 0;
        const isEnd = i === waypoints.length - 1;
        const mColor = isStart ? "#22c55e" : isEnd ? (mapVisualStyle === "neon" ? "#ff00cc" : "#ef4444") : lineColor;

        // Multiple animated pulse rings (neon gets 3, others get 2)
        const rings = mapVisualStyle === "neon" ? 3 : 2;
        for (let p = 0; p < rings; p++) {
          const rg = document.createElementNS(NS, "circle");
          rg.setAttribute("cx", `${pt.x}`); rg.setAttribute("cy", `${pt.y}`);
          rg.setAttribute("r", "5"); rg.setAttribute("fill", "none");
          rg.setAttribute("stroke", mColor);
          rg.setAttribute("stroke-width", mapVisualStyle === "neon" ? "2" : "1.5");
          const ra = document.createElementNS(NS, "animate");
          ra.setAttribute("attributeName", "r");
          ra.setAttribute("from", "5"); ra.setAttribute("to", `${20 + p * 10}`);
          ra.setAttribute("dur", `${2.8 + p * 0.5}s`);
          ra.setAttribute("begin", `${i * 0.35 + p * 0.9}s`);
          ra.setAttribute("repeatCount", "indefinite");
          const ro = document.createElementNS(NS, "animate");
          ro.setAttribute("attributeName", "opacity"); ro.setAttribute("values", "0;0.85;0");
          ro.setAttribute("dur", `${2.8 + p * 0.5}s`);
          ro.setAttribute("begin", `${i * 0.35 + p * 0.9}s`);
          ro.setAttribute("repeatCount", "indefinite");
          rg.appendChild(ra); rg.appendChild(ro);
          if (mapVisualStyle === "neon") { rg.setAttribute("filter", "url(#sfG1)"); }
          svg.appendChild(rg);
        }

        // Start/end: big colored emoji dot; mid: filled circle
        if (isStart || isEnd) {
          const star = document.createElementNS(NS, "text");
          star.setAttribute("x", `${pt.x}`); star.setAttribute("y", `${pt.y}`);
          star.setAttribute("text-anchor", "middle"); star.setAttribute("dominant-baseline", "middle");
          star.setAttribute("font-size", mapVisualStyle === "cartoon" ? "26" : "22");
          if (mapVisualStyle === "neon") star.setAttribute("filter", "url(#sfG1)");
          star.textContent = isStart ? "🟢" : "🔴";
          svg.appendChild(star);
        } else {
          const dot = document.createElementNS(NS, "circle");
          dot.setAttribute("cx", `${pt.x}`); dot.setAttribute("cy", `${pt.y}`);
          dot.setAttribute("r", mapVisualStyle === "cartoon" ? "10" : "7");
          dot.setAttribute("fill", mColor);
          dot.setAttribute("filter", "url(#sfG2)");
          svg.appendChild(dot);
          const inn = document.createElementNS(NS, "circle");
          inn.setAttribute("cx", `${pt.x}`); inn.setAttribute("cy", `${pt.y}`);
          inn.setAttribute("r", "3"); inn.setAttribute("fill", "white");
          svg.appendChild(inn);
        }

        // City label pill
        const lg = document.createElementNS(NS, "g");
        lg.style.animation = `arcIn 0.45s ease ${i * 0.4 + 0.5}s both`;
        const lw2 = wp.city.length * 7.8 + (showFlags ? 26 : 20);
        const lh = showFlags ? 42 : 26;
        const lrect = document.createElementNS(NS, "rect");
        lrect.setAttribute("x", `${pt.x - lw2 / 2}`); lrect.setAttribute("y", `${pt.y - lh - 14}`);
        lrect.setAttribute("width", `${lw2}`); lrect.setAttribute("height", `${lh}`);
        lrect.setAttribute("rx", "7"); lrect.setAttribute("fill", cfg.pill);
        lrect.setAttribute("stroke", mColor); lrect.setAttribute("stroke-width", mapVisualStyle === "cartoon" ? "2.5" : "1.5");
        if (mapVisualStyle === "neon") { lrect.setAttribute("filter", "url(#sfG2)"); }
        lg.appendChild(lrect);
        if (showFlags) {
          const ft = document.createElementNS(NS, "text");
          ft.setAttribute("x", `${pt.x}`); ft.setAttribute("y", `${pt.y - lh + 5}`);
          ft.setAttribute("text-anchor", "middle"); ft.setAttribute("font-size", "15");
          ft.textContent = wp.flag; lg.appendChild(ft);
        }
        const ct = document.createElementNS(NS, "text");
        ct.setAttribute("x", `${pt.x}`);
        ct.setAttribute("y", `${pt.y - (showFlags ? 17 : 8)}`);
        ct.setAttribute("text-anchor", "middle");
        ct.setAttribute("fill", cfg.textColor === lineColor ? lineColor : (cfg.textColor || "white"));
        ct.setAttribute("font-size", mapVisualStyle === "cartoon" ? "13.5" : "11.5");
        ct.setAttribute("font-weight", "800");
        ct.setAttribute("font-family", "'Inter','Helvetica Neue',sans-serif");
        ct.setAttribute("letter-spacing", "0.6");
        ct.textContent = wp.city; lg.appendChild(ct);
        svg.appendChild(lg);
      });
    });

    // Fallback: if moveend never fires (offline / mobile tile timeout), draw the SVG after 400ms
    _fallback = setTimeout(() => {
      if (el && !el.querySelector("svg")) map.fire("moveend");
    }, 400);

    }); // end requestAnimationFrame

    return () => {
      cancelAnimationFrame(_raf);
      clearTimeout(_fallback);
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints.map(w => `${w.lat},${w.lon}`).join("|"), lineColor, showDistance, showFlags, mapLineStyle, mapVisualStyle, mapVehicle, mapAnimSpeed]);

  const bgColors: Record<MapVisualStyle, string> = {
    cinematic: "#0d1b2a", cartoon: "#0a0a1a", neon: "#000510",
    "3d-route": "#1a1209", social: "#f8fafc",
  };
  return <div ref={containerRef} className="absolute inset-0" style={{ background: bgColors[mapVisualStyle] || "#0d1b2a", zIndex: 1 }}/>;
}

// ── Professional Timeline constants ─────────────────────────────────────────
const TL_RULER_H  = 24;
const TL_VIDEO_H  = 86;
const TL_AUDIO_H  = 48;
const TL_SFX_H    = 38;
const TL_VOICE_H  = 38;
const TL_CAPTS_H  = 42;
const TL_TEXT_H   = 38;
const TL_OVERL_H  = 38;
const TL_TRANS_H  = 32;
const TL_EFFX_H   = 38;
const TL_LUT_H    = 32;
const TL_MAP_H    = 32;
const TL_LABEL_W  = 60;

function TLLabel({ icon, label, h, muted, onMuteToggle, onClick, active }: { icon: React.ReactNode; label: string; h: number; muted?: boolean; onMuteToggle?: () => void; onClick?: () => void; active?: boolean }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center border-b border-zinc-800/60 flex-shrink-0 relative group/tll transition-colors", onClick && "cursor-pointer hover:bg-zinc-800/40 active:bg-zinc-800/70", active && "bg-zinc-800/30")}
      style={{ height: h }}
      onClick={onClick}
      title={onClick ? `Open ${label} editor` : undefined}>
      {icon}
      <span className={cn("text-[5.5px] font-semibold mt-0.5 tracking-widest uppercase leading-none", active ? "text-white" : "text-zinc-600")}>{label}</span>
      {onClick && !onMuteToggle && (
        <div className="absolute right-0 top-0 bottom-0 w-[2px] opacity-0 group-hover/tll:opacity-100 rounded-r" style={{ background: "currentColor" }} />
      )}
      {onMuteToggle && (
        <button
          className={cn("absolute right-0.5 top-0.5 w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-opacity", muted ? "opacity-100 bg-red-500/20" : "opacity-0 group-hover/tll:opacity-100 hover:bg-zinc-700")}
          onClick={e => { e.stopPropagation(); onMuteToggle(); }}
          title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={6} className="text-red-400" /> : <Volume2 size={6} className="text-zinc-500" />}
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AdminCreatorStudio() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Step state
  const [step, setStep] = useState<AdminStep>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);

  // Trim & timeline
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedCover, setSelectedCover] = useState(0);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [timelineFrames, setTimelineFrames] = useState<string[]>([]);
  const [dragging, setDragging] = useState<"start"|"end"|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit tabs & aspect ratio
  const [editTab, setEditTab] = useState<EditTab>("templates");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

  // Filters
  const [filterPresetId, setFilterPresetId] = useState("normal");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [shadows, setShadows] = useState(0);
  const [highlights, setHighlights] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [grain, setGrain] = useState(0);
  const [sharpen, setSharpen] = useState(false);

  // Speed & audio
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(100);
  const [selectedTrack, setSelectedTrack] = useState<string|null>(null);
  const [customAudioFile, setCustomAudioFile] = useState<File|null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string|null>(null);
  const [audioEffects, setAudioEffects] = useState<AudioEffects>({ bassBoost: false, echo: false, reverb: false, normalize: false, fadeIn: false, fadeOut: false });
  const [trackVolume, setTrackVolume] = useState(80);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Caption layers
  const [captionLayers, setCaptionLayers] = useState<CaptionLayer[]>([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState<number | null>(null);
  const [captionInput, setCaptionInput] = useState("Add your caption here");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("subtitle");
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [captionFontSize, setCaptionFontSize] = useState(22);
  const [captionAiLoading, setCaptionAiLoading] = useState(false);
  const [captionBg, setCaptionBg] = useState(true);
  const [nextCaptionId, setNextCaptionId] = useState(1);
  const draggingCaptionRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Draggable graphic overlays — position as % of canvas
  const [overlayPositions, setOverlayPositions] = useState<Record<string, OverlayPos>>({
    "money-counter": { x: 50, y: 50 }, "year-journey": { x: 50, y: 12 },
    "timeline-story": { x: 50, y: 88 }, "map-route": { x: 50, y: 50 },
    "stats-burst": { x: 50, y: 50 }, "pin-drop": { x: 50, y: 50 },
    "neon-city": { x: 50, y: 50 }, "split-reveal": { x: 50, y: 50 },
  });
  const draggingOverlayRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Export quality & format
  const [exportQuality, setExportQuality] = useState<ExportQuality>("1080p");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");

  // Map visual style, vehicle, animation speed
  const [mapVisualStyle, setMapVisualStyle] = useState<MapVisualStyle>("cinematic");
  const [mapVehicle, setMapVehicle] = useState<MapVehicle>("plane");
  const [mapAnimSpeed, setMapAnimSpeed] = useState(1.0);

  // Voice control & AI action log
  const [voiceActive, setVoiceActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [aiActionLog, setAiActionLog] = useState<string[]>([]);
  const [aiEditorMode, setAiEditorMode] = useState(false);

  // Text layers
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(28);
  const [textPosition, setTextPosition] = useState<"top"|"center"|"bottom">("bottom");
  const [textAnimation, setTextAnimation] = useState<TextAnimation>("none");
  const [textFont, setTextFont] = useState<TextFont>("default");
  const [nextTextId, setNextTextId] = useState(1);

  // Stickers
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [nextStickerId, setNextStickerId] = useState(1);

  // AI subtitle
  const [aiHint, setAiHint] = useState("");
  const [aiSubtitleStyle, setAiSubtitleStyle] = useState<"bold"|"minimal"|"neon"|"classic">("bold");
  const [aiSubtitles, setAiSubtitles] = useState<string[]>([]);
  const [aiSubtitleLoading, setAiSubtitleLoading] = useState(false);

  // ── AI Smart Editor state ─────────────────────────────────────────────────
  const [smartEditLoading, setSmartEditLoading] = useState(false);
  const [smartEditAnalysis, setSmartEditAnalysis] = useState<SmartEditAnalysis | null>(null);
  const [smartEditTranscript, setSmartEditTranscript] = useState("");
  const [smartEditContext, setSmartEditContext] = useState("");
  const [smartEditGoal, setSmartEditGoal] = useState("");
  const [smartEditApplied, setSmartEditApplied] = useState<Set<string>>(new Set());
  const [smartEditShowContext, setSmartEditShowContext] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // AI Camera movement
  const [aiCameraMove, setAiCameraMove] = useState<string | null>(null);
  const [aiCameraLoading, setAiCameraLoading] = useState(false);
  const [aiCameraCustom, setAiCameraCustom] = useState("");

  // AI Motion Analyze
  const [aiMotionAnalyzing, setAiMotionAnalyzing] = useState(false);
  const [aiMotionResult, setAiMotionResult] = useState<AiMotionResult | null>(null);
  const [aiMotionProgress, setAiMotionProgress] = useState("");

  // Track muting (timeline)
  const [mutedTracks, setMutedTracks] = useState({ video: false, music: false, voice: false });
  // Visible timeline tracks — only tracks with content show by default
  const [visibleTracks, setVisibleTracks] = useState<Set<string>>(new Set(["video"]));
  const [addTrackMenuOpen, setAddTrackMenuOpen] = useState(false);

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "clip" | "audio"; clipIdx?: number } | null>(null);

  // Music preview (oscillator)
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);

  // Audio start offset (seconds into video when music starts)
  const [audioStartOffset, setAudioStartOffset] = useState(0);

  // Split reveal divider position (%)
  const [splitRevealPos, setSplitRevealPos] = useState(42);

  // Neon city customisation
  const [neonCityColor, setNeonCityColor] = useState("#39ff14");
  const [neonCityLabel, setNeonCityLabel] = useState("CITY LIFE");

  // Stats burst editable items
  const [statsBurstItems, setStatsBurstItems] = useState([
    { label: "Followers", value: "10K", suffix: "+" },
    { label: "Events",    value: "500", suffix: "+" },
    { label: "Views",     value: "1M",  suffix: "" },
    { label: "Cities",    value: "12",  suffix: "" },
  ]);

  // AI translation
  const [aiTransLang, setAiTransLang] = useState("en");
  const [aiTransLoading, setAiTransLoading] = useState(false);

  // AI auto-caption
  const [aiCaptionVideoDesc, setAiCaptionVideoDesc] = useState("");
  const [aiAutoCaptionLoading, setAiAutoCaptionLoading] = useState(false);

  // Sound & template selection
  const [selectedMotionId, setSelectedMotionId] = useState<string|null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string|null>(null);
  const [selectedSoundFx, setSelectedSoundFx] = useState<string|null>(null);
  const [soundCategory, setSoundCategory] = useState("intro");
  const [selectedIntroHook, setSelectedIntroHook] = useState<string|null>(null);

  // AI Beats Prescription
  const [aiBeatsLoading, setAiBeatsLoading] = useState(false);
  const [aiBeatsResult, setAiBeatsResult] = useState<any>(null);
  const [aiBeatsPrompt, setAiBeatsPrompt] = useState("");

  // Beat Synthesizer
  const [beatGenBpm, setBeatGenBpm] = useState(120);
  const [beatGenGenre, setBeatGenGenre] = useState("Hip Hop");
  const [isBeatPlaying, setIsBeatPlaying] = useState(false);
  const beatCtxRef = useRef<AudioContext | null>(null);

  // Effect Timeline Regions
  const [effectRegions, setEffectRegions] = useState<EffectRegion[]>([]);
  const [pendingEffect, setPendingEffect] = useState<Omit<EffectRegion,"id"|"startTime"|"endTime"> | null>(null);
  const [pendingRangeStart, setPendingRangeStart] = useState(0);
  const [pendingRangeEnd, setPendingRangeEnd] = useState(0);
  const motionTextLayerIdRef = useRef<number | null>(null);
  const lastToastDismissRef = useRef<(() => void) | null>(null);

  // AI Director (admin = always unlocked)
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [showMorePanel, setShowMorePanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "Welcome to Admin Creator Studio! I'm your AI Director — fully unlocked for admin use. Ask me for content strategy, captions, hooks, platform analysis, or anything about growing Urban Culture Connect. 🎬👑" },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  // Export & platform
  const [selectedPlatform, setSelectedPlatform] = useState<string|null>(null);
  const [selectedTransition, setSelectedTransition] = useState<string|null>(null);
  const [transitionCategory, setTransitionCategory] = useState("cut");

  // Brand kit
  const [brandColors, setBrandColors] = useState(["#ff3b30","#ff9500","#ffffff","#000000","#007aff","#af52de"]);
  const [brandFont, setBrandFont] = useState<TextFont>("bold");
  const [lowerThirdEnabled, setLowerThirdEnabled] = useState(false);
  const [lowerThirdText, setLowerThirdText] = useState("");
  const [lowerThirdStyle, setLowerThirdStyle] = useState("bold-bar");
  const [progressBarEnabled, setProgressBarEnabled] = useState(false);
  const [progressBarColor, setProgressBarColor] = useState("#ffffff");
  const [logoWatermark, setLogoWatermark] = useState("@UrbanCultureConnect");
  const [logoPosition, setLogoPosition] = useState("bottom-right");

  // Viral intelligence
  const [viralScore, setViralScore] = useState<number|null>(null);
  const [viralBreakdown, setViralBreakdown] = useState<{hook:number;energy:number;trends:number;optimize:number}|null>(null);
  const [viralTips, setViralTips] = useState<string[]>([]);
  const [viralPlatformBest, setViralPlatformBest] = useState("");
  const [viralScoreLoading, setViralScoreLoading] = useState(false);
  const [hookCategory, setHookCategory] = useState("curiosity");
  const [copiedKey, setCopiedKey] = useState<string|null>(null);
  const [selectedHashtagPack, setSelectedHashtagPack] = useState<string|null>(null);

  // Admin-exclusive: Schedule
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedulePlatforms, setSchedulePlatforms] = useState<string[]>(["ig-reels"]);
  const [autoPostIG, setAutoPostIG] = useState(false);
  const [autoPostTikTok, setAutoPostTikTok] = useState(false);

  // Admin-exclusive: Batch
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // Admin-exclusive: Caption Library
  const [savedCaptions, setSavedCaptions] = useState<SavedCaption[]>(ADMIN_CAPTION_TEMPLATES);
  const [newCaptionTitle, setNewCaptionTitle] = useState("");
  const [newCaptionTags, setNewCaptionTags] = useState("");
  const [captionPlatformTag, setCaptionPlatformTag] = useState("All");

  // Admin-exclusive: Analytics
  const [analyticsView, setAnalyticsView] = useState<"times"|"formats"|"trends">("times");

  // Multi-clip timeline
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [activeClipIdx, setActiveClipIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipCurrentTime, setClipCurrentTime] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(60);
  const addClipInputRef = useRef<HTMLInputElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const [draggingTrimClip, setDraggingTrimClip] = useState<{ clipIdx: number; handle: "start" | "end"; startX: number; startVal: number } | null>(null);
  const [tlDragClip, setTlDragClip] = useState<{ idx: number; startX: number } | null>(null);
  const [tlDropIdx, setTlDropIdx] = useState<number | null>(null);
  const [clipTransitionClass, setClipTransitionClass] = useState("");
  const prevActiveClipIdxRef = useRef(-1);
  const sfxAudioCtxRef = useRef<AudioContext | null>(null);
  const sfxOscRef = useRef<OscillatorNode | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const voMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const [voiceOverUrl, setVoiceOverUrl] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const exportRecorderRef = useRef<MediaRecorder | null>(null);

  // Help overlay & tool mode
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [activeToolMode, setActiveToolMode] = useState<"select"|"split"|"trim">("select");

  // Per-clip frame thumbnail cache (clipId → dataURL[])
  const [clipFrameCache, setClipFrameCache] = useState<Record<string, string[]>>({});

  // Trim-drag tooltip { time, side }
  const [trimTooltip, setTrimTooltip] = useState<{ time: number; side: "start"|"end" } | null>(null);

  // Effect region resize/drag
  // Current video time (updated on timeupdate) — used for text layer visibility
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  // Text block timeline drag
  const [draggingTextBlock, setDraggingTextBlock] = useState<{
    id: number; handle: "start"|"end"|"move"; startX: number; startStart: number; startEnd: number;
  } | null>(null);

  const [draggingEffectRegion, setDraggingEffectRegion] = useState<{
    id: string; handle: "start"|"end"|"move"; startX: number; startStart: number; startEnd: number;
  } | null>(null);

  // Professional multi-layer timeline
  const [tlExpanded, setTlExpanded] = useState(true);
  const [tlScrubTime, setTlScrubTime] = useState<number | null>(null);
  const [tlScrubX, setTlScrubX] = useState(0);
  const tlScrollRef = useRef<HTMLDivElement>(null);
  const tlLabelRef  = useRef<HTMLDivElement>(null);
  const tlIsDraggingPlayheadRef = useRef(false);

  // Real-time Graphic Overlays
  const [selectedGraphicOverlay, setSelectedGraphicOverlay] = useState<string | null>(null);
  const [counterTarget, setCounterTarget] = useState(10000);
  const [counterCurrent, setCounterCurrent] = useState(0);
  const [counterPrefix, setCounterPrefix] = useState("€");
  const [counterSuffix, setCounterSuffix] = useState("");
  const [counterLabel, setCounterLabel] = useState("Revenue Generated");
  const [yearFrom, setYearFrom] = useState(2015);
  const [yearTo, setYearTo] = useState(new Date().getFullYear());
  const [yearCurrent, setYearCurrent] = useState(2015);
  const [mapCity, setMapCity] = useState("Amsterdam"); // kept for pin-drop overlay
  const [mapWaypoints, setMapWaypoints] = useState<MapWaypointItem[]>([
    { id: "wp-1", city: "Amsterdam", lat: 52.37, lon: 4.90,  flag: "🇳🇱", country: "Netherlands" },
    { id: "wp-2", city: "Paris",     lat: 48.86, lon: 2.35,  flag: "🇫🇷", country: "France"      },
  ]);
  const [mapLineColor,        setMapLineColor]        = useState("#39ff14");
  const [mapLineStyle,        setMapLineStyle]        = useState<"solid"|"dashed"|"dotted"|"glowing">("glowing");
  const [mapStyleMode,        setMapStyleMode]        = useState<"dark"|"neon"|"minimal">("dark");
  const [mapShowDistance,     setMapShowDistance]     = useState(true);
  const [mapShowFlags,        setMapShowFlags]        = useState(true);
  const [mapHighlightCountry, setMapHighlightCountry] = useState<string | null>(null);
  const [mapHighlightColor,   setMapHighlightColor]   = useState("#39ff14");
  const [mapAiLoading,        setMapAiLoading]        = useState(false);
  const [mapSearchQuery,      setMapSearchQuery]      = useState("");
  const [mapShowCitySugg,     setMapShowCitySugg]     = useState(false);
  const [timelineSteps, setTimelineSteps] = useState(["2015", "2018", "2021", "Now"]);
  const [timelineActive, setTimelineActive] = useState(0);
  const [statsItems] = useState([
    { label: "Followers", target: 10000, suffix: "+" },
    { label: "Events",    target: 500,   suffix: "+" },
  ]);

  // Video pan / crop offset (0–100 %, default center)
  const [videoOffset, setVideoOffset] = useState({ x: 50, y: 50 });
  const videoPanRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Canvas text dragging & selection
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<number | null>(null);
  const [editingTextLayerId, setEditingTextLayerId] = useState<number | null>(null);
  const canvasDivRef = useRef<HTMLDivElement>(null);
  const draggingTextRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Tab group filter for 19-tab navigation
  const [tabGroup, setTabGroup] = useState<string | null>(null);

  // Undo / redo
  const undoHistoryRef = useRef<Array<{ textLayers: TextLayer[]; stickerLayers: StickerLayer[] }>>([{ textLayers: [], stickerLayers: [] }]);
  const undoPointerRef = useRef(0);
  const textLayersRef = useRef(textLayers);
  const stickerLayersRef = useRef(stickerLayers);
  textLayersRef.current = textLayers;
  stickerLayersRef.current = stickerLayers;

  // Derived
  const currentPreset = FILTER_PRESETS.find(p => p.id === filterPresetId) ?? FILTER_PRESETS[0];
  const cssFilter = buildCssFilter(currentPreset, brightness, contrast, saturation, warmth);
  const startPct = videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0;
  const endPct   = videoDuration > 0 ? (trimEnd   / videoDuration) * 100 : 100;

  // Inject keyframes
  useEffect(() => {
    if (!document.getElementById("admin-studio-kf")) {
      const el = document.createElement("style"); el.id = "admin-studio-kf"; el.textContent = STUDIO_KEYFRAMES;
      document.head.appendChild(el);
    }
    return () => { document.getElementById("admin-studio-kf")?.remove(); };
  }, []);

  // Scroll AI to bottom
  useEffect(() => { aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      // Ctrl/Cmd shortcuts — work even inside inputs for safety
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (e.key === "d") { e.preventDefault(); handleDuplicateClip(); return; }
      }
      if (inInput) return;
      // Non-input shortcuts
      if (e.key === " " || e.code === "Space") { e.preventDefault(); handlePlayPause(); return; }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); handleSplitClip(); return; }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); setShowHelpOverlay(v => !v); return; }
      if (e.key === "Escape") { setShowHelpOverlay(false); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); handleDeleteClip(activeClipIdx); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (!previewVideoRef.current) return;
        const step = e.shiftKey ? 5 : 1;
        const dir = e.key === "ArrowLeft" ? -step : step;
        previewVideoRef.current.currentTime = Math.max(0, Math.min(previewVideoRef.current.currentTime + dir, videoDuration));
        return;
      }
      if (e.key === "=" || e.key === "+") { e.preventDefault(); setPxPerSec(p => Math.min(200, p + 15)); return; }
      if (e.key === "-") { e.preventDefault(); setPxPerSec(p => Math.max(15, p - 15)); return; }
      if (e.key === "[") {
        e.preventDefault();
        const ct = previewVideoRef.current?.currentTime ?? 0;
        setClips(prev => prev.map((c, i) => i === activeClipIdx ? { ...c, trimStart: Math.max(0, Math.min(ct, c.trimEnd - 0.2)) } : c));
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        const ct = previewVideoRef.current?.currentTime ?? 0;
        setClips(prev => prev.map((c, i) => i === activeClipIdx ? { ...c, trimEnd: Math.min(c.duration, Math.max(ct, c.trimStart + 0.2)) } : c));
        return;
      }
      if (e.key === "t" || e.key === "T") { e.preventDefault(); setActiveToolMode(m => m === "trim" ? "select" : "trim"); return; }
      if (e.key === "x" || e.key === "X") { e.preventDefault(); setActiveToolMode(m => m === "split" ? "select" : "split"); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeClipIdx, videoDuration, clips]);

  // Apply CSS filter, speed & volume to preview — all synced
  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.style.filter = cssFilter;
      previewVideoRef.current.playbackRate = speed;
      previewVideoRef.current.volume = muted ? 0 : Math.max(0, Math.min(1, audioVolume / 100));
    }
  }, [cssFilter, speed, audioVolume, muted]);

  // ── Audio track playback — sync with video ─────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const video = previewVideoRef.current;
    if (!audio) return;
    const trackUrl = selectedTrack === "custom" ? customAudioUrl : (MUSIC_TRACKS.find(t => t.id === selectedTrack)?.url ?? null);
    if (!trackUrl) { audio.pause(); audio.src = ""; return; }
    if (audio.src !== trackUrl) { audio.src = trackUrl; }
    audio.volume = Math.max(0, Math.min(1, trackVolume / 100));
    audio.loop = true;
    if (!video) return;
    const onPlay  = () => { audio.play().catch(() => {}); };
    const onPause = () => audio.pause();
    const onSeek  = () => { audio.currentTime = video.currentTime % (audio.duration || 999); };
    video.addEventListener("play",  onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeek);
    return () => {
      video.removeEventListener("play",  onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeek);
      audio.pause();
    };
  }, [selectedTrack, customAudioUrl, trackVolume, mutedTracks.music, audioStartOffset]);

  // ── Voice-over audio sync (plays voiceover in preview alongside video) ────
  useEffect(() => {
    const voiceAudio = voiceAudioRef.current;
    const video = previewVideoRef.current;
    if (!voiceAudio || !voiceOverUrl) { voiceAudio?.pause(); return; }
    if (voiceAudio.src !== voiceOverUrl) { voiceAudio.src = voiceOverUrl; }
    voiceAudio.volume = mutedTracks.voice ? 0 : 1;
    if (!video) return;
    const onPlay  = () => { voiceAudio.play().catch(() => {}); };
    const onPause = () => voiceAudio.pause();
    const onSeek  = () => { voiceAudio.currentTime = Math.min(video.currentTime, voiceAudio.duration || video.currentTime); };
    video.addEventListener("play",   onPlay);
    video.addEventListener("pause",  onPause);
    video.addEventListener("seeked", onSeek);
    return () => {
      video.removeEventListener("play",   onPlay);
      video.removeEventListener("pause",  onPause);
      video.removeEventListener("seeked", onSeek);
      voiceAudio.pause();
    };
  }, [voiceOverUrl, mutedTracks.voice]);

  // ── Auto-show / auto-hide timeline tracks based on content ────────────────
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); selectedTrack ? n.add("music") : n.delete("music"); return n; });
  }, [selectedTrack]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); voiceOverUrl ? n.add("voice") : n.delete("voice"); return n; });
  }, [voiceOverUrl]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); selectedSoundFx ? n.add("sfx") : n.delete("sfx"); return n; });
  }, [selectedSoundFx]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); captionLayers.length > 0 ? n.add("capts") : n.delete("capts"); return n; });
  }, [captionLayers.length]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); textLayers.length > 0 ? n.add("text") : n.delete("text"); return n; });
  }, [textLayers.length]);
  useEffect(() => {
    const MAP_OVERLAYS = ["map-route", "pin-drop"];
    const hasOverl = effectRegions.some(r => r.type === "overlay" && !MAP_OVERLAYS.includes(r.effectId));
    const hasMtn   = effectRegions.some(r => r.type === "motion" || r.type === "template");
    setVisibleTracks(v => { const n = new Set(v); hasOverl ? n.add("overl") : n.delete("overl"); hasMtn ? n.add("mtn") : n.delete("mtn"); return n; });
  }, [effectRegions]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); clips.length > 1 ? n.add("trans") : n.delete("trans"); return n; });
  }, [clips.length]);
  useEffect(() => {
    setVisibleTracks(v => { const n = new Set(v); (filterPresetId && filterPresetId !== "normal") ? n.add("lut") : n.delete("lut"); return n; });
  }, [filterPresetId]);
  useEffect(() => {
    const isMap = selectedGraphicOverlay === "map-route" || selectedGraphicOverlay === "pin-drop";
    setVisibleTracks(v => { const n = new Set(v); isMap ? n.add("map") : n.delete("map"); return n; });
  }, [selectedGraphicOverlay]);

  // ── Audio effects via Web Audio API ───────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (audioSourceRef.current) { try { audioSourceRef.current.disconnect(); } catch {} }
      const src = ctx.createMediaElementSource(audio);
      audioSourceRef.current = src;
      let node: AudioNode = src;
      if (audioEffects.bassBoost) {
        const bass = ctx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 200; bass.gain.value = 8;
        node.connect(bass); node = bass;
      }
      if (audioEffects.echo) {
        const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.28;
        const feedback = ctx.createGain(); feedback.gain.value = 0.38;
        node.connect(delay); delay.connect(feedback); feedback.connect(delay);
        const wet = ctx.createGain(); wet.gain.value = 0.45;
        delay.connect(wet); wet.connect(ctx.destination);
      }
      node.connect(ctx.destination);
    } catch {}
  }, [audioEffects]);

  // File handling
  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 500 * 1024 * 1024) { toast({ title: "File too large", description: "Max 500 MB", variant: "destructive" }); return; }
    const url = URL.createObjectURL(f);
    setFile(f); setPreviewUrl(url); setStep("edit");
    const v = document.createElement("video"); v.preload = "metadata"; v.src = url;
    v.onloadedmetadata = () => setClips([{ id: "clip-0", url, name: f.name, duration: v.duration, trimStart: 0, trimEnd: v.duration }]);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (!f || !f.type.startsWith("video/")) return;
    const url = URL.createObjectURL(f);
    setFile(f); setPreviewUrl(url); setStep("edit");
    const v = document.createElement("video"); v.preload = "metadata"; v.src = url;
    v.onloadedmetadata = () => setClips([{ id: "clip-0", url, name: f.name, duration: v.duration, trimStart: 0, trimEnd: v.duration }]);
  };

  // Multi-clip: add extra clips to timeline
  const handleAddClip = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).filter(f => f.type.startsWith("video/")).forEach(f => {
      const url = URL.createObjectURL(f);
      const v = document.createElement("video"); v.preload = "metadata"; v.src = url;
      v.onloadedmetadata = () => setClips(prev => [...prev, { id: `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`, url, name: f.name, duration: v.duration, trimStart: 0, trimEnd: v.duration }]);
    });
    e.target.value = "";
  };

  // Play / pause all clips in sequence
  const handlePlayPause = () => {
    if (!previewVideoRef.current) return;
    if (isPlaying) { previewVideoRef.current.pause(); setIsPlaying(false); }
    else { previewVideoRef.current.currentTime = Math.max(clips[activeClipIdx]?.trimStart ?? 0, previewVideoRef.current.currentTime); previewVideoRef.current.play(); setIsPlaying(true); }
  };

  // Refs for time-based effect switching (avoid setState churn on every frame)
  const activeRegionTemplateRef = useRef<string | null>(null);
  const activeRegionMotionRef = useRef<string | null>(null);
  const activeRegionOverlayRef = useRef<string | null>(null);

  // Enforce trim bounds + auto-advance clips + apply time-based effects
  const handleVideoTimeUpdate = () => {
    if (!previewVideoRef.current) return;
    const ct = previewVideoRef.current.currentTime;
    setClipCurrentTime(ct);
    setCurrentVideoTime(ct);
    const clip = clips[activeClipIdx];
    if (clip && ct >= clip.trimEnd - 0.05) {
      if (activeClipIdx < clips.length - 1) {
        setActiveClipIdx(i => {
          const next = i + 1;
          // Apply visual clip transition
          if (selectedTransition) {
            const transMap: Record<string, string> = {
              fade: "admin-trans-fade", wipe: "admin-trans-wipe", zoom: "admin-trans-zoom",
              blur: "admin-trans-blur", flash: "admin-trans-flash", slide: "admin-trans-slide",
              glitch: "admin-trans-glitch", spin: "admin-trans-spin",
            };
            const cls = transMap[selectedTransition] || "admin-trans-fade";
            setClipTransitionClass(cls);
            setTimeout(() => setClipTransitionClass(""), 400);
          }
          return next;
        });
      } else {
        previewVideoRef.current.pause(); setIsPlaying(false);
        previewVideoRef.current.currentTime = clips[0]?.trimStart ?? 0;
        setActiveClipIdx(0);
      }
    }
    // Time-based effect region switching
    if (effectRegions.length > 0) {
      const active = effectRegions.filter(r => ct >= r.startTime && ct <= r.endTime);
      const tpl = active.filter(r => r.type === "template").at(-1)?.effectId ?? null;
      const mot = active.filter(r => r.type === "motion").at(-1)?.effectId ?? null;
      const ovl = active.filter(r => r.type === "overlay").at(-1)?.effectId ?? null;
      if (tpl !== activeRegionTemplateRef.current) {
        activeRegionTemplateRef.current = tpl;
        if (tpl) { const t = STUDIO_TEMPLATES.find(x => x.id === tpl); if (t) applyTemplate(t); } else { resetFilters(); resetAdjust(); }
      }
      if (mot !== activeRegionMotionRef.current) { activeRegionMotionRef.current = mot; setSelectedMotionId(mot); }
      if (ovl !== activeRegionOverlayRef.current) { activeRegionOverlayRef.current = ovl; setSelectedGraphicOverlay(ovl); }
    }
  };

  // Split active clip at current playhead position
  const handleSplitClip = () => {
    if (!previewVideoRef.current || !clips[activeClipIdx]) return;
    const ct = previewVideoRef.current.currentTime;
    const clip = clips[activeClipIdx];
    if (ct <= clip.trimStart + 0.1 || ct >= clip.trimEnd - 0.1) { toast({ title: "Move playhead inside the clip to split", variant: "destructive" }); return; }
    const second: ClipItem = { ...clip, id: `clip-${Date.now()}`, trimStart: ct };
    setClips(prev => [...prev.slice(0, activeClipIdx).map(c => c), { ...clip, trimEnd: ct }, second, ...prev.slice(activeClipIdx + 1)]);
    toast({ title: "Clip split!" });
  };

  // Delete a clip from timeline
  const handleDeleteClip = (idx: number) => {
    if (clips.length <= 1) { toast({ title: "Cannot remove the only clip", variant: "destructive" }); return; }
    pushUndo();
    setClips(prev => prev.filter((_, i) => i !== idx));
    setActiveClipIdx(i => Math.max(0, Math.min(i, clips.length - 2)));
    toast({ title: "Clip removed — Ctrl+Z to undo" });
  };

  // Duplicate the active clip
  const handleDuplicateClip = () => {
    const clip = clips[activeClipIdx]; if (!clip) return;
    pushUndo();
    const copy = { ...clip, id: `clip-${Date.now()}-dup` };
    setClips(prev => [...prev.slice(0, activeClipIdx + 1), copy, ...prev.slice(activeClipIdx + 1)]);
    toast({ title: "Clip duplicated" });
  };

  // Batch file pick
  const handleBatchPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith("video/")).slice(0, 10);
    const items: BatchItem[] = files.map(f => ({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f), caption: "", status: "queued" }));
    setBatchQueue(prev => [...prev, ...items]);
    toast({ title: `${files.length} video${files.length > 1 ? "s" : ""} added to batch queue` });
  };

  // Video metadata & thumbnails
  useEffect(() => {
    if (!previewUrl) return;
    const vid = document.createElement("video"); vid.preload = "metadata"; vid.src = previewUrl; vid.crossOrigin = "anonymous";
    vid.onloadedmetadata = () => {
      const dur = vid.duration; setVideoDuration(dur); setTrimEnd(dur);
      generateTimelineFrames(previewUrl, dur); generateThumbnails(previewUrl, dur);
    };
  }, [previewUrl]);

  const generateTimelineFrames = (url: string, dur: number) => {
    const count = 20; const frames: string[] = []; let idx = 0;
    const vid = document.createElement("video"); vid.preload = "auto"; vid.src = url; vid.muted = true;
    const canvas = document.createElement("canvas"); canvas.width = 60; canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    vid.addEventListener("seeked", () => { ctx.drawImage(vid, 0, 0, 60, 80); frames.push(canvas.toDataURL("image/jpeg", 0.5)); idx++; if (idx < count) vid.currentTime = (idx / count) * dur; else setTimelineFrames(frames); });
    vid.onloadeddata = () => { vid.currentTime = 0; };
  };

  // Generate frames for a specific clip and cache them by clip id
  const generateClipFrames = (clipId: string, url: string, trimStart: number, trimEnd: number) => {
    const dur = trimEnd - trimStart; if (dur <= 0) return;
    const count = Math.max(6, Math.min(30, Math.ceil(dur * 3)));
    const frames: string[] = []; let idx = 0;
    const vid = document.createElement("video"); vid.preload = "auto"; vid.src = url; vid.muted = true;
    const canvas = document.createElement("canvas"); canvas.width = 60; canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    vid.addEventListener("seeked", () => {
      ctx.drawImage(vid, 0, 0, 60, 80);
      frames.push(canvas.toDataURL("image/jpeg", 0.5));
      idx++;
      if (idx < count) vid.currentTime = trimStart + (idx / count) * dur;
      else setClipFrameCache(prev => ({ ...prev, [clipId]: frames }));
    });
    vid.onloadeddata = () => { vid.currentTime = trimStart; };
  };

  const generateThumbnails = (url: string, dur: number) => {
    const thumbs: string[] = []; let idx = 0;
    const vid = document.createElement("video"); vid.preload = "auto"; vid.src = url; vid.muted = true;
    const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    vid.addEventListener("seeked", () => { ctx.drawImage(vid, 0, 0, 120, 160); thumbs.push(canvas.toDataURL("image/jpeg", 0.7)); idx++; if (idx < THUMBNAIL_COUNT) vid.currentTime = ((idx + 0.5) / THUMBNAIL_COUNT) * dur; else { setThumbnails(thumbs); setCoverDataUrl(thumbs[0] || null); } });
    vid.onloadeddata = () => { vid.currentTime = 0.1; };
  };

  // Trim drag
  const getClientX = useCallback((e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX, []);
  const handleTimelineMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (getClientX(e) - rect.left) / rect.width));
    const time = pct * videoDuration;
    if (dragging === "start") setTrimStart(Math.min(time, trimEnd - 0.5));
    else setTrimEnd(Math.max(time, trimStart + 0.5));
  }, [dragging, videoDuration, trimStart, trimEnd, getClientX]);
  const handleTimelineEnd = useCallback(() => setDragging(null), []);
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("mousemove", handleTimelineMove); window.addEventListener("mouseup", handleTimelineEnd);
    window.addEventListener("touchmove", handleTimelineMove, { passive: false }); window.addEventListener("touchend", handleTimelineEnd);
    return () => { window.removeEventListener("mousemove", handleTimelineMove); window.removeEventListener("mouseup", handleTimelineEnd); window.removeEventListener("touchmove", handleTimelineMove); window.removeEventListener("touchend", handleTimelineEnd); };
  }, [dragging, handleTimelineMove, handleTimelineEnd]);

  // Switch video src when active clip changes
  useEffect(() => {
    if (!previewVideoRef.current || !clips[activeClipIdx]) return;
    const clip = clips[activeClipIdx];
    if (previewVideoRef.current.src !== clip.url) { previewVideoRef.current.src = clip.url; }
    previewVideoRef.current.currentTime = clip.trimStart;
    if (isPlaying) previewVideoRef.current.play();
  }, [activeClipIdx]);

  // Trim drag for multi-clip timeline (mouse + touch) — with tooltip
  useEffect(() => {
    if (!draggingTrimClip) return;
    const getClientX = (e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const dx = getClientX(e) - draggingTrimClip.startX;
      const dt = dx / pxPerSec;
      setClips(prev => prev.map((c, i) => {
        if (i !== draggingTrimClip.clipIdx) return c;
        if (draggingTrimClip.handle === "start") {
          const newVal = Math.max(0, Math.min(c.trimEnd - 0.5, draggingTrimClip.startVal + dt));
          setTrimTooltip({ time: newVal, side: "start" });
          return { ...c, trimStart: newVal };
        }
        const newVal = Math.min(c.duration, Math.max(c.trimStart + 0.5, draggingTrimClip.startVal + dt));
        setTrimTooltip({ time: newVal, side: "end" });
        return { ...c, trimEnd: newVal };
      }));
    };
    const onUp = () => { setDraggingTrimClip(null); setTrimTooltip(null); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingTrimClip, pxPerSec]);

  // Generate frames for new clips
  useEffect(() => {
    clips.forEach(clip => {
      if (!clipFrameCache[clip.id]) {
        generateClipFrames(clip.id, clip.url, clip.trimStart, clip.trimEnd);
      }
    });
  }, [clips.map(c => c.id).join(",")]);

  // Effect region drag/resize (mouse + touch)
  useEffect(() => {
    if (!draggingEffectRegion) return;
    const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
    const getClientX = (e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const dx = getClientX(e) - draggingEffectRegion.startX;
      const dt = dx / pxPerSec;
      setEffectRegions(prev => prev.map(r => {
        if (r.id !== draggingEffectRegion.id) return r;
        if (draggingEffectRegion.handle === "start") {
          return { ...r, startTime: Math.max(0, Math.min(draggingEffectRegion.startStart + dt, r.endTime - 0.2)) };
        }
        if (draggingEffectRegion.handle === "end") {
          return { ...r, endTime: Math.min(totalDur, Math.max(draggingEffectRegion.startEnd + dt, r.startTime + 0.2)) };
        }
        // move
        const dur = draggingEffectRegion.startEnd - draggingEffectRegion.startStart;
        const newStart = Math.max(0, Math.min(totalDur - dur, draggingEffectRegion.startStart + dt));
        return { ...r, startTime: newStart, endTime: newStart + dur };
      }));
    };
    const onUp = () => setDraggingEffectRegion(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingEffectRegion, pxPerSec, clips, videoDuration]);

  // Text block timeline drag/resize
  useEffect(() => {
    if (!draggingTextBlock) return;
    const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
    const getClientX = (e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const dx = getClientX(e) - draggingTextBlock.startX;
      const dt = dx / pxPerSec;
      setTextLayers(prev => prev.map(l => {
        if (l.id !== draggingTextBlock.id) return l;
        const st = l.startTime ?? 0; const et = l.endTime ?? Math.min(totalDur, st + 5);
        if (draggingTextBlock.handle === "start") {
          return { ...l, startTime: Math.max(0, Math.min(draggingTextBlock.startStart + dt, et - 0.2)) };
        }
        if (draggingTextBlock.handle === "end") {
          return { ...l, endTime: Math.min(totalDur, Math.max(draggingTextBlock.startEnd + dt, st + 0.2)) };
        }
        const dur = draggingTextBlock.startEnd - draggingTextBlock.startStart;
        const newStart = Math.max(0, Math.min(totalDur - dur, draggingTextBlock.startStart + dt));
        return { ...l, startTime: newStart, endTime: newStart + dur };
      }));
    };
    const onUp = () => setDraggingTextBlock(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingTextBlock, pxPerSec, clips, videoDuration]);

  // Professional timeline: seek to pixel-x position on the track
  const tlTotalDuration = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
  const tlSeekToX = useCallback((x: number) => {
    if (!previewVideoRef.current) return;
    const t = Math.max(0, Math.min(tlTotalDuration, x / pxPerSec));
    let elapsed = 0;
    for (let i = 0; i < clips.length; i++) {
      const dur = clips[i].trimEnd - clips[i].trimStart;
      if (t <= elapsed + dur || i === clips.length - 1) {
        setActiveClipIdx(i);
        previewVideoRef.current.currentTime = clips[i].trimStart + Math.min(t - elapsed, clips[i].trimEnd - clips[i].trimStart);
        break;
      }
      elapsed += dur;
    }
  }, [clips, pxPerSec, tlTotalDuration]);

  // Professional timeline: global mouse+touch handlers for playhead dragging
  useEffect(() => {
    const getClientX = (e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!tlIsDraggingPlayheadRef.current || !tlScrollRef.current) return;
      const rect = tlScrollRef.current.getBoundingClientRect();
      const x = getClientX(e) - rect.left + tlScrollRef.current.scrollLeft;
      tlSeekToX(x);
      setTlScrubX(x);
      setTlScrubTime(Math.max(0, Math.min(tlTotalDuration, x / pxPerSec)));
    };
    const onUp = () => { tlIsDraggingPlayheadRef.current = false; setTlScrubTime(null); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
  }, [tlSeekToX, tlTotalDuration, pxPerSec]);

  // Clip reorder drag (mouse + touch)
  useEffect(() => {
    if (!tlDragClip) return;
    const getClientX = (e: MouseEvent | TouchEvent) => "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const dx = getClientX(e) - tlDragClip.startX;
      const segW = clips.length > 0 ? (tlTotalDuration * pxPerSec) / clips.length : 80;
      const rawIdx = tlDragClip.idx + Math.round(dx / segW);
      setTlDropIdx(Math.max(0, Math.min(clips.length - 1, rawIdx)));
    };
    const onUp = () => {
      if (tlDropIdx !== null && tlDropIdx !== tlDragClip.idx) {
        setClips(prev => {
          const next = [...prev];
          const [moved] = next.splice(tlDragClip.idx, 1);
          next.splice(tlDropIdx!, 0, moved);
          return next;
        });
        setActiveClipIdx(tlDropIdx);
        toast({ title: `Clip moved to position ${tlDropIdx + 1}` });
      }
      setTlDragClip(null);
      setTlDropIdx(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
  }, [tlDragClip, tlDropIdx, clips.length, pxPerSec, tlTotalDuration]);

  // SFX oscillator plays while video is playing
  useEffect(() => {
    if (!isPlaying || !selectedSoundFx) {
      if (sfxAudioCtxRef.current) { sfxAudioCtxRef.current.close(); sfxAudioCtxRef.current = null; sfxOscRef.current = null; }
      return;
    }
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const sound = SOUND_LIBRARY.find(s => s.id === selectedSoundFx);
      const category = sound?.category ?? "ambient";
      const map: Record<string, { freq: number; type: OscillatorType }> = {
        whoosh: { freq: 580, type: "sawtooth" }, impact: { freq: 65, type: "square" },
        bass:   { freq: 52,  type: "sine"     }, rise:   { freq: 310, type: "sine"  },
        cinematic: { freq: 280, type: "triangle" }, urban: { freq: 190, type: "sawtooth" },
        ambient: { freq: 415, type: "sine" },
      };
      const cfg = map[category] ?? { freq: 440, type: "sine" as OscillatorType };
      osc.frequency.value = cfg.freq; osc.type = cfg.type;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      osc.start();
      sfxAudioCtxRef.current = ctx; sfxOscRef.current = osc;
    } catch {}
    return () => { if (sfxAudioCtxRef.current) { sfxAudioCtxRef.current.close(); sfxAudioCtxRef.current = null; sfxOscRef.current = null; } };
  }, [isPlaying, selectedSoundFx]);

  // Counter animation (money-counter & stats-burst)
  useEffect(() => {
    if (selectedGraphicOverlay !== "money-counter" && selectedGraphicOverlay !== "stats-burst") return;
    let cur = 0; setCounterCurrent(0);
    const steps = 80; const inc = counterTarget / steps;
    const id = setInterval(() => { cur += inc; if (cur >= counterTarget) { setCounterCurrent(counterTarget); clearInterval(id); } else setCounterCurrent(Math.floor(cur)); }, 3000 / steps);
    return () => clearInterval(id);
  }, [selectedGraphicOverlay, counterTarget]);

  // Year journey animation
  useEffect(() => {
    if (selectedGraphicOverlay !== "year-journey") return;
    setYearCurrent(yearFrom);
    const id = setInterval(() => setYearCurrent(y => y >= yearTo ? yearFrom : y + 1), 500);
    return () => clearInterval(id);
  }, [selectedGraphicOverlay, yearFrom, yearTo]);

  // Timeline step auto-advance
  useEffect(() => {
    if (selectedGraphicOverlay !== "timeline-story") return;
    setTimelineActive(0);
    const id = setInterval(() => setTimelineActive(s => (s + 1) % timelineSteps.length), 2000);
    return () => clearInterval(id);
  }, [selectedGraphicOverlay, timelineSteps.length]);

  // Text & sticker helpers
  const addTextLayer = (overrides?: Partial<TextLayer>) => {
    const text = overrides?.text || textInput.trim(); if (!text) return;
    const ct = previewVideoRef.current?.currentTime ?? 0;
    const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 10;
    const start = overrides?.startTime ?? ct;
    const end = overrides?.endTime ?? Math.min(totalDur, start + 5);
    setTextLayers(prev => [...prev, {
      id: nextTextId, text,
      color: overrides?.color ?? textColor, size: overrides?.size ?? textSize,
      position: overrides?.position ?? textPosition, animation: overrides?.animation ?? textAnimation,
      font: overrides?.font ?? textFont,
      startTime: start, endTime: end,
    }]);
    setNextTextId(n => n + 1); if (!overrides?.text) setTextInput("");
  };
  const addSticker = (emoji: string) => { setStickerLayers(prev => [...prev, { id: nextStickerId, emoji, x: 20 + (nextStickerId % 5) * 12, y: 20 + (nextStickerId % 4) * 15, size: 40 }]); setNextStickerId(n => n + 1); };

  // Add effect region to timeline
  const addEffectToTimeline = (effect: Omit<EffectRegion,"id"|"startTime"|"endTime">, start: number, end: number) => {
    pushUndo();
    setEffectRegions(prev => [...prev, { ...effect, id: `er-${Date.now()}`, startTime: start, endTime: end, posX: 50, posY: 50 }]);
    toast({ title: `${effect.emoji} Added to timeline (${formatTime(start)} – ${formatTime(end)})` });
  };

  // Quick-add a motion or overlay region at current playhead position
  const addPresetAtPlayhead = (preset: { id: string; label: string; emoji: string }, type: "motion"|"overlay") => {
    const ct = previewVideoRef.current?.currentTime ?? 0;
    const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
    const defaultDur = Math.max(2, Math.min(6, totalDur - ct));
    if (defaultDur < 0.2) { toast({ title: "Move playhead earlier to add a region", variant: "destructive" }); return; }
    const color = type === "motion" ? "#7c3aed" : "#0891b2";
    addEffectToTimeline({ type, effectId: preset.id, label: preset.label, emoji: preset.emoji, color }, ct, Math.min(totalDur, ct + defaultDur));
    if (type === "overlay") setSelectedGraphicOverlay(preset.id);
    if (type === "motion") setSelectedMotionId(preset.id);
    setEditTab("motion");
  };

  // Select and jump to an effectRegion in the timeline
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Apply template (switches — does not stack)
  const applyTemplate = (tpl: typeof STUDIO_TEMPLATES[0], showRangePicker = false) => {
    const s = tpl.settings;
    setFilterPresetId(s.filterPresetId);
    if (s.brightness !== undefined) setBrightness(s.brightness); if (s.contrast !== undefined) setContrast(s.contrast);
    if (s.saturation !== undefined) setSaturation(s.saturation); if ((s as any).warmth !== undefined) setWarmth((s as any).warmth);
    if ((s as any).shadows !== undefined) setShadows((s as any).shadows); if ((s as any).highlights !== undefined) setHighlights((s as any).highlights);
    if ((s as any).vignette !== undefined) setVignette((s as any).vignette); if ((s as any).grain !== undefined) setGrain((s as any).grain);
    setTextLayers(prev => {
      const kept = prev.filter(l => !l.fromTemplate);
      const added = (tpl.textLayers ?? []).map(tl => ({ ...tl, id: Date.now() + Math.random() * 1000 | 0, fromTemplate: true }));
      return [...kept, ...added];
    });
    setSelectedTemplateId(tpl.id);
    if (lastToastDismissRef.current) { lastToastDismissRef.current(); }
    const { dismiss } = toast({ title: `${tpl.emoji} ${tpl.label} applied! Visible on timeline →` });
    lastToastDismissRef.current = dismiss;
    if (showRangePicker) {
      setPendingEffect({ type: "template", effectId: tpl.id, label: tpl.label, emoji: tpl.emoji, color: "#7c3aed" });
      setPendingRangeStart(0); setPendingRangeEnd(videoDuration || 5);
    } else {
      // Auto-add a full-span template block to the timeline so it's visible immediately
      const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
      setEffectRegions(prev => {
        const withoutOldTemplate = prev.filter(r => r.type !== "template");
        return [...withoutOldTemplate, { type: "template" as const, effectId: tpl.id, label: tpl.label, emoji: tpl.emoji, color: "#7c3aed", id: `er-tpl-${Date.now()}`, startTime: 0, endTime: totalDur, posX: 50, posY: 50 }];
      });
      setTlExpanded(true);
    }
  };

  // Clipboard
  const copyToClipboard = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); toast({ title: "Copied!" }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  // Platform profile
  const applyPlatformProfile = (profile: typeof PLATFORM_PROFILES[0]) => {
    setAspectRatio(profile.aspectRatio); setSelectedPlatform(profile.id);
    toast({ title: `${profile.emoji} ${profile.label} profile applied`, description: `${profile.aspectRatio} · ${profile.width}×${profile.height}` });
  };

  // Brand to layers
  const applyBrandToAllLayers = () => {
    if (!textLayers.length) { toast({ title: "No text layers yet", variant: "destructive" }); return; }
    setTextLayers(prev => prev.map((l, i) => ({ ...l, color: brandColors[i % brandColors.length], font: brandFont })));
    toast({ title: "Brand applied to all layers!" });
  };

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  const pushUndo = () => {
    const snapshot = {
      textLayers: textLayersRef.current.slice(),
      stickerLayers: stickerLayersRef.current.slice(),
      clips: clips.slice(),
      effectRegions: effectRegions.slice(),
    };
    undoHistoryRef.current = undoHistoryRef.current.slice(0, undoPointerRef.current + 1);
    undoHistoryRef.current.push(snapshot);
    if (undoHistoryRef.current.length > 50) undoHistoryRef.current.shift();
    undoPointerRef.current = undoHistoryRef.current.length - 1;
  };
  const undo = () => {
    if (undoPointerRef.current <= 0) { toast({ title: "Nothing to undo" }); return; }
    undoPointerRef.current--;
    const s = undoHistoryRef.current[undoPointerRef.current];
    if (s) {
      setTextLayers(s.textLayers); setStickerLayers(s.stickerLayers);
      if (s.clips) setClips(s.clips);
      if (s.effectRegions) setEffectRegions(s.effectRegions);
      toast({ title: "↩ Undo" });
    }
  };
  const redo = () => {
    if (undoPointerRef.current >= undoHistoryRef.current.length - 1) { toast({ title: "Nothing to redo" }); return; }
    undoPointerRef.current++;
    const s = undoHistoryRef.current[undoPointerRef.current];
    if (s) {
      setTextLayers(s.textLayers); setStickerLayers(s.stickerLayers);
      if (s.clips) setClips(s.clips);
      if (s.effectRegions) setEffectRegions(s.effectRegions);
      toast({ title: "↪ Redo" });
    }
  };

  // ── Canvas text drag ─────────────────────────────────────────────────────
  const getDefaultTextXY = (pos: "top"|"center"|"bottom") =>
    pos === "top" ? { x: 50, y: 8 } : pos === "center" ? { x: 50, y: 50 } : { x: 50, y: 87 };

  const handleCanvasTextMouseDown = (e: React.MouseEvent, layerId: number) => {
    e.stopPropagation(); e.preventDefault();
    const layer = textLayers.find(l => l.id === layerId); if (!layer || !canvasDivRef.current) return;
    const def = getDefaultTextXY(layer.position);
    draggingTextRef.current = { id: layerId, startX: e.clientX, startY: e.clientY, origX: layer.x ?? def.x, origY: layer.y ?? def.y };
    setSelectedTextLayerId(layerId);
    setTextInput(layer.text); setTextColor(layer.color); setTextSize(layer.size);
    setTextPosition(layer.position); setTextAnimation(layer.animation); setTextFont(layer.font);
    setEditingTextLayerId(layerId);
    setEditTab("text");
  };
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasDivRef.current) return;
    const rect = canvasDivRef.current.getBoundingClientRect();
    // Text layer drag
    const drag = draggingTextRef.current;
    if (drag) {
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      setTextLayers(prev => prev.map(l => l.id === drag.id ? { ...l, x: Math.max(2, Math.min(96, drag.origX + dx)), y: Math.max(2, Math.min(96, drag.origY + dy)) } : l));
      return;
    }
    // Caption layer drag
    const cdrag = draggingCaptionRef.current;
    if (cdrag) {
      const dx = ((e.clientX - cdrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - cdrag.startY) / rect.height) * 100;
      setCaptionLayers(prev => prev.map(c => c.id === cdrag.id ? { ...c, x: Math.max(2, Math.min(96, cdrag.origX + dx)), y: Math.max(2, Math.min(96, cdrag.origY + dy)) } : c));
      return;
    }
    // Graphic overlay drag
    const odrag = draggingOverlayRef.current;
    if (odrag) {
      const dx = ((e.clientX - odrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - odrag.startY) / rect.height) * 100;
      setOverlayPositions(prev => ({ ...prev, [odrag.id]: { x: Math.max(5, Math.min(95, odrag.origX + dx)), y: Math.max(5, Math.min(95, odrag.origY + dy)) } }));
      return;
    }
    // Video pan
    const vdrag = videoPanRef.current;
    if (vdrag) {
      const dx = ((e.clientX - vdrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - vdrag.startY) / rect.height) * 100;
      setVideoOffset({ x: Math.max(0, Math.min(100, vdrag.origX - dx)), y: Math.max(0, Math.min(100, vdrag.origY - dy)) });
    }
  };
  const handleCanvasMouseUp = () => {
    draggingTextRef.current = null;
    draggingCaptionRef.current = null;
    draggingOverlayRef.current = null;
    videoPanRef.current = null;
  };

  // Overlay drag initiator
  const handleOverlayMouseDown = (e: React.MouseEvent, overlayId: string) => {
    e.stopPropagation(); e.preventDefault();
    const pos = overlayPositions[overlayId] ?? { x: 50, y: 50 };
    draggingOverlayRef.current = { id: overlayId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };

  // Caption drag initiator
  const handleCaptionMouseDown = (e: React.MouseEvent, capId: number) => {
    e.stopPropagation(); e.preventDefault();
    const cap = captionLayers.find(c => c.id === capId);
    if (!cap) return;
    draggingCaptionRef.current = { id: capId, startX: e.clientX, startY: e.clientY, origX: cap.x, origY: cap.y };
    setSelectedCaptionId(capId);
    setCaptionInput(cap.text); setCaptionStyle(cap.style); setCaptionColor(cap.color); setCaptionFontSize(cap.fontSize);
    setEditTab("captions");
  };

  // Add caption layer
  const addCaptionLayer = (overrides?: Partial<CaptionLayer>) => {
    const id = nextCaptionId;
    setNextCaptionId(n => n + 1);
    const ct = previewVideoRef.current?.currentTime ?? 0;
    setCaptionLayers(prev => [...prev, {
      id, text: captionInput || "Caption", x: 50, y: 85,
      startTime: ct, endTime: Math.min(ct + 4, videoDuration || ct + 4),
      style: captionStyle, fontSize: captionFontSize, color: captionColor, bg: captionBg,
      ...overrides,
    }]);
    setSelectedCaptionId(id);
  };

  // Caption AI via Claude
  const handleCaptionAi = async (prompt?: string) => {
    setCaptionAiLoading(true);
    try {
      const res = await apiRequest("/api/studio/ai-assist", "POST", {
        message: prompt ?? `Write 3 punchy video captions for an urban culture platform video about ${caption || "street culture"}. Keep each under 80 chars. Numbered list.`,
        context: { platform: selectedPlatform, template: selectedTemplateId },
      });
      const data = await res.json();
      if (data.reply) {
        const lines = data.reply.split("\n").map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter((l: string) => l.length > 3).slice(0, 5);
        lines.forEach((text: string, i: number) => {
          const ct = previewVideoRef.current?.currentTime ?? 0;
          const id = nextCaptionId + i;
          setCaptionLayers(prev => [...prev, { id, text, x: 50, y: 80 + i * 8, startTime: ct + i * 3, endTime: ct + i * 3 + 3.5, style: captionStyle, fontSize: captionFontSize, color: captionColor, bg: captionBg }]);
        });
        setNextCaptionId(n => n + lines.length);
        toast({ title: `✨ ${lines.length} AI captions added` });
      }
    } catch { toast({ title: "AI caption failed", variant: "destructive" }); }
    finally { setCaptionAiLoading(false); }
  };

  // ── Sound FX preview (oscillator) ────────────────────────────────────────
  const playSoundPreview = (category: string) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const map: Record<string, { freq: number; dur: number; type: OscillatorType }> = {
        whoosh: { freq: 700, dur: 0.5, type: "sawtooth" }, impact: { freq: 70,  dur: 0.3, type: "square" },
        bass:   { freq: 55,  dur: 1.0, type: "sine"     }, rise:   { freq: 350, dur: 1.5, type: "sine"  },
        cinematic: { freq: 290, dur: 0.9, type: "triangle" }, urban: { freq: 200, dur: 0.4, type: "sawtooth" },
        ambient: { freq: 440, dur: 2.0, type: "sine" },
      };
      const cfg = map[category] ?? { freq: 440, dur: 0.4, type: "sine" as OscillatorType };
      osc.frequency.value = cfg.freq; osc.type = cfg.type;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + cfg.dur);
      setTimeout(() => ctx.close(), (cfg.dur + 0.2) * 1000);
    } catch {}
  };

  // ── Drum pattern synthesizer — proper kick/snare/hi-hat per genre ─────────
  const synthesizeDrumPattern = (bpm: number, genre: string, bars = 2) => {
    if (beatCtxRef.current) { try { beatCtxRef.current.close(); } catch {} beatCtxRef.current = null; }
    try {
      const ctx = new AudioContext();
      beatCtxRef.current = ctx;
      const step = (60 / bpm) / 4;
      const now = ctx.currentTime;
      const patterns: Record<string, { kick: number[]; snare: number[]; hat: number[]; openHat: number[] }> = {
        "Hip Hop":    { kick: [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], openHat: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0] },
        "Trap":       { kick: [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,1], hat: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], openHat: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1] },
        "Breakbeats": { kick: [1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], hat: [1,0,1,1,0,1,0,0,1,1,0,1,0,1,1,0], openHat: [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0] },
        "Drill":      { kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], openHat: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0] },
        "Afrobeats":  { kick: [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1], openHat: [0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0] },
        "House":      { kick: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0], openHat: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1] },
        "Soul/Funk":  { kick: [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], snare: [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0], hat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], openHat: [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0] },
        "Grime":      { kick: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0], hat: [1,1,0,1,0,0,1,1,0,1,0,1,0,0,1,0], openHat: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1] },
        "Jazz/Lofi":  { kick: [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0], snare: [0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0], hat: [1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1], openHat: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1] },
        "Urban":      { kick: [1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0], snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], hat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0], openHat: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1] },
      };
      const pat = patterns[genre] ?? patterns["Hip Hop"];
      const playKick = (t: number) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
      };
      const playSnare = (t: number) => {
        const bufSize = ctx.sampleRate * 0.12;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 1500;
        const g = ctx.createGain();
        ns.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        ns.start(t); ns.stop(t + 0.15);
        const osc = ctx.createOscillator(); const g2 = ctx.createGain();
        osc.connect(g2); g2.connect(ctx.destination);
        osc.frequency.value = 200;
        g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.05);
      };
      const playHat = (t: number, open = false) => {
        const bufSize = ctx.sampleRate * (open ? 0.22 : 0.04);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 8000;
        const g = ctx.createGain();
        ns.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(open ? 0.18 : 0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.2 : 0.04));
        ns.start(t); ns.stop(t + (open ? 0.22 : 0.05));
      };
      for (let bar = 0; bar < bars; bar++) {
        pat.kick.forEach((on, i) => { if (on) playKick(now + (bar * 16 + i) * step); });
        pat.snare.forEach((on, i) => { if (on) playSnare(now + (bar * 16 + i) * step); });
        pat.hat.forEach((on, i) => { if (on) playHat(now + (bar * 16 + i) * step, false); });
        pat.openHat.forEach((on, i) => { if (on) playHat(now + (bar * 16 + i) * step, true); });
      }
      const totalMs = bars * 16 * step * 1000;
      setIsBeatPlaying(true);
      setTimeout(() => { try { ctx.close(); } catch {} if (beatCtxRef.current === ctx) beatCtxRef.current = null; setIsBeatPlaying(false); }, totalMs + 300);
    } catch { setIsBeatPlaying(false); }
  };

  const stopBeat = () => {
    if (beatCtxRef.current) { try { beatCtxRef.current.close(); } catch {} beatCtxRef.current = null; }
    setIsBeatPlaying(false);
  };

  // ── Intro Hook synthesizer — attention-grabbing sounds via Web Audio ────────
  const playIntroHook = (hookId: string) => {
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      const autoClose = (ms: number) => setTimeout(() => { try { ctx.close(); } catch {} }, ms);
      if (hookId === "air-horn") {
        [320, 640, 960].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination); osc.type = "sawtooth"; osc.frequency.value = freq;
          g.gain.setValueAtTime(0.28 / (i + 1), now); g.gain.setValueAtTime(0.28 / (i + 1), now + 0.85); g.gain.linearRampToValueAtTime(0, now + 1.1);
          osc.start(now); osc.stop(now + 1.2);
        }); autoClose(1400);
      } else if (hookId === "record-scratch") {
        const dur = 0.3; const bufSize = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate); const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i / bufSize * Math.PI);
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3000; f.Q.value = 5;
        const g = ctx.createGain(); g.gain.value = 0.6; ns.connect(f); f.connect(g); g.connect(ctx.destination); ns.start(now);
        const buf2 = ctx.createBuffer(1, bufSize * 2, ctx.sampleRate); const d2 = buf2.getChannelData(0);
        for (let i = 0; i < bufSize * 2; i++) d2[i] = Math.random() * 2 - 1;
        const ns2 = ctx.createBufferSource(); ns2.buffer = buf2;
        ns2.playbackRate.setValueAtTime(2.5, now + dur); ns2.playbackRate.linearRampToValueAtTime(0.5, now + dur + 0.4);
        const f2 = ctx.createBiquadFilter(); f2.type = "highpass"; f2.frequency.value = 1000;
        const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.4, now + dur); g2.gain.linearRampToValueAtTime(0, now + dur + 0.5);
        ns2.connect(f2); f2.connect(g2); g2.connect(ctx.destination); ns2.start(now + dur); autoClose(1200);
      } else if (hookId === "countdown-drop") {
        [0, 0.5, 1.0].forEach((t, i) => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination); osc.frequency.value = 880 - i * 80;
          g.gain.setValueAtTime(0.45, now + t); g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18);
          osc.start(now + t); osc.stop(now + t + 0.2);
        });
        const kick = ctx.createOscillator(); const kg = ctx.createGain();
        kick.connect(kg); kg.connect(ctx.destination);
        kick.frequency.setValueAtTime(200, now + 1.5); kick.frequency.exponentialRampToValueAtTime(40, now + 1.7);
        kg.gain.setValueAtTime(0.9, now + 1.5); kg.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        kick.start(now + 1.5); kick.stop(now + 2.1); autoClose(2600);
      } else if (hookId === "bass-rumble") {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(40, now); osc.frequency.linearRampToValueAtTime(80, now + 0.8);
        g.gain.setValueAtTime(0.7, now); g.gain.setValueAtTime(0.7, now + 0.7); g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.start(now); osc.stop(now + 1.0);
        const bufSize = Math.floor(ctx.sampleRate * 0.08);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate); const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        const ng = ctx.createGain(); ng.gain.value = 0.85; ns.connect(ng); ng.connect(ctx.destination);
        ns.start(now + 0.8); autoClose(1600);
      } else if (hookId === "siren-rise") {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination); osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(1200, now + 1.5);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now + 0.3);
        g.gain.setValueAtTime(0.5, now + 1.2); g.gain.linearRampToValueAtTime(0, now + 1.6);
        osc.start(now); osc.stop(now + 1.7); autoClose(2000);
      } else if (hookId === "crowd-cheer") {
        [0, 0.1, 0.2, 0.3].forEach((delay, i) => {
          const bufSize = Math.floor(ctx.sampleRate * 0.8);
          const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate); const d = buf.getChannelData(0);
          for (let j = 0; j < bufSize; j++) d[j] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = buf;
          const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 3000 + i * 500;
          const g = ctx.createGain(); ns.connect(lpf); lpf.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0, now + delay); g.gain.linearRampToValueAtTime(0.15, now + delay + 0.12); g.gain.linearRampToValueAtTime(0, now + delay + 0.75);
          ns.start(now + delay);
        }); autoClose(1600);
      } else if (hookId === "dj-rewind") {
        const bufSize = Math.floor(ctx.sampleRate * 0.8);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate); const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = buf;
        ns.playbackRate.setValueAtTime(0.3, now); ns.playbackRate.linearRampToValueAtTime(4.0, now + 0.7);
        const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 2000;
        const g = ctx.createGain(); ns.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.5, now); g.gain.linearRampToValueAtTime(0.85, now + 0.5); g.gain.linearRampToValueAtTime(0, now + 0.8);
        ns.start(now); autoClose(1200);
      } else if (hookId === "trap-intro") {
        const beat = (60 / 140) / 4;
        [0, 4, 8, 11].forEach(s => {
          const osc = ctx.createOscillator(); const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.frequency.setValueAtTime(150, now + s * beat); osc.frequency.exponentialRampToValueAtTime(50, now + s * beat + 0.2);
          g.gain.setValueAtTime(0.7, now + s * beat); g.gain.exponentialRampToValueAtTime(0.001, now + s * beat + 0.4);
          osc.start(now + s * beat); osc.stop(now + s * beat + 0.5);
        });
        [0, 2, 4, 6, 8, 10, 12, 14].forEach(s => {
          const bsz = Math.floor(ctx.sampleRate * 0.04);
          const buf = ctx.createBuffer(1, bsz, ctx.sampleRate); const d = buf.getChannelData(0);
          for (let i = 0; i < bsz; i++) d[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = buf;
          const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 9000;
          const g = ctx.createGain(); ns.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.12, now + s * beat); g.gain.exponentialRampToValueAtTime(0.001, now + s * beat + 0.035);
          ns.start(now + s * beat); ns.stop(now + s * beat + 0.04);
        }); autoClose(2200);
      } else if (hookId === "whoosh-impact") {
        const sweep = ctx.createOscillator(); const sg = ctx.createGain();
        sweep.connect(sg); sg.connect(ctx.destination); sweep.type = "sawtooth";
        sweep.frequency.setValueAtTime(1200, now); sweep.frequency.exponentialRampToValueAtTime(80, now + 0.4);
        sg.gain.setValueAtTime(0.4, now); sg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        sweep.start(now); sweep.stop(now + 0.5);
        const kick = ctx.createOscillator(); const kg = ctx.createGain();
        kick.connect(kg); kg.connect(ctx.destination);
        kick.frequency.setValueAtTime(160, now + 0.4); kick.frequency.exponentialRampToValueAtTime(40, now + 0.6);
        kg.gain.setValueAtTime(0.9, now + 0.4); kg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        kick.start(now + 0.4); kick.stop(now + 0.9); autoClose(1400);
      } else if (hookId === "glitch-snap") {
        [0, 0.05, 0.12, 0.18, 0.22].forEach(t => {
          const bsz = Math.floor(ctx.sampleRate * 0.03);
          const buf = ctx.createBuffer(1, bsz, ctx.sampleRate); const d = buf.getChannelData(0);
          for (let i = 0; i < bsz; i++) d[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = buf;
          const g = ctx.createGain(); g.gain.value = 0.55; ns.connect(g); g.connect(ctx.destination);
          ns.start(now + t); ns.stop(now + t + 0.03);
        });
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, now + 0.25); osc.frequency.exponentialRampToValueAtTime(60, now + 0.32);
        g.gain.setValueAtTime(0.75, now + 0.25); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now + 0.25); osc.stop(now + 0.4); autoClose(900);
      }
    } catch {}
  };

  // ── Music track preview — uses real audio element when URL available ────────
  const previewMusicTrack = (trackId: string) => {
    if (previewingTrackId === trackId) { setPreviewingTrackId(null); return; }
    const track = MUSIC_TRACKS.find(t => t.id === trackId);
    if (!track) return;
    setPreviewingTrackId(trackId);
    if (track.url) {
      try {
        const audio = new Audio(track.url);
        audio.volume = 0.5;
        audio.play().catch(() => {});
        setTimeout(() => { audio.pause(); audio.src = ""; setPreviewingTrackId(null); }, 4000);
      } catch { setPreviewingTrackId(null); }
      return;
    }
    try {
      const ctx = new AudioContext();
      const baseFreq = 220 * (track.bpm / 100);
      const step = (60 / track.bpm) / 4;
      synthesizeDrumPattern(track.bpm, track.genre, 2);
      const notes = [1, 1.19, 1.5, 1.33, 1, 0.89, 1.33, 1];
      let time = ctx.currentTime + step * 2;
      notes.forEach((mult) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = baseFreq * mult;
        osc.type = track.genre.includes("Jazz") || track.genre.includes("Soul") ? "triangle" : "sine";
        gain.gain.setValueAtTime(0.12, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.start(time); osc.stop(time + 0.22); time += step * 2;
      });
      setTimeout(() => { ctx.close(); setPreviewingTrackId(null); }, 3000);
    } catch { setPreviewingTrackId(null); }
  };

  // ── AI Camera movement handlers ───────────────────────────────────────────
  const handleAiCameraMove = (presetId: string) => {
    setAiCameraMove(v => v === presetId ? null : presetId);
  };

  // ── AI Beats Prescription — Claude prescribes the perfect beat ────────────
  const handleAiBeats = async () => {
    if (!aiBeatsPrompt.trim()) return;
    setAiBeatsLoading(true);
    setAiBeatsResult(null);
    try {
      const res = await fetch("/api/studio/ai-beats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt: aiBeatsPrompt, currentBpm: beatGenBpm, currentGenre: beatGenGenre }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAiBeatsResult(data);
      if (data.bpm) setBeatGenBpm(Number(data.bpm));
      if (data.genre) setBeatGenGenre(data.genre);
      if (data.suggestedTrackId) setSelectedTrack(data.suggestedTrackId);
      if (data.introHook) setSelectedIntroHook(data.introHook);
      toast({ title: `🎵 Beat Prescription Ready`, description: `${data.bpm} BPM · ${data.key} · ${data.style}` });
    } catch {
      toast({ title: "AI Beats failed", variant: "destructive" });
    } finally {
      setAiBeatsLoading(false);
    }
  };

  // Capture high-quality analysis frames from video
  const captureAnalysisFrames = (url: string, dur: number, count = 10): Promise<string[]> => {
    return new Promise((resolve) => {
      const frames: string[] = [];
      let idx = 0;
      const vid = document.createElement("video");
      vid.preload = "auto";
      vid.src = url;
      vid.muted = true;
      vid.crossOrigin = "anonymous";
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;
      const seekNext = () => { vid.currentTime = (idx / (count - 1)) * dur; };
      vid.addEventListener("seeked", () => {
        ctx.drawImage(vid, 0, 0, 240, 320);
        frames.push(canvas.toDataURL("image/jpeg", 0.72));
        idx++;
        if (idx < count) seekNext();
        else resolve(frames);
      });
      vid.onerror = () => resolve(frames);
      vid.onloadeddata = () => { seekNext(); };
    });
  };

  // AI Motion Analyze — scans video frames with Claude Vision and places smart timed camera AR events
  const handleAiMotionAnalyze = async () => {
    const url = previewUrl || clips[activeClipIdx]?.url;
    const dur = (clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0)) || videoDuration || 0;
    if (!url || dur < 1) {
      toast({ title: "Load a video first", variant: "destructive" });
      return;
    }
    setAiMotionAnalyzing(true);
    setAiMotionProgress("Capturing video frames…");
    try {
      const frames = await captureAnalysisFrames(url, dur, 10);
      setAiMotionProgress("Analyzing content with Claude Vision AI…");
      const res = await fetch("/api/studio/ai-motion-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, videoDuration: dur }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: AiMotionResult = await res.json();
      if (!data.motionEvents) throw new Error("Invalid response");
      setAiMotionResult(data);
      setAiMotionProgress("Placing motion events on timeline…");
      // Apply global camera move
      if (data.globalCameraMove) setAiCameraMove(data.globalCameraMove);
      // Build effectRegions with cameraPresetId for time-based AR movement
      const newRegions: EffectRegion[] = data.motionEvents.map((ev, i) => {
        const preset = MOTION_PRESETS.find(p => p.id === ev.motionPresetId) || MOTION_PRESETS[0];
        return {
          id: `er-ai-${Date.now()}-${i}`,
          type: "motion" as const,
          effectId: preset.id,
          label: preset.label,
          emoji: preset.emoji,
          color: ev.intensity === "high" ? "#ef4444" : ev.intensity === "medium" ? "#7c3aed" : "#6366f1",
          startTime: Math.max(0, ev.time),
          endTime: Math.min(dur, ev.time + ev.duration),
          posX: 50,
          posY: 50,
          cameraPresetId: ev.cameraPresetId,
          motionIntensity: ev.intensity,
          aiReason: ev.reason,
        };
      });
      setEffectRegions(prev => [...prev.filter(r => r.type !== "motion"), ...newRegions]);
      setTlExpanded(true);
      // Apply recommended motion preset text layer
      if (data.recommendedMotionPreset) {
        const preset = MOTION_PRESETS.find(p => p.id === data.recommendedMotionPreset);
        if (preset) {
          const newId = Date.now();
          setTextLayers(prev => {
            const kept = prev.filter(l => !l.fromMotion);
            return [...kept, { id: newId, text: preset.sampleText, color: preset.textStyle.color, size: preset.textStyle.size, position: preset.textStyle.position, animation: preset.textStyle.animation, font: preset.textStyle.font, fromMotion: preset.id }];
          });
          setSelectedMotionId(data.recommendedMotionPreset);
        }
      }
      setAiMotionProgress("");
      toast({
        title: `🤖 ${data.contentType.charAt(0).toUpperCase() + data.contentType.slice(1)} detected — ${data.contentSubType}`,
        description: `${data.motionEvents.length} AR motion events placed • ${data.energy} energy • Camera: ${data.globalCameraMove}`,
      });
    } catch {
      toast({ title: "AI Motion analysis failed", variant: "destructive" });
      setAiMotionProgress("");
    } finally {
      setAiMotionAnalyzing(false);
    }
  };

  const handleAiCameraGenerate = async () => {
    if (!aiCameraCustom.trim()) return;
    setAiCameraLoading(true);
    try {
      const res = await fetch("/api/studio/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `As a cinematographer, suggest ONE camera movement preset for this video scene: "${aiCameraCustom}". Reply ONLY with the ID from this list: slow-zoom-in, slow-zoom-out, pan-left, pan-right, drone-pullback, handheld, beat-shake, orbit. Just the ID, nothing else.`,
          context: "camera_movement",
        }),
      });
      const data = await res.json();
      const chosen = (data.response ?? "").trim().toLowerCase();
      const validIds = CAMERA_MOVE_PRESETS.map(p => p.id);
      const match = validIds.find(id => chosen.includes(id)) ?? "slow-zoom-in";
      setAiCameraMove(match);
      toast({ title: `🎥 AI Camera: ${CAMERA_MOVE_PRESETS.find(p => p.id === match)?.label}`, description: `Applied for: "${aiCameraCustom}"` });
    } catch {
      toast({ title: "AI Camera failed", variant: "destructive" });
    } finally { setAiCameraLoading(false); }
  };

  // ── AI Auto-Caption ───────────────────────────────────────────────────────
  const handleAiAutoCaption = async () => {
    if (!aiCaptionVideoDesc.trim()) return;
    setAiAutoCaptionLoading(true);
    try {
      const dur = tlTotalDuration || 30;
      const res = await fetch("/api/studio/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Generate 5-8 timed captions for a ${Math.round(dur)}-second urban culture video about: "${aiCaptionVideoDesc}". Return ONLY a JSON array like: [{"text":"Caption text","start":0,"end":3},...] with realistic timing spread across the video duration. Keep captions punchy and energetic for Dutch urban culture audience. No explanation, just the JSON array.`,
          context: "auto_caption",
        }),
      });
      const data = await res.json();
      const raw = data.response ?? "";
      const match = raw.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("No JSON");
      const items: { text: string; start: number; end: number }[] = JSON.parse(match[0]);
      const newLayers: CaptionLayer[] = items.map((item, i) => ({
        id: Date.now() + i, text: item.text, x: 50, y: 85,
        startTime: item.start, endTime: item.end,
        style: captionStyle, fontSize: captionFontSize,
        color: captionColor, bg: captionBg,
      }));
      setCaptionLayers(prev => [...prev, ...newLayers]);
      toast({ title: `✨ ${newLayers.length} captions generated!`, description: "Review and adjust timing as needed." });
      setAiCaptionVideoDesc("");
    } catch {
      toast({ title: "AI Caption failed", description: "Could not parse response. Try again.", variant: "destructive" });
    } finally { setAiAutoCaptionLoading(false); }
  };

  // ── AI Translation ────────────────────────────────────────────────────────
  const handleAiTranslate = async () => {
    if (captionLayers.length === 0) return;
    setAiTransLoading(true);
    try {
      const langLabel = TRANSLATION_LANGUAGES.find(l => l.id === aiTransLang)?.label ?? aiTransLang;
      const texts = captionLayers.map(c => c.text);
      const res = await fetch("/api/studio/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Translate these video captions to ${langLabel}. Return ONLY a JSON array of translated strings in the exact same order, keeping them short and punchy:\n${JSON.stringify(texts)}`,
          context: "translation",
        }),
      });
      const data = await res.json();
      const raw = data.response ?? "";
      const match = raw.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("No JSON");
      const translated: string[] = JSON.parse(match[0]);
      setCaptionLayers(prev => prev.map((c, i) => ({ ...c, text: translated[i] ?? c.text })));
      toast({ title: `🌍 Translated to ${langLabel}!`, description: `${captionLayers.length} captions updated.` });
    } catch {
      toast({ title: "Translation failed", variant: "destructive" });
    } finally { setAiTransLoading(false); }
  };

  // ── Voice-over recorder ───────────────────────────────────────────────────
  const startVoiceOver = async () => {
    if (voiceRecording) {
      voMediaRecorderRef.current?.stop();
      setVoiceRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      voChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) voChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(voChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoiceOverUrl(url);
        stream.getTracks().forEach(t => t.stop());
        toast({ title: "🎙️ Voice-over recorded!", description: "Waveform visible in timeline. Press play to hear it." });
      };
      mr.start();
      voMediaRecorderRef.current = mr;
      setVoiceRecording(true);
      toast({ title: "🔴 Recording voice-over…", description: "Tap Stop when done" });
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  // ── Browser-native export / download ─────────────────────────────────────
  // Uses fetch → explicit Blob MIME typing to avoid antivirus heuristic flags
  const handleDownloadExport = async () => {
    if (!clips.length && !previewUrl) { toast({ title: "No video to export", variant: "destructive" }); return; }
    const url = clips[activeClipIdx]?.url || previewUrl;
    if (!url) { toast({ title: "No video loaded", variant: "destructive" }); return; }
    const ext = exportFormat === "webm" ? "webm" : exportFormat === "mov" ? "mov" : "mp4";
    const mimeType = exportFormat === "webm" ? "video/webm" : exportFormat === "mov" ? "video/quicktime" : "video/mp4";
    const filename = `urban-culture-export-${Date.now()}.${ext}`;
    try {
      toast({ title: "⬇️ Preparing download…", description: "Processing video file…" });
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const rawBlob = await response.blob();
      // Re-wrap with explicit MIME type — this prevents AV heuristic flags on opaque blobs
      const cleanBlob = new Blob([rawBlob], { type: mimeType });
      const cleanUrl = URL.createObjectURL(cleanBlob);
      const a = document.createElement("a");
      a.href = cleanUrl; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(cleanUrl), 2000);
      toast({ title: "✅ Download ready!", description: filename });
    } catch {
      // Fallback: direct anchor download
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast({ title: "⬇️ Downloading…", description: `Saving to your device` });
    }
  };

  // ── Canvas-composite capture — bakes text + overlays into the recording ──
  const handleBrowserCapture = async () => {
    const videoEl = previewVideoRef.current;
    const canvasDiv = canvasDivRef.current;
    if (!videoEl || exportProgress !== null) return;
    try {
      // Prefer canvas-based stream (captures overlays) over raw video stream
      let stream: MediaStream | null = null;
      // Try to get a combined stream from the canvas element if available
      const canvasEl = canvasDiv?.querySelector("canvas");
      if (canvasEl && (canvasEl as any).captureStream) {
        stream = (canvasEl as any).captureStream(30);
      }
      if (!stream) {
        stream = (videoEl as any).captureStream
          ? (videoEl as any).captureStream(30)
          : (videoEl as any).mozCaptureStream?.() ?? null;
      }
      if (!stream) { await handleDownloadExport(); return; }
      // Add video audio track if missing
      const videoStream = (videoEl as any).captureStream
        ? (videoEl as any).captureStream(30)
        : null;
      if (videoStream) {
        videoStream.getAudioTracks().forEach((t: MediaStreamTrack) => {
          if (stream!.getAudioTracks().length === 0) stream!.addTrack(t);
        });
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";
      const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: exportQuality === "4k" ? 20_000_000 : exportQuality === "1080p" ? 8_000_000 : exportQuality === "720p" ? 4_000_000 : 2_000_000 });
      const chunks: Blob[] = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = blobUrl;
        a.download = `urban-culture-export-${Date.now()}.webm`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        setExportProgress(null);
        toast({ title: "✅ Export complete!", description: `WebM at ${exportQuality} saved to your device` });
      };
      mr.start(100); // collect data in 100ms chunks for smoother progress
      exportRecorderRef.current = mr;
      setExportProgress(0);
      const dur = tlTotalDuration || 10;
      const startTs = Date.now();
      const tick = setInterval(() => {
        setExportProgress(Math.min(95, ((Date.now() - startTs) / (dur * 1000)) * 100));
      }, 200);
      setTimeout(() => { clearInterval(tick); mr.stop(); }, (dur + 0.5) * 1000);
      toast({ title: "🎬 Recording export…", description: `Press ▶ — capturing ${exportQuality} preview with all effects` });
      videoEl.currentTime = clips[0]?.trimStart ?? 0;
      videoEl.play(); setIsPlaying(true);
    } catch { setExportProgress(null); await handleDownloadExport(); }
  };

  // ── Load text layer for editing ──────────────────────────────────────────
  const loadTextLayerForEditing = (layer: TextLayer) => {
    setSelectedTextLayerId(layer.id); setEditingTextLayerId(layer.id);
    setTextInput(layer.text); setTextColor(layer.color); setTextSize(layer.size);
    setTextPosition(layer.position); setTextAnimation(layer.animation); setTextFont(layer.font);
  };
  const updateSelectedTextLayer = () => {
    if (!editingTextLayerId || !textInput.trim()) return;
    pushUndo();
    setTextLayers(prev => prev.map(l => l.id === editingTextLayerId ? { ...l, text: textInput.trim(), color: textColor, size: textSize, position: textPosition, animation: textAnimation, font: textFont } : l));
    toast({ title: "Layer updated!" });
  };

  // AI handlers
  const handleViralScore = async () => {
    setViralScoreLoading(true); setViralScore(null); setViralBreakdown(null); setViralTips([]); setViralPlatformBest("");
    try {
      const res = await apiRequest("/api/studio/viral-score", "POST", { context: { platform: selectedPlatform, aspectRatio, filter: filterPresetId, template: selectedTemplateId, duration: videoDuration ? Math.round(videoDuration) : null, textCount: textLayers.length, speed, soundFx: selectedSoundFx, transition: selectedTransition, hasLowerThird: lowerThirdEnabled, hasProgressBar: progressBarEnabled } });
      const data = await res.json();
      setViralScore(data.score ?? 65); setViralBreakdown({ hook: data.hook ?? 15, energy: data.energy ?? 17, trends: data.trends ?? 15, optimize: data.optimize ?? 18 });
      setViralTips(data.tips ?? []); setViralPlatformBest(data.platform_best ?? "");
    } catch { toast({ title: "Analysis failed", variant: "destructive" }); }
    finally { setViralScoreLoading(false); }
  };

  // ── AI Editor Command Executor ────────────────────────────────────────────
  const executeEditorCommand = useCallback((raw: string): string[] => {
    const msg = raw.toLowerCase();
    const log: string[] = [];

    // Map visual style
    if (msg.includes("neon map") || msg.includes("neon style") || (msg.includes("neon") && msg.includes("map"))) {
      setMapVisualStyle("neon"); setMapLineStyle("glowing"); log.push("🌟 Map style → Neon");
    } else if (msg.includes("cartoon map") || msg.includes("cartoon style") || (msg.includes("cartoon") && msg.includes("map"))) {
      setMapVisualStyle("cartoon"); log.push("🎨 Map style → Cartoon");
    } else if (msg.includes("cinematic map") || (msg.includes("cinematic") && msg.includes("map"))) {
      setMapVisualStyle("cinematic"); log.push("🎬 Map style → Cinematic");
    } else if (msg.includes("3d route") || msg.includes("3d map") || msg.includes("3d-route")) {
      setMapVisualStyle("3d-route"); log.push("🗺️ Map style → 3D Route");
    } else if (msg.includes("social map") || msg.includes("clean map")) {
      setMapVisualStyle("social"); log.push("📱 Map style → Social");
    }

    // Vehicle
    if (msg.includes("with car") || msg.includes("car route")) { setMapVehicle("car"); log.push("🚗 Vehicle → Car"); }
    else if (msg.includes("with train") || msg.includes("train route")) { setMapVehicle("train"); log.push("🚂 Vehicle → Train"); }
    else if (msg.includes("with ship") || msg.includes("ship route") || msg.includes("boat")) { setMapVehicle("ship"); log.push("🚢 Vehicle → Ship"); }
    else if (msg.includes("with plane") || msg.includes("plane route") || msg.includes("flight") || msg.includes("airplane")) { setMapVehicle("plane"); log.push("✈️ Vehicle → Plane"); }

    // Map route from city names
    const cityPattern = MAP_CITIES_DB.map(c => c.city);
    const foundCities: MapWaypointItem[] = [];
    cityPattern.forEach(name => {
      if (msg.includes(name.toLowerCase()) && !foundCities.find(f => f.city === name)) {
        const c = MAP_CITIES_DB.find(x => x.city === name);
        if (c && foundCities.length < 8) foundCities.push({ id: `wp-cmd-${foundCities.length}`, ...c });
      }
    });
    if (foundCities.length >= 2) { setMapWaypoints(foundCities); setSelectedGraphicOverlay("map-route"); log.push(`🗺️ Route: ${foundCities.map(c => c.city).join(" → ")}`); }

    // Map overlay activation
    if ((msg.includes("map route") || msg.includes("map animation") || msg.includes("route animation")) && foundCities.length < 2) {
      setSelectedGraphicOverlay("map-route"); log.push("🗺️ Activated map route overlay");
    }

    // Route line style
    if (msg.includes("glowing route") || msg.includes("glow route")) { setMapLineStyle("glowing"); log.push("✨ Route → Glowing"); }
    else if (msg.includes("dashed route")) { setMapLineStyle("dashed"); log.push("- - Route → Dashed"); }
    else if (msg.includes("dotted route")) { setMapLineStyle("dotted"); log.push("· Route → Dotted"); }

    // Line color
    if (msg.includes("green route") || msg.includes("neon green")) { setMapLineColor("#39ff14"); log.push("🟢 Route color → Neon green"); }
    else if (msg.includes("blue route") || msg.includes("cyan route")) { setMapLineColor("#00d4ff"); log.push("🔵 Route color → Cyan"); }
    else if (msg.includes("orange route")) { setMapLineColor("#ff9f0a"); log.push("🟠 Route color → Orange"); }
    else if (msg.includes("pink route") || msg.includes("magenta route")) { setMapLineColor("#ff2d55"); log.push("🩷 Route color → Pink"); }

    // Filter
    if (msg.includes("cinematic filter")) { setFilterPresetId("cinematic"); log.push("🎬 Filter → Cinematic"); }
    else if (msg.includes("neon filter") || msg.includes("neon glow")) { setFilterPresetId("neon-glow"); log.push("💜 Filter → Neon Glow"); }
    else if (msg.includes("vintage filter")) { setFilterPresetId("vintage"); log.push("🟤 Filter → Vintage"); }
    else if (msg.includes("urban filter") || msg.includes("street filter")) { setFilterPresetId("urban-edge"); log.push("🖤 Filter → Urban Edge"); }

    // Aspect ratio / platform
    if (msg.includes("9:16") || msg.includes("instagram") || msg.includes("tiktok") || msg.includes("reels") || msg.includes("shorts")) {
      setAspectRatio("9:16"); log.push("📱 Aspect → 9:16 (mobile)");
    } else if (msg.includes("16:9") || msg.includes("youtube") || msg.includes("landscape")) {
      setAspectRatio("16:9"); log.push("🖥️ Aspect → 16:9 (landscape)");
    } else if (msg.includes("1:1") || msg.includes("square")) {
      setAspectRatio("1:1"); log.push("⬜ Aspect → 1:1 (square)");
    }

    // Audio effects
    if (msg.includes("bass boost") || msg.includes("bass fx")) { setAudioEffects(p => ({ ...p, bassBoost: true })); log.push("🔊 Audio → Bass Boost on"); }
    if (msg.includes("echo") || msg.includes("delay fx")) { setAudioEffects(p => ({ ...p, echo: true })); log.push("🔁 Audio → Echo on"); }
    if (msg.includes("reverb")) { setAudioEffects(p => ({ ...p, reverb: true })); log.push("🏛️ Audio → Reverb on"); }
    if (msg.includes("fade in")) { setAudioEffects(p => ({ ...p, fadeIn: true })); log.push("📈 Audio → Fade In on"); }
    if (msg.includes("fade out")) { setAudioEffects(p => ({ ...p, fadeOut: true })); log.push("📉 Audio → Fade Out on"); }

    // Add text overlay
    const textMatch = raw.match(/add (?:neon |bold |white |black )?text[:\s]+['"]?([^'"]+?)['"]?\s*(?:color|top|center|bottom|$)/i)
      || raw.match(/text overlay[:\s]+['"]([^'"]+)['"]/i)
      || raw.match(/add text[:\s]+['"]([^'"]+)['"]/i);
    if (textMatch) {
      const txt = textMatch[1].trim();
      const isNeonReq = msg.includes("neon");
      const pos = msg.includes("top") ? "top" : msg.includes("center") ? "center" : "bottom";
      const _ct = previewVideoRef.current?.currentTime ?? 0;
      const _td = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 10;
      setTextLayers(prev => [...prev, { id: Date.now(), text: txt, color: isNeonReq ? "#39ff14" : "#ffffff", size: 28, position: pos, animation: isNeonReq ? "neon-pulse" : "slide-up", font: msg.includes("bold") ? "bold" : "default", startTime: _ct, endTime: Math.min(_td, _ct + 5) }]);
      log.push(`🔤 Added text: "${txt}"`);
    }

    // Export quality
    if (msg.includes("4k export") || msg.includes("export 4k")) { setExportQuality("4k"); log.push("📺 Export → 4K"); }
    else if (msg.includes("1080p") || msg.includes("full hd")) { setExportQuality("1080p"); log.push("📺 Export → 1080p"); }
    else if (msg.includes("720p")) { setExportQuality("720p"); log.push("📺 Export → 720p"); }

    // Speed
    const speedMatch = msg.match(/(\d+(?:\.\d+)?)x speed/);
    if (speedMatch) {
      const s = parseFloat(speedMatch[1]);
      if (s >= 0.25 && s <= 4) { setSpeed(s); log.push(`⚡ Speed → ${s}x`); }
    }
    if (msg.includes("slow motion") || msg.includes("slow mo")) { setSpeed(0.5); log.push("🐢 Speed → 0.5x (slow)"); }
    if (msg.includes("double speed") || msg.includes("speed up")) { setSpeed(2); log.push("⚡ Speed → 2x"); }

    return log;
  }, []);

  // ── Voice control (Web Speech API) ────────────────────────────────────────
  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast({ title: "Voice not supported", description: "Use Chrome or Edge for voice input.", variant: "destructive" }); return; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; setVoiceActive(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setVoiceActive(false); recognitionRef.current = null;
      handleAiAssist(transcript);
    };
    rec.onerror = () => { setVoiceActive(false); recognitionRef.current = null; toast({ title: "Voice error", description: "Couldn't capture audio.", variant: "destructive" }); };
    rec.onend = () => { setVoiceActive(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    rec.start(); setVoiceActive(true);
    toast({ title: "🎙️ Listening…", description: "Speak your editing command or question." });
  };

  const handleAiAssist = async (message: string) => {
    if (!message.trim() || aiAssistLoading) return;
    const userMsg = message.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setAiAssistLoading(true);

    // If it's an editor command (starts with __cmd__ or aiEditorMode is on), execute it locally
    const isCmd = userMsg.startsWith("__cmd__") || aiEditorMode;
    const cleanMsg = userMsg.replace(/^__cmd__\s*/i, "");
    let executedLog: string[] = [];
    if (isCmd) {
      executedLog = executeEditorCommand(cleanMsg);
      if (executedLog.length > 0) {
        setAiActionLog(prev => [...executedLog, ...prev].slice(0, 20));
        // Add instant feedback before awaiting AI
        setAiMessages(prev => [...prev, { role: "assistant", content: `✅ Done! I applied these changes:\n${executedLog.join("\n")}\n\nLet me also give you some context…` }]);
      }
    }

    try {
      const editorContext = {
        aspectRatio, filter: filterPresetId, template: selectedTemplateId,
        duration: videoDuration ? Math.round(videoDuration) : null,
        textCount: textLayers.length, speed, platform: selectedPlatform,
        adminMode: true, editorMode: isCmd, mapStyle: mapVisualStyle,
        mapVehicle, waypoints: mapWaypoints.map(w => w.city).join(", "),
        actionsExecuted: executedLog,
      };
      // Use deep AI Operator endpoint in editor mode; chat endpoint otherwise
      const endpoint = isCmd ? "/api/studio/ai-operator" : "/api/studio/ai-assist";
      const res = await apiRequest(endpoint, "POST", { message: cleanMsg, context: editorContext });
      const data = await res.json();
      const reply = data.response || "Let me help you with that! Could you rephrase?";
      if (executedLog.length > 0) {
        // Replace the "done" message with the full AI response
        setAiMessages(prev => {
          const copy = [...prev];
          const lastAssistIdx = copy.map(m => m.role).lastIndexOf("assistant");
          if (lastAssistIdx >= 0) copy[lastAssistIdx] = { role: "assistant", content: `✅ Applied ${executedLog.length} change${executedLog.length > 1 ? "s" : ""}:\n${executedLog.join("\n")}\n\n${reply}` };
          return copy;
        });
      } else {
        setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: executedLog.length > 0 ? `✅ Changes applied! (${executedLog.join(", ")}) — AI response unavailable.` : "Network issue — try again." }]);
    } finally { setAiAssistLoading(false); }
  };

  const handleGenerateSubtitles = async () => {
    setAiSubtitleLoading(true);
    try {
      const res = await apiRequest("/api/reels/ai-caption", "POST", { filename: file?.name, duration: videoDuration || (trimEnd - trimStart), hint: (aiHint || "") + " — generate 3-5 short subtitle lines", subtitles: true });
      const data = await res.json();
      const lines = (data.caption || "").split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5);
      setAiSubtitles(lines);
      const _subTotalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 10;
      const _subSegDur = _subTotalDur / Math.max(1, lines.length);
      lines.forEach((line: string, idx: number) => {
        const _st = idx * _subSegDur;
        setTextLayers(prev => [...prev, { id: Date.now() + idx, text: line, color: aiSubtitleStyle === "neon" ? "#39ff14" : "#ffffff", size: aiSubtitleStyle === "minimal" ? 20 : 26, position: "bottom", animation: "fade", font: aiSubtitleStyle === "bold" ? "bold" : "default", startTime: _st, endTime: Math.min(_subTotalDur, _st + _subSegDur) }]);
      });
      toast({ title: `${lines.length} subtitle lines added` });
    } catch { toast({ title: "AI unavailable", variant: "destructive" }); }
    finally { setAiSubtitleLoading(false); }
  };

  // ── AI Smart Editor handlers ───────────────────────────────────────────────
  const handleRunSmartEdit = async () => {
    if (!clips.length) { toast({ title: "Add clips first", description: "Upload at least one clip before running AI analysis.", variant: "destructive" }); return; }
    setSmartEditLoading(true);
    setSmartEditAnalysis(null);
    setSmartEditApplied(new Set());
    try {
      const tlTotalDuration = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0);
      const res = await apiRequest("/api/studio/ai-smart-edit", "POST", {
        clips: clips.map((c, i) => ({
          index: i,
          filename: c.name,
          fullDuration: c.duration,
          currentAbsTrimStart: c.trimStart,
          currentAbsTrimEnd: c.trimEnd,
          effectiveDuration: c.trimEnd - c.trimStart,
        })),
        textLayers: textLayers.map(l => ({ id: l.id, text: l.text, position: l.position, startTime: l.startTime ?? 0, endTime: l.endTime ?? 5 })),
        totalDuration: tlTotalDuration,
        platform: "tiktok",
        aspectRatio,
        transition: selectedTransition,
        transcript: smartEditTranscript,
        userContext: smartEditContext,
        userGoal: smartEditGoal,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.details || data.error);
      setSmartEditAnalysis(data);
      toast({ title: "AI Smart Edit complete", description: `Found ${(data.clipAnalysis || []).filter((s: SmartClipSuggestion) => s.action !== "keep").length} edit suggestions` });
    } catch (err: any) {
      toast({ title: "AI analysis failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSmartEditLoading(false);
    }
  };

  const applySmartClipSuggestion = (s: SmartClipSuggestion, key: string) => {
    pushUndo();
    if (s.action === "cut") {
      setClips(prev => prev.filter((_, i) => i !== s.clipIndex));
      toast({ title: `Clip ${s.clipIndex + 1} removed` });
    } else if (s.action === "trim" && (s.newTrimStart !== undefined || s.newTrimEnd !== undefined)) {
      setClips(prev => prev.map((c, i) => {
        if (i !== s.clipIndex) return c;
        const ns = s.newTrimStart !== undefined ? Math.max(0, s.newTrimStart) : c.trimStart;
        const ne = s.newTrimEnd !== undefined ? Math.min(c.duration, s.newTrimEnd) : c.trimEnd;
        return { ...c, trimStart: ns, trimEnd: Math.max(ns + 0.1, ne) };
      }));
      toast({ title: `Clip ${s.clipIndex + 1} trimmed` });
    }
    setSmartEditApplied(prev => new Set([...prev, key]));
  };

  const applySmartTextSuggestion = (s: SmartTextSuggestion, key: string) => {
    pushUndo();
    if (s.action === "add" && s.text) {
      addTextLayer({ text: s.text, startTime: s.startTime ?? 0, endTime: s.endTime ?? 3, position: s.position ?? "top", font: "bold", color: "#ffffff", size: 28 });
      toast({ title: "Text overlay added" });
    } else if (s.action === "remove" && s.layerId) {
      setTextLayers(prev => prev.filter(l => l.id !== s.layerId));
      toast({ title: "Text layer removed" });
    }
    setSmartEditApplied(prev => new Set([...prev, key]));
  };

  const applyAllSmartSuggestions = () => {
    if (!smartEditAnalysis) return;
    pushUndo();
    const newApplied = new Set(smartEditApplied);
    // Apply transition recommendation
    if (smartEditAnalysis.transitionRecommendation) {
      const tr = smartEditAnalysis.transitionRecommendation.toLowerCase();
      if (["cut","fade","dissolve"].includes(tr)) setSelectedTransition(tr as any);
    }
    // Apply clip edits (process cuts first in reverse to preserve indices)
    const sorted = [...smartEditAnalysis.clipAnalysis].sort((a, b) => b.clipIndex - a.clipIndex);
    setClips(prev => {
      let c = [...prev];
      for (const s of sorted) {
        const key = `clip-${s.clipIndex}`;
        if (newApplied.has(key)) continue;
        if (s.action === "cut") {
          c = c.filter((_, i) => i !== s.clipIndex);
        } else if (s.action === "trim" && (s.newTrimStart !== undefined || s.newTrimEnd !== undefined)) {
          if (c[s.clipIndex]) {
            const ns = s.newTrimStart !== undefined ? Math.max(0, s.newTrimStart) : c[s.clipIndex].trimStart;
            const ne = s.newTrimEnd !== undefined ? Math.min(c[s.clipIndex].duration, s.newTrimEnd) : c[s.clipIndex].trimEnd;
            c[s.clipIndex] = { ...c[s.clipIndex], trimStart: ns, trimEnd: Math.max(ns + 0.1, ne) };
          }
        }
        newApplied.add(key);
      }
      return c;
    });
    // Apply text suggestions
    smartEditAnalysis.textSuggestions.forEach((s, i) => {
      const key = `text-${i}`;
      if (newApplied.has(key) || s.action !== "add" || !s.text) return;
      setTextLayers(prev => [...prev, {
        id: Date.now() + i, text: s.text!, color: "#ffffff", size: 28,
        position: s.position ?? "top", animation: "fade", font: "bold",
        startTime: s.startTime ?? 0, endTime: s.endTime ?? 3,
      }]);
      newApplied.add(key);
    });
    setSmartEditApplied(newApplied);
    toast({ title: "✅ All suggestions applied!", description: `${smartEditAnalysis.clipAnalysis.filter(s => s.action !== "keep").length} clip edits + ${smartEditAnalysis.textSuggestions.filter(s => s.action === "add").length} text layers` });
  };

  const handleMapAiRoute = async () => {
    setMapAiLoading(true);
    try {
      const res = await apiRequest("/api/studio/map-route", "POST", {});
      const data = await res.json();
      const text = (data.cities || "").trim();
      if (!text) throw new Error("Empty response");
      const cityNames = text.split(",").map((s: string) => s.trim()).filter(Boolean);
      const found: MapWaypointItem[] = [];
      cityNames.forEach((name: string) => {
        const match = MAP_CITIES_DB.find(c => c.city.toLowerCase() === name.toLowerCase() || c.city.toLowerCase().includes(name.toLowerCase()));
        if (match && found.length < 5 && !found.find(f => f.city === match.city)) {
          found.push({ id: `wp-ai-${found.length}`, ...match });
        }
      });
      if (found.length >= 2) {
        setMapWaypoints(found);
        toast({ title: "🗺️ AI Route Generated!", description: found.map(w => `${w.flag} ${w.city}`).join(" → ") });
      } else {
        // Fallback to a curated default route if AI parse fails
        const fallback = ["Amsterdam","Paris","Dubai","Tokyo"].map((name, i) => {
          const m = MAP_CITIES_DB.find(c => c.city === name);
          return m ? { id: `wp-fb-${i}`, ...m } : null;
        }).filter(Boolean) as MapWaypointItem[];
        if (fallback.length >= 2) {
          setMapWaypoints(fallback);
          toast({ title: "🗺️ Route Generated!", description: fallback.map(w => `${w.flag} ${w.city}`).join(" → ") });
        } else {
          toast({ title: "Couldn't match cities", description: "Try again for a different suggestion.", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "AI route failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setMapAiLoading(false);
    }
  };

  const handleAiCaption = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest("/api/reels/ai-caption", "POST", { filename: file?.name, duration: videoDuration || (trimEnd - trimStart), hint: aiHint || undefined });
      const data = await res.json();
      const full = [data.caption, ...(data.hashtags || [])].join(" ").slice(0, MAX_CAPTION);
      setCaption(full); toast({ title: "Caption generated!" });
    } catch { toast({ title: "AI unavailable", variant: "destructive" }); }
    finally { setAiLoading(false); }
  };

  // Caption library
  const saveCaption = () => {
    if (!caption.trim() || !newCaptionTitle.trim()) { toast({ title: "Add a title and caption first", variant: "destructive" }); return; }
    const saved: SavedCaption = { id: crypto.randomUUID(), title: newCaptionTitle, caption, tags: newCaptionTags, platform: captionPlatformTag, createdAt: new Date().toISOString().split("T")[0] };
    setSavedCaptions(prev => [saved, ...prev]); setNewCaptionTitle(""); setNewCaptionTags("");
    toast({ title: "Caption saved to library!" });
  };
  const loadCaption = (c: SavedCaption) => { setCaption(`${c.caption} ${c.tags}`.trim()); toast({ title: `"${c.title}" loaded` }); };

  // Upload
  const handleUpload = async () => {
    if (!file) return;
    setStep("uploading"); setProgress(0); setUploadSpeed(0); setEstimatedTime(0); setIsCompressing(false);
    let uploadResult: { secure_url: string; public_id: string; duration: number };
    try {
      if (file.size > COMPRESS_THRESHOLD) {
        setIsCompressing(true); setProgress(5);
        let authToken: string | null = null;
        try { const { auth } = await import("@/firebase/firebase"); if (auth.currentUser) authToken = await auth.currentUser.getIdToken(); } catch {}
        const formData = new FormData(); formData.append("video", file);
        const headers: HeadersInit = {}; if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        let sim = 10; const tick = setInterval(() => { sim = Math.min(80, sim + 0.8); setProgress(Math.round(sim)); }, 600);
        const response = await fetch("/api/reels/compress-upload", { method: "POST", headers, body: formData, credentials: "include" });
        clearInterval(tick);
        if (!response.ok) throw new Error("Video processing failed");
        uploadResult = await response.json(); setIsCompressing(false); setProgress(88);
      } else {
        let lastLoaded = 0; let lastTime = Date.now();
        const sigRes = await apiRequest("/api/reels/upload-signature", "GET");
        const sigData = await sigRes.json();
        const { signature, timestamp, folder, apiKey, cloudName } = sigData;
        const raw = await uploadVideoToCloudinary(file, { signature, timestamp, folder, apiKey, cloudName }, {
          onProgress: (pct) => {
            setProgress(pct); const now = Date.now(); const elapsed = (now - lastTime) / 1000;
            if (elapsed > 0.5) { const bUploaded = (pct / 85) * file.size; const bps = (bUploaded - lastLoaded) / elapsed; if (bps > 0) { setUploadSpeed(Math.round((bps / (1024 * 1024)) * 10) / 10); setEstimatedTime(Math.round((file.size - bUploaded) / bps)); } lastLoaded = bUploaded; lastTime = now; }
          },
        });
        uploadResult = { secure_url: raw.secure_url, public_id: raw.public_id, duration: raw.duration ?? 0 };
      }
      setProgress(92);
      const trimParts: string[] = [];
      if (trimStart > 0) trimParts.push(`so_${trimStart.toFixed(2)}`);
      if (trimEnd < videoDuration && trimEnd > 0) trimParts.push(`eo_${trimEnd.toFixed(2)}`);
      const videoUrl = uploadResult.secure_url.replace("/upload/", `/upload/${[trimParts.join(","), FULL_HD_TRANSFORM].filter(Boolean).join("/")}/`);
      let thumbnailUrl = uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg").replace("/video/upload/", "/video/upload/so_0/");
      if (coverDataUrl) {
        try {
          const coverSig = await (await apiRequest("/api/reels/upload-signature", "GET")).json();
          const fd = new FormData(); fd.append("file", coverDataUrl); fd.append("signature", coverSig.signature); fd.append("timestamp", String(coverSig.timestamp)); fd.append("folder", coverSig.folder); fd.append("api_key", coverSig.apiKey);
          const cr = await fetch(`https://api.cloudinary.com/v1_1/${coverSig.cloudName}/image/upload`, { method: "POST", body: fd }).then(r => r.json());
          if (cr.secure_url) thumbnailUrl = cr.secure_url;
        } catch {}
      }
      setProgress(96);
      await apiRequest("/api/reels", "POST", { videoUrl, videoPublicId: uploadResult.public_id, thumbnailUrl, caption: caption.trim() || null, duration: Math.round(uploadResult.duration ?? trimEnd - trimStart), status: "active" });
      setProgress(100); setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reels"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
      setStep("caption"); setProgress(0); setIsCompressing(false);
    }
  };

  const resetFilters = () => { setFilterPresetId("normal"); setBrightness(0); setContrast(0); setSaturation(0); };
  const resetAdjust  = () => { setWarmth(0); setShadows(0); setHighlights(0); setVignette(0); setGrain(0); setSharpen(false); };

  const highlightHashtags = (text: string) =>
    text.split(/(#\w+)/g).map((p, i) => p.startsWith("#") ? <span key={i} className="text-primary">{p}</span> : <span key={i}>{p}</span>);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-zinc-950 overflow-x-hidden overflow-y-hidden flex flex-col h-full w-full" data-testid="admin-creator-studio">

      {/* ── Studio Header ── */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0 gap-2 min-h-[48px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
            <Crown size={13} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-sm leading-tight truncate">Creator Studio</h1>
            <p className="text-zinc-500 text-[9px] hidden sm:block truncate">Full-access content production suite</p>
          </div>
          <span className="flex items-center gap-1 text-[9px] bg-gradient-to-r from-purple-500/20 to-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
            <Sparkles size={8} /> PRO
          </span>
          {step === "edit" && selectedPlatform && (
            <span className="hidden lg:flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full flex-shrink-0">
              {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.emoji} {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {(step === "edit" || step === "caption") && (
            <>
              {step === "edit" && (
                <Button onClick={() => setStep("caption")} size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-7 px-2 sm:px-3 text-xs" data-testid="button-next-caption">
                  <span className="hidden sm:inline">Caption</span>
                  <ChevronRight size={13} className="sm:ml-1" />
                </Button>
              )}
              {step === "caption" && (
                <>
                  <Button onClick={() => setStep("edit")} size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-7 px-2 sm:px-3 text-xs">
                    <ChevronLeft size={13} className="sm:mr-1" /> <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button onClick={handleUpload} size="sm" className="bg-gradient-to-r from-primary to-purple-600 text-white font-semibold h-7 px-2 sm:px-3 text-xs" data-testid="button-publish-reel">
                    <Upload size={12} className="sm:mr-1" /> <span className="hidden sm:inline">Publish</span>
                  </Button>
                </>
              )}
            </>
          )}
          {step !== "uploading" && step !== "done" && (
            <Button onClick={() => navigate("/admin/reels")} size="sm" variant="ghost" className="text-zinc-400 hover:text-white h-7 w-7 p-0" data-testid="button-close-studio">
              <X size={15} />
            </Button>
          )}
        </div>
      </div>

      {/* ── Step bar ── */}
      <div className="flex items-center gap-1.5 px-3 sm:px-5 py-1.5 bg-zinc-950/80 border-b border-zinc-800/50 flex-shrink-0">
        {(["pick","edit","caption"] as const).map((s, i) => {
          const icons = { pick: Film, edit: Scissors, caption: Type };
          const labels = { pick: "Select", edit: "Edit", caption: "Caption" };
          const Icon = icons[s]; const isActive = step === s; const isDone = ["pick","edit","caption"].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center">
              <div className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1 rounded-full", isActive ? "bg-primary/20 text-primary" : isDone ? "text-green-400" : "text-zinc-600")}>
                <Icon size={11} /> <span className="hidden sm:inline">{labels[s]}</span>
              </div>
              {i < 2 && <div className={cn("w-8 h-0.5 mx-1 rounded-full", isDone ? "bg-green-400" : "bg-zinc-800")} />}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1"><Database size={9} className="text-green-400" /><span className="hidden sm:inline">DB connected</span></span>
          <span className="flex items-center gap-1"><Cpu size={9} className="text-primary" /><span className="hidden sm:inline">AI unlocked</span></span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col admin-step-slide">

        {/* ── PICK ── */}
        {step === "pick" && (
          <div className="flex flex-col lg:flex-row flex-1 gap-0 overflow-auto">
            {/* Single upload */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div
                onClick={() => fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={handleDrop}
                className="flex flex-col items-center justify-center gap-5 w-full max-w-md h-72 border-2 border-dashed border-zinc-700 rounded-3xl cursor-pointer hover:border-primary/60 hover:bg-zinc-900/40 transition-all"
                data-testid="dropzone-video">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Film size={36} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-xl">Drop a video to edit</p>
                  <p className="text-zinc-500 text-sm mt-1">or click to browse files</p>
                  <p className="text-zinc-600 text-xs mt-2">MP4, MOV, WEBM · Max 500 MB</p>
                </div>
                <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                  <Upload size={15} className="mr-2" /> Browse files
                </Button>
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFilePick} data-testid="input-video-file" />
              </div>
            </div>

            {/* Admin quick-start panel */}
            <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-zinc-800 p-5 space-y-5 overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={13} className="text-yellow-400" />
                  <p className="text-white text-sm font-bold">Admin Quick Start</p>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: Calendar, label: "Schedule a post", desc: "Pick video → Schedule tab → set date/time", color: "text-blue-400" },
                    { icon: ListChecks, label: "Batch upload queue", desc: "Add multiple videos → Batch tab", color: "text-green-400" },
                    { icon: Archive, label: "Use caption library", desc: "Load saved captions in Caption step", color: "text-orange-400" },
                    { icon: BarChart3, label: "Analytics dashboard", desc: "Best posting times per platform", color: "text-purple-400" },
                  ].map(({ icon: Icon, label, desc, color }) => (
                    <div key={label} className="flex gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                      <Icon size={15} className={cn("flex-shrink-0 mt-0.5", color)} />
                      <div>
                        <p className="text-white text-xs font-semibold">{label}</p>
                        <p className="text-zinc-500 text-[10px] mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks size={13} className="text-green-400" />
                  <p className="text-white text-sm font-bold">Batch Queue</p>
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">{batchQueue.length} queued</span>
                </div>
                <button onClick={() => batchInputRef.current?.click()} className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 transition-colors text-zinc-400 hover:text-white text-sm" data-testid="button-batch-pick">
                  <PlusCircle size={14} /> Add videos to batch
                </button>
                <input ref={batchInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleBatchPick} />
                {batchQueue.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {batchQueue.slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                        <div className="w-8 h-10 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                          <video src={item.previewUrl} className="w-full h-full object-cover" muted playsInline />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-zinc-300 text-[10px] truncate">{item.file.name}</p>
                          <p className="text-zinc-500 text-[9px]">{formatSize(item.file.size)}</p>
                        </div>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", item.status === "queued" ? "bg-zinc-700 text-zinc-400" : item.status === "done" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>{item.status}</span>
                        <button onClick={() => setBatchQueue(prev => prev.filter(b => b.id !== item.id))} className="text-zinc-600 hover:text-red-400 transition-colors"><X size={12} /></button>
                      </div>
                    ))}
                    {batchQueue.length > 4 && <p className="text-zinc-600 text-[10px] text-center">+{batchQueue.length - 4} more</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT ── */}
        {step === "edit" && previewUrl && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── Studio control bar ── */}
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800 bg-zinc-950 overflow-hidden">
              <button onClick={undo} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" title="Undo (Ctrl+Z)" data-testid="button-undo"><RotateCcw size={12} /></button>
              <button onClick={redo} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" title="Redo (Ctrl+Y)" data-testid="button-redo"><RefreshCw size={12} /></button>
              <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
              {(() => {
                const t = EDIT_TABS.find(t => t.id === editTab);
                if (!t) return null;
                const Icon = t.icon;
                const colorMap: Record<string, string> = { trim: "text-orange-400", text: "text-blue-400", audio: "text-green-400", filters: "text-purple-400", adjust: "text-cyan-400", motion: "text-yellow-400", speed: "text-red-400", templates: "text-primary", transitions: "text-blue-400", brand: "text-pink-400", export: "text-blue-400", viral: "text-orange-400", aitools: "text-purple-400", sounds: "text-green-400", stickers: "text-yellow-400", schedule: "text-blue-400", batch: "text-green-400", library: "text-orange-400", analytics: "text-purple-400" };
                const c = colorMap[editTab] ?? "text-primary";
                return (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/60 min-w-0 overflow-hidden">
                    <Icon size={11} className={cn("flex-shrink-0", c)} />
                    <span className={cn("text-xs font-semibold truncate", c)}>{t.label}</span>
                    {t.adminOnly && <span className="text-[8px] text-yellow-400 bg-yellow-400/10 px-1 py-0.5 rounded font-bold flex-shrink-0">ADMIN</span>}
                  </div>
                );
              })()}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-zinc-600 hidden md:block whitespace-nowrap">Space=Play · S=Split · ?=Help</span>
                <div className="w-px h-3 bg-zinc-800 hidden sm:block" />
                <button
                  onClick={() => setShowHelpOverlay(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white transition-colors font-bold text-xs"
                  title="Keyboard shortcuts & help (?)"
                  data-testid="button-help">
                  ?
                </button>
                <div className="w-px h-3 bg-zinc-800 hidden sm:block" />
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5" title="Database connected"><Database size={9} className="text-green-400" /><span className="text-[9px] text-zinc-600 hidden sm:block">DB</span></div>
                  <div className="flex items-center gap-0.5 ml-0.5" title="AI ready"><Cpu size={9} className="text-primary" /><span className="text-[9px] text-zinc-600 hidden sm:block">AI</span></div>
                </div>
              </div>
            </div>

            {/* ── Main editing area ── */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

              {/* ── VIDEO PREVIEW PANEL — always visible on all screens ── */}
              <div className="w-full flex-shrink-0 flex flex-col lg:w-80 xl:w-[340px] border-b lg:border-b-0 lg:border-r border-zinc-800 bg-black studio-video-panel max-h-[44vh] sm:max-h-[48vh] lg:max-h-full">

                {/* Preview canvas */}
                <div className="flex-1 flex items-center justify-center bg-black overflow-hidden min-h-0">
                  {(() => {
                    const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio)!;
                    // Real-time AR camera class — switches per AI-detected timed motion event
                    const activeAiRegion = effectRegions.find(r =>
                      r.type === "motion" && r.cameraPresetId &&
                      currentVideoTime >= r.startTime && currentVideoTime < r.endTime
                    );
                    const activeCamCls = activeAiRegion
                      ? CAMERA_MOVE_PRESETS.find(p => p.id === activeAiRegion.cameraPresetId)?.cls
                      : (aiCameraMove ? CAMERA_MOVE_PRESETS.find(p => p.id === aiCameraMove)?.cls : undefined);
                    const activeMotionCls = activeAiRegion
                      ? `admin-vid-motion-${activeAiRegion.effectId}`
                      : (selectedMotionId ? `admin-vid-motion-${selectedMotionId}` : undefined);
                    return (
                      <div ref={canvasDivRef}
                           className={cn("relative overflow-hidden bg-black", activeMotionCls, activeCamCls)}
                           style={{ aspectRatio: `${ar.w}/${ar.h}`, maxHeight: "100%", maxWidth: "100%", cursor: draggingTextRef.current ? "grabbing" : videoPanRef.current ? "grabbing" : "grab" }}
                           onMouseDown={e => { if (!(e.target as HTMLElement).closest("[data-text-layer]")) videoPanRef.current = { startX: e.clientX, startY: e.clientY, origX: videoOffset.x, origY: videoOffset.y }; }}
                           onMouseMove={handleCanvasMouseMove}
                           onMouseUp={handleCanvasMouseUp}
                           onMouseLeave={handleCanvasMouseUp}
                           onTouchStart={e => { const t = e.touches[0]; videoPanRef.current = { startX: t.clientX, startY: t.clientY, origX: videoOffset.x, origY: videoOffset.y }; }}
                           onTouchMove={e => { const vd = videoPanRef.current; if (!vd || !canvasDivRef.current) return; const t2 = e.touches[0]; const rect = canvasDivRef.current.getBoundingClientRect(); setVideoOffset({ x: Math.max(0, Math.min(100, vd.origX - ((t2.clientX - vd.startX) / rect.width) * 100)), y: Math.max(0, Math.min(100, vd.origY - ((t2.clientY - vd.startY) / rect.height) * 100)) }); }}
                           onTouchEnd={() => { videoPanRef.current = null; }}>
                        <video ref={previewVideoRef}
                          src={clips[activeClipIdx]?.url ?? previewUrl}
                          className={cn("h-full w-full object-cover pointer-events-none", clipTransitionClass)} muted={muted} playsInline
                          onTimeUpdate={handleVideoTimeUpdate}
                          style={{ filter: cssFilter, objectPosition: `${videoOffset.x}% ${videoOffset.y}%` }} />
                        {vignette > 0 && <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 ${vignette * 3}px ${vignette * 2}px rgba(0,0,0,0.7)` }} />}
                        {progressBarEnabled && <div className="absolute top-0 left-0 right-0 h-1 bg-black/30"><div className="h-full rounded-full admin-progress-bar" style={{ background: progressBarColor }} /></div>}
                        {lowerThirdEnabled && lowerThirdText && (
                          <div className={cn("absolute bottom-0 left-0 right-0 px-2 py-1.5",
                            lowerThirdStyle === "bold-bar" && "bg-primary",
                            lowerThirdStyle === "minimal-line" && "border-t-2 border-white bg-black/40",
                            lowerThirdStyle === "glass" && "bg-white/10 backdrop-blur-sm",
                            lowerThirdStyle === "neon-border" && "border border-primary bg-black/60",
                            lowerThirdStyle === "broadcast" && "bg-red-600",
                            lowerThirdStyle === "urban-tag" && "bg-yellow-400",
                          )}>
                            <p className={cn("text-xs font-bold truncate", lowerThirdStyle === "urban-tag" ? "text-black" : "text-white")}>{lowerThirdText}</p>
                          </div>
                        )}
                        {stickerLayers.map(s => (
                          <div key={s.id} className="absolute pointer-events-none select-none" style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.size, lineHeight: 1 }}>{s.emoji}</div>
                        ))}
                        {textLayers.map(layer => {
                          // Respect time range if set
                          if (layer.startTime !== undefined && layer.endTime !== undefined) {
                            if (currentVideoTime < layer.startTime || currentVideoTime > layer.endTime) return null;
                          }
                          const fs = TEXT_FONTS.find(f => f.id === layer.font)?.style ?? "inherit";
                          const hasCustom = layer.x !== undefined && layer.y !== undefined;
                          const isSelected = selectedTextLayerId === layer.id;
                          const posStyle: React.CSSProperties = hasCustom
                            ? { position: "absolute", left: `${layer.x}%`, top: `${layer.y}%`, transform: "translate(-50%,-50%)", textAlign: "center" }
                            : { position: "absolute", left: 0, right: 0, textAlign: "center",
                                ...(layer.position === "top" ? { top: "0.5rem" } : layer.position === "center" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: "0.5rem" }) };
                          return (
                            <div key={layer.id}
                              className={cn("px-1 select-none transition-[outline]", getAnimClass(layer.animation))}
                              style={{ ...posStyle, color: layer.color, fontSize: layer.size * 0.7, fontFamily: fs,
                                fontWeight: layer.font === "bold" ? 900 : 700, textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                                cursor: "grab", pointerEvents: "auto",
                                outline: isSelected ? "2px solid hsl(var(--primary))" : "none",
                                outlineOffset: "3px", borderRadius: "3px" }}
                              onMouseDown={e => handleCanvasTextMouseDown(e, layer.id)}
                              data-testid={`canvas-text-${layer.id}`}>
                              {layer.text}
                            </div>
                          );
                        })}
                        {speed !== 1 && <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{SPEED_LABELS[speed]}</div>}
                        {logoWatermark && <div className={cn("absolute text-white text-[9px] font-bold bg-black/50 px-1 py-0.5 rounded pointer-events-none", logoPosition.includes("top") ? "top-2" : "bottom-2", logoPosition.includes("left") ? "left-2" : logoPosition.includes("right") ? "right-2" : "left-1/2 -translate-x-1/2")}>{logoWatermark}</div>}
                        {filterPresetId !== "normal" && <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">{FILTER_PRESETS.find(p => p.id === filterPresetId)?.label}</div>}
                        {selectedTemplateId && <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-primary/80 text-white text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">{STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.emoji} {STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.label}</div>}
                        {selectedMotionId && <div className="absolute bottom-1.5 right-1.5 bg-zinc-900/80 text-primary text-[8px] font-medium px-1.5 py-0.5 rounded-full">{MOTION_PRESETS.find(m => m.id === selectedMotionId)?.emoji} {MOTION_PRESETS.find(m => m.id === selectedMotionId)?.label}</div>}

                        {/* ── Hidden audio track player (synced to video) ── */}
                        <audio ref={audioRef} className="hidden" loop />
                        {/* ── Hidden voice-over player (synced to video) ── */}
                        <audio ref={voiceAudioRef} className="hidden" />

                        {/* ── Timeline region active chip ── */}
                        {selectedRegionId && (() => {
                          const r = effectRegions.find(x => x.id === selectedRegionId);
                          if (!r) return null;
                          return (
                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/75 backdrop-blur-sm rounded-full px-2 py-0.5 z-50 pointer-events-auto select-none"
                              style={{ border: `1px solid ${r.color}80` }}>
                              <span className="text-[7px]">{r.emoji}</span>
                              <span className="text-[7px] font-bold" style={{ color: r.color }}>{r.label}</span>
                              <span className="text-[6px] font-mono text-white/50 ml-0.5">{formatTime(r.startTime)}–{formatTime(r.endTime)}</span>
                              <button className="ml-1 text-white/40 hover:text-white transition-colors text-[8px]" onClick={() => setSelectedRegionId(null)}>✕</button>
                            </div>
                          );
                        })()}

                        {/* ── Real-time Graphic Overlays — all draggable ── */}
                        {selectedGraphicOverlay === "money-counter" && (() => {
                          const pos = overlayPositions["money-counter"] ?? { x: 50, y: 50 };
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100 }}
                              onMouseDown={e => handleOverlayMouseDown(e, "money-counter")}
                              data-testid="overlay-money-counter">
                              <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-4 py-3 text-center border border-green-500/40" style={{ animation: "adminCountUp 0.5s ease both" }}>
                                <div className="text-green-400 text-[8px] font-bold uppercase tracking-widest mb-0.5">{counterLabel}</div>
                                <div className="text-white font-black text-xl tabular-nums">{counterPrefix}{counterCurrent.toLocaleString("nl-NL")}{counterSuffix}</div>
                                <div className="h-1 bg-zinc-700 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-green-400 rounded-full transition-all duration-100" style={{ width: `${(counterCurrent / Math.max(counterTarget, 1)) * 100}%` }} /></div>
                              </div>
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "year-journey" && (() => {
                          const pos = overlayPositions["year-journey"] ?? { x: 50, y: 12 };
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100 }}
                              onMouseDown={e => handleOverlayMouseDown(e, "year-journey")}
                              data-testid="overlay-year-journey">
                              <div className="bg-black/80 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-yellow-500/40 text-center">
                                <div className="text-yellow-400 text-[7px] font-bold uppercase tracking-wider">Our Journey</div>
                                <div className="text-white font-black text-2xl tabular-nums">{yearCurrent}</div>
                                <div className="flex gap-0.5 mt-1">
                                  {Array.from({ length: Math.min(yearTo - yearFrom + 1, 12) }, (_, i) => yearFrom + i).map(y => (
                                    <div key={y} className={cn("flex-1 h-1 rounded-full transition-all duration-300", y <= yearCurrent ? "bg-yellow-400" : "bg-zinc-700")} />
                                  ))}
                                </div>
                              </div>
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "timeline-story" && (() => {
                          const pos = overlayPositions["timeline-story"] ?? { x: 50, y: 88 };
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100, width: "92%" }}
                              onMouseDown={e => handleOverlayMouseDown(e, "timeline-story")}
                              data-testid="overlay-timeline-story">
                              <div className="bg-black/80 backdrop-blur-sm rounded-xl p-2 border border-white/10">
                                <div className="flex items-end gap-1 mb-1.5">
                                  {timelineSteps.map((step, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                      <div className={cn("w-2 h-2 rounded-full border-2 transition-all duration-500", i === timelineActive ? "border-primary bg-primary scale-125" : i < timelineActive ? "border-primary/60 bg-primary/40" : "border-zinc-600 bg-zinc-800")} />
                                      <span className={cn("text-[6px] font-bold text-center leading-tight transition-colors", i === timelineActive ? "text-white" : "text-zinc-500")}>{step}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="h-0.5 bg-zinc-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${((timelineActive + 1) / timelineSteps.length) * 100}%` }} />
                                </div>
                              </div>
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "map-route" && mapWaypoints.length > 0 && (() => {
                          const pos = overlayPositions["map-route"] ?? { x: 50, y: 50 };
                          return (
                            <div
                              style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", width: "78%", height: "62%", cursor: "grab", zIndex: 20, borderRadius: 10, overflow: "hidden", border: "1.5px solid rgba(57,255,20,0.35)", boxShadow: "0 0 18px rgba(57,255,20,0.15)" }}
                              onMouseDown={e => handleOverlayMouseDown(e, "map-route")} data-testid="overlay-map-route">
                              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[7px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap select-none z-50 pointer-events-none">⠿ drag to reposition</div>
                              <MapRouteOverlay
                                waypoints={mapWaypoints}
                                lineColor={mapLineColor}
                                showDistance={mapShowDistance}
                                showFlags={mapShowFlags}
                                mapLineStyle={mapLineStyle}
                                mapVisualStyle={mapVisualStyle}
                                mapVehicle={mapVehicle}
                                mapAnimSpeed={mapAnimSpeed}
                              />
                            </div>
                          );
                        })()}
                        {false && selectedGraphicOverlay === "map-route" && mapWaypoints.length > 0 && (() => {
                          const gTS = (lat: number, lon: number) => ({ x: lon + 180, y: 90 - lat });
                          const lons = mapWaypoints.map(w => w.lon);
                          const lats = mapWaypoints.map(w => w.lat);
                          const lonSpan = Math.max(20, Math.max(...lons) - Math.min(...lons));
                          const latSpan = Math.max(15, Math.max(...lats) - Math.min(...lats));
                          const padLon = lonSpan * 0.5 + 18;
                          const padLat = latSpan * 0.5 + 14;
                          const minLon = Math.max(-180, Math.min(...lons) - padLon);
                          const maxLon = Math.min(180, Math.max(...lons) + padLon);
                          const minLat = Math.max(-90, Math.min(...lats) - padLat);
                          const maxLat = Math.min(90, Math.max(...lats) + padLat);
                          const vx = (minLon + 180).toFixed(1), vy = (90 - maxLat).toFixed(1);
                          const vw = (maxLon - minLon), vh = (maxLat - minLat);
                          const dVB = `${vx} ${vy} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
                          const fSz = Math.max(2.8, Math.min(7, vw / 16));
                          const mR  = Math.max(1.2, Math.min(4, vw / 40));
                          const dashLen = Math.max(8, vw / 10);
                          const segs = mapWaypoints.slice(0, -1).map((wp, i) => {
                            const a = wp, b = mapWaypoints[i + 1];
                            const from = gTS(a.lat, a.lon), to = gTS(b.lat, b.lon);
                            const dx = to.x - from.x, dy = to.y - from.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const cx = (from.x + to.x) / 2 - dy * 0.2;
                            const cy = (from.y + to.y) / 2 - dist * 0.22;
                            const d = `M${from.x.toFixed(2)},${from.y.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`;
                            return { from, to, cx, cy, d, km: haversineKm(a.lat, a.lon, b.lat, b.lon), pathId: `mp${i}`, delay: i * 0.7 };
                          });
                          const isNeon = mapStyleMode === "neon";
                          const bgColor = mapStyleMode === "minimal" ? "rgba(5,10,25,0.72)" : isNeon ? "rgba(0,3,15,0.85)" : "rgba(2,8,24,0.82)";
                          const gridC  = isNeon ? "rgba(0,255,160,0.055)" : "rgba(100,130,180,0.065)";
                          const cFill  = isNeon ? "#001c14" : "#0d1829";
                          const lW = 2;
                          const hlShape = mapHighlightCountry ? MAP_COUNTRY_SHAPES[mapHighlightCountry] : null;
                          return (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: bgColor }}>
                              <svg width="100%" height="100%" viewBox={dVB} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>
                                <defs>
                                  <filter id="fMG" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation={mR * 1.5} result="b"/>
                                    <feComposite in="SourceGraphic" in2="b" operator="over"/>
                                  </filter>
                                  <filter id="fMG2" x="-100%" y="-100%" width="300%" height="300%">
                                    <feGaussianBlur stdDeviation={mR * 3} result="b"/>
                                    <feComposite in="SourceGraphic" in2="b" operator="over"/>
                                  </filter>
                                  {segs.map(s => <path key={`d${s.pathId}`} id={s.pathId} d={s.d}/>)}
                                  {hlShape && (
                                    <linearGradient id="flGr" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                                      <stop offset="33.3%" stopColor={hlShape.flagColors[0]}/>
                                      <stop offset="33.3%" stopColor={hlShape.flagColors[1]}/>
                                      <stop offset="66.6%" stopColor={hlShape.flagColors[1]}/>
                                      <stop offset="66.6%" stopColor={hlShape.flagColors[2]}/>
                                      <stop offset="100%"  stopColor={hlShape.flagColors[2]}/>
                                    </linearGradient>
                                  )}
                                </defs>
                                {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lon => (
                                  <line key={`gl${lon}`} x1={lon+180} y1={0} x2={lon+180} y2={180} stroke={gridC} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                                ))}
                                {[-60,-30,0,30,60].map(lat => (
                                  <line key={`gt${lat}`} x1={0} y1={90-lat} x2={360} y2={90-lat} stroke={gridC} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
                                ))}
                                <line x1={0} y1={90} x2={360} y2={90} stroke={isNeon?"rgba(0,255,160,0.12)":"rgba(150,180,220,0.12)"} strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
                                <line x1={180} y1={0} x2={180} y2={180} stroke={isNeon?"rgba(0,255,160,0.08)":"rgba(150,180,220,0.08)"} strokeWidth="0.6" vectorEffect="non-scaling-stroke"/>
                                {MAP_CONTINENT_PATHS.map(c => <path key={c.name} d={c.d} fill={cFill} opacity={0.95}/>)}
                                {hlShape && (
                                  <g>
                                    <path d={hlShape.path} fill="url(#flGr)" opacity={0.82}/>
                                    <path d={hlShape.path} fill="none" stroke={mapHighlightColor} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity={0.9} style={{ animation: "adminNeonCityPulse 2s ease-in-out infinite" }} filter="url(#fMG)"/>
                                  </g>
                                )}
                                {segs.map((seg, i) => {
                                  const mx = ((seg.from.x+seg.to.x)/2+seg.cx)/2;
                                  const my = ((seg.from.y+seg.to.y)/2+seg.cy)/2 - fSz*1.7;
                                  const label = `${Math.round(seg.km).toLocaleString()} km`;
                                  const bw = fSz * label.length * 0.62;
                                  const bh = fSz * 1.5;
                                  return (
                                  <g key={`r${i}`}>
                                    {mapLineStyle === "glowing" && <path d={seg.d} stroke={mapLineColor} strokeWidth="6" fill="none" opacity={0.08} filter="url(#fMG2)" vectorEffect="non-scaling-stroke"/>}
                                    {mapLineStyle === "glowing" && <path d={seg.d} stroke={mapLineColor} strokeWidth="3" fill="none" opacity={0.2} filter="url(#fMG)" vectorEffect="non-scaling-stroke"/>}
                                    {/* Route line */}
                                    <path d={seg.d} stroke={mapLineColor} strokeWidth={lW} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                                      strokeDasharray={mapLineStyle==="dashed"?`${dashLen} ${dashLen*0.7}`:mapLineStyle==="dotted"?`${dashLen*0.2} ${dashLen}`:"2000 2000"}
                                      style={{ animation: mapLineStyle!=="dashed"&&mapLineStyle!=="dotted" ? `adminMapDraw ${2.2+i*0.6}s cubic-bezier(0.4,0,0.2,1) ${seg.delay}s both` : undefined }}/>
                                    {/* ✈ Airplane animating along route with auto-rotation */}
                                    <text fontSize={fSz * 2.6} textAnchor="middle" dominantBaseline="middle"
                                      fill={mapLineColor}
                                      style={{ filter: `drop-shadow(0 0 ${mR*0.9}px ${mapLineColor}) drop-shadow(0 0 ${mR*0.4}px white)` }}>
                                      ✈
                                      <animateMotion dur={`${4+i*0.7}s`} begin={`${seg.delay+2.3}s`} repeatCount="indefinite" path={seg.d} rotate="auto"/>
                                      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.3;0.35;0.9;0.95;1" dur={`${4+i*0.7}s`} begin={`${seg.delay+2.3}s`} repeatCount="indefinite"/>
                                    </text>
                                    {/* Distance badge */}
                                    {mapShowDistance && (
                                      <g style={{ animation: `adminMapFadeIn 0.7s ease ${seg.delay+3.2}s both`, opacity: 0 }}>
                                        <rect x={mx - bw/2} y={my - bh/2} width={bw} height={bh} rx={bh*0.38}
                                          fill="rgba(0,0,0,0.78)" stroke={mapLineColor} strokeWidth="0.6" opacity="0.95"/>
                                        <text x={mx} y={my} fill={mapLineColor} fontSize={fSz*0.92} textAnchor="middle"
                                          dominantBaseline="middle" fontWeight="bold">
                                          {label}
                                        </text>
                                      </g>
                                    )}
                                  </g>
                                  );
                                })}
                                {mapWaypoints.map((wp, i) => {
                                  const { x, y } = gTS(wp.lat, wp.lon);
                                  return (
                                    <g key={wp.id} style={{ animation: `adminMapFadeIn 0.6s ease ${i*0.5+1.2}s both`, opacity: 0 }}>
                                      <circle cx={x} cy={y} r={mR} fill={mapLineColor} opacity="0">
                                        <animate attributeName="r" from={mR} to={mR*4.5} dur="2.5s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" from="0.38" to="0" dur="2.5s" repeatCount="indefinite"/>
                                      </circle>
                                      <circle cx={x} cy={y} r={mR*0.7} fill={mapLineColor} opacity="0">
                                        <animate attributeName="r" from={mR*0.7} to={mR*3} dur="2.5s" begin="1.25s" repeatCount="indefinite"/>
                                        <animate attributeName="opacity" from="0.28" to="0" dur="2.5s" begin="1.25s" repeatCount="indefinite"/>
                                      </circle>
                                      <circle cx={x} cy={y} r={mR*1.6} fill={mapLineColor} opacity={0.18} filter="url(#fMG)"/>
                                      <circle cx={x} cy={y} r={mR} fill={mapLineColor} filter="url(#fMG)"/>
                                      <circle cx={x} cy={y} r={mR*0.42} fill="white"/>
                                      {mapShowFlags && <text x={x} y={y-mR*1.8} fontSize={fSz*1.7} textAnchor="middle" dominantBaseline="auto">{wp.flag}</text>}
                                      <text x={x} y={y-mR*1.8-(mapShowFlags?fSz*1.9:0)} fill="white" fontSize={fSz} textAnchor="middle" fontWeight="bold"
                                        style={{ filter: "drop-shadow(0 0.5px 2px rgba(0,0,0,0.92))" }}>
                                        {wp.city}
                                      </text>
                                    </g>
                                  );
                                })}
                                {/* Total route distance — bottom-right corner */}
                                {mapShowDistance && segs.length > 0 && (() => {
                                  const totalKm = Math.round(segs.reduce((s, seg) => s + seg.km, 0));
                                  const totalLabel = `Total: ${totalKm.toLocaleString()} km`;
                                  const tx = parseFloat(vx) + parseFloat(vw.toFixed(1)) - fSz * 0.6;
                                  const ty = parseFloat(vy) + parseFloat(vh.toFixed(1)) - fSz * 1.2;
                                  const tw = fSz * totalLabel.length * 0.62;
                                  const th = fSz * 1.7;
                                  return (
                                    <g style={{ animation: "adminMapFadeIn 0.8s ease 4.5s both", opacity: 0 }}>
                                      <rect x={tx - tw} y={ty - th/2} width={tw} height={th} rx={th*0.35}
                                        fill="rgba(0,0,0,0.82)" stroke={mapLineColor} strokeWidth="0.7"/>
                                      <text x={tx - tw/2} y={ty} fill={mapLineColor} fontSize={fSz*0.96}
                                        textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
                                        {totalLabel}
                                      </text>
                                    </g>
                                  );
                                })()}
                              </svg>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "stats-burst" && (() => {
                          const pos = overlayPositions["stats-burst"] ?? { x: 50, y: 80 };
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100, width: "92%" }}
                              onMouseDown={e => handleOverlayMouseDown(e, "stats-burst")} data-testid="overlay-stats-burst">
                              <div className="grid grid-cols-2 gap-1.5">
                                {statsBurstItems.map((stat, i) => (
                                  <div key={i} className="relative overflow-hidden rounded-xl p-2 text-center border"
                                    style={{ background: "rgba(0,0,0,0.82)", borderColor: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", animation: `adminStatsBurstIn 0.5s cubic-bezier(.34,1.56,.64,1) ${i * 0.12}s both` }}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent pointer-events-none" />
                                    <div className="text-white font-black text-lg tabular-nums leading-none">{stat.value}{stat.suffix}</div>
                                    <div className="text-zinc-400 text-[7px] font-semibold uppercase tracking-widest mt-0.5">{stat.label}</div>
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, hsl(var(--primary)/0.8), transparent)` }} />
                                  </div>
                                ))}
                              </div>
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "pin-drop" && (() => {
                          const pos = overlayPositions["pin-drop"] ?? { x: 50, y: 50 };
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100 }}
                              onMouseDown={e => handleOverlayMouseDown(e, "pin-drop")} data-testid="overlay-pin-drop">
                              <div className="flex flex-col items-center" style={{ animation: "adminPinDrop 1s ease-out both" }}>
                                <div className="text-4xl drop-shadow-lg">📍</div>
                                <div className="bg-primary/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 whitespace-nowrap">{mapCity}</div>
                                <div className="w-3 h-1 bg-black/50 rounded-full mt-0.5 blur-sm" />
                              </div>
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "neon-city" && (() => {
                          const pos = overlayPositions["neon-city"] ?? { x: 50, y: 78 };
                          const nc = neonCityColor;
                          return (
                            <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 100, width: "100%", height: "50%" }}
                              onMouseDown={e => handleOverlayMouseDown(e, "neon-city")} data-testid="overlay-neon-city">
                              <svg width="100%" height="100%" viewBox="0 0 240 100" preserveAspectRatio="none">
                                <defs>
                                  <filter id="ncGlow">
                                    <feGaussianBlur stdDeviation="2" result="b"/>
                                    <feComposite in="SourceGraphic" in2="b" operator="over"/>
                                  </filter>
                                </defs>
                                {/* Ground glow */}
                                <rect x="0" y="90" width="240" height="10" fill={nc} opacity="0.08" />
                                {/* Ground line */}
                                <line x1="0" y1="90" x2="240" y2="90" stroke={nc} strokeWidth="0.8" opacity="0.6" />
                                {/* Skyline */}
                                <path d="M0,90 L0,62 L14,62 L14,40 L18,40 L18,28 L24,28 L24,18 L30,18 L30,28 L36,28 L36,40 L40,40 L40,62 L48,62 L48,44 L52,44 L52,30 L58,30 L58,44 L62,44 L62,56 L68,56 L68,20 L74,20 L74,10 L80,10 L80,20 L86,20 L86,56 L90,56 L90,44 L96,44 L96,32 L100,32 L100,22 L106,22 L106,16 L112,16 L112,22 L118,22 L118,32 L122,32 L122,44 L128,44 L128,58 L132,58 L132,38 L136,38 L136,26 L142,26 L142,38 L146,38 L146,56 L152,56 L152,44 L158,44 L158,30 L162,30 L162,22 L168,22 L168,30 L174,30 L174,44 L178,44 L178,58 L184,58 L184,46 L190,46 L190,34 L196,34 L196,46 L200,46 L200,62 L210,62 L210,50 L216,50 L216,62 L224,62 L224,70 L240,70 L240,90 Z"
                                  fill={`${nc}18`} stroke={nc} strokeWidth="0.9" filter="url(#ncGlow)" style={{ animation: "adminNeonCityPulse 3s ease-in-out infinite" }} />
                                {/* Windows - animated randomly */}
                                {[22,26,32,36,70,76,82,96,102,108,134,140,160,166,192,198].map((x, i) => (
                                  <rect key={i} x={x} y={i % 3 === 0 ? 35 : i % 3 === 1 ? 45 : 55} width="4" height="3" rx="0.5"
                                    fill={nc} opacity="0.85"
                                    style={{ animation: `adminNeonCitySign ${1.5 + (i * 0.37) % 2}s ease-in-out ${(i * 0.28) % 1.5}s infinite` }} />
                                ))}
                                {/* Neon sign */}
                                <text x="120" y="8" textAnchor="middle" fontSize="6" fontWeight="bold" fontFamily="monospace"
                                  fill={nc} filter="url(#ncGlow)" style={{ animation: "adminNeonCitySign 2s ease-in-out infinite" }}>
                                  {neonCityLabel}
                                </text>
                                {/* Stars */}
                                {[10,35,55,85,140,170,205,225].map((x, i) => (
                                  <circle key={i} cx={x} cy={4 + (i % 5) * 2} r="0.7" fill="white" opacity={0.4 + (i % 3) * 0.2}
                                    style={{ animation: `adminNeonCityPulse ${1 + i * 0.3}s ease-in-out infinite` }} />
                                ))}
                                {/* Moon */}
                                <circle cx="215" cy="12" r="6" fill="none" stroke={nc} strokeWidth="0.6" opacity="0.5" />
                                <circle cx="218" cy="10" r="4.5" fill="rgba(0,0,0,0.85)" />
                              </svg>
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {selectedGraphicOverlay === "split-reveal" && (() => {
                          const sp = splitRevealPos;
                          return (
                            <div className="absolute inset-0 pointer-events-auto" onMouseDown={e => handleOverlayMouseDown(e, "split-reveal")} data-testid="overlay-split-reveal" style={{ cursor: "grab", zIndex: 100 }}>
                              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                {/* Left panel */}
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/25 to-transparent"
                                  style={{ clipPath: `polygon(0 0,${sp}% 0,${Math.max(0,sp-12)}% 100%,0 100%)` }} />
                                {/* Animated film strip on left edge */}
                                <div className="absolute inset-y-0 flex flex-col justify-around pointer-events-none" style={{ left: "3%" }}>
                                  {Array.from({length:6}).map((_,i) => <div key={i} className="w-3 h-4 border border-white/20 rounded-sm bg-black/30" />)}
                                </div>
                                {/* Divider line with glow */}
                                <div className="absolute inset-y-0 w-0.5 bg-white/80 shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]"
                                  style={{ left: `${sp - 3}%` }} />
                                {/* Arrows indicator */}
                                <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1"
                                  style={{ left: `${Math.max(5, sp - 10)}%` }}>
                                  <div className="flex items-center gap-0.5 bg-black/75 backdrop-blur-sm rounded-full px-1.5 py-0.5 border border-white/20">
                                    <span className="text-white text-[7px] font-bold">◀ BEFORE</span>
                                  </div>
                                </div>
                                <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1"
                                  style={{ left: `${Math.min(90, sp + 3)}%` }}>
                                  <div className="flex items-center gap-0.5 bg-black/75 backdrop-blur-sm rounded-full px-1.5 py-0.5 border border-white/20">
                                    <span className="text-white text-[7px] font-bold">AFTER ▶</span>
                                  </div>
                                </div>
                                {/* Diagonal slash accent */}
                                <div className="absolute inset-y-0 w-6 bg-gradient-to-r from-primary/30 to-transparent"
                                  style={{ left: `${sp - 5}%`, clipPath: "polygon(0 0,100% 0,60% 100%,0 100%)" }} />
                              </div>
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap select-none">⠿ drag</div>
                            </div>
                          );
                        })()}
                        {/* ── Active Caption Layers — draggable ── */}
                        {captionLayers.map(cap => {
                          const isActive = videoDuration > 0 ? (clipCurrentTime >= cap.startTime && clipCurrentTime <= cap.endTime) : true;
                          const isSel = selectedCaptionId === cap.id;
                          if (!isActive && !isSel) return null;
                          const styleMap: Record<CaptionStyle, React.CSSProperties> = {
                            bold:     { fontWeight: 900, fontSize: cap.fontSize * 0.7, textShadow: "0 2px 8px rgba(0,0,0,0.95)", fontFamily: "'Arial Black',Impact,sans-serif" },
                            minimal:  { fontWeight: 400, fontSize: cap.fontSize * 0.6, letterSpacing: "0.04em", fontFamily: "system-ui,sans-serif" },
                            neon:     { fontWeight: 700, fontSize: cap.fontSize * 0.65, textShadow: `0 0 10px ${cap.color}, 0 0 20px ${cap.color}`, fontFamily: "'Arial Black',sans-serif" },
                            subtitle: { fontWeight: 600, fontSize: cap.fontSize * 0.62, textShadow: "0 1px 4px rgba(0,0,0,0.9)", fontFamily: "system-ui,sans-serif" },
                            karaoke:  { fontWeight: 800, fontSize: cap.fontSize * 0.65, textShadow: "0 2px 6px rgba(0,0,0,0.9)", fontFamily: "'Arial Black',sans-serif" },
                            outline:  { fontWeight: 700, fontSize: cap.fontSize * 0.65, WebkitTextStroke: `1.5px ${cap.color}`, color: "transparent", fontFamily: "system-ui,sans-serif" },
                          };
                          return (
                            <div key={cap.id}
                              className="absolute select-none"
                              style={{ left: `${cap.x}%`, top: `${cap.y}%`, transform: "translate(-50%,-50%)", cursor: "grab", pointerEvents: "auto", zIndex: 200,
                                color: cap.color, ...styleMap[cap.style],
                                ...(cap.bg ? { background: "rgba(0,0,0,0.72)", padding: "2px 8px", borderRadius: 6, backdropFilter: "blur(4px)" } : {}),
                                outline: isSel ? "2px solid hsl(var(--primary))" : "none", outlineOffset: "3px", borderRadius: isSel ? "4px" : cap.bg ? "6px" : undefined,
                              }}
                              onMouseDown={e => handleCaptionMouseDown(e, cap.id)}
                              data-testid={`caption-layer-${cap.id}`}>
                              {cap.text}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* CapCut-style Playback controls */}
                <div className="flex-shrink-0 flex items-center px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-900">
                  {/* Left: fullscreen toggle + time */}
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={() => { if (previewVideoRef.current) { if (document.fullscreenElement) document.exitFullscreen(); else previewVideoRef.current.requestFullscreen?.(); } }}
                      className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors touch-manipulation"
                      title="Fullscreen" data-testid="button-fullscreen">
                      <Maximize2 size={16} />
                    </button>
                    <span className="text-[11px] text-white font-mono tabular-nums">
                      {formatTime(clipCurrentTime)}<span className="text-zinc-500 mx-0.5">/</span>{formatTime(clips[activeClipIdx]?.trimEnd ?? videoDuration)}
                    </span>
                  </div>
                  {/* Center: big play/pause */}
                  <button onClick={handlePlayPause}
                    className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90 touch-manipulation shadow-lg"
                    data-testid="button-preview-play">
                    {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />}
                  </button>
                  {/* Right: split + undo/redo */}
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <button onClick={handleSplitClip}
                      className="flex items-center gap-1 text-[10px] font-semibold text-white/60 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors active:scale-95 touch-manipulation"
                      data-testid="button-split-clip">
                      <Scissors size={11} /> Split
                    </button>
                    <button onClick={undo} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors touch-manipulation" title="Undo" data-testid="button-undo-play">
                      <RotateCcw size={15} />
                    </button>
                    <button onClick={redo} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors touch-manipulation" title="Redo" data-testid="button-redo-play">
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </div>

                {/* Aspect ratio strip — always visible, compact */}
                <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-t border-zinc-800/60 bg-zinc-900 overflow-x-auto scrollbar-hide">
                  {ASPECT_RATIOS.map(ar => (
                    <button key={ar.id} onClick={() => setAspectRatio(ar.id)}
                      className={cn("flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all border flex-shrink-0 active:scale-95 touch-manipulation",
                        aspectRatio === ar.id ? "border-primary text-primary bg-primary/15" : "border-zinc-700 text-zinc-500 hover:border-zinc-500")}
                      data-testid={`button-aspect-${ar.id.replace(":", "x")}`}>
                      <div className="border border-current rounded-sm" style={{ width: Math.round(ar.w * 3), height: Math.round(ar.h * 3) }} />
                      {ar.label}
                    </button>
                  ))}
                  <div className="ml-auto flex-shrink-0 text-[8px] text-zinc-600 pr-1">Drag video to reposition</div>
                </div>

                {/* Timeline sync strip — visual bridge connecting video preview to the timeline below */}
                <div className="flex-shrink-0 border-t border-zinc-800/60">
                  <div
                    className="relative h-1.5 bg-zinc-800/80 cursor-pointer group"
                    onClick={e => {
                      if (!previewVideoRef.current || !videoDuration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      previewVideoRef.current.currentTime = pct * videoDuration;
                    }}
                    title="Seek" data-testid="video-panel-timeline-strip">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 transition-none"
                      style={{ width: videoDuration > 0 ? `${(clipCurrentTime / videoDuration) * 100}%` : "0%" }} />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow shadow-primary/60 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: videoDuration > 0 ? `${(clipCurrentTime / videoDuration) * 100}%` : "0%" }} />
                  </div>
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <span className="text-[8px] text-zinc-600 font-mono">{formatTime(0)}</span>
                    <span className="text-[8px] text-primary font-mono tabular-nums">{formatTime(clipCurrentTime)}</span>
                    <span className="text-[8px] text-zinc-600 font-mono">{videoDuration > 0 ? formatTime(videoDuration) : "--:--"}</span>
                  </div>
                </div>
              </div>

              {/* ── CENTER PANEL: tool content + multi-clip timeline ── */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">

              {/* Tool content panel */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 space-y-3">

                {/* ── TEMPLATES ── */}
                {editTab === "templates" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Clapperboard size={14} className="text-primary" />
                      <h3 className="text-white font-bold text-sm">Studio Templates</h3>
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-auto">8 looks</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {STUDIO_TEMPLATES.map(tpl => {
                        const isSel = selectedTemplateId === tpl.id;
                        return (
                          <div key={tpl.id} className={cn("rounded-xl border-2 transition-all", isSel ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}>
                            <button onClick={() => applyTemplate(tpl)}
                              className="flex items-start gap-3 p-3 w-full text-left active:scale-[0.99] transition-transform"
                              data-testid={`button-template-${tpl.id}`}>
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0", isSel ? "bg-primary/20" : "bg-zinc-800")}>{tpl.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className={cn("text-sm font-bold", isSel ? "text-primary" : "text-white")}>{tpl.label}</p>
                                  <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1 py-0.5 rounded">{tpl.category}</span>
                                </div>
                                <p className="text-zinc-500 text-xs">{tpl.description}</p>
                              </div>
                              {isSel && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse" />}
                            </button>
                            <div className="px-3 pb-2">
                              <button
                                onClick={() => applyTemplate(tpl, true)}
                                className="flex items-center gap-1 text-[9px] text-primary/60 hover:text-primary transition-colors" data-testid={`button-template-timeline-${tpl.id}`}>
                                <Plus size={9} /> Set custom range
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedTemplateId && <button onClick={() => { setSelectedTemplateId(null); resetFilters(); resetAdjust(); setTextLayers(prev => prev.filter(l => !l.fromTemplate)); }} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"><RotateCcw size={11} /> Clear template</button>}
                  </>
                )}

                {/* ── MOTION ── */}
                {editTab === "motion" && (
                  <>
                    {/* Motion Effects — animate the video layer */}
                    <div className="flex items-center gap-2"><Layers3 size={14} className="text-purple-400" /><h3 className="text-white font-bold text-sm">Motion Effects</h3><span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full ml-auto">8 effects</span></div>
                    <p className="text-zinc-500 text-xs -mt-1">Tap to apply a real-time kinetic animation + sample text to your preview.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MOTION_PRESETS.slice(0, 8).map(preset => {
                        const isSel = selectedMotionId === preset.id;
                        return (
                          <div key={preset.id} className={cn("flex flex-col gap-1.5 p-2.5 rounded-xl border-2 transition-all", isSel ? "border-purple-500 bg-purple-500/10" : "border-zinc-800 bg-zinc-900")}>
                            <button
                              onClick={() => {
                                if (isSel) { setSelectedMotionId(null); setEffectRegions(prev => prev.filter(r => !(r.type === "motion" && r.effectId === preset.id))); return; }
                                const { textStyle, sampleText } = preset;
                                const newId = Date.now();
                                setTextLayers(prev => {
                                  const kept = prev.filter(l => !l.fromMotion);
                                  return [...kept, { id: newId, text: sampleText, color: textStyle.color, size: textStyle.size, position: textStyle.position, animation: textStyle.animation, font: textStyle.font, fromMotion: preset.id }];
                                });
                                motionTextLayerIdRef.current = newId;
                                setNextTextId(n => n + 1);
                                setSelectedMotionId(preset.id);
                                // Auto-add motion region to timeline spanning full video
                                const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
                                setEffectRegions(prev => {
                                  const without = prev.filter(r => !(r.type === "motion"));
                                  return [...without, { type: "motion" as const, effectId: preset.id, label: preset.label, emoji: preset.emoji, color: "#7c3aed", id: `er-mot-${Date.now()}`, startTime: 0, endTime: totalDur, posX: 50, posY: 50 }];
                                });
                                setTlExpanded(true);
                                if (lastToastDismissRef.current) lastToastDismissRef.current();
                                const { dismiss } = toast({ title: `${preset.emoji} ${preset.label} applied! Visible on timeline →` });
                                lastToastDismissRef.current = dismiss;
                              }}
                              className="flex items-center gap-2 w-full text-left active:scale-95 transition-transform" data-testid={`button-motion-${preset.id}`}>
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0", isSel ? "bg-purple-500/20" : "bg-zinc-800")}>{preset.emoji}</div>
                              <p className={cn("text-xs font-semibold leading-tight flex-1", isSel ? "text-purple-400" : "text-white")}>{preset.label}</p>
                              {isSel && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />}
                            </button>
                            <p className="text-zinc-500 text-[10px] leading-snug">{preset.description}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <button
                                onClick={() => addPresetAtPlayhead(preset, "motion")}
                                className="flex items-center gap-0.5 text-[9px] text-purple-300 hover:text-white bg-purple-600/25 hover:bg-purple-600/40 px-1.5 py-0.5 rounded-md transition-colors font-semibold"
                                title="Add at current playhead position"
                                data-testid={`button-motion-at-playhead-${preset.id}`}>
                                ▶ At playhead
                              </button>
                              <button
                                onClick={() => { setPendingEffect({ type: "motion", effectId: preset.id, label: preset.label, emoji: preset.emoji, color: "#7c3aed" }); setPendingRangeStart(0); setPendingRangeEnd(videoDuration || 5); }}
                                className="flex items-center gap-0.5 text-[9px] text-purple-400/60 hover:text-purple-400 transition-colors"
                                data-testid={`button-motion-timeline-${preset.id}`}>
                                <Plus size={8} /> Set range
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedMotionId && (
                      <button onClick={() => { setSelectedMotionId(null); setTextLayers(prev => prev.filter(l => !l.fromMotion)); }} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
                        <RotateCcw size={11} /> Clear motion effect
                      </button>
                    )}

                    {/* Graphic Overlays — animated data graphics on the video */}
                    <div className="border-t border-zinc-800 pt-3 flex items-center gap-2">
                      <Layers size={14} className="text-cyan-400" />
                      <h3 className="text-white font-bold text-sm">Graphic Overlays</h3>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full ml-auto">LIVE</span>
                    </div>
                    <p className="text-zinc-500 text-xs -mt-1">Real-time animated data graphics — map routes, counters, timelines, city overlays — rendered live on your preview.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MOTION_PRESETS.slice(8).map(preset => {
                        const isSel = selectedGraphicOverlay === preset.id;
                        return (
                          <div key={preset.id} className={cn("flex flex-col gap-1.5 p-2.5 rounded-xl border-2 transition-all", isSel ? "border-cyan-500 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900")}>
                            <button
                              onClick={() => {
                                if (isSel) { setSelectedGraphicOverlay(null); setEffectRegions(prev => prev.filter(r => !(r.type === "overlay" && r.effectId === preset.id))); return; }
                                setSelectedGraphicOverlay(preset.id);
                                setCounterCurrent(0);
                                if (preset.id === "map-route" && mapWaypoints.length < 2) {
                                  setMapWaypoints([
                                    { id: "wp-d0", city: "Amsterdam", lat: 52.37, lon: 4.90, flag: "🇳🇱", country: "Netherlands" },
                                    { id: "wp-d1", city: "Paris",     lat: 48.86, lon: 2.35, flag: "🇫🇷", country: "France"      },
                                    { id: "wp-d2", city: "Barcelona", lat: 41.39, lon: 2.15, flag: "🇪🇸", country: "Spain"       },
                                  ]);
                                }
                                // Auto-add overlay region spanning full video
                                const totalDur = clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0) || videoDuration || 5;
                                setEffectRegions(prev => {
                                  const without = prev.filter(r => !(r.type === "overlay"));
                                  return [...without, { type: "overlay" as const, effectId: preset.id, label: preset.label, emoji: preset.emoji, color: "#0891b2", id: `er-ovl-${Date.now()}`, startTime: 0, endTime: totalDur, posX: 50, posY: 50 }];
                                });
                                setTlExpanded(true);
                                if (lastToastDismissRef.current) lastToastDismissRef.current();
                                const { dismiss } = toast({ title: `${preset.emoji} ${preset.label} live! Visible on timeline →` });
                                lastToastDismissRef.current = dismiss;
                              }}
                              className="flex items-center gap-2 w-full text-left active:scale-95 transition-transform" data-testid={`button-overlay-${preset.id}`}>
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0", isSel ? "bg-cyan-500/20" : "bg-zinc-800")}>{preset.emoji}</div>
                              <p className={cn("text-xs font-semibold leading-tight flex-1", isSel ? "text-cyan-400" : "text-white")}>{preset.label}</p>
                              {isSel && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />}
                            </button>
                            <p className="text-zinc-500 text-[10px] leading-snug">{preset.description}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <button
                                onClick={() => addPresetAtPlayhead(preset, "overlay")}
                                className="flex items-center gap-0.5 text-[9px] text-cyan-300 hover:text-white bg-cyan-600/25 hover:bg-cyan-600/40 px-1.5 py-0.5 rounded-md transition-colors font-semibold"
                                title="Add at current playhead position"
                                data-testid={`button-overlay-at-playhead-${preset.id}`}>
                                ▶ At playhead
                              </button>
                              <button
                                onClick={() => { setPendingEffect({ type: "overlay", effectId: preset.id, label: preset.label, emoji: preset.emoji, color: "#0891b2" }); setPendingRangeStart(0); setPendingRangeEnd(videoDuration || 5); }}
                                className="flex items-center gap-0.5 text-[9px] text-cyan-400/60 hover:text-cyan-400 transition-colors"
                                data-testid={`button-overlay-timeline-${preset.id}`}>
                                <Plus size={8} /> Set range
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Timeline Regions summary ── */}
                    {effectRegions.length > 0 && (
                      <div className="border-t border-zinc-800 pt-3 space-y-1.5">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={12} className="text-purple-400" />
                          <span className="text-white text-xs font-bold">Timeline Regions</span>
                          <span className="ml-auto text-[9px] text-zinc-500">{effectRegions.length} block{effectRegions.length !== 1 ? "s" : ""}</span>
                        </div>
                        {effectRegions.map(r => (
                          <div key={r.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${selectedRegionId === r.id ? "bg-white/10" : "bg-zinc-900/60 hover:bg-zinc-800/60"}`}
                            style={{ borderLeft: `2px solid ${r.color}` }}
                            onClick={() => { setSelectedRegionId(r.id); if (r.type === "overlay") setSelectedGraphicOverlay(r.effectId); if (r.type === "motion") setSelectedMotionId(r.effectId); }}>
                            <span className="text-xs">{r.emoji}</span>
                            <span className="text-xs font-medium text-white flex-1 truncate">{r.label}</span>
                            <span className="text-[9px] font-mono text-zinc-500 flex-shrink-0">{formatTime(r.startTime)}–{formatTime(r.endTime)}</span>
                            <span className="text-[8px] px-1 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color + "25", color: r.color }}>{r.type}</span>
                            <button className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                              onClick={e => { e.stopPropagation(); setEffectRegions(prev => prev.filter(x => x.id !== r.id)); if (selectedRegionId === r.id) setSelectedRegionId(null); }}>
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Overlay config panel — shows contextual controls for active overlay */}
                    {selectedGraphicOverlay && (
                      <div className="p-3 rounded-xl bg-zinc-900 border border-cyan-500/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                          <p className="text-cyan-400 text-xs font-bold uppercase tracking-wide">
                            {MOTION_PRESETS.find(p => p.id === selectedGraphicOverlay)?.emoji} Live Config
                          </p>
                          <button onClick={() => setSelectedGraphicOverlay(null)} className="ml-auto text-zinc-500 hover:text-white transition-colors" data-testid="button-clear-overlay">
                            <X size={13} />
                          </button>
                        </div>

                        {/* Money counter & stats config */}
                        {(selectedGraphicOverlay === "money-counter" || selectedGraphicOverlay === "stats-burst") && (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-zinc-500 text-[10px] block mb-1">Prefix (€ / $ / £)</label>
                                <input value={counterPrefix} onChange={e => setCounterPrefix(e.target.value)}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                  data-testid="input-counter-prefix" placeholder="€" />
                              </div>
                              <div>
                                <label className="text-zinc-500 text-[10px] block mb-1">Suffix (K+ / % / ×)</label>
                                <input value={counterSuffix} onChange={e => setCounterSuffix(e.target.value)}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                  data-testid="input-counter-suffix" placeholder="K+" />
                              </div>
                            </div>
                            <div>
                              <label className="text-zinc-500 text-[10px] block mb-1">Target: <span className="text-white font-bold">{counterPrefix}{counterTarget.toLocaleString("nl-NL")}{counterSuffix}</span></label>
                              <input type="range" min={100} max={1000000} step={100} value={counterTarget}
                                onChange={e => { setCounterTarget(Number(e.target.value)); setCounterCurrent(0); }}
                                className="w-full accent-cyan-500" data-testid="input-counter-target" />
                              <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5"><span>100</span><span>1M</span></div>
                            </div>
                            <div>
                              <label className="text-zinc-500 text-[10px] block mb-1">Label</label>
                              <input value={counterLabel} onChange={e => setCounterLabel(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                data-testid="input-counter-label" placeholder="Revenue Generated" />
                            </div>
                            <button onClick={() => setCounterCurrent(0)} className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors" data-testid="button-restart-counter">
                              <RotateCcw size={9} /> Restart animation
                            </button>
                          </div>
                        )}

                        {/* Year journey config */}
                        {selectedGraphicOverlay === "year-journey" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-zinc-500 text-[10px] block mb-1">From year</label>
                                <input type="number" value={yearFrom} onChange={e => setYearFrom(Number(e.target.value))}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                  data-testid="input-year-from" />
                              </div>
                              <div>
                                <label className="text-zinc-500 text-[10px] block mb-1">To year</label>
                                <input type="number" value={yearTo} onChange={e => setYearTo(Number(e.target.value))}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                  data-testid="input-year-to" />
                              </div>
                            </div>
                            <p className="text-zinc-600 text-[10px]">Animates: {yearFrom} → {yearTo} at 0.5s/year · looping</p>
                          </div>
                        )}

                        {/* Neon City config */}
                        {selectedGraphicOverlay === "neon-city" && (
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-zinc-500 text-[10px] block mb-1">Neon colour</label>
                              <div className="flex items-center gap-2">
                                <input type="color" value={neonCityColor} onChange={e => setNeonCityColor(e.target.value)}
                                  className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" data-testid="input-neon-color" />
                                <div className="flex gap-1 flex-wrap">
                                  {["#39ff14","#ff073a","#00d4ff","#ff6ef7","#ffd700"].map(c => (
                                    <button key={c} onClick={() => setNeonCityColor(c)}
                                      className="w-5 h-5 rounded-full border-2 transition-all"
                                      style={{ backgroundColor: c, borderColor: neonCityColor === c ? "white" : "transparent" }}
                                      data-testid={`button-neon-color-${c.replace("#","")}`} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-zinc-500 text-[10px] block mb-1">Sign label</label>
                              <input value={neonCityLabel} onChange={e => setNeonCityLabel(e.target.value.toUpperCase())} maxLength={12}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors font-mono"
                                data-testid="input-neon-label" placeholder="CITY LIFE" />
                            </div>
                          </div>
                        )}

                        {/* Split Reveal config */}
                        {selectedGraphicOverlay === "split-reveal" && (
                          <div className="space-y-2">
                            <label className="text-zinc-500 text-[10px] block">Divider position <span className="text-white font-mono">{splitRevealPos}%</span></label>
                            <input type="range" min={15} max={80} step={1} value={splitRevealPos}
                              onChange={e => setSplitRevealPos(Number(e.target.value))}
                              className="w-full accent-cyan-500" data-testid="input-split-reveal-pos" />
                            <div className="flex justify-between text-[9px] text-zinc-600"><span>15%</span><span>80%</span></div>
                          </div>
                        )}

                        {/* Stats Burst items config */}
                        {selectedGraphicOverlay === "stats-burst" && (
                          <div className="space-y-2">
                            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Stats cards</p>
                            {statsBurstItems.map((item, i) => (
                              <div key={i} className="grid grid-cols-3 gap-1.5">
                                <input value={item.label} onChange={e => setStatsBurstItems(prev => prev.map((s,j) => j===i ? {...s,label:e.target.value} : s))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-[10px] outline-none focus:border-cyan-500 transition-colors"
                                  placeholder="Label" data-testid={`input-stats-label-${i}`} />
                                <input value={item.value} onChange={e => setStatsBurstItems(prev => prev.map((s,j) => j===i ? {...s,value:e.target.value} : s))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-[10px] outline-none focus:border-cyan-500 transition-colors font-bold"
                                  placeholder="10K" data-testid={`input-stats-value-${i}`} />
                                <input value={item.suffix} onChange={e => setStatsBurstItems(prev => prev.map((s,j) => j===i ? {...s,suffix:e.target.value} : s))}
                                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-[10px] outline-none focus:border-cyan-500 transition-colors"
                                  placeholder="+" data-testid={`input-stats-suffix-${i}`} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Map route & Pin drop config */}
                        {(selectedGraphicOverlay === "map-route" || selectedGraphicOverlay === "pin-drop") && (
                          selectedGraphicOverlay === "pin-drop" ? (
                            <div>
                              <label className="text-zinc-500 text-[10px] block mb-1">City / Location name</label>
                              <input value={mapCity} onChange={e => setMapCity(e.target.value)} placeholder="Amsterdam"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                data-testid="input-map-city" />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <MapPin size={11} className="text-cyan-400"/>
                                  <span className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Route Waypoints</span>
                                  <span className="ml-auto text-zinc-600 text-[9px]">{mapWaypoints.length}/5</span>
                                </div>
                                <div className="space-y-1">
                                  {mapWaypoints.map((wp, i) => (
                                    <div key={wp.id} className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-2 py-1.5 group">
                                      <span className="text-zinc-500 text-[9px] w-3 text-center font-bold">{i + 1}</span>
                                      <span className="text-base leading-none">{wp.flag}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-[11px] font-semibold truncate">{wp.city}</p>
                                        <p className="text-zinc-500 text-[9px]">{wp.country}</p>
                                      </div>
                                      {i < mapWaypoints.length - 1 && <span className="text-zinc-600 text-[9px]">✈</span>}
                                      {mapWaypoints.length > 2 && (
                                        <button onClick={() => setMapWaypoints(prev => prev.filter(w => w.id !== wp.id))}
                                          className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                          data-testid={`button-remove-wp-${i}`}>
                                          <X size={11}/>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {mapWaypoints.length >= 2 && (
                                  <p className="text-zinc-600 text-[9px] mt-1 text-center">
                                    Total ≈ {mapWaypoints.slice(0,-1).reduce((s,w,i) => s + haversineKm(w.lat,w.lon,mapWaypoints[i+1].lat,mapWaypoints[i+1].lon), 0).toLocaleString()} km
                                  </p>
                                )}
                              </div>

                              {mapWaypoints.length < 5 && (
                                <div className="relative">
                                  <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5">
                                    <Search size={11} className="text-zinc-500 flex-shrink-0"/>
                                    <input value={mapSearchQuery}
                                      onChange={e => { setMapSearchQuery(e.target.value); setMapShowCitySugg(true); }}
                                      onFocus={() => setMapShowCitySugg(true)}
                                      onBlur={() => setTimeout(() => setMapShowCitySugg(false), 160)}
                                      placeholder="Add city…"
                                      className="flex-1 bg-transparent text-white text-xs outline-none placeholder:text-zinc-600"
                                      data-testid="input-map-city-search"/>
                                  </div>
                                  {mapShowCitySugg && mapSearchQuery.length >= 1 && (() => {
                                    const hits = MAP_CITIES_DB.filter(c =>
                                      c.city.toLowerCase().includes(mapSearchQuery.toLowerCase()) &&
                                      !mapWaypoints.find(w => w.city === c.city)
                                    ).slice(0, 5);
                                    if (!hits.length) return null;
                                    return (
                                      <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
                                        {hits.map(c => (
                                          <button key={c.city} onMouseDown={() => { setMapWaypoints(prev => [...prev, { id: `wp-${Date.now()}`, ...c }]); setMapSearchQuery(""); setMapShowCitySugg(false); }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-zinc-800 transition-colors text-left"
                                            data-testid={`button-add-city-${c.city}`}>
                                            <span className="text-base leading-none">{c.flag}</span>
                                            <div>
                                              <p className="text-white text-xs font-medium">{c.city}</p>
                                              <p className="text-zinc-500 text-[9px]">{c.country}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Quick Templates</label>
                                <div className="flex flex-wrap gap-1">
                                  {MAP_ROUTE_TEMPLATES.map(t => (
                                    <button key={t.label} onClick={() => {
                                      const wps = t.cities.flatMap((name, i) => {
                                        const c = MAP_CITIES_DB.find(x => x.city === name);
                                        return c ? [{ id: `wp-tpl-${i}`, ...c }] : [];
                                      });
                                      if (wps.length >= 2) setMapWaypoints(wps);
                                    }}
                                      className="text-[9px] px-2 py-1 rounded-full bg-zinc-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-zinc-400 border border-zinc-700 hover:border-cyan-500/40 transition-all"
                                      data-testid={`button-map-tpl`}>
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Route Style</label>
                                <div className="grid grid-cols-4 gap-1">
                                  {(["solid","dashed","dotted","glowing"] as const).map(s => (
                                    <button key={s} onClick={() => setMapLineStyle(s)}
                                      className={cn("py-1.5 rounded-lg text-[9px] font-semibold border transition-all",
                                        mapLineStyle===s ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                                      data-testid={`button-map-ls-${s}`}>
                                      {s==="glowing"?"✨Glow":s==="dashed"?"- - -":s==="dotted"?"·  ·  ·":"━━━"}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Route Color</label>
                                <div className="flex items-center gap-2">
                                  <input type="color" value={mapLineColor} onChange={e => setMapLineColor(e.target.value)}
                                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-zinc-700 p-0.5"
                                    data-testid="input-map-line-color"/>
                                  <div className="flex gap-1 flex-wrap">
                                    {["#39ff14","#00d4ff","#ff3b30","#ff9f0a","#ffffff","#bf5af2","#ff2d55","#ffd60a"].map(c => (
                                      <button key={c} onClick={() => setMapLineColor(c)}
                                        className={cn("w-5 h-5 rounded-full border-2 transition-all", mapLineColor===c?"border-white scale-110":"border-transparent")}
                                        style={{ backgroundColor: c }} data-testid={`button-map-clr`}/>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Visual Style</label>
                                <div className="grid grid-cols-5 gap-1">
                                  {([
                                    { v: "cinematic" as MapVisualStyle, icon: "🎬", label: "Film" },
                                    { v: "cartoon"   as MapVisualStyle, icon: "🎨", label: "Toon" },
                                    { v: "neon"      as MapVisualStyle, icon: "💜", label: "Neon" },
                                    { v: "3d-route"  as MapVisualStyle, icon: "🏔️", label: "3D" },
                                    { v: "social"    as MapVisualStyle, icon: "📱", label: "Clean" },
                                  ]).map(({ v, icon, label }) => (
                                    <button key={v} onClick={() => setMapVisualStyle(v)}
                                      className={cn("py-1.5 rounded-lg text-[9px] font-semibold border transition-all flex flex-col items-center gap-0.5",
                                        mapVisualStyle === v ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                                      data-testid={`button-map-vstyle-${v}`}>
                                      <span className="text-base leading-none">{icon}</span>
                                      <span>{label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Vehicle</label>
                                <div className="grid grid-cols-4 gap-1">
                                  {([
                                    { v: "plane" as MapVehicle, icon: "✈️", label: "Plane" },
                                    { v: "car"   as MapVehicle, icon: "🚗", label: "Car" },
                                    { v: "train" as MapVehicle, icon: "🚂", label: "Train" },
                                    { v: "ship"  as MapVehicle, icon: "🚢", label: "Ship" },
                                  ]).map(({ v, icon, label }) => (
                                    <button key={v} onClick={() => setMapVehicle(v)}
                                      className={cn("py-1.5 rounded-lg text-[9px] font-semibold border transition-all flex flex-col items-center gap-0.5",
                                        mapVehicle === v ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                                      data-testid={`button-map-vehicle-${v}`}>
                                      <span className="text-base leading-none">{icon}</span>
                                      <span>{label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Anim Speed</label>
                                  <span className="text-cyan-400 text-[10px] font-bold">{mapAnimSpeed.toFixed(1)}x</span>
                                </div>
                                <input type="range" min="0.3" max="3" step="0.1" value={mapAnimSpeed}
                                  onChange={e => setMapAnimSpeed(parseFloat(e.target.value))}
                                  className="w-full accent-cyan-500 h-1.5 rounded-full"
                                  data-testid="input-map-anim-speed"/>
                              </div>

                              <div className="flex items-center gap-2">
                                <button onClick={() => setMapShowDistance(p => !p)}
                                  className={cn("flex-1 py-1 rounded-lg text-[10px] border transition-all",
                                    mapShowDistance?"bg-cyan-500/20 border-cyan-500 text-cyan-400":"bg-zinc-800 border-zinc-700 text-zinc-500")}
                                  data-testid="button-toggle-distance">
                                  ✈ Distance
                                </button>
                                <button onClick={() => setMapShowFlags(p => !p)}
                                  className={cn("flex-1 py-1 rounded-lg text-[10px] border transition-all",
                                    mapShowFlags?"bg-cyan-500/20 border-cyan-500 text-cyan-400":"bg-zinc-800 border-zinc-700 text-zinc-500")}
                                  data-testid="button-toggle-flags">
                                  🏳 Flags
                                </button>
                              </div>

                              <div>
                                <label className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 block">Country Highlight</label>
                                <div className="flex items-center gap-2">
                                  <select value={mapHighlightCountry ?? ""} onChange={e => setMapHighlightCountry(e.target.value || null)}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-cyan-500"
                                    data-testid="select-map-highlight">
                                    <option value="">None</option>
                                    {Object.entries(MAP_COUNTRY_SHAPES).map(([k, v]) => (
                                      <option key={k} value={k}>{v.flag} {v.name}</option>
                                    ))}
                                  </select>
                                  {mapHighlightCountry && (
                                    <input type="color" value={mapHighlightColor} onChange={e => setMapHighlightColor(e.target.value)}
                                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-zinc-700 p-0.5"
                                      data-testid="input-map-hl-color"/>
                                  )}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Sparkles size={11} className="text-cyan-400"/>
                                  <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider">AI Route Suggester</p>
                                </div>
                                <p className="text-zinc-500 text-[9px] mb-2">AI picks a creative, visually striking travel route for your content.</p>
                                <button onClick={handleMapAiRoute} disabled={mapAiLoading}
                                  className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-[10px] font-bold py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                  data-testid="button-map-ai-route">
                                  {mapAiLoading ? <><RotateCcw size={10} className="animate-spin"/> Generating…</> : <><Sparkles size={10}/> Generate AI Route</>}
                                </button>
                              </div>
                            </div>
                          )
                        )}

                        {/* Story timeline config */}
                        {selectedGraphicOverlay === "timeline-story" && (
                          <div className="space-y-2">
                            <label className="text-zinc-500 text-[10px] block">Timeline steps</label>
                            <div className="space-y-1.5">
                              {timelineSteps.map((step, i) => (
                                <input key={i} value={step}
                                  onChange={e => setTimelineSteps(prev => prev.map((s, j) => j === i ? e.target.value : s))}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs outline-none focus:border-cyan-500 transition-colors"
                                  data-testid={`input-timeline-step-${i}`} />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setTimelineSteps(prev => [...prev, `Step ${prev.length + 1}`])}
                                className="flex items-center gap-1 text-[10px] text-cyan-400 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors" data-testid="button-add-timeline-step">
                                <Plus size={9} /> Add step
                              </button>
                              {timelineSteps.length > 2 && (
                                <button onClick={() => setTimelineSteps(prev => prev.slice(0, -1))}
                                  className="flex items-center gap-1 text-[10px] text-red-400 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors" data-testid="button-remove-timeline-step">
                                  <X size={9} /> Remove last
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── AI Smart Motion Scan ── */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-purple-500/10 border border-red-500/25 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🤖</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold leading-tight">AI Smart Motion Scan</p>
                          <p className="text-zinc-500 text-[10px] leading-tight">Scans your video with Claude Vision — detects dance/sport/music/urban and places AR camera moves exactly where they belong</p>
                        </div>
                        {aiMotionResult && (
                          <button onClick={() => { setAiMotionResult(null); setEffectRegions(prev => prev.filter(r => !r.aiReason)); }} className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10 flex-shrink-0" data-testid="button-clear-ai-motion">Clear</button>
                        )}
                      </div>
                      <button
                        onClick={handleAiMotionAnalyze}
                        disabled={aiMotionAnalyzing || (!previewUrl && clips.length === 0)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-purple-600 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-ai-motion-analyze">
                        {aiMotionAnalyzing
                          ? <><RotateCcw size={11} className="animate-spin" /> Analyzing…</>
                          : <><Sparkles size={11} /> Scan Video → Place Smart AR Motion</>}
                      </button>
                      {aiMotionProgress && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <RotateCcw size={8} className="text-purple-400 animate-spin flex-shrink-0" />
                          <p className="text-purple-300 text-[10px]">{aiMotionProgress}</p>
                        </div>
                      )}
                      {aiMotionResult && !aiMotionAnalyzing && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-[10px] font-bold capitalize">{aiMotionResult.contentType} — {aiMotionResult.contentSubType}</p>
                              <p className="text-zinc-500 text-[9px]">Energy: {aiMotionResult.energy} · Camera: {aiMotionResult.globalCameraMove} · {aiMotionResult.motionEvents.length} events</p>
                            </div>
                            <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-bold", aiMotionResult.energy === "high" ? "bg-red-500/20 text-red-400" : aiMotionResult.energy === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400")}>
                              {aiMotionResult.energy}
                            </span>
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {aiMotionResult.motionEvents.map((ev, i) => (
                              <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                                <span className="text-xs flex-shrink-0">{MOTION_PRESETS.find(p => p.id === ev.motionPresetId)?.emoji ?? "🎬"}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-white text-[9px] font-bold">{CAMERA_MOVE_PRESETS.find(p => p.id === ev.cameraPresetId)?.label ?? ev.cameraPresetId}</span>
                                    <span className="text-zinc-600 text-[8px]">+</span>
                                    <span className="text-purple-300 text-[9px]">{MOTION_PRESETS.find(p => p.id === ev.motionPresetId)?.label ?? ev.motionPresetId}</span>
                                  </div>
                                  <p className="text-zinc-500 text-[8px] truncate">{ev.reason}</p>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                  <span className="text-zinc-400 text-[8px] font-mono">{formatTime(ev.time)}</span>
                                  <span className={cn("text-[7px] px-1 rounded-full", ev.intensity === "high" ? "bg-red-500/20 text-red-400" : ev.intensity === "medium" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400")}>{ev.intensity}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-zinc-600 text-[9px] text-center">▶ Press Play — AR camera moves trigger in real-time as video plays</p>
                        </div>
                      )}
                    </div>

                    {/* ── AI Camera Movement (manual) ── */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/25 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎥</span>
                        <p className="text-white text-sm font-bold">Manual Camera Move</p>
                        {aiCameraMove && <button onClick={() => setAiCameraMove(null)} className="ml-auto text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors" data-testid="button-clear-camera"><X size={8} className="inline" /> Clear</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CAMERA_MOVE_PRESETS.map(p => (
                          <button key={p.id}
                            onClick={() => handleAiCameraMove(p.id)}
                            className={cn("flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all", aiCameraMove === p.id ? "border-purple-400 bg-purple-400/15 text-white" : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300")}
                            data-testid={`button-camera-${p.id}`}>
                            <span className="text-sm flex-shrink-0">{p.emoji}</span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold truncate">{p.label}</p>
                              <p className="text-[8px] text-zinc-600 truncate">{p.desc}</p>
                            </div>
                            {aiCameraMove === p.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0 ml-auto" />}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Ask AI for scene</p>
                        <div className="flex gap-1.5">
                          <input
                            value={aiCameraCustom}
                            onChange={e => setAiCameraCustom(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAiCameraGenerate()}
                            placeholder="e.g. rooftop skateboarding action shot…"
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder:text-zinc-600 outline-none focus:border-purple-400 transition-colors"
                            data-testid="input-ai-camera-prompt" />
                          <button
                            onClick={handleAiCameraGenerate}
                            disabled={aiCameraLoading || !aiCameraCustom.trim()}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500 text-white text-[10px] font-bold hover:bg-purple-400 transition-colors disabled:opacity-50"
                            data-testid="button-ai-camera-generate">
                            {aiCameraLoading ? <RotateCcw size={9} className="animate-spin" /> : <Sparkles size={9} />}
                            AI
                          </button>
                        </div>
                      </div>
                      {aiCameraMove && (
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/25">
                          <span className="text-sm">{CAMERA_MOVE_PRESETS.find(p => p.id === aiCameraMove)?.emoji}</span>
                          <div>
                            <p className="text-purple-300 text-[10px] font-bold">{CAMERA_MOVE_PRESETS.find(p => p.id === aiCameraMove)?.label} active</p>
                            <p className="text-zinc-500 text-[9px]">{CAMERA_MOVE_PRESETS.find(p => p.id === aiCameraMove)?.desc} · Applied to preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── EXPORT HUB ── */}
                {editTab === "export" && (
                  <>
                    <div className="flex items-center gap-2"><Share2 size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Platform Export Hub</h3><span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">6 platforms</span></div>

                    {/* ── Export Quality ── */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2"><Sparkles size={12} className="text-yellow-400" /><p className="text-white text-xs font-bold">Export Quality</p></div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { id: "4k",    label: "4K",    sub: "3840×2160",   badge: "BEST",  badgeColor: "bg-yellow-500/20 text-yellow-400" },
                          { id: "1080p", label: "1080p", sub: "1920×1080",   badge: "HD",    badgeColor: "bg-blue-500/20 text-blue-400"   },
                          { id: "720p",  label: "720p",  sub: "1280×720",    badge: "FAST",  badgeColor: "bg-green-500/20 text-green-400"  },
                          { id: "480p",  label: "480p",  sub: "854×480",     badge: "SMALL", badgeColor: "bg-zinc-700 text-zinc-400"       },
                        ] as { id: ExportQuality; label: string; sub: string; badge: string; badgeColor: string }[]).map(q => (
                          <button key={q.id} onClick={() => setExportQuality(q.id)}
                            className={cn("flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all", exportQuality === q.id ? "border-primary bg-primary/10" : "border-zinc-800 hover:border-zinc-600")}
                            data-testid={`button-export-quality-${q.id}`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs font-bold", exportQuality === q.id ? "text-primary" : "text-white")}>{q.label}</span>
                                <span className={cn("text-[8px] font-semibold px-1 py-px rounded-sm", q.badgeColor)}>{q.badge}</span>
                              </div>
                              <p className="text-[9px] text-zinc-500 mt-0.5">{q.sub}</p>
                            </div>
                            {exportQuality === q.id && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Export Format ── */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2"><Layers size={12} className="text-purple-400" /><p className="text-white text-xs font-bold">File Format</p></div>
                      <div className="flex gap-1.5">
                        {([
                          { id: "mp4",  label: "MP4",  sub: "H.264 — max compat" },
                          { id: "webm", label: "WebM", sub: "VP9 — smaller size" },
                          { id: "mov",  label: "MOV",  sub: "ProRes — Apple" },
                        ] as { id: ExportFormat; label: string; sub: string }[]).map(f => (
                          <button key={f.id} onClick={() => setExportFormat(f.id)}
                            className={cn("flex-1 py-2 px-2 rounded-lg border text-center transition-all", exportFormat === f.id ? "border-purple-400 bg-purple-400/10" : "border-zinc-800 hover:border-zinc-600")}
                            data-testid={`button-export-format-${f.id}`} title={f.sub}>
                            <p className={cn("text-xs font-bold", exportFormat === f.id ? "text-purple-400" : "text-white")}>{f.label}</p>
                            <p className="text-[8px] text-zinc-500 mt-0.5 leading-tight">{f.sub}</p>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/60">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <p className="text-[10px] text-zinc-400">Selected: <span className="text-white font-semibold">{exportQuality.toUpperCase()} {exportFormat.toUpperCase()}</span> · {exportQuality === "4k" ? "~800MB" : exportQuality === "1080p" ? "~200MB" : exportQuality === "720p" ? "~80MB" : "~25MB"}</p>
                      </div>
                    </div>

                    <p className="text-zinc-500 text-xs">Select target platform to auto-configure specs.</p>
                    <div className="space-y-2">
                      {PLATFORM_PROFILES.map(profile => {
                        const isSel = selectedPlatform === profile.id;
                        return (
                          <button key={profile.id} onClick={() => applyPlatformProfile(profile)}
                            className={cn("w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all", isSel ? "border-primary bg-primary/8" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")} data-testid={`button-platform-${profile.id}`}>
                            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-br", profile.bgClass)}>{profile.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className={cn("font-bold text-sm", isSel ? "text-primary" : "text-white")}>{profile.label}</p>
                                <div className="flex gap-1"><span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">{profile.aspectRatio}</span><span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{profile.fps}fps</span></div>
                              </div>
                              <p className="text-zinc-500 text-[10px]">{profile.width}×{profile.height} · {profile.maxDuration > 0 ? `max ${profile.maxDuration}s` : "unlimited"} · {profile.maxSizeMB >= 1000 ? `${(profile.maxSizeMB/1024).toFixed(0)}GB` : `${profile.maxSizeMB}MB`}</p>
                              {isSel && <div className="mt-2 space-y-1">{profile.tips.map((tip, i) => <div key={i} className="flex items-start gap-1.5"><Star size={9} className="text-yellow-400 mt-0.5 flex-shrink-0" /><p className="text-zinc-400 text-[10px]">{tip}</p></div>)}</div>}
                            </div>
                            {isSel && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                    {/* ── Download to Device ── */}
                    <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <Download size={12} className="text-green-400" />
                        <p className="text-white text-xs font-bold">Download to Device</p>
                        <span className="ml-auto text-[9px] text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded-full">AV safe</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleDownloadExport}
                          disabled={!previewUrl && !clips.length}
                          className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors disabled:opacity-40"
                          data-testid="button-download-direct">
                          <Download size={11} />
                          <span className="text-[10px]">Quick Save</span>
                          <span className="text-[8px] font-normal text-green-200/70">Clean {exportFormat.toUpperCase()}</span>
                        </button>
                        <button
                          onClick={handleBrowserCapture}
                          disabled={!previewUrl && !clips.length}
                          className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-40"
                          data-testid="button-capture-export">
                          {exportProgress !== null ? (
                            <><RotateCcw size={11} className="animate-spin" /><span className="text-[10px]">{Math.round(exportProgress)}%</span></>
                          ) : (
                            <><Film size={11} /><span className="text-[10px]">Capture + Effects</span><span className="text-[8px] font-normal text-blue-200/70">Bakes overlays in</span></>
                          )}
                        </button>
                      </div>
                      {exportProgress !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] text-zinc-400"><span>Recording at {exportQuality.toUpperCase()}…</span><span>{Math.round(exportProgress)}%</span></div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all" style={{ width: `${exportProgress}%` }} />
                          </div>
                          <p className="text-[9px] text-zinc-500">Keep the preview visible and press ▶ to record</p>
                        </div>
                      )}
                      {/* Share / Copy Link row */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const url = clips[activeClipIdx]?.url || previewUrl || "";
                            if (url) { navigator.clipboard.writeText(url).then(() => toast({ title: "🔗 Link copied!", description: "Blob URL copied to clipboard" })).catch(() => toast({ title: "Copy failed", variant: "destructive" })); }
                            else { toast({ title: "No video loaded", variant: "destructive" }); }
                          }}
                          disabled={!previewUrl && !clips.length}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors disabled:opacity-40 border border-zinc-700"
                          data-testid="button-copy-video-link">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Copy Link
                        </button>
                        <button
                          onClick={async () => {
                            const url = clips[activeClipIdx]?.url || previewUrl || "";
                            if (!url) { toast({ title: "No video loaded", variant: "destructive" }); return; }
                            if (navigator.share) {
                              try {
                                await navigator.share({ title: "Urban Culture Export", text: "Check out this edit from Urban Culture Connect", url });
                              } catch { /* user cancelled */ }
                            } else {
                              navigator.clipboard.writeText(url).then(() => toast({ title: "🔗 Link copied!", description: "Share link copied (Web Share not supported)" }));
                            }
                          }}
                          disabled={!previewUrl && !clips.length}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors disabled:opacity-40 border border-zinc-700"
                          data-testid="button-share-video">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                          Share
                        </button>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                        <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Export info</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span className="text-[9px] text-zinc-600">Format</span><span className="text-[9px] text-zinc-400 font-mono">{exportFormat.toUpperCase()} · {exportQuality.toUpperCase()}</span>
                          <span className="text-[9px] text-zinc-600">Est. size</span><span className="text-[9px] text-zinc-400 font-mono">{exportQuality === "4k" ? "~800MB" : exportQuality === "1080p" ? "~200MB" : exportQuality === "720p" ? "~80MB" : "~25MB"}</span>
                          <span className="text-[9px] text-zinc-600">Duration</span><span className="text-[9px] text-zinc-400 font-mono">{formatTime(tlTotalDuration || videoDuration || 0)}</span>
                          <span className="text-[9px] text-zinc-600">Text layers</span><span className="text-[9px] text-zinc-400 font-mono">{textLayers.length} layer{textLayers.length !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <p className="text-zinc-600 text-[9px]">Quick Save fetches a clean {exportFormat.toUpperCase()} with proper MIME type to avoid antivirus flags. Capture + Effects records the live preview with all text, overlays, and filters baked in.</p>
                    </div>

                    {/* Admin: Auto-post settings */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-yellow-500/20 space-y-3">
                      <div className="flex items-center gap-2"><Crown size={13} className="text-yellow-400" /><p className="text-white text-sm font-bold">Admin Auto-Post</p><span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">ADMIN</span></div>
                      <p className="text-zinc-500 text-xs">Directly post to connected platforms after upload.</p>
                      {[{ id: "ig", label: "Instagram", emoji: "📸", state: autoPostIG, setState: setAutoPostIG }, { id: "tt", label: "TikTok", emoji: "🎵", state: autoPostTikTok, setState: setAutoPostTikTok }].map(({ id, label, emoji, state, setState }) => (
                        <div key={id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 border border-zinc-700">
                          <div className="flex items-center gap-2"><span>{emoji}</span><p className="text-white text-sm font-medium">{label}</p></div>
                          <button onClick={() => setState(v => !v)} className={cn("w-11 h-5.5 rounded-full transition-all relative", state ? "bg-primary" : "bg-zinc-700")} data-testid={`toggle-autopost-${id}`}>
                            <div className={cn("absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all", state ? "left-5.5" : "left-0.5")} style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── VIRAL INTELLIGENCE ── */}
                {editTab === "viral" && (
                  <>
                    <div className="flex items-center gap-2"><TrendingUp size={14} className="text-orange-400" /><h3 className="text-white font-bold text-sm">Viral Intelligence</h3><span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full ml-auto">AI POWERED</span></div>
                    {/* Score analyzer */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <div className="flex items-center gap-2"><BarChart2 size={13} className="text-orange-400" /><p className="text-white text-sm font-bold">Viral Score Analyzer</p></div>
                      {viralScore !== null && viralBreakdown ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center">
                            <div className="relative w-24 h-24">
                              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                                <circle cx="48" cy="48" r="40" fill="none" stroke="#27272a" strokeWidth="8" />
                                <circle cx="48" cy="48" r="40" fill="none" stroke={viralScore >= 75 ? "#22c55e" : viralScore >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="8" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - viralScore / 100)}`} strokeLinecap="round" className="transition-all duration-1000" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center admin-viral-count">
                                <span className="text-white font-bold text-2xl">{viralScore}</span>
                                <span className="text-zinc-500 text-[9px]">/ 100</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(viralBreakdown).map(([key, val]) => (
                              <div key={key} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                <div className="flex justify-between mb-1"><span className="text-zinc-400 text-[10px] capitalize">{key}</span><span className="text-white text-[10px] font-bold">{val}/25</span></div>
                                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(val / 25) * 100}%` }} /></div>
                              </div>
                            ))}
                          </div>
                          {viralPlatformBest && <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800"><Star size={12} className="text-yellow-400" /><p className="text-zinc-300 text-xs">Best platform: <span className="text-white font-bold">{viralPlatformBest}</span></p></div>}
                          {viralTips.map((tip, i) => <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800"><span className="text-primary text-xs font-bold flex-shrink-0">{i + 1}.</span><p className="text-zinc-300 text-xs">{tip}</p></div>)}
                          <button onClick={handleViralScore} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"><RotateCcw size={11} /> Re-analyze</button>
                        </div>
                      ) : (
                        <Button onClick={handleViralScore} disabled={viralScoreLoading} className="w-full bg-gradient-to-r from-orange-600 to-primary text-white" size="sm" data-testid="button-viral-score">
                          {viralScoreLoading ? <><Sparkles size={13} className="mr-2 animate-spin" /> Analyzing…</> : <><TrendingUp size={13} className="mr-2" /> Analyze Viral Potential</>}
                        </Button>
                      )}
                    </div>
                    {/* Hook library */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><Target size={13} className="text-yellow-400" /><p className="text-white text-sm font-bold">Hook Library</p><span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full ml-auto">30 hooks</span></div>
                      <div className="flex gap-1.5 flex-wrap">
                        {HOOK_CATEGORIES.map(cat => <button key={cat.id} onClick={() => setHookCategory(cat.id)} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all", hookCategory === cat.id ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-hook-cat-${cat.id}`}>{cat.emoji} {cat.label}</button>)}
                      </div>
                      <div className="space-y-2">
                        {HOOK_LIBRARY.filter(h => h.category === hookCategory).map(hook => (
                          <div key={hook.id} className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors">
                            <p className="flex-1 text-zinc-300 text-xs leading-relaxed">{hook.text}</p>
                            <button onClick={() => copyToClipboard(hook.text, hook.id)} className={cn("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all", copiedKey === hook.id ? "bg-green-500 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white")} data-testid={`button-copy-hook-${hook.id}`}>
                              {copiedKey === hook.id ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Hashtag packs */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><Hash size={13} className="text-blue-400" /><p className="text-white text-sm font-bold">Hashtag Packs</p><span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full ml-auto">8 packs</span></div>
                      {HASHTAG_PACKS.map(pack => {
                        const isOpen = selectedHashtagPack === pack.id;
                        return (
                          <div key={pack.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                            <button onClick={() => setSelectedHashtagPack(isOpen ? null : pack.id)} className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/50 text-left" data-testid={`button-hashtag-pack-${pack.id}`}>
                              <span className="text-xl">{pack.emoji}</span>
                              <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium">{pack.label}</p><p className="text-zinc-500 text-[10px]">{pack.platform} · {pack.tags.length} tags</p></div>
                              <ChevronDown size={13} className={cn("text-zinc-500 transition-transform", isOpen && "rotate-180")} />
                            </button>
                            {isOpen && (
                              <div className="border-t border-zinc-800 p-3 space-y-2">
                                <div className="flex flex-wrap gap-1">{pack.tags.map(tag => <span key={tag} className="text-[10px] bg-zinc-800 text-blue-400 px-1.5 py-0.5 rounded-full">{tag}</span>)}</div>
                                <button onClick={() => copyToClipboard(pack.tags.join(" "), `pack-${pack.id}`)} className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all", copiedKey === `pack-${pack.id}` ? "bg-green-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700")} data-testid={`button-copy-pack-${pack.id}`}>
                                  {copiedKey === `pack-${pack.id}` ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy all {pack.tags.length} tags</>}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── TRANSITIONS ── */}
                {editTab === "transitions" && (
                  <>
                    <div className="flex items-center gap-2"><Shuffle size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Transition Library</h3><span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-auto">25 types</span></div>
                    <div className="flex gap-1.5 flex-wrap">
                      {TRANSITION_CATEGORIES.map(cat => <button key={cat.id} onClick={() => setTransitionCategory(cat.id)} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all", transitionCategory === cat.id ? "border-primary bg-primary/15 text-primary" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-transition-cat-${cat.id}`}>{cat.emoji} {cat.label}</button>)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {TRANSITIONS.filter(t => t.category === transitionCategory).map(t => {
                        const isSel = selectedTransition === t.id;
                        return (
                          <button key={t.id} onClick={() => { setSelectedTransition(prev => prev === t.id ? null : t.id); if (selectedTransition !== t.id) toast({ title: `${t.emoji} ${t.label}`, description: `${t.timing} · Best for: ${t.bestFor}` }); }}
                            className={cn("flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]", isSel ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")} data-testid={`button-transition-${t.id}`}>
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0", isSel ? "bg-primary/20" : "bg-zinc-800")}>{t.emoji}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5"><p className={cn("text-sm font-semibold", isSel ? "text-primary" : "text-white")}>{t.label}</p><span className="text-[9px] bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-mono">{t.timing}</span></div>
                              <p className="text-zinc-500 text-xs">{t.description}</p>
                              <p className="text-zinc-600 text-[10px] mt-0.5 truncate">Best: {t.bestFor}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── BRAND KIT ── */}
                {editTab === "brand" && (
                  <>
                    <div className="flex items-center gap-2"><Paintbrush size={14} className="text-pink-400" /><h3 className="text-white font-bold text-sm">Brand Kit</h3><span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full ml-auto">IDENTITY</span></div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <p className="text-white text-sm font-bold">Brand Palette</p>
                      <div className="grid grid-cols-6 gap-2">
                        {brandColors.map((color, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="relative w-10 h-10 rounded-xl border-2 border-zinc-700 overflow-hidden hover:border-primary cursor-pointer" onClick={() => (document.getElementById(`admin-bc-${i}`) as HTMLInputElement)?.click()}>
                              <div className="w-full h-full" style={{ backgroundColor: color }} />
                              <input id={`admin-bc-${i}`} type="color" value={color} onChange={e => setBrandColors(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={`input-brand-color-${i}`} />
                            </div>
                            <span className="text-zinc-600 text-[8px] font-mono">{color.slice(1).toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Brand Font</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {TEXT_FONTS.map(f => <button key={f.id} onClick={() => setBrandFont(f.id)} className={cn("py-1.5 rounded-lg text-xs font-medium border transition-all", brandFont === f.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} style={{ fontFamily: f.style }} data-testid={`button-brand-font-${f.id}`}>{f.label}</button>)}
                        </div>
                      </div>
                      <Button onClick={applyBrandToAllLayers} variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10" size="sm" data-testid="button-apply-brand">
                        <Paintbrush size={13} className="mr-2" /> Apply Brand to All Text Layers
                      </Button>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <p className="text-white text-sm font-bold">Logo / Watermark</p>
                      <input type="text" placeholder="@UrbanCultureConnect or brand name…" value={logoWatermark} onChange={e => setLogoWatermark(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary" data-testid="input-logo-watermark" />
                      <p className="text-xs text-zinc-500">Position</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {["top-left","top-center","top-right","center-left","center","center-right","bottom-left","bottom-center","bottom-right"].map(pos => (
                          <button key={pos} onClick={() => setLogoPosition(pos)} className={cn("py-2 rounded-lg text-[10px] font-medium border capitalize transition-all", logoPosition === pos ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-500")} data-testid={`button-logo-pos-${pos}`}>{pos.replace(/-/g, " ")}</button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><AlignLeft size={13} className="text-cyan-400" /><p className="text-white text-sm font-bold">Lower Thirds</p></div>
                        <button onClick={() => setLowerThirdEnabled(e => !e)} className={cn("w-12 h-6 rounded-full relative transition-all", lowerThirdEnabled ? "bg-primary" : "bg-zinc-700")} data-testid="toggle-lower-third"><div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", lowerThirdEnabled ? "left-6" : "left-0.5")} /></button>
                      </div>
                      {lowerThirdEnabled && (
                        <>
                          <input type="text" placeholder="Name · Title · Label…" value={lowerThirdText} onChange={e => setLowerThirdText(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-cyan-400" data-testid="input-lower-third-text" />
                          <div className="grid grid-cols-2 gap-2">
                            {LOWER_THIRDS_STYLES.map(style => (
                              <button key={style.id} onClick={() => setLowerThirdStyle(style.id)} className={cn("flex flex-col items-start gap-1 p-2.5 rounded-xl border-2 text-left transition-all", lowerThirdStyle === style.id ? "border-cyan-400 bg-cyan-400/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600")} data-testid={`button-lower-third-${style.id}`}>
                                <div className={cn("w-full h-2 rounded-sm", style.preview)}></div>
                                <p className={cn("text-xs font-medium", lowerThirdStyle === style.id ? "text-cyan-400" : "text-zinc-300")}>{style.label}</p>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div><p className="text-white text-sm font-bold">Progress Bar</p><p className="text-zinc-500 text-xs">Animated bar at top of video</p></div>
                        <button onClick={() => setProgressBarEnabled(e => !e)} className={cn("w-12 h-6 rounded-full relative transition-all", progressBarEnabled ? "bg-primary" : "bg-zinc-700")} data-testid="toggle-progress-bar"><div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", progressBarEnabled ? "left-6" : "left-0.5")} /></button>
                      </div>
                      {progressBarEnabled && (
                        <div className="flex gap-2 flex-wrap">
                          {["#ffffff","#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#39ff14"].map(c => (
                            <button key={c} onClick={() => setProgressBarColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", progressBarColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #555" : undefined }} data-testid={`button-progress-color-${c.replace("#","")}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── TRIM ── */}
                {editTab === "trim" && (
                  <>
                    <div className="flex items-center gap-2"><Scissors size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Trim Video</h3><span className="text-zinc-500 text-xs ml-auto">{formatTime(trimStart)} – {formatTime(trimEnd)}</span></div>
                    <p className="text-zinc-500 text-xs">Drag the handles in the preview panel to set in/out points.</p>
                    <div>
                      <div className="flex items-center gap-2 mb-3"><Image size={13} className="text-primary" /><h3 className="text-white font-semibold text-sm">Cover Thumbnail</h3></div>
                      <div className="grid grid-cols-6 gap-2">
                        {thumbnails.length > 0
                          ? thumbnails.map((thumb, i) => <button key={i} onClick={() => { setSelectedCover(i); setCoverDataUrl(thumb); }} className={cn("aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all", i === selectedCover ? "border-primary ring-2 ring-primary/30 scale-105" : "border-zinc-700 hover:border-zinc-500")} data-testid={`button-cover-${i}`}><img src={thumb} alt="" className="w-full h-full object-cover" /></button>)
                          : Array.from({ length: THUMBNAIL_COUNT }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-lg bg-zinc-800 animate-pulse border-2 border-zinc-700" />)}
                      </div>
                    </div>
                  </>
                )}

                {/* ── FILTERS ── */}
                {editTab === "filters" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><SlidersHorizontal size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Visual Filters</h3></div>
                      <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors" data-testid="button-reset-filters"><RotateCcw size={11} /> Reset</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {FILTER_PRESETS.map(preset => (
                        <button key={preset.id} onClick={() => { setFilterPresetId(preset.id); if (preset.id !== "normal") setTlExpanded(true); }} className={cn("flex flex-col items-center gap-1.5 rounded-xl p-1.5 border-2 transition-all", filterPresetId === preset.id ? "border-primary bg-primary/10" : "border-transparent hover:border-zinc-600")} data-testid={`button-filter-${preset.id}`}>
                          <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800">
                            {timelineFrames[0] ? <img src={timelineFrames[0]} alt="" className="w-full h-full object-cover" style={{ filter: buildCssFilter(preset, 0, 0, 0) }} /> : <div className="w-full h-full" style={{ background: `hsl(${preset.hueRotate}, 50%, ${40 + preset.brightness}%)` }} />}
                          </div>
                          <span className={cn("text-xs font-medium", filterPresetId === preset.id ? "text-primary" : "text-zinc-400")}>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-4 pt-2">
                      {[{ label: "Brightness", value: brightness, set: setBrightness, min: -50, max: 50 }, { label: "Contrast", value: contrast, set: setContrast, min: -50, max: 50 }, { label: "Saturation", value: saturation, set: setSaturation, min: -100, max: 100 }].map(({ label, value, set, min, max }) => (
                        <div key={label}>
                          <div className="flex justify-between mb-1.5"><span className="text-sm text-zinc-300">{label}</span><span className="text-xs text-zinc-500 tabular-nums">{value > 0 ? "+" : ""}{value}</span></div>
                          <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => set(v)} className="w-full" data-testid={`slider-${label.toLowerCase()}`} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── ADJUST ── */}
                {editTab === "adjust" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Palette size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Advanced Adjust</h3></div>
                      <button onClick={resetAdjust} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors" data-testid="button-reset-adjust"><RotateCcw size={11} /> Reset</button>
                    </div>
                    <div className="space-y-4">
                      {[{ label: "Warmth", icon: Sun, value: warmth, set: setWarmth, min: -100, max: 100 }, { label: "Highlights", icon: Sun, value: highlights, set: setHighlights, min: -100, max: 100 }, { label: "Shadows", icon: Droplets, value: shadows, set: setShadows, min: -100, max: 100 }, { label: "Vignette", icon: Wind, value: vignette, set: setVignette, min: 0, max: 50 }, { label: "Grain", icon: FlipHorizontal2, value: grain, set: setGrain, min: 0, max: 100 }].map(({ label, icon: Icon, value, set, min, max }) => (
                        <div key={label}>
                          <div className="flex justify-between mb-1.5"><div className="flex items-center gap-1.5"><Icon size={11} className="text-zinc-400" /><span className="text-sm text-zinc-300">{label}</span></div><span className="text-xs text-zinc-500 tabular-nums">{value > 0 ? "+" : ""}{value}</span></div>
                          <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => set(v)} className="w-full" data-testid={`slider-${label.toLowerCase()}`} />
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <div><p className="text-white text-sm font-medium">Sharpen</p><p className="text-zinc-500 text-xs">Enhance edge definition</p></div>
                        <button onClick={() => setSharpen(s => !s)} className={cn("w-12 h-6 rounded-full relative transition-all", sharpen ? "bg-primary" : "bg-zinc-700")} data-testid="toggle-sharpen"><div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", sharpen ? "left-6" : "left-0.5")} /></button>
                      </div>
                    </div>
                  </>
                )}

                {/* ── SPEED ── */}
                {editTab === "speed" && (
                  <>
                    <div className="flex items-center gap-2"><Gauge size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Playback Speed</h3></div>
                    <div className="flex gap-2 flex-wrap">
                      {SPEED_OPTIONS.map(s => <button key={s} onClick={() => setSpeed(s)} className={cn("flex-1 min-w-[52px] py-3 rounded-xl text-sm font-bold border-2 transition-all", speed === s ? "border-primary bg-primary/15 text-primary" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-speed-${s}`}>{SPEED_LABELS[s]}</button>)}
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="flex items-center gap-3">{muted ? <VolumeX size={18} className="text-zinc-400" /> : <Volume2 size={18} className="text-white" />}<div><p className="text-white text-sm font-medium">Audio</p><p className="text-zinc-500 text-xs">{muted ? "Muted" : "On"}</p></div></div>
                      <button onClick={() => setMuted(m => !m)} className={cn("w-12 h-6 rounded-full relative transition-all", muted ? "bg-zinc-700" : "bg-primary")} data-testid="toggle-audio-mute"><div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", muted ? "left-0.5" : "left-6")} /></button>
                    </div>
                  </>
                )}

                {/* ── AUDIO ── */}
                {editTab === "audio" && (
                  <>
                    <div className="flex items-center gap-2"><Music size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Audio</h3></div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">{muted ? <VolumeX size={17} className="text-zinc-500" /> : <Volume2 size={17} className="text-white" />}<div><p className="text-white text-sm font-medium">Original Sound</p><p className="text-zinc-500 text-xs">{muted ? "Muted" : `Volume ${audioVolume}%`}</p></div></div>
                        <button onClick={() => setMuted(m => !m)} className={cn("w-12 h-6 rounded-full relative transition-all", muted ? "bg-zinc-700" : "bg-primary")} data-testid="toggle-audio-mute-audio"><div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", muted ? "left-0.5" : "left-6")} /></button>
                      </div>
                      {!muted && <><div className="flex justify-between mb-1"><span className="text-xs text-zinc-400">Volume</span><span className="text-xs text-zinc-500">{audioVolume}%</span></div><Slider min={0} max={100} step={5} value={[audioVolume]} onValueChange={([v]) => setAudioVolume(v)} className="w-full" /></>}
                    </div>

                    {/* Track volume */}
                    {selectedTrack && (
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                        <div className="flex justify-between"><span className="text-xs text-zinc-400">Track Volume</span><span className="text-xs text-primary font-bold">{trackVolume}%</span></div>
                        <Slider min={0} max={150} step={5} value={[trackVolume]} onValueChange={([v]) => setTrackVolume(v)} className="w-full" data-testid="slider-track-volume" />
                        <div className="flex justify-between items-center mt-1"><span className="text-[10px] text-zinc-500">Music starts at</span><span className="text-[10px] text-zinc-400 font-mono">{formatTime(audioStartOffset)}</span></div>
                        <Slider min={0} max={Math.max(0, tlTotalDuration - 1)} step={0.5} value={[audioStartOffset]} onValueChange={([v]) => setAudioStartOffset(v)} className="w-full" data-testid="slider-audio-offset" />
                      </div>
                    )}

                    {/* Audio Effects */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Audio FX</p>
                      {([
                        { key: "bassBoost", label: "Bass Boost", icon: "🎸", desc: "+8dB low shelf" },
                        { key: "echo",      label: "Echo",       icon: "🌊", desc: "280ms delay" },
                        { key: "reverb",    label: "Reverb",     icon: "🏛️", desc: "Room reverb" },
                        { key: "normalize", label: "Normalize",  icon: "📊", desc: "Auto levels" },
                        { key: "fadeIn",    label: "Fade In",    icon: "⬆️", desc: "2s ramp" },
                        { key: "fadeOut",   label: "Fade Out",   icon: "⬇️", desc: "2s ramp" },
                      ] as { key: keyof AudioEffects; label: string; icon: string; desc: string }[]).map(fx => (
                        <button key={fx.key}
                          onClick={() => setAudioEffects(prev => ({ ...prev, [fx.key]: !prev[fx.key] }))}
                          className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all", audioEffects[fx.key] ? "border-primary bg-primary/10 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600")}
                          data-testid={`toggle-audio-fx-${fx.key}`}>
                          <span className="text-base">{fx.icon}</span>
                          <div className="flex-1"><p className="text-xs font-semibold">{fx.label}</p><p className="text-[10px] text-zinc-500">{fx.desc}</p></div>
                          <div className={cn("w-8 h-4 rounded-full relative transition-all flex-shrink-0", audioEffects[fx.key] ? "bg-primary" : "bg-zinc-700")}>
                            <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all", audioEffects[fx.key] ? "left-4" : "left-0.5")} />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* ── AI Beats Prescription ── */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-900/30 to-zinc-900 border border-purple-500/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={13} className="text-purple-400" />
                        <p className="text-white font-bold text-sm">AI Beats Prescription</p>
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full ml-auto">Claude AI</span>
                      </div>
                      <p className="text-zinc-400 text-xs">Describe your video content and Claude prescribes the perfect BPM, key, genre and intro sound.</p>
                      <div className="flex gap-2">
                        <input
                          value={aiBeatsPrompt}
                          onChange={e => setAiBeatsPrompt(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleAiBeats()}
                          placeholder="e.g. breaking battle highlight reel, aggressive 30s..."
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                          data-testid="input-ai-beats-prompt"
                        />
                        <button onClick={handleAiBeats} disabled={aiBeatsLoading || !aiBeatsPrompt.trim()}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all"
                          data-testid="button-ai-beats">
                          {aiBeatsLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {aiBeatsLoading ? "Prescribing…" : "Prescribe"}
                        </button>
                      </div>
                      {aiBeatsResult && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-center">
                              <p className="text-purple-300 text-[10px] uppercase tracking-wide">BPM</p>
                              <p className="text-white font-bold text-sm">{aiBeatsResult.bpm}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-center">
                              <p className="text-purple-300 text-[10px] uppercase tracking-wide">Key</p>
                              <p className="text-white font-bold text-sm">{aiBeatsResult.key}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-500/20 text-center">
                              <p className="text-purple-300 text-[10px] uppercase tracking-wide">Energy</p>
                              <p className="text-white font-bold text-sm capitalize">{aiBeatsResult.energyLevel ?? "high"}</p>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-zinc-800 border border-zinc-700">
                            <p className="text-zinc-300 text-xs leading-relaxed">{aiBeatsResult.beatDescription}</p>
                          </div>
                          {aiBeatsResult.referenceArtists?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {aiBeatsResult.referenceArtists.map((a: string) => (
                                <span key={a} className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full">{a}</span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => synthesizeDrumPattern(aiBeatsResult.bpm, aiBeatsResult.genre, 2)}
                            disabled={isBeatPlaying}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-semibold hover:bg-purple-600/30 disabled:opacity-50 transition-all"
                            data-testid="button-play-prescription-beat">
                            {isBeatPlaying ? <><Square size={10} /> Stop Beat</> : <><Drum size={12} /> Play Prescribed Beat Pattern</>}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Beat Pattern Synthesizer ── */}
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 space-y-3">
                      <div className="flex items-center gap-2">
                        <Drum size={13} className="text-orange-400" />
                        <p className="text-white font-semibold text-sm">Beat Synthesizer</p>
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full ml-auto">Web Audio</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-zinc-500 text-[10px] mb-1 uppercase tracking-wide">Genre</p>
                          <select value={beatGenGenre} onChange={e => setBeatGenGenre(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                            data-testid="select-beat-genre">
                            {["Hip Hop","Trap","Breakbeats","Drill","Afrobeats","House","Soul/Funk","Grime","Jazz/Lofi","Urban"].map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <p className="text-zinc-500 text-[10px] mb-1 uppercase tracking-wide">BPM: {beatGenBpm}</p>
                          <input type="range" min={60} max={180} step={1} value={beatGenBpm} onChange={e => setBeatGenBpm(Number(e.target.value))}
                            className="w-full accent-orange-500 mt-2" data-testid="slider-beat-bpm" />
                        </div>
                      </div>
                      <button
                        onClick={() => isBeatPlaying ? stopBeat() : synthesizeDrumPattern(beatGenBpm, beatGenGenre, 2)}
                        className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all border",
                          isBeatPlaying ? "bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500/30 animate-pulse"
                                       : "bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20")}
                        data-testid="button-play-beat">
                        {isBeatPlaying ? <><Square size={12} /> Stop Pattern</> : <><Play size={12} /> Play {beatGenGenre} · {beatGenBpm} BPM</>}
                      </button>
                    </div>

                    {/* ── Intro Hook Sounds ── */}
                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap size={13} className="text-yellow-400" />
                        <p className="text-white font-semibold text-sm">Intro Hook Sounds</p>
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-auto">Attention Grabbers</span>
                      </div>
                      <p className="text-zinc-500 text-xs">Play at video start to instantly grab attention. Click preview, then apply.</p>
                      <div className="grid grid-cols-2 gap-2">
                        {INTRO_HOOKS.map(hook => {
                          const isSelected = selectedIntroHook === hook.id;
                          return (
                            <div key={hook.id} className={cn("p-2.5 rounded-xl border transition-all", isSelected ? "border-yellow-500 bg-yellow-500/10" : "border-zinc-800 bg-zinc-800/50 hover:border-zinc-600")}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-base">{hook.emoji}</span>
                                <p className={cn("text-xs font-semibold truncate", isSelected ? "text-yellow-400" : "text-white")}>{hook.label}</p>
                              </div>
                              <p className="text-[10px] text-zinc-500 mb-2 leading-tight">{hook.desc}</p>
                              <div className="flex gap-1">
                                <button onClick={() => playIntroHook(hook.id)}
                                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] transition-all"
                                  data-testid={`button-preview-hook-${hook.id}`}>
                                  <Play size={9} /> Preview
                                </button>
                                <button onClick={() => { setSelectedIntroHook(v => v === hook.id ? null : hook.id); if (selectedIntroHook !== hook.id) toast({ title: `${hook.emoji} Intro hook set`, description: hook.label }); }}
                                  className={cn("flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] transition-all border", isSelected ? "border-yellow-500 bg-yellow-500/20 text-yellow-400" : "border-zinc-700 bg-zinc-700 text-zinc-300 hover:border-yellow-500")}
                                  data-testid={`button-apply-hook-${hook.id}`}>
                                  {isSelected ? <><Check size={9} /> Applied</> : <><Plus size={9} /> Apply</>}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button onClick={() => audioFileInputRef.current?.click()} className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left", selectedTrack === "custom" ? "border-primary bg-primary/10" : "border-dashed border-zinc-700 hover:border-zinc-500")} data-testid="button-upload-audio">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center"><Mic size={15} className="text-zinc-400" /></div>
                      <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium">{customAudioFile ? customAudioFile.name : "Upload your music"}</p><p className="text-zinc-500 text-xs">MP3, M4A, WAV — plays in sync with video</p></div>
                    </button>
                    <input ref={audioFileInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (customAudioUrl) URL.revokeObjectURL(customAudioUrl); setCustomAudioFile(f); setCustomAudioUrl(URL.createObjectURL(f)); setSelectedTrack("custom"); }} data-testid="input-audio-file" />

                    {/* ── Music Tracks ── */}
                    <div className="flex items-center gap-2 pb-1">
                      <Music size={13} className="text-primary" />
                      <p className="text-white font-semibold text-sm">Music Library</p>
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-auto">10 tracks · Bensound</span>
                    </div>
                    <div className="space-y-2">
                      {MUSIC_TRACKS.map(track => (
                        <div key={track.id} className={cn("flex items-center gap-2 p-3 rounded-xl border transition-all", selectedTrack === track.id ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}>
                          <button onClick={() => previewMusicTrack(track.id)}
                            className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all border text-base", previewingTrackId === track.id ? "bg-primary border-primary animate-pulse" : "bg-zinc-800 border-zinc-700 hover:border-zinc-500")}
                            title="Preview" data-testid={`button-preview-track-${track.id}`}>
                            {previewingTrackId === track.id ? <Square size={9} className="text-white" /> : track.emoji}
                          </button>
                          <button onClick={() => setSelectedTrack(t => t === track.id ? null : track.id)} className="flex-1 text-left min-w-0" data-testid={`button-track-${track.id}`}>
                            <p className={cn("text-sm font-medium", selectedTrack === track.id ? "text-primary" : "text-white")}>{track.label}</p>
                            <p className="text-zinc-500 text-xs">{track.genre} · {track.bpm} BPM · {track.key} · <span className="capitalize">{track.mood}</span></p>
                          </button>
                          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                            {selectedTrack === track.id && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                            {track.url && <Music2 size={9} className="text-zinc-600" title="Real audio available" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 text-center">Music by Bensound.com — attribution required for public use</p>
                  </>
                )}

                {/* ── SOUNDS ── */}
                {editTab === "sounds" && (
                  <>
                    <div className="flex items-center gap-2"><Music2 size={14} className="text-green-400" /><h3 className="text-white font-bold text-sm">Sound FX Library</h3><span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">{SOUND_LIBRARY.length} sounds</span></div>
                    <div className="flex gap-1.5 flex-wrap">
                      {SOUND_CATEGORIES.map(cat => (
                        <button key={cat.id}
                          onClick={() => { setSoundCategory(cat.id); if (cat.id !== "intro") playSoundPreview(cat.id); }}
                          className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                            soundCategory === cat.id
                              ? cat.id === "intro" ? "border-yellow-500 bg-yellow-500/15 text-yellow-400" : "border-green-500 bg-green-500/15 text-green-400"
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                          data-testid={`button-sound-cat-${cat.id}`}>
                          {cat.emoji} {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Intro hook category — use synthesized sounds */}
                    {soundCategory === "intro" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-500/20">
                          <Zap size={12} className="text-yellow-400 flex-shrink-0" />
                          <p className="text-zinc-300 text-xs">Attention-grabbing sounds for the first second of your video — synthesized for instant playback.</p>
                        </div>
                        {INTRO_HOOKS.map(hook => {
                          const isSel = selectedIntroHook === hook.id;
                          return (
                            <div key={hook.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", isSel ? "border-yellow-500 bg-yellow-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}>
                              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0", isSel ? "bg-yellow-500/20" : "bg-zinc-800")}>{hook.emoji}</div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-medium", isSel ? "text-yellow-400" : "text-white")}>{hook.label}</p>
                                <p className="text-zinc-500 text-xs">{hook.desc}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => playIntroHook(hook.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-zinc-700 bg-zinc-800 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all"
                                  title="Preview" data-testid={`button-preview-hook-${hook.id}`}>
                                  <Play size={10} className="text-zinc-400" />
                                </button>
                                <button onClick={() => { setSelectedIntroHook(s => s === hook.id ? null : hook.id); if (selectedIntroHook !== hook.id) toast({ title: `${hook.emoji} Intro hook applied`, description: hook.label }); }}
                                  className={cn("w-7 h-7 rounded-lg flex items-center justify-center border transition-all", isSel ? "border-yellow-500 bg-yellow-500/20" : "border-zinc-700 bg-zinc-800 hover:border-yellow-400")}
                                  title={isSel ? "Remove" : "Apply"} data-testid={`button-apply-introsfx-${hook.id}`}>
                                  {isSel ? <Check size={10} className="text-yellow-400" /> : <Plus size={10} className="text-zinc-400" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                          <Volume2 size={12} className="text-green-400 flex-shrink-0" />
                          <p className="text-zinc-400 text-xs">Click category to preview · Click sound to apply to timeline</p>
                        </div>
                        <div className="space-y-2">
                          {SOUND_LIBRARY.filter(s => s.category === soundCategory).map(sound => {
                            const isSel = selectedSoundFx === sound.id;
                            return (
                              <div key={sound.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all", isSel ? "border-green-500 bg-green-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}>
                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0", isSel ? "bg-green-500/20" : "bg-zinc-800")}>{sound.emoji}</div>
                                <div className="flex-1 min-w-0"><p className={cn("text-sm font-medium", isSel ? "text-green-400" : "text-white")}>{sound.label}</p><p className="text-zinc-500 text-xs">{sound.duration} · {sound.mood}</p></div>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => playSoundPreview(sound.category)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-zinc-700 bg-zinc-800 hover:border-green-500 hover:bg-green-500/10 transition-all"
                                    title="Preview" data-testid={`button-preview-sound-${sound.id}`}>
                                    <Play size={10} className="text-zinc-400" />
                                  </button>
                                  <button onClick={() => { setSelectedSoundFx(s => s === sound.id ? null : sound.id); if (selectedSoundFx !== sound.id) toast({ title: `${sound.emoji} ${sound.label} applied`, description: `${sound.duration} · ${sound.mood}` }); }}
                                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center border transition-all", isSel ? "border-green-500 bg-green-500/20" : "border-zinc-700 bg-zinc-800 hover:border-green-400")}
                                    title={isSel ? "Remove" : "Apply"} data-testid={`button-sound-${sound.id}`}>
                                    {isSel ? <Square size={10} className="text-green-400" /> : <Plus size={10} className="text-zinc-400" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── CAPTIONS ── */}
                {editTab === "captions" && (
                  <>
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-cyan-400" />
                      <h3 className="text-white font-bold text-sm">Captions</h3>
                      <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-semibold">{captionLayers.length} layers</span>
                    </div>

                    {/* Add caption row */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                      <input type="text" value={captionInput} onChange={e => setCaptionInput(e.target.value)} placeholder="Caption text…"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-cyan-400"
                        data-testid="input-caption-text" />
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["bold","minimal","neon","subtitle","karaoke","outline"] as CaptionStyle[]).map(s => (
                          <button key={s} onClick={() => setCaptionStyle(s)}
                            className={cn("px-2 py-1.5 rounded-lg text-[10px] font-semibold capitalize border transition-all", captionStyle === s ? "border-cyan-400 bg-cyan-400/15 text-cyan-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                            data-testid={`button-caption-style-${s}`}>{s}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] text-zinc-500">Color</span>
                          <div className="flex gap-1.5">
                            {["#ffffff","#facc15","#f87171","#4ade80","#60a5fa","#e879f9"].map(c => (
                              <button key={c} onClick={() => setCaptionColor(c)}
                                className={cn("w-5 h-5 rounded-full border-2 transition-all", captionColor === c ? "border-white scale-110" : "border-transparent")}
                                style={{ background: c }} data-testid={`button-caption-color-${c.replace("#","")}`} />
                            ))}
                            <input type="color" value={captionColor} onChange={e => setCaptionColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" title="Custom color" />
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={captionBg} onChange={e => setCaptionBg(e.target.checked)} className="w-3 h-3" data-testid="checkbox-caption-bg" />
                          <span className="text-[10px] text-zinc-400">BG</span>
                        </label>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-[10px] text-zinc-500">Size</span><span className="text-[10px] text-zinc-400">{captionFontSize}px</span></div>
                        <Slider min={10} max={72} step={2} value={[captionFontSize]} onValueChange={([v]) => setCaptionFontSize(v)} className="w-full" data-testid="slider-caption-size" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => addCaptionLayer()} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs" data-testid="button-caption-add">
                          + Add Caption
                        </Button>
                        <Button size="sm" onClick={() => handleCaptionAi()} disabled={captionAiLoading} variant="outline" className="flex-1 border-cyan-600 text-cyan-400 hover:bg-cyan-500/10 text-xs" data-testid="button-caption-ai">
                          {captionAiLoading ? <><Sparkles size={11} className="mr-1 animate-spin" /> AI…</> : <><Sparkles size={11} className="mr-1" /> AI Captions</>}
                        </Button>
                      </div>
                    </div>

                    {/* Caption list */}
                    {captionLayers.length === 0 ? (
                      <div className="text-center py-8 text-zinc-600">
                        <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No captions yet — add one above or use AI</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {captionLayers.map(cap => (
                          <div key={cap.id} className={cn("p-3 rounded-xl border transition-all group", selectedCaptionId === cap.id ? "border-cyan-400 bg-cyan-400/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                            onClick={() => { setSelectedCaptionId(cap.id); setCaptionInput(cap.text); setCaptionStyle(cap.style); setCaptionColor(cap.color); setCaptionFontSize(cap.fontSize); }}
                            data-testid={`caption-item-${cap.id}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-white text-sm font-medium flex-1 truncate" style={{ color: cap.color }}>{cap.text}</p>
                              <button onClick={e => { e.stopPropagation(); setCaptionLayers(prev => prev.filter(c => c.id !== cap.id)); if (selectedCaptionId === cap.id) setSelectedCaptionId(null); }}
                                className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                data-testid={`button-caption-delete-${cap.id}`}><X size={11} /></button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-zinc-500 capitalize">{cap.style}</span>
                              <span className="text-[9px] text-zinc-600">·</span>
                              <span className="text-[9px] text-zinc-500">{cap.startTime.toFixed(1)}s – {cap.endTime.toFixed(1)}s</span>
                              <span className="text-[9px] text-zinc-600 ml-auto">⠿ drag on canvas</span>
                            </div>
                            {selectedCaptionId === cap.id && (
                              <div className="mt-2 space-y-1.5 pt-2 border-t border-zinc-800">
                                <input type="text" value={captionInput} onChange={e => { setCaptionInput(e.target.value); setCaptionLayers(prev => prev.map(c => c.id === cap.id ? { ...c, text: e.target.value } : c)); }}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs outline-none focus:border-cyan-400"
                                  data-testid={`input-caption-edit-${cap.id}`} />
                                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                  <div>
                                    <label className="text-zinc-500 block mb-0.5">Start (s)</label>
                                    <input type="number" min={0} max={cap.endTime - 0.1} step={0.1} value={cap.startTime.toFixed(1)} onChange={e => setCaptionLayers(prev => prev.map(c => c.id === cap.id ? { ...c, startTime: +e.target.value } : c))}
                                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs outline-none focus:border-cyan-400" data-testid={`input-caption-start-${cap.id}`} />
                                  </div>
                                  <div>
                                    <label className="text-zinc-500 block mb-0.5">End (s)</label>
                                    <input type="number" min={cap.startTime + 0.1} max={videoDuration || 999} step={0.1} value={cap.endTime.toFixed(1)} onChange={e => setCaptionLayers(prev => prev.map(c => c.id === cap.id ? { ...c, endTime: +e.target.value } : c))}
                                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs outline-none focus:border-cyan-400" data-testid={`input-caption-end-${cap.id}`} />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── AI Auto-Caption ── */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/25 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={12} className="text-cyan-400" />
                        <p className="text-white text-sm font-bold">AI Auto-Caption</p>
                        <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full ml-auto">Claude AI</span>
                      </div>
                      <p className="text-zinc-500 text-[10px]">Describe your video or paste key moments — AI generates timed captions automatically.</p>
                      <textarea
                        value={aiCaptionVideoDesc}
                        onChange={e => setAiCaptionVideoDesc(e.target.value)}
                        placeholder="e.g. breakdancer on Amsterdam bridge, starts with footwork intro, drops into power moves at 10s, ending pose at 25s…"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-white text-xs placeholder:text-zinc-600 outline-none focus:border-cyan-400 resize-none transition-colors"
                        rows={3}
                        data-testid="textarea-ai-caption-desc" />
                      <button
                        onClick={handleAiAutoCaption}
                        disabled={aiAutoCaptionLoading || !aiCaptionVideoDesc.trim()}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                        data-testid="button-ai-auto-caption">
                        {aiAutoCaptionLoading ? <><RotateCcw size={10} className="animate-spin" /> Generating captions…</> : <><Sparkles size={10} /> Generate Timed Captions</>}
                      </button>
                    </div>

                    {/* ── AI Translation ── */}
                    {captionLayers.length > 0 && (
                      <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-teal-500/10 border border-green-500/25 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🌍</span>
                          <p className="text-white text-sm font-bold">AI Translation</p>
                          <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">{captionLayers.length} captions</span>
                        </div>
                        <p className="text-zinc-500 text-[10px]">Translate all captions to another language using Claude AI.</p>
                        <div className="grid grid-cols-2 gap-1">
                          {TRANSLATION_LANGUAGES.map(lang => (
                            <button key={lang.id}
                              onClick={() => setAiTransLang(lang.id)}
                              className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left transition-all text-[10px]", aiTransLang === lang.id ? "border-green-400 bg-green-400/15 text-green-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                              data-testid={`button-lang-${lang.id}`}>
                              <span>{lang.flag}</span> {lang.label}
                              {aiTransLang === lang.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleAiTranslate}
                          disabled={aiTransLoading}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                          data-testid="button-ai-translate">
                          {aiTransLoading ? <><RotateCcw size={10} className="animate-spin" /> Translating…</> : <>🌍 Translate All Captions</>}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* ── TEXT ── */}
                {editTab === "text" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Type size={14} className="text-primary" />
                      <h3 className="text-white font-bold text-sm">Text Overlays</h3>
                      {editingTextLayerId && (
                        <span className="ml-auto text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold animate-pulse">EDITING LAYER</span>
                      )}
                    </div>
                    {editingTextLayerId && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                        <p className="text-primary text-xs flex-1">Editing selected layer — click canvas text to switch</p>
                        <button onClick={() => { setEditingTextLayerId(null); setSelectedTextLayerId(null); setTextInput(""); }} className="text-zinc-400 hover:text-white transition-colors"><X size={12} /></button>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <input type="text" placeholder="Type your text…" value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (editingTextLayerId ? updateSelectedTextLayer() : addTextLayer())} maxLength={60} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary" data-testid="input-text-overlay" />
                      <div><p className="text-xs text-zinc-500 mb-2">Color</p><div className="flex gap-2 flex-wrap">{TEXT_COLORS.map(c => <button key={c} onClick={() => setTextColor(c)} className={cn("w-7 h-7 rounded-full border-2 transition-all", textColor === c ? "border-white scale-110" : "border-transparent")} style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #555" : undefined }} data-testid={`button-text-color-${c.replace("#","")}`} />)}</div></div>
                      <div><div className="flex justify-between mb-1.5"><p className="text-xs text-zinc-500">Size</p><span className="text-xs text-zinc-400">{textSize}px</span></div><Slider min={16} max={56} step={2} value={[textSize]} onValueChange={([v]) => setTextSize(v)} className="w-full" /></div>
                      <div><p className="text-xs text-zinc-500 mb-2">Font</p><div className="grid grid-cols-4 gap-1.5">{TEXT_FONTS.map(f => <button key={f.id} onClick={() => setTextFont(f.id)} className={cn("py-1.5 rounded-lg text-xs font-medium border transition-all", textFont === f.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400")} style={{ fontFamily: f.style }} data-testid={`button-font-${f.id}`}>{f.label}</button>)}</div></div>
                      <div><p className="text-xs text-zinc-500 mb-2">Animation</p><div className="grid grid-cols-3 gap-1.5">{TEXT_ANIMATIONS.map(a => <button key={a.id} onClick={() => setTextAnimation(a.id)} className={cn("py-1.5 rounded-lg text-xs font-medium border transition-all", textAnimation === a.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400")} data-testid={`button-anim-${a.id}`}>{a.label}</button>)}</div></div>
                      <div><p className="text-xs text-zinc-500 mb-2">Position (or drag on canvas)</p><div className="flex gap-2">{(["top","center","bottom"] as const).map(pos => <button key={pos} onClick={() => setTextPosition(pos)} className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all", textPosition === pos ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400")} data-testid={`button-text-pos-${pos}`}>{pos}</button>)}</div></div>
                      {editingTextLayerId ? (
                        <div className="flex gap-2">
                          <Button onClick={updateSelectedTextLayer} disabled={!textInput.trim()} className="flex-1 bg-primary text-white" size="sm" data-testid="button-update-text"><RefreshCw size={13} className="mr-1" /> Update Layer</Button>
                          <Button onClick={() => { pushUndo(); addTextLayer(); setEditingTextLayerId(null); setSelectedTextLayerId(null); }} disabled={!textInput.trim()} variant="outline" className="flex-1 border-zinc-700 text-zinc-300" size="sm" data-testid="button-add-text-new"><Plus size={13} className="mr-1" /> Add New</Button>
                        </div>
                      ) : (
                        <Button onClick={() => { pushUndo(); addTextLayer(); }} disabled={!textInput.trim()} className="w-full bg-primary text-white" size="sm" data-testid="button-add-text"><Plus size={13} className="mr-1" /> Add Text Layer</Button>
                      )}
                    </div>
                    {textLayers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-500">Layers ({textLayers.length}) — click to edit, drag on canvas to move</p>
                        {textLayers.map(layer => {
                          const isEditing = editingTextLayerId === layer.id;
                          return (
                            <div key={layer.id} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer", isEditing ? "bg-primary/10 border-primary" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600")}
                              onClick={() => loadTextLayerForEditing(layer)}
                              data-testid={`text-layer-${layer.id}`}>
                              <div className="w-4 h-4 rounded-full border border-zinc-600 flex-shrink-0" style={{ backgroundColor: layer.color }} />
                              <span className={cn("flex-1 text-sm font-medium truncate", isEditing ? "text-primary" : "text-white")}>{layer.text}</span>
                              <span className="text-zinc-500 text-xs hidden sm:block">{layer.position} · {layer.animation}</span>
                              <button onClick={e => { e.stopPropagation(); pushUndo(); setTextLayers(prev => prev.filter(t => t.id !== layer.id)); if (editingTextLayerId === layer.id) { setEditingTextLayerId(null); setSelectedTextLayerId(null); } }} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid={`button-remove-text-${layer.id}`}><Trash2 size={13} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ── STICKERS ── */}
                {editTab === "stickers" && (
                  <>
                    <div className="flex items-center gap-2"><Smile size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Urban Stickers</h3></div>
                    <div className="grid grid-cols-8 gap-2">
                      {URBAN_STICKERS.map((emoji, i) => <button key={i} onClick={() => addSticker(emoji)} className="text-2xl h-11 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-primary hover:scale-110 active:scale-95 transition-all" data-testid={`button-sticker-${i}`}>{emoji}</button>)}
                    </div>
                    {stickerLayers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-500">Added stickers</p>
                        {stickerLayers.map(s => (
                          <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                            <span className="text-2xl">{s.emoji}</span>
                            <div className="flex-1 text-zinc-400 text-xs">Position {Math.round(s.x)}%, {Math.round(s.y)}%</div>
                            <div className="flex items-center gap-2 w-24"><Slider min={20} max={80} step={4} value={[s.size]} onValueChange={([v]) => setStickerLayers(prev => prev.map(st => st.id === s.id ? { ...st, size: v } : st))} className="flex-1" /></div>
                            <button onClick={() => setStickerLayers(prev => prev.filter(st => st.id !== s.id))} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid={`button-remove-sticker-${s.id}`}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── AI TOOLS ── */}
                {editTab === "aitools" && (
                  <>
                    <div className="flex items-center gap-2"><Sparkles size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">AI Tools</h3><span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">UNLOCKED</span></div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <div className="flex items-center gap-2"><Layers size={13} className="text-purple-400" /><p className="text-white text-sm font-bold">Auto-Subtitles</p></div>
                      <div className="grid grid-cols-4 gap-2">{(["bold","minimal","neon","classic"] as const).map(style => <button key={style} onClick={() => setAiSubtitleStyle(style)} className={cn("py-2 rounded-lg text-xs font-medium capitalize border transition-all", aiSubtitleStyle === style ? "border-purple-400 text-purple-400 bg-purple-400/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-subtitle-style-${style}`}>{style}</button>)}</div>
                      <input type="text" placeholder="Describe your video…" value={aiHint} onChange={e => setAiHint(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-purple-400" data-testid="input-ai-subtitle-hint" />
                      <Button onClick={handleGenerateSubtitles} disabled={aiSubtitleLoading} className="w-full bg-gradient-to-r from-purple-600 to-primary text-white" size="sm" data-testid="button-generate-subtitles">{aiSubtitleLoading ? <><Sparkles size={13} className="mr-2 animate-spin" /> Generating…</> : <><Sparkles size={13} className="mr-2" /> Generate Auto-Subtitles</>}</Button>
                      {aiSubtitles.length > 0 && <div className="space-y-1.5">{aiSubtitles.map((line, i) => <div key={i} className="text-xs text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2 border-l-2 border-purple-400">{line}</div>)}</div>}
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center gap-2"><Wand2 size={13} className="text-yellow-400" /><p className="text-white text-sm font-bold">Smart Enhance</p></div>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { label: "Street Look", icon: "🏙️", action: () => { setFilterPresetId("vivid"); setContrast(10); setSaturation(15); setHighlights(-10); setShadows(15); setWarmth(10); toast({ title: "Street Look applied!" }); } },
                          { label: "Cinematic",   icon: "🎬", action: () => { setFilterPresetId("cinema"); setContrast(20); setSaturation(-10); setVignette(20); setShadows(20); toast({ title: "Cinematic applied!" }); } },
                          { label: "Matte Viral", icon: "🎞️", action: () => { setFilterPresetId("matte"); setHighlights(-20); setSaturation(-20); setWarmth(15); toast({ title: "Matte Viral applied!" }); } },
                          { label: "Vibrant Pop", icon: "🌈", action: () => { setFilterPresetId("vivid"); setContrast(25); setSaturation(40); setBrightness(5); toast({ title: "Vibrant Pop applied!" }); } },
                          { label: "Dark Drama",  icon: "🌑", action: () => { setFilterPresetId("dramatic"); setContrast(35); setBrightness(-15); setVignette(30); setGrain(20); toast({ title: "Dark Drama applied!" }); } },
                        ].map(({ label, action, icon }) => (
                          <Button key={label} onClick={action} variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 justify-start" size="sm"><span className="mr-2">{icon}</span>{label}</Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ── AI SMART EDITOR ── */}
                {editTab === "smartedit" && (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <Bot size={15} className="text-cyan-400" />
                      <h3 className="text-white font-bold text-sm">Claude Smart Editor</h3>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full ml-auto font-semibold tracking-wide">AI POWERED</span>
                    </div>

                    {/* Context section (collapsible) */}
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <button
                        onClick={() => setSmartEditShowContext(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                        data-testid="button-smart-edit-toggle-context"
                      >
                        <div className="flex items-center gap-2">
                          <Cpu size={12} className="text-cyan-400" />
                          <span className="text-white text-xs font-semibold">Context & Goal</span>
                          <span className="text-[9px] text-zinc-500">(optional but recommended)</span>
                        </div>
                        {smartEditShowContext ? <ChevronUp size={13} className="text-zinc-400" /> : <ChevronDown size={13} className="text-zinc-400" />}
                      </button>
                      {smartEditShowContext && (
                        <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
                          <div className="pt-3">
                            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block mb-1.5">What is this video about?</label>
                            <input
                              type="text"
                              value={smartEditContext}
                              onChange={e => setSmartEditContext(e.target.value)}
                              placeholder="e.g. Breakdancing tutorial for beginners — footwork basics"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs placeholder:text-zinc-500 outline-none focus:border-cyan-400 transition-colors"
                              data-testid="input-smart-edit-context"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block mb-1.5">Speech transcript <span className="text-zinc-500 normal-case">(paste what you're saying)</span></label>
                            <textarea
                              value={smartEditTranscript}
                              onChange={e => setSmartEditTranscript(e.target.value)}
                              rows={4}
                              placeholder="e.g. Hey guys, today I want to, um, I want to show you how to, uh, how to do a basic footwork combo..."
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs placeholder:text-zinc-500 outline-none focus:border-cyan-400 transition-colors resize-none"
                              data-testid="textarea-smart-edit-transcript"
                            />
                            <p className="text-[9px] text-zinc-500 mt-1">Paste your speech — AI detects stutters, fillers (um/uh/like), repetitions, and dead air</p>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block mb-1.5">Creative goal</label>
                            <input
                              type="text"
                              value={smartEditGoal}
                              onChange={e => setSmartEditGoal(e.target.value)}
                              placeholder="e.g. Viral hook, keep under 30s, high energy, no dead air"
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs placeholder:text-zinc-500 outline-none focus:border-cyan-400 transition-colors"
                              data-testid="input-smart-edit-goal"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Clips summary */}
                    {clips.length > 0 && (
                      <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{clips.length} clip{clips.length !== 1 ? "s" : ""} ready to analyze</span>
                          <span className="text-xs text-cyan-400 font-medium">{clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0).toFixed(1)}s total</span>
                        </div>
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          {clips.map((c, i) => (
                            <div key={c.id} className="text-[9px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300">
                              <span className="text-zinc-500 mr-1">#{i + 1}</span>{(c.trimEnd - c.trimStart).toFixed(1)}s
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Analyze button */}
                    <Button
                      onClick={handleRunSmartEdit}
                      disabled={smartEditLoading || !clips.length}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-cyan-900/30"
                      size="sm"
                      data-testid="button-run-smart-edit"
                    >
                      {smartEditLoading
                        ? <><Bot size={13} className="mr-2 animate-pulse" /> Analyzing with Claude…</>
                        : <><Bot size={13} className="mr-2" /> Run AI Smart Analysis</>}
                    </Button>

                    {/* Loading skeleton */}
                    {smartEditLoading && (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-24 bg-zinc-900 rounded-xl border border-zinc-800" />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
                          <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
                          <div className="h-16 bg-zinc-900 rounded-xl border border-zinc-800" />
                        </div>
                        <div className="h-32 bg-zinc-900 rounded-xl border border-zinc-800" />
                      </div>
                    )}

                    {/* ── ANALYSIS RESULTS ── */}
                    {smartEditAnalysis && !smartEditLoading && (
                      <div className="space-y-4">

                        {/* Summary card */}
                        <div className="rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-cyan-500/20 p-4 space-y-3">
                          <p className="text-xs text-zinc-300 leading-relaxed">{smartEditAnalysis.summary}</p>
                          {/* Score row */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Hook", value: smartEditAnalysis.hookScore, color: smartEditAnalysis.hookScore >= 75 ? "text-green-400" : smartEditAnalysis.hookScore >= 50 ? "text-yellow-400" : "text-red-400", bg: smartEditAnalysis.hookScore >= 75 ? "bg-green-400/10 border-green-400/20" : smartEditAnalysis.hookScore >= 50 ? "bg-yellow-400/10 border-yellow-400/20" : "bg-red-400/10 border-red-400/20" },
                              { label: "Pace", value: smartEditAnalysis.paceScore, color: smartEditAnalysis.paceScore >= 75 ? "text-green-400" : smartEditAnalysis.paceScore >= 50 ? "text-yellow-400" : "text-red-400", bg: smartEditAnalysis.paceScore >= 75 ? "bg-green-400/10 border-green-400/20" : smartEditAnalysis.paceScore >= 50 ? "bg-yellow-400/10 border-yellow-400/20" : "bg-red-400/10 border-red-400/20" },
                              { label: "Ready", value: smartEditAnalysis.overallReadiness, color: smartEditAnalysis.overallReadiness >= 75 ? "text-green-400" : smartEditAnalysis.overallReadiness >= 50 ? "text-yellow-400" : "text-red-400", bg: smartEditAnalysis.overallReadiness >= 75 ? "bg-green-400/10 border-green-400/20" : smartEditAnalysis.overallReadiness >= 50 ? "bg-yellow-400/10 border-yellow-400/20" : "bg-red-400/10 border-red-400/20" },
                            ].map(({ label, value, color, bg }) => (
                              <div key={label} className={cn("rounded-lg border p-2 text-center", bg)}>
                                <p className={cn("text-lg font-black", color)}>{value}</p>
                                <p className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Hook issue */}
                          {smartEditAnalysis.hookIssue && (
                            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                              <Zap size={11} className="text-red-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-red-300">{smartEditAnalysis.hookIssue}</p>
                            </div>
                          )}
                          {/* Transition recommendation */}
                          {smartEditAnalysis.transitionRecommendation && (
                            <div className="flex items-center gap-2">
                              <Shuffle size={11} className="text-cyan-400 shrink-0" />
                              <p className="text-[11px] text-zinc-400">Recommended transition: <span className="text-cyan-300 font-medium capitalize">{smartEditAnalysis.transitionRecommendation}</span></p>
                              <button
                                onClick={() => {
                                  const tr = smartEditAnalysis.transitionRecommendation.toLowerCase();
                                  if (["cut","fade","dissolve"].includes(tr)) setSelectedTransition(tr as any);
                                  toast({ title: `Transition set to ${tr}` });
                                }}
                                className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded px-2 py-0.5 hover:bg-cyan-500/30 transition-colors"
                                data-testid="button-apply-transition"
                              >Apply</button>
                            </div>
                          )}
                        </div>

                        {/* Apply All button */}
                        {(smartEditAnalysis.clipAnalysis.filter(s => s.action !== "keep").length > 0 || smartEditAnalysis.textSuggestions.filter(s => s.action === "add").length > 0) && (
                          <Button
                            onClick={applyAllSmartSuggestions}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold shadow-lg shadow-purple-900/30"
                            size="sm"
                            data-testid="button-apply-all-smart"
                          >
                            <Wand2 size={13} className="mr-2" />
                            Apply All Suggestions ({smartEditAnalysis.clipAnalysis.filter(s => s.action !== "keep").length + smartEditAnalysis.textSuggestions.filter(s => s.action === "add").length})
                          </Button>
                        )}

                        {/* Per-clip suggestions */}
                        {smartEditAnalysis.clipAnalysis.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                              <Scissors size={10} /> Clip Edits
                            </p>
                            {smartEditAnalysis.clipAnalysis.map((s, i) => {
                              const key = `clip-${s.clipIndex}`;
                              const applied = smartEditApplied.has(key);
                              const isActionable = s.action !== "keep";
                              const issueColors: Record<string, string> = {
                                slow_start: "text-orange-400", stutter: "text-red-400", repetition: "text-yellow-400",
                                filler: "text-yellow-400", too_long: "text-orange-400", off_topic: "text-red-400",
                                weak_energy: "text-blue-400", none: "text-green-400",
                              };
                              const issueLabels: Record<string, string> = {
                                slow_start: "Slow Start", stutter: "Stutter Detected", repetition: "Repetition",
                                filler: "Filler Words", too_long: "Too Long", off_topic: "Off Topic",
                                weak_energy: "Weak Energy", none: "Looks Good",
                              };
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "rounded-xl border p-3 space-y-2 transition-all",
                                    applied ? "border-green-500/30 bg-green-500/5" : isActionable ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-zinc-900/50 opacity-60"
                                  )}
                                  data-testid={`card-smart-clip-${i}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5">Clip {s.clipIndex + 1}</span>
                                      {s.issue && s.issue !== "none" && (
                                        <span className={cn("text-[9px] font-semibold capitalize", issueColors[s.issue] || "text-zinc-400")}>
                                          ⚠ {issueLabels[s.issue] || s.issue}
                                        </span>
                                      )}
                                      {s.issue === "none" && <span className="text-[9px] text-green-400 font-semibold">✓ Good</span>}
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5">
                                      <span className="text-[9px] text-zinc-500">{s.confidence}% conf</span>
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide", {
                                        "bg-red-500/20 text-red-400": s.action === "cut",
                                        "bg-yellow-500/20 text-yellow-400": s.action === "trim",
                                        "bg-green-500/20 text-green-400": s.action === "keep",
                                      })}>{s.action}</span>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-zinc-300 leading-relaxed">{s.reason}</p>
                                  {s.action === "trim" && (s.newTrimStart !== undefined || s.newTrimEnd !== undefined) && (
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                      <Scissors size={9} />
                                      {s.newTrimStart !== undefined && <span>Start → <span className="text-cyan-400 font-mono">{s.newTrimStart.toFixed(2)}s</span></span>}
                                      {s.newTrimEnd !== undefined && <span>End → <span className="text-cyan-400 font-mono">{s.newTrimEnd.toFixed(2)}s</span></span>}
                                    </div>
                                  )}
                                  {isActionable && !applied && (
                                    <button
                                      onClick={() => applySmartClipSuggestion(s, key)}
                                      className="w-full text-xs bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/30 text-cyan-300 rounded-lg py-1.5 font-medium transition-colors"
                                      data-testid={`button-apply-clip-${i}`}
                                    >
                                      {s.action === "cut" ? "✂ Remove Clip" : "✂ Apply Trim"}
                                    </button>
                                  )}
                                  {applied && <p className="text-xs text-green-400 text-center font-semibold">✅ Applied</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Text layer suggestions */}
                        {smartEditAnalysis.textSuggestions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                              <Type size={10} /> Text Suggestions
                            </p>
                            {smartEditAnalysis.textSuggestions.map((s, i) => {
                              const key = `text-${i}`;
                              const applied = smartEditApplied.has(key);
                              return (
                                <div
                                  key={i}
                                  className={cn("rounded-xl border p-3 space-y-2 transition-all", applied ? "border-green-500/30 bg-green-500/5" : "border-zinc-700 bg-zinc-900")}
                                  data-testid={`card-smart-text-${i}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide", s.action === "add" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400")}>{s.action}</span>
                                    {s.text && <span className="text-[11px] text-white font-medium truncate">"{s.text}"</span>}
                                    {s.startTime !== undefined && <span className="text-[9px] text-zinc-500 ml-auto">{s.startTime.toFixed(1)}s–{(s.endTime ?? 3).toFixed(1)}s</span>}
                                  </div>
                                  <p className="text-[11px] text-zinc-400 leading-relaxed">{s.reason}</p>
                                  {!applied && (
                                    <button
                                      onClick={() => applySmartTextSuggestion(s, key)}
                                      className="w-full text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-300 rounded-lg py-1.5 font-medium transition-colors"
                                      data-testid={`button-apply-text-${i}`}
                                    >
                                      {s.action === "add" ? "＋ Add Text Layer" : "✕ Remove Layer"}
                                    </button>
                                  )}
                                  {applied && <p className="text-xs text-green-400 text-center font-semibold">✅ Applied</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Global suggestions / tips */}
                        {smartEditAnalysis.globalSuggestions.length > 0 && (
                          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5"><Star size={10} /> Pro Tips</p>
                            <div className="space-y-2">
                              {smartEditAnalysis.globalSuggestions.map((tip, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-cyan-400 text-xs mt-0.5 shrink-0">→</span>
                                  <p className="text-[11px] text-zinc-300 leading-relaxed">{tip}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Readiness issues */}
                        {smartEditAnalysis.readinessIssues.length > 0 && (
                          <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-3 space-y-1.5">
                            <p className="text-[10px] text-orange-400 uppercase tracking-wider font-semibold">Before You Post</p>
                            {smartEditAnalysis.readinessIssues.map((issue, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className="text-orange-400 text-xs shrink-0 mt-0.5">!</span>
                                <p className="text-[11px] text-orange-200/80 leading-relaxed">{issue}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Re-analyze button */}
                        <button
                          onClick={() => { setSmartEditAnalysis(null); setSmartEditApplied(new Set()); }}
                          className="w-full text-xs text-zinc-500 hover:text-zinc-400 py-2 border border-zinc-800 rounded-lg transition-colors"
                          data-testid="button-smart-edit-reset"
                        >↺ Reset & Re-analyze</button>

                      </div>
                    )}
                  </div>
                )}

                {/* ── SCHEDULE (Admin-only) ── */}
                {editTab === "schedule" && (
                  <>
                    <div className="flex items-center gap-2"><Calendar size={14} className="text-blue-400" /><h3 className="text-white font-bold text-sm">Schedule Post</h3><span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-auto">ADMIN</span></div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-white text-sm font-bold">Enable Scheduling</p><p className="text-zinc-500 text-xs">Post at a specific date and time</p></div>
                        <button onClick={() => setScheduleEnabled(v => !v)} className={cn("w-12 h-6 rounded-full relative transition-all", scheduleEnabled ? "bg-primary" : "bg-zinc-700")} data-testid="toggle-schedule">
                          <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", scheduleEnabled ? "left-6" : "left-0.5")} />
                        </button>
                      </div>
                      {scheduleEnabled && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-zinc-500 mb-1.5">Date</p>
                              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-400" data-testid="input-schedule-date" />
                            </div>
                            <div>
                              <p className="text-xs text-zinc-500 mb-1.5">Time</p>
                              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-400" data-testid="input-schedule-time" />
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Target Platforms</p>
                            <div className="flex flex-wrap gap-2">
                              {PLATFORM_PROFILES.map(p => (
                                <button key={p.id} onClick={() => setSchedulePlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all", schedulePlatforms.includes(p.id) ? "border-blue-400 bg-blue-400/15 text-blue-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-schedule-platform-${p.id}`}>
                                  {p.emoji} {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {scheduleDate && scheduleTime && (
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                              <div className="flex items-center gap-2">
                                <Calendar size={13} className="text-blue-400 flex-shrink-0" />
                                <div>
                                  <p className="text-white text-xs font-semibold">Scheduled: {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                                  <p className="text-blue-400 text-[10px]">{scheduleTime} · {schedulePlatforms.length} platform{schedulePlatforms.length !== 1 ? "s" : ""}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center gap-2"><Bell size={13} className="text-orange-400" /><p className="text-white text-sm font-bold">Publishing Options</p></div>
                      {[{ id: "ig", label: "Auto-post to Instagram", emoji: "📸", state: autoPostIG, setState: setAutoPostIG }, { id: "tt", label: "Auto-post to TikTok", emoji: "🎵", state: autoPostTikTok, setState: setAutoPostTikTok }].map(({ id, label, emoji, state, setState }) => (
                        <div key={id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800 border border-zinc-700">
                          <div className="flex items-center gap-2"><span>{emoji}</span><p className="text-zinc-300 text-sm">{label}</p></div>
                          <button onClick={() => setState(v => !v)} className={cn("w-11 h-6 rounded-full relative transition-all", state ? "bg-primary" : "bg-zinc-700")} data-testid={`toggle-autopost-${id}-schedule`}>
                            <div className={cn("absolute top-0.5 rounded-full bg-white shadow transition-all", state ? "left-5" : "left-0.5")} style={{ width: 20, height: 20 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Best times hint */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <div className="flex items-center gap-2"><Clock size={13} className="text-green-400" /><p className="text-white text-sm font-bold">Best Posting Times</p></div>
                      {BEST_POSTING_TIMES.map(({ platform, slots, bestDay, reach, color }) => (
                        <div key={platform} className="p-2.5 rounded-lg bg-zinc-800 border border-zinc-700">
                          <div className="flex items-center justify-between mb-1"><p className={cn("text-sm font-bold", color)}>{platform}</p><span className="text-zinc-500 text-[10px]">{bestDay}</span></div>
                          <div className="flex gap-1.5 flex-wrap">{slots.map(t => <span key={t} className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">{t}</span>)}</div>
                          <p className="text-zinc-600 text-[10px] mt-1">{reach}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── BATCH (Admin-only) ── */}
                {editTab === "batch" && (
                  <>
                    <div className="flex items-center gap-2"><ListChecks size={14} className="text-green-400" /><h3 className="text-white font-bold text-sm">Batch Upload Queue</h3><span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-auto">ADMIN</span></div>
                    <p className="text-zinc-500 text-xs">Queue multiple videos for upload. Each gets processed with the same edit settings.</p>
                    <button onClick={() => batchInputRef.current?.click()} className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-zinc-700 hover:border-green-400 hover:bg-zinc-900/50 transition-all text-zinc-400 hover:text-white" data-testid="button-batch-add">
                      <PlusCircle size={16} /> <span className="text-sm font-medium">Add videos to batch (max 10)</span>
                    </button>
                    {batchQueue.length === 0 ? (
                      <div className="text-center py-10 text-zinc-600">
                        <ListChecks size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No videos queued yet</p>
                        <p className="text-xs mt-1">Click above to add multiple videos</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-zinc-300 font-medium">{batchQueue.length} video{batchQueue.length !== 1 ? "s" : ""} queued</p>
                          <button onClick={() => setBatchQueue([])} className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"><Trash2 size={11} /> Clear all</button>
                        </div>
                        <div className="space-y-3">
                          {batchQueue.map((item, idx) => (
                            <div key={item.id} className={cn("p-3 rounded-xl border transition-all", item.status === "done" ? "border-green-500/40 bg-green-500/5" : item.status === "error" ? "border-red-500/40 bg-red-500/5" : item.status === "uploading" ? "border-primary/40 bg-primary/5" : "border-zinc-800 bg-zinc-900")} data-testid={`batch-item-${idx}`}>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                                  <video src={item.previewUrl} className="w-full h-full object-cover" muted playsInline />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium truncate">{item.file.name}</p>
                                  <p className="text-zinc-500 text-xs">{formatSize(item.file.size)}</p>
                                  <input type="text" placeholder="Caption for this video…" value={item.caption} onChange={e => setBatchQueue(prev => prev.map(b => b.id === item.id ? { ...b, caption: e.target.value } : b))} className="mt-1.5 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs placeholder:text-zinc-600 outline-none focus:border-primary" data-testid={`input-batch-caption-${idx}`} />
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-medium", item.status === "queued" ? "bg-zinc-700 text-zinc-400" : item.status === "uploading" ? "bg-primary/20 text-primary" : item.status === "done" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>{item.status}</span>
                                  <button onClick={() => setBatchQueue(prev => prev.filter(b => b.id !== item.id))} className="text-zinc-600 hover:text-red-400 transition-colors"><X size={13} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button className="w-full bg-gradient-to-r from-green-600 to-primary text-white font-bold" onClick={() => toast({ title: "Batch upload", description: "Open each video individually to apply edits and upload." })} data-testid="button-batch-start">
                          <Upload size={14} className="mr-2" /> Process Batch ({batchQueue.length} videos)
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* ── CAPTION LIBRARY (Admin-only) ── */}
                {editTab === "library" && (
                  <>
                    <div className="flex items-center gap-2"><Archive size={14} className="text-orange-400" /><h3 className="text-white font-bold text-sm">Caption Library</h3><span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-auto">ADMIN</span></div>
                    <p className="text-zinc-500 text-xs">Save and reuse caption templates. Templates are loaded in the Caption step.</p>
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                      <p className="text-white text-sm font-bold">Save Current Caption</p>
                      <input type="text" placeholder="Template title…" value={newCaptionTitle} onChange={e => setNewCaptionTitle(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-orange-400" data-testid="input-caption-title" />
                      <input type="text" placeholder="Tags to include (e.g. #hiphop #breaking)…" value={newCaptionTags} onChange={e => setNewCaptionTags(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-orange-400" data-testid="input-caption-tags" />
                      <div className="flex gap-2">
                        <select value={captionPlatformTag} onChange={e => setCaptionPlatformTag(e.target.value)} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-400" data-testid="select-caption-platform">
                          <option value="All">All Platforms</option>
                          {PLATFORM_PROFILES.map(p => <option key={p.id} value={p.label}>{p.emoji} {p.label}</option>)}
                        </select>
                        <Button onClick={saveCaption} className="bg-orange-500 hover:bg-orange-600 text-white" size="sm" data-testid="button-save-caption"><Plus size={13} className="mr-1" /> Save</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {savedCaptions.length === 0 ? <div className="text-center py-8 text-zinc-600 text-sm">No saved captions yet</div> : savedCaptions.map(cap => (
                        <div key={cap.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors" data-testid={`caption-library-${cap.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <p className="text-white text-sm font-bold">{cap.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">{cap.platform}</span>
                                <span className="text-zinc-600 text-[9px]">{cap.createdAt}</span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => loadCaption(cap)} className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors" data-testid={`button-load-caption-${cap.id}`}>Load</button>
                              <button onClick={() => setSavedCaptions(prev => prev.filter(c => c.id !== cap.id))} className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" data-testid={`button-delete-caption-${cap.id}`}><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">{cap.caption}</p>
                          {cap.tags && <p className="text-primary text-[10px] mt-1 truncate">{cap.tags}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── ANALYTICS (Admin-only) ── */}
                {editTab === "analytics" && (
                  <>
                    <div className="flex items-center gap-2"><BarChart3 size={14} className="text-purple-400" /><h3 className="text-white font-bold text-sm">Content Analytics</h3><span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full ml-auto">ADMIN</span></div>
                    <div className="flex gap-2">
                      {[{ id: "times", label: "Best Times", icon: Clock }, { id: "formats", label: "Formats", icon: Layers2 }, { id: "trends", label: "Trends", icon: TrendingUp }].map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setAnalyticsView(id as any)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all", analyticsView === id ? "border-purple-400 bg-purple-400/10 text-purple-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")} data-testid={`button-analytics-${id}`}><Icon size={12} />{label}</button>
                      ))}
                    </div>
                    {analyticsView === "times" && (
                      <div className="space-y-3">
                        <p className="text-zinc-500 text-xs">Optimal posting windows for Urban Culture Connect content based on Dutch audience behavior.</p>
                        {BEST_POSTING_TIMES.map(({ platform, slots, bestDay, reach, color }) => (
                          <div key={platform} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                            <div className="flex items-center justify-between mb-2"><p className={cn("text-sm font-bold", color)}>{platform}</p><span className="text-zinc-600 text-xs">{bestDay}</span></div>
                            <div className="flex gap-1.5 flex-wrap mb-2">{slots.map(t => <span key={t} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg font-mono">{t}</span>)}</div>
                            <p className="text-zinc-500 text-[10px]">{reach} · Timezone: CET (Amsterdam)</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {analyticsView === "formats" && (
                      <div className="space-y-3">
                        <p className="text-zinc-500 text-xs">Highest performing video formats for urban culture content right now.</p>
                        {[
                          { format: "Behind the scenes", engagement: 92, trend: "↑", note: "Authentic content wins on TikTok" },
                          { format: "Tutorial / How-to",  engagement: 88, trend: "↑", note: "High share rate & saves" },
                          { format: "Battle / Competition",engagement: 85, trend: "→", note: "Breaking & cypher content" },
                          { format: "POV storytelling",   engagement: 82, trend: "↑", note: "Gen Z primary format" },
                          { format: "Before/After",       engagement: 79, trend: "↑", note: "Works for progress reveals" },
                          { format: "Day in the life",    engagement: 75, trend: "→", note: "Strong for personal brand" },
                          { format: "Interview / collab", engagement: 71, trend: "↑", note: "Cross-audience growth" },
                          { format: "Event highlights",   engagement: 68, trend: "→", note: "Best within 24h of event" },
                        ].map(({ format, engagement, trend, note }) => (
                          <div key={format} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1"><p className="text-white text-sm font-medium">{format}</p><span className={cn("text-xs font-bold", trend === "↑" ? "text-green-400" : "text-zinc-400")}>{trend}</span></div>
                              <p className="text-zinc-500 text-[10px]">{note}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-white font-bold text-sm">{engagement}%</p>
                              <div className="w-16 h-1.5 bg-zinc-800 rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${engagement}%` }} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {analyticsView === "trends" && (
                      <div className="space-y-3">
                        <p className="text-zinc-500 text-xs">Trending topics & hashtags in the Dutch urban culture scene this month.</p>
                        {[
                          { topic: "Breaking Olympics legacy", momentum: "🔥🔥🔥", platforms: "TikTok, IG", status: "Rising" },
                          { topic: "Amsterdam street art walks", momentum: "🔥🔥",   platforms: "Instagram",   status: "Growing" },
                          { topic: "Dutch hip-hop new wave",    momentum: "🔥🔥🔥", platforms: "All",          status: "Trending" },
                          { topic: "Cypher challenges",         momentum: "🔥",     platforms: "TikTok",       status: "Stable" },
                          { topic: "Cultural fashion collabs",  momentum: "🔥🔥",   platforms: "IG, LinkedIn", status: "Rising" },
                          { topic: "Youth culture documentaries",momentum: "🔥🔥",  platforms: "YouTube",      status: "Growing" },
                          { topic: "Graffiti time-lapses",      momentum: "🔥🔥🔥", platforms: "IG Reels, TT", status: "Hot" },
                          { topic: "Beat labs & producers",     momentum: "🔥",     platforms: "All",          status: "Stable" },
                        ].map(({ topic, momentum, platforms, status }) => (
                          <div key={topic} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium">{topic}</p>
                              <p className="text-zinc-500 text-[10px]">{platforms}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <span className="text-sm">{momentum}</span>
                              <p className={cn("text-[10px] font-medium mt-0.5", status === "Trending" || status === "Hot" ? "text-orange-400" : status === "Rising" || status === "Growing" ? "text-green-400" : "text-zinc-400")}>{status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* ── Right-click Context Menu ── */}
              {contextMenu && (
                <div
                  className="fixed z-[9999] min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onMouseLeave={() => setContextMenu(null)}>
                  {contextMenu.type === "clip" && contextMenu.clipIdx !== undefined ? (
                    <>
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <p className="text-zinc-400 text-[9px] font-semibold uppercase tracking-wider">Clip {(contextMenu.clipIdx ?? 0) + 1}</p>
                      </div>
                      {[
                        { label: "Set as active", icon: "▶", action: () => { setActiveClipIdx(contextMenu.clipIdx!); setContextMenu(null); } },
                        { label: "Duplicate clip", icon: "⧉", action: () => { const c = clips[contextMenu.clipIdx!]; if (c) { pushUndo(); setClips(prev => [...prev.slice(0, contextMenu.clipIdx! + 1), { ...c, id: Date.now() }, ...prev.slice(contextMenu.clipIdx! + 1)]); } setContextMenu(null); } },
                        { label: "Remove clip",    icon: "✕", action: () => { pushUndo(); setClips(prev => prev.filter((_, i) => i !== contextMenu.clipIdx)); setActiveClipIdx(Math.max(0, (contextMenu.clipIdx ?? 1) - 1)); setContextMenu(null); }, danger: true },
                      ].map(item => (
                        <button key={item.label} onClick={item.action}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800", (item as { danger?: boolean }).danger ? "text-red-400 hover:text-red-300" : "text-zinc-300 hover:text-white")}
                          data-testid={`ctx-clip-${item.label.toLowerCase().replace(/\s+/g,"-")}`}>
                          <span className="w-4 text-center text-[10px] opacity-60">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <p className="text-zinc-400 text-[9px] font-semibold uppercase tracking-wider">Music Track</p>
                      </div>
                      {[
                        { label: mutedTracks.music ? "Unmute track" : "Mute track", icon: mutedTracks.music ? "🔊" : "🔇", action: () => { setMutedTracks(v => ({ ...v, music: !v.music })); setContextMenu(null); } },
                        { label: "Audio settings", icon: "🎛", action: () => { setEditTab("audio"); setContextMenu(null); } },
                        { label: "Remove track",   icon: "✕", action: () => { setSelectedTrack(null); setContextMenu(null); }, danger: true },
                      ].map(item => (
                        <button key={item.label} onClick={item.action}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-800", (item as { danger?: boolean }).danger ? "text-red-400 hover:text-red-300" : "text-zinc-300 hover:text-white")}
                          data-testid={`ctx-audio-${item.label.toLowerCase().replace(/\s+/g,"-")}`}>
                          <span className="w-4 text-center text-[10px]">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── Effect Placement Panel ── */}
              {pendingEffect && (
                <div className="flex-shrink-0 border-t-2 border-primary/40 bg-zinc-950 p-3 space-y-2.5" data-testid="effect-placement-panel">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{pendingEffect.emoji}</span>
                    <span className="text-white text-xs font-bold">{pendingEffect.label}</span>
                    <span className="text-[10px] text-zinc-500 ml-1 hidden sm:block">— drag to set when this effect plays</span>
                    <button onClick={() => setPendingEffect(null)} className="ml-auto text-zinc-500 hover:text-white transition-colors" data-testid="button-effect-cancel-x"><X size={13} /></button>
                  </div>
                  <div className="relative h-7 bg-zinc-800 rounded-lg overflow-hidden cursor-pointer"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      const t = pct * (videoDuration || 5);
                      if (Math.abs(t - pendingRangeStart) < Math.abs(t - pendingRangeEnd)) setPendingRangeStart(Math.min(t, pendingRangeEnd - 0.5));
                      else setPendingRangeEnd(Math.max(t, pendingRangeStart + 0.5));
                    }}>
                    <div className="absolute top-0 bottom-0 rounded-lg opacity-80 transition-all"
                      style={{ left: `${(pendingRangeStart / (videoDuration || 5)) * 100}%`, width: `${Math.max(4, ((pendingRangeEnd - pendingRangeStart) / (videoDuration || 5)) * 100)}%`, backgroundColor: pendingEffect.color }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-mono pointer-events-none">{formatTime(pendingRangeStart)} — {formatTime(pendingRangeEnd)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>In point</span><button onClick={() => setPendingRangeStart(Math.min(clipCurrentTime, pendingRangeEnd - 0.5))} className="text-primary hover:text-primary/80 transition-colors text-[10px]">📍 Playhead</button></div>
                      <Slider min={0} max={Math.max(0.5, videoDuration - 0.5)} step={0.1} value={[pendingRangeStart]} onValueChange={([v]) => setPendingRangeStart(Math.min(v, pendingRangeEnd - 0.5))} className="w-full" data-testid="slider-effect-in" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-500 mb-1"><span>Out point</span><button onClick={() => setPendingRangeEnd(Math.max(clipCurrentTime, pendingRangeStart + 0.5))} className="text-primary hover:text-primary/80 transition-colors text-[10px]">📍 Playhead</button></div>
                      <Slider min={0.5} max={videoDuration || 5} step={0.1} value={[pendingRangeEnd]} onValueChange={([v]) => setPendingRangeEnd(Math.max(v, pendingRangeStart + 0.5))} className="w-full" data-testid="slider-effect-out" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setPendingRangeStart(0); setPendingRangeEnd(videoDuration || 5); }} className="text-[10px] text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors flex-shrink-0" data-testid="button-effect-full-clip">Full clip</button>
                    <button onClick={() => { addEffectToTimeline(pendingEffect, pendingRangeStart, pendingRangeEnd); setPendingEffect(null); }} className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg text-white transition-opacity hover:opacity-90" style={{ backgroundColor: pendingEffect.color }} data-testid="button-effect-confirm">✓ Add to Timeline</button>
                    <button onClick={() => setPendingEffect(null)} className="text-[10px] text-zinc-500 hover:text-white px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors" data-testid="button-effect-cancel">Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Professional Multi-Layer Timeline ── */}
              {(() => {
                // Derived values scoped to this block
                let tlElapsed = 0;
                for (let i = 0; i < activeClipIdx; i++) tlElapsed += clips[i].trimEnd - clips[i].trimStart;
                const tlPlayheadX = (tlElapsed + Math.max(0, clipCurrentTime - (clips[activeClipIdx]?.trimStart ?? 0))) * pxPerSec;
                const tlContentW = Math.max(320, tlTotalDuration * pxPerSec + 120);
                const tlScrubFrame = tlScrubTime !== null && timelineFrames.length > 0 && tlTotalDuration > 0
                  ? timelineFrames[Math.max(0, Math.min(timelineFrames.length - 1, Math.round((tlScrubTime / tlTotalDuration) * (timelineFrames.length - 1))))]
                  : null;
                // Dynamic height: only count tracks that are visible
                const vt = visibleTracks;
                const activeTracksH =
                  (vt.has("music") ? TL_AUDIO_H : 0) +
                  (vt.has("sfx")   ? TL_SFX_H   : 0) +
                  (vt.has("voice") ? TL_VOICE_H  : 0) +
                  (vt.has("capts") ? TL_CAPTS_H  : 0) +
                  (vt.has("text")  ? TL_TEXT_H   : 0) +
                  (vt.has("overl") ? TL_OVERL_H + 8 : 0) +
                  (vt.has("trans") ? TL_TRANS_H  : 0) +
                  (vt.has("mtn")   ? TL_EFFX_H   : 0) +
                  (vt.has("lut")   ? TL_LUT_H    : 0) +
                  (vt.has("map")   ? TL_MAP_H    : 0);
                const compactH = TL_RULER_H + TL_VIDEO_H + activeTracksH + 28;
                const expandedH = compactH; // no longer used separately

                const rulerInteract = (clientX: number) => {
                  if (!tlScrollRef.current) return;
                  const rect = tlScrollRef.current.getBoundingClientRect();
                  const x = clientX - rect.left + tlScrollRef.current.scrollLeft;
                  tlSeekToX(x);
                  setTlScrubX(x);
                  setTlScrubTime(Math.max(0, Math.min(tlTotalDuration, x / pxPerSec)));
                };

                return (
                  <div
                    className="flex-shrink-0 flex flex-col border-t border-zinc-800/60 bg-[#080808] select-none"
                    style={{ height: compactH, maxHeight: "48vh", minHeight: TL_RULER_H + TL_VIDEO_H + 28, transition: "height 0.22s ease" }}
                    data-testid="professional-timeline">

                    {/* ── Toolbar ── */}
                    <div className="flex items-center gap-1 px-2 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0" style={{ height: 28 }}>
                      <button
                        onClick={() => { if (previewVideoRef.current) { previewVideoRef.current.currentTime = clips[0]?.trimStart ?? 0; setActiveClipIdx(0); previewVideoRef.current.pause(); setIsPlaying(false); }}}
                        className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded hover:bg-zinc-800"
                        title="Go to start" data-testid="button-tl-start">
                        <SkipBack size={10} />
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className="w-6 h-5 flex items-center justify-center text-white bg-primary/20 hover:bg-primary/30 rounded transition-colors border border-primary/30"
                        data-testid="button-tl-play">
                        {isPlaying ? <Pause size={9} /> : <Play size={9} />}
                      </button>
                      <button
                        onClick={() => { if (previewVideoRef.current && clips.length > 0) { const last = clips[clips.length - 1]; setActiveClipIdx(clips.length - 1); previewVideoRef.current.currentTime = last.trimEnd - 0.1; }}}
                        className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors rounded hover:bg-zinc-800"
                        title="Go to end" data-testid="button-tl-end">
                        <SkipForward size={10} />
                      </button>
                      <span className="text-[9px] font-mono text-white/70 tabular-nums ml-1">{formatTime(clipCurrentTime)}</span>
                      <span className="text-[9px] font-mono text-zinc-600 mx-px">/</span>
                      <span className="text-[9px] font-mono text-zinc-600 tabular-nums">{formatTime(tlTotalDuration)}</span>
                      <div className="flex-1" />
                      {/* Tool mode selector */}
                      <div className="flex items-center rounded overflow-hidden border border-zinc-700/60 flex-shrink-0">
                        {(["select","split","trim"] as const).map(mode => (
                          <button key={mode}
                            onClick={() => setActiveToolMode(mode)}
                            className={`px-1.5 py-0.5 text-[8px] font-semibold transition-colors ${activeToolMode === mode ? "bg-primary/30 text-white" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
                            title={mode === "select" ? "Select (V)" : mode === "split" ? "Split (X)" : "Trim (T)"}
                            data-testid={`button-tool-${mode}`}>
                            {mode === "select" ? "▶" : mode === "split" ? "✂" : "⊣⊢"}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleSplitClip}
                        className="flex items-center gap-0.5 text-[9px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors"
                        title="Split at playhead (S)"
                        data-testid="button-tl-split">
                        <Scissors size={8} /> Split
                      </button>
                      <button
                        onClick={handleDuplicateClip}
                        className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors"
                        title="Duplicate clip (Ctrl+D)"
                        data-testid="button-tl-dup">
                        <Copy size={8} />
                      </button>
                      {clips.length > 1 && (
                        <button
                          onClick={() => handleDeleteClip(activeClipIdx)}
                          className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-300 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 transition-colors"
                          title="Delete clip (Del)"
                          data-testid="button-tl-delete">
                          <Trash2 size={8} />
                        </button>
                      )}
                      <div className="w-px h-4 bg-zinc-700 mx-0.5" />
                      <button onClick={() => setPxPerSec(p => Math.max(15, p - 15))} className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-white font-bold bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700/60 transition-colors text-sm" title="Zoom out (-)">−</button>
                      <span className="text-[8px] text-zinc-600 font-mono w-7 text-center tabular-nums">{pxPerSec}px</span>
                      <button onClick={() => setPxPerSec(p => Math.min(200, p + 15))} className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-white font-bold bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700/60 transition-colors text-sm" title="Zoom in (+)">+</button>
                      <div className="w-px h-4 bg-zinc-700 mx-0.5" />
                      {/* Add Track button with dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setAddTrackMenuOpen(v => !v)}
                          className="flex items-center gap-0.5 px-1.5 h-5 text-[8px] font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                          title="Add a new track"
                          data-testid="button-tl-add-track">
                          <Plus size={9} /> Track
                        </button>
                        {addTrackMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1 min-w-[140px]"
                            onMouseLeave={() => setAddTrackMenuOpen(false)}>
                            {[
                              { id: "music", icon: <Music size={8} className="text-green-400" />,  label: "Music",      action: () => setEditTab("audio") },
                              { id: "voice", icon: <Mic size={8} className="text-red-400" />,      label: "Voice-over", action: startVoiceOver },
                              { id: "sfx",   icon: <Radio size={8} className="text-orange-400" />, label: "SFX",        action: () => setEditTab("sounds") },
                              { id: "capts", icon: <MessageSquare size={8} className="text-cyan-400" />, label: "Captions", action: () => setEditTab("captions") },
                              { id: "text",  icon: <Type size={8} className="text-blue-400" />,    label: "Text",       action: () => setEditTab("text") },
                              { id: "overl", icon: <Layers size={8} className="text-cyan-400" />,  label: "Overlay",    action: () => setEditTab("motion") },
                              { id: "trans", icon: <Scissors size={8} className="text-yellow-400" />, label: "Transitions", action: () => setEditTab("transitions") },
                              { id: "mtn",   icon: <Zap size={8} className="text-purple-400" />,   label: "Motion",     action: () => setEditTab("motion") },
                              { id: "lut",   icon: <Palette size={8} className="text-amber-400" />, label: "LUT/Filter", action: () => setEditTab("filters") },
                              { id: "map",   icon: <MapPin size={8} className="text-emerald-400" />, label: "Map",       action: () => setEditTab("motion") },
                            ].map(t => (
                              <button key={t.id}
                                onClick={() => { setVisibleTracks(v => { const n = new Set(v); n.add(t.id); return n; }); t.action(); setAddTrackMenuOpen(false); }}
                                className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-[9px] text-left transition-colors",
                                  visibleTracks.has(t.id) ? "text-zinc-500 cursor-default" : "text-zinc-300 hover:bg-zinc-800 hover:text-white")}>
                                {t.icon}
                                {t.label}
                                {visibleTracks.has(t.id) && <span className="ml-auto text-[7px] text-zinc-600">visible</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Track area ── */}
                    <div className="flex flex-1 min-h-0 overflow-hidden">

                      {/* Left: fixed track labels (scrollTop synced from right panel) */}
                      <div ref={tlLabelRef} className="flex-shrink-0 flex flex-col bg-zinc-900/70 border-r border-zinc-800/80 overflow-y-hidden" style={{ width: TL_LABEL_W }}>
                        <div className="border-b border-zinc-800/60 flex-shrink-0" style={{ height: TL_RULER_H }} />
                        <TLLabel h={TL_VIDEO_H}  icon={<Film size={9} className={mutedTracks.video ? "text-zinc-600" : "text-primary"} />} label="Video" muted={mutedTracks.video} onMuteToggle={() => setMutedTracks(v => ({ ...v, video: !v.video }))} />
                        {vt.has("music") && <TLLabel h={TL_AUDIO_H} icon={<Music size={9} className={mutedTracks.music ? "text-zinc-600" : "text-green-500"} />} label="Music" muted={mutedTracks.music} onMuteToggle={() => setMutedTracks(v => ({ ...v, music: !v.music }))} />}
                        {vt.has("sfx")   && <TLLabel h={TL_SFX_H}      icon={<Radio size={8} className="text-orange-400" />}       label="SFX"   onClick={() => setEditTab("sounds")} />}
                        {vt.has("voice") && <TLLabel h={TL_VOICE_H}     icon={<Mic size={8} className={mutedTracks.voice ? "text-zinc-600" : "text-red-400"} />} label="Voice" muted={mutedTracks.voice} onMuteToggle={() => setMutedTracks(v => ({ ...v, voice: !v.voice }))} onClick={() => setEditTab("music")} />}
                        {vt.has("capts") && <TLLabel h={TL_CAPTS_H}     icon={<MessageSquare size={8} className="text-cyan-400" />}  label="Capts" onClick={() => setEditTab("captions")} active={editTab === "captions"} />}
                        {vt.has("text")  && <TLLabel h={TL_TEXT_H}      icon={<Type size={8} className="text-blue-400" />}          label="Text"  onClick={() => setEditTab("text")} active={editTab === "text"} />}
                        {vt.has("overl") && <TLLabel h={TL_OVERL_H + 8} icon={<Layers size={8} className="text-cyan-400" />}        label="Overl" onClick={() => setEditTab("motion")} active={editTab === "motion"} />}
                        {vt.has("trans") && <TLLabel h={TL_TRANS_H}     icon={<Scissors size={8} className="text-yellow-400" />}    label="Trans" onClick={() => setEditTab("transitions")} active={editTab === "transitions"} />}
                        {vt.has("mtn")   && <TLLabel h={TL_EFFX_H}      icon={<Zap size={8} className="text-purple-400" />}         label="Mtn"   onClick={() => setEditTab("motion")} active={editTab === "motion" && (!!selectedMotionId || effectRegions.some(r => r.type === "motion" || r.type === "template"))} />}
                        {vt.has("lut")   && <TLLabel h={TL_LUT_H}       icon={<Palette size={8} className={filterPresetId && filterPresetId !== "normal" ? "text-amber-400" : "text-zinc-600"} />} label="LUT" onClick={() => setEditTab("filters")} active={editTab === "filters" || (!!filterPresetId && filterPresetId !== "normal")} />}
                        {vt.has("map")   && <TLLabel h={TL_MAP_H}       icon={<MapPin size={8} className="text-emerald-400" />}     label="Map"   onClick={() => setEditTab("motion")} active={editTab === "motion" && (selectedGraphicOverlay === "map-route" || selectedGraphicOverlay === "pin-drop")} />}
                      </div>

                      {/* Right: horizontally scrollable content */}
                      <div
                        ref={tlScrollRef}
                        className="flex-1 overflow-x-auto overflow-y-auto"
                        style={{ scrollbarWidth: "thin", scrollbarColor: "#27272a transparent" }}
                        onScroll={e => { if (tlLabelRef.current) tlLabelRef.current.scrollTop = (e.currentTarget as HTMLDivElement).scrollTop; }}>

                        {/* Content container — full timeline width */}
                        <div className="relative" style={{ width: tlContentW, minHeight: "100%" }}>

                          {/* ── Playhead line (spans all tracks) ── */}
                          <div
                            className="absolute top-0 bottom-0 z-40 pointer-events-none"
                            style={{ left: tlPlayheadX }}>
                            <div className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_10px_3px_rgba(255,255,255,0.35)]" />
                            {/* Draggable handle (mouse + touch) */}
                            <div
                              className="absolute top-0 -translate-x-[5px] w-[12px] h-[14px] cursor-col-resize pointer-events-auto z-50 flex justify-center touch-none"
                              onMouseDown={e => { e.preventDefault(); tlIsDraggingPlayheadRef.current = true; }}
                              onTouchStart={e => { e.preventDefault(); tlIsDraggingPlayheadRef.current = true; }}
                              title="Drag to scrub">
                              <div className="w-3 h-3 bg-white rounded-sm shadow-md" />
                            </div>
                          </div>

                          {/* ── Frame preview tooltip ── */}
                          {tlScrubTime !== null && (
                            <div
                              className="absolute z-50 pointer-events-none"
                              style={{ left: Math.max(0, tlScrubX - 26), top: TL_RULER_H + 2 }}>
                              <div className="bg-black border border-zinc-600 rounded shadow-2xl overflow-hidden" style={{ width: 52, height: 70 }}>
                                {tlScrubFrame ? (
                                  <img src={tlScrubFrame} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                    <Film size={14} className="text-zinc-600" />
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-0 bg-black/85 text-center text-[6px] font-mono text-white py-px">
                                  {formatTime(tlScrubTime)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── Time ruler ── */}
                          <div
                            className="relative bg-zinc-900/80 border-b border-zinc-800/70 cursor-crosshair touch-none"
                            style={{ height: TL_RULER_H }}
                            onMouseMove={e => {
                              if (!tlScrollRef.current) return;
                              const rect = tlScrollRef.current.getBoundingClientRect();
                              const x = e.clientX - rect.left + tlScrollRef.current.scrollLeft;
                              const t = x / pxPerSec;
                              if (t >= 0 && t <= tlTotalDuration + 1) { setTlScrubTime(t); setTlScrubX(x); }
                              if (tlIsDraggingPlayheadRef.current) rulerInteract(e.clientX);
                            }}
                            onMouseLeave={() => { if (!tlIsDraggingPlayheadRef.current) setTlScrubTime(null); }}
                            onMouseDown={e => rulerInteract(e.clientX)}
                            onTouchStart={e => { tlIsDraggingPlayheadRef.current = true; rulerInteract(e.touches[0].clientX); }}
                            onTouchMove={e => { if (tlIsDraggingPlayheadRef.current) rulerInteract(e.touches[0].clientX); }}
                            onTouchEnd={() => { tlIsDraggingPlayheadRef.current = false; setTlScrubTime(null); }}
                            data-testid="tl-ruler">
                            {/* Second ticks */}
                            {Array.from({ length: Math.ceil(tlTotalDuration) + 2 }, (_, i) => {
                              const x = i * pxPerSec;
                              if (x > tlContentW) return null;
                              const step = Math.max(1, Math.round(5 / Math.max(0.5, pxPerSec / 30)));
                              const isMain = i % step === 0;
                              return (
                                <div key={i} className="absolute bottom-0 flex flex-col-reverse items-start" style={{ left: x }}>
                                  <div className={`w-px ${isMain ? "h-[10px] bg-zinc-500" : "h-[5px] bg-zinc-700"}`} />
                                  {isMain && (
                                    <span className="text-[7px] text-zinc-500 font-mono whitespace-nowrap mb-[10px] ml-0.5">{i}s</span>
                                  )}
                                </div>
                              );
                            })}
                            {/* Half-second ticks when zoomed in */}
                            {pxPerSec >= 60 && Array.from({ length: Math.ceil(tlTotalDuration * 2) + 2 }, (_, i) => {
                              if (i % 2 === 0) return null;
                              const x = (i / 2) * pxPerSec;
                              if (x > tlContentW) return null;
                              return <div key={`h${i}`} className="absolute bottom-0 w-px h-[3px] bg-zinc-700" style={{ left: x }} />;
                            })}
                          </div>

                          {/* ── Video track ── */}
                          <div
                            className="relative border-b border-zinc-800/50 bg-zinc-950/80 touch-none"
                            style={{ height: TL_VIDEO_H }}
                            onMouseMove={e => {
                              if (tlDragClip) return;
                              if (!tlScrollRef.current) return;
                              const rect = tlScrollRef.current.getBoundingClientRect();
                              const x = e.clientX - rect.left + tlScrollRef.current.scrollLeft;
                              const t = x / pxPerSec;
                              if (t >= 0 && t <= tlTotalDuration + 1) { setTlScrubTime(t); setTlScrubX(x); }
                              if (tlIsDraggingPlayheadRef.current) rulerInteract(e.clientX);
                            }}
                            onMouseLeave={() => { if (!tlIsDraggingPlayheadRef.current) setTlScrubTime(null); }}
                            onMouseDown={e => { if (!tlDragClip) rulerInteract(e.clientX); }}
                            onTouchStart={e => { tlIsDraggingPlayheadRef.current = true; rulerInteract(e.touches[0].clientX); }}
                            onTouchMove={e => { if (tlIsDraggingPlayheadRef.current && !tlDragClip) rulerInteract(e.touches[0].clientX); }}
                            onTouchEnd={() => { tlIsDraggingPlayheadRef.current = false; setTlScrubTime(null); }}
                            data-testid="tl-video-track">
                            {/* Active filter / LUT indicator bar at top of video track */}
                            {filterPresetId && filterPresetId !== "normal" && (
                              <div
                                className="absolute top-0 inset-x-0 h-[3px] z-10 pointer-events-none"
                                style={{ background: "linear-gradient(90deg, #f59e0b, #d97706)" }}
                                title={`Filter: ${FILTER_PRESETS.find(f => f.id === filterPresetId)?.label ?? filterPresetId}`}
                              />
                            )}
                            {/* Active template indicator bar below filter bar */}
                            {selectedTemplateId && (
                              <div
                                className="absolute top-[3px] inset-x-0 h-[2px] z-10 pointer-events-none"
                                style={{ background: "linear-gradient(90deg, #7c3aed, #6d28d9)" }}
                                title={`Template: ${STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.label ?? selectedTemplateId}`}
                              />
                            )}
                            <input ref={addClipInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleAddClip} data-testid="input-add-clip" />
                            {clips.map((clip, idx) => {
                              const clipOffset = clips.slice(0, idx).reduce((s, c) => s + (c.trimEnd - c.trimStart) * pxPerSec, 0);
                              const clipW = Math.max(30, (clip.trimEnd - clip.trimStart) * pxPerSec);
                              const frameCount = Math.max(2, Math.floor(clipW / 44));
                              const isActive = idx === activeClipIdx;
                              const isDragging = tlDragClip?.idx === idx;
                              const isDropTarget = tlDropIdx === idx && tlDragClip && tlDragClip.idx !== idx;
                              return (
                                <div
                                  key={clip.id}
                                  className={`group absolute top-1.5 bottom-1.5 rounded overflow-hidden cursor-grab active:cursor-grabbing ${isActive ? "ring-2 ring-white shadow-[0_0_8px_rgba(255,255,255,0.3)]" : "ring-1 ring-zinc-600/50 opacity-80 hover:opacity-100 hover:ring-zinc-400"} ${isDragging ? "opacity-50 z-30" : ""} ${isDropTarget ? "ring-2 ring-yellow-400" : ""} transition-all`}
                                  style={{ left: clipOffset + 2, width: clipW - 4 }}
                                  onClick={e => { if (!tlDragClip) { setActiveClipIdx(idx); if (previewVideoRef.current) previewVideoRef.current.currentTime = clip.trimStart; } }}
                                  onMouseDown={e => {
                                    if ((e.target as HTMLElement).closest("[data-trim-handle]")) return;
                                    e.stopPropagation();
                                    setTlDragClip({ idx, startX: e.clientX });
                                  }}
                                  onTouchStart={e => {
                                    if ((e.target as HTMLElement).closest("[data-trim-handle]")) return;
                                    e.stopPropagation();
                                    setTlDragClip({ idx, startX: e.touches[0].clientX });
                                  }}
                                  onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: "clip", clipIdx: idx }); }}
                                  data-testid={`tl-clip-${idx}`}>
                                  {/* Real video frame thumbnail strip — per-clip cache */}
                                  <div className="absolute inset-0 flex bg-zinc-900">
                                    {(() => {
                                      const cachedFrames = clipFrameCache[clip.id] ?? [];
                                      const count = Math.max(2, Math.floor(clipW / 44));
                                      return Array.from({ length: count }).map((_, fi) => {
                                        const fIdx = cachedFrames.length > 0
                                          ? Math.max(0, Math.min(cachedFrames.length - 1, Math.round((fi / count) * (cachedFrames.length - 1))))
                                          : -1;
                                        return (
                                          <div key={fi} className="flex-1 overflow-hidden border-r border-black/20" style={{ minWidth: 0 }}>
                                            {fIdx >= 0 && cachedFrames[fIdx] ? (
                                              <img src={cachedFrames[fIdx]} className="w-full h-full object-cover" alt="" draggable={false} />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 animate-pulse">
                                                <Film size={7} className="text-zinc-700" />
                                              </div>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                  {/* Bottom overlay: name + duration */}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent flex items-end justify-between px-1 pb-0.5 pt-3 pointer-events-none">
                                    <span className="text-[6px] text-white/80 truncate">{clip.name.replace(/\.[^.]+$/, "")}</span>
                                    <span className="text-[5.5px] font-mono text-white/50 flex-shrink-0 ml-1">{formatTime(clip.trimEnd - clip.trimStart)}</span>
                                  </div>
                                  {/* Trim handle — left (IN point) */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center bg-gradient-to-r from-orange-400/40 to-transparent hover:from-orange-400/70 transition-colors group/trim"
                                    data-trim-handle="start"
                                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); pushUndo(); setDraggingTrimClip({ clipIdx: idx, handle: "start", startX: e.clientX, startVal: clip.trimStart }); }}
                                    onTouchStart={e => { e.stopPropagation(); pushUndo(); setDraggingTrimClip({ clipIdx: idx, handle: "start", startX: e.touches[0].clientX, startVal: clip.trimStart }); }}
                                    data-testid={`tl-trim-start-${idx}`}>
                                    <div className="w-[3px] h-8 bg-orange-400 rounded-full shadow-[0_0_4px_rgba(251,146,60,0.8)]" />
                                    <span className="absolute -top-4 left-0 text-[7px] font-mono bg-orange-500 text-white px-1 rounded opacity-0 group-hover/trim:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">{formatTime(clip.trimStart)}</span>
                                  </div>
                                  {/* Trim handle — right (OUT point) */}
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-20 flex items-center justify-center bg-gradient-to-l from-orange-400/40 to-transparent hover:from-orange-400/70 transition-colors group/trimr"
                                    data-trim-handle="end"
                                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); pushUndo(); setDraggingTrimClip({ clipIdx: idx, handle: "end", startX: e.clientX, startVal: clip.trimEnd }); }}
                                    onTouchStart={e => { e.stopPropagation(); pushUndo(); setDraggingTrimClip({ clipIdx: idx, handle: "end", startX: e.touches[0].clientX, startVal: clip.trimEnd }); }}
                                    data-testid={`tl-trim-end-${idx}`}>
                                    <div className="w-[3px] h-8 bg-orange-400 rounded-full shadow-[0_0_4px_rgba(251,146,60,0.8)]" />
                                    <span className="absolute -top-4 right-0 text-[7px] font-mono bg-orange-500 text-white px-1 rounded opacity-0 group-hover/trimr:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">{formatTime(clip.trimEnd)}</span>
                                  </div>
                                  {/* Trim tooltip while dragging */}
                                  {trimTooltip && draggingTrimClip?.clipIdx === idx && (
                                    <div className={`absolute -top-7 ${trimTooltip.side === "start" ? "left-0" : "right-0"} bg-orange-500 text-white text-[8px] font-mono px-1.5 py-0.5 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap`}>
                                      {trimTooltip.side === "start" ? "IN " : "OUT "}{formatTime(trimTooltip.time)}
                                    </div>
                                  )}
                                  {/* Split cursor overlay — when in split mode, show scissors at hover position */}
                                  {activeToolMode === "split" && isActive && (
                                    <div
                                      className="absolute inset-0 z-25 cursor-none"
                                      onClick={e => { e.stopPropagation(); handleSplitClip(); }}
                                      title="Click to split here">
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-yellow-300 text-xs font-bold bg-black/60 px-2 py-0.5 rounded">✂ Click to split</span>
                                      </div>
                                    </div>
                                  )}
                                  {/* Delete button — always visible on active, hover on others */}
                                  {clips.length > 1 && (
                                    <button
                                      className="absolute top-1 right-4 w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center z-30 transition-all opacity-0 group-hover:opacity-100"
                                      onClick={e => { e.stopPropagation(); handleDeleteClip(idx); }}
                                      data-testid={`tl-clip-del-${idx}`}>
                                      <X size={7} className="text-white" />
                                    </button>
                                  )}
                                  {/* Drag indicator */}
                                  {isDragging && (
                                    <div className="absolute inset-0 bg-white/10 flex items-center justify-center pointer-events-none">
                                      <span className="text-[8px] text-white font-bold bg-black/60 px-1.5 py-0.5 rounded">Dragging…</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {/* Add clip button */}
                            <button
                              onClick={() => addClipInputRef.current?.click()}
                              className="absolute top-2 bottom-2 flex items-center justify-center text-zinc-700 hover:text-zinc-400 border border-dashed border-zinc-800 hover:border-zinc-500 rounded transition-all"
                              style={{ left: clips.reduce((s, c) => s + (c.trimEnd - c.trimStart) * pxPerSec, 0) + 6, width: 32 }}
                              data-testid="tl-add-clip">
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* ── Music track (only shown when visible) ── */}
                          {vt.has("music") && <div className="relative border-b border-zinc-800/50 bg-black/40" style={{ height: TL_AUDIO_H }}
                            onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: "audio" }); }}>
                            {selectedTrack ? (
                              <div
                                className="absolute inset-x-1 inset-y-1.5 rounded overflow-hidden flex items-center gap-1.5 px-2 cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ background: mutedTracks.music ? "rgba(39,39,42,0.6)" : "linear-gradient(90deg,rgba(34,197,94,0.18),rgba(34,197,94,0.07))", border: mutedTracks.music ? "1px solid rgba(113,113,122,0.3)" : "1px solid rgba(34,197,94,0.28)" }}
                                onClick={() => setEditTab("audio")}>
                              {mutedTracks.music && <div className="absolute inset-0 bg-zinc-900/60 flex items-center justify-center pointer-events-none z-10"><VolumeX size={10} className="text-red-400" /></div>}
                                <Music size={8} className="text-green-400 flex-shrink-0" />
                                {/* Mini waveform bars */}
                                <div className="flex items-end gap-px flex-1 overflow-hidden" style={{ height: 14 }}>
                                  {Array.from({ length: 60 }).map((_, i) => (
                                    <div key={i} className="flex-1 bg-green-400/45 rounded-sm" style={{ height: `${(Math.sin(i * 0.55 + 1.2) * 0.38 + 0.62) * 100}%`, minHeight: 1 }} />
                                  ))}
                                </div>
                                <span className="text-[6.5px] text-green-400/60 truncate flex-shrink-0 max-w-[56px]">
                                  {customAudioFile?.name || MUSIC_TRACKS.find(t => t.id === selectedTrack)?.label || "Audio"}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditTab("audio")}
                                className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7.5px] text-zinc-700 hover:text-green-400 transition-colors border border-dashed border-zinc-800 hover:border-green-900/50 rounded px-2"
                                data-testid="tl-add-audio">
                                <Plus size={8} /> Add music
                              </button>
                            )}
                          </div>}

                          {/* ── SFX track ── */}
                          {vt.has("sfx") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_SFX_H }}>
                              {selectedSoundFx ? (
                                <div className="absolute inset-x-1 inset-y-1 rounded bg-orange-500/12 border border-orange-500/22 flex items-center gap-1 px-1.5 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setEditTab("sounds")} style={{ background: "rgba(249,115,22,0.1)" }}>
                                  <Radio size={7} className="text-orange-400 flex-shrink-0" />
                                  <span className="text-[6.5px] text-orange-400/80 truncate">{SOUND_LIBRARY.find(s => s.id === selectedSoundFx)?.label || selectedSoundFx}</span>
                                </div>
                              ) : (
                                <button onClick={() => setEditTab("sounds")} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-orange-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add SFX
                                </button>
                              )}
                          </div>}
                          {/* ── Voice track ── */}
                          {vt.has("voice") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_VOICE_H }}>
                              {voiceOverUrl ? (
                                <div className="absolute inset-x-1 inset-y-1 rounded flex items-center gap-1.5 px-1.5 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }} onClick={startVoiceOver}>
                                  <Mic size={7} className="text-red-400 flex-shrink-0" />
                                  <div className="flex items-end gap-px flex-1 overflow-hidden" style={{ height: 10 }}>
                                    {Array.from({ length: 32 }).map((_, i) => (
                                      <div key={i} className="flex-1 bg-red-400/60 rounded-sm" style={{ height: `${(Math.sin(i * 0.9 + 0.5) * 0.4 + 0.6) * 100}%` }} />
                                    ))}
                                  </div>
                                  <span className="text-[6px] text-red-300/70 flex-shrink-0">VO</span>
                                </div>
                              ) : voiceRecording ? (
                                <button onClick={startVoiceOver} className="absolute inset-x-1 inset-y-1 flex items-center gap-1.5 text-[7px] text-red-400 border border-red-500/50 bg-red-500/10 rounded px-2 animate-pulse">
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording… tap to stop
                                </button>
                              ) : (
                                <button onClick={startVoiceOver} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-red-400 transition-colors border border-dashed border-zinc-800 hover:border-red-900/40 rounded px-2" data-testid="button-record-voice">
                                  <Mic size={7} /> Record voice-over
                                </button>
                              )}
                          </div>}

                          {/* ── Captions track ── */}
                          {vt.has("capts") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_CAPTS_H }}>
                              {captionLayers.length > 0 && tlTotalDuration > 0 ? (
                                captionLayers.map(cap => {
                                  const cx = (cap.startTime / tlTotalDuration) * (tlTotalDuration * pxPerSec);
                                  const cw = Math.max(20, ((cap.endTime - cap.startTime) / tlTotalDuration) * (tlTotalDuration * pxPerSec));
                                  return (
                                    <div key={cap.id}
                                      className={`absolute top-1.5 bottom-1.5 rounded px-1 flex items-center overflow-hidden cursor-pointer transition-all ${selectedCaptionId === cap.id ? "bg-cyan-500/40 border border-cyan-400/60" : "bg-cyan-800/25 border border-cyan-800/40 hover:bg-cyan-700/30"}`}
                                      style={{ left: cx + 2, width: cw - 4 }}
                                      onClick={() => { setSelectedCaptionId(cap.id); setEditTab("captions"); }}>
                                      <span className="text-[6px] text-cyan-300/80 truncate">{cap.text}</span>
                                    </div>
                                  );
                                })
                              ) : (
                                <button onClick={() => setEditTab("captions")} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-cyan-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add captions — open Captions tab →
                                </button>
                              )}
                          </div>}

                          {/* ── Text track ── */}
                          {vt.has("text") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_TEXT_H }}>
                              {textLayers.length > 0 && tlTotalDuration > 0 ? (
                                textLayers.map(l => {
                                  const st = l.startTime ?? 0;
                                  const et = l.endTime ?? Math.min(tlTotalDuration, st + 5);
                                  const bx = st * pxPerSec;
                                  const bw = Math.max(28, (et - st) * pxPerSec);
                                  const isDraggingThis = draggingTextBlock?.id === l.id;
                                  const isSelected = selectedTextLayerId === l.id;
                                  return (
                                    <div key={l.id}
                                      className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden group/txt select-none cursor-pointer ${isDraggingThis ? "opacity-70" : ""} ${isSelected ? "ring-1 ring-blue-400/80" : ""}`}
                                      style={{ left: bx + 1, width: bw - 2, backgroundColor: "#2563eb25", border: "1px solid #3b82f660" }}
                                      onClick={() => { setSelectedTextLayerId(l.id); setEditTab("text"); }}>
                                      {/* Left resize handle */}
                                      <div className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "start", startX: e.clientX, startStart: st, startEnd: et }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "start", startX: e.touches[0].clientX, startStart: st, startEnd: et }); }}>
                                        <div className="w-px h-3 bg-blue-400/60" />
                                      </div>
                                      {/* Body — drag to move */}
                                      <div className="flex-1 flex items-center justify-center cursor-move px-1.5 overflow-hidden"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "move", startX: e.clientX, startStart: st, startEnd: et }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "move", startX: e.touches[0].clientX, startStart: st, startEnd: et }); }}>
                                        <span className="text-[6px] text-blue-300 font-medium truncate">{l.text}</span>
                                        <span className="text-[5px] font-mono text-blue-400/50 ml-1 flex-shrink-0">{formatTime(st)}–{formatTime(et)}</span>
                                      </div>
                                      {/* Right resize handle */}
                                      <div className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "end", startX: e.clientX, startStart: st, startEnd: et }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingTextBlock({ id: l.id, handle: "end", startX: e.touches[0].clientX, startStart: st, startEnd: et }); }}>
                                        <div className="w-px h-3 bg-blue-400/60" />
                                      </div>
                                      {/* Delete on hover */}
                                      <button className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/70 text-white text-[6px] flex items-center justify-center rounded-bl opacity-0 group-hover/txt:opacity-100 transition-opacity z-20 hover:bg-red-600"
                                        onClick={e => { e.stopPropagation(); pushUndo(); setTextLayers(prev => prev.filter(x => x.id !== l.id)); if (selectedTextLayerId === l.id) setSelectedTextLayerId(null); }}>
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                <button onClick={() => setEditTab("text")} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-blue-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add text — open Text tab →
                                </button>
                              )}
                          </div>}

                          {/* ── Overlays track ── */}
                          {vt.has("overl") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_OVERL_H + 8 }}>
                              {(() => { const MAP_OVLS = ["map-route","pin-drop"]; const ovls = effectRegions.filter(r => r.type === "overlay" && !MAP_OVLS.includes(r.effectId)); return ovls.length > 0 && tlTotalDuration > 0 ? (
                                ovls.map(r => {
                                  const rx = r.startTime * pxPerSec;
                                  const rw = Math.max(24, (r.endTime - r.startTime) * pxPerSec);
                                  const isDraggingThis = draggingEffectRegion?.id === r.id;
                                  const isSelected = selectedRegionId === r.id;
                                  return (
                                    <div key={r.id}
                                      className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden group/ovl select-none cursor-pointer ${isDraggingThis ? "opacity-70" : ""} ${isSelected ? "ring-1 ring-white/60" : ""}`}
                                      style={{ left: rx + 1, width: rw - 2, backgroundColor: r.color + "30", border: `1px solid ${r.color}70` }}
                                      onClick={() => { setSelectedRegionId(r.id); setSelectedGraphicOverlay(r.effectId); setEditTab("motion"); }}>
                                      {/* Left resize handle */}
                                      <div className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "start", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "start", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <div className="w-px h-4" style={{ backgroundColor: r.color }} />
                                      </div>
                                      {/* Body — drag to move */}
                                      <div className="flex-1 flex items-center justify-center cursor-move px-1 overflow-hidden"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "move", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "move", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <span className="text-[6px] text-white font-bold truncate">{r.emoji} {r.label}</span>
                                        <span className="text-[5px] font-mono text-white/50 ml-1 flex-shrink-0">{formatTime(r.startTime)}–{formatTime(r.endTime)}</span>
                                      </div>
                                      {/* Right resize handle */}
                                      <div className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "end", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "end", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <div className="w-px h-4" style={{ backgroundColor: r.color }} />
                                      </div>
                                      {/* Delete on hover */}
                                      <button className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/70 text-white text-[6px] flex items-center justify-center rounded-bl opacity-0 group-hover/ovl:opacity-100 transition-opacity z-20 hover:bg-red-600"
                                        onClick={e => { e.stopPropagation(); setEffectRegions(prev => prev.filter(x => x.id !== r.id)); if (selectedRegionId === r.id) setSelectedRegionId(null); }}>
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                <button onClick={() => setEditTab("motion")} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-cyan-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add overlay — open Motion tab →
                                </button>
                              ); })()}
                          </div>}

                          {/* ── Transitions track ── */}
                          {vt.has("trans") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_TRANS_H }}>
                              {clips.map((_, idx) => {
                                if (idx === 0) return null;
                                const cx = clips.slice(0, idx).reduce((s, c) => s + (c.trimEnd - c.trimStart) * pxPerSec, 0);
                                const trans = selectedTransition ? TRANSITIONS.find(t => t.id === selectedTransition) : null;
                                return (
                                  <div key={`trans-${idx}`}
                                    className="absolute top-0.5 bottom-0.5 -translate-x-1/2 w-8 rounded flex items-center justify-center cursor-pointer bg-yellow-500/15 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors"
                                    style={{ left: cx }}
                                    onClick={() => setEditTab("transitions")}>
                                    <span className="text-[8px]">{trans?.emoji || "✂️"}</span>
                                  </div>
                                );
                              })}
                              {clips.length <= 1 && (
                                <button onClick={() => setEditTab("transitions")} className="absolute inset-x-1 inset-y-0.5 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-yellow-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add transitions →
                                </button>
                              )}
                          </div>}

                          {/* ── Effects / Motion track ── */}
                          {vt.has("mtn") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_EFFX_H }}>
                              {effectRegions.filter(r => r.type === "motion" || r.type === "template").length > 0 && tlTotalDuration > 0 ? (
                                effectRegions.filter(r => r.type === "motion" || r.type === "template").map(r => {
                                  const rx = r.startTime * pxPerSec;
                                  const rw = Math.max(24, (r.endTime - r.startTime) * pxPerSec);
                                  const isDraggingThis = draggingEffectRegion?.id === r.id;
                                  return (
                                    <div key={r.id}
                                      className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden group/er select-none ${isDraggingThis ? "opacity-70" : ""}`}
                                      style={{ left: rx + 1, width: rw - 2, backgroundColor: r.color + "28", border: `1px solid ${r.color}60` }}>
                                      {/* Left resize handle */}
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "start", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "start", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <div className="w-px h-4" style={{ backgroundColor: r.color }} />
                                      </div>
                                      {/* Body — drag to move */}
                                      <div
                                        className="flex-1 flex items-center justify-center cursor-move px-1 overflow-hidden"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "move", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "move", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <span className="text-[6px] text-white font-bold truncate">{r.emoji} {r.label}</span>
                                        <span className="text-[5px] font-mono text-white/50 ml-1 flex-shrink-0">{formatTime(r.startTime)}–{formatTime(r.endTime)}</span>
                                      </div>
                                      {/* Right resize handle */}
                                      <div
                                        className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center z-10 hover:bg-white/10"
                                        onMouseDown={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "end", startX: e.clientX, startStart: r.startTime, startEnd: r.endTime }); }}
                                        onTouchStart={e => { e.stopPropagation(); setDraggingEffectRegion({ id: r.id, handle: "end", startX: e.touches[0].clientX, startStart: r.startTime, startEnd: r.endTime }); }}>
                                        <div className="w-px h-4" style={{ backgroundColor: r.color }} />
                                      </div>
                                      {/* Delete on hover */}
                                      <button
                                        className="absolute top-0 right-0 w-3.5 h-3.5 bg-black/70 text-white text-[6px] flex items-center justify-center rounded-bl opacity-0 group-hover/er:opacity-100 transition-opacity z-20 hover:bg-red-600"
                                        onClick={e => { e.stopPropagation(); setEffectRegions(prev => prev.filter(x => x.id !== r.id)); }}>
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })
                              ) : (
                                <button onClick={() => setEditTab("motion")} className="absolute inset-x-1 inset-y-1 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-purple-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add motion / template →
                                </button>
                              )}
                          </div>}

                          {/* ── LUT / Filter track ── */}
                          {vt.has("lut") && <div className="relative border-b border-zinc-800/40 bg-black/30" style={{ height: TL_LUT_H }}>
                              {filterPresetId && filterPresetId !== "normal" ? (
                                <div className="absolute inset-x-1 inset-y-0.5 rounded flex items-center gap-1 px-1.5 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }} onClick={() => setEditTab("filters")}>
                                  <Palette size={7} className="text-amber-400 flex-shrink-0" />
                                  <span className="text-[6.5px] text-amber-400/80 truncate">{FILTER_PRESETS.find(f => f.id === filterPresetId)?.label || filterPresetId}</span>
                                </div>
                              ) : (
                                <button onClick={() => setEditTab("filters")} className="absolute inset-x-1 inset-y-0.5 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-amber-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Apply filter / LUT →
                                </button>
                              )}
                          </div>}

                          {/* ── Map animation track ── */}
                          {vt.has("map") && <div className="relative border-b border-zinc-800/30 bg-black/30" style={{ height: TL_MAP_H }}>
                              {(selectedGraphicOverlay === "map-route" || selectedGraphicOverlay === "pin-drop") ? (
                                <div className="absolute inset-x-1 inset-y-0.5 rounded flex items-center gap-1 px-1.5 cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }} onClick={() => setEditTab("motion")}>
                                  <MapPin size={7} className="text-emerald-400 flex-shrink-0" />
                                  <span className="text-[6.5px] text-emerald-400/80 truncate">{selectedGraphicOverlay.replace(/-/g, " ")}</span>
                                </div>
                              ) : (
                                <button onClick={() => setEditTab("motion")} className="absolute inset-x-1 inset-y-0.5 flex items-center gap-1 text-[7px] text-zinc-700 hover:text-emerald-400 transition-colors border border-dashed border-zinc-800 hover:border-zinc-700 rounded px-2">
                                  <Plus size={7} /> Add map overlay →
                                </button>
                              )}
                          </div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              </div>

              {/* ── RIGHT: AI Creative Director & Operator ── */}
              <div className={cn("hidden xl:flex flex-col border-l border-zinc-800 bg-zinc-950 transition-all duration-300 flex-shrink-0", aiPanelOpen ? "w-80" : "w-10")}>
                <button onClick={() => setAiPanelOpen(o => !o)} className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 hover:bg-zinc-900 transition-colors w-full text-left" data-testid="button-toggle-ai-panel">
                  {aiPanelOpen ? (
                    <><div className="flex items-center gap-2"><Crown size={13} className="text-yellow-400" /><span className="text-xs font-bold text-white">AI Creative Operator</span><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /></div><ChevronDown size={13} className="text-zinc-500 -rotate-90" /></>
                  ) : <Bot size={15} className="text-primary mx-auto" />}
                </button>
                {aiPanelOpen && (
                  <div className="flex-1 flex flex-col overflow-hidden">

                    {/* ── Mode toggle + Editor Commands ── */}
                    <div className="p-2 border-b border-zinc-800 space-y-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAiEditorMode(false)}
                          className={cn("flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all",
                            !aiEditorMode ? "bg-yellow-500/20 border-yellow-500 text-yellow-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                          data-testid="button-ai-mode-chat">
                          💬 Chat
                        </button>
                        <button onClick={() => setAiEditorMode(true)}
                          className={cn("flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all",
                            aiEditorMode ? "bg-purple-500/20 border-purple-500 text-purple-400" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                          data-testid="button-ai-mode-editor">
                          🎬 Editor
                        </button>
                        <button onClick={startVoiceInput}
                          className={cn("w-8 h-7 rounded-lg border transition-all flex items-center justify-center",
                            voiceActive ? "bg-red-500 border-red-400 text-white animate-pulse" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500")}
                          title={voiceActive ? "Stop listening" : "Voice input"}
                          data-testid="button-voice-input">
                          <Mic size={12} />
                        </button>
                      </div>
                      {aiEditorMode && (
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                          <p className="text-purple-300 text-[9px] font-semibold mb-1">Editor Mode — Claude controls the studio</p>
                          <p className="text-zinc-500 text-[9px]">Say: "neon map Amsterdam → Paris", "add bold text", "bass boost", "export for Instagram"</p>
                        </div>
                      )}
                      <div className="flex gap-1 flex-wrap">
                        {(aiEditorMode ? ADMIN_AI_EDITOR_COMMANDS : ADMIN_AI_QUICK_ACTIONS).map(action => (
                          <button key={action.label} onClick={() => handleAiAssist(action.prompt)} disabled={aiAssistLoading}
                            className={cn("text-[9px] px-2 py-1 rounded-lg transition-colors disabled:opacity-50",
                              aiEditorMode ? "bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-800/50" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")}
                            data-testid={`button-ai-quick-${action.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}>
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Action log (editor mode) ── */}
                    {aiEditorMode && aiActionLog.length > 0 && (
                      <div className="px-2 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">Applied changes</span>
                          <button onClick={() => setAiActionLog([])} className="text-zinc-600 hover:text-zinc-400 text-[9px]">clear</button>
                        </div>
                        <div className="space-y-0.5 max-h-20 overflow-y-auto">
                          {aiActionLog.slice(0, 8).map((entry, i) => (
                            <div key={i} className="text-[9px] text-zinc-400 flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                              {entry}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Chat messages ── */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {aiMessages.map((msg, i) => (
                        <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
                          {msg.role === "assistant" && (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500/20 to-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Crown size={11} className="text-yellow-400" />
                            </div>
                          )}
                          <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line",
                            msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-200 rounded-tl-sm")}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {aiAssistLoading && (
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <Crown size={11} className="text-yellow-400 animate-pulse" />
                          </div>
                          <div className="bg-zinc-800 rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                            <span className="text-zinc-500 text-[10px]">{aiEditorMode ? "Claude is editing…" : "Thinking…"}</span>
                            {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                          </div>
                        </div>
                      )}
                      <div ref={aiChatEndRef} />
                    </div>

                    {/* ── Input ── */}
                    <div className="p-2 border-t border-zinc-800">
                      {voiceActive && (
                        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <Mic size={11} className="text-red-400 animate-pulse" />
                          <span className="text-red-300 text-[10px] font-semibold">Listening… speak your command</span>
                          <button onClick={startVoiceInput} className="ml-auto text-red-400 hover:text-red-300 text-[9px]">stop</button>
                        </div>
                      )}
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={aiInput}
                          onChange={e => setAiInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiAssist(aiInput); } }}
                          placeholder={aiEditorMode ? "Tell Claude what to build… (e.g. neon Amsterdam → Paris map)" : "Ask your AI director…"}
                          rows={2}
                          className={cn("flex-1 bg-zinc-800 border rounded-lg px-2.5 py-2 text-white text-xs placeholder:text-zinc-500 outline-none resize-none transition-colors",
                            aiEditorMode ? "border-purple-700 focus:border-purple-500" : "border-zinc-700 focus:border-yellow-400")}
                          data-testid="input-ai-assistant"
                        />
                        <div className="flex flex-col gap-1">
                          <button onClick={() => handleAiAssist(aiInput)} disabled={!aiInput.trim() || aiAssistLoading}
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 flex-shrink-0",
                              aiEditorMode ? "bg-gradient-to-br from-purple-600 to-primary" : "bg-gradient-to-br from-yellow-500 to-primary")}
                            data-testid="button-ai-send">
                            <Send size={13} />
                          </button>
                          <button onClick={startVoiceInput}
                            className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border transition-all",
                              voiceActive ? "bg-red-500 border-red-400 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
                            data-testid="button-voice-send">
                            <Mic size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── More Tools Panel ── */}
            {showMorePanel && (
              <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950 max-h-[38vh] sm:max-h-[45vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                  <p className="text-white text-xs font-bold">More Tools</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-yellow-400 flex items-center gap-1"><Crown size={9} className="text-yellow-400" /> Admin tools marked with dot</span>
                    <button onClick={() => setShowMorePanel(false)} className="text-zinc-500 hover:text-white transition-colors" data-testid="button-more-close"><X size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-13 p-2 gap-0.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
                  {[
                    { id: "templates",   Icon: Clapperboard,  label: "Templates",   color: "text-primary"    },
                    { id: "motion",      Icon: Layers3,       label: "Motion",      color: "text-purple-400" },
                    { id: "transitions", Icon: Shuffle,       label: "Transitions", color: "text-blue-400"   },
                    { id: "stickers",    Icon: Smile,         label: "Stickers",    color: "text-yellow-400" },
                    { id: "sounds",      Icon: Music2,        label: "Sounds",      color: "text-green-400"  },
                    { id: "brand",       Icon: Paintbrush,    label: "Brand",       color: "text-pink-400"   },
                    { id: "export",      Icon: Share2,        label: "Export",      color: "text-blue-400"   },
                    { id: "viral",       Icon: TrendingUp,    label: "Viral",       color: "text-orange-400" },
                    { id: "aitools",     Icon: Sparkles,      label: "AI Tools",    color: "text-purple-400" },
                    { id: "schedule",    Icon: Calendar,      label: "Schedule",    color: "text-blue-400",   adminOnly: true },
                    { id: "analytics",   Icon: BarChart3,     label: "Analytics",   color: "text-purple-400", adminOnly: true },
                    { id: "library",     Icon: Archive,       label: "Library",     color: "text-orange-400", adminOnly: true },
                    { id: "batch",       Icon: ListChecks,    label: "Batch",       color: "text-green-400",  adminOnly: true },
                  ].map(({ id, Icon, label, color, adminOnly }) => {
                    const isActive = editTab === id;
                    return (
                      <button key={id} onClick={() => { setEditTab(id as EditTab); setShowMorePanel(false); }}
                        className={cn("flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl hover:bg-zinc-800 transition-all relative",
                          isActive && "bg-zinc-800")}
                        data-testid={`more-btn-${id}`}>
                        {adminOnly && <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                        <Icon size={16} className={isActive ? color : "text-zinc-400"} />
                        <span className={cn("text-[8px] font-medium text-center leading-tight mt-0.5", isActive ? color : "text-zinc-500")}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── CapCut-style Bottom Toolbar ── */}
            <div className="flex-shrink-0 bg-zinc-950 border-t border-zinc-800">
              {/* Video sync progress bar — clicking seeks the video */}
              <div className="relative h-3 bg-zinc-800 cursor-pointer group touch-manipulation"
                onClick={e => {
                  if (!previewVideoRef.current || !videoDuration) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  previewVideoRef.current.currentTime = pct * videoDuration;
                }}
                title="Seek video" data-testid="global-progress-bar">
                <div className="absolute inset-y-0 left-0 bg-primary/80 transition-none group-hover:bg-primary rounded-r-full"
                  style={{ width: videoDuration > 0 ? `${(clipCurrentTime / videoDuration) * 100}%` : "0%" }} />
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md shadow-primary/60 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 border-2 border-white"
                  style={{ left: videoDuration > 0 ? `${(clipCurrentTime / videoDuration) * 100}%` : "0%" }} />
                {videoDuration > 0 && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-zinc-400 font-mono bg-zinc-900/90 px-1 rounded">
                      {formatTime(clipCurrentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>
                )}
              </div>
              {/* CapCut order: Edit | Audio | Text | Effects | Overlay | Captions | Filter | More */}
              <div className="flex items-center gap-0 px-0.5 py-1">
                {[
                  { id: "trim",        Icon: Scissors,          label: "Edit",     color: "text-white"      },
                  { id: "audio",       Icon: Music,             label: "Audio",    color: "text-green-400"  },
                  { id: "text",        Icon: Type,              label: "Text",     color: "text-blue-400"   },
                  { id: "motion",      Icon: Sparkles,          label: "Effects",  color: "text-yellow-400" },
                  { id: "stickers",    Icon: Layers,            label: "Overlay",  color: "text-pink-400"   },
                  { id: "captions",    Icon: MessageSquare,     label: "Captions", color: "text-cyan-400"   },
                  { id: "filters",     Icon: SlidersHorizontal, label: "Filter",   color: "text-purple-400" },
                ].map(({ id, Icon, label, color }, idx) => {
                  const isActive = editTab === id && !showMorePanel;
                  return (
                    <button key={`${id}-${idx}`} onClick={() => { setEditTab(id as EditTab); setShowMorePanel(false); }}
                      className={cn("flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all flex-1 touch-manipulation active:scale-95",
                        isActive ? "bg-zinc-800" : "hover:bg-zinc-900/50")}
                      data-testid={`toolbar-btn-${label.toLowerCase()}`}>
                      <Icon size={17} className={isActive ? color : "text-zinc-400"} />
                      <span className={cn("text-[8px] font-medium whitespace-nowrap", isActive ? color : "text-zinc-500")}>{label}</span>
                    </button>
                  );
                })}
                <button onClick={() => setShowMorePanel(v => !v)}
                  className={cn("flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all flex-shrink-0 w-9 touch-manipulation active:scale-95",
                    showMorePanel ? "bg-zinc-800" : "hover:bg-zinc-900/50")}
                  data-testid="toolbar-btn-more">
                  <div className="flex gap-0.5 items-center justify-center" style={{ height: 17 }}>
                    {[0,1,2].map(i => <div key={i} className={cn("w-1 h-1 rounded-full", showMorePanel ? "bg-white" : "bg-zinc-500")} />)}
                  </div>
                  <span className={cn("text-[8px] font-medium", showMorePanel ? "text-white" : "text-zinc-500")}>More</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CAPTION ── */}
        {step === "caption" && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-lg mx-auto space-y-5">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2"><Wand2 size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">AI Caption Generator</h3><span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full ml-auto">UNLOCKED</span></div>
                  <input type="text" placeholder="Hint: 'breakdance battle rooftop Amsterdam'…" value={aiHint} onChange={e => setAiHint(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary" data-testid="input-ai-hint" />
                  <Button onClick={handleAiCaption} disabled={aiLoading} className="w-full bg-gradient-to-r from-primary to-purple-500 text-white font-medium" size="sm" data-testid="button-ai-caption">{aiLoading ? <><Sparkles size={13} className="mr-2 animate-spin" /> Generating…</> : <><Sparkles size={13} className="mr-2" /> Generate Caption & Hashtags</>}</Button>
                </div>

                {selectedPlatform && (() => {
                  const profile = PLATFORM_PROFILES.find(p => p.id === selectedPlatform);
                  if (!profile) return null;
                  return (
                    <div className={cn("p-3 rounded-xl border bg-gradient-to-r border-zinc-700", profile.bgClass)}>
                      <div className="flex items-center gap-2 mb-2"><span className="text-lg">{profile.emoji}</span><p className="text-white text-sm font-bold">{profile.label} Tips</p></div>
                      {profile.tips.map((tip, i) => <div key={i} className="flex items-start gap-1.5 mb-1"><Star size={9} className="text-yellow-400 mt-0.5" /><p className="text-zinc-300 text-xs">{tip}</p></div>)}
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center gap-2 mb-2"><Type size={14} className="text-primary" /><h3 className="text-white font-bold text-sm">Caption</h3></div>
                  <Textarea placeholder="Write a caption… #hiphop #breaking #streetculture" value={caption} onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))} className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-28 text-base" data-testid="input-reel-caption" />
                  <div className="flex justify-between mt-1.5">
                    <div className="text-sm text-zinc-300 flex-1">{caption && <span>{highlightHashtags(caption)}</span>}</div>
                    <span className={cn("text-xs font-medium ml-2", caption.length > MAX_CAPTION * 0.9 ? "text-red-400" : "text-zinc-500")}>{caption.length}/{MAX_CAPTION}</span>
                  </div>
                </div>

                {previewUrl && (
                  <div className="flex items-center gap-4 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="w-14 h-20 rounded-lg overflow-hidden bg-black flex-shrink-0">
                      {coverDataUrl ? <img src={coverDataUrl} alt="" className="w-full h-full object-cover" /> : <video src={previewUrl} className="w-full h-full object-cover" muted playsInline />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{file?.name}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{formatTime(trimEnd - trimStart)} · {file ? formatSize(file.size) : ""}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filterPresetId !== "normal" && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{FILTER_PRESETS.find(p => p.id === filterPresetId)?.label}</span>}
                        {selectedTemplateId && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.emoji} {STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.label}</span>}
                        {selectedPlatform && <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">{PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.emoji} {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.label}</span>}
                        {speed !== 1 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{SPEED_LABELS[speed]}</span>}
                        {textLayers.length > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">{textLayers.length} text layers</span>}
                        {viralScore !== null && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">📊 Score: {viralScore}</span>}
                        {scheduleEnabled && scheduleDate && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">📅 {scheduleDate} {scheduleTime}</span>}
                        {lowerThirdEnabled && lowerThirdText && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">Lower third</span>}
                        {progressBarEnabled && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full">Progress bar</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Caption library quick-load */}
            <div className="lg:w-72 border-t lg:border-t-0 lg:border-l border-zinc-800 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3"><Archive size={13} className="text-orange-400" /><p className="text-white text-sm font-bold">Caption Library</p></div>
              <div className="space-y-2">
                {savedCaptions.map(cap => (
                  <div key={cap.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-400/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white text-xs font-bold">{cap.title}</p>
                      <button onClick={() => loadCaption(cap)} className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full hover:bg-orange-500/30 transition-colors flex-shrink-0" data-testid={`button-load-caption-side-${cap.id}`}>Load</button>
                    </div>
                    <p className="text-zinc-500 text-[10px] line-clamp-2">{cap.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {step === "uploading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 px-6 max-w-sm">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="48" fill="none" stroke="#27272a" strokeWidth="8" />
                  <circle cx="56" cy="56" r="48" fill="none" stroke={isCompressing ? "hsl(38 92% 50%)" : "hsl(var(--primary))"} strokeWidth="8" strokeDasharray={`${2 * Math.PI * 48}`} strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`} strokeLinecap="round" className="transition-all duration-300" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {isCompressing ? <Zap size={28} className="text-amber-400 animate-pulse" /> : <span className="text-white font-bold text-xl">{progress}%</span>}
                </div>
              </div>
              <div className="text-center space-y-1">
                {isCompressing ? <><p className="text-white font-bold text-lg">Compressing video…</p><p className="text-amber-400/70 text-sm">Optimizing quality</p></> : <><p className="text-white font-bold text-lg">Uploading reel</p>{uploadSpeed > 0 && <p className="text-zinc-400 text-sm">{uploadSpeed} MB/s · ~{estimatedTime}s remaining</p>}</>}
                <div className="w-48 bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: isCompressing ? "hsl(38 92% 50%)" : "hsl(var(--primary))" }} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Crown size={12} className="text-yellow-400" /><span>Admin upload · Full HD quality</span></div>
            </div>
          </div>
        )}

        {/* ── HELP OVERLAY ── */}
        {showHelpOverlay && (
          <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowHelpOverlay(false); }}
            data-testid="help-overlay">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-white text-lg font-bold">Creator Studio</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">Keyboard Shortcuts & Guide</span>
                </div>
                <button
                  onClick={() => setShowHelpOverlay(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  data-testid="button-help-close">
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 grid gap-6 md:grid-cols-2">
                {/* Keyboard shortcuts */}
                <div>
                  <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Keyboard Shortcuts</p>
                  <div className="space-y-1">
                    {[
                      ["Space", "Play / Pause"],
                      ["S", "Split clip at playhead"],
                      ["T", "Toggle Trim mode"],
                      ["X", "Toggle Split mode"],
                      ["Delete / Backspace", "Delete active clip"],
                      ["Ctrl + Z", "Undo"],
                      ["Ctrl + Y / Ctrl+Shift+Z", "Redo"],
                      ["Ctrl + D", "Duplicate active clip"],
                      ["← / →", "Seek ±1 second"],
                      ["Shift + ← / →", "Seek ±5 seconds"],
                      ["[", "Trim IN to playhead"],
                      ["]", "Trim OUT to playhead"],
                      ["+ / =", "Zoom in timeline"],
                      ["−", "Zoom out timeline"],
                      ["?", "Toggle this help overlay"],
                      ["Esc", "Close overlays"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex items-center justify-between gap-3 py-1 border-b border-zinc-800/60">
                        <span className="text-zinc-400 text-xs">{desc}</span>
                        <kbd className="text-[9px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0">{key}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Panel guide */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Timeline Tools</p>
                    <div className="space-y-2 text-xs text-zinc-400">
                      <div className="flex gap-2"><span className="text-white font-semibold w-14 flex-shrink-0">▶ Select</span><span>Click clips, drag to reorder. Default mode.</span></div>
                      <div className="flex gap-2"><span className="text-white font-semibold w-14 flex-shrink-0">✂ Split</span><span>Click a clip to split it at the playhead position.</span></div>
                      <div className="flex gap-2"><span className="text-white font-semibold w-14 flex-shrink-0">⊣⊢ Trim</span><span>Drag orange handles on clip edges to trim in/out points.</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Timeline Tracks</p>
                    <div className="space-y-1.5 text-xs">
                      {[
                        ["🎬 Video", "Drag clips to reorder · Trim handles · Split · Duplicate"],
                        ["🎵 Music", "Drag a beat from the Sounds panel"],
                        ["🎤 Voice", "Record voice-over with the mic button"],
                        ["💥 SFX", "Sound effects dropped from Sounds panel"],
                        ["💬 Captions", "Auto-captions or manual entries"],
                        ["✍️ Text", "Text layers placed on the canvas"],
                        ["🎞️ Transitions", "Added between clip gaps"],
                        ["✨ FX", "Effect regions: drag edges to resize, middle to move"],
                        ["🎨 LUT", "Active color filter / preset"],
                        ["🗺️ Map", "Map overlay animation"],
                      ].map(([track, desc]) => (
                        <div key={track} className="flex gap-2 border-b border-zinc-800/50 pb-1">
                          <span className="text-zinc-200 font-semibold w-24 flex-shrink-0 text-[10px]">{track}</span>
                          <span className="text-zinc-500 text-[10px]">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Tips</p>
                    <ul className="text-[10px] text-zinc-500 space-y-1 list-disc list-inside">
                      <li>Click the ruler to jump the playhead to any time.</li>
                      <li>Hover a clip to see the delete button (red dot, top-right).</li>
                      <li>Hold Shift while seeking for 5-second jumps.</li>
                      <li>Ctrl+D duplicates the current clip — handy for B-roll loops.</li>
                      <li>Use [ and ] to snap trim points to the playhead precisely.</li>
                      <li>The FX track shows time-based effect regions. Drag handles to resize.</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <button onClick={() => setShowHelpOverlay(false)} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors" data-testid="button-help-close-bottom">Got it</button>
              </div>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 size={48} className="text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-2xl">Reel published!</p>
                <p className="text-zinc-400 text-sm mt-2">Live on Urban Culture Connect</p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate("/admin/reels")} variant="outline" className="border-zinc-700 text-zinc-300" data-testid="button-go-to-reels">View Reels</Button>
                <Button onClick={() => { setStep("pick"); setFile(null); setPreviewUrl(null); setCaption(""); setProgress(0); setTextLayers([]); setStickerLayers([]); setSelectedTemplateId(null); setViralScore(null); }} className="bg-primary text-white" data-testid="button-create-another">Create Another</Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
