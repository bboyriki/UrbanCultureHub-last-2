import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImageUploaderProps {
  initialImage?: string;
  onImageUploaded: (imageUrl: string, publicId: string) => void;
  onUploadStart?: () => void;
  folder?: string;
  className?: string;
  buttonText?: string;
}

const ImageUploader = ({
  initialImage,
  onImageUploaded,
  onUploadStart,
  folder = "urban-culture",
  className = "",
  buttonText = "Upload Image"
}: ImageUploaderProps) => {
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [publicId, setPublicId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      // Extract public ID from Cloudinary URL if possible
      try {
        const urlParts = initialImage.split('/');
        const filenamePart = urlParts[urlParts.length - 1];
        const publicIdParts = filenamePart.split('.');
        if (publicIdParts.length > 1) {
          setPublicId(publicIdParts[0]);
        }
      } catch (error) {
        console.error("Could not extract public ID from URL", error);
      }
    }
  }, [initialImage]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent the click from propagating to parent elements (like a dialog close)
    e.preventDefault();
    e.stopPropagation();
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Notify parent component upload is starting
    if (onUploadStart) {
      onUploadStart();
    }
    
    try {
      // Step 1: Get upload signature from server
      console.log("Getting upload signature from server...");
      
      const signatureResponse = await fetch('/api/media/upload-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          folder: folder,
          params: {
            format: 'jpg' // Include format in signature generation
          }
        })
      });

      if (!signatureResponse.ok) {
        const errorText = await signatureResponse.text();
        console.error("Signature error response:", errorText);
        throw new Error("Failed to generate upload signature");
      }

      const signatureData = await signatureResponse.json();
      
      // Step 2: Create form data for Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureData.apiKey);
      formData.append('timestamp', signatureData.timestamp.toString());
      formData.append('signature', signatureData.signature);
      formData.append('folder', folder);
      // Auto-convert HEIC and other formats to JPEG for better browser compatibility
      formData.append('format', 'jpg');
      
      // Step 3: Upload to Cloudinary directly
      if (!signatureData.cloudName) {
        throw new Error("Cloud name is missing from the signature response");
      }
      
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;
      console.log("Uploading to Cloudinary URL:", cloudinaryUrl);
      
      const cloudinaryResponse = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!cloudinaryResponse.ok) {
        const errorText = await cloudinaryResponse.text();
        console.error("Cloudinary error response:", errorText);
        throw new Error(`Failed to upload image to Cloudinary: ${cloudinaryResponse.status} ${cloudinaryResponse.statusText}`);
      }
      
      const cloudinaryData = await cloudinaryResponse.json();
      console.log("Upload successful. Image URL:", cloudinaryData.secure_url);
      
      // Set the image and public ID
      setImage(cloudinaryData.secure_url);
      setPublicId(cloudinaryData.public_id);
      
      // Notify parent component
      onImageUploaded(cloudinaryData.secure_url, cloudinaryData.public_id);
      
      toast({
        title: "Image uploaded successfully",
        description: "Your image has been uploaded."
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    // Prevent the click from propagating to parent elements
    e.preventDefault();
    e.stopPropagation();
    
    if (!publicId) return;
    
    setIsDeleting(true);
    
    try {
      console.log("Attempting to delete image with publicId:", publicId);
      
      const response = await fetch(`/api/media/${publicId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Delete error response:", errorText);
        throw new Error("Failed to delete image");
      }
      
      console.log("Image successfully deleted from Cloudinary");
      
      // Clear local state
      setImage(null);
      setPublicId("");
      
      // Notify parent component
      onImageUploaded("", "");
      
      toast({
        title: "Image deleted",
        description: "The image has been removed successfully."
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      {isUploading ? (
        <Card className="w-full aspect-video flex items-center justify-center">
          <div className="flex flex-col items-center p-4">
            <Skeleton className="h-[120px] w-[200px] rounded-md" />
            <p className="mt-2 text-sm text-muted-foreground">Uploading image...</p>
          </div>
        </Card>
      ) : image ? (
        <div className="relative w-full">
          <img 
            src={image} 
            alt="Uploaded" 
            className="w-full aspect-video object-cover rounded-md"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button 
          type="button"
          onClick={handleClick} 
          variant="outline" 
          className="w-full aspect-video flex flex-col gap-2 border-dashed"
        >
          <Upload className="h-6 w-6" />
          <span>{buttonText}</span>
        </Button>
      )}
    </div>
  );
};

export { ImageUploader };