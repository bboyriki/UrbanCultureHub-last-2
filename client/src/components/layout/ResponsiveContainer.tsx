import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  noPadding?: boolean;
}

/**
 * A responsive container component that provides consistent padding
 * and width constraints across different screen sizes
 */
export function ResponsiveContainer({
  children,
  className,
  fullWidth = false,
  noPadding = false,
}: ResponsiveContainerProps) {
  const { isDarkMode } = useTheme();

  return (
    <div 
      className={cn(
        "w-full transition-all duration-300",
        !noPadding && "px-4 sm:px-6 md:px-8",
        !fullWidth && "mx-auto max-w-7xl",
        isDarkMode ? "text-gray-100" : "text-gray-900",
        className
      )}
    >
      {children}
    </div>
  );
}