import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input border-input flex h-8 w-full min-w-0 rounded-[calc(var(--radius)-4px)] border border-border px-3 py-1 text-[0.82rem] bg-input-background shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:",
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive dark:aria-invalid:ring-destructive aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
