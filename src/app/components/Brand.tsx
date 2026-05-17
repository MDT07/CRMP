import { useId } from "react";
import { cn } from "./ui/utils";

interface BrandMarkProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "gradient" | "minimal";
}

const markSizeClasses = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
} as const;

export function BrandMark({
  className,
  size = "md",
  variant = "gradient",
  ...props
}: BrandMarkProps) {
  const baseId = useId().replace(/:/g, "");
  const gradientId = `${baseId}-gradient`;
  const glowId = `${baseId}-glow`;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-2xl",
        variant === "gradient" && "bg-gradient-primary shadow-lg shadow-glow-primary",
        variant === "default" && "bg-primary shadow-lg",
        variant === "minimal" && "bg-transparent",
        markSizeClasses[size],
        className
      )}
      {...props}
    >
      <svg
        viewBox="0 0 40 40"
        className={cn("h-[60%] w-[60%]", variant === "minimal" && "h-[80%] w-[80%]")}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Modern "P" shape for Pipeline/Platform */}
        <path
          d="M12 32V8h10c5.5 0 9 3.5 9 8.5s-3.5 8.5-9 8.5h-6v7"
          stroke={variant === "minimal" ? `url(#${gradientId})` : `url(#${gradientId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={variant === "gradient" ? `url(#${glowId})` : undefined}
        />

        {/* Dot accent */}
        <circle
          cx="28"
          cy="8"
          r="3"
          fill={variant === "minimal" ? `url(#${gradientId})` : "#ffffff"}
          fillOpacity="0.95"
        />
      </svg>
    </div>
  );
}

interface BrandLockupProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
  subtitle?: string;
  variant?: "default" | "light" | "gradient";
}

export function BrandLockup({
  className,
  size = "md",
  showSubtitle = true,
  subtitle = "Pipeline Intelligence",
  variant = "default",
  ...props
}: BrandLockupProps) {
  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const subTextSizes = {
    sm: "text-[0.65rem]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <BrandMark size={size} variant={variant === "gradient" ? "gradient" : "default"} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-bold tracking-tight",
            variant === "light" ? "text-white" : "text-foreground",
            textSizes[size]
          )}
          style={{ letterSpacing: "-0.03em" }}
        >
          CRMP
        </p>
        {showSubtitle ? (
          <p
            className={cn(
              "truncate font-medium",
              variant === "light" ? "text-white/70" : "text-muted-foreground",
              subTextSizes[size]
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
  variant?: "default" | "muted" | "gradient";
}

export function BrandText({ className, variant = "default", ...props }: BrandTextProps) {
  return (
    <span
      className={cn(
        "font-bold tracking-tight",
        variant === "default" && "text-foreground",
        variant === "muted" && "text-muted-foreground",
        variant === "gradient" && "bg-gradient-primary bg-clip-text text-transparent",
        className
      )}
      style={{ letterSpacing: "-0.03em" }}
      {...props}
    >
      CRMP
    </span>
  );
}

// Apple-style animated logo for loading/splash
interface BrandAnimatedProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg";
}

export function BrandAnimated({ className, size = "md", ...props }: BrandAnimatedProps) {
  const sizeClasses = {
    sm: "size-12",
    md: "size-20",
    lg: "size-32",
  };

  return (
    <div
      className={cn("relative flex items-center justify-center", sizeClasses[size], className)}
      {...props}
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-primary opacity-20 blur-xl animate-pulse" />
      <BrandMark size={size === "sm" ? "sm" : size === "md" ? "md" : "lg"} variant="gradient" />
    </div>
  );
}
