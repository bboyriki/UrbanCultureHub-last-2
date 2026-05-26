import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  MoreHorizontal,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Eye,
  Send,
  RefreshCw,
  XCircle,
  Pencil,
  Mail
} from 'lucide-react';
import { Link } from 'wouter';

const ORDER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' }
];

function formatCurrency(amount: string | number) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

interface OrderManagementProps {
  statusFilter?: string;
}

const OrderManagement: React.FC<OrderManagementProps> = ({ statusFilter: initialStatusFilter }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showTrackingDialog, setShowTrackingDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [courierName, setCourierName] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Update status filter when prop changes
  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);
  
  // Fetch all orders with optional status filtering
  const {
    data: orders,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/orders', statusFilter],
    queryFn: async () => {
      let url = '/api/orders';
      if (statusFilter && statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      return response.json();
    }
  });
  
  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number, status: string }) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Order Updated',
        description: `Order status has been updated successfully.`,
        variant: 'default'
      });
      setShowStatusDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Update tracking information mutation
  const updateTrackingMutation = useMutation({
    mutationFn: async ({ orderId, trackingNumber, trackingUrl, courierName }: { orderId: number, trackingNumber: string, trackingUrl?: string, courierName?: string }) => {
      const response = await fetch(`/api/orders/${orderId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, trackingUrl, courierName })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update tracking information');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Tracking Updated',
        description: `Tracking information has been updated and customer notified.`,
        variant: 'default'
      });
      setShowTrackingDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Send custom notification mutation
  const sendNotificationMutation = useMutation({
    mutationFn: async ({ orderId, message }: { orderId: number, message: string }) => {
      const response = await fetch(`/api/admin/orders/${orderId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send notification');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Notification Sent',
        description: `Customer has been notified.`,
        variant: 'default'
      });
      setShowNotificationDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Notification Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Reject order mutation
  const rejectOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: number, reason: string }) => {
      const response = await fetch(`/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject order');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Order Rejected',
        description: `The order has been rejected and customer notified.`,
        variant: 'default'
      });
      setShowRejectDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Rejection Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Mark as delivered mutation
  const markAsDeliveredMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: number }) => {
      const response = await fetch(`/api/orders/${orderId}/delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark order as delivered');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Order Updated',
        description: `Order marked as delivered.`,
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
  
  // Handle search/filter
  const filteredOrders = orders ? orders.filter((order: any) => 
    // If there's a search term, filter by order ID or buyer name/email
    !searchTerm || 
    order.id.toString().includes(searchTerm) || 
    (order.buyer?.displayName && order.buyer.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.buyer?.email && order.buyer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : [];
  
  // Function to get status badge variant
  const getStatusBadge = (status: string) => {
    let icon = <Clock className="h-4 w-4 mr-1" />;
    let className = "bg-yellow-100 text-yellow-800 border-yellow-200";
    
    switch (status) {
      case 'processing':
        icon = <Package className="h-4 w-4 mr-1" />;
        className = "bg-blue-100 text-blue-800 border-blue-200";
        break;
      case 'shipped':
        icon = <Truck className="h-4 w-4 mr-1" />;
        className = "bg-indigo-100 text-indigo-800 border-indigo-200";
        break;
      case 'delivered':
      case 'completed':
        icon = <CheckCircle className="h-4 w-4 mr-1" />;
        className = "bg-green-100 text-green-800 border-green-200";
        break;
      case 'cancelled':
      case 'rejected':
        icon = <AlertTriangle className="h-4 w-4 mr-1" />;
        className = "bg-red-100 text-red-800 border-red-200";
        break;
    }
    
    return (
      <Badge className={`${className} flex items-center px-2 py-1`}>
        {icon}
        <span>{status.toUpperCase()}</span>
      </Badge>
    );
  };
  
  // Handle status update
  const handleStatusUpdate = () => {
    if (!selectedOrder || !newStatus) return;
    
    updateStatusMutation.mutate({
      orderId: selectedOrder.id,
      status: newStatus
    });
  };
  
  // Handle tracking update
  const handleTrackingUpdate = () => {
    if (!selectedOrder || !trackingNumber) return;
    
    updateTrackingMutation.mutate({
      orderId: selectedOrder.id,
      trackingNumber,
      trackingUrl,
      courierName
    });
  };
  
  // Handle send notification
  const handleSendNotification = () => {
    if (!selectedOrder || !notificationMessage) return;
    
    sendNotificationMutation.mutate({
      orderId: selectedOrder.id,
      message: notificationMessage
    });
  };
  
  // Handle order rejection
  const handleRejectOrder = () => {
    if (!selectedOrder || !rejectionReason) return;
    
    rejectOrderMutation.mutate({
      orderId: selectedOrder.id,
      reason: rejectionReason
    });
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading Orders</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Failed to load orders'}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
          <CardDescription>
            View, filter and manage all customer orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              className="ml-auto hidden sm:flex"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Package className="h-12 w-12 mb-2 opacity-30" />
                        <p>No orders found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">#{order.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{order.buyer?.displayName || 'Unknown User'}</span>
                          <span className="text-xs text-muted-foreground">
                            {order.buyer?.email && order.buyer.email.length > 20 
                              ? `${order.buyer.email.substring(0, 20)}...` 
                              : order.buyer?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.createdAt ? format(parseISO(order.createdAt), 'MMM d, yyyy') : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/orders/${order.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrder(order);
                              setNewStatus(order.status);
                              setShowStatusDialog(true);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Update Status
                            </DropdownMenuItem>
                            
                            {['processing', 'pending'].includes(order.status) && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order);
                                setTrackingNumber(order.trackingNumber || '');
                                setTrackingUrl(order.trackingUrl || '');
                                setCourierName(order.courierName || '');
                                setShowTrackingDialog(true);
                              }}>
                                <Truck className="h-4 w-4 mr-2" />
                                Add Tracking
                              </DropdownMenuItem>
                            )}
                            
                            {order.status === 'shipped' && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order);
                                markAsDeliveredMutation.mutate({ orderId: order.id });
                              }}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Delivered
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem onClick={() => {
                              setSelectedOrder(order);
                              setNotificationMessage('');
                              setShowNotificationDialog(true);
                            }}>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Notification
                            </DropdownMenuItem>
                            
                            {['pending', 'processing'].includes(order.status) && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setRejectionReason('');
                                  setShowRejectDialog(true);
                                }}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject Order
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {filteredOrders.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the status for order #{selectedOrder?.id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status</Label>
              <Select
                value={newStatus}
                onValueChange={setNewStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleStatusUpdate}
              disabled={updateStatusMutation.isPending || newStatus === selectedOrder?.status}
            >
              {updateStatusMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Information</DialogTitle>
            <DialogDescription>
              Add shipping and tracking details for order #{selectedOrder?.id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number*</Label>
              <Input
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="trackingUrl">Tracking URL (Optional)</Label>
              <Input
                id="trackingUrl"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://courier.com/track/..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="courierName">Courier Name (Optional)</Label>
              <Input
                id="courierName"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="DHL, UPS, etc."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrackingDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleTrackingUpdate}
              disabled={updateTrackingMutation.isPending || !trackingNumber}
            >
              {updateTrackingMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Save & Notify Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Send Notification Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Customer Notification</DialogTitle>
            <DialogDescription>
              Send a custom notification to the customer about order #{selectedOrder?.id}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Enter your message to the customer..."
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSendNotification}
              disabled={sendNotificationMutation.isPending || !notificationMessage}
            >
              {sendNotificationMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Order Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              This will reject order #{selectedOrder?.id} and notify the customer. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this order is being rejected..."
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleRejectOrder}
              disabled={rejectOrderMutation.isPending || !rejectionReason}
            >
              {rejectOrderMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderManagement;