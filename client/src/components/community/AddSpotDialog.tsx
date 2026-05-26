import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LocationType } from "@shared/schema";
import { searchAddress, reverseGeocode, NominatimResult } from "@/lib/nominatim";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, MapPin, Search, CheckCircle, Navigation,
  Sparkles, ArrowLeft, ArrowRight, Image,
} from "lucide-react";
import MultiImageUploader from "@/components/shared/MultiImageUploader";

const addSpotSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  address: z.string().min(5, "Address is required"),
  type: z.string().min(1, "Please select a spot type"),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  skillLevel: z.string().optional(),
  accessibility: z.string().optional(),
  surfaceType: z.string().optional(),
  isFree: z.boolean().default(true),
  openingHours: z.string().optional(),
  images: z.array(z.string()).optional(),
});

type AddSpotFormValues = z.infer<typeof addSpotSchema>;

interface AddSpotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SPOT_TYPES = [
  { group: "Sports & Active", items: [
    { value: LocationType.BASKETBALL, label: "Basketball", emoji: "🏀" },
    { value: LocationType.TABLE_TENNIS, label: "Table Tennis", emoji: "🏓" },
    { value: LocationType.PADEL, label: "Padel", emoji: "🎾" },
    { value: LocationType.SKATE, label: "Skate Park", emoji: "🛹" },
    { value: LocationType.BOULDERING, label: "Bouldering", emoji: "🧗" },
    { value: LocationType.PARKOUR, label: "Parkour", emoji: "🤸" },
    { value: LocationType.BMX, label: "BMX", emoji: "🚲" },
    { value: LocationType.TRAINING, label: "Calisthenics", emoji: "💪" },
    { value: LocationType.FITNESS, label: "Gym / Fitness", emoji: "🏋️" },
    { value: LocationType.STREET_SPORTS, label: "Street Sports", emoji: "⚽" },
  ]},
  { group: "Urban Art & Culture", items: [
    { value: LocationType.GRAFFITI, label: "Graffiti / Art", emoji: "🎨" },
    { value: LocationType.DANCE, label: "Dance Studio", emoji: "💃" },
    { value: LocationType.MUSIC, label: "Music / DJ", emoji: "🎵" },
    { value: LocationType.RAP, label: "Rap / MC", emoji: "🎤" },
    { value: LocationType.BEATBOX, label: "Beatbox", emoji: "🎙️" },
    { value: LocationType.PERFORMANCE, label: "Performance", emoji: "🎭" },
    { value: LocationType.OPEN_MIC, label: "Open Mic", emoji: "🎶" },
    { value: LocationType.WORKSHOP, label: "Workshop", emoji: "🛠️" },
  ]},
  { group: "Social & Community", items: [
    { value: LocationType.CULTURAL_HUB, label: "Community Hub", emoji: "🏛️" },
    { value: LocationType.CAFE, label: "Café / Hangout", emoji: "☕" },
    { value: LocationType.RESTAURANT, label: "Food & Drink", emoji: "🍜" },
    { value: LocationType.WELLNESS, label: "Wellness / Spa", emoji: "🧘" },
    { value: LocationType.NIGHTLIFE, label: "Nightlife", emoji: "🌙" },
    { value: LocationType.OTHER, label: "Other", emoji: "📍" },
  ]},
];

const ALL_TYPES_FLAT = SPOT_TYPES.flatMap(g => g.items);

const SKILL_LEVELS = [
  { value: "all", label: "All Levels" },
  { value: "beginner", label: "Beginner Friendly" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export function AddSpotDialog({ open, onOpenChange }: AddSpotDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<AddSpotFormValues>({
    resolver: zodResolver(addSpotSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      type: "",
      latitude: "",
      longitude: "",
      skillLevel: "all",
      accessibility: "unknown",
      surfaceType: "",
      isFree: true,
      openingHours: "",
      images: [],
    },
  });

  const selectedType = form.watch("type");
  const selectedTypeInfo = ALL_TYPES_FLAT.find(t => t.value === selectedType);

  const handleAddressInputChange = (newValue: string) => {
    setAddressInput(newValue);
    form.setValue("address", newValue);
    setLocationConfirmed(false);
    setShowAddressSuggestions(true);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (newValue.length >= 3) {
      setIsSearchingAddress(true);
      addressSearchTimer.current = setTimeout(async () => {
        const results = await searchAddress(newValue, 5);
        setAddressSuggestions(results);
        setIsSearchingAddress(false);
      }, 400);
    } else {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
    }
  };

  const handleAddressSelect = (result: NominatimResult) => {
    const displayAddress = result.display_name.split(",").slice(0, 4).join(", ");
    setAddressInput(displayAddress);
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    form.setValue("address", displayAddress);
    form.setValue("latitude", result.lat);
    form.setValue("longitude", result.lon);
    setLocationConfirmed(true);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Not supported", description: "Geolocation isn't available in your browser", variant: "destructive" });
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        form.setValue("latitude", lat.toString());
        form.setValue("longitude", lng.toString());
        try {
          const address = await reverseGeocode(lat, lng);
          if (address) {
            const shortAddress = address.split(",").slice(0, 4).join(", ");
            form.setValue("address", shortAddress);
            setAddressInput(shortAddress);
            setLocationConfirmed(true);
          }
        } catch {}
        setIsGettingLocation(false);
        toast({ title: "Location found!", description: "Your current location was added" });
      },
      () => {
        setIsGettingLocation(false);
        toast({ title: "Couldn't get location", description: "Please search for an address instead", variant: "destructive" });
      },
      { enableHighAccuracy: true }
    );
  };

  const generateAiDescription = async () => {
    const spotName = form.getValues("name");
    const spotType = form.getValues("type");
    const address = form.getValues("address");
    const latitude = form.getValues("latitude");
    const longitude = form.getValues("longitude");

    if (!spotName || spotName.length < 3) {
      toast({ title: "Add a name first", description: "Go back and enter the spot name", variant: "destructive" });
      return;
    }
    if (!spotType) {
      toast({ title: "Select a type first", description: "Go back and pick what kind of spot this is", variant: "destructive" });
      return;
    }
    if (!address || address.trim().length < 3) {
      toast({ title: "Add a location first", description: "Go back and search or pin the address", variant: "destructive" });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const response = await apiRequest("/api/spots/ai-description", "POST", {
        address: address.trim(),
        latitude,
        longitude,
        spotType,
        spotName,
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        toast({
          title: "Premium AI feature 🔒",
          description: data.mode === "subscription" ? "Upgrade to Premium to unlock AI descriptions." : "Contact admin to unlock AI features.",
          variant: "destructive",
        });
        return;
      }
      if (data.description) {
        form.setValue("description", data.description);
        toast({ title: "✨ Description generated!", description: "Feel free to edit it to match your spot" });
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: "Please write a description manually", variant: "destructive" });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const createSpotMutation = useMutation({
    mutationFn: async (data: AddSpotFormValues) =>
      apiRequest("/api/locations", "POST", {
        ...data,
        createdBy: user?.id,
        latitude: data.latitude || "0",
        longitude: data.longitude || "0",
        approvalStatus: "pending",
        isVisible: true,
        images: data.images || [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({
        title: "Spot submitted! 🎉",
        description: "An admin will review and approve it shortly.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Submission failed", description: error.message || "Could not submit your spot", variant: "destructive" });
    },
  });

  const handleClose = () => {
    form.reset();
    setStep(1);
    setLocationConfirmed(false);
    setAddressInput("");
    setAddressSuggestions([]);
    onOpenChange(false);
  };

  const goNext = async () => {
    if (step === 1) {
      if (!selectedType) {
        toast({ title: "Pick a spot type", description: "Tap on what kind of spot you want to add", variant: "destructive" });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const valid = await form.trigger(["name", "address"]);
      if (!valid) return;
      setStep(3);
    }
  };

  const onSubmit = (data: AddSpotFormValues) => {
    if (!user) {
      toast({ title: "Login required", description: "Please log in to add a spot", variant: "destructive" });
      return;
    }
    createSpotMutation.mutate(data);
  };

  const STEPS = ["Type", "Location", "Details"];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-3xl p-0 overflow-hidden flex flex-col"
      >
        {/* Handle bar */}
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  data-testid="button-back-step"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="font-bold text-lg leading-tight">
                  {step === 1 && "What kind of spot?"}
                  {step === 2 && "Where is it?"}
                  {step === 3 && "Tell us more"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {step === 1 && "Pick the type that best describes this spot"}
                  {step === 2 && "Give it a name and pin the location"}
                  {step === 3 && "Add a description, photos & details"}
                </p>
              </div>
            </div>
            {selectedType && step === 1 && (
              <span className="text-2xl">{selectedTypeInfo?.emoji}</span>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 flex-1">
                <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i + 1 <= step ? "bg-primary" : "bg-muted"
                }`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STEPS.map((label, i) => (
              <span key={label} className={`text-[10px] font-medium transition-colors ${
                i + 1 <= step ? "text-primary" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">

              {/* ───── STEP 1: Type picker ───── */}
              {step === 1 && (
                <div className="flex-1 px-4 pb-4 space-y-5">
                  {SPOT_TYPES.map((group) => (
                    <div key={group.group}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        {group.group}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((type) => {
                          const isSelected = selectedType === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => form.setValue("type", type.value)}
                              data-testid={`type-card-${type.value}`}
                              className={`relative flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 transition-all duration-150 min-h-[72px] ${
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/50 active:scale-95"
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-3 h-3 text-primary-foreground" />
                                </div>
                              )}
                              <span className="text-2xl leading-none">{type.emoji}</span>
                              <span className={`text-[11px] font-medium text-center leading-tight ${
                                isSelected ? "text-primary" : "text-foreground"
                              }`}>
                                {type.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ───── STEP 2: Name + Location ───── */}
              {step === 2 && (
                <div className="flex-1 px-5 pb-4 space-y-5">
                  {selectedTypeInfo && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/8 border border-primary/15">
                      <span className="text-2xl">{selectedTypeInfo.emoji}</span>
                      <div>
                        <p className="text-xs text-muted-foreground">Selected type</p>
                        <p className="font-semibold text-sm">{selectedTypeInfo.label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="ml-auto text-xs text-primary underline underline-offset-2"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Spot Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={`e.g., West Side ${selectedTypeInfo?.label || "Spot"}`}
                            {...field}
                            data-testid="input-spot-name"
                            className="h-12 rounded-xl text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Location *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search address or street..."
                              value={addressInput}
                              onChange={(e) => handleAddressInputChange(e.target.value)}
                              onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                              onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                              className="pl-10 h-12 rounded-xl text-base"
                              data-testid="input-spot-address"
                            />
                            {isSearchingAddress && (
                              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </FormControl>

                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute z-50 left-5 right-5 mt-1 bg-popover border rounded-2xl shadow-xl overflow-hidden">
                            {addressSuggestions.map((suggestion, idx) => (
                              <button
                                key={`${suggestion.place_id}-${idx}`}
                                type="button"
                                className="w-full px-4 py-3 text-left text-sm hover:bg-accent flex items-start gap-3 border-b last:border-0 active:bg-accent"
                                onMouseDown={(e) => { e.preventDefault(); handleAddressSelect(suggestion); }}
                              >
                                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2 leading-snug">{suggestion.display_name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 gap-2.5 rounded-xl text-sm font-medium"
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    data-testid="button-get-location"
                  >
                    {isGettingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4 text-primary" />
                    )}
                    Use My Current Location
                  </Button>

                  {locationConfirmed && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">Location confirmed</p>
                        <p className="text-xs text-green-600/80 truncate">{addressInput}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ───── STEP 3: Description + Details ───── */}
              {step === 3 && (
                <div className="flex-1 px-5 pb-4 space-y-5">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <FormLabel className="text-sm font-semibold">Description *</FormLabel>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={generateAiDescription}
                            disabled={isGeneratingDescription}
                            className="h-7 px-2.5 text-xs gap-1.5 text-primary rounded-full bg-primary/10 hover:bg-primary/15"
                            data-testid="button-generate-ai-description"
                          >
                            {isGeneratingDescription ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            AI Write
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="What makes this spot special? Describe the vibe, facilities, who hangs here, best time to visit..."
                            className="min-h-[110px] resize-none rounded-xl text-sm"
                            {...field}
                            data-testid="textarea-spot-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Skill level */}
                  <FormField
                    control={form.control}
                    name="skillLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Skill Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-skill-level" className="h-12 rounded-xl">
                              <SelectValue placeholder="Who is this spot for?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SKILL_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Accessibility */}
                  <FormField
                    control={form.control}
                    name="accessibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Accessibility ♿</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-accessibility" className="h-12 rounded-xl">
                              <SelectValue placeholder="Is this spot wheelchair accessible?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="wheelchair">♿ Fully wheelchair accessible</SelectItem>
                            <SelectItem value="limited">🚶 Limited accessibility</SelectItem>
                            <SelectItem value="not_accessible">❌ Not wheelchair accessible</SelectItem>
                            <SelectItem value="unknown">❓ Unknown / not sure</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Surface Type */}
                  <FormField
                    control={form.control}
                    name="surfaceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Floor / Surface Type 🏗️</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-surface-type" className="h-12 rounded-xl">
                              <SelectValue placeholder="What is the floor or surface like?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="concrete">🪨 Concrete</SelectItem>
                            <SelectItem value="asphalt">⬛ Asphalt / Tarmac</SelectItem>
                            <SelectItem value="wood">🪵 Wood / Hardwood floor</SelectItem>
                            <SelectItem value="sprung_floor">🎵 Sprung dance floor</SelectItem>
                            <SelectItem value="rubber">🔵 Rubber / Foam mat</SelectItem>
                            <SelectItem value="grass">🌿 Grass</SelectItem>
                            <SelectItem value="tiles">🔲 Tiles</SelectItem>
                            <SelectItem value="sand">🏖️ Sand</SelectItem>
                            <SelectItem value="mixed">🔀 Mixed surfaces</SelectItem>
                            <SelectItem value="other">📋 Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Opening hours */}
                  <FormField
                    control={form.control}
                    name="openingHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Opening Hours <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Mon–Fri 08:00–22:00, weekends 10:00–20:00"
                            {...field}
                            className="h-12 rounded-xl text-sm"
                            data-testid="input-opening-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Free / Paid toggle */}
                  <FormField
                    control={form.control}
                    name="isFree"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                          <div>
                            <Label className="text-sm font-semibold">Free to access</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {field.value ? "No entry fee required" : "Entry fee or membership needed"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={field.value ? "default" : "secondary"} className="text-xs">
                              {field.value ? "Free" : "Paid"}
                            </Badge>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-is-free"
                            />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Photos */}
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold flex items-center gap-2">
                          <Image className="h-4 w-4 text-primary" />
                          Photos <span className="text-muted-foreground font-normal">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <MultiImageUploader
                            images={field.value || []}
                            onImagesChange={(urls) => field.onChange(urls)}
                            maxImages={5}
                            folder="urban-culture/spots"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Photos help others find and recognise the spot
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-xs text-muted-foreground text-center pb-1">
                    Your spot will be reviewed by an admin before going live.
                  </p>
                </div>
              )}

              {/* ───── Footer actions ───── */}
              <div className="flex-shrink-0 px-5 pb-6 pt-2 border-t border-border/50 bg-background">
                {step < 3 ? (
                  <Button
                    type="button"
                    className="w-full h-14 rounded-2xl text-base font-semibold gap-2 shadow-sm"
                    onClick={goNext}
                    data-testid="button-next-step"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-2xl text-base font-semibold gap-2 shadow-sm"
                    disabled={createSpotMutation.isPending}
                    data-testid="button-submit-spot"
                  >
                    {createSpotMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <MapPin className="h-5 w-5" />
                    )}
                    Submit Spot
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
