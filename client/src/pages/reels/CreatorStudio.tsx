import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Upload, Film, CheckCircle2, ChevronLeft, ChevronRight,
  Scissors, Image, Type, Sparkles, Gauge, SlidersHorizontal,
  Wand2, Plus, Trash2, VolumeX, Volume2, RotateCcw, Zap,
  Music, Smile, Palette, Layers, Play, Square,
  Sun, Droplets, Wind, FlipHorizontal2, Mic,
  Clapperboard, Layers3, Music2, Bot, Send, ChevronDown, Lock,
  TrendingUp, BarChart2, Hash, Share2, Paintbrush, Shuffle,
  Copy, Check, Smartphone, Globe, Monitor, AlignLeft, Target,
  Bookmark, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { uploadVideoToCloudinary, applyFullHd, FULL_HD_TRANSFORM } from "@/lib/cloudinaryUpload";

interface CreatorStudioProps {
  onClose: () => void;
  onUploaded: () => void;
}

type Step = "pick" | "edit" | "caption" | "uploading" | "done";
type EditTab = "trim" | "filters" | "adjust" | "speed" | "text" | "audio" | "stickers" | "aitools" | "motion" | "templates" | "sounds" | "export" | "viral" | "transitions" | "brand";
type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";
type TextAnimation = "none" | "slide-up" | "bounce" | "fade" | "typewriter" | "glitch" | "zoom-in" | "neon-pulse" | "shake" | "blur-in";
type TextFont = "default" | "bold" | "handwriting" | "mono";

interface MotionPreset {
  id: string; label: string; emoji: string; description: string;
  textStyle: { color: string; size: number; position: "top"|"center"|"bottom"; animation: TextAnimation; font: TextFont; };
  sampleText: string;
}

interface StudioTemplate {
  id: string; label: string; emoji: string; description: string; category: string;
  settings: {
    filterPresetId: string; brightness?: number; contrast?: number; saturation?: number;
    warmth?: number; shadows?: number; highlights?: number; vignette?: number; grain?: number;
    speed?: number; aspectRatio?: AspectRatio;
  };
  textLayers?: Omit<TextLayer, "id">[];
}

interface SoundEffect {
  id: string; label: string;
  category: "cinematic"|"whoosh"|"impact"|"bass"|"rise"|"urban"|"ambient";
  emoji: string; duration: string; mood: string;
}

interface AiMessage { role: "user"|"assistant"; content: string; }

interface PlatformProfile {
  id: string; label: string; emoji: string; aspectRatio: AspectRatio;
  width: number; height: number; fps: number; maxDuration: number; maxSizeMB: number;
  color: string; bgClass: string; tips: string[];
}

interface TransitionPreset {
  id: string; label: string; emoji: string; category: string;
  description: string; timing: string; bestFor: string;
}

interface HookTemplate { id: string; text: string; category: string; platform: string; }
interface HashtagPack { id: string; label: string; emoji: string; platform: string; description: string; tags: string[]; }

interface TextLayer {
  id: number; text: string; color: string; size: number;
  position: "top"|"center"|"bottom"; animation: TextAnimation; font: TextFont;
}
interface StickerLayer { id: number; emoji: string; x: number; y: number; size: number; }

const ASPECT_RATIOS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: "9:16", label: "Reel", w: 9, h: 16 },
  { id: "1:1",  label: "Square", w: 1, h: 1 },
  { id: "4:5",  label: "Portrait", w: 4, h: 5 },
  { id: "16:9", label: "Wide", w: 16, h: 9 },
];

const URBAN_STICKERS = [
  "🔥","💯","🎯","👑","🤸","💫","⚡","🌊","🎵","🎤","🏆","🦁",
  "✨","🕺","👊","🙌","🔮","🌀","🎭","🛹","🎨","💥","🌟","🔥",
  "🤙","👐","💪","🎶","🌈","🏙️","🎪","🧨","🥇","🔑","🚀","💎",
  "🎬","🎧","📸","🌆","🦋","🌺","❤️‍🔥","🎯","🏄","🤺","🥊","👾",
  "🪄","🎸","🥁","🎹","🪩","🏆","🌙","☀️",
];

const TEXT_FONTS: { id: TextFont; label: string; style: string }[] = [
  { id: "default",     label: "Default",    style: "system-ui, sans-serif" },
  { id: "bold",        label: "Impact",     style: "'Arial Black', Impact, sans-serif" },
  { id: "handwriting", label: "Script",     style: "Pacifico, cursive" },
  { id: "mono",        label: "Mono",       style: "'Courier New', monospace" },
];

const TEXT_ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: "none",       label: "None" },
  { id: "slide-up",  label: "Slide Up" },
  { id: "bounce",    label: "Bounce" },
  { id: "fade",      label: "Fade In" },
  { id: "typewriter",label: "Typewrite" },
  { id: "glitch",    label: "Glitch" },
  { id: "zoom-in",   label: "Zoom In" },
  { id: "neon-pulse",label: "Neon Glow" },
  { id: "shake",     label: "Shake" },
  { id: "blur-in",   label: "Blur In" },
];

const MUSIC_TRACKS = [
  { id: "hiphop1",  label: "Street Cipher",    genre: "Hip Hop",    bpm: 95  },
  { id: "break1",   label: "B-Boy Session",    genre: "Breakbeats", bpm: 130 },
  { id: "urban1",   label: "Amsterdam Nights", genre: "Urban",      bpm: 108 },
  { id: "trap1",    label: "Concrete Jungle",  genre: "Trap",       bpm: 140 },
  { id: "soul1",    label: "Groove Therapy",   genre: "Soul/Funk",  bpm: 88  },
  { id: "drill1",   label: "Daily Grind",      genre: "Drill",      bpm: 145 },
  { id: "afro1",    label: "Lagos to AMS",     genre: "Afrobeats",  bpm: 112 },
  { id: "jazz1",    label: "Midnight Jazz",    genre: "Jazz/Lofi",  bpm: 76  },
  { id: "grime1",   label: "Grime Season",     genre: "Grime",      bpm: 140 },
  { id: "house1",   label: "Club Amsterdam",   genre: "House",      bpm: 128 },
];

const MOTION_PRESETS: MotionPreset[] = [
  { id: "kinetic-drop", label: "Kinetic Drop", emoji: "💥", description: "Bold text drops in with impact", sampleText: "NO DAYS OFF", textStyle: { color: "#ffffff", size: 36, position: "center", animation: "slide-up", font: "bold" } },
  { id: "neon-glow", label: "Neon Glow", emoji: "🔮", description: "Pulsing neon glow effect", sampleText: "AMSTERDAM VIBES", textStyle: { color: "#39ff14", size: 28, position: "center", animation: "neon-pulse", font: "bold" } },
  { id: "street-tag", label: "Street Tag", emoji: "🎨", description: "Graffiti-style spray reveal", sampleText: "Real Recognize Real", textStyle: { color: "#ffcc00", size: 30, position: "bottom", animation: "blur-in", font: "handwriting" } },
  { id: "cinematic-title", label: "Cinematic Title", emoji: "🎬", description: "Wide letterbox title reveal", sampleText: "THE STREETS SPEAK", textStyle: { color: "#ffffff", size: 22, position: "center", animation: "fade", font: "mono" } },
  { id: "social-hook", label: "Social Hook", emoji: "🎯", description: "Bold attention-grabbing hook", sampleText: "YOU NEED TO SEE THIS", textStyle: { color: "#ff3b30", size: 32, position: "top", animation: "zoom-in", font: "bold" } },
  { id: "urban-flash", label: "Urban Flash", emoji: "⚡", description: "Quick flash-in with energy", sampleText: "STAY FOCUSED", textStyle: { color: "#ff9500", size: 34, position: "center", animation: "zoom-in", font: "bold" } },
  { id: "heat-wave", label: "Heat Wave", emoji: "🌊", description: "Distorted glitch wave effect", sampleText: "LEVEL UP", textStyle: { color: "#ff6b35", size: 36, position: "center", animation: "glitch", font: "bold" } },
  { id: "beat-drop", label: "Beat Drop", emoji: "🥁", description: "Shake on the beat drop", sampleText: "DROP IT 🔊", textStyle: { color: "#af52de", size: 32, position: "bottom", animation: "shake", font: "bold" } },
];

const STUDIO_TEMPLATES: StudioTemplate[] = [
  { id: "reel-hook", label: "Reel Hook", emoji: "🎯", description: "High-energy opener to stop the scroll", category: "Social", settings: { filterPresetId: "vivid", contrast: 15, saturation: 30, brightness: 5, warmth: 10 }, textLayers: [{ text: "WATCH TILL THE END 👀", color: "#ffffff", size: 26, position: "top", animation: "slide-up", font: "bold" }] },
  { id: "cinematic-edit", label: "Cinematic Edit", emoji: "🎬", description: "Dark & dramatic film aesthetic", category: "Cinematic", settings: { filterPresetId: "cinema", contrast: 25, saturation: -15, vignette: 25, shadows: 20, highlights: -15, grain: 20 }, textLayers: [{ text: "THE STREETS DON'T LIE", color: "#ffffff", size: 24, position: "center", animation: "fade", font: "mono" }] },
  { id: "event-promo", label: "Event Promo", emoji: "🎪", description: "Bold colors for events & announcements", category: "Promo", settings: { filterPresetId: "vivid", brightness: 10, saturation: 40, contrast: 20 }, textLayers: [{ text: "SAVE THE DATE", color: "#ffcc00", size: 30, position: "top", animation: "zoom-in", font: "bold" }, { text: "DROP YOUR LOCATION 📍", color: "#ffffff", size: 18, position: "bottom", animation: "fade", font: "default" }] },
  { id: "urban-culture", label: "Urban Culture", emoji: "🏙️", description: "Warm authentic street aesthetic", category: "Culture", settings: { filterPresetId: "warm", warmth: 30, saturation: 20, shadows: 10, vignette: 15 }, textLayers: [{ text: "Culture Never Sleeps", color: "#ff9500", size: 26, position: "bottom", animation: "slide-up", font: "handwriting" }] },
  { id: "bboy-battle", label: "B-Boy Battle", emoji: "🤸", description: "Raw power for breaking content", category: "Breaking", settings: { filterPresetId: "dramatic", contrast: 30, saturation: -10, vignette: 30, shadows: 25 }, textLayers: [{ text: "CYPHER SEASON 🔥", color: "#ff3b30", size: 28, position: "top", animation: "glitch", font: "bold" }] },
  { id: "city-night", label: "City Night", emoji: "🌃", description: "Cool blue mystery & night energy", category: "Night", settings: { filterPresetId: "cool", brightness: -10, contrast: 20, saturation: 10, vignette: 20 }, textLayers: [{ text: "After Dark", color: "#007aff", size: 30, position: "center", animation: "blur-in", font: "handwriting" }] },
  { id: "matte-viral", label: "Matte Viral", emoji: "🎞️", description: "Trendy desaturated matte finish", category: "Trending", settings: { filterPresetId: "matte", highlights: -20, shadows: 10, saturation: -20, vignette: 10 }, textLayers: [{ text: "this changed me", color: "#e8e8e8", size: 22, position: "bottom", animation: "fade", font: "default" }] },
  { id: "analog-retro", label: "Analog Retro", emoji: "📼", description: "Warm 90s VHS film aesthetic", category: "Retro", settings: { filterPresetId: "analog", warmth: 40, grain: 35, vignette: 20, saturation: -10 }, textLayers: [{ text: "OLD SCHOOL STILL RULES", color: "#ffd700", size: 24, position: "center", animation: "typewriter", font: "mono" }] },
];

const SOUND_LIBRARY: SoundEffect[] = [
  { id: "whoosh-1", label: "Air Whoosh",    category: "whoosh",    emoji: "💨", duration: "0.8s", mood: "transition" },
  { id: "whoosh-2", label: "Power Whoosh",  category: "whoosh",    emoji: "🌬️", duration: "1.2s", mood: "dramatic" },
  { id: "whoosh-3", label: "Quick Swipe",   category: "whoosh",    emoji: "⚡", duration: "0.4s", mood: "fast" },
  { id: "whoosh-4", label: "Deep Whoosh",   category: "whoosh",    emoji: "🌊", duration: "1.5s", mood: "cinematic" },
  { id: "impact-1", label: "Bass Punch",    category: "impact",    emoji: "💥", duration: "0.6s", mood: "aggressive" },
  { id: "impact-2", label: "Metal Hit",     category: "impact",    emoji: "🔩", duration: "0.8s", mood: "industrial" },
  { id: "impact-3", label: "Deep Thud",     category: "impact",    emoji: "🥁", duration: "0.5s", mood: "powerful" },
  { id: "impact-4", label: "Snap Crack",    category: "impact",    emoji: "🪄", duration: "0.3s", mood: "sharp" },
  { id: "bass-1",   label: "808 Drop",      category: "bass",      emoji: "📻", duration: "2.0s", mood: "urban" },
  { id: "bass-2",   label: "Sub Bass Wave", category: "bass",      emoji: "🔊", duration: "1.8s", mood: "deep" },
  { id: "bass-3",   label: "Bass Rumble",   category: "bass",      emoji: "💫", duration: "1.5s", mood: "tense" },
  { id: "rise-1",   label: "Cinematic Rise",category: "rise",      emoji: "🚀", duration: "3.0s", mood: "epic" },
  { id: "rise-2",   label: "Power Build",   category: "rise",      emoji: "📈", duration: "2.5s", mood: "intense" },
  { id: "rise-3",   label: "Tension Rise",  category: "rise",      emoji: "🎯", duration: "4.0s", mood: "suspense" },
  { id: "cin-1",    label: "Epic Stinger",  category: "cinematic", emoji: "🎬", duration: "1.2s", mood: "cinematic" },
  { id: "cin-2",    label: "Drama Horn",    category: "cinematic", emoji: "🎺", duration: "2.0s", mood: "dramatic" },
  { id: "cin-3",    label: "Trailer Boom",  category: "cinematic", emoji: "💣", duration: "1.8s", mood: "massive" },
  { id: "urb-1",    label: "Record Scratch",category: "urban",     emoji: "🎧", duration: "0.8s", mood: "hip hop" },
  { id: "urb-2",    label: "Vinyl Crackle", category: "urban",     emoji: "📀", duration: "1.0s", mood: "nostalgic" },
  { id: "urb-3",    label: "Cash Register", category: "urban",     emoji: "💰", duration: "0.6s", mood: "flex" },
  { id: "amb-1",    label: "City Ambience", category: "ambient",   emoji: "🌆", duration: "5.0s", mood: "chill" },
  { id: "amb-2",    label: "Rain Drops",    category: "ambient",   emoji: "🌧️", duration: "5.0s", mood: "relaxed" },
];

const SOUND_CATEGORIES = [
  { id: "whoosh",    label: "Whoosh",    emoji: "💨" },
  { id: "impact",    label: "Impact",    emoji: "💥" },
  { id: "bass",      label: "Bass Drop", emoji: "🔊" },
  { id: "rise",      label: "Rise",      emoji: "🚀" },
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "urban",     label: "Urban",     emoji: "🎧" },
  { id: "ambient",   label: "Ambient",   emoji: "🌆" },
];

const AI_QUICK_ACTIONS = [
  { label: "Hook ideas",      prompt: "Give me 3 creative hook lines for my video that will stop people from scrolling in the first 3 seconds." },
  { label: "Caption tips",    prompt: "What caption style works best for urban culture content on Instagram Reels right now?" },
  { label: "Hashtag strategy",prompt: "What are the best hashtag strategies for Dutch urban culture content? Give me a tiered mix of big/medium/niche." },
  { label: "Edit advice",     prompt: "Based on my current settings, what editing improvements would make this reel go viral?" },
  { label: "Trending styles", prompt: "What visual editing trends are dominating hip-hop and breaking content right now on TikTok and Instagram?" },
  { label: "Title ideas",     prompt: "Give me 5 YouTube title ideas for urban culture video content that maximize click-through rate." },
  { label: "B-roll ideas",    prompt: "Suggest 5 B-roll shot ideas that would complement this main video and increase production value." },
  { label: "Growth tips",     prompt: "Give me 3 account growth tactics specifically for urban culture / street dance creators in the Netherlands." },
  { label: "Platform guide",  prompt: "Which platform should I prioritize for urban culture content and why? Compare TikTok, Instagram Reels, and YouTube Shorts." },
  { label: "Collab ideas",    prompt: "Suggest 3 creative collaboration ideas for urban culture creators that could double both creators' audiences." },
];

const PLATFORM_PROFILES: PlatformProfile[] = [
  { id: "tiktok",    label: "TikTok",     emoji: "🎵", aspectRatio: "9:16", width: 1080, height: 1920, fps: 60, maxDuration: 60,  maxSizeMB: 287,   color: "#010101", bgClass: "from-zinc-900 to-zinc-800", tips: ["First 3 seconds are make-or-break", "Use trending audio for 3× reach", "Post between 6–10 PM local time"] },
  { id: "ig-reels",  label: "IG Reels",   emoji: "📸", aspectRatio: "9:16", width: 1080, height: 1920, fps: 30, maxDuration: 90,  maxSizeMB: 250,   color: "#C13584", bgClass: "from-purple-900/40 to-pink-900/30", tips: ["Hashtags boost discovery up to 40%", "Share to Story for 2× views", "Keep text in safe zones (top/bottom 15%)"] },
  { id: "ig-story",  label: "IG Story",   emoji: "⭕", aspectRatio: "9:16", width: 1080, height: 1920, fps: 30, maxDuration: 15,  maxSizeMB: 100,   color: "#FCAF45", bgClass: "from-orange-900/30 to-yellow-900/20", tips: ["15-second max — cut tight", "Add polls/questions for engagement", "Use stickers for algorithm boost"] },
  { id: "yt-shorts", label: "YT Shorts",  emoji: "▶️", aspectRatio: "9:16", width: 1080, height: 1920, fps: 60, maxDuration: 60,  maxSizeMB: 10000, color: "#FF0000", bgClass: "from-red-900/30 to-zinc-900", tips: ["60-second max for full Shorts distribution", "Strong first frame = higher CTR", "Add #Shorts in title for reach"] },
  { id: "youtube",   label: "YouTube",    emoji: "📺", aspectRatio: "16:9", width: 1920, height: 1080, fps: 60, maxDuration: 0,   maxSizeMB: 128000,color: "#FF0000", bgClass: "from-red-950/30 to-zinc-900", tips: ["Custom thumbnail = 90% of success", "Chapters boost watch time by 40%", "SEO-optimized titles get 3× more clicks"] },
  { id: "linkedin",  label: "LinkedIn",   emoji: "💼", aspectRatio: "1:1",  width: 1080, height: 1080, fps: 30, maxDuration: 600, maxSizeMB: 200,   color: "#0A66C2", bgClass: "from-blue-900/30 to-zinc-900",  tips: ["Native video gets 3× more engagement", "First 5 seconds must hook professionals", "Captions essential — 85% watch muted"] },
];

const TRANSITION_CATEGORIES = [
  { id: "cut",      label: "Cut",      emoji: "✂️" },
  { id: "motion",   label: "Motion",   emoji: "💫" },
  { id: "creative", label: "Creative", emoji: "🎨" },
  { id: "urban",    label: "Urban",    emoji: "🏙️" },
  { id: "beat",     label: "Beat Sync",emoji: "🥁" },
];

const TRANSITIONS: TransitionPreset[] = [
  { id: "hard-cut",       label: "Hard Cut",      emoji: "✂️", category: "cut",      description: "Instant raw switch — full energy",     timing: "0.0s",  bestFor: "Fast-paced breaking, battles" },
  { id: "cross-dissolve", label: "Cross Dissolve",emoji: "🌫️", category: "cut",      description: "Smooth blend between clips",           timing: "0.3s",  bestFor: "Emotional moments, storytelling" },
  { id: "fade-black",     label: "Fade to Black", emoji: "⬛", category: "cut",      description: "Classic fade out to black",            timing: "0.5s",  bestFor: "Scene endings, chapter breaks" },
  { id: "fade-white",     label: "Fade to White", emoji: "⬜", category: "cut",      description: "Bright flash transition",              timing: "0.3s",  bestFor: "Dream sequences, reveals" },
  { id: "dip-color",      label: "Dip to Color",  emoji: "🎨", category: "cut",      description: "Dip to brand color between clips",     timing: "0.4s",  bestFor: "Brand-consistent content" },
  { id: "whip-pan",       label: "Whip Pan",      emoji: "💫", category: "motion",   description: "High-speed horizontal sweep",          timing: "0.2s",  bestFor: "Action, location change, energy" },
  { id: "zoom-punch",     label: "Zoom Punch",    emoji: "🔍", category: "motion",   description: "Rapid zoom into next clip",            timing: "0.15s", bestFor: "Reaction moments, emphasis" },
  { id: "spin",           label: "360° Spin",     emoji: "🌀", category: "motion",   description: "Full rotation transition",             timing: "0.4s",  bestFor: "Fun, dynamic, show-off content" },
  { id: "slide-left",     label: "Slide Left",    emoji: "⬅️", category: "motion",   description: "Next clip slides in from right",       timing: "0.3s",  bestFor: "Tutorial steps, list content" },
  { id: "slide-up",       label: "Slide Up",      emoji: "⬆️", category: "motion",   description: "Swipe up to next scene",              timing: "0.3s",  bestFor: "Scroll-style reveals, builds" },
  { id: "push-zoom",      label: "Push Zoom",     emoji: "🔎", category: "motion",   description: "Camera pushes forward dramatically",   timing: "0.25s", bestFor: "Close-ups, important details" },
  { id: "glitch",         label: "Glitch Cut",    emoji: "📺", category: "creative", description: "Digital distortion corruption",        timing: "0.2s",  bestFor: "Urban, tech, hacker aesthetic" },
  { id: "light-leak",     label: "Light Leak",    emoji: "💡", category: "creative", description: "Warm light burst between clips",       timing: "0.5s",  bestFor: "Vintage, cinematic, aesthetic" },
  { id: "color-flash",    label: "Color Flash",   emoji: "⚡", category: "creative", description: "Bright color burst cut",               timing: "0.1s",  bestFor: "High energy, music sync" },
  { id: "warp",           label: "Warp",          emoji: "🌊", category: "creative", description: "Ripple distortion warp effect",        timing: "0.4s",  bestFor: "Dreamy, abstract, mind-bending" },
  { id: "blur-transition",label: "Motion Blur",   emoji: "💨", category: "creative", description: "Speed blur streak into next clip",     timing: "0.3s",  bestFor: "Speed, urgency, chase scenes" },
  { id: "prism",          label: "Prism Split",   emoji: "🔮", category: "creative", description: "RGB prism split dispersion",           timing: "0.35s", bestFor: "Artistic, visual-heavy content" },
  { id: "freeze-frame",   label: "Freeze Frame",  emoji: "📸", category: "urban",    description: "Momentary freeze before next cut",     timing: "0.5s",  bestFor: "Highlight moments, cool poses" },
  { id: "echo",           label: "Echo Trail",    emoji: "🔊", category: "urban",    description: "Ghost trail echo effect",              timing: "0.4s",  bestFor: "Dance moves, breaking highlights" },
  { id: "flash-cut",      label: "Flash Cut",     emoji: "✨", category: "urban",    description: "Rapid-fire multiple cuts",             timing: "0.1s",  bestFor: "Montage, battle videos, energy" },
  { id: "strobe",         label: "Strobe",        emoji: "🔦", category: "urban",    description: "Rapid flash strobe effect",            timing: "0.2s",  bestFor: "Club, rave, EDM content" },
  { id: "film-burn",      label: "Film Burn",     emoji: "🔥", category: "urban",    description: "Vintage film burn overlay",            timing: "0.6s",  bestFor: "Nostalgic, old-school content" },
  { id: "beat-cut",       label: "Beat Cut",      emoji: "🥁", category: "beat",     description: "Cut snaps precisely to beat marker",   timing: "auto",  bestFor: "Music-driven content, dance" },
  { id: "bass-hit",       label: "Bass Hit",      emoji: "🔈", category: "beat",     description: "Frame flash on bass drop hit",         timing: "auto",  bestFor: "Trap, drill, UK garage beats" },
  { id: "rhythm-cut",     label: "Rhythm Cut",    emoji: "🎵", category: "beat",     description: "Multiple cuts matched to BPM",         timing: "auto",  bestFor: "Fast BPM, hip-hop, breaking" },
];

const HOOK_CATEGORIES = [
  { id: "curiosity",  label: "Curiosity",      emoji: "🤔" },
  { id: "shock",      label: "Shock/Surprise", emoji: "😱" },
  { id: "fomo",       label: "FOMO",           emoji: "🏃" },
  { id: "urban",      label: "Urban Culture",  emoji: "🏙️" },
  { id: "challenge",  label: "Challenge",      emoji: "💪" },
];

const HOOK_LIBRARY: HookTemplate[] = [
  { id: "h1",  category: "curiosity", platform: "all", text: "Nobody talks about this but it changed everything for me..." },
  { id: "h2",  category: "curiosity", platform: "all", text: "Wait for the end — this one surprised everyone 👀" },
  { id: "h3",  category: "curiosity", platform: "all", text: "I tested this for 30 days. The result shocked me." },
  { id: "h4",  category: "curiosity", platform: "tiktok", text: "POV: You discover something the internet keeps hidden 🔍" },
  { id: "h5",  category: "curiosity", platform: "all", text: "The reason most people fail at this (and how to fix it)" },
  { id: "h6",  category: "curiosity", platform: "all", text: "What happens when you combine these two things? 🤯" },
  { id: "h7",  category: "shock",     platform: "all", text: "I can't believe this actually worked 💀" },
  { id: "h8",  category: "shock",     platform: "all", text: "This video got 10 million views overnight. Here's why." },
  { id: "h9",  category: "shock",     platform: "all", text: "They told me this was impossible. Then I did it." },
  { id: "h10", category: "shock",     platform: "all", text: "The most insane [skill] you'll see today 🔥" },
  { id: "h11", category: "shock",     platform: "ig",  text: "Wait... did that just happen?! 😱 Watch again." },
  { id: "h12", category: "shock",     platform: "all", text: "Nobody expected this from a kid from Amsterdam" },
  { id: "h13", category: "fomo",      platform: "all", text: "This trend is taking over in 2025. Don't miss it." },
  { id: "h14", category: "fomo",      platform: "all", text: "Everyone in [city] is doing this now. Are you?" },
  { id: "h15", category: "fomo",      platform: "tiktok", text: "Save this now — you'll need it later 📌" },
  { id: "h16", category: "fomo",      platform: "all", text: "The underground scene nobody knows about (until now)" },
  { id: "h17", category: "fomo",      platform: "all", text: "This event sold out in 4 minutes. Watch why 👇" },
  { id: "h18", category: "fomo",      platform: "ig",  text: "If you live in NL and don't know this spot, you're missing out" },
  { id: "h19", category: "urban",     platform: "all", text: "The streets raised me and this is proof 🏙️" },
  { id: "h20", category: "urban",     platform: "all", text: "Real recognize real. This is what culture looks like." },
  { id: "h21", category: "urban",     platform: "all", text: "Amsterdam breaking scene hits different at night 🌃" },
  { id: "h22", category: "urban",     platform: "all", text: "From the cyphers to the screens — this is our story" },
  { id: "h23", category: "urban",     platform: "ig",  text: "The graffiti speaks what words can't say 🎨" },
  { id: "h24", category: "urban",     platform: "all", text: "B-boys don't need a stage. The street IS the stage. 🔥" },
  { id: "h25", category: "challenge", platform: "all", text: "Try to watch this without feeling inspired. I dare you." },
  { id: "h26", category: "challenge", platform: "tiktok", text: "Can you beat this? Drop your version below 👇 #Challenge" },
  { id: "h27", category: "challenge", platform: "all", text: "30 days. Zero experience. This is what happened." },
  { id: "h28", category: "challenge", platform: "all", text: "They said I couldn't. Watch what happened next 💪" },
  { id: "h29", category: "challenge", platform: "all", text: "Drop everything. Watch this 60-second transformation." },
  { id: "h30", category: "challenge", platform: "all", text: "This took 1000 tries. It was worth every single one." },
];

const HASHTAG_PACKS: HashtagPack[] = [
  { id: "breaking",      label: "Breaking / B-Boy",  emoji: "🤸", platform: "IG+TT",    description: "Breaking, bboy/bgirl content",   tags: ["#breaking","#bboy","#bgirl","#breakdance","#cypher","#streetdance","#UrbanCulture","#headspin","#windmill","#powermoves","#footwork","#bboylife","#1on1","#breakingolympics","#breakingculture"] },
  { id: "hiphop",        label: "Hip-Hop Culture",   emoji: "🎤", platform: "All",       description: "Hip-hop culture & music",        tags: ["#hiphop","#hiphopculture","#rap","#emcee","#freestyle","#bars","#cypher","#underground","#hiphophead","#dj","#beatmaking","#producer","#hiphoplife","#streetvibes","#microphone"] },
  { id: "graffiti",      label: "Graffiti / Art",    emoji: "🎨", platform: "Instagram", description: "Street art and graffiti culture",tags: ["#graffiti","#streetart","#urbanart","#spraypaint","#mural","#graff","#graffwriter","#artistsoninstagram","#instagraffiti","#aerosol","#bombing","#wholecar","#pieceoftheday","#wallart","#streetartistry"] },
  { id: "amsterdam",     label: "Amsterdam Urban",   emoji: "🇳🇱", platform: "All",       description: "Dutch urban scene content",      tags: ["#amsterdam","#amsterdamstreet","#netherlands","#dutch","#amsterdam020","#streetamsterdam","#damsko","#iamsterdam","#020vibes","#urbanamsterdam","#streetculturenl","#nederlandsurban","#dutchcreatives","#hollandstreet"] },
  { id: "dance",         label: "Street Dance",      emoji: "💃", platform: "TT+IG",     description: "All styles of street dance",     tags: ["#streetdance","#dance","#dancer","#dancing","#choreography","#popping","#locking","#waacking","#krump","#dancevideo","#dancelife","#urbandance","#hiphopDance","#danceculture","#freestyle"] },
  { id: "reels-boost",   label: "Reels Boost",       emoji: "🚀", platform: "Instagram", description: "Maximize Instagram Reels reach", tags: ["#reels","#reelsinstagram","#reelsvideo","#instareels","#reelitfeelit","#viralreels","#reelsofinstagram","#trendingreels","#explorepage","#explore","#viral","#trending","#fyp","#instadaily","#instagood"] },
  { id: "tiktok-foryou", label: "TikTok FYP",        emoji: "🎵", platform: "TikTok",    description: "TikTok FYP optimization tags",   tags: ["#fyp","#foryou","#foryoupage","#viral","#trending","#tiktok","#tiktokviral","#viralvideo","#tiktokdance","#fypシ","#xyzbca","#duet","#stitch","#tiktoktrend","#tiktokeurope"] },
  { id: "urban-culture", label: "Urban Culture",     emoji: "🏙️", platform: "All",       description: "General urban culture vibes",    tags: ["#urbanculture","#streetculture","#urbanlifestyle","#citylife","#streetstyle","#urbanfashion","#streetsofeurope","#urbanvibes","#cityphotography","#urbanphotography","#streetphotography","#streetlife","#cityvibes","#culturalmovement","#underground"] },
];

const LOWER_THIRDS_STYLES = [
  { id: "bold-bar",     label: "Bold Bar",     description: "Colored bar with white text",   preview: "bg-primary" },
  { id: "minimal-line", label: "Minimal Line", description: "Text with colored underline",   preview: "border-b-2 border-white" },
  { id: "glass",        label: "Glassmorphism",description: "Frosted glass background",      preview: "bg-white/10 backdrop-blur" },
  { id: "neon-border",  label: "Neon Border",  description: "Glowing neon frame",            preview: "border border-primary shadow-[0_0_8px_var(--primary)]" },
  { id: "broadcast",    label: "Broadcast",    description: "Professional news-style bar",   preview: "bg-red-600" },
  { id: "urban-tag",    label: "Urban Tag",    description: "Graffiti-inspired spray style", preview: "bg-yellow-400" },
];

const STEP_LABELS: Record<Step, string> = { pick: "Select Video", edit: "Edit Studio", caption: "Caption & Tags", uploading: "Uploading…", done: "Posted!" };
const STEP_ICONS: Record<Step, typeof Film> = { pick: Film, edit: Scissors, caption: Type, uploading: Upload, done: CheckCircle2 };
const MAX_CAPTION = 300;
const COMPRESS_THRESHOLD = 80 * 1024 * 1024;
const THUMBNAIL_COUNT = 6;

interface FilterPreset {
  id: string; label: string; brightness: number; contrast: number;
  saturation: number; sepia: number; hueRotate: number;
}

const FILTER_PRESETS: FilterPreset[] = [
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
  { id: "chrome",   label: "Chrome",   brightness: 5,   contrast: 40, saturation: 10,  sepia: 0,  hueRotate: 0   },
  { id: "pastel",   label: "Pastel",   brightness: 20,  contrast: -15,saturation: -40, sepia: 15, hueRotate: 0   },
];

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const SPEED_LABELS: Record<number, string> = { 0.25: "0.25×", 0.5: "0.5×", 0.75: "0.75×", 1: "1×", 1.25: "1.25×", 1.5: "1.5×", 2: "2×", 3: "3×" };
const TEXT_COLORS = ["#ffffff","#000000","#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#ff6b6b","#39ff14","#00cfff","#ff69b4"];

function buildCssFilter(p: FilterPreset, brightness: number, contrast: number, saturation: number, warmth = 0, shadows = 0, highlights = 0): string {
  const b = 1 + (p.brightness + brightness + highlights * 0.5) / 100;
  const c = 1 + (p.contrast + contrast) / 100;
  const s = Math.max(0, 1 + (p.saturation + saturation) / 100);
  const sepia = Math.min(1, p.sepia / 100 + warmth / 200);
  const hue = p.hueRotate + (warmth > 0 ? 0 : warmth < 0 ? 10 : 0);
  return `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${sepia}) hue-rotate(${hue}deg)`;
}

function buildCloudinaryTransform(preset: FilterPreset, brightness: number, contrast: number, saturation: number, speed: number, muted: boolean, textLayers: TextLayer[], warmth = 0, shadows = 0, highlights = 0, vignette = 0, audioVolume = 100): string {
  const parts: string[] = [];
  const totalB = preset.brightness + brightness + Math.round(highlights * 0.5);
  const totalC = preset.contrast + contrast + Math.round(shadows * 0.3);
  const totalS = preset.saturation + saturation;
  const totalWarmth = Math.round(preset.sepia + warmth * 0.5);
  if (totalB !== 0) parts.push(`e_brightness:${totalB}`);
  if (totalC !== 0) parts.push(`e_contrast:${totalC}`);
  if (totalS !== 0) parts.push(`e_saturation:${totalS}`);
  if (totalWarmth > 0) parts.push(`e_sepia:${Math.min(100, totalWarmth)}`);
  if (vignette > 0) parts.push(`e_vignette:${vignette}`);
  if (speed !== 1) parts.push(`e_accelerate:${Math.round(speed * 100)}`);
  if (muted) parts.push("an_strip");
  else if (audioVolume !== 100) parts.push(`e_volume:${audioVolume}`);
  return parts.join(",");
}

function getAnimationClass(animation: TextAnimation): string {
  switch (animation) {
    case "slide-up":  return "animate-[slideUp_0.6s_ease_forwards]";
    case "bounce":    return "animate-bounce";
    case "fade":      return "animate-[fadeIn_0.8s_ease_forwards]";
    case "typewriter":return "animate-[fadeIn_0.5s_ease_forwards]";
    case "glitch":    return "studio-anim-glitch";
    case "zoom-in":   return "studio-anim-zoomin";
    case "neon-pulse":return "studio-anim-neon";
    case "shake":     return "studio-anim-shake";
    case "blur-in":   return "studio-anim-blurin";
    default:          return "";
  }
}

const STUDIO_KEYFRAMES = `
@keyframes studioGlitch {
  0%,100%{transform:translate(0);filter:none}
  10%{transform:translate(-3px,2px);filter:hue-rotate(90deg)}
  20%{transform:translate(3px,-2px);opacity:.8}
  30%{transform:translate(-2px,1px);filter:hue-rotate(-60deg)}
  50%{transform:translate(-1px,2px);filter:hue-rotate(45deg)}
}
@keyframes studioZoomin {
  from{transform:scale(0.3);opacity:0}
  60%{transform:scale(1.08)}
  to{transform:scale(1);opacity:1}
}
@keyframes studioNeon {
  0%,100%{text-shadow:0 0 8px currentColor,0 0 20px currentColor,0 0 40px currentColor}
  50%{text-shadow:0 0 4px currentColor,0 0 10px currentColor,0 0 20px currentColor}
}
@keyframes studioShake {
  0%,100%{transform:translateX(0)}
  10%{transform:translateX(-6px)} 20%{transform:translateX(6px)}
  30%{transform:translateX(-5px)} 40%{transform:translateX(5px)}
  70%{transform:translateX(-2px)} 80%{transform:translateX(2px)}
}
@keyframes studioBlurin {
  from{filter:blur(12px);opacity:0}
  to{filter:blur(0);opacity:1}
}
@keyframes studioLowerThird {
  from{transform:translateX(-100%);opacity:0}
  to{transform:translateX(0);opacity:1}
}
@keyframes studioProgressBar {
  from{width:0%}
  to{width:100%}
}
@keyframes studioViralCount {
  from{opacity:0;transform:scale(0.5)}
  to{opacity:1;transform:scale(1)}
}
.studio-anim-glitch{animation:studioGlitch 0.8s ease forwards}
.studio-anim-zoomin{animation:studioZoomin 0.5s cubic-bezier(.17,.67,.35,1.2) forwards}
.studio-anim-neon{animation:studioNeon 1.5s ease-in-out infinite}
.studio-anim-shake{animation:studioShake 0.6s ease forwards}
.studio-anim-blurin{animation:studioBlurin 0.7s ease forwards}
.studio-lower-third{animation:studioLowerThird 0.4s cubic-bezier(.22,1,.36,1) forwards}
.studio-viral-count{animation:studioViralCount 0.6s cubic-bezier(.22,1,.36,1) forwards}
`;

export default function CreatorStudio({ onClose, onUploaded }: CreatorStudioProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);

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

  const [editTab, setEditTab] = useState<EditTab>("templates");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");

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

  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(100);
  const [selectedTrack, setSelectedTrack] = useState<string|null>(null);
  const [customAudioFile, setCustomAudioFile] = useState<File|null>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string|null>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(28);
  const [textPosition, setTextPosition] = useState<"top"|"center"|"bottom">("bottom");
  const [textAnimation, setTextAnimation] = useState<TextAnimation>("none");
  const [textFont, setTextFont] = useState<TextFont>("default");
  const [nextTextId, setNextTextId] = useState(1);

  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [nextStickerId, setNextStickerId] = useState(1);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiSubtitleStyle, setAiSubtitleStyle] = useState<"bold"|"minimal"|"neon"|"classic">("bold");
  const [aiSubtitles, setAiSubtitles] = useState<string[]>([]);
  const [aiSubtitleLoading, setAiSubtitleLoading] = useState(false);

  const [selectedMotionId, setSelectedMotionId] = useState<string|null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string|null>(null);
  const [selectedSoundFx, setSelectedSoundFx] = useState<string|null>(null);
  const [soundCategory, setSoundCategory] = useState<string>("whoosh");

  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "assistant", content: "Hey! I'm your AI Creative Director — your secret weapon for viral content. Ask me about hooks, captions, hashtags, edit styles, platform strategy, and more. 🎨🚀" },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAccessMode, setAiAccessMode] = useState<string>("loading");
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  // ── New: Export & Platform ──
  const [selectedPlatform, setSelectedPlatform] = useState<string|null>(null);

  // ── New: Transitions ──
  const [selectedTransition, setSelectedTransition] = useState<string|null>(null);
  const [transitionCategory, setTransitionCategory] = useState("cut");

  // ── New: Brand Kit ──
  const [brandColors, setBrandColors] = useState<string[]>(["#ff3b30","#ff9500","#ffffff","#000000","#007aff","#af52de"]);
  const [brandFont, setBrandFont] = useState<TextFont>("bold");
  const [lowerThirdEnabled, setLowerThirdEnabled] = useState(false);
  const [lowerThirdText, setLowerThirdText] = useState("");
  const [lowerThirdStyle, setLowerThirdStyle] = useState("bold-bar");
  const [progressBarEnabled, setProgressBarEnabled] = useState(false);
  const [progressBarColor, setProgressBarColor] = useState("#ffffff");
  const [logoPosition, setLogoPosition] = useState<string>("bottom-right");
  const [logoWatermark, setLogoWatermark] = useState("");

  // ── New: Viral Intelligence ──
  const [viralScore, setViralScore] = useState<number|null>(null);
  const [viralBreakdown, setViralBreakdown] = useState<{hook:number;energy:number;trends:number;optimize:number}|null>(null);
  const [viralTips, setViralTips] = useState<string[]>([]);
  const [viralPlatformBest, setViralPlatformBest] = useState<string>("");
  const [viralScoreLoading, setViralScoreLoading] = useState(false);
  const [hookCategory, setHookCategory] = useState("curiosity");
  const [copiedKey, setCopiedKey] = useState<string|null>(null);

  const currentPreset = FILTER_PRESETS.find(p => p.id === filterPresetId) ?? FILTER_PRESETS[0];
  const cssFilter = buildCssFilter(currentPreset, brightness, contrast, saturation, warmth, shadows, highlights);

  useEffect(() => {
    if (!document.getElementById("studio-keyframes")) {
      const el = document.createElement("style");
      el.id = "studio-keyframes";
      el.textContent = STUDIO_KEYFRAMES;
      document.head.appendChild(el);
    }
    return () => { const el = document.getElementById("studio-keyframes"); if (el) el.remove(); };
  }, []);

  useEffect(() => {
    apiRequest("/api/app-settings", "GET").then(r => r.json()).then(d => {
      setAiAccessMode(d.aiAccessMode || "contact_admin");
    }).catch(() => setAiAccessMode("contact_admin"));
  }, []);

  useEffect(() => { aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.style.filter = cssFilter;
      previewVideoRef.current.playbackRate = speed;
      previewVideoRef.current.muted = true;
    }
  }, [cssFilter, speed]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) { toast({ title: "File too large", description: "Max 500 MB per reel.", variant: "destructive" }); return; }
    setFile(f); setPreviewUrl(URL.createObjectURL(f)); setStep("edit");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f || !f.type.startsWith("video/")) { toast({ title: "Invalid file", description: "Please drop a video file.", variant: "destructive" }); return; }
    if (f.size > 500 * 1024 * 1024) { toast({ title: "File too large", description: "Max 500 MB per reel.", variant: "destructive" }); return; }
    setFile(f); setPreviewUrl(URL.createObjectURL(f)); setStep("edit");
  };

  useEffect(() => {
    if (!previewUrl) return;
    const vid = document.createElement("video");
    vid.preload = "metadata"; vid.src = previewUrl; vid.crossOrigin = "anonymous";
    vid.onloadedmetadata = () => {
      const dur = vid.duration;
      setVideoDuration(dur); setTrimEnd(dur);
      generateTimelineFrames(previewUrl, dur);
      generateThumbnails(previewUrl, dur);
    };
  }, [previewUrl]);

  const generateTimelineFrames = (url: string, dur: number) => {
    const frameCount = 20; const frames: string[] = []; let idx = 0;
    const vid = document.createElement("video"); vid.preload = "auto"; vid.src = url; vid.muted = true;
    const canvas = document.createElement("canvas"); canvas.width = 60; canvas.height = 80;
    const ctx = canvas.getContext("2d")!;
    const captureFrame = () => { if (idx >= frameCount) { setTimelineFrames(frames); return; } vid.currentTime = (idx / frameCount) * dur; };
    vid.addEventListener("seeked", () => { ctx.drawImage(vid, 0, 0, 60, 80); frames.push(canvas.toDataURL("image/jpeg", 0.5)); idx++; captureFrame(); });
    vid.onloadeddata = () => captureFrame();
  };

  const generateThumbnails = (url: string, dur: number) => {
    const thumbs: string[] = []; let idx = 0;
    const vid = document.createElement("video"); vid.preload = "auto"; vid.src = url; vid.muted = true;
    const canvas = document.createElement("canvas"); canvas.width = 120; canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    const capture = () => { if (idx >= THUMBNAIL_COUNT) { setThumbnails(thumbs); setCoverDataUrl(thumbs[0] || null); return; } vid.currentTime = ((idx + 0.5) / THUMBNAIL_COUNT) * dur; };
    vid.addEventListener("seeked", () => { ctx.drawImage(vid, 0, 0, 120, 160); thumbs.push(canvas.toDataURL("image/jpeg", 0.7)); idx++; capture(); });
    vid.onloadeddata = () => capture();
  };

  useEffect(() => {
    if (step !== "edit" || !previewVideoRef.current) return;
    const vid = previewVideoRef.current;
    vid.currentTime = trimStart;
    const checkTime = () => { if (vid.currentTime >= trimEnd) { vid.pause(); vid.currentTime = trimEnd; } };
    vid.addEventListener("timeupdate", checkTime);
    return () => vid.removeEventListener("timeupdate", checkTime);
  }, [step, trimStart, trimEnd]);

  const getClientX = useCallback((e: MouseEvent | TouchEvent): number => {
    if ("touches" in e) return e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
    return e.clientX;
  }, []);

  const handleTimelineMouseDown = (e: React.MouseEvent, type: "start"|"end") => { e.preventDefault(); setDragging(type); };
  const handleTouchStart = (e: React.TouchEvent, type: "start"|"end") => { e.preventDefault(); setDragging(type); };

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
    window.addEventListener("mousemove", handleTimelineMove);
    window.addEventListener("mouseup", handleTimelineEnd);
    window.addEventListener("touchmove", handleTimelineMove, { passive: false });
    window.addEventListener("touchend", handleTimelineEnd);
    return () => {
      window.removeEventListener("mousemove", handleTimelineMove);
      window.removeEventListener("mouseup", handleTimelineEnd);
      window.removeEventListener("touchmove", handleTimelineMove);
      window.removeEventListener("touchend", handleTimelineEnd);
    };
  }, [dragging, handleTimelineMove, handleTimelineEnd]);

  const highlightHashtags = (text: string) =>
    text.split(/(#\w+)/g).map((part, i) =>
      part.startsWith("#") ? <span key={i} className="text-primary">{part}</span> : <span key={i}>{part}</span>
    );

  const addTextLayer = (overrides?: Partial<TextLayer>) => {
    const text = overrides?.text || textInput.trim();
    if (!text) return;
    setTextLayers(prev => [...prev, { id: nextTextId, text, color: overrides?.color ?? textColor, size: overrides?.size ?? textSize, position: overrides?.position ?? textPosition, animation: overrides?.animation ?? textAnimation, font: overrides?.font ?? textFont }]);
    setNextTextId(n => n + 1);
    if (!overrides?.text) setTextInput("");
  };

  const removeTextLayer = (id: number) => setTextLayers(prev => prev.filter(t => t.id !== id));

  const addSticker = (emoji: string) => {
    setStickerLayers(prev => [...prev, { id: nextStickerId, emoji, x: 20 + (nextStickerId % 5) * 12, y: 20 + (nextStickerId % 4) * 15, size: 40 }]);
    setNextStickerId(n => n + 1);
  };

  const removeSticker = (id: number) => setStickerLayers(prev => prev.filter(s => s.id !== id));

  const handleCustomAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (customAudioUrl) URL.revokeObjectURL(customAudioUrl);
    setCustomAudioFile(f); setCustomAudioUrl(URL.createObjectURL(f)); setSelectedTrack("custom");
  };

  const applyTemplate = (template: StudioTemplate) => {
    const s = template.settings;
    setFilterPresetId(s.filterPresetId);
    if (s.brightness !== undefined) setBrightness(s.brightness);
    if (s.contrast !== undefined) setContrast(s.contrast);
    if (s.saturation !== undefined) setSaturation(s.saturation);
    if (s.warmth !== undefined) setWarmth(s.warmth);
    if (s.shadows !== undefined) setShadows(s.shadows);
    if (s.highlights !== undefined) setHighlights(s.highlights);
    if (s.vignette !== undefined) setVignette(s.vignette);
    if (s.grain !== undefined) setGrain(s.grain);
    if (s.speed !== undefined) setSpeed(s.speed);
    if (s.aspectRatio !== undefined) setAspectRatio(s.aspectRatio);
    if (template.textLayers?.length) {
      template.textLayers.forEach(tl => {
        setTextLayers(prev => [...prev, { ...tl, id: Date.now() + Math.random() * 1000 | 0 }]);
        setNextTextId(n => n + 1);
      });
    }
    setSelectedTemplateId(template.id);
    toast({ title: `${template.emoji} Template applied!`, description: `"${template.label}" look is active.` });
  };

  const applyMotionPreset = (preset: MotionPreset) => {
    const { textStyle, sampleText } = preset;
    setTextLayers(prev => [...prev, { id: Date.now(), text: sampleText, color: textStyle.color, size: textStyle.size, position: textStyle.position, animation: textStyle.animation, font: textStyle.font }]);
    setNextTextId(n => n + 1);
    setSelectedMotionId(preset.id);
    toast({ title: `${preset.emoji} Motion preset added!`, description: `"${preset.label}" text layer added. Edit it in the Text tab.` });
  };

  const applyPlatformProfile = (profile: PlatformProfile) => {
    setAspectRatio(profile.aspectRatio);
    setSelectedPlatform(profile.id);
    toast({ title: `${profile.emoji} ${profile.label} profile applied`, description: `Aspect ratio set to ${profile.aspectRatio} · ${profile.width}×${profile.height}` });
  };

  const applyBrandToAllLayers = () => {
    if (!textLayers.length) { toast({ title: "No text layers", description: "Add text layers first to apply brand styling.", variant: "destructive" }); return; }
    setTextLayers(prev => prev.map((layer, i) => ({ ...layer, color: brandColors[i % brandColors.length], font: brandFont })));
    toast({ title: "Brand applied!", description: "Your brand colors and font applied to all text layers." });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({ title: "Copied!", description: "Text copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" });
    }
  };

  const handleViralScore = async () => {
    setViralScoreLoading(true);
    setViralScore(null); setViralBreakdown(null); setViralTips([]); setViralPlatformBest("");
    try {
      const res = await apiRequest("/api/studio/viral-score", "POST", {
        context: {
          platform: selectedPlatform,
          aspectRatio,
          filter: filterPresetId,
          template: selectedTemplateId,
          duration: videoDuration ? Math.round(videoDuration) : null,
          textCount: textLayers.length,
          speed,
          soundFx: selectedSoundFx,
          transition: selectedTransition,
          hasLowerThird: lowerThirdEnabled,
          hasProgressBar: progressBarEnabled,
        },
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "AI unavailable", description: "Contact admin to unlock viral analysis.", variant: "destructive" });
        return;
      }
      setViralScore(data.score ?? 65);
      setViralBreakdown({ hook: data.hook ?? 15, energy: data.energy ?? 17, trends: data.trends ?? 16, optimize: data.optimize ?? 17 });
      setViralTips(data.tips ?? []);
      setViralPlatformBest(data.platform_best ?? "");
    } catch {
      toast({ title: "Analysis failed", description: "Could not run viral score analysis.", variant: "destructive" });
    } finally {
      setViralScoreLoading(false);
    }
  };

  const handleAiAssist = async (message: string) => {
    if (!message.trim() || aiAssistLoading) return;
    const userMsg = message.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setAiAssistLoading(true);
    try {
      const res = await apiRequest("/api/studio/ai-assist", "POST", {
        message: userMsg,
        context: { aspectRatio, filter: filterPresetId, template: selectedTemplateId, duration: videoDuration ? Math.round(videoDuration) : null, textCount: textLayers.length, speed, platform: selectedPlatform },
      });
      const data = await res.json();
      if (data.error === "contact_admin") {
        setAiMessages(prev => [...prev, { role: "assistant", content: "AI access is restricted. Contact your admin to unlock the AI Creative Director. 🔒" }]);
      } else {
        setAiMessages(prev => [...prev, { role: "assistant", content: data.response || "I'm having trouble right now. Try again!" }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Connection issue. Check your network and try again." }]);
    } finally {
      setAiAssistLoading(false);
    }
  };

  const handleGenerateSubtitles = async () => {
    setAiSubtitleLoading(true);
    try {
      const res = await apiRequest("/api/reels/ai-caption", "POST", { filename: file?.name, duration: videoDuration || (trimEnd - trimStart), hint: (aiHint || "") + " — generate 3-5 short subtitle lines for this video", subtitles: true });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const lines = (data.caption || "").split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5);
      setAiSubtitles(lines);
      lines.forEach((line: string, idx: number) => {
        setTextLayers(prev => [...prev, { id: Date.now() + idx, text: line, color: aiSubtitleStyle === "neon" ? "#39ff14" : "#ffffff", size: aiSubtitleStyle === "minimal" ? 20 : 26, position: "bottom", animation: "fade", font: aiSubtitleStyle === "bold" ? "bold" : "default" }]);
      });
      toast({ title: "Subtitles generated!", description: `${lines.length} lines added as text layers.` });
    } catch {
      toast({ title: "AI unavailable", description: "Could not generate subtitles. Try again.", variant: "destructive" });
    } finally {
      setAiSubtitleLoading(false);
    }
  };

  const resetFilters = () => { setFilterPresetId("normal"); setBrightness(0); setContrast(0); setSaturation(0); };
  const resetAdjust = () => { setWarmth(0); setShadows(0); setHighlights(0); setVignette(0); setGrain(0); setSharpen(false); };

  const handleAiCaption = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest("/api/reels/ai-caption", "POST", { filename: file?.name, duration: videoDuration || (trimEnd - trimStart), hint: aiHint || undefined });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fullCaption = [data.caption, ...(data.hashtags || [])].join(" ").slice(0, MAX_CAPTION);
      setCaption(fullCaption);
      toast({ title: "Caption generated!", description: "Edit it to make it yours." });
    } catch {
      toast({ title: "AI unavailable", description: "Could not generate caption. Try again.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

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
        setProgress(10);
        let sim = 10;
        const tick = setInterval(() => { sim = Math.min(80, sim + 0.8); setProgress(Math.round(sim)); }, 600);
        let serverData: { secure_url: string; public_id: string; duration: number };
        try {
          const response = await fetch("/api/reels/compress-upload", { method: "POST", headers, body: formData, credentials: "include" });
          clearInterval(tick);
          if (!response.ok) { const errData = await response.json().catch(() => ({ error: "Upload failed" })); throw new Error(errData.error || "Video processing failed"); }
          serverData = await response.json();
        } catch (e) { clearInterval(tick); throw e; }
        setIsCompressing(false); setProgress(88);
        uploadResult = serverData;
      } else {
        let lastLoaded = 0; let lastTime = Date.now();
        const sigRes = await apiRequest("/api/reels/upload-signature", "GET");
        const sigData = await sigRes.json();
        const { signature, timestamp, folder, apiKey, cloudName } = sigData;
        const raw = await uploadVideoToCloudinary(file, { signature, timestamp, folder, apiKey, cloudName }, {
          onProgress: (pct) => {
            setProgress(pct);
            const now = Date.now(); const elapsed = (now - lastTime) / 1000;
            if (elapsed > 0.5) {
              const bytesUploaded = (pct / 85) * file.size;
              const bps = (bytesUploaded - lastLoaded) / elapsed;
              if (bps > 0) { setUploadSpeed(Math.round((bps / (1024 * 1024)) * 10) / 10); setEstimatedTime(Math.round((file.size - bytesUploaded) / bps)); }
              lastLoaded = bytesUploaded; lastTime = now;
            }
          },
        });
        uploadResult = { secure_url: raw.secure_url, public_id: raw.public_id, duration: raw.duration ?? 0 };
      }
      setProgress(90);
      const cloudTransform = buildCloudinaryTransform(currentPreset, brightness, contrast, saturation, speed, muted, textLayers, warmth, shadows, highlights, vignette, audioVolume);
      const trimParts: string[] = [];
      if (trimStart > 0) trimParts.push(`so_${trimStart.toFixed(2)}`);
      if (trimEnd < videoDuration && trimEnd > 0) trimParts.push(`eo_${trimEnd.toFixed(2)}`);
      const trimTransform = trimParts.join(",");
      const transformLayers = [trimTransform, FULL_HD_TRANSFORM, cloudTransform].filter(Boolean).join("/");
      const videoUrl = uploadResult.secure_url.replace("/upload/", `/upload/${transformLayers}/`);
      let thumbnailUrl = uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg").replace("/video/upload/", "/video/upload/so_0/");
      if (coverDataUrl) {
        try {
          const coverSigRes = await apiRequest("/api/reels/upload-signature", "GET");
          const coverSig = await coverSigRes.json();
          const coverFormData = new FormData();
          coverFormData.append("file", coverDataUrl); coverFormData.append("signature", coverSig.signature);
          coverFormData.append("timestamp", String(coverSig.timestamp)); coverFormData.append("folder", coverSig.folder);
          coverFormData.append("api_key", coverSig.apiKey);
          const coverResult = await fetch(`https://api.cloudinary.com/v1_1/${coverSig.cloudName}/image/upload`, { method: "POST", body: coverFormData }).then(r => r.json());
          if (coverResult.secure_url) thumbnailUrl = coverResult.secure_url;
        } catch {}
      }
      setProgress(95);
      await apiRequest("/api/reels", "POST", { videoUrl, videoPublicId: uploadResult.public_id, thumbnailUrl, caption: caption.trim() || null, duration: Math.round(uploadResult.duration ?? trimEnd - trimStart), status: "active" });
      setProgress(100); setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/reels"] });
      setTimeout(() => { onUploaded(); onClose(); }, 1500);
    } catch (err: any) {
      const msg = err?.message || "Upload failed. Please try again.";
      console.error("Reel upload error:", msg, err);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
      setStep("caption"); setProgress(0); setIsCompressing(false);
    }
  };

  const goBack = () => {
    if (step === "edit") { if (previewUrl) URL.revokeObjectURL(previewUrl); setFile(null); setPreviewUrl(null); setTrimStart(0); setTrimEnd(0); setThumbnails([]); setTimelineFrames([]); setStep("pick"); }
    else if (step === "caption") setStep("edit");
  };

  const goNext = () => { if (step === "edit") setStep("caption"); else if (step === "caption") handleUpload(); };

  const startPct = videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0;
  const endPct   = videoDuration > 0 ? (trimEnd   / videoDuration) * 100 : 100;
  const stepOrder: Step[] = ["pick", "edit", "caption", "uploading", "done"];
  const currentStepIdx = stepOrder.indexOf(step);

  const EDIT_TABS: { id: EditTab; label: string; icon: typeof Scissors }[] = [
    { id: "templates",   label: "Templates",   icon: Clapperboard },
    { id: "motion",      label: "Motion",      icon: Layers3      },
    { id: "export",      label: "Export",      icon: Share2       },
    { id: "viral",       label: "Viral",       icon: TrendingUp   },
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
    { id: "aitools",     label: "AI Tools",    icon: Sparkles     },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" data-testid="creator-studio">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
        <div className="flex items-center gap-3">
          {(step === "edit" || step === "caption") && (
            <button onClick={goBack} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 transition-colors" data-testid="button-back-step">
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Clapperboard size={16} className="text-primary" />
            <h2 className="text-white font-semibold text-base">{STEP_LABELS[step]}</h2>
          </div>
          {step === "edit" && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] bg-gradient-to-r from-purple-500/20 to-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
              <Sparkles size={10} /> Pro Studio
            </span>
          )}
          {step === "edit" && selectedPlatform && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-full font-medium">
              {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.emoji} {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {(step === "edit" || step === "caption") && (
            <Button onClick={goNext} size="sm" className="bg-primary hover:bg-primary/90 text-white font-medium px-4" data-testid="button-next-step">
              {step === "caption" ? "Post Reel" : "Next"}
              {step !== "caption" && <ChevronRight size={14} className="ml-1" />}
            </Button>
          )}
          {step !== "uploading" && step !== "done" && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" data-testid="button-close-upload">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-zinc-950 border-b border-zinc-800/50 flex-shrink-0">
        {stepOrder.slice(0, 3).map((s, i) => {
          const Icon = STEP_ICONS[s]; const isActive = i === currentStepIdx; const isDone = i < currentStepIdx;
          return (
            <div key={s} className="flex items-center flex-1">
              <div className={cn("flex items-center gap-1.5 text-xs font-medium transition-colors", isActive ? "text-primary" : isDone ? "text-green-400" : "text-zinc-600")}>
                <Icon size={13} /><span className="hidden sm:inline">{STEP_LABELS[s]}</span>
              </div>
              {i < 2 && <div className={cn("flex-1 h-0.5 mx-2 rounded-full transition-colors", isDone ? "bg-green-400" : "bg-zinc-800")} />}
            </div>
          );
        })}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div key={step} className="animate-step-slide h-full flex flex-col">

          {/* ── PICK ── */}
          {step === "pick" && (
            <div className="flex items-center justify-center flex-1 p-6">
              <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
                className="flex flex-col items-center justify-center gap-6 w-full max-w-lg h-80 border-2 border-dashed border-zinc-700 rounded-3xl cursor-pointer hover:border-primary/60 hover:bg-zinc-900/50 transition-all"
                data-testid="dropzone-video">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Film size={36} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-lg">Drag & drop a video</p>
                  <p className="text-zinc-500 text-sm mt-1">or click to browse</p>
                  <p className="text-zinc-600 text-xs mt-2">MP4, MOV, WEBM · Max 500 MB</p>
                </div>
                <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                  <Upload size={16} className="mr-2" />Browse files
                </Button>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={handleFilePick} data-testid="input-video-file" />
              </div>
            </div>
          )}

          {/* ── EDIT ── */}
          {step === "edit" && previewUrl && (
            <div className="flex-1 flex overflow-hidden">

              {/* LEFT: Vertical Tool Tabs */}
              <div className="hidden lg:flex flex-col w-14 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 overflow-y-auto py-2">
                {EDIT_TABS.map(tab => {
                  const Icon = tab.icon; const isActive = editTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setEditTab(tab.id)}
                      className={cn("flex flex-col items-center gap-1 py-2.5 px-1 text-[8.5px] font-medium transition-all border-r-2 -mr-px",
                        isActive ? "text-primary border-primary bg-primary/10" : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900")}
                      data-testid={`tab-edit-${tab.id}`} title={tab.label}>
                      <Icon size={16} />
                      <span className="leading-tight text-center">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* CENTER: Preview + Tool content */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Mobile horizontal tab bar */}
                <div className="lg:hidden flex border-b border-zinc-800 bg-zinc-950 overflow-x-auto flex-shrink-0">
                  {EDIT_TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button key={tab.id} onClick={() => setEditTab(tab.id)}
                        className={cn("flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors flex-shrink-0 border-b-2",
                          editTab === tab.id ? "text-primary border-primary" : "text-zinc-500 border-transparent hover:text-zinc-300")}
                        data-testid={`tab-edit-${tab.id}-mobile`}>
                        <Icon size={15} />{tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Preview + Tool content row */}
                <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

                  {/* Video preview pane */}
                  <div className="flex-shrink-0 lg:w-52 p-3 space-y-2 lg:overflow-y-auto lg:border-r lg:border-zinc-800">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {ASPECT_RATIOS.map(ar => (
                        <button key={ar.id} onClick={() => setAspectRatio(ar.id)}
                          className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[9px] font-medium transition-all border",
                            aspectRatio === ar.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-500")}
                          data-testid={`button-aspect-${ar.id.replace(":", "x")}`}>
                          <div className="border border-current rounded-sm" style={{ width: Math.round(ar.w * 4), height: Math.round(ar.h * 4) }} />
                          {ar.label}
                        </button>
                      ))}
                    </div>

                    {(() => {
                      const ar = ASPECT_RATIOS.find(a => a.id === aspectRatio)!;
                      return (
                        <div className="relative rounded-xl overflow-hidden bg-black mx-auto" style={{ aspectRatio: `${ar.w}/${ar.h}`, maxHeight: aspectRatio === "16:9" ? "10rem" : "42vh" }}>
                          <video ref={previewVideoRef} src={previewUrl} className="h-full w-full object-cover transition-all duration-300" autoPlay muted loop playsInline style={{ filter: cssFilter }} />

                          {vignette > 0 && <div className="absolute inset-0 pointer-events-none rounded-xl" style={{ boxShadow: `inset 0 0 ${vignette * 3}px ${vignette * 2}px rgba(0,0,0,0.7)` }} />}
                          {grain > 0 && <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`, opacity: grain / 200 }} />}

                          {/* Progress bar overlay */}
                          {progressBarEnabled && (
                            <div className="absolute top-0 left-0 right-0 h-1 bg-black/30">
                              <div className="h-full rounded-full" style={{ background: progressBarColor, width: "45%", animation: "studioProgressBar 3s linear infinite" }} />
                            </div>
                          )}

                          {/* Lower thirds overlay */}
                          {lowerThirdEnabled && lowerThirdText && (
                            <div className={cn("absolute bottom-0 left-0 right-0 px-2 py-1.5 studio-lower-third",
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
                            const fontStyle = TEXT_FONTS.find(f => f.id === layer.font)?.style ?? "inherit";
                            return (
                              <div key={layer.id} className={cn("absolute left-0 right-0 px-2 py-1 text-center drop-shadow-lg pointer-events-none",
                                layer.position === "top" && "top-6",
                                layer.position === "center" && "top-1/2 -translate-y-1/2",
                                layer.position === "bottom" && "bottom-6",
                                getAnimationClass(layer.animation))}
                                style={{ color: layer.color, fontSize: layer.size * 0.7, fontFamily: fontStyle, fontWeight: layer.font === "bold" ? 900 : 700, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                                {layer.text}
                              </div>
                            );
                          })}

                          {speed !== 1 && <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{SPEED_LABELS[speed]}</div>}
                          {muted && <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"><VolumeX size={9} /> Muted</div>}
                          {selectedTrack && !muted && <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"><Music size={9} />{selectedTrack === "custom" ? "Custom" : MUSIC_TRACKS.find(t => t.id === selectedTrack)?.label}</div>}
                          {filterPresetId !== "normal" && <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">{FILTER_PRESETS.find(p => p.id === filterPresetId)?.label}</div>}
                          {selectedTemplateId && <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-primary/80 text-white text-[9px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">{STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.emoji} {STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.label}</div>}
                        </div>
                      );
                    })()}

                    {editTab === "trim" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-zinc-500">
                          <span>{formatTime(trimStart)}</span>
                          <span className="text-primary font-medium">{formatTime(trimEnd - trimStart)}</span>
                          <span>{formatTime(trimEnd)}</span>
                        </div>
                        <div className="relative" ref={timelineRef}>
                          <div className="flex h-12 rounded-lg overflow-hidden bg-zinc-900">
                            {timelineFrames.length > 0
                              ? timelineFrames.map((frame, i) => <img key={i} src={frame} alt="" className="h-full flex-1 object-cover" draggable={false} />)
                              : Array.from({ length: 20 }).map((_, i) => <div key={i} className="h-full flex-1 bg-zinc-800 animate-pulse" />)}
                          </div>
                          <div className="absolute top-0 left-0 h-full bg-black/50 pointer-events-none" style={{ width: `${startPct}%` }} />
                          <div className="absolute top-0 right-0 h-full bg-black/50 pointer-events-none" style={{ width: `${100 - endPct}%` }} />
                          <div className="absolute top-0 h-full border-2 border-primary rounded-lg pointer-events-none" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
                          <div className="absolute top-0 h-full w-4 cursor-col-resize z-10 flex items-center justify-center" style={{ left: `calc(${startPct}% - 8px)` }} onMouseDown={(e) => handleTimelineMouseDown(e, "start")} onTouchStart={(e) => handleTouchStart(e, "start")} data-testid="handle-trim-start">
                            <div className="w-1 h-8 rounded-full bg-primary" />
                          </div>
                          <div className="absolute top-0 h-full w-4 cursor-col-resize z-10 flex items-center justify-center" style={{ left: `calc(${endPct}% - 8px)` }} onMouseDown={(e) => handleTimelineMouseDown(e, "end")} onTouchStart={(e) => handleTouchStart(e, "end")} data-testid="handle-trim-end">
                            <div className="w-1 h-8 rounded-full bg-primary" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tool content panel */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* ── TEMPLATES TAB ── */}
                    {editTab === "templates" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Clapperboard size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Studio Templates</h3>
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium ml-auto">PRO</span>
                        </div>
                        <p className="text-zinc-500 text-xs">One-tap complete look — applies filters, colors, and text overlays instantly.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {STUDIO_TEMPLATES.map(template => {
                            const isSelected = selectedTemplateId === template.id;
                            return (
                              <button key={template.id} onClick={() => applyTemplate(template)}
                                className={cn("flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]",
                                  isSelected ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-template-${template.id}`}>
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0", isSelected ? "bg-primary/20" : "bg-zinc-800")}>{template.emoji}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className={cn("text-sm font-semibold", isSelected ? "text-primary" : "text-white")}>{template.label}</p>
                                    <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1 py-0.5 rounded">{template.category}</span>
                                  </div>
                                  <p className="text-zinc-500 text-xs leading-tight">{template.description}</p>
                                  {template.textLayers && <p className="text-zinc-600 text-[10px] mt-1">+ {template.textLayers.length} text layer{template.textLayers.length > 1 ? "s" : ""}</p>}
                                </div>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse" />}
                              </button>
                            );
                          })}
                        </div>
                        {selectedTemplateId && (
                          <button onClick={() => { setSelectedTemplateId(null); resetFilters(); resetAdjust(); }} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
                            <RotateCcw size={11} /> Clear template
                          </button>
                        )}
                      </>
                    )}

                    {/* ── MOTION GRAPHICS TAB ── */}
                    {editTab === "motion" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Layers3 size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Motion Graphics</h3>
                          <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">KINETIC</span>
                        </div>
                        <p className="text-zinc-500 text-xs">Add animated text graphics. Each preset adds a text layer — edit it in the Text tab.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {MOTION_PRESETS.map(preset => {
                            const isSelected = selectedMotionId === preset.id;
                            return (
                              <button key={preset.id} onClick={() => applyMotionPreset(preset)}
                                className={cn("flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01] group",
                                  isSelected ? "border-purple-500 bg-purple-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-motion-${preset.id}`}>
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0", isSelected ? "bg-purple-500/20" : "bg-zinc-800")}>{preset.emoji}</div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-semibold", isSelected ? "text-purple-400" : "text-white")}>{preset.label}</p>
                                  <p className="text-zinc-500 text-xs truncate">{preset.description}</p>
                                  <div className="mt-1 flex items-center gap-1">
                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded">{preset.textStyle.animation}</span>
                                    <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded">{preset.textStyle.position}</span>
                                  </div>
                                </div>
                                <Plus size={14} className="text-zinc-600 group-hover:text-white transition-colors flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* ── EXPORT HUB TAB ── */}
                    {editTab === "export" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Share2 size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Platform Export Hub</h3>
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">6 PLATFORMS</span>
                        </div>
                        <p className="text-zinc-500 text-xs">Select your target platform to auto-configure aspect ratio and get platform-specific tips.</p>
                        <div className="space-y-2.5">
                          {PLATFORM_PROFILES.map(profile => {
                            const isSelected = selectedPlatform === profile.id;
                            return (
                              <button key={profile.id} onClick={() => applyPlatformProfile(profile)}
                                className={cn("w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all",
                                  isSelected ? "border-primary bg-primary/8" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-platform-${profile.id}`}>
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-br", profile.bgClass)}>{profile.emoji}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-white")}>{profile.label}</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono">{profile.aspectRatio}</span>
                                      <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{profile.fps}fps</span>
                                    </div>
                                  </div>
                                  <p className="text-zinc-500 text-[10px]">{profile.width}×{profile.height} · {profile.maxDuration > 0 ? `max ${profile.maxDuration}s` : "unlimited"} · {profile.maxSizeMB >= 1000 ? `${(profile.maxSizeMB/1024).toFixed(0)}GB` : `${profile.maxSizeMB}MB`}</p>
                                  {isSelected && (
                                    <div className="mt-2 space-y-1">
                                      {profile.tips.map((tip, i) => (
                                        <div key={i} className="flex items-start gap-1.5">
                                          <Star size={9} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                          <p className="text-zinc-400 text-[10px] leading-tight">{tip}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1 animate-pulse" />}
                              </button>
                            );
                          })}
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                          <p className="text-xs text-zinc-400 font-medium">Cross-Platform Strategy</p>
                          <div className="space-y-1.5">
                            {[
                              { icon: "🎵", tip: "TikTok first — highest organic reach for new creators" },
                              { icon: "📸", tip: "Repost to Instagram Reels within 24h for double exposure" },
                              { icon: "▶️", tip: "Upload to YT Shorts for long-tail search discoverability" },
                              { icon: "📌", tip: "Remove TikTok watermark before cross-posting (use SnapTik)" },
                            ].map(({ icon, tip }) => (
                              <div key={tip} className="flex items-start gap-2">
                                <span className="text-sm">{icon}</span>
                                <p className="text-zinc-500 text-[10px] leading-tight">{tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── VIRAL INTELLIGENCE TAB ── */}
                    {editTab === "viral" && (
                      <>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Viral Intelligence</h3>
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">AI POWERED</span>
                        </div>

                        {/* Viral Score Analyzer */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                          <div className="flex items-center gap-2">
                            <BarChart2 size={14} className="text-orange-400" />
                            <p className="text-white text-sm font-semibold">Viral Score Analyzer</p>
                          </div>
                          <p className="text-zinc-500 text-xs">AI analyzes your current settings and predicts viral potential across 4 dimensions.</p>

                          {viralScore !== null && viralBreakdown ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center">
                                <div className="relative w-24 h-24">
                                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                                    <circle cx="48" cy="48" r="40" fill="none" stroke="#27272a" strokeWidth="8" />
                                    <circle cx="48" cy="48" r="40" fill="none"
                                      stroke={viralScore >= 75 ? "#22c55e" : viralScore >= 50 ? "#f59e0b" : "#ef4444"}
                                      strokeWidth="8"
                                      strokeDasharray={`${2 * Math.PI * 40}`}
                                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - viralScore / 100)}`}
                                      strokeLinecap="round" className="transition-all duration-1000" />
                                  </svg>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center studio-viral-count">
                                    <span className="text-white font-bold text-2xl">{viralScore}</span>
                                    <span className="text-zinc-500 text-[9px]">/ 100</span>
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(viralBreakdown).map(([key, val]) => (
                                  <div key={key} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-zinc-400 text-[10px] capitalize">{key}</span>
                                      <span className="text-white text-[10px] font-bold">{val}/25</span>
                                    </div>
                                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(val / 25) * 100}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {viralPlatformBest && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                  <Star size={12} className="text-yellow-400 flex-shrink-0" />
                                  <p className="text-zinc-300 text-xs">Best platform: <span className="text-white font-semibold">{viralPlatformBest}</span></p>
                                </div>
                              )}
                              {viralTips.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wide">Improvement Tips</p>
                                  {viralTips.map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-800">
                                      <span className="text-primary text-xs font-bold flex-shrink-0">{i + 1}.</span>
                                      <p className="text-zinc-300 text-xs leading-tight">{tip}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={handleViralScore} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
                                <RotateCcw size={11} /> Re-analyze
                              </button>
                            </div>
                          ) : (
                            <Button onClick={handleViralScore} disabled={viralScoreLoading || aiAccessMode === "contact_admin"}
                              className="w-full bg-gradient-to-r from-orange-600 to-primary hover:opacity-90 text-white font-medium" size="sm"
                              data-testid="button-viral-score">
                              {viralScoreLoading
                                ? <><Sparkles size={14} className="mr-2 animate-spin" /> Analyzing…</>
                                : aiAccessMode === "contact_admin"
                                ? <><Lock size={14} className="mr-2" /> Unlock Viral Score</>
                                : <><TrendingUp size={14} className="mr-2" /> Analyze Viral Potential</>}
                            </Button>
                          )}
                        </div>

                        {/* Hook Library */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Target size={14} className="text-yellow-400" />
                            <p className="text-white text-sm font-semibold">Hook Library</p>
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full ml-auto">30 hooks</span>
                          </div>
                          <p className="text-zinc-500 text-xs">Proven first-3-second hooks. Click to copy and use in your caption or text overlay.</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {HOOK_CATEGORIES.map(cat => (
                              <button key={cat.id} onClick={() => setHookCategory(cat.id)}
                                className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                                  hookCategory === cat.id ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                data-testid={`button-hook-cat-${cat.id}`}>
                                {cat.emoji} {cat.label}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-2">
                            {HOOK_LIBRARY.filter(h => h.category === hookCategory).map(hook => (
                              <div key={hook.id} className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors group">
                                <p className="flex-1 text-zinc-300 text-xs leading-relaxed">{hook.text}</p>
                                <button onClick={() => copyToClipboard(hook.text, hook.id)}
                                  className={cn("flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                                    copiedKey === hook.id ? "bg-green-500 text-white" : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white")}
                                  data-testid={`button-copy-hook-${hook.id}`}>
                                  {copiedKey === hook.id ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Hashtag Packs */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-blue-400" />
                            <p className="text-white text-sm font-semibold">Hashtag Intelligence Packs</p>
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full ml-auto">8 packs</span>
                          </div>
                          <p className="text-zinc-500 text-xs">Curated hashtag packs for each niche. Click "Copy All" to paste into your caption.</p>
                          <div className="space-y-2">
                            {HASHTAG_PACKS.map(pack => {
                              const isOpen = selectedHashtagPack === pack.id;
                              const allTags = pack.tags.join(" ");
                              return (
                                <div key={pack.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                                  <button onClick={() => setSelectedHashtagPack(isOpen ? null : pack.id)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/50 transition-colors text-left"
                                    data-testid={`button-hashtag-pack-${pack.id}`}>
                                    <span className="text-xl">{pack.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm font-medium">{pack.label}</p>
                                      <p className="text-zinc-500 text-[10px]">{pack.platform} · {pack.tags.length} tags</p>
                                    </div>
                                    <ChevronDown size={14} className={cn("text-zinc-500 transition-transform", isOpen && "rotate-180")} />
                                  </button>
                                  {isOpen && (
                                    <div className="border-t border-zinc-800 p-3 space-y-2">
                                      <div className="flex flex-wrap gap-1">
                                        {pack.tags.map(tag => (
                                          <span key={tag} className="text-[10px] bg-zinc-800 text-blue-400 px-1.5 py-0.5 rounded-full">{tag}</span>
                                        ))}
                                      </div>
                                      <button onClick={() => copyToClipboard(allTags, `pack-${pack.id}`)}
                                        className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                                          copiedKey === `pack-${pack.id}` ? "bg-green-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white")}
                                        data-testid={`button-copy-pack-${pack.id}`}>
                                        {copiedKey === `pack-${pack.id}` ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy all {pack.tags.length} tags</>}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Trending Formats */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <Bookmark size={14} className="text-pink-400" />
                            <p className="text-white text-sm font-semibold">Trending Formats Now</p>
                          </div>
                          <div className="space-y-2">
                            {[
                              { platform: "TikTok", format: "POV storytelling",     tip: "First-person hooks with emotional reveal" },
                              { platform: "IG Reels", format: "Transitions showcase",tip: "Fast-cut B-roll with trending audio" },
                              { platform: "YT Shorts",format: "Before/After reveals",tip: "Split-screen or consecutive transformation" },
                              { platform: "All",      format: "Silent demo videos",  tip: "No talking, just visuals + text overlays" },
                              { platform: "TikTok",  format: "Stitch response",      tip: "React to viral content in your niche" },
                            ].map(({ platform, format, tip }) => (
                              <div key={format} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">{platform}</span>
                                  <span className="text-zinc-300 text-xs font-medium">{format}</span>
                                </div>
                                <p className="text-zinc-500 text-[10px] leading-tight">{tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── TRANSITIONS TAB ── */}
                    {editTab === "transitions" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Shuffle size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Transition Library</h3>
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium ml-auto">25 types</span>
                        </div>
                        <p className="text-zinc-500 text-xs">Professional transitions for every style. Select one to tag it for your edit — note the timing and best use case.</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {TRANSITION_CATEGORIES.map(cat => (
                            <button key={cat.id} onClick={() => setTransitionCategory(cat.id)}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                                transitionCategory === cat.id ? "border-primary bg-primary/15 text-primary" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                              data-testid={`button-transition-cat-${cat.id}`}>
                              {cat.emoji} {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {TRANSITIONS.filter(t => t.category === transitionCategory).map(transition => {
                            const isSelected = selectedTransition === transition.id;
                            return (
                              <button key={transition.id} onClick={() => { setSelectedTransition(t => t === transition.id ? null : transition.id); if (selectedTransition !== transition.id) toast({ title: `${transition.emoji} ${transition.label}`, description: `${transition.timing} · Best for: ${transition.bestFor}` }); }}
                                className={cn("flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]",
                                  isSelected ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-transition-${transition.id}`}>
                                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0", isSelected ? "bg-primary/20" : "bg-zinc-800")}>{transition.emoji}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className={cn("text-sm font-semibold", isSelected ? "text-primary" : "text-white")}>{transition.label}</p>
                                    <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-mono">{transition.timing}</span>
                                  </div>
                                  <p className="text-zinc-500 text-xs leading-tight">{transition.description}</p>
                                  <p className="text-zinc-600 text-[10px] mt-0.5 truncate">Best: {transition.bestFor}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {selectedTransition && (
                          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-2">
                            <Check size={14} className="text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-medium">
                                {TRANSITIONS.find(t => t.id === selectedTransition)?.emoji} {TRANSITIONS.find(t => t.id === selectedTransition)?.label} selected
                              </p>
                              <p className="text-zinc-400 text-[10px]">{TRANSITIONS.find(t => t.id === selectedTransition)?.bestFor}</p>
                            </div>
                            <button onClick={() => setSelectedTransition(null)} className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"><X size={12} /></button>
                          </div>
                        )}
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                          <p className="text-xs text-zinc-400 font-medium mb-2">Pro Transition Tips</p>
                          <div className="space-y-1.5">
                            {["Match cut: find similar shapes/colors in consecutive clips for invisible cuts", "J-cut: let audio from the next clip bleed in before the video cuts — feels cinematic", "Beat sync: cut exactly on the 1-beat or drop for maximum impact", "Rule of 3: limit transitions in one video to max 3 types for cohesion"].map(tip => (
                              <div key={tip} className="flex items-start gap-1.5">
                                <Star size={9} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                                <p className="text-zinc-500 text-[10px] leading-tight">{tip}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── BRAND KIT TAB ── */}
                    {editTab === "brand" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Paintbrush size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Brand Kit</h3>
                          <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">IDENTITY</span>
                        </div>

                        {/* Brand Colors */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                          <p className="text-white text-sm font-semibold">Brand Palette</p>
                          <p className="text-zinc-500 text-xs">Set your 6 brand colors. "Apply to layers" stamps them across all text overlays.</p>
                          <div className="grid grid-cols-6 gap-2">
                            {brandColors.map((color, i) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="relative w-10 h-10 rounded-xl border-2 border-zinc-700 overflow-hidden hover:border-primary transition-colors cursor-pointer" onClick={() => { const input = document.getElementById(`brand-color-${i}`) as HTMLInputElement; input?.click(); }}>
                                  <div className="w-full h-full" style={{ backgroundColor: color }} />
                                  <input id={`brand-color-${i}`} type="color" value={color} onChange={e => setBrandColors(prev => { const next = [...prev]; next[i] = e.target.value; return next; })} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={`input-brand-color-${i}`} />
                                </div>
                                <span className="text-zinc-600 text-[8px] font-mono">{color.slice(1).toUpperCase()}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Brand Font</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {TEXT_FONTS.map(f => (
                                <button key={f.id} onClick={() => setBrandFont(f.id)}
                                  className={cn("py-1.5 rounded-lg text-xs font-medium transition-all border", brandFont === f.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                  style={{ fontFamily: f.style }} data-testid={`button-brand-font-${f.id}`}>
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Button onClick={applyBrandToAllLayers} variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:border-primary" size="sm" data-testid="button-apply-brand">
                            <Paintbrush size={14} className="mr-2" /> Apply Brand to All Text Layers
                          </Button>
                        </div>

                        {/* Logo Watermark */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <p className="text-white text-sm font-semibold">Logo / Watermark</p>
                          <input type="text" placeholder="@yourhandle or brand name…" value={logoWatermark} onChange={e => setLogoWatermark(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary transition-colors"
                            data-testid="input-logo-watermark" />
                          <p className="text-xs text-zinc-500">Position</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {["top-left","top-center","top-right","center-left","center","center-right","bottom-left","bottom-center","bottom-right"].map(pos => (
                              <button key={pos} onClick={() => setLogoPosition(pos)}
                                className={cn("py-2 rounded-lg text-[10px] font-medium transition-all border capitalize",
                                  logoPosition === pos ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-500")}
                                data-testid={`button-logo-pos-${pos}`}>
                                {pos.replace(/-/g, " ")}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Lower Thirds */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlignLeft size={14} className="text-cyan-400" />
                              <p className="text-white text-sm font-semibold">Lower Thirds</p>
                            </div>
                            <button onClick={() => setLowerThirdEnabled(e => !e)}
                              className={cn("w-12 h-6 rounded-full transition-all relative", lowerThirdEnabled ? "bg-primary" : "bg-zinc-700")}
                              data-testid="toggle-lower-third">
                              <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", lowerThirdEnabled ? "left-6" : "left-0.5")} />
                            </button>
                          </div>
                          {lowerThirdEnabled && (
                            <>
                              <input type="text" placeholder="Name · Title · Label…" value={lowerThirdText} onChange={e => setLowerThirdText(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-cyan-400 transition-colors"
                                data-testid="input-lower-third-text" />
                              <div className="grid grid-cols-2 gap-2">
                                {LOWER_THIRDS_STYLES.map(style => (
                                  <button key={style.id} onClick={() => setLowerThirdStyle(style.id)}
                                    className={cn("flex flex-col items-start gap-1 p-2.5 rounded-xl border-2 text-left transition-all",
                                      lowerThirdStyle === style.id ? "border-cyan-400 bg-cyan-400/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600")}
                                    data-testid={`button-lower-third-${style.id}`}>
                                    <div className={cn("w-full h-2 rounded-sm", style.preview)}></div>
                                    <p className={cn("text-xs font-medium", lowerThirdStyle === style.id ? "text-cyan-400" : "text-zinc-300")}>{style.label}</p>
                                    <p className="text-zinc-600 text-[9px]">{style.description}</p>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm font-semibold">Progress Bar</p>
                              <p className="text-zinc-500 text-xs">Thin bar at top — shows video progress</p>
                            </div>
                            <button onClick={() => setProgressBarEnabled(e => !e)}
                              className={cn("w-12 h-6 rounded-full transition-all relative", progressBarEnabled ? "bg-primary" : "bg-zinc-700")}
                              data-testid="toggle-progress-bar">
                              <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", progressBarEnabled ? "left-6" : "left-0.5")} />
                            </button>
                          </div>
                          {progressBarEnabled && (
                            <div>
                              <p className="text-xs text-zinc-500 mb-2">Bar Color</p>
                              <div className="flex gap-2 flex-wrap">
                                {["#ffffff","#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#39ff14"].map(c => (
                                  <button key={c} onClick={() => setProgressBarColor(c)}
                                    className={cn("w-7 h-7 rounded-full border-2 transition-all", progressBarColor === c ? "border-white scale-110" : "border-transparent")}
                                    style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #555" : undefined }}
                                    data-testid={`button-progress-color-${c.replace("#","")}`} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* ── TRIM TAB ── */}
                    {editTab === "trim" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Scissors size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Trim Video</h3>
                          <span className="text-zinc-500 text-xs ml-auto">{formatTime(trimStart)} – {formatTime(trimEnd)} · {formatTime(trimEnd - trimStart)}</span>
                        </div>
                        <p className="text-zinc-500 text-xs">Drag the timeline handles in the preview panel to set start/end points.</p>
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Image size={14} className="text-primary" />
                            <h3 className="text-white font-semibold text-sm">Cover Thumbnail</h3>
                          </div>
                          <div className="grid grid-cols-6 gap-2">
                            {thumbnails.length > 0
                              ? thumbnails.map((thumb, i) => (
                                  <button key={i} onClick={() => { setSelectedCover(i); setCoverDataUrl(thumb); }}
                                    className={cn("aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all", i === selectedCover ? "border-primary ring-2 ring-primary/30 scale-105" : "border-zinc-700 hover:border-zinc-500")}
                                    data-testid={`button-cover-${i}`}>
                                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                                  </button>
                                ))
                              : Array.from({ length: THUMBNAIL_COUNT }).map((_, i) => <div key={i} className="aspect-[3/4] rounded-lg bg-zinc-800 animate-pulse border-2 border-zinc-700" />)}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── FILTERS TAB ── */}
                    {editTab === "filters" && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal size={14} className="text-primary" />
                            <h3 className="text-white font-semibold text-sm">Visual Filters</h3>
                          </div>
                          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors" data-testid="button-reset-filters">
                            <RotateCcw size={12} /> Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {FILTER_PRESETS.map(preset => {
                            const previewFilter = buildCssFilter(preset, 0, 0, 0);
                            return (
                              <button key={preset.id} onClick={() => setFilterPresetId(preset.id)}
                                className={cn("flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all border-2", filterPresetId === preset.id ? "border-primary bg-primary/10" : "border-transparent hover:border-zinc-600")}
                                data-testid={`button-filter-${preset.id}`}>
                                <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800">
                                  {timelineFrames[0]
                                    ? <img src={timelineFrames[0]} alt="" className="w-full h-full object-cover" style={{ filter: previewFilter }} />
                                    : <div className="w-full h-full" style={{ background: `hsl(${preset.hueRotate}, 50%, ${40 + preset.brightness}%)` }} />}
                                </div>
                                <span className={cn("text-xs font-medium", filterPresetId === preset.id ? "text-primary" : "text-zinc-400")}>{preset.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="space-y-4 pt-2">
                          {[
                            { label: "Brightness", value: brightness, set: setBrightness, min: -50, max: 50 },
                            { label: "Contrast",   value: contrast,   set: setContrast,   min: -50, max: 50 },
                            { label: "Saturation", value: saturation, set: setSaturation, min: -100, max: 100 },
                          ].map(({ label, value, set, min, max }) => (
                            <div key={label}>
                              <div className="flex justify-between mb-1.5">
                                <span className="text-sm text-zinc-300">{label}</span>
                                <span className="text-xs text-zinc-500 tabular-nums">{value > 0 ? "+" : ""}{value}</span>
                              </div>
                              <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => set(v)} className="w-full" data-testid={`slider-${label.toLowerCase()}`} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* ── ADJUST TAB ── */}
                    {editTab === "adjust" && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Palette size={14} className="text-primary" />
                            <h3 className="text-white font-semibold text-sm">Advanced Adjust</h3>
                          </div>
                          <button onClick={resetAdjust} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors" data-testid="button-reset-adjust">
                            <RotateCcw size={12} /> Reset
                          </button>
                        </div>
                        <div className="space-y-4">
                          {[
                            { label: "Warmth",     icon: Sun,             value: warmth,     set: setWarmth,     min: -100, max: 100 },
                            { label: "Highlights", icon: Sun,             value: highlights, set: setHighlights, min: -100, max: 100 },
                            { label: "Shadows",    icon: Droplets,        value: shadows,    set: setShadows,    min: -100, max: 100 },
                            { label: "Vignette",   icon: Wind,            value: vignette,   set: setVignette,   min: 0,    max: 50  },
                            { label: "Grain",      icon: FlipHorizontal2, value: grain,      set: setGrain,      min: 0,    max: 100 },
                          ].map(({ label, icon: Icon, value, set, min, max }) => (
                            <div key={label}>
                              <div className="flex justify-between mb-1.5">
                                <div className="flex items-center gap-1.5"><Icon size={11} className="text-zinc-400" /><span className="text-sm text-zinc-300">{label}</span></div>
                                <span className="text-xs text-zinc-500 tabular-nums">{value > 0 ? "+" : ""}{value}</span>
                              </div>
                              <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => set(v)} className="w-full" data-testid={`slider-${label.toLowerCase()}`} />
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                            <div><p className="text-white text-sm font-medium">Sharpen</p><p className="text-zinc-500 text-xs">Enhance edge definition</p></div>
                            <button onClick={() => setSharpen(s => !s)} className={cn("w-12 h-6 rounded-full transition-all relative", sharpen ? "bg-primary" : "bg-zinc-700")} data-testid="toggle-sharpen">
                              <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", sharpen ? "left-6" : "left-0.5")} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── SPEED TAB ── */}
                    {editTab === "speed" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Gauge size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Playback Speed</h3>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {SPEED_OPTIONS.map(s => (
                            <button key={s} onClick={() => setSpeed(s)}
                              className={cn("flex-1 min-w-[52px] py-3 rounded-xl text-sm font-bold transition-all border-2", speed === s ? "border-primary bg-primary/15 text-primary" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white")}
                              data-testid={`button-speed-${s}`}>
                              {SPEED_LABELS[s]}
                            </button>
                          ))}
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                          <p className="text-zinc-400 text-xs leading-relaxed">
                            {speed < 1 ? `Slow motion at ${SPEED_LABELS[speed]} — great for highlighting tricks and moves.` : speed > 1 ? `Fast forward at ${SPEED_LABELS[speed]} — perfect for timelapse and energy.` : "Normal speed — no change to original video."}
                          </p>
                          {speed <= 0.5 && <p className="text-yellow-400 text-[10px]">💡 Pro tip: Combine with a bass-hit sound effect for maximum impact</p>}
                          {speed >= 2 && <p className="text-yellow-400 text-[10px]">💡 Pro tip: Great for showing a full day in 60 seconds</p>}
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                          <div className="flex items-center gap-3">
                            {muted ? <VolumeX size={18} className="text-zinc-400" /> : <Volume2 size={18} className="text-white" />}
                            <div><p className="text-white text-sm font-medium">Audio</p><p className="text-zinc-500 text-xs">{muted ? "Audio removed" : "Original audio kept"}</p></div>
                          </div>
                          <button onClick={() => setMuted(m => !m)} className={cn("w-12 h-6 rounded-full transition-all relative", muted ? "bg-zinc-700" : "bg-primary")} data-testid="toggle-audio-mute">
                            <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", muted ? "left-0.5" : "left-6")} />
                          </button>
                        </div>
                      </>
                    )}

                    {/* ── AUDIO TAB ── */}
                    {editTab === "audio" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Music size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Audio</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Original Audio</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {muted ? <VolumeX size={18} className="text-zinc-500" /> : <Volume2 size={18} className="text-white" />}
                              <div><p className="text-white text-sm font-medium">Original Sound</p><p className="text-zinc-500 text-xs">{muted ? "Muted" : `Volume ${audioVolume}%`}</p></div>
                            </div>
                            <button onClick={() => setMuted(m => !m)} className={cn("w-12 h-6 rounded-full transition-all relative", muted ? "bg-zinc-700" : "bg-primary")} data-testid="toggle-audio-mute">
                              <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", muted ? "left-0.5" : "left-6")} />
                            </button>
                          </div>
                          {!muted && (
                            <div>
                              <div className="flex justify-between mb-2"><span className="text-xs text-zinc-400">Volume</span><span className="text-xs text-zinc-500">{audioVolume}%</span></div>
                              <Slider min={0} max={100} step={5} value={[audioVolume]} onValueChange={([v]) => setAudioVolume(v)} className="w-full" data-testid="slider-audio-volume" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Background Music</p>
                          <button onClick={() => audioFileInputRef.current?.click()}
                            className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left", selectedTrack === "custom" ? "border-primary bg-primary/10" : "border-dashed border-zinc-700 hover:border-zinc-500")}
                            data-testid="button-upload-audio">
                            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0"><Mic size={16} className="text-zinc-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium">{customAudioFile ? customAudioFile.name : "Upload your music"}</p>
                              <p className="text-zinc-500 text-xs">MP3, M4A, WAV</p>
                            </div>
                            {selectedTrack === "custom" && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          </button>
                          <input ref={audioFileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleCustomAudio} data-testid="input-audio-file" />
                          <div className="space-y-2">
                            {MUSIC_TRACKS.map(track => (
                              <button key={track.id} onClick={() => setSelectedTrack(t => t === track.id ? null : track.id)}
                                className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", selectedTrack === track.id ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-track-${track.id}`}>
                                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", selectedTrack === track.id ? "bg-primary" : "bg-zinc-800")}>
                                  <Music size={14} className={selectedTrack === track.id ? "text-white" : "text-zinc-400"} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium">{track.label}</p>
                                  <p className="text-zinc-500 text-xs">{track.genre} · {track.bpm} BPM</p>
                                </div>
                                {selectedTrack === track.id && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── SOUNDS TAB ── */}
                    {editTab === "sounds" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Music2 size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Sound Library</h3>
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium ml-auto">FX</span>
                        </div>
                        <p className="text-zinc-500 text-xs">Professional sound effects for transitions, impacts, and cinematic moments.</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {SOUND_CATEGORIES.map(cat => (
                            <button key={cat.id} onClick={() => setSoundCategory(cat.id)}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                                soundCategory === cat.id ? "border-primary bg-primary/15 text-primary" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                              data-testid={`button-sound-cat-${cat.id}`}>
                              {cat.emoji} {cat.label}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2">
                          {SOUND_LIBRARY.filter(s => s.category === soundCategory).map(sound => {
                            const isSelected = selectedSoundFx === sound.id;
                            return (
                              <button key={sound.id} onClick={() => { setSelectedSoundFx(s => s === sound.id ? null : sound.id); if (selectedSoundFx !== sound.id) toast({ title: `${sound.emoji} ${sound.label} selected`, description: `${sound.duration} · ${sound.mood}` }); }}
                                className={cn("w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left", isSelected ? "border-blue-500 bg-blue-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600")}
                                data-testid={`button-sound-${sound.id}`}>
                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0", isSelected ? "bg-blue-500/20" : "bg-zinc-800")}>{sound.emoji}</div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium", isSelected ? "text-blue-400" : "text-white")}>{sound.label}</p>
                                  <p className="text-zinc-500 text-xs">{sound.duration} · {sound.mood}</p>
                                </div>
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", isSelected ? "border-blue-500 bg-blue-500/20" : "border-zinc-700 bg-zinc-800")}>
                                  {isSelected ? <Square size={12} className="text-blue-400" /> : <Play size={12} className="text-zinc-400" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* ── TEXT TAB ── */}
                    {editTab === "text" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Type size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Text Overlays</h3>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                          <input type="text" placeholder="Type your text…" value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTextLayer()} maxLength={60}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary transition-colors"
                            data-testid="input-text-overlay" />
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Color</p>
                            <div className="flex gap-2 flex-wrap">
                              {TEXT_COLORS.map(c => (
                                <button key={c} onClick={() => setTextColor(c)}
                                  className={cn("w-7 h-7 rounded-full border-2 transition-all", textColor === c ? "border-white scale-110" : "border-transparent")}
                                  style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #555" : undefined }}
                                  data-testid={`button-text-color-${c.replace("#", "")}`} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between mb-1.5"><p className="text-xs text-zinc-500">Size</p><span className="text-xs text-zinc-400">{textSize}px</span></div>
                            <Slider min={16} max={56} step={2} value={[textSize]} onValueChange={([v]) => setTextSize(v)} className="w-full" data-testid="slider-text-size" />
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Font</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {TEXT_FONTS.map(f => (
                                <button key={f.id} onClick={() => setTextFont(f.id)}
                                  className={cn("py-1.5 rounded-lg text-xs font-medium transition-all border", textFont === f.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                  style={{ fontFamily: f.style }} data-testid={`button-font-${f.id}`}>{f.label}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Animation</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {TEXT_ANIMATIONS.map(a => (
                                <button key={a.id} onClick={() => setTextAnimation(a.id)}
                                  className={cn("py-1.5 rounded-lg text-xs font-medium transition-all border", textAnimation === a.id ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                  data-testid={`button-anim-${a.id}`}>{a.label}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 mb-2">Position</p>
                            <div className="flex gap-2">
                              {(["top","center","bottom"] as const).map(pos => (
                                <button key={pos} onClick={() => setTextPosition(pos)}
                                  className={cn("flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border", textPosition === pos ? "border-primary text-primary bg-primary/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                  data-testid={`button-text-pos-${pos}`}>{pos}</button>
                              ))}
                            </div>
                          </div>
                          <Button onClick={() => addTextLayer()} disabled={!textInput.trim()} className="w-full bg-primary hover:bg-primary/90 text-white" size="sm" data-testid="button-add-text">
                            <Plus size={14} className="mr-1" /> Add Text
                          </Button>
                        </div>
                        {textLayers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-500">Added layers ({textLayers.length})</p>
                            {textLayers.map(layer => (
                              <div key={layer.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                                <div className="w-4 h-4 rounded-full flex-shrink-0 border border-zinc-600" style={{ backgroundColor: layer.color }} />
                                <span className="flex-1 text-white text-sm font-medium truncate">{layer.text}</span>
                                <span className="text-zinc-500 text-xs hidden sm:block">{layer.position} · {layer.animation}</span>
                                <button onClick={() => removeTextLayer(layer.id)} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid={`button-remove-text-${layer.id}`}><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        {textLayers.length === 0 && <div className="text-center py-6 text-zinc-600 text-sm">No text overlays yet.</div>}
                      </>
                    )}

                    {/* ── STICKERS TAB ── */}
                    {editTab === "stickers" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Smile size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">Urban Stickers</h3>
                        </div>
                        <p className="text-zinc-500 text-xs">Tap a sticker to add it to your video.</p>
                        <div className="grid grid-cols-8 gap-2">
                          {URBAN_STICKERS.map((emoji, i) => (
                            <button key={i} onClick={() => addSticker(emoji)}
                              className="text-2xl h-11 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-primary hover:bg-zinc-800 transition-all hover:scale-110 active:scale-95"
                              data-testid={`button-sticker-${i}`}>{emoji}</button>
                          ))}
                        </div>
                        {stickerLayers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-500">Added stickers</p>
                            {stickerLayers.map(s => (
                              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                                <span className="text-2xl">{s.emoji}</span>
                                <div className="flex-1 text-zinc-400 text-xs">Position {Math.round(s.x)}%, {Math.round(s.y)}%</div>
                                <div className="flex items-center gap-2 w-28">
                                  <Slider min={20} max={80} step={4} value={[s.size]} onValueChange={([v]) => setStickerLayers(prev => prev.map(st => st.id === s.id ? { ...st, size: v } : st))} className="flex-1" />
                                </div>
                                <button onClick={() => removeSticker(s.id)} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid={`button-remove-sticker-${s.id}`}><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        {stickerLayers.length === 0 && <div className="text-center py-6 text-zinc-600 text-sm">Tap any sticker above to add it</div>}
                      </>
                    )}

                    {/* ── AI TOOLS TAB ── */}
                    {editTab === "aitools" && (
                      <>
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-primary" />
                          <h3 className="text-white font-semibold text-sm">AI Tools</h3>
                          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium ml-auto">AI</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-purple-400" />
                            <p className="text-white text-sm font-semibold">Auto-Subtitles</p>
                          </div>
                          <p className="text-zinc-500 text-xs">AI generates subtitle lines and adds them as animated text layers.</p>
                          <div>
                            <p className="text-xs text-zinc-400 mb-2">Style</p>
                            <div className="grid grid-cols-4 gap-2">
                              {(["bold","minimal","neon","classic"] as const).map(style => (
                                <button key={style} onClick={() => setAiSubtitleStyle(style)}
                                  className={cn("py-2 rounded-lg text-xs font-medium capitalize border transition-all", aiSubtitleStyle === style ? "border-purple-400 text-purple-400 bg-purple-400/10" : "border-zinc-700 text-zinc-400 hover:border-zinc-500")}
                                  data-testid={`button-subtitle-style-${style}`}>{style}</button>
                              ))}
                            </div>
                          </div>
                          <input type="text" placeholder="Describe your video (e.g. 'bboy battle rooftop Amsterdam')…" value={aiHint} onChange={(e) => setAiHint(e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-purple-400 transition-colors"
                            data-testid="input-ai-subtitle-hint" />
                          <Button onClick={handleGenerateSubtitles} disabled={aiSubtitleLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-primary hover:opacity-90 text-white font-medium" size="sm" data-testid="button-generate-subtitles">
                            {aiSubtitleLoading ? <><Sparkles size={14} className="mr-2 animate-spin" /> Generating…</> : <><Sparkles size={14} className="mr-2" /> Generate Auto-Subtitles</>}
                          </Button>
                          {aiSubtitles.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-xs text-zinc-500">{aiSubtitles.length} subtitle lines added</p>
                              {aiSubtitles.map((line, i) => <div key={i} className="text-xs text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2 border-l-2 border-purple-400">{line}</div>)}
                            </div>
                          )}
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <Wand2 size={14} className="text-yellow-400" />
                            <p className="text-white text-sm font-semibold">Smart Enhance</p>
                          </div>
                          <p className="text-zinc-500 text-xs">One-tap optimized looks for different content types.</p>
                          <div className="grid grid-cols-1 gap-2">
                            {[
                              { label: "Street Look",   action: () => { setFilterPresetId("vivid"); setContrast(10); setSaturation(15); setHighlights(-10); setShadows(15); setWarmth(10); toast({ title: "Street Look applied!" }); }, icon: "🏙️" },
                              { label: "Cinematic",     action: () => { setFilterPresetId("cinema"); setContrast(20); setSaturation(-10); setVignette(20); setShadows(20); toast({ title: "Cinematic mode applied!" }); }, icon: "🎬" },
                              { label: "Aesthetic Matte",action: () => { setFilterPresetId("matte"); setHighlights(-20); setSaturation(-20); setWarmth(15); toast({ title: "Aesthetic Matte applied!" }); }, icon: "🎞️" },
                              { label: "Vibrant Pop",   action: () => { setFilterPresetId("vivid"); setContrast(25); setSaturation(40); setBrightness(5); toast({ title: "Vibrant Pop applied!" }); }, icon: "🌈" },
                              { label: "Dark Drama",    action: () => { setFilterPresetId("dramatic"); setContrast(35); setBrightness(-15); setVignette(30); setGrain(20); toast({ title: "Dark Drama applied!" }); }, icon: "🌑" },
                            ].map(({ label, action, icon }) => (
                              <Button key={label} onClick={action} variant="outline" className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 justify-start" size="sm">
                                <span className="mr-2">{icon}</span>{label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-green-400" />
                            <p className="text-white text-sm font-semibold">Content Planner</p>
                          </div>
                          <p className="text-zinc-500 text-xs">Best posting times for maximum engagement by platform.</p>
                          <div className="space-y-2">
                            {[
                              { platform: "TikTok",    times: "6–10 AM, 7–9 PM", days: "Tue–Thu, Fri" },
                              { platform: "IG Reels",  times: "9 AM–1 PM, 7–9 PM", days: "Mon–Wed" },
                              { platform: "YT Shorts", times: "2–4 PM, 8–11 PM", days: "Thu–Sat" },
                            ].map(({ platform, times, days }) => (
                              <div key={platform} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800 border border-zinc-700">
                                <div className="flex-1"><p className="text-white text-xs font-semibold">{platform}</p><p className="text-zinc-500 text-[10px]">{times}</p></div>
                                <span className="text-zinc-500 text-[10px]">{days}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                </div>
              </div>

              {/* RIGHT: AI Creative Director Panel */}
              <div className={cn("hidden lg:flex flex-col border-l border-zinc-800 bg-zinc-950 transition-all duration-300 flex-shrink-0", aiPanelOpen ? "w-72" : "w-10")}>
                <button onClick={() => setAiPanelOpen(o => !o)}
                  className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 hover:bg-zinc-900 transition-colors w-full text-left"
                  data-testid="button-toggle-ai-panel">
                  {aiPanelOpen ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Bot size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-white">AI Creative Director</span>
                        {aiAccessMode === "contact_admin" && <Lock size={10} className="text-zinc-500" />}
                      </div>
                      <ChevronDown size={14} className="text-zinc-500 rotate-[-90deg]" />
                    </>
                  ) : (
                    <Bot size={16} className="text-primary mx-auto" />
                  )}
                </button>

                {aiPanelOpen && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {aiAccessMode === "contact_admin" ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3"><Lock size={20} className="text-zinc-500" /></div>
                        <p className="text-white text-sm font-semibold mb-1">AI Assistant Locked</p>
                        <p className="text-zinc-500 text-xs leading-relaxed">Contact your admin to unlock the AI Creative Director for personalized advice.</p>
                        <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-left w-full">
                          <p className="text-xs text-zinc-500 font-medium mb-2">What you'd unlock:</p>
                          {["Hook & caption writing","Hashtag strategy","Edit style advice","Viral score analysis","Platform growth tips","B-roll suggestions","Cross-post strategy","Collab ideas"].map(item => (
                            <div key={item} className="flex items-center gap-2 mb-1">
                              <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                              <span className="text-xs text-zinc-400">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-2 border-b border-zinc-800 flex gap-1 flex-wrap">
                          {AI_QUICK_ACTIONS.map(action => (
                            <button key={action.label} onClick={() => handleAiAssist(action.prompt)} disabled={aiAssistLoading}
                              className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              data-testid={`button-ai-quick-${action.label.toLowerCase().replace(/\s/g, "-")}`}>
                              {action.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                          {aiMessages.map((msg, i) => (
                            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
                              {msg.role === "assistant" && (
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Bot size={12} className="text-primary" />
                                </div>
                              )}
                              <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed", msg.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-200 rounded-tl-sm")}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {aiAssistLoading && (
                            <div className="flex gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <Bot size={12} className="text-primary animate-pulse" />
                              </div>
                              <div className="bg-zinc-800 rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            </div>
                          )}
                          <div ref={aiChatEndRef} />
                        </div>
                        <div className="p-2 border-t border-zinc-800">
                          <div className="flex gap-2 items-end">
                            <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiAssist(aiInput); } }}
                              placeholder="Ask anything about your video…" rows={2}
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-white text-xs placeholder:text-zinc-500 outline-none focus:border-primary transition-colors resize-none"
                              data-testid="input-ai-assistant" />
                            <button onClick={() => handleAiAssist(aiInput)} disabled={!aiInput.trim() || aiAssistLoading}
                              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0"
                              data-testid="button-ai-send">
                              <Send size={14} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── CAPTION ── */}
          {step === "caption" && (
            <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
              <div className="w-full max-w-lg space-y-5">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wand2 size={15} className="text-primary" />
                    <h3 className="text-white font-semibold text-sm">AI Caption Generator</h3>
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium ml-auto">AI</span>
                  </div>
                  <input type="text" placeholder="Hint: e.g. 'breakdance battle in Amsterdam'…" value={aiHint} onChange={(e) => setAiHint(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-500 outline-none focus:border-primary transition-colors"
                    data-testid="input-ai-hint" />
                  <Button onClick={handleAiCaption} disabled={aiLoading} className="w-full bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 text-white font-medium" size="sm" data-testid="button-ai-caption">
                    {aiLoading ? <><Sparkles size={14} className="mr-2 animate-spin" /> Generating…</> : <><Sparkles size={14} className="mr-2" /> Generate Caption & Hashtags</>}
                  </Button>
                </div>

                {selectedPlatform && (
                  <div className={cn("p-3 rounded-xl border bg-gradient-to-r", PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.bgClass, "border-zinc-700")}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.emoji}</span>
                      <p className="text-white text-sm font-semibold">{PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.label} Tips</p>
                    </div>
                    <div className="space-y-1">
                      {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <Star size={9} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                          <p className="text-zinc-300 text-xs">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Type size={16} className="text-primary" />
                    <h3 className="text-white font-semibold text-sm">Caption</h3>
                  </div>
                  <Textarea placeholder="Write a caption… #hiphop #breaking #streetculture" value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                    className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-28 text-base" data-testid="input-reel-caption" />
                  <div className="flex justify-between items-center mt-2">
                    <div className="text-sm text-zinc-300">{caption && <span>{highlightHashtags(caption)}</span>}</div>
                    <span className={cn("text-xs font-medium", caption.length > MAX_CAPTION * 0.9 ? "text-red-400" : "text-zinc-500")}>{caption.length}/{MAX_CAPTION}</span>
                  </div>
                </div>

                {previewUrl && (
                  <div className="flex items-center gap-4 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="w-16 h-24 rounded-lg overflow-hidden bg-black flex-shrink-0">
                      {coverDataUrl ? <img src={coverDataUrl} alt="" className="w-full h-full object-cover" /> : <video src={previewUrl} className="w-full h-full object-cover" muted playsInline />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{file?.name || "Video"}</p>
                      <p className="text-zinc-500 text-xs mt-1">{formatTime(trimEnd - trimStart)} · {file ? formatSize(file.size) : ""}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {filterPresetId !== "normal" && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{FILTER_PRESETS.find(p => p.id === filterPresetId)?.label}</span>}
                        {selectedTemplateId && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.emoji} {STUDIO_TEMPLATES.find(t => t.id === selectedTemplateId)?.label}</span>}
                        {selectedPlatform && <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">{PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.emoji} {PLATFORM_PROFILES.find(p => p.id === selectedPlatform)?.label}</span>}
                        {speed !== 1 && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">{SPEED_LABELS[speed]}</span>}
                        {muted && <span className="text-[10px] bg-zinc-500/20 text-zinc-400 px-1.5 py-0.5 rounded-full">No audio</span>}
                        {selectedSoundFx && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">FX: {SOUND_LIBRARY.find(s => s.id === selectedSoundFx)?.label}</span>}
                        {selectedTransition && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">✂️ {TRANSITIONS.find(t => t.id === selectedTransition)?.label}</span>}
                        {textLayers.length > 0 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">{textLayers.length} text layer{textLayers.length > 1 ? "s" : ""}</span>}
                        {stickerLayers.length > 0 && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">{stickerLayers.length} sticker{stickerLayers.length > 1 ? "s" : ""}</span>}
                        {lowerThirdEnabled && lowerThirdText && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">Lower third</span>}
                        {progressBarEnabled && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full">Progress bar</span>}
                        {viralScore !== null && <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">📊 Score: {viralScore}</span>}
                        {aspectRatio !== "9:16" && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full">{aspectRatio}</span>}
                        {(warmth !== 0 || shadows !== 0 || highlights !== 0 || vignette !== 0) && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Color graded</span>}
                      </div>
                    </div>
                  </div>
                )}
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
                    <circle cx="56" cy="56" r="48" fill="none"
                      stroke={isCompressing ? "hsl(38 92% 50%)" : "hsl(var(--primary))"}
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 48}`}
                      strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress / 100)}`}
                      strokeLinecap="round" className="transition-all duration-300" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isCompressing ? <Zap size={28} className="text-amber-400 animate-pulse" /> : <span className="text-white font-bold text-xl">{progress}%</span>}
                  </div>
                </div>
                <div className="text-center space-y-1">
                  {isCompressing ? (
                    <><p className="text-white font-semibold text-lg">Compressing video…</p><p className="text-amber-400/70 text-sm">Optimizing quality — this may take a minute</p></>
                  ) : (
                    <><p className="text-white font-semibold text-lg">Uploading your reel</p>{uploadSpeed > 0 && <p className="text-zinc-400 text-sm">{uploadSpeed} MB/s · ~{estimatedTime}s remaining</p>}</>
                  )}
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300 relative" style={{ width: `${progress}%`, background: isCompressing ? "hsl(38 92% 50%)" : "hsl(var(--primary))" }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-reel-shimmer" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-5 animate-success-burst">
                <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 size={48} className="text-green-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-2xl">Reel posted!</p>
                  <p className="text-zinc-400 text-sm mt-2">Your reel is live. The community will love it.</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Sparkles size={20} className="text-yellow-400 animate-pulse" />
                  <Sparkles size={16} className="text-primary animate-pulse delay-100" />
                  <Sparkles size={20} className="text-yellow-400 animate-pulse delay-200" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}
