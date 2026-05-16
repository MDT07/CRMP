import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius)-4px)] text-[0.78rem] font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled: [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive dark:aria-invalid:ring-destructive aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/30 bg-primary text-primary-foreground shadow-[var(--shadow-button)] hover:bg-primary/88",
        success:
          "border border-success/24 bg-success-soft text-success hover:bg-success-soft/80",
        info:
          "border border-info/24 bg-info-soft text-info hover:bg-info-soft/80",
        warning:
          "border border-warning/24 bg-warning-soft text-warning hover:bg-warning-soft/80",
        destructive:
          "border border-destructive/24 bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive dark:focus-visible:ring-destructive dark:bg-destructive/60",
        outline:
          "border border-border bg-card text-foreground hover:border-primary/24 hover:bg-accent hover:text-accent-foreground dark:bg-input dark:border-input dark:hover:bg-input",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5 has-[>svg]:px-2.5",
        sm: "h-7 rounded-[calc(var(--radius)-5px)] px-2.5 has-[>svg]:px-2",
        lg: "h-9 rounded-[calc(var(--radius)-3px)] px-4 has-[>svg]:px-3.5",
        icon: "size-8 rounded-[calc(var(--radius)-5px)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

export { Button, buttonVariants };
