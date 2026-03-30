import { useId } from "react";

import { cn } from "./ui/utils";

interface BrandMarkProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md";
}

const markSizeClasses = {
  sm: "size-10 rounded-[1.1rem]",
  md: "size-12 rounded-[1.35rem]",
} as const;

export function BrandMark({
  className,
  size = "md",
  ...props
}: BrandMarkProps) {
  const baseId = useId().replace(/:/g, "");
  const shellGradientId = `${baseId}-shell`;
  const coreGradientId = `${baseId}-core`;
  const lineGradientId = `${baseId}-line`;
  const glowId = `${baseId}-glow`;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border border-primary/18 bg-canvas shadow-[var(--shadow-glow)]",
        markSizeClasses[size],
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={shellGradientId} x1="8" y1="6" x2="58" y2="58">
            <stop offset="0%" stopColor="#6eddff" />
            <stop offset="38%" stopColor="#00a6fb" />
            <stop offset="100%" stopColor="#0582ca" />
          </linearGradient>
          <linearGradient id={coreGradientId} x1="14" y1="12" x2="50" y2="54">
            <stop offset="0%" stopColor="#0c4266" />
            <stop offset="100%" stopColor="#051923" />
          </linearGradient>
          <linearGradient id={lineGradientId} x1="18" y1="42" x2="48" y2="20">
            <stop offset="0%" stopColor="#95e4ff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
          <radialGradient id={glowId} cx="0" cy="0" r="1" gradientTransform="translate(32 24) rotate(90) scale(28)">
            <stop offset="0%" stopColor="#00a6fb" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#00a6fb" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect
          x="1"
          y="1"
          width="62"
          height="62"
          rx="22"
          fill={`url(#${shellGradientId})`}
          fillOpacity="0.28"
          stroke="rgba(255,255,255,0.14)"
        />
        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="18"
          fill={`url(#${coreGradientId})`}
          stroke="rgba(149,228,255,0.14)"
        />
        <circle cx="32" cy="24" r="22" fill={`url(#${glowId})`} />

        <path
          d="M16 42 L26 32 L36 36 L48 20"
          stroke={`url(#${lineGradientId})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 48 H47"
          stroke="rgba(149,228,255,0.16)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {[
          { cx: 16, cy: 42 },
          { cx: 26, cy: 32 },
          { cx: 36, cy: 36 },
          { cx: 48, cy: 20 },
        ].map((node) => (
          <g key={`${node.cx}-${node.cy}`}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r="5"
              fill="rgba(5,25,35,0.84)"
              stroke="rgba(149,228,255,0.28)"
            />
            <circle cx={node.cx} cy={node.cy} r="2.2" fill="#f5fbff" />
          </g>
        ))}
      </svg>
    </div>
  );
}

interface BrandLockupProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md";
  showSubtitle?: boolean;
  subtitle?: string;
}

export function BrandLockup({
  className,
  size = "md",
  showSubtitle = true,
  subtitle = "Next-generation CRM",
  ...props
}: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <BrandMark size={size} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold tracking-[0.06em] text-foreground",
            size === "sm" ? "text-sm" : "text-[0.95rem]",
          )}
        >
          CRMP <span className="text-primary">by EmirCo</span>
        </p>
        {showSubtitle ? (
          <p
            className={cn(
              "truncate text-muted-foreground",
              size === "sm" ? "text-[0.7rem]" : "text-xs",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
