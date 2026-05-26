import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, Clock, Check, CheckCheck, Calendar, MessageSquare, ShoppingCart, 
  PackageCheck, Share2, LineChart, MapPin, MoveRight, Heart, UserPlus,
  Image, Activity, Sparkles, Trash2, Settings, Filter, X, Users, Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { isSellerNotification, getSellerRedirectUrl } from '@/lib/notificationRedirects';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { Post, Event, Location } from '@shared/schema';
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeEvent } from "@/lib/localize";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  isSeen: boolean;
  createdAt: Date | string;
  actionLink?: string;
  actionText?: string;
  fromUserId?: number;
  fromUserName?: string;
  fromUserAvatar?: string;
  thumbnail?: string;
}

const normalizeDate = (date: Date | string): Date => {
  if (date instanceof Date) return date;
  return new Date(date);
};

const SOCIAL_TYPES = [
  'like', 'like_notification', 
  'comment', 'comment_notification',
  'follow', 'follow_request', 'follow_accepted',
  'chat_message'
];

const CONTENT_TYPES = [
  'post', 'new_post',
  'spot', 'spot_approved', 'new_spot',
  'event', 'event_reminder',
  'content_shared', 'artwork'
];

const ORDER_TYPES = [
  'new_order', 'order_status_update', 
  'tracking_update', 'service_booking', 
  'booking_status_update', 'digital_product_ready'
];

const getNotificationIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'like':
    case 'like_notification':
      return <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />;
    case 'comment':
    case 'comment_notification':
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return <UserPlus className="h-5 w-5 text-green-500" />;
    case 'spot':
    case 'spot_approved':
    case 'new_spot':
      return <MapPin className="h-5 w-5 text-orange-500" />;
    case 'event':
    case 'event_reminder':
      return <Calendar className="h-5 w-5 text-purple-500" />;
    case 'post':
    case 'new_post':
      return <Image className="h-5 w-5 text-indigo-500" />;
    case 'order_status_update':
    case 'tracking_update':
      return <PackageCheck className="h-5 w-5 text-teal-500" />;
    case 'new_order':
      return <ShoppingCart className="h-5 w-5 text-emerald-500" />;
    case 'service_booking':
    case 'booking_status_update':
      return <Calendar className="h-5 w-5 text-violet-500" />;
    case 'content_shared':
      return <Share2 className="h-5 w-5 text-cyan-500" />;
    case 'chat_message':
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'like':
    case 'like_notification':
      return "bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15";
    case 'comment':
    case 'comment_notification':
      return "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15";
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return "bg-green-500/10 border-green-500/20 hover:bg-green-500/15";
    case 'spot':
    case 'spot_approved':
    case 'new_spot':
      return "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15";
    case 'event':
    case 'event_reminder':
      return "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15";
    case 'post':
    case 'new_post':
      return "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/15";
    case 'order_status_update':
    case 'tracking_update':
    case 'new_order':
      return "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15";
    case 'service_booking':
    case 'booking_status_update':
      return "bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/15";
    default:
      return "bg-primary/10 border-primary/20 hover:bg-primary/15";
  }
};

const NotificationCard = ({ 
  notification, 
  onMarkAsRead,
  onDelete 
}: { 
  notification: Notification; 
  onMarkAsRead: (id: number) => void;
  onDelete: (id: number) => void;
}) => {
  const initials = notification.fromUserName 
    ? notification.fromUserName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : notification.title.slice(0, 2).toUpperCase();

  return (
    <div 
      className={cn(
        "group relative p-4 rounded-xl border transition-all duration-300",
        "hover:shadow-md hover:scale-[1.005]",
        getNotificationColor(notification.type),
        !notification.isRead && "ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
            <AvatarImage src={notification.fromUserAvatar || notification.thumbnail || ""} />
            <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-primary-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-background shadow-sm border">
            {getNotificationIcon(notification.type)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground leading-tight mb-0.5">
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {notification.message}
              </p>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.isRead && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  data-testid={`button-mark-read-${notification.id}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                data-testid={`button-delete-${notification.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDistanceToNow(normalizeDate(notification.createdAt), { addSuffix: true })}</span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {notification.actionLink && (
                <Link href={notification.actionLink}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1">
                    {notification.actionText || "View"}
                    <MoveRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
              
              {isSellerNotification(notification.type) && (
                <Link href={getSellerRedirectUrl(notification.type) || "#"}>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <LineChart className="h-3 w-3" />
                    Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {!notification.isRead && (
        <div className="absolute top-3 right-3">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: any; 
  title: string; 
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="relative mb-6">
      <div className="bg-muted rounded-full p-8">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
    </div>
    <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground text-center max-w-sm">
      {description}
    </p>
  </div>
);

const SocialContentCard = ({ post }: { post: Post }) => {
  return (
    <Link href={`/community/post/${post.id}`} data-testid={`card-post-${post.id}`}>
      <Card className="group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.005] border-l-4 border-l-rose-500/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-lg bg-rose-500/10 flex-shrink-0">
              <Heart className="h-6 w-6 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm text-foreground">Community Post</span>
                <Badge variant="secondary" className="text-xs">
                  <Heart className="h-3 w-3 mr-1" />
                  Post
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
              {post.image && (
                <div className="mt-2 rounded-lg overflow-hidden h-24 w-full">
                  <img src={post.image} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {post.createdAt && formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </div>
            </div>
            <MoveRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const EventContentCard = ({ event }: { event: Event }) => {
  const eventDate = event.date ? new Date(event.date) : null;
  const isPast = eventDate ? eventDate < new Date() : false;
  
  return (
    <Link href={`/events/${event.id}`} data-testid={`card-event-${event.id}`}>
      <Card className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.005] border-l-4",
        isPast ? "border-l-gray-400/50 opacity-75" : "border-l-purple-500/50"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-3 rounded-lg",
              isPast ? "bg-gray-500/10" : "bg-purple-500/10"
            )}>
              <Calendar className={cn("h-6 w-6", isPast ? "text-gray-500" : "text-purple-500")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm text-foreground line-clamp-1">{(event as any).titleEn && language === "en" ? (event as any).titleEn : event.title}</span>
                {isPast && <Badge variant="secondary" className="text-xs">Past</Badge>}
              </div>
              {event.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{(event as any).descriptionEn && language === "en" ? (event as any).descriptionEn : event.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {eventDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(eventDate, 'MMM d, yyyy')}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{event.location}</span>
                  </span>
                )}
              </div>
            </div>
            <MoveRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const SpotContentCard = ({ spot }: { spot: Location }) => {
  return (
    <Link href={`/locations/${spot.id}`} data-testid={`card-spot-${spot.id}`}>
      <Card className="group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.005] border-l-4 border-l-orange-500/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <MapPin className="h-6 w-6 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm text-foreground line-clamp-1">{spot.name}</span>
                {spot.type && (
                  <Badge variant="secondary" className="text-xs capitalize">{spot.type}</Badge>
                )}
              </div>
              {spot.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{spot.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {spot.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{spot.address}</span>
                  </span>
                )}
              </div>
            </div>
            <MoveRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const ContentLoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default function NotificationsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: notifications = [], refetch, isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<Notification[]>;
    },
    enabled: !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: true
  });

  const { data: posts = [], isLoading: isLoadingPosts } = useQuery<Post[]>({
    queryKey: ['/api/posts'],
    enabled: activeTab === 'social',
    staleTime: 60000,
  });

  const { data: events = [], isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: activeTab === 'content',
    staleTime: 60000,
  });

  const { data: spots = [], isLoading: isLoadingSpots } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    enabled: activeTab === 'content',
    staleTime: 60000,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const socialNotifications = notifications.filter(n => 
    SOCIAL_TYPES.includes(n.type?.toLowerCase())
  );
  const contentNotifications = notifications.filter(n => 
    CONTENT_TYPES.includes(n.type?.toLowerCase())
  );
  const orderNotifications = notifications.filter(n => 
    ORDER_TYPES.includes(n.type?.toLowerCase())
  );
  
  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest('/api/notifications/mark-all-read', 'POST', {
        userId: user.id
      });
      
      if (response.ok) {
        refetch();
        toast({
          title: "All caught up!",
          description: "All notifications marked as read",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to mark notifications as read",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  const handleMarkAsRead = async (id: number) => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest(`/api/notifications/${id}/read`, 'POST', {
        userId: user.id
      });
      
      if (response.ok) {
        queryClient.setQueryData(['/api/notifications'], (old: Notification[] | undefined) => 
          old?.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user?.id) return;
    
    try {
      const response = await apiRequest(`/api/notifications/${id}`, 'DELETE', {
        userId: user.id
      });
      
      if (response.ok) {
        queryClient.setQueryData(['/api/notifications'], (old: Notification[] | undefined) => 
          old?.filter(n => n.id !== id)
        );
        toast({
          title: "Notification deleted",
          description: "The notification has been removed",
        });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getFilteredNotifications = () => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.isRead);
      case 'social':
        return socialNotifications;
      case 'content':
        return contentNotifications;
      case 'orders':
        return orderNotifications;
      default:
        return notifications;
    }
  };

  const filteredNotifications = getFilteredNotifications();

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-muted/20 pt-6 pb-8 px-4 mb-6 border-b border-border/60">
        <div className="container max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="p-3 rounded-xl bg-primary/10 shadow-sm">
                  <Bell className="h-7 w-7 text-primary" />
                </div>
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-6 min-w-[1.5rem] flex items-center justify-center text-xs font-bold px-1.5"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
                <p className="text-sm text-muted-foreground">Stay updated with your activity</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={handleMarkAllAsRead}
                  data-testid="button-mark-all-read"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              )}
              <Link href="/settings">
                <Button variant="ghost" size="icon" data-testid="button-notification-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 h-11 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="all" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm relative">
                Unread
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:top-1 sm:right-1 h-2 w-2 bg-destructive rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger value="social" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Heart className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                Social
              </TabsTrigger>
              <TabsTrigger value="content" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Sparkles className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                Content
              </TabsTrigger>
              <TabsTrigger value="orders" className="rounded-lg text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ShoppingCart className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
                Orders
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="container max-w-3xl mx-auto px-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
              <Activity className="absolute inset-0 m-auto h-5 w-5 text-primary" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Loading notifications...</p>
          </div>
        ) : activeTab === 'social' ? (
          <div className="space-y-4">
            {socialNotifications.length > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recent Social Notifications
                </h3>
                {socialNotifications.slice(0, 5).map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Community Activity
              </h3>
              {isLoadingPosts ? (
                <ContentLoadingSkeleton />
              ) : posts.length === 0 ? (
                <EmptyState 
                  icon={Users}
                  title="No community posts yet"
                  description="Be the first to share something with the community! Head to the Community page to create a post."
                />
              ) : (
                <div className="space-y-3">
                  {posts.slice(0, 10).map((post) => (
                    <SocialContentCard 
                      key={post.id} 
                      post={post}
                    />
                  ))}
                  <div className="text-center pt-4">
                    <Link href="/community">
                      <Button variant="outline" className="gap-2">
                        View All Posts
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'content' ? (
          <div className="space-y-6">
            {contentNotifications.length > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recent Content Updates
                </h3>
                {contentNotifications.slice(0, 5).map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
            
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming Events
              </h3>
              {isLoadingEvents ? (
                <ContentLoadingSkeleton />
              ) : events.length === 0 ? (
                <div className="p-6 rounded-lg bg-muted/30 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No events scheduled yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <EventContentCard key={event.id} event={event} />
                  ))}
                  <div className="text-center pt-2">
                    <Link href="/events">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View All Events
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Featured Spots
              </h3>
              {isLoadingSpots ? (
                <ContentLoadingSkeleton />
              ) : spots.length === 0 ? (
                <div className="p-6 rounded-lg bg-muted/30 text-center">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No spots discovered yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {spots.filter((s: Location) => s.isVisible && s.approvalStatus === 'approved').slice(0, 5).map((spot) => (
                    <SpotContentCard key={spot.id} spot={spot} />
                  ))}
                  <div className="text-center pt-2">
                    <Link href="/map">
                      <Button variant="ghost" size="sm" className="gap-2">
                        Explore Map
                        <MoveRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState 
            icon={activeTab === 'unread' ? CheckCheck : Bell}
            title={activeTab === 'unread' ? "You're all caught up!" : "No notifications"}
            description={
              activeTab === 'unread' 
                ? "No unread notifications. Check back later for new updates!" 
                : activeTab === 'orders'
                ? "No order notifications. Your purchases will show up here."
                : "You'll see notifications here when there's activity on your account"
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
            
            {filteredNotifications.length >= 20 && (
              <div className="text-center pt-6">
                <Button variant="outline" className="gap-2">
                  Load More
                  <MoveRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
