import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePreferencias } from "@/contexts/PreferenciasContext";
import { useLocalizacao } from "@/contexts/LocalizacaoContext";
import { MODALIDADES, nomeModalidade, type ModalidadeId } from "@/lib/modalidades";
import { Toggle } from "@/components/ui/toggle";

/** Opções selecionáveis: estado marcado indicado por ícone + texto, não só cor. */
export function OpcoesModalidade({ selecionadas, onAlternar, nome = "mod" }: { selecionadas: ModalidadeId[]; onAlternar: (id: ModalidadeId) => void; nome?: string }) {
  return (
    <div role="group" aria-label="Modalidades" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {MODALIDADES.map((m) => {
        const ativo = selecionadas.includes(m.id);
        return (
          <Toggle key={m.id} id={`${nome}-${m.id}`} pressed={ativo} onPressedChange={() => onAlternar(m.id)}
            className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=off]:border-border data-[state=off]:bg-background data-[state=off]:text-muted-foreground data-[state=off]:hover:border-accent data-[state=off]:hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground">
            <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${ativo ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {ativo && <Check className="h-3.5 w-3.5" />}
            </span>
            {m.nome}
            {ativo && <span className="sr-only">(selecionada)</span>}
          </Toggle>
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

  // Não abre por cima de outra janela nem durante a solicitação de localização.
  useEffect(() => {
    if (!p.convitePendente) return;
    const t = setTimeout(() => setOutroModal(!!document.querySelector('[aria-modal="true"]:not([data-pref])')), 600);
    return () => clearTimeout(t);
  }, [p.convitePendente, caminho]);

  const convite = p.convitePendente && caminho === "/" && status !== "obtendo" && !outroModal;
  const aberto = p.editorAberto || convite;

  useEffect(() => {
    if (aberto) setSel(p.preferencia.modalidades);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  if (!p.montado) return null;
  if (p.ofertaAparelho && caminho === "/") {
    return (
      <div role="status" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-xl">
        <p className="font-medium">Usar as modalidades salvas neste aparelho na sua conta?</p>
        <p className="mt-1 text-muted-foreground">
          {p.ofertaAparelho.estado === "todas" ? "Explorar todas" : p.ofertaAparelho.modalidades.map(nomeModalidade).join(", ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={p.aceitarAparelho}>Usar na conta</Button>
          <Button variant="secondary" onClick={p.recusarAparelho}>Não, obrigado</Button>
        </div>
      </div>
    );
  }
  // Esc e clique fora equivalem a "Agora não"; o foco inicial vai para a primeira modalidade.
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && p.agoraNao()}>
      <DialogContent data-pref showCloseButton={false}
        className="bottom-0 top-auto block max-h-[85vh] w-full max-w-none translate-y-0 overflow-y-auto rounded-t-xl p-5 sm:bottom-auto sm:top-[50%] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-lg">
        <DialogTitle className="text-xl uppercase">Que tipo de operação você curte?</DialogTitle>
        <DialogDescription className="mt-1">Escolha suas modalidades favoritas para encontrar primeiro os eventos que combinam com você.</DialogDescription>
        <div className="mt-4"><OpcoesModalidade selecionadas={sel} onAlternar={alternar} nome="pref-modal" /></div>
        <p className="mt-3 text-xs text-muted-foreground">
          {p.daConta ? "Salvo na sua conta." : "Salvo neste aparelho — não é necessário criar conta."}
        </p>
        <div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-2 bg-popover pb-[env(safe-area-inset-bottom)] pt-2 sm:flex sm:flex-wrap sm:pb-0">
          <Button className="col-span-2" disabled={!sel.length} onClick={() => p.salvar(sel)}>Salvar preferências</Button>
          <Button variant="secondary" onClick={p.explorarTodas}>Explorar todas</Button>
          <Button variant="outline" onClick={p.agoraNao}>Agora não</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
