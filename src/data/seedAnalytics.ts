// Histórico fictício e determinístico de métricas (60 dias), usado pelo seed do banco.
import type { Campanha, OrigemAcesso, RegistroAnalytics } from "@/lib/analytics";
import type { Evento } from "@/lib/domain/types";

function prng(semente: number) {
  let a = semente;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarHistoricoDemo(todosEventos: Evento[], agora = Date.now()): { campanhas: Campanha[]; registros: RegistroAnalytics[] } {
  const rnd = prng(20261012);
  const eventos = todosEventos.filter((e) => e.status === "publicado");
  const camps: Campanha[] = eventos.slice(0, 2).map((e, i) => ({
    id: `cmp-demo-${i + 1}`, eventoId: e.id, nome: i === 0 ? "Instagram da organização" : "Grupo de WhatsApp",
    origem: i === 0 ? "instagram" : "whatsapp", criadoEm: new Date(agora - 40 * 86400000).toISOString(),
  }));
  const regs: RegistroAnalytics[] = [];
  let n = 0;
  const secaoDe = (o: OrigemAcesso) => (o === "destaques" ? "sec-destaques" : o === "regional" ? "sec-sudeste" : undefined);
  function funil(comum: Omit<RegistroAnalytics, "id" | "tipo" | "em">, em: number) {
    if (rnd() > 0.35) return;
    regs.push({ id: `h-${n++}`, tipo: "clique_inscrever", em, ...comum });
    if (rnd() > 0.7) return;
    const fluxoId = `h-${n++}`;
    regs.push({ id: fluxoId, tipo: "inscricao_iniciada", em: em + 500, ...comum });
    if (rnd() < 0.55) regs.push({ id: `h-${n++}`, tipo: "inscricao_confirmada", em: em + 60000, fluxoId, ...comum });
  }
  for (const e of eventos) {
    const peso = 0.5 + rnd();
    for (let d = 60; d >= 0; d--) {
      const diaBase = agora - d * 86400000;
      const exib = Math.round((2 + rnd() * 5) * peso);
      for (let i = 0; i < exib; i++) {
        const origem: OrigemAcesso = rnd() < 0.5 ? "destaques" : rnd() < 0.6 ? "regional" : "busca";
        const vis = `vis-demo-${Math.floor(rnd() * 400)}`;
        const ses = `ses-demo-${n}`;
        const em = diaBase - Math.floor(rnd() * 80000000);
        const comum = { eventoId: e.id, visitanteId: vis, sessaoId: ses, origem, secaoId: secaoDe(origem), posicao: 1 + Math.floor(rnd() * 4) };
        regs.push({ id: `h-${n++}`, tipo: "exibicao", em, ...comum });
        if (rnd() < 0.12) {
          regs.push({ id: `h-${n++}`, tipo: "clique", em: em + 1000, ...comum });
          regs.push({ id: `h-${n++}`, tipo: "visita", em: em + 2000, ...comum });
          funil(comum, em + 3000);
        }
      }
      // Acessos diretos e por campanha (sem clique fictício)
      const diretos = Math.floor(rnd() * 3 * peso);
      for (let i = 0; i < diretos; i++) {
        const cmp = camps.find((c) => c.eventoId === e.id && rnd() < 0.5);
        const comum = { eventoId: e.id, visitanteId: `vis-demo-${Math.floor(rnd() * 400)}`, sessaoId: `ses-demo-${n}`, origem: (cmp ? "campanha" : "direto") as OrigemAcesso, campanhaId: cmp?.id };
        const em = diaBase - Math.floor(rnd() * 80000000);
        regs.push({ id: `h-${n++}`, tipo: "visita", em, ...comum });
        funil(comum, em + 1000);
      }
    }
  }
  if (eventos[0]) {
    regs.push({ id: `h-${n++}`, tipo: "cortesia_resgatada", eventoId: eventos[0].id, visitanteId: "vis-demo-c", sessaoId: "ses-demo-c", origem: "direto", em: agora - 5 * 86400000 });
  }
  return { campanhas: camps, registros: regs };
}
