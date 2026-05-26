import { cn } from "@/lib/utils";
import React from "react";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PageHeader({
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col items-start gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface PageHeaderHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

export function PageHeaderHeading({
  className,
  children,
  ...props
}: PageHeaderHeadingProps) {
  return (
    <h1
      className={cn(
        "text-3xl font-bold tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

interface PageHeaderDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

export function PageHeaderDescription({
  className,
  children,
  ...props
}: PageHeaderDescriptionProps) {
  return (
    <p
      className={cn("text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}