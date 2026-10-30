# Growth event tracker

Client `grow.js` posts to Worker **https://growth-ingest.basileion-ops.workers.dev**.

Test events: `{ "test": true }` or cta/utm_campaign `__grow_test` / `ACT-TEST`.

Enable Analytics Engine (free) to persist: https://dash.cloudflare.com/552c4ecb2438c0156cd65d0fc269c83c/workers/analytics-engine

Pages `functions/` removed — deploys failed while AE disabled.
