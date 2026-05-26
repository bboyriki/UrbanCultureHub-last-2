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
import { Link } from "wouter";

type SignupTermsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
};

export default function SignupTermsModal({ open, onOpenChange, onAccept }: SignupTermsModalProps) {
  const [hasRead, setHasRead] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Reset state when modal is opened
  useEffect(() => {
    if (open) {
      setHasRead(false);
      setHasChecked(false);
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
        
        <ScrollArea className="h-[50vh] rounded-md p-4 bg-card" onScroll={handleScroll}>
          <div className="prose dark:prose-invert max-w-none">
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
              
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing and using the Urban Culture platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
              
              <h3>2. Description of Service</h3>
              <p>Urban Culture provides a platform for users to discover urban culture events, locations, and services. We offer marketplace functionality for products and services related to urban culture.</p>
              
              <h3>3. User Accounts</h3>
              <p>To access certain features of the platform, you must register for an account. You agree to provide accurate information and to keep your account secure.</p>
              
              <h3>4. User Content</h3>
              <p>Users may contribute content to the platform. You retain ownership of your content, but grant us a license to use it in connection with our services.</p>
              
              <h3>5. Prohibited Activities</h3>
              <p>You agree not to engage in any activity that may disrupt, damage, or impair the platform, including unauthorized access, data collection, or distribution of harmful content.</p>
              
              <h3>6. Marketplace Rules</h3>
              <p>For users selling products or services through our marketplace, additional terms apply regarding payments, refunds, and seller responsibilities.</p>
              
              <p>For the complete Terms of Service, please visit the full terms page.</p>
            </div>
          </div>
        </ScrollArea>
        
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