import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Rótulo de status: nunca quebra linha e os ícones SVG têm tamanho fixo, para ficar
// íntegro em tabelas, cartões e detalhes.
const badgeVariants = cva(
  "status-badge inline-flex w-max max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium leading-4 [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        accent: "bg-accent text-accent-foreground",
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
