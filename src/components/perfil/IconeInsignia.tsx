import { Award, Compass, Map, Medal, Shield, Target, Trophy, type LucideIcon } from "lucide-react";

/** Ícones de insígnia compatíveis com todos os navegadores (emojis viram quadrados em alguns). */
const ICONES: Record<string, LucideIcon> = {
  "🎖️": Medal,
  "🪖": Shield,
  "🏅": Award,
  "🧭": Compass,
  "🗺️": Map,
  "🎯": Target,
};

export const ICONES_INSIGNIA = Object.keys(ICONES);

export function IconeInsignia({ icone, size = 24, className }: { icone: string; size?: number; className?: string }) {
  const Icone = ICONES[icone] ?? Trophy;
  return <Icone size={size} className={className} aria-hidden="true" />;
}
