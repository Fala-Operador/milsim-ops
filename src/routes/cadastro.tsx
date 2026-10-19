import { destinoDoLink, redirectSeguro } from "@/lib/links";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { consultarCep } from "@/services/auth";
import {
  mascaraCep,
  mascaraCpf,
  mascaraTelefone,
} from "@/lib/domain/validators";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo } from "@/components/ui";
import { EditorFoto } from "@/components/EditorFoto";
import { TIPOS_FOTO, erroArquivoFoto } from "@/lib/recorteFoto";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
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
      setF((p) => ({
        ...p,
        logradouro: p.logradouro || r.logradouro,
        bairro: p.bairro || r.bairro,
        cidade: r.cidade || p.cidade,
        uf: r.uf || p.uf,
      }));
    } catch {
      /* preenchimento manual permitido */
    }
  };

  // A foto escolhida abre o editor (recorte, zoom, girar, ajustes) antes de ser usada.
  const aoSelecionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    const erroFoto = erroArquivoFoto(arquivo);
    if (erroFoto) {
      setErro(erroFoto);
      return;
    }
    setArquivoFoto(arquivo);
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
      navigate({ ...destinoDoLink(redirectSeguro(redirect)) } as { to: string });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no cadastro.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide">
          Cadastro de participante
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados são usados apenas para identificação no evento e comunicação operacional.
        </p>

        <form onSubmit={aoEnviar} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4">
            <img
              src={fotoUrl}
              alt="Prévia da foto de perfil"
              className="h-20 w-20 rounded-full border border-border object-cover"
            />
            <Campo rotulo="Foto de perfil (opcional — você ajusta o recorte)" htmlFor="foto">
              <input id="foto" type="file" accept={TIPOS_FOTO.join(",")} onChange={aoSelecionarFoto} className="w-full" />
            </Campo>
          </div>
          {arquivoFoto && (
            <EditorFoto
              arquivo={arquivoFoto}
              onCancelar={() => setArquivoFoto(null)}
              onConfirmar={(dataUrl) => {
                setFotoUrl(dataUrl);
                setArquivoFoto(null);
              }}
            />
          )}

          <Campo rotulo="CPF" htmlFor="cpf">
            <Input id="cpf" inputMode="numeric" value={f.cpf} onChange={(e) => setF((p) => ({ ...p, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" required />
          </Campo>
          <Campo rotulo="Data de nascimento" htmlFor="nasc">
            <Input id="nasc" type="date" value={f.dataNascimento} onChange={set("dataNascimento")} required />
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Nome completo" htmlFor="nome">
              <Input id="nome" value={f.nomeCompleto} onChange={set("nomeCompleto")} required />
            </Campo>
          </div>
          <Campo rotulo="E-mail" htmlFor="email">
            <Input id="email" type="email" value={f.email} onChange={set("email")} required />
          </Campo>
          <Campo rotulo="WhatsApp" htmlFor="whats">
            <Input id="whats" inputMode="tel" value={f.whatsapp} onChange={(e) => setF((p) => ({ ...p, whatsapp: mascaraTelefone(e.target.value) }))} placeholder="(11) 99999-9999" required />
          </Campo>
          <Campo rotulo="Senha" htmlFor="senha">
            <Input id="senha" type="password" value={f.senha} onChange={set("senha")} required minLength={6} />
          </Campo>
          <Campo rotulo="Confirmar senha" htmlFor="senha2">
            <Input id="senha2" type="password" value={f.confirmacaoSenha} onChange={set("confirmacaoSenha")} required />
          </Campo>

          <Campo rotulo="CEP" htmlFor="cep">
            <div className="flex gap-2">
              <Input id="cep" inputMode="numeric" value={f.cep} onChange={(e) => setF((p) => ({ ...p, cep: mascaraCep(e.target.value) }))} placeholder="00000-000" required />
              <Button type="button" variant="outline" onClick={aoBuscarCep}>Buscar</Button>
            </div>
          </Campo>
          <Campo rotulo="Logradouro" htmlFor="logr">
            <Input id="logr" value={f.logradouro} onChange={set("logradouro")} required />
          </Campo>
          <Campo rotulo="Número" htmlFor="num">
            <Input id="num" value={f.numero} onChange={set("numero")} required />
          </Campo>
          <Campo rotulo="Complemento (opcional)" htmlFor="comp">
            <Input id="comp" value={f.complemento} onChange={set("complemento")} />
          </Campo>
          <Campo rotulo="Bairro" htmlFor="bairro">
            <Input id="bairro" value={f.bairro} onChange={set("bairro")} required />
          </Campo>
          <Campo rotulo="Cidade" htmlFor="cidade">
            <Input id="cidade" value={f.cidade} onChange={set("cidade")} required />
          </Campo>
          <Campo rotulo="UF / Estado" htmlFor="uf">
            <NativeSelect id="uf" value={f.uf} onChange={set("uf")} required>
              <option value="">Selecione</option>
              {UFS.map(([sigla, nome]) => (
                <option key={sigla} value={sigla}>{sigla} — {nome}</option>
              ))}
            </NativeSelect>
          </Campo>
          <Campo rotulo="Instagram (opcional)" htmlFor="insta">
            <Input id="insta" value={f.instagram} onChange={set("instagram")} placeholder="@seuperfil" />
          </Campo>
          <Campo rotulo="Squad (opcional)" htmlFor="squad">
            <Input id="squad" value={f.squad} onChange={set("squad")} />
          </Campo>

          <div className="sm:col-span-2 space-y-2 text-sm">
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={aceite} onCheckedChange={(marcado) => setAceite(marcado === true)} className="mt-1" required />
              <span>
                Li e aceito os <Link to="/termos" className="text-accent hover:underline">termos de uso</Link> .
              </span>
            </Label>
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={privacidade} onCheckedChange={(marcado) => setPrivacidade(marcado === true)} className="mt-1" required />
              <span>
                Estou ciente do <Link to="/privacidade" className="text-accent hover:underline">aviso de privacidade</Link>.
              </span>
            </Label>
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={promocional} onCheckedChange={(marcado) => setPromocional(marcado === true)} className="mt-1" />
              <span>Autorizo o recebimento de comunicações promocionais (opcional).</span>
            </Label>
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
          <Button type="submit" disabled={carregando} className="sm:col-span-2">
            {carregando ? "Cadastrando..." : "Concluir cadastro"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
