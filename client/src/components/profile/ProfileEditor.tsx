import { useState, useEffect, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, KvkVerificationStatus } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { FileUpload } from "@/components/ui/file-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, AlertCircle, Clock, MapPin, Building, RefreshCw } from "lucide-react";
import { searchAddress, NominatimResult } from "@/lib/nominatim";
import AIBioWriter from "@/components/ai/AIBioWriter";

interface ProfileEditorProps {
  user: User;
}

const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().optional(),
  location: z.string().optional(),
  artType: z.string().optional(),
  profilePicture: z.string().optional(),
  organizationName: z.string().optional(),
  kvkNumber: z.string().optional(),
  btwNumber: z.string().optional(), // VAT number
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileEditor({ user }: ProfileEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  const [locationInput, setLocationInput] = useState(user.location || "");
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
    const display = result.display_name.split(",").slice(0, 3).join(", ");
    setLocationInput(display);
    form.setValue("location", display);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user.displayName || "",
      bio: user.bio || "",
      location: user.location || "",
      artType: user.artType || "",
      profilePicture: user.profilePicture || "",
      organizationName: user.organizationName || "",
      kvkNumber: user.kvkNumber || "",
      btwNumber: user.btwNumber || "",
    },
  });
  
  // KVK verification
  const [verifyingKvk, setVerifyingKvk] = useState(false);
  const [testingKvk, setTestingKvk] = useState(false);
  const [kvkTestResult, setKvkTestResult] = useState<{
    isValid: boolean;
    message?: string;
    businessName?: string;
    vatNumber?: string;
  } | null>(null);
  
  // Direct KVK test without saving to user profile
  const testKvkMutation = useMutation({
    mutationFn: async (kvkData: { kvkNumber: string; companyName?: string; btwNumber?: string }) => {
      const response = await apiRequest(`/api/kvk/verify`, "POST", kvkData);
      return response.json();
    },
    onSuccess: (data) => {
      setKvkTestResult({
        isValid: data.isValid,
        message: data.errorMessage,
        businessName: data.businessName,
        vatNumber: data.vat
      });
      if (data.isValid) {
        toast({
          title: "KVK Number Valid",
          description: `Successfully verified ${data.businessName}`,
        });
        
        // Auto-fill organization name if it's empty or different
        if (!form.getValues("organizationName") || 
            (data.businessName && form.getValues("organizationName") !== data.businessName)) {
          form.setValue("organizationName", data.businessName);
        }
        
        // Auto-fill BTW number if it's empty
        if (data.vat && !form.getValues("btwNumber")) {
          form.setValue("btwNumber", data.vat);
        }
      } else {
        toast({
          title: "KVK Number Invalid",
          description: data.errorMessage || "Could not verify KVK number",
          variant: "destructive",
        });
      }
      setTestingKvk(false);
    },
    onError: (error: any) => {
      setKvkTestResult({
        isValid: false,
        message: error.message || "Error testing KVK number"
      });
      toast({
        title: "KVK verification failed",
        description: error.message || "Could not verify KVK number",
        variant: "destructive",
      });
      setTestingKvk(false);
    },
  });
  
  // Official KVK verification that updates user profile
  const verifyKvkMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest(`/api/users/${userId}/verify-kvk`, "POST", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
      // Update the user in AuthContext
      setUser({
        ...user,
        ...data,
      });
      toast({
        title: "Verification successful",
        description: "Your business information has been verified",
      });
      setVerifyingKvk(false);
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Could not verify business information",
        variant: "destructive",
      });
      setVerifyingKvk(false);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const response = await apiRequest(`/api/users/${user.id}`, "PATCH", values);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
      // Update the user in AuthContext
      setUser({
        ...user,
        ...data,
      });
      setIsOpen(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update profile",
        description: error.message || "Could not update your profile",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: ProfileFormValues) {
    updateProfileMutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="absolute top-4 left-4 bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
            />
          </svg>
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information to personalize your account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="City, Country" 
                        value={locationInput}
                        onChange={(e) => handleLocationSearch(e.target.value)}
                        onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                        onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                        className="pr-10"
                        data-testid="input-location"
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
                  
                  <FormDescription>Where you're based or active</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell us about yourself"
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>A short bio about you and your work</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AIBioWriter
              currentBio={form.getValues("bio")}
              onApply={(bio) => form.setValue("bio", bio, { shouldValidate: true, shouldDirty: true })}
            />
            {user.role === 'artist' && (
              <FormField
                control={form.control}
                name="artType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Art Type</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="E.g., Graffiti, Dance, Music" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>What type of art do you create?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="profilePicture"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Picture</FormLabel>
                  <div className="space-y-4">
                    {field.value && (
                      <div className="flex items-center space-x-4">
                        <Avatar className="w-16 h-16 border-2 border-primary">
                          <AvatarImage src={field.value} alt={form.getValues("displayName") || "User"} />
                          <AvatarFallback className="text-lg bg-primary/10 text-primary">
                            {form.getValues("displayName")?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <p className="text-sm font-medium">Current Image</p>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="mt-1 h-7 text-xs"
                            onClick={() => field.onChange("")}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <FileUpload
                      folder="profiles"
                      label="Upload New Image"
                      buttonText="Choose Image"
                      onUploadComplete={(url) => field.onChange(url)}
                    />
                  </div>
                  <FormDescription>
                    Upload a profile picture to personalize your account
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Business Verification Section */}
            {(user.role === 'business' || user.role === 'provider') && (
              <>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Business Verification</h3>
                    {user.kvkVerificationStatus && (
                      <Badge 
                        className={
                          user.kvkVerificationStatus === KvkVerificationStatus.VERIFIED 
                            ? "bg-green-100 text-green-800 hover:bg-green-200" 
                            : user.kvkVerificationStatus === KvkVerificationStatus.REJECTED
                            ? "bg-red-100 text-red-800 hover:bg-red-200"
                            : user.kvkVerificationStatus === KvkVerificationStatus.PENDING
                            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }
                      >
                        {user.kvkVerificationStatus === KvkVerificationStatus.VERIFIED && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {user.kvkVerificationStatus === KvkVerificationStatus.REJECTED && (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {user.kvkVerificationStatus === KvkVerificationStatus.PENDING && (
                          <Clock className="h-3 w-3 mr-1" />
                        )}
                        {user.kvkVerificationStatus}
                      </Badge>
                    )}
                  </div>
                  
                  {user.kvkVerificationStatus === KvkVerificationStatus.REJECTED && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Verification Failed</AlertTitle>
                      <AlertDescription>
                        We couldn't verify your business information. Please check the details and try again.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="organizationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="Your registered business name" 
                              {...field} 
                              className="pr-10"
                            />
                            <Building className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                          </div>
                        </FormControl>
                        <FormDescription>Your official registered business name</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="kvkNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>KVK Number</FormLabel>
                          <div className="flex space-x-2">
                            <FormControl className="flex-1">
                              <Input 
                                placeholder="8-digit KVK number" 
                                {...field} 
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-w-[80px]"
                              disabled={!field.value || testingKvk}
                              onClick={() => {
                                setTestingKvk(true);
                                setKvkTestResult(null);
                                testKvkMutation.mutate({
                                  kvkNumber: field.value,
                                  companyName: form.getValues("organizationName"),
                                  btwNumber: form.getValues("btwNumber")
                                });
                              }}
                            >
                              {testingKvk ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                'Test'
                              )}
                            </Button>
                          </div>
                          <FormDescription>Your Chamber of Commerce number</FormDescription>
                          {kvkTestResult && (
                            <div className={`mt-2 text-sm ${kvkTestResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                              {kvkTestResult.isValid ? (
                                <span className="flex items-center">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Valid KVK number for {kvkTestResult.businessName}
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {kvkTestResult.message || "Invalid KVK number"}
                                </span>
                              )}
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="btwNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>BTW Number</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="VAT number (optional)" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Your VAT registration number</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={
                      verifyingKvk || 
                      !form.getValues("kvkNumber") || 
                      !form.getValues("organizationName") ||
                      user.kvkVerificationStatus === KvkVerificationStatus.VERIFIED
                    }
                    onClick={() => {
                      setVerifyingKvk(true);
                      onSubmit(form.getValues()); // First save the form
                      // Then verify after a short delay to make sure the saved data is used
                      setTimeout(() => {
                        verifyKvkMutation.mutate(user.id);
                      }, 500);
                    }}
                  >
                    {verifyKvkMutation.isPending || verifyingKvk ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : user.kvkVerificationStatus === KvkVerificationStatus.VERIFIED ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Verified
                      </>
                    ) : (
                      'Verify Business Information'
                    )}
                  </Button>
                </div>
              </>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}