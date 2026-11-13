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

- Android app: `CAPACITOR=1 vite build` produces a static SPA in dist/client that Capacitor bundles; the android/ folder is generated in CI by scripts/android-setup.sh (not committed) so it never drifts from config.
- Android release signing uses scripts/android-release.py with GitHub secrets passed via environment, a temporary restricted keystore, and apksigner verification before artifact upload so credentials are not interpolated into shell commands or committed.
- Recover failed lazy page downloads with one session-scoped reload per address; manual retry reloads the document because router invalidation can reuse a rejected module import.
