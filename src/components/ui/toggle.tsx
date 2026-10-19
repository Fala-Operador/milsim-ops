import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Botões liga/desliga (aria-pressed). "chip" e "chipAccent" são as pílulas de filtro do app;
// "plain" deixa a aparência com a tela (cartões e opções grandes), que usam data-[state=on].
const toggleVariants = cva(
  "cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        plain: "",
        chip: "rounded-full border px-3 py-1 text-xs font-medium data-[state=off]:border-border data-[state=off]:bg-background/70 data-[state=off]:text-muted-foreground data-[state=off]:hover:border-accent data-[state=off]:hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        chipAccent:
          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs data-[state=off]:border-border data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=on]:border-accent data-[state=on]:bg-accent/10 data-[state=on]:text-accent",
      },
    },
    defaultVariants: {
      variant: "plain",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, className }))} {...props} />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
