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
