import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Card } from "../ui/card";
import { cn } from "../ui/utils";

const surfaceCardVariants = cva(
  "relative isolate overflow-hidden border text-card-foreground transition-all duration-300",
  {
    variants: {
      tone: {
        default: "border-border/50 bg-card shadow-sm",
        subtle: "border-border/30 bg-surface-subtle shadow-none",
        accent: "border-primary/15 bg-gradient-card shadow-md",
        elevated: "border-border/40 bg-card shadow-lg",
        glass: "glass border-white/10 shadow-lg",
        gradient: "border-primary/20 bg-gradient-card shadow-md",
      },
      interactive: {
        true: "cursor-pointer hover:border-primary/25 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
        false: "",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-5",
        xl: "p-6",
      },
      radius: {
        sm: "rounded-xl",
        md: "rounded-2xl",
        lg: "rounded-3xl",
      },
    },
    defaultVariants: {
      tone: "default",
      interactive: false,
      padding: "md",
      radius: "md",
    },
  }
);

type SurfaceCardProps = React.ComponentProps<typeof Card> &
  VariantProps<typeof surfaceCardVariants> & {
    glow?: "none" | "primary" | "success" | "warning" | "accent";
    header?: React.ReactNode;
    footer?: React.ReactNode;
  };

export function SurfaceCard({
  className,
  tone,
  interactive,
  padding,
  radius,
  glow = "none",
  header,
  footer,
  children,
  ...props
}: SurfaceCardProps) {
  const glowClasses = {
    none: "",
    primary: "hover:shadow-glow-primary",
    success: "hover:shadow-glow-success",
    warning: "hover:shadow-glow-warning",
    accent: "hover:shadow-[0_0_20px_rgba(175,82,222,0.25)]",
  };

  return (
    <Card
      className={cn(
        surfaceCardVariants({ tone, interactive, padding, radius }),
        glow !== "none" && glowClasses[glow],
        className
      )}
      {...props}
    >
      {header && <div className="mb-4 flex items-start justify-between">{header}</div>}
      {children}
      {footer && <div className="mt-4 pt-4 border-t border-border/30">{footer}</div>}
    </Card>
  );
}
