import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Calendar, Check, CheckCircle2, Clock, DollarSign, ShieldCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

function formatCurrency(amount: string | number) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(numAmount);
}

type ServiceBooking = {
  id: number;
  serviceId: number;
  userId: number;
  providerId: number;
  status: string;
  bookingDate: string;
  endDate?: string;
  isPaid: boolean;
  isRefunded?: boolean;
  paymentIntentId?: string;
  message?: string;
  price: string;
  createdAt: string;
  updatedAt: string;
  service?: {
    id: number;
    name: string;
    description?: string;
    category?: string;
    price: string;
    image?: string;
  };
  user?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
  provider?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
};

// Function already defined above

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function AdminServiceBookingsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = ["admin", "super_admin"].includes(user?.role ?? "");
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ['/api/service-bookings'],
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: (bookingId: number) => {
      return apiRequest(`/api/service-bookings/${bookingId}/approve`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Booking approved",
        description: "The booking has been approved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      setIsApproveDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Approval failed",
        description: "There was an error approving the booking. Please try again.",
        variant: "destructive"
      });
      console.error("Error approving booking:", error);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ bookingId, message }: { bookingId: number; message: string }) => {
      return apiRequest(`/api/service-bookings/${bookingId}/reject`, 'POST', { message });
    },
    onSuccess: () => {
      toast({
        title: "Booking rejected",
        description: "The booking has been rejected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      setIsRejectDialogOpen(false);
      setRejectionMessage("");
    },
    onError: (error) => {
      toast({
        title: "Rejection failed",
        description: "There was an error rejecting the booking. Please try again.",
        variant: "destructive"
      });
      console.error("Error rejecting booking:", error);
    }
  });
  
  const completeMutation = useMutation({
    mutationFn: (bookingId: number) => {
      return apiRequest(`/api/service-bookings/${bookingId}/complete`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Booking completed",
        description: "The booking has been marked as completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      setIsCompleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Completion failed",
        description: "There was an error marking the booking as completed. Please try again.",
        variant: "destructive"
      });
      console.error("Error completing booking:", error);
    }
  });

  // Redirect non-admin users
  useEffect(() => {
    if (user && !isAdmin) {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page.",
        variant: "destructive"
      });
      navigate("/");
    }
  }, [user, isAdmin, toast, navigate]);

  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">
              You don't have permission to access this page. This area is restricted to administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Loading Service Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-red-500">Error Loading Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">
              There was an error loading the service bookings. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bookingsArray = Array.isArray(bookings) ? bookings : [];
  
  const filteredBookings = bookingsArray.filter((booking: ServiceBooking) => {
    if (activeTab === "pending") {
      return booking.status === "pending" && booking.isPaid;
    }
    if (activeTab === "approved") {
      return booking.status === "approved";
    }
    if (activeTab === "completed") {
      return booking.status === "completed";
    }
    if (activeTab === "rejected") {
      return booking.status === "rejected";
    }
    return true;
  });

  const handleApprove = (booking: ServiceBooking) => {
    setSelectedBooking(booking);
    setIsApproveDialogOpen(true);
  };

  const handleReject = (booking: ServiceBooking) => {
    setSelectedBooking(booking);
    setIsRejectDialogOpen(true);
  };
  
  const handleComplete = (booking: ServiceBooking) => {
    setSelectedBooking(booking);
    setIsCompleteDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedBooking) {
      approveMutation.mutate(selectedBooking.id);
    }
  };

  const confirmReject = () => {
    if (selectedBooking) {
      rejectMutation.mutate({
        bookingId: selectedBooking.id,
        message: rejectionMessage
      });
    }
  };
  
  const confirmComplete = () => {
    if (selectedBooking) {
      completeMutation.mutate(selectedBooking.id);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-4 mb-6">
        <h1 className="text-3xl font-bold">Service Booking Management</h1>
        <p className="text-muted-foreground">
          Review and manage service bookings that require admin approval
        </p>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending Approval
            {bookingsArray.filter((b: ServiceBooking) => b.status === "pending" && b.isPaid).length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {bookingsArray.filter((b: ServiceBooking) => b.status === "pending" && b.isPaid).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredBookings?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No {activeTab} bookings found</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredBookings?.map((booking: ServiceBooking) => (
              <Card key={booking.id} className={booking.isPaid && booking.status === "pending" ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span>Booking #{booking.id}</span>
                        {booking.isPaid && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <Check className="w-3 h-3 mr-1" /> Paid
                          </Badge>
                        )}
                        {booking.status === "pending" && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        )}
                        {booking.status === "approved" && (
                          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {booking.status === "rejected" && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            <X className="w-3 h-3 mr-1" /> Rejected
                          </Badge>
                        )}
                        {booking.status === "completed" && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        Booked {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold">{formatCurrency(booking.price)}</div>
                      <div className="text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3 inline mr-1" /> 
                        {formatDate(booking.bookingDate)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Service Details</h3>
                      <div className="flex items-center gap-3 mb-2">
                        {booking.service?.image ? (
                          <img 
                            src={booking.service.image} 
                            alt={booking.service?.name} 
                            className="w-12 h-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{booking.service?.name}</div>
                          <div className="text-sm text-muted-foreground">{booking.service?.category}</div>
                        </div>
                      </div>
                      {booking.service?.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                          {booking.service.description}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold mb-2">Customer</h3>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={booking.user?.profilePicture} alt={booking.user?.displayName} />
                              <AvatarFallback>{booking.user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{booking.user?.displayName}</div>
                              <div className="text-xs text-muted-foreground">{booking.user?.email}</div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">Provider</h3>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={booking.provider?.profilePicture} alt={booking.provider?.displayName} />
                              <AvatarFallback>{booking.provider?.displayName?.charAt(0) || 'P'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{booking.provider?.displayName}</div>
                              <div className="text-xs text-muted-foreground">{booking.provider?.email}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {booking.message && (
                        <div className="mt-3">
                          <h3 className="font-semibold mb-1">Customer Message:</h3>
                          <p className="text-sm border p-2 rounded-md bg-muted/50">{booking.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                {booking.status === "pending" && booking.isPaid && (
                  <CardFooter className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => handleReject(booking)}
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button 
                      onClick={() => handleApprove(booking)}
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </CardFooter>
                )}
                
                {booking.status === "approved" && (
                  <CardFooter className="flex justify-end gap-3">
                    <Button 
                      variant="secondary" 
                      onClick={() => handleComplete(booking)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Mark as Completed
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Service Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this booking? This will confirm the service reservation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">Booking Details:</p>
            <p>Service: {selectedBooking?.service?.name}</p>
            <p>Customer: {selectedBooking?.user?.displayName}</p>
            <p>Date: {selectedBooking?.bookingDate ? formatDate(selectedBooking.bookingDate) : 'N/A'}</p>
            <p>Amount: {selectedBooking?.price ? formatCurrency(selectedBooking.price) : 'N/A'}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Service Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this booking. The user will be notified and refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">Booking Details:</p>
            <p>Service: {selectedBooking?.service?.name}</p>
            <p>Customer: {selectedBooking?.user?.displayName}</p>
            <p>Date: {selectedBooking?.bookingDate ? formatDate(selectedBooking.bookingDate) : 'N/A'}</p>
            <p>Amount: {selectedBooking?.price ? formatCurrency(selectedBooking.price) : 'N/A'}</p>
            
            <div className="mt-4 space-y-2">
              <Label htmlFor="message">Rejection Reason</Label>
              <Textarea
                id="message"
                value={rejectionMessage}
                onChange={(e) => setRejectionMessage(e.target.value)}
                placeholder="Enter a reason for rejecting this booking"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be sent to the customer along with the rejection notification.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending || !rejectionMessage.trim()}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Complete Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Booking as Completed</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this booking as completed? This action indicates the service has been delivered.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">Booking Details:</p>
            <p>Service: {selectedBooking?.service?.name}</p>
            <p>Customer: {selectedBooking?.user?.displayName}</p>
            <p>Date: {selectedBooking?.bookingDate ? formatDate(selectedBooking.bookingDate) : 'N/A'}</p>
            <p>Amount: {selectedBooking?.price ? formatCurrency(selectedBooking.price) : 'N/A'}</p>
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Marking a booking as completed is final and will notify both the customer and service provider.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCompleteDialogOpen(false)}
              disabled={completeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={confirmComplete}
              disabled={completeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {completeMutation.isPending ? 'Processing...' : 'Mark as Completed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}