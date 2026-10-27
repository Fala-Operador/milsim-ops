import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Rótulo de status: nunca quebra linha e os ícones SVG têm tamanho fixo, para ficar
// íntegro em tabelas, cartões e detalhes.
const badgeVariants = cva(
  "status-badge inline-flex w-max max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[11px] font-semibold leading-4 tracking-wide [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success/15 text-success ring-1 ring-inset ring-success/30",
        warning: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/35",
        destructive: "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/35",
        accent: "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
