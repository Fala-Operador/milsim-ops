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

- Route loaders and module-level base reads run on the server, where browser
  storage is empty and always holds the seed data. Any screen that must show
  what the organizer just saved has to re-read the local base after mount —
  through `useVersaoBase()` (subscription to writes) or `useEventoAtual()`
  (fresh event after hydration). Never trust loader data or a `useMemo` cached
  read for post-write state.
- Branches that depend on the logged-in user (or on browser storage in general)
  need a `montado` guard set in `useEffect` before switching the rendered tree.
  Server markup has no session, so an unguarded branch causes a hydration
  mismatch and a full client re-render.
- Free text typed by users (event rules manual) is converted to HTML only
  through `src/lib/regras.ts`, which escapes everything before adding tags.
  Never inject user text as raw HTML.
- Home-page eligibility rules (location, schedule, event status, link validation) live only in `src/lib/divulgacao.ts`; admin writes go through `src/services/divulgacao.ts`, which enforces admin-only access and audit logging. Why: one place decides what the public page shows.
- All analytics collection goes through `src/services/analytics.ts` (anonymous random ids, exclusions, dedupe, attribution); aggregations/formulas live in `src/lib/analytics.ts`. Why: tracking rules stay out of components and stay consistent across panels.
- Check-in decisions live in `src/lib/checkin.ts` (pure validation/sync rules); persistence in `src/services/checkinStore.ts` keeps the simulated reference base (localStorage) separate from the device offline base and queue (IndexedDB, presence + queue in one transaction); `src/services/checkin.ts` orchestrates; `public/sw.js` caches app files network-first. Why: offline rules stay testable and storage layers never mix.
- Theme rules (visitor always dark, per-account preference) live in `src/contexts/ThemeContext.tsx` + `src/lib/localizacao.ts`; the pre-paint script there must mirror them. Why: avoid wrong-theme flashes and cross-user leakage.
- Home location: pure rules in `src/lib/localizacao.ts`, device reading + reverse geocoding (OpenStreetMap Nominatim, coords rounded to 2 decimals, never stored) in `src/services/geolocalizacao.ts`, shared state in `LocalizacaoContext` (stores only city/UF + mode). Why: header, search and sections share one location and manual choices are never overwritten silently.
