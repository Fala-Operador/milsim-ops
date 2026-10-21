# `publicarEvento`

[← Índice de APIs](../README.md) · Módulo: [Organizador](../README.md#organizador)

| | |
|---|---|
| Server function | `publicarEventoFn` em [`src/api/organizador.functions.ts`](../../../src/api/organizador.functions.ts) |
| Uso no navegador | `publicarEvento(…)` |
| Método | `POST` |
| Acesso | Organização dona do evento ou admin |

Publica o evento (passa a aparecer na página inicial e aceitar inscrições) e cria os fóruns da comunidade.

## Entrada

| Campo | Tipo | Observação |
|---|---|---|
| `eventoId` | string |  |

## Regras

- Valida para publicar (`validarParaPublicacao`): nome, modalidade, descrição, enredo, local, imagem principal, ao menos um exército, um tipo de ingresso e uma atividade no cronograma, e atividades dentro do período do evento.
- Data e horário de cada atividade valem no fuso do evento (`fuso`), não no fuso do servidor.
- Os erros de validação chegam juntos numa única mensagem, **um por linha** (`\n`); o editor separa e associa cada um à sua etapa.

## Resposta

`void`.

## Erros

Mensagens que chegam ao navegador em `error.message` (regras de negócio):

- Evento não encontrado.
- Você só pode gerenciar eventos da sua organização.
- Nome obrigatório.
- Adicione a imagem principal do evento.
- Cadastre ao menos um tipo de ingresso.
- O cronograma precisa de ao menos uma atividade.
- Atividade "{título}" fora do período do evento.
- Entre na sua conta para continuar.

## Exemplo

```ts
import { publicarEvento } from "@/api/organizador.functions";

await publicarEvento("evt-mv76xwom-mgios");
```

`data` enviado à server function (`publicarEventoFn({ data })`):

```json
{
  "eventoId": "evt-mv76xwom-mgios"
}
```

Resultado devolvido pela chamada:

```json
null
```
