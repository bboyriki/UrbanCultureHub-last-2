import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, X, MapPin, Navigation } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { searchAddress, geocodeAddress, reverseGeocode, getCurrentLocation, NominatimResult } from "@/lib/nominatim";

const locationSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  address: z.string().min(5, { message: "Address must be at least 5 characters" }),
  type: z.string({ required_error: "Please select a location type" }),
  accessibility: z.string().optional(),
  openingHours: z.string().optional(),
  surfaceType: z.string().optional(),
  skillLevel: z.string().optional(),
  isFree: z.boolean().default(true),
  website: z.string().url().optional().or(z.literal("")),
  contactInfo: z.string().optional(),
  latitude: z.string().min(1, { message: "Latitude is required" }),
  longitude: z.string().min(1, { message: "Longitude is required" }),
  // Extended rich fields
  indoorOutdoor: z.string().optional(),
  lighting: z.string().optional(),
  crowdLevel: z.string().optional(),
  floorMaterial: z.string().optional(),
  instagram: z.string().optional(),
  rules: z.string().optional(),
  capacity: z.string().optional(),
});

type FormValues = z.infer<typeof locationSchema>;

interface AddLocationModalProps {
  open: boolean;
  onClose: () => void;
  prefilledCoordinates?: { latitude: string; longitude: string };
}

const LocationTypeOptions = [
  { value: "graffiti", label: "Graffiti & Street Art" },
  { value: "dance", label: "Dance Area" },
  { value: "music", label: "Music Spot" },
  { value: "rap", label: "Rap & Spoken Word" },
  { value: "performance", label: "Performance Space" },
  { value: "skate", label: "Skateboarding Spot" },
  { value: "parkour", label: "Parkour Area" },
  { value: "training", label: "Training Ground" },
  { value: "bmx", label: "BMX Spot" },
  { value: "street_sports", label: "Street Sports" },
  { value: "cultural_hub", label: "Cultural Hub" },
  { value: "open_mic", label: "Open Mic Venue" },
  { value: "workshop", label: "Workshop Space" },
  { value: "other", label: "Other" },
];

const AddLocationModal = ({ open, onClose, prefilledCoordinates }: AddLocationModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [addressInput, setAddressInput] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addressContainerRef.current && !addressContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      type: "",
      accessibility: "",
      openingHours: "",
      surfaceType: "",
      skillLevel: "",
      isFree: true,
      website: "",
      contactInfo: "",
      latitude: prefilledCoordinates?.latitude || "",
      longitude: prefilledCoordinates?.longitude || "",
      indoorOutdoor: "",
      lighting: "",
      crowdLevel: "",
      floorMaterial: "",
      instagram: "",
      rules: "",
      capacity: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (prefilledCoordinates) {
      form.setValue("latitude", prefilledCoordinates.latitude);
      form.setValue("longitude", prefilledCoordinates.longitude);
    }
  }, [prefilledCoordinates]);

  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressInput(val);
    form.setValue("address", val);
    setShowSuggestions(true);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (val.length >= 3) {
      setIsSearchingAddress(true);
      addressSearchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val, 5);
        setAddressSuggestions(results);
        setIsSearchingAddress(false);
      }, 400);
    } else {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
    }
  };

  const handleAddressSelect = async (result: NominatimResult) => {
    const displayAddress = result.display_name.split(",").slice(0, 4).join(", ");
    setAddressInput(displayAddress);
    form.setValue("address", displayAddress);
    form.setValue("latitude", result.lat);
    form.setValue("longitude", result.lon);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    toast({ title: "Location set", description: `Coordinates retrieved for ${displayAddress}` });
  };

  const generateAiDescription = async () => {
    const address = form.getValues("address");
    const spotType = form.getValues("type");
    const spotName = form.getValues("name");
    const latitude = form.getValues("latitude");
    const longitude = form.getValues("longitude");

    if (!address || address.trim().length < 3) {
      toast({ title: "Address required", description: "Enter a location address first.", variant: "destructive" });
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const response = await apiRequest("/api/spots/ai-description", "POST", { address, latitude, longitude, spotType, spotName });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        toast({
          title: "Premium AI feature 🔒",
          description: data.mode === "subscription"
            ? "Upgrade to Premium to unlock AI descriptions."
            : "Contact the admin to unlock AI features.",
          variant: "destructive",
        });
        return;
      }

      if (data.description) {
        form.setValue("description", data.description);
        toast({ title: "Description generated", description: "AI description added. Feel free to edit it!" });
      }
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message || "Could not generate description.", variant: "destructive" });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const { lat, lng } = await getCurrentLocation();
      form.setValue("latitude", lat.toString());
      form.setValue("longitude", lng.toString());
      try {
        const address = await reverseGeocode(lat, lng);
        setAddressInput(address.split(",").slice(0, 4).join(", "));
        form.setValue("address", address.split(",").slice(0, 4).join(", "));
        toast({ title: "Location found", description: "Your current location has been set." });
      } catch {
        const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressInput(coordStr);
        form.setValue("address", coordStr);
        toast({ title: "Location found", description: "Coordinates set, but couldn't get full address." });
      }
    } catch (error: any) {
      toast({ title: "Location error", description: error.message || "Unable to get your location", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setImages(prev => [...prev, ...newFiles]);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          if (!event.target || typeof event.target.result !== "string") throw new Error("Failed to read file");
          const uploadRes = await apiRequest("/api/media/upload", "POST", {
            imageData: event.target.result,
            folder: "urban-culture/locations",
            resourceType: "image",
          });
          if (!uploadRes.ok) {
            const err = await uploadRes.json();
            throw new Error(err.message || "Upload failed");
          }
          const data = await uploadRes.json();
          resolve(data.url);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast({ title: "Authentication required", description: "Please sign in to add a location", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        toast({ title: "Uploading images", description: "Please wait..." });
        imageUrls = await Promise.all(images.map(uploadImageToCloudinary));
      }
      const locationData = {
        ...values,
        createdBy: user.id,
        images: imageUrls.length > 0 ? imageUrls : null,
        capacity: values.capacity ? parseInt(values.capacity) : null,
        // clean empty strings for optional fields
        indoorOutdoor: values.indoorOutdoor || null,
        lighting: values.lighting || null,
        crowdLevel: values.crowdLevel || null,
        floorMaterial: values.floorMaterial || null,
        instagram: values.instagram || null,
        rules: values.rules || null,
      };
      const response = await apiRequest("/api/locations", "POST", locationData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create location");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location added", description: "Your location has been successfully added to the map." });
      form.reset();
      setImages([]);
      setImagePreviews([]);
      setAddressInput("");
      onClose();
    } catch (error: any) {
      toast({ title: "Failed to add location", description: error.message || "An error occurred", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, staggerChildren: 0.05, delayChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full sm:w-[90vw] max-w-xl max-h-[85vh] overflow-y-auto rounded-xl p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add New Location</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <motion.form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Location Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter location name" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Type</FormLabel>
                  <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select location type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LocationTypeOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <FormLabel className="font-medium">Description</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAiDescription}
                      disabled={isLoading || isGeneratingDescription}
                      className="text-xs gap-1"
                      data-testid="button-generate-ai-description"
                    >
                      {isGeneratingDescription ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />Generating...</>
                      ) : (
                        <><Sparkles className="h-3 w-3" />Generate with AI</>
                      )}
                    </Button>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this location or use AI to generate..."
                      disabled={isLoading || isGeneratingDescription}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="openingHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Opening Hours</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 24/7" disabled={isLoading} className="text-sm" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs text-muted-foreground">When accessible?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surfaceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Surface Type</FormLabel>
                    <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Select surface" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="concrete">Concrete</SelectItem>
                        <SelectItem value="asphalt">Asphalt</SelectItem>
                        <SelectItem value="wood">Wood</SelectItem>
                        <SelectItem value="metal">Metal</SelectItem>
                        <SelectItem value="rubber">Rubber</SelectItem>
                        <SelectItem value="grass">Grass</SelectItem>
                        <SelectItem value="dirt">Dirt/Earth</SelectItem>
                        <SelectItem value="sand">Sand</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="skillLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Recommended Skill Level</FormLabel>
                    <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select skill level" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="all">All Levels</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accessibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Accessibility</FormLabel>
                    <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select accessibility" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wheelchair">Wheelchair Accessible</SelectItem>
                        <SelectItem value="limited">Limited Accessibility</SelectItem>
                        <SelectItem value="not_accessible">Not Accessible</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Website (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" disabled={isLoading} className="text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Contact Info (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone or email" disabled={isLoading} className="text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isFree"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border border-border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Free to use</FormLabel>
                    <FormDescription>Check if this location is free to access</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* ── Extended Rich Fields ── */}
            <div className="pt-1 pb-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">More Details (optional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="indoorOutdoor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Indoor / Outdoor</FormLabel>
                      <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="outdoor">Outdoor</SelectItem>
                          <SelectItem value="indoor">Indoor</SelectItem>
                          <SelectItem value="covered">Covered</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lighting"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Lighting</FormLabel>
                      <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="full">Full lighting</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="crowdLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Crowd Level</FormLabel>
                      <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="quiet">Quiet / Solo</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="busy">Usually Busy</SelectItem>
                          <SelectItem value="varies">Varies</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="floorMaterial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Floor Material</FormLabel>
                      <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="smooth_concrete">Smooth Concrete</SelectItem>
                          <SelectItem value="rough_concrete">Rough Concrete</SelectItem>
                          <SelectItem value="marble">Marble</SelectItem>
                          <SelectItem value="tiles">Tiles</SelectItem>
                          <SelectItem value="wood">Wood / Parquet</SelectItem>
                          <SelectItem value="asphalt">Asphalt</SelectItem>
                          <SelectItem value="dirt">Dirt / Earth</SelectItem>
                          <SelectItem value="grass">Grass</SelectItem>
                          <SelectItem value="rubber">Rubber</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Capacity (people)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 20" disabled={isLoading} className="text-sm" {...field} data-testid="input-capacity" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Instagram Handle</FormLabel>
                      <FormControl>
                        <Input placeholder="@spotname" disabled={isLoading} className="text-sm" {...field} data-testid="input-instagram" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="rules"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel className="text-sm font-medium">Spot Rules / Access Info</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. No filming, ask permission first" disabled={isLoading} className="text-sm" {...field} data-testid="input-rules" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field: _field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Location Search</FormLabel>
                  <FormControl>
                    <div className="relative" ref={addressContainerRef}>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          value={addressInput}
                          onChange={handleAddressInputChange}
                          onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                          placeholder="Enter address or landmark..."
                          disabled={isLoading}
                          className="pl-9"
                          data-testid="input-address-search"
                        />
                        {isSearchingAddress && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
                          {addressSuggestions.map((r, i) => (
                            <div
                              key={i}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleAddressSelect(r)}
                              className="px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors flex items-start gap-2 border-b border-border last:border-0"
                            >
                              <Navigation className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-foreground leading-tight">
                                {r.display_name.split(",").slice(0, 4).join(", ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <button
                          type="button"
                          onClick={handleGetCurrentLocation}
                          disabled={isLoading}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded-md text-primary hover:bg-muted transition-colors"
                          data-testid="button-use-current-location"
                        >
                          <MapPin className="h-3 w-3" />
                          Use My Current Location
                        </button>
                        {form.watch("latitude") && form.watch("longitude") && (
                          <span className="text-xs text-muted-foreground">
                            {parseFloat(form.watch("latitude")).toFixed(5)}, {parseFloat(form.watch("longitude")).toFixed(5)}
                          </span>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <input type="hidden" {...form.register("latitude")} />
            <input type="hidden" {...form.register("longitude")} />

            <motion.div className="space-y-2" variants={itemVariants}>
              <FormLabel className="text-sm font-medium">Images</FormLabel>
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
                <AnimatePresence>
                  {imagePreviews.map((src, index) => (
                    <motion.div
                      key={index}
                      className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden group"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <img src={src} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                      <motion.button
                        type="button"
                        className="absolute inset-0 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <motion.button
                  type="button"
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors border-border text-muted-foreground hover:border-primary/50 hover:bg-muted"
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    disabled={isLoading}
                  />
                </motion.button>
              </div>
              <p className="text-xs text-muted-foreground">Add images (optional)</p>
            </motion.div>

            <motion.div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4" variants={itemVariants}>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="text-sm">
                Cancel
              </Button>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" disabled={isLoading} className="text-sm w-full sm:w-auto">
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </div>
                  ) : "Add Location"}
                </Button>
              </motion.div>
            </motion.div>
          </motion.form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLocationModal;
