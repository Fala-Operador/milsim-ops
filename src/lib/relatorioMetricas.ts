// Monta o relatório de métricas (somente agregados) e o converte em CSV/PDF.
import type { Indicadores, LinhaGrupo } from "@/lib/analytics";

export interface SecaoRelatorio { titulo: string; cabecalho: string[]; linhas: string[][] }
export interface Relatorio { titulo: string; filtros: [string, string][]; secoes: SecaoRelatorio[] }

const n = (v: number) => String(v);
const p = (v: number | null) => (v === null ? "Sem dados" : `${v.toFixed(1).replace(".", ",")}%`);

export function montarRelatorio(a: {
  evento: string; periodo: string; origem: string; ind: Indicadores;
  porOrigem: LinhaGrupo[]; porSecao: LinhaGrupo[]; porEvento: LinhaGrupo[];
  nomeOrigem: (k: string) => string; nomeSecao: (k: string) => string; nomeEvento: (k: string) => string;
  geradoEm: string;
}): Relatorio {
  const i = a.ind;
  const grupo = (titulo: string, rot: string, lista: LinhaGrupo[], nome: (k: string) => string): SecaoRelatorio => ({
    titulo,
    cabecalho: [rot, "Exibições", "Cliques", "CTR", "Visitas", "Visitantes", "Confirmadas", "Conversão"],
    linhas: lista.map((g) => [nome(g.chave), n(g.ind.exibicoes), n(g.ind.cliques), p(g.ind.ctr), n(g.ind.visitas), n(g.ind.visitantes), n(g.ind.confirmadas), p(g.ind.conversao)]),
  });
  return {
    titulo: "Relatório de métricas",
    filtros: [["Evento", a.evento], ["Período", a.periodo], ["Origem ou campanha", a.origem], ["Gerado em", a.geradoEm]],
    secoes: [
      { titulo: "Indicadores", cabecalho: ["Indicador", "Valor"], linhas: [
        ["Exibições dos cards", n(i.exibicoes)], ["Cliques nos cards", n(i.cliques)], ["CTR dos cards", p(i.ctr)],
        ["Visitas", n(i.visitas)], ["Visitantes únicos estimados", n(i.visitantes)], ["Cliques em Inscrever-se", n(i.cliquesInscrever)],
        ["Inscrições iniciadas", n(i.iniciadas)], ["Inscrições confirmadas", n(i.confirmadas)], ["Conversão de visitantes", p(i.conversao)],
        ["Conclusão da inscrição", p(i.conclusao)], ["Fluxos não concluídos", n(i.naoConcluidos)],
        ["Cortesias resgatadas", n(i.cortesias)], ["Inclusões administrativas", n(i.inclusoes)],
      ] },
      grupo("Por origem", "Origem", a.porOrigem, a.nomeOrigem),
      grupo("Por seção da página inicial", "Seção", a.porSecao, a.nomeSecao),
      grupo("Por evento", "Evento", a.porEvento, a.nomeEvento),
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
  doc.text("Somente dados agregados e anônimos.", 14, doc.internal.pageSize.getHeight() - 8);
  baixar(doc.output("blob"), nome);
}
