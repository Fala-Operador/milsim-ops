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
