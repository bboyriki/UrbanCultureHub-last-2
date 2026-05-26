import React, { useState, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  folder?: string;
  className?: string;
  accept?: string;
  maxSize?: number;
  label?: string;
  buttonText?: string;
}

export function FileUpload({
  onUploadComplete,
  folder = "profiles",
  className = "",
  accept = "image/jpeg,image/png,image/gif",
  maxSize = 5 * 1024 * 1024, // 5MB default
  label = "Upload Image",
  buttonText = "Select Image"
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `The file exceeds the maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    // Save the filename for display
    setFileName(file.name);
    setIsUploading(true);

    try {
      console.log(`Preparing to upload file: ${file.name} to folder: ${folder}`);
      
      // Step 1: Get upload signature from server
      console.log("Getting upload signature from server...");
      
      const signatureResponse = await fetch('/api/media/upload-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folder: folder })
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
      
      // Call the callback with the new URL
      onUploadComplete(cloudinaryData.secure_url);
      
      toast({
        title: "Upload successful",
        description: "Your image has been uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Something went wrong while uploading your image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to convert File to base64 string
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="file-upload">{label}</Label>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="relative"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            buttonText
          )}
        </Button>
        {fileName && !isUploading && (
          <span className="text-sm text-gray-500 truncate max-w-[200px]">
            {fileName}
          </span>
        )}
        <input
          id="file-upload"
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
      </div>
    </div>
  );
}