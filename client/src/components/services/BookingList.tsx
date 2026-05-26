import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Search, CheckCircle, XCircle, Calendar, Clock, User, Banknote, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface BookingListProps {
  providerId?: number;
  buyerId?: number;
  isProvider?: boolean;
}

export const BookingList = ({ providerId, buyerId, isProvider = false }: BookingListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState("all");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine the correct API endpoint based on the props
  let apiEndpoint = "/api/bookings";
  if (providerId) {
    apiEndpoint = `/api/bookings/provider/${providerId}`;
  } else if (buyerId) {
    apiEndpoint = `/api/bookings/buyer/${buyerId}`;
  }

  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await apiRequest(apiEndpoint, "GET");
      if (!response.ok) {
        throw new Error("Failed to fetch bookings");
      }
      return response.json();
    },
  });

  // Get user details for the bookings
  const { data: services } = useQuery({
    queryKey: ["/api/services"],
    queryFn: async () => {
      const response = await apiRequest("/api/services", "GET");
      if (!response.ok) {
        throw new Error("Failed to fetch services");
      }
      return response.json();
    },
    enabled: !!bookings,
  });

  const filteredBookings = bookings
    ? bookings.filter((booking: any) => {
        // Apply search filters
        const matchesSearch =
          searchTerm === "" ||
          booking.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.serviceId?.toString().includes(searchTerm) ||
          booking.buyerId?.toString().includes(searchTerm);

        // Apply tab filters
        if (tab === "all") return matchesSearch;
        if (tab === "pending") return booking.status === "pending" && matchesSearch;
        if (tab === "confirmed") return booking.status === "confirmed" && matchesSearch;
        if (tab === "completed") return booking.status === "completed" && matchesSearch;
        if (tab === "cancelled") return booking.status === "cancelled" && matchesSearch;
        
        return matchesSearch;
      })
    : [];

  const getServiceName = (serviceId: number) => {
    if (!services) return "Loading...";
    const service = services.find((s: any) => s.id === serviceId);
    return service ? service.name : "Unknown Service";
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case "confirmed":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "completed":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "cancelled":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const handleStatusChange = async (bookingId: number, newStatus: string) => {
    try {
      const response = await apiRequest(`/api/bookings/${bookingId}/status`, "PATCH", {
        status: newStatus,
      });

      if (!response.ok) {
        throw new Error("Failed to update booking status");
      }

      toast({
        title: "Booking Updated",
        description: `Booking status changed to ${newStatus}`,
      });

      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!selectedBookingId || !message.trim()) return;

    try {
      const booking = bookings.find((b: any) => b.id === selectedBookingId);
      if (!booking) return;

      // Determine recipient based on whether the current user is provider or buyer
      const recipientId = isProvider ? booking.buyerId : booking.providerId;

      const response = await apiRequest("/api/messages", "POST", {
        receiverId: recipientId,
        content: message,
        type: "booking",
        bookingId: selectedBookingId,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully",
      });

      setMessage("");
      setMessageDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Tabs defaultValue="all" value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No bookings found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((booking: any) => (
            <Card key={booking.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{getServiceName(booking.serviceId)}</CardTitle>
                    <CardDescription>
                      Booking #{booking.id}
                    </CardDescription>
                  </div>
                  <Badge className={getBadgeColor(booking.status)}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{booking.date ? format(new Date(booking.date), 'MMMM d, yyyy') : 'Not set'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {booking.startTime ? format(new Date(booking.startTime), 'h:mm a') : 'Not set'} - 
                    {booking.endTime ? format(new Date(booking.endTime), ' h:mm a') : ' Not set'}
                  </span>
                </div>
                
                {isProvider ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Buyer ID: {booking.buyerId}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Provider ID: {booking.providerId}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span>€{booking.totalAmount || "0.00"}</span>
                </div>
                
                {booking.notes && (
                  <div className="mt-2 text-sm p-2 bg-muted rounded-md">
                    <p className="line-clamp-2">{booking.notes}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2 pt-2">
                {isProvider && booking.status === "pending" && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleStatusChange(booking.id, "confirmed")}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleStatusChange(booking.id, "cancelled")}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}
                
                {isProvider && booking.status === "confirmed" && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleStatusChange(booking.id, "completed")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Complete
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedBookingId(booking.id);
                    setMessageDialogOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Message
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a Message</DialogTitle>
            <DialogDescription>
              This message will be sent to the {isProvider ? "buyer" : "service provider"}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage}>Send Message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};