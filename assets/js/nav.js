// Сезонная кампания шапки (01.10, финал): ЕДИНСТВЕННЫЙ переключатель для
// ОБА состояния — не только "включить Halloween", но и "какой постоянный
// branding показывать, когда Halloween выключен". С этого ТЗ старый
// logo.png + отдельная надпись .hdr-brand (легаси-разметка в HTML) больше
// НЕ является тем, что реально показывается ни в одном состоянии — это
// просто noscript/до-JS fallback на случай, если этот файл не выполнился.
// И Halloween, и новый classic full logo — цельные композиции (герб+
// Vershy+PROPERTY CARE), поэтому в обоих случаях .hdr-brand скрывается и
// src меняется, но КАЖДОЕ состояние получает СВОЙ класс (halloween-campaign
// / classic-logo) со своей геометрией в base.css — Halloween-specific
// offsets/overlap/margin-top никогда не применяются к classic logo и
// наоборот (см. ТЗ п.3: "same CSS + different src" запрещён явно).
var SEASONAL_CAMPAIGN = { halloweenLogo: true };
(function(){
  document.querySelectorAll('.hdr-logo').forEach(function(a){
    var img = a.querySelector('img');
    if (SEASONAL_CAMPAIGN.halloweenLogo) {
      if (img) img.src = 'assets/img/logo-halloween.webp';
      a.classList.add('halloween-campaign');
      a.classList.remove('classic-logo');
    } else {
      if (img) img.src = 'assets/img/logo-classic-full.webp';
      a.classList.add('classic-logo');
      a.classList.remove('halloween-campaign');
    }
  });
  // Компактный brand-V — тот же принцип: Halloween ON использует
  // предоставленный Owner файл (своя геометрия, см. .halloween-v-icon в
  // mobile-tabbar.css), Halloween OFF — исходный logo.png, уже стоящий в
  // разметке по умолчанию, с исходным 66%-box (никакого класса не нужно).
  // Единственное другое публичное место со стандартным compact-V — кнопка
  // "Więcej"/More в нижнем таббаре; footer (100px) и JSON-LD schema.image
  // это не тот же кейс и не переключаются.
  document.querySelectorAll('.mtb-cta-icon img').forEach(function(img){
    if (SEASONAL_CAMPAIGN.halloweenLogo) {
      img.src = 'assets/img/logo-halloween-v.webp';
      img.classList.add('halloween-v-icon');
    } else {
      img.src = 'assets/img/logo.png';
      img.classList.remove('halloween-v-icon');
    }
  });
})();

// VershClean — mobile nav toggle + auto-close on scroll
// On mobile this nav renders as a bottom sheet (see index-mobile.css) — the
// body class drives its dark backdrop and hides the floating call button
// while it's open, so every path that opens/closes #hn must keep both in sync.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
function setNavOpen(open){
  var n = document.getElementById('hn');
  if(!n) return;
  n.classList.toggle('open', open);
  document.body.classList.toggle('nav-sheet-open', open);
}
function toggleNav(){
  var n = document.getElementById('hn');
  if(n) setNavOpen(!n.classList.contains('open'));
}
window.addEventListener('scroll', function(){
  var n = document.getElementById('hn');
  if(n && n.classList.contains('open')) setNavOpen(false);
}, {passive:true});
// Auto-close mobile nav on scroll if user hasn't clicked a link inside it
var _navScrollY = window.scrollY;
window.addEventListener('scroll', function(){
  var n = document.getElementById('hn');
  if(n && n.classList.contains('open')) {
    if(Math.abs(window.scrollY - _navScrollY) > 10) {
      setNavOpen(false);
    }
  } else {
    _navScrollY = window.scrollY;
  }
}, {passive:true});
var hnLinks = document.querySelectorAll('#hn a');
if(hnLinks) hnLinks.forEach(function(a){
  a.addEventListener('click', function(){
    setNavOpen(false);
  });
});

// Login dropdown (client/partner cabinet) in the topbar
function toggleLoginMenu(){
  var d = document.getElementById('login-dropdown');
  var btn = document.querySelector('.login-trigger');
  if(!d) return;
  d.classList.toggle('open');
  if(btn) btn.classList.toggle('open', d.classList.contains('open'));
}
document.addEventListener('click', function(e){
  var d = document.getElementById('login-dropdown');
  if(!d || !d.classList.contains('open')) return;
  if(d.contains(e.target) || (e.target.closest && e.target.closest('.login-trigger'))) return;
  d.classList.remove('open');
  var btn = document.querySelector('.login-trigger');
  if(btn) btn.classList.remove('open');
});

// Collapsed language switcher in the topbar: shows only the active language
// until tapped, then reveals the rest for one more tap.
(function(){
  var box = document.getElementById('topbar-langs');
  if(!box) return;
  box.addEventListener('click', function(e){
    var btn = e.target.closest('.lb');
    if(!btn) return;
    if(!box.classList.contains('expanded')){
      box.classList.add('expanded');
      return;
    }
    setTimeout(function(){ box.classList.remove('expanded'); }, 150);
  });
})();

// Floating call button (#float-cta): fixed-position, so nothing on the page
// reserves space around it — whatever the user scrolls to can end up right
// under it. Rather than guess safe zones per page, sample what's actually
// rendered under its own footprint (corners + center) after every scroll
// settles, and fade it out (cta-yield) whenever a real control or text
// element is there. document.elementFromPoint would just return the button
// itself (it's the topmost thing at that point) — elementsFromPoint returns
// the whole z-order stack, so this can see through it to what's underneath.
document.addEventListener('DOMContentLoaded', function(){
  // nav.js loads mid-body, before #float-cta exists in the DOM on most
  // pages (it's declared further down) — deferred to DOMContentLoaded so
  // the lookup below doesn't just silently find nothing.
  var btn = document.getElementById('float-cta');
  if(!btn || !document.elementsFromPoint) return;
  // Deliberately NOT a bare h1-h4/p/li tag match — this button's fixed
  // corner scrolls over ordinary body text on every text-heavy page, so
  // that would make it yield almost permanently, defeating its purpose
  // (it also needs to stay visible/reachable). Named UI text that's
  // actually prominent (addon names/prices, card titles, FAQ questions)
  // is covered by its own class below instead of a blanket tag match.
  var PROTECT_SEL = 'button,a,input,select,textarea,label,' +
    '.qty-btn,.qty-input,.add-col-head,.add-col-toggle,.ai-n,.ai-p,' +
    '.pbadge,.card-calc-btn,.card-calc-input,.mob-bar-btn,.mob-cta-btn,' +
    '.hero-calc-menu-item,.msw-card,.srv-short-btn,.btn-prim,.btn-out,.btn-wa,' +
    '.faq-q,.cb-btn,.cb-btn-reject,.modal,.modal-bg,' +
    '.srv-title,.srv-short-title,.add-col-title,.hng-label,.ft2-col a,' +
    '.mtb-label,.hero-calc-menu-text,.hero-calc-menu-price,.sec-title';
  function sample(){
    if(btn.classList.contains('cta-scrolling')) return;
    var r = btn.getBoundingClientRect();
    if(!r.width || !r.height){ btn.classList.remove('cta-yield'); return; }
    var pts = [
      [r.left+2, r.top+2], [r.right-2, r.top+2],
      [r.left+2, r.bottom-2], [r.right-2, r.bottom-2],
      [r.left+r.width/2, r.top+r.height/2]
    ];
    for(var i=0; i<pts.length; i++){
      var stack = document.elementsFromPoint(pts[i][0], pts[i][1]) || [];
      for(var j=0; j<stack.length; j++){
        var el = stack[j];
        if(el === btn || btn.contains(el)) continue;
        if(el.closest && el.closest(PROTECT_SEL)){
          btn.classList.add('cta-yield');
          return;
        }
      }
    }
    btn.classList.remove('cta-yield');
  }
  var settleTimer = null;
  window.addEventListener('scroll', function(){
    btn.classList.add('cta-scrolling');
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function(){
      btn.classList.remove('cta-scrolling');
      sample();
    }, 150);
  }, {passive:true});
  window.addEventListener('resize', function(){
    clearTimeout(settleTimer);
    settleTimer = setTimeout(sample, 150);
  });
  // Catches everything scroll/resize don't: accordions and dropdowns
  // opening, addons being added, language switches changing text length.
  // A light poll is simpler and safer than wiring a re-check into every
  // one of those call sites across 8 pages' worth of separate JS.
  setInterval(sample, 700);
  sample();
});

// "Konto" popup in the bottom mobile tab bar (client/partner cabinet links)
function toggleMtbAccount(){
  var m = document.getElementById('mtb-account-menu');
  if(m) m.classList.toggle('show');
}
document.addEventListener('click', function(e){
  var m = document.getElementById('mtb-account-menu');
  var btn = e.target.closest('.mtb-item');
  if(m && m.classList.contains('show') && !m.contains(e.target) && !(btn && btn.getAttribute('onclick')==='toggleMtbAccount()')){
    m.classList.remove('show');
  }
});
