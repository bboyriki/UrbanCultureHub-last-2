import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Bell, Heart, MessageCircle, UserPlus, MapPin, 
  Calendar, Image, Check, CheckCheck, X, Loader2,
  Activity, TrendingUp, Sparkles, Clock, Eye
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: number;
  type: string;
  title: string;
  message: string;
  fromUserId?: number;
  fromUserName?: string;
  fromUserAvatar?: string;
  targetId?: number;
  targetType?: string;
  actionLink?: string;
  actionText?: string;
  thumbnail?: string;
  isRead: boolean;
  isSeen: boolean;
  createdAt: Date | string;
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

interface CommunityActivityFeedProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const getActivityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'like':
    case 'like_notification':
      return <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />;
    case 'comment':
    case 'comment_notification':
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'spot':
    case 'spot_approved':
    case 'new_spot':
      return <MapPin className="h-4 w-4 text-orange-500" />;
    case 'event':
    case 'event_reminder':
      return <Calendar className="h-4 w-4 text-purple-500" />;
    case 'post':
    case 'new_post':
      return <Image className="h-4 w-4 text-indigo-500" />;
    default:
      return <Activity className="h-4 w-4 text-primary" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'like':
    case 'like_notification':
      return "bg-rose-500/10 border-rose-500/20";
    case 'comment':
    case 'comment_notification':
      return "bg-blue-500/10 border-blue-500/20";
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return "bg-green-500/10 border-green-500/20";
    case 'spot':
    case 'spot_approved':
    case 'new_spot':
      return "bg-orange-500/10 border-orange-500/20";
    case 'event':
    case 'event_reminder':
      return "bg-purple-500/10 border-purple-500/20";
    case 'post':
    case 'new_post':
      return "bg-indigo-500/10 border-indigo-500/20";
    default:
      return "bg-primary/10 border-primary/20";
  }
};

const ActivityCard = ({ 
  activity, 
  onMarkAsRead 
}: { 
  activity: ActivityItem; 
  onMarkAsRead: (id: number) => void;
}) => {
  const initials = activity.fromUserName 
    ? activity.fromUserName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'UC';

  return (
    <div 
      className={cn(
        "group relative p-4 rounded-xl border transition-all duration-300",
        "hover:shadow-md hover:scale-[1.01]",
        getActivityColor(activity.type),
        !activity.isRead && "ring-2 ring-primary/20 bg-opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
            <AvatarImage src={activity.fromUserAvatar || ""} alt={activity.fromUserName || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-background shadow-sm border">
            {getActivityIcon(activity.type)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground leading-tight">
                {activity.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {activity.message}
              </p>
            </div>
            
            {!activity.isRead && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkAsRead(activity.id);
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(normalizeDate(activity.createdAt), { addSuffix: true })}</span>
            </div>
            
            {activity.actionLink && (
              <Link href={activity.actionLink}>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2 gap-1">
                  {activity.actionText || "View"}
                  <Eye className="h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {!activity.isRead && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
      )}
    </div>
  );
};

const EmptyActivityState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="relative mb-4">
      <div className="bg-muted rounded-full p-6">
        <Bell className="h-8 w-8 text-muted-foreground" />
      </div>
    </div>
    <h3 className="font-semibold text-foreground mb-1">No Activity Yet</h3>
    <p className="text-sm text-muted-foreground text-center max-w-[200px]">
      {message}
    </p>
  </div>
);

export default function CommunityActivityFeed({ isOpen, onOpenChange }: CommunityActivityFeedProps) {
  const { user } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead,
    refreshNotifications 
  } = useNotifications();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (isOpen && user) {
      refreshNotifications();
    }
  }, [isOpen, user, refreshNotifications]);

  const filterActivities = (type: string) => {
    if (!notifications) return [];
    
    switch (type) {
      case "social":
        return notifications.filter((n: any) => 
          SOCIAL_TYPES.includes(n.type?.toLowerCase())
        );
      case "content":
        return notifications.filter((n: any) => 
          CONTENT_TYPES.includes(n.type?.toLowerCase())
        );
      case "unread":
        return notifications.filter((n: any) => !n.isRead);
      default:
        return notifications;
    }
  };

  const currentActivities = filterActivities(activeTab);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] flex items-center justify-center text-[10px] font-bold px-1"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">Activity Feed</SheetTitle>
                <p className="text-xs text-muted-foreground">Stay updated with community</p>
              </div>
            </div>
            
            {unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1"
                onClick={() => markAllAsRead()}
              >
                <CheckCheck className="h-3 w-3" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </SheetHeader>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-3 pb-2 border-b bg-muted/30">
            <TabsList className="w-full grid grid-cols-4 h-9 bg-muted/50">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background">
                All
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs data-[state=active]:bg-background">
                <Heart className="h-3 w-3 mr-1" />
                Social
              </TabsTrigger>
              <TabsTrigger value="content" className="text-xs data-[state=active]:bg-background">
                <Sparkles className="h-3 w-3 mr-1" />
                Content
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs data-[state=active]:bg-background relative">
                New
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive rounded-full" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary"></div>
                    <Activity className="absolute inset-0 m-auto h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading activity...</p>
                </div>
              ) : currentActivities.length === 0 ? (
                <EmptyActivityState 
                  message={
                    activeTab === "unread" 
                      ? "You're all caught up! No new notifications." 
                      : activeTab === "social"
                      ? "No social activity yet. Start interacting!"
                      : activeTab === "content"
                      ? "No content updates. Check back later!"
                      : "Your activity feed is empty. Join the community!"
                  }
                />
              ) : (
                <>
                  {currentActivities.map((activity: any) => (
                    <ActivityCard 
                      key={activity.id} 
                      activity={activity}
                      onMarkAsRead={markAsRead}
                    />
                  ))}
                  
                  {currentActivities.length >= 10 && (
                    <div className="text-center pt-4 pb-2">
                      <Link href="/notifications">
                        <Button variant="outline" size="sm" className="gap-2">
                          <TrendingUp className="h-4 w-4" />
                          View All Activity
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>
        
        <div className="p-4 border-t">
          <Link href="/notifications">
            <Button variant="outline" className="w-full gap-2 bg-background">
              <Bell className="h-4 w-4" />
              View All Notifications
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
