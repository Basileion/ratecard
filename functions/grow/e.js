/**
 * Privacy-friendly event ingest — Cloudflare Pages Function.
 * POST /api/e → Workers Analytics Engine (binding GROWTH) when bound.
 * Test events: body.test or cta/utm_campaign __grow_test / ACT-TEST
 * blobs: [site,event,path,cta,utm_source,utm_campaign,utm_medium,variant,referrer_host,test_tag]
 * doubles: [1, is_test]
 */
const ALLOWED = {
  page_view:1, cta_click:1, kit_submit:1, checkout_click:1,
  audit_checkout:1, pro_checkout:1, sponsor_checkout:1, ab_expose:1
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };
}

function isTestPayload(body) {
  if (body && (body.test === true || body.test === 1 || body.test === "1" || body.test === "true")) return true;
  var cta = String((body && body.cta) || "");
  var camp = String((body && body.utm_campaign) || "");
  return cta.indexOf("__grow_test") === 0 || camp.indexOf("__grow_test") === 0 || camp === "ACT-TEST";
}

export async function onRequest(context) {
  var request = context.request;
  var headers = corsHeaders(request.headers.get("Origin"));
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method" }), { status: 405, headers: headers });
  }
  var body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), { status: 400, headers: headers });
  }
  var event = String(body.event || "").slice(0, 40);
  if (!ALLOWED[event]) {
    return new Response(JSON.stringify({ ok: false, error: "bad_event" }), { status: 400, headers: headers });
  }
  var site = String(body.site || "").slice(0, 80);
  var path = String(body.path || "").slice(0, 200);
  var cta = String(body.cta || "").slice(0, 80);
  var utm_source = String(body.utm_source || "").slice(0, 80);
  var utm_campaign = String(body.utm_campaign || "").slice(0, 80);
  var utm_medium = String(body.utm_medium || "").slice(0, 40);
  var variant = String(body.variant || "").slice(0, 40);
  var referrer_host = "";
  try {
    if (body.referrer) referrer_host = new URL(String(body.referrer)).hostname.slice(0, 80);
  } catch (e) {
    referrer_host = String(body.referrer || "").slice(0, 80);
  }
  var test = isTestPayload(body);
  var test_tag = test ? "test" : "";
  var ae = context.env && context.env.GROWTH;
  var bound = !!(ae && typeof ae.writeDataPoint === "function");
  if (bound) {
    ae.writeDataPoint({
      indexes: [site || "unknown"],
      blobs: [site, event, path, cta, utm_source, utm_campaign, utm_medium, variant, referrer_host, test_tag],
      doubles: [1, test ? 1 : 0]
    });
  }
  return new Response(JSON.stringify({ ok: true, test: !!test, bound: bound }), { status: 200, headers: headers });
}
