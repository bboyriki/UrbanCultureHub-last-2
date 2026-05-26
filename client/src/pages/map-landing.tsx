import { useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import MapView from "@/components/map/MapView";
import {
  MapPin, Calendar, Users, Sparkles, ChevronDown,
  Mail, Shield, FileText, ArrowRight, Quote,
  Zap, Globe, Heart, Music
} from "lucide-react";

/* ── Scroll indicator ────────────────────────────────────────────────────── */
function ScrollHint() {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-1.5 pointer-events-none">
      <span className="text-[11px] font-medium text-white/60 tracking-widest uppercase">Explore more</span>
      <ChevronDown className="w-4 h-4 text-white/50 animate-bounce" />
    </div>
  );
}

/* ── Section: About ──────────────────────────────────────────────────────── */
const PILLARS = [
  { icon: MapPin, label: "Urban Spots", desc: "Discover skate parks, street art walls, training grounds, and cultural gems mapped across the Netherlands." },
  { icon: Calendar, label: "Events", desc: "Find battles, cyphers, workshops, and community events near you — all in one place." },
  { icon: Users, label: "Community", desc: "Connect with artists, athletes, organisers, and culture enthusiasts who share your passion." },
  { icon: Sparkles, label: "Opportunities", desc: "Visibility for artists, gigs for athletes, and collaboration for cultural organisations and municipalities." },
];

function AboutSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium tracking-wider uppercase border-primary/30 text-primary">
            What we do
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Where Urban Culture Lives
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Urban Culture Hub is the platform that unites the urban culture scene — connecting people to spots,
            events, communities, artists, and opportunities across the Netherlands and beyond.
          </p>
        </div>

        {/* Pillar cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="group relative rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300 p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-2">{label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2 px-8">
            <Link href="/explore">
              Explore the Platform <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 px-8">
            <Link href="/auth">
              Join the Community
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── Section: Stats strip ────────────────────────────────────────────────── */
const STATS = [
  { icon: Globe, value: "🇳🇱", label: "Netherlands-based" },
  { icon: Music, value: "Urban", label: "Street & Hip-Hop culture" },
  { icon: Heart, value: "Free", label: "Free to join" },
  { icon: Zap, value: "Live", label: "Real-time events & spots" },
];

function StatsStrip() {
  return (
    <div className="border-y border-border/50 bg-muted/30">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/50">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center py-8 px-4 text-center gap-1">
              <span className="text-xl font-bold">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Section: Founder ────────────────────────────────────────────────────── */
function FounderSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — identity card */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-8 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent rounded-3xl" />
              <div className="relative">
                {/* Avatar ring */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-6 text-3xl font-bold text-white shadow-lg ring-4 ring-primary/20">
                  R
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Riki Almouti</h3>
                <p className="text-primary/80 text-sm font-medium mb-4">Founder &amp; CEO</p>
                <div className="flex flex-wrap gap-2">
                  {["Dancer", "Event Organiser", "Founder"].map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium border border-white/10">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Divider */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-2 text-white/50 text-xs">
                    <Globe className="w-3.5 h-3.5" />
                    🇳🇱 Netherlands · Nederland
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — story */}
          <div>
            <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-medium tracking-wider uppercase border-primary/30 text-primary">
              Our Story
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
              Built from passion,<br />not a boardroom.
            </h2>

            <div className="relative pl-5 border-l-2 border-primary/30 mb-6">
              <Quote className="absolute -left-3 -top-1 w-5 h-5 text-primary/40" />
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                My name is Riki Almouti. I am originally from Syria and also proudly Dutch, living in the Netherlands.
                As a dancer, event organiser, and founder, I created Urban Culture Hub from real experience and a deep
                passion for urban culture, community, and connection.
              </p>
            </div>

            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base mb-6">
              My mission is to <strong className="text-foreground font-semibold">connect communities, artists, athletes, municipalities,
              schools, and cultural organisations</strong>. This platform is built to create opportunities, visibility,
              and real collaboration within urban culture.
            </p>

            <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
              Urban Culture Hub is not just an app — it is a movement to bring urban culture the recognition,
              infrastructure, and community it deserves.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Section: Contact ────────────────────────────────────────────────────── */
function ContactSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/90 to-primary p-10 sm:p-14 text-white shadow-xl">
          {/* Background glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
            <div className="max-w-lg">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-sm font-medium uppercase tracking-wider">Get in Touch</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Want to collaborate or learn more?
              </h2>
              <p className="text-white/80 leading-relaxed text-sm sm:text-base">
                Whether you are a municipality, school, cultural organisation, artist, or athlete — we want to hear from you.
                Reach out and let's build something together.
              </p>
              <div className="mt-4 flex items-center gap-2 text-white/60 text-sm">
                <Mail className="w-4 h-4" />
                <a href="mailto:riki@coffeeanddance.nl" className="hover:text-white transition-colors font-medium">
                  riki@coffeeanddance.nl
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-3 shrink-0">
              <Button
                asChild
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-semibold px-8 shadow-lg gap-2"
                data-testid="button-contact"
              >
                <Link href="/contact">
                  <Mail className="w-4 h-4" /> Contact Us
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-8 gap-2"
              >
                <a href="mailto:riki@coffeeanddance.nl">
                  Send Email
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Section: Trust & Legal ──────────────────────────────────────────────── */
function TrustSection() {
  return (
    <section className="py-16 sm:py-20 border-t border-border/40">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Safe, Trusted &amp; Compliant</h2>
          </div>
          <p className="text-muted-foreground text-sm max-w-md">
            Urban Culture Hub is built with privacy and security first. We comply with Dutch law
            (Burgerlijk Wetboek) and EU GDPR (AVG). Your data is never sold.
          </p>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Shield, label: "AVG / GDPR", sub: "EU compliant" },
            { icon: Globe, label: "Netherlands", sub: "Registered" },
            { icon: Sparkles, label: "App Store", sub: "Approved" },
            { icon: Heart, label: "No ads", sub: "Your data stays yours" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card p-4 text-center flex flex-col items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">{sub}</span>
            </div>
          ))}
        </div>

        {/* Legal links */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/privacy-policy"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-medium"
            data-testid="link-privacy-policy-hero"
          >
            <Shield className="w-4 h-4 text-primary" /> Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-medium"
            data-testid="link-tos-hero"
          >
            <FileText className="w-4 h-4 text-primary" /> Terms of Service
          </Link>
          <Link
            href="/legal-hub"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/50 transition-all text-sm font-medium"
            data-testid="link-legal-hub-hero"
          >
            <Sparkles className="w-4 h-4 text-primary" /> Legal Hub
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function MapLandingPage() {
  const { user } = useAuth();
  const sectionsRef = useRef<HTMLDivElement>(null);

  const scrollToSections = () => {
    sectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col w-full">

      {/* ── Full-screen map ── */}
      <div className="relative w-full h-[calc(100vh-56px)]">
        <MapView />
        {/* Scroll hint — only shown to guests on wider screens (not on mobile where map UI is dense) */}
        {!user && (
          <button
            onClick={scrollToSections}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-1 
                       hidden sm:flex cursor-pointer pointer-events-auto bg-black/40 backdrop-blur-sm
                       border border-white/20 rounded-full px-5 py-2.5 hover:bg-black/60 transition-all"
            aria-label="Scroll to learn more"
          >
            <span className="text-[11px] font-medium text-white/70 tracking-widest uppercase">Discover more</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/50 animate-bounce" />
          </button>
        )}
      </div>

      {/* ── Informational sections ── */}
      <div ref={sectionsRef} className="w-full bg-background">
        <AboutSection />
        <StatsStrip />
        <FounderSection />
        <ContactSection />
        <TrustSection />
        {/* Extra bottom padding for mobile bottom nav */}
        <div className="h-[calc(60px+env(safe-area-inset-bottom,0px)+8px)] md:h-4" />
      </div>
    </div>
  );
}
