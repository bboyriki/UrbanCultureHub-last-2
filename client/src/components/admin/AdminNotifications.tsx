import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminNotification } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { RefreshCw, Bell, CheckCheck, MapPin, Calendar, Flag, AlertTriangle, User } from "lucide-react";
import { useLocation } from "wouter";

const AdminNotifications = () => {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const adminId = user?.id;

  // Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/notifications", adminId, showUnreadOnly],
    queryFn: async () => {
      if (!adminId) return [];
      const response = await apiRequest(
        "/api/admin/notifications", 
        "GET",
        { userId: adminId, unreadOnly: showUnreadOnly }
      );
      return await response.json();
    },
    enabled: !!adminId,
    refetchInterval: 30000
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(
        `/api/admin/notifications/${notificationId}/read`, 
        "POST", 
        { adminId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to mark notification as read",
        description: error.message || "Could not update notification",
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter((n: AdminNotification) => !n.isRead);
      await Promise.all(
        unreadNotifications.map((n: AdminNotification) => 
          apiRequest(`/api/admin/notifications/${n.id}/read`, "POST", { adminId })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      toast({
        title: "All notifications marked as read",
      });
    },
  });

  const unreadCount = notifications.filter((n: AdminNotification) => !n.isRead).length;

  const openNotificationDetails = (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setDetailsOpen(true);
    
    // Mark as read when opening details
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  // Navigate to related content based on notification type
  const handleNotificationAction = (notification: AdminNotification) => {
    setDetailsOpen(false);
    
    if (notification.actionLink) {
      navigate(notification.actionLink);
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case "event_approval":
          navigate("/admin?tab=events");
          break;
        case "user_approval":
          navigate("/admin?tab=users");
          break;
        case "content_flag":
          navigate("/admin?tab=content");
          break;
        case "location_approval":
          navigate("/admin?tab=spots");
          break;
        default:
          toast({
            title: "Navigation",
            description: "No direct link available for this notification",
          });
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "user_approval":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-blue-500" />
          </div>
        );
      case "content_flag":
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Flag className="w-5 h-5 text-red-500" />
          </div>
        );
      case "event_approval":
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
        );
      case "location_approval":
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-purple-500" />
          </div>
        );
      case "system_alert":
        return (
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-gray-500" />
          </div>
        );
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Admin Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {unreadCount}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh notifications"
            data-testid="button-refresh-notifications"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            data-testid="button-toggle-unread"
          >
            {showUnreadOnly ? "Showing Unread" : "Showing All"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading notifications...</p>
        </div>
      ) : notifications.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {notifications.map((notification: AdminNotification) => (
            <div 
              key={notification.id}
              className={`flex p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50' : ''}`}
              onClick={() => openNotificationDetails(notification)}
            >
              {getNotificationIcon(notification.type)}
              <div className="ml-3 flex-1">
                <div className="flex justify-between items-start">
                  <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-blue-600' : 'text-gray-900'}`}>
                    {notification.title}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {notification.createdAt ? format(new Date(notification.createdAt), "MMM d, h:mm a") : "N/A"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                {!notification.isRead && (
                  <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-1"></span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-xl shadow-sm">
          <p className="text-gray-500">No notifications found</p>
          {showUnreadOnly && (
            <p className="text-gray-400 text-sm mt-1">Try showing all notifications</p>
          )}
        </div>
      )}

      {/* Notification Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && getNotificationIcon(selectedNotification.type)}
              <span>{selectedNotification?.title}</span>
            </DialogTitle>
            <DialogDescription>{selectedNotification?.message || "Notification details"}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">{selectedNotification?.message}</p>
            
            {selectedNotification && (
              <Button 
                onClick={() => handleNotificationAction(selectedNotification)}
                data-testid="button-view-notification-details"
              >
                {selectedNotification.actionText || "View Details"}
              </Button>
            )}
            
            <div className="text-xs text-muted-foreground mt-4">
              Received: {selectedNotification?.createdAt && format(new Date(selectedNotification.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNotifications;