# Ratecard — launch kit (drafts only; nothing posted)

Voice: precise, calm, numerical. No exclamation marks, no emoji, no "game-changer". Lead with a number, back it with a source. Replace URL with the live one.

## Show HN
**Title:** Show HN: Ratecard – AI API list prices with source links and check dates

**Body:**
I kept rebuilding the same spreadsheet: input, output, cached and batch rates per 1M tokens across providers, each with a link so finance would trust it. Ratecard is that spreadsheet, public.

- 85 price rows across 14 providers and gateways (OpenAI, Anthropic, Google, xAI, DeepSeek, Together, Fireworks, Groq, OpenRouter, Perplexity, Azure, Bedrock and others). 78 verified against the provider's own page on 2026-10-26; the rest are marked Unverified with blank prices rather than guesses.
- A calculator: monthly tokens, cache hit rate, batch share → monthly/annual cost and savings vs your current model. The URL encodes the scenario.
- A change log of dated, sourced changes. Example: Gemini 3.8 Flash's paid rate is scheduled to double on 2027-01-01.
- Static site, no tracking scripts, installable as a PWA. JSON API, OpenAPI and llms.txt are free (CC BY 4.0).

A weekly script snapshots every source page and diffs it. Corrections welcome — every row links its source, so they're easy to check.

## Reddit (r/LocalLLaMA, r/MachineLearning weekly thread, r/SaaS, r/startups — read each sub's self-promo rules first)
**Title:** I compiled published AI API rates (input/output/cached/batch per 1M tokens) with source links and check dates
**Body:** Short version of the HN post + one concrete finding, e.g. "At 800M input / 120M output a month, moving a Sonnet 4.6 workload to Sonnet 5.5 at 40% cache hits is about $12.4K/yr cheaper at list price." Ask: "What rates or providers am I missing?"

## X (thread)
1. AI API pricing, as a rate card: 85 models, 14 providers, every price linked to the provider's own page and dated. [link]
2. Input, output, cached input and batch per 1M tokens — side by side. Unverified rows stay blank; we don't guess.
3. Announced increases worth calendaring: Gemini 4 Argon promo ends 2026-12-01 ($2→$4 input). Gemini 3.8 Flash doubles 2027-01-01.
4. Calculator: tokens, cache hit %, batch share → monthly and annual cost vs your current model. Shareable URL.
5. Free weekly digest of changes. JSON API + llms.txt for agents. [link]

## LinkedIn
AI spend is becoming a line item that finance asks about. The inputs are public, but scattered across fifteen pricing pages with different units, caching rules and batch discounts.

Ratecard puts them on one rate card: per-1M-token input, output, cached and batch prices for 85 models across 14 providers, each linked to the source and dated. A calculator turns monthly volumes into an annual figure and the savings versus your current model.

Two dates worth noting for 2027 budgets: Google's Gemini 4 Argon promotional pricing ends 1 December, and Gemini 3.8 Flash's paid rate doubles on 1 January.

Free to use. A weekly digest covers what changed. [link]

## Product Hunt
- **Name:** Ratecard
- **Tagline (60):** AI API prices per 1M tokens — sourced, dated, comparable
- **Description:** Published input, output, cached and batch rates for 85 AI models across 14 providers, each linked to the official page with a check date. Cost calculator with cache and batch modeling, side-by-side compare, change log, and a free JSON API. Installable as an app.
- **First comment:** why it exists (finance-grade sourcing), what "Unverified" means, Pro roadmap ($9/mo: rate-change and budget alerts, CSV exports, spend forecast).
- **Gallery:** assets/og/home.png, calculator.png, compare.png, pro.png (1200×630) + screenshots/*.png.

## Sequencing (2h/week)
Week 1: go live, submit sitemap to Google Search Console. Week 2: Show HN (Tue–Thu, 8–10am ET). Week 3: LinkedIn + X. Week 4: Reddit (one sub per week). Week 6+: Product Hunt once the digest has issues to show.
