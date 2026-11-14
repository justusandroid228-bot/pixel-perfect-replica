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

- Android app: `npm run build` builds the static SPA directly in dist with Nitro disabled; `npm run build:web` preserves the hosted Worker build. Capacitor and scripts/android-setup.sh use dist, and CI generates android/ through that script so configuration cannot drift.
- Android release signing uses scripts/android-release.py with GitHub secrets passed via environment, a temporary restricted keystore, and apksigner verification before artifact upload so credentials are not interpolated into shell commands or committed.
- Recover failed lazy page downloads with one session-scoped reload per address; manual retry reloads the document because router invalidation can reuse a rejected module import.
