// Componentes públicos da página inicial: seletor de região, seções, carrossel, parceiros e banner.
import { Link } from "@tanstack/react-router";
import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { Abrangencia, BaseDados, Parceiro, SecaoInicial } from "@/lib/domain/types";
import {
  REGIOES, UF_REGIAO, hrefDoLink, linkPrincipal, rotuloAbrangencia, rotuloDoLink,
  type CartaoEventoResolvido, type SecaoResolvida,
} from "@/lib/divulgacao";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { Badge, Botao, Selecao } from "@/components/ui";

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

/** Carrossel sem avanço automático, com botões e rolagem por teclado. */
function Carrossel({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduzir ? "auto" : "smooth" });
  };
  return (
    <div className="relative" role="region" aria-roledescription="carrossel" aria-label={rotulo}>
      <div ref={ref} tabIndex={0} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Botao variante="contorno" className="!px-2" onClick={() => mover(-1)} aria-label={`Anterior em ${rotulo}`}><ChevronLeft className="h-4 w-4" /></Botao>
        <Botao variante="contorno" className="!px-2" onClick={() => mover(1)} aria-label={`Próximo em ${rotulo}`}><ChevronRight className="h-4 w-4" /></Botao>
      </div>
    </div>
  );
}

function precoInicial(e: CartaoEventoResolvido["evento"]): number {
  const precos = e.lotes.filter((l) => l.status === "ativo").flatMap((l) => l.itens.map((i) => i.precoCentavos));
  return precos.length ? Math.min(...precos) : Math.min(...e.tipos.map((t) => t.precoBaseCentavos));
}

function CartaoEvento({ c, carrossel }: { c: CartaoEventoResolvido; carrossel: boolean }) {
  const e = c.evento;
  return (
    <Link to="/eventos/$eventoId" params={{ eventoId: e.id }}
      className={`block rounded-lg border border-border bg-card text-card-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${carrossel ? "w-72 shrink-0 snap-start" : ""}`}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg">
        {c.imagem ? (
          <ImagemSegura src={c.imagem} alt={`Imagem da ${e.nome}`} className="h-full w-full" />
        ) : (
          <div className="topo-bg flex h-full items-end bg-secondary p-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{e.cidade} · {e.uf}</span>
          </div>
        )}
        {c.selo && <span className="absolute left-2 top-2"><Badge tom="aviso">{c.selo}</Badge></span>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold uppercase">{e.nome}</h3>
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

function CartaoParceiro({ p, secao, carrossel }: { p: Parceiro; secao: SecaoInicial; carrossel: boolean }) {
  const principal = linkPrincipal(p);
  const extras = p.links.filter((l) => hrefDoLink(l) && hrefDoLink(l) !== principal);
  const logo = (
    <div className={`rounded-md p-2 ${SUPERFICIE[secao.superficieLogo]}`}>
      <ImagemSegura src={p.logoUrl} alt={p.textoAlt || p.nome} contain className={`w-full ${TAM_LOGO[secao.tamanhoLogo]}`} />
    </div>
  );
  return (
    <div id={`parceiro-${p.id}`} className={`rounded-lg border border-border bg-card p-3 ${carrossel ? "w-60 shrink-0 snap-start" : ""}`}>
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
      {extras.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {extras.map((l) => (
            <a key={l.id} href={hrefDoLink(l)!} target="_blank" rel="noopener noreferrer"
              aria-label={`Abrir ${rotuloDoLink(l)} de ${p.nome}`}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">
              {rotuloDoLink(l)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Banner({ secao, base, celular }: { secao: SecaoInicial; base: BaseDados; celular: boolean }) {
  const b = secao.banner!;
  const img = celular && b.imagemCelular ? b.imagemCelular : b.imagemDesktop;
  const d = b.destino;
  const botao = b.textoBotao || "Saiba mais";
  const classeBotao = "inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";
  let acao: ReactNode = null;
  if (d?.tipo === "evento" && base.eventos.some((e) => e.id === d.valor)) {
    acao = <Link to="/eventos/$eventoId" params={{ eventoId: d.valor }} className={classeBotao}>{botao}</Link>;
  } else if (d?.tipo === "secao") {
    acao = <a href={`#secao-${d.valor}`} className={classeBotao}>{botao}</a>;
  } else if (d?.tipo === "parceiro") {
    acao = <a href={`#parceiro-${d.valor}`} className={classeBotao}>{botao}</a>;
  } else if (d?.tipo === "externo" && d.valor) {
    acao = <a href={d.valor} target="_blank" rel="noopener noreferrer" className={classeBotao}>{botao}</a>;
  }
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      {img && <ImagemSegura src={img} alt={b.textoAlt} className={`w-full ${celular ? "aspect-[4/3]" : "aspect-[21/7]"}`} />}
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
  secoes, base, local, celular = false,
}: { secoes: SecaoResolvida[]; base: BaseDados; local: Abrangencia; celular?: boolean }) {
  return (
    <div className="space-y-10">
      {secoes.map(({ secao, eventos, parceiros }) => {
        const carrossel = secao.layout === "carrossel";
        const regional = local.escopo === "nacional" && secao.abrangencia.escopo !== "nacional";
        const grade = celular ? "grid gap-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
        const gradeParceiros = celular ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
        return (
          <section key={secao.id} id={`secao-${secao.id}`} aria-labelledby={`t-${secao.id}`}>
            {secao.tipo !== "banner" && (
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={`t-${secao.id}`} className="font-display text-2xl font-semibold uppercase tracking-wide">{secao.titulo}</h2>
                  {regional && <Badge>{rotuloAbrangencia(secao.abrangencia)}</Badge>}
                  {secao.status === "rascunho" && <Badge tom="aviso">Rascunho</Badge>}
                </div>
                {secao.subtitulo && <p className="text-sm text-muted-foreground">{secao.subtitulo}</p>}
              </div>
            )}
            {secao.tipo === "banner" && <h2 id={`t-${secao.id}`} className="sr-only">{secao.titulo}</h2>}
            {secao.tipo === "banner" ? (
              <Banner secao={secao} base={base} celular={celular} />
            ) : eventos.length ? (
              carrossel ? (
                <Carrossel rotulo={secao.titulo}>{eventos.map((c) => <CartaoEvento key={c.evento.id} c={c} carrossel />)}</Carrossel>
              ) : (
                <div className={grade}>{eventos.map((c) => <CartaoEvento key={c.evento.id} c={c} carrossel={false} />)}</div>
              )
            ) : carrossel ? (
              <Carrossel rotulo={secao.titulo}>{parceiros.map((p) => <CartaoParceiro key={p.id} p={p} secao={secao} carrossel />)}</Carrossel>
            ) : (
              <div className={gradeParceiros}>{parceiros.map((p) => <CartaoParceiro key={p.id} p={p} secao={secao} carrossel={false} />)}</div>
            )}
          </section>
        );
      })}
    </div>
  );
}
