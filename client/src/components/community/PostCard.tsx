import React, { useState, useRef, useMemo, useEffect } from "react";
import { formatDistance } from "date-fns";
import { Post, Comment, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Edit, Trash2, Award, CheckCircle, Lock, Globe } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ContentManagementMenu } from "@/components/common/ContentManagement";
import { canManagePost, canManageComment } from "@/lib/permissions";
import PostEditDialog from "./PostEditDialog";
import CommentEditDialog from "./CommentEditDialog";
import CommentDeleteDialog from "./CommentDeleteDialog";
import { Link } from "wouter";
import { ReportButton } from "@/components/common/ReportButton";
import { BlockUserButton } from "@/components/common/BlockUserButton";
import { ShareDialog } from "./ShareDialog";

interface PostAuthor {
  id?: number;
  displayName: string;
  role: string;
  profilePicture: string | null;
}

interface PostCardProps {
  post: Post;
  author?: PostAuthor;
  onDelete?: () => void;
  autoShowComments?: boolean;
  isHighlighted?: boolean;
}

const PostCard = ({ post, author, onDelete, autoShowComments = false, isHighlighted = false }: PostCardProps) => {
  const [showComments, setShowComments] = useState(autoShowComments);
  const [commentText, setCommentText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [replyToComment, setReplyToComment] = useState<number | null>(null);
  const [commentToEdit, setCommentToEdit] = useState<any | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<any | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle auto-scroll to comments section when highlighted or autoShowComments
  useEffect(() => {
    if ((isHighlighted || autoShowComments) && cardRef.current) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // If auto-showing comments, scroll to comments section after card is visible
        if (autoShowComments && commentsSectionRef.current) {
          setTimeout(() => {
            commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 300);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted, autoShowComments]);

  // Update showComments when autoShowComments prop changes
  useEffect(() => {
    if (autoShowComments) {
      setShowComments(true);
    }
  }, [autoShowComments]);

  // Get author if not provided - ensure we use the correct endpoint format and properly parse the response
  const { data: fetchedAuthor, isLoading: authorLoading } = useQuery<User>({
    queryKey: [`/api/users/${post.userId}`],
    queryFn: async () => {
      const response = await apiRequest(`/api/users/${post.userId}`);
      if (response && typeof response.json === 'function') {
        return response.json();
      }
      return response;
    },
    enabled: !author && post.userId !== undefined && post.userId !== null,
    staleTime: 300000, // Cache for 5 min — user profiles rarely change mid-session
    retry: 1
  });
  
  // Create a compatible author object from the fetched data if needed
  const postAuthor: PostAuthor = useMemo(() => {
    // Priority 1: If author is provided via props, use that (e.g. from profile page)
    if (author) {
      // If author is a User object (like passed from profile), adapt it to PostAuthor format
      if ('id' in author && author.id) {
        return {
          id: author.id,
          displayName: author.displayName || `User ${author.id}`,
          role: author.role || 'user',
          profilePicture: author.profilePicture || null
        };
      }
      
      // If the author object doesn't have an ID or it's missing, add the post's userId
      return {
        ...author,
        id: author.id || post.userId || 0,
        displayName: author.displayName || `User ${post.userId || 0}`
      };
    }
    
    // Priority 2: If the post is by the current logged-in user, use current user data
    if (user && user.id === post.userId) {
      // Always ensure current user has a profile picture
      const profilePic = 
        user.id === 1 ? "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png" :
        (user.profilePicture && user.profilePicture.trim() !== "") ? 
          user.profilePicture : 
          "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png";
      
      return {
        id: user.id,
        displayName: user.displayName || '',
        role: user.role || 'user',
        profilePicture: profilePic
      };
    }
    
    // Priority 3: If we have fetched author data from API
    if (fetchedAuthor) {
      // Special case for Oudai Admin (ID 1)
      if (fetchedAuthor.id === 1) {
        return {
          id: fetchedAuthor.id,
          displayName: fetchedAuthor.displayName || 'Oudai Admin',
          role: fetchedAuthor.role || 'admin',
          profilePicture: "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
        };
      }
      
      // Always ensure database users have a profile picture
      const profilePic = 
        (fetchedAuthor.profilePicture && fetchedAuthor.profilePicture.trim() !== "") ? 
          fetchedAuthor.profilePicture : 
          "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png";
      
      return {
        id: fetchedAuthor.id,
        displayName: fetchedAuthor.displayName || '',
        role: fetchedAuthor.role || 'user',
        profilePicture: profilePic
      };
    }
    
    // Priority 4: Fallback for when we couldn't determine the author but we know the userId
    if (post.userId !== undefined && post.userId !== null) {
      // Special case for Oudai Admin (ID 1)
      if (post.userId === 1) {
        return { 
          id: 1,
          displayName: "Oudai Admin",
          role: 'admin',
          profilePicture: "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
        };
      }
      
      // For other users, use a default avatar placeholder 
      return { 
        id: post.userId,
        displayName: "User", 
        role: 'user',
        profilePicture: "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
      };
    }
    
    // Priority 5: Complete fallback when we have no info
    return { 
      id: -1,
      displayName: "User",
      role: 'user',
      profilePicture: "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
    };
  }, [author, fetchedAuthor, post.userId, user]);
    

  // Get likes
  const { data: likes = [], isLoading: likesLoading } = useQuery<any[]>({
    queryKey: [`/api/posts/${post.id}/likes`],
    enabled: post.id > 0,
  });

  // Check if the current user has liked the post
  const userLike = likes.find((like: any) => user && like.userId === user.id);
  const hasLiked = Boolean(userLike);

  // Get comments
  const { data: comments = [] } = useQuery<any[]>({
    queryKey: [`/api/posts/${post.id}/comments`],
    enabled: showComments,
  });
  
  // Query for comment replies — fetch all in parallel
  const { data: commentReplies = {} } = useQuery<Record<number, any[]>>({
    queryKey: [`/api/posts/${post.id}/comment-replies`],
    queryFn: async () => {
      const topLevel = comments.filter((c: any) => c.parentCommentId === null);
      if (topLevel.length === 0) return {};

      const results = await Promise.allSettled(
        topLevel.map(async (comment: any) => {
          const response = await apiRequest(`/api/comments/${comment.id}/replies`, "GET");
          let replyData = response;
          if (response && typeof response.json === 'function') {
            replyData = await response.json();
          }
          return { commentId: comment.id, replies: Array.isArray(replyData) ? replyData : [] };
        })
      );

      const replies: Record<number, any[]> = {};
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.replies.length > 0) {
          replies[result.value.commentId] = result.value.replies;
        }
      }
      return replies;
    },
    enabled: showComments && comments.length > 0,
  });

  // Add like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to like posts");
      
      // Check if this is a sample post (has negative ID)
      if (post.id < 0) {
        // For sample posts, we don't need to make an API call
        return { success: true, isSamplePost: true };
      }
      
      await apiRequest("/api/likes", "POST", {
        userId: user.id,
        postId: post.id,
      });
    },
    onSuccess: (data: any) => {
      // Only invalidate queries for real posts
      if (!data?.isSamplePost) {
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}/likes`] });
      } else {
        // For sample posts, just show a toast message
        toast({
          title: "Sample post liked",
          description: "This is a demo post, likes are not stored",
        });
      }
    },
    onError: (error: any) => {
      // Don't show error for already liked posts
      if (error.message?.includes("already liked")) return;
      
      toast({
        title: "Failed to like post",
        description: error.message || "Could not like this post",
        variant: "destructive",
      });
    },
  });

  // Unlike mutation
  const unlikeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !userLike) throw new Error("No like to remove");
      
      await apiRequest(`/api/likes/${userLike.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}/likes`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unlike post",
        description: error.message || "Could not unlike this post",
        variant: "destructive",
      });
    },
  });

  const handleLikePost = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please login to like posts",
        variant: "destructive",
      });
      return;
    }
    
    // If already liked, unlike it
    if (hasLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  // Add comment mutation
  const commentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      if (!user) throw new Error("You must be logged in to comment");
      if (!commentText.trim()) throw new Error("Comment cannot be empty");
      
      // Check if this is a sample post (has negative ID)
      if (post.id < 0) {
        // For sample posts, we don't need to make an API call
        return { success: true, isSamplePost: true };
      }
      
      try {
        const response = await apiRequest("/api/comments", "POST", {
          postId: post.id,
          content: commentText.trim(),
          parentCommentId: replyToComment // Include parent comment ID for replies
        });
        return response;
      } catch (error: any) {
        // Check if this is a content filtering error
        if (error.response?.data?.filteredContent) {
          throw new Error(error.response.data.message || "Your comment contains inappropriate content");
        }
        throw error;
      }
    },
    onSuccess: (data: any) => {
      // Only invalidate queries for real posts
      if (!data?.isSamplePost) {
        // Invalidate comments, replies, and the posts list so commentCount stays fresh
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}/comments`] });
        queryClient.invalidateQueries({ queryKey: [`/api/posts/${post.id}/comment-replies`] });
        queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
        
        toast({
          title: replyToComment ? "Reply posted" : "Comment posted",
          description: replyToComment 
            ? "Your reply has been posted successfully" 
            : "Your comment has been posted successfully",
        });
      } else {
        // For sample posts, just show a toast message
        toast({
          title: replyToComment ? "Sample post reply" : "Sample post comment",
          description: "This is a demo post, comments are not stored",
        });
      }
      
      setCommentText(''); // Clear the input after successful comment
    },
    onError: (error: any) => {
      // Special handling for content filter violations
      if (error.message && error.message.includes("community guidelines")) {
        toast({
          title: "Content Filter Alert",
          description: error.message,
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Failed to post comment",
          description: error.message || "Could not post your comment",
          variant: "destructive",
        });
      }
    },
  });

  const handleCommentSubmit = () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please login to post comments",
        variant: "destructive",
      });
      return;
    }
    
    commentMutation.mutate(commentText);
    
    // Reset the reply state after submitting
    if (replyToComment) {
      setReplyToComment(null);
    }
  };

  const sharePost = () => {
    // Open the share dialog with multiple platform options
    setShareDialogOpen(true);
  };

  // Format date
  const formattedDate = post.createdAt
    ? formatDistance(new Date(post.createdAt), new Date(), { addSuffix: true })
    : "recently";
    
  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to delete posts");
      if (user.role !== "admin" && user.id !== post.userId) {
        throw new Error("You can only delete your own posts");
      }
      
      // Check if this is a sample post (has negative ID)
      if (post.id < 0) {
        // For sample posts, we don't need to make an API call
        return { success: true, isSamplePost: true };
      }

      // Include auth data in both headers and params for robust permission checking
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.id?.toString() || '',
          'X-User-Role': user?.role || '',
        },
        withCredentials: true,
        params: {
          userId: user?.id,
          userRole: user?.role,
        }
      };
      
      await apiRequest(`/api/posts/${post.id}`, "DELETE", config);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      
      if (data?.isSamplePost) {
        toast({
          title: "Sample post hidden",
          description: "This sample post has been removed from view",
        });
      } else {
        toast({
          title: "Post deleted",
          description: "The post has been removed successfully",
        });
      }
      
      if (onDelete) onDelete();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete post",
        description: error.message || "Could not delete this post",
        variant: "destructive",
      });
    },
  });

  const handleDeletePost = () => {
    setDeleteDialogOpen(false);
    deletePostMutation.mutate();
  };

  // Check if user can manage the post using our permission utility
  const canManage = canManagePost(user, post.userId);

  return (
    <div>
      {/* Edit Post Dialog */}
      {editDialogOpen && (
        <PostEditDialog
          post={post}
          isOpen={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={() => {
            // If we're on a profile page or other list that uses onDelete callback,
            // also notify the parent component about the update
            if (onDelete) queryClient.invalidateQueries({ queryKey: [`/api/users/${post.userId}/posts`] });
          }}
        />
      )}
      
      {/* Comment Edit Dialog */}
      {commentToEdit && (
        <CommentEditDialog
          comment={commentToEdit}
          isOpen={Boolean(commentToEdit)}
          onClose={() => setCommentToEdit(null)}
          onSuccess={() => {
            // The comment edit dialog will automatically invalidate the correct queries
            setCommentToEdit(null);
          }}
        />
      )}
      
      {/* Comment Delete Dialog */}
      {commentToDelete && (
        <CommentDeleteDialog
          comment={commentToDelete}
          isOpen={Boolean(commentToDelete)}
          onClose={() => setCommentToDelete(null)}
          onSuccess={() => {
            // The comment delete dialog will automatically invalidate the correct queries
            setCommentToDelete(null);
          }}
        />
      )}
    
      <Card 
        ref={cardRef}
        id={`post-${post.id}`}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 transition-colors duration-300 ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        data-testid={`card-post-${post.id}`}
      >
        <div>
          <div className="flex items-center justify-between mb-3">
          {postAuthor && postAuthor.id ? (
            <div className="flex items-center">
              <div className="flex items-center">
                <Link href={`/profile/${postAuthor.id}`} className="mr-3">
                  <Avatar className="w-10 h-10 rounded-full border-2 border-primary">
                    <AvatarImage 
                      src={
                        postAuthor?.id === 1 
                          ? "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
                          : postAuthor?.profilePicture && postAuthor.profilePicture.trim() !== ""
                            ? postAuthor.profilePicture
                            : "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
                      } 
                      alt={postAuthor?.displayName || "User"} 
                    />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {postAuthor?.displayName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <Link href={`/profile/${postAuthor.id}`} 
                    className="font-medium text-foreground hover:underline cursor-pointer">
                    {postAuthor?.displayName && postAuthor.displayName.trim() && !postAuthor.displayName.includes("undefined") 
                      ? postAuthor.displayName 
                      : "User"}
                  </Link>
                  <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                    {postAuthor?.role === "artist" ? "Artist" : 
                     postAuthor?.role === "enthusiast" ? "Urban Enthusiast" :
                     postAuthor?.role || "User"} • {formattedDate}
                    {(post as any).privacy === "friends_only" && (
                      <Lock className="h-3 w-3 text-muted-foreground ml-0.5" title="Followers only" />
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              {/* User avatar with profile link - make sure we always have valid IDs */}
              <Link href={`/profile/${postAuthor.id || post.userId}`} className="mr-3">
                <Avatar className="w-10 h-10 rounded-full border-4 border-white dark:border-gray-900 shadow-md">
                  <AvatarImage 
                    src={
                      postAuthor?.id === 1 
                        ? "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
                        : postAuthor?.profilePicture && postAuthor.profilePicture.trim() !== ""
                          ? postAuthor.profilePicture
                          : "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
                    } 
                    alt={postAuthor?.displayName || `User ${postAuthor.id || post.userId}`} 
                  />
                  <AvatarFallback className="text-sm bg-primary/20 text-primary">
                    {postAuthor?.displayName ? postAuthor.displayName.charAt(0) : 
                     postAuthor.id ? String(postAuthor.id).charAt(0) : 
                     post.userId ? String(post.userId).charAt(0) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link href={`/profile/${postAuthor.id || post.userId}`}
                  className="font-medium text-foreground hover:underline cursor-pointer">
                  {postAuthor?.displayName && postAuthor.displayName.trim() && !postAuthor.displayName.includes("undefined") 
                    ? postAuthor.displayName 
                    : `User ${postAuthor.id || post.userId}`}
                </Link>
                {/* Role badge - mirroring profile page format */}
                <p className="text-gray-500 dark:text-gray-400 text-xs flex items-center">
                  {postAuthor?.role === "artist" ? (
                    <span className="flex items-center">
                      <Award className="h-3 w-3 mr-1" /> Artist
                    </span>
                  ) : 
                   postAuthor?.role === "enthusiast" ? "Urban Enthusiast" :
                   postAuthor?.role === "municipality" ? "Municipality" :
                   postAuthor?.role === "school" ? "School" :
                   postAuthor?.role === "admin" ? (
                    <span className="flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" /> Admin
                    </span>
                   ) : "User"}
                  <span className="mx-1">•</span> {formattedDate}
                </p>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            {/* Content moderation options */}
            {user && postAuthor && postAuthor.id && user.id !== postAuthor.id && (
              <BlockUserButton
                userId={postAuthor.id}
                username={postAuthor.displayName || "User"}
                variant="icon"
              />
            )}
            
            <ReportButton
              contentId={post.id}
              contentType="post"
              variant="icon"
            />

            {/* Post management options */}
            <ContentManagementMenu
              canManage={canManage}
              contentId={post.id}
              contentType="post"
              onEdit={() => setEditDialogOpen(true)}
              queryKeys={["/api/posts"]}
              className="text-gray-500 hover:text-gray-700"
              authorId={postAuthor?.id !== undefined ? postAuthor.id : post.userId}
              showViewProfile={true}
            />
          </div>
        </div>
      
      <p className="mb-3 text-foreground">{post.content}</p>
      
      {post.image && (
        <div className="mb-3 w-full overflow-hidden rounded-lg">
          <img 
            src={post.image} 
            alt="Post content" 
            className="w-full h-auto max-h-96 object-cover rounded-lg hover:scale-[1.01] transition-transform duration-200"
            onError={(e) => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.src = "";
              target.alt = "Image failed to load";
              target.style.display = "none";
            }}
          />
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 dark:text-gray-400 p-0 hover:text-primary dark:hover:text-primary hover:bg-transparent"
            onClick={handleLikePost}
            disabled={likeMutation.isPending || unlikeMutation.isPending}
            data-testid={`button-like-${post.id}`}
          >
{hasLiked ? (
              // Filled heart when liked
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1 text-red-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              // Empty heart when not liked
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            )}
            <span className="font-medium">{likesLoading ? ((post as any).likeCount ?? 0) : likes.length}</span>
            <span className="ml-1">Likes</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center text-gray-500 dark:text-gray-400 p-0 hover:text-primary dark:hover:text-primary hover:bg-transparent"
            onClick={toggleComments}
            data-testid={`button-comments-${post.id}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="font-medium">{showComments && comments.length > 0 ? comments.length : ((post as any).commentCount ?? 0)}</span>
            <span className="ml-1">Comments</span>
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center text-gray-500 dark:text-gray-400 p-0 hover:text-primary dark:hover:text-primary hover:bg-transparent"
          onClick={sharePost}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          <span>Share</span>
        </Button>
      </div>
      
      {/* Comments section (conditionally rendered) */}
      {showComments && (
        <div 
          ref={commentsSectionRef}
          id={`post-${post.id}-comments`}
          className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700"
        >
          <h4 className="font-medium text-sm mb-2 text-foreground">Comments</h4>
          
          {comments?.length > 0 ? (
            <div className="space-y-3">
              {comments
                .filter((comment: any) => comment.parentCommentId === null) // Only show top-level comments here
                .map((comment: any) => {
                  const replies = commentReplies[comment.id] || [];
                  return (
                    <div key={comment.id} className="space-y-2">
                      {/* Top level comment */}
                      <div className="flex">
                        {comment.user?.id ? (
                          <Link href={`/profile/${comment.user.id}`} className="mr-2">
                            <Avatar className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-900 shadow-sm">
                              <AvatarImage 
                                src={
                                  comment.user?.id === 1 
                                    ? "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
                                    : comment.user?.profilePicture || "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
                                } 
                                alt={comment.user?.displayName || "User"} 
                              />
                              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                {comment.user?.displayName?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                          </Link>
                        ) : (
                          <Avatar className="w-8 h-8 mr-2 rounded-full border-2 border-white dark:border-gray-900 shadow-sm">
                            <AvatarFallback className="bg-primary/20 text-primary text-sm">
                              {comment.user?.displayName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-2 text-sm flex-1">
                          <div className="flex justify-between">
                            <div className="font-medium text-foreground">
                              {comment.user?.id ? (
                                <Link href={`/profile/${comment.user.id}`}
                                  className="hover:underline text-foreground cursor-pointer">
                                  {comment.user?.displayName && !comment.user.displayName.includes("undefined") 
                                    ? comment.user.displayName 
                                    : `User ${comment.user?.id || comment.userId || ""}`}
                                </Link>
                              ) : (
                                comment.user?.displayName && !comment.user.displayName.includes("undefined") 
                                  ? comment.user.displayName 
                                  : `User ${comment.user?.id || comment.userId || ""}`
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {/* Edit button (only for comment owner or admin) */}
                              {canManageComment(user, comment.userId) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                                  onClick={() => setCommentToEdit(comment)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Delete button (only for comment owner or admin) */}
                              {canManageComment(user, comment.userId) && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                                  onClick={() => setCommentToDelete(comment)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                              
                              {/* Report button (for all users) */}
                              {user && (
                                <ReportButton
                                  contentId={comment.id}
                                  contentType="comment"
                                  variant="icon"
                                  className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                                />
                              )}
                              
                              {/* Reply button (for all users) */}
                              {user && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 px-2 text-xs text-primary"
                                  onClick={() => {
                                    setReplyToComment(comment.id);
                                    if (commentInputRef.current) {
                                      commentInputRef.current.focus();
                                      const displayName = comment.user?.displayName && !comment.user.displayName.includes("undefined") 
                                        ? comment.user.displayName 
                                        : `User ${comment.user?.id || comment.userId || ""}`;
                                      setCommentText(`@${displayName} `);
                                    }
                                  }}
                                >
                                  Reply
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-foreground/80">{comment.content}</p>
                        </div>
                      </div>
                      
                      {/* Replies to this comment */}
                      {replies.length > 0 && (
                        <div className="ml-8 space-y-2">
                          {replies.map((reply: any) => (
                            <div key={reply.id} className="flex">
                              {reply.user?.id ? (
                                <Link href={`/profile/${reply.user.id}`} className="mr-2">
                                  <Avatar className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 shadow-sm">
                                    <AvatarImage 
                                      src={
                                        reply.user?.id === 1 
                                          ? "https://res.cloudinary.com/dbutuy5tt/image/upload/v1743030827/profiles/odkbtj331neofqrthajr.png"
                                          : reply.user?.profilePicture || "https://res.cloudinary.com/dbutuy5tt/image/upload/v1742093072/profiles/avatar-placeholder_twgmxn.png"
                                      } 
                                      alt={reply.user?.displayName || "User"} 
                                    />
                                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                      {reply.user?.displayName?.charAt(0) || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                </Link>
                              ) : (
                                <Avatar className="w-6 h-6 mr-2 rounded-full border-2 border-white dark:border-gray-900 shadow-sm">
                                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                    {reply.user?.displayName?.charAt(0) || "U"}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2 text-sm flex-1">
                                <div className="flex justify-between items-center">
                                  <div className="font-medium text-foreground text-xs">
                                    {reply.user?.id ? (
                                      <Link href={`/profile/${reply.user.id}`}
                                        className="hover:underline text-foreground cursor-pointer">
                                        {reply.user?.displayName && !reply.user.displayName.includes("undefined") 
                                          ? reply.user.displayName 
                                          : `User ${reply.user?.id || reply.userId || ""}`}
                                      </Link>
                                    ) : (
                                      reply.user?.displayName && !reply.user.displayName.includes("undefined") 
                                        ? reply.user.displayName 
                                        : `User ${reply.user?.id || reply.userId || ""}`
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    {/* Edit button (only for reply owner or admin) */}
                                    {canManageComment(user, reply.userId) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 w-5 p-0 text-gray-500 hover:text-gray-700"
                                        onClick={() => setCommentToEdit(reply)}
                                      >
                                        <Edit className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    
                                    {/* Delete button (only for reply owner or admin) */}
                                    {canManageComment(user, reply.userId) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 w-5 p-0 text-gray-500 hover:text-red-500"
                                        onClick={() => setCommentToDelete(reply)}
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
                                    )}

                                    {/* Report button for replies (for all users) */}
                                    {user && (
                                      <ReportButton
                                        contentId={reply.id}
                                        contentType="comment"
                                        variant="icon"
                                        className="h-5 w-5 p-0 text-gray-500 hover:text-red-500"
                                      />
                                    )}
                                  </div>
                                </div>
                                <p className="text-foreground/80 text-xs">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No comments yet. Be the first to comment!</p>
          )}
          
          {/* Active comment input */}
          <div className="mt-3 flex flex-col">
            {/* Reply indicator */}
            {replyToComment !== null && (
              <div className="flex items-center mb-2 text-xs text-primary">
                <span>Replying to comment</span>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  className="h-5 px-1 ml-2 text-xs text-gray-500"
                  onClick={() => setReplyToComment(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
            
            <div className="flex">
              <Input 
                ref={commentInputRef}
                className="flex-1 mr-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400" 
                placeholder={user 
                  ? replyToComment !== null 
                    ? "Write a reply..." 
                    : "Write a comment..." 
                  : "Please login to comment"
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommentSubmit();
                  }
                }}
                disabled={!user || commentMutation.isPending}
              />
              <Button 
                size="sm" 
                className="dark:bg-primary dark:text-white dark:hover:bg-primary/90"
                onClick={handleCommentSubmit}
                disabled={!user || !commentText.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
        </div>
    </Card>
    
    {/* Share Dialog */}
    <ShareDialog
      open={shareDialogOpen}
      onOpenChange={setShareDialogOpen}
      postId={post.id}
      postContent={post.content || ''}
      authorName={postAuthor?.displayName || 'User'}
      postImage={post.image || null}
    />
    </div>
  );
};

// Input component for comments with all necessary props
// Custom Input component for comments
const Input = React.forwardRef<
  HTMLInputElement,
  {
    className?: string;
    placeholder?: string;
    size?: string;
    disabled?: boolean;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }
>(({ className = "", placeholder, disabled, value, onChange, onKeyDown }, ref) => (
  <input
    ref={ref}
    type="text"
    className={`border border-gray-300 rounded-lg px-3 py-2 ${className}`}
    placeholder={placeholder}
    disabled={disabled}
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
  />
));

export default PostCard;
