# Ratecard — AI API pricing tracker (PWA)

Static, dependency-free (Node 20). Proposed live URL: https://ratecardai.pages.dev

- `data/models.json` — one row per model×provider: input/output/cached/batch USD per 1M tokens, context, status (verified|unverified), `source`, `checked`.
- `data/providers.json`, `data/changes.json` (only real, sourced changes).
- `scripts/seed-data.mjs` — one-off seed from the 2026-10-26 readings (keep for reference; edit JSON directly afterwards).
- `scripts/build.mjs` — builds `dist/`: rate table, finder, calculator, compare, model pages, provider pages, change log, RSS, Pro, sponsor, developers, methodology, `/api/*.json`, `openapi.json`, `llms.txt`, manifest + service worker, sitemap, `_headers`.
- `scripts/visuals.mjs` — icons + OG images (headless Chrome).
- `scripts/check.mjs` — weekly: snapshots every unique source page, diffs, writes `reports/diff-DATE.md`.

## Weekly routine (~30 min)
`npm run check` → read `reports/diff-*.md` → update `data/models.json` (+ `data/changes.json` for confirmed changes, set `checked`) → `npm run visuals && npm run build:prod` → push.

## Go-live constants (top of scripts/build.mjs)
`FORM_ACTION`, `CHECKOUT_PRO_MONTHLY`, `CHECKOUT_PRO_ANNUAL`, `CHECKOUT_SPONSOR`, `CONTACT` — all `'#pending'`.

## SEO
- `seo/head-extra.html`: paste Google / Bing (`msvalidate.01`) verification meta tags here; they are injected into every page's `<head>` on build.
- `indexnow.key`: IndexNow key; build hosts it at `/<key>.txt`. After a deploy, run `node scripts/indexnow.mjs` to submit every sitemap URL to Bing/IndexNow.
- `dist/` is committed; run `npm run build:prod` before pushing.

Local preview: `npm run preview` → http://localhost:8787
