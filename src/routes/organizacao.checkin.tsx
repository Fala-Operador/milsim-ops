import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, CloudOff, CloudUpload, Download, HelpCircle, Keyboard, QrCode, RefreshCw,
  Search, ShieldCheck, Undo2, UserCheck, Users, Wifi, WifiOff, XCircle, Clock, Trophy,
} from "lucide-react";
import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { useEventosOrg } from "@/components/organizacao";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { CheckinProvider, useCheckin } from "@/contexts/CheckinContext";
import { LeitorQr } from "@/components/LeitorQr";
import { carregarBase } from "@/services/db";
import { premioDoExercito } from "@/lib/missoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EstadoVazio, Modal } from "@/components/ui";
import {
  ROTULO_ORIGEM_ENTRADA, ROTULO_SYNC, entradaAtiva, lerConteudoQr,
  type IngressoCredenciamento, type RegistroCheckin, type ResultadoValidacao,
} from "@/lib/checkin";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import { ResumoFichaEmergencia } from "@/components/perfil/FichaEmergencia";
import { tr } from "@/i18n/routes/organizacao.checkin";
import { localeAtual } from "@/i18n/dicionario";

export const Route = createFileRoute("/organizacao/checkin")({
  head: () => ({
    meta: [
      { title: tr("check_in_e_credenciamento_milsim_ops") },
      { name: "description", content: tr("credenciamento_na_portaria_leitura_de_qr") },
      { property: "og:title", content: tr("check_in_e_credenciamento_milsim_ops") },
      { property: "og:description", content: tr("portaria_do_evento_com_leitura_de") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaCheckin,
});

const hora = (iso: string) => new Date(iso).toLocaleTimeString(localeAtual(), { hour: "2-digit", minute: "2-digit" });
const dataHora = (iso: string) => new Date(iso).toLocaleString(localeAtual(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function PaginaCheckin() {
  const { eventos } = useEventosOrg();
  const ordenados = useMemo(() => [...eventos].sort((a, b) => b.inicioEm.localeCompare(a.inicioEm)), [eventos]);
  const [eventoId, selecionar, invalido] = useEventoOrganizacao(ordenados);
  const evento = ordenados.find((e) => e.id === eventoId);
  if (eventos.length === 0) return <EstadoVazio titulo={tr("nenhum_evento_para_credenciar")} descricao={tr("crie_um_evento_no_painel")} />;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="titulo-pagina">{tr("check_in_e_credenciamento")}</h2>
        <p className="subtitulo-pagina">{tr("confirme_a_presenca_na_portaria_inscrica")}</p>
      </div>
      <OperacaoSelecionada eventos={ordenados} evento={evento} invalido={invalido} onSelecionar={selecionar} />
      {/* key: trocar de evento desmonta tudo — desliga a câmera e limpa a leitura anterior */}
      {evento && <CheckinProvider key={evento.id} eventoId={evento.id}><Portaria /></CheckinProvider>}
    </div>
  );
}

type Modo = "nenhum" | "busca" | "codigo";

function Portaria() {
  const ck = useCheckin();
  const [modo, setModo] = useState<Modo>("nenhum");
  const [leitorAberto, setLeitorAberto] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [registradoOffline, setRegistradoOffline] = useState(false);
  const [conferir, setConferir] = useState<{ ingresso: IngressoCredenciamento; origem: "codigo" | "manual" } | null>(null);
  const [desfazer, setDesfazer] = useState<RegistroCheckin | null>(null);

  const ingressos = ck.fonte?.ingressos ?? [];
  const registros = ck.fonte?.registros ?? [];
  const ativos = ingressos.filter((i) => i.status === "confirmada");
  const presentes = ativos.filter((i) => entradaAtiva(registros, i.inscricaoId)).length;
  const semBase = !ck.online && !ck.fonte?.snapshot;

  const trocarModo = (m: Modo) => { setModo(m); setResultado(null); setConferir(null); };

  const aoLerQr = async (texto: string) => {
    const token = lerConteudoQr(texto);
    const r = token ? ck.validar({ token }) : { tipo: "nao_encontrado" as const };
    if (!r) return;
    if (r.tipo === "valido") {
      const final = await ck.confirmar(r.ingresso.inscricaoId, "qr");
      setRegistradoOffline(!ck.online);
      setResultado(final);
    } else { setRegistradoOffline(false); setResultado(r); }
  };

  return (
    <>
      {/* Estado da conexão e preparação: uma faixa só */}
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm md:flex-row md:divide-x md:divide-y-0">
        <div className="flex flex-1 items-center gap-3 p-3">
          <span className={`h-2 w-2 shrink-0 rounded-full ${ck.online ? "bg-success" : "bg-warning"}`} aria-hidden />
          <span className="font-semibold" role="status">{ck.online ? tr("conectado") : ck.redeReal ? tr("sem_conexao_simulado") : tr("sem_conexao")}</span>
          <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Label className="flex items-center gap-1.5 text-[length:inherit] font-normal text-inherit"><Checkbox checked={ck.simularOffline} onCheckedChange={(m) => ck.setSimularOffline(m === true)} />{tr("simular_sem_rede")}</Label>
            <Label className="flex items-center gap-1.5 text-[length:inherit] font-normal text-inherit"><Checkbox checked={ck.simularFalha} onCheckedChange={(m) => ck.setSimularFalha(m === true)} />{tr("simular_falha")}</Label>
          </span>
        </div>
        <div className="flex flex-1 items-center gap-3 p-3">
          {ck.fonte?.snapshot ? <ShieldCheck className="h-4 w-4 shrink-0 text-success" /> : <CloudOff className="h-4 w-4 shrink-0 text-warning" />}
          <span className="min-w-0">
            <span className="font-semibold">{ck.fonte?.snapshot ? tr("pronto_para_offline") : tr("offline_nao_preparado")}</span>
            <span className="block text-xs text-muted-foreground">{ck.fonte?.snapshot ? tr("base_de_atualizadoem", { atualizadoEm: dataHora(ck.fonte.snapshot.atualizadoEm) }) : tr("baixe_a_base_antes_de_ir")}{ck.estadoSW !== "ativo" && ` ${tr("service_worker_indisponivel")}`}</span>
          </span>
        </div>
      </div>

      {ck.aviso && <p role="status" className="rounded-md border border-border bg-secondary px-4 py-3 text-sm">{ck.aviso}</p>}
      {!ck.online && (
        <div role="alert" className="flex gap-3 rounded-md border border-warning/60 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p>{tr("modo_offline_validando_contra_a_base")}{" "}<strong>{tr("um_aparelho_por_evento")}</strong>{" "}{tr("no_modo_totalmente_offline_nao_ha")}</p>
        </div>
      )}

      {/* Indicadores */}
      <FaixaIndicadores className="lg:grid-cols-4" itens={[
        { rotulo: tr("inscritos_ativos"), valor: String(ativos.length) },
        { rotulo: tr("presencas"), valor: String(presentes), detalhe: ativos.length ? tr("valor_credenciados", { valor: Math.round((presentes / ativos.length) * 100) }) : undefined },
        { rotulo: tr("faltam_credenciar"), valor: String(ativos.length - presentes) },
        { rotulo: tr("na_fila_offline"), valor: String(ck.pendentes), detalhe: ck.pendentes ? tr("sincroniza_ao_voltar_a_conexao") : tr("tudo_sincronizado") },
      ]} />

      {/* Ações principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:first-child]:col-span-2 [&>*:first-child]:min-h-32 [&>*:first-child]:!border-primary [&>*:first-child]:!bg-primary [&>*:first-child]:text-xl [&>*:first-child]:!text-primary-foreground">
        <BotaoGrande ativo={leitorAberto} onClick={() => { setResultado(null); setLeitorAberto(true); }} disabled={semBase}><QrCode className="h-7 w-7" />{tr("ler_qr_code")}</BotaoGrande>
        <BotaoGrande ativo={modo === "busca"} onClick={() => trocarModo("busca")} disabled={semBase}><Search className="h-7 w-7" />{tr("buscar_participante")}</BotaoGrande>
        <BotaoGrande ativo={modo === "codigo"} onClick={() => trocarModo("codigo")} disabled={semBase}><Keyboard className="h-7 w-7" />{tr("digitar_codigo")}</BotaoGrande>
        <BotaoGrande onClick={ck.preparar} disabled={ck.ocupado || !ck.online}><Download className="h-7 w-7" />{ck.fonte?.snapshot ? tr("atualizar_base_offline") : tr("preparar_para_uso_offline")}</BotaoGrande>
        {ck.pendentes > 0 && <BotaoGrande onClick={ck.sincronizarAgora} disabled={!ck.online}><RefreshCw className="h-7 w-7" />{tr("sincronizar_agora")}</BotaoGrande>}
      </div>
      {semBase && <p role="alert" className="text-sm text-warning">{tr("sem_conexao_e_sem_base_baixada")}</p>}

      {/* Leitura de QR Code em modal: a câmera liga só quando aberto e desliga ao fechar */}
      <Modal aberto={leitorAberto} titulo={tr("ler_qr_code_do_participante")} onFechar={() => setLeitorAberto(false)}>
        <div className="space-y-4">
          <LeitorQr pausado={!!resultado || ck.ocupado} onLeitura={aoLerQr} onErro={() => {}} />
          {resultado && <CartaoResultado r={resultado} offline={registradoOffline} />}
          {resultado && <Button className="h-14 w-full" onClick={() => setResultado(null)}><QrCode className="h-5 w-5" />{tr("proxima_leitura")}</Button>}
          {!resultado && <p className="text-center text-sm text-muted-foreground">{tr("aponte_a_camera_para_o_qr")}</p>}
        </div>
      </Modal>
      {modo === "busca" && !conferir && <BuscaManual ingressos={ingressos} registros={registros} onEscolher={(i) => { setResultado(null); setConferir({ ingresso: i, origem: "manual" }); }} />}
      {modo === "codigo" && !conferir && (
        <DigitarCodigo onBuscar={(codigo) => {
          const r = ck.validar({ codigo });
          if (r && "ingresso" in r) { setResultado(r.tipo === "valido" ? null : r); if (r.tipo === "valido") setConferir({ ingresso: r.ingresso, origem: "codigo" }); }
          else setResultado(r);
        }} />
      )}
      {(modo === "busca" || modo === "codigo") && resultado && !conferir && <CartaoResultado r={resultado} offline={registradoOffline} />}
      {conferir && (
        <ConferenciaManual
          ingresso={conferir.ingresso}
          validacao={ck.validar({ inscricaoId: conferir.ingresso.inscricaoId })}
          ocupado={ck.ocupado}
          onCancelar={() => setConferir(null)}
          onConfirmar={async (motivo) => {
            const r = await ck.confirmar(conferir.ingresso.inscricaoId, conferir.origem, motivo);
            setRegistradoOffline(!ck.online);
            setResultado(r);
            setConferir(null);
          }}
        />
      )}

      <EntradasRecentes registros={registros} ingressos={ingressos} onDesfazer={setDesfazer} />
      {desfazer && <ModalDesfazer registro={desfazer} onFechar={() => setDesfazer(null)} />}
    </>
  );
}

function Indicador({ icone: Icone, rotulo, valor }: { icone: typeof Users; rotulo: string; valor: number }) {
  return (
    <Card>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icone className="h-4 w-4" />{rotulo}</p>
      <p className="mt-1 font-display text-3xl font-bold">{valor}</p>
    </Card>
  );
}

const GRANDE = "flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Com `ativo`, alterna um modo (Toggle); sem ele, é uma ação comum (Button).
function BotaoGrande({ ativo, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  if (ativo === undefined) {
    return (
      <Button variant="plain" size="none" {...p}
        className={`${GRANDE} border-border bg-card transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50`}
      >{children}</Button>
    );
  }
  return (
    <Toggle
      {...p}
      pressed={ativo}
      className={`${GRANDE} data-[state=off]:border-border data-[state=off]:bg-card data-[state=off]:hover:border-primary data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground`}
    >{children}</Toggle>
  );
}

const VISUAL: Record<ResultadoValidacao["tipo"], { icone: typeof CheckCircle2; titulo: string; classe: string }> = {
  valido: { icone: CheckCircle2, get titulo() { return tr("entrada_confirmada"); }, classe: "border-success bg-success/15" },
  ja_realizado: { icone: AlertTriangle, get titulo() { return tr("check_in_ja_realizado"); }, classe: "border-warning bg-warning/15" },
  cancelado: { icone: Ban, get titulo() { return tr("ingresso_cancelado_ou_estornado"); }, classe: "border-destructive bg-destructive/15" },
  outro_evento: { icone: XCircle, get titulo() { return tr("ingresso_de_outro_evento"); }, classe: "border-destructive bg-destructive/15" },
  nao_encontrado: { icone: HelpCircle, get titulo() { return tr("codigo_nao_encontrado"); }, classe: "border-destructive bg-destructive/15" },
};

/** Prêmio das missões pré-evento do exército da pessoa (depois de encerrada a campanha). */
function PremioDoExercito({ ingresso }: { ingresso: IngressoCredenciamento }) {
  const base = carregarBase();
  const exercitoId = base.inscricoes.find((i) => i.id === ingresso.inscricaoId)?.exercitoId;
  const r = premioDoExercito(base.campanhasMissoes.find((c) => c.eventoId === ingresso.eventoId), exercitoId);
  if (!r?.premio) return null;
  return (
    <p className="mt-2 flex items-center gap-2 rounded-md bg-background/60 px-3 py-2 text-base font-semibold">
      <Trophy className="size-5 shrink-0" aria-hidden="true" />{tr("colocacao_nas_missoes_pre_evento_premio", { colocacao: r.colocacao, premio: r.premio })}
    </p>
  );
}

function CartaoResultado({ r, offline }: { r: ResultadoValidacao; offline: boolean }) {
  const v = VISUAL[r.tipo];
  return (
    <div role="alert" className={`rounded-lg border-2 p-5 ${v.classe}`}>
      <p className="flex items-center gap-3 font-display text-2xl font-bold uppercase"><v.icone className="h-9 w-9 shrink-0" />{v.titulo}</p>
      {"ingresso" in r && (
        <p className="mt-2 text-base"><strong>{r.ingresso.nome}</strong> · {r.ingresso.tipo} · {r.ingresso.exercito} · <span className="font-mono">{r.ingresso.codigo}</span></p>
      )}
      {r.tipo === "ja_realizado" && <p className="mt-1 text-base">{tr("entrada_registrada_as")}{" "}<strong>{hora(r.em)}</strong> ({dataHora(r.em)}).</p>}
      {r.tipo === "valido" && offline && <p className="mt-2 font-semibold">{tr("entrada_registrada_neste_aparelho_sincro")}</p>}
      {(r.tipo === "valido" || r.tipo === "ja_realizado") && <PremioDoExercito ingresso={r.ingresso} />}
      {(r.tipo === "valido" || r.tipo === "ja_realizado") && r.ingresso.emergencia && (
        <div className="mt-3"><ResumoFichaEmergencia ficha={r.ingresso.emergencia} compacto /></div>
      )}
    </div>
  );
}

function BuscaManual({ ingressos, registros, onEscolher }: {
  ingressos: IngressoCredenciamento[]; registros: RegistroCheckin[]; onEscolher: (i: IngressoCredenciamento) => void;
}) {
  const [q, setQ] = useState("");
  const termo = q.trim().toLowerCase();
  const lista = termo.length < 2 ? [] : ingressos.filter((i) => i.nome.toLowerCase().includes(termo) || i.codigo.toLowerCase().includes(termo)).slice(0, 20);
  return (
    <Card className="space-y-3">
      <Label className="block text-sm font-medium text-inherit" htmlFor="busca-ck">{tr("buscar_por_nome_ou_codigo_da")}</Label>
      <Input id="busca-ck" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("digite_ao_menos_2_letras")}
        className="h-14 w-full rounded-md border border-input bg-background px-4 text-lg focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 py-0 sm:text-lg" />
      <ul className="divide-y divide-border">
        {lista.map((i) => {
          const ativa = entradaAtiva(registros, i.inscricaoId);
          return (
            <li key={i.inscricaoId}>
              <Button variant="plain" size="none" onClick={() => onEscolher(i)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-secondary">
                <span className="min-w-0"><span className="block truncate font-medium">{i.nome}</span><span className="block font-mono text-xs text-muted-foreground">{i.codigo} · {i.tipo}</span></span>
                {i.status !== "confirmada" ? <Badge variant="destructive">{tr("cancelada")}</Badge> : ativa ? <Badge variant="success">{tr("presente_em", { em: hora(ativa.em) })}</Badge> : <Badge>{tr("aguardando")}</Badge>}
              </Button>
            </li>
          );
        })}
        {termo.length >= 2 && lista.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">{tr("nenhum_participante_encontrado_neste_eve")}</li>}
      </ul>
    </Card>
  );
}

function DigitarCodigo({ onBuscar }: { onBuscar: (c: string) => void }) {
  const [c, setC] = useState("");
  return (
    <Card>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (c.trim()) onBuscar(c); }}>
        <Label className="flex-1 text-sm font-medium text-inherit">{tr("codigo_do_ingresso")}<Input autoFocus value={c} onChange={(e) => setC(e.target.value.toUpperCase())} placeholder="OP-XXXXX" autoCapitalize="characters"
            className="mt-1 h-14 w-full rounded-md border border-input bg-background px-4 font-mono text-lg uppercase focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40 py-0 sm:text-lg" />
        </Label>
        <Button type="submit" className="h-14">{tr("conferir")}</Button>
      </form>
    </Card>
  );
}

function ConferenciaManual({ ingresso, validacao, ocupado, onCancelar, onConfirmar }: {
  ingresso: IngressoCredenciamento; validacao: ResultadoValidacao | null; ocupado: boolean; onCancelar: () => void; onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const valido = validacao?.tipo === "valido";
  return (
    <Card className="space-y-3 border-2 border-primary">
      <h3 className="font-display text-lg font-semibold uppercase">{tr("conferencia_antes_do_check_in_manual")}</h3>
      <dl className="grid gap-1 text-base sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">{tr("participante")}</dt><dd className="font-semibold">{ingresso.nome}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{tr("codigo")}</dt><dd className="font-mono">{ingresso.codigo}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{tr("ingresso")}</dt><dd>{ingresso.tipo}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{tr("exercito")}</dt><dd>{ingresso.exercito}</dd></div>
      </dl>
      <PremioDoExercito ingresso={ingresso} />
      {ingresso.emergencia && <ResumoFichaEmergencia ficha={ingresso.emergencia} compacto />}
      {validacao && !valido ? <CartaoResultado r={validacao} offline={false} /> : (
        <>
          <Textarea placeholder={tr("motivo_do_check_in_manual_obrigatorio")} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label={tr("motivo_do_check_in_manual")} />
          <Label className="flex items-center gap-2 text-sm font-normal text-inherit"><Checkbox className="h-5 w-5" checked={ciente} onCheckedChange={(marcado) => setCiente(marcado === true)} />{" "}{tr("conferi_o_participante_e_o_ingresso")}</Label>
        </>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="h-12" onClick={onCancelar}>{tr("voltar")}</Button>
        {valido && <Button className="h-12" disabled={!ciente || !motivo.trim() || ocupado} onClick={() => onConfirmar(motivo)}><UserCheck className="h-5 w-5" />{tr("confirmar_entrada")}</Button>}
      </div>
    </Card>
  );
}

function EntradasRecentes({ registros, ingressos, onDesfazer }: {
  registros: RegistroCheckin[]; ingressos: IngressoCredenciamento[]; onDesfazer: (r: RegistroCheckin) => void;
}) {
  const nome = (id: string) => ingressos.find((i) => i.inscricaoId === id)?.nome ?? tr("participante");
  const revertidos = new Set(registros.filter((r) => r.tipo === "reversao").map((r) => r.revertidoId));
  const lista = registros.slice(0, 30);
  return (
    <Card>
      <h3 className="border-b border-border px-4 py-3 font-display text-lg font-semibold uppercase">{tr("entradas_recentes")}</h3>
      {lista.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{tr("nenhuma_entrada_registrada_ainda")}</p> : (
        <ul className="divide-y divide-border">
          {lista.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{r.tipo === "reversao" ? <span className="inline-flex items-center gap-1"><Undo2 className="h-4 w-4" />{tr("check_in_desfeito")}{" "}</span> : null}{nome(r.inscricaoId)}</p>
                <p className="text-xs text-muted-foreground">
                  {dataHora(r.em)} · {r.tipo === "reversao" ? tr("motivo_motivo", { motivo: r.motivo }) : ROTULO_ORIGEM_ENTRADA[r.origem]}{r.tipo === "entrada" && r.motivo ? ` · ${r.motivo}` : ""} · {r.operadorNome} · {r.dispositivoId}
                </p>
                {r.conflito && <p className="text-xs font-medium text-destructive">⚠ {r.conflito}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.sync === "sincronizado" ? "success" : r.sync === "conflito" ? "destructive" : "warning"}>
                  {r.sync === "sincronizado" ? "✓ " : r.sync === "conflito" ? "⚠ " : "⏳ "}{ROTULO_SYNC[r.sync]}
                </Badge>
                {r.tipo === "entrada" && r.sync !== "conflito" && !revertidos.has(r.id) && (
                  <Button variant="ghost" className="" onClick={() => onDesfazer(r)}><Undo2 className="h-4 w-4" />{tr("desfazer")}</Button>
                )}
                {revertidos.has(r.id) && <Badge>{tr("revertido")}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ModalDesfazer({ registro, onFechar }: { registro: RegistroCheckin; onFechar: () => void }) {
  const ck = useCheckin();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo={tr("desfazer_check_in")} onFechar={onFechar}>
      <p className="text-sm text-muted-foreground">{tr("o_registro_original_e_preservado_e")}</p>
      <div className="mt-3"><Textarea placeholder={tr("justificativa_obrigatoria")} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label={tr("justificativa")} /></div>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onFechar}>{tr("voltar")}</Button>
        <Button variant="destructive" disabled={!motivo.trim()} onClick={async () => {
          try { await ck.desfazer(registro, motivo); onFechar(); } catch (e) { setErro(e instanceof Error ? e.message : tr("falha")); }
        }}>{tr("desfazer_check_in")}</Button>
      </div>
    </Modal>
  );
}
