import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash, AlertCircle, MoreVertical, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ManagementButtonsProps {
  canManage: boolean;
  contentId: number;
  contentType: 'service' | 'product' | 'post' | 'comment' | 'event' | 'location';
  onEdit?: () => void;
  queryKeys?: string[];
  compact?: boolean;
  className?: string;
  authorId?: number;
  showViewProfile?: boolean;
}

/**
 * A dropdown menu with options for content including view profile, edit and delete
 */
export function ContentManagementMenu({ 
  canManage, 
  contentId, 
  contentType, 
  onEdit,
  queryKeys = [], 
  className = "",
  authorId,
  showViewProfile = true
}: ManagementButtonsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [, navigate] = useLocation();
  
  // Create API endpoint path based on content type
  const getEndpoint = () => {
    switch (contentType) {
      case 'service':
        return `/api/services/${contentId}`;
      case 'product':
        return `/api/products/${contentId}`;  
      case 'post':
        return `/api/posts/${contentId}`;
      case 'comment':
        return `/api/comments/${contentId}`;
      case 'event':
        return `/api/events/${contentId}`;
      case 'location':
        return `/api/locations/${contentId}`;
      default:
        return '';
    }
  };
  
  const handleDelete = async () => {
    try {
      // Get current user from global context
      const user = window.__URBAN_CULTURE_USER__;
      
      if (!user) {
        console.error("User not found in global context");
        toast({
          title: "Authentication Error",
          description: "You must be logged in to delete content",
          variant: "destructive"
        });
        return;
      }

      // Create a request body with user credentials
      const requestBody = {
        userId: user.id,
        userRole: user.role || 'user'
      };
      
      // Log data for debugging
      console.log(`Deleting ${contentType} with auth data:`, {
        contentId: contentId,
        userId: user.id,
        userRole: user.role,
        endpoint: getEndpoint(),
        requestBody
      });
      
      // Make request with user info in both body and headers for maximum compatibility
      const response = await fetch(getEndpoint(), {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': String(user.id || '0'),
          'X-User-Role': String(user.role || 'user'),
        },
        body: JSON.stringify(requestBody),
        credentials: "include"
      });
      
      let errorData = null;
      let errorMessage = `Failed to delete ${contentType}`;
      
      try {
        // Try to parse error message if present
        if (!response.ok) {
          const data = await response.json();
          errorData = data;
          errorMessage = data.message || errorMessage;
        }
      } catch (parseError) {
        console.warn("Could not parse error response:", parseError);
      }
      
      if (!response.ok) {
        throw new Error(errorMessage);
      }
      
      toast({
        title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} deleted`,
        description: `The ${contentType} has been successfully deleted`,
      });
      
      // Invalidate relevant queries to refresh data
      if (queryKeys.length > 0) {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    } catch (error) {
      console.error(`Error deleting ${contentType}:`, error);
      toast({
        title: `Failed to delete ${contentType}`,
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Only show the menu if user can manage or view profile is enabled
  // Handle special case for admin profile (ID 1)
  const finalAuthorId = authorId === 1 ? 1 : authorId;
  const showMenu = canManage || (showViewProfile && finalAuthorId);
  
  if (!showMenu) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={className}>
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* View Profile option available for everyone */}
          {showViewProfile && finalAuthorId ? (
            <DropdownMenuItem onClick={() => {
              console.log("Navigating to profile:", finalAuthorId);
              navigate(`/profile/${finalAuthorId}`);
            }}>
              <User className="mr-2 h-4 w-4" />
              {finalAuthorId === 1 ? "View Oudai Admin's Profile" : "View Profile"}
            </DropdownMenuItem>
          ) : (
            // Add logging when the View Profile option isn't shown
            showViewProfile ? <>{console.log("View Profile not shown:", { authorId, finalAuthorId, showViewProfile })}</> : null
          )}
          
          {/* Edit and Delete options only for content owners/admins */}
          {canManage && (
            <>
              {showViewProfile && finalAuthorId !== undefined && finalAuthorId !== null && <DropdownMenuSeparator />}
              
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {contentType}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Buttons for editing and deleting content
 */
export function ContentManagementButtons({ 
  canManage, 
  contentId, 
  contentType,
  onEdit,
  queryKeys = []
}: ManagementButtonsProps) {
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  
  const getEndpoint = () => {
    switch (contentType) {
      case 'service':
        return `/api/services/${contentId}`;
      case 'product':
        return `/api/products/${contentId}`;  
      case 'post':
        return `/api/posts/${contentId}`;
      case 'comment':
        return `/api/comments/${contentId}`;
      case 'event':
        return `/api/events/${contentId}`;
      case 'location':
        return `/api/locations/${contentId}`;
      default:
        return '';
    }
  };

  const handleDelete = async () => {
    try {
      // Get current user from global context
      const user = window.__URBAN_CULTURE_USER__;
      
      if (!user) {
        console.error("User not found in global context");
        toast({
          title: "Authentication Error",
          description: "You must be logged in to delete content",
          variant: "destructive"
        });
        return;
      }

      // Create a request body with user credentials
      const requestBody = {
        userId: user.id,
        userRole: user.role || 'user'
      };
      
      // Log data for debugging
      console.log(`Deleting ${contentType} with auth data:`, {
        contentId: contentId,
        userId: user.id,
        userRole: user.role,
        endpoint: getEndpoint(),
        requestBody
      });
      
      // Make request with user info in body rather than params
      const response = await fetch(getEndpoint(), {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id?.toString() || '',
          'X-User-Role': user.role || '',
        },
        body: JSON.stringify(requestBody),
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to delete ${contentType}`);
      }
      
      toast({
        title: `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} deleted`,
        description: `The ${contentType} has been deleted successfully`,
      });
      
      // Invalidate relevant queries to refresh data
      if (queryKeys.length > 0) {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    } catch (error) {
      console.error(`Error deleting ${contentType}:`, error);
      toast({
        title: `Failed to delete ${contentType}`,
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  if (!canManage) return null;
  
  return (
    <>
      <div className="flex space-x-2">
        {onEdit && (
          <Button variant="outline" size="sm" className="flex items-center" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={() => setIsDeleteAlertOpen(true)}
        >
          <Trash className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </div>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {contentType}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Utility functions to check if current user can manage specific content
 */
export function canManagePost(currentUser: any, postUserId: number | null): boolean {
  // null check
  if (!currentUser) return false;
  
  // Admin can manage all posts
  if (currentUser.role === "admin") return true;
  
  // User can manage their own posts
  if (currentUser.id === postUserId) return true;
  
  // Otherwise not allowed
  return false;
}

export function canManageComment(currentUser: any, commentUserId: number | null): boolean {
  // Same logic as posts
  return canManagePost(currentUser, commentUserId);
}

export function canManageEvent(currentUser: any, eventOrganizerId: number | null): boolean {
  // null check
  if (!currentUser) return false;
  
  // Admin can manage all events
  if (currentUser.role === "admin") return true;
  
  // Organizer can manage their own events
  if (currentUser.id === eventOrganizerId) return true;
  
  // Otherwise not allowed
  return false;
}

export function canManageService(currentUser: any, serviceProviderId: number | null): boolean {
  // Same logic as posts
  return canManagePost(currentUser, serviceProviderId);
}

export function canManageProduct(currentUser: any, productSellerId: number | null): boolean {
  // Same logic as posts
  return canManagePost(currentUser, productSellerId);
}

export function canManageLocation(currentUser: any, locationCreatorId: number | null): boolean {
  // null check
  if (!currentUser) return false;
  
  // Admin can manage all locations
  if (currentUser.role === "admin") return true;
  
  // Location creator can manage their own locations
  if (currentUser.id === locationCreatorId) return true;
  
  // Special check for municipality and organization users
  if (
    (currentUser.role === "municipality" || currentUser.role === "organization") && 
    locationCreatorId === null
  ) {
    return true;
  }
  
  // Otherwise not allowed
  return false;
}
