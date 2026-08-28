// VershClean — mobile nav toggle + auto-close on scroll
function toggleNav(){
  var n = document.getElementById('hn');
  if(n) n.classList.toggle('open');
}
window.addEventListener('scroll', function(){
  var n = document.getElementById('hn');
  if(n && n.classList.contains('open')) n.classList.remove('open');
}, {passive:true});
// Auto-close mobile nav on scroll if user hasn't clicked a link inside it
var _navScrollY = window.scrollY;
window.addEventListener('scroll', function(){
  var n = document.getElementById('hn');
  if(n && n.classList.contains('open')) {
    if(Math.abs(window.scrollY - _navScrollY) > 10) {
      n.classList.remove('open');
    }
  } else {
    _navScrollY = window.scrollY;
  }
}, {passive:true});
var hnLinks = document.querySelectorAll('#hn a');
if(hnLinks) hnLinks.forEach(function(a){
  a.addEventListener('click', function(){
    var hn = document.getElementById('hn');
    if(hn) hn.classList.remove('open');
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
