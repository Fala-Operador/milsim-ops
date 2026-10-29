// Protótipo do redesign: um só cartão de operação para a página inicial e as seções de divulgação.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Evento } from "@/lib/domain/types";
import { Preco } from "@/components/Preco";
import { ImagemSegura } from "@/components/divulgacao";
import { nomeModalidade } from "@/lib/modalidades";
import { tr } from "@/i18n/components/CartaoOperacao";


export function CartaoOperacao({ evento: e, organizacao, preco, restantes, selo, chamada }: {
  evento: Evento; organizacao?: string; preco: number; restantes: number; selo?: string | undefined; chamada?: string | undefined;
}) {
  const d = new Date(e.inicioEm);
  const poucas = restantes > 0 && restantes <= e.capacidadeTotal * 0.15;
  let estado: ReactNode = null;
  if (restantes <= 0) estado = <span className="text-destructive">{tr("esgotado")}</span>;
  else if (poucas) estado = <span className="text-warning">{tr("restam_restantes_vagas", { restantes })}</span>;
  return (
    <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card text-card-foreground hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
        <ImagemSegura src={e.imagemUrl} alt={e.imagem?.alt || ""} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
        {e.modalidade && <span className="absolute left-3 top-3 rounded-sm bg-black/65 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white backdrop-blur-sm">
          {nomeModalidade(e.modalidade)}
        </span>}
        {selo && <span className="absolute right-3 top-3 rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">{selo}</span>}
      </div>
      <div className="flex flex-1 gap-4 p-4">
        <div className="w-11 shrink-0 text-center leading-none" aria-hidden="true">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">{tr("semana").split(",")[d.getDay()]}</p>
          <p className="mt-1 font-display text-[28px] font-bold">{String(d.getDate()).padStart(2, "0")}</p>
          <p className="mt-0.5 font-mono text-[11px] uppercase text-accent">{tr("meses").split(",")[d.getMonth()]}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col border-l border-border/70 pl-4">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{e.nome}</h3>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">{e.cidade}/{e.uf}{organizacao ? ` · ${organizacao}` : ""}</p>
          {chamada && <p className="mt-2 line-clamp-2 text-[13px]">{chamada}</p>}
          <div className="mt-auto flex items-baseline justify-between gap-2 pt-3 text-[13px]">
            <span className="text-muted-foreground">{tr("a_partir_de")}{" "}<Preco centavos={preco} className="font-semibold text-foreground" /></span>
            {estado && <span className="font-medium">{estado}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
