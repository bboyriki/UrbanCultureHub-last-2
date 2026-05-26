import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { Membership } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Search, X, BarChart3, Calendar, RefreshCw, AlertCircle } from "lucide-react";

interface MembershipWithUser extends Membership {
  user: {
    id: number;
    email: string;
    displayName: string;
    profilePicture?: string;
  };
}

const MembershipManagement = () => {
  const [activeTab, setActiveTab] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<MembershipWithUser | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "endDate">("newest");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { toast } = useToast();

  // Fetch all memberships with user data
  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ["/api/admin/memberships"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/admin/memberships", "GET");
        return await response.json();
      } catch (error) {
        console.error("Failed to fetch memberships:", error);
        return [];
      }
    }
  });

  // Fetch premium membership stats
  const { data: membershipStats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/admin/memberships/stats"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/admin/memberships/stats", "GET");
        return await response.json();
      } catch (error) {
        console.error("Failed to fetch membership stats:", error);
        return {
          totalMembers: 0,
          monthlyMembers: 0,
          yearlyMembers: 0,
          activeMembers: 0,
          expiredMembers: 0,
          cancelledMembers: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          averageLifetime: 0
        };
      }
    }
  });

  // Mutation to cancel a membership
  const { mutate: cancelMembership, isPending: isCancelling } = useMutation({
    mutationFn: async (membershipId: number) => {
      const response = await apiRequest(`/api/admin/memberships/${membershipId}/cancel`, "POST");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to cancel membership");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Cancelled",
        description: "The membership has been cancelled successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to extend a membership
  const { mutate: extendMembership, isPending: isExtending } = useMutation({
    mutationFn: async ({ membershipId, months }: { membershipId: number; months: number }) => {
      const response = await apiRequest(`/api/admin/memberships/${membershipId}/extend`, "POST", {
        months
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to extend membership");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Extended",
        description: "The membership has been extended successfully."
      });
      setIsExtendDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Mutation to manually add a membership
  const { mutate: createMembership, isPending: isCreating } = useMutation({
    mutationFn: async (data: { userId: number; tier: string; period: string; months: number }) => {
      const response = await apiRequest("/api/admin/memberships", "POST", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create membership");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Membership Created",
        description: "The membership has been created successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/memberships/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Filter memberships based on search query and active tab
  const filteredMemberships = memberships.filter((membership: MembershipWithUser) => {
    // Filter by search query
    const matchesSearch = searchQuery === "" || 
      membership.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      membership.user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
    // Filter by status tab
    const matchesTab = 
      (activeTab === "active" && membership.status === "active") ||
      (activeTab === "cancelled" && membership.status === "cancelled") ||
      (activeTab === "expired" && membership.status === "expired") ||
      activeTab === "all";
      
    return matchesSearch && matchesTab;
  });

  // Sort memberships
  const sortedMemberships = [...filteredMemberships].sort((a, b) => {
    if (sortBy === "newest") {
      return sortDirection === "desc" 
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === "oldest") {
      return sortDirection === "desc"
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortBy === "endDate") {
      if (!a.endDate) return sortDirection === "desc" ? 1 : -1;
      if (!b.endDate) return sortDirection === "desc" ? -1 : 1;
      return sortDirection === "desc"
        ? new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
        : new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }
    return 0;
  });

  // Handle sorting
  const handleSort = (type: "newest" | "oldest" | "endDate") => {
    if (sortBy === type) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortDirection("desc");
    }
  };

  // Calculate remaining time in days
  const getRemainingDays = (endDate: string | null) => {
    if (!endDate) return 0;
    const now = new Date();
    const end = new Date(endDate);
    const diffInMs = end.getTime() - now.getTime();
    return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
  };

  // Format membership status with color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Cancelled</Badge>;
      case "expired":
        return <Badge variant="outline" className="border-red-500 text-red-500">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Premium Membership Management</h2>
          <p className="text-muted-foreground">Manage and track premium memberships</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsRevenueDialogOpen(true)}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Revenue Report
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Membership</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Premium Membership</DialogTitle>
                <DialogDescription>
                  Manually add a premium membership for a user.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="userId" className="text-right">
                    User ID
                  </Label>
                  <Input 
                    id="userId" 
                    type="number" 
                    className="col-span-3" 
                    placeholder="Enter user ID"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tier" className="text-right">
                    Tier
                  </Label>
                  <Select defaultValue="premium">
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="period" className="text-right">
                    Period
                  </Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="months" className="text-right">
                    Duration
                  </Label>
                  <Input 
                    id="months" 
                    type="number" 
                    className="col-span-3" 
                    placeholder="Months"
                    defaultValue="1"
                    min="1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>Cancel</Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Adding..." : "Add Membership"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Membership Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Premium Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {membershipStats?.totalMembers || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Memberships
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {membershipStats?.activeMembers || 0} 
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({Math.round(((membershipStats?.activeMembers || 0) / (membershipStats?.totalMembers || 1)) * 100)}%)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatPrice(membershipStats?.totalRevenue || 0)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatPrice(membershipStats?.monthlyRevenue || 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs and Table */}
      <div className="bg-card rounded-md border">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b">
            <TabsList className="mb-4 sm:mb-0">
              <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Active
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled
              </TabsTrigger>
              <TabsTrigger value="expired">
                Expired
              </TabsTrigger>
              <TabsTrigger value="all">
                All
              </TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search members..."
                className="pl-8 w-full sm:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="relative">
            {loadingMemberships ? (
              <div className="p-4">
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            ) : filteredMemberships.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <AlertCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">No memberships found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {searchQuery 
                    ? "Try adjusting your search query to find what you're looking for." 
                    : "There are no memberships in this category yet."}
                </p>
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>
                        <button 
                          className="flex items-center gap-1"
                          onClick={() => handleSort("newest")}
                        >
                          Date Created
                          {sortBy === "newest" && (
                            sortDirection === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )
                          )}
                        </button>
                      </TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>
                        <button 
                          className="flex items-center gap-1"
                          onClick={() => handleSort("endDate")}
                        >
                          Expires
                          {sortBy === "endDate" && (
                            sortDirection === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )
                          )}
                        </button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMemberships.map((membership: MembershipWithUser) => (
                      <TableRow key={membership.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {membership.user.profilePicture ? (
                              <img 
                                src={membership.user.profilePicture} 
                                alt={membership.user.displayName}
                                className="h-8 w-8 rounded-full object-cover" 
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-xs font-medium">
                                  {membership.user.displayName[0]}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{membership.user.displayName}</div>
                              <div className="text-xs text-muted-foreground">{membership.user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(membership.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {membership.period.charAt(0).toUpperCase() + membership.period.slice(1)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {membership.endDate ? (
                            <div>
                              <div className="font-medium">
                                {new Date(membership.endDate).toLocaleDateString()}
                              </div>
                              {membership.status === "active" && (
                                <div className="text-xs text-muted-foreground">
                                  {getRemainingDays(membership.endDate)} days left
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(membership.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedMembership(membership);
                                      setIsExtendDialogOpen(true);
                                    }}
                                    disabled={membership.status !== "active"}
                                  >
                                    <Calendar className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Extend Membership</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to cancel this membership?")) {
                                        cancelMembership(membership.id);
                                      }
                                    }}
                                    disabled={membership.status !== "active" || isCancelling}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Cancel Membership</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Tabs>
      </div>
      
      {/* Extend Membership Dialog */}
      <Dialog open={isExtendDialogOpen} onOpenChange={setIsExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Membership</DialogTitle>
            <DialogDescription>
              Extend the membership period for {selectedMembership?.user.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="extendMonths" className="text-right">
                Add Months
              </Label>
              <Input 
                id="extendMonths" 
                type="number" 
                className="col-span-3" 
                placeholder="Number of months"
                defaultValue="1"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedMembership && extendMembership({ 
                membershipId: selectedMembership.id, 
                months: 1 // Replace with actual input value
              })}
              disabled={isExtending}
            >
              {isExtending ? "Extending..." : "Extend Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Revenue Report Dialog */}
      <Dialog open={isRevenueDialogOpen} onOpenChange={setIsRevenueDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Premium Membership Revenue</DialogTitle>
            <DialogDescription>
              Monthly and yearly revenue breakdown
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {loadingStats ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Monthly Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {membershipStats?.monthlyMembers || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Yearly Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {membershipStats?.yearlyMembers || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPrice(membershipStats?.totalRevenue || 0)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Monthly Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatPrice(membershipStats?.monthlyRevenue || 0)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Average Membership Duration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {membershipStats?.averageLifetime || 0} days
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRevenueDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembershipManagement;