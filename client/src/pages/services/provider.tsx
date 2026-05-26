import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Calendar, CheckCircle, Clock, DollarSign, Users, Briefcase, Star } from 'lucide-react';
import { Link } from 'wouter';

// UI Components
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Heading from '@/components/ui/heading';
import { useToast } from '@/hooks/use-toast';
import { ConnectionStatusBadge } from '@/components/ui/connection-status-badge';
import { useWebSocket } from '@/contexts/WebSocketSingletonContext';

interface ServiceBooking {
  id: number;
  serviceId: number;
  userId: number;
  userName: string;
  status: string;
  createdAt: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
}

interface ServiceStats {
  totalServices: number;
  activeBookings: number;
  completedBookings: number;
  revenue: number;
  avgRating: number;
}

const ServiceProviderDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { connectionStatus } = useWebSocket();
  const [stats, setStats] = useState<ServiceStats>({
    totalServices: 0,
    activeBookings: 0,
    completedBookings: 0,
    revenue: 0,
    avgRating: 0
  });
  const [recentBookings, setRecentBookings] = useState<ServiceBooking[]>([]);

  // Fetch services created by the current user
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/services/provider', user?.id],
    enabled: !!user?.id
  });

  // Fetch bookings for services provided by this user
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/services/provider/bookings', user?.id],
    enabled: !!user?.id
  });

  // Calculate stats when data is loaded
  useEffect(() => {
    if (services && Array.isArray(services) && bookings && Array.isArray(bookings)) {
      // Calculate total revenue from completed bookings
      const completedBookingsList = bookings.filter((booking: any) => booking.status === 'completed');
      const totalRevenue = completedBookingsList.reduce((sum: number, booking: any) => sum + booking.price, 0);
      
      // Calculate average rating
      const reviewedServices = services.filter((service: any) => service.reviewCount > 0);
      const avgRating = reviewedServices.length > 0 
        ? reviewedServices.reduce((sum: number, service: any) => sum + service.rating, 0) / reviewedServices.length 
        : 0;
      
      setStats({
        totalServices: services.length,
        activeBookings: bookings.filter((booking: any) => ['pending', 'confirmed'].includes(booking.status)).length,
        completedBookings: completedBookingsList.length,
        revenue: totalRevenue,
        avgRating: parseFloat(avgRating.toFixed(1))
      });
    }
  }, [services, bookings]);

  // Set up recent bookings
  useEffect(() => {
    if (bookings && Array.isArray(bookings)) {
      const sortedBookings = [...bookings]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentBookings(sortedBookings);
    }
  }, [bookings]);

  // Listen for real-time service booking notifications
  useEffect(() => {
    const handleServiceBooking = (event: CustomEvent<any>) => {
      console.log('[SERVICE] Received service booking notification:', event.detail);
      
      // Show toast notification
      toast({
        title: event.detail.title || 'New Service Booking',
        description: event.detail.message || 'Someone has booked your service',
        variant: 'default',
      });

      // Refresh the bookings data
      queryClient.invalidateQueries({ queryKey: ['/api/services/provider/bookings', user?.id] });
      
      // Also refresh the specific service data
      if (event.detail.serviceId) {
        queryClient.invalidateQueries({ queryKey: [`/api/services/${event.detail.serviceId}`] });
      }
    };

    // Add the event listener for service booking events
    window.addEventListener('notification:service', handleServiceBooking);
    
    return () => {
      window.removeEventListener('notification:service', handleServiceBooking);
    };
  }, [queryClient, toast, user?.id]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p>Please log in to view your service provider dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <Heading as="h1">Service Provider Dashboard</Heading>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge status={connectionStatus} />
          <Link href="/services/create">
            <Button>
              <Briefcase className="mr-2 h-4 w-4" />
              Add New Service
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Services</p>
              <h3 className="text-2xl font-bold">{stats.totalServices}</h3>
            </div>
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Active Bookings</p>
              <h3 className="text-2xl font-bold">{stats.activeBookings}</h3>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <h3 className="text-2xl font-bold">{stats.completedBookings}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <h3 className="text-2xl font-bold">€{stats.revenue}</h3>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <h3 className="text-2xl font-bold">{stats.avgRating} / 5</h3>
            </div>
            <Star className="h-8 w-8 text-amber-500" />
          </div>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="recent">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">Recent Bookings</TabsTrigger>
          <TabsTrigger value="services">My Services</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        {/* Recent Bookings Tab */}
        <TabsContent value="recent">
          <Card>
            <Table>
              <TableCaption>Recent bookings for your services</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>{booking.userName}</TableCell>
                      <TableCell>{booking.serviceName}</TableCell>
                      <TableCell>
                        {new Date(booking.date).toLocaleDateString()} at {booking.time}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            booking.status === 'confirmed' 
                              ? 'default' 
                              : booking.status === 'completed' 
                                ? 'success' 
                                : booking.status === 'pending'
                                  ? 'outline'
                                  : 'destructive'
                          }
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>€{booking.price}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/services/bookings/${booking.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={booking.status === 'completed' || booking.status === 'cancelled'}
                          >
                            Update Status
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No bookings yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* My Services Tab */}
        <TabsContent value="services">
          <Card>
            <Table>
              <TableCaption>All services you offer</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Bookings</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services && Array.isArray(services) && services.length > 0 ? (
                  services.map((service: any) => {
                    const serviceBookings = bookings?.filter((b: any) => b.serviceId === service.id) || [];
                    
                    return (
                      <TableRow key={service.id}>
                        <TableCell>{service.name}</TableCell>
                        <TableCell>€{service.price}</TableCell>
                        <TableCell>{service.category}</TableCell>
                        <TableCell>{serviceBookings.length}</TableCell>
                        <TableCell>
                          {service.rating > 0 ? (
                            <span className="flex items-center">
                              {service.rating.toFixed(1)}
                              <Star className="h-4 w-4 text-amber-500 ml-1" />
                            </span>
                          ) : (
                            'No ratings'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/services/${service.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                            <Link href={`/services/${service.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      {servicesLoading ? 'Loading services...' : 'No services found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card className="p-6">
            <div className="flex items-center mb-4 gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Booking Calendar</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Your upcoming appointments and scheduled bookings will appear here.
            </p>
            
            {/* Simplified placeholder for calendar */}
            <div className="border rounded-md p-4 h-96 flex items-center justify-center">
              <Link href="/calendar">
                <Button>View Full Calendar</Button>
              </Link>
            </div>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <Card className="p-6">
            <div className="flex items-center mb-4 gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-medium">Service Reviews</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Reviews from clients who have used your services
            </p>
            
            <div className="space-y-4">
              {services && Array.isArray(services) && services.some((s: any) => s.reviewCount > 0) ? (
                services
                  .filter((s: any) => s.reviewCount > 0)
                  .map((service: any) => (
                    <Card key={service.id} className="p-4">
                      <div className="flex justify-between mb-2">
                        <h4 className="font-medium">{service.name}</h4>
                        <span className="flex items-center">
                          {service.rating.toFixed(1)}
                          <Star className="h-4 w-4 text-amber-500 ml-1" />
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {service.reviewCount} {service.reviewCount === 1 ? 'review' : 'reviews'}
                      </p>
                      <Link href={`/services/${service.id}/reviews`}>
                        <Button variant="outline" size="sm">View All Reviews</Button>
                      </Link>
                    </Card>
                  ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No reviews yet</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServiceProviderDashboard;