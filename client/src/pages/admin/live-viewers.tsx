import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Helmet } from "react-helmet";
import { 
  Search, 
  Monitor, 
  UserPlus, 
  Trash2, 
  ExternalLink,
  Copy,
  CheckCircle,
  Users,
  Calendar,
  Swords,
  Settings,
  Loader2,
  Trophy
} from "lucide-react";

type User = {
  id: number;
  displayName: string | null;
  email?: string;
  role: string;
  profilePicture: string | null;
};

type Event = {
  id: number;
  title: string;
  date: string;
};

type BattleCategory = {
  id: number;
  name: string;
  eventId: number;
};

type LiveViewer = {
  id: number;
  eventId: number;
  userId: number;
  categoryId: number | null;
  grantedByUserId: number;
  createdAt: string;
  user?: User;
  category?: BattleCategory;
};

type Dancer = {
  id: number;
  username?: string;
  displayName: string | null;
  profilePicture: string | null;
};

type Matchup = {
  id: number;
  eventId: number;
  categoryId: number;
  round: number;
  position: number;
  status: string;
  bestOf: number;
  currentRound: number;
  dancerARoundWins: number;
  dancerBRoundWins: number;
  dancerA: Dancer | null;
  dancerB: Dancer | null;
  winner: Dancer | null;
};

export default function LiveViewersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddViewerDialogOpen, setIsAddViewerDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedBattleCategoryId, setSelectedBattleCategoryId] = useState<string>("");

  // Fetch events for selection
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  // Fetch categories for selected event
  const { data: categories = [] } = useQuery<BattleCategory[]>({
    queryKey: ["/api/events", selectedEventId, "battle-categories"],
    enabled: !!selectedEventId,
  });

  // Fetch current live viewers for selected event
  const { data: liveViewers = [], isLoading: isLoadingViewers } = useQuery<LiveViewer[]>({
    queryKey: ["/api/events", selectedEventId, "live-viewers"],
    enabled: !!selectedEventId,
  });

  // Fetch matchups for selected category (for battle settings)
  const { data: matchups = [], isLoading: isLoadingMatchups } = useQuery<Matchup[]>({
    queryKey: ["/api/events", selectedEventId, "categories", selectedBattleCategoryId, "matchups"],
    enabled: !!selectedEventId && !!selectedBattleCategoryId,
  });

  // Search users
  const { data: searchResults = [], isLoading: isSearching } = useQuery<User[]>({
    queryKey: ["/api/users/search", searchQuery],
    queryFn: async () => {
      const response = await apiRequest('/api/users/search', 'GET', { q: searchQuery });
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Grant viewer access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async ({ userId, categoryId }: { userId: number; categoryId: number | null }) => {
      return apiRequest(`/api/events/${selectedEventId}/live-viewers`, "POST", {
        targetUserId: userId,
        categoryId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Viewer access granted",
        description: `${selectedUser?.displayName || "User"} can now display live results`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events", selectedEventId, "live-viewers"] });
      setIsAddViewerDialogOpen(false);
      setSelectedUser(null);
      setSearchQuery("");
      setSelectedCategoryId("all");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to grant access",
        description: error.message || "Could not grant viewer access",
        variant: "destructive",
      });
    },
  });

  // Revoke viewer access mutation
  const revokeAccessMutation = useMutation({
    mutationFn: async (viewerId: number) => {
      return apiRequest(`/api/events/${selectedEventId}/live-viewers/${viewerId}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Viewer access revoked",
        description: "User can no longer view live results",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events", selectedEventId, "live-viewers"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to revoke access",
        description: error.message || "Could not revoke viewer access",
        variant: "destructive",
      });
    },
  });

  // Update matchup bestOf setting
  const updateBestOfMutation = useMutation({
    mutationFn: async ({ matchupId, bestOf }: { matchupId: number; bestOf: number }) => {
      return apiRequest(`/api/matchups/${matchupId}`, "PATCH", { bestOf });
    },
    onSuccess: (_, { bestOf }) => {
      toast({
        title: "Battle format updated",
        description: `Matchup set to Best of ${bestOf}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events", selectedEventId, "categories", selectedBattleCategoryId, "matchups"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update battle format",
        description: error.message || "Could not update battle settings",
        variant: "destructive",
      });
    },
  });

  const handleGrantAccess = () => {
    if (!selectedUser || !selectedEventId) return;
    
    const categoryId = selectedCategoryId === "all" ? null : parseInt(selectedCategoryId);
    grantAccessMutation.mutate({ userId: selectedUser.id, categoryId });
  };

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/live-results/${selectedEventId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast({
      title: "URL copied",
      description: "Live results URL copied to clipboard",
    });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getDancerName = (dancer: Dancer | null) => {
    if (!dancer) return "TBD";
    return dancer.displayName || dancer.username || `Dancer #${dancer.id}`;
  };

  // Filter matchups that are active or pending (not completed)
  const activeMatchups = matchups.filter(m => m.status !== 'completed' && m.status !== 'COMPLETED');

  // Check if user is admin
  if (!["admin", "super_admin"].includes(user?.role ?? "")) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Live Viewers Management | Urban Culture Admin</title>
      </Helmet>

      <div className="container py-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Monitor className="w-8 h-8 text-primary" />
            Live Viewers Management
          </h1>
          <p className="text-muted-foreground">
            Grant users access to display live battle results on projectors or external screens for audiences.
          </p>
        </div>

        {/* Event Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Select Event
            </CardTitle>
            <CardDescription>
              Choose an event to manage live viewer access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-full sm:w-[300px]" data-testid="select-event">
                  <SelectValue placeholder="Select an event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id.toString()}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEventId && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCopyUrl}
                    className="flex items-center gap-2"
                    data-testid="button-copy-url"
                  >
                    {copiedUrl ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    Copy Live URL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/live-results/${selectedEventId}`, "_blank")}
                    className="flex items-center gap-2"
                    data-testid="button-open-live"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Live View
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Viewers & Add New */}
        {selectedEventId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Authorized Viewers
                </CardTitle>
                <CardDescription>
                  Users who can access the live results display for this event
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsAddViewerDialogOpen(true)}
                className="flex items-center gap-2"
                data-testid="button-add-viewer"
              >
                <UserPlus className="w-4 h-4" />
                Add Viewer
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingViewers ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading viewers...
                </div>
              ) : liveViewers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Monitor className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No viewers have been granted access yet.</p>
                  <p className="text-sm mt-1">Add users who need to display live results to audiences.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Category Access</TableHead>
                      <TableHead>Granted</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveViewers.map((viewer) => (
                      <TableRow key={viewer.id} data-testid={`row-viewer-${viewer.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={viewer.user?.profilePicture || undefined} />
                              <AvatarFallback>{getInitials(viewer.user?.displayName || null)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{viewer.user?.displayName || "Unknown User"}</div>
                              <div className="text-xs text-muted-foreground">{viewer.user?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {viewer.categoryId ? (
                            <Badge variant="secondary">{viewer.category?.name || `Category ${viewer.categoryId}`}</Badge>
                          ) : (
                            <Badge variant="outline">All Categories</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(viewer.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeAccessMutation.mutate(viewer.id)}
                            disabled={revokeAccessMutation.isPending}
                            data-testid={`button-revoke-${viewer.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Battle Settings Section */}
        {selectedEventId && categories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Battle Settings
              </CardTitle>
              <CardDescription>
                Configure round format for active battles (Best of 1, 3, 5, 7, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Selection for Battle Settings */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedBattleCategoryId} onValueChange={setSelectedBattleCategoryId}>
                  <SelectTrigger className="w-full sm:w-[300px]" data-testid="select-battle-category">
                    <SelectValue placeholder="Select a category to manage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Matchups Table */}
              {selectedBattleCategoryId ? (
                isLoadingMatchups ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading matchups...
                  </div>
                ) : activeMatchups.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Swords className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No active matchups found.</p>
                    <p className="text-sm mt-1">All battles have been completed or brackets haven't been generated yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Battle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Current Score</TableHead>
                        <TableHead className="w-[180px]">Format</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeMatchups.map((matchup) => (
                        <TableRow key={matchup.id} data-testid={`row-matchup-${matchup.id}`}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="font-medium">
                                {getDancerName(matchup.dancerA)} vs {getDancerName(matchup.dancerB)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Round {matchup.round}, Position {matchup.position}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={matchup.status === 'voting' || matchup.status === 'VOTING' ? 'default' : 'secondary'}
                              className={matchup.status === 'voting' || matchup.status === 'VOTING' ? 'bg-green-500 animate-pulse' : ''}
                            >
                              {matchup.status === 'voting' || matchup.status === 'VOTING' ? 'LIVE' : matchup.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(matchup.bestOf || 1) > 1 ? (
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{matchup.dancerARoundWins || 0}</span>
                                <span className="text-muted-foreground">-</span>
                                <span className="font-bold">{matchup.dancerBRoundWins || 0}</span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  (R{matchup.currentRound || 1})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Single round</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={(matchup.bestOf || 1).toString()}
                              onValueChange={(value) => {
                                updateBestOfMutation.mutate({ 
                                  matchupId: matchup.id, 
                                  bestOf: parseInt(value) 
                                });
                              }}
                              disabled={updateBestOfMutation.isPending}
                            >
                              <SelectTrigger 
                                className="w-[150px]" 
                                data-testid={`select-bestof-${matchup.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Best of 1</SelectItem>
                                <SelectItem value="3">Best of 3</SelectItem>
                                <SelectItem value="5">Best of 5</SelectItem>
                                <SelectItem value="7">Best of 7</SelectItem>
                                <SelectItem value="9">Best of 9</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                <div className="py-6 text-center text-muted-foreground border rounded-md bg-muted/30">
                  <Swords className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a category above to manage battle formats</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Viewer Dialog */}
        <Dialog open={isAddViewerDialogOpen} onOpenChange={setIsAddViewerDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Live Viewer</DialogTitle>
              <DialogDescription>
                Search for a user and grant them access to display live battle results.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* User Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search User</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-user"
                  />
                </div>

                {/* Search Results */}
                {searchQuery.length >= 2 && (
                  <div className="border rounded-md max-h-[200px] overflow-y-auto">
                    {isSearching ? (
                      <div className="p-4 text-center text-muted-foreground">Searching...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No users found</div>
                    ) : (
                      <div className="divide-y">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => {
                              setSelectedUser(result);
                              setSearchQuery(result.displayName || "");
                            }}
                            className={`w-full flex items-center gap-3 p-3 text-left hover-elevate transition-colors ${
                              selectedUser?.id === result.id ? "bg-primary/10" : ""
                            }`}
                            data-testid={`button-select-user-${result.id}`}
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={result.profilePicture || undefined} />
                              <AvatarFallback>{getInitials(result.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{result.displayName || "Unnamed User"}</div>
                              <div className="text-xs text-muted-foreground truncate">{result.email}</div>
                            </div>
                            {result.role === "admin" && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected User Display */}
              {selectedUser && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-md border">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedUser.profilePicture || undefined} />
                    <AvatarFallback>{getInitials(selectedUser.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{selectedUser.displayName}</div>
                    <div className="text-sm text-muted-foreground">Selected for viewer access</div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              )}

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category Access</label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category access..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose "All Categories" for full event access, or select a specific category.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddViewerDialogOpen(false);
                  setSelectedUser(null);
                  setSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGrantAccess}
                disabled={!selectedUser || grantAccessMutation.isPending}
                data-testid="button-confirm-grant"
              >
                {grantAccessMutation.isPending ? "Granting..." : "Grant Access"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
