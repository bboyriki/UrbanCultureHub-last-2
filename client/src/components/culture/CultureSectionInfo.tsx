import { useState } from "react";
import { Info, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CultureSectionId =
  | "cred"
  | "groups"
  | "crews"
  | "challenges"
  | "cyphers"
  | "graffiti"
  | "beat-lab"
  | "hall-of-fame"
  | "culture-tools";

type Pillar = { label: string; body: string };

type SectionContent = {
  emoji: string;
  title: string;
  tagline: string;
  accent: string;
  pillars: { what: Pillar; how: Pillar; purpose: Pillar; connects: Pillar };
};

const CULTURE_INFO: Record<CultureSectionId, SectionContent> = {
  cred: {
    emoji: "⭐",
    title: "Street Cred",
    tagline: "Your reputation, earned move by move.",
    accent: "from-amber-500/20 via-yellow-500/10 to-orange-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A living reputation score that reflects everything you contribute to the culture — from hosting cyphers to dropping beats, tagging the wall, and lifting up the community.",
      },
      how: {
        label: "How it works",
        body: "Every meaningful action across the app earns Cred. Found a crew, ship a challenge entry, get voted up, share a beat, post a tag — each one stacks. The more you build, the higher you climb from Rookie to Legend.",
      },
      purpose: {
        label: "Why it exists",
        body: "Talent is loud, but consistency is louder. Cred makes the work visible — so the people putting in real time and energy get recognised, not just the loudest voice in the room.",
      },
      connects: {
        label: "How it connects",
        body: "Cred is the heartbeat of the platform. Cyphers, Crews, Challenges, Beat Lab, Graffiti Wall, Radio and Hall of Fame all feed into it — and your score unlocks visibility across the whole app.",
      },
    },
  },
  groups: {
    emoji: "👥",
    title: "Groups",
    tagline: "Find your tribe, share your craft.",
    accent: "from-blue-500/20 via-sky-500/10 to-cyan-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "Open spaces built around a discipline, neighbourhood or shared interest — the public commons of the platform where anyone can drop in.",
      },
      how: {
        label: "How it works",
        body: "Browse groups by discipline or city, request to join, share posts, ask questions, and organise meet-ups. Group admins keep the vibe right and curate what's pinned.",
      },
      purpose: {
        label: "Why it exists",
        body: "Most movements start as conversations. Groups give scenes a home — somewhere to swap knowledge, share spots, hype each other up, and grow the community organically.",
      },
      connects: {
        label: "How it connects",
        body: "Groups feed Cyphers and Crews, surface events on the Map, and turn casual followers into active participants who later show up for Challenges and BTTS sessions.",
      },
    },
  },
  crews: {
    emoji: "🤝",
    title: "Crews",
    tagline: "Tight-knit collectives that move together.",
    accent: "from-purple-500/20 via-violet-500/10 to-fuchsia-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "Your inner circle. Crews are small, identity-driven collectives — your team, your name, your colours — built around a discipline and a city.",
      },
      how: {
        label: "How it works",
        body: "Found a crew or join one by invite. Crews get a profile page, member roster, founding year, and shared Cred. Add Instagram and people can find your work outside the app too.",
      },
      purpose: {
        label: "Why it exists",
        body: "Hip-hop, skate, parkour, graffiti — none of it is solo. Crews honour the way real culture moves: as units that build a name together over time.",
      },
      connects: {
        label: "How it connects",
        body: "Crews compete in Challenges, host Cyphers, get inducted into the Hall of Fame, and share Cred with their members — making the collective the unit of progress.",
      },
    },
  },
  challenges: {
    emoji: "⚡",
    title: "Challenges",
    tagline: "Themed competitions that push your craft.",
    accent: "from-yellow-500/20 via-amber-500/10 to-orange-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "Time-bound creative prompts — a theme, a discipline, a deadline. Drop your entry, get votes from the community, climb the leaderboard.",
      },
      how: {
        label: "How it works",
        body: "Browse the active challenge, submit a video or link with a caption, then vote on other entries. Winners are decided by the community and surfaced across the app.",
      },
      purpose: {
        label: "Why it exists",
        body: "Constraints sharpen creativity. Challenges give the scene a regular reason to create, ship, and put work in front of people who actually care.",
      },
      connects: {
        label: "How it connects",
        body: "Entries earn Cred, top winners get promoted to the Hall of Fame, Crews can rep each other on submissions, and Culture Tools can help generate themes and breakdowns.",
      },
    },
  },
  cyphers: {
    emoji: "🔥",
    title: "Cyphers",
    tagline: "Spontaneous live sessions, mapped in real time.",
    accent: "from-orange-500/20 via-red-500/10 to-rose-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A cypher is a live circle — breakers, MCs, beatboxers, dancers — meeting in the same spot at the same time to trade rounds and feed off each other.",
      },
      how: {
        label: "How it works",
        body: "Drop a pin with the discipline, location, start and end time. Anyone can RSVP, show up, jump in. Active cyphers light up the map so the scene knows where to be.",
      },
      purpose: {
        label: "Why it exists",
        body: "Culture happens in person. Cyphers turn the app into a real-world matchmaker — making it easy to find the next session instead of missing it on Instagram a week late.",
      },
      connects: {
        label: "How it connects",
        body: "Cyphers earn Cred, fill the Map, attract Crew members, and feed clips into the Graffiti Wall and Challenges — closing the loop between online and IRL.",
      },
    },
  },
  graffiti: {
    emoji: "🎨",
    title: "Graffiti Wall",
    tagline: "An open canvas the whole community paints on.",
    accent: "from-cyan-500/20 via-sky-500/10 to-blue-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A shared digital wall where anyone can drop a tag — stickers, text, images — and watch the surface evolve as the community keeps painting over it.",
      },
      how: {
        label: "How it works",
        body: "Pick sticker, text or image, choose a colour, place it, sign it. Every contribution stays anchored to your profile so the wall is also a feed of who's active.",
      },
      purpose: {
        label: "Why it exists",
        body: "Graffiti is conversation. The wall keeps that spirit alive online — a low-pressure way to leave your mark, signal what you're feeling, and tag your crew.",
      },
      connects: {
        label: "How it connects",
        body: "Tags earn Cred, link back to profiles and Crews, and act as the community's collective mood board — visible context for everything else happening in the app.",
      },
    },
  },
  "beat-lab": {
    emoji: "🎵",
    title: "Beat Lab & Radio",
    tagline: "Drop beats. Get heard. Run the airwaves.",
    accent: "from-green-500/20 via-emerald-500/10 to-teal-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A two-sided sound space — Beat Lab is where producers upload and share tracks, Radio is the curated stream where the best of it gets played to the whole community.",
      },
      how: {
        label: "How it works",
        body: "Upload a beat with a title and genre, get plays and feedback from the Lab, and submit standout work to Radio rotation. Anyone can listen, anywhere in the app.",
      },
      purpose: {
        label: "Why it exists",
        body: "Producers and DJs need somewhere that isn't an algorithm. Beat Lab gives them a real audience; Radio gives the scene a soundtrack of its own.",
      },
      connects: {
        label: "How it connects",
        body: "Beats power Cyphers and Challenges, earn Cred, and surface artists who later get inducted into the Hall of Fame — keeping sound at the centre of the culture.",
      },
    },
  },
  "hall-of-fame": {
    emoji: "👑",
    title: "Hall of Fame",
    tagline: "The pioneers, the legends, the ones who paved it.",
    accent: "from-amber-500/20 via-yellow-500/10 to-amber-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A permanent archive of the people whose work shaped the culture — pioneers, OGs, and modern legends across every discipline the app celebrates.",
      },
      how: {
        label: "How it works",
        body: "Each entry has a name, discipline, city, year, photo, achievement and bio. Entries are curated and connected to Instagram so the legacy stays linked to living artists.",
      },
      purpose: {
        label: "Why it exists",
        body: "Culture without memory dies. The Hall of Fame keeps the lineage visible — so the next generation knows whose shoulders they're standing on.",
      },
      connects: {
        label: "How it connects",
        body: "Top performers from Challenges, Crews and Beat Lab can be inducted, Cred milestones flag candidates, and Culture Tools can surface the lineage behind any discipline.",
      },
    },
  },
  "culture-tools": {
    emoji: "✨",
    title: "Culture Tools",
    tagline: "AI that speaks the language of the scene.",
    accent: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/5",
    pillars: {
      what: {
        label: "What it is",
        body: "A toolkit of AI assistants tuned for hip-hop, breaking, graffiti and street culture — generating crew DNA, lineage maps, challenge themes, bios, and more.",
      },
      how: {
        label: "How it works",
        body: "Pick a tool, give it a prompt or a discipline, and it returns culturally-aware output you can use in your profile, your crew, your challenge entry or your bio.",
      },
      purpose: {
        label: "Why it exists",
        body: "Most AI tools don't know the difference between popping and locking. Culture Tools do — giving creators a faster way to express ideas without flattening the language.",
      },
      connects: {
        label: "How it connects",
        body: "Outputs plug straight into Crews, Challenges, Hall of Fame and your profile — turning AI into a quiet helper for everything else the app already does.",
      },
    },
  },
};

interface Props {
  section: CultureSectionId;
  className?: string;
  align?: "inline" | "block";
}

export default function CultureSectionInfo({ section, className, align = "inline" }: Props) {
  const [open, setOpen] = useState(false);
  const info = CULTURE_INFO[section];
  if (!info) return null;

  return (
    <div className={cn(align === "block" ? "w-full" : "inline-block", className)} data-testid={`culture-info-${section}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          "group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
          "border border-border/60 bg-background/60 backdrop-blur",
          "text-muted-foreground hover:text-foreground hover:border-border",
          "transition-all duration-200",
          open && "text-foreground border-border bg-muted/60"
        )}
        data-testid={`culture-info-toggle-${section}`}
      >
        <Info className="w-3 h-3" strokeWidth={2.2} />
        <span>{open ? "Hide" : "About this section"}</span>
      </button>

      {open && (
        <div
          className={cn(
            "mt-3 relative overflow-hidden rounded-2xl border border-border/60",
            "bg-gradient-to-br animate-in fade-in slide-in-from-top-1 duration-300",
            info.accent
          )}
          data-testid={`culture-info-panel-${section}`}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-none" />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-background/80 border border-border/60 flex items-center justify-center text-lg shrink-0">
                  {info.emoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm tracking-tight truncate">{info.title}</h3>
                    <Sparkles className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{info.tagline}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                aria-label="Close"
                data-testid={`culture-info-close-${section}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {(["what", "how", "purpose", "connects"] as const).map(k => {
                const p = info.pillars[k];
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-border/50 bg-background/60 p-3"
                    data-testid={`culture-info-pillar-${section}-${k}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {p.label}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/85">{p.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
