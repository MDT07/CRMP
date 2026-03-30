import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

const statusBadgeVariants = cva("border font-medium", {
  variants: {
    tone: {
      neutral: "border-border/80 bg-muted text-foreground/80",
      primary: "border-primary/20 bg-primary/12 text-primary",
      success: "border-success/24 bg-success-soft text-success",
      info: "border-info/24 bg-info-soft text-info",
      warning: "border-warning/24 bg-warning-soft text-warning",
      danger: "border-danger/24 bg-danger-soft text-danger",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

type StatusBadgeProps = React.ComponentProps<typeof Badge> &
  VariantProps<typeof statusBadgeVariants>;

export function StatusBadge({
  className,
  tone,
  variant,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant={variant ?? "outline"}
      className={cn(statusBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}
