import React, { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, DollarSign, Clock, Users, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

// Define types for our data
interface ServiceBooking {
  id: number;
  serviceId: number;
  userId: number;
  status: string;
  date: string;
  timeSlot: string;
  price: number;
  notes?: string;
  createdAt: string;
  user?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
}

interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  providerId: number;
  categoryId: number;
  imageUrl?: string;
}

const ServiceSales: React.FC = () => {
  const [, params] = useRoute<{ id: string }>('/services/:id/sales');
  const serviceId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');

  // Fetch service details
  const { data: service, isLoading: isLoadingService } = useQuery({
    queryKey: ['/api/services', serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const response = await fetch(`/api/services/${serviceId}`);
      if (!response.ok) throw new Error('Failed to fetch service');
      return response.json();
    },
    enabled: !!serviceId
  });

  // Fetch service bookings
  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['/api/services/bookings', serviceId],
    queryFn: async () => {
      if (!serviceId) return [];
      const response = await fetch(`/api/services/${serviceId}/bookings`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      return response.json();
    },
    enabled: !!serviceId
  });

  if (isLoadingService || isLoadingBookings) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading service sales data...</span>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Service not found</h2>
          <p>The service you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link to="/services">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Services
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Filter bookings based on active tab
  const filteredBookings = bookings ? bookings.filter((booking: ServiceBooking) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'completed') return booking.status === 'completed';
    if (activeTab === 'upcoming') return booking.status === 'confirmed' && new Date(booking.date) > new Date();
    if (activeTab === 'cancelled') return booking.status === 'cancelled';
    return true;
  }) : [];

  // Calculate stats
  const totalBookings = bookings ? bookings.length : 0;
  const totalRevenue = bookings ? bookings.reduce((sum: number, booking: ServiceBooking) => sum + (booking.status !== 'cancelled' ? (booking.price || 0) : 0), 0) : 0;
  const completedCount = bookings ? bookings.filter((b: ServiceBooking) => b.status === 'completed').length : 0;
  const upcomingCount = bookings ? bookings.filter((b: ServiceBooking) => b.status === 'confirmed' && new Date(b.date) > new Date()).length : 0;
  const cancelledCount = bookings ? bookings.filter((b: ServiceBooking) => b.status === 'cancelled').length : 0;

  // Helper function to format time slot
  const formatTimeSlot = (timeSlot: string) => {
    return timeSlot;
  };

  // Helper function to determine booking status badge
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case 'confirmed':
        return <Badge variant="secondary">Confirmed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <Link to={`/services/${serviceId}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Service
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{service.name}</h1>
          <p className="text-muted-foreground mb-2">Service bookings dashboard</p>
        </div>
      </div>

      <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">€{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per booking: €{completedCount ? (totalRevenue / completedCount).toFixed(2) : service.price.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalBookings ? Math.round((completedCount / totalBookings) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled sessions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Service Bookings</CardTitle>
          <CardDescription>
            Manage all bookings for your service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Bookings ({totalBookings})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({cancelledCount})</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              <div className="rounded-md border">
                {filteredBookings.length > 0 ? (
                  <div className="divide-y">
                    {filteredBookings.map((booking: ServiceBooking) => (
                      <div key={booking.id} className="flex flex-col md:flex-row md:items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={booking.user?.profilePicture} />
                            <AvatarFallback>{booking.user?.displayName?.substring(0, 2) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{booking.user?.displayName || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{booking.user?.email || 'No email'}</p>
                            <div className="flex items-center mt-1">
                              <div className="flex items-center mr-4">
                                <Calendar className="w-3 h-3 mr-1" />
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(booking.date), 'MMM d, yyyy')}
                                </p>
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                <p className="text-xs text-muted-foreground">
                                  {formatTimeSlot(booking.timeSlot)}
                                </p>
                              </div>
                            </div>
                            {booking.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                "{booking.notes.substring(0, 60)}{booking.notes.length > 60 ? '...' : ''}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 md:mt-0">
                          <div className="flex flex-col items-end mr-2">
                            <span className="font-medium">€{booking.price.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">
                              Booked: {format(new Date(booking.createdAt), 'MMM d')}
                            </span>
                          </div>
                          {getStatusBadge(booking.status)}
                          {booking.status === 'confirmed' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Feature coming soon",
                                  description: "Status update functionality will be available in the next update.",
                                });
                              }}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">No bookings found</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceSales;