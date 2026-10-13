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

- Public carousel sections share SectionCarousel with native scrolling and scoped scrollbar suppression. Why: navigation, alignment and accessibility remain consistent without affecting analytics wrappers or other scrollable components.

- Monolith with Supabase: the browser never talks to the database. Every write
  goes through a server function in `src/api/*.functions.ts`, which runs the
  existing service code inside the unit of work (`src/server/unidade.server.ts`:
  load base → run rule → upload media → one transactional, version-checked
  `aplicar_mudancas` RPC). Never call `mutarBase` from components; it throws in
  the browser. Identity always comes from the Supabase Auth session on the
  server — never accept `usuarioId`/`perfil` from the client. Why: rules and
  authorization run where the user cannot tamper with them.
- Reads: the server returns a per-user "visão" (`src/lib/visao.ts`), the only
  read authorization boundary; `carregarBase()` in the browser returns that
  snapshot and every API response replaces it. Any new collection or sensitive
  field must be filtered in `visaoParaUsuario` (with a test in
  `src/test/visao.test.ts`). Why: the browser only ever holds what the person may see.
- Pages render only after the first visão loads (`AuthContext.carga`, gated in
  `__root.tsx`); SSR shows the skeleton. Re-render on new data through
  `useVersaoBase()`; effects that call the API must depend on `usuario?.id`, not
  the `usuario` object (a new object arrives with every response). Route
  loaders use server functions (`obterEventoFn`), never the local base.
- Schema changes: new migration in `supabase/migrations` (RLS on, no policies,
  grants only to `service_role`), update `TABELAS` in `src/lib/persistencia.ts`
  and `tabelas_base()` in SQL together. Why: the generic mapper and the RPCs
  assume one column per top-level field, in snake_case.
- Free text typed by users (event rules manual) is converted to HTML only
  through `src/lib/regras.ts`, which escapes everything before adding tags.
  Never inject user text as raw HTML.
- Home-page eligibility rules (location, schedule, event status, link validation) live only in `src/lib/divulgacao.ts`; admin writes go through `src/services/divulgacao.ts`, which enforces admin-only access and audit logging. Why: one place decides what the public page shows.
- All analytics collection goes through `src/services/analytics.ts` (anonymous random ids, exclusions, dedupe, attribution), which batches records to `src/api/analytics.functions.ts`; the server revalidates and re-applies exclusions in `src/server/analytics.server.ts`; aggregations/formulas live in `src/lib/analytics.ts`. Why: tracking rules stay out of components and stay consistent across panels.
- Check-in decisions live in `src/lib/checkin.ts` (pure validation/sync rules); persistence in `src/services/checkinStore.ts` keeps the server reference base (`checkins` table, read from the visão) separate from the device offline base and queue (IndexedDB, presence + queue in one transaction); `src/services/checkin.ts` orchestrates and `aplicarSincronizacao` accepts the queue on the server; `public/sw.js` caches app files network-first. Why: offline rules stay testable and storage layers never mix.
- Theme rules (visitor always dark, per-account preference) live in `src/contexts/ThemeContext.tsx` + `src/lib/localizacao.ts`; the pre-paint script there must mirror them. Why: avoid wrong-theme flashes and cross-user leakage.
- Home location: pure rules in `src/lib/localizacao.ts`, device reading + reverse geocoding (OpenStreetMap Nominatim, coords rounded to 2 decimals, never stored) in `src/services/geolocalizacao.ts`, shared state in `LocalizacaoContext` (stores only city/UF + mode). Why: header, search and sections share one location and manual choices are never overwritten silently.
- Event modality catalog, publish validation, preference normalization and "Para você" ordering live only in `src/lib/modalidades.ts`; persistence (device vs account) in `src/services/preferencias.ts`; shared state in `PreferenciasContext`. Why: forms, cards, filters and profile use the same stable ids and deterministic rules.
