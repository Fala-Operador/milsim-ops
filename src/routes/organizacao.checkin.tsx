import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, CloudOff, CloudUpload, Download, HelpCircle, Keyboard, QrCode, RefreshCw,
  Search, ShieldCheck, Undo2, UserCheck, Users, Wifi, WifiOff, XCircle, Clock,
} from "lucide-react";
import { OperacaoSelecionada } from "@/components/OperacaoSelecionada";
import { useEventosOrg } from "@/components/organizacao";
import { useEventoOrganizacao } from "@/contexts/OrganizationEventContext";
import { CheckinProvider, useCheckin } from "@/contexts/CheckinContext";
import { LeitorQr } from "@/components/LeitorQr";
import { AreaTexto, Badge, Botao, Cartao, EstadoVazio, Modal } from "@/components/ui";
import {
  ROTULO_ORIGEM_ENTRADA, ROTULO_SYNC, entradaAtiva, lerConteudoQr,
  type IngressoCredenciamento, type RegistroCheckin, type ResultadoValidacao,
} from "@/lib/checkin";

export const Route = createFileRoute("/organizacao/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in e credenciamento — MilSim Ops" },
      { name: "description", content: "Credenciamento na portaria: leitura de QR Code, busca manual, modo offline e sincronização." },
      { property: "og:title", content: "Check-in e credenciamento — MilSim Ops" },
      { property: "og:description", content: "Portaria do evento com leitura de QR Code e modo offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaCheckin,
});

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function PaginaCheckin() {
  const { eventos } = useEventosOrg();
  const ordenados = useMemo(() => [...eventos].sort((a, b) => b.inicioEm.localeCompare(a.inicioEm)), [eventos]);
  const [eventoId, selecionar, invalido] = useEventoOrganizacao(ordenados);
  const evento = ordenados.find((e) => e.id === eventoId);
  if (eventos.length === 0) return <EstadoVazio titulo="Nenhum evento para credenciar" descricao="Crie um evento no Painel." />;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold uppercase">Check-in e credenciamento</h2>
        <p className="text-sm text-muted-foreground">Confirme a presença na portaria. Inscrição confirmada e check-in realizado são coisas diferentes.</p>
      </div>
      <OperacaoSelecionada eventos={ordenados} evento={evento} invalido={invalido} onSelecionar={selecionar} />
      {/* key: trocar de evento desmonta tudo — desliga a câmera e limpa a leitura anterior */}
      {evento && <CheckinProvider key={evento.id} eventoId={evento.id}><Portaria /></CheckinProvider>}
    </div>
  );
}

type Modo = "nenhum" | "qr" | "busca" | "codigo";

function Portaria() {
  const ck = useCheckin();
  const [modo, setModo] = useState<Modo>("nenhum");
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
      {/* Estado da conexão e preparação */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-2 text-base font-semibold ${ck.online ? "text-success" : "text-warning"}`} role="status">
              {ck.online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              {ck.online ? "Conectado" : ck.redeReal ? "Sem conexão (simulado)" : "Sem conexão"}
            </span>
            <Badge tom="destaque">Sincronização demonstrativa</Badge>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={ck.simularOffline} onChange={(e) => ck.setSimularOffline(e.target.checked)} /> Simular perda de conexão</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={ck.simularFalha} onChange={(e) => ck.setSimularFalha(e.target.checked)} /> Simular falha de sincronização</label>
          </div>
          <p className="text-xs text-muted-foreground">Sem servidor real: a sincronização envia os registros a uma base de referência simulada neste navegador. Aparelhos diferentes não compartilham dados.</p>
        </Cartao>
        <Cartao className="space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            {ck.fonte?.snapshot ? <ShieldCheck className="h-5 w-5 text-success" /> : <CloudOff className="h-5 w-5 text-warning" />}
            {ck.fonte?.snapshot ? "Aparelho pronto para uso offline" : "Aparelho ainda não preparado para offline"}
          </p>
          {ck.fonte?.snapshot ? (
            <p className="text-sm text-muted-foreground">Última atualização: {dataHora(ck.fonte.snapshot.atualizadoEm)} · {ck.fonte.snapshot.ingressos.filter((i) => i.status === "confirmada").length} ingressos disponíveis para validação</p>
          ) : <p className="text-sm text-muted-foreground">Prepare antes de ir para um local sem internet.</p>}
          <p className="text-xs text-muted-foreground">
            Arquivos da aplicação: {ck.estadoSW === "ativo" ? "Service Worker ativo" : ck.estadoSW === "registrando" ? "verificando…" : "Service Worker indisponível neste navegador/prévia — reabrir sem internet não funcionará aqui"}
            {!ck.idb && " · IndexedDB indisponível"}
          </p>
        </Cartao>
      </div>

      {ck.aviso && <p role="status" className="rounded-md border border-border bg-secondary px-4 py-3 text-sm">{ck.aviso}</p>}
      {!ck.online && (
        <div role="alert" className="flex gap-3 rounded-md border border-warning/60 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p>Modo offline: validando contra a base baixada. Inscrições, cancelamentos e entradas em outros aparelhos posteriores à última atualização podem ainda não ser conhecidos. Recomendamos <strong>um aparelho por evento</strong> no modo totalmente offline — não há bloqueio de duplicidade entre aparelhos desconectados.</p>
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icone={Users} rotulo="Inscritos ativos" valor={ativos.length} />
        <Indicador icone={UserCheck} rotulo="Presenças confirmadas" valor={presentes} />
        <Indicador icone={Clock} rotulo="Ainda não credenciados" valor={ativos.length - presentes} />
        <Indicador icone={CloudUpload} rotulo="Pendentes de sincronização" valor={ck.pendentes} />
      </div>

      {/* Ações principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <BotaoGrande ativo={modo === "qr"} onClick={() => trocarModo(modo === "qr" ? "nenhum" : "qr")} disabled={semBase}><QrCode className="h-7 w-7" />Ler QR Code</BotaoGrande>
        <BotaoGrande ativo={modo === "busca"} onClick={() => trocarModo("busca")} disabled={semBase}><Search className="h-7 w-7" />Buscar participante</BotaoGrande>
        <BotaoGrande ativo={modo === "codigo"} onClick={() => trocarModo("codigo")} disabled={semBase}><Keyboard className="h-7 w-7" />Digitar código</BotaoGrande>
        <BotaoGrande onClick={ck.preparar} disabled={ck.ocupado || !ck.online}><Download className="h-7 w-7" />{ck.fonte?.snapshot ? "Atualizar base offline" : "Preparar para uso offline"}</BotaoGrande>
        {ck.pendentes > 0 && <BotaoGrande onClick={ck.sincronizarAgora} disabled={!ck.online}><RefreshCw className="h-7 w-7" />Sincronizar agora</BotaoGrande>}
      </div>
      {semBase && <p role="alert" className="text-sm text-warning">Sem conexão e sem base baixada para este evento: não é possível validar ingressos neste aparelho.</p>}

      {modo === "qr" && (
        <Cartao className="space-y-4">
          <LeitorQr pausado={!!resultado || ck.ocupado} onLeitura={aoLerQr} onErro={() => {}} />
          {resultado && <CartaoResultado r={resultado} offline={registradoOffline} />}
          {resultado && <Botao className="h-14 w-full text-base" onClick={() => setResultado(null)}><QrCode className="h-5 w-5" />Próxima leitura</Botao>}
          {!resultado && <p className="text-center text-sm text-muted-foreground">Aponte a câmera para o QR Code do participante.</p>}
        </Cartao>
      )}
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
    <Cartao className="p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icone className="h-4 w-4" />{rotulo}</p>
      <p className="mt-1 font-display text-3xl font-bold">{valor}</p>
    </Cartao>
  );
}

function BotaoGrande({ ativo, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }) {
  return (
    <button
      {...p}
      aria-pressed={ativo}
      className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 p-3 text-center text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}
    >{children}</button>
  );
}

const VISUAL: Record<ResultadoValidacao["tipo"], { icone: typeof CheckCircle2; titulo: string; classe: string }> = {
  valido: { icone: CheckCircle2, titulo: "Entrada confirmada", classe: "border-success bg-success/15" },
  ja_realizado: { icone: AlertTriangle, titulo: "Check-in já realizado", classe: "border-warning bg-warning/15" },
  cancelado: { icone: Ban, titulo: "Ingresso cancelado ou estornado", classe: "border-destructive bg-destructive/15" },
  outro_evento: { icone: XCircle, titulo: "Ingresso de outro evento", classe: "border-destructive bg-destructive/15" },
  nao_encontrado: { icone: HelpCircle, titulo: "Código não encontrado", classe: "border-destructive bg-destructive/15" },
};

function CartaoResultado({ r, offline }: { r: ResultadoValidacao; offline: boolean }) {
  const v = VISUAL[r.tipo];
  return (
    <div role="alert" className={`rounded-lg border-2 p-5 ${v.classe}`}>
      <p className="flex items-center gap-3 font-display text-2xl font-bold uppercase"><v.icone className="h-9 w-9 shrink-0" />{v.titulo}</p>
      {"ingresso" in r && (
        <p className="mt-2 text-base"><strong>{r.ingresso.nome}</strong> · {r.ingresso.tipo} · {r.ingresso.exercito} · <span className="font-mono">{r.ingresso.codigo}</span></p>
      )}
      {r.tipo === "ja_realizado" && <p className="mt-1 text-base">Entrada registrada às <strong>{hora(r.em)}</strong> ({dataHora(r.em)}).</p>}
      {r.tipo === "valido" && offline && <p className="mt-2 font-semibold">Entrada registrada neste aparelho — sincronização pendente.</p>}
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
    <Cartao className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="busca-ck">Buscar por nome ou código da inscrição</label>
      <input id="busca-ck" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite ao menos 2 letras"
        className="h-14 w-full rounded-md border border-input bg-background px-4 text-lg focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40" />
      <ul className="divide-y divide-border">
        {lista.map((i) => {
          const ativa = entradaAtiva(registros, i.inscricaoId);
          return (
            <li key={i.inscricaoId}>
              <button onClick={() => onEscolher(i)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-secondary">
                <span className="min-w-0"><span className="block truncate font-medium">{i.nome}</span><span className="block font-mono text-xs text-muted-foreground">{i.codigo} · {i.tipo}</span></span>
                {i.status !== "confirmada" ? <Badge tom="perigo">✕ Cancelada</Badge> : ativa ? <Badge tom="sucesso">✓ Presente {hora(ativa.em)}</Badge> : <Badge>Aguardando</Badge>}
              </button>
            </li>
          );
        })}
        {termo.length >= 2 && lista.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Nenhum participante encontrado neste evento.</li>}
      </ul>
    </Cartao>
  );
}

function DigitarCodigo({ onBuscar }: { onBuscar: (c: string) => void }) {
  const [c, setC] = useState("");
  return (
    <Cartao>
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); if (c.trim()) onBuscar(c); }}>
        <label className="flex-1 text-sm font-medium">Código do ingresso
          <input autoFocus value={c} onChange={(e) => setC(e.target.value.toUpperCase())} placeholder="OP-XXXXX" autoCapitalize="characters"
            className="mt-1 h-14 w-full rounded-md border border-input bg-background px-4 font-mono text-lg uppercase focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40" />
        </label>
        <Botao type="submit" className="h-14 text-base">Conferir</Botao>
      </form>
    </Cartao>
  );
}

function ConferenciaManual({ ingresso, validacao, ocupado, onCancelar, onConfirmar }: {
  ingresso: IngressoCredenciamento; validacao: ResultadoValidacao | null; ocupado: boolean; onCancelar: () => void; onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const valido = validacao?.tipo === "valido";
  return (
    <Cartao className="space-y-3 border-2 border-primary">
      <h3 className="font-display text-lg font-semibold uppercase">Conferência antes do check-in manual</h3>
      <dl className="grid gap-1 text-base sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Participante</dt><dd className="font-semibold">{ingresso.nome}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Código</dt><dd className="font-mono">{ingresso.codigo}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Ingresso</dt><dd>{ingresso.tipo}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Exército</dt><dd>{ingresso.exercito}</dd></div>
      </dl>
      {validacao && !valido ? <CartaoResultado r={validacao} offline={false} /> : (
        <>
          <AreaTexto placeholder="Motivo do check-in manual (obrigatório) — ex.: celular sem bateria" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do check-in manual" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={ciente} onChange={(e) => setCiente(e.target.checked)} /> Conferi o participante e o ingresso</label>
        </>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Botao variante="contorno" className="h-12" onClick={onCancelar}>Voltar</Botao>
        {valido && <Botao className="h-12 text-base" disabled={!ciente || !motivo.trim() || ocupado} onClick={() => onConfirmar(motivo)}><UserCheck className="h-5 w-5" />Confirmar entrada</Botao>}
      </div>
    </Cartao>
  );
}

function EntradasRecentes({ registros, ingressos, onDesfazer }: {
  registros: RegistroCheckin[]; ingressos: IngressoCredenciamento[]; onDesfazer: (r: RegistroCheckin) => void;
}) {
  const nome = (id: string) => ingressos.find((i) => i.inscricaoId === id)?.nome ?? "Participante";
  const revertidos = new Set(registros.filter((r) => r.tipo === "reversao").map((r) => r.revertidoId));
  const lista = registros.slice(0, 30);
  return (
    <Cartao className="p-0">
      <h3 className="border-b border-border px-4 py-3 font-display text-lg font-semibold uppercase">Entradas recentes</h3>
      {lista.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma entrada registrada ainda.</p> : (
        <ul className="divide-y divide-border">
          {lista.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{r.tipo === "reversao" ? <span className="inline-flex items-center gap-1"><Undo2 className="h-4 w-4" />Check-in desfeito · </span> : null}{nome(r.inscricaoId)}</p>
                <p className="text-xs text-muted-foreground">
                  {dataHora(r.em)} · {r.tipo === "reversao" ? `Motivo: ${r.motivo}` : ROTULO_ORIGEM_ENTRADA[r.origem]}{r.tipo === "entrada" && r.motivo ? ` · ${r.motivo}` : ""} · {r.operadorNome} · {r.dispositivoId}
                </p>
                {r.conflito && <p className="text-xs font-medium text-destructive">⚠ {r.conflito}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tom={r.sync === "sincronizado" ? "sucesso" : r.sync === "conflito" ? "perigo" : "aviso"}>
                  {r.sync === "sincronizado" ? "✓ " : r.sync === "conflito" ? "⚠ " : "⏳ "}{ROTULO_SYNC[r.sync]}
                </Badge>
                {r.tipo === "entrada" && r.sync !== "conflito" && !revertidos.has(r.id) && (
                  <Botao variante="fantasma" className="px-2 py-1" onClick={() => onDesfazer(r)}><Undo2 className="h-4 w-4" />Desfazer</Botao>
                )}
                {revertidos.has(r.id) && <Badge>Revertido</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

function ModalDesfazer({ registro, onFechar }: { registro: RegistroCheckin; onFechar: () => void }) {
  const ck = useCheckin();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  return (
    <Modal aberto titulo="Desfazer check-in" onFechar={onFechar}>
      <p className="text-sm text-muted-foreground">O registro original é preservado e uma reversão é adicionada ao histórico.</p>
      <div className="mt-3"><AreaTexto placeholder="Justificativa (obrigatória)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Justificativa" /></div>
      {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="fantasma" onClick={onFechar}>Voltar</Botao>
        <Botao variante="perigo" disabled={!motivo.trim()} onClick={async () => {
          try { await ck.desfazer(registro, motivo); onFechar(); } catch (e) { setErro(e instanceof Error ? e.message : "Falha."); }
        }}>Desfazer check-in</Botao>
      </div>
    </Modal>
  );
}
