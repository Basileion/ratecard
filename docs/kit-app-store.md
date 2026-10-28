# Should Ratecard also ship a Kit App Store app? (assessed 2026-10-26 ET)

Sources: https://developers.kit.com/kit-app-store/building-apps · /quick-start-guide · /authentication · /plugins/oauth-authorization

## What Kit allows
- Apps can provide **API access** (V4 API, OAuth required to publish), **plugins** (content blocks / media sources inside Kit's email editor), or both.
- Plugin-only apps that read **public endpoints with no authentication** do not need OAuth (Kit cites GIPHY as the example).
- Self-serve: Kit → Automate → Apps → Build → New app. Test privately as Draft, then submit via the Distribution tab; review ~5 business days; contact apps@kit.com.
- Listing needs icon, summary, description, resource links. App must make "meaningful use" of Kit APIs, webhooks or plugins.

## Verdict: yes, later, as a no-auth content-block plugin (low effort, distribution upside)
**"Ratecard AI Price Table"** — a content block that lets any Kit newsletter writer (AI/dev/finance newsletters) insert a live-at-send-time AI API price table: choose provider or models, get a formatted table with "Source: Ratecard, checked YYYY-MM-DD" and a link back. It reads our existing public `/api/models.json`, so no OAuth server, no database, $0 hosting.

Why it fits: every insert is a backlink and brand impression inside other people's newsletters, aimed exactly at AI-curious readers. Why not now: it depends on the site being live and stable; Kit review needs a real listing and support URL.

Not recommended: an OAuth API app (subscriber sync etc.) — needs a hosted OAuth server and token storage, which conflicts with the $0 / 2h-per-week constraint.

## Steps (≈2–3 sessions of Kurt's time once the site is live)
1. Go live first (Cloudflare Pages) so `https://ratecardai.pages.dev/api/models.json` is public with CORS `*` (already set in `dist/_headers`).
2. Add a tiny endpoint for the plugin's content-block render (static JSON pre-built per provider, e.g. `/api/kit/block-<provider>.json` returning the HTML snippet Kit expects — follow the content-block spec in Kit's docs and the `Kit/app-examples` repo). Can be a static file per provider generated in `build.mjs`; if Kit requires POST, use a free Cloudflare Pages Function.
3. In Kit: Automate → Apps → Build → **New app** "Ratecard AI Price Table". Fill icon (assets/icon-512.png), summary, description, support URL (/developers.html), privacy note (no data collected).
4. Authentication tab: enable plugin, **No authentication**.
5. Install the Draft app in Kurt's own Kit account, insert the block in a test broadcast, send to self.
6. Distribution tab → Submit; email apps@kit.com with a short description. Wait ≤5 business days, fix feedback, publish.
7. Announce in the digest and on X/LinkedIn ("free price-table block for Kit newsletters").

Nothing here has been created; no Kit account or app exists yet.
