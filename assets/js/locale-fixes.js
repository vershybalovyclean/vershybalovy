/* Locale fixes shared by all pages that have the PL / UK / RU / EN switcher (SL()).
   1. Area unit: "m²" -> "м²" in Ukrainian and Russian (and back in Polish / English), including text that is rendered later by calculators.
   2. Accessibility attributes (aria-label / alt / title) that are static Polish in the markup.
   Texts are only re-written for the language currently selected; the Polish source value is remembered in data-vc-src-* so switching back restores it. */
(function () {
  'use strict';

  var ATTR_TX = {
    'Zamknij': { uk: 'Закрити', ru: 'Закрыть', en: 'Close' },
    'Poprzednie': { uk: 'Попередні', ru: 'Предыдущие', en: 'Previous' },
    'Następne': { uk: 'Наступні', ru: 'Следующие', en: 'Next' },
    'Nawigacja mobilna': { uk: 'Мобільна навігація', ru: 'Мобильная навигация', en: 'Mobile navigation' },
    'Niedostępne poza sezonem': { uk: 'Недоступно поза сезоном', ru: 'Недоступно вне сезона', en: 'Not available out of season' },
    'Profesjonalne sprzątanie': { uk: 'Професійне прибирання', ru: 'Профессиональная уборка', en: 'Professional cleaning' },
    'Ozonowanie i dezynfekcja': { uk: 'Озонування та дезінфекція', ru: 'Озонирование и дезинфекция', en: 'Ozone treatment and disinfection' },
    'Pranie tapicerki i czyszczenie chemiczne': { uk: 'Прання меблів та хімчистка', ru: 'Стирка мебели и химчистка', en: 'Upholstery washing and dry cleaning' },
    'Sprzątanie przyjazne zwierzętom': { uk: 'Прибирання, дружнє до тварин', ru: 'Уборка, дружелюбная к животным', en: 'Pet-friendly cleaning' },
    'Przed': { uk: 'До', ru: 'До', en: 'Before' },
    'Zespół Vershy Property Care': { uk: 'Команда Vershy Property Care', ru: 'Команда Vershy Property Care', en: 'The Vershy Property Care team' },
    'Olena i Volodymyr — Vershy Property Care': { uk: 'Олена і Володимир — Vershy Property Care', ru: 'Олена и Володимир — Vershy Property Care', en: 'Olena and Volodymyr — Vershy Property Care' },
    'Mycie okien': { uk: 'Миття вікон', ru: 'Мытьё окон', en: 'Window cleaning' },
    'Czyszczenie kuchenki': { uk: 'Чищення плити', ru: 'Чистка плиты', en: 'Cooktop cleaning' },
    'Odkurzanie': { uk: 'Пилососіння', ru: 'Пылесошение', en: 'Vacuuming' },
    'Efekt': { uk: 'Результат', ru: 'Результат', en: 'Result' }
  };
  var ATTRS = ['aria-label', 'alt', 'title'];

  function curLang() { return document.documentElement.lang || 'pl'; }

  function fixAttrs(root, lang) {
    var sel = ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
    var els = root.querySelectorAll ? root.querySelectorAll(sel) : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      ATTRS.forEach(function (a) {
        var cur = el.getAttribute(a);
        if (cur === null) return;
        var srcKey = 'data-vc-src-' + a;
        var src = el.getAttribute(srcKey) || cur;
        var tx = ATTR_TX[src];
        if (!tx) return;
        el.setAttribute(srcKey, src);
        var want = lang === 'pl' ? src : (tx[lang] || src);
        if (cur !== want) el.setAttribute(a, want);
      });
    }
  }

  var LATIN_M2 = /(^|[^A-Za-z])m²/g;
  var CYR_M2 = /м²/g;
  function fixUnitText(text, lang) {
    if (lang === 'uk' || lang === 'ru') return text.indexOf('m²') === -1 ? text : text.replace(LATIN_M2, '$1м²');
    return text.indexOf('м²') === -1 ? text : text.replace(CYR_M2, 'm²');
  }

  function fixUnits(root, lang) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var p = node.parentNode;
      if (p && p.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(p.nodeName)) continue;
      var v = node.nodeValue;
      if (!v) continue;
      var nv = fixUnitText(v, lang);
      if (nv !== v) node.nodeValue = nv;
    }
    var withPh = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title]') : [];
    for (var i = 0; i < withPh.length; i++) {
      ['placeholder', 'title'].forEach(function (a) {
        var cur = withPh[i].getAttribute(a);
        if (cur) { var nv = fixUnitText(cur, lang); if (nv !== cur) withPh[i].setAttribute(a, nv); }
      });
    }
  }

  function run(root) {
    var lang = curLang();
    var r = root && root.nodeType === 1 ? root : document.body;
    fixUnits(r, lang);
    fixAttrs(r, lang);
  }

  function wrapSL() {
    var orig = window.SL;
    if (typeof orig !== 'function' || orig.__vcLocaleWrapped) return;
    var wrapped = function () {
      var res = orig.apply(this, arguments);
      run(document.body);
      return res;
    };
    wrapped.__vcLocaleWrapped = true;
    window.SL = wrapped;
  }

  var pending = false;
  var queue = [];
  function flush() {
    pending = false;
    var items = queue; queue = [];
    items.forEach(function (n) { run(n.nodeType === 1 ? n : n.parentNode); });
  }
  function observe() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (muts) {
      var lang = curLang();
      if (lang === 'pl') return;
      muts.forEach(function (m) {
        if (m.type === 'characterData') queue.push(m.target);
        else m.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) queue.push(n); });
      });
      if (queue.length && !pending) { pending = true; (window.requestAnimationFrame || setTimeout)(flush); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    wrapSL();
    run(document.body);
    observe();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.vcLocaleFix = run;

  // K-1: komunikat dla metrażu wpisanego jako 0 / liczba ujemna (puste pole nie jest błędem). Wspólny dla kalkulatorów na stronach.
  var AREA_ZERO_MSG = {
    pl: '❌ Podaj metraż większy niż 0 m²',
    uk: '❌ Вкажіть площу, більшу за 0 м²',
    ru: '❌ Укажите площадь больше 0 м²',
    en: '❌ Enter an area greater than 0 m²'
  };
  window.vcAreaZeroMsg = function () { return AREA_ZERO_MSG[curLang()] || AREA_ZERO_MSG.pl; };
  window.vcAreaInputFilled = function (el) { return !!el && String(el.value).trim() !== ''; };
})();
