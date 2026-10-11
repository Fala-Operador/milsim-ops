import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { recuperarSenha } from "@/services/auth";
import { Botao, Campo, Cartao, Entrada } from "@/components/ui";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — MilSim Ops" },
      { name: "description", content: "Recuperação de senha simulada. Nenhum e-mail é enviado." },
      { property: "og:title", content: "Recuperar senha — MilSim Ops" },
      { property: "og:description", content: "Recuperação de senha simulada." },
    ],
  }),
  component: PaginaRecuperar,
});

function PaginaRecuperar() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    try {
      await recuperarSenha(email);
      setEnviado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao processar.");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">Recuperar senha</h1>
        {enviado ? (
          <p className="mt-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            Simulação concluída: em produção, um link de redefinição seria enviado se o e-mail
            existir na base. Nenhum e-mail real foi enviado.
          </p>
        ) : (
          <form onSubmit={aoEnviar} className="mt-4 space-y-4">
            <Campo rotulo="E-mail" htmlFor="email" erro={erro || undefined}>
              <Entrada id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Campo>
            <Botao type="submit" className="w-full">Simular recuperação</Botao>
          </form>
        )}
        <p className="mt-4 text-sm">
          <Link to="/login" className="text-accent hover:underline">Voltar ao login</Link>
        </p>
      </Cartao>
    </div>
  );
}
