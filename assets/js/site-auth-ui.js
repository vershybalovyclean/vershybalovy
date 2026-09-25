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
        window.location.href = 'https://kabinet.vershclean.pl/client/dashboard.html';
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
        window.location.href = 'https://kabinet.vershclean.pl/client/dashboard.html';
      };
      mtbTxt.textContent = name;
      var mtbIcon = mtbBtn.querySelector('.mtb-icon');
      if (mtbIcon) mtbIcon.textContent = '👤';
    }
  }

  // Admin return-navigation (targeted fix, 25.09 — corrected same day): "Owner/
  // Manager cabinet → На сайт" had no way back. Reuses this exact topbar/
  // mobile-tabbar slot — same pattern as applyClientSession() above — instead
  // of adding new header chrome. Mutually exclusive with the client button:
  // only checked when no client session was found, so an owner/manager who
  // happens to also hold a stale client cookie still sees their own cabinet
  // link, not the other.
  //
  // Destination depends on the server-verified role, not a shared guess:
  // dashboard.html is the same file for both roles, but each role has its
  // own login entry point (index.html for owner, manager/login.html for
  // manager) that (a) auto-forwards straight to dashboard.html if that
  // role's session is still valid, or (b) shows that role's own correct
  // login form if it isn't — jumping straight to dashboard.html would, on an
  // expired session, bounce a manager to the owner-only index.html instead.
  var MANAGER_BTN_LABEL = { pl: 'Wróć do panelu', ru: 'Вернуться в кабинет', uk: 'Повернутися до кабінету', en: 'Back to dashboard' };
  function managerLabel(){
    var l = localStorage.getItem('vc_lang');
    return MANAGER_BTN_LABEL[l] || MANAGER_BTN_LABEL.pl;
  }
  function adminDestForRole(role){
    return role === 'owner'
      ? 'https://admin.vershclean.pl/index.html'
      : 'https://admin.vershclean.pl/manager/login.html';
  }

  function applyManagerSession(role){
    var dest = adminDestForRole(role);

    var topbarBtn = document.querySelector('.login-trigger');
    var topbarTxt = topbarBtn && topbarBtn.querySelector('.login-txt');
    if (topbarBtn && topbarTxt) {
      topbarBtn.setAttribute('onclick', '');
      topbarBtn.onclick = function(e){
        e.preventDefault();
        window.location.href = dest;
      };
      topbarBtn.classList.add('login-trigger-active');
      topbarTxt.textContent = managerLabel();
      topbarBtn.childNodes[0].textContent = '🔙 ';
      var dropdown = document.getElementById('login-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    }

    // Selects via the label's stable id + .closest(), not the onclick="..."
    // attribute value — that attribute gets cleared below on the first call,
    // which would make the attribute-selector fail to re-find this button on
    // any later re-render (e.g. a language switch), silently freezing this
    // label at whatever text it had the first time.
    var mtbTxt = document.getElementById('mtb-lbl-account');
    var mtbBtn = mtbTxt && mtbTxt.closest('.mtb-item');
    if (mtbBtn && mtbTxt) {
      mtbBtn.setAttribute('onclick', '');
      mtbBtn.onclick = function(e){
        e.preventDefault();
        window.location.href = dest;
      };
      mtbTxt.textContent = managerLabel();
      var mtbIcon = mtbBtn.querySelector('.mtb-icon');
      if (mtbIcon) mtbIcon.textContent = '🔙';
    }
  }

  function init(){
    if (!window.vcGetClientSession) return; // client-session.js not loaded on this page
    window.vcGetClientSession().then(function(session){
      if (session && session.name !== undefined) { applyClientSession(session); return; }
      if (window.vcGetManagerSession) {
        window.vcGetManagerSession().then(function(mgrSession){
          if (mgrSession) applyManagerSession(mgrSession.role);
        });
      }
    });
  }

  // Exposed so pages whose language-apply function runs late (deferred to
  // window 'load' — see the comment above SL()/applyTranslations() on pages
  // with heavier hero imagery) can re-assert an already-detected client
  // session after resetting the login button text to the translated
  // default. vcGetClientSession() caches its result, so calling this again
  // is cheap and makes no extra network request.
  window.vcReapplySiteAuth = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
