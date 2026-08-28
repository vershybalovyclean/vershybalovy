(function () {
  // Keeps footer/CTA contact links (tel:, mailto:, wa.me) in sync with the cabinet's
  // Настройки → Тексты сайта editor via the public.get_public_site_texts() RPC.
  // Hardcoded HTML values stay as-is and act as the fallback for no-JS visitors
  // or if this fetch fails, so nothing here is SEO/crawl-critical.
  var SUPABASE_URL = "https://qwwerfvyscrzwvadgudn.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_DoLfCe_aAMX1mqG1eE7w9A_R06qfDXp";

  function applyTexts(map) {
    var phone = map.contact_phone;
    var whatsapp = map.contact_whatsapp;
    var email = map.contact_email;
    var phonePattern = /\+?\d[\d\s]{5,}\d/;
    var emailPattern = /[^\s]+@[^\s]+/;

    if (phone) {
      var telHref = "tel:" + phone.replace(/\s+/g, "");
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
        a.setAttribute("href", telHref);
        if (phonePattern.test(a.textContent)) {
          a.textContent = a.textContent.replace(phonePattern, phone);
        }
      });
    }

    if (whatsapp) {
      // Preserve any existing query string (e.g. a pre-filled ?text= message) —
      // only the phone number itself should come from the cabinet.
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function (a) {
        var current = a.getAttribute("href");
        var qIdx = current.indexOf("?");
        var query = qIdx !== -1 ? current.slice(qIdx) : "";
        a.setAttribute("href", whatsapp + query);
      });
    }

    if (email) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        a.setAttribute("href", "mailto:" + email);
        if (emailPattern.test(a.textContent)) {
          a.textContent = a.textContent.replace(emailPattern, email);
        }
      });
    }
  }

  fetch(SUPABASE_URL + "/rest/v1/rpc/get_public_site_texts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY
    },
    body: "{}"
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) {
      if (!rows) return;
      var map = {};
      rows.forEach(function (row) { map[row.key] = row.value; });
      applyTexts(map);
    })
    .catch(function () {});
})();
