import * as React from "react";

import { cn } from "../ui/utils";

interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: string;
  description: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        {meta ? (
          <div className="flex flex-wrap items-center gap-1.5 text-kicker text-muted-foreground/80">
            {meta}
          </div>
        ) : null}
        <div className="space-y-1">
          <h1 className="max-w-3xl text-balance text-foreground">{title}</h1>
          <p className="max-w-2xl text-[0.84rem] leading-5 text-muted-foreground/90">
            {description}
          </p>
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
