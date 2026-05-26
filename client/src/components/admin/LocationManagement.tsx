import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Location } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MapPin, 
  Search, 
  Check, 
  X, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Loader2,
  ExternalLink,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  MoreVertical,
  RefreshCw,
  Plus,
  Star,
  StarOff
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LocationFilterType = "all" | "pending" | "approved" | "rejected";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.2 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

const LocationManagement = () => {
  const [filter, setFilter] = useState<LocationFilterType>("all");
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [createModal, setCreateModal] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    description: "",
    address: "",
    latitude: "",
    longitude: "",
    type: "dance",
    accessibility: "unknown",
    skillLevel: "all",
    surfaceType: "",
    openingHours: "",
    isFree: true,
    website: "",
    contactInfo: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidateAllLocationQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations", { showAll: true }] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users/saved-locations"] });
  };

  const { data: locations = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/locations", { showAll: true }],
    queryFn: async () => {
      const response = await apiRequest("/api/locations?showAll=true", "GET");
      return response.json();
    }
  });

  const { data: spotlightStatusMap = {} } = useQuery<Record<number, { spotlightId: number; active: boolean; isSuperFeatured: boolean }>>({
    queryKey: ["/api/admin/locations/spotlight-status"],
    queryFn: async () => {
      const response = await apiRequest("/api/admin/locations/spotlight-status", "GET");
      return response.json();
    }
  });

  const spotlightMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const response = await apiRequest(`/api/admin/locations/${locationId}/spotlight`, "POST");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locations/spotlight-status"] });
      toast({ title: "Spot spotlighted", description: "This spot will now appear on the map with spotlight styling" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to spotlight", description: error.message || "Could not spotlight this spot", variant: "destructive" });
    },
  });

  const unspotlightMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const response = await apiRequest(`/api/admin/locations/${locationId}/spotlight`, "DELETE");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/locations/spotlight-status"] });
      toast({ title: "Spotlight removed", description: "The spot has been removed from the spotlight layer" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove spotlight", description: error.message || "Could not remove spotlight", variant: "destructive" });
    },
  });

  const filteredLocations = locations.filter((location: Location) => {
    const matchesSearch = search === "" || 
      location.name?.toLowerCase().includes(search.toLowerCase()) ||
      location.description?.toLowerCase().includes(search.toLowerCase()) ||
      location.address?.toLowerCase().includes(search.toLowerCase());
    
    let matchesFilter;
    switch (filter) {
      case "pending":
        matchesFilter = location.approvalStatus === "pending" || !location.approvalStatus;
        break;
      case "approved":
        matchesFilter = location.approvalStatus === "approved";
        break;
      case "rejected":
        matchesFilter = location.approvalStatus === "rejected";
        break;
      default:
        matchesFilter = true;
    }
    
    return matchesSearch && matchesFilter;
  });

  const createMutation = useMutation({
    mutationFn: async (locationData: typeof newLocation) => {
      return apiRequest("/api/locations", "POST", {
        ...locationData,
        createdBy: user?.id,
        approvalStatus: "approved",
        isVisible: true,
      });
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setCreateModal(false);
      setNewLocation({
        name: "",
        description: "",
        address: "",
        latitude: "",
        longitude: "",
        type: "dance",
        accessibility: "unknown",
        skillLevel: "all",
        surfaceType: "",
        openingHours: "",
        isFree: true,
        website: "",
        contactInfo: "",
      });
      toast({
        title: "Spot created",
        description: "The spot has been created and is now visible to users",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create spot",
        description: error.message || "Could not create spot",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (locationId: number) => {
      return apiRequest(`/api/locations/${locationId}/approve`, "POST");
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      toast({
        title: "Spot approved",
        description: "The spot has been approved and is now visible to users",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to approve spot",
        description: error.message || "Could not approve spot",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ locationId, reason }: { locationId: number; reason: string }) => {
      return apiRequest(`/api/locations/${locationId}/reject`, "POST", { reason });
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setRejectModal(false);
      setRejectReason("");
      toast({
        title: "Spot rejected",
        description: "The spot has been rejected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject spot",
        description: error.message || "Could not reject spot",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ locationId, isVisible }: { locationId: number; isVisible: boolean }) => {
      return apiRequest(`/api/locations/${locationId}/visibility`, "POST", { isVisible });
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      toast({
        title: "Visibility updated",
        description: "The spot visibility has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update visibility",
        description: error.message || "Could not update visibility",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (locationId: number) => {
      return apiRequest(`/api/locations/${locationId}`, "DELETE");
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setDeleteModal(false);
      setSelectedLocation(null);
      toast({
        title: "Spot deleted",
        description: "The spot has been permanently deleted from everywhere",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete spot",
        description: error.message || "Could not delete spot",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ locationId, data }: { locationId: number; data: Partial<Location> }) => {
      return apiRequest(`/api/locations/${locationId}`, "PATCH", data);
    },
    onSuccess: () => {
      invalidateAllLocationQueries();
      setEditModal(false);
      toast({
        title: "Spot updated",
        description: "The spot has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update spot",
        description: error.message || "Could not update spot",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (location: Location) => {
    approveMutation.mutate(location.id);
  };

  const handleBulkApprove = async () => {
    const results = { success: [] as number[], failed: [] as number[] };
    
    for (const id of selectedLocations) {
      try {
        await approveMutation.mutateAsync(id);
        results.success.push(id);
      } catch (error) {
        results.failed.push(id);
      }
    }
    
    if (results.failed.length === 0) {
      setSelectedLocations([]);
      toast({
        title: "Bulk approve complete",
        description: `All ${results.success.length} spots have been approved`,
      });
    } else if (results.success.length > 0) {
      setSelectedLocations(results.failed);
      toast({
        title: "Partial success",
        description: `${results.success.length} approved, ${results.failed.length} failed. Failed spots remain selected.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bulk approve failed",
        description: "Could not approve any of the selected spots",
        variant: "destructive",
      });
    }
    
    invalidateAllLocationQueries();
  };

  const handleCreateSubmit = () => {
    if (!newLocation.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the spot",
        variant: "destructive",
      });
      return;
    }
    if (!newLocation.latitude || !newLocation.longitude) {
      toast({
        title: "Coordinates required",
        description: "Please enter latitude and longitude for the spot",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newLocation);
  };

  const handleRejectClick = (location: Location) => {
    setSelectedLocation(location);
    setRejectModal(true);
  };

  const handleRejectConfirm = () => {
    if (selectedLocation) {
      rejectMutation.mutate({ 
        locationId: selectedLocation.id, 
        reason: rejectReason || "Rejected by admin" 
      });
    }
  };

  const handleEditClick = (location: Location) => {
    setSelectedLocation(location);
    setEditModal(true);
  };

  const handleDeleteClick = (location: Location) => {
    setSelectedLocation(location);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedLocation) {
      deleteMutation.mutate(selectedLocation.id);
    }
  };

  const handleToggleVisibility = (location: Location) => {
    toggleVisibilityMutation.mutate({ 
      locationId: location.id, 
      isVisible: !location.isVisible 
    });
  };

  const handleSaveEdit = () => {
    if (selectedLocation) {
      updateMutation.mutate({
        locationId: selectedLocation.id,
        data: {
          name: selectedLocation.name,
          description: selectedLocation.description,
          address: selectedLocation.address,
          type: selectedLocation.type,
          accessibility: selectedLocation.accessibility,
          openingHours: selectedLocation.openingHours,
          surfaceType: selectedLocation.surfaceType,
          skillLevel: selectedLocation.skillLevel,
          isFree: selectedLocation.isFree,
          website: selectedLocation.website,
          contactInfo: selectedLocation.contactInfo,
        }
      });
    }
  };

  const toggleSelectLocation = (id: number) => {
    setSelectedLocations(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLocations.length === filteredLocations.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(filteredLocations.map((l: Location) => l.id));
    }
  };

  const getStatusBadge = (location: Location) => {
    const status = location.approvalStatus || "pending";
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const typeLabels: Record<string, string> = {
      graffiti: "Graffiti",
      dance: "Dance",
      music: "Music",
      rap: "Rap",
      performance: "Performance",
      skate: "Skate",
      parkour: "Parkour",
      training: "Training",
      bmx: "BMX",
      street_sports: "Street Sports",
      cultural_hub: "Cultural Hub",
      open_mic: "Open Mic",
      workshop: "Workshop",
    };
    return <Badge variant="outline">{typeLabels[type] || type}</Badge>;
  };

  const pendingCount = locations.filter((l: Location) => l.approvalStatus === "pending" || !l.approvalStatus).length;
  const approvedCount = locations.filter((l: Location) => l.approvalStatus === "approved").length;
  const rejectedCount = locations.filter((l: Location) => l.approvalStatus === "rejected").length;

  if (isLoading) {
    return (
      <motion.div 
        className="flex items-center justify-center py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading spots...</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Spot Management</h2>
          <p className="text-sm text-muted-foreground">Manage all user-submitted spots and locations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {pendingCount} pending
            </Badge>
          )}
          <Button 
            size="sm" 
            onClick={() => setCreateModal(true)}
            data-testid="button-create-spot"
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Create Spot</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-spots"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search spots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-spots"
          />
        </div>
        
        {selectedLocations.length > 0 && filter === "pending" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-muted-foreground">
              {selectedLocations.length} selected
            </span>
            <Button 
              size="sm" 
              onClick={handleBulkApprove}
              disabled={approveMutation.isPending}
              data-testid="button-bulk-approve"
            >
              <Check className="h-4 w-4 mr-1" />
              Approve All
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedLocations([])}
              data-testid="button-clear-selection"
            >
              Clear
            </Button>
          </motion.div>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as LocationFilterType)}>
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-lg gap-1">
            <TabsTrigger 
              value="pending" 
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background"
              data-testid="tab-pending"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pending</span>
              <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="approved"
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background"
              data-testid="tab-approved"
            >
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Approved</span>
              <Badge variant="secondary" className="ml-1">{approvedCount}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="rejected"
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background"
              data-testid="tab-rejected"
            >
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Rejected</span>
              <Badge variant="secondary" className="ml-1">{rejectedCount}</Badge>
            </TabsTrigger>
            <TabsTrigger 
              value="all"
              className="flex items-center gap-2 px-3 py-2 data-[state=active]:bg-background"
              data-testid="tab-all"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
              <Badge variant="secondary" className="ml-1">{locations.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value={filter} className="mt-4">
          <AnimatePresence mode="popLayout">
            {filteredLocations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No spots found</p>
                    <p className="text-sm">
                      {search ? "Try adjusting your search terms" : `No ${filter} spots at the moment`}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {filter === "pending" && filteredLocations.length > 1 && (
                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox
                      checked={selectedLocations.length === filteredLocations.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-sm text-muted-foreground">Select all</span>
                  </div>
                )}
                
                {filteredLocations.map((location: Location) => (
                  <motion.div
                    key={location.id}
                    variants={fadeInUp}
                    layout
                  >
                    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex gap-3 sm:gap-4">
                          {filter === "pending" && (
                            <div className="flex items-start pt-1">
                              <Checkbox
                                checked={selectedLocations.includes(location.id)}
                                onCheckedChange={() => toggleSelectLocation(location.id)}
                                data-testid={`checkbox-select-${location.id}`}
                              />
                            </div>
                          )}
                          
                          {location.images && location.images.length > 0 && (
                            <div className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0">
                              <img
                                src={location.images[0]}
                                alt={location.name}
                                className="w-full h-full object-cover rounded-md"
                              />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-start gap-2 mb-1">
                              <h3 className="text-base sm:text-lg font-semibold truncate">{location.name}</h3>
                              <div className="flex flex-wrap gap-1">
                                {getStatusBadge(location)}
                                {location.type && getTypeBadge(location.type)}
                                {!location.isVisible && (
                                  <Badge variant="outline" className="border-orange-500 text-orange-500 gap-1">
                                    <EyeOff className="h-3 w-3" />
                                    Hidden
                                  </Badge>
                                )}
                                {spotlightStatusMap[location.id] && (
                                  <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/50 gap-1" variant="outline" data-testid={`badge-spotlighted-${location.id}`}>
                                    <Star className="h-3 w-3 fill-current" />
                                    Spotlighted
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                              {location.description}
                            </p>
                            
                            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              {location.address && (
                                <div className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-[250px]">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{location.address}</span>
                                </div>
                              )}
                              {location.createdBy && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>ID: {location.createdBy}</span>
                                </div>
                              )}
                            </div>
                            
                            {location.rejectionReason && (
                              <div className="mt-2 p-2 bg-destructive/10 rounded text-xs sm:text-sm text-destructive">
                                <strong>Reason:</strong> {location.rejectionReason}
                              </div>
                            )}
                          </div>
                          
                          <div className="hidden lg:flex flex-col gap-2">
                            {(location.approvalStatus === "pending" || !location.approvalStatus) && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(location)}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-${location.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleRejectClick(location)}
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-reject-${location.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              data-testid={`button-view-${location.id}`}
                            >
                              <Link to={`/locations/${location.id}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Link>
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(location)}
                              data-testid={`button-edit-${location.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleVisibility(location)}
                              disabled={toggleVisibilityMutation.isPending}
                              data-testid={`button-visibility-${location.id}`}
                            >
                              {location.isVisible ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-1" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Show
                                </>
                              )}
                            </Button>
                            
                            {location.approvalStatus === "approved" && (
                              spotlightStatusMap[location.id] ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                                  onClick={() => unspotlightMutation.mutate(location.id)}
                                  disabled={unspotlightMutation.isPending}
                                  data-testid={`button-unspotlight-${location.id}`}
                                >
                                  {unspotlightMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <StarOff className="h-4 w-4 mr-1" />}
                                  Unspotlight
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10"
                                  onClick={() => spotlightMutation.mutate(location.id)}
                                  disabled={spotlightMutation.isPending}
                                  data-testid={`button-spotlight-${location.id}`}
                                >
                                  {spotlightMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Star className="h-4 w-4 mr-1" />}
                                  Spotlight
                                </Button>
                              )
                            )}
                            
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteClick(location)}
                              data-testid={`button-delete-${location.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                          
                          <div className="lg:hidden">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid={`button-menu-${location.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(location.approvalStatus === "pending" || !location.approvalStatus) && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleApprove(location)}>
                                      <Check className="h-4 w-4 mr-2" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleRejectClick(location)}>
                                      <X className="h-4 w-4 mr-2" />
                                      Reject
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem asChild>
                                  <Link to={`/locations/${location.id}`} className="flex items-center">
                                    <Eye className="h-4 w-4 mr-2" />
                                    View in Community
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditClick(location)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleVisibility(location)}>
                                  {location.isVisible ? (
                                    <>
                                      <EyeOff className="h-4 w-4 mr-2" />
                                      Hide
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Show
                                    </>
                                  )}
                                </DropdownMenuItem>
                                {location.latitude && location.longitude && (
                                  <DropdownMenuItem onClick={() => window.open(
                                    `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                                    "_blank"
                                  )}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open in Maps
                                  </DropdownMenuItem>
                                )}
                                {location.approvalStatus === "approved" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    {spotlightStatusMap[location.id] ? (
                                      <DropdownMenuItem
                                        onClick={() => unspotlightMutation.mutate(location.id)}
                                        className="text-yellow-600 dark:text-yellow-400"
                                        data-testid={`dropdown-unspotlight-${location.id}`}
                                      >
                                        <StarOff className="h-4 w-4 mr-2" />
                                        Remove Spotlight
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => spotlightMutation.mutate(location.id)}
                                        className="text-yellow-600 dark:text-yellow-400"
                                        data-testid={`dropdown-spotlight-${location.id}`}
                                      >
                                        <Star className="h-4 w-4 mr-2" />
                                        Spotlight on Map
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClick(location)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      </Tabs>

      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Spot</DialogTitle>
          </DialogHeader>
          
          {selectedLocation && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={selectedLocation.name}
                    onChange={(e) => setSelectedLocation({
                      ...selectedLocation,
                      name: e.target.value
                    })}
                    data-testid="input-edit-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={selectedLocation.description || ""}
                    onChange={(e) => setSelectedLocation({
                      ...selectedLocation,
                      description: e.target.value
                    })}
                    rows={3}
                    data-testid="input-edit-description"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={selectedLocation.address || ""}
                    onChange={(e) => setSelectedLocation({
                      ...selectedLocation,
                      address: e.target.value
                    })}
                    data-testid="input-edit-address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-lat">Latitude</Label>
                    <Input
                      id="edit-lat"
                      type="number"
                      step="any"
                      value={selectedLocation.latitude || ""}
                      onChange={(e) => setSelectedLocation({ ...selectedLocation, latitude: e.target.value })}
                      placeholder="e.g. 52.3676"
                      data-testid="input-edit-lat"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-lon">Longitude</Label>
                    <Input
                      id="edit-lon"
                      type="number"
                      step="any"
                      value={selectedLocation.longitude || ""}
                      onChange={(e) => setSelectedLocation({ ...selectedLocation, longitude: e.target.value })}
                      placeholder="e.g. 4.9041"
                      data-testid="input-edit-lon"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-type">Type</Label>
                    <Select
                      value={selectedLocation.type}
                      onValueChange={(value) => setSelectedLocation({
                        ...selectedLocation,
                        type: value
                      })}
                    >
                      <SelectTrigger data-testid="select-edit-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="graffiti">Graffiti & Street Art</SelectItem>
                        <SelectItem value="dance">Dance Area</SelectItem>
                        <SelectItem value="music">Music Spot</SelectItem>
                        <SelectItem value="rap">Rap & Spoken Word</SelectItem>
                        <SelectItem value="performance">Performance Space</SelectItem>
                        <SelectItem value="skate">Skatepark</SelectItem>
                        <SelectItem value="parkour">Parkour</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="bmx">BMX</SelectItem>
                        <SelectItem value="street_sports">Street Sports</SelectItem>
                        <SelectItem value="cultural_hub">Cultural Hub</SelectItem>
                        <SelectItem value="open_mic">Open Mic</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-skill-level">Skill Level</Label>
                    <Select
                      value={selectedLocation.skillLevel || "all"}
                      onValueChange={(value) => setSelectedLocation({
                        ...selectedLocation,
                        skillLevel: value
                      })}
                    >
                      <SelectTrigger data-testid="select-edit-skill">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="all">All Levels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-surface">Surface Type</Label>
                    <Input
                      id="edit-surface"
                      value={selectedLocation.surfaceType || ""}
                      onChange={(e) => setSelectedLocation({
                        ...selectedLocation,
                        surfaceType: e.target.value
                      })}
                      placeholder="e.g., concrete, asphalt"
                      data-testid="input-edit-surface"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-accessibility">Accessibility</Label>
                    <Select
                      value={selectedLocation.accessibility || "unknown"}
                      onValueChange={(value) => setSelectedLocation({
                        ...selectedLocation,
                        accessibility: value
                      })}
                    >
                      <SelectTrigger data-testid="select-edit-accessibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wheelchair">Wheelchair Accessible</SelectItem>
                        <SelectItem value="limited">Limited Access</SelectItem>
                        <SelectItem value="not_accessible">Not Accessible</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="edit-hours">Opening Hours</Label>
                  <Input
                    id="edit-hours"
                    value={selectedLocation.openingHours || ""}
                    onChange={(e) => setSelectedLocation({
                      ...selectedLocation,
                      openingHours: e.target.value
                    })}
                    placeholder="e.g., 24/7 or Mon-Fri 9am-10pm"
                    data-testid="input-edit-hours"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-website">Website</Label>
                    <Input
                      id="edit-website"
                      type="url"
                      value={selectedLocation.website || ""}
                      onChange={(e) => setSelectedLocation({
                        ...selectedLocation,
                        website: e.target.value
                      })}
                      placeholder="https://..."
                      data-testid="input-edit-website"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-contact">Contact Info</Label>
                    <Input
                      id="edit-contact"
                      value={selectedLocation.contactInfo || ""}
                      onChange={(e) => setSelectedLocation({
                        ...selectedLocation,
                        contactInfo: e.target.value
                      })}
                      data-testid="input-edit-contact"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-free"
                    checked={selectedLocation.isFree ?? true}
                    onCheckedChange={(checked) => setSelectedLocation({
                      ...selectedLocation,
                      isFree: checked
                    })}
                    data-testid="switch-edit-free"
                  />
                  <Label htmlFor="edit-free">Free to use</Label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditModal(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModal} onOpenChange={setRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Spot</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this spot. This will be visible to the user who submitted it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Rejection Reason</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Duplicate entry, inaccurate location, inappropriate content..."
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectModal(false)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectConfirm} 
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Reject Spot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Spot</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{selectedLocation?.name}"? This action cannot be undone and will remove it from everywhere in the app.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModal(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm} 
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Spot</DialogTitle>
            <DialogDescription>
              Add a new spot directly as an admin. It will be automatically approved and visible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="Enter spot name"
                  data-testid="input-create-name"
                />
              </div>
              
              <div>
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={newLocation.description}
                  onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                  placeholder="Describe this spot..."
                  rows={3}
                  data-testid="input-create-description"
                />
              </div>
              
              <div>
                <Label htmlFor="create-address">Address</Label>
                <Input
                  id="create-address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  placeholder="Enter address"
                  data-testid="input-create-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-lat">Latitude *</Label>
                  <Input
                    id="create-lat"
                    type="number"
                    step="any"
                    value={newLocation.latitude}
                    onChange={(e) => setNewLocation({ ...newLocation, latitude: e.target.value })}
                    placeholder="e.g. 52.3676"
                    data-testid="input-create-lat"
                  />
                </div>
                <div>
                  <Label htmlFor="create-lon">Longitude *</Label>
                  <Input
                    id="create-lon"
                    type="number"
                    step="any"
                    value={newLocation.longitude}
                    onChange={(e) => setNewLocation({ ...newLocation, longitude: e.target.value })}
                    placeholder="e.g. 4.9041"
                    data-testid="input-create-lon"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-type">Type</Label>
                  <Select
                    value={newLocation.type}
                    onValueChange={(value) => setNewLocation({ ...newLocation, type: value })}
                  >
                    <SelectTrigger data-testid="select-create-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="graffiti">Graffiti & Street Art</SelectItem>
                      <SelectItem value="dance">Dance Area</SelectItem>
                      <SelectItem value="music">Music Spot</SelectItem>
                      <SelectItem value="rap">Rap & Spoken Word</SelectItem>
                      <SelectItem value="performance">Performance Space</SelectItem>
                      <SelectItem value="skate">Skatepark</SelectItem>
                      <SelectItem value="parkour">Parkour</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="bmx">BMX</SelectItem>
                      <SelectItem value="street_sports">Street Sports</SelectItem>
                      <SelectItem value="cultural_hub">Cultural Hub</SelectItem>
                      <SelectItem value="open_mic">Open Mic</SelectItem>
                      <SelectItem value="workshop">Workshop</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="create-skill-level">Skill Level</Label>
                  <Select
                    value={newLocation.skillLevel}
                    onValueChange={(value) => setNewLocation({ ...newLocation, skillLevel: value })}
                  >
                    <SelectTrigger data-testid="select-create-skill">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="all">All Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-surface">Surface Type</Label>
                  <Input
                    id="create-surface"
                    value={newLocation.surfaceType}
                    onChange={(e) => setNewLocation({ ...newLocation, surfaceType: e.target.value })}
                    placeholder="e.g., concrete, asphalt"
                    data-testid="input-create-surface"
                  />
                </div>
                
                <div>
                  <Label htmlFor="create-accessibility">Accessibility</Label>
                  <Select
                    value={newLocation.accessibility}
                    onValueChange={(value) => setNewLocation({ ...newLocation, accessibility: value })}
                  >
                    <SelectTrigger data-testid="select-create-accessibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wheelchair">Wheelchair Accessible</SelectItem>
                      <SelectItem value="limited">Limited Access</SelectItem>
                      <SelectItem value="not_accessible">Not Accessible</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-hours">Opening Hours</Label>
                <Input
                  id="create-hours"
                  value={newLocation.openingHours}
                  onChange={(e) => setNewLocation({ ...newLocation, openingHours: e.target.value })}
                  placeholder="e.g., 24/7 or Mon-Fri 9am-10pm"
                  data-testid="input-create-hours"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-website">Website</Label>
                  <Input
                    id="create-website"
                    type="url"
                    value={newLocation.website}
                    onChange={(e) => setNewLocation({ ...newLocation, website: e.target.value })}
                    placeholder="https://..."
                    data-testid="input-create-website"
                  />
                </div>
                
                <div>
                  <Label htmlFor="create-contact">Contact Info</Label>
                  <Input
                    id="create-contact"
                    value={newLocation.contactInfo}
                    onChange={(e) => setNewLocation({ ...newLocation, contactInfo: e.target.value })}
                    placeholder="Email or phone"
                    data-testid="input-create-contact"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="create-free"
                  checked={newLocation.isFree}
                  onCheckedChange={(checked) => setNewLocation({ ...newLocation, isFree: checked })}
                  data-testid="switch-create-free"
                />
                <Label htmlFor="create-free">Free to use</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateModal(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSubmit} 
              disabled={createMutation.isPending || !newLocation.name.trim()}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Create Spot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default LocationManagement;
