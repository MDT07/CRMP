import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "../ui/utils";
import { SurfaceCard } from "./surface-card";

interface MetricCardProps extends Omit<React.ComponentProps<typeof SurfaceCard>, 'tone'> {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone?: "primary" | "info" | "warning" | "success";
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  primary: "text-primary bg-primary/12 border-primary/20",
  info: "text-info bg-info-soft border-info/20",
  warning: "text-warning bg-warning-soft border-warning/20",
  success: "text-success bg-success-soft border-success/20",
};

const deltaToneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  primary: "text-primary",
  info: "text-info",
  warning: "text-warning",
  success: "text-success",
};

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "primary",
  className,
  ...props
}: MetricCardProps) {
  return (
    <SurfaceCard
      tone="subtle"
      className={cn("gap-0 p-3.5", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground/80 uppercase">
            {label}
          </p>
          <div className="space-y-0.5">
            <p className="font-metric text-2xl font-semibold text-foreground">
              {value}
            </p>
            <p
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                deltaToneClasses[tone],
              )}
            >
              <ArrowUpRight className="size-3" />
              {delta}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-[calc(var(--radius)-4px)] border",
            toneClasses[tone],
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </SurfaceCard>
  );
}
