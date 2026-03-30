import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Card } from "../ui/card";
import { cn } from "../ui/utils";

const surfaceCardVariants = cva(
  "relative isolate overflow-hidden border-border/80 bg-card text-card-foreground",
  {
    variants: {
      tone: {
        default: "",
        subtle: "bg-card",
        accent: "border-primary/18 bg-surface-strong/70",
      },
      interactive: {
        true: "transition-[transform,border-color,box-shadow,background-color] duration-200 hover:border-primary/20 hover:bg-surface-muted hover:shadow-[var(--shadow-panel)]",
        false: "",
      },
    },
    defaultVariants: {
      tone: "default",
      interactive: false,
    },
  },
);

type SurfaceCardProps = React.ComponentProps<typeof Card> &
  VariantProps<typeof surfaceCardVariants>;

export function SurfaceCard({
  className,
  tone,
  interactive,
  ...props
}: SurfaceCardProps) {
  return (
    <Card
      className={cn(surfaceCardVariants({ tone, interactive }), className)}
      {...props}
    />
  );
}
