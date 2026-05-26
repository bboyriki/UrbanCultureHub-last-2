import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";

interface BlockUserButtonProps {
  userId: number;
  username: string;
  variant?: 'icon' | 'text' | 'menu';
  className?: string;
  onSuccess?: () => void;
}

export function BlockUserButton({ userId, username, variant = 'text', className = '', onSuccess }: BlockUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, getToken } = useAuth();

  const handleSubmit = async () => {
    // If user not logged in, show login message
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to block users",
        variant: "destructive",
      });
      setIsOpen(false);
      return;
    }

    // Don't allow blocking yourself
    if (user.id === userId) {
      setError("You cannot block yourself");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get authentication token
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        console.error("Failed to get authentication token:", tokenError);
      }

      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          blockedId: userId,
          reason
        })
      });

      let responseText = '';
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('Error reading block response:', textError);
      }

      if (!response.ok) {
        // Try to parse as JSON if it looks like JSON
        if (responseText && (responseText.trim().startsWith('{') || responseText.trim().startsWith('['))) {
          try {
            const errorData = JSON.parse(responseText);
            console.error('Block user error response:', errorData);
            throw new Error(errorData.message || 'Failed to block user');
          } catch (jsonError) {
            console.error('Response looked like JSON but failed to parse:', jsonError);
            throw new Error('Server returned an invalid response format');
          }
        } else if (responseText.includes('<!DOCTYPE html>')) {
          // It's an HTML error page
          console.error('HTML error response received:', responseText.substring(0, 200));
          throw new Error('Server returned an HTML error page instead of JSON');
        } else {
          // Some other error
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      toast({
        title: 'User blocked',
        description: `You have successfully blocked ${username}. You will no longer see their content.`,
      });
      
      // Reset form and close dialog
      setReason('');
      setIsOpen(false);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      
      toast({
        title: 'Failed to block user',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render button based on variant
  const renderButton = () => {
    switch (variant) {
      case 'text':
        return (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(true)}
            className={`text-gray-500 hover:text-red-600 ${className}`}
          >
            <UserX className="h-4 w-4 mr-1" />
            Block User
          </Button>
        );
      case 'menu':
        return (
          <div 
            onClick={() => setIsOpen(true)}
            className={`flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-red-50 ${className}`}
          >
            <UserX className="h-4 w-4 mr-2 text-gray-500" />
            Block User
          </div>
        );
      case 'icon':
      default:
        return (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(true)}
            className={`text-gray-500 hover:text-red-600 ${className}`}
          >
            <UserX className="h-4 w-4" />
            <span className="sr-only">Block {username}</span>
          </Button>
        );
    }
  };

  return (
    <>
      {renderButton()}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block {username}</DialogTitle>
          </DialogHeader>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 flex items-start">
              <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-600">
              <p>When you block someone:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>They won't be able to see your profile or content</li>
                <li>You won't see their posts, comments, or events</li>
                <li>They won't be notified that you've blocked them</li>
                <li>You can unblock them later if you change your mind</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason (optional, for your reference only)</Label>
              <Textarea
                id="block-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you blocking this user?"
                className="resize-none h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Blocking...
                </>
              ) : (
                'Block User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}