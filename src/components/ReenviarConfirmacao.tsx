// Reenvio do e-mail de confirmação de cadastro (com o próprio CAPTCHA). A resposta não diz se
// a conta existe; só avisa que, se houver cadastro pendente com o e-mail, o link foi enviado.
import { useState } from "react";
import { reenviarConfirmacao } from "@/api/sessao.functions";
import { useTurnstile } from "@/components/Turnstile";
import { Button } from "@/components/ui/button";
import { tr } from "@/i18n/components/ReenviarConfirmacao";

export function ReenviarConfirmacao({ email }: { email: string }) {
  const turnstile = useTurnstile("reenviar_confirmacao");
  const [estado, setEstado] = useState<"ocioso" | "enviando" | "enviado">("ocioso");
  const [erro, setErro] = useState("");

  const reenviar = async () => {
    if (!email.trim()) return setErro(tr("informe_o_e_mail_do_cadastro"));
    setErro("");
    setEstado("enviando");
    try {
      await reenviarConfirmacao(email, turnstile.token);
      setEstado("enviado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : tr("nao_foi_possivel_reenviar_agora"));
      setEstado("ocioso");
    } finally {
      turnstile.resetar();
    }
  };

  return (
    <div className="space-y-2">
      {estado === "enviado" ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {tr("se_houver_um_cadastro_aguardando_confirm", { email })}</p>
      ) : (
        <>
          {turnstile.elemento}
          <Button type="button" variant="outline" className="w-full" onClick={reenviar} disabled={estado === "enviando" || !turnstile.pronto}>
            {estado === "enviando" ? tr("enviando") : tr("reenviar_e_mail_de_confirmacao")}
          </Button>
        </>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
