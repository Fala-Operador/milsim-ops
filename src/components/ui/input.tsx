import * as React from "react";

import { cn } from "@/lib/utils";

// 16px no celular (abaixo disso o Safari do iOS amplia a página ao focar) e 14px a partir
// de sm. O seletor de arquivo nativo segue o estilo global de styles.css.
export const estiloCampo =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus:border-ring focus:outline-none sm:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(estiloCampo, "placeholder:text-muted-foreground", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
