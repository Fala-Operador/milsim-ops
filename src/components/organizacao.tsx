import { useMemo } from "react";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { carregarBase } from "@/services/db";
import { disponibilidadeNaBase, resumoFinanceiro } from "@/services/inscricoes";
import { TEXTO_MOTIVO } from "@/lib/vendas";
import { resumoRepasse } from "@/lib/repasses";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge, Botao, Selecao } from "@/components/ui";
import { StatusInscricao } from "@/components/StatusInscricao";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { Evento } from "@/lib/domain/types";
import { Movimentacoes } from "@/components/financeiro/Movimentacoes";
import { linhasDeMovimentacao } from "@/lib/movimentacoes";

/** Eventos visíveis para o organizador logado (admin vê todos). */
export function useEventosOrg() {
  const { usuario } = useAuth();
  const versao = useVersaoBase();
  return useMemo(() => {
    const base = carregarBase();
    const orgId = usuario && usuario.perfil !== "admin" ? usuario.organizacaoId : undefined;
    const eventos = base.eventos.filter((e) => !orgId || e.organizacaoId === orgId);
    return { base, eventos, orgId };
  }, [usuario, versao]);
}

/** Seletor de evento usado nas páginas Inscritos, Comunidade e Financeiro. */
export function SeletorEvento({
  eventos,
  valor,
  onChange,
}: {
  eventos: Evento[];
  valor: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="sel-evento" className="text-sm text-muted-foreground">
        Evento:
      </label>
      <Selecao id="sel-evento" value={valor} onChange={(e) => onChange(e.target.value)} className="min-w-56">
        {eventos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome || "Sem nome"} — {formatarDataBR(e.inicioEm)}
          </option>
        ))}
      </Selecao>
    </div>
  );
}

export function TabelaInscritos({ eventoId }: { eventoId: string }) {
  const base = carregarBase();
  const evento = base.eventos.find((e) => e.id === eventoId)!;
  const inscricoes = base.inscricoes.filter((i) => i.eventoId === eventoId);
  const confirmadas = inscricoes.filter((i) => i.status === "confirmada").length;
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {confirmadas} confirmadas de {inscricoes.length} inscrições · capacidade {evento.capacidadeTotal}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-3">Participante</th>
              <th className="py-2 pr-3">CPF</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Exército</th>
              <th className="py-2 pr-3">Origem</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {inscricoes.map((i) => {
              const u = base.usuarios.find((x) => x.id === i.usuarioId);
              return (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{u?.nomeCompleto ?? "Participante"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{u ? mascararCpf(u.cpf) : "***"}</td>
                  <td className="py-2 pr-3">{evento.tipos.find((t) => t.id === i.tipoId)?.nome}</td>
                  <td className="py-2 pr-3">{evento.exercitos.find((e) => e.id === i.exercitoId)?.nome}</td>
                  <td className="py-2 pr-3">{i.origem}</td>
                  <td className="py-2">
                    <StatusInscricao status={i.status} />
                  </td>
                </tr>
              );
            })}
            {inscricoes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nenhuma inscrição neste evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Botao
        variante="contorno"
        className="mt-3"
        onClick={() => {
          const linhas = inscricoes.map((i) => {
            const u = base.usuarios.find((x) => x.id === i.usuarioId);
            return [u?.nomeCompleto ?? "Participante", i.codigo, i.status, i.origem].join(";");
          });
          const csv = "nome;codigo;status;origem\n" + linhas.join("\n");
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = "inscritos.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Exportar relatório (CSV)
      </Botao>
    </div>
  );
}

export function Financeiro({ eventoId }: { eventoId: string }) {
  const r = resumoFinanceiro(eventoId);
  const itens: Array<[string, string]> = [
    ["Inscritos ativos", String(r.inscritosAtivos)],
    ["Valor bruto", formatarBRL(r.bruto)],
    ["Descontos concedidos", formatarBRL(r.descontos)],
    ["Ajustes", formatarBRL(r.ajustes)],
    ["Estornos", formatarBRL(r.estornos)],
    ["Total líquido", formatarBRL(r.liquido)],
    ["Cortesias emitidas / resgatadas", `${r.cortesiasEmitidas} / ${r.cortesiasResgatadas}`],
    ["Cupons utilizados", String(r.cuponsUtilizados)],
    ["Integralmente descontadas", String(r.integralmenteDescontadas)],
    ["Reservas aguardando pagamento", String(r.reservasAguardando)],
  ];
  // Vendas pagas online: quanto foi cobrado, a taxa retida e para onde foi o dinheiro.
  const rep = resumoRepasse(carregarBase(), eventoId);
  if (rep.cobrado > 0) {
    itens.push(
      ["Pago online (Stripe)", formatarBRL(rep.cobrado)],
      ["Taxa da plataforma", formatarBRL(rep.taxas)],
      ["Repassado à organização", formatarBRL(rep.repassado)],
    );
    if (rep.naPlataforma > 0) itens.push(["Com a plataforma (repasse à parte)", formatarBRL(rep.naPlataforma)]);
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Valores derivados das inscrições confirmadas, descontos e estornos registrados. Pagamentos online são
        processados pelo Stripe; reservas aguardando pagamento ainda não entram nos valores.
      </p>
      {r.reembolsosPendentes.length > 0 && (
        <div role="status" className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <p className="font-medium">{r.reembolsosPendentes.length} reembolso(s) em andamento no Stripe</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.reembolsosPendentes.map((i) => (
              <li key={i.id} className="break-words">
                {i.codigo}: {i.pagamento?.erro ? `falha — ${i.pagamento.erro} (nova tentativa automática)` : "aguardando confirmação do Stripe"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-md border border-border bg-elevated p-3">
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className="font-mono text-lg font-semibold">{valor}</p>
          </div>
        ))}
      </div>
      {/* key: trocar de evento recomeça abas e filtros */}
      <Movimentacoes
        key={eventoId}
        linhas={linhasDeMovimentacao(r.movimentacoes, carregarBase().inscricoes.filter((i) => i.eventoId === eventoId))}
      />
    </div>
  );
}

/** Evento selecionado compartilhado entre as páginas da organização. */
export function useEventoSelecionado(eventos: Evento[]) {
  return useEventoOrganizacao(eventos);
}

/**
 * Tipos de ingresso com e sem venda aberta. Mostra o motivo de cada bloqueio e
 * o atalho para configurar os lotes do evento correto.
 */
export function AvisoLotes({ evento, compacto = false, onConfigurar }: { evento: Evento; compacto?: boolean; onConfigurar: () => void }) {
  const base = carregarBase();
  const tipos = evento.tipos.filter((t) => !t.arquivado).map((t) => ({ t, d: disponibilidadeNaBase(base, evento, t.id) }));
  const bloqueados = tipos.filter((x) => !x.d.disponivel);
  if (compacto) {
    if (bloqueados.length === 0) return null;
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-warning">
        {bloqueados.length === tipos.length ? "Inscrições indisponíveis" : `${bloqueados.length} ingresso(s) sem venda aberta`}
        <button type="button" onClick={onConfigurar} className="underline underline-offset-2 hover:text-foreground">Configurar lotes</button>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold uppercase">Disponibilidade dos ingressos</h3>
        <Botao variante="contorno" onClick={onConfigurar}>Configurar lotes</Botao>
      </div>
      <ul className="space-y-1 text-sm">
        {tipos.map(({ t, d }) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
            <span>{t.nome}</span>
            {d.disponivel ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                {d.lote.nome} · {formatarBRL(d.precoCentavos)} · {d.restantes} vagas
                <Badge tom="sucesso">disponível</Badge>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                {TEXTO_MOTIVO[d.motivo]}
                {d.motivo === "agendado" && d.inicioVendas ? ` (a partir de ${formatarDataBR(d.inicioVendas)})` : ""}
                <Badge tom="aviso">indisponível</Badge>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
