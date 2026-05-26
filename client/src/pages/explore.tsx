import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useExploreImageUpdates } from '@/hooks/use-explore-image-updates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, MapPin, ShoppingBag, Sparkles, Users,
  ArrowRight, Play
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────────── */
type ExplorePageImage = {
  id: number;
  section: string;
  imageUrl: string;
  imagePublicId: string;
  title: string;
  description: string;
  sortOrder: number | null;
  isActive: boolean | null;
  isCoverImage: boolean | null;
  createdBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/* ── Fallback stock images per section ─────────────────────────────────── */
const FALLBACK_IMAGES: Record<string, string> = {
  map:         'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=480&fit=crop&q=80',
  events:      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=480&fit=crop&q=80',
  marketplace: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=800&h=480&fit=crop&q=80',
  community:   'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=480&fit=crop&q=80',
  services:    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=480&fit=crop&q=80',
};

/* Gradient fallback when even the photo doesn't load */
const FALLBACK_GRADIENTS: Record<string, string> = {
  map:         'from-blue-900 via-blue-800 to-slate-900',
  events:      'from-violet-900 via-purple-800 to-slate-900',
  marketplace: 'from-orange-900 via-amber-800 to-slate-900',
  community:   'from-emerald-900 via-teal-800 to-slate-900',
  services:    'from-pink-900 via-rose-800 to-slate-900',
};

/* ── Section card config ────────────────────────────────────────────────── */
const SECTIONS = [
  {
    key: 'map',
    icon: MapPin,
    title: 'Urban Spots',
    subtitle: 'Explore the Map',
    description: 'Discover skate parks, graffiti walls, dance studios, and hidden cultural gems — all mapped across the Netherlands.',
    cta: 'Open Map',
    href: '/map',
    badge: '2000+ spots',
  },
  {
    key: 'events',
    icon: Calendar,
    title: 'Events',
    subtitle: 'What\'s On',
    description: 'Find battles, cyphers, workshops, gallery openings, and live performances near you — updated in real time.',
    cta: 'Browse Events',
    href: '/events',
    badge: 'Live updates',
  },
  {
    key: 'marketplace',
    icon: ShoppingBag,
    title: 'Marketplace',
    subtitle: 'Shop Urban Culture',
    description: 'Original artwork, limited drops, training gear, and urban culture merchandise — straight from the community.',
    cta: 'Shop Now',
    href: '/marketplace',
    badge: 'New arrivals',
  },
  {
    key: 'community',
    icon: Users,
    title: 'Community',
    subtitle: 'Connect & Grow',
    description: 'Meet artists, athletes, organisers, and creatives who share your passion. Build real connections in the scene.',
    cta: 'Join Community',
    href: '/community',
    badge: 'Growing daily',
  },
  {
    key: 'services',
    icon: Sparkles,
    title: 'Creative Services',
    subtitle: 'Hire & Collaborate',
    description: 'Book dancers for events, commission artists, find coaches, and collaborate with cultural organisations.',
    cta: 'Explore Services',
    href: '/services',
    badge: 'Professionals',
  },
];

/* ── Section card component ─────────────────────────────────────────────── */
function SectionCard({
  section,
  apiImage,
}: {
  section: typeof SECTIONS[number];
  apiImage: ExplorePageImage | null;
}) {
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);

  const photoUrl  = apiImage?.imageUrl ?? FALLBACK_IMAGES[section.key];
  const gradient  = FALLBACK_GRADIENTS[section.key];
  const Icon      = section.icon;

  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-primary/40 hover:shadow-xl transition-all duration-300">

      {/* ── Photo / gradient header ── */}
      <div className="relative h-52 overflow-hidden bg-slate-900">
        {!imgError ? (
          <img
            src={photoUrl}
            alt={section.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        )}

        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Icon + badge overlay on image */}
        <div className="absolute top-4 left-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/80 text-[10px] font-semibold tracking-wide">
            {section.badge}
          </span>
        </div>

        {/* Title pinned to bottom of image */}
        <div className="absolute bottom-0 inset-x-0 p-4">
          <p className="text-white/60 text-[10px] font-semibold tracking-widest uppercase mb-0.5">
            {section.subtitle}
          </p>
          <h3 className="text-white font-black text-xl leading-tight">
            {section.title}
          </h3>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        <p className="text-muted-foreground text-sm leading-relaxed flex-1">
          {section.description}
        </p>
        <Button
          onClick={() => navigate(section.href)}
          className="w-full gap-2"
          data-testid={`button-explore-${section.key}`}
        >
          {section.cta} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
const ExplorePage = () => {
  const [, navigate] = useLocation();

  useExploreImageUpdates();

  const { data: exploreImages, isLoading } = useQuery<ExplorePageImage[]>({
    queryKey: ['/api/explore-images'],
    staleTime: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const getApiImage = (section: string): ExplorePageImage | null => {
    if (!exploreImages || isLoading) return null;
    const active = exploreImages.filter(img => img.section === section && img.isActive);
    const cover  = active.find(img => img.isCoverImage === true);
    if (cover) return cover;
    return [...active].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ?? null;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

      {/* ── Page header ── */}
      <div className="py-10 sm:py-14 text-center">
        <Badge variant="outline" className="mb-4 px-3.5 py-1.5 text-[10px] font-semibold tracking-widest uppercase border-primary/25 text-primary">
          Discover
        </Badge>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
          Explore Urban Culture
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Everything the platform has to offer — from the interactive map to events, marketplace, community, and creative services.
        </p>
      </div>

      {/* ── Section grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-8">
        {SECTIONS.map(section => (
          <SectionCard
            key={section.key}
            section={section}
            apiImage={getApiImage(section.key)}
          />
        ))}
      </div>

      {/* ── Bottom CTA ── */}
      <div className="py-12 sm:py-16 text-center border-t border-border/40">
        <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to join the community?</h2>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
          Create a free account to post content, book services, purchase tickets,
          and connect with the urban culture scene in the Netherlands.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="gap-2 px-8"
            data-testid="button-signup-cta"
          >
            <Play className="w-4 h-4" /> Sign up — it's free
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            size="lg"
            className="gap-2 px-8"
          >
            Back to Homepage
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
