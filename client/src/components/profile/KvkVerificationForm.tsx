import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Loader2, AlertCircle, CheckCircle2, Search, Building2 } from "lucide-react";
import { CompanyCombobox } from "../ui/combobox-company";

// Define verification schema with validation
const verificationSchema = z.object({
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
  kvkNumber: z.string().min(8, "KVK number must be at least 8 digits"),
  btwNumber: z.string().optional(),
});

type VerificationFormValues = z.infer<typeof verificationSchema>;

interface KvkVerificationFormProps {
  onSuccess?: () => void;
}

export default function KvkVerificationForm({ onSuccess }: KvkVerificationFormProps) {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<{ kvkNumber: string; businessName: string } | null>(null);

  // Initialize form with default values from user
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      organizationName: user?.organizationName || "",
      kvkNumber: user?.kvkNumber || "",
      btwNumber: user?.btwNumber || "",
    },
  });

  // Handle company selection from the search dropdown
  const handleCompanySelect = (company: { kvkNumber: string; businessName: string } | null) => {
    setSelectedCompany(company);
    if (company) {
      form.setValue("organizationName", company.businessName);
      form.setValue("kvkNumber", company.kvkNumber);
    }
  };

  // Handle form submission
  const onSubmit = async (values: VerificationFormValues) => {
    if (!user) return;

    try {
      setIsSubmitting(true);

      // Skip KVK API verification and directly update user's profile
      // This allows entering business info without KVK API validation
      const response = await apiRequest(`/api/users/${user.id}`, "PATCH", {
        organizationName: values.organizationName,
        kvkNumber: values.kvkNumber,
        btwNumber: values.btwNumber || null,
        kvkVerificationStatus: "pending", // Set to pending for admin review
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update user context
        setUser({ ...user, ...updatedUser });
        
        // Invalidate user queries
        queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
        
        toast({
          title: "Information Submitted",
          description: "Your business information has been submitted and will be reviewed by our team.",
        });
        
        if (onSuccess) onSuccess();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit business information");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit business information. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the verification status badge
  const renderStatusBadge = () => {
    if (!user?.kvkVerificationStatus) return null;
    
    switch (user.kvkVerificationStatus) {
      case "verified":
        return <Badge className="bg-green-500 hover:bg-green-600">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="outline">Pending Review</Badge>;
      default:
        return null;
    }
  };

  // If the user is already verified, show a success message
  if (user?.kvkVerificationStatus === "verified") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Business Verification</CardTitle>
            {renderStatusBadge()}
          </div>
          <CardDescription className="dark:text-gray-300">
            Your business has been verified successfully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium text-green-800 dark:text-green-300">Verification Complete</h3>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                    Your business details have been verified and your profile is now marked as a verified business.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Organization Name</h3>
                <p className="mt-1">{user.organizationName}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">KVK Number</h3>
                <p className="mt-1">{user.kvkNumber}</p>
              </div>
              {user.btwNumber && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">BTW Number</h3>
                  <p className="mt-1">{user.btwNumber}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If the verification is pending, show a pending message with option to update
  if (user?.kvkVerificationStatus === "pending") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Business Verification</CardTitle>
            {renderStatusBadge()}
          </div>
          <CardDescription className="dark:text-gray-300">
            Your business verification is being reviewed by our team. You can update your information below if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium text-blue-800 dark:text-blue-300">Verification in Progress</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                    We are currently reviewing your business information. This process usually takes 1-2 business days.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Current Information</h3>
                <div className="mt-2 p-3 rounded-md bg-muted/50">
                  <div className="mb-2">
                    <span className="text-xs font-semibold">Organization Name: </span>
                    <span>{user.organizationName || "Not provided"}</span>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs font-semibold">KVK Number: </span>
                    <span>{user.kvkNumber || "Not provided"}</span>
                  </div>
                  {user.btwNumber && (
                    <div>
                      <span className="text-xs font-semibold">BTW Number: </span>
                      <span>{user.btwNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="text-sm font-medium mb-3">Update your business information</div>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="text-sm mb-2 font-medium">Enter your business information</div>
                  <div className="text-xs text-muted-foreground">KVK API connection: <span className="text-red-500 font-medium">Disconnected</span></div>
                </div>
                
                <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                    <p className="text-xs">The KVK API is currently unavailable. Please manually enter your business details below.</p>
                  </div>
                </div>
                
                {/* Hidden company search - removed but kept for compatibility */}
                <div className="hidden">
                  <CompanyCombobox
                    onSelect={handleCompanySelect}
                    placeholder="Search by company name..."
                    className="w-full"
                    value={selectedCompany?.businessName}
                    disabled={true}
                  />
                </div>
              </div>

              <div className="relative z-0 mt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="organizationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your business name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="kvkNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>KVK Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 12345678" {...field} />
                          </FormControl>
                          <FormDescription className="dark:text-gray-300">
                            Enter your KVK (Chamber of Commerce) registration number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="btwNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>BTW Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. NL123456789B01" {...field} />
                          </FormControl>
                          <FormDescription className="dark:text-gray-300">
                            Enter your VAT (BTW) number if applicable
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <CardFooter className="px-0 pt-4">
                      <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating Information...
                          </>
                        ) : (
                          "Update Verification Information"
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If the verification was rejected, show the rejection reason and allow resubmission
  if (user?.kvkVerificationStatus === "rejected") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Business Verification</CardTitle>
            {renderStatusBadge()}
          </div>
          <CardDescription className="dark:text-gray-300">
            Your business verification was not approved. Please update your information and resubmit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Verification Declined</h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    {user.kvkVerificationFailReason || "The provided business information could not be verified. Please check your details and try again."}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                <p className="text-xs">The KVK API is currently unavailable. Please manually enter your business details below.</p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kvkNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KVK Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 12345678" {...field} />
                      </FormControl>
                      <FormDescription className="dark:text-gray-300">
                        Enter your KVK (Chamber of Commerce) registration number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="btwNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BTW Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. NL123456789B01" {...field} />
                      </FormControl>
                      <FormDescription className="dark:text-gray-300">
                        Enter your VAT (BTW) number if applicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <CardFooter className="px-0 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resubmitting...
                      </>
                    ) : (
                      "Resubmit Verification"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: Show the verification form for new submissions
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Verification</CardTitle>
        <CardDescription className="dark:text-gray-300">
          Verify your business to unlock additional features and build trust with customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex">
              <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" />
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-300">Business Verification Benefits</h3>
                <ul className="text-sm text-amber-700 dark:text-amber-400 mt-1 list-disc pl-5 space-y-1">
                  <li>Display a verified badge on your profile and listings</li>
                  <li>Increase trust and credibility with customers</li>
                  <li>Unlock access to professional seller features</li>
                  <li>Gain priority in search results and recommendations</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="text-sm mb-2 font-medium">Enter your business information</div>
              <div className="text-xs text-muted-foreground">KVK API connection: <span className="text-red-500 font-medium">Disconnected</span></div>
            </div>
            
            <div className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                <p className="text-xs">The KVK API is currently unavailable. Please manually enter your business details below.</p>
              </div>
            </div>
            
            {/* Hidden company search - removed but kept for compatibility */}
            <div className="hidden">
              <CompanyCombobox
                onSelect={handleCompanySelect}
                placeholder="Search by company name..."
                className="w-full"
                value={selectedCompany?.businessName}
                disabled={true}
              />
            </div>
          </div>

          <div className="relative z-0 mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kvkNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KVK Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 12345678" {...field} />
                      </FormControl>
                      <FormDescription className="dark:text-gray-300">
                        Enter your KVK (Chamber of Commerce) registration number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="btwNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BTW Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. NL123456789B01" {...field} />
                      </FormControl>
                      <FormDescription className="dark:text-gray-300">
                        Enter your VAT (BTW) number if applicable
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <CardFooter className="px-0 pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Verification"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}