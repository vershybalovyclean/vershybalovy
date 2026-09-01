// Reflects an already-logged-in client (see client-session.js) in the site's
// topbar "Zaloguj się" button and the mobile "Konto" tab — swaps them for the
// client's own name/avatar and points straight at their cabinet, instead of
// the guest login dropdown. Guests (no session) are left completely
// untouched. Partner sessions aren't detected yet (client-session.js only
// checks the client cookie) — applyPartnerSession() is a deliberate stub for
// when that's added, so this file's shape doesn't need to change later.
(function(){
  function firstName(fullName){
    return (fullName || '').trim().split(/\s+/)[0] || '';
  }

  function applyClientSession(session){
    var name = firstName(session.name) || 'Klient';

    var topbarBtn = document.querySelector('.login-trigger');
    var topbarTxt = topbarBtn && topbarBtn.querySelector('.login-txt');
    if (topbarBtn && topbarTxt) {
      topbarBtn.setAttribute('onclick', '');
      topbarBtn.onclick = function(e){
        e.preventDefault();
        window.open('https://kabinet.vershclean.pl/client/dashboard.html', '_blank', 'noopener');
      };
      topbarBtn.classList.add('login-trigger-active');
      topbarTxt.textContent = name;
      topbarBtn.childNodes[0].textContent = '👤 ';
      var dropdown = document.getElementById('login-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    }

    var mtbBtn = document.querySelector('.mobile-tabbar .mtb-item[onclick="toggleMtbAccount()"]');
    var mtbTxt = document.getElementById('mtb-lbl-account');
    if (mtbBtn && mtbTxt) {
      mtbBtn.setAttribute('onclick', '');
      mtbBtn.onclick = function(e){
        e.preventDefault();
        window.open('https://kabinet.vershclean.pl/client/dashboard.html', '_blank', 'noopener');
      };
      mtbTxt.textContent = name;
      var mtbIcon = mtbBtn.querySelector('.mtb-icon');
      if (mtbIcon) mtbIcon.textContent = '👤';
    }
  }

  function init(){
    if (!window.vcGetClientSession) return; // client-session.js not loaded on this page
    window.vcGetClientSession().then(function(session){
      if (session && session.name !== undefined) applyClientSession(session);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
