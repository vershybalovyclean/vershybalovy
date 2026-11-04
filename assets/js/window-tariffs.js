// Window-cleaning tariffs — the single source of the numbers on the CLIENT side.
// The server keeps an identical data block in api/_window_tariffs.js; scripts/check-window-tariffs.html
// (local test page) fails if the two ever differ. The season is decided by the SERVICE date (the cleaning date,
// Europe/Warsaw calendar date as YYYY-MM-DD), never by the date the order is placed.
//   Season 01.04–15.10, winter 16.10–31.03.
// ---- DATA (keep identical to api/_window_tariffs.js) ----
var VC_WIN = {
  rate: { plain: { season: 25, winter: 40 }, renovation: { season: 33, winter: 50 } },
  balustrade: { season: 20, winter: 50 },
  standaloneMin: 199
};
// ---- END DATA ----
(function(){
  var W = VC_WIN;
  var WORDS = {
    season: { pl: 'sezonowe', uk: 'сезонне', ru: 'сезонное', en: 'seasonal' },
    winter: { pl: 'zimowe', uk: 'зимове', ru: 'зимнее', en: 'winter' }
  };
  function warsawToday(){
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    } catch (e) {}
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  // iso falsy → no date chosen yet: an INDICATIVE season from today's date (replaced as soon as a date is picked).
  function seasonFor(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || warsawToday());
    var md = m ? parseInt(m[2], 10) * 100 + parseInt(m[3], 10) : 0;
    return (md >= 401 && md <= 1015) ? 'season' : 'winter';
  }
  function rate(kind, iso){ var k = W.rate[kind] || W.rate.plain; return k[seasonFor(iso)]; }
  function balRate(iso){ return W.balustrade[seasonFor(iso)]; }
  function money(kind, m2, iso, standalone){
    var v = Math.round(rate(kind, iso) * m2);
    return standalone ? Math.max(v, W.standaloneMin) : v;
  }
  function word(iso, lang){ var s = WORDS[seasonFor(iso)]; return s[lang] || s.pl; }

  // Repricing of a booking snapshot (bk_orderData) once the cleaning date is known / changes.
  // d.windows = { kind, m2, standalone, total, key (add-on row key), labels (standalone service labels by season) },
  // d.balustrade = { qty, total } (stand-alone page only; its add-on row carries the PER-PIECE price).
  // Only the window lines move; the rest of d.price (cleaning, other add-ons, regular-order discount) is untouched.
  function repriceOrder(d, iso){
    if (!d || !d.windows || !iso) return false;
    var w = d.windows, delta = 0, changed = false;
    if (w.lockIso === iso) return false; // the server's recalculation for this very date stands until the date changes
    var total = money(w.kind, w.m2, iso, !!w.standalone);
    if (total !== w.total) {
      delta += total - w.total; w.total = total; changed = true;
      if (!w.standalone && Array.isArray(d.addons)) d.addons.forEach(function(a){ if (a && a.key === w.key) a.price = total; });
    }
    if (w.standalone && w.labels && d.service !== w.labels[seasonFor(iso)]) { d.service = w.labels[seasonFor(iso)]; changed = true; }
    if (d.balustrade && d.balustrade.qty > 0) {
      var bt = d.balustrade.qty * balRate(iso);
      if (bt !== d.balustrade.total) {
        delta += bt - d.balustrade.total; d.balustrade.total = bt; changed = true;
        var bk = 'ok:balustrady-' + (seasonFor(iso) === 'winter' ? 'winter' : 'season');
        if (Array.isArray(d.addons)) d.addons.forEach(function(a){ if (a && /^ok:balustrady-/.test(a.key)) { a.key = bk; a.price = balRate(iso); } });
      }
    }
    if (delta) {
      d.price = (d.price || 0) + delta;
      if (d.regularPlan) { d.regularPlan.addonsTotal += delta; d.regularPlan.baseTotal += delta; }
    }
    return changed;
  }
  // Applies the server's answer (code price_changed) to the snapshot: lines = [{kind, key, oldKey, price, qty}], baseDelta.
  // The change is computed HERE from the snapshot's own current values (absolute server prices, not the server's delta), so
  // applying the same answer twice never double-counts. Returns the base amount change (0 = the snapshot already agreed).
  function applyServerLines(d, lines, iso){
    if (!d) return 0;
    var delta = 0;
    if (d.windows && iso) d.windows.lockIso = iso;
    (lines || []).forEach(function(l){
      if (!(l.price >= 0)) return;
      if (l.kind === 'window' && d.windows) {
        if (l.standalone) { delta += l.price - d.windows.total; d.windows.total = l.price; }
        else if (Array.isArray(d.addons)) d.addons.forEach(function(a){ if (a && a.key === l.key) { delta += l.price - a.price; a.price = l.price; d.windows.total = l.price; } });
      }
      if (l.kind === 'balustrade' && d.balustrade && Array.isArray(d.addons)) {
        d.addons.forEach(function(a){ if (a && (a.key === l.key || a.key === l.oldKey)) { delta += l.qty * (l.price - a.price); a.key = l.key; a.price = l.price; d.balustrade.total = l.qty * l.price; } });
      }
    });
    if (delta) {
      d.price = (d.price || 0) + delta;
      if (d.regularPlan) { d.regularPlan.addonsTotal += delta; d.regularPlan.baseTotal += delta; }
    }
    return delta;
  }
  // Add-on row on a service page: shows the rate of the indicative season and keeps data-price in step.
  function syncAddonRow(li, kind){
    if (!li) return;
    var r = rate(kind);
    li.setAttribute('data-price', String(r));
    var p = li.querySelector('.ai-p'); if (p) { p.textContent = r + ' zł/m²'; p.dataset.pl = r + ' zł/m²'; }
  }
  // "(sezonowe — 33 zł/m²)" badge of the after-renovation page.
  function fixBadge(id, kind, lang){
    var el = document.getElementById(id); if (!el) return;
    el.textContent = '(' + word(null, lang) + ' — ' + rate(kind) + ' zł/m²)';
  }
  // "od 33 zł/m²" card on the after-renovation page: the rate of the indicative season.
  var FROM = { pl: 'od ', uk: 'від ', ru: 'от ', en: 'from ' };
  function fixFrom(id, kind, lang){
    var el = document.getElementById(id); if (!el) return;
    el.textContent = (FROM[lang] || FROM.pl) + rate(kind) + ' zł/m²';
  }
  window.VCWindowTariffs = { fixFrom: fixFrom, data: W, seasonFor: seasonFor, rate: rate, balRate: balRate, money: money, word: word, repriceOrder: repriceOrder, applyServerLines: applyServerLines, syncAddonRow: syncAddonRow, fixBadge: fixBadge, today: warsawToday };
})();
