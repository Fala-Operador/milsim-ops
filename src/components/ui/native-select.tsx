import * as React from "react";

import { cn } from "@/lib/utils";
import { estiloCampo } from "@/components/ui/input";

// Seleção nativa (componente native-select do shadcn/ui): mantém o seletor do sistema
// no celular e funciona com <option> e onChange comuns. A seta padrão do navegador é
// trocada pela mesma seta (ChevronDown) dos outros seletores; ver `.campo-select` em styles.css.
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(estiloCampo, "campo-select", className)} {...props} />
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
