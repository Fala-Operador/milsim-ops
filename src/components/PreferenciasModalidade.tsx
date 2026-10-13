import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Botao } from "@/components/ui";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { useLocalizacao } from "@/contexts/LocalizacaoContext";
import { MODALIDADES, nomeModalidade, type ModalidadeId } from "@/lib/modalidades";

/** Opções selecionáveis: estado marcado indicado por ícone + texto, não só cor. */
export function OpcoesModalidade({ selecionadas, onAlternar, nome = "mod" }: { selecionadas: ModalidadeId[]; onAlternar: (id: ModalidadeId) => void; nome?: string }) {
  return (
    <div role="group" aria-label="Modalidades" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MODALIDADES.map((m) => {
        const ativo = selecionadas.includes(m.id);
        return (
          <button key={m.id} type="button" id={`${nome}-${m.id}`} aria-pressed={ativo} onClick={() => onAlternar(m.id)}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${ativo ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background text-muted-foreground hover:border-accent hover:text-foreground"}`}>
            <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {ativo && <Check className="h-3.5 w-3.5" />}
            </span>
            {m.nome}
            {ativo && <span className="sr-only">(selecionada)</span>}
          </button>
        );
      })}
    </div>
  );
}

export function useSelecaoModalidades(inicial: ModalidadeId[]) {
  const [sel, setSel] = useState<ModalidadeId[]>(inicial);
  const alternar = (id: ModalidadeId) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return { sel, setSel, alternar };
}

/** Convite de primeiro acesso e editor de preferências (janela central; painel inferior no celular). */
export function PreferenciasModal() {
  const p = usePreferencias();
  const { status } = useLocalizacao();
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const [outroModal, setOutroModal] = useState(false);
  const { sel, setSel, alternar } = useSelecaoModalidades([]);
  const caixa = useRef<HTMLDivElement>(null);

  // Não abre por cima de outra janela nem durante a solicitação de localização.
  useEffect(() => {
    if (!p.convitePendente) return;
    const t = setTimeout(() => setOutroModal(!!document.querySelector('[aria-modal="true"]:not([data-pref])')), 600);
    return () => clearTimeout(t);
  }, [p.convitePendente, caminho]);

  const convite = p.convitePendente && caminho === "/" && status !== "obtendo" && !outroModal;
  const aberto = p.editorAberto || convite;

  useEffect(() => {
    if (aberto) { setSel(p.preferencia.modalidades); setTimeout(() => caixa.current?.querySelector("button")?.focus(), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") p.agoraNao(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, p]);

  if (!p.montado) return null;
  if (p.ofertaAparelho && caminho === "/") {
    return (
      <div role="status" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-xl">
        <p className="font-medium">Usar as modalidades salvas neste aparelho na sua conta?</p>
        <p className="mt-1 text-muted-foreground">
          {p.ofertaAparelho.estado === "todas" ? "Explorar todas" : p.ofertaAparelho.modalidades.map(nomeModalidade).join(", ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao onClick={p.aceitarAparelho}>Usar na conta</Botao>
          <Botao variante="secundario" onClick={p.recusarAparelho}>Não, obrigado</Botao>
        </div>
      </div>
    );
  }
  if (!aberto) return null;

  return (
    <div data-pref className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pref-titulo" onClick={p.agoraNao}>
      <div ref={caixa} onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl border border-border bg-popover p-5 text-popover-foreground shadow-xl sm:max-w-lg sm:rounded-lg">
        <h2 id="pref-titulo" className="font-display text-xl font-semibold uppercase">Que tipo de operação você curte?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Escolha suas modalidades favoritas para encontrar primeiro os eventos que combinam com você.</p>
        <div className="mt-4"><OpcoesModalidade selecionadas={sel} onAlternar={alternar} nome="pref-modal" /></div>
        <p className="mt-3 text-xs text-muted-foreground">
          {p.daConta ? "Salvo na sua conta." : "Salvo neste aparelho — não é necessário criar conta."}
        </p>
        <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 bg-popover pt-2">
          <Botao disabled={!sel.length} onClick={() => p.salvar(sel)}>Salvar preferências</Botao>
          <Botao variante="secundario" onClick={p.explorarTodas}>Explorar todas</Botao>
          <Botao variante="fantasma" onClick={p.agoraNao}>Agora não</Botao>
        </div>
      </div>
    </div>
  );
}
