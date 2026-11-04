// Halloween campaign — the single server-side source of truth (shared by api/submit.js and api/campaign.js).
// The file name starts with "_" so Vercel does not expose it as a route of its own.
//
// Business rules (approved 02.11.2026):
//  * a gift is granted only if BOTH hold: the cleaning date is within 26.10–07.11.2026 inclusive AND the request is
//    created before 08.11.2026 00:00 Europe/Warsaw (server clock, never the browser's);
//  * the gift must be one the site really offers, for the kind of cleaning actually ordered;
//  * nothing in the browser payload (isGift, price, date, comment line) is trusted on its own.

// 08.11.2026 00:00 Europe/Warsaw. Warsaw is on CET (UTC+1) in November — summer time ended on 25.10.2026 —
// so the instant is 07.11.2026 23:00:00 UTC. A fixed instant needs no Intl/ICU and no time-zone database.
export const HALLOWEEN_CUTOFF_MS = Date.UTC(2026, 10, 7, 23, 0, 0);
export const HALLOWEEN_DATE_START = "2026-10-26";
export const HALLOWEEN_DATE_END = "2026-11-07";

export function isHalloweenCampaignOpen(nowMs) {
  return typeof nowMs === "number" && nowMs < HALLOWEEN_CUTOFF_MS;
}

export function isHalloweenGiftDate(scheduledDate) {
  return typeof scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate) &&
    scheduledDate >= HALLOWEEN_DATE_START && scheduledDate <= HALLOWEEN_DATE_END;
}

// What the site offers (mirrors the gift pickers of sprzatanie-mieszkan-i-domow-krakow.html and
// sprzatanie-po-wyprowadzce-krakow.html). "ms:" = apartment add-on catalog key, "wp:" = move-out add-on catalog key.
const SLUG_GENERAL = "sprzatanie-mieszkan-generalne";
const SLUG_DETAILED = "sprzatanie-mieszkan-szczegolowe";
const SLUGS_MOVEOUT = ["sprzatanie-po-wyprowadzce", "wyprowadzka-bez-mebli"];
const GEN_CHOICE = ["ms:kl1", "ms:kl2", "ms:kl9", "ms:kl13"]; // general: ONE of kettle / microwave / coffee machine / dishwasher
const DET_FIXED = ["ms:kl8", "ms:kl11"];                       // detailed: hood + one kitchen cabinet, always
const DET_CHOICE = ["ms:kl1", "ms:kl2"];                       // detailed: plus microwave OR kettle
const MOVEOUT_KEY = "wp:fugi_korytarz_hw";                      // move-out: hallway floor grout, qty = m²
const MOVEOUT_MAX_M2 = 200;

// Polish names for the line the team reads in the e-mail / Telegram / Sheets text.
const GIFT_NAMES = {
  "ms:kl1": "Czajnik", "ms:kl2": "Mikrofalówka", "ms:kl9": "Zmywarka", "ms:kl13": "Ekspres do kawy",
  "ms:kl8": "Okap", "ms:kl11": "Szafka kuchenna"
};

const GIFT_LINE_PREFIX = "🎃 Halloween GRATIS:";

// The serviceLines the booking widget sends: [{slug, price, ...}]. Only a line with a positive price counts as ordered.
function orderedSlugs(serviceLines, serviceSlug) {
  const set = new Set();
  if (Array.isArray(serviceLines)) {
    for (const l of serviceLines) {
      if (l && typeof l.slug === "string" && Number(l.price) > 0) set.add(l.slug);
    }
  }
  if (typeof serviceSlug === "string" && serviceSlug) set.add(serviceSlug);
  return set;
}

// Can the choice-type gift keys be covered by the available slots?
//   pools: one array of allowed keys per slot (a slot = a general or a detailed cleaning in the order).
function choicesFit(keys, pools) {
  if (keys.length > pools.length) return false;
  if (!keys.length) return true;
  const [k, ...rest] = keys;
  for (let i = 0; i < pools.length; i++) {
    if (pools[i].includes(k) && choicesFit(rest, pools.filter((_, j) => j !== i))) return true;
  }
  return false;
}

// Verified gift rows are remembered here, by object identity. The marker cannot be forged from JSON,
// whatever the browser sends.
const VERIFIED = new WeakSet();
export function isVerifiedHalloweenGift(addon) {
  return !!addon && VERIFIED.has(addon);
}

// Decides what to do with the gifts a booking claims.
//   input: { addons, comment, clientNote, scheduledDate, serviceLines, serviceSlug, nowMs }
//   output: {
//     claimed:   the browser asked for a gift (isGift row or the site's "🎃 Halloween GRATIS" line),
//     granted:   gifts were confirmed by the server,
//     reason:    null | "expired" | "date" | "invalid"   (why a claimed gift was NOT granted),
//     addons:    the add-on list to store — only freshly built objects; confirmed gifts are marked,
//     comment:   the site-generated summary with the browser's Halloween line replaced by a server-built one (or removed),
//     giftLine:  the server-confirmed line (null if none)
//   }
export function evaluateHalloweenGifts(input) {
  const { addons, comment, clientNote, scheduledDate, serviceLines, serviceSlug, nowMs } = input;
  const rows = Array.isArray(addons) ? addons : [];

  // Only the site-generated summary may carry the Halloween line. When no clientNote field was sent, `comment` is
  // the visitor's own text (simple contact forms) and is never edited.
  const summaryIsGenerated = clientNote !== undefined && typeof comment === "string";
  const lineRe = new RegExp("^" + GIFT_LINE_PREFIX + "(?: .*)?$");
  let claimedLine = false;
  let cleanedComment = comment;
  if (summaryIsGenerated) {
    const kept = [];
    for (const ln of comment.split("\n")) {
      if (lineRe.test(ln.replace(/\r$/, ""))) claimedLine = true; else kept.push(ln);
    }
    cleanedComment = kept.join("\n");
  }

  const claimedRows = rows.filter((a) => a && a.isGift === true && typeof a.key === "string");
  const claimed = claimedRows.length > 0 || claimedLine;

  // Fresh, whitelisted copies of every add-on; isGift is dropped unless the server confirms it below.
  const out = [];
  for (const a of rows) {
    if (!a || typeof a.key !== "string" || !a.key) continue;
    out.push({ key: a.key, qty: a.qty, price: a.price, _gift: a.isGift === true });
  }

  const result = { claimed, granted: false, reason: null, addons: [], comment: cleanedComment, giftLine: null };
  const plain = () => out.filter((a) => !a._gift || Number(a.price) > 0).map((a) => ({ key: a.key, qty: a.qty, price: a.price }));
  // A rejected gift row that carried a real price stays an ordinary paid add-on; a free one disappears.

  if (!claimedRows.length) {
    result.addons = plain();
    if (claimedLine) result.reason = decideReason(nowMs, scheduledDate);
    return result;
  }

  if (!isHalloweenCampaignOpen(nowMs)) { result.reason = "expired"; result.addons = plain(); return result; }
  if (!isHalloweenGiftDate(scheduledDate)) { result.reason = "date"; result.addons = plain(); return result; }

  const slugs = orderedSlugs(serviceLines, serviceSlug);
  const hasGen = slugs.has(SLUG_GENERAL), hasDet = slugs.has(SLUG_DETAILED);
  const hasMove = SLUGS_MOVEOUT.some((s) => slugs.has(s));
  const keys = claimedRows.map((a) => a.key);
  let ok = new Set(keys).size === keys.length; // each gift at most once

  const choiceKeys = [];
  for (const a of claimedRows) {
    if (a.key === MOVEOUT_KEY) {
      const m2 = Number(a.qty);
      if (!hasMove || !(m2 > 0) || m2 > MOVEOUT_MAX_M2) ok = false;
    } else if (DET_FIXED.includes(a.key)) {
      if (!hasDet) ok = false;
    } else if (GEN_CHOICE.includes(a.key)) {
      choiceKeys.push(a.key);
    } else {
      ok = false; // not a gift the site offers
    }
  }
  if (ok) {
    const pools = [];
    if (hasGen) pools.push(GEN_CHOICE);
    if (hasDet) pools.push(DET_CHOICE);
    ok = choicesFit(choiceKeys, pools);
  }
  if (!ok) { result.reason = "invalid"; result.addons = plain(); return result; }

  // Confirmed. Price is forced to 0 and the quantity to what the offer allows.
  const granted = [];
  const nameParts = [];
  for (const a of out) {
    if (a._gift && claimedRows.some((c) => c.key === a.key)) {
      const isMove = a.key === MOVEOUT_KEY;
      const row = { key: a.key, qty: isMove ? Number(a.qty) : 1, price: 0, isGift: true };
      VERIFIED.add(row);
      granted.push(row);
      nameParts.push(isMove ? "Czyszczenie fug w korytarzu — " + Number(a.qty) + " m²" : (GIFT_NAMES[a.key] || a.key));
    } else {
      granted.push({ key: a.key, qty: a.qty, price: a.price });
    }
  }
  result.granted = true;
  result.addons = granted;
  result.giftLine = GIFT_LINE_PREFIX + " " + nameParts.join("; ") + " (potwierdzone przez serwer)";
  if (summaryIsGenerated) {
    // The server-built line goes where the browser's own used to be: right before the address line.
    const lines = cleanedComment.split("\n");
    const at = lines.findIndex((l) => l.startsWith("Adres:"));
    if (at >= 0) lines.splice(at, 0, result.giftLine); else lines.push(result.giftLine);
    result.comment = lines.join("\n");
  }
  return result;
}

// A Halloween line without any gift row in the payload: nothing to grant, say why.
function decideReason(nowMs, scheduledDate) {
  if (!isHalloweenCampaignOpen(nowMs)) return "expired";
  if (!isHalloweenGiftDate(scheduledDate)) return "date";
  return "invalid";
}
