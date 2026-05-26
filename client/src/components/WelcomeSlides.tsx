import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, MapPin, Calendar, Users } from "lucide-react";

const STORAGE_KEY = "ucHub_welcome_seen_v1";

const slides = [
  {
    icon: <MapPin className="h-14 w-14 text-primary" />,
    bg: "from-blue-500/20 to-violet-500/20",
    dot: "bg-primary",
    title: "Discover Urban Spots",
    body: "Find hidden gems — street art walls, skate parks, and graffiti spots mapped across the Netherlands.",
  },
  {
    icon: <Calendar className="h-14 w-14 text-orange-400" />,
    bg: "from-orange-500/20 to-red-500/20",
    dot: "bg-orange-400",
    title: "Catch Local Events",
    body: "Stay in the loop with battles, jams, exhibitions, and cultural events happening in your city.",
  },
  {
    icon: <Users className="h-14 w-14 text-emerald-400" />,
    bg: "from-emerald-500/20 to-teal-500/20",
    dot: "bg-emerald-400",
    title: "Join the Community",
    body: "Connect with artists, dancers, skaters, and creatives. Share your work, follow your scene.",
  },
];

interface Props {
  onDone: () => void;
}

export default function WelcomeSlides({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < slides.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, "1");
      onDone();
    }
  };

  const skip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
  };

  const slide = slides[step];

  return (
    <div className="fixed inset-0 z-[99] bg-background flex flex-col items-center justify-between px-6 py-10 select-none">
      {/* Skip button */}
      <div className="w-full flex justify-end">
        {step < slides.length - 1 && (
          <button
            onClick={skip}
            data-testid="btn-welcome-skip"
            className="text-sm text-muted-foreground font-medium"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center w-full max-w-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-6"
          >
            <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.bg} flex items-center justify-center`}>
              {slide.icon}
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">{slide.title}</h2>
              <p className="text-muted-foreground text-base leading-relaxed">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + CTA */}
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? `w-6 ${slide.dot}` : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <Button
          data-testid="btn-welcome-next"
          className="w-full h-12 rounded-2xl text-base font-semibold gap-2"
          onClick={next}
        >
          {step < slides.length - 1 ? "Next" : "Get Started"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function shouldShowWelcome(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}
