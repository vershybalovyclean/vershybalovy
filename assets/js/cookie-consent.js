/* ─── COOKIE CONSENT + GOOGLE CONSENT MODE V2 ──────────────────────────────
   Default consent signals are set to "denied" before any Google tag loads.
   GTM/GA4 are then loaded unconditionally — Consent Mode governs what they
   actually send, not whether they load. The visitor's Accept/Reject choice
   updates the consent signals via gtag('consent','update',...) and is
   remembered in localStorage. Meta Pixel has no consent-mode equivalent, so
   it stays gated behind explicit acceptance. */
(function(){
  var KEY = 'vc_cookie_consent';
  var LANG_KEY = 'vc_lang';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  var CB_TX = {
    pl:{text:'Ta strona wykorzystuje pliki cookies analityczne i marketingowe. Więcej informacji znajdziesz w <a href="/polityka-cookies">Polityce cookies</a>.', btn:'OK, rozumiem', reject:'Odrzuć'},
    uk:{text:'Цей сайт використовує аналітичні та рекламні файли cookie. Більше інформації в <a href="/polityka-cookies">Політиці cookies</a>.', btn:'ОК, зрозуміло', reject:'Відхилити'},
    ru:{text:'Этот сайт использует аналитические и рекламные файлы cookie. Подробнее в <a href="/polityka-cookies">Политике cookies</a>.', btn:'ОК, понятно', reject:'Отклонить'},
    en:{text:'This site uses analytics and marketing cookies. More information in the <a href="/polityka-cookies">Cookie Policy</a>.', btn:'OK, got it', reject:'Reject'}
  };
  function cbLang(){
    var l = localStorage.getItem(LANG_KEY);
    return CB_TX[l] ? l : 'pl';
  }

  function loadGoogleTags(){
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PLMP4PG5');

    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-Q484FKHNVE';
    document.head.appendChild(ga);
    gtag('js', new Date());
    gtag('config', 'G-Q484FKHNVE');
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

  function grantConsent(){
    gtag('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted'
    });
    loadMetaPixel();
  }

  function denyConsent(){
    gtag('consent', 'update', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function showBanner(){
    var t = CB_TX[cbLang()];
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.innerHTML =
      '<div class="cb-box">' +
        '<p class="cb-text">' + t.text + '</p>' +
        '<div class="cb-actions">' +
          '<button type="button" id="cb-ok" class="cb-btn">' + t.btn + '</button>' +
          '<button type="button" id="cb-reject" class="cb-btn-reject">' + t.reject + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('cb-ok').addEventListener('click', function(){
      localStorage.setItem(KEY, 'accepted');
      el.remove();
      grantConsent();
    });
    document.getElementById('cb-reject').addEventListener('click', function(){
      localStorage.setItem(KEY, 'rejected');
      el.remove();
      denyConsent();
    });
  }

  // The banner renders once at DOMContentLoaded, using whatever language was
  // already saved from a PREVIOUS visit — but the very first time a visitor
  // clicks a language pill, the banner is usually already showing and had no
  // way to hear about that click. Each page's SL() calls this after updating
  // vc_lang, so the banner (if still open) re-renders in the new language
  // instead of staying stuck in whatever it first loaded as.
  window.refreshCookieBanner = function(lang){
    var el = document.getElementById('cookie-banner');
    if(!el) return;
    var t = CB_TX[lang] || CB_TX.pl;
    el.querySelector('.cb-text').innerHTML = t.text;
    el.querySelector('#cb-ok').textContent = t.btn;
    el.querySelector('#cb-reject').textContent = t.reject;
  };

  loadGoogleTags();

  document.addEventListener('DOMContentLoaded', function(){
    var saved = localStorage.getItem(KEY);
    if(saved === 'accepted'){
      grantConsent();
    } else if(saved === 'rejected'){
      denyConsent();
    } else {
      showBanner();
    }
  });
})();
