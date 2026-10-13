import { useMemo } from "react";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { carregarBase } from "@/services/db";
import { resumoFinanceiro } from "@/services/inscricoes";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge, Botao, Selecao } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { Evento } from "@/lib/domain/types";

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
                    <Badge tom={i.status === "confirmada" ? "sucesso" : "perigo"}>{i.status}</Badge>
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
  ];
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Valores derivados das inscrições, descontos e estornos registrados. Pagamentos não são processados pela plataforma.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-md border border-border bg-elevated p-3">
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className="font-mono text-lg font-semibold">{valor}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-sm font-medium">Movimentações</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {r.movimentacoes.map((m) => (
          <li key={m.id} className="flex justify-between rounded border border-border/50 px-3 py-1.5">
            <span className="text-muted-foreground">{m.descricao}</span>
            <span className={`font-mono ${m.valorCentavos < 0 ? "text-destructive" : "text-success"}`}>
              {formatarBRL(m.valorCentavos)}
            </span>
          </li>
        ))}
        {r.movimentacoes.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</li>
        )}
      </ul>
    </div>
  );
}

/** Evento selecionado compartilhado entre as páginas da organização. */
export function useEventoSelecionado(eventos: Evento[]) {
  return useEventoOrganizacao(eventos);
}
