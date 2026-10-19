# Documentação do MilSim Ops

Por onde começar, conforme o que você precisa:

| Quero… | Leia |
|---|---|
| Entender o produto, rodar o projeto e configurar o ambiente | [README do projeto](../README.md) |
| Saber **o que** o sistema decide (vagas, cupons, pagamento, comunidade, suporte…) | [Regras de negócio](regras-de-negocio.md) |
| Ver **como** as coisas acontecem de ponta a ponta (inscrição com Stripe, check-in, suporte…) | [Fluxos](fluxos.md) |
| Chamar ou criar uma API | [Referência das APIs](api/README.md): uma página por API, com exemplo |
| Entender camadas, banco, segurança e deploy | [Arquitetura](ARQUITETURA.md) |
| Saber as regras obrigatórias para mexer no código | [AGENTS.md](../AGENTS.md) |

## Mapa rápido

```
Navegador (src/routes, src/components)
   │  chama wrappers de src/api/*.functions.ts  ── referência: docs/api/
   ▼
Server functions (zod + identidade da sessão)
   │  mutar / ler  (src/server/unidade.server.ts)
   ▼
Regras: src/lib (puras) + src/services (aplicam na base)  ── docs/regras-de-negocio.md
   │  1 transação por escrita (aplicar_mudancas)
   ▼
Supabase: Postgres (RLS fechado), Auth, Storage (midia público, documentos privado)
Stripe: Checkout, reembolsos e Connect (webhook via Edge Function)
```

## Mantendo esta documentação

- Mudou uma regra? Atualize a seção correspondente de [regras-de-negocio.md](regras-de-negocio.md)
  junto com o código e o teste.
- Criou, mudou ou removeu uma API? Atualize a página dela em `docs/api/<módulo>/` e a linha no
  [índice](api/README.md). Cada página segue o mesmo formato: tabela de identificação, entrada,
  regras, resposta, erros e exemplo.
- As mensagens listadas em "Erros" são as mesmas do código (`ErroDominio`); se mudar o texto de
  um erro, atualize a página.
