import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatarDataBR } from "@/lib/domain/money";
import { mascararCpf, mascararTelefone } from "@/lib/domain/validators";
import { Cartao, Selecao, Campo } from "@/components/ui";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — MilSim Ops" },
      { name: "description", content: "Seus dados de perfil e preferências." },
      { property: "og:title", content: "Perfil — MilSim Ops" },
      { property: "og:description", content: "Perfil e preferências." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { usuario } = useAuth();
  const { preferencia, definirPreferencia } = useTheme();
  if (!usuario) return null;
  const [a, m, d] = usuario.dataNascimento.split("-");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold uppercase">Perfil</h1>
      <Cartao>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Nome</dt><dd>{usuario.nomeCompleto}</dd></div>
          <div><dt className="text-muted-foreground">E-mail</dt><dd>{usuario.email}</dd></div>
          <div><dt className="text-muted-foreground">CPF</dt><dd>{mascararCpf(usuario.cpf)}</dd></div>
          <div><dt className="text-muted-foreground">Nascimento</dt><dd>{`${d}/${m}/${a}`}</dd></div>
          <div><dt className="text-muted-foreground">WhatsApp</dt><dd>{mascararTelefone(usuario.whatsapp)}</dd></div>
          <div><dt className="text-muted-foreground">Cidade</dt><dd>{usuario.endereco.cidade}/{usuario.endereco.uf}</dd></div>
          {usuario.squad && <div><dt className="text-muted-foreground">Squad</dt><dd>{usuario.squad}</dd></div>}
          {usuario.instagram && <div><dt className="text-muted-foreground">Instagram</dt><dd>{usuario.instagram}</dd></div>}
          <div><dt className="text-muted-foreground">Aceite dos termos</dt><dd>{usuario.aceiteTermosVersao} em {formatarDataBR(usuario.aceiteTermosEm)}</dd></div>
        </dl>
      </Cartao>
      <Cartao>
        <h2 className="font-display text-lg font-semibold uppercase">Configurações</h2>
        <div className="mt-3 max-w-xs">
          <Campo rotulo="Tema" htmlFor="tema">
            <Selecao id="tema" value={preferencia} onChange={(e) => definirPreferencia(e.target.value as "dark" | "light" | "system")}>
              <option value="dark">Escuro — verde-oliva</option>
              <option value="light">Claro — TAN</option>
              <option value="system">Seguir o sistema</option>
            </Selecao>
          </Campo>
        </div>
      </Cartao>
    </div>
  );
}
