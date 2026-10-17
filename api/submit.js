import { randomUUID, createHash } from "node:crypto";

// ── Outbound calls with a hard timeout ───────────────────────────────────────────────
// A hung downstream service (Supabase, Resend, the Sheets webhook, Telegram relay) must
// not hold the function until the platform kills it — that is exactly how a booking can
// end up saved but never announced, and the client gets a gateway timeout for it.
// Every outbound request below goes through fetchT. Lookups that only enrich the row get
// a short limit, the notification/insert calls a longer one; all four notification
// channels run in parallel (see handler), so the whole function stays well under 10 s.
const TIMEOUT_LOOKUP_MS = 2000;
const TIMEOUT_DEFAULT_MS = 4000;
function fetchT(url, opts, ms) {
  const o = Object.assign({}, opts || {});
  if (!o.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    const isLookup = /\/rest\/v1\/(rpc\/resolve_|services\?|properties\?)|\/auth\/v1\/user/.test(String(url));
    o.signal = AbortSignal.timeout(ms || (isLookup ? TIMEOUT_LOOKUP_MS : TIMEOUT_DEFAULT_MS));
  }
  return globalThis.fetch(url, o);
}

// Phase 3 (24.09) attribution enrichment — minimal normalization, no validation
// framework. Every helper below fails to null rather than throwing: a malformed or
// oversized attribution value must never fail a real booking, only get dropped.
function cleanAttrString(v, maxLen) {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

// Same-site path only — never an absolute URL (no "://"), always starts with "/".
// A landing page is just "which page did they land on", never a place to smuggle
// an external redirect target.
function cleanLandingPage(v) {
  const s = cleanAttrString(v, 500);
  if (!s) return null;
  if (s.includes("://") || !s.startsWith("/")) return null;
  return s;
}

// Must round-trip through Date/toISOString and land in a sane range — not in the
// future, not absurdly old — otherwise it's dropped rather than stored as garbage.
function cleanIsoTimestamp(v) {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000;
  if (d.getTime() > now + 60000 || d.getTime() < now - tenYearsMs) return null;
  return d.toISOString();
}

// Pulls and normalizes all 10 first-touch attribution fields from a request body —
// shared by the booking-insert path below. Every field is independently optional;
// missing/invalid ones simply come back null, same as any other optional booking field.
function extractAttribution(body) {
  return {
    gclid: cleanAttrString(body.gclid, 200),
    gbraid: cleanAttrString(body.gbraid, 200),
    wbraid: cleanAttrString(body.wbraid, 200),
    utm_source: cleanAttrString(body.utm_source, 255),
    utm_medium: cleanAttrString(body.utm_medium, 255),
    utm_campaign: cleanAttrString(body.utm_campaign, 255),
    utm_term: cleanAttrString(body.utm_term, 255),
    utm_content: cleanAttrString(body.utm_content, 255),
    landing_page: cleanLandingPage(body.landing_page),
    first_visit_at: cleanIsoTimestamp(body.first_visit_at)
  };
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Returns the address if it is a single, plausible e-mail (used as Reply-To only —
// never as From), otherwise null.
function cleanReplyTo(v) {
  const s = cleanAttrString(v, 254);
  return s && EMAIL_RE.test(s) ? s : null;
}

// ── Booking-form validation (MASTER QA, D-009) ──────────────────────────────────────
// Mirrors assets/js/booking.js (bk_phoneValid / bk_emailValid / postal): the client
// check is only for fast feedback, this is the one that counts. A failed check answers
// 400 {error, code, field}; the browser maps `code` to a message in the visitor's
// language. Nothing here touches pricing or the order content.
const BOOKING_EMAIL_RE = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\".]{2,}$/;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = ["transfer", "blik", "cash"];
const BOOKING_LIMITS = { name: 120, phone: 30, email: 254, address: 300, postal: 6, clientNote: 2000, comment: 6000, service: 300 };

// Polish numbers: 9 digits (optionally +48 / 0048 / 48 prefix); other countries: E.164
// shape (+ and 8-15 digits). Spaces, dashes, dots and parentheses are allowed separators.
function isValidPhone(raw) {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s || s.length > BOOKING_LIMITS.phone || !/^[+\d\s().\-]+$/.test(s)) return false;
  if (s.indexOf("+") > 0 || s.lastIndexOf("+") > 0) return false;
  let d = s.replace(/\D/g, "");
  const plus = s.charAt(0) === "+";
  if (plus || d.indexOf("00") === 0) {
    if (!plus) d = d.slice(2);
    if (d.indexOf("48") === 0) return /^48[1-9]\d{8}$/.test(d);
    return /^[1-9]\d{7,14}$/.test(d);
  }
  if (d.length === 11 && d.indexOf("48") === 0) return /^48[1-9]\d{8}$/.test(d);
  return /^[1-9]\d{8}$/.test(d);
}

function isRealIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Returns null when the booking/contact body is acceptable, otherwise {code, error}.
function validateSubmission(body) {
  const L = BOOKING_LIMITS;
  const bad = (code, error) => ({ code, error });
  const str = (v) => (typeof v === "string" ? v : "");

  const name = cleanLine(body.name, L.name + 1);
  if (!name || name.length < 2 || name.length > L.name || str(body.name).length > 4 * L.name) {
    return bad("invalid_name", "Podaj imię i nazwisko");
  }
  if (!isValidPhone(body.phone)) return bad("invalid_phone", "Podaj poprawny numer telefonu");

  const email = str(body.email).trim();
  if (email && (email.length > L.email || !BOOKING_EMAIL_RE.test(email))) {
    return bad("invalid_email", "Podaj poprawny adres e-mail");
  }
  const postal = str(body.postalCode).trim();
  if (postal && !/^\d{2}-\d{3}$/.test(postal)) return bad("invalid_postal", "Podaj kod pocztowy w formacie 00-000");

  if (str(body.address).length > L.address || str(body.clientNote).length > L.clientNote ||
      str(body.comment).length > L.comment || str(body.service).length > L.service) {
    return bad("too_long", "Jedno z pól jest za długie");
  }

  // A real calendar booking additionally needs a valid date/time, an address and (if sent)
  // a known payment method.
  if (body.scheduledDate) {
    if (!isRealIsoDate(body.scheduledDate)) return bad("invalid_date", "Nieprawidłowa data");
    const warsawToday = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    const earliest = new Date(Date.parse(warsawToday + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    if (body.scheduledDate < earliest) return bad("invalid_date", "Termin jest w przeszłości");
    if (body.scheduledTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(body.scheduledTime))) {
      return bad("invalid_time", "Nieprawidłowa godzina");
    }
    if (!str(body.address).trim()) return bad("invalid_address", "Podaj adres");
    if (body.paymentMethod && PAYMENT_METHODS.indexOf(body.paymentMethod) === -1) {
      return bad("invalid_payment", "Nieprawidłowy sposób płatności");
    }
  }
  return null;
}

// From defaults to Resend's sandbox sender exactly as before; set the optional
// `resend_from` env var (an address on a Resend-verified domain) to change it.
async function sendEmail(text, name, replyTo, subjectPrefix) {
  const RESEND_API_KEY = process.env.Resend_api_key;
  const TO_EMAIL = process.env.to_email;
  if (!RESEND_API_KEY || !TO_EMAIL) return false;
  try {
    const r = await fetchT("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.resend_from || "onboarding@resend.dev",
        to: [TO_EMAIL],
        subject: (subjectPrefix || "") + "Nowe zgłoszenie od " + name,
        text: text,
        ...(cleanReplyTo(replyTo) ? { reply_to: cleanReplyTo(replyTo) } : {})
      })
    });
    return r.ok;
  } catch (error) {
    return false;
  }
}

// ── Partner-program sign-up (program-partnerski.html#dolacz) ─────────────────────
// A lead for the company to call back — no account, contract, code or commission is
// created here. Delivered to the partner inbox (alias of the main Workspace mailbox)
// and to the owner's Telegram "attention" topic; deliberately NOT written to the
// bookings Google Sheet (different columns/purpose) or to Supabase.
const PARTNER_TYPES = ["Agencja nieruchomości", "Firma remontowo-budowlana", "Firma przeprowadzkowa", "Klient indywidualny", "Inne"];
const PARTNER_SUBJECT = "Nowe zgłoszenie partnerskie — Vershy Property Care";

// Single-line, control-character-free, length-capped text (names/phones/urls end up in
// an e-mail body and a Telegram message — no line breaks or header-like injection).
function cleanLine(v, maxLen) {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function sendPartnerEmail(text, replyTo) {
  const RESEND_API_KEY = process.env.Resend_api_key;
  if (!RESEND_API_KEY) return false;
  try {
    const r = await fetchT("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // Defaults to the sender domain already verified in Resend for Supabase Auth mail
        // (README: mail.vershclean.pl). Override with `partner_from_email` if needed.
        from: process.env.partner_from_email || "Vershy Property Care <noreply@mail.vershclean.pl>",
        to: [process.env.partner_to_email || "partnerzy@vershclean.pl"],
        subject: PARTNER_SUBJECT,
        text: text,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });
    // Log the status only — never the payload or response (personal data).
    if (!r.ok) console.error("partner e-mail rejected by Resend, status", r.status);
    return r.ok;
  } catch (error) {
    console.error("partner e-mail request failed");
    return false;
  }
}

async function handlePartnerSignup(req, res, body) {
  // Honeypot: a real visitor never sees/fills this field. Pretend success so bots get no signal.
  if (cleanLine(body.website, 200)) return res.status(200).json({ success: true });

  const name = cleanLine(body.name, 120);
  const phone = cleanLine(body.phone, 30);
  const emailRaw = cleanLine(body.email, 254);
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
  const partnerType = cleanLine(body.partnerType, 80);

  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  if (!name || name.length < 2) return res.status(400).json({ error: "Imię i nazwisko są wymagane" });
  if (!phone || !/^[+\d\s()\-.]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return res.status(400).json({ error: "Podaj poprawny numer telefonu" });
  }
  if (emailRaw && !email) return res.status(400).json({ error: "Podaj poprawny adres e-mail" });
  if (!partnerType || PARTNER_TYPES.indexOf(partnerType) === -1) {
    return res.status(400).json({ error: "Wybierz rodzaj współpracy" });
  }

  const pageUrl = cleanLine(body.pageUrl, 300) || cleanLine(req.headers && (req.headers.referer || req.headers.referrer), 300);
  const when = new Date();
  const whenPl = when.toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });

  const text = "Nowe zgłoszenie z formularza partnerskiego\n\n" +
    "Imię i nazwisko: " + name + "\n" +
    "Telefon: " + phone + "\n" +
    "Email: " + (email || "nie podano") + "\n" +
    "Rodzaj współpracy: " + partnerType + "\n" +
    "Data zgłoszenia: " + whenPl + " (czas polski), " + when.toISOString() + "\n" +
    "Źródło: Program partnerski\n" +
    "Strona: " + (pageUrl || "brak danych") + "\n\n" +
    "Zgłoszenie nie tworzy konta, umowy ani zobowiązań — skontaktuj się z osobą, aby omówić warunki współpracy.";

  const [emailResult, telegramResult] = await Promise.allSettled([
    sendPartnerEmail(text, email),
    notifySiteEvent({
      event: "site_contact",
      name, phone,
      service: "Program partnerski — " + partnerType,
      comment: "Zgłoszenie partnerskie" + (email ? " · " + email : ""),
      source: pageUrl || null
    })
  ]);
  const emailOk = emailResult.status === "fulfilled" && emailResult.value === true;
  const telegramOk = telegramResult.status === "fulfilled" && telegramResult.value === true;

  // Success only if a human was actually notified through at least one channel.
  if (!emailOk && !telegramOk) {
    console.error("Partner sign-up: all notification channels failed");
    return res.status(500).json({ error: "Błąd wysyłania" });
  }
  if (!emailOk) console.error("Partner sign-up: e-mail channel failed, delivered via Telegram only");
  return res.status(200).json({ success: true });
}

// Legacy Telegram migration (26.09): quick-contact/estimate submissions (no
// requests row at all) and the booking-DB-insert-failure fallback both used to
// go through sendTelegram() below, straight to a single hardcoded personal
// chat (TELEGRAM_CHAT_ID) — a completely separate destination from the v2
// admin group/topics system. Both now route through notify-owner-event's
// site_contact/site_booking_failed events into the same "🔥 Требует внимания"
// (TELEGRAM_TOPIC_ATTENTION) topic every other attention-needing event already
// uses — no new topic, no fake request row, no fake id. sendTelegram() itself
// and TELEGRAM_CHAT_ID are retired below now that nothing calls them.
async function notifySiteEvent(eventBody) {
  const SUPABASE_URL = process.env.supabase_url;
  if (!SUPABASE_URL) return false;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/notify-owner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody)
    });
    return r.ok;
  } catch (error) {
    return false;
  }
}

// Пингует владельца/менеджеров в Telegram (см. vershy-admin/supabase/
// functions/notify-owner-event) о только что созданной заявке — заменяет
// старый sendTelegram() для реальных бронирований: тот бил в ОДИН
// захардкоженный chat_id, этот рассылает всем owner/manager с подключённым
// ботом. Требует, чтобы requests-строка с этим id уже реально была вставлена
// (см. insertSupabaseRequest/handler) — иначе функция просто не найдёт
// строку и молча ничего не пошлёт.
async function notifyOwnerEvent(requestId) {
  const SUPABASE_URL = process.env.supabase_url;
  if (!SUPABASE_URL || !requestId) return false;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/notify-owner-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "request", id: requestId })
    });
    return r.ok;
  } catch (error) {
    return false;
  }
}

// Web Push counterpart to notifyOwnerEvent() above — same {event, id} contract
// as send-push's other callers (client.js/app.js/cleaner.js/partner.js, see
// supabase/functions/send-push/index.ts), just reached here via a raw fetch
// instead of the supabase-js client those use, since this is an anonymous
// server-side request with no user session to invoke functions.invoke() with.
// Staging smoke test (10.09) found this call was simply never added when the
// push rework shipped — site bookings only ever reached notifyOwnerEvent
// (Telegram), never send-push, so owner/manager got no push for a new booking
// coming from the public site (client-cabinet repeat bookings were fine,
// see client.js's own notifyPush('new_request', ...) call).
//
// Needs an Authorization header, unlike notify-owner-event right above it:
// send-push's own header comment claims verify_jwt=false ("Публичная...
// вызывается из всех 4 кабинетов"), but the deployed function actually
// enforces verify_jwt=true at the gateway — every existing caller is a
// logged-in cabinet using supabase-js's functions.invoke(), which attaches
// the user's session JWT automatically, so this was never visible until an
// anonymous (no-session) caller tried it and got a 401
// UNAUTHORIZED_NO_AUTH_HEADER before the function body ever ran. Reusing the
// same server-side anon key insertSupabaseRequest() already uses below is
// enough to pass that gate — send-push resolves the real recipient from the
// {event, id} row itself, not from whoever's key was on the request.
async function notifyPushOwner(requestId) {
  const SUPABASE_URL = process.env.supabase_url;
  const SUPABASE_ANON_KEY = process.env.Supabase_anon_key;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !requestId) return false;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ event: "new_request", id: requestId })
    });
    return r.ok;
  } catch (error) {
    return false;
  }
}

async function logToSheet(data) {
  const URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!URL) return false;
  try {
    const r = await fetchT(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return r.ok;
  } catch (error) {
    return false;
  }
}

// Resolves a client-typed "VC-0000" partner code to that partner's profiles.id,
// so the admin panel's commission/attribution tools (which key off requests.partner_id)
// work automatically for site bookings instead of requiring a manager to notice the
// code in the email/Telegram text and attribute it by hand. Returns null on any
// mismatch/error — an unrecognized or missing code must never block the booking.
async function resolvePartnerId(partnerCode, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!partnerCode || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    // RLS blocks anon reads of profiles entirely, so this goes through a narrow
    // SECURITY DEFINER RPC (public.resolve_partner_id) that returns only the id —
    // never a direct table query, which would leak partner email/phone/commission.
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_partner_id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ code: partnerCode })
    });
    if (!r.ok) return null;
    const id = await r.json();
    return id || null;
  } catch (error) {
    return null;
  }
}

// Marks a marketing promo code as used (increments used_count) once a booking that
// actually applied it has been saved — never at validation time, so a client who
// merely checks a code without booking doesn't eat into its usage_limit. Best-effort,
// same reliability as the existing manual "+1" button in the cabinet's Маркетинг tab.
async function incrementPromoUsage(promoCode, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!promoCode || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/increment_promo_usage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_code: promoCode })
    });
  } catch (error) {
    // Non-critical — the booking itself already succeeded regardless of this.
  }
}

// Resolves a page-known service slug (e.g. 'sprzatanie-po-remoncie') to services.id
// so admin-panel reporting/pricing tools that key off requests.service_id work for
// site bookings. services is publicly readable by design (RLS: services_select_public)
// specifically for this lookup, so no RPC is needed here. Returns null on any
// mismatch/error or when the site left the slug empty (ambiguous multi-service order) —
// requests.service_label (already sent separately) is the documented fallback.
async function resolveServiceId(serviceSlug, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!serviceSlug || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/services?slug=eq." + encodeURIComponent(serviceSlug) + "&select=id", {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + SUPABASE_ANON_KEY }
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows[0] && rows[0].id) || null;
  } catch (error) {
    return null;
  }
}

// Verifies a client's access_token (mirrored by the client cabinet into the
// vc_at cookie the site reads — see assets/js/client-session.js) via Supabase's
// own Auth API, and returns the real, server-verified user id. Never trusts a
// client-supplied id directly: this endpoint runs on the anon key, and the
// requests table accepts anonymous inserts (guests must be able to book), so
// a body field alone could otherwise be used to falsely attribute a booking to
// an arbitrary client's cabinet. Returns null on any missing/expired/invalid
// token — the booking still proceeds as a guest order in that case.
async function resolveClientId(clientToken, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!clientToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + clientToken }
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user.id : null;
  } catch (error) {
    return null;
  }
}

// Confirms a client-picked "saved address" actually belongs to that same
// verified client before linking it — property_id is just an FK on requests,
// so without this check a manipulated id could attach someone else's saved
// address (name/access notes/photos) to an unrelated booking.
async function resolvePropertyId(propertyId, clientId, clientToken, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!propertyId || !clientId || !clientToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    // RLS (properties_select_staff) only lets a 'client' role see rows where
    // client_id = auth.uid() — that identity comes from the JWT in Authorization,
    // so this must run as the client's own verified token, not the anon key
    // (which has no auth.uid() and would just get an empty result either way).
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/properties?id=eq." + encodeURIComponent(propertyId) + "&client_id=eq." + encodeURIComponent(clientId) + "&select=id", {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": "Bearer " + clientToken }
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return (rows[0] && rows[0].id) || null;
  } catch (error) {
    return null;
  }
}

// Covers the gap left by resolvePropertyId above: that one only links a
// property the client already explicitly picked from their saved-addresses
// dropdown. Guests, and clients who just typed a fresh address instead of
// picking a saved one, never got a properties row at all — the admin
// panel's "Obiekty" section stayed empty regardless of real booking volume
// (see ТЗ §28 audit). Finds-or-creates via a narrow SECURITY DEFINER RPC
// (same reasoning as resolvePartnerId above — anon key has no RLS access to
// properties otherwise) so this is safe to call for every booking that has
// an address but no already-resolved propertyId.
async function resolveOrCreatePropertyId(address, clientId, name, phone, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!address || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_or_create_property", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_client_id: clientId, p_address: address, p_name: name, p_phone: phone })
    });
    if (!r.ok) return null;
    const id = await r.json();
    return id || null;
  } catch (error) {
    return null;
  }
}

// Resolves site_key -> addon_services.id via a narrow SECURITY DEFINER RPC —
// anon has no direct SELECT on addon_services (staff/client only, see schema.sql),
// and addon_services itself has no slug column since one site_key like "al7" can
// mean a different real addon depending on which page sent it (page-prefixed,
// see site_addon_map). Returns a {site_key: addon_service_id} map; any key with
// no match (typo, retired addon) is simply absent from the result, not an error —
// insertRequestAddons below skips those rather than failing the whole booking.
async function resolveAddonServiceIds(keys, SUPABASE_URL, SUPABASE_ANON_KEY) {
  if (!Array.isArray(keys) || !keys.length || !SUPABASE_URL || !SUPABASE_ANON_KEY) return {};
  try {
    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_addon_service_ids", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ p_keys: keys })
    });
    if (!r.ok) return {};
    const rows = await r.json();
    const map = {};
    for (const row of rows) map[row.site_key] = row.addon_service_id;
    return map;
  } catch (error) {
    return {};
  }
}

// Halloween campaign (26.10–07.11.2026 inclusive) GRATIS add-ons: eligibility is
// re-checked here against the booking's actual scheduled_date (never trusted from
// the client alone) before any addon.isGift is allowed to reach request_addons at
// price 0 — a request for a date outside the window has its gift flags stripped
// (forced back to a real price-only addon, which the normal price>0 filter below
// then drops like any other zero/invalid line).
const HALLOWEEN_GIFT_START = "2026-10-26";
const HALLOWEEN_GIFT_END = "2026-11-07";
function isHalloweenGiftEligible(scheduledDate) {
  return typeof scheduledDate === "string" && scheduledDate >= HALLOWEEN_GIFT_START && scheduledDate <= HALLOWEEN_GIFT_END;
}

// Ночные заказы (21:00–7:00, по просьбе владелицы) автоматически помечаются
// requests.is_urgent — то же поле, что уже используется для ручной пометки
// срочности менеджером: влияет на бейдж ⚡ в кабинете клинера и текст
// Telegram-уведомления. scheduledTime приходит как "HH:MM" или "HH:MM:SS".
function isNightTime(scheduledTime) {
  if (!scheduledTime) return false;
  const hour = parseInt(scheduledTime.slice(0, 2), 10);
  if (Number.isNaN(hour)) return false;
  return hour >= 21 || hour < 7;
}

async function insertSupabaseRequest(data) {
  const SUPABASE_URL = process.env.supabase_url;
  const SUPABASE_ANON_KEY = process.env.Supabase_anon_key;
  // Only real calendar bookings carry a scheduledDate (requests.scheduled_date is NOT NULL
  // in the admin panel's schema) — quick contact/estimate forms don't collect one, so they
  // correctly stay out of the admin panel's "requests" table and keep going to email/Telegram/Sheets only.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("insertSupabaseRequest: missing supabase_url/Supabase_anon_key env vars — booking not written to admin panel");
    return false;
  }
  if (!data.scheduledDate) return false;
  const startedAt = Date.now();
  let rowInserted = false; // true as soon as the requests row itself is confirmed saved
  let partial = false;     // row saved, but its service lines / add-ons were not
  try {
    const partnerId = await resolvePartnerId(data.partnerCode, SUPABASE_URL, SUPABASE_ANON_KEY);
    const serviceId = await resolveServiceId(data.serviceSlug, SUPABASE_URL, SUPABASE_ANON_KEY);
    const clientId = await resolveClientId(data.clientToken, SUPABASE_URL, SUPABASE_ANON_KEY);
    let propertyId = clientId ? await resolvePropertyId(data.propertyId, clientId, data.clientToken, SUPABASE_URL, SUPABASE_ANON_KEY) : null;
    // Enrichment lookups fail to null; if the database is struggling (the lookups above
    // used up their time limits) skip the optional property find-or-create and go straight
    // to the insert, so an outage is reported to the client within a few seconds.
    if (!propertyId && data.address && (Date.now() - startedAt) < 3000) {
      propertyId = await resolveOrCreatePropertyId(data.address, clientId, data.name, data.phone, SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    // client_comment = only the client's own words, matching how manual/
    // client-cabinet requests already work. hasClientNote mirrors the same
    // flag the Telegram text below already uses correctly — the full calendar
    // widget (booking.js) always sends clientNote (possibly ''), so this
    // resolves to clientNote-or-null for every real booking; comment (the
    // auto-generated summary) is no longer used as a fallback for those.
    // Simple contact forms that never send clientNote at all keep today's
    // behavior (comment IS the message) — but those never reach this function
    // anyway (no scheduledDate, see guard above).
    // Client Full QA GO (18.09): renamed from requests.notes (client-only vs
    // staff-only internal_notes split) — this write path is 100% client text,
    // never staff-authored, so it always goes into client_comment.
    const hasClientNote = data.clientNote !== undefined;
    const clientComment = hasClientNote ? (data.clientNote || null) : (data.comment || null);

    const freqTimes = (typeof data.freqTimes === "number" && data.freqTimes > 1) ? data.freqTimes : 1;

    // Phase 3 (24.09): first-touch ad/UTM attribution, forwarded only by booking.js
    // (the sole caller that ever reaches this function — see the scheduledDate guard
    // above). Every field independently normalizes to null on anything malformed/
    // oversized; a missing or invalid attribution value never blocks the booking itself.
    const attribution = extractAttribution(data);

    const r = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        ...(data.id ? { id: data.id } : {}),
        client_id: clientId,
        property_id: propertyId,
        client_name: data.name,
        client_phone: data.phone,
        client_email: data.email || null,
        client_language: data.clientLanguage || null,
        address: data.address || null,
        scheduled_date: data.scheduledDate,
        scheduled_time: data.scheduledTime || null,
        service_label: data.service || null,
        price: data.price || null,
        client_comment: clientComment,
        partner_id: partnerId,
        service_id: serviceId,
        source: "website",
        is_urgent: isNightTime(data.scheduledTime),
        area_m2: (typeof data.areaM2 === "number") ? data.areaM2 : null,
        orders_per_month: freqTimes,
        requested_payment_method: data.paymentMethod || null,
        invoice_requested: !!data.invoiceRequested,
        marketing_photo_consent: typeof data.marketingPhotoConsent === "boolean" ? data.marketingPhotoConsent : null,
        promo_code: data.promoCode || null,
        promo_discount_amount: (typeof data.promoDiscountAmount === "number") ? data.promoDiscountAmount : 0,
        ...attribution
      })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      // A confirmed duplicate is ONLY: HTTP 409 + unique violation of the primary key
      // (requests_pkey) + (when the error names the key) our own id. Any other 409/4xx/5xx
      // is a real failure and is reported as such — it must never turn into a success.
      if (r.status === 409 && /requests_pkey/.test(errText) && (!/Key \(id\)/.test(errText) || errText.indexOf(String(data.id)) !== -1)) {
        return "duplicate";
      }
      console.error("insertSupabaseRequest failed", r.status, errText);
      return false;
    }
    rowInserted = true;
    if (data.promoCode) {
      await incrementPromoUsage(data.promoCode, SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // request_services — one row per selected tier (MIXED-capable, see
    // sprzatanie-mieszkan-i-domow-krakow.html); each line's own slug is resolved
    // independently since a MIXED order has no single services.id for the whole
    // request. price is the TOTAL for the line (qty × rate), matching how
    // request_services.price is documented/used everywhere else (recalcRequestPanel
    // in the admin's app.js does the same qty×rate snapshot).
    if (Array.isArray(data.serviceLines) && data.serviceLines.length) {
      const lineRows = [];
      for (const line of data.serviceLines) {
        const lineServiceId = await resolveServiceId(line.slug, SUPABASE_URL, SUPABASE_ANON_KEY);
        if (!lineServiceId) continue; // no matching catalog row — skip rather than violate the not-null FK
        const qty = line.qty || 1;
        lineRows.push({
          request_id: data.id, service_id: lineServiceId, qty: qty,
          area_m2: line.m2 || null, price: (line.price || 0) * qty, sort_order: lineRows.length
        });
      }
      if (lineRows.length) {
        const rsRes = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/request_services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal"
          },
          body: JSON.stringify(lineRows)
        });
        if (!rsRes.ok) { partial = true; console.error("request_services insert failed", rsRes.status, await rsRes.text().catch(() => "")); }
      }
    }

    // request_addons — resolved via site_addon_map (see resolveAddonServiceIds).
    // price/qty are the SITE's own booking-time snapshot (data.addons[].price),
    // never re-derived from the current addon_services.price — the catalog price
    // can move independently of what this specific client actually saw and paid.
    if (Array.isArray(data.addons) && data.addons.length) {
      const giftsAllowed = isHalloweenGiftEligible(data.scheduledDate);
      const keys = data.addons.map(a => a.key).filter(Boolean);
      const idMap = await resolveAddonServiceIds(keys, SUPABASE_URL, SUPABASE_ANON_KEY);
      const addonRows = data.addons
        .filter(a => a.key && idMap[a.key] && (a.price > 0 || (a.isGift && giftsAllowed)))
        .map(a => ({ request_id: data.id, addon_service_id: idMap[a.key], price: a.price || 0, qty: a.qty || 1, is_gift: !!(a.isGift && giftsAllowed) }));
      if (addonRows.length) {
        const raRes = await fetchT(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/request_addons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal"
          },
          body: JSON.stringify(addonRows)
        });
        if (!raRes.ok) { partial = true; console.error("request_addons insert failed", raRes.status, await raRes.text().catch(() => "")); }
      }
    }

    // true = fully saved; "partial" = the request row exists but its service lines / add-ons
    // did not all get saved (the e-mail/Telegram text still carries the full order).
    return partial ? "partial" : true;
  } catch (error) {
    console.error("insertSupabaseRequest threw", error);
    // The row itself may already be saved (an error/timeout in a later step must not turn a
    // saved booking into a "not saved" answer — a retry would only hit the duplicate path).
    return rowInserted ? "partial" : false;
  }
}

// Limits for the "[POWTÓRKA]" retry notice. Kept in memory of the running function
// instance (no extra storage needed): best-effort across cold starts, but it bounds any
// burst that reaches a warm instance — which is exactly what a replay loop does.
const RETRY_NOTICES_PER_ORDER = 2;       // per order id, per hour
const RETRY_NOTICES_GLOBAL = 10;         // per instance, per 10 minutes
const retryNoticeLog = new Map();        // orderId -> [timestamps]
let retryNoticeGlobal = [];              // timestamps
function allowRetryNotice(orderId) {
  const now = Date.now();
  retryNoticeGlobal = retryNoticeGlobal.filter((t) => now - t < 600000);
  if (retryNoticeGlobal.length >= RETRY_NOTICES_GLOBAL) return false;
  if (retryNoticeLog.size > 500) {
    for (const [k, v] of retryNoticeLog) { if (!v.some((t) => now - t < 3600000)) retryNoticeLog.delete(k); }
  }
  const times = (retryNoticeLog.get(orderId) || []).filter((t) => now - t < 3600000);
  if (times.length >= RETRY_NOTICES_PER_ORDER) { retryNoticeLog.set(orderId, times); return false; }
  times.push(now);
  retryNoticeLog.set(orderId, times);
  retryNoticeGlobal.push(now);
  return true;
}

// Same order = same id: the browser's requestId is combined with the order content, so a
// retry of an identical order maps to the same requests.id (duplicate-safe), while any
// other order — even one that wrongly reuses a requestId — gets its own row.
function deriveRequestId(clientRequestId, content) {
  const h = createHash("sha256").update(clientRequestId + "\u0001" + JSON.stringify(content)).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4 layout
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const x = b.toString("hex");
  return x.slice(0, 8) + "-" + x.slice(8, 12) + "-" + x.slice(12, 16) + "-" + x.slice(16, 20) + "-" + x.slice(20);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.body && req.body.formType === "partner") {
    return handlePartnerSignup(req, res, req.body);
  }

  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ error: "Nieprawidłowe żądanie", code: "invalid_request" });
  }

  let { name, phone, service, comment, clientNote, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price, clientToken, propertyId, clientLanguage, addons, areaM2, freqTimes, serviceLines, paymentMethod, invoiceRequested, marketingPhotoConsent, promoDiscountAmount, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, first_visit_at } = req.body;

  // Format/length validation of the contact fields (name, phone, e-mail, postal code,
  // and for calendar bookings date/time/address/payment). Same rules as the browser.
  const invalid = validateSubmission(req.body);
  if (invalid) {
    return res.status(400).json({ error: invalid.error, code: invalid.code });
  }
  // From here on name/phone/e-mail are single-line, control-character-free strings
  // (they end up in an e-mail subject/body, a Telegram message and a Google Sheet).
  name = cleanLine(name, BOOKING_LIMITS.name);
  phone = cleanLine(phone, BOOKING_LIMITS.phone);
  email = cleanLine(email, BOOKING_LIMITS.email) || "";

  // The full calendar-booking widget (booking.js) sends `comment` as an
  // auto-generated order summary (service/addons/price/date/address/...)
  // and the client's own free-text note separately as `clientNote`, so
  // "Komentarz:" below shows only what the client actually typed, not the
  // whole summary. Simpler contact forms never send clientNote — for them
  // `comment` IS the client's message, exactly as before.
  const hasClientNote = clientNote !== undefined;
  const text = "Nowe zgłoszenie ze strony Vershy Property Care!\n\n" +
    "Imię: " + name + "\n" +
    "Telefon: " + phone + "\n" +
    "Usługa: " + (service || "nie wybrano") + "\n" +
    (partnerCode ? "Kod partnera: " + partnerCode + "\n" : "") +
    (hasClientNote && comment ? "\n" + comment + "\n" : "") +
    "Komentarz: " + ((hasClientNote ? clientNote : comment) || "brak");

  // Real calendar bookings get their id generated here (instead of letting Postgres
  // default it) so it's already known before insertSupabaseRequest ever runs — needed
  // to call notifyOwnerEvent() afterwards without a RETURNING round-trip, which anon
  // inserts can't safely do (see the RLS SELECT-gap note in insertSupabaseRequest).
  const hasBooking = !!scheduledDate;
  // Duplicate-submit protection: the browser sends a per-order `requestId` (UUID v4) that
  // is reused for retries of the SAME order. The row id is derived from that requestId AND
  // the order content, so (a) a retry of an identical order hits the primary key and is
  // recognised as a duplicate, while (b) a different order can never be swallowed as a
  // "duplicate" — even if a client wrongly reuses a requestId it gets its own row. A
  // missing or malformed requestId falls back to a server-generated id (old cached pages
  // keep working exactly as before, just without retry protection).
  const clientRequestId = typeof req.body.requestId === "string" && UUID_V4_RE.test(req.body.requestId) ? req.body.requestId.toLowerCase() : null;
  const requestId = !hasBooking ? null
    : clientRequestId
      ? deriveRequestId(clientRequestId, [name, phone, scheduledDate, scheduledTime || "", address || "", price == null ? null : price, service || "", comment || "", clientNote || "", JSON.stringify(addons || [])])
      : randomUUID();

  // The database row is written first so the outcome is known before anything is sent.
  // If the insert fails, e-mail / Google Sheets / Telegram below still carry the full order
  // (clearly marked as NOT saved), so a Supabase outage never makes a lead disappear.
  let inserted = null; // true | "partial" | "duplicate" | false (hasBooking only)
  if (hasBooking) {
    inserted = await insertSupabaseRequest({ name, phone, service, comment, clientNote, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price, clientToken, propertyId, clientLanguage, addons, areaM2, freqTimes, serviceLines, paymentMethod, invoiceRequested, marketingPhotoConsent, promoDiscountAmount, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, first_visit_at, id: requestId });
  }

  // Confirmed duplicate = this exact order is already saved. The client gets success and
  // no second row exists. The first attempt may have died after the insert but before the
  // owner was notified (function timeout, dropped connection) and that cannot be told
  // from here, so one clearly marked "retry" notice goes out (e-mail + Telegram attention
  // topic). It is not a new request and is never written to Google Sheets (no duplicate row).
  if (inserted === "duplicate") {
    // Bounded: at most RETRY_NOTICES_PER_ORDER notices per order id per hour and
    // RETRY_NOTICES_GLOBAL per 10 minutes, so replaying the same order over and over can
    // never turn into an endless stream of notifications. Beyond the limit the client
    // still gets success (the order is saved) but nothing more is sent.
    if (!allowRetryNotice(requestId)) return res.status(200).json({ success: true });
    await Promise.allSettled([
      sendEmail("POWTÓRZONE WYSŁANIE tej samej rezerwacji (id " + requestId + ").\nRezerwacja jest już zapisana w systemie (panel → Заявки) — to powiadomienie wysłano na wypadek, gdyby pierwsze nie dotarło.\n\n" + text, name, email, "[POWTÓRKA] "),
      notifySiteEvent({
        event: "site_contact",
        name, phone, service: (service || "") + " · POWTÓRZONA rezerwacja",
        comment: "Ta sama rezerwacja wysłana ponownie — jest już zapisana w systemie (id " + requestId + ").",
        source: null
      })
    ]);
    return res.status(200).json({ success: true });
  }

  const saved = hasBooking && !!inserted; // true or "partial"
  let mailText = text;
  let mailPrefix = "";
  if (hasBooking && !saved) {
    mailPrefix = "[NIE ZAPISANO W SYSTEMIE] ";
    mailText = "UWAGA: ta rezerwacja NIE została zapisana w systemie (awaria bazy danych). Klient dostał komunikat o błędzie i może ponowić zgłoszenie. Oddzwoń lub dopisz zlecenie ręcznie.\n\n" + text;
  } else if (inserted === "partial") {
    mailText = "UWAGA: rezerwacja zapisana, ale jej pozycje (usługi/dodatki) nie zostały w pełni zapisane w systemie — uzupełnij ręcznie wg treści poniżej.\n\n" + text;
  }

  // All channels run in parallel and each has its own time limit (fetchT), so one slow or
  // dead service can neither delay the others nor push the function past the platform
  // limit. Telegram for a saved booking goes through notifyOwnerEvent (the row exists by
  // now); for an unsaved one through site_booking_failed (v2 ATTENTION topic) as an extra
  // channel. None of this is ever allowed to substitute for the insert in the answer to
  // the client below — a notification reaching the owner is not proof the request is saved.
  const tasks = [
    sendEmail(mailText, name, email, mailPrefix),
    // Sheets appendRow parses values like user input: "+48 514 363 538" became a
    // formula (#ERROR!), "+48514363538" a number without "+". A leading apostrophe
    // stores the phone as plain text exactly as typed (the apostrophe is not shown).
    // Sheets only — every other channel still gets `phone` unchanged.
    logToSheet({ date: new Date().toISOString(), name: name, phone: phone ? "'" + phone : "", service: service || "", partnerCode: partnerCode || "", comment: (hasBooking && !saved ? mailPrefix : "") + ((hasClientNote ? clientNote : comment) || "") })
  ];
  if (hasBooking) {
    tasks.push(saved ? notifyOwnerEvent(requestId) : notifySiteEvent({
      event: "site_booking_failed",
      name, phone, service: service || null,
      date: scheduledDate || null, address: address || null,
      comment: (hasClientNote ? clientNote : comment) || null
    }));
    if (saved) tasks.push(notifyPushOwner(requestId));
  } else {
    // Quick contact/estimate forms never become a requests row — routed to the
    // v2 admin group's ATTENTION topic instead of the old single personal chat.
    tasks.push(notifySiteEvent({
      event: "site_contact",
      name, phone, service: service || null,
      comment: (hasClientNote ? clientNote : comment) || null,
      source: (req.headers && (req.headers.referer || req.headers.referrer)) || null
    }));
  }
  // Awaited so everything finishes before the function returns (Vercel doesn't
  // guarantee background execution after the response is sent).
  const settled = await Promise.allSettled(tasks);
  const emailResult = settled[0];
  const sheetResult = settled[1];
  const telegramOk = settled[2].status === "fulfilled" && settled[2].value === true;

  if (hasBooking) {
    // A real calendar booking is only a success if it was actually saved.
    if (!saved) {
      console.error("Booking not saved to Supabase", { emailResult, sheetResult, telegramOk });
      return res.status(500).json({ error: "Nie udało się zapisać rezerwacji. Spróbuj ponownie lub skontaktuj się z nami telefonicznie.", code: "not_saved" });
    }
    // Saved, but no channel confirmed the owner notification: the request still sits in the
    // admin's incoming queue — leave a loud trace in the function log.
    const pushOk = settled[3] && settled[3].status === "fulfilled" && settled[3].value === true;
    const mailOk = emailResult.status === "fulfilled" && emailResult.value === true;
    if (!telegramOk && !pushOk && !mailOk) console.error("NOTIFICATION_FAILED: booking saved but no channel confirmed", { requestId });
    return res.status(200).json({ success: true });
  }

  // Quick contact/estimate forms have no database row to check — "sent" means a human
  // was actually notified via at least one channel (email/Telegram/Sheets).
  const anySucceeded = telegramOk === true
    || [emailResult, sheetResult].some(function (r) { return r.status === "fulfilled" && r.value === true; });

  if (!anySucceeded) {
    console.error("All notification channels failed", { emailResult, sheetResult, telegramOk });
    return res.status(500).json({ error: "Błąd wysyłania" });
  }

  return res.status(200).json({ success: true });
}
