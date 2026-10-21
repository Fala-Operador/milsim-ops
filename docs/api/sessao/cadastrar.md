# `cadastrar`

[← Índice de APIs](../README.md) · Módulo: [Sessão e leitura](../README.md#sessao)

| | |
|---|---|
| Server function | `cadastrarFn` em [`src/api/sessao.functions.ts`](../../../src/api/sessao.functions.ts) |
| Uso no navegador | `cadastrar(…)` |
| Método | `POST` |
| Acesso | Pública |

Cria a conta de participante: valida os dados, cria o usuário no Supabase Auth (e-mail já confirmado), grava o perfil e faz login.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `cpf` | string | CPF (com ou sem máscara). |
| `nomeCompleto` | string (até 200) |  |
| `dataNascimento` | string AAAA-MM-DD | Idade mínima de 15 anos. |
| `email` | string |  |
| `senha / confirmacaoSenha` | string | Mínimo de 6 caracteres, com letra minúscula, letra maiúscula, número e símbolo; precisam ser iguais. O Supabase Auth também recusa senhas vazadas. |
| `whatsapp` | string | Telefone com DDD. |
| `cep, logradouro, numero, complemento?, bairro, cidade, uf` | string | Endereço. |
| `instagram?, squad?` | string | Opcionais (perfil social). |
| `fotoUrl?` | string (data URL) | Foto opcional; vai para o Storage. |
| `aceiteTermos, cienciaPrivacidade` | boolean | Obrigatórios (`true`). |
| `autorizacaoPromocional` | boolean | Consentimento opcional para comunicações. |

## Regras

- CPF e e-mail são únicos.
- Menores de 18 anos (15 a 17) ficam com `autorizacaoResponsavel = "pendente"` e só se inscrevem depois da aprovação do admin.
- Se a gravação do perfil falhar, a conta criada no Auth é apagada (não fica conta órfã).
- Perfil, papel e organização ficam na tabela `usuarios`, nunca em `user_metadata`.

## Resposta

`null`; a pessoa já sai logada (visão aplicada).

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- É obrigatório aceitar os termos e o aviso de privacidade.
- Informe um e-mail válido.
- CPF inválido.
- Telefone/WhatsApp inválido.
- A senha deve ter ao menos 6 caracteres.
- A senha deve ter letra minúscula, letra maiúscula, número e símbolo.
- A confirmação de senha não confere.
- É necessário ter ao menos 15 anos.
- Já existe um cadastro com este CPF.
- Já existe um cadastro com este e-mail.
- Esta senha já apareceu em vazamentos de dados e não pode ser usada. Escolha outra.
- Senha fraca. Escolha uma senha mais difícil de adivinhar.
- Não foi possível criar a conta. Tente novamente.

## Exemplo

```ts
import { cadastrar } from "@/api/sessao.functions";

await cadastrar({
  cpf: "529.982.247-25", nomeCompleto: "Ana Souza", dataNascimento: "1998-04-12",
  email: "ana@exemplo.com", senha: "Segredo#123", confirmacaoSenha: "Segredo#123",
  whatsapp: "(11) 98888-7777", cep: "01310-100", logradouro: "Av. Paulista", numero: "1000",
  bairro: "Bela Vista", cidade: "São Paulo", uf: "SP",
  aceiteTermos: true, cienciaPrivacidade: true, autorizacaoPromocional: false,
});
```

Resultado devolvido pela chamada:

```json
null
```
