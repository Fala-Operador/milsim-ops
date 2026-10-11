// Serviço de autenticação demonstrativa.
// ATENÇÃO: senhas usam hash demonstrativo apenas para não ficarem em texto puro.
// Autenticação segura será implementada no backend na etapa de produção.
import { carregarBase, mutarBase, latencia, ErroDominio, gerarId } from "./db";
import { storage } from "@/lib/storage";
import { hashDemo, VERSAO_TERMOS } from "@/data/seed";
import {
  cpfValido,
  emailValido,
  normalizarEmail,
  somenteDigitos,
  telefoneValido,
  idadeEmAnos,
  IDADE_MINIMA,
} from "@/lib/domain/validators";
import type { Usuario } from "@/lib/domain/types";

const CHAVE_SESSAO = "sessao";

export interface DadosCadastro {
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string;
  email: string;
  senha: string;
  confirmacaoSenha: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | undefined;
  bairro: string;
  cidade: string;
  uf: string;
  instagram?: string | undefined;
  squad?: string | undefined;
  fotoUrl?: string | undefined;
  aceiteTermos: boolean;
  cienciaPrivacidade: boolean;
  autorizacaoPromocional: boolean;
}

export function sessaoAtual(): string | null {
  return storage.ler<string>(CHAVE_SESSAO);
}

export function usuarioDaSessao(): Usuario | null {
  const id = sessaoAtual();
  if (!id) return null;
  const base = carregarBase();
  return base.usuarios.find((u) => u.id === id && u.ativo) ?? null;
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  await latencia();
  const base = carregarBase();
  const emailNorm = normalizarEmail(email);
  const hash = base.credenciais[emailNorm];
  if (!hash || hash !== hashDemo(senha)) {
    throw new ErroDominio("credenciais_invalidas", "E-mail ou senha incorretos.");
  }
  const usuario = base.usuarios.find(
    (u) => u.email === emailNorm && u.ativo,
  );
  if (!usuario) throw new ErroDominio("usuario_inativo", "Conta inativa.");
  storage.gravar(CHAVE_SESSAO, usuario.id);
  return usuario;
}

export function sair(): void {
  storage.remover(CHAVE_SESSAO);
}

export async function cadastrar(dados: DadosCadastro): Promise<Usuario> {
  await latencia(400);
  const email = normalizarEmail(dados.email);
  const cpf = somenteDigitos(dados.cpf);
  const whatsapp = somenteDigitos(dados.whatsapp);

  if (!dados.aceiteTermos || !dados.cienciaPrivacidade) {
    throw new ErroDominio("termos", "É obrigatório aceitar os termos e o aviso de privacidade.");
  }
  if (!emailValido(email)) throw new ErroDominio("email", "Informe um e-mail válido.");
  if (!cpfValido(cpf)) throw new ErroDominio("cpf", "CPF inválido.");
  if (!telefoneValido(whatsapp)) throw new ErroDominio("telefone", "Telefone/WhatsApp inválido.");
  if (dados.senha.length < 6) throw new ErroDominio("senha", "A senha deve ter ao menos 6 caracteres.");
  if (dados.senha !== dados.confirmacaoSenha) {
    throw new ErroDominio("senha_confirmacao", "A confirmação de senha não confere.");
  }
  const idade = idadeEmAnos(dados.dataNascimento);
  if (idade < IDADE_MINIMA) {
    throw new ErroDominio("idade", `É necessário ter ao menos ${IDADE_MINIMA} anos.`);
  }

  return mutarBase((base) => {
    const cpfDuplicado = base.usuarios.some((u) => u.cpf === cpf);
    const emailDuplicado = base.usuarios.some((u) => u.email === email);
    if (cpfDuplicado) throw new ErroDominio("cpf_duplicado", "Já existe um cadastro com este CPF.");
    if (emailDuplicado) throw new ErroDominio("email_duplicado", "Já existe um cadastro com este e-mail.");

    const menor = idade < 18;
    const usuario: Usuario = {
      id: gerarId("usr"),
      perfil: "participante",
      nomeCompleto: dados.nomeCompleto.trim(),
      cpf,
      dataNascimento: dados.dataNascimento,
      email,
      whatsapp,
      endereco: {
        cep: somenteDigitos(dados.cep),
        logradouro: dados.logradouro.trim(),
        numero: dados.numero.trim(),
        complemento: dados.complemento?.trim() || undefined,
        bairro: dados.bairro.trim(),
        cidade: dados.cidade.trim(),
        uf: dados.uf.toUpperCase(),
      },
      instagram: dados.instagram?.trim() || undefined,
      squad: dados.squad?.trim() || undefined,
      fotoUrl: dados.fotoUrl,
      // Decisão de produto sujeita à validação jurídica: cadastro de 15–17 anos
      // existe com autorização pendente, mas inscrição aguarda aprovação.
      autorizacaoResponsavel: menor ? "pendente" : "nao_aplicavel",
      autorizacaoPromocional: dados.autorizacaoPromocional,
      aceiteTermosVersao: VERSAO_TERMOS,
      aceiteTermosEm: new Date().toISOString(),
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    base.usuarios.push(usuario);
    base.credenciais[email] = hashDemo(dados.senha);
    storage.gravar(CHAVE_SESSAO, usuario.id);
    return usuario;
  });
}

/** Recuperação de senha simulada — nenhum e-mail é enviado. */
export async function recuperarSenha(email: string): Promise<void> {
  await latencia();
  const emailNorm = normalizarEmail(email);
  if (!emailValido(emailNorm)) throw new ErroDominio("email", "Informe um e-mail válido.");
  // Simulação: sempre responde sucesso para não revelar contas existentes.
}

/** Consulta de CEP simulada: preenche cidade/UF plausíveis, editáveis. */
export async function consultarCep(cep: string) {
  await latencia(300);
  const d = somenteDigitos(cep);
  if (d.length !== 8) throw new ErroDominio("cep", "CEP inválido.");
  return {
    logradouro: "",
    bairro: "",
    cidade: "Cidade demonstrativa",
    uf: "SP",
  };
}
