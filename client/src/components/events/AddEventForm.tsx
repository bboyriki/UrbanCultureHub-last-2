import { useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, MapPin, ChevronRight, ChevronLeft, Check, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  EVENT_TAGS,
  COMPETITION_TYPES,
  COMPETITION_FORMATS,
  COMPETITION_CATEGORIES,
} from "@/types";
import { searchAddress, geocodeAddress, NominatimResult } from "@/lib/nominatim";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Badge } from "@/components/ui/badge";

class FormErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AddEventForm rendering error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-2">
          <p className="text-destructive font-semibold">Something went wrong loading this step.</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button className="text-sm underline" onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DUTCH_CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Haarlem", "Zaandam", "Almere", "Eindhoven", "Leiden", "Delft"];

const eventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  date: z.date({ required_error: "Date is required" }),
  location: z.string().min(3, "Location is required"),
  city: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  description: z.string().min(10, "Description is too short"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isPaid: z.boolean().default(false),
  price: z.coerce.number().min(0).optional(),
  priceModel: z.enum(["free", "paid", "from"]).default("free"),
  adultPrice: z.coerce.number().min(0).optional(),
  kidsPrice: z.coerce.number().min(0).optional(),
  familyPrice: z.coerce.number().min(0).optional(),
  image: z.string().optional().or(z.literal("")),
  kidFriendly: z.boolean().default(false),
  familyFriendly: z.boolean().default(false),
  minAge: z.coerce.number().min(0).optional(),
  maxAge: z.coerce.number().min(0).optional(),
  isIndoor: z.boolean().optional(),
  tags: z.array(z.string()).default([]),
  externalTicketLink: z.preprocess(val => val === "" ? undefined : val, z.string().url("Must be a valid URL").optional()),
  capacity: z.coerce.number().min(0).optional(),
  isCompetition: z.boolean().default(false),
  competitionDiscipline: z.string().optional(),
  competitionSport: z.string().optional(),
  competitionFormat: z.string().optional(),
  competitionMaxParticipants: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : Number(val),
    z.number().min(2).optional()
  ),
  competitionPrizePool: z.string().optional(),
});

type FormValues = z.infer<typeof eventSchema>;

interface AddEventFormProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 1, label: "Basics", desc: "Name, date & location" },
  { id: 2, label: "Details", desc: "Category, description & photo" },
  { id: 3, label: "Tickets", desc: "Pricing, audience & more" },
];

const CATEGORY_GROUPS = [
  {
    label: "Events",
    items: [
      { value: "dance", icon: "🕺", label: "Dance" },
      { value: "music", icon: "🎵", label: "Music" },
      { value: "sports", icon: "⚽", label: "Sports" },
      { value: "festival", icon: "🎪", label: "Festival" },
      { value: "workshop", icon: "🎨", label: "Workshop" },
      { value: "community", icon: "🤝", label: "Community" },
      { value: "cultural", icon: "🌍", label: "Cultural" },
      { value: "nightlife", icon: "🌙", label: "Nightlife" },
      { value: "art", icon: "🖼️", label: "Art" },
      { value: "skate", icon: "🛹", label: "Skate" },
      { value: "parkour", icon: "🏃", label: "Parkour" },
      { value: "kids", icon: "👦", label: "Kids" },
      { value: "family", icon: "👨‍👩‍👧", label: "Family" },
      { value: "food", icon: "🍕", label: "Food" },
      { value: "free", icon: "🎫", label: "Free" },
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

const DISCIPLINE_GROUPS = [
  { value: "dance", label: "Dance", icon: "🕺" },
  { value: "music", label: "Music", icon: "🎵" },
  { value: "sports", label: "Sports", icon: "⚽" },
  { value: "art", label: "Art", icon: "🎨" },
  { value: "other", label: "Other", icon: "🏅" },
];

function BracketInfoCard({ discipline, format }: { discipline: string; format: string }) {
  const info: Record<string, Record<string, string>> = {
    dance: {
      "single-elimination": "Dancers go head to head. One loss = out.",
      "double-elimination": "Two chances before elimination.",
      "round-robin": "Everyone battles everyone in the pool.",
      "judges-choice": "Judges pick winners per round.",
    },
  };
  const msg = info[discipline]?.[format] || `${format} bracket for ${discipline} competition.`;
  return (
    <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      📋 {msg}
    </div>
  );
}

const AddEventForm = ({ open, onClose }: AddEventFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Location search state
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // All form field state — no react-hook-form, no subscriptions, no infinite loops
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [isIndoor, setIsIndoor] = useState<boolean | undefined>();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [competitionSport, setCompetitionSport] = useState("");
  const [competitionMaxParticipants, setCompetitionMaxParticipants] = useState<string>("");
  const [competitionPrizePool, setCompetitionPrizePool] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState<string>("");
  const [adultPrice, setAdultPrice] = useState<string>("");
  const [kidsPrice, setKidsPrice] = useState<string>("");
  const [familyPrice, setFamilyPrice] = useState<string>("");
  const [externalTicketLink, setExternalTicketLink] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [kidFriendly, setKidFriendly] = useState(false);
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");

  // UI-only state (also written to submission)
  const [isCompetition, setIsCompetition] = useState(false);
  const [competitionDiscipline, setCompetitionDiscipline] = useState("");
  const [competitionFormat, setCompetitionFormat] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [priceModel, setPriceModel] = useState<"free" | "paid" | "from">("free");
  const [tags, setTags] = useState<string[]>([]);

  const resetAll = () => {
    setStep(1);
    setErrors({});
    setLocationInput("");
    setLocationSuggestions([]);
    setTitle("");
    setDate(undefined);
    setCity("");
    setLatitude("");
    setLongitude("");
    setIsIndoor(undefined);
    setCategory("");
    setDescription("");
    setCompetitionSport("");
    setCompetitionMaxParticipants("");
    setCompetitionPrizePool("");
    setImage("");
    setPrice("");
    setAdultPrice("");
    setKidsPrice("");
    setFamilyPrice("");
    setExternalTicketLink("");
    setCapacity("");
    setKidFriendly(false);
    setFamilyFriendly(false);
    setMinAge("");
    setMaxAge("");
    setIsCompetition(false);
    setCompetitionDiscipline("");
    setCompetitionFormat("");
    setIsPaid(false);
    setPriceModel("free");
    setTags([]);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleLocationInputChange = (val: string) => {
    setLocationInput(val);
    setLatitude("");
    setLongitude("");
    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current);
    if (val.length >= 3) {
      locationSearchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val, 5);
        setLocationSuggestions(results);
        setLocationOpen(results.length > 0);
      }, 300);
    } else {
      setLocationSuggestions([]);
      setLocationOpen(false);
    }
  };

  const handleLocationSelect = (suggestion: NominatimResult) => {
    setLocationInput(suggestion.display_name);
    setLatitude(suggestion.lat.toString());
    setLongitude(suggestion.lon.toString());
    setLocationOpen(false);
    setLocationSuggestions([]);
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    const competitionCats: readonly string[] = COMPETITION_CATEGORIES;
    if (competitionCats.includes(cat)) {
      setIsCompetition(true);
    }
    setErrors(prev => ({ ...prev, category: "" }));
  };

  const handleCompetitionToggle = (enabled: boolean) => {
    setIsCompetition(enabled);
    if (!enabled) {
      setCompetitionDiscipline("");
      setCompetitionSport("");
      setCompetitionFormat("");
    }
  };

  const competitionSubtypes: Array<{ value: string; label: string }> = (() => {
    try {
      if (!competitionDiscipline) return [];
      const types = (COMPETITION_TYPES as unknown as Record<string, Array<{ value: string; label: string }>>) || {};
      return Array.isArray(types[competitionDiscipline]) ? types[competitionDiscipline] : [];
    } catch {
      return [];
    }
  })();

  const validateStep = (s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!title || title.length < 3) errs.title = "Title must be at least 3 characters";
      if (!date) errs.date = "Date is required";
      if (!locationInput || locationInput.length < 3) errs.location = "Location is required";
    }
    if (s === 2) {
      if (!category) errs.category = "Category is required";
      if (!description || description.length < 10) errs.description = "Description is too short";
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(s => s + 1);
  };

  const createEventMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const formattedValues = {
        ...values,
        price: values.isPaid ? Math.round((values.price ?? 0) * 100) : null,
        adultPrice: values.adultPrice ? Math.round(values.adultPrice * 100) : undefined,
        kidsPrice: values.kidsPrice ? Math.round(values.kidsPrice * 100) : undefined,
        familyPrice: values.familyPrice ? Math.round(values.familyPrice * 100) : undefined,
        organizerId: user?.id || null,
        externalTicketLink: values.externalTicketLink || undefined,
        isCompetition: values.isCompetition || false,
        subcategory: values.competitionSport || values.subcategory || undefined,
      };
      const response = await apiRequest("/api/events", "POST", formattedValues);
      return response.json();
    },
    onSuccess: (data: any) => {
      const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "super_admin";
      toast({
        title: isAdmin ? "Event created!" : "Event submitted!",
        description: isAdmin
          ? isCompetition
            ? "Your competition event is live. Go to the event page to set up categories and bracket."
            : "Your event is now live and visible to everyone."
          : "Your event is pending review. It will appear once approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      resetAll();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create event", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const handleSubmit = async () => {
    const loc = locationInput;
    let lat = latitude;
    let lon = longitude;
    if (loc && (!lat || !lon)) {
      try {
        const result = await geocodeAddress(loc);
        if (result) { lat = result.lat.toString(); lon = result.lng.toString(); }
      } catch {}
    }

    const raw = {
      title,
      date,
      location: loc,
      city: city || undefined,
      category,
      description,
      latitude: lat || undefined,
      longitude: lon || undefined,
      isPaid,
      price: price !== "" ? parseFloat(price) : undefined,
      priceModel: isPaid ? priceModel : "free" as const,
      adultPrice: adultPrice !== "" ? parseFloat(adultPrice) : undefined,
      kidsPrice: kidsPrice !== "" ? parseFloat(kidsPrice) : undefined,
      familyPrice: familyPrice !== "" ? parseFloat(familyPrice) : undefined,
      image: image || undefined,
      kidFriendly,
      familyFriendly,
      isIndoor,
      tags,
      externalTicketLink: externalTicketLink || undefined,
      capacity: capacity !== "" ? parseFloat(capacity) : undefined,
      isCompetition,
      competitionDiscipline: competitionDiscipline || undefined,
      competitionSport: competitionSport || undefined,
      competitionFormat: competitionFormat || undefined,
      competitionMaxParticipants: competitionMaxParticipants !== "" ? parseFloat(competitionMaxParticipants) : undefined,
      competitionPrizePool: competitionPrizePool || undefined,
      minAge: minAge !== "" ? parseFloat(minAge) : undefined,
      maxAge: maxAge !== "" ? parseFloat(maxAge) : undefined,
    };

    const result = eventSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      toast({ title: "Please fix the errors", variant: "destructive" });
      return;
    }
    setErrors({});
    createEventMutation.mutate(result.data);
  };

  const Err = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-sm font-medium text-destructive">{errors[field]}</p> : null;

  const Label = ({ children, required }: { children: ReactNode; required?: boolean }) => (
    <p className="text-sm font-medium leading-none">{children}{required && " *"}</p>
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-[600px] max-h-[92vh] overflow-y-auto rounded-2xl bg-background shadow-2xl mx-4 p-0">
        <FormErrorBoundary>
          {/* Header */}
          <div className="sticky top-0 bg-background z-10 px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold">Create Event</h2>
              <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                      step > s.id ? "bg-primary text-primary-foreground" :
                      step === s.id ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <span className={cn("text-xs mt-1 font-medium", step === s.id ? "text-primary" : "text-muted-foreground")}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("h-0.5 flex-1 mx-2 mb-4 transition-all", step > s.id ? "bg-primary" : "bg-muted")} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-5">
            <div>
              {/* ── Step 1: Basics ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label required>Event Title</Label>
                    <Input
                      data-testid="input-event-title"
                      placeholder="Name of your event"
                      className="h-11"
                      value={title}
                      onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: "" })); }}
                    />
                    <Err field="title" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label required>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-11", !date && "text-muted-foreground")} data-testid="button-event-date">
                            {date ? format(date, "d MMM yyyy") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-70" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={d => { setDate(d); setErrors(prev => ({ ...prev, date: "" })); }}
                            disabled={d => d < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Err field="date" />
                    </div>

                    <div className="space-y-2">
                      <Label>City</Label>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {DUTCH_CITIES.slice(0, 6).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCity(c)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              city === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                            )}
                          >{c}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label required>Location</Label>
                    <div className="relative">
                      <Input
                        data-testid="input-event-location"
                        placeholder="Type to search locations..."
                        value={locationInput}
                        onChange={e => { handleLocationInputChange(e.target.value); setErrors(prev => ({ ...prev, location: "" })); }}
                        onBlur={() => setTimeout(() => setLocationOpen(false), 200)}
                        onFocus={() => locationSuggestions.length > 0 && setLocationOpen(true)}
                        className="pr-10 h-11"
                      />
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      {locationOpen && locationSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-card rounded-xl shadow-xl max-h-[250px] overflow-y-auto border">
                          {locationSuggestions.map((s, idx) => (
                            <div
                              key={`${s.place_id}-${idx}`}
                              className="px-4 py-3 text-sm cursor-pointer hover:bg-accent rounded-lg mx-1 my-0.5"
                              onMouseDown={e => { e.preventDefault(); handleLocationSelect(s); }}
                            >
                              {s.display_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Err field="location" />
                  </div>

                  <div className="space-y-2">
                    <Label>Venue type</Label>
                    <div className="flex gap-2">
                      {[{ value: true, label: "🏠 Indoor" }, { value: false, label: "🌳 Outdoor" }].map(opt => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setIsIndoor(opt.value)}
                          className={cn(
                            "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                            isIndoor === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                          )}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Details ── */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Category visual grid */}
                  <div className="space-y-2">
                    <Label required>Category</Label>
                    <Err field="category" />
                    <div className="space-y-3">
                      {CATEGORY_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">{group.label}</p>
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {group.items.map(cat => (
                              <button
                                key={cat.value}
                                type="button"
                                data-testid={`category-${cat.value}`}
                                onClick={() => handleCategorySelect(cat.value)}
                                className={cn(
                                  "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all",
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
                    </div>
                  </div>

                  {/* Competition toggle */}
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                      isCompetition ? "border-amber-500 bg-amber-500/10" : "border-border bg-muted/30 hover:border-amber-400/60"
                    )}
                    onClick={() => handleCompetitionToggle(!isCompetition)}
                    data-testid="toggle-is-competition"
                  >
                    <Checkbox
                      checked={isCompetition}
                      onCheckedChange={(v) => handleCompetitionToggle(!!v)}
                      className="h-5 w-5"
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-amber-500" /> This is a competition
                      </p>
                      <p className="text-xs text-muted-foreground">Enable bracket, registration & judging for any event type</p>
                    </div>
                  </div>

                  {/* Competition settings */}
                  {isCompetition && (
                    <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Competition Settings</span>
                      </div>

                      {/* Discipline */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Discipline</p>
                        <div className="grid grid-cols-2 gap-2">
                          {DISCIPLINE_GROUPS.map(d => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => { setCompetitionDiscipline(d.value); setCompetitionSport(""); }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left",
                                competitionDiscipline === d.value
                                  ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300"
                                  : "bg-card border-border hover:border-amber-400/60"
                              )}
                              data-testid={`discipline-${d.value}`}
                            >
                              <span>{d.icon}</span> {d.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Subtype */}
                      {competitionSubtypes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Specific Type</p>
                          <div className="flex flex-wrap gap-2">
                            {competitionSubtypes.map((sub: any) => (
                              <button
                                key={sub.value}
                                type="button"
                                onClick={() => setCompetitionSport(sub.value)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                  competitionSport === sub.value ? "bg-amber-500 text-white border-amber-500" : "bg-card border-border hover:border-amber-400"
                                )}
                                data-testid={`sport-${sub.value}`}
                              >{sub.label}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Format */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Format</p>
                        <div className="flex flex-wrap gap-2">
                          {COMPETITION_FORMATS.map(f => (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => setCompetitionFormat(f.value)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                competitionFormat === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                              )}
                              data-testid={`format-${f.value}`}
                            >{f.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Max participants & prize pool */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Max Participants</p>
                          <Input
                            type="number"
                            placeholder="e.g. 16"
                            className="h-9 text-sm"
                            value={competitionMaxParticipants}
                            onChange={e => setCompetitionMaxParticipants(e.target.value)}
                            data-testid="input-max-participants"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Prize Pool (optional)</p>
                          <Input
                            placeholder="e.g. €500 cash"
                            className="h-9 text-sm"
                            value={competitionPrizePool}
                            onChange={e => setCompetitionPrizePool(e.target.value)}
                            data-testid="input-prize-pool"
                          />
                        </div>
                      </div>

                      {/* Bracket preview info */}
                      {competitionDiscipline && competitionFormat && (
                        <BracketInfoCard discipline={competitionDiscipline} format={competitionFormat} />
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label required>Description</Label>
                    <Textarea
                      data-testid="textarea-event-description"
                      placeholder="Describe your event..."
                      rows={4}
                      className="min-h-[110px] resize-none"
                      value={description}
                      onChange={e => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: "" })); }}
                    />
                    <Err field="description" />
                  </div>

                  <div className="space-y-2">
                    <Label>Capacity</Label>
                    <Input
                      data-testid="input-event-capacity"
                      type="number"
                      placeholder="Max attendees"
                      className="h-11"
                      value={capacity}
                      onChange={e => setCapacity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cover Photo</Label>
                    <ImageUploader
                      initialImage={image}
                      onImageUploaded={url => setImage(url)}
                      folder="urban-culture/events"
                      buttonText="Upload event photo"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TAGS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            tags.includes(tag) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                          )}
                        >{tag}</button>
                      ))}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 3: Tickets & Audience ── */}
              {step === 3 && (
                <div className="space-y-5">
                  {/* Summary card */}
                  {isCompetition && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Competition Event</p>
                        <p className="text-xs text-muted-foreground">A bracket will be auto-generated. Manage participants &amp; rounds from the event page after creation.</p>
                      </div>
                    </div>
                  )}

                  {/* Paid toggle */}
                  <div className="flex flex-row items-center gap-3 p-4 rounded-xl border bg-muted/30">
                    <Checkbox
                      checked={isPaid}
                      onCheckedChange={v => setIsPaid(!!v)}
                      data-testid="checkbox-is-paid"
                      className="h-5 w-5"
                    />
                    <div>
                      <p className="text-base font-semibold">Paid event</p>
                      <p className="text-xs text-muted-foreground">Enable ticket sales with pricing</p>
                    </div>
                  </div>

                  {isPaid && (
                    <div className="space-y-4">
                      {/* Price model */}
                      <div className="space-y-2">
                        <Label>Pricing model</Label>
                        <div className="flex gap-2">
                          {[{ v: "paid" as const, l: "Fixed price" }, { v: "from" as const, l: "Starting from" }].map(opt => (
                            <button key={opt.v} type="button"
                              onClick={() => setPriceModel(opt.v)}
                              className={cn("flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all", priceModel === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50")}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {priceModel === "paid" ? (
                        <div className="space-y-2">
                          <Label>Ticket price (€)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                            <Input
                              data-testid="input-event-price"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="pl-8 h-11"
                              value={price}
                              onChange={e => setPrice(e.target.value)}
                            />
                          </div>
                          <Err field="price" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Adult (€)", value: adultPrice, setter: setAdultPrice },
                            { label: "Kids (€)", value: kidsPrice, setter: setKidsPrice },
                            { label: "Family (€)", value: familyPrice, setter: setFamilyPrice },
                          ].map(({ label, value, setter }) => (
                            <div key={label} className="space-y-1.5">
                              <p className="text-xs font-medium">{label}</p>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                                <Input type="number" step="0.01" placeholder="0.00" className="pl-7 h-10 text-sm" value={value} onChange={e => setter(e.target.value)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>External ticket link (optional)</Label>
                        <Input
                          data-testid="input-external-ticket"
                          placeholder="https://tickets.example.com"
                          className="h-11"
                          value={externalTicketLink}
                          onChange={e => setExternalTicketLink(e.target.value)}
                        />
                        <Err field="externalTicketLink" />
                      </div>
                    </div>
                  )}

                  {/* Audience */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Target Audience</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-row items-center gap-3 p-3 rounded-xl border bg-muted/30">
                        <Checkbox checked={kidFriendly} onCheckedChange={v => setKidFriendly(!!v)} data-testid="checkbox-kid-friendly" className="h-4 w-4" />
                        <p className="cursor-pointer text-sm font-medium">🧒 Kid Friendly</p>
                      </div>
                      <div className="flex flex-row items-center gap-3 p-3 rounded-xl border bg-muted/30">
                        <Checkbox checked={familyFriendly} onCheckedChange={v => setFamilyFriendly(!!v)} data-testid="checkbox-family-friendly" className="h-4 w-4" />
                        <p className="cursor-pointer text-sm font-medium">👨‍👩‍👧 Family Friendly</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium">Min age</p>
                        <Input type="number" placeholder="0" className="h-10" value={minAge} onChange={e => setMinAge(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium">Max age</p>
                        <Input type="number" placeholder="99" className="h-10" value={maxAge} onChange={e => setMaxAge(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Navigation ── */}
              <div className="flex justify-between gap-3 pt-6 mt-2 border-t">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
                )}

                {step < 3 ? (
                  <Button type="button" onClick={handleNext} className="gap-1.5" data-testid="button-next-step">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={createEventMutation.isPending}
                    data-testid="button-submit-event"
                    className={cn("font-semibold gap-1.5", isCompetition && "bg-amber-600 hover:bg-amber-700")}
                  >
                    {createEventMutation.isPending ? "Creating..." : (
                      <>
                        {isCompetition ? <Trophy className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                        {isCompetition ? "Create Competition" : "Create Event"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </FormErrorBoundary>
      </div>
    </div>,
    document.body
  );
};

export default AddEventForm;
