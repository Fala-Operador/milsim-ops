<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Regras técnicas do projeto

- Writes: browser never talks to the DB; every write is a server fn in `src/api/*.functions.ts` running services inside `src/server/unidade.server.ts` (one version-checked `aplicar_mudancas` RPC). Never call `mutarBase` from components; identity only from the server session. Why: rules/authz run where users can't tamper.
- Reads: per-user "visão" (`src/lib/visao.ts`) is the only read boundary; new collections/sensitive fields are filtered in `visaoParaUsuario` with a test. Pages render after first load (`AuthContext.carga`); re-render via `useVersaoBase()`; API effects depend on `usuario?.id`. Why: browser holds only what the user may see.
- Schema: external DB, SQL applied with psql and kept in `docs/migracoes/` (RLS on, no policies, grants to `service_role`); update `TABELAS` in `src/lib/persistencia.ts` and `tabelas_base()` together. Why: generic mapper assumes one snake_case column per top-level field.
- User free text becomes HTML only via `src/lib/regras.ts` (escapes first).
- Domain rules live in one pure module each: home eligibility `src/lib/divulgacao.ts` (admin writes `src/services/divulgacao.ts`); modalities `src/lib/modalidades.ts`; ticket/coupon availability `src/lib/vendas.ts`; location `src/lib/localizacao.ts` (geocoding in `src/services/geolocalizacao.ts`, coords never stored); theme `src/contexts/ThemeContext.tsx` (pre-paint script mirrors it); event editor steps/review `src/lib/eventoEditor.ts`. Why: one place decides each rule.
- Analytics only via `src/services/analytics.ts` → `src/api/analytics.functions.ts`, revalidated in `src/server/analytics.server.ts`; formulas in `src/lib/analytics.ts`.
- Check-in: rules in `src/lib/checkin.ts`; `src/services/checkinStore.ts` keeps server base and offline IndexedDB queue separate. Why: offline rules testable, storage never mixes.
- Operator profile: grants/vouchers only via `recalcularProgressao` (`src/services/progressao.ts`, idempotent); others' profiles only via `montarPerfil`. Invoices live in private `documentos` bucket, owner-only signed URLs, never in the visão.
- Carousels share `SectionCarousel` (scoped scrollbar suppression).
- Status labels use shared nonwrapping `Badge` with fixed-size SVG icons; registration and attendance use `StatusInscricao`. Why: labels stay intact across tables, cards and detail views.
- Event editor drawer (`src/components/editorEvento/`): no `<form>`, buttons `type="button"`, backdrop never closes; drafts autosave to server, non-draft edits stay in IndexedDB until "Salvar alterações". Why: closes only on explicit action; public data not overwritten early.
- Event image crops commit their generated pixels in the crop interaction, never in a delayed step effect. Why: navigation must not cancel pending image generation.
- Support desk: admin-only triage; rules in `src/lib/suporte.ts` (access, per-user `vistaDoChamado`, encaminhamentos, derived "aguardando organizador" status, and `linkSuporte`/`resolverLinkSuporte` as the only builders of support URLs), writes in `src/services/suporte.ts` via `src/api/suporte.functions.ts`; message audience lives in each message (`canal`, `encaminhamentoId`), organizers see only their forwards and explicitly shared attachments; responsible/solution/link derive from immutable "sistema" messages (no new columns); attachments in private `documentos` bucket under `suporte/`. Why: schema can't change without DB access, internal talk must never reach participants, and notification links must resolve per viewer.
