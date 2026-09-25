// Detects a logged-in vershclean client on the public site, via the cookie
// mirrored by the client cabinet (kabinet.vershclean.pl) onto the shared
// .vershclean.pl domain — see vcSetSessionCookie() in vershy-admin's client.js.
// Guests (no cookie, or an expired token) fall through untouched — every
// caller must treat a null/rejected result as "behave exactly as before".
(function(){
  var SUPABASE_URL = "https://qwwerfvyscrzwvadgudn.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_DoLfCe_aAMX1mqG1eE7w9A_R06qfDXp";

  function getCookie(name){
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  var cached = null;
  window.vcGetClientSession = function(){
    if (cached) return cached;
    cached = (async function(){
      var token = getCookie('vc_at');
      if (!token) return null;
      try {
        var profRes = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=full_name,phone,email', {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
        });
        if (!profRes.ok) return null;
        var profRows = await profRes.json();
        var profile = profRows[0];
        if (!profile) return null;

        var propRes = await fetch(SUPABASE_URL + '/rest/v1/properties?is_active=eq.true&select=id,address,property_type,area,is_default&order=is_default.desc', {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
        });
        var properties = propRes.ok ? await propRes.json() : [];

        return { token: token, name: profile.full_name || '', phone: profile.phone || '', email: profile.email || '', properties: properties };
      } catch (e) {
        return null;
      }
    })();
    return cached;
  };

  // Manager return-navigation (targeted fix, 25.09): same cookie-mirroring
  // technique as vc_at above, separate cookie (vc_mgr_at) written by
  // vershy-admin's app.js only for role='manager' — kept distinct from vc_at
  // so a manager and a client logged in on the same browser never collide
  // (and so this never shows the client cabinet link to a manager or
  // vice versa). Re-checks the role server-side rather than trusting the
  // cookie's mere presence, same defensive pattern as the client check above.
  var cachedMgr = null;
  window.vcGetManagerSession = function(){
    if (cachedMgr) return cachedMgr;
    cachedMgr = (async function(){
      var token = getCookie('vc_mgr_at');
      if (!token) return null;
      try {
        var profRes = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=role', {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
        });
        if (!profRes.ok) return null;
        var profRows = await profRes.json();
        var profile = profRows[0];
        if (!profile || profile.role !== 'manager') return null;
        return { token: token };
      } catch (e) {
        return null;
      }
    })();
    return cachedMgr;
  };
})();
