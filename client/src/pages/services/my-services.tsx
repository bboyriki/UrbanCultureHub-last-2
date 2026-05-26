import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash, Clock, Users, DollarSign, Plus, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function MyServicesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services", { providerId: user?.id }],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch(`/api/services?providerId=${user.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch services");
      }
      return response.json();
    },
    enabled: !!user,
  });
  
  // Redirect to login if not authenticated
  if (!user) {
    navigate("/auth");
    return null;
  }
  
  const handleCreateService = () => {
    navigate("/services/create");
  };
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Services</h1>
          <p className="text-muted-foreground mt-1">
            Manage services you offer in the marketplace
          </p>
        </div>
        <Button onClick={handleCreateService} className="flex items-center gap-2">
          <Plus size={16} />
          <span>Create New Service</span>
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {!services || services.length === 0 ? (
            <div className="text-center py-12 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">No Services Yet</h3>
              <p className="text-muted-foreground mb-6">You haven't created any services yet.</p>
              <Button onClick={handleCreateService}>
                Create Your First Service
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const { user } = useAuth();
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to delete services");
      
      // Prepare direct data with auth information
      const requestData = {
        userId: user.id,
        userRole: user.role
      };
      
      // Include auth data in both headers and params for robust permission checking
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id?.toString() || '',
          'X-User-Role': user.role || '',
        },
        withCredentials: true,
        params: {
          userId: user.id,
          userRole: user.role,
        }
      };
      
      // Log data for debugging
      console.log('Deleting service with auth data:', {
        serviceId: service.id,
        userId: user.id,
        userRole: user.role,
        serviceProviderId: service.providerId
      });
      
      try {
        // Try the request with direct data payload first
        const response = await fetch(`/api/services/${service.id}?userId=${user.id}&userRole=${user.role}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': user.id?.toString() || '',
            'X-User-Role': user.role || ''
          },
          credentials: 'include',
          body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Service deletion failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Service deletion failed: ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Service deletion error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Service deleted",
        description: "Your service has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('Service deletion mutation error:', error);
      
      // Check if the error message contains information about bookings
      const errorMessage = error?.message || "";
      
      if (errorMessage.includes("existing bookings")) {
        // Show specific toast for booking constraint error
        toast({
          title: "Service Deactivated",
          description: "This service has existing bookings and cannot be deleted. It has been deactivated and will no longer appear in search results or the marketplace.",
          variant: "default",
        });
        
        // Refresh the services list to show updated status
        queryClient.invalidateQueries({ queryKey: ["/api/services"] });
        setIsDeleteDialogOpen(false);
        return;
      }
      
      // Default error message for other errors
      toast({
        title: "Failed to delete service",
        description: error?.message || "There was an error deleting your service. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleEdit = () => {
    navigate(`/services/edit/${service.id}`);
  };
  
  const handleDelete = () => {
    deleteMutation.mutate();
  };
  
  const handleViewBookings = () => {
    navigate(`/bookings?serviceId=${service.id}`);
  };
  
  return (
    <Card className="overflow-hidden flex flex-col h-full">
      {service.images && service.images.length > 0 && (
        <div className="relative h-48 w-full overflow-hidden">
          <img 
            src={service.images[0]} 
            alt={service.name} 
            className="object-cover w-full h-full"
          />
          <Badge className="absolute top-2 right-2">
            {service.type}
          </Badge>
        </div>
      )}
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="line-clamp-1">{service.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Badge variant="outline">{service.category}</Badge>
              {service.isVerified && (
                <Badge variant="secondary">Verified</Badge>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">{formatPrice(parseInt(service.price))}</div>
            <div className="text-xs text-muted-foreground">per session</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-muted-foreground line-clamp-3 mb-3">{service.description}</p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted-foreground" />
            <span>{service.duration} minutes</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <span>
              {service.maxParticipants 
                ? `Max ${service.maxParticipants} participants`
                : "Unlimited participants"
              }
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-muted-foreground" />
            <span>{service.isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button variant="outline" onClick={handleEdit} className="flex items-center justify-center gap-2">
            <Pencil size={14} />
            <span>Edit</span>
          </Button>
          
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center justify-center gap-2">
                <Trash size={14} />
                <span>Delete</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Service</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this service? This action cannot be undone.
                  <p className="mt-2 text-sm">
                    Note: Services with existing bookings will be deactivated instead of completely removed to preserve booking history.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Service"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <Button 
          variant="default" 
          className="w-full"
          onClick={handleViewBookings}
        >
          View Bookings
        </Button>
      </CardFooter>
    </Card>
  );
}