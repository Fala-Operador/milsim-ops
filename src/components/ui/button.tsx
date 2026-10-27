import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Identidade do Milsim Ops: hover por opacidade, foco pelo contorno global (styles.css)
// e sem tamanho fixo de ícone, para manter os ícones que cada tela já define.
// Hover e toque com transição curta (cor, fundo, borda, opacidade) e leve afundar ao toque.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[color,background-color,border-color,opacity,box-shadow,transform] duration-150 ease-[var(--ease-saida)] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        destructive: "border border-destructive/50 bg-transparent text-destructive hover:bg-destructive hover:text-destructive-foreground",
        outline: "border border-border bg-transparent text-foreground hover:border-foreground/40 hover:bg-secondary/60",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        link: "text-accent underline-offset-2 hover:underline",
        // Sem aparência própria: desfaz a base acima e deixa a tela definir tudo (linhas de lista,
        // miniaturas, links de ação). Use com size="none".
        plain:
          "inline-block items-stretch justify-start gap-0 whitespace-normal rounded-none text-[length:inherit] font-normal enabled:active:scale-100 disabled:cursor-default disabled:opacity-100",
      },
      size: {
        default: "px-4 py-2",
        sm: "px-3 py-1.5 text-xs",
        lg: "px-6 py-3",
        icon: "h-9 w-9",
        none: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
