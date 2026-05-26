import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Service, ServiceCategory, ServiceType, SkillLevel, insertServiceSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronLeft, Loader2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import KvkVerificationForm from "@/components/profile/KvkVerificationForm";
import MultiImageUploader from "@/components/shared/MultiImageUploader";
import ManageTimeSlots from "@/components/services/ManageTimeSlots";

// Extended schema for client-side validation
const editServiceSchema = z.object({
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

export default function EditServicePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Check if verification is needed immediately based on user profile
  const [verificationRequired, setVerificationRequired] = useState(
    user?.kvkVerificationStatus !== 'verified'
  );
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    user?.kvkVerificationStatus || null
  );
  
  
  // Fetch service data
  const { data: service, isLoading, error } = useQuery<Service>({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/services/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }
      return response.json();
    },
  });
  
  // Update verification status when user data changes
  useEffect(() => {
    if (user) {
      setVerificationRequired(user.kvkVerificationStatus !== 'verified');
      setVerificationStatus(user.kvkVerificationStatus || null);
    }
  }, [user]);
  
  const form = useForm<z.infer<typeof editServiceSchema>>({
    resolver: zodResolver(editServiceSchema),
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
  
  // Update form values when service data is loaded
  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        type: service.type as ServiceType,
        category: service.category as ServiceCategory,
        skillLevel: service.skillLevel as SkillLevel,
        description: service.description,
        price: service.price?.toString() || "",
        duration: service.duration?.toString() || "60",
        maxParticipants: service.maxParticipants?.toString() || "",
        location: service.location || "",
        isRemote: service.isRemote || false,
        requirements: service.requirements || "",
        images: service.images || [],
      });
    }
  }, [service, form]);
  
  const updateServiceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editServiceSchema>) => {
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
      
      // Explicitly include userId in the request to ensure proper authorization
      const userId = user?.id || localStorage.getItem('userId');
      const userRole = user?.role;
      
      // Use a manual fetch call with explicit headers and URL params
      try {
        const response = await fetch(`/api/services/${id}?userId=${userId}&userRole=${userRole}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': userId?.toString() || '',
            'X-User-Role': userRole || ''
          },
          credentials: 'include',
          body: JSON.stringify(serviceData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Service update failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Service update failed: ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Service update error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Service updated",
        description: "Your service has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: [`/api/services/${id}`] });
      navigate("/services/my-services");
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
            description: "Please add your KVK number in your profile to update services. Our verification system is in fallback mode due to API issues.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Business verification required",
            description: "You need to verify your business information before updating services.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error updating service",
          description: "There was an error updating your service. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  function onSubmit(data: z.infer<typeof editServiceSchema>) {
    setIsSubmitting(true);
    updateServiceMutation.mutate(data);
  }

  // Redirect to login if not authenticated
  if (!user) {
    navigate("/auth");
    return null;
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Show error state
  if (error || !service) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Service Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The service you're trying to edit doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate("/services/my-services")}>
          Back to My Services
        </Button>
      </div>
    );
  }
  
  // Check if user has permission to edit this service
  const canEdit = user && (user.role === 'admin' || user.id === service.providerId);
  
  if (!canEdit) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Permission Denied</h1>
        <p className="text-muted-foreground mb-6">
          You don't have permission to edit this service.
        </p>
        <Button onClick={() => navigate("/services")}>
          Back to Services
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/services/my-services")} 
        className="mb-6 flex items-center gap-2"
      >
        <ChevronLeft size={16} />
        <span>Back to My Services</span>
      </Button>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Service</h1>
          <p className="text-muted-foreground mt-2">Update your service details</p>
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
                  description: "Your business is now verified. You can update services.",
                });
              }}
            />
          </div>
        )}

        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details">Service Details</TabsTrigger>
            <TabsTrigger value="availability">Time Slots & Availability</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Service Details</CardTitle>
                <CardDescription>
                  Update the information about the service you're offering
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
                            <SelectItem value={ServiceType.TECHNICAL}>Technical Service</SelectItem>
                            <SelectItem value={ServiceType.CREATIVE_SERVICE}>Creative Service</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the type of service you're offering
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
                          Indicate what skill level this service is appropriate for
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide a detailed description of your service..."
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Describe what participants can expect, what they will learn or experience
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
                          <Input placeholder="e.g., 50" {...field} />
                        </FormControl>
                        <FormDescription>
                          Price per session/booking
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
                          <Input placeholder="e.g., 60" {...field} />
                        </FormControl>
                        <FormDescription>
                          How long each session lasts
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
                        <FormLabel>Max Participants</FormLabel>
                        <FormControl>
                          <Input placeholder="Leave empty if no limit" {...field} />
                        </FormControl>
                        <FormDescription>
                          Maximum number of participants
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <div className="flex items-center space-x-2">
                          <FormControl>
                            <div className="flex-1 relative">
                              <Input placeholder="e.g., Amsterdam, Netherlands" {...field} />
                              <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                          </FormControl>
                        </div>
                        <FormDescription>
                          Where the service will take place
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isRemote"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Remote Service</FormLabel>
                          <FormDescription>
                            Toggle if this service can be delivered remotely
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
                </div>

                <Separator />

                <FormField
                  control={form.control}
                  name="requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirements</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="List any requirements or things participants should bring..."
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Specify any requirements, prerequisites, or items participants should bring
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate("/services/my-services")}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                        Updating...
                      </>
                    ) : (
                      'Update Service'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
          </TabsContent>
          
          <TabsContent value="availability">
            <Card>
              <CardHeader>
                <CardTitle>Time Slots & Availability</CardTitle>
                <CardDescription>
                  Manage specific dates and times when your service is available for booking
                </CardDescription>
              </CardHeader>
              <CardContent>
                {service ? (
                  <ManageTimeSlots serviceId={service.id} />
                ) : (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Loading service data...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}