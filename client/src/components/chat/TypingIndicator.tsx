import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingIndicatorProps {
  user: any;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ user }) => {
  // Variants for dot animations - more responsive, smoother animations
  const dotVariants = {
    initial: { y: 0, opacity: 0.4 },
    animate: (i: number) => ({
      y: [0, -5, 0],
      opacity: [0.4, 0.9, 0.4],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut",
        delay: i * 0.1, // Staggered animation
      }
    })
  };

  // Container animations
  const containerVariants = {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.3, 
        ease: "easeOut",
        when: "beforeChildren",
        staggerChildren: 0.05 
      }
    },
    exit: { 
      opacity: 0, 
      y: 10, 
      scale: 0.9, 
      transition: { 
        duration: 0.2,
        ease: "easeIn" 
      }
    }
  };

  // Bubble animation with subtle pulse effect
  const bubbleVariants = {
    initial: { scale: 0.9, x: -10 },
    animate: { 
      scale: 1, 
      x: 0,
      boxShadow: [
        "0px 0px 0px rgba(124, 58, 237, 0)", 
        "0px 0px 8px rgba(124, 58, 237, 0.2)", 
        "0px 0px 0px rgba(124, 58, 237, 0)"
      ],
      transition: { 
        scale: { duration: 0.2, ease: "easeOut" },
        x: { duration: 0.2, ease: "easeOut" },
        boxShadow: { 
          duration: 1.8, 
          repeat: Infinity, 
          repeatType: "loop",
          ease: "easeInOut"
        }
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="flex items-end gap-0.5 sm:gap-1 mb-0.5 ml-1 sm:ml-2"
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        layout
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <Avatar className="h-4 w-4 sm:h-5 sm:w-5">
            {user?.profilePicture ? (
              <AvatarImage src={user.profilePicture} alt={user.displayName} />
            ) : (
              <AvatarFallback className="text-[8px] sm:text-xs">
                {user?.displayName?.[0] || <User className="h-2 w-2 sm:h-3 sm:w-3" />}
              </AvatarFallback>
            )}
          </Avatar>
        </motion.div>
        
        <motion.div 
          className="bg-muted/90 px-2 py-1 rounded-md rounded-bl-none max-w-[85%] flex items-center shadow-sm"
          variants={bubbleVariants}
          initial="initial"
          animate="animate"
          layout
        >
          <div className="flex items-center gap-[1px] sm:gap-[2px]">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-current opacity-40"
                custom={i}
                variants={dotVariants}
                initial="initial"
                animate="animate"
              />
            ))}
          </div>
          <motion.span 
            className="ml-1.5 text-[10px] sm:text-xs text-muted-foreground hidden xs:inline-block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.3, duration: 0.2 }}
          >
            {user?.displayName || `User ${user?.id || user?.userId}`}
          </motion.span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TypingIndicator;

// Add this CSS to your global CSS file:
// 
// .typing-indicator {
//   display: flex;
//   align-items: center;
// }
// 
// .typing-indicator span {
//   height: 8px;
//   width: 8px;
//   margin: 0 1px;
//   background-color: currentColor;
//   border-radius: 50%;
//   display: block;
//   opacity: 0.4;
// }
// 
// .typing-indicator span:nth-child(1) {
//   animation: typing 1.4s infinite 0.2s;
// }
// 
// .typing-indicator span:nth-child(2) {
//   animation: typing 1.4s infinite 0.4s;
// }
// 
// .typing-indicator span:nth-child(3) {
//   animation: typing 1.4s infinite 0.6s;
// }
// 
// @keyframes typing {
//   0% {
//     transform: translateY(0px);
//     opacity: 0.4;
//   }
//   50% {
//     transform: translateY(-5px);
//     opacity: 0.8;
//   }
//   100% {
//     transform: translateY(0px);
//     opacity: 0.4;
//   }
// }