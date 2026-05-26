import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Service, ServiceBooking } from '@shared/schema';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, 
  Calendar, 
  Check, 
  Clock, 
  CreditCard, 
  DollarSign, 
  MapPin, 
  Loader2,
  Trash2,
  Users, 
  X 
} from 'lucide-react';
import ExistingBookingPayment from './ExistingBookingPayment';

export interface BookingDetailsProps {
  bookingId: number;
  isProvider?: boolean;
}

export function BookingDetails({ bookingId, isProvider = false }: BookingDetailsProps) {
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['/api/service-bookings', bookingId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/service-bookings/${bookingId}`);
      return await response.json();
    },
  });

  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['/api/services', booking?.serviceId],
    queryFn: async () => {
      if (!booking?.serviceId) return null;
      const response = await apiRequest('GET', `/api/services/${booking.serviceId}`);
      return await response.json();
    },
    enabled: !!booking?.serviceId,
  });

  const approveBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/service-bookings/${bookingId}/approve`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking Approved',
        description: 'You have successfully approved this booking.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings', bookingId] });
      setIsApproveDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error approving booking:', error);
      toast({
        title: 'Error Approving Booking',
        description: 'Failed to approve booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const rejectBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/service-bookings/${bookingId}/reject`, {
        message: rejectReason,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking Rejected',
        description: 'You have successfully rejected this booking.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings', bookingId] });
      setIsRejectDialogOpen(false);
      setRejectReason('');
    },
    onError: (error) => {
      console.error('Error rejecting booking:', error);
      toast({
        title: 'Error Rejecting Booking',
        description: 'Failed to reject booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/service-bookings/${bookingId}/cancel`, {
        message: cancelReason,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking Cancelled',
        description: 'You have successfully cancelled this booking.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings', bookingId] });
      setIsCancelDialogOpen(false);
      setCancelReason('');
    },
    onError: (error) => {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error Cancelling Booking',
        description: 'Failed to cancel booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const completeBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/service-bookings/${bookingId}/complete`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking Completed',
        description: 'You have successfully marked this booking as complete.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings', bookingId] });
    },
    onError: (error) => {
      console.error('Error completing booking:', error);
      toast({
        title: 'Error Completing Booking',
        description: 'Failed to complete booking. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  const [, setLocation] = useLocation();
  
  const deleteBookingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/service-bookings/${bookingId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Booking Deleted',
        description: 'The booking has been permanently deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/service-bookings'] });
      setIsDeleteDialogOpen(false);
      // Navigate back to bookings list
      setLocation('/bookings');
    },
    onError: (error) => {
      console.error('Error deleting booking:', error);
      toast({
        title: 'Error Deleting Booking',
        description: 'Failed to delete booking. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/service-bookings', bookingId] });
    toast({
      title: "Payment Successful",
      description: "Your payment has been processed successfully.",
    });
  };

  if (bookingLoading || serviceLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!booking || !service) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Not Found</CardTitle>
          <CardDescription>The requested booking could not be found.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              The booking details could not be retrieved. Please check the booking ID and try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const renderStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return (
          <div className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full inline-flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </div>
        );
      case 'approved':
        return (
          <div className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full inline-flex items-center">
            <Check className="w-3 h-3 mr-1" />
            Approved
          </div>
        );
      case 'rejected':
        return (
          <div className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded-full inline-flex items-center">
            <X className="w-3 h-3 mr-1" />
            Rejected
          </div>
        );
      case 'cancelled':
        return (
          <div className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full inline-flex items-center">
            <X className="w-3 h-3 mr-1" />
            Cancelled
          </div>
        );
      case 'completed':
        return (
          <div className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full inline-flex items-center">
            <Check className="w-3 h-3 mr-1" />
            Completed
          </div>
        );
      default:
        return (
          <div className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full inline-flex items-center">
            {status}
          </div>
        );
    }
  };

  const renderPaymentStatusBadge = () => {
    if (booking.isPaid) {
      return (
        <div className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full inline-flex items-center">
          <CreditCard className="w-3 h-3 mr-1" />
          Paid
        </div>
      );
    } else if (booking.isRefunded) {
      return (
        <div className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded-full inline-flex items-center">
          <DollarSign className="w-3 h-3 mr-1" />
          Refunded
        </div>
      );
    } else {
      return (
        <div className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full inline-flex items-center">
          <CreditCard className="w-3 h-3 mr-1" />
          Unpaid
        </div>
      );
    }
  };

  const renderActionButtons = () => {
    if (isProvider) {
      return (
        <div className="flex flex-wrap gap-2 mt-4">
          {booking.status === 'PENDING' && (
            <>
              {booking.isPaid ? (
                // Show approval and rejection buttons only if the booking is paid
                <>
                  <Button 
                    variant="default" 
                    onClick={() => setIsApproveDialogOpen(true)}
                    disabled={approveBookingMutation.isPending}
                  >
                    {approveBookingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Approve Booking
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setIsRejectDialogOpen(true)}
                    disabled={rejectBookingMutation.isPending}
                  >
                    {rejectBookingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Reject Booking
                      </>
                    )}
                  </Button>
                </>
              ) : (
                // If not paid, show waiting for payment message
                <Alert className="w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Waiting for Payment</AlertTitle>
                  <AlertDescription>
                    The customer needs to complete payment before you can approve this booking.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
          
          {booking.status === 'APPROVED' && (
            <Button 
              variant="default" 
              onClick={() => completeBookingMutation.mutate()}
              disabled={completeBookingMutation.isPending}
            >
              {completeBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Mark as Complete
                </>
              )}
            </Button>
          )}
          
          {(booking.status === 'PENDING' || booking.status === 'APPROVED') && (
            <Button 
              variant="destructive" 
              onClick={() => setIsCancelDialogOpen(true)}
              disabled={cancelBookingMutation.isPending}
            >
              {cancelBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Cancel Booking
                </>
              )}
            </Button>
          )}
          
          {/* Delete button for provider (admin) */}
          <Button 
            variant="outline" 
            className="ml-auto border-red-200 text-red-600 hover:bg-red-50" 
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={deleteBookingMutation.isPending}
          >
            {deleteBookingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </>
            )}
          </Button>
        </div>
      );
    } else {
      // Customer view
      return (
        <div className="flex flex-wrap gap-2 mt-4">
          {(booking.status === 'PENDING' || booking.status === 'APPROVED') && (
            <Button 
              variant="destructive" 
              onClick={() => setIsCancelDialogOpen(true)}
              disabled={cancelBookingMutation.isPending}
            >
              {cancelBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Cancel Booking
                </>
              )}
            </Button>
          )}
        </div>
      );
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            <div className="flex justify-between items-center">
              <span>{service.name}</span>
              {renderStatusBadge(booking.status)}
            </div>
          </CardTitle>
          <CardDescription>
            Booking #{booking.id} - {renderPaymentStatusBadge()}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <div className="font-medium">Date & Time:</div>
                <div className="text-sm text-gray-500">
                  {format(new Date(booking.startTime), 'MMMM d, yyyy')} at {format(new Date(booking.startTime), 'h:mm a')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-500" />
              <div>
                <div className="font-medium">Participants:</div>
                <div className="text-sm text-gray-500">
                  {booking.participants || 1} {booking.participants === 1 ? 'person' : 'people'}
                </div>
              </div>
            </div>
            
            {booking.location && (
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div>
                  <div className="font-medium">Location:</div>
                  <div className="text-sm text-gray-500">{booking.location}</div>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-gray-500" />
              <div>
                <div className="font-medium">Price:</div>
                <div className="text-sm text-gray-500">{formatPrice(Number(service.price))}</div>
              </div>
            </div>
            
            {/* Image section removed as the images field has been removed from the schema */}

            {booking.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <div className="font-medium">Notes:</div>
                <div className="text-sm text-gray-600 whitespace-pre-line">{booking.notes}</div>
              </div>
            )}

            {booking.adminMessage && (
              <Alert className="mt-4" variant={booking.status === 'REJECTED' ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{booking.status === 'REJECTED' ? 'Rejection Reason' : 'Message from Provider'}</AlertTitle>
                <AlertDescription>
                  {booking.adminMessage}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col items-stretch">
          <Separator className="my-4" />
          {renderActionButtons()}
        </CardFooter>
      </Card>
      
      {/* Show payment section to customers for pending bookings that haven't been paid */}
      {!isProvider && !booking.isPaid && booking.status === 'PENDING' && (
        <>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Required</AlertTitle>
            <AlertDescription>
              Please complete payment to confirm your booking. After payment, the service provider will review and approve your booking.
            </AlertDescription>
          </Alert>
          <ExistingBookingPayment 
            booking={booking}
            service={service}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </>
      )}

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this booking? This will notify the customer that their booking has been confirmed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => approveBookingMutation.mutate()} disabled={approveBookingMutation.isPending}>
              {approveBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this booking. The customer will be notified and, if applicable, refunded.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px] my-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => rejectBookingMutation.mutate()} 
              disabled={rejectBookingMutation.isPending || !rejectReason.trim()}
            >
              {rejectBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this booking. {isProvider ? "The customer" : "The service provider"} will be notified.
              {booking.isPaid && !isProvider && " You may be eligible for a refund depending on the cancellation policy."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for cancellation..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="min-h-[100px] my-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>Back</Button>
            <Button 
              variant="destructive" 
              onClick={() => cancelBookingMutation.mutate()} 
              disabled={cancelBookingMutation.isPending || !cancelReason.trim()}
            >
              {cancelBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Booking'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this booking? This action cannot be undone.
              {booking.isPaid && " Any associated payment will be automatically refunded to the customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4 my-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">Warning</h4>
                <p className="text-sm">
                  Deleting a booking will remove it completely from the system, including all associated records and communications.
                  This is different from cancellation, which preserves the booking record.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteBookingMutation.mutate()} 
              disabled={deleteBookingMutation.isPending}
            >
              {deleteBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}