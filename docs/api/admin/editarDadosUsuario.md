# `editarDadosUsuario`

[← Índice de APIs](../README.md) · Módulo: [Administração](../README.md#admin)

| | |
|---|---|
| Server function | `editarDadosUsuarioFn` em [`src/api/admin.functions.ts`](../../../src/api/admin.functions.ts) |
| Uso no navegador | `editarDadosUsuario(…)` |
| Método | `POST` |
| Acesso | Somente admin |

Corrige o cadastro de outra pessoa (Administração › Usuários › painel do usuário › Editar dados).

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `usuarioId` | string |  |
| `dados.cpf` | string (até 14) | Com ou sem máscara. Válido e único. |
| `dados.nomeCompleto` | string (até 150) |  |
| `dados.dataNascimento` | string `AAAA-MM-DD` |  |
| `dados.whatsapp` | string (até 20) | Com DDD. |
| `dados.cep`, `logradouro`, `numero`, `complemento?`, `bairro`, `cidade`, `uf` | string | Endereço; complemento opcional. |
| `dados.instagram?`, `dados.squad?` | string | Opcionais. |

## Regras

- Mesmas regras de [`atualizarDadosConta`](../conta/atualizarDadosConta.md) (inclusive o efeito da data de nascimento na autorização do responsável).
- O CPF precisa ser válido e não pode pertencer a outra conta. O índice cego (`cpf_hash`) é recalculado na gravação, como em qualquer escrita de dado pessoal.
- O e-mail não muda por aqui: é o login da conta no Supabase Auth.
- A ficha de emergência não é lida nem alterada.
- Auditoria `editar_usuario` com os nomes dos campos alterados (ex.: `Campos alterados: nome, cpf`), nunca os valores. Sem alteração, nada é auditado.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- CPF inválido.
- Já existe um cadastro com este CPF.
- Usuário não encontrado.
- As mensagens de validação de [`atualizarDadosConta`](../conta/atualizarDadosConta.md).
- Entre na sua conta para continuar.

## Exemplo

```ts
import { editarDadosUsuario } from "@/api/admin.functions";

await editarDadosUsuario("3bbdfd0d-…", {
  cpf: "123.456.789-09", nomeCompleto: "Maria Silva", dataNascimento: "1990-05-10",
  whatsapp: "(83) 99999-1234", cep: "58000-000", logradouro: "Rua A", numero: "10",
  bairro: "Centro", cidade: "João Pessoa", uf: "PB",
});
```

Resultado devolvido pela chamada:

```json
null
```
