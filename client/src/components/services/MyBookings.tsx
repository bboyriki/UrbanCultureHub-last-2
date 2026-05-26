import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ServiceBooking, Service, BookingStatus } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function MyBookings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Check for success parameter in URL for payment return
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const paymentSuccess = urlParams.get('success') === 'true';
  const bookingId = urlParams.get('bookingId');
  
  // Fetch user's bookings
  const { data: bookings, isLoading } = useQuery<ServiceBooking[]>({
    queryKey: ['/api/service-bookings', { userId: user?.id }],
    queryFn: async () => {
      const response = await fetch(`/api/service-bookings?userId=${user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      return response.json();
    },
    enabled: !!user?.id,
  });
  
  // Fetch service details for each booking
  const { data: services, isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const response = await fetch('/api/services');
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }
      return response.json();
    },
    enabled: !!bookings,
  });
  
  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (data: { bookingId: number; message: string }) => {
      return await apiRequest(
        'POST',
        `/api/service-bookings/${data.bookingId}/cancel`,
        { message: data.message } // This gets mapped to adminMessage in the server
      );
    },
    onSuccess: () => {
      toast({
        title: 'Booking cancelled',
        description: 'Your booking has been cancelled successfully.',
      });
      setShowCancelDialog(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
    },
    onError: (error) => {
      console.error('Cancel booking error:', error);
      toast({
        title: 'Failed to cancel booking',
        description: 'There was an error cancelling your booking. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Filter bookings based on active tab
  const filteredBookings = bookings?.filter((booking) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return booking.status === BookingStatus.PENDING;
    if (activeTab === 'approved') return booking.status === BookingStatus.APPROVED;
    if (activeTab === 'completed') return booking.status === BookingStatus.COMPLETED;
    if (activeTab === 'cancelled') return booking.status === BookingStatus.CANCELLED;
    return true;
  });
  
  const handleCancelBooking = () => {
    if (!selectedBooking) return;
    
    cancelBookingMutation.mutate({
      bookingId: selectedBooking.id,
      message: cancelReason,
    });
  };
  
  const getServiceById = (serviceId: number) => {
    return services?.find(service => service.id === serviceId);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case BookingStatus.PENDING:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case BookingStatus.APPROVED:
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Approved</Badge>;
      case BookingStatus.COMPLETED:
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case BookingStatus.CANCELLED:
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelled</Badge>;
      case BookingStatus.REJECTED:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Button onClick={() => navigate('/services')}>Browse Services</Button>
      </div>
      
      {paymentSuccess && bookingId && (
        <Alert className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Payment Successful</AlertTitle>
          <AlertDescription>
            Your booking has been confirmed. Thank you for your payment!
          </AlertDescription>
        </Alert>
      )}
      
      {(!bookings || bookings.length === 0) ? (
        <div className="text-center py-10">
          <div className="mb-4 flex justify-center">
            <Calendar className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No bookings found</h3>
          <p className="text-muted-foreground mb-6">You haven't made any service bookings yet.</p>
          <Button onClick={() => navigate('/services')}>Browse Services</Button>
        </div>
      ) : (
        <>
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full max-w-lg">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBookings?.map((booking) => {
                  const service = getServiceById(booking.serviceId);
                  if (!service) return null;
                  
                  return (
                    <Card key={booking.id} className="overflow-hidden">
                      {service.images && service.images.length > 0 && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img
                            src={service.images[0]}
                            alt={service.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      )}
                      
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          <div>
                            <CardTitle className="text-lg">{service.name}</CardTitle>
                            <CardDescription>
                              Booked on {booking.createdAt && !isNaN(new Date(booking.createdAt).getTime()) 
                                ? format(new Date(booking.createdAt), "MMM d, yyyy") 
                                : "Unknown date"}
                            </CardDescription>
                          </div>
                          <div>{booking.status ? getStatusBadge(booking.status) : <Badge variant="outline">Unknown</Badge>}</div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3 pb-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {booking.startTime && !isNaN(new Date(booking.startTime).getTime())
                              ? format(new Date(booking.startTime), "MMM d, yyyy") 
                              : "Unknown date"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {booking.startTime && !isNaN(new Date(booking.startTime).getTime())
                              ? format(new Date(booking.startTime), "h:mm a") 
                              : "Unknown"} 
                            {" - "}
                            {booking.endTime && !isNaN(new Date(booking.endTime).getTime())
                              ? format(new Date(booking.endTime), "h:mm a") 
                              : "Unknown"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{booking.participants} {booking.participants === 1 ? 'participant' : 'participants'}</span>
                        </div>
                        
                        <div className="font-medium">
                          Total: {formatPrice(parseInt(booking.totalPrice))}
                        </div>
                        
                        {booking.message && (
                          <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                            <p className="font-medium mb-1">Your message:</p>
                            <p>{booking.message}</p>
                          </div>
                        )}
                        
                        {booking.adminMessage && (
                          <div className="text-sm border-t pt-2 mt-2">
                            <p className="font-medium mb-1">Provider message:</p>
                            <p className="text-muted-foreground">{booking.adminMessage}</p>
                          </div>
                        )}
                      </CardContent>
                      
                      <CardFooter>
                        <div className="flex w-full gap-2">
                          <Button variant="outline" asChild className="flex-1">
                            <Link href={`/services/${service.id}`}>View Service</Link>
                          </Button>
                          
                          {(booking.status === BookingStatus.PENDING || booking.status === BookingStatus.APPROVED) && (
                            <Button 
                              variant="destructive" 
                              className="flex-1"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowCancelDialog(true);
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
              
              {filteredBookings?.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">No {activeTab} bookings found.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Booking</DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel this booking? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <label className="text-sm font-medium mb-2 block">Reason for cancellation (optional)</label>
                <Textarea
                  placeholder="Please provide a reason for cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                  Keep Booking
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleCancelBooking}
                  disabled={cancelBookingMutation.isPending}
                >
                  {cancelBookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Booking"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}