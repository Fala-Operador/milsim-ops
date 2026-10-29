// Mostra um texto fixo do site (marcação de src/lib/textoRico.ts) como elementos React.
import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { blocos, trechos, type Trecho } from "@/lib/textoRico";

function Trechos({ itens }: { itens: Trecho[] }) {
  return (
    <>
      {itens.map((t, i) => {
        if (t.tipo === "texto") return <Fragment key={i}>{t.texto}</Fragment>;
        if (t.tipo === "codigo") return <code key={i}>{t.texto}</code>;
        if (t.tipo === "negrito") return <strong key={i}><Trechos itens={t.filhos} /></strong>;
        const filhos = <Trechos itens={t.filhos} />;
        // Caminho do site: navegação do roteador. Âncora e e-mail: link comum. Fora do site: nova aba.
        if (t.href.startsWith("/") && !t.href.includes("#")) return <Link key={i} to={t.href}>{filhos}</Link>;
        if (t.href.startsWith("https://")) return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">{filhos}</a>;
        return <a key={i} href={t.href}>{filhos}</a>;
      })}
    </>
  );
}

/** Texto em blocos (parágrafos, listas); `especiais` preenche os blocos [[nome]]. */
export function TextoRico({ texto, especiais }: { texto: string; especiais?: Record<string, ReactNode> }) {
  return (
    <>
      {blocos(texto).map((b, i) => {
        if (b.tipo === "especial") return <Fragment key={i}>{especiais?.[b.nome] ?? null}</Fragment>;
        if (b.tipo === "lista") return <ul key={i}>{b.itens.map((item, j) => <li key={j}><Trechos itens={item} /></li>)}</ul>;
        return <p key={i}><Trechos itens={b.trechos} /></p>;
      })}
    </>
  );
}

/** Texto de uma linha, sem parágrafo em volta (para usar dentro de <p>, <li> etc.). */
export function TextoEmLinha({ texto }: { texto: string }) {
  return <Trechos itens={trechos(texto)} />;
}
