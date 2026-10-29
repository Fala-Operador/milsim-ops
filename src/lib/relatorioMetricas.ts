// Monta o relatório de métricas (somente agregados) e o converte em CSV/PDF.
import type { Indicadores, LinhaGrupo } from "@/lib/analytics";
import { tr } from "@/i18n/lib/relatorioMetricas";

export interface SecaoRelatorio { titulo: string; cabecalho: string[]; linhas: string[][] }
export interface Relatorio { titulo: string; filtros: [string, string][]; secoes: SecaoRelatorio[] }

const n = (v: number) => String(v);
const p = (v: number | null) => (v === null ? tr("sem_dados") : `${v.toFixed(1).replace(".", ",")}%`);

export function montarRelatorio(a: {
  evento: string; periodo: string; origem: string; ind: Indicadores;
  porOrigem: LinhaGrupo[]; porSecao: LinhaGrupo[]; porEvento: LinhaGrupo[];
  nomeOrigem: (k: string) => string; nomeSecao: (k: string) => string; nomeEvento: (k: string) => string;
  geradoEm: string;
}): Relatorio {
  const i = a.ind;
  const grupo = (titulo: string, rot: string, lista: LinhaGrupo[], nome: (k: string) => string): SecaoRelatorio => ({
    titulo,
    cabecalho: [rot, tr("exibicoes"), tr("cliques"), "CTR", tr("visitas"), tr("visitantes"), tr("confirmadas"), tr("conversao")],
    linhas: lista.map((g) => [nome(g.chave), n(g.ind.exibicoes), n(g.ind.cliques), p(g.ind.ctr), n(g.ind.visitas), n(g.ind.visitantes), n(g.ind.confirmadas), p(g.ind.conversao)]),
  });
  return {
    titulo: tr("relatorio_de_metricas"),
    filtros: [[tr("evento"), a.evento], [tr("periodo"), a.periodo], [tr("origem_ou_campanha"), a.origem], [tr("gerado_em"), a.geradoEm]],
    secoes: [
      { titulo: tr("indicadores"), cabecalho: [tr("indicador"), tr("valor")], linhas: [
        [tr("exibicoes_dos_cards"), n(i.exibicoes)], [tr("cliques_nos_cards"), n(i.cliques)], [tr("ctr_dos_cards"), p(i.ctr)],
        [tr("visitas"), n(i.visitas)], [tr("visitantes_unicos_estimados"), n(i.visitantes)], [tr("cliques_em_inscrever_se"), n(i.cliquesInscrever)],
        [tr("inscricoes_iniciadas"), n(i.iniciadas)], [tr("inscricoes_confirmadas"), n(i.confirmadas)], [tr("conversao_de_visitantes"), p(i.conversao)],
        [tr("conclusao_da_inscricao"), p(i.conclusao)], [tr("fluxos_nao_concluidos"), n(i.naoConcluidos)],
        [tr("cortesias_resgatadas"), n(i.cortesias)], [tr("inclusoes_administrativas"), n(i.inclusoes)],
      ] },
      grupo(tr("por_origem"), tr("origem"), a.porOrigem, a.nomeOrigem),
      grupo(tr("por_secao_da_pagina_inicial"), tr("secao"), a.porSecao, a.nomeSecao),
      grupo(tr("por_evento"), tr("evento"), a.porEvento, a.nomeEvento),
    ].filter((s) => s.linhas.length > 0),
  };
}

const celula = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV com ";" (padrão do Excel em pt-BR) e BOM para acentos. */
export function relatorioParaCsv(r: Relatorio): string {
  const out: string[][] = [[r.titulo], ...r.filtros.map(([k, v]) => [k, v])];
  for (const s of r.secoes) out.push([], [s.titulo], s.cabecalho, ...s.linhas);
  return "\uFEFF" + out.map((l) => l.map(celula).join(";")).join("\r\n");
}

export function nomeArquivo(evento: string, ext: string): string {
  const slug = evento.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `metricas-${slug || "eventos"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baixarCsv(r: Relatorio, nome: string) {
  baixar(new Blob([relatorioParaCsv(r)], { type: "text/csv;charset=utf-8" }), nome);
}

export async function baixarPdf(r: Relatorio, nome: string) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16); doc.text(r.titulo, 14, 16);
  doc.setFontSize(10);
  let y = 24;
  for (const [k, v] of r.filtros) { doc.text(`${k}: ${v}`, 14, y); y += 5; }
  for (const s of r.secoes) {
    y += 4;
    doc.setFontSize(12); doc.text(s.titulo, 14, y);
    autoTable(doc, { startY: y + 2, head: [s.cabecalho], body: s.linhas, styles: { fontSize: 9 }, headStyles: { fillColor: [74, 85, 50] } });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    if (y > 180) { doc.addPage(); y = 16; }
  }
  doc.setFontSize(8);
  doc.text(tr("somente_dados_agregados_e_anonimos"), 14, doc.internal.pageSize.getHeight() - 8);
  baixar(doc.output("blob"), nome);
}
