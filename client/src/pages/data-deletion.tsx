import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Form schema
const deletionRequestSchema = z.object({
  reason: z.string().min(1, "Please select a reason"),
  additionalInfo: z.string().optional(),
  confirmDelete: z.boolean().refine(val => val === true, {
    message: "You must confirm that you understand the consequences",
  })
});

type DeletionRequestFormValues = z.infer<typeof deletionRequestSchema>;

export default function DataDeletionPage() {
  const [requestHistory, setRequestHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formData, setFormData] = useState<DeletionRequestFormValues | null>(null);
  const { toast } = useToast();

  const form = useForm<DeletionRequestFormValues>({
    resolver: zodResolver(deletionRequestSchema),
    defaultValues: {
      reason: "",
      additionalInfo: "",
      confirmDelete: false,
    },
  });

  useEffect(() => {
    const fetchRequestHistory = async () => {
      setIsLoading(true);
      try {
        // Fixed apiRequest format to use object notation
        const response = await apiRequest({
          url: "/api/legal/data-deletion-requests",
          method: "GET",
          data: undefined
        });
        
        const data = await response.json();
        setRequestHistory(data);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch data deletion request history:", error);
        setRequestHistory([]);
        setIsLoading(false);
      }
    };

    fetchRequestHistory();
  }, []);

  // Handle form submission - Now just opens the confirmation dialog
  const onSubmit = (data: DeletionRequestFormValues) => {
    setFormData(data);
    setShowConfirmDialog(true);
  };

  // When user confirms in the dialog, this processes the actual submission
  const handleConfirmedSubmit = async () => {
    if (!formData) return;
    
    try {
      // Fixed apiRequest format to use object notation
      const response = await apiRequest({
        url: "/api/legal/request-data-deletion",
        method: "POST",
        data: {
          reason: formData.reason,
          additionalNotes: formData.additionalInfo,
        }
      });
      
      const responseData = await response.json();
      
      toast({
        title: "Request Submitted",
        description: "Your data deletion request has been submitted successfully.",
      });
      
      // Add the new request to the history
      setRequestHistory([responseData, ...requestHistory]);
      
      // Reset the form and dialog state
      form.reset();
      setFormData(null);
      setShowConfirmDialog(false);
    } catch (error) {
      console.error("Failed to submit data deletion request:", error);
      
      toast({
        title: "Error",
        description: "Failed to submit your request. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Helper to display status icons
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  // Helper to get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending Review";
      case "approved":
        return "Approved - Data Will Be Deleted";
      case "rejected":
        return "Rejected - See Admin Notes";
      case "completed":
        return "Completed - Data Deleted";
      default:
        return "Unknown Status";
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Data Deletion Request</CardTitle>
          <CardDescription>
            Request the deletion of your personal data in accordance with data protection regulations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose dark:prose-invert max-w-none mb-6">
            <p>
              You have the right to request the deletion of your personal data. Please note that:
            </p>
            <ul>
              <li>Deletion of your data is permanent and cannot be undone.</li>
              <li>Your account will be deactivated and you will lose access to the platform.</li>
              <li>Content you've created may remain available if it has been shared with others.</li>
              <li>We may retain certain information for legal or legitimate business purposes.</li>
              <li>The review process typically takes 7-14 business days.</li>
            </ul>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Reason for Data Deletion</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="no_longer_use" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            I no longer use Urban Culture
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="privacy_concerns" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            I have privacy concerns
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="personal_choice" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Personal choice
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="other" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Other reason
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Information (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide any additional context for your request..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This helps us better understand your request and may expedite the review process.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmDelete"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        I understand that this action is permanent and cannot be undone
                      </FormLabel>
                      <FormDescription>
                        By checking this box, you confirm that you want to proceed with the data deletion request.
                      </FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Submit Data Deletion Request
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {requestHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Request History</CardTitle>
            <CardDescription>
              Previous data deletion requests you have submitted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col space-y-3">
                <div className="h-6 w-3/4 bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {requestHistory.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(request.status)}
                        <span className="font-medium">{getStatusText(request.status)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Submitted: {format(new Date(request.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    
                    <Accordion type="single" collapsible>
                      <AccordionItem value={`request-${request.id}`}>
                        <AccordionTrigger>Request Details</AccordionTrigger>
                        <AccordionContent>
                          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Reason:</dt>
                              <dd className="text-sm">{request.reason}</dd>
                            </div>
                            
                            {request.additionalNotes && (
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-muted-foreground">Additional Notes:</dt>
                                <dd className="text-sm">{request.additionalNotes}</dd>
                              </div>
                            )}
                            
                            {request.status === "approved" && (
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-muted-foreground">Scheduled Deletion Date:</dt>
                                <dd className="text-sm">
                                  {request.scheduledDeletionDate
                                    ? format(new Date(request.scheduledDeletionDate), "MMMM d, yyyy")
                                    : "To be determined"}
                                </dd>
                              </div>
                            )}
                            
                            {request.status === "rejected" && request.adminNotes && (
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-muted-foreground">Admin Response:</dt>
                                <dd className="text-sm">{request.adminNotes}</dd>
                              </div>
                            )}
                            
                            {request.reviewedAt && (
                              <div>
                                <dt className="text-sm font-medium text-muted-foreground">Reviewed On:</dt>
                                <dd className="text-sm">{format(new Date(request.reviewedAt), "MMMM d, yyyy")}</dd>
                              </div>
                            )}
                          </dl>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => window.history.back()} className="ml-auto">
              Go back
            </Button>
          </CardFooter>
        </Card>
      )}

      {requestHistory.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <p className="text-muted-foreground">You don't have any data deletion requests yet.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => window.history.back()} className="ml-auto">
              Go back
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Deletion Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure you want to request deletion of your account data? 
              This action cannot be undone and your account will be permanently deleted 
              after the request is approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedSubmit}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Submit Deletion Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}