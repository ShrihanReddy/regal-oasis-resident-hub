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
- Protect resident self-service with an encrypted server-verified shared-code session; this gate grants no individual identity or owner privileges.
- Keep maintenance reads public and poll the shared query; resident writes require the server gate, while status changes require verified ownership.
- Store rent images privately and student allotments separately; expose only active student selection behind the resident gate, with owner-only proof review.
- Anonymous feedback rows contain only message, random ID, and timestamp; never persist student or session identifiers with feedback.
- Kitchen stock and immutable history are writable only through owner-checked atomic database functions; retain column-scoped ingredient creation and recipe editing to preserve the existing frontend API.
