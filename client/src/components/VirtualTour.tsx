import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const VIRTUAL_TOUR_KEY = (userId: number | string) => `vt_done_v1_${userId}`;

const STEPS = [
  {
    id: "welcome",
    emoji: "🏙️",
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    glowColor: "shadow-violet-500/40",
    dotColor: "bg-violet-400",
    title: "Welcome to Urban Culture Hub",
    subtitle: "Your all-in-one platform for the Netherlands' urban scene",
    features: [
      "Discover events, classes & hidden spots",
      "Connect with artists, dancers & creatives",
      "Buy, sell, and explore urban culture",
    ],
    route: null,
    routeLabel: null,
  },
  {
    id: "events",
    emoji: "🎵",
    gradient: "from-orange-500 via-rose-500 to-pink-600",
    glowColor: "shadow-orange-500/40",
    dotColor: "bg-orange-400",
    title: "Discover 1,000+ Events",
    subtitle: "Hip-hop battles, art shows, exhibitions, breakin' — all in one place",
    features: [
      "Filter by music, sport, cultural & family",
      "Buy tickets instantly in-app",
      "Save favourites & get reminders",
    ],
    route: "/events",
    routeLabel: "Events",
  },
  {
    id: "map",
    emoji: "🗺️",
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    glowColor: "shadow-blue-500/40",
    dotColor: "bg-blue-400",
    title: "Explore the City Map",
    subtitle: "Every street art wall, skate park & graffiti spot mapped across the Netherlands",
    features: [
      "Interactive map with real venues",
      "Filter by spot type: art, skate, graffiti",
      "Submit and review hidden gems",
    ],
    route: "/map",
    routeLabel: "Map",
  },
  {
    id: "ai",
    emoji: "✨",
    gradient: "from-indigo-600 via-purple-500 to-violet-600",
    glowColor: "shadow-indigo-500/40",
    dotColor: "bg-indigo-400",
    title: "AI Find My Spot",
    subtitle: "Tell the AI what vibe you want — it finds the perfect real place for you",
    features: [
      "Pick your vibe: chill, energetic, creative",
      "Choose type: café, club, gallery & more",
      "Matches to real verified venues",
    ],
    route: "/map",
    routeLabel: "Map → Find My Spot",
  },
  {
    id: "safety",
    emoji: "🛡️",
    gradient: "from-emerald-500 via-green-500 to-teal-600",
    glowColor: "shadow-emerald-500/40",
    dotColor: "bg-emerald-400",
    title: "Stay Safe",
    subtitle: "Mark safe spaces and share your location with trusted contacts",
    features: [
      "One-tap emergency SOS broadcast",
      "Safe spot map across all cities",
      "Trusted contacts & check-ins",
    ],
    route: "/map",
    routeLabel: "Map → Safe Spots",
  },
  {
    id: "classes",
    emoji: "🥊",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    glowColor: "shadow-amber-500/40",
    dotColor: "bg-amber-400",
    title: "Book Classes & Sessions",
    subtitle: "Boxing, yoga, breakin', crossfit — weekly schedules from top venues",
    features: [
      "Browse class timetable by day",
      "Book & pay per session instantly",
      "Track all your upcoming classes",
    ],
    route: "/programme/events",
    routeLabel: "Schedule",
  },
  {
    id: "community",
    emoji: "👥",
    gradient: "from-pink-500 via-rose-500 to-red-500",
    glowColor: "shadow-pink-500/40",
    dotColor: "bg-pink-400",
    title: "Join the Community",
    subtitle: "Connect with artists, dancers, skaters and creatives across the Netherlands",
    features: [
      "Follow creators & get inspired",
      "Share posts, reels & your work",
      "Direct messages & group chats",
    ],
    route: "/community",
    routeLabel: "Community",
  },
  {
    id: "marketplace",
    emoji: "🛍️",
    gradient: "from-teal-500 via-cyan-500 to-blue-500",
    glowColor: "shadow-teal-500/40",
    dotColor: "bg-teal-400",
    title: "Urban Marketplace",
    subtitle: "Buy & sell sneakers, records, gear and artwork — built for creatives",
    features: [
      "Browse listings from the community",
      "Sell your gear in minutes",
      "Secure payments, easy shipping",
    ],
    route: "/marketplace",
    routeLabel: "Marketplace",
  },
  {
    id: "tickets",
    emoji: "🎫",
    gradient: "from-violet-600 via-purple-500 to-pink-500",
    glowColor: "shadow-violet-500/40",
    dotColor: "bg-violet-400",
    title: "Your Tickets & Bookings",
    subtitle: "All your event tickets, class bookings and orders in one tab",
    features: [
      "Digital QR tickets — no printer needed",
      "Full booking history & receipts",
      "Manage, cancel or transfer bookings",
    ],
    route: "/profile/tickets",
    routeLabel: "Tickets",
  },
  {
    id: "done",
    emoji: "🚀",
    gradient: "from-gray-900 via-slate-800 to-gray-900",
    glowColor: "shadow-gray-700/40",
    dotColor: "bg-primary",
    title: "You're All Set!",
    subtitle: "Start exploring the urban culture scene of the Netherlands",
    features: [
      "Tap any section from the nav bar below",
      "Come back to this tour anytime in Settings",
      "Enjoy Urban Culture Hub 🌆",
    ],
    route: null,
    routeLabel: null,
  },
];

interface Props {
  onDone: () => void;
}

export default function VirtualTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [progressWidth, setProgressWidth] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  useEffect(() => {
    const t = setTimeout(() => setProgressWidth(progress), 80);
    return () => clearTimeout(t);
  }, [progress]);

  const goNext = () => {
    if (isLast) { onDone(); return; }
    setDir(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    if (step === 0) return;
    setDir(-1);
    setStep(s => s - 1);
  };

  const skip = () => onDone();

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-80%" : "80%", opacity: 0, scale: 0.95 }),
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden select-none">

      {/* ── Top Bar ── */}
      <div className="relative shrink-0 px-4 pt-10 pb-3">
        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/70 transition-all duration-500 ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Step counter + skip */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-white/50 font-medium tracking-wide uppercase">
            {step + 1} / {STEPS.length}
          </span>
          {!isLast && (
            <button
              onClick={skip}
              data-testid="btn-tour-skip"
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              Skip <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Slide ── */}
      <div className="flex-1 relative overflow-hidden px-5">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.9 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5"
          >
            {/* Glowing card background */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className={cn(
                "w-36 h-36 rounded-[2.5rem] bg-gradient-to-br flex items-center justify-center shadow-2xl",
                current.gradient,
                current.glowColor
              )}
            >
              <motion.span
                key={step + "-emoji"}
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 20 }}
                className="text-6xl"
                style={{ lineHeight: 1 }}
              >
                {current.emoji}
              </motion.span>
            </motion.div>

            {/* Route pill */}
            {current.routeLabel && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20"
              >
                <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">
                  {current.routeLabel}
                </span>
              </motion.div>
            )}

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-center"
            >
              <h2 className="text-2xl font-extrabold text-white leading-tight mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-xs mx-auto">
                {current.subtitle}
              </p>
            </motion.div>

            {/* Feature bullets */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="w-full max-w-xs space-y-2"
            >
              {current.features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.32 + i * 0.07, duration: 0.3 }}
                  className="flex items-start gap-2.5"
                >
                  <div className={cn(
                    "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br",
                    current.gradient
                  )}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-sm text-white/75 leading-snug">{feat}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom Nav ── */}
      <div className="shrink-0 px-5 pb-10 pt-3 space-y-4">
        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDir(i > step ? 1 : -1); setStep(i); }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-5 bg-white" : "w-1.5 bg-white/25"
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={goBack}
              data-testid="btn-tour-back"
              className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Button
            onClick={goNext}
            data-testid="btn-tour-next"
            className={cn(
              "flex-1 h-12 rounded-2xl font-semibold text-base gap-2 border-0 text-white bg-gradient-to-r shadow-lg",
              current.gradient
            )}
          >
            {isLast ? "Start Exploring" : "Next"}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
