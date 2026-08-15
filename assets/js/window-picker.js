// Shared window-type picker widget (used on service add-on rows).
// Each instance is identified by an instanceKey; state and DOM ids are scoped to it.
var WP_TYPES = [
  {id:'small',   m2:0.5,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="9" y="9" width="14" height="14" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><rect x="20.5" y="14" width="1.6" height="6" rx="0.8" fill="#64748b"/></svg>'},
  {id:'std',     m2:1.0,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="9" y="4" width="13" height="24" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><rect x="19.5" y="13" width="1.6" height="6" rx="0.8" fill="#64748b"/></svg>'},
  {id:'double',  m2:1.8,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="3" y="8" width="26" height="16" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="16" y1="8" x2="16" y2="24" stroke="#2563eb" stroke-width="1.4"/></svg>'},
  {id:'triple',  m2:2.7,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="2" y="9" width="28" height="14" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="11.3" y1="9" x2="11.3" y2="23" stroke="#2563eb" stroke-width="1.4"/><line x1="20.7" y1="9" x2="20.7" y2="23" stroke="#2563eb" stroke-width="1.4"/></svg>'},
  {id:'balcony', m2:1.9,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="9" y="2" width="13" height="27" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="9" y1="29.5" x2="22" y2="29.5" stroke="#94a3b8" stroke-width="1.6"/><rect x="10.3" y="14" width="1.6" height="6" rx="0.8" fill="#64748b"/></svg>'},
  {id:'floor',   m2:2.42, icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="6" y="1" width="16" height="28" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="14" y1="1" x2="14" y2="29" stroke="#2563eb" stroke-width="1.2"/><line x1="6" y1="30.5" x2="22" y2="30.5" stroke="#94a3b8" stroke-width="1.6"/></svg>'},
  {id:'patio',   m2:4.5,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="1" y="10" width="30" height="12" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="8.5" y1="10" x2="8.5" y2="22" stroke="#2563eb" stroke-width="1.2"/><line x1="16" y1="10" x2="16" y2="22" stroke="#2563eb" stroke-width="1.2"/><line x1="23.5" y1="10" x2="23.5" y2="22" stroke="#2563eb" stroke-width="1.2"/></svg>'},
  {id:'roof',    m2:0.9,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><polygon points="9,3 25,7 23,25 7,21" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><line x1="8" y1="12" x2="24" y2="16" stroke="#64748b" stroke-width="1.6"/></svg>'},
  {id:'shop',    m2:3.0,  icon:'<svg viewBox="0 0 32 32" width="26" height="26"><rect x="1" y="6" width="30" height="20" rx="1" fill="#eff6ff" stroke="#2563eb" stroke-width="2.2"/><line x1="16" y1="6" x2="16" y2="26" stroke="#2563eb" stroke-width="1.4"/><line x1="1" y1="16" x2="31" y2="16" stroke="#2563eb" stroke-width="1.4"/></svg>'}
];
var WP_LABELS = {
  pl:['Małe okno (1-skrzydłowe)','Okno standardowe','Okno 2-skrzydłowe','Okno 3-skrzydłowe (duże)','Drzwi balkonowe','Okno podłogowe','Okno tarasowe / panoramiczne','Okno dachowe (Velux)','Witryna sklepowa (1 sekcja)'],
  uk:['Мале вікно (1-стулкове)','Стандартне вікно','Двостулкове вікно','Тристулкове вікно (велике)','Балконні двері','Підлогове вікно','Панорамне / терасне вікно','Дахове вікно (Velux)','Вітрина (1 секція)'],
  ru:['Маленькое окно (1-створчатое)','Стандартное окно','2-створчатое окно','3-створчатое окно (большое)','Балконная дверь','Окно в пол','Панорамное / террасное окно','Мансардное окно (Velux)','Витрина (1 секция)'],
  en:['Small window (1 sash)','Standard window','Double window (2 sash)','Large window (3 sash)','Balcony door','Floor-to-ceiling window','Patio / panoramic window','Roof window (Velux)','Shop window (1 section)']
};
var WP_UNIT = {pl:'m²/szt.', uk:'m²/шт.', ru:'m²/шт.', en:'m²/pc'};
var WP_CUSTOM = {
  pl:{label:'Dokładny metraż / niestandardowe', hint:'wpisz dokładny m²'},
  uk:{label:'Точний метраж / нестандартне', hint:'вкажіть точний m²'},
  ru:{label:'Точный метраж / нестандарт', hint:'укажите точный m²'},
  en:{label:'Exact area / non-standard', hint:'enter exact m²'}
};
var WP_CUSTOM_ICON = '<svg viewBox="0 0 32 32" width="26" height="26"><rect x="3" y="12" width="26" height="8" rx="1.5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><line x1="8" y1="12" x2="8" y2="16" stroke="#2563eb" stroke-width="1.4"/><line x1="13" y1="12" x2="13" y2="16" stroke="#2563eb" stroke-width="1.4"/><line x1="18" y1="12" x2="18" y2="16" stroke="#2563eb" stroke-width="1.4"/><line x1="23" y1="12" x2="23" y2="16" stroke="#2563eb" stroke-width="1.4"/></svg>';
var WP_DISCLAIMER = {
  pl: '❗ Wymiary okien podane orientacyjnie, zgodnie ze standardowymi rozmiarami producentów okien. Dokładna cena zostanie podana po pomiarze na miejscu — przed rozpoczęciem sprzątania lub podczas wizyty wstępnej.',
  uk: '❗ Розміри вікон вказані орієнтовно, відповідно до стандартних розмірів виробників вікон. Точна ціна буде озвучена після заміру на місці — перед початком прибирання або під час попереднього візиту.',
  ru: '❗ Размеры окон указаны ориентировочно, в соответствии со стандартными размерами производителей окон. Точная цена будет озвучена после замера на месте — перед началом уборки или предварительного визита.',
  en: '❗ Window sizes are approximate, based on standard manufacturer dimensions. The exact price will be confirmed after on-site measurement — before the cleaning starts or during a preliminary visit.'
};

var WP_STATE = {};     // instanceKey -> {qty:{typeId:n}, custom:number}
var WP_LISTENERS = {}; // instanceKey -> callback(totalM2)
var WP_CONTAINER = {}; // instanceKey -> containerId (for label refresh)

function wpLang(){
  return (typeof lang !== 'undefined' && lang) ? lang : 'pl';
}

function wpBuild(instanceKey, containerId){
  WP_STATE[instanceKey] = WP_STATE[instanceKey] || {qty:{}, custom:0};
  WP_CONTAINER[instanceKey] = containerId;
  var box = document.getElementById(containerId);
  if(!box) return;
  var l = wpLang();
  var labels = WP_LABELS[l] || WP_LABELS.pl;
  var unit = WP_UNIT[l] || WP_UNIT.pl;
  var custom = WP_CUSTOM[l] || WP_CUSTOM.pl;
  var html = '';
  WP_TYPES.forEach(function(t, i){
    html += '<div class="win-row">'
      + '<div class="win-info"><span class="win-ico">'+t.icon+'</span><span class="win-text"><span class="win-name" data-wt="'+i+'">'+labels[i]+'</span><small class="win-size">'+t.m2.toFixed(1).replace('.',',')+' '+unit+'</small></span></div>'
      + '<div class="win-stepper">'
      + '<button type="button" class="win-btn" onclick="event.stopPropagation();wpStep(\''+instanceKey+'\',\''+t.id+'\',-1)">−</button>'
      + '<span class="win-qty" id="wpq-'+instanceKey+'-'+t.id+'">0</span>'
      + '<button type="button" class="win-btn" onclick="event.stopPropagation();wpStep(\''+instanceKey+'\',\''+t.id+'\',1)">+</button>'
      + '</div></div>';
  });
  html += '<div class="win-row win-row-custom">'
    + '<div class="win-info"><span class="win-ico">'+WP_CUSTOM_ICON+'</span><span class="win-text"><span class="win-custom-name">'+custom.label+'</span><small class="win-custom-hint-text">'+custom.hint+'</small></span></div>'
    + '<div class="win-custom-inp"><input type="number" min="0" step="0.1" class="win-custom-field" id="wpc-'+instanceKey+'" placeholder="0" onclick="event.stopPropagation()" oninput="wpCustomInput(\''+instanceKey+'\')"><span class="win-custom-unit">m²</span></div>'
    + '</div>';
  html += '<p class="win-disclaimer">'+(WP_DISCLAIMER[l]||WP_DISCLAIMER.pl)+'</p>';
  box.innerHTML = html;
}

function wpStep(instanceKey, typeId, delta){
  var st = WP_STATE[instanceKey];
  if(!st) return;
  var q = (st.qty[typeId]||0) + delta;
  if(q<0) q = 0;
  st.qty[typeId] = q;
  var el = document.getElementById('wpq-'+instanceKey+'-'+typeId);
  if(el) el.textContent = q;
  wpNotify(instanceKey);
}

function wpCustomInput(instanceKey){
  var st = WP_STATE[instanceKey];
  if(!st) return;
  var inp = document.getElementById('wpc-'+instanceKey);
  var val = parseFloat(inp.value);
  st.custom = (val>0) ? val : 0;
  wpNotify(instanceKey);
}

function wpTotalM2(instanceKey){
  var st = WP_STATE[instanceKey];
  if(!st) return 0;
  var m2 = 0;
  WP_TYPES.forEach(function(t){ m2 += (st.qty[t.id]||0) * t.m2; });
  m2 += st.custom || 0;
  return Math.round(m2*10)/10;
}

function wpClear(instanceKey){
  var st = WP_STATE[instanceKey];
  if(!st) return;
  st.qty = {};
  st.custom = 0;
  document.querySelectorAll('[id^="wpq-'+instanceKey+'-"]').forEach(function(el){ el.textContent='0'; });
  var inp = document.getElementById('wpc-'+instanceKey);
  if(inp) inp.value = '';
}

function wpOnChange(instanceKey, cb){
  WP_LISTENERS[instanceKey] = cb;
}

function wpNotify(instanceKey){
  var cb = WP_LISTENERS[instanceKey];
  if(cb) cb(wpTotalM2(instanceKey));
}

function wpRefreshLabels(instanceKey){
  var containerId = WP_CONTAINER[instanceKey];
  var box = containerId ? document.getElementById(containerId) : null;
  if(!box) return;
  var l = wpLang();
  var labels = WP_LABELS[l] || WP_LABELS.pl;
  var unit = WP_UNIT[l] || WP_UNIT.pl;
  var custom = WP_CUSTOM[l] || WP_CUSTOM.pl;
  box.querySelectorAll('.win-name').forEach(function(el){
    var i = parseInt(el.getAttribute('data-wt'),10);
    if(labels[i]) el.textContent = labels[i];
  });
  box.querySelectorAll('.win-size').forEach(function(el, n){
    var t = WP_TYPES[n % WP_TYPES.length];
    el.textContent = t.m2.toFixed(1).replace('.',',')+' '+unit;
  });
  var nameEl = box.querySelector('.win-custom-name');
  if(nameEl) nameEl.textContent = custom.label;
  var hintEl = box.querySelector('.win-custom-hint-text');
  if(hintEl) hintEl.textContent = custom.hint;
  var discEl = box.querySelector('.win-disclaimer');
  if(discEl) discEl.textContent = WP_DISCLAIMER[l] || WP_DISCLAIMER.pl;
}
