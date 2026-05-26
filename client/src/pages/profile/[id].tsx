import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useServicesAccess } from "@/components/services/ServicesGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/community/PostCard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageHeaderHeading } from "@/components/ui/page-header";
import { PageHeaderDescription } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, User, Map, Clock, CheckCircle, Calendar, UserPlus, UserMinus, Settings, Send, ExternalLink, Award, Mail, Shield, Phone as PhoneIcon, Ticket, LogOut, MessageCircle, UserX, Users } from "lucide-react";
import { FollowButton, FollowersList, FollowingList } from "@/components/follow";
import { BlockUserButton } from "@/components/common/BlockUserButton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function UserProfilePage() {
  const [, params] = useRoute("/profile/:id");
  const userId = params?.id ? parseInt(params.id) : null;
  const { user: currentUser } = useAuth();
  const servicesAccess = useServicesAccess();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("posts");
  


  // Fetch user profile data with direct URL format and proper JSON parsing
  const { 
    data: user, 
    isLoading: isLoadingUser,
    error: userError
  } = useQuery({
    queryKey: [`/api/users/${userId}`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}`);
      // Check if we need to process the response
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response; // Already processed JSON
    },
    enabled: Boolean(userId),
    staleTime: 0, // Always fetch fresh data
    retry: 3
  });
  

  // Fetch user posts using the correct URL format for the queryKey with proper response handling
  const { 
    data: userPosts = [], 
    isLoading: isLoadingPosts 
  } = useQuery({
    queryKey: [`/api/users/${userId}/posts`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/posts`);
      // Check if we need to process the response
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response; // Already processed JSON
    },
    enabled: Boolean(userId),
    staleTime: 0 // Always fetch fresh data
  });
  

  // Fetch user events using the correct URL format for the queryKey with proper response handling
  const { 
    data: userEvents = [], 
    isLoading: isLoadingEvents 
  } = useQuery({
    queryKey: [`/api/users/${userId}/events`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/events`);
      // Check if we need to process the response
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response; // Already processed JSON
    },
    enabled: Boolean(userId)
  });
  
  // Fetch user RSVPs with proper response handling
  const {
    data: userRsvps = [],
    isLoading: isLoadingRsvps
  } = useQuery({
    queryKey: [`/api/users/${userId}/rsvps`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/rsvps`);
      // Check if we need to process the response
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response; // Already processed JSON
    },
    enabled: Boolean(userId)
  });

  // Fetch user tickets with proper response handling
  const {
    data: userTickets = [],
    isLoading: isLoadingTickets
  } = useQuery({
    queryKey: [`/api/users/${userId}/tickets`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/tickets`);
      // Check if we need to process the response
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response; // Already processed JSON
    },
    enabled: Boolean(userId)
  });
  
  const {
    data: userSpots = [],
    isLoading: isLoadingSpots
  } = useQuery({
    queryKey: [`/api/users/${userId}/locations`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/locations`);
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response;
    },
    enabled: Boolean(userId)
  });

  const isOwnProfile = currentUser?.id === userId;
  const {
    data: savedSpotsData = [],
    isLoading: isLoadingSavedSpots
  } = useQuery<any[]>({
    queryKey: ["/api/users/saved-locations"],
    enabled: isOwnProfile,
  });

  const {
    data: followers = [],
    isLoading: isLoadingFollowers
  } = useQuery({
    queryKey: [`/api/users/${userId}/followers`],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/users/${userId}/followers`);
        // Check if we need to process the response
        if (response && typeof response.json === 'function') {
          return response.json();
        }
        return response; // Already processed JSON
      } catch (error) {
        console.error("Error fetching followers:", error);
        return [];
      }
    },
    enabled: Boolean(userId)
  });
  
  const {
    data: following = [],
    isLoading: isLoadingFollowing
  } = useQuery({
    queryKey: [`/api/users/${userId}/following`],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/users/${userId}/following`);
        if (response && typeof response.json === 'function') {
          return response.json();
        }
        return response;
      } catch (error) {
        console.error("Error fetching following:", error);
        return [];
      }
    },
    enabled: Boolean(userId)
  });

  const { data: mutualFollowData } = useQuery<{ isMutual: boolean }>({
    queryKey: ['/api/users', userId, 'mutual-follow'],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/mutual-follow`);
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response;
    },
    enabled: Boolean(userId) && Boolean(currentUser) && currentUser?.id !== userId,
  });

  const { data: blockStatusData } = useQuery<{ isBlocked: boolean }>({
    queryKey: ['/api/users', userId, 'is-blocked'],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${userId}/is-blocked`);
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response;
    },
    enabled: Boolean(userId) && Boolean(currentUser) && currentUser?.id !== userId,
  });

  const { data: programmeAccessData } = useQuery<{ id: number; isEnabled: boolean; venueName: string } | null>({
    queryKey: ["/api/programme/access"],
    enabled: !!currentUser && currentUser.id === userId,
  });

  const isMutualFollow = mutualFollowData?.isMutual || false;
  const isBlocked = blockStatusData?.isBlocked || false;
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Show loading state
  if (isLoadingUser) {
    return (
      <div className="flex-1 pb-16">
        <div className="h-40 sm:h-48 relative" style={{ backgroundColor: "hsl(221,83%,53%)" }}>
          <div className="absolute -bottom-16 sm:-bottom-20 left-4 flex flex-col sm:flex-row items-center sm:items-end">
            <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-full" />
            <div className="mt-2 sm:mt-0 mb-4 sm:ml-4">
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
        
        <div className="mt-24 sm:mt-28 px-4">
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (userError || !user) {
    return (
      <div className="container max-w-6xl py-8">
        <PageHeader>
          <PageHeaderHeading>User Not Found</PageHeaderHeading>
          <PageHeaderDescription>
            The user profile you're looking for doesn't exist
          </PageHeaderDescription>
        </PageHeader>
        
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">User Not Found</h3>
            <p className="text-muted-foreground mb-6">
              We couldn't find the user profile you're looking for
            </p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-16">
      {/* Profile Header — clean design tokens, no gradients */}
      <div className="bg-background border-b border-border">
        {/* Thin primary accent bar */}
        <div className="h-1 bg-primary w-full" />

        <div className="container px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0 self-center sm:self-start">
              <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-border shadow-sm">
                <AvatarImage
                  src={user.profilePicture || ""}
                  alt={user.displayName || `User ${userId}`}
                />
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Info + Actions */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground" data-testid="text-profile-name">
                      {user.displayName && user.displayName.trim() !== "" ? user.displayName : `User ${userId}`}
                    </h1>
                    {user.isVerified && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                    {isMutualFollow && (
                      <Badge variant="secondary" className="gap-1 text-xs" data-testid="badge-mutual-follow">
                        <Users className="h-3 w-3" />
                        Mutual
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="capitalize text-xs">
                      {user.role === "artist" ? (
                        <span className="flex items-center gap-1"><Award className="h-3 w-3" /> Artist</span>
                      ) : user.role === "admin" ? (
                        <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Admin</span>
                      ) : (
                        <span className="capitalize">{user.role || "Member"}</span>
                      )}
                    </Badge>
                    {user.artType && (
                      <Badge variant="secondary" className="text-xs capitalize">{user.artType}</Badge>
                    )}
                  </div>

                  {(user.location || user.artType) && (
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {user.location || ""}
                      {user.location && user.artType && <span className="mx-1">·</span>}
                      {user.artType && <span className="capitalize">{user.artType}</span>}
                    </p>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 justify-center sm:justify-start flex-wrap">
                  {currentUser && currentUser.id !== userId && (
                    <>
                      <FollowButton userId={userId!} size="sm" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setLocation(`/chat?userId=${userId}`)}
                        data-testid={`button-message-${userId}`}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Message</span>
                      </Button>
                      <BlockUserButton
                        userId={userId!}
                        username={user.displayName || `User ${userId}`}
                        variant="text"
                        onSuccess={() => {
                          queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'is-blocked'] });
                        }}
                      />
                    </>
                  )}
                  {currentUser && currentUser.id === userId && (
                    <Link href="/settings">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Settings className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Social stats row */}
              <div className="flex gap-6 mt-4 justify-center sm:justify-start" data-testid="stats-row">
                <div className="text-center sm:text-left" data-testid="stat-posts-count">
                  <p className="text-base font-bold text-foreground">{userPosts?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
                <div className="text-center sm:text-left" data-testid="stat-spots-count">
                  <p className="text-base font-bold text-foreground">{userSpots?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Spots</p>
                </div>
                <div className="cursor-pointer" data-testid="stat-followers">
                  <FollowersList userId={userId!} asDialog={true} />
                </div>
                <div className="cursor-pointer" data-testid="stat-following">
                  <FollowingList userId={userId!} asDialog={true} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile content with sidebar layout */}
      <div className="px-2 sm:px-4 container mt-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar with user menu */}
          <aside className="md:w-64 shrink-0">
            <Card className="bg-background/60 backdrop-blur-sm shadow-sm">
              <CardContent className="p-0">
                <nav className="flex flex-col">
                  <Link href={`/profile/${userId}`} className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                    <User size={16} className="text-primary" />
                    <span className="font-medium text-sm">Profile</span>
                  </Link>
                  
                  {currentUser && currentUser.id === userId && (
                    <>
                      <Link href="/profile/tickets" className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                        <Ticket size={16} className="text-primary" />
                        <span className="font-medium text-sm">My Tickets</span>
                      </Link>
                      
                      {servicesAccess.canAccess && (
                        <Link
                          href="/bookings"
                          className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40"
                          data-testid="link-manage-bookings"
                        >
                          <Calendar size={16} className="text-primary" />
                          <span className="font-medium text-sm">Manage Bookings</span>
                          {servicesAccess.isAdmin && servicesAccess.isLocked && (
                            <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
                              Admin
                            </span>
                          )}
                        </Link>
                      )}

                      {programmeAccessData?.isEnabled && (
                        <Link href="/my-programme" className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                          <CalendarDays size={16} className="text-primary" />
                          <div className="flex-1">
                            <span className="font-medium text-sm">Programme Planner</span>
                            <span className="block text-xs text-muted-foreground">{programmeAccessData.venueName}</span>
                          </div>
                        </Link>
                      )}
                      
                      {user.role === "admin" && (
                        <Link href="/admin" className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                          <Shield size={16} className="text-primary" />
                          <span className="font-medium text-sm">Admin Dashboard</span>
                        </Link>
                      )}
                      
                      <Link href="/settings" className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                        <Settings size={16} className="text-primary" />
                        <span className="font-medium text-sm">Settings</span>
                      </Link>
                      
                      <Link href="/legal-hub" className="flex items-center gap-2 px-4 py-3 hover:bg-primary/5 transition-colors border-b border-border/40">
                        <Shield size={16} className="text-primary" />
                        <span className="font-medium text-sm">Terms of Service</span>
                      </Link>
                      
                      <button 
                        onClick={() => {
                          // Implement sign out functionality
                          // This should match the signOut function in the header
                          window.location.href = "/auth";
                        }}
                        className="flex items-center gap-2 px-4 py-3 hover:bg-red-50 transition-colors text-red-500"
                      >
                        <LogOut size={16} />
                        <span className="font-medium text-sm">Sign Out</span>
                      </button>
                    </>
                  )}
                </nav>
              </CardContent>
            </Card>
            
            {/* Social stats for mobile/tablet that were previously in the header */}
            <div className="md:hidden flex justify-around bg-background/60 backdrop-blur-sm shadow-sm rounded-lg mt-4 p-3">
              <div className="text-center" data-testid="stat-posts-count-mobile">
                <p className="text-xl font-bold">{userPosts?.length || 0}</p>
                <p className="text-xs">Posts</p>
              </div>
              <div className="text-center" data-testid="stat-spots-count-mobile">
                <p className="text-xl font-bold">{userSpots?.length || 0}</p>
                <p className="text-xs">Spots</p>
              </div>
              <div className="text-center" data-testid="stat-followers-mobile">
                <p className="text-xl font-bold">{followers?.length || 0}</p>
                <p className="text-xs">Followers</p>
              </div>
              <div className="text-center" data-testid="stat-following-mobile">
                <p className="text-xl font-bold">{following?.length || 0}</p>
                <p className="text-xs">Following</p>
              </div>
            </div>
          </aside>
          
          {/* Main content with tabs */}
          <div className="flex-1">
            <Card className="bg-background/60 backdrop-blur-sm shadow-sm">
              <CardContent className="p-0">
                <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="border-b border-border w-full flex flex-wrap overflow-x-auto scrollbar-none bg-transparent h-auto p-0">
                    <TabsTrigger 
                      value="posts" 
                      className="py-2.5 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground transition-colors bg-transparent text-sm font-medium"
                    >
                      Posts
                    </TabsTrigger>
                    <TabsTrigger 
                      value="spots" 
                      className="py-2 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground transition-colors rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent text-sm font-medium py-2.5"
                      data-testid="tab-spots"
                    >
                      Spots
                    </TabsTrigger>
                    <TabsTrigger 
                      value="events" 
                      className="py-2 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground transition-colors rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent text-sm font-medium py-2.5"
                    >
                      Events
                    </TabsTrigger>
                    <TabsTrigger 
                      value="reserved" 
                      className="py-2 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground transition-colors rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent text-sm font-medium py-2.5"
                    >
                      Reserved
                    </TabsTrigger>
                    <TabsTrigger 
                      value="about" 
                      className="py-2 px-4 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground transition-colors rounded-none border-b-2 border-transparent data-[state=active]:border-primary bg-transparent text-sm font-medium py-2.5"
                    >
                      About
                    </TabsTrigger>
                  </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts">
            {isLoadingPosts ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading posts...</p>
              </div>
            ) : userPosts?.length > 0 ? (
              <div className="space-y-4">
                {userPosts.map((post: any) => {
                  // Enhanced author data with fallbacks for missing values
                  const authorData = {
                    id: userId,
                    displayName: userId === 1 ? "Oudai Admin" : 
                                user.displayName && user.displayName.trim() !== "" ? 
                                user.displayName : `User ${userId}`,
                    role: user.role || "user",
                    profilePicture: user.profilePicture || null
                  };
                  
                  return (
                    <PostCard key={post.id} post={post} author={authorData} />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-16 w-16 text-muted-foreground mx-auto mb-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                  />
                </svg>
                <h3 className="text-lg font-medium text-foreground font-semibold mb-1">No posts yet</h3>
                <p className="text-muted-foreground">This user hasn't shared any posts yet</p>
              </div>
            )}
          </TabsContent>

          {/* Spots Tab */}
          <TabsContent value="spots">
            {/* Saved OSM spots section (own profile only) */}
            {isOwnProfile && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-4 pb-2">Saved from Map</h3>
                {isLoadingSavedSpots ? (
                  <div className="flex gap-2 px-4">
                    {[1,2].map(i => <Skeleton key={i} className="h-36 w-48 rounded-lg flex-shrink-0" />)}
                  </div>
                ) : savedSpotsData.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                    {savedSpotsData.map((saved: any) => {
                      const name = saved.osmName || saved.locationName || "Unknown Spot";
                      const key = saved.osmId ? `osm-${saved.osmId}` : `loc-${saved.locationId}`;
                      const href = saved.locationId
                        ? `/locations/${saved.locationId}`
                        : saved.osmId
                          ? `/map?lat=${saved.osmLat}&lng=${saved.osmLon}&osmId=${saved.osmId}`
                          : "#";
                      return (
                        <Card key={key} className="overflow-hidden" data-testid={`card-saved-spot-${saved.osmId ?? saved.locationId}`}>
                          <div className="h-24 bg-muted flex items-center justify-center">
                            <Map className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <CardContent className="p-3">
                            <h4 className="font-medium text-sm mb-1 truncate" data-testid={`text-saved-name-${saved.osmId ?? saved.locationId}`}>{name}</h4>
                            {saved.osmCategory && (
                              <Badge variant="secondary" className="text-xs mb-2">{saved.osmCategory}</Badge>
                            )}
                            {saved.osmAddress && (
                              <p className="text-xs text-muted-foreground mb-2 truncate">{saved.osmAddress}</p>
                            )}
                            <Link href={href}>
                              <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-saved-${saved.osmId ?? saved.locationId}`}>
                                View on Map
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No saved spots yet. Tap the bookmark icon on any map spot to save it here.
                  </div>
                )}
                {userSpots?.length > 0 && <div className="border-t border-border my-4" />}
              </div>
            )}

            {/* Owned locations */}
            {isLoadingSpots ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading spots...</p>
              </div>
            ) : userSpots?.length > 0 ? (
              <div>
                {isOwnProfile && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-4 pb-2">My Locations</h3>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-0">
                  {userSpots.map((spot: any) => (
                    <Card key={spot.id} className="overflow-hidden" data-testid={`card-spot-${spot.id}`}>
                      <div className="h-32 bg-muted relative">
                        {spot.image ? (
                          <img 
                            src={spot.image} 
                            alt={spot.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Map className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        {spot.type && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="text-xs">{spot.type}</Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h4 className="font-medium text-sm mb-1" data-testid={`text-spot-name-${spot.id}`}>{spot.name}</h4>
                        {spot.address && (
                          <p className="text-xs text-muted-foreground mb-2 truncate">{spot.address}</p>
                        )}
                        {spot.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{spot.description}</p>
                        )}
                        <Link href={`/locations/${spot.id}`}>
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-spot-${spot.id}`}>View Spot</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : !isOwnProfile ? (
              <div className="text-center py-8">
                <Map className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground font-semibold mb-1">No spots</h3>
                <p className="text-muted-foreground">This user hasn't added any spots yet</p>
              </div>
            ) : null}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            {isLoadingEvents ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading events...</p>
              </div>
            ) : userEvents && userEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userEvents.map((event: any) => (
                  <Card key={event.id} className="overflow-hidden">
                    <div className="h-40 bg-muted relative">
                      {event.image ? (
                        <img 
                          src={event.image} 
                          alt={event.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CalendarDays className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-2 truncate text-foreground">{(event as any).titleEn && language === "en" ? (event as any).titleEn : event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                        {event.location && (
                          <>
                            <Map className="h-4 w-4 ml-3 mr-1" />
                            <span className="truncate">{event.location}</span>
                          </>
                        )}
                      </div>
                      <Link href={`/events/${event.id}`}>
                        <Button variant="outline" size="sm" className="w-full">View Details</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarDays className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground font-semibold mb-1">No events</h3>
                <p className="text-muted-foreground">This user hasn't created any events yet</p>
              </div>
            )}
          </TabsContent>

          {/* Reserved Events Tab - Shows both Tickets and RSVPs */}
          <TabsContent value="reserved">
            {isLoadingTickets || isLoadingRsvps ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading reserved events...</p>
              </div>
            ) : (userTickets && userTickets.length > 0) || (userRsvps && userRsvps.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Purchased Tickets */}
                {userTickets && userTickets.map((ticket: any) => {
                  const event = ticket.event;
                  if (!event) return null;
                  
                  return (
                    <Card key={ticket.id} className="overflow-hidden">
                      <div className="h-40 bg-muted relative">
                        {event.image ? (
                          <img 
                            src={event.image} 
                            alt={event.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Ticket className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className="gap-1">
                            <Ticket className="h-3 w-3" /> Ticket
                          </Badge>
                        </div>
                        
                      </div>
                      <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-2 truncate text-foreground">{(event as any).titleEn && language === "en" ? (event as any).titleEn : event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{new Date(event.date).toLocaleDateString()}</span>
                          {event.location && (
                            <>
                              <Map className="h-4 w-4 ml-3 mr-1" />
                              <span className="truncate">{event.location}</span>
                            </>
                          )}
                        </div>
                        <Link href={`/events/${event.id}`}>
                          <Button variant="outline" size="sm" className="w-full">View Event</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* RSVPs */}
                {userRsvps && userRsvps.map((rsvp: any) => {
                  const event = rsvp.event;
                  if (!event) return null;
                  
                  return (
                    <Card key={rsvp.id} className="overflow-hidden">
                      <div className="h-40 bg-muted relative">
                        {event.image ? (
                          <img 
                            src={event.image} 
                            alt={event.title} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Calendar className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant={rsvp.status === "going" ? "default" : "secondary"}>
                            {rsvp.status === "going" ? (
                              <span className="flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" /> Going
                              </span>
                            ) : (
                              "Not Going"
                            )}
                          </Badge>
                        </div>
                        
                      </div>
                      <CardContent className="p-3">
                      <h3 className="font-semibold text-sm mb-2 truncate text-foreground">{(event as any).titleEn && language === "en" ? (event as any).titleEn : event.title}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{new Date(event.date).toLocaleDateString()}</span>
                          {event.location && (
                            <>
                              <Map className="h-4 w-4 ml-3 mr-1" />
                              <span className="truncate">{event.location}</span>
                            </>
                          )}
                        </div>
                        <Link href={`/events/${event.id}`}>
                          <Button variant="outline" size="sm" className="w-full">View Event</Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground font-semibold mb-1">No reserved events</h3>
                <p className="text-muted-foreground">This user hasn't reserved or RSVP'd to any events yet</p>
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main Bio */}
              <Card className="lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">About {userId === 1 ? "Oudai Admin" : user.displayName}</h3>
                    {currentUser && userId === currentUser.id && (
                      <Link href="/settings">
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          <Settings className="h-4 w-4" /> Edit
                        </Button>
                      </Link>
                    )}
                  </div>
                  
                  {/* Bio section with styling */}
                  <div className="bg-muted/50 rounded-md p-4 mb-6 border border-border">
                    {user.bio ? (
                      <p className="text-foreground">{user.bio}</p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        {currentUser && userId === currentUser.id 
                          ? "You haven't added a bio yet. Tell the community about yourself!" 
                          : "No bio available"}
                      </p>
                    )}
                  </div>
                  
                  {/* Artistic information for artists */}
                  {user.role === "artist" && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium mb-3 flex items-center">
                        <Award className="h-4 w-4 mr-2 text-primary" /> Artistic Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {user.artType && (
                          <div className="bg-primary/5 p-3 rounded-md">
                            <p className="text-sm font-medium text-primary">Art Type</p>
                            <p className="text-sm">{user.artType}</p>
                          </div>
                        )}
                        
                        {user.experience && (
                          <div className="bg-primary/5 p-3 rounded-md">
                            <p className="text-sm font-medium text-primary">Experience</p>
                            <p className="text-sm">{user.experience}</p>
                          </div>
                        )}
                        
                        {user.specialties && (
                          <div className="bg-primary/5 p-3 rounded-md">
                            <p className="text-sm font-medium text-primary">Specialties</p>
                            <p className="text-sm">{user.specialties}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Contact information */}
                  <div className="mb-4">
                    <h4 className="text-md font-medium mb-3 flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-primary" /> Contact Information
                    </h4>
                    
                    {/* Show contact info or buttons based on privacy settings */}
                    {currentUser && userId === currentUser.id ? (
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <Mail className="h-5 w-5 text-muted-foreground mt-0.5 mr-3" />
                          <div>
                            <h4 className="text-sm font-medium">Email</h4>
                            <p className="text-muted-foreground">
                              {user.email || "No email available"}
                            </p>
                          </div>
                        </div>
                        
                        {user.phone && (
                          <div className="flex items-start">
                            <PhoneIcon className="h-5 w-5 text-muted-foreground mt-0.5 mr-3" />
                            <div>
                              <h4 className="text-sm font-medium">Phone</h4>
                              <p className="text-muted-foreground">{user.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.email && (
                          <Button variant="outline" size="sm" className="gap-1" asChild>
                            <a href={`mailto:${user.email}`}>
                              <Mail className="h-4 w-4" /> Email
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Profile Information Card */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-md font-medium mb-4">Profile Information</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5 mr-3" />
                      <div>
                        <h4 className="text-sm font-medium">Member Since</h4>
                        <p className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {user.role && (
                      <div className="flex items-start">
                        <div className="mt-0.5 mr-3">
                          {user.role === "artist" ? (
                            <Award className="h-5 w-5 text-primary" />
                          ) : user.role === "admin" ? (
                            <Shield className="h-5 w-5 text-primary" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">Role</h4>
                          <p className="text-muted-foreground">
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {user.location && (
                      <div className="flex items-start">
                        <Map className="h-5 w-5 text-muted-foreground mt-0.5 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium">Location</h4>
                          <p className="text-muted-foreground">{user.location}</p>
                        </div>
                      </div>
                    )}
                    
                    {user.website && (
                      <div className="flex items-start">
                        <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5 mr-3" />
                        <div>
                          <h4 className="text-sm font-medium">Website</h4>
                          <a 
                            href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block max-w-[200px]"
                          >
                            {user.website}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Show data deletion link only when viewing own profile */}
                  {currentUser && userId === currentUser.id && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="w-full">
                        <h4 className="text-sm font-medium mb-2">Account Management</h4>
                        <Link href="/data-deletion">
                          <Button variant="destructive" size="sm" className="mt-1 w-full">
                            Request Data Deletion
                          </Button>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-2">
                          This will initiate the process to permanently delete your account and all associated data.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}