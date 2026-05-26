import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProfileStoryRing } from "@/components/stories/StoryCircles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import PostCard from "@/components/community/PostCard";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ProfileEditor } from "./ProfileEditor";
import UserTickets from "./UserTickets";
import UserOrders from "./UserOrders";
import KvkVerificationForm from "./KvkVerificationForm";
import { ContentFilterSettings } from "@/components/common/ContentFilterSettings";
import {
  CalendarDays, Clock, MapPin, Settings, LogOut,
  MessageSquare, FileText, Bookmark, Ticket, Shield, Filter,
  CheckCircle, PenLine, Calendar, Loader2, Trash2,
} from "lucide-react";

const ProfileView = () => {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("posts");

  useEffect(() => {
    if (window.location.pathname.includes("/profile/tickets")) {
      setActiveTab("tickets");
      return;
    }
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam && ["posts", "spots", "events", "schedule", "tickets", "orders", "business", "content-filter"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const { data: userPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: [`/api/users/${user?.id}/posts`],
    enabled: !!user?.id,
  });

  const { data: savedLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: [`/api/users/${user?.id}/saved-locations`],
    enabled: !!user?.id,
  });

  const { data: userRsvps = [], isLoading: rsvpsLoading } = useQuery({
    queryKey: [`/api/users/${user?.id}/rsvps`],
    enabled: !!user?.id,
  });

  const { data: myReservations = [], isLoading: reservationsLoading } = useQuery<any[]>({
    queryKey: ['/api/programme/my-reservations'],
    enabled: !!user?.id,
  });

  const cancelReservationMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      const response = await apiRequest(`/api/programme/registrations/${registrationId}`, "DELETE");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programme/my-reservations'] });
      toast({ title: "Reservation cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel reservation", variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/auth");
      toast({ title: "Logged out", description: "You have been logged out successfully." });
    } catch (error: any) {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
    }
  };

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Must be logged in");
      const response = await apiRequest("/api/posts", "POST", { content, userId: user.id });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/posts`] });
      toast({ title: "Post created" });
    },
  });

  if (!user) return null;

  const initials = (user.displayName || "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const tabItems = [
    { value: "posts", label: "Posts", icon: FileText },
    { value: "spots", label: "Spots", icon: Bookmark },
    { value: "events", label: "Events", icon: CalendarDays },
    { value: "schedule", label: "Schedule", icon: Calendar },
    { value: "tickets", label: "Tickets", icon: Ticket },
    { value: "orders", label: "Orders", icon: MessageSquare },
    { value: "business", label: "Business", icon: Shield },
    { value: "content-filter", label: "Filters", icon: Filter },
  ];

  return (
    <div className="flex-1 pb-16">
      {/* Profile Header */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-primary">
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="pg" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pg)"/>
          <circle cx="85%" cy="30%" r="90" fill="rgba(255,255,255,0.04)"/>
          <circle cx="10%" cy="80%" r="60" fill="rgba(255,255,255,0.04)"/>
        </svg>

        {/* Avatar + name */}
        <div className="absolute -bottom-16 sm:-bottom-20 left-4 flex flex-col sm:flex-row items-center sm:items-end">
          <div className="relative">
            <ProfileStoryRing userId={user.id}>
              <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-white shadow-md">
                <AvatarImage src={user.profilePicture || ""} alt={user.displayName || "User"} />
                <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/20 text-primary">{initials}</AvatarFallback>
              </Avatar>
            </ProfileStoryRing>
            <div className="absolute bottom-0 right-0 bg-green-500 text-white text-xs py-1 px-2 rounded-full shadow-sm flex items-center gap-1">
              {user.isVerified && <CheckCircle className="w-2.5 h-2.5" />}
              <span className="capitalize">{user.role || "User"}</span>
            </div>
          </div>
          <div className="mt-2 sm:mt-0 mb-4 sm:ml-4 text-center sm:text-left">
            <h2 className="text-lg sm:text-xl font-bold text-white">{user.displayName || "User"}</h2>
            <p className="text-white/80 text-sm">{user.location || ""}</p>
            {user.artType && (
              <p className="text-white/70 text-xs mt-0.5">{user.artType}</p>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <ProfileEditor user={user} />
          <Button
            variant="ghost"
            size="icon"
            className="bg-white/20 text-white hover:bg-white/30"
            onClick={handleLogout}
            aria-label="Logout"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Stats on right */}
        <div className="hidden sm:flex absolute bottom-4 right-4 gap-5 text-white/90">
          <div className="text-center" data-testid="stat-posts-count">
            <p className="text-xl font-bold">{Array.isArray(userPosts) ? userPosts.length : 0}</p>
            <p className="text-xs">Posts</p>
          </div>
          <div className="text-center" data-testid="stat-spots-count">
            <p className="text-xl font-bold">{Array.isArray(savedLocations) ? savedLocations.length : 0}</p>
            <p className="text-xs">Spots</p>
          </div>
          <div className="text-center" data-testid="stat-events-count">
            <p className="text-xl font-bold">{Array.isArray(userRsvps) ? userRsvps.length : 0}</p>
            <p className="text-xs">Events</p>
          </div>
        </div>
      </div>

      {/* Mobile stats */}
      <div className="sm:hidden flex justify-around border-b border-border bg-background px-4 pt-20 pb-3">
        <div className="text-center">
          <p className="text-lg font-bold">{Array.isArray(userPosts) ? userPosts.length : 0}</p>
          <p className="text-xs text-muted-foreground">Posts</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{Array.isArray(savedLocations) ? savedLocations.length : 0}</p>
          <p className="text-xs text-muted-foreground">Spots</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold">{Array.isArray(userRsvps) ? userRsvps.length : 0}</p>
          <p className="text-xs text-muted-foreground">Events</p>
        </div>
      </div>

      <div className="mt-20 sm:mt-24 px-2 sm:px-4 max-w-4xl mx-auto">
        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{user.bio}</p>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex flex-nowrap overflow-x-auto scrollbar-none border-b border-border bg-transparent h-auto p-0 mb-4 gap-0">
            {tabItems.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="py-2.5 px-3 sm:px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground text-xs sm:text-sm font-medium transition-colors shrink-0 bg-transparent"
                data-testid={`tab-profile-${tab.value}`}
              >
                <tab.icon className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posts">
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : Array.isArray(userPosts) && userPosts.length > 0 ? (
              <div className="space-y-4">
                {(userPosts as any[]).map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    author={{
                      id: user.id,
                      displayName: user.displayName || "",
                      role: user.role || "user",
                      profilePicture: user.profilePicture || null,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <PenLine className="w-12 h-12 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-base mb-1">No posts yet</h3>
                  <p className="text-sm text-muted-foreground">Share your urban culture experiences with the community</p>
                </div>
                <Button
                  onClick={() => {
                    const content = prompt("What's on your mind?");
                    if (content?.trim()) createPostMutation.mutate(content);
                  }}
                  data-testid="button-create-post"
                >
                  Create Post
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="spots">
            {locationsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
              </div>
            ) : Array.isArray(savedLocations) && savedLocations.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {(savedLocations as any[]).map((location: any) => {
                  const SPOT_FALLBACK = "https://images.unsplash.com/photo-1561059510-ee6d2a434031?auto=format&fit=crop&q=80&w=600";
                  const photo = Array.isArray(location.images) && location.images.length > 0
                    ? location.images[0]
                    : SPOT_FALLBACK;
                  return (
                    <Card
                      key={location.id}
                      className="overflow-hidden cursor-pointer group"
                      onClick={() => setLocation(`/locations/${location.id}`)}
                      data-testid={`card-saved-spot-${location.id}`}
                    >
                      <div className="relative h-32 bg-muted overflow-hidden">
                        {photo ? (
                          <img
                            src={photo}
                            alt={location.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
                            <MapPin className="w-8 h-8 text-primary/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        {location.type && (
                          <div className="absolute top-2 left-2">
                            <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur-sm capitalize">
                              {location.type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{location.name}</p>
                        </div>
                      </div>
                      <CardContent className="p-2.5">
                        {location.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />{location.address}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Bookmark className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1">No saved spots yet</h3>
                  <p className="text-sm text-muted-foreground">Save locations from the map to find them easily later</p>
                </div>
                <Button onClick={() => setLocation("/map")} data-testid="button-explore-map">Explore Map</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="events">
            {rsvpsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : Array.isArray(userRsvps) && userRsvps.length > 0 ? (
              <div className="space-y-3">
                {(userRsvps as any[]).map((rsvp: any) => (
                  <Card
                    key={rsvp.id}
                    className="overflow-hidden cursor-pointer group"
                    onClick={() => rsvp.event?.id && setLocation(`/events/${rsvp.event.id}`)}
                    data-testid={`card-rsvp-${rsvp.id}`}
                  >
                    <div className="flex gap-0">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 flex-shrink-0 bg-muted relative overflow-hidden">
                        {rsvp.event?.image ? (
                          <img src={rsvp.event.image} alt={rsvp.event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
                            <CalendarDays className="w-8 h-8 text-primary/60" />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <CardContent className="p-3 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{rsvp.event?.title || "Event"}</h3>
                          <Badge className="text-[10px] shrink-0" variant={rsvp.status === 'going' ? 'default' : 'secondary'}>
                            {rsvp.status || "Going"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          {rsvp.event?.date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(rsvp.event.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {rsvp.event?.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{rsvp.event.location}</span>
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <CalendarDays className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1">No events yet</h3>
                  <p className="text-sm text-muted-foreground">RSVP to events to see them here</p>
                </div>
                <Button onClick={() => setLocation("/events")} data-testid="button-browse-events">Browse Events</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule">
            {reservationsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading your schedule…
              </div>
            ) : myReservations.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Sessions you've reserved at urban culture spots.</p>
                {myReservations.map((res: any) => {
                  const start = res.occurrenceStart || res.item?.startTime;
                  const end = res.occurrenceEnd || res.item?.endTime;
                  const isPast = start ? new Date(start) < new Date() : false;
                  return (
                    <Card key={res.id} className={isPast ? 'opacity-60' : ''} data-testid={`reservation-item-${res.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center text-center min-w-[40px] bg-primary/10 rounded-lg p-1.5 flex-shrink-0">
                            <span className="text-xs font-bold text-primary leading-tight">
                              {start ? new Date(start).toLocaleString('en', { month: 'short' }) : '—'}
                            </span>
                            <span className="text-lg font-bold leading-tight text-primary">
                              {start ? new Date(start).getDate() : '—'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{res.item?.title || 'Session'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{res.item?.category?.replace(/_/g, ' ')}</p>
                            {start && end && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(start).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} – {new Date(end).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                            {res.item?.location && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" /> {res.item.location}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={isPast ? 'secondary' : 'default'} className="text-xs">
                                {isPast ? 'Past' : res.status || 'Confirmed'}
                              </Badge>
                              {res.amountPaid && parseFloat(res.amountPaid) > 0 && (
                                <Badge variant="outline" className="text-xs">€{res.amountPaid}</Badge>
                              )}
                            </div>
                          </div>
                          {!isPast && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => cancelReservationMutation.mutate(res.id)}
                              disabled={cancelReservationMutation.isPending}
                              data-testid={`button-cancel-reservation-${res.id}`}
                            >
                              {cancelReservationMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Calendar className="w-12 h-12 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-base mb-1">No sessions booked yet</h3>
                  <p className="text-sm text-muted-foreground">Reserve sessions at spots to see them here</p>
                </div>
                <Button onClick={() => setLocation("/community")} data-testid="button-browse-spots">Explore Spots</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tickets">
            {user?.id && <UserTickets userId={user.id} />}
          </TabsContent>

          <TabsContent value="orders">
            {user?.id && <UserOrders userId={user.id} />}
          </TabsContent>

          <TabsContent value="business">
            {user && <KvkVerificationForm />}
          </TabsContent>

          <TabsContent value="content-filter">
            {user && <ContentFilterSettings userId={user.id} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProfileView;
