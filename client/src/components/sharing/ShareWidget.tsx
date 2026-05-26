import React, { useState } from 'react';
import { 
  Facebook, 
  Twitter, 
  Instagram, 
  Share2, 
  Link, 
  Mail, 
  Copy, 
  Check,
  X
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SharingMetadata {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  hashtags?: string[];
  insights?: string;
}

interface ShareWidgetProps {
  metadata: SharingMetadata;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'ghost' | 'link';
  className?: string;
}

export function ShareWidget({ 
  metadata, 
  size = 'md',
  variant = 'ghost',
  className 
}: ShareWidgetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const { title, description, url, imageUrl, hashtags = [], insights } = metadata;
  
  // Ensure we're using the full URL
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  
  // Prepare share text with insights and hashtags
  const shareText = insights 
    ? `${title} - ${insights}` 
    : title;

  const hashtagsText = hashtags.length > 0 
    ? hashtags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ') 
    : '';

  // Extract content ID from URL
  const extractContentId = () => {
    if (!fullUrl) return null;
    const matches = fullUrl.match(/\/([^\/]+)\/(\d+)$/);
    return matches && matches[2] ? parseInt(matches[2], 10) : null;
  };
  
  // Extract content type from URL
  const extractContentType = () => {
    if (!fullUrl) return 'unknown';
    const matches = fullUrl.match(/\/([^\/]+)\/\d+$/);
    const path = matches && matches[1] ? matches[1] : '';
    
    switch (path) {
      case 'events':
        return 'event';
      case 'locations':
        return 'location';
      case 'services':
        return 'service';
      case 'marketplace':
        return 'product';
      case 'posts':
        return 'post';
      default:
        return 'unknown';
    }
  };
  
  // Record share action through WebSocket
  const recordShareAction = (platform: string) => {
    const contentId = extractContentId();
    const contentType = extractContentType();
    
    // Only track if we have a valid content ID
    if (contentId) {
      try {
        // Find user ID if available (from auth context or localStorage)
        const userDataString = localStorage.getItem('userData');
        const userId = userDataString ? JSON.parse(userDataString).id : null;
        
        // If WebSocket is available, send notification
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
        
        // Create a temporary WebSocket connection if none exists
        const tempSocket = new WebSocket(wsUrl);
        
        tempSocket.onopen = () => {
          // Authenticate first if we have a user ID
          if (userId) {
            tempSocket.send(JSON.stringify({
              type: 'auth',
              userId,
              role: 'user'
            }));
          }
          
          // Send notification about the shared content
          tempSocket.send(JSON.stringify({
            type: 'notification',
            notificationType: 'CONTENT_SHARED',
            payload: {
              contentType,
              contentId,
              platform,
              timestamp: new Date()
            },
            targetUserId: null // This will be broadcast to admins
          }));
          
          // Close the socket after sending
          setTimeout(() => tempSocket.close(), 500);
        };
        
        // Handle errors
        tempSocket.onerror = () => {
          console.log('WebSocket connection error when sharing content');
        };
      } catch (error) {
        console.log('Error recording share action:', error);
      }
    }
  };

  // Share URLs for different platforms
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}${hashtagsText ? `&hashtags=${hashtagsText.replace(/#/g, '')}` : ''}`;
  
  // Email share content
  const emailSubject = encodeURIComponent(title);
  const emailBody = encodeURIComponent(`${title}\n\n${description}\n\n${insights ? `${insights}\n\n` : ''}${fullUrl}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  
  // Facebook share URL
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}&quote=${encodeURIComponent(shareText)}`;

  // Copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
      recordShareAction('clipboard');
    }).catch(err => {
      toast({
        title: "Failed to copy link",
        description: "Please try again or copy the link manually.",
        variant: "destructive"
      });
    });
  };

  // For Instagram, we need a different approach as they don't have a direct share URL
  const shareToInstagram = () => {
    toast({
      title: "Instagram sharing",
      description: "Instagram doesn't support direct sharing. Copy the link and share it on Instagram manually.",
    });
    copyToClipboard();
    recordShareAction('instagram');
  };

  // Size classes for the share button
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10', 
    lg: 'h-12 w-12'
  };

  // Size classes for the share icons
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className={cn(sizeClasses[size], className)}
          aria-label="Share this content"
        >
          <Share2 className={iconSizes[size]} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium">Share this content</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4">
            {insights && (
              <div className="mb-4 p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-1">Urban Insight:</p>
                <p className="text-muted-foreground">{insights}</p>
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Button 
                variant="outline" 
                size="icon" 
                className="flex flex-col items-center justify-center h-16 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-800/50"
                onClick={() => {
                  window.open(twitterUrl, '_blank');
                  recordShareAction('twitter');
                }}
              >
                <Twitter className="h-6 w-6 text-[#1DA1F2] mb-1" />
                <span className="text-xs">Twitter</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="flex flex-col items-center justify-center h-16 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-800/50"
                onClick={() => {
                  window.open(facebookUrl, '_blank');
                  recordShareAction('facebook');
                }}
              >
                <Facebook className="h-6 w-6 text-[#4267B2] mb-1" />
                <span className="text-xs">Facebook</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="flex flex-col items-center justify-center h-16 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-800/50"
                onClick={shareToInstagram}
              >
                <Instagram className="h-6 w-6 text-[#E1306C] mb-1" />
                <span className="text-xs">Instagram</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="flex flex-col items-center justify-center h-16 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-800/50"
                onClick={() => {
                  window.open(emailUrl, '_blank');
                  recordShareAction('email');
                }}
              >
                <Mail className="h-6 w-6 text-amber-600 dark:text-amber-400 mb-1" />
                <span className="text-xs">Email</span>
              </Button>
            </div>
            
            <div className="relative">
              <div className="flex items-center space-x-2">
                <input 
                  type="text" 
                  value={fullUrl}
                  readOnly
                  className="w-full p-2 bg-muted rounded-md text-sm pr-10"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                  onClick={copyToClipboard}
                >
                  {copied ? 
                    <Check className="h-4 w-4 text-green-500" /> : 
                    <Copy className="h-4 w-4" />
                  }
                </Button>
              </div>
            </div>
            
            {hashtagsText && (
              <div className="mt-3 flex flex-wrap gap-1">
                {hashtags.map((tag, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                  >
                    #{tag.replace(/\s+/g, '')}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}