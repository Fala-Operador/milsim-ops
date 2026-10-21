import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InputSenhaProps = Omit<React.ComponentProps<"input">, "type">;

// Campo de senha com o botão de olho para mostrar ou ocultar o que foi digitado.
const InputSenha = React.forwardRef<HTMLInputElement, InputSenhaProps>(({ className, ...props }, ref) => {
  const [mostrar, setMostrar] = React.useState(false);
  const Olho = mostrar ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input ref={ref} type={mostrar ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <Button
        type="button"
        variant="plain"
        size="none"
        onClick={() => setMostrar((m) => !m)}
        aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={mostrar}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Olho className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
});
InputSenha.displayName = "InputSenha";

export { InputSenha };
