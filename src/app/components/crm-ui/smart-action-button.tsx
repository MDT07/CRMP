import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";

import { Button, type buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

type ButtonVariant = NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];

interface SmartActionItem {
  label: string;
  description?: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
}

interface SmartActionButtonProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  items: SmartActionItem[];
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}

export function SmartActionButton({
  label,
  icon: Icon,
  onClick,
  items,
  variant = "default",
  disabled = false,
  className,
}: SmartActionButtonProps) {
  return (
    <div className={cn("inline-flex items-center rounded-[calc(var(--radius)-1px)]", className)}>
      <Button
        variant={variant}
        onClick={onClick}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-r-none pr-2.5"
      >
        {Icon ? <Icon className="size-4" /> : null}
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            disabled={disabled}
            className="rounded-l-none border-l border-white/10 px-0 shadow-none"
            aria-label={`${label} options`}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 rounded-[calc(var(--radius)-1px)] border-border/80 bg-popover p-1.5 shadow-[var(--shadow-elevated)]"
        >
          {items.map((item, index) => {
            const ItemIcon = item.icon;

            return (
              <div key={item.label}>
                <DropdownMenuItem
                  variant={item.destructive ? "destructive" : "default"}
                  onClick={item.onSelect}
                  className="items-start gap-3 rounded-[calc(var(--radius)-5px)] px-3 py-2.5"
                >
                  {ItemIcon ? (
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius)-5px)] border border-border/70 bg-background text-muted-foreground">
                      <ItemIcon className="size-4" />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[0.82rem] font-semibold text-foreground">{item.label}</p>
                    {item.description ? (
                      <p className="mt-0.5 text-[0.74rem] leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </DropdownMenuItem>
                {index < items.length - 1 ? <DropdownMenuSeparator /> : null}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
