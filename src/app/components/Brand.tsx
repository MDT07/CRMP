import { useId } from "react";

import { cn } from "./ui/utils";

interface BrandMarkProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg";
}

const markSizeClasses = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
} as const;

export function BrandMark({
  className,
  size = "md",
  ...props
}: BrandMarkProps) {
  const baseId = useId().replace(/:/g, "");
  const gradientId = `${baseId}-gradient`;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-primary shadow-lg",
        markSizeClasses[size],
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 40 40"
        className="h-5/6 w-5/6"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        
        {/* Minimal "C" shape - CRM */}
        <path
          d="M28 12C28 12 24 8 18 8C12 8 8 13 8 20C8 27 12 32 18 32C24 32 28 28 28 28"
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Connection dot */}
        <circle
          cx="30"
          cy="12"
          r="3"
          fill="#ffffff"
          fillOpacity="0.9"
        />
      </svg>
    </div>
  );
}

interface BrandLockupProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  subtitle?: string;
}

export function BrandLockup({
  className,
  size = "md",
  showSubtitle = true,
  subtitle = "Customer Relationship Management",
  ...props
}: BrandLockupProps) {
  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const subTextSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <BrandMark size={size} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-bold tracking-tight text-foreground",
            textSizes[size],
          )}
        >
          CRMP
        </p>
        {showSubtitle ? (
          <p
            className={cn(
              "truncate text-muted-foreground font-medium",
              subTextSizes[size],
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Simple text-only version for compact spaces
interface BrandTextProps extends React.ComponentProps<"span"> {
  variant?: "default" | "muted";
}

export function BrandText({
  className,
  variant = "default",
  ...props
}: BrandTextProps) {
  return (
    <span
      className={cn(
        "font-bold tracking-tight",
        variant === "default" ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      CRMP
    </span>
  );
}
