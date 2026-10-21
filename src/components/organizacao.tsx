import { useMemo } from "react";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { carregarBase } from "@/services/db";
import { disponibilidadeNaBase, resumoFinanceiro } from "@/services/inscricoes";
import { TEXTO_MOTIVO } from "@/lib/vendas";
import { resumoRepasse } from "@/lib/repasses";
import { disputaEmAberto, ROTULO_DISPUTA } from "@/lib/stripe";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { mascararCpf } from "@/lib/domain/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusInscricao } from "@/components/StatusInscricao";
import { useAuth } from "@/contexts/AuthContext";
import { useVersaoBase } from "@/hooks/useVersaoBase";
import type { Evento } from "@/lib/domain/types";
import { Movimentacoes } from "@/components/financeiro/Movimentacoes";
import { linhasDeMovimentacao } from "@/lib/movimentacoes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";

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
      <Label htmlFor="sel-evento" className="text-sm text-muted-foreground font-normal">
        Evento:
      </Label>
      <NativeSelect id="sel-evento" value={valor} onChange={(e) => onChange(e.target.value)} className="min-w-56">
        {eventos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nome || "Sem nome"} — {formatarDataBR(e.inicioEm)}
          </option>
        ))}
      </NativeSelect>
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
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <TableHead className="py-2 pr-3">Participante</TableHead>
              <TableHead className="py-2 pr-3">CPF</TableHead>
              <TableHead className="py-2 pr-3">Tipo</TableHead>
              <TableHead className="py-2 pr-3">Exército</TableHead>
              <TableHead className="py-2 pr-3">Origem</TableHead>
              <TableHead className="py-2">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inscricoes.map((i) => {
              const u = base.usuarios.find((x) => x.id === i.usuarioId);
              return (
                <TableRow key={i.id} className="border-b border-border/50">
                  <TableCell className="py-2 pr-3">{u?.nomeCompleto ?? "Participante"}</TableCell>
                  <TableCell className="py-2 pr-3 font-mono text-xs">{u ? mascararCpf(u.cpf) : "***"}</TableCell>
                  <TableCell className="py-2 pr-3">{evento.tipos.find((t) => t.id === i.tipoId)?.nome}</TableCell>
                  <TableCell className="py-2 pr-3">{evento.exercitos.find((e) => e.id === i.exercitoId)?.nome}</TableCell>
                  <TableCell className="py-2 pr-3">{i.origem}</TableCell>
                  <TableCell className="py-2">
                    <StatusInscricao status={i.status} />
                  </TableCell>
                </TableRow>
              );
            })}
            {inscricoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Nenhuma inscrição neste evento.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Button
        variant="outline"
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
      </Button>
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
    if (rep.taxasComprador > 0) itens.push(["Taxa de serviço paga pelos compradores (fica com a plataforma)", formatarBRL(rep.taxasComprador)]);
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
      {r.disputas.length > 0 && (
        <div role="status" className={`mt-3 rounded-md border px-3 py-2 text-sm ${r.disputas.some((i) => disputaEmAberto(i.pagamento?.disputa)) ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-elevated"}`}>
          <p className="font-medium">{r.disputas.length} pagamento(s) contestado(s) no banco do cartão</p>
          <p className="mt-0.5 text-xs">A resposta à contestação é feita pela plataforma com o Stripe. Guarde comprovantes de participação, como o check-in.</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.disputas.map((i) => (
              <li key={i.id} className="break-words">
                {i.codigo}: {formatarBRL(i.pagamento!.disputa!.valorCentavos)} — {ROTULO_DISPUTA[i.pagamento!.disputa!.status]} (desde {formatarDataBR(i.pagamento!.disputa!.abertaEm)})
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0 rounded-md border border-border bg-elevated p-3">
            <p className="text-xs leading-tight text-muted-foreground">{rotulo}</p>
            <p className="mt-1 break-words font-mono text-base font-semibold sm:text-lg">{valor}</p>
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
        <Button variant="plain" size="none" type="button" onClick={onConfigurar} className="underline underline-offset-2 hover:text-foreground">Configurar lotes</Button>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold uppercase">Disponibilidade dos ingressos</h3>
        <Button variant="outline" onClick={onConfigurar}>Configurar lotes</Button>
      </div>
      <ul className="space-y-1 text-sm">
        {tipos.map(({ t, d }) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2">
            <span>{t.nome}</span>
            {d.disponivel ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                {d.lote.nome} · {formatarBRL(d.precoCentavos)} · {d.restantes} vagas
                <Badge variant="success">disponível</Badge>
              </span>
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                {TEXTO_MOTIVO[d.motivo]}
                {d.motivo === "agendado" && d.inicioVendas ? ` (a partir de ${formatarDataBR(d.inicioVendas)})` : ""}
                <Badge variant="warning">indisponível</Badge>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
