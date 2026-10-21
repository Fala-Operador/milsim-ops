// Regras de cadastro (validação e montagem do perfil). A autenticação em si é feita
// pelo Supabase Auth no servidor (src/server/auth.server.ts); a senha nunca é
// guardada nas tabelas da aplicação.
import { mutarBase, ErroDominio } from "./db";
import { VERSAO_TERMOS } from "@/data/termos";
import {
  cpfValido,
  emailValido,
  normalizarEmail,
  somenteDigitos,
  telefoneValido,
  idadeEmAnos,
  IDADE_MINIMA,
} from "@/lib/domain/validators";
import { validarFoto } from "@/services/conta";
import type { Usuario } from "@/lib/domain/types";
import { erroSenha } from "@/lib/domain/senha";

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

export { SENHA_MINIMA } from "@/lib/domain/senha";

/** Valida o formulário de cadastro; devolve os campos normalizados. */
export function validarCadastro(dados: DadosCadastro) {
  const email = normalizarEmail(dados.email);
  const cpf = somenteDigitos(dados.cpf);
  const whatsapp = somenteDigitos(dados.whatsapp);

  if (!dados.aceiteTermos || !dados.cienciaPrivacidade) {
    throw new ErroDominio("termos", "É obrigatório aceitar os termos e o aviso de privacidade.");
  }
  if (!emailValido(email)) throw new ErroDominio("email", "Informe um e-mail válido.");
  if (!cpfValido(cpf)) throw new ErroDominio("cpf", "CPF inválido.");
  if (!telefoneValido(whatsapp)) throw new ErroDominio("telefone", "Telefone/WhatsApp inválido.");
  const problemaSenha = erroSenha(dados.senha);
  if (problemaSenha) throw new ErroDominio("senha", problemaSenha);
  if (dados.senha !== dados.confirmacaoSenha) {
    throw new ErroDominio("senha_confirmacao", "A confirmação de senha não confere.");
  }
  const idade = idadeEmAnos(dados.dataNascimento);
  if (idade < IDADE_MINIMA) {
    throw new ErroDominio("idade", `É necessário ter ao menos ${IDADE_MINIMA} anos.`);
  }
  return { email, cpf, whatsapp, idade };
}

/** Cria o perfil do participante para um usuário já criado no Supabase Auth (`id`). */
export function registrarPerfil(id: string, dados: DadosCadastro): Usuario {
  const { email, cpf, whatsapp, idade } = validarCadastro(dados);
  if (dados.fotoUrl) validarFoto(dados.fotoUrl);
  return mutarBase((base) => {
    if (base.usuarios.some((u) => u.cpf === cpf)) {
      throw new ErroDominio("cpf_duplicado", "Já existe um cadastro com este CPF.");
    }
    if (base.usuarios.some((u) => u.email === email)) {
      throw new ErroDominio("email_duplicado", "Já existe um cadastro com este e-mail.");
    }
    const menor = idade < 18;
    const usuario: Usuario = {
      id,
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
    return usuario;
  });
}

/** Consulta o CEP no ViaCEP (serviço público e gratuito). Os campos continuam editáveis. */
export async function consultarCep(cep: string) {
  const d = somenteDigitos(cep);
  if (d.length !== 8) throw new ErroDominio("cep", "CEP inválido.");
  const resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!resposta.ok) throw new ErroDominio("cep", "Não foi possível consultar o CEP agora.");
  const r = (await resposta.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (r.erro) throw new ErroDominio("cep", "CEP não encontrado.");
  return { logradouro: r.logradouro ?? "", bairro: r.bairro ?? "", cidade: r.localidade ?? "", uf: r.uf ?? "" };
}
