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

/** Título e finalidade do topo da página inicial; também sai no HTML do servidor antes da carga. */
export function ChamadaPlataforma() {
  return (
    <>
      <p className="rotulo-tecnico">MilSim Ops · plataforma de eventos de airsoft e milsim</p>
      <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold uppercase leading-[0.95] text-foreground sm:text-6xl">
        Operações de airsoft e milsim pelo Brasil
      </h1>
      <p className="mt-3 max-w-xl text-base text-muted-foreground">
        O MilSim Ops é uma plataforma pública para encontrar eventos de airsoft e milsim, fazer a inscrição, pagar o ingresso
        e fazer o check-in. Você vê a agenda sem criar conta; o login só é pedido para se inscrever.{" "}
        <a href="#sobre" className="text-accent underline-offset-2 hover:underline">Saiba mais</a>
        {" · "}
        <Link to="/privacidade" className="text-accent underline-offset-2 hover:underline">Aviso de privacidade</Link>
      </p>
    </>
  );
}

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
