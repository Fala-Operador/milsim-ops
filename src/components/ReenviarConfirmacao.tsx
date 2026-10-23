// Reenvio do e-mail de confirmação de cadastro (com o próprio CAPTCHA). A resposta não diz se
// a conta existe; só avisa que, se houver cadastro pendente com o e-mail, o link foi enviado.
import { useState } from "react";
import { reenviarConfirmacao } from "@/api/sessao.functions";
import { useTurnstile } from "@/components/Turnstile";
import { Button } from "@/components/ui/button";

export function ReenviarConfirmacao({ email }: { email: string }) {
  const turnstile = useTurnstile("reenviar_confirmacao");
  const [estado, setEstado] = useState<"ocioso" | "enviando" | "enviado">("ocioso");
  const [erro, setErro] = useState("");

  const reenviar = async () => {
    if (!email.trim()) return setErro("Informe o e-mail do cadastro.");
    setErro("");
    setEstado("enviando");
    try {
      await reenviarConfirmacao(email, turnstile.token);
      setEstado("enviado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reenviar agora.");
      setEstado("ocioso");
    } finally {
      turnstile.resetar();
    }
  };

  return (
    <div className="space-y-2">
      {estado === "enviado" ? (
        <p role="status" className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Se houver um cadastro aguardando confirmação com {email}, enviamos um novo link. Confira também a caixa de spam.
        </p>
      ) : (
        <>
          {turnstile.elemento}
          <Button type="button" variant="outline" className="w-full" onClick={reenviar} disabled={estado === "enviando" || !turnstile.pronto}>
            {estado === "enviando" ? "Enviando..." : "Reenviar e-mail de confirmação"}
          </Button>
        </>
      )}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
