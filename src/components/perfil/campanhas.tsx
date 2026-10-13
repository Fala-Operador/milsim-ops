// Formulário e lista de campanhas de recompensa (administração e organização).
import { useState } from "react";
import { salvarCampanha } from "@/api/gamificacao.functions";
import { descreverBeneficio, statusVoucher } from "@/lib/participacao";
import { formatarDataBR } from "@/lib/domain/money";
import type { BaseDados, CampanhaRecompensa, TipoBeneficio, Usuario } from "@/lib/domain/types";
import { AreaTexto, Badge, Botao, Campo, Entrada, EstadoVazio, Modal, Selecao } from "@/components/ui";

const paraLocal = (iso: string) => iso.slice(0, 16);
const deLocal = (v: string) => (v ? new Date(v).toISOString() : "");

export function FormCampanha({ base, usuario, inicial, organizacaoFixa, onFechar }: {
  base: BaseDados; usuario: Usuario; inicial: CampanhaRecompensa | null; organizacaoFixa?: string | undefined; onFechar: () => void;
}) {
  const hoje = new Date();
  const em = (d: number) => new Date(hoje.getTime() + d * 864e5).toISOString();
  const [c, setC] = useState({
    nome: inicial?.nome ?? "", descricao: inicial?.descricao ?? "", insigniaId: inicial?.insigniaId ?? base.insignias[0]?.id ?? "",
    organizacaoId: inicial?.organizacaoId ?? organizacaoFixa ?? base.organizacoes[0]?.id ?? "",
    tipo: inicial?.tipo ?? ("percentual" as TipoBeneficio), valor: inicial?.valor ?? 10,
    eventosElegiveis: inicial?.eventosElegiveis ?? [], tiposElegiveis: inicial?.tiposElegiveis ?? [],
    maximo: inicial?.maximo ?? 50, limitePorParticipante: inicial?.limitePorParticipante ?? 1,
    inicioEm: inicial?.inicioEm ?? hoje.toISOString(), conquistarAte: inicial?.conquistarAte ?? em(90), resgatarAte: inicial?.resgatarAte ?? em(180),
    regras: inicial?.regras ?? "Válido para um ingresso. Não acumula com cupom. Não reserva vaga.",
    aceitaAnteriores: inicial?.aceitaAnteriores ?? false, ativa: inicial?.ativa ?? true, autorizacao: inicial?.autorizacao ?? "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const eventos = base.eventos.filter((e) => e.organizacaoId === c.organizacaoId && ["publicado", "inscricoes_encerradas"].includes(e.status));
  const tipos = base.eventos.filter((e) => c.eventosElegiveis.includes(e.id)).flatMap((e) => e.tipos.map((t) => ({ ...t, evento: e.nome })));
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const precisaAutorizacao = usuario.perfil === "admin" && usuario.organizacaoId !== c.organizacaoId;

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await salvarCampanha({ ...c, id: inicial?.id, valor: c.tipo === "fixo" ? Math.round(c.valor) : c.valor, autorizacao: c.autorizacao || undefined });
      onFechar();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setSalvando(false); }
  };

  return (
    <Modal aberto largo titulo={inicial ? `Editar campanha (versão ${inicial.versao})` : "Nova campanha de recompensa"} onFechar={onFechar}>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo rotulo="Nome" htmlFor="cp-nome"><Entrada id="cp-nome" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} /></Campo>
        <Campo rotulo="Conquista necessária" htmlFor="cp-ins">
          <Selecao id="cp-ins" value={c.insigniaId} onChange={(e) => setC({ ...c, insigniaId: e.target.value })}>
            {base.insignias.map((i) => <option key={i.id} value={i.id}>{i.icone} {i.nome}</option>)}
          </Selecao>
        </Campo>
        <div className="md:col-span-2"><Campo rotulo="Descrição" htmlFor="cp-desc"><AreaTexto id="cp-desc" rows={2} value={c.descricao} onChange={(e) => setC({ ...c, descricao: e.target.value })} /></Campo></div>
        <Campo rotulo="Organização responsável pelo benefício" htmlFor="cp-org">
          <Selecao id="cp-org" value={c.organizacaoId} disabled={!!organizacaoFixa} onChange={(e) => setC({ ...c, organizacaoId: e.target.value, eventosElegiveis: [], tiposElegiveis: [] })}>
            {base.organizacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Benefício" htmlFor="cp-tipo">
            <Selecao id="cp-tipo" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as TipoBeneficio })}>
              <option value="percentual">Desconto %</option><option value="fixo">Desconto fixo</option><option value="gratuito">Ingresso gratuito</option>
            </Selecao>
          </Campo>
          {c.tipo !== "gratuito" && (
            <Campo rotulo={c.tipo === "percentual" ? "Percentual" : "Valor (R$)"} htmlFor="cp-valor">
              <Entrada id="cp-valor" type="number" min={1} value={c.tipo === "fixo" ? c.valor / 100 : c.valor}
                onChange={(e) => setC({ ...c, valor: c.tipo === "fixo" ? Math.round(Number(e.target.value) * 100) : Number(e.target.value) })} />
            </Campo>
          )}
        </div>
        {precisaAutorizacao && (
          <div className="md:col-span-2">
            <Campo rotulo="Referência da oferta autorizada pela organização (obrigatória)" htmlFor="cp-aut">
              <Entrada id="cp-aut" value={c.autorizacao} onChange={(e) => setC({ ...c, autorizacao: e.target.value })} placeholder="Ex.: e-mail de 10/10 de Ana (Bravo) autorizando 50 vouchers" />
            </Campo>
            <p className="mt-1 text-xs text-muted-foreground">A administração não pode criar obrigação para uma organização sem oferta autorizada. A referência fica na auditoria.</p>
          </div>
        )}
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">Eventos elegíveis</legend>
          {eventos.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum evento aberto desta organização.</p> : (
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {eventos.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.eventosElegiveis.includes(e.id)} onChange={() => setC({ ...c, eventosElegiveis: alternar(c.eventosElegiveis, e.id) })} /> {e.nome}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {tipos.length > 0 && (
          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium">Tipos de ingresso elegíveis <span className="font-normal text-muted-foreground">(nenhum marcado = todos)</span></legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {tipos.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.tiposElegiveis.includes(t.id)} onChange={() => setC({ ...c, tiposElegiveis: alternar(c.tiposElegiveis, t.id) })} /> {t.nome} <span className="text-xs text-muted-foreground">({t.evento})</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Campo rotulo="Quantidade máxima de benefícios" htmlFor="cp-max"><Entrada id="cp-max" type="number" min={1} value={c.maximo} onChange={(e) => setC({ ...c, maximo: Number(e.target.value) })} /></Campo>
        <Campo rotulo="Limite por participante" htmlFor="cp-lim"><Entrada id="cp-lim" type="number" min={1} max={10} value={c.limitePorParticipante} onChange={(e) => setC({ ...c, limitePorParticipante: Number(e.target.value) })} /></Campo>
        <Campo rotulo="Início da campanha" htmlFor="cp-ini"><Entrada id="cp-ini" type="datetime-local" value={paraLocal(c.inicioEm)} onChange={(e) => setC({ ...c, inicioEm: deLocal(e.target.value) })} /></Campo>
        <Campo rotulo="Prazo para conquistar" htmlFor="cp-conq"><Entrada id="cp-conq" type="datetime-local" value={paraLocal(c.conquistarAte)} onChange={(e) => setC({ ...c, conquistarAte: deLocal(e.target.value) })} /></Campo>
        <Campo rotulo="Prazo para resgatar" htmlFor="cp-resg"><Entrada id="cp-resg" type="datetime-local" value={paraLocal(c.resgatarAte)} onChange={(e) => setC({ ...c, resgatarAte: deLocal(e.target.value) })} /></Campo>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.aceitaAnteriores} onChange={(e) => setC({ ...c, aceitaAnteriores: e.target.checked })} /> Aceita conquistas anteriores ao início</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={c.ativa} onChange={(e) => setC({ ...c, ativa: e.target.checked })} /> Campanha ativa</label>
        </div>
        <div className="md:col-span-2"><Campo rotulo="Regras de uso" htmlFor="cp-regras"><AreaTexto id="cp-regras" rows={2} value={c.regras} onChange={(e) => setC({ ...c, regras: e.target.value })} /></Campo></div>
      </div>
      {inicial && <p className="mt-2 text-xs text-muted-foreground">Benefícios já emitidos mantêm as condições da época; a edição vale para os próximos.</p>}
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="contorno" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar campanha"}</Botao>
      </div>
    </Modal>
  );
}

export function ListaCampanhas({ base, campanhas, onEditar }: { base: BaseDados; campanhas: CampanhaRecompensa[]; onEditar: (c: CampanhaRecompensa) => void }) {
  if (!campanhas.length) return <EstadoVazio titulo="Nenhuma campanha" />;
  return (
    <ul className="space-y-2">
      {campanhas.map((c) => {
        const vs = base.vouchers.filter((v) => v.campanhaId === c.id);
        const usados = vs.filter((v) => v.status === "utilizada").length;
        const disp = vs.filter((v) => statusVoucher(v) === "disponivel").length;
        const ins = base.insignias.find((i) => i.id === c.insigniaId);
        return (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{c.nome} <Badge tom={c.ativa ? "sucesso" : "padrao"}>{c.ativa ? "Ativa" : "Inativa"}</Badge> <span className="text-xs text-muted-foreground">v{c.versao}</span></p>
              <p className="text-xs text-muted-foreground">
                {descreverBeneficio(c)} · conquista: {ins ? `${ins.icone} ${ins.nome}` : "—"} · {base.organizacoes.find((o) => o.id === c.organizacaoId)?.nome}
              </p>
              <p className="text-xs text-muted-foreground">Emitidos {vs.length}/{c.maximo} · disponíveis {disp} · utilizados {usados} · resgate até {formatarDataBR(c.resgatarAte)}{c.aceitaAnteriores ? " · aceita conquistas anteriores" : ""}</p>
            </div>
            <Botao variante="contorno" className="px-3 py-1 text-xs" onClick={() => onEditar(c)}>Editar</Botao>
          </li>
        );
      })}
    </ul>
  );
}
