import { useState, useEffect } from "react";
import { useWebSocket, WebSocketMessage, MessageType } from "@/contexts/WebSocketSingletonContext";
import SystemTermsModal from "@/components/modals/SystemTermsModal";
import { useAuth } from "@/contexts/AuthContext";

/**
 * This component handles WebSocket messages for Terms of Service prompts
 * and displays a modal when an admin sends a terms prompt
 */
export default function TermsPromptHandler() {
  const { user } = useAuth();
  const [termsModalOpen, setTermsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("Terms of Service");
  const [message, setMessage] = useState<string>("Please review our updated Terms of Service");
  const [requireAction, setRequireAction] = useState<boolean>(true);
  const [termsVersion, setTermsVersion] = useState<string>("current");
  
  // Listen for WebSocket messages related to terms prompts
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    // If the user is not logged in, don't bother subscribing
    if (!user) return;
    
    // Subscribe to WebSocket messages and handle terms prompts
    const unsubscribe = subscribe((data: WebSocketMessage) => {
      if (data.type === MessageType.TERMS_PROMPT || data.type === 'TERMS_PROMPT') {
        const payload = data.payload || {};
        
        // Set the modal properties from the payload
        setTitle(payload.title || "Terms of Service");
        setMessage(payload.message || "Please review our updated Terms of Service");
        setRequireAction(payload.requireAction !== undefined ? payload.requireAction : true);
        setTermsVersion(payload.termsVersion || "current");
        
        // Open the modal
        setTermsModalOpen(true);
      }
    });
    
    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, [user, subscribe]);
  
  if (!user) {
    return null; // Don't render anything if the user is not logged in
  }
  
  return (
    <SystemTermsModal
      open={termsModalOpen}
      onOpenChange={setTermsModalOpen}
      title={title}
      message={message}
      requireAction={requireAction}
      termsVersion={termsVersion}
    />
  );
}