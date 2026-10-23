import { cn } from "@/lib/utils";

// Brilho que atravessa o bloco (`skeleton-brilho`, styles.css); parado com reduced-motion.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-brilho rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
