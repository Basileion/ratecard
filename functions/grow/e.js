export async function onRequest() {
  return new Response(JSON.stringify({ ok: true, ping: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
