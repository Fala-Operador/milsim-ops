# MilSim Ops — protótipo demonstrativo

Aplicação web responsiva (pt-BR) para divulgação e gestão de eventos de simulação militar.
**Versão 100% mockada**: dados fictícios, autenticação demonstrativa e persistência local.
Sem backend real, envio de mensagens ou pagamentos.

## Execução

```bash
bun install
bun run dev
bunx vitest run   # testes das regras de negócio
```

## Contas demonstrativas

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin@admin` | `admin@123` |
| Participante | `usuario@teste.com.br` | `user@123` |
| Organizador aprovado | `organizador@teste.com.br` | `organizador@123` |

## Organização do projeto

- `src/lib/domain/` — tipos, validações (CPF/CNPJ/idade), dinheiro em centavos
- `src/lib/storage.ts` — único ponto de acesso ao localStorage (prefixo `milsim-demo:`)
- `src/data/seed.ts` — base fictícia inicial (criada só quando não existe)
- `src/services/` — serviços mockados assíncronos com erros de domínio (`ErroDominio`)
- `src/contexts/` — `AuthContext`, `ThemeContext`, `NotificationContext`
- `src/routes/` — páginas (TanStack Router, equivalente ao React Router)
- `src/test/regras.test.ts` — testes das regras centrais

## Temas

Dark verde-oliva e light TAN, com opção "Sistema". Preferência persistida e aplicada antes da
primeira pintura (script inline no `__root.tsx`).

## Limitações do mock e pontos de substituição

- **Autenticação**: senhas usam hash demonstrativo (`hashDemo`) apenas para não ficarem em texto
  puro no localStorage. Em produção: autenticação e autorização no servidor.
- **Persistência**: localStorage via `src/services/db.ts`. Substitua `carregarBase`/`mutarBase`
  por chamadas de API mantendo as assinaturas dos serviços.
- **Uploads**: fotos de perfil viram data URLs locais (limite 2 MB). Em produção: storage
  protegido com validação no servidor.
- **Comunicações**: nenhum e-mail, WhatsApp ou push real é enviado; notificações são internas.
- **Pagamentos**: inscrições e estornos são simulados; não há gateway, PIX ou cartão.
- **Auditoria**: demonstrativa — armazenamento local não oferece integridade de produção.
- **LGPD**: fluxos de privacidade são demonstrativos; retenção, exclusão e validação jurídica
  (incl. dados de adolescentes 15–17 anos) ficam para a etapa de produção.

## Regras centrais implementadas

- Uma inscrição ativa por usuário por evento (qualquer origem), com confirmação atômica.
- Capacidades de evento, exército, tipo e lote consumidas conjuntamente por inscrição.
- Cupons: normalização, validade, limite de usos, elegibilidade por tipo, uso contabilizado só
  na confirmação; cortesias não aceitam cupom e exigem e-mail correspondente.
- Cancelamento/estorno integral libera vaga, invalida ingresso e preserva histórico.
- Privacidade de exércitos: o participante vê apenas o próprio exército.
- Financeiro derivado dos registros de origem (sem números fixos).
