import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ImageUploader } from "../shared/ImageUploader";
import { User } from "@shared/schema";

interface ProfileImageEditorProps {
  user: User;
}

export default function ProfileImageEditor({ user }: ProfileImageEditorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string>(user.profilePicture || "");
  const [profileImagePublicId, setProfileImagePublicId] = useState<string>("");
  const { toast } = useToast();

  // This function is called by ImageUploader after successful Cloudinary upload
  const handleImageUploaded = (imageUrl: string, publicId: string) => {
    console.log("Profile image uploaded successfully:", imageUrl);
    setProfileImageUrl(imageUrl);
    setProfileImagePublicId(publicId);
  };

  const handleSave = async () => {
    if (!profileImageUrl) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Updating user profile with new image URL:", profileImageUrl);
      
      // Update user profile with new image URL using native fetch
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profilePicture: profileImageUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update profile error:", errorText);
        throw new Error("Failed to update profile picture");
      }

      // Invalidate user queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });

      toast({
        title: "Profile updated",
        description: "Your profile picture has been updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      toast({
        title: "Update failed",
        description: "There was an error updating your profile picture",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <ImageUploader
            initialImage={user.profilePicture || undefined}
            onImageUploaded={handleImageUploaded}
            folder="profiles"
            className="w-full max-w-md"
            buttonText="Choose Image"
          />
          
          {profileImageUrl !== user.profilePicture && (
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}