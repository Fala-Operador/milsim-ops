// Apresentação estática da plataforma na página inicial. Não depende de dados nem de login:
// sai no HTML do servidor, para visitantes e para a verificação do login com o Google.
import { Link } from "@tanstack/react-router";
import { CalendarCheck, QrCode, ShieldCheck, Ticket } from "lucide-react";

const RECURSOS = [
  { icone: CalendarCheck, titulo: "Encontre operações", texto: "Agenda pública de eventos de airsoft e milsim em todo o Brasil, com busca por cidade, data e modalidade." },
  { icone: Ticket, titulo: "Inscreva-se e pague", texto: "Inscrição do operador e do squad, com ingresso pago pelo Stripe (cartão ou Pix) quando o evento cobra." },
  { icone: QrCode, titulo: "Check-in no campo", texto: "Ingresso com QR code para o check-in no dia, mais comunidade e avisos de cada evento." },
  { icone: ShieldCheck, titulo: "Para organizações", texto: "Ferramentas para criar eventos, vender lotes, controlar inscritos e receber os valores das vendas." },
];

export function SobrePlataforma() {
  return (
    <section id="sobre" aria-labelledby="t-sobre" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="rotulo-tecnico">Sobre a plataforma</p>
        <h2 id="t-sobre" className="mt-1 font-display text-2xl font-semibold uppercase tracking-wide">O que é o MilSim Ops</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          O MilSim Ops é uma plataforma de divulgação e gestão de eventos de airsoft e simulação militar (milsim), operada pela
          Fala Operador. Jogadores encontram operações e se inscrevem; organizações publicam eventos, vendem ingressos e fazem o
          check-in dos participantes. Qualquer pessoa pode ver a agenda sem criar conta.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo} className="rounded-lg border border-border p-4">
              <Icone className="h-5 w-5 text-accent" aria-hidden />
              <h3 className="mt-2 font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
          Para se inscrever, você cria uma conta com e-mail e senha ou entra com a sua conta Google. Com o Google, o MilSim Ops
          recebe apenas o seu nome, e-mail e foto de perfil, usados só para criar e identificar a sua conta. Veja os detalhes no{" "}
          <Link to="/privacidade" className="text-accent underline underline-offset-2">Aviso de privacidade</Link> e nos{" "}
          <Link to="/termos" className="text-accent underline underline-offset-2">Termos de uso</Link>.
        </p>
      </div>
    </section>
  );
}
