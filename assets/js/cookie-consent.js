/* ─── COOKIE CONSENT ───────────────────────────────────────────────────────
   Gate for GTM / GA4 / Meta Pixel: nothing loads until the visitor clicks
   "OK, rozumiem". Choice is remembered in localStorage. */
(function(){
  var KEY = 'vc_cookie_consent';

  function loadAnalytics(){
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PLMP4PG5');

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-Q484FKHNVE';
    document.head.appendChild(ga);
    gtag('js', new Date());
    gtag('config', 'G-Q484FKHNVE');

    if(window.VC_HAS_PIXEL){
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
  }

  function showBanner(){
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.innerHTML =
      '<div class="cb-box">' +
        '<p class="cb-text">Ta strona wykorzystuje pliki cookies analityczne i marketingowe. Więcej informacji znajdziesz w <a href="/polityka-cookies">Polityce cookies</a>.</p>' +
        '<button type="button" id="cb-ok" class="cb-btn">OK, rozumiem</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('cb-ok').addEventListener('click', function(){
      localStorage.setItem(KEY, 'accepted');
      el.remove();
      loadAnalytics();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(localStorage.getItem(KEY) === 'accepted'){
      loadAnalytics();
    } else {
      showBanner();
    }
  });
})();
