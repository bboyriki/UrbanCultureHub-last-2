import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Service, ServiceCategory, ServiceType, SkillLevel, insertServiceSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronLeft, Loader2, MapPin, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { searchAddress, NominatimResult } from "@/lib/nominatim";
import KvkVerificationForm from "@/components/profile/KvkVerificationForm";
import MultiImageUploader from "@/components/shared/MultiImageUploader";
import { useMutation } from "@tanstack/react-query";

// Extended schema for client-side validation
const createServiceSchema = z.object({
  name: z.string().min(5, "Service name must be at least 5 characters"),
  type: z.enum([
    ServiceType.WORKSHOP, 
    ServiceType.PRIVATE_LESSON, 
    ServiceType.PERFORMANCE, 
    ServiceType.EVENT_SERVICE,
    ServiceType.TECHNICAL,
    ServiceType.CREATIVE_SERVICE
  ]),
  category: z.enum([
    // Artists & Performers
    ServiceCategory.DANCE,
    ServiceCategory.GRAFFITI,
    ServiceCategory.BEATBOX,
    ServiceCategory.RAP,
    ServiceCategory.DJ,
    ServiceCategory.MUSIC,
    ServiceCategory.THEATER,
    ServiceCategory.CIRCUS,
    
    // Athletes & Sports
    ServiceCategory.SKATEBOARDING,
    ServiceCategory.PARKOUR,
    ServiceCategory.BMX,
    ServiceCategory.ROLLERBLADING,
    ServiceCategory.BASKETBALL,
    ServiceCategory.FOOTBALL,
    ServiceCategory.BOXING,
    ServiceCategory.MMA,
    ServiceCategory.CAPOEIRA,
    ServiceCategory.GYMNASTICS,
    ServiceCategory.FITNESS,
    
    // Event Production
    ServiceCategory.LIGHTING,
    ServiceCategory.SOUND,
    ServiceCategory.STAGE_DESIGN,
    ServiceCategory.PROJECTION,
    ServiceCategory.PHOTOGRAPHY,
    ServiceCategory.VIDEOGRAPHY,
    ServiceCategory.EVENT_MANAGEMENT,
    
    ServiceCategory.OTHER
  ]),
  skillLevel: z.enum([
    SkillLevel.BEGINNER,
    SkillLevel.INTERMEDIATE,
    SkillLevel.ADVANCED,
    SkillLevel.PROFESSIONAL,
    SkillLevel.ALL_LEVELS
  ]).default(SkillLevel.ALL_LEVELS),
  description: z.string().min(20, "Description must be at least 20 characters"),
  price: z.string().min(1, "Price is required").regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  duration: z.string().min(1, "Duration is required").regex(/^\d+$/, "Must be a number"),
  maxParticipants: z.string().regex(/^\d*$/, "Must be a number").optional().transform(val => val === "" ? null : parseInt(val)),
  location: z.string().optional(),
  isRemote: z.boolean().default(false),
  requirements: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export default function CreateServicePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [locationInput, setLocationInput] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<NominatimResult[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLocationSearch = (val: string) => {
    setLocationInput(val);
    form.setValue("location", val);
    setShowLocationSuggestions(true);
    if (locationSearchTimer.current) clearTimeout(locationSearchTimer.current);
    if (val.length >= 3) {
      locationSearchTimer.current = setTimeout(async () => {
        const results = await searchAddress(val, 5);
        setLocationSuggestions(results);
      }, 400);
    } else {
      setLocationSuggestions([]);
    }
  };

  const handleLocationSelect = (result: NominatimResult) => {
    const display = result.display_name.split(",").slice(0, 4).join(", ");
    setLocationInput(display);
    form.setValue("location", display);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  // Check if verification is needed immediately based on user profile
  const [verificationRequired, setVerificationRequired] = useState(
    user?.kvkVerificationStatus !== 'verified'
  );
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    user?.kvkVerificationStatus || null
  );

  // Update verification status when user data changes
  useEffect(() => {
    if (user) {
      setVerificationRequired(user.kvkVerificationStatus !== 'verified');
      setVerificationStatus(user.kvkVerificationStatus || null);
    }
  }, [user]);

  const form = useForm<z.infer<typeof createServiceSchema>>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: "",
      type: ServiceType.WORKSHOP,
      category: ServiceCategory.DANCE,
      skillLevel: SkillLevel.ALL_LEVELS,
      description: "",
      price: "",
      duration: "60",
      maxParticipants: "",
      location: "",
      isRemote: false,
      requirements: "",
      images: [],
    },
  });
  
  const enhanceMutation = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      const res = await apiRequest("/api/services/ai/enhance-description", "POST", {
        name: values.name,
        category: values.category,
        type: values.type,
        skillLevel: values.skillLevel,
        currentDescription: values.description,
      });
      const data = await res.json();
      return data.description as string;
    },
    onSuccess: (desc) => {
      form.setValue("description", desc);
      toast({ title: "Description enhanced", description: "AI improved your service description." });
    },
    onError: () => {
      toast({ title: "AI unavailable", description: "Please try again shortly.", variant: "destructive" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createServiceSchema>) => {
      // Transform the form data to match the expected schema
      const serviceData = {
        ...data,
        providerId: user?.id,
        price: data.price, // Price is stored as string in the database
        duration: parseInt(data.duration),
        // Make sure maxParticipants is either a number or null, not undefined
        maxParticipants: data.maxParticipants === undefined ? null : data.maxParticipants,
      };

      console.log("Service data being sent:", serviceData);
      return await apiRequest("/api/services", "POST", serviceData);
    },
    onSuccess: () => {
      toast({
        title: "Service created",
        description: "Your service has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      navigate("/services");
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      
      // Check if this is a verification error
      if (error.status === 403 && error.data?.needsVerification) {
        setVerificationRequired(true);
        setVerificationStatus(error.data?.verificationStatus);
        
        // Check if KVK API is in fallback mode
        if (error.data?.isFallbackMode) {
          // Suggest adding KVK number
          toast({
            title: "Business verification needed",
            description: "Please add your KVK number in your profile to create services. Our verification system is in fallback mode due to API issues.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Business verification required",
            description: "You need to verify your business information before creating services.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error creating service",
          description: "There was an error creating your service. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  function onSubmit(data: z.infer<typeof createServiceSchema>) {
    setIsSubmitting(true);
    createServiceMutation.mutate(data);
  }

  // Redirect to login if not authenticated
  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <Button variant="ghost" onClick={() => navigate("/services")} className="mb-6 flex items-center gap-2">
        <ChevronLeft size={16} />
        <span>Back to Services</span>
      </Button>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create a New Service</h1>
          <p className="text-muted-foreground mt-2">Share your skills and talents with the community</p>
        </div>
        
        {verificationRequired && (
          <div className="mb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium text-amber-800">Business Verification Required</h3>
                  {verificationStatus === 'pending' ? (
                    <p className="text-amber-700 text-sm mt-1">
                      Your business verification is currently in progress. Please wait for an administrator to approve your KVK details.
                    </p>
                  ) : verificationStatus === 'rejected' ? (
                    <p className="text-amber-700 text-sm mt-1">
                      Your business verification was rejected. Please update your KVK details and try again.
                    </p>
                  ) : (
                    <p className="text-amber-700 text-sm mt-1">
                      You need to verify your business details before you can offer services. 
                      {verificationStatus === undefined 
                        ? 'Please complete the verification form below.'
                        : 'Please complete the verification process below.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Integrate the KVK verification form directly in the service creation page */}
            <KvkVerificationForm 
              onSuccess={() => {
                setVerificationRequired(false);
                toast({
                  title: "Verification completed",
                  description: "Your business is now verified. You can create services.",
                });
              }}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
            <CardDescription>
              Provide information about the service you're offering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Hip-Hop Dance Workshop" {...field} />
                        </FormControl>
                        <FormDescription>
                          Create a clear and descriptive name
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-80">
                            <SelectItem className="font-semibold text-primary" disabled value="header-artists">-- Artists & Performers --</SelectItem>
                            <SelectItem value={ServiceCategory.DANCE}>Dance</SelectItem>
                            <SelectItem value={ServiceCategory.GRAFFITI}>Graffiti</SelectItem>
                            <SelectItem value={ServiceCategory.BEATBOX}>Beatbox</SelectItem>
                            <SelectItem value={ServiceCategory.RAP}>Rap</SelectItem>
                            <SelectItem value={ServiceCategory.DJ}>DJ</SelectItem>
                            <SelectItem value={ServiceCategory.MUSIC}>Music</SelectItem>
                            <SelectItem value={ServiceCategory.THEATER}>Theater</SelectItem>
                            <SelectItem value={ServiceCategory.CIRCUS}>Circus</SelectItem>
                            
                            <SelectItem className="font-semibold text-primary mt-2" disabled value="header-athletes">-- Athletes & Sports --</SelectItem>
                            <SelectItem value={ServiceCategory.SKATEBOARDING}>Skateboarding</SelectItem>
                            <SelectItem value={ServiceCategory.PARKOUR}>Parkour</SelectItem>
                            <SelectItem value={ServiceCategory.BMX}>BMX</SelectItem>
                            <SelectItem value={ServiceCategory.ROLLERBLADING}>Rollerblading</SelectItem>
                            <SelectItem value={ServiceCategory.BASKETBALL}>Basketball</SelectItem>
                            <SelectItem value={ServiceCategory.FOOTBALL}>Football</SelectItem>
                            <SelectItem value={ServiceCategory.BOXING}>Boxing</SelectItem>
                            <SelectItem value={ServiceCategory.MMA}>MMA</SelectItem>
                            <SelectItem value={ServiceCategory.CAPOEIRA}>Capoeira</SelectItem>
                            <SelectItem value={ServiceCategory.GYMNASTICS}>Gymnastics</SelectItem>
                            <SelectItem value={ServiceCategory.FITNESS}>Fitness</SelectItem>
                            
                            <SelectItem className="font-semibold text-primary mt-2" disabled value="header-production">-- Event Production --</SelectItem>
                            <SelectItem value={ServiceCategory.LIGHTING}>Lighting</SelectItem>
                            <SelectItem value={ServiceCategory.SOUND}>Sound</SelectItem>
                            <SelectItem value={ServiceCategory.STAGE_DESIGN}>Stage Design</SelectItem>
                            <SelectItem value={ServiceCategory.PROJECTION}>Projection</SelectItem>
                            <SelectItem value={ServiceCategory.PHOTOGRAPHY}>Photography</SelectItem>
                            <SelectItem value={ServiceCategory.VIDEOGRAPHY}>Videography</SelectItem>
                            <SelectItem value={ServiceCategory.EVENT_MANAGEMENT}>Event Management</SelectItem>
                            
                            <SelectItem value={ServiceCategory.OTHER}>Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the category that best fits your service
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={ServiceType.WORKSHOP}>Workshop</SelectItem>
                            <SelectItem value={ServiceType.PRIVATE_LESSON}>Private Lesson</SelectItem>
                            <SelectItem value={ServiceType.PERFORMANCE}>Performance</SelectItem>
                            <SelectItem value={ServiceType.EVENT_SERVICE}>Event Service</SelectItem>
                            <SelectItem value={ServiceType.TECHNICAL}>Technical Support</SelectItem>
                            <SelectItem value={ServiceType.CREATIVE_SERVICE}>Creative Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          What kind of service are you offering?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="skillLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skill Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select skill level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SkillLevel.BEGINNER}>Beginner</SelectItem>
                            <SelectItem value={SkillLevel.INTERMEDIATE}>Intermediate</SelectItem>
                            <SelectItem value={SkillLevel.ADVANCED}>Advanced</SelectItem>
                            <SelectItem value={SkillLevel.PROFESSIONAL}>Professional</SelectItem>
                            <SelectItem value={SkillLevel.ALL_LEVELS}>All Levels</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          What skill level is this service for?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1.5">
                        <FormLabel className="mb-0">Description</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => enhanceMutation.mutate()}
                          disabled={enhanceMutation.isPending}
                          className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10 h-7 px-2.5"
                          data-testid="button-enhance-description"
                        >
                          {enhanceMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {enhanceMutation.isPending ? "Enhancing…" : "Enhance with AI"}
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what your service offers, what participants will learn or experience, and why it's valuable..." 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Provide a detailed description — or click "Enhance with AI" to improve it automatically
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (€)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 50.00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Set a price per booking
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" min="15" step="15" {...field} />
                        </FormControl>
                        <FormDescription>
                          How long is each session?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Participants (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 10" {...field} />
                        </FormControl>
                        <FormDescription>
                          Leave empty if unlimited
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="isRemote"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Remote Service</FormLabel>
                            <FormDescription>
                              This service is offered online
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="relative">
                          <FormLabel>Location (optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="Search for a location..." 
                                value={locationInput}
                                onChange={(e) => handleLocationSearch(e.target.value)}
                                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                                onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                                className="pr-10"
                              />
                              <MapPin className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                            </div>
                          </FormControl>
                          
                          {showLocationSuggestions && locationSuggestions.length > 0 && (
                            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-background border border-input py-1 shadow-lg">
                              {locationSuggestions.map((result, idx) => (
                                <li
                                  key={`${result.place_id}-${idx}`}
                                  onMouseDown={(e) => { e.preventDefault(); handleLocationSelect(result); }}
                                  className="cursor-pointer select-none px-4 py-2 hover:bg-muted text-sm"
                                >
                                  {result.display_name}
                                </li>
                              ))}
                            </ul>
                          )}
                          
                          <FormDescription>
                            Where will the service take place?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="requirements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requirements (optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="List any materials, preparations, or prerequisites..."
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          What should participants bring or know?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-6">
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Images</FormLabel>
                        <FormControl>
                          <MultiImageUploader
                            images={field.value || []}
                            onImagesChange={(urls) => {
                              field.onChange(urls);
                            }}
                            maxImages={5}
                            folder="urban-culture/services"
                          />
                        </FormControl>
                        <FormDescription>
                          Upload images showcasing your service (max 5 images)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <CardFooter className="px-0 pb-0 pt-6">
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Service...
                      </>
                    ) : (
                      "Create Service"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}