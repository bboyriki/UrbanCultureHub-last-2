import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Service, ServiceBooking, ServiceReview, User, insertServiceBookingSchema, insertServiceReviewSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ChevronLeft, 
  MapPin, 
  Star, 
  Clock, 
  Users, 
  DollarSign, 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  Loader2, 
  CreditCard, 
  AlertCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Bell
} from "lucide-react";
import NotificationBadge from "@/components/badges/NotificationBadge";
import NotificationBadgeWrapper from "@/components/badges/NotificationBadgeWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BookingPayment } from "@/components/services/BookingPayment";
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import StripeWrapper from '@/components/events/StripeWrapper';
import MultiImageUploader from '@/components/shared/MultiImageUploader';
import TimeSlotSelector from '@/components/services/TimeSlotSelector';
import { ReviewerNameDisplay } from '@/components/services/ReviewerNameDisplay';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, getToken } = useAuth();
  const { toast } = useToast();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const serviceId = parseInt(id);
  
  // Debug user information
  useEffect(() => {
    console.log("Current user:", user);
    console.log("User role:", user?.role);
    console.log("Is admin?", user?.role === 'admin');
  }, [user]);

  const { data: service, isLoading } = useQuery<Service>({
    queryKey: [`/api/services/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/services/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch service");
      }
      return response.json();
    },
  });

  const { data: availability, isLoading: isLoadingAvailability } = useQuery({
    queryKey: [`/api/services/${id}/availability`],
    queryFn: async () => {
      const response = await fetch(`/api/services/${id}/availability`);
      if (!response.ok) {
        throw new Error("Failed to fetch availability");
      }
      return response.json();
    },
    enabled: !!service,
  });

  const { data: reviews, isLoading: isLoadingReviews } = useQuery<ServiceReview[]>({
    queryKey: ["/api/service-reviews", { serviceId }],
    queryFn: async () => {
      const response = await fetch(`/api/service-reviews?serviceId=${serviceId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch reviews");
      }
      return response.json();
    },
    enabled: !!serviceId,
  });

  const goBack = () => {
    navigate("/services");
  };

  if (isLoading) {
    return <ServiceDetailSkeleton />;
  }

  if (!service) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Service Not Found</h1>
        <p className="text-muted-foreground mb-6">The service you're looking for doesn't exist or has been removed.</p>
        <Button onClick={goBack}>Go Back to Services</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={goBack} className="flex items-center gap-2">
          <ChevronLeft size={16} />
          <span>Back to Services</span>
        </Button>
        
        {/* Service Booking Notifications Badge */}
        <div className="relative">
          <Button variant="ghost" className="relative" onClick={() => window.location.href = '/notifications'}>
            <Bell className="h-5 w-5" />
            <NotificationBadgeWrapper section="service" className="top-0 right-0" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge>{service.category}</Badge>
                  <Badge variant="outline">{service.type}</Badge>
                  {service.skillLevel && (
                    <Badge variant="secondary">{service.skillLevel}</Badge>
                  )}
                  {service.isVerified && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Check size={12} />
                      <span>Verified</span>
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                  <div className="text-3xl font-bold">{formatPrice(parseInt(service.price))}</div>
                  <p className="text-muted-foreground text-sm">per booking</p>
                </div>
                {user && (user.id === service.providerId || user.role === 'admin') && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/services/${service.id}/manage`)}
                      className="flex items-center gap-1"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Manage Bookings</span>
                    </Button>
                    
                    {/* Admin controls - Modified for all roles to see */}
                    <div className="flex flex-row gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/services/edit/${service.id}`)}
                        className="flex items-center gap-1"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Edit Service</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
                            try {
                              // Get the auth token - this is a Firebase token
                              const token = await getToken?.() || '';
                              
                              if (!token) {
                                console.error("No authentication token available");
                                toast({
                                  title: "Authentication Error",
                                  description: "Please log in again to perform this action.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              console.log("Attempting to delete service with token:", token ? "Token available" : "No token");
                              
                              // Add user information in the request body as a fallback
                              // This ensures admin roles are properly sent to the server
                              const isAdmin = user?.role === 'admin';
                              console.log("User role for service deletion:", {
                                userId: user?.id,
                                userRole: user?.role,
                                isAdmin,
                                serviceProviderId: service.providerId
                              });
                              
                              const requestBody = {
                                userId: user?.id,
                                userRole: user?.role,
                                isAdmin: isAdmin
                              };
                              
                              // Send request with auth headers
                              const response = await fetch(`/api/services/${service.id}`, {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(requestBody)
                              });
                              
                              console.log("Delete service response status:", response.status);
                              
                              if (response.ok) {
                                toast({
                                  title: "Service deleted",
                                  description: "The service has been deactivated successfully.",
                                });
                                navigate("/services");
                              } else {
                                // Try to get detailed error message
                                let errorMessage = "Failed to delete the service.";
                                let errorDetails;
                                
                                try {
                                  const errorData = await response.json();
                                  console.error("Service deletion error details:", errorData);
                                  errorMessage = errorData.error || errorData.message || errorMessage;
                                  errorDetails = errorData.details;
                                } catch (e) {
                                  // If can't parse JSON, use response status text
                                  errorMessage = `Failed to delete service: ${response.statusText}`;
                                }
                                
                                // Show error toast with more details for debugging
                                toast({
                                  title: "Error",
                                  description: errorMessage,
                                  variant: "destructive",
                                });
                                
                                // Log additional details for debugging
                                if (errorDetails) {
                                  console.error("Error details:", errorDetails);
                                }
                              }
                            } catch (error) {
                              console.error("Error deleting service:", error);
                              toast({
                                title: "Error",
                                description: "Failed to delete the service. Please try again.",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {service.images && service.images.length > 0 && (
              <div className="rounded-lg overflow-hidden aspect-video relative">
                <img 
                  src={service.images[0]} 
                  alt={service.name} 
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="py-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Duration</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <p>{service.duration} minutes</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Capacity</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <p>{service.maxParticipants || "Unlimited"} participants</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Skill Level</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <p>{service.skillLevel || "All Levels"}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Location</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <p>{service.location || (service.isRemote ? "Remote / Online" : "Not specified")}</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">Description</h2>
              <p className="text-muted-foreground whitespace-pre-line">{service.description}</p>
            </div>

            {service.requirements && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Requirements</h2>
                <p className="text-muted-foreground whitespace-pre-line">{service.requirements}</p>
              </div>
            )}

            <Separator />

            <Tabs defaultValue="reviews" className="w-full">
              <TabsList>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="availability">Availability</TabsTrigger>
              </TabsList>
              <TabsContent value="reviews" className="pt-4">
                <ReviewSection 
                  reviews={reviews || []} 
                  isLoading={isLoadingReviews} 
                  serviceId={serviceId}
                  providerId={service.providerId}
                />
              </TabsContent>
              <TabsContent value="availability" className="pt-4">
                <AvailabilitySection 
                  availability={availability || []}
                  isLoading={isLoadingAvailability}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Book this Service</CardTitle>
              <CardDescription>
                Complete your booking request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Price</span>
                <span className="font-medium">{formatPrice(parseInt(service.price))}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{service.duration} minutes</span>
              </div>
              {service.location && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{service.location}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              {user ? (
                <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">Book Now</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px] md:max-w-[650px] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 border-b">
                      <DialogTitle className="text-xl">Book {service.name}</DialogTitle>
                      <DialogDescription className="text-base">
                        Fill out the details to request this service
                      </DialogDescription>
                    </DialogHeader>
                    <div className="px-3 py-4 sm:px-6 sm:py-5 overflow-y-auto max-h-[80vh]">
                      <BookingForm 
                        service={service} 
                        onSuccess={() => setBookingDialogOpen(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button className="w-full" onClick={() => navigate("/auth")}>
                  Sign in to Book
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ServiceDetailSkeleton() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <Skeleton className="h-10 w-64 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-32" />
            </div>

            <Skeleton className="h-64 w-full rounded-lg" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>

            <div>
              <Skeleton className="h-8 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>

        <div>
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ reviews, isLoading, serviceId, providerId }: { 
  reviews: ServiceReview[],
  isLoading: boolean,
  serviceId: number,
  providerId: number
}) {
  const { user } = useAuth();
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [userCompletedBookings, setUserCompletedBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // Fetch user's completed bookings for this service
  useEffect(() => {
    if (user?.id && serviceId) {
      setLoadingBookings(true);
      fetch(`/api/service-bookings?userId=${user.id}&serviceId=${serviceId}&status=completed`)
        .then(response => response.json())
        .then(data => {
          setUserCompletedBookings(data);
          setLoadingBookings(false);
        })
        .catch(error => {
          console.error("Error fetching user bookings:", error);
          setLoadingBookings(false);
        });
    }
  }, [user, serviceId]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  const hasUserBookedService = userCompletedBookings.length > 0;
  
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold">Customer Reviews</h3>
          <p className="text-muted-foreground">{reviews.length} reviews</p>
        </div>
        
        {user && user.id !== providerId && hasUserBookedService && (
          <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Write a Review</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Write a Review</DialogTitle>
                <DialogDescription>
                  Share your experience with this service
                </DialogDescription>
              </DialogHeader>
              <ReviewForm 
                serviceId={serviceId}
                providerId={providerId}
                onSuccess={() => setIsReviewDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No reviews yet. Be the first to leave a review!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">
                      <ReviewerNameDisplay reviewerId={review.reviewerId} />
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(review.createdAt), "MMMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star 
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{review.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AvailabilitySection({ availability, isLoading }: {
  availability: any[],
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (!availability || availability.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No availability information. Please contact the service provider.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Available Time Slots</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availability.map((slot) => (
          <Card key={slot.id}>
            <CardHeader className="py-4">
              <CardTitle className="text-base">
                {format(new Date(slot.startTime), "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <CardDescription>
                {format(new Date(slot.startTime), "h:mm a")} - {format(new Date(slot.endTime), "h:mm a")}
              </CardDescription>
            </CardHeader>
            {slot.notes && (
              <CardContent className="py-2">
                <p className="text-sm text-muted-foreground">{slot.notes}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function BookingForm({ service, onSuccess }: { 
  service: Service, 
  onSuccess: () => void 
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const bookingSchema = z.object({
    timeSlotId: z.number({
      required_error: "Please select a time slot"
    }),
    participants: z.string().transform(val => parseInt(val))
      .refine(val => !isNaN(val), "Must be a number")
      .refine(val => val > 0, "Must be at least 1")
      .refine(
        val => !service.maxParticipants || val <= service.maxParticipants, 
        `Cannot exceed ${service.maxParticipants} participants`
      ),
    message: z.string().optional(),
    // Images field removed as it's been removed from the schema
  });
  
  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      timeSlotId: undefined,
      participants: "1",
      message: "",
      // Images field removed
    },
  });
  
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<any>(null);
  
  // Create the intent for direct payment
  const createPaymentIntentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bookingSchema>) => {
      if (!user?.id) {
        throw new Error("User must be logged in to create a booking");
      }
      
      // Log data for debugging
      console.log("Creating payment intent with data:", data);
      
      // Fetch time slot data
      console.log("Fetching time slot with ID:", data.timeSlotId);
      const response = await fetch(`/api/service-time-slots/${data.timeSlotId}`);
      
      if (!response.ok) {
        console.error("Failed to fetch time slot. Status:", response.status);
        // Try fallback endpoint if needed
        const fallbackResponse = await fetch(`/api/service-timeslots/${data.timeSlotId}`);
        
        if (!fallbackResponse.ok) {
          console.error("Failed to fetch time slot from fallback endpoint. Status:", fallbackResponse.status);
          throw new Error('Failed to fetch time slot information. Please try again.');
        }
        
        console.log("Using fallback time slot endpoint successfully");
        const timeSlot = await fallbackResponse.json();
        console.log("Retrieved time slot:", timeSlot);
      }
      
      const timeSlot = await response.json();
      console.log("Retrieved time slot:", timeSlot);
      
      const startTime = new Date(timeSlot.startTime);
      const endTime = new Date(timeSlot.endTime);
      
      // Calculate total price based on participants
      const totalPrice = (parseInt(service.price) * data.participants).toString();
      console.log("Calculated total price:", totalPrice);
      
      const bookingDetails = {
        userId: user.id,
        providerId: service.providerId,
        serviceId: service.id,
        timeSlotId: data.timeSlotId, // Important: include the timeSlotId
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        participants: data.participants,
        message: data.message || "",
        totalPrice: totalPrice,
        location: service.location || "",
      };
      
      console.log("Created booking details:", bookingDetails);
      
      // Save booking data for later use (needed for iDEAL redirects)
      setBookingData(bookingDetails);
      
      // Store booking data in localStorage for iDEAL flow
      localStorage.setItem('pendingBookingData', JSON.stringify({
        bookingData: bookingDetails,
        timestamp: Date.now(),
        serviceId: service.id,
        paymentMethod: 'ideal',
        paymentMetadata: {
          paymentType: 'iDEAL',
          timeSlotId: data.timeSlotId.toString()
        }
      }));
      
      // Set iDEAL backup flags
      localStorage.setItem('idealPaymentPending', 'true');
      localStorage.setItem('idealPaymentTimestamp', Date.now().toString());
      
      console.log("Saved pending booking data to localStorage for iDEAL flow");
      
      // Create a payment intent directly with better error handling
      try {
        console.log("Sending payment intent creation request with amount:", parseInt(totalPrice) * 100);
        
        const paymentResponse = await fetch('/api/service-bookings/direct-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serviceId: service.id,
            amount: parseInt(totalPrice) * 100, // Convert to cents
            metadata: {
              userId: user.id.toString(),
              providerId: service.providerId.toString(),
              participants: data.participants.toString(),
              timeSlotId: data.timeSlotId.toString(),
              serviceName: service.name
            }
          })
        });
        
        if (!paymentResponse.ok) {
          const errorText = await paymentResponse.text();
          console.error("Payment intent creation failed. Status:", paymentResponse.status, "Error:", errorText);
          
          let errorMessage = "Failed to create payment intent";
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // Use the raw text if not valid JSON
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        const paymentData = await paymentResponse.json();
        console.log("Payment intent created successfully:", paymentData);
        
        // Store payment intent ID for iDEAL flow
        if (paymentData.clientSecret) {
          // Extract payment intent ID from client secret (format: pi_XXX_secret_YYY)
          const paymentIntentId = paymentData.clientSecret.split('_secret_')[0];
          console.log("Extracted payment intent ID:", paymentIntentId);
          
          localStorage.setItem('idealPaymentIntentId', paymentIntentId);
          
          // Update the pendingBookingData with the payment intent ID
          const pendingData = JSON.parse(localStorage.getItem('pendingBookingData') || '{}');
          pendingData.paymentIntentId = paymentIntentId;
          localStorage.setItem('pendingBookingData', JSON.stringify(pendingData));
        }
        
        return paymentData;
      } catch (err: any) {
        console.error("Payment intent creation error:", err);
        throw new Error(err.message || "Failed to initialize payment. Please try again.");
      }
    },
    onSuccess: (data) => {
      if (data && data.clientSecret) {
        console.log("Setting client secret for payment form");
        setClientSecret(data.clientSecret);
      } else {
        console.error("Payment intent created but no client secret returned");
        toast({
          title: "Error",
          description: "Could not initialize payment. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      console.error("Payment intent creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  function onSubmit(data: z.infer<typeof bookingSchema>) {
    createPaymentIntentMutation.mutate(data);
  }
  
  // Handle payment success
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      if (!bookingData) {
        console.error("Booking data is missing");
        toast({
          title: "Error",
          description: "Booking information is missing. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      // Create the booking with the payment intent ID
      const response = await apiRequest('/api/service-bookings', 'POST', {
        ...bookingData,
        paymentIntentId,
        isPaid: true,
        status: 'payment_successful' // Use the payment_successful status
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create booking");
      }
      
      // Get the booking data
      const bookingResult = await response.json();
      console.log("Booking created successfully:", bookingResult);
      
      toast({
        title: "Payment successful",
        description: "Your booking has been confirmed with payment. You'll receive an email confirmation shortly.",
      });
      
      // Invalidate bookings cache to refresh booking data
      queryClient.invalidateQueries({ queryKey: ["/api/service-bookings"] });
      
      // Call success callback
      onSuccess();
      
      // Redirect to the bookings page
      window.location.href = '/bookings';
    } catch (error: any) {
      console.error("Error creating booking after payment:", error);
      toast({
        title: "Error",
        description: error.message || "Payment was successful but there was an error confirming your booking. Please contact support.",
        variant: "destructive"
      });
    }
  };

  // Handle payment error
  const handlePaymentError = (error: any) => {
    console.error("Payment error:", error);
    toast({
      title: "Payment failed",
      description: error.message || "There was an error processing your payment. Please try again.",
      variant: "destructive",
    });
    
    // Reset the client secret to allow the user to try again
    setClientSecret(null);
  };

  // If we have a client secret, show the payment component
  if (clientSecret) {
    return (
      <div className="space-y-6 max-w-full sm:max-w-2xl md:max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-semibold text-center">Complete Your Payment</h2>
        <Alert className="p-3 sm:p-4">
          <AlertDescription className="text-sm sm:text-base">
            Please complete payment to confirm your booking. Your booking will be automatically confirmed once payment is complete.
          </AlertDescription>
        </Alert>
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6">
          <StripeWrapper clientSecret={clientSecret}>
            <PaymentForm 
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </StripeWrapper>
        </div>
      </div>
    );
  }
  
  // Check if user is authenticated
  if (!user) {
    return (
      <div className="space-y-4 pt-4">
        <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You need to be logged in to book this service.
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => navigate('/auth')} 
          className="w-full"
        >
          Sign In to Book
        </Button>
      </div>
    );
  }
  
  // Otherwise show the booking form
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Service Info Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-muted-foreground mb-1">Price</p>
            <p className="font-bold text-sm sm:text-base text-primary">€{parseFloat(service.price).toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-muted-foreground mb-1">Duration</p>
            <p className="font-bold text-sm sm:text-base">{service.duration} minutes</p>
          </div>
        </div>
        
        {/* Time Slot Selector */}
        <FormField
          control={form.control}
          name="timeSlotId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Select a Time Slot</FormLabel>
              <FormControl>
                <TimeSlotSelector 
                  serviceId={service.id}
                  onSelectTimeSlot={(timeSlotId) => field.onChange(timeSlotId)}
                  selectedTimeSlotId={field.value}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Choose from available time slots
              </FormDescription>
              <FormMessage className="text-xs font-medium text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Number of Participants Field */}
        <FormField
          control={form.control}
          name="participants"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Number of Participants</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  max={service.maxParticipants || 99} 
                  className="h-10"
                  {...field} 
                />
              </FormControl>
              <FormDescription className="text-xs">
                {service.maxParticipants 
                  ? `Maximum ${service.maxParticipants} participants allowed`
                  : "Enter the number of participants"
                }
              </FormDescription>
              <FormMessage className="text-xs font-medium text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Message Field */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Message (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Any special requirements?" 
                  className="text-sm resize-none min-h-[80px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage className="text-xs font-medium text-red-500" />
            </FormItem>
          )}
        />
        
        {/* Image Upload Field removed as it's been removed from the schema */}
        
        {/* Total Price Box */}
        <div className="mt-2 p-3 bg-primary/10 rounded-md border border-primary/20">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">Total Price:</p>
              <p className="text-xs text-muted-foreground">For {form.watch("participants") || 1} participant(s)</p>
            </div>
            <div className="text-lg font-bold text-primary">
              €{(parseFloat(service.price) * parseInt(form.watch("participants") || "1")).toFixed(2)}
            </div>
          </div>
        </div>
        
        {/* Submit Button */}
        <div className="mt-4">
          <Button
            type="submit"
            className="w-full h-10 sm:h-11"
            disabled={createPaymentIntentMutation.isPending}
          >
            {createPaymentIntentMutation.isPending ? (
              <span className="flex items-center gap-1.5 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 justify-center">
                <CreditCard className="h-4 w-4" />
                Continue to Payment
              </span>
            )}
          </Button>
          <p className="text-xs text-center mt-2 text-muted-foreground">
            You will pay now to confirm your booking immediately
          </p>
        </div>
      </form>
    </Form>
  );
}

// Payment Form component for handling Stripe payments
const PaymentForm = ({ 
  clientSecret,
  onSuccess,
  onError
}: { 
  clientSecret: string,
  onSuccess: (paymentIntentId: string) => void,
  onError: (error: any) => void
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Listen for changes to the PaymentElement to detect selected payment method
  useEffect(() => {
    if (!elements) return;
    
    const paymentElement = elements.getElement('payment');
    if (!paymentElement) return;
    
    const handleChange = (event: any) => {
      if (event.value?.type) {
        console.log("Payment method changed:", event.value.type);
        setPaymentMethod(event.value.type);
      }
    };
    
    paymentElement.on('change', handleChange);
    
    // Clean up
    return () => {
      paymentElement.off('change', handleChange);
    };
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe not initialized");
      toast({
        title: "Payment System Error",
        description: "Payment system not initialized. Please refresh the page and try again.",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    
    // Save pending status for all payments in case of redirect
    localStorage.setItem('paymentPending', 'true');
    localStorage.setItem('paymentTimestamp', Date.now().toString());
    
    // Get payment intent ID from client secret (format: pi_XXX_secret_YYY)
    const paymentIntentId = clientSecret.split('_secret_')[0];
    localStorage.setItem('pendingPaymentIntentId', paymentIntentId);

    try {
      console.log("Submitting payment form with method:", paymentMethod);
      
      // First, submit the elements form to validate payment information
      const submitResult = await elements.submit();
      if (submitResult.error) {
        console.error("Error in elements.submit():", submitResult.error);
        throw submitResult.error;
      }
      
      // Check if iDEAL is selected and use specific return_url approach
      const isIdeal = paymentMethod === 'ideal';
      
      if (isIdeal) {
        console.log("Using iDEAL payment flow with redirect");
        
        // Store that we're using iDEAL specifically
        localStorage.setItem('idealPaymentPending', 'true');
        
        // For iDEAL, we need to use the redirect approach and include a return URL
        const returnUrl = `${window.location.origin}/payments/redirect?source=service-booking&method=ideal&intent=${paymentIntentId}`;
        console.log("Setting return URL for iDEAL:", returnUrl);
        
        // Then confirm the payment with the validated details
        const { error } = await stripe.confirmPayment({
          clientSecret,
          elements,
          confirmParams: {
            return_url: returnUrl,
            payment_method_data: {
              billing_details: {} // This ensures billing details are collected from the form
            },
          },
          // Force redirect for iDEAL
          redirect: "always"
        });
        
        // If we get here with iDEAL, it means the redirect didn't happen
        if (error) {
          console.error("iDEAL payment error:", error);
          throw error;
        }
        
        // We should not reach here for iDEAL since it should redirect
        console.log("iDEAL payment did not redirect as expected");
      } else {
        console.log("Using standard payment flow with optional redirect");
        
        // For credit cards, we use the normal flow with conditional redirect
        const { error, paymentIntent } = await stripe.confirmPayment({
          clientSecret,
          elements,
          confirmParams: {
            // Include return_url in case redirect is needed
            return_url: `${window.location.origin}/payments/redirect?source=service-booking&method=card&intent=${paymentIntentId}`,
            // Ensure billing details are properly collected
            payment_method_data: {
              billing_details: {} // This ensures billing details are collected from the form
            },
          },
          redirect: "if_required"
        });

        if (error) {
          console.error("Payment confirmation error:", error);
          throw error;
        }

        if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "requires_capture") {
          // For both succeeded and requires_capture, we consider it successful
          console.log(`Payment successful with status: ${paymentIntent.status}`);
          
          // Clear any pending payment flags
          localStorage.removeItem('paymentPending');
          localStorage.removeItem('pendingPaymentIntentId');
          localStorage.removeItem('paymentTimestamp');
          localStorage.removeItem('idealPaymentPending');
          
          onSuccess(paymentIntent.id);
        } else if (paymentIntent) {
          // Handle other payment intent statuses
          console.log(`Payment has status: ${paymentIntent.status}`);
          toast({
            title: "Payment Status",
            description: `Payment status: ${paymentIntent.status}. Please contact support if you see this message.`,
            variant: "warning"
          });
        } else {
          // No payment intent returned
          throw new Error("No payment information returned");
        }
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      
      // Detailed error handling
      let errorMessage = "An unexpected error occurred";
      let errorTitle = "Payment Error";
      
      if (err.type === 'validation_error') {
        errorMessage = "Please check your payment information and try again.";
        errorTitle = "Invalid Payment Information";
      } else if (err.type === 'card_error') {
        errorMessage = err.message || "Your card was declined. Please try another payment method.";
        errorTitle = "Card Declined";
      } else if (err.code === 'incomplete_payment_details') {
        errorMessage = "Please select a payment method to pay with.";
        errorTitle = "Payment Information Required";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Clear pending payment flags on error
      localStorage.removeItem('paymentPending');
      localStorage.removeItem('pendingPaymentIntentId');
      localStorage.removeItem('paymentTimestamp');
      localStorage.removeItem('idealPaymentPending');
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
      
      onError(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full mx-auto">
      <Alert className="bg-primary/10 border-primary/20 p-3">
        <div className="flex items-start gap-2">
          <CreditCard className="h-4 w-4 mt-0.5 text-primary" />
          <AlertDescription className="text-xs sm:text-sm">
            Complete your payment information to confirm your booking
          </AlertDescription>
        </div>
      </Alert>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 className="text-sm font-medium mb-3 text-foreground">Payment Details</h3>
          <PaymentElement />
        </div>
        
        {paymentMethod === 'ideal' && (
          <Alert variant="info" className="bg-blue-50 border-blue-200 p-3">
            <AlertTitle className="text-sm font-medium">iDEAL Payment Selected</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              You will be redirected to your bank's website to complete payment. After payment, you'll return to this site to complete your booking.
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-10 sm:h-11"
          disabled={!stripe || processing}
        >
          {processing ? (
            <span className="flex items-center gap-1.5 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing Payment...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 justify-center">
              <CreditCard className="h-4 w-4" />
              {paymentMethod === 'ideal' ? 'Pay with iDEAL' : 'Complete Payment'}
            </span>
          )}
        </Button>
        
        <p className="text-center text-xs text-muted-foreground">
          Your payment is secured by Stripe with 256-bit SSL encryption
        </p>
      </form>
    </div>
  );
};

function ReviewForm({ serviceId, providerId, onSuccess }: {
  serviceId: number,
  providerId: number,
  onSuccess: () => void
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  
  // Fetch the user's bookings for this service to get a valid bookingId
  useEffect(() => {
    if (user?.id && serviceId) {
      const fetchUserBookings = async () => {
        try {
          const response = await fetch(`/api/service-bookings?userId=${user.id}&serviceId=${serviceId}&status=completed`);
          if (response.ok) {
            const bookings = await response.json();
            setUserBookings(bookings);
            if (bookings.length > 0) {
              setSelectedBookingId(bookings[0].id);
            }
          }
        } catch (error) {
          console.error("Error fetching user bookings:", error);
        }
      };
      fetchUserBookings();
    }
  }, [user?.id, serviceId]);
  
  const reviewSchema = z.object({
    rating: z.string().transform(val => parseInt(val))
      .refine(val => !isNaN(val), "Please select a rating")
      .refine(val => val >= 1 && val <= 5, "Rating must be between 1 and 5"),
    content: z.string().min(10, "Review must be at least 10 characters"),
  });
  
  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: "",
      content: "",
    },
  });
  
  const reviewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof reviewSchema>) => {
      if (!selectedBookingId) {
        throw new Error("No booking selected");
      }
      
      const reviewData = {
        serviceId,
        providerId,
        reviewerId: user?.id,
        bookingId: selectedBookingId,
        rating: data.rating,
        content: data.content,
      };
      
      return await apiRequest("/api/service-reviews", "POST", reviewData);
    },
    onSuccess: () => {
      toast({
        title: "Review submitted",
        description: "Your review has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/service-reviews"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Review failed",
        description: "There was an error submitting your review. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  function onSubmit(data: z.infer<typeof reviewSchema>) {
    reviewMutation.mutate(data);
  }
  
  // Early return if no bookings found
  if (userBookings.length === 0) {
    return (
      <div className="p-4 text-center space-y-3">
        <div className="text-amber-500 mb-2">
          <AlertTriangle className="h-10 w-10 mx-auto" />
        </div>
        <h3 className="font-medium">You need a completed booking to leave a review</h3>
        <p className="text-sm text-muted-foreground">
          Book and complete this service first before writing a review.
        </p>
        <Button 
          variant="outline" 
          className="mt-2" 
          onClick={onSuccess}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {userBookings.length > 1 && (
          <div className="mb-4">
            <Label htmlFor="booking-select" className="text-sm font-medium">
              Select which booking this review is for:
            </Label>
            <Select 
              value={selectedBookingId?.toString() || ""} 
              onValueChange={(value) => setSelectedBookingId(parseInt(value))}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Select a booking" />
              </SelectTrigger>
              <SelectContent>
                {userBookings.map((booking) => (
                  <SelectItem key={booking.id} value={booking.id.toString()}>
                    Booking #{booking.id} - {new Date(booking.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Your Rating</FormLabel>
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  {...field}
                >
                  <option value="">Select rating</option>
                  <option value="5">★★★★★ (5) Excellent</option>
                  <option value="4">★★★★☆ (4) Very Good</option>
                  <option value="3">★★★☆☆ (3) Good</option>
                  <option value="2">★★☆☆☆ (2) Fair</option>
                  <option value="1">★☆☆☆☆ (1) Poor</option>
                </select>
              </FormControl>
              <FormMessage className="text-xs font-medium text-red-500" />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">Your Review</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Share your experience with this service" 
                  className="text-sm min-h-[100px] resize-none"
                  {...field} 
                />
              </FormControl>
              <FormDescription className="text-xs mt-1">
                Your review helps others know what to expect
              </FormDescription>
              <FormMessage className="text-xs font-medium text-red-500" />
            </FormItem>
          )}
        />
        
        <div className="mt-2">
          <Button
            type="submit"
            className="w-full h-10 sm:h-11"
            disabled={reviewMutation.isPending}
          >
            {reviewMutation.isPending ? (
              <span className="flex items-center gap-1.5 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 justify-center">
                <Star className="h-4 w-4" />
                Submit Review
              </span>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}