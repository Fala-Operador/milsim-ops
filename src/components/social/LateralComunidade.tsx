// Lateral da comunidade geral (feed e fóruns): banners, operações impulsionadas e patrocinadores.
// O que entra é decidido por `lateralDaComunidade` (src/lib/divulgacao.ts); aqui só se desenha.
// `compacta`: versão do celular, mostrada no topo do feed (um destaque só).
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { carregarBase } from "@/services/db";
import { idDoVisitante } from "@/services/analytics";
import { useLocalizacao } from "@/contexts/LocalizacaoContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import { lateralDaComunidade, linkPrincipal, type CartaoEventoResolvido } from "@/lib/divulgacao";
import { formatarDataBR } from "@/lib/domain/money";
import { CardRastreado, ImagemSegura } from "@/components/divulgacao";
import type { BaseDados, SecaoInicial } from "@/lib/domain/types";

function destinoDoBanner(base: BaseDados, s: SecaoInicial): { interno?: string; externo?: string } {
  const d = s.banner?.destino;
  if (d?.tipo === "evento" && base.eventos.some((e) => e.id === d.valor)) return { interno: d.valor };
  if (d?.tipo === "externo" && d.valor) return { externo: d.valor };
  return {};
}

function BannerLateral({ base, secao }: { base: BaseDados; secao: SecaoInicial }) {
  const b = secao.banner!;
  const img = b.imagemCelular || b.imagemDesktop;
  const destino = destinoDoBanner(base, secao);
  const corpo = (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {img && <ImagemSegura src={img} alt={b.textoAlt} className="aspect-[4/3] w-full" />}
      {(b.chamada || destino.interno || destino.externo) && (
        <div className="p-3">
          {b.chamada && <p className="text-sm font-medium">{b.chamada}</p>}
          {(destino.interno || destino.externo) && <p className="mt-1 text-xs font-medium text-accent">{b.textoBotao || "Saiba mais"} →</p>}
        </div>
      )}
    </div>
  );
  if (destino.interno) return <Link to="/eventos/$eventoId" params={{ eventoId: destino.interno }} className="block hover:opacity-95">{corpo}</Link>;
  if (destino.externo) return <a href={destino.externo} target="_blank" rel="noopener noreferrer" className="block hover:opacity-95">{corpo}</a>;
  return corpo;
}

function OperacaoLateral({ c }: { c: CartaoEventoResolvido }) {
  const e = c.evento;
  return (
    <Link to="/eventos/$eventoId" params={{ eventoId: e.id }} className="flex gap-3 rounded-lg border border-border bg-card p-2 hover:bg-card/80">
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-secondary">
        <ImagemSegura src={c.imagem} alt="" className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold leading-tight">{e.nome}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}</p>
        {c.esgotado && <p className="text-xs font-medium text-destructive">Esgotado</p>}
      </div>
    </Link>
  );
}

export function LateralComunidade({ compacta = false }: { compacta?: boolean }) {
  const versao = useVersaoBase();
  const { local } = useLocalizacao();
  const [visualizacaoId] = useState(() => `vz-com-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const base = carregarBase();
  const lateral = useMemo(() => lateralDaComunidade(base, local, new Date(), idDoVisitante()), [versao, local]); // eslint-disable-line react-hooks/exhaustive-deps
  const { banners, operacoes, patrocinadores } = lateral;
  if (!banners.length && !operacoes.length && !patrocinadores.length) return null;

  const cartaoOperacao = (c: CartaoEventoResolvido, i: number) => (
    <CardRastreado key={c.evento.id} ativo eventoId={c.evento.id} origem="destaques" secaoId="comunidade" posicao={i + 1}
      visualizacaoId={visualizacaoId} campanhaId={c.campanhaId}>
      <OperacaoLateral c={c} />
    </CardRastreado>
  );

  // Celular: um destaque só, no topo do feed (banner primeiro; senão a primeira operação).
  if (compacta) {
    const primeiro = banners[0];
    if (primeiro) return <aside aria-label="Destaque" className="lg:hidden"><BannerLateral base={base} secao={primeiro} /></aside>;
    const op = operacoes[0];
    return op ? (
      <aside aria-label="Operação em destaque" className="space-y-1 lg:hidden">
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Operação em destaque</p>
        {cartaoOperacao(op, 0)}
      </aside>
    ) : null;
  }

  return (
    <div className="space-y-4">
      {banners.map((s) => <BannerLateral key={s.id} base={base} secao={s} />)}
      {operacoes.length > 0 && (
        <section aria-labelledby="lat-operacoes" className="space-y-2">
          <h2 id="lat-operacoes" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Operações em destaque</h2>
          {operacoes.map(cartaoOperacao)}
        </section>
      )}
      {patrocinadores.length > 0 && (
        <section aria-labelledby="lat-patrocinadores" className="space-y-2">
          <h2 id="lat-patrocinadores" className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Patrocinadores</h2>
          <ul className="grid grid-cols-2 gap-2">
            {patrocinadores.map((p) => {
              const href = linkPrincipal(p);
              const logo = p.logoUrl
                ? <ImagemSegura src={p.logoUrl} alt={p.textoAlt || p.nome} contain className="h-12 w-full" />
                : <span className="block truncate text-center text-xs font-medium">{p.nome}</span>;
              return (
                <li key={p.id} className="rounded-md border border-border bg-card p-2">
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${p.nome} (nova aba)`} className="block">{logo}</a> : logo}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
