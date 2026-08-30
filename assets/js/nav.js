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
