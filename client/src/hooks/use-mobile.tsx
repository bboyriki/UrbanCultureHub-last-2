import { useState, useEffect } from 'react';

/**
 * Custom hook to detect mobile screens based on viewport width
 * Returns a boolean indicating if the current screen is a mobile screen
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < breakpoint);
    };

    // Check on initial mount
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to detect different screen sizes
 * Returns an object with boolean flags for different screen sizes
 */
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    isMobile: false,    // < 640px
    isTablet: false,    // >= 640px & < 1024px
    isDesktop: false,   // >= 1024px
    isLargeScreen: false // >= 1280px
  });

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      setScreenSize({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        isLargeScreen: width >= 1280
      });
    };

    // Initialize on mount
    updateScreenSize();

    // Add event listener for resize
    window.addEventListener('resize', updateScreenSize);

    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return screenSize;
}