import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { consultarCep } from "@/services/auth";
import {
  mascaraCep,
  mascaraCpf,
  mascaraTelefone,
} from "@/lib/domain/validators";
import { Botao, Campo, Cartao, Entrada, Selecao } from "@/components/ui";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cadastro de participante — MilSim Ops" },
      { name: "description", content: "Cadastre-se para se inscrever em eventos de simulação militar. Demonstração." },
      { property: "og:title", content: "Cadastro de participante — MilSim Ops" },
      { property: "og:description", content: "Cadastre-se na plataforma. Demonstração." },
    ],
  }),
  component: PaginaCadastro,
});

const UFS: Array<[string, string]> = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
  ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
  ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
];

const FOTO_PADRAO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#46523B"/><circle cx="50" cy="38" r="16" fill="#B8C1AA"/><ellipse cx="50" cy="82" rx="26" ry="18" fill="#B8C1AA"/></svg>`,
  );

function PaginaCadastro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/cadastro" });
  const [f, setF] = useState({
    cpf: "", nomeCompleto: "", dataNascimento: "", email: "", senha: "",
    confirmacaoSenha: "", whatsapp: "", cep: "", logradouro: "", numero: "",
    complemento: "", bairro: "", cidade: "", uf: "", instagram: "", squad: "",
  });
  const [fotoUrl, setFotoUrl] = useState<string>(FOTO_PADRAO);
  const [aceite, setAceite] = useState(false);
  const [privacidade, setPrivacidade] = useState(false);
  const [promocional, setPromocional] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const aoBuscarCep = async () => {
    try {
      const r = await consultarCep(f.cep);
      setF((p) => ({ ...p, cidade: r.cidade, uf: r.uf }));
    } catch {
      /* preenchimento manual permitido */
    }
  };

  const aoSelecionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro("A foto deve ter no máximo 2 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
      setErro("Formato de foto inválido. Use JPG, PNG ou WebP.");
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setFotoUrl(String(leitor.result));
    leitor.readAsDataURL(arquivo);
  };

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await registrar({
        ...f,
        fotoUrl: fotoUrl === FOTO_PADRAO ? undefined : fotoUrl,
        aceiteTermos: aceite,
        cienciaPrivacidade: privacidade,
        autorizacaoPromocional: promocional,
      });
      // Retorna ao fluxo de inscrição quando o cadastro começou em um evento
      navigate({ to: redirect ?? "/app" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no cadastro.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Cartao>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
          Cadastro de participante
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados são usados apenas para identificação no evento e comunicação operacional.
          Protótipo demonstrativo — não use dados reais.
        </p>

        <form onSubmit={aoEnviar} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4">
            <img
              src={fotoUrl}
              alt="Foto de perfil (recorte quadrado 1:1)"
              className="h-20 w-20 rounded-md border border-border object-cover"
            />
            <Campo rotulo="Foto de perfil (1:1, até 2 MB)" htmlFor="foto">
              <Entrada id="foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={aoSelecionarFoto} />
            </Campo>
          </div>

          <Campo rotulo="CPF" htmlFor="cpf">
            <Entrada id="cpf" inputMode="numeric" value={f.cpf} onChange={(e) => setF((p) => ({ ...p, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" required />
          </Campo>
          <Campo rotulo="Data de nascimento" htmlFor="nasc">
            <Entrada id="nasc" type="date" value={f.dataNascimento} onChange={set("dataNascimento")} required />
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Nome completo" htmlFor="nome">
              <Entrada id="nome" value={f.nomeCompleto} onChange={set("nomeCompleto")} required />
            </Campo>
          </div>
          <Campo rotulo="E-mail" htmlFor="email">
            <Entrada id="email" type="email" value={f.email} onChange={set("email")} required />
          </Campo>
          <Campo rotulo="WhatsApp" htmlFor="whats">
            <Entrada id="whats" inputMode="tel" value={f.whatsapp} onChange={(e) => setF((p) => ({ ...p, whatsapp: mascaraTelefone(e.target.value) }))} placeholder="(11) 99999-9999" required />
          </Campo>
          <Campo rotulo="Senha" htmlFor="senha">
            <Entrada id="senha" type="password" value={f.senha} onChange={set("senha")} required minLength={6} />
          </Campo>
          <Campo rotulo="Confirmar senha" htmlFor="senha2">
            <Entrada id="senha2" type="password" value={f.confirmacaoSenha} onChange={set("confirmacaoSenha")} required />
          </Campo>

          <Campo rotulo="CEP" htmlFor="cep">
            <div className="flex gap-2">
              <Entrada id="cep" inputMode="numeric" value={f.cep} onChange={(e) => setF((p) => ({ ...p, cep: mascaraCep(e.target.value) }))} placeholder="00000-000" required />
              <Botao type="button" variante="contorno" onClick={aoBuscarCep}>Buscar</Botao>
            </div>
          </Campo>
          <Campo rotulo="Logradouro" htmlFor="logr">
            <Entrada id="logr" value={f.logradouro} onChange={set("logradouro")} required />
          </Campo>
          <Campo rotulo="Número" htmlFor="num">
            <Entrada id="num" value={f.numero} onChange={set("numero")} required />
          </Campo>
          <Campo rotulo="Complemento (opcional)" htmlFor="comp">
            <Entrada id="comp" value={f.complemento} onChange={set("complemento")} />
          </Campo>
          <Campo rotulo="Bairro" htmlFor="bairro">
            <Entrada id="bairro" value={f.bairro} onChange={set("bairro")} required />
          </Campo>
          <Campo rotulo="Cidade" htmlFor="cidade">
            <Entrada id="cidade" value={f.cidade} onChange={set("cidade")} required />
          </Campo>
          <Campo rotulo="UF / Estado" htmlFor="uf">
            <Selecao id="uf" value={f.uf} onChange={set("uf")} required>
              <option value="">Selecione</option>
              {UFS.map(([sigla, nome]) => (
                <option key={sigla} value={sigla}>{sigla} — {nome}</option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Instagram (opcional)" htmlFor="insta">
            <Entrada id="insta" value={f.instagram} onChange={set("instagram")} placeholder="@seuperfil" />
          </Campo>
          <Campo rotulo="Squad (opcional)" htmlFor="squad">
            <Entrada id="squad" value={f.squad} onChange={set("squad")} />
          </Campo>

          <div className="sm:col-span-2 space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1" required />
              <span>
                Li e aceito os <Link to="/termos" className="text-accent hover:underline">termos de uso</Link> (demonstrativos, versão termos-demo-v1).
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={privacidade} onChange={(e) => setPrivacidade(e.target.checked)} className="mt-1" required />
              <span>
                Estou ciente do <Link to="/privacidade" className="text-accent hover:underline">aviso de privacidade</Link> (demonstrativo).
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={promocional} onChange={(e) => setPromocional(e.target.checked)} className="mt-1" />
              <span>Autorizo o recebimento de comunicações promocionais (opcional).</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Participantes de 15 a 17 anos: o cadastro é criado com autorização do responsável
              pendente; a inscrição em eventos é liberada após aprovação. Fluxo sujeito à
              validação jurídica antes da produção.
            </p>
          </div>

          {erro && (
            <p role="alert" className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}
          <Botao type="submit" disabled={carregando} className="sm:col-span-2">
            {carregando ? "Cadastrando..." : "Concluir cadastro"}
          </Botao>
        </form>
      </Cartao>
    </div>
  );
}
