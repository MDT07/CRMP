import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-muted-foreground",
        primary: "bg-primary/10 text-primary",
        success: "bg-success/10 text-success",
        info: "bg-info/10 text-info",
        warning: "bg-warning/10 text-warning",
        danger: "bg-destructive/10 text-destructive",
        accent: "bg-accent/10 text-accent",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.65rem] rounded-md",
        md: "px-2.5 py-1 text-xs rounded-lg",
        lg: "px-3 py-1.5 text-sm rounded-lg",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  }
);

type StatusBadgeProps = React.ComponentProps<typeof Badge> &
  VariantProps<typeof statusBadgeVariants> & {
    dot?: boolean;
    pulse?: boolean;
  };

export function StatusBadge({
  className,
  tone,
  size,
  dot,
  pulse,
  variant,
  children,
  ...props
}: StatusBadgeProps) {
  const dotColors: Record<string, string> = {
    neutral: "bg-muted-foreground",
    primary: "bg-primary",
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
    danger: "bg-destructive",
    accent: "bg-accent",
  };

  return (
    <Badge
      variant={variant ?? "outline"}
      className={cn(statusBadgeVariants({ tone, size }), className)}
      {...props}
    >
      {dot && tone && (
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            dotColors[tone] || "bg-muted-foreground",
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </Badge>
  );
}
