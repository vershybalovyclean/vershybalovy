/* Informacyjna karta usługi w kalkulatorach (PL / UK / RU / EN).
   Pokazuje: usługę, powierzchnię (zakres), liczbę specjalistów, orientacyjny czas, cenę i link do zakresu prac.
   Normy czasu i liczby specjalistów są zatwierdzone przez właściciela (poniżej, jedno źródło).
   CENA NIE JEST TU LICZONA — strona przekazuje kwotę z istniejącego kalkulatora (total); bez kwoty karta się nie wyświetla.
   Strona wywołuje VCInfoCard.update(tabKey, {band, total, exactArea}) po każdym przeliczeniu; band = indeks zakresu 0..5
   (0–1 → do 45 m², 2 → 46–60, 3 → 61–75, 4 → 76–90, 5 → ponad 90 m²). */
(function () {
  'use strict';

  // Normy (zespół zawsze 2 osoby; ponad 90 m² — indywidualnie). Zakresy czasu w godzinach.
  var NORMS = {
    wspomagajace: [[2, 2.5], [2.5, 3], [3, 4], [4, 5]],
    generalne:    [[3, 3], [3.5, 3.5], [6, 6], [7, 7]],
    szczegolowe:  [[7, 7], [7.5, 7.5], [7, 10.5], [12, 12]],
    remont:       [[6, 8], [8, 10], [10, 12], [12, 14]]
  };
  var TEAM = 2;
  var MOVEOUT_MIN_HOURS = 6; // po wyprowadzce: od 6 godzin, niezależnie od powierzchni

  // Indeks zakresu cennika (0..5) → indeks normy (0..3) lub -1 (ponad 90 m² — indywidualnie)
  function normIndex(band) {
    if (band === 0 || band === 1) return 0;
    if (band >= 2 && band <= 4) return band - 1;
    return -1;
  }
  // Powierzchnia → indeks zakresu 0..4 (granice 45/46, 60/61, 75/76, 90/91); 4 = ponad 90
  function bandForArea(m2) {
    m2 = Number(m2);
    if (!(m2 > 0)) return null;
    if (m2 <= 45) return 0;
    if (m2 <= 60) return 1;
    if (m2 <= 75) return 2;
    if (m2 <= 90) return 3;
    return 4;
  }

  var TX = {
    pl: {
      title: 'Informacje o usłudze', service: 'Usługa', area: 'Powierzchnia', team: 'Liczba specjalistów', time: 'Szacowany czas', price: 'Cena',
      checklist: 'Co obejmuje usługa?', individual: 'Indywidualnie', hr: 'godz.', specialists: 'specjalistów', moveTime: 'Czas realizacji: od 6 godzin',
      note: 'Podany czas sprzątania jest orientacyjny i dotyczy pracy wskazanego zespołu przy standardowym stopniu zabrudzenia. Rzeczywisty czas realizacji może się różnić w zależności od stanu nieruchomości, liczby przedmiotów, zakresu prac oraz wybranych usług dodatkowych.',
      names: { wspomagajace: 'Sprzątanie podtrzymujące', generalne: 'Sprzątanie generalne', szczegolowe: 'Sprzątanie detaliczne', remont: 'Sprzątanie po remoncie', wyprowadzka: 'Sprzątanie po wyprowadzce' },
      areas: ['do 45 m²', '46–60 m²', '61–75 m²', '76–90 m²', 'ponad 90 m²'], currency: 'zł', dec: ','
    },
    uk: {
      title: 'Інформація про послугу', service: 'Послуга', area: 'Площа', team: 'Кількість спеціалістів', time: 'Орієнтовний час', price: 'Ціна',
      checklist: 'Що входить у послугу?', individual: 'Індивідуально', hr: 'год.', specialists: 'спеціалісти', moveTime: 'Час виконання: від 6 годин',
      note: 'Зазначений час прибирання є орієнтовним і стосується роботи вказаної команди при стандартному ступені забруднення. Фактичний час виконання може відрізнятися залежно від стану приміщення, кількості предметів, обсягу робіт та обраних додаткових послуг.',
      names: { wspomagajace: 'Підтримуюче прибирання', generalne: 'Генеральне прибирання', szczegolowe: 'Детальне прибирання', remont: 'Прибирання після ремонту', wyprowadzka: 'Прибирання після виїзду' },
      areas: ['до 45 м²', '46–60 м²', '61–75 м²', '76–90 м²', 'понад 90 м²'], currency: 'zł', dec: ','
    },
    ru: {
      title: 'Информация об услуге', service: 'Услуга', area: 'Площадь', team: 'Количество специалистов', time: 'Ориентировочное время', price: 'Цена',
      checklist: 'Что входит в услугу?', individual: 'Индивидуально', hr: 'ч', specialists: 'специалиста', moveTime: 'Время выполнения: от 6 часов',
      note: 'Указанное время уборки является ориентировочным и относится к работе указанной бригады при стандартной степени загрязнения. Фактическое время выполнения может отличаться в зависимости от состояния помещения, количества предметов, объёма работ и выбранных дополнительных услуг.',
      names: { wspomagajace: 'Поддерживающая уборка', generalne: 'Генеральная уборка', szczegolowe: 'Детальная уборка', remont: 'Уборка после ремонта', wyprowadzka: 'Уборка после выезда' },
      areas: ['до 45 м²', '46–60 м²', '61–75 м²', '76–90 м²', 'более 90 м²'], currency: 'zł', dec: ','
    },
    en: {
      title: 'Service information', service: 'Service', area: 'Area', team: 'Number of specialists', time: 'Estimated time', price: 'Price',
      checklist: 'What does the service include?', individual: 'Individual', hr: 'h', specialists: 'specialists', moveTime: 'Duration: from 6 hours',
      note: 'The stated cleaning time is approximate and refers to the work of the indicated team at a standard level of soiling. The actual time may differ depending on the condition of the property, the number of items, the scope of work and the selected additional services.',
      names: { wspomagajace: 'Maintenance cleaning', generalne: 'General cleaning', szczegolowe: 'Detailed cleaning', remont: 'Post-renovation cleaning', wyprowadzka: 'Move-out cleaning' },
      areas: ['up to 45 m²', '46–60 m²', '61–75 m²', '76–90 m²', 'over 90 m²'], currency: 'zł', dec: '.'
    }
  };

  // Istniejące zakresy prac na stronach / w Załączniku nr 1 (nic nowego nie tworzymy)
  var CHECKLIST = {
    wspomagajace: '/zalacznik-nr-1-zakres-uslug#zakres-wspomagajaca',
    generalne: '/zalacznik-nr-1-zakres-uslug#zakres-generalna',
    szczegolowe: '/zalacznik-nr-1-zakres-uslug#zakres-szczegolowa',
    remont: '#scope-section',
    wyprowadzka: '#scope-section'
  };

  function curLang() { var l = document.documentElement.lang || 'pl'; return TX[l] ? l : 'pl'; }
  function num(n, t) { return String(n).replace('.', t.dec); }
  function hours(range, t) {
    var a = range[0], b = range[1];
    return (a === b ? num(a, t) : num(a, t) + '–' + num(b, t)) + ' ' + t.hr;
  }
  function specialists(n, t, lang) {
    if (lang === 'pl') return n + ' ' + t.specialists;
    return n + ' ' + t.specialists;
  }

  // Czysta funkcja: dane karty dla usługi i zakresu (bez ceny) — używana przez render i testy
  function describe(key, band, lang) {
    var t = TX[lang] || TX.pl;
    if (key === 'wyprowadzka') {
      return { name: t.names.wyprowadzka, area: null, team: specialists(TEAM, t, lang), time: t.moveTime, timeIsSentence: true };
    }
    if (!NORMS[key] || band == null) return null;
    var ni = normIndex(band);
    var area = t.areas[ni === -1 ? 4 : ni];
    if (ni === -1) return { name: t.names[key], area: area, team: t.individual, time: t.individual };
    return { name: t.names[key], area: area, team: specialists(TEAM, t, lang), time: hours(NORMS[key][ni], t) };
  }

  var styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    var s = document.createElement('style');
    s.textContent = '.vc-info-card{margin:16px 0 0;padding:14px 16px;border:1.5px solid var(--border,#dbe4f0);border-left:4px solid var(--blue2,#2563eb);border-radius:12px;background:#fff;color:var(--text,#0f172a);font-size:14px;line-height:1.45;box-sizing:border-box;max-width:100%}' +
      '.vc-info-card[hidden]{display:none}' +
      '.vc-ic-title{font-weight:800;font-size:15px;margin:0 0 8px}' +
      '.vc-ic-rows{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}' +
      '.vc-ic-rows dt{color:var(--gray,#64748b);font-weight:600}' +
      '.vc-ic-rows dd{margin:0;font-weight:700;text-align:right;overflow-wrap:anywhere}' +
      '.vc-ic-price{font-size:18px;color:var(--blue2,#2563eb)}' +
      '.vc-ic-link{display:inline-block;margin-top:10px;font-weight:700;color:var(--blue2,#2563eb);text-decoration:underline}' +
      '.vc-ic-note{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--gray,#64748b)}' +
      '@media(max-width:480px){.vc-info-card{padding:12px}.vc-ic-rows{grid-template-columns:1fr;gap:0}.vc-ic-rows dt{margin-top:6px}.vc-ic-rows dd{text-align:left}}';
    document.head.appendChild(s);
  }

  var states = {}; // key -> last state (do ponownego renderu po zmianie języka)

  function hostFor(key) {
    var id = 'vc-info-card-' + key;
    var el = document.getElementById(id);
    if (el) return el;
    var anchor = null;
    if (key === 'wspomagajace' || key === 'generalne' || key === 'szczegolowe') anchor = document.querySelector('#area-calc-' + key + ' .ac-ranges') || document.getElementById('area-calc-' + key);
    else if (key === 'remont') anchor = document.getElementById('calc-rows');
    else if (key === 'wyprowadzka') anchor = document.getElementById('info-note');
    if (!anchor) return null;
    el = document.createElement('div');
    el.id = id; el.className = 'vc-info-card'; el.hidden = true;
    anchor.insertAdjacentElement('afterend', el);
    return el;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render(key) {
    var st = states[key]; var host = hostFor(key);
    if (!host) return;
    if (!st || !(st.total > 0)) { host.hidden = true; host.innerHTML = ''; return; }
    var lang = curLang(), t = TX[lang];
    var d = describe(key, st.band, lang);
    if (!d) { host.hidden = true; host.innerHTML = ''; return; }
    injectStyle();
    var rows = '<dt>' + t.service + '</dt><dd>' + esc(d.name) + '</dd>';
    if (d.area) rows += '<dt>' + t.area + '</dt><dd>' + esc(d.area) + '</dd>';
    rows += '<dt>' + t.team + '</dt><dd>' + esc(d.team) + '</dd>';
    rows += d.timeIsSentence ? '<dt></dt><dd>' + esc(d.time) + '</dd>' : '<dt>' + t.time + '</dt><dd>' + esc(d.time) + '</dd>';
    rows += '<dt>' + t.price + '</dt><dd class="vc-ic-price">' + esc(st.total) + ' ' + t.currency + '</dd>';
    host.innerHTML = '<p class="vc-ic-title">' + t.title + '</p><dl class="vc-ic-rows">' + rows + '</dl>' +
      '<a class="vc-ic-link" href="' + CHECKLIST[key] + '"' + (CHECKLIST[key].charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>' + t.checklist + '</a>' +
      '<p class="vc-ic-note">' + t.note + '</p>';
    host.hidden = false;
  }

  // state: { band: 0..5 | null, total: number }; total <= 0 / brak band → karta ukryta
  function update(key, state) {
    states[key] = state && state.band != null ? state : (key === 'wyprowadzka' ? state : null);
    render(key);
  }
  function hide(key) { states[key] = null; render(key); }

  // zmiana języka (SL) → przerysuj
  function wrapSL() {
    if (typeof window.SL !== 'function' || window.SL.__vcInfoCard) return;
    var orig = window.SL;
    var wrapped = function () { var r = orig.apply(this, arguments); Object.keys(states).forEach(render); return r; };
    wrapped.__vcInfoCard = true;
    window.SL = wrapped;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapSL); else wrapSL();
  window.addEventListener('load', wrapSL);

  window.VCInfoCard = { update: update, hide: hide, describe: describe, bandForArea: bandForArea, normIndex: normIndex, NORMS: NORMS, TX: TX, CHECKLIST: CHECKLIST, MOVEOUT_MIN_HOURS: MOVEOUT_MIN_HOURS };
})();
