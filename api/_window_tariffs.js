// Window-cleaning tariffs, SERVER side (underscore prefix: not a Vercel route). The data block must stay identical to the
// one in assets/js/window-tariffs.js (the local check page scripts/check-window-tariffs.html compares them).
// Season is decided by the SERVICE date (YYYY-MM-DD, the cleaning date), never by the order date:
//   season 01.04–15.10, winter 16.10–31.03.
// ---- DATA (keep identical to assets/js/window-tariffs.js) ----
const VC_WIN = {
  rate: { plain: { season: 25, winter: 40 }, renovation: { season: 33, winter: 50 } },
  balustrade: { season: 20, winter: 50 },
  standaloneMin: 199
};
// ---- END DATA ----

export const WINDOW_TARIFFS = VC_WIN;
// Add-on keys of the booking snapshot → kind of window cleaning (site_addon_map: ms:wl1, wp:okna, pr:wl1).
const ADDON_KIND = { "ms:wl1": "plain", "wp:okna": "plain", "pr:wl1": "renovation" };

export function seasonFor(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const md = parseInt(m[2], 10) * 100 + parseInt(m[3], 10);
  return md >= 401 && md <= 1015 ? "season" : "winter";
}
export function windowRate(kind, iso) {
  const s = seasonFor(iso);
  return s ? (VC_WIN.rate[kind] || VC_WIN.rate.plain)[s] : null;
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : NaN);

// Independent check of the window part of a booking against the tariffs. Returns null when the order has no window
// part (or cannot be checked), otherwise { ok, season, lines, baseDelta }. `baseDelta` = how much the BASE order amount
// (before night surcharge / promo) must change; the browser applies it and recomputes the final price itself.
// Only window lines are judged — cleaning, other add-ons and the regular-order discount are never touched.
// Line prices: add-on window rows carry the TOTAL for the line (rate × m²), balustrade rows the price PER PIECE
// (that is what the pages already send).
export function checkWindowPricing(body) {
  const iso = body && body.scheduledDate;
  const season = seasonFor(iso);
  if (!season) return null;
  const lines = [];
  let baseDelta = 0;
  const addons = Array.isArray(body.addons) ? body.addons : [];
  for (const a of addons) {
    if (!a || typeof a.key !== "string") continue;
    if (ADDON_KIND[a.key]) {
      const qty = num(a.qty), claimed = num(a.price);
      if (!(qty > 0) || !(claimed >= 0)) { lines.push({ kind: "window", key: a.key, qty: a.qty, claimed: a.price, price: NaN, bad: true }); continue; }
      const price = Math.round(windowRate(ADDON_KIND[a.key], iso) * qty);
      lines.push({ kind: "window", key: a.key, qty, price, claimed });
      baseDelta += price - claimed;
    } else if (/^ok:balustrady-(season|winter)$/.test(a.key)) {
      const qty = num(a.qty), claimed = num(a.price);
      if (!(qty > 0) || !(claimed >= 0)) continue;
      const key = "ok:balustrady-" + season;
      const price = VC_WIN.balustrade[season];
      lines.push({ kind: "balustrade", key, oldKey: a.key, qty, price, claimed });
      baseDelta += qty * (price - claimed);
    }
  }
  // Stand-alone window cleaning (the mycie-okien page): the service label is always the Polish catalogue name.
  const label = typeof body.service === "string" ? body.service : "";
  if (/^\s*mycie okien/i.test(label)) {
    const m2 = num(body.areaM2);
    const kind = /po remoncie/i.test(label) ? "renovation" : "plain";
    if (m2 > 0) {
      const price = Math.max(Math.round(windowRate(kind, iso) * m2), VC_WIN.standaloneMin);
      const w = body.windows && typeof body.windows === "object" ? body.windows : null;
      let claimed;
      if (w && num(w.total) === w.total) claimed = w.total;
      else {
        // Legacy page (cached before this change) sends no `windows`: derive the base from the final price
        // (promo added back, night surcharge = x2) and compare with the expected base.
        const balClaimed = lines.filter((l) => l.kind === "balustrade").reduce((s, l) => s + l.qty * l.claimed, 0);
        const baseGuess = num(body.price) + (num(body.promoDiscountAmount) || 0);
        claimed = (Math.abs(baseGuess - balClaimed - price) < 0.51 || Math.abs(baseGuess / 2 - balClaimed - price) < 0.51) ? price : baseGuess - balClaimed;
      }
      lines.push({ kind: "window", key: "standalone", standalone: true, qty: m2, price, claimed });
      baseDelta += price - claimed;
    }
  }
  if (!lines.length) return null;
  const ok = lines.every((l) => !l.bad && l.price === l.claimed && !(l.oldKey && l.oldKey !== l.key));
  return { ok, season, lines, baseDelta };
}
