import React from 'react';
import { cn } from '@/lib/utils';

interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: 'xl' | 'lg' | 'md' | 'sm' | 'xs';
  className?: string;
  children: React.ReactNode;
}

/**
 * Reusable heading component with standardized styling
 */
const Heading: React.FC<HeadingProps> = ({
  as: Tag = 'h2',
  size,
  className,
  children,
  ...props
}) => {
  // Determine size class based on the heading level and specified size
  const sizeClass = size || {
    h1: 'xl',
    h2: 'lg',
    h3: 'md',
    h4: 'sm',
    h5: 'xs',
    h6: 'xs',
  }[Tag] || 'md';

  // Map size to specific styles
  const sizeStyles = {
    xl: 'text-4xl font-bold tracking-tight sm:text-5xl',
    lg: 'text-3xl font-bold tracking-tight',
    md: 'text-2xl font-bold',
    sm: 'text-xl font-semibold',
    xs: 'text-lg font-medium',
  }[sizeClass];

  return (
    <Tag
      className={cn(sizeStyles, className)}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Heading;