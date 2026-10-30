# Growth event tracker

Privacy-friendly custom events via Pages Function `functions/grow/e.js` → Workers Analytics Engine.

**Binding (required for persistence):** In Cloudflare Pages → Settings → Bindings → Add Analytics Engine:
- Variable name: `GROWTH`
- Dataset: `growth_events`
Then redeploy. Free tier only.

Client: `grow.js` (or inlined). Test events: `{ "test": true }` or `cta`/`utm_campaign` starting with `__grow_test` / `ACT-TEST` → excluded by `analyze.py`.

See `/workspace/growth/tracker/README.md` and `/workspace/growth/utm-convention.md`.
