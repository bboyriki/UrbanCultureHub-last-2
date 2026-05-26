import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookingStatus } from "@shared/schema";

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle, Clock, X, Calendar, User, DollarSign, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Type for service bookings returned from API with additional details
interface BookingWithDetails {
  id: number;
  userId: number;
  providerId: number;
  serviceId: number;
  startTime: string;
  endTime: string;
  participants: number;
  totalPrice: number;
  status: string;
  message: string | null;
  adminMessage: string | null;
  createdAt: string;
  updatedAt: string;
  paymentIntentId: string | null;
  isPaid: boolean;
  isRefunded: boolean;
  // Added details
  serviceDetails?: {
    id: number;
    name: string;
    description: string;
    price: number;
    duration: number;
    location: string;
    category: string;
    type: string;
  } | null;
  userDetails?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture: string;
    role: string;
  } | null;
  providerDetails?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture: string;
    role: string;
  } | null;
}

const BookingManagement = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all service bookings
  const { 
    data: bookings = [], 
    isLoading: isLoadingBookings,
    error: bookingsError 
  } = useQuery({
    queryKey: ["/api/service-bookings"],
    queryFn: async () => {
      const response = await apiRequest("/api/service-bookings", "GET");
      return await response.json();
    }
  });
  
  // Unified mutation for updating booking status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      bookingId, 
      status, 
      message 
    }: { 
      bookingId: number; 
      status: string; 
      message?: string;
    }) => {
      const response = await apiRequest(`/api/service-bookings/${bookingId}/status`, "POST", {
        status,
        message
      });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-bookings"] });
      
      // Get appropriate success message based on the status
      let title = "";
      let description = "";
      
      switch (variables.status) {
        case BookingStatus.APPROVED:
          title = "Booking Approved";
          description = "The service booking has been approved successfully.";
          break;
        case BookingStatus.REJECTED:
          title = "Booking Rejected";
          description = "The service booking has been rejected.";
          break;
        case BookingStatus.COMPLETED:
          title = "Booking Completed";
          description = "The service booking has been marked as completed.";
          break;
        case BookingStatus.CANCELLED:
          title = "Booking Cancelled";
          description = "The service booking has been cancelled.";
          break;
        default:
          title = "Status Updated";
          description = `The booking status has been updated to ${variables.status}.`;
      }
      
      toast({
        title,
        description,
        variant: "default",
      });
      
      setIsDetailsOpen(false);
      setFeedbackMessage("");
    },
    onError: (error, variables) => {
      console.error(`Error updating booking status to ${variables.status}:`, error);
      
      // Get appropriate error message based on the status
      let title = "";
      let description = "";
      
      switch (variables.status) {
        case BookingStatus.APPROVED:
          title = "Approval Failed";
          description = "There was an error approving the booking. Please try again.";
          break;
        case BookingStatus.REJECTED:
          title = "Rejection Failed";
          description = "There was an error rejecting the booking. Please try again.";
          break;
        case BookingStatus.COMPLETED:
          title = "Completion Failed";
          description = "There was an error completing the booking. Please try again.";
          break;
        case BookingStatus.CANCELLED:
          title = "Cancellation Failed";
          description = "There was an error cancelling the booking. Please try again.";
          break;
        default:
          title = "Update Failed";
          description = `There was an error updating the booking status to ${variables.status}.`;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  });
  
  const openBookingDetails = (booking: BookingWithDetails) => {
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case BookingStatus.PENDING_APPROVAL:
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case BookingStatus.APPROVED:
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="mr-1 h-3 w-3" /> Approved</Badge>;
      case BookingStatus.REJECTED:
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100"><X className="mr-1 h-3 w-3" /> Rejected</Badge>;
      case BookingStatus.COMPLETED:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case BookingStatus.CANCELLED:
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-100"><X className="mr-1 h-3 w-3" /> Cancelled</Badge>;
      case "payment_successful":
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100"><DollarSign className="mr-1 h-3 w-3" /> Payment Successful</Badge>;
      case "payment_pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><DollarSign className="mr-1 h-3 w-3" /> Payment Pending</Badge>;
      case "payment_failed":
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100"><DollarSign className="mr-1 h-3 w-3" /> Payment Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const filterBookingsByStatus = (bookings: BookingWithDetails[], status: string) => {
    if (status === "all") {
      return bookings;
    }
    return bookings.filter(booking => booking.status === status);
  };
  
  const filterBookingsBySearch = (bookings: BookingWithDetails[], searchTerm: string) => {
    if (!searchTerm.trim()) return bookings;
    
    const term = searchTerm.toLowerCase();
    return bookings.filter(booking => 
      booking.serviceDetails?.name.toLowerCase().includes(term) ||
      booking.userDetails?.displayName.toLowerCase().includes(term) ||
      booking.userDetails?.email.toLowerCase().includes(term) ||
      booking.providerDetails?.displayName.toLowerCase().includes(term) ||
      booking.serviceDetails?.location.toLowerCase().includes(term)
    );
  };
  
  const filteredBookings = filterBookingsBySearch(
    filterBookingsByStatus(bookings, activeTab), 
    searchQuery
  );
  
  // Handle booking approval
  const handleApprove = () => {
    if (selectedBooking) {
      updateStatusMutation.mutate({
        bookingId: selectedBooking.id,
        status: BookingStatus.APPROVED
      });
    }
  };
  
  // Handle booking rejection
  const handleReject = () => {
    if (selectedBooking && feedbackMessage) {
      updateStatusMutation.mutate({ 
        bookingId: selectedBooking.id,
        status: BookingStatus.REJECTED,
        message: feedbackMessage 
      });
    } else {
      toast({
        title: "Feedback Required",
        description: "Please provide a reason for rejecting this booking.",
        variant: "destructive",
      });
    }
  };
  
  // Handle booking completion
  const handleComplete = () => {
    if (selectedBooking) {
      updateStatusMutation.mutate({
        bookingId: selectedBooking.id,
        status: BookingStatus.COMPLETED
      });
    }
  };
  
  // Handle booking cancellation
  const handleCancel = () => {
    if (selectedBooking && feedbackMessage) {
      updateStatusMutation.mutate({ 
        bookingId: selectedBooking.id,
        status: BookingStatus.CANCELLED,
        message: feedbackMessage 
      });
    } else {
      toast({
        title: "Feedback Required",
        description: "Please provide a reason for cancelling this booking.",
        variant: "destructive",
      });
    }
  };
  
  // Formatting functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(price);
  };
  
  // Loading states and error handling
  if (isLoadingBookings) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-[250px]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }
  
  if (bookingsError) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h3 className="mt-2 text-lg font-semibold">Error Loading Bookings</h3>
        <p className="text-sm text-gray-500">There was an error loading the service bookings. Please try again later.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Service Booking Management</CardTitle>
          <CardDescription>Manage and oversee all service bookings in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="search-bookings">Search Bookings</Label>
            <Input
              id="search-bookings"
              placeholder="Search by service, user, provider or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-80"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Bookings</TabsTrigger>
              <TabsTrigger value={BookingStatus.PENDING_APPROVAL}>Pending</TabsTrigger>
              <TabsTrigger value={BookingStatus.APPROVED}>Approved</TabsTrigger>
              <TabsTrigger value={BookingStatus.COMPLETED}>Completed</TabsTrigger>
              <TabsTrigger value={BookingStatus.REJECTED}>Rejected</TabsTrigger>
              <TabsTrigger value={BookingStatus.CANCELLED}>Cancelled</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-0">
              {filteredBookings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">No bookings found in this category.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Participants</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.serviceDetails?.name || 'Unknown Service'}
                          </TableCell>
                          <TableCell>
                            {booking.userDetails?.displayName || booking.userDetails?.email || 'Unknown User'}
                          </TableCell>
                          <TableCell>
                            {formatDate(booking.startTime)}
                          </TableCell>
                          <TableCell>
                            {booking.participants}
                          </TableCell>
                          <TableCell>
                            {formatPrice(booking.totalPrice)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(booking.status)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openBookingDetails(booking)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Booking Details Dialog */}
      {selectedBooking && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>
                Booking ID: {selectedBooking.id}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold mb-2">Service Information</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">{selectedBooking.serviceDetails?.name || 'Unknown Service'}</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.serviceDetails?.description || 'No description available'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.serviceDetails?.location || 'Location not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Date & Time</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedBooking.startTime)} - {formatDate(selectedBooking.endTime)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Participants</p>
                      <p className="text-sm text-muted-foreground">{selectedBooking.participants} participants</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">Price</p>
                      <p className="text-sm text-muted-foreground">{formatPrice(selectedBooking.totalPrice)}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Customer & Provider</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Customer</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedBooking.userDetails?.profilePicture ? (
                        <img 
                          src={selectedBooking.userDetails.profilePicture} 
                          alt={selectedBooking.userDetails.displayName} 
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{selectedBooking.userDetails?.displayName || 'Unknown User'}</p>
                        <p className="text-sm text-muted-foreground">{selectedBooking.userDetails?.email || 'No email available'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Provider</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedBooking.providerDetails?.profilePicture ? (
                        <img 
                          src={selectedBooking.providerDetails.profilePicture} 
                          alt={selectedBooking.providerDetails.displayName} 
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{selectedBooking.providerDetails?.displayName || 'Unknown Provider'}</p>
                        <p className="text-sm text-muted-foreground">{selectedBooking.providerDetails?.email || 'No email available'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium">Booking Status</h4>
                    <div className="mt-1">
                      {getStatusBadge(selectedBooking.status)}
                      {selectedBooking.isPaid && (
                        <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                          <DollarSign className="mr-1 h-3 w-3" /> Paid
                        </Badge>
                      )}
                      {selectedBooking.isRefunded && (
                        <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800 hover:bg-orange-100">
                          Refunded
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {(selectedBooking.message || selectedBooking.adminMessage) && (
                    <div>
                      <h4 className="font-medium">Messages</h4>
                      {selectedBooking.message && (
                        <div className="mt-1 p-2 bg-gray-50 rounded-md">
                          <p className="text-sm font-medium">Customer Message:</p>
                          <p className="text-sm">{selectedBooking.message}</p>
                        </div>
                      )}
                      {selectedBooking.adminMessage && (
                        <div className="mt-2 p-2 bg-gray-50 rounded-md">
                          <p className="text-sm font-medium">Admin Feedback:</p>
                          <p className="text-sm">{selectedBooking.adminMessage}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Admin feedback input for rejection or cancellation */}
            {(selectedBooking.status === BookingStatus.PENDING_APPROVAL || selectedBooking.status === BookingStatus.APPROVED) && (
              <div className="mt-4">
                <Label htmlFor="feedback">Feedback Message (required for rejection/cancellation)</Label>
                <Textarea 
                  id="feedback"
                  placeholder="Enter a message for the customer and provider..."
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            
            <DialogFooter className="flex-col sm:flex-row sm:justify-between sm:space-x-0">
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                {selectedBooking.status === BookingStatus.PENDING_APPROVAL && (
                  <>
                    <Button 
                      variant="default" 
                      onClick={handleApprove}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Approve Booking"}
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleReject}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Reject Booking"}
                    </Button>
                  </>
                )}
                
                {selectedBooking.status === BookingStatus.APPROVED && (
                  <>
                    <Button 
                      variant="default" 
                      onClick={handleComplete}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Mark as Completed"}
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleCancel}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Cancel Booking"}
                    </Button>
                  </>
                )}
              </div>
              
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BookingManagement;