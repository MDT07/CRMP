import type * as React from "react";
import { cn } from "../ui/utils";

interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  compact?: boolean;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  icon,
  badge,
  compact = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !compact && "lg:flex-row lg:items-center lg:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        {(meta || badge) && (
          <div className="flex flex-wrap items-center gap-2">
            {meta}
            {badge}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm">
                {icon}
              </div>
            )}
            <h1
              className={cn(
                "max-w-3xl text-balance font-bold text-foreground",
                compact ? "text-lg" : "text-xl lg:text-2xl"
              )}
            >
              {title}
            </h1>
          </div>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground/70">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </div>
  );
}
