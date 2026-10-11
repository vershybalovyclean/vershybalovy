/* ─── COOKIE CONSENT + GOOGLE CONSENT MODE V2 ──────────────────────────────
   Default consent signals are set to "denied" before any Google tag loads.
   GTM is then loaded unconditionally — Consent Mode governs what tags send,
   not whether they load. The visitor's choice is stored per category and
   mapped to the four Consent Mode v2 signals:

     Analityczne pliki cookie   → analytics_storage   (GA4 cookies _ga, _ga_*)
     Reklamowe pliki cookie     → ad_storage          (Google Ads cookies _gcl_*)
     Mierzenie reklam           → ad_user_data        (sending ad-measurement data to Google)
     Personalizacja reklam      → ad_personalization  (remarketing / personalised ads)

   Meta Pixel has no Consent Mode equivalent; it is loaded only when all three
   advertising categories are granted. Every change is also pushed to the
   dataLayer as {event:'vc_consent_update'} so GTM can react to it (no tag uses
   it until GTM is changed). The banner is never treated as consent by itself:
   silence, scrolling and navigation leave everything denied.

   Choice management lives on /polityka-cookies#customize (rendered into
   #vc-cookie-settings) and is linked from every footer. */
(function(){
  var KEY = 'vc_cookie_consent';
  var LANG_KEY = 'vc_lang';
  var MAX_AGE_DAYS = 365; // a stored choice older than this is asked again
  var CATS = ['analytics', 'ads', 'ad_measure', 'ad_personal'];
  var SETTINGS_URL = '/polityka-cookies#customize';
  // Choices saved by the old one-step banner ('accepted' / 'rejected') are not carried
  // over: those visitors see the new banner and choose again. Set to true to keep them
  // (owner decision — see the consent report).
  var ACCEPT_LEGACY_CHOICE = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function noneGranted(){ return { analytics: false, ads: false, ad_measure: false, ad_personal: false }; }
  function allGranted(){ return { analytics: true, ads: true, ad_measure: true, ad_personal: true }; }

  // Stored formats: 'accepted' / 'rejected' (banner before Oct 2026) or
  // {"v":2,"ts":"…","analytics":…,"ads":…,"ad_measure":…,"ad_personal":…}.
  function readChoice(){
    try {
      var raw = localStorage.getItem(KEY);
      if(!raw) return null;
      if(raw === 'accepted' || raw === 'rejected'){
        if(!ACCEPT_LEGACY_CHOICE) return null;
        var l = raw === 'accepted' ? allGranted() : noneGranted();
        l.legacy = true;
        return l;
      }
      var o = JSON.parse(raw);
      if(!o || o.v !== 2) return null;
      if(o.ts && Date.now() - Date.parse(o.ts) > MAX_AGE_DAYS * 864e5) return null;
      return o;
    } catch(e) { return null; }
  }

  function saveChoice(c){
    var o = { v: 2, ts: new Date().toISOString() };
    CATS.forEach(function(k){ o[k] = !!c[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e) {}
    return o;
  }

  function signals(c){
    return {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ad_measure ? 'granted' : 'denied',
      ad_personalization: c.ad_personal ? 'granted' : 'denied'
    };
  }

  function pixelAllowed(c){ return !!(c && c.ads && c.ad_measure && c.ad_personal); }

  function pushUpdate(c, source){
    var s = signals(c);
    dataLayer.push({
      event: 'vc_consent_update',
      vc_consent_source: source,
      vc_consent_analytics: s.analytics_storage,
      vc_consent_ads: s.ad_storage,
      vc_consent_ad_measure: s.ad_user_data,
      vc_consent_ad_personal: s.ad_personalization
    });
  }

  // A previously stored choice is restored synchronously, right after the defaults
  // and BEFORE loadGoogleTags(), so the first page_view / call-tracking request of a
  // returning visitor already carries that state. New visitors keep the defaults.
  var current = readChoice();
  if(current) gtag('consent', 'update', signals(current));

  // First-touch ad/UTM attribution (Phase 3, 24.09), forwarded only to our own
  // /api/submit when the visitor books (assets/js/booking.js). The click id / UTM values
  // of the current URL are kept in memory first; they are written to localStorage
  // (write-once, kept ATTR_TTL_DAYS) only while "Reklamowe pliki cookie" (ad_storage)
  // is granted, and removed again when it is withdrawn. A booking made on the landing
  // page itself still gets the in-memory value. Never sent to Google/Meta by this code.
  var ATTR_KEY = 'vc_first_touch';
  var ATTR_TTL_DAYS = 90;
  var ATTR_FIELDS = ['gclid','gbraid','wbraid','utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  var pendingTouch = null;
  function readStoredTouch(){
    try {
      var raw = localStorage.getItem(ATTR_KEY);
      if(!raw) return null;
      var o = JSON.parse(raw);
      if(o && o.first_visit_at && Date.now() - Date.parse(o.first_visit_at) > ATTR_TTL_DAYS * 864e5){
        localStorage.removeItem(ATTR_KEY);
        return null;
      }
      return o;
    } catch(e) { return null; }
  }
  function storeTouchIfAllowed(){
    if(!pendingTouch || !current || !current.ads) return;
    try { if(!readStoredTouch()) localStorage.setItem(ATTR_KEY, JSON.stringify(pendingTouch)); } catch(e) {}
  }
  function dropStoredTouch(){
    try { localStorage.removeItem(ATTR_KEY); } catch(e) {}
  }
  (function captureFirstTouch(){
    try {
      var params = new URLSearchParams(window.location.search);
      var found = {};
      var hasAny = false;
      ATTR_FIELDS.forEach(function(k){
        var v = params.get(k);
        if(v){ found[k] = v; hasAny = true; }
      });
      if(!hasAny) return;
      found.landing_page = window.location.pathname;
      found.first_visit_at = new Date().toISOString();
      pendingTouch = found;
    } catch(e) { /* URLSearchParams unavailable — best-effort, never fatal */ }
  })();
  // Also clears a value saved unconditionally by the pre-October code.
  if(!current || !current.ads) dropStoredTouch();
  else readStoredTouch(); // removes a value older than ATTR_TTL_DAYS
  storeTouchIfAllowed();
  // booking.js: stored first touch, else this page's not-yet-stored one, else {}.
  window.vcGetFirstTouch = function(){ return readStoredTouch() || pendingTouch || {}; };

  var TX = {
    pl:{
      title:'Ta strona używa plików cookie',
      text:'Używamy niezbędnych plików cookie do prawidłowego działania strony. Za Twoją zgodą korzystamy także z plików analitycznych i reklamowych, aby ulepszać nasze usługi i mierzyć skuteczność reklam. Swoje preferencje możesz zmienić w dowolnym momencie.',
      privacy:'Polityka prywatności', ok:'OK, akceptuję', reject:'Tylko niezbędne',
      settings:'Ustawienia cookies', dialog:'Zgoda na pliki cookie',
      cats:{
        necessary:['Obowiązkowe pliki cookie','Niezbędne do działania strony: zapamiętanie Twojego wyboru dotyczącego cookies i języka, logowanie do konta klienta, formularz rezerwacji. Nie można ich wyłączyć.'],
        analytics:['Analityczne pliki cookie','Google Analytics 4 (pliki _ga, _ga_*): liczenie odwiedzin i sposobu korzystania ze strony.'],
        ads:['Reklamowe pliki cookie','Pliki cookie Google Ads (_gcl_*) zapisujące kliknięcie w reklamę na Twoim urządzeniu oraz nasz zapis źródła wizyty z reklamy (vc_first_touch, do 90 dni), aby przypisać rezerwację do kampanii.'],
        ad_measure:['Mierzenie reklam','Przekazywanie Google danych o wizycie, zgłoszeniu lub połączeniu telefonicznym w celu pomiaru skuteczności reklam.'],
        ad_personal:['Personalizacja reklam','Dopasowanie reklam do Twoich zainteresowań (listy remarketingowe Google, odbiorcy Meta).']
      },
      always:'Zawsze aktywne', on:'Włączone', off:'Wyłączone',
      save:'Zapisz wybór', acceptAll:'Akceptuję wszystkie', rejectAll:'Tylko niezbędne',
      saved:'Zapisano Twój wybór.', none:'Nie wyrażono jeszcze zgody — działają tylko obowiązkowe pliki cookie.',
      since:'Twój wybór z dnia', meta:'Meta Pixel jest uruchamiany tylko przy włączonych wszystkich trzech kategoriach reklamowych.'
    },
    uk:{
      title:'Цей сайт використовує файли cookie',
      text:'Ми використовуємо необхідні файли cookie для правильної роботи сайту. За Вашою згодою ми також використовуємо аналітичні та рекламні файли cookie, щоб покращувати наші послуги та вимірювати ефективність реклами. Свої налаштування Ви можете змінити будь-коли.',
      privacy:'Політика конфіденційності', ok:'ОК, погоджуюсь', reject:'Лише необхідні',
      settings:'Налаштування cookies', dialog:'Згода на файли cookie',
      cats:{
        necessary:['Обов’язкові файли cookie','Потрібні для роботи сайту: збереження Вашого вибору щодо cookies і мови, вхід до кабінету клієнта, форма бронювання. Їх не можна вимкнути.'],
        analytics:['Аналітичні файли cookie','Google Analytics 4 (файли _ga, _ga_*): підрахунок відвідувань і того, як використовується сайт.'],
        ads:['Рекламні файли cookie','Файли cookie Google Ads (_gcl_*), що зберігають клік по рекламі на Вашому пристрої, та наш запис джерела візиту з реклами (vc_first_touch, до 90 днів), щоб пов’язати бронювання з кампанією.'],
        ad_measure:['Вимірювання реклами','Передача Google даних про відвідування, заявку чи телефонний дзвінок для вимірювання ефективності реклами.'],
        ad_personal:['Персоналізація реклами','Підбір реклами відповідно до Ваших інтересів (списки ремаркетингу Google, аудиторії Meta).']
      },
      always:'Завжди активні', on:'Увімкнено', off:'Вимкнено',
      save:'Зберегти вибір', acceptAll:'Прийняти всі', rejectAll:'Лише необхідні',
      saved:'Ваш вибір збережено.', none:'Згоду ще не надано — працюють лише обов’язкові файли cookie.',
      since:'Ваш вибір від', meta:'Meta Pixel запускається лише тоді, коли увімкнено всі три рекламні категорії.'
    },
    ru:{
      title:'Этот сайт использует файлы cookie',
      text:'Мы используем необходимые файлы cookie для правильной работы сайта. С Вашего согласия мы также используем аналитические и рекламные файлы cookie, чтобы улучшать наши услуги и измерять эффективность рекламы. Свои настройки Вы можете изменить в любой момент.',
      privacy:'Политика конфиденциальности', ok:'ОК, принимаю', reject:'Только необходимые',
      settings:'Настройки cookies', dialog:'Согласие на файлы cookie',
      cats:{
        necessary:['Обязательные файлы cookie','Нужны для работы сайта: сохранение Вашего выбора по cookies и языка, вход в кабинет клиента, форма бронирования. Их нельзя отключить.'],
        analytics:['Аналитические файлы cookie','Google Analytics 4 (файлы _ga, _ga_*): подсчёт посещений и того, как используется сайт.'],
        ads:['Рекламные файлы cookie','Файлы cookie Google Ads (_gcl_*), сохраняющие клик по рекламе на Вашем устройстве, и наша запись источника визита из рекламы (vc_first_touch, до 90 дней), чтобы связать бронирование с кампанией.'],
        ad_measure:['Измерение рекламы','Передача Google данных о посещении, заявке или телефонном звонке для измерения эффективности рекламы.'],
        ad_personal:['Персонализация рекламы','Подбор рекламы по Вашим интересам (списки ремаркетинга Google, аудитории Meta).']
      },
      always:'Всегда активны', on:'Включено', off:'Выключено',
      save:'Сохранить выбор', acceptAll:'Принять все', rejectAll:'Только необходимые',
      saved:'Ваш выбор сохранён.', none:'Согласие ещё не дано — работают только обязательные файлы cookie.',
      since:'Ваш выбор от', meta:'Meta Pixel запускается только при включённых всех трёх рекламных категориях.'
    },
    en:{
      title:'This site uses cookies',
      text:'We use necessary cookies to make the site work properly. With your consent we also use analytics and advertising cookies to improve our services and measure how well our ads perform. You can change your preferences at any time.',
      privacy:'Privacy Policy', ok:'OK, I accept', reject:'Necessary only',
      settings:'Cookie settings', dialog:'Cookie consent',
      cats:{
        necessary:['Necessary cookies','Required for the site to work: remembering your cookie and language choice, signing in to the client account, the booking form. They cannot be switched off.'],
        analytics:['Analytics cookies','Google Analytics 4 (cookies _ga, _ga_*): counting visits and how the site is used.'],
        ads:['Advertising cookies','Google Ads cookies (_gcl_*) that store an ad click on your device, and our own record of the ad that brought you here (vc_first_touch, up to 90 days) to link a booking to the campaign.'],
        ad_measure:['Ad measurement','Sending Google data about a visit, booking or phone call to measure how well ads perform.'],
        ad_personal:['Ad personalisation','Tailoring ads to your interests (Google remarketing lists, Meta audiences).']
      },
      always:'Always active', on:'On', off:'Off',
      save:'Save my choice', acceptAll:'Accept all', rejectAll:'Necessary only',
      saved:'Your choice has been saved.', none:'No consent given yet — only necessary cookies are active.',
      since:'Your choice from', meta:'Meta Pixel only runs when all three advertising categories are on.'
    }
  };
  function lang(){
    try { var l = localStorage.getItem(LANG_KEY); return TX[l] ? l : 'pl'; } catch(e) { return 'pl'; }
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // Phase 3 (24.09): GA4 (G-Q484FKHNVE) used to be loaded/configured TWICE — once here
  // via a standalone gtag.js + gtag('config',...), and once more by GTM's own internal
  // GA4 Configuration tag. GTM is the single source of truth now; this function only
  // bootstraps GTM itself.
  function loadGoogleTags(){
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PLMP4PG5');
  }

  function loadMetaPixel(){
    if(!window.VC_HAS_PIXEL || window.fbq) return;
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '2404996220021062');
    fbq('track', 'PageView');
  }

  // Removes first-party cookies of a revoked category on every domain level they may
  // have been written to (www.vershclean.pl, .vershclean.pl, host-only).
  function deleteCookies(test){
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    if(parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    document.cookie.split(';').forEach(function(pair){
      var name = pair.split('=')[0].trim();
      if(!name || !test(name)) return;
      domains.forEach(function(d){
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  // Applies a new choice: stores it, updates Consent Mode, notifies GTM and starts or
  // stops what depends on it. Cookies of every denied category are removed (also ones
  // left over from an earlier choice or banner version). Revoking a category that was
  // granted reloads the page, because tags already running (Meta Pixel in particular)
  // cannot be fully unloaded.
  function applyChoice(c, source){
    var before = current;
    current = saveChoice(c);
    gtag('consent', 'update', signals(current));
    pushUpdate(current, source);
    if(!current.analytics) deleteCookies(function(n){ return /^_ga(_|$)/.test(n); });
    if(!current.ads){
      deleteCookies(function(n){ return /^_gcl_/.test(n); });
      dropStoredTouch();
    } else {
      storeTouchIfAllowed();
    }
    if(!pixelAllowed(current)){
      if(window.fbq) try { fbq('consent', 'revoke'); } catch(e) {}
      deleteCookies(function(n){ return n === '_fbp' || n === '_fbc'; });
    }
    var revoked = before && CATS.some(function(k){ return before[k] && !current[k]; });
    if(revoked){
      setTimeout(function(){ location.reload(); }, 400);
      return;
    }
    if(pixelAllowed(current)) loadMetaPixel();
  }

  /* ─── BANNER ─────────────────────────────────────────────── */
  function bannerHtml(t){
    // Two equally sized buttons (accept all / necessary only) + a text link to the
    // per-category settings page.
    return '<div class="cb-box">' +
        '<div class="cb-body">' +
          '<p class="cb-title" id="cb-title">' + esc(t.title) + '</p>' +
          '<p class="cb-text">' + esc(t.text) + ' <a href="/polityka-prywatnosci" class="cb-privacy">' + esc(t.privacy) + '</a></p>' +
        '</div>' +
        '<div class="cb-actions">' +
          '<div class="cb-buttons">' +
            '<button type="button" id="cb-ok" class="cb-btn">' + esc(t.ok) + '</button>' +
            '<button type="button" id="cb-reject" class="cb-btn-secondary">' + esc(t.reject) + '</button>' +
          '</div>' +
          '<a href="' + SETTINGS_URL + '" id="cb-settings" class="cb-link">' + esc(t.settings) + '</a>' +
        '</div>' +
      '</div>';
  }

  // Keeps the floating call button visible above the banner on phones.
  function syncBannerOffset(){
    var el = document.getElementById('cookie-banner');
    var h = el ? Math.ceil(el.getBoundingClientRect().height) + 16 : 0;
    document.documentElement.style.setProperty('--vc-cb-offset', h + 'px');
    document.documentElement.classList.toggle('vc-cb-open', !!el);
  }

  function closeBanner(){
    var el = document.getElementById('cookie-banner');
    if(el) el.remove();
    syncBannerOffset();
  }

  function showBanner(){
    var t = TX[lang()];
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'cb-title');
    el.innerHTML = bannerHtml(t);
    document.body.appendChild(el);
    bindBanner(el);
    syncBannerOffset();
    window.addEventListener('resize', syncBannerOffset);
  }

  function bindBanner(el){
    el.querySelector('#cb-ok').addEventListener('click', function(){
      closeBanner();
      applyChoice(allGranted(), 'banner_accept');
    });
    el.querySelector('#cb-reject').addEventListener('click', function(){
      closeBanner();
      applyChoice(noneGranted(), 'banner_reject');
    });
  }

  /* ─── SETTINGS PANEL (/polityka-cookies#customize) ───────── */
  function renderSettings(){
    var box = document.getElementById('vc-cookie-settings');
    if(!box) return;
    var t = TX[lang()];
    var c = current || noneGranted();
    var rows = '<div class="vcs-row"><div class="vcs-txt"><p class="vcs-name">' + esc(t.cats.necessary[0]) + '</p><p class="vcs-desc">' + esc(t.cats.necessary[1]) + '</p></div>' +
      '<span class="vcs-always">' + esc(t.always) + '</span></div>';
    CATS.forEach(function(k){
      rows += '<div class="vcs-row"><div class="vcs-txt"><p class="vcs-name" id="vcs-l-' + k + '">' + esc(t.cats[k][0]) + '</p><p class="vcs-desc">' + esc(t.cats[k][1]) + '</p></div>' +
        '<label class="vcs-switch"><input type="checkbox" role="switch" data-cat="' + k + '" aria-labelledby="vcs-l-' + k + '"' + (c[k] ? ' checked' : '') + '><span class="vcs-slider" aria-hidden="true"></span>' +
        '<span class="vcs-state">' + esc(c[k] ? t.on : t.off) + '</span></label></div>';
    });
    var status = current
      ? (current.ts ? esc(t.since) + ' ' + esc(new Date(current.ts).toLocaleDateString(lang() === 'en' ? 'en-GB' : lang())) : '')
      : esc(t.none);
    box.innerHTML = '<p class="vcs-status">' + status + '</p>' + rows +
      '<p class="vcs-note">' + esc(t.meta) + '</p>' +
      '<div class="vcs-actions">' +
        '<button type="button" class="cb-btn vcs-save">' + esc(t.save) + '</button>' +
        '<button type="button" class="vcs-secondary vcs-all">' + esc(t.acceptAll) + '</button>' +
        '<button type="button" class="vcs-secondary vcs-none">' + esc(t.rejectAll) + '</button>' +
      '</div><p class="vcs-saved" role="status" aria-live="polite"></p>';
    box.querySelectorAll('input[data-cat]').forEach(function(inp){
      inp.addEventListener('change', function(){
        inp.parentNode.querySelector('.vcs-state').textContent = inp.checked ? t.on : t.off;
      });
    });
    function done(choice, source){
      closeBanner();
      applyChoice(choice, source);
      renderSettings();
      var msg = document.querySelector('#vc-cookie-settings .vcs-saved');
      if(msg) msg.textContent = t.saved;
    }
    box.querySelector('.vcs-save').addEventListener('click', function(){
      var c2 = noneGranted();
      box.querySelectorAll('input[data-cat]').forEach(function(inp){ c2[inp.getAttribute('data-cat')] = inp.checked; });
      done(c2, 'settings_save');
    });
    box.querySelector('.vcs-all').addEventListener('click', function(){ done(allGranted(), 'settings_accept_all'); });
    box.querySelector('.vcs-none').addEventListener('click', function(){ done(noneGranted(), 'settings_reject'); });
  }

  function translateLinks(){
    var t = TX[lang()];
    document.querySelectorAll('[data-vc-cookie-settings]').forEach(function(a){ a.textContent = t.settings; });
  }

  // Each page's SL() calls this after updating vc_lang, so the banner, the settings
  // panel and the footer links follow a language switch made while they are open.
  window.refreshCookieBanner = function(){
    var el = document.getElementById('cookie-banner');
    if(el){ el.innerHTML = bannerHtml(TX[lang()]); bindBanner(el); syncBannerOffset(); }
    renderSettings();
    translateLinks();
  };

  loadGoogleTags();
  if(current) pushUpdate(current, 'restored');

  document.addEventListener('DOMContentLoaded', function(){
    translateLinks();
    renderSettings();
    if(current){
      // Consent signals were already restored before the tags loaded (see top of file).
      if(pixelAllowed(current)) loadMetaPixel();
    } else if(!document.getElementById('vc-cookie-settings')){
      // On the settings page itself the panel asks; elsewhere the banner does.
      showBanner();
    }
  });
})();
