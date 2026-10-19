import * as React from "react";

import { cn } from "@/lib/utils";
import { estiloCampo } from "@/components/ui/input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        className={cn(estiloCampo, "placeholder:text-muted-foreground", className)}
        rows={rows}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
