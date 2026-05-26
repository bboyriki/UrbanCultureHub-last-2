import React, { useState, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Upload, X, Plus, Image } from "lucide-react";

export interface MultiImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  className?: string;
  folder?: string;
}

const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({
  images,
  onImagesChange,
  maxImages = 5,
  className = "",
  folder = "urban-culture/services",
}) => {
  // Ensure images is always an array
  const imageArray = Array.isArray(images) ? images : [];
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleAddImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (imageArray.length >= maxImages) {
      toast({
        title: "Maximum images reached",
        description: `You can only upload a maximum of ${maxImages} images.`,
        variant: "destructive",
      });
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    
    try {
      // Convert file to base64 for server upload
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          if (!event.target || typeof event.target.result !== 'string') {
            throw new Error("Failed to read file");
          }
          
          setUploadProgress(30);
          
          const base64Data = event.target.result;
          
          // Upload via our server endpoint
          const uploadResponse = await apiRequest("/api/media/upload", "POST", {
            imageData: base64Data,
            folder: folder,
            resourceType: "image"
          });
          
          setUploadProgress(90);
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || "Failed to upload image via server");
          }
          
          const uploadResult = await uploadResponse.json();
          
          if (!uploadResult.url) {
            throw new Error("No image URL returned from server");
          }
          
          console.log("Upload result:", uploadResult);
          
          // Step 3: Update the images array
          const updatedImages = [...imageArray, uploadResult.url];
          console.log("Updated images array:", updatedImages);
          onImagesChange(updatedImages);
          
          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          
          toast({
            title: "Upload successful",
            description: "Image has been uploaded successfully",
          });
        } catch (error: any) {
          console.error("Upload error:", error);
          toast({
            title: "Upload failed",
            description: error.message || "Failed to upload image",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      };
      
      reader.onerror = () => {
        setUploading(false);
        setUploadProgress(0);
        toast({
          title: "Upload failed",
          description: "Failed to read file",
          variant: "destructive",
        });
      };
      
      reader.readAsDataURL(file);
      return; // Early return as the actual upload happens in the reader.onload callback
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = async (index: number) => {
    try {
      const imageUrl = imageArray[index];
      const publicId = extractPublicIdFromUrl(imageUrl);
      
      if (publicId) {
        // Call delete API
        await apiRequest(`/api/media/${publicId}`, "DELETE");
      }
      
      // Update the images array
      const updatedImages = [...imageArray];
      updatedImages.splice(index, 1);
      onImagesChange(updatedImages);
      
      toast({
        title: "Image removed",
        description: "Image has been removed successfully",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Failed to remove image",
        description: error.message || "An error occurred while removing the image",
        variant: "destructive",
      });
    }
  };

  // Helper function to extract public ID from Cloudinary URL
  const extractPublicIdFromUrl = (url: string): string | null => {
    try {
      // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image_id.jpg
      const regex = /\/upload\/(?:v\d+\/)?(.+)\.\w+(?:\?.*)?$/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {imageArray.map((image, index) => (
          <div key={index} className="relative group aspect-square border rounded-md overflow-hidden bg-muted">
            <img 
              src={image} 
              alt={`Product image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemoveImage(index)}
              className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        
        {/* Add image button */}
        {imageArray.length < maxImages && !uploading && (
          <Button
            type="button"
            variant="outline"
            className="aspect-square h-auto flex flex-col items-center justify-center border-dashed"
            onClick={handleAddImage}
          >
            <Plus className="h-6 w-6 mb-1" />
            <span className="text-xs">Add Image</span>
          </Button>
        )}
        
        {/* Uploading placeholder */}
        {uploading && (
          <Card className="aspect-square flex flex-col items-center justify-center p-4">
            <Skeleton className="h-16 w-16 rounded-md mb-2" />
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
          </Card>
        )}
      </div>
      
      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {imageArray.length} of {maxImages} images
      </p>
    </div>
  );
};

export default MultiImageUploader;