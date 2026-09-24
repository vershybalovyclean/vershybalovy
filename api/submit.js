import { randomUUID } from "node:crypto";

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

async function sendEmail(text, name) {
  const RESEND_API_KEY = process.env.Resend_api_key;
  const TO_EMAIL = process.env.to_email;
  if (!RESEND_API_KEY || !TO_EMAIL) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [TO_EMAIL],
        subject: "Nowe zgłoszenie od " + name,
        text: text
      })
    });
    return r.ok;
  } catch (error) {
    return false;
  }
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/notify-owner-event", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/notify-owner-event", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/send-push", {
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
    const r = await fetch(URL, {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_partner_id", {
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
    await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/increment_promo_usage", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/services?slug=eq." + encodeURIComponent(serviceSlug) + "&select=id", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/properties?id=eq." + encodeURIComponent(propertyId) + "&client_id=eq." + encodeURIComponent(clientId) + "&select=id", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_or_create_property", {
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
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/resolve_addon_service_ids", {
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
  try {
    const partnerId = await resolvePartnerId(data.partnerCode, SUPABASE_URL, SUPABASE_ANON_KEY);
    const serviceId = await resolveServiceId(data.serviceSlug, SUPABASE_URL, SUPABASE_ANON_KEY);
    const clientId = await resolveClientId(data.clientToken, SUPABASE_URL, SUPABASE_ANON_KEY);
    let propertyId = clientId ? await resolvePropertyId(data.propertyId, clientId, data.clientToken, SUPABASE_URL, SUPABASE_ANON_KEY) : null;
    if (!propertyId && data.address) {
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

    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/requests", {
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
        promo_code: data.promoCode || null,
        promo_discount_amount: (typeof data.promoDiscountAmount === "number") ? data.promoDiscountAmount : 0,
        ...attribution
      })
    });
    if (!r.ok) {
      console.error("insertSupabaseRequest failed", r.status, await r.text().catch(() => ""));
      return false;
    }
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
        const rsRes = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/request_services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal"
          },
          body: JSON.stringify(lineRows)
        });
        if (!rsRes.ok) console.error("request_services insert failed", rsRes.status, await rsRes.text().catch(() => ""));
      }
    }

    // request_addons — resolved via site_addon_map (see resolveAddonServiceIds).
    // price/qty are the SITE's own booking-time snapshot (data.addons[].price),
    // never re-derived from the current addon_services.price — the catalog price
    // can move independently of what this specific client actually saw and paid.
    if (Array.isArray(data.addons) && data.addons.length) {
      const keys = data.addons.map(a => a.key).filter(Boolean);
      const idMap = await resolveAddonServiceIds(keys, SUPABASE_URL, SUPABASE_ANON_KEY);
      const addonRows = data.addons
        .filter(a => a.key && idMap[a.key] && a.price > 0)
        .map(a => ({ request_id: data.id, addon_service_id: idMap[a.key], price: a.price, qty: a.qty || 1 }));
      if (addonRows.length) {
        const raRes = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/request_addons", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY, "Prefer": "return=minimal"
          },
          body: JSON.stringify(addonRows)
        });
        if (!raRes.ok) console.error("request_addons insert failed", raRes.status, await raRes.text().catch(() => ""));
      }
    }

    return true;
  } catch (error) {
    console.error("insertSupabaseRequest threw", error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone, service, comment, clientNote, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price, clientToken, propertyId, clientLanguage, addons, areaM2, freqTimes, serviceLines, paymentMethod, invoiceRequested, promoDiscountAmount, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, first_visit_at } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Imię i telefon są wymagane" });
  }

  // The full calendar-booking widget (booking.js) sends `comment` as an
  // auto-generated order summary (service/addons/price/date/address/...)
  // and the client's own free-text note separately as `clientNote`, so
  // "Komentarz:" below shows only what the client actually typed, not the
  // whole summary. Simpler contact forms never send clientNote — for them
  // `comment` IS the client's message, exactly as before.
  const hasClientNote = clientNote !== undefined;
  const text = "Nowe zgłoszenie ze strony Verschybalovy!\n\n" +
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
  const requestId = hasBooking ? randomUUID() : null;

  const [emailResult, sheetResult] = await Promise.allSettled([
    sendEmail(text, name),
    logToSheet({ date: new Date().toISOString(), name: name, phone: phone, service: service || "", partnerCode: partnerCode || "", comment: (hasClientNote ? clientNote : comment) || "" })
  ]);

  // Telegram is handled sequentially, not in the allSettled batch above: for a real
  // booking it must fan out via notifyOwnerEvent (which needs the DB row to already
  // exist), falling back to notifySiteEvent's site_booking_failed (v2 ATTENTION topic)
  // only as a best-effort extra channel if that insert itself failed — so a Supabase
  // outage still reaches someone instead of going silent. It is never allowed to substitute for the insert
  // in the client-facing success check below: a notification reaching the owner is not
  // the same as the booking actually being saved, and conflating the two previously let
  // a client see "Dziękujemy" for a request that was never written to the database.
  // Awaited so both finish before the function returns (Vercel doesn't guarantee
  // background execution after the response is sent).
  let telegramOk;
  let inserted = null;
  if (hasBooking) {
    inserted = await insertSupabaseRequest({ name, phone, service, comment, clientNote, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price, clientToken, propertyId, clientLanguage, addons, areaM2, freqTimes, serviceLines, paymentMethod, invoiceRequested, promoDiscountAmount, gclid, gbraid, wbraid, utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, first_visit_at, id: requestId });
    telegramOk = inserted ? await notifyOwnerEvent(requestId) : await notifySiteEvent({
      event: "site_booking_failed",
      name, phone, service: service || null,
      date: scheduledDate || null, address: address || null,
      comment: (hasClientNote ? clientNote : comment) || null
    });
    if (inserted) await notifyPushOwner(requestId);
  } else {
    // Quick contact/estimate forms never become a requests row — routed to the
    // v2 admin group's ATTENTION topic instead of the old single personal chat.
    telegramOk = await notifySiteEvent({
      event: "site_contact",
      name, phone, service: service || null,
      comment: (hasClientNote ? clientNote : comment) || null,
      source: (req.headers && (req.headers.referer || req.headers.referrer)) || null
    });
  }

  if (hasBooking) {
    // A real calendar booking is only a success if it was actually saved — the
    // notification channels above are a best-effort side conversation with the owner,
    // not proof the client's request exists anywhere.
    if (!inserted) {
      console.error("Booking not saved to Supabase", { emailResult, sheetResult, telegramOk });
      return res.status(500).json({ error: "Nie udało się zapisać rezerwacji. Spróbuj ponownie lub skontaktuj się z nami telefonicznie." });
    }
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
