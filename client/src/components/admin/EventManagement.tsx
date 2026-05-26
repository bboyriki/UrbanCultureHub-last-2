import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Event, EventTicketType } from "@shared/schema";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Plus, Trash2, Ticket, RefreshCw, Calendar, MapPin, Eye, EyeOff, Edit, Check, X, Search, Star, Zap, BadgeCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AdminCreateEventModal from "@/components/admin/AdminCreateEventModal";

type EventFilterType = "all" | "pending" | "approved" | "rejected";

interface TicketTypeForm {
  name: string;
  price: string;
  description: string;
  maxQuantity: string;
  benefits: string;
}

const EventManagement = () => {
  const [filter, setFilter] = useState<EventFilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [ticketTypesModal, setTicketTypesModal] = useState(false);
  const [ticketTypeEvent, setTicketTypeEvent] = useState<Event | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [newTicketType, setNewTicketType] = useState<TicketTypeForm>({
    name: "",
    price: "",
    description: "",
    maxQuantity: "",
    benefits: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const adminId = user?.id;

  // Fetch all events with proper authentication
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/events", "admin"],
    queryFn: async () => {
      const response = await apiRequest("/api/events", "GET", { showAll: true });
      return await response.json();
    },
    enabled: !!adminId
  });

  const filteredEvents = events.filter((event: Event) => {
    const matchesSearch = search === "" || 
      event.title?.toLowerCase().includes(search.toLowerCase()) ||
      event.description?.toLowerCase().includes(search.toLowerCase());
    
    let matchesFilter;
    
    switch (filter) {
      case "pending":
        // Consider null status as pending for backward compatibility
        matchesFilter = event.status === "pending" || event.status === null;
        break;
      case "approved":
        matchesFilter = event.status === "approved";
        break;
      case "rejected":
        matchesFilter = event.status === "rejected";
        break;
      default:
        matchesFilter = true; // "all" filter shows everything
    }
    
    return matchesSearch && matchesFilter;
  });

  // Approve event mutation
  const approveEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/admin/events/${eventId}/approve`, "POST", { adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] });
      toast({
        title: "Event approved",
        description: "The event has been approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve event",
        description: error.message || "Could not approve event",
        variant: "destructive",
      });
    },
  });

  // Reject event mutation
  const rejectEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/admin/events/${eventId}/reject`, "POST", { adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] });
      toast({
        title: "Event rejected",
        description: "The event has been rejected successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject event",
        description: error.message || "Could not reject event",
        variant: "destructive",
      });
    },
  });

  // Modify event mutation
  const modifyEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: number; data: Partial<Event> }) => {
      return apiRequest(`/api/admin/events/${eventId}`, "PATCH", { ...data, adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] });
      toast({
        title: "Event updated",
        description: "The event has been updated successfully",
      });
      setEditModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update event",
        description: error.message || "Could not update event",
        variant: "destructive",
      });
    },
  });

  const handleApproveEvent = (event: Event) => {
    approveEventMutation.mutate(event.id);
  };

  const handleRejectEvent = (event: Event) => {
    rejectEventMutation.mutate(event.id);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEditModal(true);
  };

  // Fetch ticket types for selected event
  const { data: ticketTypes = [], refetch: refetchTicketTypes } = useQuery({
    queryKey: ["/api/admin/events", ticketTypeEvent?.id, "ticket-types"],
    queryFn: async () => {
      if (!ticketTypeEvent?.id) return [];
      const response = await apiRequest(`/api/admin/events/${ticketTypeEvent.id}/ticket-types`, "GET");
      return await response.json();
    },
    enabled: !!ticketTypeEvent?.id,
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest(`/api/events/${eventId}`, "DELETE", { adminId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] });
      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully",
      });
      setDeleteModal(false);
      setEventToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete event",
        description: error.message || "Could not delete event",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setDeleteModal(true);
  };

  const confirmDeleteEvent = () => {
    if (eventToDelete) {
      deleteEventMutation.mutate(eventToDelete.id);
    }
  };

  const featureMutation = useMutation({
    mutationFn: (eventId: number) => apiRequest(`/api/admin/events/${eventId}/feature`, "PATCH"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); toast({ title: "Featured bijgewerkt" }); },
    onError: () => toast({ title: "Mislukt", variant: "destructive" }),
  });

  const trendMutation = useMutation({
    mutationFn: (eventId: number) => apiRequest(`/api/admin/events/${eventId}/trend`, "PATCH"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); toast({ title: "Trending bijgewerkt" }); },
    onError: () => toast({ title: "Mislukt", variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (eventId: number) => apiRequest(`/api/admin/events/${eventId}/verify`, "PATCH"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events", "admin"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); toast({ title: "Verificatie bijgewerkt" }); },
    onError: () => toast({ title: "Mislukt", variant: "destructive" }),
  });

  // Create ticket type mutation
  const createTicketTypeMutation = useMutation({
    mutationFn: async (data: { eventId: number; ticketType: TicketTypeForm }) => {
      return apiRequest(`/api/admin/events/${data.eventId}/ticket-types`, "POST", {
        name: data.ticketType.name,
        price: data.ticketType.price,
        description: data.ticketType.description,
        maxQuantity: data.ticketType.maxQuantity ? parseInt(data.ticketType.maxQuantity) : null,
        availableQuantity: data.ticketType.maxQuantity ? parseInt(data.ticketType.maxQuantity) : null,
        benefits: data.ticketType.benefits,
      });
    },
    onSuccess: () => {
      refetchTicketTypes();
      setNewTicketType({ name: "", price: "", description: "", maxQuantity: "", benefits: "" });
      toast({
        title: "Ticket type created",
        description: "The ticket type has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create ticket type",
        description: error.message || "Could not create ticket type",
        variant: "destructive",
      });
    },
  });

  // Delete ticket type mutation
  const deleteTicketTypeMutation = useMutation({
    mutationFn: async (ticketTypeId: number) => {
      return apiRequest(`/api/admin/ticket-types/${ticketTypeId}`, "DELETE");
    },
    onSuccess: () => {
      refetchTicketTypes();
      toast({
        title: "Ticket type deleted",
        description: "The ticket type has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete ticket type",
        description: error.message || "Could not delete ticket type",
        variant: "destructive",
      });
    },
  });

  const handleTicketTypes = (event: Event) => {
    setTicketTypeEvent(event);
    setTicketTypesModal(true);
  };

  const handleCreateTicketType = () => {
    if (!ticketTypeEvent?.id || !newTicketType.name || !newTicketType.price) {
      toast({
        title: "Missing information",
        description: "Please enter a name and price for the ticket type",
        variant: "destructive",
      });
      return;
    }
    createTicketTypeMutation.mutate({
      eventId: ticketTypeEvent.id,
      ticketType: newTicketType,
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case null:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status || "Unknown"}</Badge>;
    }
  };

  // Count events by status
  const pendingCount = events.filter((e: Event) => e.status === "pending" || e.status === null).length;
  const approvedCount = events.filter((e: Event) => e.status === "approved").length;
  const rejectedCount = events.filter((e: Event) => e.status === "rejected").length;

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Event Management</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateModal(true)}
              data-testid="button-create-event"
              className="gap-1.5 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              title="Refresh events"
              data-testid="button-refresh-events"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="relative w-full">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search events..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-events"
          />
        </div>
      </div>

      {/* Event Filter - Scrollable on mobile */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as EventFilterType)} className="mb-4">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max min-w-full sm:w-auto gap-1 p-1">
            <TabsTrigger value="pending" className="gap-1 min-w-[80px] text-xs sm:text-sm" data-testid="tab-pending-events">
              <span className="hidden sm:inline">Pending</span>
              <span className="sm:hidden">Pend</span>
              {pendingCount > 0 && <Badge variant="destructive" className="rounded-full text-xs px-1.5">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1 min-w-[80px] text-xs sm:text-sm" data-testid="tab-approved-events">
              <span className="hidden sm:inline">Approved</span>
              <span className="sm:hidden">Appr</span>
              {approvedCount > 0 && <Badge variant="secondary" className="rounded-full text-xs px-1.5">{approvedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1 min-w-[80px] text-xs sm:text-sm" data-testid="tab-rejected-events">
              <span className="hidden sm:inline">Rejected</span>
              <span className="sm:hidden">Rej</span>
              {rejectedCount > 0 && <Badge variant="outline" className="rounded-full text-xs px-1.5">{rejectedCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="all" className="min-w-[60px] text-xs sm:text-sm" data-testid="tab-all-events">All</TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </Tabs>

      {/* Event List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading events...</p>
        </div>
      ) : filteredEvents.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredEvents.map((event: Event) => (
              <Card key={event.id} className="overflow-hidden" data-testid={`card-event-${event.id}`}>
                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight truncate">{event.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                    </div>
                    {getStatusBadge(event.status)}
                  </div>
                </CardHeader>
                <CardContent className="px-4 py-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {event.date ? format(new Date(event.date), "MMM d, yyyy") : "TBD"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location ? event.location.split(',')[0] : "No location"}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="px-4 py-3 border-t bg-muted/30">
                  <div className="flex flex-wrap gap-2 w-full">
                    {/* Premium control toggles */}
                    <div className="flex gap-1 w-full mb-1">
                      <Button variant="ghost" size="sm" className={`flex-1 text-xs gap-1 ${(event as any).isFeatured ? "text-yellow-500 bg-yellow-50" : "text-muted-foreground"}`}
                        onClick={() => featureMutation.mutate(event.id)} data-testid={`button-feature-event-mobile-${event.id}`}>
                        <Star className="h-3.5 w-3.5" fill={(event as any).isFeatured ? "currentColor" : "none"} /> Featured
                      </Button>
                      <Button variant="ghost" size="sm" className={`flex-1 text-xs gap-1 ${(event as any).isTrending ? "text-orange-500 bg-orange-50" : "text-muted-foreground"}`}
                        onClick={() => trendMutation.mutate(event.id)} data-testid={`button-trend-event-mobile-${event.id}`}>
                        <Zap className="h-3.5 w-3.5" fill={(event as any).isTrending ? "currentColor" : "none"} /> Trending
                      </Button>
                      <Button variant="ghost" size="sm" className={`flex-1 text-xs gap-1 ${(event as any).isVerifiedOrganizer ? "text-blue-500 bg-blue-50" : "text-muted-foreground"}`}
                        onClick={() => verifyMutation.mutate(event.id)} data-testid={`button-verify-event-mobile-${event.id}`}>
                        <BadgeCheck className="h-3.5 w-3.5" /> Verify
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditEvent(event)}
                      className="flex-1 min-w-[80px]"
                      data-testid={`button-edit-event-mobile-${event.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTicketTypes(event)}
                      className="flex-1 min-w-[80px]"
                      data-testid={`button-tickets-event-mobile-${event.id}`}
                    >
                      <Ticket className="h-4 w-4 mr-1" />
                      Tickets
                    </Button>
                    {(event.status === "pending" || event.status === null) && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproveEvent(event)}
                          className="flex-1 min-w-[80px] bg-green-600"
                          data-testid={`button-approve-event-mobile-${event.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRejectEvent(event)}
                          className="flex-1 min-w-[80px]"
                          data-testid={`button-reject-event-mobile-${event.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEvent(event)}
                      className="text-destructive"
                      data-testid={`button-delete-event-mobile-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-card rounded-xl shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Event</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Organizer</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((event: Event) => (
                  <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-normal">
                      <div className="text-sm font-medium">{event.title}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">{event.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">Organizer #{event.organizerId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{event.date ? format(new Date(event.date), "MMM d, yyyy") : "TBD"}</div>
                      {event.createdAt && (
                        <div className="text-xs text-muted-foreground">Created: {format(new Date(event.createdAt), "MMM d, yyyy")}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(event.status)}
                        <div className="flex gap-1 mt-1">
                          {(event as any).isFeatured && <Badge className="text-[10px] px-1 py-0 bg-yellow-100 text-yellow-800">⭐ Featured</Badge>}
                          {(event as any).isTrending && <Badge className="text-[10px] px-1 py-0 bg-orange-100 text-orange-800">⚡ Trending</Badge>}
                          {(event as any).isVerifiedOrganizer && <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800">✓ Verified</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {/* Feature/Trend/Verify toggles */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => featureMutation.mutate(event.id)}
                          title={(event as any).isFeatured ? "Verwijder featured" : "Markeer als featured"}
                          data-testid={`button-feature-event-${event.id}`}
                          className={(event as any).isFeatured ? "text-yellow-500" : "text-muted-foreground"}
                        >
                          <Star className="h-4 w-4" fill={(event as any).isFeatured ? "currentColor" : "none"} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => trendMutation.mutate(event.id)}
                          title={(event as any).isTrending ? "Verwijder trending" : "Markeer als trending"}
                          data-testid={`button-trend-event-${event.id}`}
                          className={(event as any).isTrending ? "text-orange-500" : "text-muted-foreground"}
                        >
                          <Zap className="h-4 w-4" fill={(event as any).isTrending ? "currentColor" : "none"} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => verifyMutation.mutate(event.id)}
                          title={(event as any).isVerifiedOrganizer ? "Verwijder verificatie" : "Verifieer organisator"}
                          data-testid={`button-verify-event-${event.id}`}
                          className={(event as any).isVerifiedOrganizer ? "text-blue-500" : "text-muted-foreground"}
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditEvent(event)}
                          title="Edit event"
                          data-testid={`button-edit-event-${event.id}`}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTicketTypes(event)}
                          title="Manage ticket types"
                          data-testid={`button-tickets-event-${event.id}`}
                        >
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {(event.status === "pending" || event.status === null) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleApproveEvent(event)}
                              className="text-green-500"
                              title="Approve event"
                              data-testid={`button-approve-event-${event.id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRejectEvent(event)}
                              className="text-destructive"
                              title="Reject event"
                              data-testid={`button-reject-event-${event.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(event)}
                          className="text-destructive"
                          title="Delete event"
                          data-testid={`button-delete-event-${event.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-8 bg-card rounded-xl shadow-sm">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No events found matching your criteria</p>
        </div>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedEvent && (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (selectedEvent) {
                  modifyEventMutation.mutate({
                    eventId: selectedEvent.id,
                    data: {
                      title: selectedEvent.title,
                      description: selectedEvent.description,
                      location: selectedEvent.location,
                      date: selectedEvent.date,
                      category: selectedEvent.category,
                      price: selectedEvent.price,
                      image: selectedEvent.image,
                    }
                  });
                }
              }} className="space-y-4">
                <div>
                  <Label htmlFor="title" className="mb-1">Title</Label>
                  <Input
                    id="title"
                    value={selectedEvent.title || ""}
                    onChange={(e) => setSelectedEvent({...selectedEvent, title: e.target.value})}
                    placeholder="Event title"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description" className="mb-1">Description</Label>
                  <Textarea
                    id="description"
                    value={selectedEvent.description || ""}
                    onChange={(e) => setSelectedEvent({...selectedEvent, description: e.target.value})}
                    placeholder="Event description"
                    className="min-h-[100px]"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="location" className="mb-1">Location</Label>
                    <Input
                      id="location"
                      value={selectedEvent.location || ""}
                      onChange={(e) => setSelectedEvent({...selectedEvent, location: e.target.value})}
                      placeholder="Event location"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="date" className="mb-1">Date</Label>
                    <Input
                      id="date"
                      type="datetime-local"
                      value={selectedEvent.date ? new Date(selectedEvent.date).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setSelectedEvent({...selectedEvent, date: new Date(e.target.value)})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="category" className="mb-1">Category</Label>
                    <select
                      id="category"
                      value={selectedEvent.category || ""}
                      onChange={(e) => setSelectedEvent({...selectedEvent, category: e.target.value})}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select a category</option>
                      <option value="dance">Dance</option>
                      <option value="music">Music</option>
                      <option value="art">Art</option>
                      <option value="graffiti">Graffiti</option>
                      <option value="workshop">Workshop</option>
                      <option value="performance">Performance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="price" className="mb-1">Price (€)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={selectedEvent.price || ""}
                      onChange={(e) => setSelectedEvent({...selectedEvent, price: parseFloat(e.target.value)})}
                      placeholder="Event price"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="image" className="mb-1">Event Image</Label>
                  <div>
                    <ImageUploader
                      initialImage={selectedEvent.image || ""}
                      onImageUploaded={(imageUrl, publicId) => {
                        setSelectedEvent({...selectedEvent, image: imageUrl});
                        setIsUploading(false);
                      }}
                      onUploadStart={() => {
                        setIsUploading(true);
                      }}
                      folder="urban-culture/events"
                      buttonText="Upload Event Image"
                    />
                    {isUploading && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        <span>Uploading image...</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Upload an image for the event</p>
                </div>
                
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditModal(false)}
                    disabled={modifyEventMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={modifyEventMutation.isPending || isUploading}
                    className="w-full sm:w-auto"
                  >
                    {modifyEventMutation.isPending ? "Saving..." : isUploading ? "Uploading Image..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Types Modal */}
      <Dialog open={ticketTypesModal} onOpenChange={setTicketTypesModal}>
        <DialogContent className="w-[95vw] max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Ticket className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">Tickets: {ticketTypeEvent?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6">
            {/* Existing Ticket Types */}
            <div>
              <h3 className="text-sm font-medium mb-3">Current Ticket Types</h3>
              {ticketTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                  No ticket types configured. Add one below.
                </p>
              ) : (
                <div className="space-y-2">
                  {ticketTypes.map((ticketType: EventTicketType) => (
                    <div 
                      key={ticketType.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md bg-muted/30 gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{ticketType.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            €{parseFloat(ticketType.price).toFixed(2)}
                          </Badge>
                          {ticketType.maxQuantity && (
                            <Badge variant="outline" className="text-xs">
                              {ticketType.availableQuantity}/{ticketType.maxQuantity} left
                            </Badge>
                          )}
                        </div>
                        {ticketType.description && (
                          <p className="text-xs text-muted-foreground mt-1">{ticketType.description}</p>
                        )}
                        {ticketType.benefits && (
                          <p className="text-xs text-muted-foreground mt-1">Benefits: {ticketType.benefits}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTicketTypeMutation.mutate(ticketType.id)}
                        disabled={deleteTicketTypeMutation.isPending}
                        className="self-end sm:self-center"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Ticket Type */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Add New Ticket Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="ticketName">Name *</Label>
                  <Input
                    id="ticketName"
                    placeholder="e.g., Standard, VIP, Early Bird"
                    value={newTicketType.name}
                    onChange={(e) => setNewTicketType({ ...newTicketType, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ticketPrice">Price (€) *</Label>
                  <Input
                    id="ticketPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newTicketType.price}
                    onChange={(e) => setNewTicketType({ ...newTicketType, price: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ticketQuantity">Max Quantity (optional)</Label>
                  <Input
                    id="ticketQuantity"
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={newTicketType.maxQuantity}
                    onChange={(e) => setNewTicketType({ ...newTicketType, maxQuantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ticketBenefits">Benefits (optional)</Label>
                  <Input
                    id="ticketBenefits"
                    placeholder="e.g., Front row seating, VIP area access"
                    value={newTicketType.benefits}
                    onChange={(e) => setNewTicketType({ ...newTicketType, benefits: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="ticketDescription">Description (optional)</Label>
                  <Textarea
                    id="ticketDescription"
                    placeholder="Describe what this ticket includes..."
                    value={newTicketType.description}
                    onChange={(e) => setNewTicketType({ ...newTicketType, description: e.target.value })}
                  />
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={handleCreateTicketType}
                disabled={createTicketTypeMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                {createTicketTypeMutation.isPending ? "Adding..." : "Add Ticket Type"}
              </Button>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setTicketTypesModal(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Create Event Modal */}
      <AdminCreateEventModal open={createModal} onClose={() => setCreateModal(false)} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteModal} onOpenChange={setDeleteModal}>
        <AlertDialogContent className="w-[95vw] max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
              All associated tickets, RSVPs, and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setEventToDelete(null)} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEvent}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventManagement;