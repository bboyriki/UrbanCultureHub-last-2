import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ReportButtonProps {
  contentId: number;
  contentType: 'post' | 'comment' | 'event' | 'location' | 'user' | 'product' | 'reel';
  variant?: 'icon' | 'text' | 'menu';
  className?: string;
}

const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'violence', label: 'Violence or threatening content' },
  { id: 'hate', label: 'Hate speech or symbols' },
  { id: 'unauthorized', label: 'Unauthorized or stolen content' },
  { id: 'other', label: 'Other reason' }
];

export function ReportButton({ contentId, contentType, variant = 'icon', className = '' }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, getToken } = useAuth();

  const handleSubmit = async () => {
    // Validate form
    if (!selectedReason) {
      setError('Please select a reason for reporting this content');
      return;
    }

    // If user not logged in, show login message
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to report content",
        variant: "destructive",
      });
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the current authentication token
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        console.error("Failed to get authentication token:", tokenError);
      }

      const reason = `${REPORT_REASONS.find(r => r.id === selectedReason)?.label || selectedReason}${
        additionalDetails ? ': ' + additionalDetails : ''
      }`;

      // Use fetch with Bearer token for authentication
      const response = await fetch('/api/content/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          contentType,
          contentId,
          reason,
          reporterId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to report content');
      }

      toast({
        title: 'Content reported',
        description: 'Thank you for reporting this content. Our moderation team will review it within 24 hours.',
      });
      
      // Reset form and close dialog
      setSelectedReason('');
      setAdditionalDetails('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error reporting content:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      
      toast({
        title: 'Failed to report content',
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
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        );
      case 'menu':
        return (
          <div 
            onClick={() => setIsOpen(true)}
            className={`flex items-center px-2 py-1.5 text-sm cursor-pointer hover:bg-red-50 ${className}`}
          >
            <Flag className="h-4 w-4 mr-2 text-gray-500" />
            Report
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
            <Flag className="h-4 w-4" />
            <span className="sr-only">Report {contentType}</span>
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
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription className="mt-1 text-muted-foreground">
              Our moderation team will review reports within 24 hours.
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-600 flex items-start">
              <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Why are you reporting this {contentType}?</Label>
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                {REPORT_REASONS.map((reason) => (
                  <div key={reason.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason.id} id={reason.id} />
                    <Label htmlFor={reason.id}>{reason.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Additional details (optional)</Label>
              <Textarea
                id="details"
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder="Provide any additional context that might help our moderators review this content"
                className="resize-none h-[100px]"
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
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}