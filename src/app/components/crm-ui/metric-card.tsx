import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import * as React from "react";
import { cn } from "../ui/utils";
import { SurfaceCard } from "./surface-card";

interface MetricCardProps extends React.ComponentProps<"div"> {
  title?: string;
  label?: string;
  value: string | number;
  subtitle?: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  color?: "primary" | "success" | "warning" | "info" | "accent" | "neutral";
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "success" | "warning" | "info" | "accent" | "neutral";
}

const colorStyles = {
  primary: {
    bg: "bg-primary-soft",
    text: "text-primary",
    glow: "shadow-glow-primary",
  },
  success: {
    bg: "bg-success-soft",
    text: "text-success",
    glow: "shadow-glow-success",
  },
  warning: {
    bg: "bg-warning-soft",
    text: "text-warning",
    glow: "shadow-glow-warning",
  },
  info: {
    bg: "bg-info-soft",
    text: "text-info",
    glow: "shadow-glow-primary",
  },
  accent: {
    bg: "bg-accent-soft",
    text: "text-accent",
    glow: "shadow-glow-primary",
  },
  neutral: {
    bg: "bg-surface-muted",
    text: "text-muted-foreground",
    glow: "",
  },
};

// Helper to render icon - handles both ReactNode and component references
function renderIcon(
  icon: React.ComponentType<{ className?: string }> | React.ReactNode | null,
  className: string
): React.ReactNode {
  if (!icon) return null;

  // If it's already a React element (JSX like <Icon />), return as-is
  if (React.isValidElement(icon)) {
    return <span className={className}>{icon}</span>;
  }

  // If it's a function/component (like LucideIcon), render it as JSX
  if (typeof icon === "function") {
    const IconComponent = icon as unknown as React.ComponentType<{ className?: string }>;
    return <IconComponent className={className} />;
  }

  // Handle objects with $$typeof (e.g. React.forwardRef components in some environments)
  if (typeof icon === "object" && "$$typeof" in (icon as object)) {
    const IconComponent = icon as unknown as React.ComponentType<{ className?: string }>;
    return <IconComponent className={className} />;
  }

  // Fallback
  return <span className={className}>{icon}</span>;
}

export function MetricCard({
  title,
  label,
  value,
  subtitle,
  delta,
  trend,
  trendValue,
  icon,
  color = "primary",
  size = "md",
  tone,
  className,
  ...props
}: MetricCardProps) {
  const effectiveColor = tone || color;
  const styles = colorStyles[effectiveColor];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-success"
      : trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  const displayTitle = title || label || "Metric";
  const displayTrend = trendValue || delta;

  return (
    <SurfaceCard
      tone="default"
      padding="sm"
      radius="lg"
      className={cn("group hover:-translate-y-0.5 transition-transform duration-200", className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <div className={cn("flex size-9 items-center justify-center rounded-lg shrink-0", styles.bg)}>
          {icon ? (
            renderIcon(icon, cn("size-4", styles.text))
          ) : (
            <TrendingUp className={cn("size-4", styles.text)} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground truncate">{displayTitle}</p>
            {(trend || delta) && (
              <div className={cn("flex items-center gap-0.5 text-xs font-medium shrink-0", trendColor)}>
                <TrendIcon className="size-3" />
                {displayTrend}
              </div>
            )}
          </div>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground/60 truncate">{subtitle}</p>}
        </div>
      </div>
    </SurfaceCard>
  );
}
