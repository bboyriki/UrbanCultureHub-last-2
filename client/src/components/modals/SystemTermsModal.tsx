import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import TermsOfServiceDisplay from "@/components/legal/TermsOfServiceDisplay";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SystemTermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  requireAction: boolean;
  termsVersion?: string;
}

/**
 * A modal that displays Terms of Service prompted by the system/admin
 * Can be configured to require user action (accept/decline) or just acknowledgment
 */
export default function SystemTermsModal({
  open,
  onOpenChange,
  title,
  message,
  requireAction = true,
  termsVersion = "current",
}: SystemTermsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState<string | null>(null);

  // Fetch terms of service content when the modal opens
  useEffect(() => {
    if (open && termsVersion) {
      const fetchTerms = async () => {
        try {
          const response = await apiRequest(`/api/legal/terms?version=${termsVersion}`, {
            method: "GET",
          });
          
          if (response.content) {
            setTermsContent(response.content);
          } else {
            setTermsContent("Unable to load terms of service content.");
            toast({
              title: "Error loading terms",
              description: "Could not load the terms of service content. Please try again later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error fetching terms:", error);
          setTermsContent("Error loading terms of service content.");
          toast({
            title: "Error",
            description: "Failed to load terms of service. Please try again later.",
            variant: "destructive",
          });
        }
      };
      
      fetchTerms();
    }
  }, [open, termsVersion, toast]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setAccepted(false);
      setLoading(false);
    }
  }, [open]);

  const handleAccept = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await apiRequest("/api/legal/accept-terms", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          version: termsVersion,
        }),
      });
      
      toast({
        title: "Terms Accepted",
        description: "You have successfully accepted the terms of service.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Error accepting terms:", error);
      toast({
        title: "Error",
        description: "Failed to record your acceptance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!user) return;
    
    // For now, declining just closes the modal, but you might want to
    // record this action or take other steps in a real implementation
    toast({
      title: "Terms Declined",
      description: "You have declined the terms of service. Some features may be limited.",
      variant: "destructive",
    });
    
    onOpenChange(false);
  };

  const handleAcknowledge = () => {
    toast({
      title: "Acknowledged",
      description: "Thank you for reviewing our terms of service.",
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={requireAction ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base">{message}</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow my-4 max-h-[60vh] rounded border p-4">
          {termsContent ? (
            <TermsOfServiceDisplay content={termsContent} termsVersion={termsVersion} />
          ) : (
            <div className="py-8 text-center text-muted-foreground">Loading terms content...</div>
          )}
        </ScrollArea>
        
        {requireAction && (
          <div className="flex items-start space-x-2 mb-4">
            <Checkbox 
              id="terms-accept" 
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
            />
            <Label
              htmlFor="terms-accept"
              className="text-sm leading-tight"
            >
              I have read and agree to the Terms of Service
            </Label>
          </div>
        )}
        
        <DialogFooter className="flex justify-between sm:justify-between">
          {requireAction ? (
            <>
              <Button
                variant="outline"
                onClick={handleDecline}
                disabled={loading}
              >
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                disabled={loading || !accepted}
              >
                Accept
              </Button>
            </>
          ) : (
            <Button
              className="ml-auto"
              onClick={handleAcknowledge}
              disabled={loading}
            >
              Acknowledge
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}