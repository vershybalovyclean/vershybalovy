(function () {
  // Keeps footer/CTA contact links (tel:, mailto:, wa.me) in sync with the cabinet's
  // Настройки → Тексты сайта editor via the public.get_public_site_texts() RPC.
  // Hardcoded HTML values stay as-is and act as the fallback for no-JS visitors
  // or if this fetch fails, so nothing here is SEO/crawl-critical.
  var SUPABASE_URL = "https://qwwerfvyscrzwvadgudn.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_DoLfCe_aAMX1mqG1eE7w9A_R06qfDXp";

  /* ─── PHONE: cabinet sync + Google Ads forwarding number (website calls) ───
     Google's call-tracking script (GTM "Calls from Website" tag) replaces the
     number only in TEXT nodes and then rewrites the tel: href of the <a> that
     contains that text. So icon-only call buttons (#float-cta, #hngCallBtn, tab
     bar) are never switched by Google, and this sync used to overwrite every
     tel: link afterwards, undoing Google's switch.
     Only VershClean call links are handled: <a data-vc-call href="tel:…"> in the
     HTML. Google keeps the element (and the marker) when it switches the href.
       1. A marked link whose digits are neither the site number nor the cabinet
          number was switched by Google → forwarding number. The most recent
          switch observed wins, so a re-switch never leaves a stale number.
       2. Never overwrite the forwarding number; copy it to the other marked
          links (and replace older forwarding numbers on them).
       3. Without a forwarding number, plain cabinet sync as before.
     Unmarked tel: links are never read or changed. Nothing here touches consent
     or requests a number from Google. */
  var CALL_LINKS = 'a[data-vc-call][href^="tel:"]';
  var SITE_PHONE_DIGITS = "48514363538"; // number in the HTML = number in the GTM tag
  var PHONE_RE = /\+?\d[\d\s]{5,}\d/;
  var cabinetPhone = null;  // display string from the cabinet, e.g. "+48 514 363 538"
  var forwarding = null;    // { digits, tel, display } — latest Google switch
  var previousForwarding = {}; // digits of earlier forwarding numbers → replaced

  function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }
  function hrefDigits(href) { return digitsOf(String(href || "").slice(4)); }
  function isOwnNumber(d) {
    return d === SITE_PHONE_DIGITS || (cabinetPhone !== null && d === digitsOf(cabinetPhone));
  }
  // Digits this sync may replace: our own numbers and any older forwarding number.
  function isReplaceable(d) {
    return isOwnNumber(d) || previousForwarding[d] === true;
  }

  function displayFrom(link) {
    var m = (link.textContent || "").match(/\+*\(?\d[\d\s\-()]{6,}\d/);
    // Google's text; a leading "++" (international number in the tag + the "+"
    // left on the page) is collapsed to a single "+".
    return m ? m[0].replace(/^\++/, "+") : null;
  }

  function setForwarding(link) {
    var d = hrefDigits(link.getAttribute("href"));
    if (!d || isOwnNumber(d) || (forwarding && forwarding.digits === d)) return;
    if (forwarding) previousForwarding[forwarding.digits] = true;
    delete previousForwarding[d];
    forwarding = { digits: d, tel: link.getAttribute("href"), display: null };
  }

  // Display text for the current forwarding number, from a marked link that
  // Google switched (the one whose text contains a phone number).
  function refreshDisplay() {
    if (!forwarding || forwarding.display) return;
    var links = document.querySelectorAll(CALL_LINKS);
    for (var i = 0; i < links.length; i++) {
      if (hrefDigits(links[i].getAttribute("href")) !== forwarding.digits) continue;
      var disp = displayFrom(links[i]);
      if (disp && !isReplaceable(digitsOf(disp))) { forwarding.display = disp; return; }
    }
  }

  // Google switched before this script ran: no mutation was observed, so take
  // the switched marked link from the current DOM.
  function scanForForwarding() {
    if (forwarding) return;
    var links = document.querySelectorAll(CALL_LINKS);
    for (var i = 0; i < links.length; i++) {
      var d = hrefDigits(links[i].getAttribute("href"));
      if (d && !isReplaceable(d)) { setForwarding(links[i]); return; }
    }
  }

  function forEachTextNode(root, fn) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) fn(n);
  }

  function applyPhone() {
    scanForForwarding();
    refreshDisplay();
    // Google reports success but no switched VershClean link was found: do not touch anything.
    if (!forwarding && window.google_wcc_status === "success") return;
    var targetTel = forwarding ? forwarding.tel : (cabinetPhone ? "tel:" + cabinetPhone.replace(/\s+/g, "") : null);
    var targetText = forwarding ? forwarding.display : cabinetPhone;

    document.querySelectorAll(CALL_LINKS).forEach(function (a) {
      var d = hrefDigits(a.getAttribute("href"));
      // Only links still pointing at our own number (or an older forwarding
      // number) are updated — the current forwarding number is never overwritten.
      if (targetTel && isReplaceable(d) && a.getAttribute("href") !== targetTel) {
        a.setAttribute("href", targetTel);
      }
      // Text nodes only (keeps child markup such as icon/label spans intact).
      forEachTextNode(a, function (node) {
        var t = node.nodeValue;
        var nt = t;
        if (forwarding && /\+\s*\+/.test(t) && digitsOf(t).indexOf(forwarding.digits) !== -1) {
          nt = nt.replace(/\+\s*\+/, "+");
        }
        var m = nt.match(PHONE_RE);
        if (m && targetText && isReplaceable(digitsOf(m[0]))) {
          nt = nt.replace(m[0], targetText);
        }
        if (nt !== t) node.nodeValue = nt;
      });
    });
  }

  // Re-apply after DOM changes (Google's switch, language re-renders). A marked
  // link's href changing to a number that is not ours and not the current
  // forwarding number can only be Google switching (again) → latest wins.
  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; applyPhone(); }, 50);
  }
  if (window.MutationObserver && document.body) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "attributes" && r.target.matches && r.target.matches(CALL_LINKS)) {
          var d = hrefDigits(r.target.getAttribute("href"));
          if (d && !isOwnNumber(d) && !(forwarding && forwarding.digits === d) && previousForwarding[d] !== true) {
            setForwarding(r.target);
          }
        }
      }
      schedule();
    }).observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["href"]
    });
  }
  window.addEventListener("load", schedule);

  function applyTexts(map) {
    var phone = map.contact_phone;
    var whatsapp = map.contact_whatsapp;
    var email = map.contact_email;
    var emailPattern = /[^\s]+@[^\s]+/;

    if (phone) {
      cabinetPhone = phone;
      applyPhone();
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
      if (!rows) { applyPhone(); return; }
      var map = {};
      rows.forEach(function (row) { map[row.key] = row.value; });
      applyTexts(map);
    })
    .catch(function () { applyPhone(); });
})();
