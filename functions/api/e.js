/**
 * Privacy-friendly event ingest — Cloudflare Pages Function.
 * POST /api/e  JSON body → Workers Analytics Engine (binding GROWTH).
 * No cookies. No PII. Free-tier Analytics Engine write.
 *
 * blobs: [site, event, path, cta, utm_source, utm_campaign, utm_medium, variant, referrer_host]
 * doubles: [1]  (count)
 * indexes: [site]  (for filtering)
 */
const ALLOWED = new Set([
  "page_view",
  "cta_click",
  "kit_submit",
  "checkout_click",
  "audit_checkout",
  "pro_checkout",
  "sponsor_checkout",
  "ab_expose",
]);

function cors(origin) {
  const o = origin || "*";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: cors(context.request.headers.get("Origin")) });
}

export async function onRequestPost(context) {
  const headers = {
    ...cors(context.request.headers.get("Origin")),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), { status: 400, headers });
  }
  const event = String(body.event || "").slice(0, 40);
  if (!ALLOWED.has(event)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_event" }), { status: 400, headers });
  }
  const site = String(body.site || "").slice(0, 80);
  const path = String(body.path || "").slice(0, 200);
  const cta = String(body.cta || "").slice(0, 80);
  const utm_source = String(body.utm_source || "").slice(0, 80);
  const utm_campaign = String(body.utm_campaign || "").slice(0, 80);
  const utm_medium = String(body.utm_medium || "").slice(0, 40);
  const variant = String(body.variant || "").slice(0, 40);
  let referrer_host = "";
  try {
    if (body.referrer) referrer_host = new URL(String(body.referrer)).hostname.slice(0, 80);
  } catch {
    referrer_host = String(body.referrer || "").slice(0, 80);
  }

  const ae = context.env.GROWTH;
  if (ae && typeof ae.writeDataPoint === "function") {
    ae.writeDataPoint({
      indexes: [site || "unknown"],
      blobs: [site, event, path, cta, utm_source, utm_campaign, utm_medium, variant, referrer_host],
      doubles: [1],
    });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 204, headers });
}
