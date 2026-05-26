import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

type TermsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
};

export default function TermsModal({ open, onOpenChange, onAccept }: TermsModalProps) {
  const [termsContent, setTermsContent] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasRead, setHasRead] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const fetchTermsContent = async () => {
      setIsLoading(true);
      try {
        // Fetch the latest terms of service
        const response = await apiRequest({
          url: "/api/legal/terms-of-service?language=en",
          method: "GET"
        });
        
        const data = await response.json();
        setTermsContent(data);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch terms of service:", error);
        // Fall back to placeholder content if API is not available yet
        setTermsContent({
          id: 1,
          type: "terms_of_service",
          language: "en",
          title: "Terms of Service",
          content: `<h2>Terms of Service</h2>
            <p>By accessing and using the Urban Culture platform, you agree to be bound by these Terms of Service.</p>
            
            <h3>Zero-Tolerance Content Policy</h3>
            <p>Urban Culture maintains a <strong>zero-tolerance policy</strong> regarding objectionable content. This includes, but is not limited to:</p>
            <ul>
              <li>Content that promotes hate speech, discrimination, or violence against any individual or group</li>
              <li>Sexually explicit or pornographic material</li>
              <li>Content that depicts, encourages, or promotes illegal activities</li>
              <li>Harassing, bullying, or intimidating content targeting other users</li>
              <li>Content that violates intellectual property rights or privacy of others</li>
              <li>Misinformation or content that may cause public harm</li>
            </ul>
            <p>Any user found to be in violation of this policy will be subject to immediate account suspension or termination without prior warning.</p>
            
            <p>For the complete Terms of Service, please visit the full terms page.</p>`,
          version: "1.0",
          effectiveDate: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          isActive: true,
        });
        setIsLoading(false);
      }
    };

    if (open) {
      fetchTermsContent();
    }
  }, [open]);

  // Track when user scrolls to the bottom of terms
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Consider "read" when user has scrolled at least 80% of the content
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      setHasRead(true);
    }
  };

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Please read the following terms carefully before creating your account
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col space-y-3 p-4">
            <div className="h-6 w-3/4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse"></div>
          </div>
        ) : (
          <ScrollArea className="h-[50vh] rounded-md p-4 bg-card" onScroll={handleScroll}>
            <div className="prose dark:prose-invert max-w-none">
              {typeof termsContent.content === 'string' ? (
                <div dangerouslySetInnerHTML={{ __html: termsContent.content }} />
              ) : (
                <div>
                  <h2>Terms of Service</h2>
                  <p>By accessing and using the Urban Culture platform, you agree to be bound by these Terms of Service.</p>
                  
                  <h3>Zero-Tolerance Content Policy</h3>
                  <p>Urban Culture maintains a <strong>zero-tolerance policy</strong> regarding objectionable content. This includes, but is not limited to:</p>
                  <ul>
                    <li>Content that promotes hate speech, discrimination, or violence against any individual or group</li>
                    <li>Sexually explicit or pornographic material</li>
                    <li>Content that depicts, encourages, or promotes illegal activities</li>
                    <li>Harassing, bullying, or intimidating content targeting other users</li>
                    <li>Content that violates intellectual property rights or privacy of others</li>
                    <li>Misinformation or content that may cause public harm</li>
                  </ul>
                  <p>Any user found to be in violation of this policy will be subject to immediate account suspension or termination without prior warning.</p>
                  
                  <p>For the complete Terms of Service, please visit the full terms page.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        
        <DialogFooter className="flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="terms-checkbox" 
              checked={hasChecked}
              onCheckedChange={(checked) => setHasChecked(!!checked)}
              disabled={!hasRead}
            />
            <Label 
              htmlFor="terms-checkbox" 
              className={`text-sm font-medium ${!hasRead ? 'text-muted-foreground' : ''}`}
            >
              {hasRead 
                ? "I have read and agree to the Terms of Service"
                : "Please scroll through the terms to enable this checkbox"}
            </Label>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAccept}
              disabled={!hasChecked || !hasRead}
            >
              Accept & Continue
            </Button>
          </div>
        </DialogFooter>
        
        <div className="mt-2 text-xs text-center text-muted-foreground">
          <Link to="/terms-of-service" className="hover:underline" target="_blank">
            Open Terms in Full Page
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}