import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Copy, 
  Check, 
  Share2, 
  MessageCircle,
  X,
  Lock
} from "lucide-react";
import { SiInstagram, SiWhatsapp, SiFacebook } from "react-icons/si";
import { useCanShare } from "@/hooks/useCanShare";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: number;
  postContent: string;
  authorName: string;
  postImage?: string | null;
}

export function ShareDialog({ 
  open, 
  onOpenChange, 
  postId, 
  postContent, 
  authorName,
  postImage 
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const canShare = useCanShare();
  
  const postUrl = `${window.location.origin}/post/${postId}`;
  const shareText = postContent?.substring(0, 100) + (postContent?.length > 100 ? '...' : '');
  const encodedUrl = encodeURIComponent(postUrl);
  const encodedText = encodeURIComponent(shareText);
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Post link has been copied to your clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the link",
        variant: "destructive",
      });
    }
  };
  
  const shareToInstagramStory = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      const instagramStoryUrl = `instagram://story-camera`;
      
      toast({
        title: "Opening Instagram",
        description: "Take a screenshot and share to your Story, or copy the link first",
      });
      
      copyToClipboard();
      
      setTimeout(() => {
        window.location.href = instagramStoryUrl;
      }, 500);
      
      setTimeout(() => {
        const instagramAppUrl = `instagram://`;
        window.location.href = instagramAppUrl;
      }, 1500);
    } else {
      toast({
        title: "Instagram Stories",
        description: "Open Instagram on your mobile device to share to your Story. Link copied to clipboard!",
      });
      copyToClipboard();
      
      window.open('https://www.instagram.com/', '_blank');
    }
  };
  
  const shareToWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
    window.open(whatsappUrl, '_blank');
    onOpenChange(false);
  };
  
  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    window.open(facebookUrl, '_blank');
    onOpenChange(false);
  };
  
  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    window.open(twitterUrl, '_blank');
    onOpenChange(false);
  };
  
  const useNativeShare = async () => {
    const shareData = {
      title: `Post by ${authorName}`,
      text: shareText,
      url: postUrl
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast({
          title: "Shared successfully",
          description: "The post has been shared",
        });
        onOpenChange(false);
      } else {
        copyToClipboard();
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        copyToClipboard();
      }
    }
  };

  if (!canShare) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-share-locked">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Sharing Locked
            </DialogTitle>
            <DialogDescription>
              Sharing posts is currently restricted. Only admins can grant this permission.
              Please contact a community admin if you need to share content.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <Button onClick={() => onOpenChange(false)} className="w-full" data-testid="button-close-share-locked">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Post
          </DialogTitle>
          <DialogDescription>
            Share this post to your favorite platform
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2">
            <Input 
              value={postUrl} 
              readOnly 
              className="flex-1 text-sm"
              data-testid="input-share-url"
            />
            <Button 
              size="icon" 
              variant="outline" 
              onClick={copyToClipboard}
              data-testid="button-copy-link"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white border-0 hover:opacity-90"
              onClick={shareToInstagramStory}
              data-testid="button-share-instagram"
            >
              <SiInstagram className="h-5 w-5" />
              <span>Instagram Story</span>
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 bg-green-500 text-white border-0 hover:bg-green-600"
              onClick={shareToWhatsApp}
              data-testid="button-share-whatsapp"
            >
              <SiWhatsapp className="h-5 w-5" />
              <span>WhatsApp</span>
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 bg-blue-600 text-white border-0 hover:bg-blue-700"
              onClick={shareToFacebook}
              data-testid="button-share-facebook"
            >
              <SiFacebook className="h-5 w-5" />
              <span>Facebook</span>
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center justify-center gap-2 h-12 bg-black dark:bg-white text-white dark:text-black border-0 hover:opacity-90"
              onClick={shareToTwitter}
              data-testid="button-share-twitter"
            >
              <X className="h-5 w-5" />
              <span>X (Twitter)</span>
            </Button>
          </div>
          
          {'share' in navigator && (
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 h-12"
              onClick={useNativeShare}
              data-testid="button-share-native"
            >
              <Share2 className="h-5 w-5" />
              <span>More Options</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
