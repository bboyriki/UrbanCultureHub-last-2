import { useState, useRef, useEffect, useMemo } from "react";
import { EditContext, useEdit } from "./context";
import { FIRE, FIRE_TEXT, typeIcon, typeBadge, categoryIcon, categoryColor, statusColor, initials, BioExpandable, DeleteConfirm } from "./helpers";
import { AdminPanel, FloatingAdminBar } from "./AdminPanel";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { reportPurchase } from "@/lib/adsTracking";
import {
  Flame, MapPin, Calendar, Users, Trophy,
  Clock, Instagram, ExternalLink, Plus, Pencil, Trash2,
  ChevronRight, Mic2, Disc3, Zap, Star, Image, Play,
  X, Check, ArrowRight, ArrowUp, ArrowDown, AlertTriangle,
  LayoutDashboard, Activity, Shield, SquarePen, Youtube, Link2,
  Swords, UserCheck, ClipboardList, ChevronDown, Music,
  Ticket, ShoppingCart, CreditCard, Layers, Hash, CircleCheck,
  PackageOpen, Wallet, ReceiptText, UserRound, Ban,
  Sparkles, Send, Loader2, RefreshCw, RotateCcw, Megaphone
} from "lucide-react";

/* ─── YouTube helpers ─────────────────────────────────────────────────────── */
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */

/* ─── Seed data (shown when DB is empty) ────────────────────────────────────── */
const DEFAULT_PROGRAM = [
  { id:-1,  time:"12:00", endTime:"13:00", title:"Doors Open",              type:"special",     artist:null,           stage:"Main Stage",   description:"Gates open. Warm-up DJ sets, street art stalls, street food.", isHighlight:false, sortOrder:0 },
  { id:-2,  time:"13:00", endTime:"14:30", title:"Breaking: Prelims",       type:"battle",      artist:null,           stage:"Battle Floor", description:"1v1 Breaking prelim rounds — 32 dancers battle for 16 spots.", isHighlight:false, sortOrder:1 },
  { id:-3,  time:"13:30", endTime:"14:30", title:"DJ Set",                  type:"dj",          artist:"DJ BTTS",      stage:"Main Stage",   description:"Live DJ set keeping the energy up during prelim rounds.", isHighlight:false, sortOrder:2 },
  { id:-4,  time:"14:30", endTime:"15:30", title:"Popping Showcase",        type:"performance", artist:"The Poppers",  stage:"Main Stage",   description:"Special showcase of Dutch popping masters.", isHighlight:false, sortOrder:3 },
  { id:-5,  time:"15:00", endTime:"16:30", title:"Breaking: Quarter Finals",type:"battle",      artist:null,           stage:"Battle Floor", description:"Top 16 breaking down to 8. Judging panel assembled.", isHighlight:true,  sortOrder:4 },
  { id:-6,  time:"16:00", endTime:"17:00", title:"Rap Performance",         type:"performance", artist:"TBA",          stage:"Main Stage",   description:"Live rap performance from a special guest.", isHighlight:false, sortOrder:5 },
  { id:-7,  time:"16:30", endTime:"17:30", title:"Breaking: Semi Finals",   type:"battle",      artist:null,           stage:"Battle Floor", description:"Top 8 → Top 4. The energy reaches peak level.", isHighlight:true,  sortOrder:6 },
  { id:-8,  time:"17:30", endTime:"18:00", title:"Graffiti Live",           type:"performance", artist:"Live Writers",  stage:"Wall",         description:"Live graffiti artists finish their pieces.", isHighlight:false, sortOrder:7 },
  { id:-9,  time:"18:00", endTime:"19:00", title:"Breaking: FINALS",        type:"battle",      artist:null,           stage:"Battle Floor", description:"The grand final. Top 2 dancers battle for the trophy.", isHighlight:true,  sortOrder:8 },
  { id:-10, time:"19:00", endTime:"19:30", title:"Award Ceremony",          type:"special",     artist:"Riki Almouti", stage:"Main Stage",   description:"Trophy presentation by organizer Riki Almouti.", isHighlight:false, sortOrder:9 },
  { id:-11, time:"19:30", endTime:"21:00", title:"Closing Party",           type:"dj",          artist:"Various DJs",  stage:"Main Stage",   description:"Closing DJ sets, freestyle cypher, community vibes.", isHighlight:false, sortOrder:10 },
];
const DEFAULT_LINEUP = [
  { id:-1, name:"Riki Almouti",    role:"Organizer & Host",  category:"organizer", bio:"Founder of Back to the Street.", instagram:"riki_almouti", featured:true,  imageUrl:null, sortOrder:0 },
  { id:-2, name:"Marth Craandijk", role:"Co-Founder",        category:"organizer", bio:"Co-founder of Back to the Street.", instagram:null, featured:true,  imageUrl:null, sortOrder:1 },
  { id:-3, name:"DJ BTTS",         role:"Main DJ",           category:"dj",        bio:"The official DJ of Back to the Street.", instagram:null, featured:false, imageUrl:null, sortOrder:2 },
  { id:-4, name:"TBA",             role:"Rap Artist",        category:"performer", bio:"Special guest rapper to be announced.", instagram:null, featured:false, imageUrl:null, sortOrder:3 },
  { id:-5, name:"The Judging Panel",role:"Battle Judges",    category:"judge",     bio:"A panel of respected judges from the Dutch breaking scene.", instagram:null, featured:false, imageUrl:null, sortOrder:4 },
];
const DEFAULT_BATTLES = [
  { id:-1, battleType:"1v1", category:"Breaking", round:"Final",         position:1, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"18:00", status:"upcoming" },
  { id:-2, battleType:"1v1", category:"Breaking", round:"Semi Final",    position:1, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"16:30", status:"upcoming" },
  { id:-3, battleType:"1v1", category:"Breaking", round:"Semi Final",    position:2, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"16:30", status:"upcoming" },
  { id:-4, battleType:"1v1", category:"Breaking", round:"Quarter Final", position:1, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"15:00", status:"upcoming" },
  { id:-5, battleType:"1v1", category:"Breaking", round:"Quarter Final", position:2, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"15:00", status:"upcoming" },
  { id:-6, battleType:"1v1", category:"Breaking", round:"Quarter Final", position:3, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"15:00", status:"upcoming" },
  { id:-7, battleType:"1v1", category:"Breaking", round:"Quarter Final", position:4, participant1:"TBA", participant2:"TBA", winner:null, scheduledTime:"15:00", status:"upcoming" },
];

/* ─── Battle format config ───────────────────────────────────────────────────── */
const BATTLE_FORMATS = [
  { id:"all",    label:"All Formats",  icon:<Swords className="w-3.5 h-3.5"/> },
  { id:"1v1",    label:"1 vs 1",       icon:<UserCheck className="w-3.5 h-3.5"/> },
  { id:"2v2",    label:"2 vs 2",       icon:<Users className="w-3.5 h-3.5"/> },
  { id:"3v3",    label:"3 vs 3",       icon:<Users className="w-3.5 h-3.5"/> },
  { id:"crew",   label:"Crew Battle",  icon:<Trophy className="w-3.5 h-3.5"/> },
  { id:"7smoke", label:"7 to Smoke",   icon:<Flame className="w-3.5 h-3.5"/> },
];

/* ─── Seven-to-Smoke special view ────────────────────────────────────────────── */
function SevenToSmokeView({ battles, isAdmin, openBattle }: { battles:any[]; isAdmin:boolean; openBattle:(b:any)=>void }) {
  const chain = battles.filter((b:any)=>b.battleType==="7smoke"||b.round==="7-to-smoke");
  if (chain.length===0) return (
    <div className="text-center py-16 border border-white/5 rounded-3xl">
      <Flame className="w-10 h-10 mx-auto mb-3 text-orange-400/30"/>
      <p className="text-white/30 text-sm">Seven-to-Smoke battles will appear here.</p>
      <p className="text-white/20 text-xs mt-1">The reigning champion faces 7 challengers in a row.</p>
    </div>
  );
  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-0 overflow-x-auto pb-4">
        {chain.map((battle:any, idx:number)=>(
          <div key={battle.id??idx} className="flex items-center">
            <div className="relative group">
              <div onClick={()=>isAdmin&&openBattle(battle)} className={`shrink-0 w-40 rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                battle.status==="live"?"border-yellow-500/50 shadow-[0_0_20px_#eab30830]":
                battle.status==="completed"?"border-green-500/30":
                "border-white/10"}`}>
                <div className="px-3 py-2 bg-orange-500/10 border-b border-white/5">
                  <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest">Round {idx+1}</span>
                  {battle.status==="live"&&<span className="ml-2 text-[9px] text-yellow-400 font-bold animate-pulse">● LIVE</span>}
                </div>
                <div className="p-2 space-y-1">
                  <div className={`px-2 py-1.5 rounded-lg text-xs font-semibold ${battle.winner===battle.participant1?"bg-green-500/20 text-green-300":"bg-white/5 text-white/60"}`}>
                    {battle.winner===battle.participant1&&<Check className="inline w-3 h-3 mr-1 text-green-400"/>}
                    {battle.participant1??"Champion"}
                  </div>
                  <div className="text-center text-[10px] text-white/20 font-bold">vs</div>
                  <div className={`px-2 py-1.5 rounded-lg text-xs font-semibold ${battle.winner===battle.participant2?"bg-green-500/20 text-green-300":"bg-white/5 text-white/60"}`}>
                    {battle.winner===battle.participant2&&<Check className="inline w-3 h-3 mr-1 text-green-400"/>}
                    {battle.participant2??"Challenger"}
                  </div>
                </div>
              </div>
              {isAdmin && battle.id && battle.id > 0 && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-orange-500/50 transition-all duration-150"
                  />
                  <div
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20 cursor-pointer"
                    onClick={()=>openBattle(battle)}
                    title="Edit"
                  >
                    <Pencil className="w-2.5 h-2.5 text-white" />
                  </div>
                  <BattleDeleteButton battle={battle} onDeleted={()=>{}} />
                </>
              )}
            </div>
            {idx<chain.length-1&&(
              <div className="shrink-0 w-6 h-px bg-gradient-to-r from-orange-500/40 to-orange-500/10"/>
            )}
          </div>
        ))}
        {/* Final champion */}
        <div className="shrink-0 w-6 h-px bg-gradient-to-r from-orange-500/20 to-orange-500/50"/>
        <div className="shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-transparent">
          <Trophy className="w-6 h-6 text-orange-400"/>
          <span className="text-[10px] font-black text-orange-300 uppercase tracking-widest">Champion</span>
          {chain.filter((b:any)=>b.winner).length===chain.length&&(
            <span className="text-white/70 text-xs font-bold">{chain[chain.length-1].winner}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Visual helpers ─────────────────────────────────────────────────────────── */

/* ─── Role Emblem — animated SVG character icons per role ───────────────────── */
function RoleEmblem({ category, size = 56 }: { category: string; size?: number }) {
  const s = size;
  const c = Math.round(s / 2);
  if (category === "organizer") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="og1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient>
        <filter id="ogGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {/* Glow bg */}
      <circle cx={c} cy={c} r={c} fill="url(#og1)" style={{animation:"btts-pulse 2.4s ease-in-out infinite"}}/>
      {/* Crown base */}
      <path d="M14 38 L16 26 L22 33 L28 18 L34 33 L40 26 L42 38 Z" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinejoin="round" filter="url(#ogGlow)" style={{animation:"btts-glow-stroke 2.4s ease-in-out infinite"}}/>
      <path d="M14 38 L42 38" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"/>
      {/* Jewels */}
      <circle cx="28" cy="19" r="2.5" fill="#fbbf24" style={{animation:"btts-twinkle 1.8s ease-in-out infinite"}}/>
      <circle cx="16" cy="27" r="1.8" fill="#f59e0b" style={{animation:"btts-twinkle 1.8s ease-in-out infinite 0.3s"}}/>
      <circle cx="40" cy="27" r="1.8" fill="#f59e0b" style={{animation:"btts-twinkle 1.8s ease-in-out infinite 0.6s"}}/>
      {/* Star above */}
      <path d="M28 8 L29.2 11.6 L33 11.6 L30 13.8 L31.2 17.4 L28 15.2 L24.8 17.4 L26 13.8 L23 11.6 L26.8 11.6 Z" fill="#fde68a" style={{animation:"btts-spin-slow 6s linear infinite"}}/>
    </svg>
  );
  if (category === "judge") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="jg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f97316" stopOpacity="0.2"/><stop offset="100%" stopColor="#f97316" stopOpacity="0"/></radialGradient>
        <filter id="jGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={c} cy={c} r={c} fill="url(#jg1)" style={{animation:"btts-pulse 2.8s ease-in-out infinite"}}/>
      {/* Scales beam */}
      <line x1="16" y1="22" x2="40" y2="22" stroke="#f97316" strokeWidth="2" strokeLinecap="round" filter="url(#jGlow)"/>
      <line x1="28" y1="16" x2="28" y2="38" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
      {/* Left pan */}
      <line x1="16" y1="22" x2="13" y2="30" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="22" x2="19" y2="30" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 30 Q16 33 21 30" stroke="#fb923c" strokeWidth="1.8" fill="none" strokeLinecap="round" style={{animation:"btts-swing-l 2s ease-in-out infinite"}}/>
      {/* Right pan */}
      <line x1="40" y1="22" x2="37" y2="30" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="40" y1="22" x2="43" y2="30" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M35 32 Q40 35 45 32" stroke="#fb923c" strokeWidth="1.8" fill="none" strokeLinecap="round" style={{animation:"btts-swing-r 2s ease-in-out infinite"}}/>
      {/* Base */}
      <path d="M24 38 L32 38" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
      {/* Trophy badge */}
      <circle cx="28" cy="16" r="4" fill="#f97316" style={{animation:"btts-twinkle 2s ease-in-out infinite"}}/>
      <path d="M26.5 15 L28 13.5 L29.5 15 L29 17 L27 17 Z" fill="white"/>
    </svg>
  );
  if (category === "dj") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="dg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx={c} cy={c} r={c} fill="url(#dg1)" style={{animation:"btts-pulse 2s ease-in-out infinite"}}/>
      {/* Vinyl record spinning */}
      <g style={{transformOrigin:`${c}px ${c}px`, animation:"btts-spin 4s linear infinite"}}>
        <circle cx={c} cy={c} r="18" fill="#1e1b4b" stroke="#3b82f6" strokeWidth="1.5"/>
        <circle cx={c} cy={c} r="13" fill="none" stroke="#312e81" strokeWidth="1"/>
        <circle cx={c} cy={c} r="8" fill="none" stroke="#4338ca" strokeWidth="1"/>
        <circle cx={c} cy={c} r="4" fill="none" stroke="#312e81" strokeWidth="1"/>
        {/* Grooves */}
        {[10.5, 15.5].map((r,i)=>(
          <circle key={i} cx={c} cy={c} r={r} fill="none" stroke="#3b82f640" strokeWidth="0.8"/>
        ))}
        {/* Label */}
        <circle cx={c} cy={c} r="4.5" fill="#3b82f6"/>
        <circle cx={c} cy={c} r="1.5" fill="white"/>
      </g>
      {/* Headphone arc */}
      <path d="M15 28 Q15 14 28 14 Q41 14 41 28" stroke="#60a5fa" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <rect x="12" y="26" width="5" height="8" rx="2.5" fill="#3b82f6" style={{animation:"btts-pulse 1.5s ease-in-out infinite"}}/>
      <rect x="39" y="26" width="5" height="8" rx="2.5" fill="#3b82f6" style={{animation:"btts-pulse 1.5s ease-in-out infinite 0.75s"}}/>
    </svg>
  );
  if (category === "host") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="hg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#a855f7" stopOpacity="0.2"/><stop offset="100%" stopColor="#a855f7" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx={c} cy={c} r={c} fill="url(#hg1)"/>
      {/* Mic body */}
      <rect x="23" y="12" width="10" height="18" rx="5" fill="none" stroke="#c084fc" strokeWidth="2.2"/>
      <rect x="25" y="14" width="6" height="3" rx="1" fill="#c084fc" opacity="0.4"/>
      <rect x="25" y="19" width="6" height="3" rx="1" fill="#c084fc" opacity="0.4"/>
      {/* Mic stand */}
      <path d="M20 30 Q20 37 28 37 Q36 37 36 30" stroke="#c084fc" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="28" y1="37" x2="28" y2="43" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"/>
      <line x1="22" y1="43" x2="34" y2="43" stroke="#c084fc" strokeWidth="2" strokeLinecap="round"/>
      {/* Sound waves */}
      <path d="M13 24 Q11 28 13 32" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" style={{animation:"btts-wave 1.6s ease-in-out infinite"}}/>
      <path d="M43 24 Q45 28 43 32" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" style={{animation:"btts-wave 1.6s ease-in-out infinite 0.4s"}}/>
      <path d="M9 21 Q6 28 9 35" stroke="#a855f740" strokeWidth="1.5" fill="none" strokeLinecap="round" style={{animation:"btts-wave 1.6s ease-in-out infinite 0.2s"}}/>
      <path d="M47 21 Q50 28 47 35" stroke="#a855f740" strokeWidth="1.5" fill="none" strokeLinecap="round" style={{animation:"btts-wave 1.6s ease-in-out infinite 0.6s"}}/>
    </svg>
  );
  if (category === "performer") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="pg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.2"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx={c} cy={c} r={c} fill="url(#pg1)" style={{animation:"btts-pulse 2.2s ease-in-out infinite"}}/>
      {/* Music note 1 */}
      <g style={{animation:"btts-float 2.2s ease-in-out infinite"}}>
        <path d="M22 36 L22 22 L36 19 L36 33" stroke="#f472b6" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="19.5" cy="37" r="3.5" fill="none" stroke="#f472b6" strokeWidth="2" style={{animation:"btts-twinkle 2.2s ease-in-out infinite"}}/>
        <circle cx="33.5" cy="34" r="3.5" fill="none" stroke="#f472b6" strokeWidth="2" style={{animation:"btts-twinkle 2.2s ease-in-out infinite 0.5s"}}/>
        <circle cx="19.5" cy="37" r="1.5" fill="#f472b6"/>
        <circle cx="33.5" cy="34" r="1.5" fill="#f472b6"/>
      </g>
      {/* Sparkles */}
      <circle cx="40" cy="14" r="2" fill="#f9a8d4" style={{animation:"btts-twinkle 1.5s ease-in-out infinite"}}/>
      <circle cx="14" cy="18" r="1.5" fill="#f9a8d4" style={{animation:"btts-twinkle 1.5s ease-in-out infinite 0.5s"}}/>
      <circle cx="43" cy="38" r="1.5" fill="#f9a8d4" style={{animation:"btts-twinkle 1.5s ease-in-out infinite 1s"}}/>
    </svg>
  );
  if (category === "crew") return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
      <defs>
        <radialGradient id="cg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.2"/><stop offset="100%" stopColor="#22c55e" stopOpacity="0"/></radialGradient>
        <filter id="crGlow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx={c} cy={c} r={c} fill="url(#cg1)" style={{animation:"btts-pulse 2.6s ease-in-out infinite"}}/>
      {/* Raised fist */}
      <g filter="url(#crGlow)" style={{animation:"btts-float 2.6s ease-in-out infinite"}}>
        {/* Wrist */}
        <rect x="20" y="36" width="16" height="6" rx="3" fill="#22c55e" opacity="0.8"/>
        {/* Palm */}
        <rect x="19" y="26" width="18" height="13" rx="4" fill="#22c55e"/>
        {/* Fingers */}
        <rect x="20" y="18" width="4" height="11" rx="2" fill="#22c55e"/>
        <rect x="25" y="16" width="4" height="12" rx="2" fill="#22c55e"/>
        <rect x="30" y="17" width="4" height="11" rx="2" fill="#22c55e"/>
        <rect x="34" y="20" width="3.5" height="9" rx="1.75" fill="#22c55e"/>
        {/* Thumb */}
        <ellipse cx="18" cy="30" rx="3" ry="4" fill="#22c55e"/>
        {/* Knuckle lines */}
        <line x1="21" y1="27" x2="21" y2="29" stroke="#16a34a" strokeWidth="1" strokeLinecap="round"/>
        <line x1="26" y1="27" x2="26" y2="29" stroke="#16a34a" strokeWidth="1" strokeLinecap="round"/>
        <line x1="31" y1="27" x2="31" y2="29" stroke="#16a34a" strokeWidth="1" strokeLinecap="round"/>
      </g>
      {/* Power lines */}
      <line x1="40" y1="12" x2="44" y2="8" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" style={{animation:"btts-twinkle 1.4s ease-in-out infinite"}}/>
      <line x1="42" y1="20" x2="47" y2="18" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" style={{animation:"btts-twinkle 1.4s ease-in-out infinite 0.3s"}}/>
      <line x1="38" y1="10" x2="40" y2="5" stroke="#4ade8060" strokeWidth="1.5" strokeLinecap="round" style={{animation:"btts-twinkle 1.4s ease-in-out infinite 0.6s"}}/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={c} cy={c} r={c} fill="rgba(255,255,255,0.05)"/>
      <text x={c} y={c+5} textAnchor="middle" fontSize="20" fill="rgba(255,255,255,0.4)" fontWeight="900">?</text>
    </svg>
  );
}

/* ─── Admin click-wrapper ────────────────────────────────────────────────────── */
function AdminClickable({ children, onEdit, onDelete, className = "" }: { children: React.ReactNode; onEdit: () => void; onDelete?: () => void; className?: string }) {
  const { isAdmin } = useEdit();
  if (!isAdmin) return <div className={className}>{children}</div>;
  return (
    <div
      className={`relative group ${className} cursor-pointer`}
      onClick={onEdit}
      title="Click to edit"
    >
      {children}
      {/* Hover ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-orange-500/50 transition-all duration-150" />
      {/* Edit badge */}
      <div className="pointer-events-none absolute top-2 right-2 w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20">
        <Pencil className="w-3 h-3 text-white" />
      </div>
      {/* Delete badge — only rendered when onDelete provided */}
      {onDelete && (
        <div
          className="pointer-events-auto absolute bottom-2 right-2 w-6 h-6 rounded-lg bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

/* ── Bio with expandable dialog ─────────────────────────────────────────── */

/* ── Reset ALL tickets button (admin) ───────────────────────────────────── */

/* ── Self-contained ticket purchase delete button (admin only) ───────────── */
function TicketPurchaseDeleteButton({ purchase, onDeleted }: { purchase: any; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/ticket-purchases/${purchase.id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/btts/ticket-purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/btts/my-spots"] });
      toast({ title: "Ticket purchase deleted" });
      onDeleted();
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });
  const label = `${purchase.ticket?.name ?? "Ticket"} #${purchase.id}`;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-[10px] font-semibold transition-colors"
        title="Delete this purchase"
        data-testid={`button-delete-purchase-${purchase.id}`}
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
      <DeleteConfirm open={open} label={label} onConfirm={() => delMut.mutate()} onCancel={() => setOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ── Self-contained battle delete button (used on bracket cards) ─────────── */
function BattleDeleteButton({ battle, onDeleted }: { battle: any; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/battles/${battle.id}`, "DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/btts/battles"] }); toast({ title: "Battle deleted" }); onDeleted(); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });
  return (
    <>
      <div
        className="pointer-events-auto absolute bottom-2 right-2 w-6 h-6 rounded-lg bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-30 cursor-pointer"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title="Delete battle"
      >
        <Trash2 className="w-3 h-3 text-white" />
      </div>
      <DeleteConfirm open={open} label={`${battle.category ?? ""} ${battle.round ?? "battle"}`} onConfirm={() => delMut.mutate()} onCancel={() => setOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ─── Delete confirm ─────────────────────────────────────────────────────────── */

/* ════════════════════════════════════════════════════════════════════════════════
   EDIT DIALOGS  (lifted to page level, shared between public view & admin panel)
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ── Program Edit Dialog ────────────────────────────────────────────────────── */
const BLANK_PROG = { time:"", endTime:"", title:"", artist:"", stage:"", type:"performance", description:"", isHighlight:false, sortOrder:0 };

/* ── Stripe Embedded Checkout Modal ─────────────────────────────────────────── */
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY ?? "");


// ── Inner payment form (needs to be inside <Elements>) ────────────────────────
function InAppPaymentForm({ purchaseId, price, ticketType, onSuccess }: {
  purchaseId: number;
  price: number;
  ticketType?: string;
  onSuccess: (purchase: any) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const returnUrl = `https://urbanculturehub.nl/back-to-the-street?btts_payment=success&purchase_id=${purchaseId}`;
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message || "Payment failed. Please try again.");
      setProcessing(false);
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      try {
        const resp = await fetch(`/api/btts/ticket-purchases/${purchaseId}/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paymentIntentId: result.paymentIntent.id }),
        });
        const data = await resp.json();
        if (data.success) {
          // Google Ads purchase conversion (BTTS in-app card flow)
          reportPurchase({
            value: typeof price === "number" ? price : undefined,
            currency: "EUR",
            transactionId: result.paymentIntent.id,
            conversionType: "btts_ticket",
          });
          onSuccess(data.purchase);
        } else {
          setError(data.error || "Confirmation failed. Contact support.");
        }
      } catch {
        setError("Could not confirm payment. Contact support if charged.");
      }
    }
    setProcessing(false);
  };

  const accentClass = ticketType === "spot"
    ? "from-orange-500 to-red-500"
    : ticketType === "guest"
    ? "from-emerald-500 to-teal-400"
    : "from-blue-500 to-violet-500";

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "auto", googlePay: "auto" },
        }}
      />
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        data-testid="pay-now-btn"
        className={`w-full py-3 rounded-xl font-black text-sm text-white bg-gradient-to-r ${accentClass} disabled:opacity-50 disabled:cursor-not-allowed transition-opacity`}
      >
        {processing ? "Processing…" : `Pay €${price.toFixed(2)} — Secure Spot`}
      </button>
      <p className="text-white/30 text-xs text-center">🔒 Secured by Stripe · Your data never leaves Stripe</p>
    </form>
  );
}

// ── In-app payment modal (no iframe, no external redirect for cards) ───────────
function InAppPaymentModal({ clientSecret, purchaseId, price, ticketType, ticketName, onSuccess, onClose }: {
  clientSecret: string;
  purchaseId: number;
  price: number;
  ticketType?: string;
  ticketName?: string;
  onSuccess: (purchase: any) => void;
  onClose: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [paidPurchase, setPaidPurchase] = useState<any>(null);

  const accentClass  = ticketType === "spot" ? "from-orange-500 to-red-500" : ticketType === "guest" ? "from-emerald-500 to-teal-400" : "from-blue-500 to-violet-500";
  const accentBorder = ticketType === "spot" ? "border-orange-500/30" : ticketType === "guest" ? "border-emerald-500/25" : "border-blue-500/25";

  const handleSuccess = (purchase: any) => {
    setPaidPurchase(purchase);
    setPaid(true);
    onSuccess(purchase);
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#07070b] border-white/10 text-white p-0 max-w-[480px] overflow-hidden max-h-[90vh] flex flex-col" data-testid="stripe-checkout-modal">
        {/* Header */}
        <div className={`border-b ${accentBorder} bg-gradient-to-r from-white/[0.02] to-transparent shrink-0`}>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${accentClass} flex items-center justify-center shrink-0`}>
              {paid ? <Check className="w-4 h-4 text-white"/> : <CreditCard className="w-4 h-4 text-white"/>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">{paid ? "Payment Confirmed!" : "Secure Checkout"}</p>
              {ticketName && <p className="text-white/40 text-xs truncate">{ticketName}</p>}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors" data-testid="close-checkout">
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {paid ? (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${accentClass} flex items-center justify-center`}>
                <Check className="w-8 h-8 text-white"/>
              </div>
              <div>
                <p className="text-white font-black text-lg">
                  {ticketType === "spot" ? "🔥 Battle Spot Secured!" : ticketType === "guest" ? "🟢 Guest Pass Confirmed!" : "🎉 Ticket Confirmed!"}
                </p>
                <p className="text-white/50 text-sm mt-1">Check your email for your ticket & QR code.</p>
              </div>
              <button onClick={onClose} className={`mt-2 px-6 py-2.5 rounded-xl font-black text-sm text-white bg-gradient-to-r ${accentClass}`}>
                Done
              </button>
            </div>
          ) : (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: { colorPrimary: ticketType === "spot" ? "#f97316" : ticketType === "guest" ? "#10b981" : "#6366f1", borderRadius: "12px" },
                },
              }}
            >
              <InAppPaymentForm
                purchaseId={purchaseId}
                price={price}
                ticketType={ticketType}
                onSuccess={handleSuccess}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgramEditDialog({ item, onClose }: { item: any; onClose: ()=>void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !item.id || item.id < 0;
  const [form, setForm] = useState({
    time:        item.time        ?? "",
    endTime:     item.endTime     ?? "",
    title:       item.title       ?? "",
    artist:      item.artist      ?? "",
    stage:       item.stage       ?? "",
    type:        item.type        ?? "performance",
    description: item.description ?? "",
    isHighlight: item.isHighlight ?? false,
    sortOrder:   item.sortOrder   ?? 0,
  });
  const [delOpen, setDelOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data:any) => isNew ? apiRequest("/api/btts/program","POST",data) : apiRequest(`/api/btts/program/${item.id}`,"PATCH",data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/program"] }); toast({ title: isNew ? "Item added" : "Item updated" }); onClose(); },
    onError:   () => toast({ title:"Save failed", variant:"destructive" }),
  });
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/program/${item.id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/program"] }); toast({ title:"Deleted" }); onClose(); },
    onError:   () => toast({ title:"Delete failed", variant:"destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={v => !v && onClose()}>
        <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center"><SquarePen className="w-3.5 h-3.5 text-orange-400"/></span>
              {isNew ? "Add Program Item" : "Edit Program Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-white/50 text-xs">Start Time *</Label><Input placeholder="14:00" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">End Time</Label><Input placeholder="15:30" value={form.endTime} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Title *</Label><Input placeholder="Program item title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Type</Label>
              <Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                  {["battle","dj","performance","special"].map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Artist / Performer</Label><Input placeholder="Optional" value={form.artist} onChange={e=>setForm(f=>({...f,artist:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Stage / Location</Label><Input placeholder="Main Stage, Battle Floor…" value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Description</Label><Textarea placeholder="Short description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <Switch id="ph" checked={form.isHighlight} onCheckedChange={v=>setForm(f=>({...f,isHighlight:v}))} />
                <Label htmlFor="ph" className="text-white/70 text-xs cursor-pointer">Highlight</Label>
              </div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">Sort Order</Label><Input type="number" value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:Number(e.target.value)}))} className="bg-white/5 border-white/10 text-white" /></div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {!isNew && <Button variant="outline" onClick={()=>setDelOpen(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 mr-auto"><Trash2 className="w-3.5 h-3.5 mr-1.5"/>Delete</Button>}
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={()=>saveMut.mutate(form)} disabled={!form.time||!form.title||saveMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}>
              {saveMut.isPending ? "Saving…" : isNew ? "Add Item" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={delOpen} label={item.title} onConfirm={()=>delMut.mutate()} onCancel={()=>setDelOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ── Lineup Edit Dialog ─────────────────────────────────────────────────────── */
const BLANK_LINEUP_FORM = { name:"", role:"", category:"performer", bio:"", instagram:"", imageUrl:"", featured:false, sortOrder:0 };

function LineupEditDialog({ item, onClose }: { item:any; onClose:()=>void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !item.id || item.id < 0;
  const [form, setForm] = useState({ name:item.name||"", role:item.role||"", category:item.category||"performer", bio:item.bio||"", instagram:item.instagram||"", imageUrl:item.imageUrl||"", featured:!!item.featured, sortOrder:item.sortOrder??0 });
  const [delOpen, setDelOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data:any) => isNew ? apiRequest("/api/btts/lineup","POST",data) : apiRequest(`/api/btts/lineup/${item.id}`,"PATCH",data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/lineup"] }); toast({ title: isNew ? "Member added" : "Member updated" }); onClose(); },
    onError:   () => toast({ title:"Save failed", variant:"destructive" }),
  });
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/lineup/${item.id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/lineup"] }); toast({ title:"Deleted" }); onClose(); },
    onError:   () => toast({ title:"Delete failed", variant:"destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={v=>!v&&onClose()}>
        <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center"><SquarePen className="w-3.5 h-3.5 text-orange-400"/></span>{isNew ? "Add Member" : "Edit Member"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-white/50 text-xs">Name *</Label><Input placeholder="Full name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Role *</Label><Input placeholder="e.g. Head Judge, Main DJ" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Category</Label>
              <Select value={form.category} onValueChange={v=>setForm(f=>({...f,category:v}))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                  {["organizer","dj","judge","performer","crew"].map(c=><SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Bio</Label><Textarea placeholder="Short bio" value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-white/50 text-xs">Instagram (no @)</Label><Input placeholder="handle" value={form.instagram} onChange={e=>setForm(f=>({...f,instagram:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">Photo URL</Label><Input placeholder="https://…" value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
              <Switch id="lf" checked={form.featured} onCheckedChange={v=>setForm(f=>({...f,featured:v}))} />
              <Label htmlFor="lf" className="text-white/70 text-xs cursor-pointer">Featured (shown prominently)</Label>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Sort Order</Label><Input type="number" value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:Number(e.target.value)}))} className="bg-white/5 border-white/10 text-white" /></div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {!isNew && <Button variant="outline" onClick={()=>setDelOpen(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 mr-auto"><Trash2 className="w-3.5 h-3.5 mr-1.5"/>Delete</Button>}
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={()=>saveMut.mutate(form)} disabled={!form.name||!form.role||saveMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}>{saveMut.isPending?"Saving…":isNew?"Add Member":"Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={delOpen} label={item.name} onConfirm={()=>delMut.mutate()} onCancel={()=>setDelOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ── Battle Edit Dialog ─────────────────────────────────────────────────────── */
function BattleEditDialog({ item, onClose }: { item:any; onClose:()=>void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !item.id || item.id < 0;
  const [form, setForm] = useState({ battleType:item.battleType||"1v1", category:item.category||"Breaking", round:item.round||"Quarter Final", position:item.position||1, participant1:item.participant1||"", participant2:item.participant2||"", winner:item.winner||"", scheduledTime:item.scheduledTime||"", status:item.status||"upcoming" });
  const [delOpen, setDelOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data:any) => isNew ? apiRequest("/api/btts/battles","POST",{...data,winner:data.winner||null}) : apiRequest(`/api/btts/battles/${item.id}`,"PATCH",{...data,winner:data.winner||null}),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/battles"] }); toast({ title: isNew ? "Battle added" : "Battle updated" }); onClose(); },
    onError:   () => toast({ title:"Save failed", variant:"destructive" }),
  });
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/battles/${item.id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/battles"] }); toast({ title:"Deleted" }); onClose(); },
    onError:   () => toast({ title:"Delete failed", variant:"destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={v=>!v&&onClose()}>
        <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center"><SquarePen className="w-3.5 h-3.5 text-orange-400"/></span>{isNew?"Add Battle":"Edit Battle"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-white/50 text-xs">Category</Label><Input placeholder="Breaking, Popping…" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">Round</Label>
                <Select value={form.round} onValueChange={v=>setForm(f=>({...f,round:v}))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    {["Final","Semi Final","Quarter Final","Round of 16","Prelim"].map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-white/50 text-xs">Type</Label>
                <Select value={form.battleType} onValueChange={v=>setForm(f=>({...f,battleType:v}))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    {["1v1","2v2","3v3","crew"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">Position #</Label><Input type="number" min={1} value={form.position} onChange={e=>setForm(f=>({...f,position:Number(e.target.value)}))} className="bg-white/5 border-white/10 text-white" /></div>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Participant 1</Label><Input placeholder="Name or TBA" value={form.participant1} onChange={e=>setForm(f=>({...f,participant1:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Participant 2</Label><Input placeholder="Name or TBA" value={form.participant2} onChange={e=>setForm(f=>({...f,participant2:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Winner (blank = TBD)</Label><Input placeholder="Winner's name" value={form.winner} onChange={e=>setForm(f=>({...f,winner:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-white/50 text-xs">Scheduled Time</Label><Input placeholder="15:00" value={form.scheduledTime} onChange={e=>setForm(f=>({...f,scheduledTime:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
              <div className="space-y-1"><Label className="text-white/50 text-xs">Status</Label>
                <Select value={form.status} onValueChange={v=>setForm(f=>({...f,status:v}))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                    {["upcoming","live","completed"].map(s=><SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {!isNew && <Button variant="outline" onClick={()=>setDelOpen(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 mr-auto"><Trash2 className="w-3.5 h-3.5 mr-1.5"/>Delete</Button>}
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}>{saveMut.isPending?"Saving…":isNew?"Add Battle":"Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={delOpen} label={`${item.category} ${item.round}`} onConfirm={()=>delMut.mutate()} onCancel={()=>setDelOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ── Gallery Edit Dialog ────────────────────────────────────────────────────── */
function GalleryEditDialog({ item, onClose }: { item:any; onClose:()=>void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isNew = !item.id || item.id < 0;
  const [form, setForm] = useState({ url:item.url||"", thumbnailUrl:item.thumbnailUrl||"", caption:item.caption||"", mediaType:item.mediaType||"image", featured:!!item.featured, sortOrder:item.sortOrder??0 });
  const [delOpen, setDelOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data:any) => isNew ? apiRequest("/api/btts/gallery","POST",data) : apiRequest(`/api/btts/gallery/${item.id}`,"PATCH",data),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/gallery"] }); toast({ title: isNew ? "Media added" : "Media updated" }); onClose(); },
    onError:   () => toast({ title:"Save failed", variant:"destructive" }),
  });
  const delMut = useMutation({
    mutationFn: () => apiRequest(`/api/btts/gallery/${item.id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/gallery"] }); toast({ title:"Deleted" }); onClose(); },
    onError:   () => toast({ title:"Delete failed", variant:"destructive" }),
  });

  return (
    <>
      <Dialog open onOpenChange={v=>!v&&onClose()}>
        <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center"><SquarePen className="w-3.5 h-3.5 text-orange-400"/></span>{isNew?"Add Media":"Edit Media"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-white/50 text-xs">Type</Label>
              <Select value={form.mediaType} onValueChange={v=>setForm(f=>({...f,mediaType:v}))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0d1117] border-white/10 text-white"><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Media URL *</Label><Input placeholder="https://…" value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="space-y-1"><Label className="text-white/50 text-xs">Caption</Label><Input placeholder="Optional caption" value={form.caption} onChange={e=>setForm(f=>({...f,caption:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" /></div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
              <Switch id="gf" checked={form.featured} onCheckedChange={v=>setForm(f=>({...f,featured:v}))} />
              <Label htmlFor="gf" className="text-white/70 text-xs cursor-pointer">Featured</Label>
            </div>
            {form.url && form.mediaType==="image" && (
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                <img src={form.url} alt="preview" className="w-full max-h-40 object-contain" onError={()=>{}} />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {!isNew && <Button variant="outline" onClick={()=>setDelOpen(true)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 mr-auto"><Trash2 className="w-3.5 h-3.5 mr-1.5"/>Delete</Button>}
            <Button variant="outline" onClick={onClose} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={()=>saveMut.mutate(form)} disabled={!form.url||saveMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}>{saveMut.isPending?"Saving…":isNew?"Add Media":"Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirm open={delOpen} label={item.caption||item.url||"media"} onConfirm={()=>delMut.mutate()} onCancel={()=>setDelOpen(false)} isPending={delMut.isPending} />
    </>
  );
}

/* ── CTA Section — with inline admin editing ─────────────────────────────── */
function CtaSection({ bttsSettings, isAdmin }: { bttsSettings: any; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ badge: "", title: "", desc: "" });
  const qc = useQueryClient();
  const { toast } = useToast();
  const FIRE_CONST = "from-orange-500 via-red-500 to-yellow-400";
  const FIRE_TEXT_CONST = "from-orange-400 via-red-400 to-yellow-400";

  const saveMut = useMutation({
    mutationFn: (d: { ctaBadge: string; ctaTitle: string; ctaDesc: string }) =>
      apiRequest("/api/btts/settings", "PATCH", d).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/btts/settings"] });
      toast({ title: "CTA updated" });
      setEditing(false);
    },
  });

  const openEdit = () => {
    setDraft({ badge: bttsSettings.ctaBadge || "Free Entry", title: bttsSettings.ctaTitle || "Join the Movement", desc: bttsSettings.ctaDesc || "" });
    setEditing(true);
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,_#7c2d0e55_0%,_transparent_70%)]" />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        {editing ? (
          /* ── Inline edit form ── */
          <div className="text-left bg-black/60 border border-orange-500/30 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-300 text-sm font-bold flex items-center gap-2"><Pencil className="w-3.5 h-3.5"/>Edit CTA Section</span>
              <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/60 text-xs">Cancel</button>
            </div>
            <div>
              <label className="block text-white/40 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">Badge Label <span className="text-white/20 normal-case">(shows in hero pill + CTA)</span></label>
              <input value={draft.badge} onChange={e => setDraft(d => ({...d, badge: e.target.value}))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                placeholder="Free Entry" />
            </div>
            <div>
              <label className="block text-white/40 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">Headline</label>
              <input value={draft.title} onChange={e => setDraft(d => ({...d, title: e.target.value}))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                placeholder="Join the Movement" />
            </div>
            <div>
              <label className="block text-white/40 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">Description</label>
              <textarea value={draft.desc} onChange={e => setDraft(d => ({...d, desc: e.target.value}))} rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50 resize-none"
                placeholder="Back to the Street is free. No tickets, no barriers…" />
            </div>
            <button
              onClick={() => saveMut.mutate({ ctaBadge: draft.badge, ctaTitle: draft.title, ctaDesc: draft.desc })}
              disabled={saveMut.isPending}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r ${FIRE_CONST} text-white font-bold text-sm transition-all disabled:opacity-50`}
            >
              <Check className="w-4 h-4"/>{saveMut.isPending ? "Saving…" : "Save CTA"}
            </button>
          </div>
        ) : (
          <>
            {/* Admin edit button above badge */}
            {isAdmin && (
              <button onClick={openEdit}
                className="mb-4 flex items-center gap-1.5 mx-auto px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-300/70 hover:text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/40 text-[10px] font-semibold transition-all">
                <Pencil className="w-2.5 h-2.5"/>Edit CTA Section
              </button>
            )}
            <Badge className="mb-6 bg-orange-500/20 text-orange-300 border-orange-500/40 px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase">
              {bttsSettings.ctaBadge || "Free Entry"}
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">
              <span className={`bg-gradient-to-r ${FIRE_TEXT_CONST} bg-clip-text text-transparent`}>{bttsSettings.ctaTitle || "Join the Movement"}</span>
            </h2>
            <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              {bttsSettings.ctaDesc || "Back to the Street is free. No tickets, no barriers — just show up and feel the energy."}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" className={`bg-gradient-to-r ${FIRE_CONST} text-white font-bold px-10 shadow-[0_0_40px_#f9731640] hover:shadow-[0_0_60px_#f9731660] transition-all border-0`}><Flame className="w-4 h-4 mr-2"/>I'm Coming</Button>
              <Button size="lg" variant="outline" asChild className="border-white/20 text-white hover:bg-white/5 px-8"><a href="https://backtothestreet.nl" target="_blank" rel="noopener noreferrer">Learn More <ArrowRight className="w-4 h-4 ml-2"/></a></Button>
            </div>
            <p className="mt-8 text-white/25 text-sm">Organised by <span className="text-white/50">Riki Almouti</span> &amp; <span className="text-white/50">Marth Craandijk</span></p>
          </>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   ADMIN PANEL  (full management view at bottom of page)
   ═══════════════════════════════════════════════════════════════════════════════ */


interface TicketCardProps {
  ticket: any;
  isAdmin: boolean;
  mySpots: any[];
  setPublicEditingTicket: (t: any) => void;
  deletePublicTicketMut: { mutate: (id: any) => void };
  setClaimModalTicket: (t: any) => void;
  setClaimForm: (f: { guestName: string; guestEmail: string; notes: string }) => void;
}

function TicketCard({ ticket, isAdmin, mySpots, setPublicEditingTicket, deletePublicTicketMut, setClaimModalTicket, setClaimForm }: TicketCardProps) {
  const claimed   = ticket.claimedCount ?? 0;
  const total     = ticket.totalSpots ?? 0;
  const remaining = total > 0 ? total - claimed : null;
  const isFull    = total > 0 && claimed >= total;
  const isFree    = ticket.price === 0;
  const isSpot    = ticket.type === "spot";
  const isGuest   = ticket.type === "guest";
  const alreadyClaimed = isAdmin ? false : isSpot
    ? (mySpots as any[]).some((s:any)=>s.ticket?.type==="spot" && s.status==="confirmed")
    : (mySpots as any[]).some((s:any)=>s.ticketId===ticket.id && s.status==="confirmed");
  const pendingClaim = isAdmin ? null : isSpot
    ? (mySpots as any[]).find((s:any)=>s.ticket?.type==="spot" && s.status==="pending_payment")
    : (mySpots as any[]).find((s:any)=>s.ticketId===ticket.id && s.status==="pending_payment");
  const btnClass  = isSpot
    ? `bg-gradient-to-r ${FIRE}`
    : isGuest
      ? "bg-gradient-to-r from-emerald-600 to-teal-600"
      : "bg-gradient-to-r from-blue-600 to-violet-600";
  const barClass  = isFull ? "bg-red-500" : isSpot ? "bg-orange-500" : isGuest ? "bg-emerald-500" : "bg-blue-500";
  const borderClass = isFull ? "border-white/8 opacity-60" : isSpot ? "border-orange-500/20 hover:border-orange-500/40" : isGuest ? "border-emerald-500/20 hover:border-emerald-500/40" : "border-blue-500/20 hover:border-blue-500/40";
  const topBar    = isSpot ? "bg-gradient-to-r from-orange-500 to-red-500" : isGuest ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-blue-500 to-violet-500";
  const btnLabel  = isSpot ? "Claim Battle Spot" : isGuest ? "Get Guest Ticket" : "Get Entry Ticket";
  return (
    <div className={`relative rounded-2xl border overflow-hidden flex flex-col ${borderClass} transition-all bg-[#090910] group`} data-testid={`card-spot-${ticket.id}`}>
      {isAdmin && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setPublicEditingTicket({...ticket})}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/60 border border-white/10 text-white/50 hover:text-orange-400 hover:border-orange-500/40 transition-colors backdrop-blur-sm"
            title="Edit ticket type"
            data-testid={`button-public-edit-ticket-${ticket.id}`}
          >
            <Pencil className="w-3.5 h-3.5"/>
          </button>
          <button
            onClick={() => { if(confirm(`Delete "${ticket.name}" and all its claims?`)) deletePublicTicketMut.mutate(ticket.id); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/60 border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/40 transition-colors backdrop-blur-sm"
            title="Delete ticket type"
            data-testid={`button-public-delete-ticket-${ticket.id}`}
          >
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}
      <div className={`h-1 w-full ${topBar}`}/>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2 mb-1">
          <h4 className="text-white font-black text-sm tracking-tight flex-1">{ticket.name}</h4>
          {ticket.phase && (
            <Badge className={`text-[8px] px-1.5 py-0 shrink-0 ${ticket.phase === "early_bird" ? "bg-green-500/20 text-green-300 border-green-500/30" : ticket.phase === "late" ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>
              {ticket.phase === "early_bird" ? "Early Bird" : ticket.phase === "late" ? "Late" : "Regular"}
            </Badge>
          )}
        </div>
        {ticket.description&&<p className="text-white/35 text-xs leading-relaxed mb-3">{ticket.description}</p>}
        <div className="flex-1"/>
        {total > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-white/30 mb-1">
              <span>{claimed} claimed</span>
              <span>{isFull?"Sold out":`${remaining} left`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${barClass}`} style={{width:`${Math.min(100,Math.round(claimed/total*100))}%`}}/>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-white/8">
          <p className="text-white font-black text-base">{isFree?"Free":`€${Number(ticket.price).toFixed(2)}`}</p>
          {alreadyClaimed ? (
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 gap-1 px-3 py-1.5 text-xs"><CircleCheck className="w-3 h-3"/>Secured</Badge>
          ) : pendingClaim ? (
            <Button size="sm" onClick={()=>{ setClaimModalTicket(ticket); setClaimForm({guestName: pendingClaim.guestName ?? "", guestEmail: pendingClaim.guestEmail ?? "", notes: pendingClaim.notes ?? ""}); }}
              className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs px-3 hover:bg-amber-500/30"
              data-testid={`button-complete-payment-${ticket.id}`}>
              ⏳ Complete Payment
            </Button>
          ) : isFull ? (
            <Badge className="bg-white/5 text-white/30 border-white/10 px-3 py-1.5 text-xs">Sold Out</Badge>
          ) : (
            <Button size="sm" onClick={()=>{ setClaimModalTicket(ticket); setClaimForm({guestName:"",guestEmail:"",notes:""}); }}
              className={`${btnClass} text-white border-0 font-bold text-xs px-4`}
              data-testid={`button-claim-${ticket.id}`}>
              {btnLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function BackToTheStreetPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  /* ── Shared edit dialog state ── */
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [editingLineup,  setEditingLineup]  = useState<any>(null);
  const [editingBattle,  setEditingBattle]  = useState<any>(null);
  const [editingGallery, setEditingGallery] = useState<any>(null);

  /* ── Public-view ticket admin (edit/delete from the Join section) ── */
  const [publicEditingTicket, setPublicEditingTicket] = useState<any>(null);
  const qcPublic = useQueryClient();
  const { toast: toastPublic } = useToast();
  const updatePublicTicketMut = useMutation({
    mutationFn: ({id,data}:{id:number;data:any}) => apiRequest(`/api/btts/tickets/${id}`,"PATCH",data).then(r=>r.json()),
    onSuccess: () => { qcPublic.invalidateQueries({queryKey:["/api/btts/tickets"]}); toastPublic({title:"Ticket updated"}); setPublicEditingTicket(null); },
    onError: () => toastPublic({title:"Failed",variant:"destructive"}),
  });
  const deletePublicTicketMut = useMutation({
    mutationFn: (id:number) => apiRequest(`/api/btts/tickets/${id}`,"DELETE"),
    onSuccess: () => { qcPublic.invalidateQueries({queryKey:["/api/btts/tickets"]}); toastPublic({title:"Ticket type deleted"}); },
    onError: () => toastPublic({title:"Failed",variant:"destructive"}),
  });

  /* ── In-app Stripe embedded checkout ── */
  const [stripeCheckout, setStripeCheckout] = useState<{clientSecret:string;purchaseId:number;price:number;ticketType?:string;ticketName?:string}|null>(null);

  const openProgram = (item:any) => setEditingProgram(item);
  const openLineup  = (item:any) => setEditingLineup(item);
  const openBattle  = (item:any) => setEditingBattle(item);
  const openGallery = (item:any) => setEditingGallery(item);

  /* ── "Add new" helpers ── */
  const handleAdd = (type:string) => {
    if (type==="program")  openProgram({ ...BLANK_PROG });
    if (type==="lineup")   openLineup({ name:"",role:"",category:"performer",bio:"",instagram:"",imageUrl:"",featured:false,sortOrder:0 });
    if (type==="battles")  openBattle({ battleType:"1v1",category:"Breaking",round:"Quarter Final",position:1,participant1:"",participant2:"",winner:"",scheduledTime:"",status:"upcoming" });
    if (type==="gallery")  openGallery({ url:"",caption:"",mediaType:"image",featured:false,sortOrder:0 });
  };

  /* ── Background video settings ── */
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: videoSettings } = useQuery<{ url: string; enabled: boolean; muted: boolean; mode: string }>({
    queryKey: ["/api/btts/video-settings"],
  });
  const [editingVideo,  setEditingVideo]  = useState(false);
  const [videoDraft,    setVideoDraft]    = useState("");

  const videoUrl     = videoSettings?.url     ?? "";
  const videoEnabled = videoSettings?.enabled ?? false;
  const videoMuted   = videoSettings?.muted   ?? true;
  const videoMode    = videoSettings?.mode    ?? "background";
  const videoId      = extractYoutubeId(videoUrl);
  const showAmbient  = videoEnabled && !!videoId;

  const ambientIframeRef = useRef<HTMLIFrameElement>(null);

  // Fade the video in once it starts playing (postMessage or 2s fallback)
  const [videoVisible, setVideoVisible] = useState(false);
  const videoFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVideoVisible(false);
    if (!showAmbient) return;
    // Force-reveal after 1.5s — covers browsers that block postMessage (iOS Safari, etc.)
    videoFallbackTimer.current = setTimeout(() => setVideoVisible(true), 1500);
    const YT_ORIGINS = ["https://www.youtube.com", "https://www.youtube-nocookie.com"];
    const onMsg = (e: MessageEvent) => {
      if (!YT_ORIGINS.includes(e.origin)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // info=1 → PLAYING, info=-1 → BUFFERING/CUED (also safe to show)
        if (d?.event === "onStateChange" && (d?.info === 1 || d?.info === -1)) {
          clearTimeout(videoFallbackTimer.current!);
          setVideoVisible(true);
        }
      } catch { /* noop */ }
    };
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("message", onMsg); clearTimeout(videoFallbackTimer.current!); };
  }, [showAmbient, videoId]);


  const saveVideoMutation = useMutation({
    mutationFn: (patch: { url?: string; enabled?: boolean; muted?: boolean; mode?: string }) =>
      apiRequest("/api/btts/video-settings", "PATCH", patch).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/btts/video-settings"] });
      setEditingVideo(false);
    },
    onError: () => toast({ title: "Error", description: "Could not save video settings.", variant: "destructive" }),
  });

  /* ── Data ── */
  const { data: programData = [] } = useQuery<any[]>({ queryKey:["/api/btts/program"] });
  const { data: lineupData  = [] } = useQuery<any[]>({ queryKey:["/api/btts/lineup"]  });
  const { data: battlesData = [] } = useQuery<any[]>({ queryKey:["/api/btts/battles"] });
  const { data: galleryData = [] } = useQuery<any[]>({ queryKey:["/api/btts/gallery"] });

  const program = programData.length>0 ? [...programData].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)) : DEFAULT_PROGRAM;
  const lineup  = lineupData.length >0 ? lineupData  : DEFAULT_LINEUP;
  const battles = battlesData.length>0 ? battlesData : DEFAULT_BATTLES;
  const gallery = galleryData as any[];

  // Round priority: 0 = Final (rightmost in bracket), higher = earlier rounds (leftmost)
  const ROUND_PRIORITY: Record<string,number> = {
    "Final": 0, "Semi-Final": 1, "Quarter-Final": 2,
    "Top 16": 3, "Top 32": 4, "Top 64": 5, "Top 128": 6,
    // Legacy names from manually-entered battles
    "Semi Final": 1, "Quarter Final": 2, "Round of 16": 3, "Prelim": 7,
  };

  const [activeBracketFormat, setActiveBracketFormat] = useState("1v1");

  // Filter battles by selected format (so each tab shows its own bracket)
  const filteredBattles = activeBracketFormat === "all"
    ? battles.filter((b: any) => b.battleType !== "7smoke")
    : battles.filter((b: any) => b.battleType === activeBracketFormat);

  const battlesByRound = filteredBattles.reduce<Record<string,any[]>>((acc, b: any) => {
    const key = b.round ?? "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});
  // Sort: Final (0) first, early rounds last → .reverse() in render gives correct left-to-right layout
  const allRounds = Object.keys(battlesByRound).sort((a, b) => {
    const pa = ROUND_PRIORITY[a] ?? 99;
    const pb = ROUND_PRIORITY[b] ?? 99;
    return pa - pb;
  });

  /* ── New: BTTS settings, judges, registrations, bracket format ── */
  const { data: bttsSettingsData } = useQuery<any>({ queryKey:["/api/btts/settings"] });
  const { data: judgesData = [] }  = useQuery<any[]>({ queryKey:["/api/btts/judges"] });
  const { data: registrationsData = [] } = useQuery<any[]>({
    queryKey:["/api/btts/registrations"],
    enabled: isAdmin,
  });

  const bttsSettings = {
    registrationOpen: bttsSettingsData?.registrationOpen ?? false,
    bracketPublic:    bttsSettingsData?.bracketPublic ?? true,
    judgeCount:       bttsSettingsData?.judgeCount ?? 5,
    activeFormat:     bttsSettingsData?.activeFormat ?? "1v1",
    eventDate:        bttsSettingsData?.eventDate  ?? "",
    eventYear:        bttsSettingsData?.eventYear  ?? "2026",
    eventVenue:       bttsSettingsData?.eventVenue ?? "",
    eventCity:        bttsSettingsData?.eventCity  ?? "Netherlands",
    ticketUrl:        bttsSettingsData?.ticketUrl  ?? "",
    eventTitle:       bttsSettingsData?.eventTitle ?? "Back to the Street",
    ctaBadge:         bttsSettingsData?.ctaBadge   ?? "Free Entry",
    ctaTitle:         bttsSettingsData?.ctaTitle   ?? "Join the Movement",
    ctaDesc:          bttsSettingsData?.ctaDesc    ?? "",
    eventDescription: bttsSettingsData?.eventDescription ?? "",
  };

  // Inline edit state for the "Free Entry" hero pill (admin only)
  const [inlineEditBadge, setInlineEditBadge] = useState(false);
  const [inlineBadgeVal, setInlineBadgeVal] = useState("");
  const saveInlineBadgeMut = useMutation({
    mutationFn: (val: string) => apiRequest("/api/btts/settings","PATCH",{ ctaBadge: val }).then(r=>r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey:["/api/btts/settings"] }),
  });
  const judges        = judgesData as any[];
  const registrations = registrationsData as any[];

  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regForm, setRegForm] = useState({ guestName:"", crewName:"", battleType:"1v1", category:"Breaking", notes:"" });

  /* ── Spots / Tickets (public) ── */
  const { data: publicTickets = [] } = useQuery<any[]>({ queryKey:["/api/btts/tickets"] });
  // Include user.id in the key so each user gets their own isolated cache entry.
  // Without this, user A's pending purchases would bleed into user B's cache.
  const { data: mySpots = [] } = useQuery<any[]>({
    queryKey: ["/api/btts/my-spots", user?.id],
    enabled: !!user?.id,
  });
  const [claimModalTicket, setClaimModalTicket] = useState<any>(null);
  const [claimForm, setClaimForm]    = useState({ guestName:"", guestEmail:"", notes:"" });

  // Handle Stripe return URL — confirm payment on page load if URL params present
  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const bttsPayment  = params.get("btts_payment");
    const sessionId    = params.get("session_id");       // legacy Checkout Session
    const purchaseId   = params.get("purchase_id");      // in-app PaymentIntent redirect
    const paymentIntent = params.get("payment_intent");  // Stripe adds this on redirect
    if (!bttsPayment) return;
    window.history.replaceState({}, "", window.location.pathname);

    if (bttsPayment === "cancelled") {
      toast({ title: "Payment cancelled", description: "Your spot was not confirmed. You can try again.", variant: "destructive" });
      return;
    }

    const handleConfirmed = (data: any) => {
      if (data.success) {
        const ticket = data.purchase?.ticket;
        const ticketType = ticket?.type;
        // Google Ads purchase conversion (BTTS redirect / iDEAL / legacy Checkout flow)
        const ticketPrice = typeof ticket?.price === "number" ? ticket.price : undefined;
        const txnId = paymentIntent || sessionId || (data.purchase?.id ? `btts:${data.purchase.id}` : undefined);
        if (txnId) {
          reportPurchase({
            value: ticketPrice,
            currency: "EUR",
            transactionId: txnId,
            conversionType: "btts_ticket",
          });
        }
        const title = ticketType === "spot" ? "🔥 Battle spot secured!" : ticketType === "guest" ? "🟢 Guest pass confirmed!" : "🎉 Ticket confirmed!";
        const desc  = "Payment received — check your email for your ticket & QR code.";
        toast({ title, description: desc });
        queryClient.invalidateQueries({ queryKey: ["/api/btts/tickets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/btts/my-spots"] });
        // Redirect to the tickets page so users see their ticket immediately
        setTimeout(() => {
          window.location.href = "https://urbanculturehub.nl/profile/tickets";
        }, 1200);
      } else {
        toast({ title: "Payment verification issue", description: data.error || "Please contact the organizer.", variant: "destructive" });
      }
    };

    if (bttsPayment === "success" && purchaseId && paymentIntent) {
      // In-app PaymentElement redirect (e.g. iDEAL) returned here
      fetch(`/api/btts/ticket-purchases/${purchaseId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentIntentId: paymentIntent }),
      })
        .then(r => r.json())
        .then(handleConfirmed)
        .catch(() => toast({ title: "Could not verify payment", description: "If your payment went through, your spot will be confirmed shortly.", variant: "destructive" }));
    } else if (bttsPayment === "success" && sessionId) {
      // Legacy Checkout Session redirect
      fetch(`/api/btts/ticket-claim/activate?session_id=${encodeURIComponent(sessionId)}`, { credentials: "include" })
        .then(r => r.json())
        .then(handleConfirmed)
        .catch(() => toast({ title: "Could not verify payment", description: "If your payment went through, your spot will be confirmed shortly.", variant: "destructive" }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const claimMut = useMutation({
    mutationFn: ({ id, data }:{ id:number; data:any }) =>
      apiRequest(`/api/btts/tickets/${id}/claim`, "POST", data).then(r=>r.json()),
    onSuccess: (data: any) => {
      if (data.requiresPayment && data.clientSecret && data.isPaymentIntent) {
        // In-app PaymentElement checkout — stays inside the app
        const savedTicket = claimModalTicket;
        setClaimModalTicket(null);
        setStripeCheckout({
          clientSecret:  data.clientSecret,
          purchaseId:    data.purchaseId,
          price:         savedTicket?.price ?? 0,
          ticketType:    savedTicket?.type,
          ticketName:    savedTicket?.name,
        });
      } else if (data.requiresPayment && data.checkoutUrl) {
        toast({ title: "Redirecting to payment…", description: "You'll complete checkout on the next page." });
        setClaimModalTicket(null);
        setTimeout(() => { window.location.href = data.checkoutUrl; }, 600);
      } else {
        const t = data.purchase?.ticket;
        const ttype = t?.type ?? claimModalTicket?.type;
        const title = ttype === "spot" ? "🔥 Battle spot secured!" : ttype === "guest" ? "🟢 Guest pass confirmed!" : "🎉 Ticket confirmed!";
        const desc = "Your spot is locked in — check your email for the ticket and QR code.";
        toast({ title, description: desc });
        queryClient.invalidateQueries({ queryKey:["/api/btts/tickets"] });
        queryClient.invalidateQueries({ queryKey:["/api/btts/my-spots"] });
        setClaimModalTicket(null);
        setClaimForm({ guestName:"", guestEmail:"", notes:"" });
        // Scroll to my tickets after a brief delay
        setTimeout(() => { document.getElementById("btts-my-tickets")?.scrollIntoView({ behavior:"smooth" }); }, 600);
      }
    },
    onError: (e:any) => {
      let msg = e?.message ?? "Sold out or unavailable.";
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/,"")); if (parsed?.error) msg = parsed.error; } catch {}
      toast({ title:"Couldn't claim spot", description: msg, variant:"destructive" });
    },
  });

  const saveSettingsMut = useMutation({
    mutationFn: (patch:any) => apiRequest("/api/btts/settings","PATCH",patch).then(r=>r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey:["/api/btts/settings"] }); toast({ title:"Settings saved" }); },
    onError: () => toast({ title:"Failed to save settings", variant:"destructive" }),
  });

  // Bracket generation — called from the bracket section's "Sync Bracket" button
  const generateBracketMut = useMutation({
    mutationFn: (data:{battleType:string;category:string;forceRegen?:boolean}) =>
      apiRequest("/api/btts/bracket/generate","POST",data).then(r=>r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey:["/api/btts/battles"] });
      if (data.generated > 0)
        toast({ title:"✓ Bracket generated", description:`${data.participants} confirmed → ${data.size}-person bracket, ${data.rounds} rounds.` });
      else
        toast({ title:"Nothing to generate", description: data.message ?? "Need at least 2 confirmed participants.", variant:"destructive" });
    },
    onError: () => toast({ title:"Bracket generation failed", variant:"destructive" }),
  });

  const registerMut = useMutation({
    mutationFn: (data:any) => apiRequest("/api/btts/registrations","POST",data).then(r=>r.json()),
    onSuccess: () => {
      toast({ title:"Registration submitted!", description:"The organizer will confirm your spot." });
      setRegModalOpen(false);
      setRegForm({ guestName:"", crewName:"", battleType:"1v1", category:"Breaking", notes:"" });
    },
    onError: (e:any) => {
      let msg = e?.message ?? "Something went wrong.";
      // e.message is "403: {\"error\":\"...\"}"; try to extract the error field
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/, "")); if (parsed?.error) msg = parsed.error; } catch {}
      const needsTicket = msg.toLowerCase().includes("ticket");
      toast({
        title: needsTicket ? "Ticket required" : "Registration failed",
        description: msg,
        variant: "destructive",
      });
      if (needsTicket) {
        setRegModalOpen(false);
        const el = document.getElementById("btts-spots"); if(el) el.scrollIntoView({ behavior:"smooth" });
      }
    },
  });

  /* ── Ticket gating logic ── */
  const activeTickets      = (publicTickets as any[]).filter((t:any) => t.isActive);
  const hasActiveTickets   = activeTickets.length > 0;
  const confirmedSpots     = (mySpots as any[]).filter((s:any) => s.status === "confirmed");
  const hasValidTicket     = confirmedSpots.length > 0;
  const hasSpotTicket      = confirmedSpots.some((s:any) => s.ticket?.type === "spot");
  const hasGeneralTicket   = confirmedSpots.some((s:any) => s.ticket?.type === "general");
  // Pre-fill reg form name from most recent claimed spot
  const latestSpotName     = confirmedSpots[0]?.guestName ?? "";
  const latestSpotFormat   = confirmedSpots.find((s:any) => s.ticket?.type === "spot")?.ticket?.battleFormat ?? "1v1";

  return (
    <EditContext.Provider value={{ isAdmin, openProgram, openLineup, openBattle, openGallery }}>
      <div className="min-h-screen bg-[#050508] text-white">

        {/* ── Edit dialogs (page-level) ──────────────────────────────────────── */}
        {editingProgram && <ProgramEditDialog item={editingProgram} onClose={()=>setEditingProgram(null)} />}
        {editingLineup  && <LineupEditDialog  item={editingLineup}  onClose={()=>setEditingLineup(null)}  />}
        {editingBattle  && <BattleEditDialog  item={editingBattle}  onClose={()=>setEditingBattle(null)}  />}
        {editingGallery && <GalleryEditDialog item={editingGallery} onClose={()=>setEditingGallery(null)} />}
        {stripeCheckout && (
          <InAppPaymentModal
            clientSecret={stripeCheckout.clientSecret}
            purchaseId={stripeCheckout.purchaseId}
            price={stripeCheckout.price}
            ticketType={stripeCheckout.ticketType}
            ticketName={stripeCheckout.ticketName}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey:["/api/btts/tickets"] });
              queryClient.invalidateQueries({ queryKey:["/api/btts/my-spots"] });
              // Redirect to the tickets page so users see their ticket immediately
              setTimeout(() => {
                window.location.href = "https://urbanculturehub.nl/profile/tickets";
              }, 1200);
            }}
            onClose={() => {
              setStripeCheckout(null);
              queryClient.invalidateQueries({ queryKey:["/api/btts/my-spots"] });
              queryClient.invalidateQueries({ queryKey:["/api/btts/ticket-purchases"] });
            }}
          />
        )}

        {/* ── Floating admin toolbar ──────────────────────────────────────────── */}
        {isAdmin && <FloatingAdminBar onAdd={handleAdd} />}

        {/* ── HERO ────────────────────────────────────────────────────────────── */}
        <section className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden">

          {/* ── Layer 0: Ambient video background ── */}
          {showAmbient && (
            <div className="btts-ambient-iframe-wrap">
              {/* YouTube iframe — always mute=1 so mobile browsers autoplay without prompts */}
              <iframe
                key={videoId}
                ref={ambientIframeRef}
                className="btts-ambient-iframe"
                style={{
                  opacity: videoVisible ? 0.55 : 0,
                  transition: "opacity 0s",   /* shield handles the reveal, iframe can jump */
                }}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=0&disablekb=1&cc_load_policy=0&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
                allow="autoplay; encrypted-media"
                allowFullScreen={false}
                title="Background video"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {/* Black shield — sits above iframe and hides ALL YouTube loading UI / branding.
                  Fades out once video is confirmed playing. User never sees YouTube. */}
              <div
                className="btts-ambient-shield"
                style={{
                  opacity: videoVisible ? 0 : 1,
                  transition: videoVisible ? "opacity 2.5s cubic-bezier(0.4,0,0.2,1)" : "none",
                }}
              />
            </div>
          )}

          {/* ── Layer 1: Fire gradient radials ── */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,_#7c1b0a55_0%,_transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_100%,_#b45309aa_0%,_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_90%,_#92400e55_0%,_transparent_55%)]" />
          {/* ── Layer 2: Dark base + dot grid ── */}
          <div className={`absolute inset-0 transition-colors duration-700 ${showAmbient ? "bg-[#050508]/20" : "bg-[#050508]/60"}`} />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
          {/* ── Layer 3: Floating sparks ── */}
          {[...Array(16)].map((_,i)=>(
            <div key={i} className="absolute rounded-full pointer-events-none" style={{ width:`${2+(i%3)}px`,height:`${2+(i%3)}px`,background:i%3===0?"#f97316":i%3===1?"#ef4444":"#fbbf24",left:`${5+(i*6.1)%90}%`,top:`${8+(i*8.3)%84}%`,opacity:0.1+(i%5)*0.04 }} />
          ))}

          {/* Content */}
          <div className="relative z-10 w-full flex flex-col items-center justify-center px-4 py-10">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-10 bg-gradient-to-r from-transparent to-orange-500/50" />
              <span className="text-orange-400/80 text-[10px] font-bold tracking-[0.25em] uppercase">Flagship Cultural Event</span>
              <div className="h-px w-10 bg-gradient-to-l from-transparent to-orange-500/50" />
            </div>

            {/* THE GIANT TITLE */}
            <div className="w-full overflow-hidden" style={{textAlign:'center'}}>
              <div
                className="btts-fire-text"
                style={{fontSize:'clamp(2.5rem,11vw,8rem)',display:'block',whiteSpace:'nowrap',letterSpacing:'-0.04em',fontWeight:900,lineHeight:0.88}}
              >BACK TO</div>
              <div
                style={{fontSize:'clamp(1.8rem,6vw,4.5rem)',display:'block',color:'rgba(255,255,255,0.88)',fontWeight:900,letterSpacing:'-0.04em',lineHeight:1.1}}
              >THE</div>
              <div
                className="btts-fire-text-delayed"
                style={{fontSize:'clamp(4rem,16vw,13rem)',display:'block',whiteSpace:'nowrap',letterSpacing:'-0.04em',fontWeight:900,lineHeight:0.82}}
              >STREET</div>
            </div>

            {/* Tagline */}
            <p className="mt-8 text-white/60 text-sm sm:text-base max-w-md text-center leading-relaxed">
              Hip-hop culture · Dance battles · Street art · Music
            </p>

            {/* Info pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {[
                {icon:<Calendar className="w-3 h-3"/>,label: bttsSettings.eventDate ? bttsSettings.eventDate : bttsSettings.eventYear || "2026", editable: false},
                {icon:<MapPin className="w-3 h-3"/>,   label: bttsSettings.eventVenue ? bttsSettings.eventVenue : bttsSettings.eventCity || "Netherlands", editable: false},
              ].map(b=>(
                <div key={b.label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[11px] text-white/50">{b.icon}<span>{b.label}</span></div>
              ))}
              {/* Badge pill — click-to-edit for admins */}
              {inlineEditBadge ? (
                <form
                  className="flex items-center gap-1 bg-black/60 border border-orange-500/50 rounded-full px-2 py-0.5"
                  onSubmit={e => {
                    e.preventDefault();
                    saveInlineBadgeMut.mutate(inlineBadgeVal);
                    setInlineEditBadge(false);
                  }}
                >
                  <input
                    autoFocus
                    value={inlineBadgeVal}
                    onChange={e => setInlineBadgeVal(e.target.value)}
                    className="bg-transparent text-[11px] text-white w-24 outline-none placeholder-white/30"
                    placeholder="e.g. Free Entry"
                  />
                  <button type="submit" className="text-orange-400 hover:text-orange-300 text-[10px] font-bold">Save</button>
                  <button type="button" onClick={() => setInlineEditBadge(false)} className="text-white/30 hover:text-white/60 text-[10px]">✕</button>
                </form>
              ) : (
                <div
                  className={`flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[11px] text-white/50 ${isAdmin ? "cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300 transition-all" : ""}`}
                  onClick={() => { if (isAdmin) { setInlineBadgeVal(bttsSettings.ctaBadge || "Free Entry"); setInlineEditBadge(true); } }}
                  title={isAdmin ? "Click to edit" : undefined}
                >
                  <Users className="w-3 h-3"/>
                  <span>{bttsSettings.ctaBadge || "Free Entry"}</span>
                  {isAdmin && <Pencil className="w-2.5 h-2.5 opacity-50" />}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Button className={`bg-gradient-to-r ${FIRE} text-white font-bold px-7 shadow-[0_0_40px_#f9731640] hover:shadow-[0_0_60px_#f9731660] transition-all border-0`} onClick={()=>document.getElementById("btts-program")?.scrollIntoView({behavior:"smooth"})}>
                <Flame className="w-4 h-4 mr-2"/>Full Program
              </Button>
              <Button variant="outline" asChild className="border-white/15 text-white/70 hover:bg-white/5 px-7">
                <a href="https://backtothestreet.nl" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-2"/>Official Site</a>
              </Button>
            </div>
          </div>

          {/* ── Admin video control — floating bottom of hero ── */}
          {isAdmin && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 w-full max-w-sm px-4">
              {!editingVideo ? (
                /* Status pill */
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                  {/* ON/OFF toggle */}
                  <button
                    data-testid="btts-video-toggle"
                    onClick={() => saveVideoMutation.mutate({ enabled: !videoEnabled })}
                    disabled={saveVideoMutation.isPending || !videoId}
                    className={`relative w-8 h-4 rounded-full shrink-0 transition-colors duration-300 disabled:opacity-30 ${videoEnabled && videoId ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-white/15"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-300 ${videoEnabled && videoId ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  <span className="text-[11px] text-white/50 flex-1 truncate">
                    {showAmbient ? "Video background on" : videoId ? "Video background off" : "No video set"}
                  </span>
                  <button
                    data-testid="btts-video-edit-btn"
                    onClick={() => { setVideoDraft(videoUrl); setEditingVideo(true); }}
                    className="text-[11px] text-orange-400/70 hover:text-orange-300 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Pencil className="w-3 h-3" />{videoId ? "Change" : "Set video"}
                  </button>
                </div>
              ) : (
                /* URL editor */
                <div className="rounded-2xl bg-black/80 border border-orange-500/25 backdrop-blur-md overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                    <Youtube className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[11px] text-orange-300/80 font-semibold tracking-widest uppercase flex-1">Background video URL</span>
                    <button onClick={() => setEditingVideo(false)} className="text-white/30 hover:text-white/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-3 flex gap-2">
                    <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <Link2 className="w-3 h-3 text-white/30 shrink-0" />
                      <input
                        data-testid="btts-video-url-input"
                        className="flex-1 bg-transparent text-xs text-white placeholder:text-white/20 outline-none min-w-0"
                        placeholder="Paste YouTube URL…"
                        value={videoDraft}
                        onChange={e => setVideoDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && extractYoutubeId(videoDraft)) saveVideoMutation.mutate({ url: videoDraft, enabled: true });
                          if (e.key === "Escape") setEditingVideo(false);
                        }}
                        autoFocus
                      />
                    </div>
                    <Button
                      data-testid="btts-video-save-btn"
                      size="sm"
                      className={`bg-gradient-to-r ${FIRE} text-white border-0 text-xs h-9 px-4 shrink-0`}
                      onClick={() => saveVideoMutation.mutate({ url: videoDraft, enabled: true })}
                      disabled={saveVideoMutation.isPending || !extractYoutubeId(videoDraft)}
                    >
                      {saveVideoMutation.isPending ? "…" : "Save"}
                    </Button>
                  </div>
                  {videoDraft && !extractYoutubeId(videoDraft) && (
                    <p className="text-[10px] text-red-400/60 px-4 pb-2.5">Not a valid YouTube URL</p>
                  )}
                  {/* Video mode selector */}
                  <div className="px-3 pb-3 flex gap-2">
                    {(["background","silent","sound"] as const).map(m => (
                      <button key={m} onClick={() => saveVideoMutation.mutate({ mode: m as any } as any)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-all ${videoMode === m ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}>
                        {m === "background" ? "Visual" : m === "silent" ? "Silent" : "Sound"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scroll indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce opacity-30">
            <div className="w-px h-10 bg-gradient-to-b from-transparent to-orange-400" />
          </div>
        </section>

        {/* ── MISSION STRIP ────────────────────────────────────────────────────── */}
        <section className="py-14 border-y border-white/5 bg-[#0a0a10]">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[{icon:<Trophy className="w-6 h-6 text-orange-400"/>,title:"Battle Culture",desc:"Dance battles at the heart of everything — Breaking, Popping, Locking, and all urban styles. Authentic competition, real respect."},{icon:<Music className="w-6 h-6 text-orange-400"/>,title:"Music & Art",desc:"DJs, rappers, live graffiti writers, and street performers unite to create an immersive multi-sense urban experience."},{icon:<Users className="w-6 h-6 text-orange-400"/>,title:"Community",desc:"Founded by Riki Almouti & Marth Craandijk. Free entry, open to all. Because culture belongs to everyone."}].map(({icon,title,desc})=>(
              <div key={title} className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">{icon}</div>
                <div><h3 className="text-white font-bold mb-1">{title}</h3><p className="text-white/50 text-sm leading-relaxed">{desc}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PROGRAM ──────────────────────────────────────────────────────────── */}
        <section id="btts-program" className="py-20 sm:py-28">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-14">
              <Badge className="mb-4 bg-orange-500/15 text-orange-300 border-orange-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Program</Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Full Day Schedule</h2>
              <p className="text-white/45 text-base max-w-lg mx-auto">From doors open to closing party — every moment packed with culture.</p>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between mb-6 p-3 rounded-2xl bg-orange-500/8 border border-orange-500/20">
                <span className="text-orange-300/70 text-xs flex items-center gap-1.5"><SquarePen className="w-3.5 h-3.5"/>Click any item below to edit it</span>
                <Button size="sm" onClick={()=>handleAdd("program")} className={`bg-gradient-to-r ${FIRE} text-white border-0 text-xs h-7 gap-1`}><Plus className="w-3 h-3"/>Add Item</Button>
              </div>
            )}
            <div className="relative">
              <div className="absolute left-[88px] top-0 bottom-0 w-px bg-gradient-to-b from-orange-500/40 via-orange-500/20 to-transparent hidden sm:block" />
              <div className="space-y-3">
                {program.map((item:any,i:number)=>(
                  <AdminClickable key={item.id??i} onEdit={()=>openProgram(item)}>
                    <div className={`relative flex gap-4 sm:gap-6 p-4 rounded-2xl border transition-colors ${item.isHighlight?"bg-orange-500/10 border-orange-500/30 ring-1 ring-orange-500/20":"bg-white/[0.03] border-white/8 hover:border-white/15"}`}>
                      <div className="w-[72px] shrink-0 text-right">
                        <span className="text-xs font-mono font-bold text-orange-400">{item.time}</span>
                        {item.endTime&&<span className="block text-[10px] text-white/25 font-mono">{item.endTime}</span>}
                      </div>
                      <div className="hidden sm:flex items-start pt-0.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center z-10 ${item.isHighlight?"bg-orange-500/30 border border-orange-500/50":"bg-white/5 border border-white/10"}`}>{typeIcon(item.type)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className={`font-bold text-sm ${item.isHighlight?"text-orange-200":"text-white"}`}>{item.title}</h4>
                          {item.isHighlight&&<Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[9px] px-2 py-0.5">HIGHLIGHT</Badge>}
                          <Badge variant="outline" className={`text-[9px] px-2 py-0.5 ${typeBadge(item.type)}`}>{item.type}</Badge>
                        </div>
                        {item.artist&&<p className="text-xs text-white/50 mb-1 font-medium">{item.artist}</p>}
                        {item.stage&&<p className="text-[10px] text-white/30 mb-1">{item.stage}</p>}
                        {item.description&&<p className="text-xs text-white/40 leading-relaxed">{item.description}</p>}
                      </div>
                    </div>
                  </AdminClickable>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── LINEUP ───────────────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28 bg-[#070710]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <Badge className="mb-4 bg-orange-500/15 text-orange-300 border-orange-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Team</Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">The People Behind BTTS</h2>
              <p className="text-white/45 text-base max-w-lg mx-auto">From the organizer to the judges, DJs, and crew — every role has its own identity.</p>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between mb-8 p-3 rounded-2xl bg-orange-500/8 border border-orange-500/20">
                <span className="text-orange-300/70 text-xs flex items-center gap-1.5"><SquarePen className="w-3.5 h-3.5"/>Click any card to edit</span>
                <Button size="sm" onClick={()=>handleAdd("lineup")} className={`bg-gradient-to-r ${FIRE} text-white border-0 text-xs h-7 gap-1`}><Plus className="w-3 h-3"/>Add Member</Button>
              </div>
            )}

            {/* Organizer — hero card, always first */}
            {lineup.filter((m:any)=>m.category==="organizer").length>0&&(
              <div className="mb-10">
                <p className="text-[10px] font-bold tracking-widest uppercase text-orange-400/60 mb-4">Organizers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...(lineup as any[])].filter(m=>m.category==="organizer").sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((m:any,i:number)=>(
                    <AdminClickable key={m.id??i} onEdit={()=>openLineup(m)}>
                      <div className="relative rounded-3xl overflow-hidden border border-orange-500/30 bg-gradient-to-br from-orange-950/60 via-red-950/40 to-transparent p-6">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,#f9731615,transparent)]"/>
                        <div className="absolute top-5 right-5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-[0_0_20px_#f59e0b60]">
                            <Star className="w-4 h-4 text-white fill-white"/>
                          </div>
                        </div>
                        <div className="relative flex gap-5 items-start">
                          <div className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-orange-500/30 to-red-500/20 border border-orange-500/40 flex items-center justify-center text-2xl font-black text-orange-300 shadow-[0_0_30px_#f9731625]">
                            {m.imageUrl?<img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover"/>:<RoleEmblem category={m.category} size={56}/>}
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="text-white font-black text-lg">{m.name}</h3>
                            </div>
                            <p className="text-orange-300 text-xs font-bold mb-3 tracking-wide uppercase">{m.role}</p>
                            {m.bio&&<BioExpandable bio={m.bio} lines={3} className="text-white/50 text-sm leading-relaxed"/>}
                            {m.instagram&&<a href={`https://instagram.com/${m.instagram}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors"><Instagram className="w-3.5 h-3.5"/>@{m.instagram}</a>}
                          </div>
                        </div>
                      </div>
                    </AdminClickable>
                  ))}
                </div>
              </div>
            )}

            {/* Judges */}
            {lineup.filter((m:any)=>m.category==="judge").length>0&&(
              <div className="mb-10">
                <p className="text-[10px] font-bold tracking-widest uppercase text-orange-400/60 mb-4 flex items-center gap-2"><Trophy className="w-3.5 h-3.5"/>Judges</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...(lineup as any[])].filter(m=>m.category==="judge").sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((m:any,i:number)=>(
                    <AdminClickable key={m.id??i} onEdit={()=>openLineup(m)}>
                      <div className="relative p-5 rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/30 to-transparent overflow-hidden group">
                        <div className="flex gap-4 items-start">
                          <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center text-lg font-black text-orange-300">
                              {m.imageUrl?<img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover"/>:<RoleEmblem category="judge" size={44}/>}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-500/90 flex items-center justify-center shadow-md">
                              <Trophy className="w-2.5 h-2.5 text-white"/>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold text-sm mb-0.5">{m.name}</h4>
                            <p className="text-orange-300/70 text-[10px] font-semibold uppercase tracking-wide">{m.role}</p>
                            {m.bio&&<BioExpandable bio={m.bio} lines={2} className="text-white/35 text-xs leading-relaxed mt-2"/>}
                            {m.instagram&&<a href={`https://instagram.com/${m.instagram}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="mt-2 flex items-center gap-1 text-[10px] text-white/25 hover:text-white/60 transition-colors"><Instagram className="w-3 h-3"/>@{m.instagram}</a>}
                          </div>
                        </div>
                      </div>
                    </AdminClickable>
                  ))}
                </div>
              </div>
            )}

            {/* DJs */}
            {lineup.filter((m:any)=>m.category==="dj").length>0&&(
              <div className="mb-10">
                <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400/60 mb-4 flex items-center gap-2"><Disc3 className="w-3.5 h-3.5"/>DJs</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...(lineup as any[])].filter(m=>m.category==="dj").sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((m:any,i:number)=>(
                    <AdminClickable key={m.id??i} onEdit={()=>openLineup(m)}>
                      <div className="relative p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-transparent overflow-hidden">
                        <div className="flex gap-4 items-start">
                          <div className="relative shrink-0">
                            <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-900/20 border border-blue-500/30 flex items-center justify-center text-lg font-black text-blue-300 shadow-[0_0_20px_#3b82f620]">
                              {m.imageUrl?<img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover"/>:<RoleEmblem category="dj" size={44}/>}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500/90 flex items-center justify-center shadow-md">
                              <Disc3 className="w-2.5 h-2.5 text-white"/>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold text-sm mb-0.5">{m.name}</h4>
                            <p className="text-blue-300/70 text-[10px] font-semibold uppercase tracking-wide">{m.role}</p>
                            {m.bio&&<BioExpandable bio={m.bio} lines={2} className="text-white/35 text-xs leading-relaxed mt-2"/>}
                            {m.instagram&&<a href={`https://instagram.com/${m.instagram}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="mt-2 flex items-center gap-1 text-[10px] text-white/25 hover:text-white/60 transition-colors"><Instagram className="w-3 h-3"/>@{m.instagram}</a>}
                          </div>
                        </div>
                      </div>
                    </AdminClickable>
                  ))}
                </div>
              </div>
            )}

            {/* Performers, Hosts, Crew */}
            {lineup.filter((m:any)=>!["organizer","judge","dj"].includes(m.category)).length>0&&(
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-pink-400/60 mb-4 flex items-center gap-2"><Mic2 className="w-3.5 h-3.5"/>Artists & Crew</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...(lineup as any[])].filter(m=>!["organizer","judge","dj"].includes(m.category)).sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((m:any,i:number)=>(
                    <AdminClickable key={m.id??i} onEdit={()=>openLineup(m)}>
                      <div className={`p-4 rounded-2xl border bg-white/[0.02] ${categoryColor(m.category)}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black overflow-hidden shrink-0 ${categoryColor(m.category)}`}>
                            {m.imageUrl?<img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover"/>:<RoleEmblem category={m.category} size={40}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5"><h4 className="text-white font-bold text-sm truncate">{m.name}</h4></div>
                            <p className="text-[10px] text-white/40 mt-0.5">{m.role}</p>
                          </div>
                          <div className="shrink-0 opacity-50">{categoryIcon(m.category)}</div>
                        </div>
                        {m.bio&&<BioExpandable bio={m.bio} lines={1} className="text-white/30 text-xs leading-relaxed mt-2"/>}
                      </div>
                    </AdminClickable>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── BATTLE BRACKETS ──────────────────────────────────────────────────── */}
        {(bttsSettings.bracketPublic || isAdmin) && (
        <section className="py-20 sm:py-28" id="btts-bracket">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-orange-500/15 text-orange-300 border-orange-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Live Bracket</Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Battle Brackets</h2>
              <p className="text-white/45 text-base max-w-lg mx-auto">Live bracket — updated as battles progress.</p>
            </div>

            {/* Format tabs */}
            <div className="flex gap-2 flex-wrap justify-center mb-8">
              {BATTLE_FORMATS.map(f=>(
                <button key={f.id} onClick={()=>setActiveBracketFormat(f.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold transition-all ${activeBracketFormat===f.id?"bg-gradient-to-r from-orange-500/30 to-red-500/20 border-orange-500/50 text-orange-300":"border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"}`}>
                  {f.icon}{f.label}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className="space-y-3 mb-6">
                {/* Confirmed battlers summary for current format */}
                {activeBracketFormat !== "7smoke" && activeBracketFormat !== "all" && (()=>{
                  const confirmed = registrations.filter((r:any)=>r.status==="confirmed"&&r.battleType===activeBracketFormat);
                  const total = confirmed.length;
                  let bracketSize = 0; if(total>=2){let p=2;while(p<total)p*=2;bracketSize=p;}
                  return total > 0 ? (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-green-500/8 border border-green-500/20">
                      <Users className="w-3.5 h-3.5 text-green-400 shrink-0"/>
                      <span className="text-green-300/80 text-xs flex-1">
                        <strong className="text-green-300">{total} confirmed</strong> for {activeBracketFormat} → <strong className="text-green-300">{bracketSize}-person bracket</strong> ({Math.log2(bracketSize)} rounds)
                      </span>
                      <Button size="sm" disabled={generateBracketMut.isPending}
                        onClick={()=>generateBracketMut.mutate({battleType:activeBracketFormat,category:"Breaking"})}
                        className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 text-xs h-7 gap-1">
                        <RefreshCw className={`w-3 h-3 ${generateBracketMut.isPending?"animate-spin":""}`}/>
                        {generateBracketMut.isPending?"Syncing…":"Sync Bracket"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/3 border border-white/8">
                      <Users className="w-3.5 h-3.5 text-white/20 shrink-0"/>
                      <span className="text-white/30 text-xs flex-1">No confirmed battlers for {activeBracketFormat} yet — confirm registrations to auto-build the bracket</span>
                    </div>
                  );
                })()}
                {/* Admin toolbar */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-500/8 border border-orange-500/20 flex-wrap">
                  <span className="text-orange-300/70 text-xs flex items-center gap-1.5 flex-1"><SquarePen className="w-3.5 h-3.5"/>Click any matchup to edit</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/30 text-xs">Public</span>
                    <button onClick={()=>saveSettingsMut.mutate({bracketPublic:!bttsSettings.bracketPublic})}
                      className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${bttsSettings.bracketPublic?"bg-gradient-to-r from-orange-500 to-red-500":"bg-white/15"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${bttsSettings.bracketPublic?"translate-x-4":"translate-x-0"}`}/>
                    </button>
                  </div>
                  {activeBracketFormat !== "7smoke" && (
                    <Button size="sm" variant="outline" disabled={generateBracketMut.isPending}
                      onClick={()=>generateBracketMut.mutate({battleType:activeBracketFormat==="all"?"1v1":activeBracketFormat,category:"Breaking",forceRegen:true})}
                      className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10 bg-transparent text-xs h-7 gap-1">
                      <RefreshCw className={`w-3 h-3 ${generateBracketMut.isPending?"animate-spin":""}`}/>Rebuild
                    </Button>
                  )}
                  <Button size="sm" onClick={()=>handleAdd("battles")} className={`bg-gradient-to-r ${FIRE} text-white border-0 text-xs h-7 gap-1`}><Plus className="w-3 h-3"/>Add Battle</Button>
                </div>
              </div>
            )}

            {/* Seven-to-smoke layout */}
            {activeBracketFormat==="7smoke" ? (
              <SevenToSmokeView battles={battles} isAdmin={isAdmin} openBattle={openBattle}/>
            ) : allRounds.length===0 ? (
              <div className="text-center py-20 text-white/25 border border-white/5 rounded-3xl">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30"/>
                <p className="text-sm">Bracket will appear once battles are added.</p>
                {isAdmin&&<Button size="sm" onClick={()=>handleAdd("battles")} className={`mt-4 bg-gradient-to-r ${FIRE} text-white border-0`}><Plus className="w-3.5 h-3.5 mr-1.5"/>Add first battle</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto pb-6">
                <div className="flex gap-6 min-w-max items-start">
                  {[...allRounds].reverse().map((round, rIdx)=>(
                    <div key={round} className="flex flex-col" style={{ gap: `${Math.pow(2,rIdx)*8+8}px`, paddingTop: `${Math.pow(2,rIdx)*4}px` }}>
                      <p className="text-[10px] font-bold tracking-widest uppercase text-orange-400/70 text-center mb-3">{round}</p>
                      {battlesByRound[round].map((battle:any,i:number)=>(
                        <AdminClickable key={battle.id??i} onEdit={()=>openBattle(battle)}>
                          <div className={`relative w-52 rounded-2xl border p-0 overflow-hidden transition-all ${
                            battle.status==="live"?"border-yellow-500/50 shadow-[0_0_24px_#eab30825]":
                            battle.status==="completed"?"border-green-500/30":
                            "border-white/10"}`}>
                            {battle.status==="live"&&<div className="absolute top-2 right-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/><span className="text-[9px] text-yellow-400 font-bold">LIVE</span></div>}
                            {[battle.participant1,battle.participant2].map((p:string|null,pi:number)=>(
                              <div key={pi} className={`px-3 py-2.5 text-sm font-semibold border-b last:border-b-0 border-white/5 flex items-center gap-2 ${
                                battle.winner&&battle.winner===p?"bg-green-500/15 text-green-200":
                                battle.winner&&battle.winner!==p?"bg-black/20 text-white/30 line-through":
                                "bg-white/[0.02] text-white/70"}`}>
                                {battle.winner&&battle.winner===p&&<Check className="w-3.5 h-3.5 text-green-400 shrink-0"/>}
                                <span className="truncate">{p??"TBA"}</span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-black/20">
                              {battle.scheduledTime&&<span className="text-[10px] text-white/20 font-mono">{battle.scheduledTime}</span>}
                              <span className={`text-[9px] font-bold ml-auto ${battle.status==="live"?"text-yellow-400":battle.status==="completed"?"text-green-400":"text-white/25"}`}>{battle.status}</span>
                            </div>
                          </div>
                          {isAdmin && battle.id && battle.id > 0 && <BattleDeleteButton battle={battle} onDeleted={()=>{}} />}
                        </AdminClickable>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Judging panel — shown when bracket is public */}
            {judges.length>0&&(
              <div className="mt-12 pt-8 border-t border-white/8">
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/30 mb-6 text-center">Judging Panel · {bttsSettings.judgeCount} Judges</p>
                <div className="flex flex-wrap justify-center gap-4">
                  {judges.map((j:any)=>(
                    <div key={j.id} className="flex flex-col items-center gap-2 group">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500/15 to-red-500/10 border border-orange-500/25 flex items-center justify-center text-base font-black text-orange-300 shadow-[0_0_15px_#f9731610]">
                        {j.avatarUrl?<img src={j.avatarUrl} alt={j.guestName??""} className="w-full h-full object-cover"/>:
                          <Trophy className="w-5 h-5 text-orange-400/60"/>}
                      </div>
                      <div className="text-center">
                        <p className="text-white/70 text-xs font-semibold">{j.guestName??`Judge ${j.judgeNumber}`}</p>
                        {j.specialty&&<p className="text-white/30 text-[10px]">{j.specialty}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {/* ── JOIN THE EVENT (Tickets) ──────────────────────────────────────────── */}
        {(publicTickets.filter((t:any)=>t.isActive).length > 0) && (
          <section className="py-16 sm:py-20 bg-gradient-to-b from-[#050508] to-[#06060a]" id="btts-spots">
            <div className="max-w-5xl mx-auto px-6">

              {/* Section header */}
              <div className="text-center mb-10">
                <Badge className="mb-4 bg-orange-500/15 text-orange-300 border-orange-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Join the Event</Badge>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">How Do You Want to Join?</h2>
                <p className="text-white/40 text-base max-w-lg mx-auto">Choose your path — come as a guest and soak up the culture, or step up and battle.</p>
              </div>

              {/* My tickets/spots — logged-in user confirmation */}
              {mySpots.length > 0 && (()=>{
                // Sort: confirmed first, then pending_payment, then others, then cancelled last
                const statusOrder: Record<string,number> = { confirmed:0, pending_payment:1, pending:2, cancelled:99 };
                const sorted = [...(mySpots as any[])].sort((a,b)=>
                  (statusOrder[a.status]??5) - (statusOrder[b.status]??5)
                );
                const confirmedCount = sorted.filter(s=>s.status==="confirmed").length;
                return (
                  <div className="mb-8" id="btts-my-tickets">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                        <CircleCheck className="w-4 h-4 text-green-400"/>
                      </div>
                      <div>
                        <h3 className="text-white font-black text-sm">Your Tickets</h3>
                        <p className="text-white/35 text-[10px]">{confirmedCount} confirmed · {sorted.length} total</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {sorted.map((s:any)=>{
                        const isBattleSpot = s.ticket?.type === "spot";
                        const isGuestPass  = s.ticket?.type === "guest";
                        const isConfirmed  = s.status === "confirmed";
                        const isCancelled  = s.status === "cancelled";
                        const isPending    = !isConfirmed && !isCancelled;
                        const accentBorder = isBattleSpot ? "border-orange-500/30" : isGuestPass ? "border-emerald-500/25" : "border-blue-500/25";
                        const accentBg     = isBattleSpot ? "from-orange-500/8 to-transparent" : isGuestPass ? "from-emerald-500/8 to-transparent" : "from-blue-500/8 to-transparent";
                        const accentBar    = isBattleSpot ? "bg-gradient-to-r from-orange-500 to-red-500" : isGuestPass ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-blue-500 to-violet-500";
                        const accentColor  = isBattleSpot ? "text-orange-400" : isGuestPass ? "text-emerald-400" : "text-blue-400";
                        const entryLabel   = isBattleSpot ? `Battle Spot #${s.spotNumber}` : isGuestPass ? "Guest Pass" : "General Entry";
                        return (
                          <div key={s.id} className={`rounded-2xl border overflow-hidden ${isCancelled?"border-white/8 opacity-50":isConfirmed?accentBorder:"border-white/10"}`} data-testid={`my-spot-${s.id}`}>
                            {/* Accent bar */}
                            <div className={`h-0.5 w-full ${isConfirmed?accentBar:"bg-white/10"}`}/>
                            {/* Main row */}
                            <div className={`p-4 bg-gradient-to-r ${isConfirmed?accentBg:"from-white/[0.02] to-transparent"}`}>
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isBattleSpot?"bg-orange-500/15 border border-orange-500/25":isGuestPass?"bg-emerald-500/15 border border-emerald-500/20":"bg-blue-500/15 border border-blue-500/20"}`}>
                                  {isBattleSpot ? <Swords className="w-4 h-4 text-orange-400"/> : isGuestPass ? <Users className="w-4 h-4 text-emerald-400"/> : <Ticket className="w-4 h-4 text-blue-400"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-white font-black text-sm">{s.ticket?.name ?? "Ticket"}</p>
                                    <Badge className={`text-[9px] px-2 py-0 shrink-0 ${isConfirmed?"bg-green-500/20 text-green-300 border-green-500/30":isCancelled?"bg-red-500/20 text-red-300 border-red-500/30":"bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                                      {isConfirmed?"✓ Confirmed":isCancelled?"Cancelled":"Pending"}
                                    </Badge>
                                    {isAdmin && <TicketPurchaseDeleteButton purchase={s} onDeleted={()=>{}} />}
                                  </div>
                                  <p className={`text-xs mt-0.5 font-medium ${accentColor}`}>{entryLabel}</p>
                                  <p className="text-white/30 text-[10px] mt-0.5">{bttsSettings.eventTitle} {bttsSettings.eventYear}{bttsSettings.eventVenue?` · ${bttsSettings.eventVenue}`:""}</p>
                                  <div className="flex flex-wrap items-center gap-3 mt-2">
                                    {s.registrationId && <span className="flex items-center gap-1 text-[10px] text-green-400/70"><CircleCheck className="w-3 h-3"/>Battle registration confirmed</span>}
                                    {s.amountPaid && Number(s.amountPaid) > 0
                                      ? <span className="text-[10px] text-white/30">Paid €{Number(s.amountPaid).toFixed(2)}</span>
                                      : isConfirmed ? <span className="text-[10px] text-white/30">Free entry</span> : null}
                                    <span className="text-[10px] text-white/20">#{s.id}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* QR code — confirmed tickets */}
                            {isConfirmed && s.qrCode && (
                              <div className="border-t border-white/8 bg-[#06060a] flex flex-col sm:flex-row items-center gap-5 p-5">
                                <div className="flex flex-col items-center gap-2 shrink-0">
                                  <p className={`text-[9px] font-bold uppercase tracking-widest ${accentColor}`}>📲 Scan at Entry</p>
                                  <div className="bg-white rounded-2xl p-3 shadow-lg" style={{boxShadow:`0 0 0 3px ${isBattleSpot?"rgba(249,115,22,0.3)":isGuestPass?"rgba(16,185,129,0.3)":"rgba(59,130,246,0.3)"},0 8px 32px rgba(0,0,0,0.5)`}}>
                                    <img src={s.qrCode} alt="Ticket QR code" className="w-44 h-44 block rounded-lg" data-testid={`qr-code-${s.id}`} />
                                  </div>
                                  <p className="text-white/20 text-[9px]">Ticket #{s.id}</p>
                                </div>
                                <div className="flex-1 space-y-3 sm:text-left text-center">
                                  <div>
                                    <p className="text-white font-bold text-sm">{s.ticket?.name}</p>
                                    <p className={`text-xs font-semibold mt-0.5 ${accentColor}`}>{entryLabel}</p>
                                  </div>
                                  <div className="space-y-1.5 text-xs text-white/40">
                                    {bttsSettings.eventDate&&<p className="flex items-center gap-1.5"><Calendar className="w-3 h-3 shrink-0"/>{bttsSettings.eventDate}</p>}
                                    {bttsSettings.eventVenue&&<p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0"/>{bttsSettings.eventVenue}{bttsSettings.eventCity?`, ${bttsSettings.eventCity}`:""}</p>}
                                  </div>
                                  <p className="text-white/25 text-[10px] leading-relaxed">Show this QR code to the staff at the entrance. It can only be scanned once and is valid for this event only.</p>
                                </div>
                              </div>
                            )}
                            {isConfirmed && !s.qrCode && (
                              <div className="border-t border-white/5 p-3 bg-[#06060a] text-center">
                                <p className="text-white/25 text-[10px] flex items-center justify-center gap-1.5"><span className="animate-pulse">⟳</span> QR code generating — refresh in a moment</p>
                              </div>
                            )}
                            {isPending && (
                              <div className="border-t border-amber-500/10 p-4 bg-amber-500/[0.03] flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div>
                                  <p className="text-amber-300/80 text-xs font-semibold">Payment not completed</p>
                                  <p className="text-amber-400/50 text-[10px] mt-0.5">Your spot is <strong>not secured</strong> until payment is done.</p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const t = publicTickets.find((pt: any) => pt.id === s.ticketId);
                                    if (t) {
                                      setClaimModalTicket(t);
                                      setClaimForm({ guestName: s.guestName ?? "", guestEmail: s.guestEmail ?? "", notes: s.notes ?? "" });
                                    } else {
                                      toast({ title: "Ticket no longer available", description: "This ticket type has been removed. Please contact the organizer.", variant: "destructive" });
                                    }
                                  }}
                                  className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 border-0"
                                  data-testid={`button-retry-payment-${s.id}`}
                                >
                                  Complete Payment →
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Three-path layout: Guest | General | Battle */}
              {(()=>{
                const active = publicTickets.filter((t:any)=>t.isActive);
                const guestOnlyTickets   = active.filter((t:any)=>t.type==="guest");
                const generalTickets     = active.filter((t:any)=>t.type==="general");
                const battleTickets      = active.filter((t:any)=>t.type==="spot");
                const visibleCols = [guestOnlyTickets.length>0, generalTickets.length>0, battleTickets.length>0].filter(Boolean).length;
                const renderTicketCard = (t:any) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    isAdmin={isAdmin}
                    mySpots={mySpots as any[]}
                    setPublicEditingTicket={setPublicEditingTicket}
                    deletePublicTicketMut={deletePublicTicketMut}
                    setClaimModalTicket={setClaimModalTicket}
                    setClaimForm={setClaimForm}
                  />
                );

                return (
                  <div className={`grid gap-6 ${visibleCols===3?"lg:grid-cols-3":visibleCols===2?"lg:grid-cols-2":"grid-cols-1 max-w-2xl mx-auto"}`}>

                    {/* Guest Ticket path */}
                    {guestOnlyTickets.length > 0 && (
                      <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden">
                        <div className="p-6 border-b border-emerald-500/10">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Users className="w-5 h-5 text-emerald-400"/>
                            </div>
                            <div>
                              <h3 className="text-white font-black text-base">Guest Pass</h3>
                              <p className="text-white/40 text-xs mt-0.5 leading-relaxed">For invited guests and normal visitors — attend and enjoy the culture.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {["Event entry","Guest access","Watch all battles"].map(f=>(
                              <span key={f} className="flex items-center gap-1 text-[10px] text-emerald-300/60 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-full">
                                <Check className="w-2.5 h-2.5"/>{f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {guestOnlyTickets.map((t:any)=>renderTicketCard(t))}
                        </div>
                      </div>
                    )}

                    {/* General Entry path */}
                    {generalTickets.length > 0 && (
                      <div className="rounded-3xl border border-blue-500/15 bg-blue-500/[0.03] overflow-hidden">
                        <div className="p-6 border-b border-blue-500/10">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Ticket className="w-5 h-5 text-blue-400"/>
                            </div>
                            <div>
                              <h3 className="text-white font-black text-base">General Entry</h3>
                              <p className="text-white/40 text-xs mt-0.5 leading-relaxed">Attend the event, watch the battles, experience the culture — no competition required.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {["Event entry included","Watch all battles","Full event access"].map(f=>(
                              <span key={f} className="flex items-center gap-1 text-[10px] text-blue-300/60 bg-blue-500/8 border border-blue-500/15 px-2.5 py-1 rounded-full">
                                <Check className="w-2.5 h-2.5"/>{f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {generalTickets.map((t:any)=>renderTicketCard(t))}
                        </div>
                      </div>
                    )}

                    {/* Battle path */}
                    {battleTickets.length > 0 && (
                      <div className="rounded-3xl border border-orange-500/20 bg-orange-500/[0.03] overflow-hidden">
                        <div className="p-6 border-b border-orange-500/10">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 mt-0.5">
                              <Swords className="w-5 h-5 text-orange-400"/>
                            </div>
                            <div>
                              <h3 className="text-white font-black text-base">Joining the Battle?</h3>
                              <p className="text-white/40 text-xs mt-0.5 leading-relaxed">Secure your battle spot — entry and registration handled in one step.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {["Event entry included","Battle spot secured","Registration auto-confirmed"].map(f=>(
                              <span key={f} className="flex items-center gap-1 text-[10px] text-orange-300/60 bg-orange-500/8 border border-orange-500/15 px-2.5 py-1 rounded-full">
                                <Check className="w-2.5 h-2.5"/>{f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {battleTickets.map((t:any)=>renderTicketCard(t))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Event anchor footer */}
              {bttsSettings.eventDate && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-5 p-4 rounded-2xl border border-white/5 bg-white/[0.015] text-xs text-white/30">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-orange-400/50"/>{bttsSettings.eventTitle} · {bttsSettings.eventDate}</span>
                  {bttsSettings.eventVenue&&<span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-orange-400/50"/>{bttsSettings.eventVenue}{bttsSettings.eventCity?`, ${bttsSettings.eventCity}`:""}</span>}
                  <span className="flex items-center gap-1.5"><CircleCheck className="w-3.5 h-3.5 text-green-400/50"/>Tickets linked to this event</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Public Ticket Edit Dialog (admin) ────────────────────────────── */}
        {publicEditingTicket && (
          <Dialog open onOpenChange={v => !v && setPublicEditingTicket(null)}>
            <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Pencil className="w-4 h-4 text-orange-400"/>Edit Ticket Type
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">Name</Label>
                  <Input
                    value={publicEditingTicket.name}
                    onChange={e => setPublicEditingTicket((f:any) => ({...f, name: e.target.value}))}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-public-ticket-name"
                  />
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">Description</Label>
                  <Textarea
                    value={publicEditingTicket.description ?? ""}
                    onChange={e => setPublicEditingTicket((f:any) => ({...f, description: e.target.value}))}
                    className="bg-white/5 border-white/10 text-white resize-none"
                    rows={2}
                    data-testid="input-public-ticket-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/60 text-xs mb-1.5 block">Price (€)</Label>
                    <Input
                      type="number" min={0}
                      value={publicEditingTicket.price}
                      onChange={e => setPublicEditingTicket((f:any) => ({...f, price: Number(e.target.value)}))}
                      className="bg-white/5 border-white/10 text-white"
                      data-testid="input-public-ticket-price"
                    />
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs mb-1.5 block">Total Spots (0 = unlimited)</Label>
                    <Input
                      type="number" min={0}
                      value={publicEditingTicket.totalSpots}
                      onChange={e => setPublicEditingTicket((f:any) => ({...f, totalSpots: Number(e.target.value)}))}
                      className="bg-white/5 border-white/10 text-white"
                      data-testid="input-public-ticket-spots"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">Type</Label>
                  <Select value={publicEditingTicket.type} onValueChange={v => setPublicEditingTicket((f:any) => ({...f, type: v}))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                      <SelectItem value="general">General Entry</SelectItem>
                      <SelectItem value="guest">Guest Pass</SelectItem>
                      <SelectItem value="spot">Battle Spot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {publicEditingTicket.type === "spot" && (
                  <div>
                    <Label className="text-white/60 text-xs mb-1.5 block">Battle Format</Label>
                    <Select value={publicEditingTicket.battleFormat ?? "1v1"} onValueChange={v => setPublicEditingTicket((f:any) => ({...f, battleFormat: v}))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                        <SelectItem value="1v1">1v1</SelectItem>
                        <SelectItem value="2v2">2v2</SelectItem>
                        <SelectItem value="crew">Crew</SelectItem>
                        <SelectItem value="7-to-smoke">7 to Smoke</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    checked={publicEditingTicket.isActive}
                    onCheckedChange={v => setPublicEditingTicket((f:any) => ({...f, isActive: v}))}
                    id="public-ticket-active"
                  />
                  <Label htmlFor="public-ticket-active" className="text-white/60 text-xs cursor-pointer">Active (visible to users)</Label>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPublicEditingTicket(null)} className="border-white/10 text-white hover:bg-white/5">
                  Cancel
                </Button>
                <Button
                  onClick={() => updatePublicTicketMut.mutate({ id: publicEditingTicket.id, data: publicEditingTicket })}
                  disabled={updatePublicTicketMut.isPending}
                  className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}
                  data-testid="button-save-public-ticket"
                >
                  {updatePublicTicketMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── Claim Modal ─────────────────────────────────────────────────────── */}
        {claimModalTicket && (
          <Dialog open onOpenChange={v=>!v&&setClaimModalTicket(null)}>
            <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {claimModalTicket.type==="spot" ? <Swords className="w-5 h-5 text-orange-400"/> : claimModalTicket.type==="guest" ? <Users className="w-5 h-5 text-emerald-400"/> : <Ticket className="w-5 h-5 text-blue-400"/>}
                  {claimModalTicket.type==="spot" ? "Secure Your Battle Spot" : claimModalTicket.type==="guest" ? "Get Your Guest Pass" : "Get Your Entry Ticket"}
                </DialogTitle>
              </DialogHeader>

              {/* Path context banner */}
              {claimModalTicket.type==="spot" ? (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-orange-400 shrink-0"/>
                    <p className="text-orange-300 font-bold text-sm">{claimModalTicket.name}</p>
                    <span className="ml-auto text-orange-300 font-black text-sm">{claimModalTicket.price===0?"Free":`€${Number(claimModalTicket.price).toFixed(2)}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
                    {bttsSettings.eventDate&&<span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>{bttsSettings.eventDate}</span>}
                    {bttsSettings.eventVenue&&<span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/>{bttsSettings.eventVenue}</span>}
                    {claimModalTicket.battleFormat&&<span className="flex items-center gap-1"><Trophy className="w-2.5 h-2.5"/>Format: {claimModalTicket.battleFormat}</span>}
                  </div>
                  <div className="pt-1 border-t border-orange-500/15 space-y-1">
                    {["Event entry included","Battle spot reserved in bracket","Battle registration created instantly","Organizer confirms your place"].map(f=>(
                      <p key={f} className="flex items-center gap-1.5 text-[10px] text-green-300/70"><CircleCheck className="w-3 h-3 text-green-400 shrink-0"/>{f}</p>
                    ))}
                  </div>
                </div>
              ) : claimModalTicket.type==="guest" ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400 shrink-0"/>
                    <p className="text-emerald-300 font-bold text-sm">{claimModalTicket.name}</p>
                    <span className="ml-auto text-emerald-300 font-black text-sm">{claimModalTicket.price===0?"Free":`€${Number(claimModalTicket.price).toFixed(2)}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
                    {bttsSettings.eventDate&&<span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>{bttsSettings.eventDate}</span>}
                    {bttsSettings.eventVenue&&<span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/>{bttsSettings.eventVenue}</span>}
                  </div>
                  <div className="pt-1 border-t border-emerald-500/15 space-y-1">
                    {["Guest pass to the full event","Watch all battles","No competition required","Ticket sent to your email"].map(f=>(
                      <p key={f} className="flex items-center gap-1.5 text-[10px] text-emerald-300/70"><CircleCheck className="w-3 h-3 text-emerald-400 shrink-0"/>{f}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-blue-400 shrink-0"/>
                    <p className="text-blue-300 font-bold text-sm">{claimModalTicket.name}</p>
                    <span className="ml-auto text-blue-300 font-black text-sm">{claimModalTicket.price===0?"Free":`€${Number(claimModalTicket.price).toFixed(2)}`}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/40">
                    {bttsSettings.eventDate&&<span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5"/>{bttsSettings.eventDate}</span>}
                    {bttsSettings.eventVenue&&<span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/>{bttsSettings.eventVenue}</span>}
                  </div>
                  <div className="pt-1 border-t border-blue-500/15 space-y-1">
                    {["Full event entry","Watch all battles from the crowd","No battle registration required"].map(f=>(
                      <p key={f} className="flex items-center gap-1.5 text-[10px] text-blue-300/70"><CircleCheck className="w-3 h-3 text-blue-400 shrink-0"/>{f}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-white/50 text-xs">Your Name / Battle Name *</Label>
                  <Input placeholder="Stage name or full name"
                    value={claimForm.guestName}
                    onChange={e=>setClaimForm(f=>({...f,guestName:e.target.value}))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    data-testid="input-claim-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/50 text-xs">Email (optional — for confirmation)</Label>
                  <Input placeholder="your@email.com" type="email"
                    value={claimForm.guestEmail}
                    onChange={e=>setClaimForm(f=>({...f,guestEmail:e.target.value}))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    data-testid="input-claim-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/50 text-xs">Notes (optional)</Label>
                  <Textarea placeholder="Crew name, partner info, message for organizer…"
                    value={claimForm.notes}
                    onChange={e=>setClaimForm(f=>({...f,notes:e.target.value}))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    rows={2}
                    data-testid="input-claim-notes"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={()=>setClaimModalTicket(null)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
                <Button
                  onClick={()=>claimMut.mutate({id:claimModalTicket.id, data:{...claimForm, embedded:true}})}
                  disabled={!claimForm.guestName || claimMut.isPending}
                  className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}
                  data-testid="button-confirm-claim"
                >
                  {claimMut.isPending
                    ? (claimModalTicket.price > 0 ? "Preparing payment…" : "Securing…")
                    : claimModalTicket.price > 0
                      ? `Pay €${Number(claimModalTicket.price).toFixed(2)} → Secure Spot`
                      : claimModalTicket.type==="spot" ? "Secure My Spot (Free)" : claimModalTicket.type==="guest" ? "Get Guest Pass (Free)" : "Get Ticket (Free)"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── BATTLE REGISTRATION ───────────────────────────────────────────────── */}
        <section className="py-16 sm:py-20 bg-gradient-to-b from-[#050508] to-[#0a0510]" id="btts-register">
          <div className="max-w-3xl mx-auto px-6">
            {bttsSettings.registrationOpen ? (
              <div className="relative rounded-3xl border border-orange-500/30 overflow-hidden bg-gradient-to-br from-orange-950/50 via-red-950/30 to-transparent p-8 text-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#f9731615,transparent)]"/>
                <div className="relative">
                  <Badge className="mb-4 bg-orange-500/20 text-orange-300 border-orange-500/40 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Registration Open</Badge>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">{bttsSettings.eventTitle} {bttsSettings.eventYear}</h2>
                  {(bttsSettings.eventDate||bttsSettings.eventVenue) && (
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                      {bttsSettings.eventDate&&<span className="flex items-center gap-1.5 text-orange-300/70 text-xs font-semibold"><Calendar className="w-3 h-3"/>{bttsSettings.eventDate}</span>}
                      {bttsSettings.eventVenue&&<span className="flex items-center gap-1.5 text-white/40 text-xs"><MapPin className="w-3 h-3"/>{bttsSettings.eventVenue}{bttsSettings.eventCity?`, ${bttsSettings.eventCity}`:""}</span>}
                    </div>
                  )}

                  {/* ── State 1: Tickets configured, user has NO ticket ── */}
                  {hasActiveTickets && !hasValidTicket && (
                    <div className="space-y-5">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-orange-300 text-sm font-semibold">
                        <Swords className="w-4 h-4"/>
                        Secure a battle spot first, then registration opens
                      </div>
                      <p className="text-white/40 text-sm max-w-sm mx-auto">Battle registration is linked to your ticket. Get your battle spot ticket and your registration is confirmed instantly.</p>
                      <Button
                        onClick={()=>{ const el=document.getElementById("btts-spots"); if(el) el.scrollIntoView({behavior:"smooth"}); }}
                        className={`bg-gradient-to-r ${FIRE} text-white font-bold px-8 shadow-[0_0_30px_#f9731640] border-0`}
                        data-testid="button-get-ticket-first"
                      >
                        <Swords className="w-4 h-4 mr-2"/>Get a Battle Spot
                      </Button>

                      {/* Admin bypass — skip ticket gate for testing */}
                      {isAdmin && (
                        <div className="pt-2 border-t border-white/8 space-y-2">
                          <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Admin only</p>
                          <Button
                            variant="outline"
                            onClick={()=>{ setRegForm(f=>({...f,guestName:"Test Dancer",battleType:"1v1",category:"Breaking"})); setRegModalOpen(true); }}
                            className="border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/60 bg-transparent text-xs px-5"
                            data-testid="button-admin-test-register"
                          >
                            <Zap className="w-3.5 h-3.5 mr-2"/>Test Registration (bypass ticket)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── State 2: User has a BATTLE SPOT ticket (already auto-registered) ── */}
                  {hasSpotTicket && (
                    <div className="space-y-4">
                      <div className="inline-flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                          <CircleCheck className="w-7 h-7 text-green-400"/>
                        </div>
                        <span className="text-green-300 font-black text-lg">You're In!</span>
                      </div>
                      <p className="text-white/50 text-sm max-w-sm mx-auto">Your battle spot is secured and your registration was submitted automatically when you claimed your ticket. The organizer will confirm your place.</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {confirmedSpots.filter((s:any)=>s.ticket?.type==="spot").map((s:any)=>(
                          <div key={s.id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
                            <Swords className="w-3.5 h-3.5 text-orange-400"/>
                            <span className="text-white font-semibold">{s.ticket?.name}</span>
                            <span className="text-white/40">· Spot #{s.spotNumber}</span>
                          </div>
                        ))}
                      </div>
                      {/* Allow general ticket holders to also register if they have both */}
                      {hasGeneralTicket && (
                        <Button variant="outline" onClick={()=>{ setRegForm(f=>({...f,guestName:latestSpotName||f.guestName})); setRegModalOpen(true); }}
                          className="border-white/20 text-white/70 hover:bg-white/5 mt-2"
                          data-testid="button-register-extra">
                          <Trophy className="w-4 h-4 mr-2"/>Register Additional Entry
                        </Button>
                      )}
                    </div>
                  )}

                  {/* ── State 3: User has GENERAL ticket → registration unlocked ── */}
                  {!hasSpotTicket && hasGeneralTicket && (
                    <div className="space-y-5">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-green-500/10 border border-green-500/25 text-green-300 text-sm font-semibold">
                        <CircleCheck className="w-4 h-4"/>
                        Entry ticket confirmed — you can now register to battle
                      </div>
                      <p className="text-white/50 text-sm max-w-md mx-auto">You have a valid event ticket. If you also want to compete, complete your battle registration below.</p>
                      <Button
                        onClick={()=>{ setRegForm(f=>({...f,guestName:latestSpotName||f.guestName})); setRegModalOpen(true); }}
                        className={`bg-gradient-to-r ${FIRE} text-white font-bold px-8 shadow-[0_0_30px_#f9731640] border-0`}
                        data-testid="button-register-compete"
                      >
                        <Swords className="w-4 h-4 mr-2"/>Register to Compete
                      </Button>
                    </div>
                  )}

                  {/* ── State 4: No internal tickets → redirect to buy ticket if URL set, else open registration ── */}
                  {!hasActiveTickets && (
                    <div className="space-y-5">
                      {bttsSettings.ticketUrl ? (
                        <>
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-orange-300 text-sm font-semibold">
                            <Ticket className="w-4 h-4"/>
                            A ticket is required to register
                          </div>
                          <p className="text-white/40 text-sm max-w-sm mx-auto">Purchase your ticket first, then come back to complete your battle registration.</p>
                          <Button
                            onClick={() => { const el = document.getElementById("btts-spots"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
                            className={`bg-gradient-to-r ${FIRE} text-white font-bold px-8 shadow-[0_0_30px_#f9731640] border-0`}
                            data-testid="button-buy-ticket-inapp"
                          >
                            <Ticket className="w-4 h-4 mr-2"/>Get Your Ticket
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto">Registration is open. Sign up below to secure your spot in the battle.</p>
                          <Button onClick={()=>setRegModalOpen(true)} className={`bg-gradient-to-r ${FIRE} text-white font-bold px-8 shadow-[0_0_30px_#f9731640] border-0`}
                            data-testid="button-register-free">
                            <Trophy className="w-4 h-4 mr-2"/>Register to Compete
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 px-6 rounded-3xl border border-white/8 bg-white/[0.015]">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-white/30"/>
                </div>
                <h3 className="text-white/60 font-bold text-lg mb-2">Battle Registration</h3>
                <p className="text-white/30 text-sm">{isAdmin?"Registration is currently closed. Enable it from the admin panel.":"Battle registration is not yet open. Check back soon."}</p>
                {isAdmin&&<Button size="sm" onClick={()=>saveSettingsMut.mutate({registrationOpen:true})} className={`mt-4 bg-gradient-to-r ${FIRE} text-white border-0`}>Open Registration</Button>}
              </div>
            )}
          </div>
        </section>

        {/* ── Registration Modal ── */}
        {regModalOpen&&(
          <Dialog open onOpenChange={v=>!v&&setRegModalOpen(false)}>
            <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-md">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-orange-400"/>Register for Battle</DialogTitle></DialogHeader>
              <div className="space-y-3">
                {/* Ticket confirmed banner (when they have a ticket) */}
                {hasValidTicket ? (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-xs text-green-300 font-semibold">
                    <CircleCheck className="w-3.5 h-3.5 shrink-0"/>
                    Ticket confirmed — {confirmedSpots[0]?.ticket?.name ?? "Valid entry"}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300/80 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0"/>
                    A valid event ticket is required to compete. Make sure you have purchased a ticket before registering.
                  </div>
                )}
                <div className="space-y-1"><Label className="text-white/50 text-xs">Your Name / Battle Name *</Label>
                  <Input placeholder="Stage name or full name" value={regForm.guestName} onChange={e=>setRegForm(f=>({...f,guestName:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-reg-name"/>
                </div>
                <div className="space-y-1"><Label className="text-white/50 text-xs">Crew / Team Name</Label>
                  <Input placeholder="Optional crew name" value={regForm.crewName} onChange={e=>setRegForm(f=>({...f,crewName:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-white/50 text-xs">Battle Type</Label>
                    <Select value={regForm.battleType} onValueChange={v=>setRegForm(f=>({...f,battleType:v}))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                        {["1v1","2v2","3v3","crew"].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-white/50 text-xs">Category</Label>
                    <Input placeholder="Breaking, Popping…" value={regForm.category} onChange={e=>setRegForm(f=>({...f,category:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20"/>
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-white/50 text-xs">Notes (optional)</Label>
                  <Textarea placeholder="Any notes for the organizer" value={regForm.notes} onChange={e=>setRegForm(f=>({...f,notes:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20" rows={2}/>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={()=>setRegModalOpen(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
                <Button onClick={()=>registerMut.mutate(regForm)} disabled={!regForm.guestName||registerMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`} data-testid="button-submit-reg">
                  {registerMut.isPending?"Submitting…":"Submit Registration"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── GALLERY ──────────────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28 bg-[#070710]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-14">
              <Badge className="mb-4 bg-orange-500/15 text-orange-300 border-orange-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase">Gallery</Badge>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Photos & Videos</h2>
              <p className="text-white/45 text-base max-w-lg mx-auto">The visual memory of Back to the Street — every moment captured.</p>
            </div>
            {isAdmin && (
              <div className="flex items-center justify-between mb-6 p-3 rounded-2xl bg-orange-500/8 border border-orange-500/20">
                <span className="text-orange-300/70 text-xs flex items-center gap-1.5"><SquarePen className="w-3.5 h-3.5"/>Click any photo to edit or delete</span>
                <Button size="sm" onClick={()=>handleAdd("gallery")} className={`bg-gradient-to-r ${FIRE} text-white border-0 text-xs h-7 gap-1`}><Plus className="w-3 h-3"/>Add Media</Button>
              </div>
            )}
            {gallery.length===0 ? (
              <div className="text-center py-24 border border-white/8 rounded-3xl bg-white/[0.02]">
                <Image className="w-12 h-12 mx-auto mb-4 text-white/15"/>
                <p className="text-white/30 text-sm">Gallery coming soon — photos and videos will appear here.</p>
              </div>
            ) : (
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
                {gallery.map((item:any)=>(
                  <AdminClickable key={item.id} onEdit={()=>openGallery(item)} className="break-inside-avoid">
                    <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
                      {item.mediaType==="video"?<div className="aspect-video flex items-center justify-center bg-black"><Play className="w-10 h-10 text-white/40"/></div>:<img src={item.url} alt={item.caption??""} className="w-full object-cover" loading="lazy"/>}
                      {item.caption&&<p className="p-3 text-xs text-white/40">{item.caption}</p>}
                    </div>
                  </AdminClickable>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────────── */}
        <CtaSection bttsSettings={bttsSettings} isAdmin={isAdmin} />


        {/* ── MAP ──────────────────────────────────────────────────────────────── */}
        <section className="py-16 bg-[#0a0a12] border-t border-white/5">
          <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0"><MapPin className="w-5 h-5 text-orange-400"/></div>
              <div><h3 className="text-white font-bold">Find it on the Map</h3><p className="text-white/45 text-sm">Pinned as a key cultural location on the Urban Culture map.</p></div>
            </div>
            <Button asChild variant="outline" className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10 whitespace-nowrap shrink-0">
              <Link href="/map"><MapPin className="w-4 h-4 mr-2"/>Open Map</Link>
            </Button>
          </div>
        </section>

        {/* ── ADMIN PANEL ──────────────────────────────────────────────────────── */}
        {isAdmin && <AdminPanel onAdd={handleAdd} />}

        {/* bottom padding for floating bar */}
        {isAdmin && <div className="h-24" />}
      </div>
    </EditContext.Provider>
  );
}
