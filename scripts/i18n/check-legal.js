// Проверки переведённых юридических страниц (запуск: runLegalChecks(); результат в window.__lreport). Использует get/vis/num/selfUrl/LANGS из check.html.
const LEGAL = ['regulamin', 'polityka-prywatnosci', 'polityka-cookies', 'zalacznik-nr-1-zakres-uslug'];
window.runLegalChecks = async function () {
  const rep = { fail: [], warn: [] }; const F = (k, m) => rep.fail.push(k + ': ' + m), W = (k, m) => rep.warn.push(k + ': ' + m);
  for (const s of LEGAL) {
    const pl = await get('/' + s + '.html'); const plNum = num(vis(pl).textContent); const plTitle = pl.title;
    for (const l of LANGS) {
      const k = l + '/' + s; const d = await get('/' + l + '/' + s + '.html');
      if (d.documentElement.lang !== l) F(k, 'html lang');
      if (!d.title || d.title === plTitle) F(k, 'title');
      const can = d.querySelector('link[rel=canonical]'); if (!can || can.href !== selfUrl(l, s)) F(k, 'canonical ' + (can && can.href));
      const rb = d.querySelector('meta[name=robots]'); if (!rb || rb.content !== 'noindex,follow') F(k, 'robots ' + (rb && rb.content));
      if (/data-vcn|<base/.test(d.documentElement.outerHTML)) F(k, 'мусор генератора');
      const ids = {}; d.querySelectorAll('[id]').forEach(e => ids[e.id] = (ids[e.id] || 0) + 1); const dup = Object.keys(ids).filter(i => ids[i] > 1); if (dup.length) F(k, 'дубли id ' + dup);
      const plIds = pl.querySelectorAll('[id]').length; if (plIds !== d.querySelectorAll('[id]').length) F(k, 'число id ' + d.querySelectorAll('[id]').length + ' ≠ ' + plIds);
      const rel = []; d.querySelectorAll('[src],link[href],a[href]').forEach(e => { const a = e.getAttribute('src') || e.getAttribute('href'); if (a && !/^(\/|https?:|#|mailto:|tel:|data:|javascript:)/i.test(a)) rel.push(a); }); if (rel.length) F(k, 'относительные пути ' + rel.slice(0, 4));
      const dn = num(vis(d).textContent);
      if (dn !== plNum) { const a = plNum.split(','), b = dn.split(','); F(k, 'числа в тексте ≠ польским: PL-' + a.length + ' vs ' + b.length + ' ; нет: ' + a.filter(x => !b.includes(x)).slice(0, 6) + ' ; лишние: ' + b.filter(x => !a.includes(x)).slice(0, 6)); }
      const t = vis(d).textContent.replace(/\s+/g, ' ');
      const bad = [...new Set((t.match(/[^\s]*[ąćęłńśźż][^\s]*/gi) || []).filter(w => !/^(Kraków|Małopolsk|Wieliczka|Niepołomice|Zabierzów|Michałowice|Świątniki|Myślenice|Krzeszowice|zł)/i.test(w)))];
      if (bad.length) W(k, 'польские слова (' + bad.length + '): ' + bad.slice(0, 10).join(' | '));
      const sw = d.querySelectorAll('a.lb[hreflang]');
      if (sw.length !== 4) F(k, 'переключатель ' + sw.length);
      else if ([...sw].some(a => a.getAttribute('href') !== (a.hreflang === 'pl' ? '/' + s : '/' + a.hreflang + '/' + s))) F(k, 'ссылки переключателя');
      else if (d.querySelectorAll('a.lb.on').length !== 1 || d.querySelector('a.lb.on').hreflang !== l) F(k, 'активный язык переключателя');
      const noPrefix = [...d.querySelectorAll('a[href^="/"]:not(.lb)')].map(a => a.getAttribute('href')).filter(h => h !== '/' && !/^\/(uk|ru|en)(\/|$|#)/.test(h) && !/^\/assets/.test(h));
      if (noPrefix.length) F(k, 'ссылки без языкового префикса: ' + [...new Set(noPrefix)].slice(0, 5));
      const hrefs = [...new Set([...d.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href').split('#')[0]))];
      for (const h of hrefs) {
        if (!h || h === '/' || /^\/(uk|ru|en)$/.test(h)) continue; let ok = false;
        for (const c of [h + '.html', h]) { try { const r = await fetch(c, { method: 'HEAD', cache: 'no-store' }); if (r.ok) { ok = true; break; } } catch (e) { } }
        if (!ok) F(k, 'битая ссылка ' + h);
      }
    }
  }
  window.__lreport = rep; return rep;
};
