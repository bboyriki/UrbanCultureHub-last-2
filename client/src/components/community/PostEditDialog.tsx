import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Post } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/shared/ImageUploader";

// Validation schema for post editing
const postEditSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Post content is required"),
  image: z.string().optional(),
  tags: z.string().optional(),
  artType: z.string().optional(),
});

type PostEditFormValues = z.infer<typeof postEditSchema>;

interface PostEditDialogProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PostEditDialog({
  post,
  isOpen,
  onClose,
  onSuccess,
}: PostEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  // Initialize form with existing post data
  const form = useForm<PostEditFormValues>({
    resolver: zodResolver(postEditSchema),
    defaultValues: {
      title: "",  // Our schema doesn't include title but we keep it for possible future use
      content: post.content || "",
      image: post.image || "",
      tags: "", // Our schema doesn't include tags but we keep it for possible future use
      artType: "", // Our schema doesn't include artType but we keep it for possible future use
    },
  });

  // Update post mutation
  const updatePostMutation = useMutation({
    mutationFn: async (data: PostEditFormValues) => {
      // Process tags if provided
      const formattedData: Partial<Post> = { ...data };
      
      // Convert comma-separated tags to array if provided
      if (data.tags) {
        formattedData.tags = data.tags.split(",").map((tag) => tag.trim());
      }
      
      // Add userId to ensure authorization check works
      if (post.userId) {
        formattedData.userId = post.userId;
      }
      
      const response = await apiRequest(
        `/api/posts/${post.id}`,
        "PATCH",
        {
          data: formattedData,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update post");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      if (post.userId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/users/${post.userId}/posts`]
        });
      }
      
      toast({
        title: "Post updated",
        description: "Your post has been updated successfully.",
      });
      
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (imageUrl: string) => {
    form.setValue("image", imageUrl);
    setIsUploading(false);
  };

  const onSubmit = (data: PostEditFormValues) => {
    updatePostMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>
            Make changes to your post. Click save when you're done.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Show title field only if post has a title */}
            {post.title && (
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      className="min-h-[120px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Image (optional)</FormLabel>
                  <FormControl>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                      {field.value ? (
                        <div className="relative">
                          <img 
                            src={field.value} 
                            alt="Post preview" 
                            className="w-full h-auto max-h-48 object-cover rounded-md" 
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              form.setValue("image", "");
                            }}
                            disabled={updatePostMutation.isPending}
                            type="button"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <ImageUploader 
                          onImageUploaded={(imageUrl) => handleImageUpload(imageUrl)}
                          folder="posts"
                          onUploadStart={() => setIsUploading(true)}
                          buttonText="Add a photo to your post"
                        />
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma separated, optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="art, dance, graffiti" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="artType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Art Type (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Graffiti, Dance, Music, etc."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={updatePostMutation.isPending || isUploading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updatePostMutation.isPending || isUploading}
              >
                {updatePostMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading Image...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}