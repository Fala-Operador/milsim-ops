import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Evento } from "@/lib/domain/types";
import { formatarBRL, formatarDataBR } from "@/lib/domain/money";
import { nomeModalidade } from "@/lib/modalidades";
import { ETAPAS, type Problema } from "@/lib/eventoEditor";
import { tr } from "@/i18n/components/editorEvento/EventReviewStep";

function Bloco({ titulo, etapa, irPara, children }: { titulo: string; etapa: number; irPara: (e: number, campo?: string) => void; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-elevated p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide">{titulo}</h3>
        <Button type="button" variant="ghost" onClick={() => irPara(etapa)} aria-label={tr("editar_titulo", { titulo })}>{tr("editar")}</Button>
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function ListaProblemas({ titulo, itens, tom, irPara }: { titulo: string; itens: Problema[]; tom: "erro" | "aviso"; irPara: (e: number, campo?: string) => void }) {
  if (!itens.length) return null;
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${tom === "erro" ? "border-destructive/50 bg-destructive/10" : "border-warning/50 bg-warning/10"}`}>
      <p className="font-medium">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {itens.map((p, i) => (
          <li key={i}>
            <Button variant="plain" size="none" type="button" className="text-left underline-offset-2 hover:underline focus-visible:underline" onClick={() => irPara(p.etapa, p.campo)}>
              <span className="text-muted-foreground">{ETAPAS[p.etapa]?.titulo}:</span> {p.mensagem}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EtapaRevisao({ ev, erros, avisos, irPara }: { ev: Evento; erros: Problema[]; avisos: Problema[]; irPara: (e: number, campo?: string) => void }) {
  const banner = ev.imagem?.bannerUrl || ev.imagemUrl;
  return (
    <div className="space-y-4">
      <ListaProblemas titulo={tr("corrija_antes_de_publicar")} itens={erros} tom="erro" irPara={irPara} />
      <ListaProblemas titulo={tr("avisos")} itens={avisos} tom="aviso" irPara={irPara} />
      {erros.length === 0 && <p role="status" className="rounded-md border border-success/50 bg-success/10 p-3 text-sm">{tr("tudo_pronto_revise_o_resumo_abaixo")}</p>}

      <Bloco titulo={tr("banner_e_card")} etapa={2} irPara={irPara}>
        {banner ? (
          <div className="grid gap-3 sm:grid-cols-[3fr_2fr]">
            <img src={banner} alt={ev.imagem?.alt ?? ""} className="aspect-[21/9] w-full rounded object-cover" />
            {ev.imagemUrl && <img src={ev.imagemUrl} alt="" className="aspect-video w-full rounded object-cover" />}
          </div>
        ) : <p className="text-muted-foreground">{tr("sem_imagem")}</p>}
      </Bloco>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo={tr("informacoes_gerais")} etapa={0} irPara={irPara}>
          <p className="font-medium">{ev.nome || "—"}</p>
          <p>{tr("modalidade_modalidade", { modalidade: nomeModalidade(ev.modalidade) })}</p>
          <p className="text-muted-foreground">{ev.descricaoResumida || tr("sem_descricao")}</p>
        </Bloco>
        <Bloco titulo={tr("data_e_localizacao")} etapa={1} irPara={irPara}>
          <p>{formatarDataBR(ev.inicioEm)} → {formatarDataBR(ev.fimEm)}</p>
          <p>{ev.local || "—"}</p>
          <p className="text-muted-foreground">{[ev.endereco, ev.cep].filter(Boolean).join(" · ")} {ev.cidade}/{ev.uf}</p>
        </Bloco>
        <Bloco titulo={tr("exercitos_e_capacidade")} etapa={3} irPara={irPara}>
          <p>{tr("capacidade_total_capacidadetotal", { capacidadeTotal: ev.capacidadeTotal })}</p>
          <ul className="text-muted-foreground">{ev.exercitos.map((x) => <li key={x.id}>{x.nome || tr("sem_nome")}{" "}{tr("capacidade_vagas", { capacidade: x.capacidade })}</li>)}</ul>
        </Bloco>
        <Bloco titulo={tr("ingressos_e_lotes")} etapa={4} irPara={irPara}>
          <ul>{ev.tipos.map((t) => <li key={t.id}>{t.nome || tr("sem_nome")}{" "}{tr("base_precobasecentavos_quantidademaxima", { precoBaseCentavos: formatarBRL(t.precoBaseCentavos), quantidadeMaxima: t.quantidadeMaxima })}</li>)}</ul>
          <ul className="text-muted-foreground">{ev.lotes.map((l) => <li key={l.id}>{l.nome} ({l.status}) · {formatarDataBR(l.inicioVendas)} → {formatarDataBR(l.fimVendas)}</li>)}</ul>
          {ev.lotes.length === 0 && <p className="text-warning">{tr("nenhum_lote")}</p>}
        </Bloco>
        <Bloco titulo={tr("cronograma")} etapa={5} irPara={irPara}>
          <ul>{[...ev.cronograma].sort((a, b) => a.ordem - b.ordem).map((a) => <li key={a.id}>{a.data ? formatarDataBR(a.data) : tr("sem_data")}{a.horario ? ` ${tr("as_horario", { horario: a.horario })}` : ""} · {a.titulo || tr("sem_nome")}</li>)}</ul>
          {ev.cronograma.length === 0 && <p className="text-muted-foreground">{tr("sem_atividades")}</p>}
        </Bloco>
        <Bloco titulo={tr("documento_de_regras")} etapa={5} irPara={irPara}>
          {ev.regras ? <p>{tr("titulo_vversao_valor", { titulo: ev.regras.titulo, versao: ev.regras.versao, valor: ev.regras.nomeArquivo ?? ev.regras.formato.toUpperCase() })}</p> : <p className="text-muted-foreground">{tr("sem_caderno_de_regras")}</p>}
        </Bloco>
      </div>
    </div>
  );
}
