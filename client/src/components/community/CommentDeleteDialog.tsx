import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket, MessageType } from '@/contexts/WebSocketSingletonContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CommentDeleteDialogProps {
  comment: {
    id: number;
    postId: number;
    parentCommentId: number | null;
    userId: number; // Added userId for permission checking
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CommentDeleteDialog({
  comment,
  isOpen,
  onClose,
  onSuccess,
}: CommentDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDeleteClicked, setIsDeleteClicked] = useState(false);
  const { subscribe } = useWebSocket();
  
  // Set up WebSocket listeners for comment deletion notifications
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to content moderation notifications
    const unsubscribe = subscribe((message) => {
      // Only process content moderation messages for comment deletions
      if (message.type === 'CONTENT_MODERATION' &&
          message.payload.contentType === 'comment' &&
          message.payload.action === 'deleted') {
        
        const { commentId } = message.payload;
        
        // If the notification is for the current comment, close the dialog
        if (comment && commentId === comment.id) {
          toast({
            title: 'Comment removed',
            description: message.payload.message || 'The comment has been removed',
          });
          
          // Invalidate the appropriate queries for this comment
          queryClient.invalidateQueries({ queryKey: [`/api/posts/${comment.postId}/comments`] });
          
          if (comment.parentCommentId) {
            queryClient.invalidateQueries({
              queryKey: [`/api/comments/${comment.parentCommentId}/replies`]
            });
          }
          
          // Close the dialog
          onClose();
          if (onSuccess) onSuccess();
        }
      }
    });
    
    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [user, comment, queryClient, onClose, onSuccess, toast, subscribe]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // With the updated apiRequest function, we can now correctly pass
      // auth data in headers and query parameters
      const response = await apiRequest(`/api/comments/${comment.id}`, "DELETE", {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.id?.toString() || '',
          'X-User-Role': user?.role || '',
        },
        params: {
          userId: user?.id,
          userRole: user?.role,
        },
        withCredentials: true
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete comment');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate comment queries - both top-level comments and replies
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${comment.postId}/comments`] });
      
      // If it's a reply, also invalidate replies for the parent comment
      if (comment.parentCommentId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/comments/${comment.parentCommentId}/replies`] 
        });
      }

      toast({
        title: 'Comment deleted',
        description: 'Your comment has been successfully deleted.',
      });

      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      setIsDeleteClicked(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    // Check if user is logged in and has permission
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'You must be logged in to delete comments.',
        variant: 'destructive',
      });
      return;
    }

    // Only allow the comment owner or admins to delete
    if (comment.userId !== user.id && user.role !== 'admin') {
      toast({
        title: 'Permission denied',
        description: 'You can only delete your own comments.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleteClicked(true);
    deleteMutation.mutate();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {comment.parentCommentId ? 'Reply' : 'Comment'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this {comment.parentCommentId ? 'reply' : 'comment'}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending || isDeleteClicked}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMutation.isPending || isDeleteClicked}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending || isDeleteClicked ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}