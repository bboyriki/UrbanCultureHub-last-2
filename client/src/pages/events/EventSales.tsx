import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar, Tag, Users, Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

// Define types for our data
interface EventTicket {
  id: number;
  eventId: number;
  userId: number;
  ticketNumber: string;  // Changed from ticketCode to match API response
  isValid: boolean;
  isUsed: boolean;
  checkInTime?: string | null;  // For tracking check-in status
  purchasedAt: string;  // Changed from purchaseDate to match API response
  purchaseAmount: number | string;
  paymentIntentId?: string;
  type?: string;
  seat?: string | null;
  notes?: string | null;
  emailSent?: boolean;
  pdfUrl?: string;
  scanCount?: number;
  ticketQuantity?: number;
  lastScanned?: string | null;
  user?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  };
}

interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  imageUrl: string;
  organizerId: number;
  ticketPrice: number;
  capacity: number;
  categoryId: number;
}

const EventSales: React.FC = () => {
  // Check for both sales and tickets routes
  const [, salesParams] = useRoute<{ id: string }>('/events/:id/sales');
  const [, ticketsParams] = useRoute<{ id: string }>('/events/:id/tickets');
  
  // Use params from whichever route matched
  const params = salesParams || ticketsParams;
  const eventId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');

  // Fetch event details
  const { data: event, isLoading: isLoadingEvent, error: eventError } = useQuery({
    queryKey: ['/api/events', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      console.log('Fetching event with ID:', eventId);
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        console.error('Failed to fetch event:', response.status, response.statusText);
        throw new Error('Failed to fetch event');
      }
      const data = await response.json();
      console.log('Event data:', data);
      return data;
    },
    enabled: !!eventId
  });

  // Fetch event tickets
  const { data: tickets, isLoading: isLoadingTickets, error: ticketsError } = useQuery({
    queryKey: ['/api/events/tickets', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      console.log('Fetching tickets for event ID:', eventId);
      const response = await fetch(`/api/events/${eventId}/tickets`);
      if (!response.ok) {
        console.error('Failed to fetch tickets:', response.status, response.statusText);
        throw new Error('Failed to fetch tickets');
      }
      const data = await response.json();
      console.log('Tickets data:', data);
      return data;
    },
    enabled: !!eventId
  });

  // Show loading state
  if (isLoadingEvent || isLoadingTickets) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading event sales data...</span>
      </div>
    );
  }

  // Handle errors
  if (eventError || ticketsError) {
    console.error('Error loading data:', { eventError, ticketsError });
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Error loading data</h2>
          <p>There was a problem loading the event or ticket information. Please try again later.</p>
          <Link to="/events">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Handle event not found
  if (!event) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          <h2 className="text-lg font-semibold">Event not found</h2>
          <p>The event you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link to="/events">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Declare variables outside try block so they're accessible in the return statement
  let filteredTickets: EventTicket[] = [];
  let totalSales = 0;
  let totalRevenue = 0;
  let checkedInCount = 0;
  
  try {
    console.log('Event data:', event);
    console.log('Tickets data:', tickets);
    
    // Make sure tickets is an array to prevent errors
    const ticketsArray = Array.isArray(tickets) ? tickets : [];
    
    // Filter tickets based on active tab
    filteredTickets = ticketsArray.filter((ticket: EventTicket) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'checked-in') return !!ticket.checkInTime || ticket.isUsed;
      if (activeTab === 'pending') return !ticket.checkInTime && !ticket.isUsed;
      return true;
    });

    // Calculate stats
    totalSales = ticketsArray.length;
    // Convert from cents (100) to euros (1.00) by dividing by 100
    totalRevenue = ticketsArray.reduce((sum: number, ticket: EventTicket) => {
      let amount = typeof ticket.purchaseAmount === 'string' 
        ? parseFloat(ticket.purchaseAmount) 
        : (ticket.purchaseAmount || 0);
      // Convert from cents to euros
      amount = amount / 100;
      return sum + amount;
    }, 0);
    checkedInCount = ticketsArray.filter((t: EventTicket) => !!t.checkInTime || t.isUsed).length;
  } catch (error) {
    console.error('Error processing ticket data:', error);
    // Continue with default values set above
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start mb-6">
        <div>
          <Link to={`/events/${eventId}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Event
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
          <p className="text-muted-foreground mb-2">
            <Calendar className="inline-block w-4 h-4 mr-1" />
            {format(new Date(event.date), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 mb-8 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((totalSales / (event.capacity || 1)) * 100)}% of capacity
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">€{totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Average: €{totalSales ? (totalRevenue / totalSales).toFixed(2) : "0.00"} per ticket
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{checkedInCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSales ? Math.round((checkedInCount / totalSales) * 100) : 0}% attendance rate
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            {ticketsParams ? 'Ticket Management' : 'Ticket Sales'}
          </CardTitle>
          <CardDescription>
            {ticketsParams 
              ? 'Manage tickets and check-ins for your event' 
              : 'Manage ticket sales and check-ins for your event'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Tickets ({totalSales})</TabsTrigger>
              <TabsTrigger value="checked-in">Checked In ({checkedInCount})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({totalSales - checkedInCount})</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              <div className="rounded-md border">
                {filteredTickets.length > 0 ? (
                  <div className="divide-y">
                    {filteredTickets.map((ticket: EventTicket) => (
                      <div key={ticket.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={ticket.user?.profilePicture} />
                            <AvatarFallback>{ticket.user?.displayName?.substring(0, 2) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{ticket.user?.displayName || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{ticket.user?.email || 'No email'}</p>
                            <div className="flex items-center mt-1">
                              <p className="text-xs text-muted-foreground">
                                Purchased: {format(new Date(ticket.purchasedAt), 'MMM d, yyyy')}
                              </p>
                              <p className="text-xs ml-4 text-muted-foreground">Ticket #{ticket.ticketNumber}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ticket.isUsed ? 'default' : 'secondary'} className={ticket.isUsed ? 'bg-green-500 hover:bg-green-600' : ''}>
                            {ticket.isUsed ? 'Checked In' : 'Not Checked In'}
                          </Badge>
                          {!ticket.isUsed && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Feature coming soon",
                                  description: "Check-in functionality will be available in the next update.",
                                });
                              }}
                            >
                              Check In
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">No tickets found</p>
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

export default EventSales;