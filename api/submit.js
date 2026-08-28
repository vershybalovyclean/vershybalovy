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

async function sendTelegram(text) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) return false;
  try {
    const r = await fetch("https://api.telegram.org/bot" + TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: text })
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

async function insertSupabaseRequest(data) {
  const SUPABASE_URL = process.env.supabase_url;
  const SUPABASE_ANON_KEY = process.env.Supabase_anon_key;
  // Only real calendar bookings carry a scheduledDate (requests.scheduled_date is NOT NULL
  // in the admin panel's schema) — quick contact/estimate forms don't collect one, so they
  // correctly stay out of the admin panel's "requests" table and keep going to email/Telegram/Sheets only.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !data.scheduledDate) return false;
  try {
    const partnerId = await resolvePartnerId(data.partnerCode, SUPABASE_URL, SUPABASE_ANON_KEY);
    const serviceId = await resolveServiceId(data.serviceSlug, SUPABASE_URL, SUPABASE_ANON_KEY);
    const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        client_name: data.name,
        client_phone: data.phone,
        client_email: data.email || null,
        address: data.address || null,
        scheduled_date: data.scheduledDate,
        scheduled_time: data.scheduledTime || null,
        service_label: data.service || null,
        price: data.price || null,
        notes: data.comment || null,
        partner_id: partnerId,
        service_id: serviceId,
        source: "website"
      })
    });
    if (r.ok && data.promoCode) {
      await incrementPromoUsage(data.promoCode, SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return r.ok;
  } catch (error) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone, service, comment, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Imię i telefon są wymagane" });
  }

  const text = "Nowe zgłoszenie ze strony Verschybalovy!\n\n" +
    "Imię: " + name + "\n" +
    "Telefon: " + phone + "\n" +
    "Usługa: " + (service || "nie wybrano") + "\n" +
    (partnerCode ? "Kod partnera: " + partnerCode + "\n" : "") +
    "Komentarz: " + (comment || "brak");

  const results = await Promise.allSettled([
    sendEmail(text, name),
    sendTelegram(text),
    logToSheet({ date: new Date().toISOString(), name: name, phone: phone, service: service || "", partnerCode: partnerCode || "", comment: comment || "" })
  ]);

  // Awaited so it finishes before the serverless function returns (Vercel doesn't guarantee
  // background execution after the response is sent), but kept OUT of the anySucceeded
  // check above: a booking should count as "sent" based on whether a human was actually
  // notified (email/Telegram/Sheets), never on whether the admin-panel database write
  // succeeded — otherwise a total failure of all three notification channels could be
  // silently masked as success by this alone.
  await insertSupabaseRequest({ name, phone, service, comment, partnerCode, promoCode, serviceSlug, email, address, scheduledDate, scheduledTime, price });

  const anySucceeded = results.some(function (r) { return r.status === "fulfilled" && r.value === true; });

  if (!anySucceeded) {
    console.error("All notification channels failed", results);
    return res.status(500).json({ error: "Błąd wysyłania" });
  }

  return res.status(200).json({ success: true });
}
