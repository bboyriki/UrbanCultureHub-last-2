import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Calendar, CheckCircle, Clock, DollarSign, Users } from 'lucide-react';
import { WebSocketMessage } from '@/contexts/WebSocketSingletonContext';
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

interface EventRSVP {
  id: number;
  eventId: number;
  userId: number;
  userName: string;
  status: string;
  createdAt: string;
  eventName: string;
}

interface EventStats {
  totalEvents: number;
  activeEvents: number;
  totalRSVPs: number;
  upcomingEvents: number;
}

const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { connectionStatus } = useWebSocket();
  const [stats, setStats] = useState<EventStats>({
    totalEvents: 0,
    activeEvents: 0,
    totalRSVPs: 0,
    upcomingEvents: 0
  });
  const [recentRSVPs, setRecentRSVPs] = useState<EventRSVP[]>([]);

  // Fetch events created by the current user
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events/organizer', user?.id],
    enabled: !!user?.id
  });

  // Fetch RSVPs for events organized by this user
  const { data: rsvps, isLoading: rsvpsLoading } = useQuery({
    queryKey: ['/api/events/organizer/rsvps', user?.id],
    enabled: !!user?.id
  });

  // Calculate stats when data is loaded
  useEffect(() => {
    if (events && Array.isArray(events)) {
      const now = new Date();
      setStats({
        totalEvents: events.length,
        activeEvents: events.filter((event: any) => new Date(event.endDate) >= now).length,
        upcomingEvents: events.filter((event: any) => new Date(event.startDate) > now).length,
        totalRSVPs: rsvps?.length || 0
      });
    }
  }, [events, rsvps]);

  // Set up recent RSVPs
  useEffect(() => {
    if (rsvps && Array.isArray(rsvps)) {
      const sortedRSVPs = [...rsvps]
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      setRecentRSVPs(sortedRSVPs);
    }
  }, [rsvps]);

  // Listen for real-time event RSVP notifications
  useEffect(() => {
    const handleEventRSVP = (event: CustomEvent<any>) => {
      console.log('[EVENT] Received event RSVP notification:', event.detail);
      
      // Show toast notification
      toast({
        title: event.detail.title || 'New Event RSVP',
        description: event.detail.message || 'Someone has RSVPed to your event',
        variant: 'default',
      });

      // Refresh the RSVP data
      queryClient.invalidateQueries({ queryKey: ['/api/events/organizer/rsvps', user?.id] });
      
      // Also refresh the specific event data
      if (event.detail.eventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${event.detail.eventId}`] });
      }
    };

    // Add the event listener for custom event notifications
    window.addEventListener('notification:content', handleEventRSVP);
    
    // Also listen for direct notification:event-rsvp events from the WebSocket context
    window.addEventListener('notification:event-rsvp', (event: Event) => {
      const customEvent = event as CustomEvent<WebSocketMessage['payload']>;
      handleEventRSVP(customEvent);
    });
    
    return () => {
      window.removeEventListener('notification:content', handleEventRSVP);
      window.removeEventListener('notification:event-rsvp', handleEventRSVP as EventListener);
    };
  }, [queryClient, toast, user?.id]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p>Please log in to view your organizer dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <Heading as="h1">Event Organizer Dashboard</Heading>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge status={connectionStatus} />
          <Link href="/events/create">
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Create New Event
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <h3 className="text-2xl font-bold">{stats.totalEvents}</h3>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Active Events</p>
              <h3 className="text-2xl font-bold">{stats.activeEvents}</h3>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total RSVPs</p>
              <h3 className="text-2xl font-bold">{stats.totalRSVPs}</h3>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Events</p>
              <h3 className="text-2xl font-bold">{stats.upcomingEvents}</h3>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="recent">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">Recent RSVPs</TabsTrigger>
          <TabsTrigger value="events">My Events</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Recent RSVPs Tab */}
        <TabsContent value="recent">
          <Card>
            <Table>
              <TableCaption>Recent RSVPs to your events</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRSVPs.length > 0 ? (
                  recentRSVPs.map((rsvp) => (
                    <TableRow key={rsvp.id}>
                      <TableCell>{rsvp.userName}</TableCell>
                      <TableCell>{rsvp.eventName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={rsvp.status === 'going' ? 'default' : 'destructive'}
                        >
                          {rsvp.status === 'going' ? 'Going' : 'Not Going'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(rsvp.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/events/${rsvp.eventId}`}>
                          <Button variant="ghost" size="sm">
                            View Event
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No RSVPs yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* My Events Tab */}
        <TabsContent value="events">
          <Card>
            <Table>
              <TableCaption>All events you've organized</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>RSVPs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events && Array.isArray(events) && events.length > 0 ? (
                  events.map((event: any) => {
                    const eventRsvps = rsvps?.filter((r: any) => r.eventId === event.id) || [];
                    const now = new Date();
                    const startDate = new Date(event.startDate);
                    const endDate = new Date(event.endDate);
                    
                    let status = 'upcoming';
                    if (endDate < now) status = 'past';
                    else if (startDate <= now && endDate >= now) status = 'active';
                    
                    return (
                      <TableRow key={event.id}>
                        <TableCell>{event.name}</TableCell>
                        <TableCell>
                          {new Date(event.startDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{eventRsvps.length}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              status === 'active' 
                                ? 'default' 
                                : status === 'upcoming' 
                                  ? 'outline' 
                                  : 'secondary'
                            }
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/events/${event.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                            <Link href={`/events/${event.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      {eventsLoading ? 'Loading events...' : 'No events found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card className="p-6">
            <div className="flex items-center mb-4 gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Event Notifications</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              You'll receive real-time notifications here when:
            </p>
            
            <ul className="list-disc pl-5 space-y-2 mb-6">
              <li>Someone RSVPs to your event</li>
              <li>An attendee cancels their RSVP</li>
              <li>Someone purchases tickets for your event</li>
              <li>Your event is promoted or featured by admins</li>
            </ul>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Event Sales</span>
              </div>
              <Link href="/sales/events">
                <Button variant="outline" size="sm">View Sales</Button>
              </Link>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizerDashboard;