import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface CommentEditDialogProps {
  comment: {
    id: number;
    content: string;
    postId: number;
    parentCommentId: number | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CommentEditDialog({ 
  comment,
  isOpen,
  onClose,
  onSuccess 
}: CommentEditDialogProps) {
  const [content, setContent] = useState(comment.content);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const editMutation = useMutation({
    mutationFn: async () => {
      // Use the updated apiRequest function with proper data field
      const response = await apiRequest(`/api/comments/${comment.id}`, "PATCH", { 
        data: { content },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update comment');
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
        title: 'Comment updated',
        description: 'Your comment has been successfully updated.',
      });
      
      onClose();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      editMutation.mutate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {comment.parentCommentId ? 'Reply' : 'Comment'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your comment..."
              className="min-h-[100px]"
              disabled={editMutation.isPending}
            />
          </div>
          
          <DialogFooter className="mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!content.trim() || editMutation.isPending}
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}