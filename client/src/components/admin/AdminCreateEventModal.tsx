import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { searchAddress, NominatimResult } from "@/lib/nominatim";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  CalendarIcon, MapPin, ChevronLeft, ChevronRight, Check,
  Star, TrendingUp, BadgeCheck, Ticket, Users, Clock, Globe,
  Sparkles, Trophy, Music, Mic, Zap, Building2, Trees,
  Baby, Heart, Tag, DollarSign, Info, Crown, AlertCircle,
  FileText, ShieldCheck, Eye, EyeOff,
} from "lucide-react";

/* ─── Constants ─── */
const DUTCH_CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Haarlem", "Zaandam", "Almere", "Eindhoven", "Leiden", "Delft"];

const CATEGORY_GROUPS = [
  {
    label: "Urban & Culture",
    items: [
      { value: "dance", icon: "🕺", label: "Dance" },
      { value: "music", icon: "🎵", label: "Music" },
      { value: "nightlife", icon: "🌙", label: "Nightlife" },
      { value: "art", icon: "🖼️", label: "Art" },
      { value: "cultural", icon: "🌍", label: "Cultural" },
      { value: "festival", icon: "🎪", label: "Festival" },
      { value: "skate", icon: "🛹", label: "Skate" },
      { value: "parkour", icon: "🏃", label: "Parkour" },
    ],
  },
  {
    label: "Community & Sports",
    items: [
      { value: "sports", icon: "⚽", label: "Sports" },
      { value: "community", icon: "🤝", label: "Community" },
      { value: "workshop", icon: "🎨", label: "Workshop" },
      { value: "food", icon: "🍕", label: "Food" },
      { value: "kids", icon: "🧒", label: "Kids" },
      { value: "family", icon: "👨‍👩‍👧", label: "Family" },
      { value: "free", icon: "🎟️", label: "Free" },
      { value: "premium", icon: "⭐", label: "Premium" },
    ],
  },
  {
    label: "Competition",
    items: [
      { value: "competition", icon: "🏆", label: "Competition" },
    ],
  },
];

const EVENT_TAGS = [
  "Beginner Friendly", "Alcohol Free", "Underground", "Live DJ", "Live Band",
  "Outdoor Stage", "18+", "21+", "All Ages", "VIP Available", "Limited Spots",
  "Free Entry", "Dress Code", "RSVP Required", "Food & Drinks", "Networking",
  "Charity Event", "Photo Allowed", "No Photography", "Pet Friendly",
];

const MUSIC_GENRES = [
  { value: "hiphop", label: "Hip-Hop / Rap" },
  { value: "electronic", label: "Electronic / EDM" },
  { value: "rnb", label: "R&B / Soul" },
  { value: "afrobeats", label: "Afrobeats" },
  { value: "dancehall", label: "Dancehall / Reggae" },
  { value: "jazz", label: "Jazz" },
  { value: "latin", label: "Latin" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "world", label: "World Music" },
  { value: "classical", label: "Classical" },
  { value: "other", label: "Other" },
];

const CROWD_LEVELS = [
  { value: "low", label: "🟢 Relaxed", desc: "Chill vibe, easy to move around" },
  { value: "medium", label: "🟡 Moderate", desc: "Comfortable crowd" },
  { value: "busy", label: "🔴 Packed", desc: "High energy, very busy" },
];

const STEPS = [
  { id: 1, label: "Basics", icon: CalendarIcon, desc: "Title, date & location" },
  { id: 2, label: "Category", icon: Tag, desc: "Type & description" },
  { id: 3, label: "Media", icon: Sparkles, desc: "Image & links" },
  { id: 4, label: "Tickets", icon: Ticket, desc: "Pricing & capacity" },
  { id: 5, label: "Admin", icon: Crown, desc: "Featured & publish" },
];

/* ─── Zod Schema ─── */
const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  date: z.date({ required_error: "Event date is required" }),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  city: z.string().optional(),
  location: z.string().min(3, "Location is required"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isIndoor: z.boolean().optional(),
  category: z.string({ required_error: "Category is required" }).min(1, "Select a category"),
  description: z.string().min(10, "Description is too short (min 10 chars)"),
  tags: z.array(z.string()).default([]),
  musicGenre: z.string().optional(),
  crowdLevel: z.string().optional(),
  image: z.string().optional().or(z.literal("")),
  organizerBio: z.string().optional(),
  externalTicketLink: z.preprocess(val => val === "" ? undefined : val, z.string().url("Must be a valid URL").optional()),
  websiteUrl: z.preprocess(val => val === "" ? undefined : val, z.string().url("Must be a valid URL").optional()),
  priceModel: z.enum(["free", "paid", "from"]).default("free"),
  isPaid: z.boolean().default(false),
  price: z.coerce.number().min(0).optional(),
  adultPrice: z.coerce.number().min(0).optional(),
  kidsPrice: z.coerce.number().min(0).optional(),
  familyPrice: z.coerce.number().min(0).optional(),
  earlyBirdPrice: z.coerce.number().min(0).optional(),
  capacity: z.coerce.number().min(1).optional(),
  kidFriendly: z.boolean().default(false),
  familyFriendly: z.boolean().default(false),
  minAge: z.coerce.number().min(0).optional(),
  maxAge: z.coerce.number().min(0).optional(),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  isVerifiedOrganizer: z.boolean().default(false),
  status: z.enum(["approved", "pending"]).default("approved"),
  adminNotes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ─── Step indicator ─── */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        return (
          <div key={s.id} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
              done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"
            )}>
              {done ? <Check className="w-3.5 h-3.5" /> : s.id}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className={cn("text-xs font-semibold truncate", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 rounded-full mx-1", done ? "bg-emerald-500" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Toggle button ─── */
function ToggleBtn({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
      active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50",
      className
    )}>{children}</button>
  );
}

/* ─── Switch toggle ─── */
function SwitchRow({ label, desc, checked, onChange, icon, accent }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
  icon?: React.ReactNode; accent?: string;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn(
      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all",
      checked ? (accent || "border-primary bg-primary/5") : "border-border bg-card hover:border-primary/30"
    )}>
      {icon && <div className={cn("shrink-0", checked ? "opacity-100" : "opacity-50")}>{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className={cn(
        "w-10 h-6 rounded-full flex items-center transition-all shrink-0",
        checked ? (accent ? "bg-amber-500" : "bg-primary") : "bg-muted"
      )}>
        <div className={cn("w-4 h-4 rounded-full bg-white shadow transition-transform mx-1", checked ? "translate-x-4" : "translate-x-0")} />
      </div>
    </button>
  );
}

/* ─── Price input ─── */
function PriceField({ label, value, onChange, placeholder = "0.00", hint }: {
  label: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">€</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder={placeholder}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          className="pl-7 h-10"
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ─── Main Component ─── */
const AdminCreateEventModal = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [locationInput, setLocationInput] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", location: "", city: "", description: "",
      latitude: "", longitude: "", category: "", tags: [],
      image: "", organizerBio: "", externalTicketLink: "", websiteUrl: "",
      priceModel: "free", isPaid: false, price: undefined, adultPrice: undefined,
      kidsPrice: undefined, familyPrice: undefined, earlyBirdPrice: undefined,
      capacity: undefined, kidFriendly: false, familyFriendly: false,
      minAge: undefined, maxAge: undefined, startTime: "", endTime: "",
      isFeatured: false, isTrending: false, isVerifiedOrganizer: false,
      status: "approved", adminNotes: "", musicGenre: "", crowdLevel: "",
    },
  });

  const { watch, setValue, handleSubmit, formState: { errors } } = form;

  const category = watch("category");
  const priceModel = watch("priceModel");
  const isFeatured = watch("isFeatured");
  const isTrending = watch("isTrending");
  const isVerifiedOrganizer = watch("isVerifiedOrganizer");
  const kidFriendly = watch("kidFriendly");
  const familyFriendly = watch("familyFriendly");
  const selectedTags = watch("tags") || [];
  const selectedDate = watch("date");
  const status = watch("status");
  const isIndoor = watch("isIndoor");
  const musicGenre = watch("musicGenre");
  const crowdLevel = watch("crowdLevel");

  /* ─── Location autocomplete ─── */
  const handleLocationInput = (val: string) => {
    setLocationInput(val);
    setValue("location", val);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    if (val.length < 2) { setLocationSuggestions([]); return; }
    locationTimer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(val);
        setLocationSuggestions(results.slice(0, 5));
        if (results.length > 0) setLocationOpen(true);
      } catch {}
    }, 300);
  };

  const handleLocationSelect = (r: NominatimResult) => {
    setLocationInput(r.display_name);
    setValue("location", r.display_name);
    setValue("latitude", r.lat);
    setValue("longitude", r.lon);
    setLocationOpen(false);
    setLocationSuggestions([]);
  };

  /* ─── Step field maps for validation ─── */
  const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
    1: ["title", "date", "location"],
    2: ["category", "description"],
    3: [],
    4: [],
  };

  /* ─── Quick check for Next button disabled state ─── */
  const canAdvance = () => {
    if (step === 1) {
      return !!watch("title") && watch("title").length >= 3 && !!selectedDate && !!watch("location") && watch("location").length >= 3;
    }
    if (step === 2) {
      return !!category && !!watch("description") && watch("description").length >= 10;
    }
    return true;
  };

  /* ─── Handle Next with validation + error display ─── */
  const handleNext = async () => {
    const fields = STEP_FIELDS[step] || [];
    const valid = fields.length > 0 ? await form.trigger(fields as any) : true;
    if (valid) setStep(s => s + 1);
  };

  /* ─── Submit ─── */
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const eventDate = new Date(data.date);
      if (data.startTime) {
        const [h, m] = data.startTime.split(":").map(Number);
        eventDate.setHours(h, m);
      }

      let endDate: Date | undefined;
      if (data.endTime) {
        endDate = new Date(data.date);
        const [h, m] = data.endTime.split(":").map(Number);
        endDate.setHours(h, m);
        if (endDate <= eventDate) endDate.setDate(endDate.getDate() + 1);
      }

      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        date: eventDate.toISOString(),
        endDate: endDate?.toISOString(),
        city: data.city,
        category: data.category,
        tags: data.tags.length > 0 ? data.tags : undefined,
        image: data.image || undefined,
        isIndoor: data.isIndoor,
        priceModel: data.priceModel,
        isPaid: data.priceModel !== "free",
        price: data.priceModel !== "free" && data.price ? Math.round(Number(data.price) * 100) : undefined,
        adultPrice: data.adultPrice ? Math.round(Number(data.adultPrice) * 100) : undefined,
        kidsPrice: data.kidsPrice ? Math.round(Number(data.kidsPrice) * 100) : undefined,
        familyPrice: data.familyPrice ? Math.round(Number(data.familyPrice) * 100) : undefined,
        earlyBirdPrice: data.earlyBirdPrice ? Math.round(Number(data.earlyBirdPrice) * 100) : undefined,
        capacity: data.capacity,
        kidFriendly: data.kidFriendly,
        familyFriendly: data.familyFriendly,
        minAge: data.minAge,
        maxAge: data.maxAge,
        musicGenre: data.musicGenre || undefined,
        crowdLevel: data.crowdLevel || undefined,
        organizerBio: data.organizerBio || undefined,
        externalTicketLink: data.externalTicketLink || undefined,
        isFeatured: data.isFeatured,
        isTrending: data.isTrending,
        isVerifiedOrganizer: data.isVerifiedOrganizer,
        status: data.status,
        organizerId: user?.id,
        source: "manual",
      };

      const res = await apiRequest("/api/events", "POST", payload);
      const event = await res.json();

      // If featured/trending, patch separately to ensure flags are saved
      if ((data.isFeatured || data.isTrending || data.isVerifiedOrganizer) && event.id) {
        await apiRequest(`/api/admin/events/${event.id}`, "PATCH", {
          isFeatured: data.isFeatured,
          isTrending: data.isTrending,
          isVerifiedOrganizer: data.isVerifiedOrganizer,
          adminId: user?.id,
        });
      }

      return event;
    },
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      qc.invalidateQueries({ queryKey: ["/api/events", "admin"] });
      toast({
        title: isFeatured ? "⭐ Featured event created!" : "Event created!",
        description: `"${event.title}" is ${watch("status") === "approved" ? "live now" : "saved as pending"}.`,
      });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create event", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    form.reset();
    setStep(1);
    setLocationInput("");
    onClose();
  };

  const onSubmit = (data: FormValues) => {
    if (step !== 5) return; // Safety guard — only submit on final step
    createMutation.mutate(data);
  };

  const stepContent = (
    <>
      {/* ── Step 1: Basics ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Event Title <span className="text-destructive">*</span></Label>
            <Input
              data-testid="input-admin-event-title"
              placeholder="e.g. Urban Dance Battle Amsterdam 2026"
              className="h-12 text-base font-medium"
              {...form.register("title")}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Event Date <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-10 justify-start font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {selectedDate ? format(selectedDate, "d MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={d => d && setValue("date", d)}
                    initialFocus
                    disabled={d => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-xs text-destructive mt-1">{errors.date.message}</p>}
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">City</Label>
              <div className="flex flex-wrap gap-1.5">
                {["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Haarlem"].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("city", watch("city") === c ? "" : c)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                      watch("city") === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                    )}
                  >{c}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Start Time
              </Label>
              <Input type="time" className="h-10" {...form.register("startTime")} />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> End Time
              </Label>
              <Input type="time" className="h-10" {...form.register("endTime")} />
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Venue / Location <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                data-testid="input-admin-event-location"
                placeholder="Search venue, address or area..."
                value={locationInput}
                onChange={e => handleLocationInput(e.target.value)}
                onBlur={() => setTimeout(() => setLocationOpen(false), 200)}
                onFocus={() => locationSuggestions.length > 0 && setLocationOpen(true)}
                className="h-11 pr-10"
              />
              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {locationOpen && locationSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card rounded-xl shadow-xl border max-h-52 overflow-y-auto">
                  {locationSuggestions.map((s, i) => (
                    <div
                      key={`${s.place_id}-${i}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent rounded-lg mx-1 my-0.5 leading-snug"
                      onMouseDown={e => { e.preventDefault(); handleLocationSelect(s); }}
                    >
                      {s.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location.message}</p>}
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Venue Type</Label>
            <div className="flex gap-3">
              <ToggleBtn active={isIndoor === true} onClick={() => setValue("isIndoor", isIndoor === true ? undefined : true)} className="flex-1">
                <Building2 className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Indoor
              </ToggleBtn>
              <ToggleBtn active={isIndoor === false} onClick={() => setValue("isIndoor", isIndoor === false ? undefined : false)} className="flex-1">
                <Trees className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Outdoor
              </ToggleBtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Category & Description ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold mb-3 block">Event Category <span className="text-destructive">*</span></Label>
            {CATEGORY_GROUPS.map(group => (
              <div key={group.label} className="mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {group.items.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setValue("category", cat.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all",
                        category === cat.value
                          ? cat.value === "competition"
                            ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20"
                            : "bg-primary/10 border-primary text-primary ring-2 ring-primary/20"
                          : "bg-card border-border hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-xl leading-none">{cat.icon}</span>
                      <span className="leading-tight text-center">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
          </div>

          {(category === "music" || category === "nightlife" || category === "dance" || category === "festival") && (
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> Music Genre
              </Label>
              <div className="flex flex-wrap gap-2">
                {MUSIC_GENRES.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setValue("musicGenre", musicGenre === g.value ? "" : g.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      musicGenre === g.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                    )}
                  >{g.label}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold mb-2 block">Description <span className="text-destructive">*</span></Label>
            <Textarea
              data-testid="input-admin-event-description"
              placeholder="Describe the event — what makes it special, who should come, what to expect..."
              rows={5}
              className="resize-none text-sm"
              {...form.register("description")}
            />
            <div className="flex justify-between mt-1">
              {errors.description
                ? <p className="text-xs text-destructive">{errors.description.message}</p>
                : <span />
              }
              <span className="text-[10px] text-muted-foreground">{watch("description")?.length || 0} chars</span>
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setValue("tags", active ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag])}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                    )}
                  >{tag}</button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block">Expected Crowd</Label>
            <div className="grid grid-cols-3 gap-2">
              {CROWD_LEVELS.map(cl => (
                <button
                  key={cl.value}
                  type="button"
                  onClick={() => setValue("crowdLevel", crowdLevel === cl.value ? "" : cl.value)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    crowdLevel === cl.value ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <p className="text-xs font-semibold">{cl.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cl.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Media & Links ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Event Cover Image</Label>
            <ImageUploader
              initialImage={watch("image") || ""}
              onImageUploaded={(url) => setValue("image", url)}
              buttonText="Upload event image"
              folder="events"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Recommended: 1200×630px, JPEG or PNG</p>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Organizer Bio <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Brief info about the organizer, crew, or brand behind this event..."
              rows={3}
              className="resize-none text-sm"
              {...form.register("organizerBio")}
            />
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Event Website <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="https://example.com/event"
              className="h-10"
              {...form.register("websiteUrl")}
            />
            {errors.websiteUrl && <p className="text-xs text-destructive mt-1">{errors.websiteUrl.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <Baby className="w-3.5 h-3.5" /> Min Age
              </Label>
              <Input type="number" min="0" max="100" placeholder="e.g. 18" className="h-10" {...form.register("minAge")} />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Max Age
              </Label>
              <Input type="number" min="0" max="120" placeholder="No limit" className="h-10" {...form.register("maxAge")} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Audience</Label>
            <SwitchRow
              label="Kid Friendly"
              desc="Suitable and safe for children"
              checked={kidFriendly}
              onChange={v => setValue("kidFriendly", v)}
              icon={<Baby className="w-5 h-5 text-blue-500" />}
            />
            <SwitchRow
              label="Family Friendly"
              desc="Great for the whole family"
              checked={familyFriendly}
              onChange={v => setValue("familyFriendly", v)}
              icon={<Heart className="w-5 h-5 text-pink-500" />}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Tickets & Pricing ── */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Price model selector */}
          <div>
            <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Ticket Type
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "free", label: "🎟️ Free", desc: "No charge for entry", color: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
                { value: "paid", label: "💳 Paid", desc: "Fixed ticket price", color: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400" },
                { value: "from", label: "🎫 From", desc: "Starting price (tiers)", color: "border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`price-model-${opt.value}`}
                  onClick={() => {
                    setValue("priceModel", opt.value as "free" | "paid" | "from");
                    setValue("isPaid", opt.value !== "free");
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-center transition-all",
                    priceModel === opt.value ? opt.color + " ring-2 ring-offset-1 ring-current/20" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <p className="text-lg mb-1">{opt.label.split(" ")[0]}</p>
                  <p className="text-xs font-bold">{opt.label.split(" ").slice(1).join(" ")}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {priceModel === "free" && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Free admission</p>
                <p className="text-xs text-muted-foreground">This event is free — no ticket purchase required for attendees.</p>
              </div>
            </div>
          )}

          {priceModel !== "free" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <PriceField
                  label="General Admission"
                  value={watch("price") || ""}
                  onChange={v => setValue("price", v === "" ? undefined : Number(v))}
                  hint="Standard entry price"
                />
                <PriceField
                  label="Early Bird Price"
                  value={watch("earlyBirdPrice") || ""}
                  onChange={v => setValue("earlyBirdPrice", v === "" ? undefined : Number(v))}
                  hint="Discounted early ticket price"
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Age-based Pricing (optional)</p>
                <div className="grid grid-cols-3 gap-3">
                  <PriceField
                    label="Adult"
                    value={watch("adultPrice") || ""}
                    onChange={v => setValue("adultPrice", v === "" ? undefined : Number(v))}
                    hint="18+ ticket"
                  />
                  <PriceField
                    label="Kids"
                    value={watch("kidsPrice") || ""}
                    onChange={v => setValue("kidsPrice", v === "" ? undefined : Number(v))}
                    hint="Under 12"
                  />
                  <PriceField
                    label="Family"
                    value={watch("familyPrice") || ""}
                    onChange={v => setValue("familyPrice", v === "" ? undefined : Number(v))}
                    hint="2 adults + kids"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <Ticket className="w-4 h-4" /> External Ticket Link <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="https://ticketmaster.nl/event/..."
              className="h-10"
              {...form.register("externalTicketLink")}
            />
            {errors.externalTicketLink && <p className="text-xs text-destructive mt-1">{errors.externalTicketLink.message}</p>}
            <p className="text-[10px] text-muted-foreground mt-1">Link to Ticketmaster, Eventbrite, or another ticketing platform</p>
          </div>

          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <Users className="w-4 h-4" /> Venue Capacity <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 500"
              className="h-10"
              {...form.register("capacity")}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Maximum number of attendees. Leave empty for unlimited.</p>
          </div>
        </div>
      )}

      {/* ── Step 5: Admin Controls ── */}
      {step === 5 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
            <Crown className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Admin-Only Controls</p>
              <p className="text-xs text-muted-foreground">These settings are only visible to administrators and will not be shown to regular users.</p>
            </div>
          </div>

          {/* Publish status */}
          <div>
            <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
              <Eye className="w-4 h-4" /> Publish Status
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setValue("status", "approved")}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  status === "approved" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-card hover:border-emerald-500/40"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Live Now</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Event is immediately visible to all users</p>
              </button>
              <button
                type="button"
                onClick={() => setValue("status", "pending")}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  status === "pending" ? "border-amber-500 bg-amber-500/10" : "border-border bg-card hover:border-amber-500/40"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <EyeOff className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Save as Draft</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Hidden until you manually approve it</p>
              </button>
            </div>
          </div>

          {/* Featured */}
          <div>
            <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Promotion
            </Label>
            <div className="space-y-3">
              <SwitchRow
                label="⭐ Feature This Event"
                desc="Appears in the Featured section on the homepage & discovery page — maximum visibility"
                checked={isFeatured}
                onChange={v => setValue("isFeatured", v)}
                icon={<Star className="w-6 h-6 text-amber-500" />}
                accent="border-amber-500 bg-amber-500/10"
              />
              <SwitchRow
                label="🔥 Mark as Trending"
                desc="Shows in the Trending section — appears alongside popular community events"
                checked={isTrending}
                onChange={v => setValue("isTrending", v)}
                icon={<TrendingUp className="w-6 h-6 text-orange-500" />}
                accent="border-orange-500 bg-orange-500/10"
              />
              <SwitchRow
                label="✅ Verified Organizer"
                desc="Adds a blue verification badge to the event and organizer name"
                checked={isVerifiedOrganizer}
                onChange={v => setValue("isVerifiedOrganizer", v)}
                icon={<BadgeCheck className="w-6 h-6 text-blue-500" />}
                accent="border-blue-500 bg-blue-500/10"
              />
            </div>
          </div>

          {/* Active badges preview */}
          {(isFeatured || isTrending || isVerifiedOrganizer) && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Active badges on this event:</p>
              <div className="flex flex-wrap gap-2">
                {isFeatured && <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-400">⭐ Featured</Badge>}
                {isTrending && <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400">🔥 Trending</Badge>}
                {isVerifiedOrganizer && <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30 dark:text-blue-400">✅ Verified Organizer</Badge>}
              </div>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Admin Notes <span className="text-muted-foreground text-xs font-normal">(internal only)</span>
            </Label>
            <Textarea
              placeholder="Internal notes about this event — not visible to users..."
              rows={3}
              className="resize-none text-sm"
              {...form.register("adminNotes")}
            />
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Summary</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Title</p>
                <p className="font-medium truncate">{watch("title") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Date</p>
                <p className="font-medium">{selectedDate ? format(selectedDate, "d MMM yyyy") : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Category</p>
                <p className="font-medium capitalize">{category || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Pricing</p>
                <p className="font-medium capitalize">
                  {priceModel === "free" ? "Free" : priceModel === "paid" ? `€${watch("price") || 0}` : `From €${watch("price") || 0}`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <p className={cn("font-medium", status === "approved" ? "text-emerald-600" : "text-amber-600")}>
                  {status === "approved" ? "Live" : "Draft"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Location</p>
                <p className="font-medium truncate">{watch("city") || watch("location")?.split(",")[0] || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Create New Event</h2>
              <p className="text-xs text-muted-foreground">Admin event creation — {STEPS[step - 1].desc}</p>
            </div>
          </div>
          <StepBar current={step} total={5} />
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {stepContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-card shrink-0 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => step === 1 ? handleClose() : setStep(s => s - 1)}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Step {step} of {STEPS.length}</span>
              {step < 5 ? (
                <Button
                  type="button"
                  data-testid="btn-next-step"
                  onClick={handleNext}
                  disabled={!canAdvance()}
                  className="gap-1.5"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSubmit(onSubmit)()}
                  data-testid="btn-create-event-submit"
                  disabled={createMutation.isPending}
                  className={cn(
                    "gap-2 font-semibold",
                    isFeatured ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
                  )}
                >
                  {createMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                  ) : isFeatured ? (
                    <><Star className="w-4 h-4" /> Publish as Featured</>
                  ) : (
                    <><Check className="w-4 h-4" /> {status === "approved" ? "Publish Event" : "Save as Draft"}</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateEventModal;
