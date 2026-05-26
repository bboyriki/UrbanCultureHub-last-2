import React, { useState, useEffect, useRef, memo, useMemo } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck, User, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

interface MessageStatus {
  userId: number;
  status: string;
  deliveredAt: string | null;
  readAt: string | null;
}

interface MessageBubbleProps {
  message: any;
  isOwnMessage: boolean;
  sender: any;
  userId: number; // Required to be a number for proper message status comparison
}

// Use memo to prevent unnecessary re-renders of messages
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  sender,
  userId
}) => {
  // State to track if this is a new message for animation purposes
  // Only animate new messages, not ones loaded from history
  const isNewMessage = useRef(Date.now() - new Date(message.createdAt).getTime() < 30000);
  const [isNew, setIsNew] = useState(isNewMessage.current);
  const [isVisible, setIsVisible] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  
  // Check if the message is temporary/optimistic (being sent)
  const isOptimistic = typeof message.id === 'string' && message.id.startsWith('temp-');
  const isJustSent = message.status === 'sending' || isOptimistic;
  
  // Memoize formatting function to prevent recalculation on each render
  const formatMessageTime = useMemo(() => {
    return (timestamp: string) => {
      if (!timestamp) return '';
      
      try {
        const messageDate = new Date(timestamp);
        const today = new Date();
        
        // If message is from today, just show the time
        if (messageDate.toDateString() === today.toDateString()) {
          return format(messageDate, 'HH:mm');
        }
        
        // If message is from this year, show day, month and time
        if (messageDate.getFullYear() === today.getFullYear()) {
          return format(messageDate, 'd MMM, HH:mm');
        }
        
        // Otherwise show full date
        return format(messageDate, 'd MMM yyyy, HH:mm');
      } catch (e) {
        // Handle invalid dates gracefully
        return '';
      }
    };
  }, []);
  
  // Cache formatted time to avoid recalculations
  const formattedTime = useMemo(() => {
    return message.createdAt ? formatMessageTime(message.createdAt) : '';
  }, [message.createdAt, formatMessageTime]);

  // Optimized intersection observer using passive option for better performance
  useEffect(() => {
    // Skip animation for older messages to improve performance on initial load
    if (!isNewMessage.current) {
      setIsNew(false);
      setIsVisible(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only animate when message first becomes visible
        if (entry.isIntersecting && isNew) {
          setIsVisible(true);
          // Remove the 'new' state after animation
          setTimeout(() => {
            setIsNew(false);
          }, 300); // Reduced to 300ms for faster transition
        }
      },
      { 
        threshold: 0.1, // Reduced threshold to trigger earlier
        rootMargin: "20px", // Add margin to pre-load
      }
    );
    
    if (messageRef.current) {
      observer.observe(messageRef.current);
    }
    
    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [isNew]);

  // Render message delivery status icon with enhanced visuals and better state logic
  const renderMessageStatus = (message: any) => {
    if (!message || !message.senderId || message.senderId !== userId) return null;
    
    const deliveryStatuses = Array.isArray(message.deliveryStatus) ? message.deliveryStatus : [];
    // Fix - Ensure we get the message status correctly from all possible properties
    const messageStatus = message.status || 
                          (message.isRead ? 'read' : 
                           message.isDelivered ? 'delivered' : 'sent');
    
    // Get timestamp information for tooltips with better fallbacks
    const readTime = message.readAt 
      ? formatMessageTime(message.readAt) 
      : (deliveryStatuses[0]?.readAt ? formatMessageTime(deliveryStatuses[0].readAt) : '');
      
    const deliveredTime = message.deliveredAt 
      ? formatMessageTime(message.deliveredAt) 
      : (deliveryStatuses[0]?.deliveredAt ? formatMessageTime(deliveryStatuses[0].deliveredAt) : '');
    
    const sentTime = message.createdAt ? formatMessageTime(message.createdAt) : '';
    
    // Handle failed messages state
    if (messageStatus === 'failed') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="text-destructive"
                >
                  <span className="text-[10px] font-medium">Failed</span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Message failed to send. Tap to retry.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      );
    }
    
    // Handle sending state - animated clock icon with pulse effect
    if (messageStatus === 'sending' || messageStatus === 'pending' || isOptimistic) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <motion.div 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="flex items-center gap-0.5"
                >
                  <Clock className="h-3 w-3 text-primary/70" />
                  <span className="text-[10px] font-medium hidden md:inline text-primary/70">Sending</span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Sending message...
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      );
    }
    
    // Enhanced read status check - check for any indicators of read status
    const isRead = messageStatus === 'read' || 
                  message.isRead === true || 
                  (deliveryStatuses.length > 0 && deliveryStatuses.some((status: MessageStatus) => 
                    status && status.readAt !== null && status.status === 'read'
                  ));
    
    if (isRead) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: "spring" }}
        >
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5 text-primary">
                  <CheckCheck className="h-3 w-3" />
                  <span className="text-[10px] font-medium hidden md:inline">Read</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Read {readTime ? `at ${readTime}` : ''}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      );
    }
    
    // Enhanced delivered status check - look for any indicators of delivery
    const isDelivered = messageStatus === 'delivered' || 
                      message.isDelivered === true || 
                      (deliveryStatuses.length > 0 && deliveryStatuses.some((status: MessageStatus) => 
                        status && status.deliveredAt !== null && status.status === 'delivered'
                      ));
    
    if (isDelivered) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: "spring" }}
        >
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <Check className="h-3 w-3" />
                  <span className="text-[10px] font-medium hidden md:inline">Delivered</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                Delivered {deliveredTime ? `at ${deliveredTime}` : ''}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      );
    }
    
    // Default sent status - single check mark with lighter color
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5 text-muted-foreground/70">
                <Check className="h-3 w-3" />
                <span className="text-[10px] font-medium hidden md:inline">Sent</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Sent {sentTime ? `at ${sentTime}` : ''}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </motion.div>
    );
  };

  // For system messages (join/leave notifications)
  if (message.contentType === 'system' || message.type === 'system') {
    return (
      <motion.div 
        className="flex justify-center my-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.8, y: 0 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 500 }}
      >
        <div className="bg-muted/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-muted-foreground shadow-sm">
          {message.content || "System notification"}
        </div>
      </motion.div>
    );
  }

  // Animation variants for different message states
  const containerVariants = {
    initial: { 
      opacity: 0, 
      y: 10,
      x: isOwnMessage ? 10 : -10, 
      scale: 0.95,
    },
    animate: { 
      opacity: 1, 
      y: 0, 
      x: 0,
      scale: 1,
      transition: { 
        duration: 0.2, 
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      y: 10,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: "easeIn" 
      }
    }
  };

  // Bubble animation variants
  const bubbleVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.9, 
      x: isOwnMessage ? 8 : -8 
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      x: 0,
      transition: { 
        duration: 0.2, 
        ease: "easeOut"
      }
    },
    sending: { 
      boxShadow: [
        "0 1px 2px rgba(0,0,0,0.1)",
        "0 1px 6px rgba(0,0,0,0.2)",
        "0 1px 2px rgba(0,0,0,0.1)"
      ],
      opacity: [0.9, 1, 0.9],
      transition: { 
        duration: 1.2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} my-0 sm:my-0.5 group`}
        ref={messageRef}
        variants={containerVariants}
        initial="initial"
        animate={isVisible ? "animate" : "initial"}
        exit="exit"
        layout
      >
        <div className="flex items-end gap-0.5 sm:gap-1 max-w-[85%] md:max-w-[80%]">
          {/* Show avatar only for messages from others */}
          {!isOwnMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <Avatar className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5">
                {sender && sender.profilePicture ? (
                  <AvatarImage 
                    src={sender.profilePicture} 
                    alt={sender && sender.displayName ? sender.displayName : message && message.senderId ? `User ${message.senderId}` : 'User'} 
                  />
                ) : (
                  <AvatarFallback className="text-[8px] sm:text-xs">
                    {sender && sender.displayName && typeof sender.displayName === 'string' && sender.displayName.length > 0
                      ? sender.displayName[0]
                      : message && message.senderId 
                        ? `${message.senderId}`.charAt(0)
                        : <User className="h-2 w-2 sm:h-3 sm:w-3" />
                    }
                  </AvatarFallback>
                )}
              </Avatar>
            </motion.div>
          )}
          
          <motion.div 
            className={`
              relative px-2 py-1 rounded-md
              ${isOwnMessage 
                ? 'bg-primary text-primary-foreground rounded-br-none' 
                : 'bg-muted/90 backdrop-blur-[1px] rounded-bl-none'}
              ${isJustSent ? 'shadow' : 'shadow-sm'}
            `}
            variants={bubbleVariants}
            initial="initial"
            animate={isJustSent ? "sending" : "animate"}
            layout
          >
            {/* Message content with compact typography */}
            <div className="whitespace-pre-wrap break-words text-xs leading-tight">
              {message.content || ''}
            </div>
            
            {/* Message time and status with improved visibility on hover */}
            <motion.div 
              className="text-[10px] mt-0.5 flex justify-end gap-1 items-center"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0.65 }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className={`transition-opacity duration-200 text-[8px] ${isOwnMessage ? 'text-primary-foreground/80' : 'text-muted-foreground/80'}`}>
                {message.createdAt ? formatMessageTime(message.createdAt) : ''}
              </span>
              {renderMessageStatus(message)}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Adding a displayName helps with debugging in React DevTools
MessageBubble.displayName = 'MessageBubble';

export default React.memo(MessageBubble, (prevProps, nextProps) => {
  // Custom equality check to prevent unnecessary re-renders
  // Only re-render when essential props change
  return (
    prevProps.message?.id === nextProps.message?.id &&
    prevProps.message?.status === nextProps.message?.status &&
    prevProps.message?.content === nextProps.message?.content &&
    prevProps.message?.isRead === nextProps.message?.isRead &&
    prevProps.message?.isDelivered === nextProps.message?.isDelivered &&
    prevProps.isOwnMessage === nextProps.isOwnMessage
  );
});