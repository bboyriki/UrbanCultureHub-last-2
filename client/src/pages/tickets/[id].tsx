import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Users, DollarSign, Mail, Ticket as TicketIcon, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ticket details
  const {
    data: ticket,
    isLoading,
    error
  } = useQuery({
    queryKey: [`/api/tickets/${id}`],
    enabled: !!id,
    retry: 3,
    gcTime: 0
  });

  // Resend email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/tickets/${id}/resend-email`, 'POST');
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Your ticket confirmation email has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Email",
        description: error.message || "Could not send the email. Please try again later.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!user && !isLoading) {
      setLocation('/auth');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error ? 
              'An error occurred while fetching the ticket. Please try again later.' : 
              'Ticket not found. It may have been deleted or you may not have permission to view it.'}
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => setLocation('/events')}>Browse Events</Button>
        </div>
      </div>
    );
  }

  // Check if the user is authorized to view this ticket
  if (user?.id !== ticket.userId) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view this ticket.
          </AlertDescription>
        </Alert>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => setLocation('/events')}>Browse Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {ticket.event?.title || "Event Ticket"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Ticket #{ticket.id} • Purchased {ticket.createdAt ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true }) : 'recently'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs
            defaultValue="details"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="details">Ticket Details</TabsTrigger>
              <TabsTrigger value="event">Event Info</TabsTrigger>
              <TabsTrigger value="qrcode">QR Code</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Type</p>
                      <p className="font-medium">{ticket.ticketType || "Standard Admission"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Quantity</p>
                      <p className="font-medium">{ticket.ticketQuantity} {ticket.ticketQuantity === 1 ? 'ticket' : 'tickets'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
                      <p className="font-medium">€{(ticket.purchaseAmount / 100).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Payment ID</p>
                      <p className="font-medium text-xs truncate">{ticket.paymentIntentId || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Status</p>
                      <Badge variant={ticket.isUsed ? "secondary" : "default"}>
                        {ticket.isUsed ? "Used" : "Valid"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email Confirmation</p>
                      <Badge variant={ticket.emailSent ? "default" : "destructive"}>
                        {ticket.emailSent ? "Sent" : "Not Sent"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />
                  
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Attendee Information</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                        <p className="font-medium">{user?.fullName || user?.displayName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                        <p className="font-medium truncate">{user?.email || "N/A"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  {ticket.emailSent === false && (
                    <Button 
                      variant="outline"
                      onClick={() => resendEmailMutation.mutate()}
                      disabled={resendEmailMutation.isPending}
                      data-testid="button-resend-email"
                    >
                      {resendEmailMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Request Email Resend
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="event" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticket.event ? (
                    <div className="space-y-4">
                      {ticket.event.image && (
                        <div className="rounded-lg overflow-hidden h-48">
                          <img 
                            src={ticket.event.image} 
                            alt={ticket.event.title} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <span>
                            {ticket.event.date
                              ? format(new Date(ticket.event.date), "EEEE, MMMM d, yyyy")
                              : "Date TBA"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <span>
                            {ticket.event.date
                              ? format(new Date(ticket.event.date), "h:mm a")
                              : "Time TBA"}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <span>{ticket.event.location || "Location TBA"}</span>
                        </div>
                        
                        {ticket.event.description && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Event Description</p>
                            <p>{ticket.event.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 dark:text-gray-400">Event information not available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => ticket.event && setLocation(`/events/${ticket.event.id}`)}
                    disabled={!ticket.event}
                  >
                    View Full Event Details
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="qrcode" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ticket QR Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-8">
                    {ticket.qrCode ? (
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                          <img 
                            src={ticket.qrCode} 
                            alt="Ticket QR Code" 
                            className="max-w-[250px]" 
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{ticket.ticketNumber || `#${ticket.id}`}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Present this QR code at the event entrance for admission
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <TicketIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">QR Code not available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-center">
                  {ticket.qrCode && (
                    <Button variant="outline" onClick={() => window.print()}>
                      Print Ticket
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => setActiveTab('qrcode')}
              >
                <TicketIcon className="mr-2 h-4 w-4" />
                Show QR Code
              </Button>
              
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => window.print()}
                disabled={!ticket.qrCode}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Print Ticket
              </Button>
              
              {ticket.event && (
                <Button 
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => setLocation(`/events/${ticket.event.id}`)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  View Event
                </Button>
              )}
              
              <Button 
                className="w-full justify-start"
                variant="outline"
                onClick={() => setLocation('/profile/tickets')}
              >
                <Users className="mr-2 h-4 w-4" />
                All My Tickets
              </Button>
              
              {!ticket.emailSent && (
                <Button 
                  className="w-full justify-start"
                  variant="default"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Email
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                If you have any questions about your ticket or the event, please contact the event organizer or our support team.
              </p>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}