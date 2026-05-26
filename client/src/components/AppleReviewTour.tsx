import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, X, ShieldCheck, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const APPLE_REVIEW_TOUR_KEY = "apple_review_tour_done_v2";
export const APPLE_REVIEW_ACCOUNT = "rikim5736@gmail.com";

const STEPS = [
  {
    id: "welcome",
    emoji: "🏙️",
    gradient: "from-slate-700 via-slate-800 to-slate-900",
    glowColor: "shadow-slate-500/30",
    badge: "App Overview",
    title: "Urban Culture Hub",
    subtitle: "A social platform for the Dutch urban culture scene — B-boys, graffiti artists, DJs, skaters and more.",
    notes: [
      "Platform for discovering urban culture events, venues & artists across the Netherlands",
      "Social feed, messaging, AI tools, marketplace & event ticketing all in one app",
      "Available in Dutch & English",
    ],
  },
  {
    id: "privacy",
    emoji: "🍪",
    gradient: "from-green-700 via-emerald-700 to-teal-800",
    glowColor: "shadow-green-500/30",
    badge: "Guideline 5.1.2(i) — Privacy",
    title: "No Tracking on iOS",
    subtitle: "We do not collect cookies for advertising or tracking purposes on Apple devices.",
    notes: [
      "The cookie consent banner does NOT appear inside the iOS native app",
      "Session cookies are used only to keep you logged in — not for advertising",
      "No App Tracking Transparency prompt is shown because we do not track users",
    ],
  },
  {
    id: "login",
    emoji: "🔐",
    gradient: "from-blue-700 via-indigo-700 to-violet-800",
    glowColor: "shadow-blue-500/30",
    badge: "Guideline 4.8 — Login Services",
    title: "Email Login Only on iOS",
    subtitle: "Google Sign In is hidden inside the iOS app — users log in with email and password only.",
    notes: [
      "No third-party login (Google/Facebook) is offered within the iOS native app",
      "Standard email + password registration and login",
      "Password reset via email is supported",
    ],
  },
  {
    id: "ai",
    emoji: "✨",
    gradient: "from-purple-700 via-violet-700 to-indigo-800",
    glowColor: "shadow-purple-500/30",
    badge: "Premium Features — Free Access",
    title: "AI Features — Free for All Users",
    subtitle: "All AI-powered tools are currently free. No payment, subscription or in-app purchase is required.",
    notes: [
      "AI content suggestions, caption writing, bio generation — all free",
      "No paywall or subscription prompt will appear during review",
      "Users simply log in to access all AI features immediately",
    ],
  },
  {
    id: "events",
    emoji: "🎵",
    gradient: "from-orange-700 via-rose-700 to-pink-800",
    glowColor: "shadow-orange-500/30",
    badge: "Events Tab",
    title: "1,400+ Events",
    subtitle: "Hip-hop battles, graffiti exhibitions, breakin' sessions, DJ sets — browsable without payment.",
    notes: [
      "Tap Events in the navigation to browse all events",
      "Filter by category: music, sport, culture, family",
      "Event detail pages, maps and ticket purchase available",
    ],
  },
  {
    id: "map",
    emoji: "🗺️",
    gradient: "from-cyan-700 via-blue-700 to-sky-800",
    glowColor: "shadow-cyan-500/30",
    badge: "Map Tab",
    title: "Interactive City Map",
    subtitle: "Graffiti walls, skate parks and urban spots mapped across the Netherlands.",
    notes: [
      "Tap Map in the navigation to explore all locations",
      "Filter by spot type: art, skate, graffiti, safe spaces",
      "Location permission is optional — the map works without it",
    ],
  },
  {
    id: "community",
    emoji: "👥",
    gradient: "from-pink-700 via-rose-700 to-red-800",
    glowColor: "shadow-pink-500/30",
    badge: "Community Tab",
    title: "Community Social Feed",
    subtitle: "Posts, stories and profiles from urban culture creators across the Netherlands.",
    notes: [
      "Demo account has 3 pre-loaded community posts and 2 active stories",
      "The account follows 4 users and has 4 followers for an active social graph",
      "Direct messaging is available between any two users",
    ],
  },
  {
    id: "marketplace",
    emoji: "🛍️",
    gradient: "from-teal-700 via-cyan-700 to-blue-800",
    glowColor: "shadow-teal-500/30",
    badge: "Marketplace Tab",
    title: "Urban Marketplace",
    subtitle: "Buy and sell sneakers, records, gear and artwork — no purchase required to browse.",
    notes: [
      "Browse all listings freely without creating a listing or paying",
      "Stripe payment integration for secure checkout",
      "Sellers can list items from the Marketplace section",
    ],
  },
  {
    id: "credentials",
    emoji: "🔑",
    gradient: "from-amber-700 via-yellow-700 to-orange-800",
    glowColor: "shadow-amber-500/30",
    badge: "Review Notes",
    title: "Demo Account Credentials",
    subtitle: "Log in with email and password — all features and content are pre-loaded.",
    notes: [
      "Email: rikim5736@gmail.com  •  Password: UrbanDemo2024!",
      "Profile: B-Boy / Artist, Amsterdam, profile pic, 950 cred score — fully set up",
      "Pre-loaded: 3 posts, 2 stories, 4 followers, saved events, premium AI, all access unlocked",
    ],
  },
  {
    id: "done",
    emoji: "✅",
    gradient: "from-gray-800 via-slate-800 to-gray-900",
    glowColor: "shadow-gray-700/30",
    badge: "Review Guide Complete",
    title: "Ready for Review",
    subtitle: "All features are accessible. Tap any section from the navigation bar below to explore.",
    notes: [
      "Restart this guide anytime from Profile → Settings → App Review Guide",
      "All Apple guidelines addressed: 4.8 (login), 5.1.2 (privacy), 2.1 (demo access)",
      "Thank you for reviewing Urban Culture Hub",
    ],
  },
];

interface Props {
  onDone: () => void;
}

export default function AppleReviewTour({ onDone }: Props) {
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

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-80%" : "80%", opacity: 0, scale: 0.95 }),
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col overflow-hidden select-none">

      {/* ── Top Bar ── */}
      <div className="relative shrink-0 px-4 pt-10 pb-3">
        {/* Apple Review badge */}
        <div className="flex items-center justify-center mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15">
            <Apple className="w-3 h-3 text-white/60" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
              Apple App Review Guide
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/60 transition-all duration-500 ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Step counter + skip */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-white/40 font-medium tracking-wide uppercase">
            {step + 1} / {STEPS.length}
          </span>
          {!isLast && (
            <button
              onClick={onDone}
              data-testid="btn-apple-tour-skip"
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5"
          >
            {/* Icon card */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className={cn(
                "w-28 h-28 rounded-[2rem] bg-gradient-to-br flex items-center justify-center shadow-2xl",
                current.gradient,
                current.glowColor
              )}
            >
              <motion.span
                key={step + "-emoji"}
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 20 }}
                className="text-5xl"
                style={{ lineHeight: 1 }}
              >
                {current.emoji}
              </motion.span>
            </motion.div>

            {/* Guideline badge */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.3 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20"
            >
              <ShieldCheck className="w-3 h-3 text-white/60" />
              <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">
                {current.badge}
              </span>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-center"
            >
              <h2 className="text-xl font-extrabold text-white leading-tight mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-white/55 leading-relaxed max-w-xs mx-auto">
                {current.subtitle}
              </p>
            </motion.div>

            {/* Notes */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="w-full max-w-xs space-y-2.5"
            >
              {current.notes.map((note, i) => (
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
                  <p className="text-sm text-white/70 leading-snug font-mono tracking-tight">{note}</p>
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
                i === step ? "w-5 bg-white" : "w-1.5 bg-white/20"
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={goBack}
              data-testid="btn-apple-tour-back"
              className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <Button
            onClick={goNext}
            data-testid="btn-apple-tour-next"
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
