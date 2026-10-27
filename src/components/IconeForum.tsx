// Ícones próprios dos fóruns da comunidade (traço reto, cantos vivos, no estilo da marca).
// O fórum guarda um emoji legado em `icone`; aqui ele vira o desenho correspondente.
import type { ReactNode } from "react";

type Tipo = "todos" | "avisos" | "geral" | "duvidas" | "logistica" | "fotos" | "preparacao" | "equipamento" | "outro";

const DESENHOS: Record<Tipo, ReactNode> = {
  // Quatro quadros: todos os fóruns.
  todos: <><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></>,
  // Rádio de campanha com antena: comunicados oficiais.
  avisos: <><path d="M6 9h12v11H6z" /><path d="M9 9 15 3" /><path d="M9 13h6M9 16h3" /><circle cx="15.5" cy="16.5" r="1" /></>,
  // Dois balões retos: conversa.
  geral: <><path d="M3 4h12v8H8l-3 3v-3H3z" /><path d="M17 8h4v8h-2v3l-3-3h-5v-2" /></>,
  // Prancheta de briefing com interrogação.
  duvidas: <><path d="M6 4h12v17H6z" /><path d="M9 3h6v3H9z" /><path d="M10 11a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6" /><path d="M12 17.5v.01" /></>,
  // Viatura: caronas e logística.
  logistica: <><path d="M2 15V9h11l3 3h4a2 2 0 0 1 2 2v1" /><path d="M2 15h2M10 15h5M20 15h2" /><circle cx="7" cy="16" r="2" /><circle cx="17.5" cy="16" r="2" /><path d="M5 9V6h5v3" /></>,
  // Câmera com retícula: fotos e relatos.
  fotos: <><path d="M3 7h4l2-3h6l2 3h4v13H3z" /><circle cx="12" cy="13" r="4" /><path d="M12 8v2M12 16v2M7 13h2M15 13h2" /></>,
  // Retícula de mira: preparação operacional.
  preparacao: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></>,
  // Colete: equipamento.
  equipamento: <><path d="M8 3h2l2 2 2-2h2l1 5-1 2v11H8V10L7 8z" /><path d="M8 13h8M8 17h8" /></>,
  // Bandeirola de marcação: qualquer outro fórum.
  outro: <><path d="M6 21V3" /><path d="M6 4h11l-3 4 3 4H6" /></>,
};

const POR_EMOJI: Record<string, Tipo> = {
  "📢": "avisos", "📣": "avisos", "💬": "geral", "❓": "duvidas", "🚗": "logistica", "🚙": "logistica",
  "📷": "fotos", "📸": "fotos", "🎯": "preparacao", "🪖": "equipamento", "🎒": "equipamento",
};

function tipoDoForum(forum?: { icone?: string | undefined; nome: string }): Tipo {
  if (!forum) return "todos";
  const porEmoji = forum.icone ? POR_EMOJI[forum.icone.trim()] : undefined;
  if (porEmoji) return porEmoji;
  const n = forum.nome.toLocaleLowerCase("pt-BR");
  if (/aviso|comunicad|oficia/.test(n)) return "avisos";
  if (/carona|log[ií]stic|hosped|transport/.test(n)) return "logistica";
  if (/foto|relato|imagem|v[ií]deo/.test(n)) return "fotos";
  if (/d[uú]vida|pergunt/.test(n)) return "duvidas";
  if (/prepar|briefing|t[aá]tic|miss/.test(n)) return "preparacao";
  if (/equip|gear|loja|classific/.test(n)) return "equipamento";
  if (/conversa|geral|papo/.test(n)) return "geral";
  return "outro";
}

export function IconeForum({ forum, ativo = false, tamanho = "md" }: {
  forum?: { icone?: string | undefined; nome: string } | undefined;
  ativo?: boolean;
  tamanho?: "sm" | "md" | "lg";
}) {
  const caixa = tamanho === "lg" ? "size-11" : tamanho === "sm" ? "size-5 border-0 bg-transparent" : "size-8";
  const icone = tamanho === "lg" ? "size-6" : tamanho === "sm" ? "size-4" : "size-[18px]";
  return (
    <span aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-md border ${ativo ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-secondary/60 text-muted-foreground"} ${caixa}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" className={icone}>
        {DESENHOS[tipoDoForum(forum)]}
      </svg>
    </span>
  );
}

/** Opções do editor de fórum. O valor salvo continua sendo o emoji (campo `icone`), sem mudar o banco. */
export const OPCOES_ICONE_FORUM: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Automático (pelo nome)" },
  { valor: "📢", rotulo: "Rádio · avisos" },
  { valor: "💬", rotulo: "Balões · conversa" },
  { valor: "❓", rotulo: "Prancheta · dúvidas" },
  { valor: "🚗", rotulo: "Viatura · logística" },
  { valor: "📷", rotulo: "Câmera · fotos" },
  { valor: "🎯", rotulo: "Retícula · preparação" },
  { valor: "🪖", rotulo: "Colete · equipamento" },
];
