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

## Application rules
- Keep the role switcher presentation-only; owner editing is authorized independently by authenticated server functions and database policies.
- Define shared navigation in `src/components/site-header.tsx` and all theme styling through semantic tokens in `src/styles.css`, so all role views share the same identity.
- Persist only the appearance preference in browser storage; property and resident data require a proper authenticated service when introduced.

- Store tariffs and meals in Cloud tables with public SELECT and owner-only UPDATE; use a protected roles table plus verified identity for ownership, never client-side role claims.
- Use the single root AuthProvider for identity updates and cache invalidation; public owner sign-in surfaces must never load private information without server authorization.
