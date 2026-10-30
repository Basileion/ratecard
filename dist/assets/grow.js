/**
 * grow.js — tiny shared event + A/B helper (no cookies, privacy-friendly).
 * Include once per page. Config via window.__GROW__ = { site, experiments? }.
 *
 * Events POSTed to same-origin /api/e (Pages Function → Analytics Engine).
 * UTM params persisted in localStorage for the session attribution window.
 * A/B: sticky via localStorage key grow:ab:<experimentId>.
 */
(function () {
  var cfg = window.__GROW__ || {};
  var SITE = cfg.site || location.hostname;
  var ENDPOINT = cfg.endpoint || "/api/e";
  var L = null;
  try { L = window.localStorage; } catch (e) {}

  function qs(k) {
    try { return new URLSearchParams(location.search).get(k) || ""; } catch (e) { return ""; }
  }

  function readUtm() {
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    var out = {};
    var found = false;
    keys.forEach(function (k) {
      var v = qs(k);
      if (v) { out[k] = v; found = true; }
    });
    if (found && L) {
      try { L.setItem("grow:utm", JSON.stringify({ t: Date.now(), ...out })); } catch (e) {}
      return out;
    }
    if (L) {
      try {
        var raw = L.getItem("grow:utm");
        if (raw) {
          var o = JSON.parse(raw);
          if (o && o.t && Date.now() - o.t < 7 * 864e5) return o;
        }
      } catch (e) {}
    }
    return {};
  }

  function variant(experimentId, arms) {
    arms = arms || ["A", "B"];
    var key = "grow:ab:" + experimentId;
    if (L) {
      try {
        var existing = L.getItem(key);
        if (existing && arms.indexOf(existing) >= 0) return existing;
      } catch (e) {}
    }
    var pick = arms[Math.floor(Math.random() * arms.length)];
    if (L) {
      try { L.setItem(key, pick); } catch (e) {}
    }
    return pick;
  }

  function send(event, extra) {
    extra = extra || {};
    var utm = readUtm();
    var payload = {
      site: SITE,
      event: event,
      path: location.pathname + location.hash,
      cta: extra.cta || "",
      utm_source: utm.utm_source || "",
      utm_campaign: utm.utm_campaign || "",
      utm_medium: utm.utm_medium || "",
      variant: extra.variant || (cfg.variant || ""),
      referrer: document.referrer || "",
    };
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
        return;
      }
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: "POST", body: body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" });
    } catch (e) {}
  }

  // Auto page_view
  send("page_view");

  // Capture UTM on load
  readUtm();

  // Click tracking: [data-grow], checkout / Kit / audit links
  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var el = t.closest("[data-grow], a[data-pay], a[href*='kit.com/products'], a[href*='/audit'], button[type='submit']");
      if (!el) return;
      var cta = el.getAttribute("data-grow") || el.getAttribute("data-pay") || "";
      var href = (el.getAttribute && el.getAttribute("href")) || "";
      if (/kit\.com\/products\/.*audit/i.test(href) || /\/audit/i.test(href) || cta === "audit") {
        send("audit_checkout", { cta: cta || "audit" });
      } else if (/kit\.com\/products/i.test(href) || cta === "pro" || el.getAttribute("data-pay") === "pro") {
        if (/sponsor/i.test(href) || cta === "sponsor") send("sponsor_checkout", { cta: cta || "sponsor" });
        else send("pro_checkout", { cta: cta || "pro" });
      } else if (cta) {
        send("cta_click", { cta: cta });
      } else if (el.tagName === "BUTTON" && el.closest("form[action*='kit.com']")) {
        /* submit handler covers Kit */
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    function (ev) {
      var f = ev.target;
      if (!f || !f.action) return;
      if (/kit\.com\/forms/i.test(f.action)) {
        send("kit_submit", { cta: f.getAttribute("data-src") || f.getAttribute("data-form") || "kit" });
      }
    },
    true
  );

  // Public API
  window.grow = {
    track: send,
    variant: variant,
    expose: function (experimentId, arms) {
      var v = variant(experimentId, arms);
      send("ab_expose", { variant: experimentId + ":" + v, cta: experimentId });
      return v;
    },
  };

  // Optional experiments from config
  if (cfg.experiments && cfg.experiments.length) {
    cfg.experiments.forEach(function (ex) {
      var v = window.grow.expose(ex.id, ex.arms || ["A", "B"]);
      document.documentElement.setAttribute("data-ab-" + ex.id, v);
      if (ex.apply) {
        try { ex.apply(v); } catch (e) {}
      }
    });
  }
})();
