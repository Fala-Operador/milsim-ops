import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { carregarBase } from "@/services/db";
import {
  cancelarInscricao,
  retomarPagamento,
  sincronizarPagamento,
} from "@/api/inscricoes.functions";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataBR } from "@/lib/domain/money";
import { Preco } from "@/components/Preco";
import { ROTULO_PAGAMENTO, reservaVigente } from "@/lib/pagamentos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio, Modal } from "@/components/ui";
import { StatusInscricao } from "@/components/StatusInscricao";
import type { Inscricao } from "@/lib/domain/types";
import { IngressoQr } from "@/components/IngressoQr";
import { CreditCard, QrCode, Users } from "lucide-react";
import { tr } from "@/i18n/routes/app.ingressos";
import { localeAtual } from "@/i18n/dicionario";

export const Route = createFileRoute("/app/ingressos")({
  // Retorno do checkout do Stripe: ?pagamento=sucesso&sessao=cs_...
  validateSearch: (
    s: Record<string, unknown>,
  ): { pagamento?: string | undefined; sessao?: string | undefined } => ({
    pagamento: typeof s["pagamento"] === "string" ? s["pagamento"] : undefined,
    sessao: typeof s["sessao"] === "string" ? s["sessao"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: tr("meus_ingressos_milsim_ops") },
      { name: "description", content: tr("ingressos_status_e_historico_de_particip") },
      { property: "og:title", content: tr("meus_ingressos_milsim_ops") },
      { property: "og:description", content: tr("ingressos_e_historico") },
    ],
  }),
  component: MeusIngressos,
});

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" });

type Retorno = { tom: "sucesso" | "aviso" | "perigo"; texto: string };
const AVISO_RETORNO: Record<string, Retorno> = {
  pago: { tom: "sucesso", get texto() { return tr("pagamento_aprovado_seu_ingresso_esta_con"); } },
  processando: {
    tom: "aviso",
    get texto() { return tr("pagamento_enviado_e_em_processamento_avi"); },
  },
  aguardando: {
    tom: "aviso",
    get texto() { return tr("ainda_nao_recebemos_a_confirmacao_do"); },
  },
  estorno_pendente: {
    tom: "perigo",
    get texto() { return tr("o_pagamento_chegou_depois_que_a"); },
  },
  estornado: {
    tom: "perigo",
    get texto() { return tr("o_pagamento_chegou_depois_que_a_2"); },
  },
  expirado: {
    tom: "perigo",
    get texto() { return tr("o_prazo_da_reserva_terminou_antes"); },
  },
  falhou: {
    tom: "perigo",
    get texto() { return tr("o_pagamento_nao_foi_aprovado_faca"); },
  },
  cancelado: { tom: "perigo", get texto() { return tr("esta_reserva_foi_cancelada_antes_do"); } },
};
const COR_AVISO = {
  sucesso: "border-success/40 bg-success/10 text-success",
  aviso: "border-warning/40 bg-warning/10 text-warning",
  perigo: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Confere o pagamento ao voltar do checkout e repete por alguns segundos enquanto o Stripe confirma. */
function useRetornoDoCheckout(sessao: string | undefined, usuarioId: string | undefined) {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<Retorno | null>(null);
  const feito = useRef<string | null>(null);
  // Montagem da página (não do efeito): a conferência segue depois de limpar o endereço.
  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => {
      montada.current = false;
    };
  }, []);
  useEffect(() => {
    if (!sessao || !usuarioId || feito.current === sessao) return;
    feito.current = sessao;
    let tentativas = 0;
    const conferir = async () => {
      try {
        const r = await sincronizarPagamento(sessao);
        if (!montada.current) return;
        setAviso(AVISO_RETORNO[r.situacao] ?? null);
        if (r.situacao === "aguardando" && ++tentativas < 6) setTimeout(conferir, 3000);
      } catch (err) {
        if (montada.current)
          setAviso({
            tom: "perigo",
            texto: err instanceof Error ? err.message : tr("nao_foi_possivel_conferir_o_pagamento"),
          });
      }
    };
    void conferir();
    // Tira os parâmetros do endereço para um recarregamento não repetir a conferência.
    navigate({
      to: "/app/ingressos",
      search: { pagamento: undefined, sessao: undefined },
      replace: true,
    });
  }, [sessao, usuarioId, navigate]);
  return aviso;
}

function MeusIngressos() {
  const { usuario } = useAuth();
  const [, setVersao] = useState(0);
  const [cancelando, setCancelando] = useState<Inscricao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [qrDe, setQrDe] = useState<Inscricao | null>(null);
  const [abrindoPagamento, setAbrindoPagamento] = useState<string | null>(null);
  const [erroPagamento, setErroPagamento] = useState("");
  const { sessao } = Route.useSearch();
  const aviso = useRetornoDoCheckout(sessao, usuario?.id);
  const base = carregarBase();
  if (!usuario) return null;

  const minhas = base.inscricoes
    .filter((i) => i.usuarioId === usuario.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  const concluirPagamento = async (ins: Inscricao) => {
    setErroPagamento("");
    setAbrindoPagamento(ins.id);
    try {
      const r = await retomarPagamento(ins.id);
      if (r.urlPagamento) window.location.assign(r.urlPagamento);
    } catch (err) {
      setErroPagamento(err instanceof Error ? err.message : tr("nao_foi_possivel_abrir_o_pagamento"));
      setAbrindoPagamento(null);
    }
  };

  const cancelarReserva = async (ins: Inscricao) => {
    setErroPagamento("");
    try {
      await cancelarInscricao(ins.id, "Reserva cancelada antes do pagamento");
    } catch (err) {
      setErroPagamento(err instanceof Error ? err.message : tr("falha_ao_cancelar_a_reserva"));
    }
  };

  const aoCancelar = async () => {
    if (!cancelando) return;
    setErro("");
    try {
      await cancelarInscricao(cancelando.id, motivo);
      setCancelando(null);
      setMotivo("");
      setVersao((v) => v + 1);
    } catch (err) {
      setErro(err instanceof Error ? err.message : tr("falha_ao_cancelar"));
    }
  };

  return (
    <div>
      <h1 className="titulo-pagina">{tr("meus_ingressos")}</h1>
      {aviso && (
        <p
          role="status"
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${COR_AVISO[aviso.tom]}`}
        >
          {aviso.texto}
        </p>
      )}
      {erroPagamento && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroPagamento}
        </p>
      )}
      {minhas.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio
            titulo={tr("voce_ainda_nao_possui_ingressos")}
            descricao={tr("inscreva_se_em_uma_operacao_na")}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {minhas.map((ins) => {
            const evento = base.eventos.find((e) => e.id === ins.eventoId);
            const tipo = evento?.tipos.find((t) => t.id === ins.tipoId);
            const lote = evento?.lotes.find((l) => l.id === ins.loteId);
            const exercito = evento?.exercitos.find((e) => e.id === ins.exercitoId);
            const aguardandoPagamento =
              ins.pagamento?.status === "aguardando" && reservaVigente(ins);
            return (
              <div key={ins.id} className={`flex overflow-hidden rounded-lg border border-border/70 bg-card ${ins.status === "cancelada" ? "opacity-60" : ""}`}>
                <div className="relative hidden w-44 shrink-0 sm:block">
                  {evento?.imagemUrl && <img src={evento.imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  {evento && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
                    <p className="font-display text-3xl font-bold leading-none">{formatarDataBR(evento.inicioEm).slice(0, 5)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/75">{evento.cidade}/{evento.uf}</p>
                  </div>}
                </div>
                <div className="min-w-0 flex-1 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold uppercase leading-tight">{evento?.nome ?? tr("evento")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {evento &&
                        `${formatarDataBR(evento.inicioEm)} · ${evento.cidade}/${evento.uf}`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tipo?.nome}
                      {lote ? ` · ${lote.nome}` : ""}{" "}{tr("exercito_nome", { nome: exercito?.nome })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {ins.origem === "cortesia"
                        ? tr("cortesia_por_convite")
                        : ins.descontoCentavos >= ins.valorCentavos && ins.valorCentavos > 0
                          ? tr("inscricao_integralmente_descontada")
                          : <>{tr("valor")}{" "}<Preco centavos={ins.valorCentavos - ins.descontoCentavos} /></>}
                    </p>
                    {ins.pagamento && (
                      <p className="text-sm text-muted-foreground">{tr("pagamento_online_valor", { valor: ROTULO_PAGAMENTO[ins.pagamento.status] })}
                        {aguardandoPagamento &&
                          ` ${tr("vaga_reservada_ate_expiraem", { expiraEm: hora(ins.pagamento.expiraEm) })}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:block sm:shrink-0 sm:border-l sm:border-dashed sm:border-border sm:pl-5 sm:text-right">
                    <StatusInscricao status={ins.status} />
                    <p className="font-mono text-lg font-semibold tracking-wider text-accent sm:mt-2">{ins.codigo}</p>
                    <p className="w-full text-[11px] text-muted-foreground">{tr("codigo_do_ingresso_sem_dados_pessoais")}</p>
                  </div>
                </div>
                {aguardandoPagamento && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => concluirPagamento(ins)}
                      disabled={abrindoPagamento === ins.id}
                    >
                      <CreditCard className="h-4 w-4" />
                      {abrindoPagamento === ins.id ? tr("abrindo_pagamento") : tr("concluir_pagamento")}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => cancelarReserva(ins)}
                    >{tr("cancelar_reserva")}</Button>
                  </div>
                )}
                {ins.status === "confirmada" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button className="w-full sm:w-auto" onClick={() => setQrDe(ins)}>
                      <QrCode className="h-4 w-4" />{tr("abrir_qr_code_de_entrada")}</Button>
                    {evento?.whatsappGrupoUrl && (
                      <a
                        href={evento.whatsappGrupoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:w-auto"
                      >
                        <Users className="h-4 w-4" aria-hidden="true" />{tr("entrar_no_grupo_do_whatsapp")}</a>
                    )}
                    <Button
                      className="w-full text-muted-foreground sm:ml-auto sm:w-auto"
                      variant="ghost"
                      onClick={() => setCancelando(ins)}
                    >{tr("cancelar_inscricao")}</Button>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {qrDe && (
        <IngressoQr
          inscricao={qrDe}
          evento={base.eventos.find((e) => e.id === qrDe.eventoId)}
          usuarioId={usuario.id}
          onFechar={() => setQrDe(null)}
        />
      )}
      <Modal
        aberto={!!cancelando}
        titulo={cancelando?.status === "pendente" ? tr("cancelar_reserva") : tr("cancelar_inscricao")}
        onFechar={() => setCancelando(null)}
      >
        <p className="text-sm text-muted-foreground">{tr("o_cancelamento_invalida_o_ingresso_liber")}{cancelando?.pagamento &&
            ` ${tr("como_o_pagamento_foi_online_o")}`}{" "}{tr("o_historico_e_preservado")}</p>
        <div className="mt-3">
          <Textarea
            placeholder={tr("justificativa_do_cancelamento_obrigatori")}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {erro && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setCancelando(null)}>{tr("voltar")}</Button>
          <Button variant="destructive" onClick={aoCancelar}>{tr("confirmar_cancelamento")}</Button>
        </div>
      </Modal>
    </div>
  );
}
