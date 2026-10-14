// Componentes públicos da página inicial: seletor de região, seções, carrossel, parceiros e banner.
import { nomeModalidade } from "@/lib/modalidades";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { registrarClique, registrarExibicao } from "@/services/analytics";
import type { OrigemAcesso } from "@/lib/analytics";
import { ExternalLink, Globe, ImageOff, Instagram, MessageCircle } from "lucide-react";
import type { Abrangencia, BaseDados, LinkParceiro, Parceiro, SecaoInicial } from "@/lib/domain/types";
import {
  REGIOES, UF_REGIAO, hrefDoLink, linkPrincipal, rotuloAbrangencia, rotuloDoLink,
  type CartaoEventoResolvido, type SecaoResolvida,
} from "@/lib/divulgacao";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Selecao } from "@/components/ui";
import { SectionCarousel } from "@/components/SectionCarousel";

const UFS = Object.keys(UF_REGIAO).sort();

export function SeletorLocalizacao({
  base, valor, onMudar,
}: { base: BaseDados; valor: Abrangencia; onMudar: (a: Abrangencia) => void }) {
  const cidades = valor.uf
    ? [...new Set(base.eventos.filter((e) => e.uf === valor.uf).map((e) => e.cidade))].sort()
    : [];
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Escolher localização">
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted-foreground">Localização</span>
        <Selecao
          value={valor.escopo}
          onChange={(e) => {
            const escopo = e.target.value as Abrangencia["escopo"];
            onMudar(escopo === "nacional" ? { escopo } : { escopo, regiao: valor.regiao ?? "Sudeste", uf: valor.uf ?? "SP", cidade: valor.cidade });
          }}
        >
          <option value="nacional">Todo o Brasil</option>
          <option value="regiao">Região</option>
          <option value="estado">Estado</option>
          <option value="cidade">Cidade</option>
        </Selecao>
      </label>
      {valor.escopo === "regiao" && (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Região</span>
          <Selecao value={valor.regiao} onChange={(e) => onMudar({ escopo: "regiao", regiao: e.target.value as Abrangencia["regiao"] })}>
            {REGIOES.map((r) => <option key={r}>{r}</option>)}
          </Selecao>
        </label>
      )}
      {(valor.escopo === "estado" || valor.escopo === "cidade") && (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Estado</span>
          <Selecao value={valor.uf} onChange={(e) => onMudar({ escopo: valor.escopo, uf: e.target.value, cidade: undefined })}>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </Selecao>
        </label>
      )}
      {valor.escopo === "cidade" && (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Cidade</span>
          <Selecao value={valor.cidade ?? ""} onChange={(e) => onMudar({ ...valor, cidade: e.target.value })}>
            <option value="">Selecione</option>
            {cidades.map((c) => <option key={c}>{c}</option>)}
          </Selecao>
        </label>
      )}
    </div>
  );
}

export function ImagemSegura({ src, alt, className = "", contain = false }: { src?: string | undefined; alt: string; className?: string; contain?: boolean }) {
  const [erro, setErro] = useState(false);
  if (!src || erro) {
    return (
      <div className={`flex items-center justify-center bg-secondary text-muted-foreground ${className}`} role="img" aria-label={alt || "Imagem indisponível"}>
        <ImageOff className="h-6 w-6" aria-hidden />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setErro(true)}
      className={`${contain ? "object-contain" : "object-cover"} ${className}`} />
  );
}

/** Envolve um card de evento: exibição (50% visível por 1s) e clique, via AnalyticsService. */
export function CardRastreado({
  ativo, eventoId, origem, secaoId, posicao, visualizacaoId, campanhaId, className = "", children,
}: {
  ativo: boolean; eventoId: string; origem: OrigemAcesso; secaoId?: string | undefined; posicao: number; campanhaId?: string | undefined;
  visualizacaoId: string; className?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!ativo || !el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const obs = new IntersectionObserver(([en]) => {
      if (en?.isIntersecting && en.intersectionRatio >= 0.5) {
        timer ??= setTimeout(() => {
          registrarExibicao({ eventoId, origem, secaoId, posicao, visualizacaoId, campanhaId });
          obs.disconnect();
        }, 1000);
      } else {
        clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: [0, 0.5, 1] });
    obs.observe(el);
    return () => { obs.disconnect(); clearTimeout(timer); };
  }, [ativo, eventoId, origem, secaoId, posicao, visualizacaoId, campanhaId]);
  return (
    <div ref={ref} className={className} onClickCapture={ativo ? () => registrarClique({ eventoId, origem, secaoId, posicao, campanhaId }) : undefined}>
      {children}
    </div>
  );
}

function precoInicial(e: CartaoEventoResolvido["evento"]): number {
  const precos = e.lotes.filter((l) => l.status === "ativo").flatMap((l) => l.itens.map((i) => i.precoCentavos));
  return precos.length ? Math.min(...precos) : Math.min(...e.tipos.map((t) => t.precoBaseCentavos));
}

export function CartaoEvento({ c }: { c: CartaoEventoResolvido }) {
  const e = c.evento;
  return (
    <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}
      className="block h-full rounded-lg border border-border bg-card text-card-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg">
        {c.imagem ? (
          <ImagemSegura src={c.imagem} alt={`Imagem da ${e.nome}`} className="h-full w-full" />
        ) : (
          <div className="topo-bg flex h-full items-end bg-secondary p-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{e.cidade} · {e.uf}</span>
          </div>
        )}
        {(c.selo || c.campanhaId) && (
          <span className="absolute left-2 top-2 flex gap-1">
            {c.campanhaId && <Badge tom="aviso">Em destaque</Badge>}
            {c.selo && <Badge tom="aviso">{c.selo}</Badge>}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold uppercase">{e.nome}</h3>
            <span className="mt-1 inline-block rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{nomeModalidade(e.modalidade)}</span>
          </div>
          {c.esgotado ? <Badge tom="perigo">Esgotado</Badge> : <Badge tom="sucesso">Vagas abertas</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{formatarDataBR(e.inicioEm)} · {e.cidade}/{e.uf}</p>
        {c.chamada && <p className="mt-2 text-sm">{c.chamada}</p>}
        <p className="mt-2 text-sm">A partir de <span className="text-accent">{formatarBRL(precoInicial(e))}</span></p>
      </div>
    </Link>
  );
}

const TAM_LOGO = { p: "h-14", m: "h-20", g: "h-28" } as const;
const SUPERFICIE = { nenhuma: "", clara: "bg-[oklch(0.98_0_0)]", escura: "bg-[oklch(0.2_0_0)]" } as const;

const ICONE_LINK: Record<LinkParceiro["tipo"], typeof Globe> = {
  site: Globe, instagram: Instagram, whatsapp: MessageCircle, externo: ExternalLink, outro: ExternalLink,
};
// Instagram primeiro, depois a ordem cadastrada.
const ordemBotao = (l: LinkParceiro) => (l.tipo === "instagram" ? 0 : 1);

function CartaoParceiro({ p, secao, carrossel }: { p: Parceiro; secao: SecaoInicial; carrossel: boolean }) {
  const principal = linkPrincipal(p);
  // Todo link válido vira botão — inclusive o principal (o logo também leva a ele).
  const botoes = p.links.filter((l) => hrefDoLink(l)).sort((a, b) => ordemBotao(a) - ordemBotao(b));
  const logo = (
    <div className={`rounded-md p-2 ${SUPERFICIE[secao.superficieLogo]}`}>
      <ImagemSegura src={p.logoUrl} alt={p.textoAlt || p.nome} contain className={`w-full ${TAM_LOGO[secao.tamanhoLogo]}`} />
    </div>
  );
  return (
    <div id={`parceiro-${p.id}`} className={`flex flex-col rounded-lg border border-border bg-card p-3 ${carrossel ? "w-60 shrink-0 snap-start" : "h-full"}`}>
      {principal ? (
        <a href={principal} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${p.nome} (nova aba)`} className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring">
          {logo}
          <p className="mt-2 text-center font-medium underline-offset-2 hover:underline">{p.nome}</p>
        </a>
      ) : (
        <>
          {logo}
          <p className="mt-2 text-center font-medium">{p.nome}</p>
        </>
      )}
      {secao.mostrarDescricoes && p.descricao && <p className="mt-1 text-center text-xs text-muted-foreground">{p.descricao}</p>}
      {botoes.length > 0 && (
        // mt-auto: os botões ficam alinhados na base, mesmo com descrições de alturas diferentes
        <div className="mt-auto flex flex-wrap justify-center gap-1 pt-2">
          {botoes.map((l) => {
            const Icone = ICONE_LINK[l.tipo];
            return (
              <a key={l.id} href={hrefDoLink(l)!} target="_blank" rel="noopener noreferrer"
                aria-label={`Abrir ${rotuloDoLink(l)} de ${p.nome} (nova aba)`}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
                <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                {rotuloDoLink(l)}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Banner({ secao, base, celular, rastrear }: { secao: SecaoInicial; base: BaseDados; celular: boolean; rastrear: boolean }) {
  const b = secao.banner!;
  const img = celular && b.imagemCelular ? b.imagemCelular : b.imagemDesktop;
  const d = b.destino;
  const botao = b.textoBotao || "Saiba mais";
  const classeBotao = "inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";
  let acao: ReactNode = null;
  if (d?.tipo === "evento" && base.eventos.some((e) => e.id === d.valor)) {
    acao = <Link to="/eventos/$eventoId" params={{ eventoId: d.valor }} onClickCapture={() => rastrear && registrarClique({ eventoId: d.valor, origem: "inicio", secaoId: secao.id })} className={classeBotao}>{botao}</Link>;
  } else if (d?.tipo === "secao") {
    acao = <a href={`#secao-${d.valor}`} className={classeBotao}>{botao}</a>;
  } else if (d?.tipo === "parceiro") {
    acao = <a href={`#parceiro-${d.valor}`} className={classeBotao}>{botao}</a>;
  } else if (d?.tipo === "externo" && d.valor) {
    acao = <a href={d.valor} target="_blank" rel="noopener noreferrer" className={classeBotao}>{botao}</a>;
  }
  const ev = d?.tipo === "evento" ? base.eventos.find((e) => e.id === d.valor) : undefined;
  if (ev && img) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        <ImagemSegura src={img} alt={b.textoAlt} className={`w-full ${celular ? "aspect-[4/3] max-h-[300px]" : "aspect-[21/6] max-h-[300px]"}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-6">
          <div className="min-w-0 text-white">
            <span className="inline-block rounded bg-accent px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-accent-foreground">Operação em destaque</span>
            <p className="mt-2 font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">{ev.nome}</p>
            <p className="text-sm text-white/85">{formatarDataBR(ev.inicioEm)} · {ev.cidade}/{ev.uf}</p>
          </div>
          <Link to="/eventos/$eventoId" params={{ eventoId: ev.id }} onClickCapture={() => rastrear && registrarClique({ eventoId: ev.id, origem: "inicio", secaoId: secao.id })} className={classeBotao}>Ver operação</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      {img && <ImagemSegura src={img} alt={b.textoAlt} className={`w-full ${celular ? "aspect-[4/3] max-h-[300px]" : "aspect-[21/6] max-h-[300px]"}`} />}
      {(b.chamada || acao) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          {b.chamada && <p className="font-display text-xl font-semibold uppercase">{b.chamada}</p>}
          {acao}
        </div>
      )}
    </div>
  );
}

export function SecoesPublicas({
  secoes, base, local, celular = false, rastrear = false, visualizacaoId = "previa",
}: { secoes: SecaoResolvida[]; base: BaseDados; local: Abrangencia; celular?: boolean; rastrear?: boolean; visualizacaoId?: string }) {
  return (
    <div className="min-w-0 max-w-full space-y-10">
      {secoes.map(({ secao, eventos, parceiros }) => {
        const carrossel = secao.layout === "carrossel";
        const origemSecao: OrigemAcesso = secao.tipo === "regional" ? "regional" : "destaques";
        const regional = local.escopo === "nacional" && secao.abrangencia.escopo !== "nacional";
        const grade = celular ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
        const gradeParceiros = celular ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
        const cabecalho = (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`t-${secao.id}`} className="font-display text-2xl font-semibold uppercase tracking-wide">{secao.titulo}</h2>
              {regional && <Badge>{rotuloAbrangencia(secao.abrangencia)}</Badge>}
              {secao.status === "rascunho" && <Badge tom="aviso">Rascunho</Badge>}
            </div>
            {secao.subtitulo && <p className="text-sm text-muted-foreground">{secao.subtitulo}</p>}
          </>
        );
        return (
          <section key={secao.id} id={`secao-${secao.id}`} className="min-w-0 max-w-full" aria-labelledby={`t-${secao.id}`}>
            {secao.tipo !== "banner" && !carrossel && <div className="mb-3">{cabecalho}</div>}
            {secao.tipo === "banner" && <h2 id={`t-${secao.id}`} className="sr-only">{secao.titulo}</h2>}
            {secao.tipo === "banner" ? (
              <Banner secao={secao} base={base} celular={celular} rastrear={rastrear} />
            ) : eventos.length ? (
              carrossel ? (
                <SectionCarousel rotulo={secao.titulo} cabecalho={cabecalho}>{eventos.map((c, i) => (
                  <CardRastreado key={c.evento.id} ativo={rastrear} eventoId={c.evento.id} origem={origemSecao} secaoId={secao.id} posicao={i + 1} visualizacaoId={visualizacaoId} campanhaId={c.campanhaId} className="w-72 max-w-full shrink-0 snap-start">
                    <CartaoEvento c={c} />
                  </CardRastreado>
                ))}</SectionCarousel>
              ) : (
                <div className={grade}>{eventos.map((c, i) => (
                  <CardRastreado key={c.evento.id} ativo={rastrear} eventoId={c.evento.id} origem={origemSecao} secaoId={secao.id} posicao={i + 1} visualizacaoId={visualizacaoId} campanhaId={c.campanhaId} className="h-full">
                    <CartaoEvento c={c} />
                  </CardRastreado>
                ))}</div>
              )
            ) : carrossel ? (
              <SectionCarousel rotulo={secao.titulo} cabecalho={cabecalho}>{parceiros.map((p) => <CartaoParceiro key={p.id} p={p} secao={secao} carrossel />)}</SectionCarousel>
            ) : (
              <div className={gradeParceiros}>{parceiros.map((p) => <CartaoParceiro key={p.id} p={p} secao={secao} carrossel={false} />)}</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
