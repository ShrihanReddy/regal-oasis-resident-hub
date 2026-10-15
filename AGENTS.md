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
- Keep the role switcher presentation-only until authentication is requested; selecting a view must not grant access to private data.
- Define shared navigation in `src/components/site-header.tsx` and all theme styling through semantic tokens in `src/styles.css`, so all role views share the same identity.
- Persist only the appearance preference in browser storage; property and resident data require a proper authenticated service when introduced.
