import { useScreenSize } from "@/hooks/use-mobile";

// This component is now empty as the floating theme button and related functionality
// has been moved to the mobile menu in AppHeader.tsx
const BottomNavigation = () => {
  const { isMobile, isTablet } = useScreenSize();
  
  // Return empty fragment - component kept for backward compatibility
  return <></>;
};

export default BottomNavigation;