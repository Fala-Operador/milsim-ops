import { destinoDoLink, redirectSeguro } from "@/lib/links";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { textoBuscaCep, useBuscaCep } from "@/hooks/useBuscaCep";
import {
  mascaraCep,
  mascaraCpf,
  mascaraTelefone,
} from "@/lib/domain/validators";
import { Button } from "@/components/ui/button";
import { LayoutAcesso } from "@/components/LayoutAcesso";
import { Input } from "@/components/ui/input";
import { InputSenha } from "@/components/ui/input-senha";
import { RequisitosSenha } from "@/components/RequisitosSenha";
import { erroSenha } from "@/lib/domain/senha";
import { useTurnstile } from "@/components/Turnstile";
import { NativeSelect } from "@/components/ui/native-select";
import { Campo } from "@/components/ui";
import { EditorFoto } from "@/components/EditorFoto";
import { TIPOS_FOTO, erroArquivoFoto } from "@/lib/recorteFoto";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CamposFicha, FICHA_VAZIA } from "@/components/perfil/FichaEmergencia";
import { ReenviarConfirmacao } from "@/components/ReenviarConfirmacao";
import { CHAVE_DESTINO_CONFIRMACAO } from "@/lib/confirmacaoEmail";
import { MailCheck } from "lucide-react";
import { fichaPreenchida, type DadosFicha } from "@/lib/fichaEmergencia";
import imgTrilha from "@/assets/comunidade-trilha.jpg";
import imgEquipamento from "@/assets/comunidade-equipamento.jpg";

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

const ETAPAS = [
  { titulo: "Conta", descricao: "E-mail e senha para entrar na plataforma." },
  { titulo: "Dados pessoais", descricao: "Usados só para identificar você na portaria do evento." },
  { titulo: "Endereço", descricao: "Digite o CEP: o endereço é preenchido sozinho." },
  { titulo: "Perfil de jogo", descricao: "Opcional. Ajuda o organizador e a equipe de resgate em campo." },
  { titulo: "Revisão", descricao: "Confira os dados e aceite os termos para criar a conta." },
] as const;

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
  const [ficha, setFicha] = useState<DadosFicha>(FICHA_VAZIA);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const turnstile = useTurnstile("cadastro");
  const ultima = ETAPAS.length - 1;
  const irPara = (n: number) => { setErro(""); setEtapa(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Cada etapa só mostra os seus campos: o "required" nativo valida a etapa antes de avançar.
  const avancar = (e: React.FormEvent) => {
    if (etapa === ultima) return aoEnviar(e);
    e.preventDefault();
    if (etapa === 0 && !senhaValida) return setErro(erroSenha(f.senha) ?? "A confirmação de senha não confere.");
    irPara(etapa + 1);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // CEP completo preenche o endereço sozinho; o que o ViaCEP não traz (CEP de cidade) fica como está.
  const buscaCep = useBuscaCep(f.cep, (r) =>
    setF((p) => ({
      ...p,
      logradouro: r.logradouro || p.logradouro,
      bairro: r.bairro || p.bairro,
      cidade: r.cidade || p.cidade,
      uf: r.uf || p.uf,
    })),
  );

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

  const senhaValida = erroSenha(f.senha) === null && f.senha === f.confirmacaoSenha;

  const aoEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    if (!senhaValida) return setErro(erroSenha(f.senha) ?? "A confirmação de senha não confere.");
    setCarregando(true);
    try {
      const conta = await registrar({
        ...f,
        fotoUrl: fotoUrl === FOTO_PADRAO ? undefined : fotoUrl,
        aceiteTermos: aceite,
        cienciaPrivacidade: privacidade,
        autorizacaoPromocional: promocional,
        // Só envia a ficha se algo foi preenchido ou autorizado.
        fichaEmergencia: fichaPreenchida(ficha) || ficha.compartilhar ? ficha : undefined,
      }, turnstile.token);
      if (!conta) {
        // Precisa confirmar o e-mail: guarda para onde voltar depois de abrir o link (mesmo aparelho).
        try { localStorage.setItem(CHAVE_DESTINO_CONFIRMACAO, redirectSeguro(redirect)); } catch { /* sem armazenamento: vai para /app */ }
        setAguardandoConfirmacao(f.email.trim().toLowerCase());
        return;
      }
      // Retorna ao fluxo de inscrição quando o cadastro começou em um evento
      navigate({ ...destinoDoLink(redirectSeguro(redirect)) } as { to: string });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no cadastro.");
      turnstile.resetar();
    } finally {
      setCarregando(false);
    }
  };

  if (aguardandoConfirmacao) {
    return (
      <LayoutAcesso titulo="Confirme seu e-mail" rotulo="Quase lá" frase="Abra o link do e-mail para ativar a sua conta." imagem={imgTrilha}>
        <div className="mt-4 space-y-4">
          <MailCheck className="h-8 w-8 text-accent" aria-hidden="true" />
          <p className="text-sm">
            Sua conta foi criada. Enviamos um link de confirmação para <strong className="break-all">{aguardandoConfirmacao}</strong>.
            Abra o link para ativar o acesso — ele vale por 1 hora.
          </p>
          <p className="text-sm text-muted-foreground">Não chegou? Confira a caixa de spam ou peça outro e-mail.</p>
          <ReenviarConfirmacao email={aguardandoConfirmacao} />
          <p className="text-sm">
            Já confirmou? <Link to="/login" search={{ redirect }} className="text-accent hover:underline">Entrar</Link>
          </p>
        </div>
      </LayoutAcesso>
    );
  }

  const resumo: Array<[string, string, number]> = [
    ["E-mail", f.email, 0], ["Nome", f.nomeCompleto, 1], ["CPF", f.cpf, 1], ["Nascimento", f.dataNascimento.split("-").reverse().join("/"), 1],
    ["WhatsApp", f.whatsapp, 1], ["Endereço", [f.logradouro, f.numero, f.bairro, f.cidade && `${f.cidade}/${f.uf}`].filter(Boolean).join(", "), 2],
    ["Squad", f.squad || "—", 3], ["Ficha de emergência", fichaPreenchida(ficha) ? "Preenchida" : "Não preenchida", 3],
  ];

  return (
    <LayoutAcesso largo titulo="Criar conta" subtitulo="Cinco etapas rápidas. Você pode voltar e corrigir antes de concluir."
      imagem={imgEquipamento} rotulo="Cadastro de operador" frase="Uma conta para todas as operações do Brasil.">
      <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Etapas do cadastro">
        {ETAPAS.map((et, i) => (
          <li key={et.titulo} aria-current={i === etapa ? "step" : undefined}>
            <Button variant="plain" size="none" type="button" disabled={i > etapa} onClick={() => irPara(i)} className="block w-full text-left">
              <span className={`block h-1 rounded-full ${i <= etapa ? "bg-primary" : "bg-secondary"}`} />
              <span className={`mt-1.5 hidden font-mono text-[10px] uppercase tracking-wider sm:block ${i === etapa ? "text-foreground" : "text-muted-foreground"}`}>{et.titulo}</span>
            </Button>
          </li>
        ))}
      </ol>
      <div className="mt-6 border-b border-border pb-4">
        <p className="rotulo-tecnico">Etapa {etapa + 1} de {ETAPAS.length}</p>
        <h2 className="mt-1 text-xl font-semibold">{ETAPAS[etapa]!.titulo}</h2>
        <p className="text-sm text-muted-foreground">{ETAPAS[etapa]!.descricao}</p>
      </div>

      <form onSubmit={avancar} className="mt-5 grid gap-4 sm:grid-cols-2">
        {etapa === 0 && <>
          <div className="sm:col-span-2">
            <Campo rotulo="E-mail" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} required />
            </Campo>
          </div>
          <Campo rotulo="Senha" htmlFor="senha">
            <InputSenha id="senha" autoComplete="new-password" value={f.senha} onChange={set("senha")} aria-describedby="requisitos-senha" required />
          </Campo>
          <Campo rotulo="Confirmar senha" htmlFor="senha2">
            <InputSenha id="senha2" autoComplete="new-password" value={f.confirmacaoSenha} onChange={set("confirmacaoSenha")} required />
          </Campo>
          <div className="sm:col-span-2">
            <RequisitosSenha id="requisitos-senha" senha={f.senha} confirmacao={f.confirmacaoSenha} />
          </div>
        </>}

        {etapa === 1 && <>
          <div className="sm:col-span-2 flex items-center gap-4">
            <img src={fotoUrl} alt="Prévia da foto de perfil" className="h-16 w-16 rounded-full border border-border object-cover" />
            <Campo rotulo="Foto de perfil (opcional)" htmlFor="foto">
              <input id="foto" type="file" accept={TIPOS_FOTO.join(",")} onChange={aoSelecionarFoto} className="w-full" />
            </Campo>
          </div>
          {arquivoFoto && (
            <EditorFoto arquivo={arquivoFoto} onCancelar={() => setArquivoFoto(null)}
              onConfirmar={(dataUrl) => { setFotoUrl(dataUrl); setArquivoFoto(null); }} />
          )}
          <div className="sm:col-span-2">
            <Campo rotulo="Nome completo" htmlFor="nome">
              <Input id="nome" autoComplete="name" value={f.nomeCompleto} onChange={set("nomeCompleto")} required />
            </Campo>
          </div>
          <Campo rotulo="CPF" htmlFor="cpf">
            <Input id="cpf" inputMode="numeric" value={f.cpf} onChange={(e) => setF((p) => ({ ...p, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" required />
          </Campo>
          <Campo rotulo="Data de nascimento" htmlFor="nasc">
            <Input id="nasc" type="date" value={f.dataNascimento} onChange={set("dataNascimento")} required />
          </Campo>
          <Campo rotulo="WhatsApp" htmlFor="whats">
            <Input id="whats" inputMode="tel" value={f.whatsapp} onChange={(e) => setF((p) => ({ ...p, whatsapp: mascaraTelefone(e.target.value) }))} placeholder="(11) 99999-9999" required />
          </Campo>
        </>}

        {etapa === 2 && <>
          <div className="sm:col-span-2">
            <Campo rotulo="CEP" htmlFor="cep">
              <Input id="cep" inputMode="numeric" autoComplete="postal-code" value={f.cep} onChange={(e) => setF((p) => ({ ...p, cep: mascaraCep(e.target.value) }))} placeholder="00000-000" required className="sm:max-w-48" />
              <p aria-live="polite" className={`text-xs ${buscaCep.status === "erro" ? "text-destructive" : "text-muted-foreground"}`}>
                {textoBuscaCep(buscaCep) || "Digite o CEP para preencher o endereço automaticamente."}
              </p>
            </Campo>
          </div>
          <div className="sm:col-span-2"><Campo rotulo="Logradouro" htmlFor="logr"><Input id="logr" value={f.logradouro} onChange={set("logradouro")} required /></Campo></div>
          <Campo rotulo="Número" htmlFor="num"><Input id="num" value={f.numero} onChange={set("numero")} required /></Campo>
          <Campo rotulo="Complemento (opcional)" htmlFor="comp"><Input id="comp" value={f.complemento} onChange={set("complemento")} /></Campo>
          <Campo rotulo="Bairro" htmlFor="bairro"><Input id="bairro" value={f.bairro} onChange={set("bairro")} required /></Campo>
          <Campo rotulo="Cidade" htmlFor="cidade"><Input id="cidade" value={f.cidade} onChange={set("cidade")} required /></Campo>
          <Campo rotulo="UF / Estado" htmlFor="uf">
            <NativeSelect id="uf" value={f.uf} onChange={set("uf")} required>
              <option value="">Selecione</option>
              {UFS.map(([sigla, nome]) => <option key={sigla} value={sigla}>{sigla} — {nome}</option>)}
            </NativeSelect>
          </Campo>
        </>}

        {etapa === 3 && <>
          <Campo rotulo="Instagram (opcional)" htmlFor="insta"><Input id="insta" value={f.instagram} onChange={set("instagram")} placeholder="@seuperfil" /></Campo>
          <Campo rotulo="Squad (opcional)" htmlFor="squad"><Input id="squad" value={f.squad} onChange={set("squad")} /></Campo>
          <section aria-labelledby="titulo-ficha" className="sm:col-span-2 space-y-3 border-t border-border pt-4">
            <div>
              <h3 id="titulo-ficha" className="font-semibold">Ficha de emergência</h3>
              <p className="mt-1 text-xs text-muted-foreground">Tipo sanguíneo, alergias e um contato para emergências em campo. Você pode preencher depois em Meu perfil.</p>
            </div>
            <CamposFicha valor={ficha} onChange={setFicha} prefixo="cad-ficha" />
          </section>
        </>}

        {etapa === ultima && <>
          <dl className="sm:col-span-2 divide-y divide-border rounded-lg border border-border text-sm">
            {resumo.map(([r, v, n]) => (
              <div key={r} className="flex items-baseline gap-3 px-4 py-2.5">
                <dt className="w-36 shrink-0 text-muted-foreground">{r}</dt>
                <dd className="min-w-0 flex-1 break-words">{v || "—"}</dd>
                <Button variant="link" size="none" type="button" className="text-xs" onClick={() => irPara(n)}>Editar</Button>
              </div>
            ))}
          </dl>
          <div className="sm:col-span-2 space-y-2 text-sm">
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={aceite} onCheckedChange={(m) => setAceite(m === true)} className="mt-1" required />
              <span>Li e aceito os <Link to="/termos" className="text-accent hover:underline">termos de uso</Link>.</span>
            </Label>
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={privacidade} onCheckedChange={(m) => setPrivacidade(m === true)} className="mt-1" required />
              <span>Estou ciente do <Link to="/privacidade" className="text-accent hover:underline">aviso de privacidade</Link>.</span>
            </Label>
            <Label className="flex items-start gap-2 text-[length:inherit] font-normal text-inherit">
              <Checkbox checked={promocional} onCheckedChange={(m) => setPromocional(m === true)} className="mt-1" />
              <span>Autorizo o recebimento de comunicações promocionais (opcional).</span>
            </Label>
            <p className="text-xs text-muted-foreground">Participantes de 15 a 17 anos: a inscrição em eventos é liberada após a aprovação do responsável.</p>
          </div>
          {turnstile.elemento && <div className="sm:col-span-2">{turnstile.elemento}</div>}
        </>}

        {erro && (
          <p role="alert" className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
        )}
        <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t border-border pt-4">
          {etapa > 0 ? <Button type="button" variant="ghost" onClick={() => irPara(etapa - 1)}>Voltar</Button> : <Link to="/login" search={{ redirect }} className="text-sm text-accent hover:underline">Já tenho conta</Link>}
          {etapa < ultima
            ? <Button type="submit" size="lg">Continuar</Button>
            : <Button type="submit" size="lg" disabled={carregando || !aceite || !privacidade || !senhaValida || !turnstile.pronto}>{carregando ? "Criando conta..." : "Criar conta"}</Button>}
        </div>
      </form>
    </LayoutAcesso>
  );
}
