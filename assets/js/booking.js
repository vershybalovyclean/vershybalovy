// VershClean — booking calendar widget (.bk-* namespace)
(function(){
  /* ─── BOOKING DATA & STATE ─────────────────────────── */
  var bk_lang = typeof lang !== 'undefined' ? lang : 'pl';
  window.bk_orderData = null;
  var bk_selectedDate = null;
  var bk_selectedSlot = null;
  var bk_selectedPayment = null;
  var bk_invoiceOn = false;
  var bk_partnerOn = false;
  var bk_viewYear, bk_viewMonth;

  var now = new Date();
  bk_viewYear = now.getFullYear();
  bk_viewMonth = now.getMonth();

  /* ─── TRANSLATIONS ─────────────────────────────────── */
  var BK_TX = {
    pl:{
      h1:'Wybierz termin',
      sub:'Termin rezerwujemy dopiero po potwierdzeniu — <strong style="color:#16a34a">bez opłat na tym etapie</strong>.',
      calTitle:'📅 Wybierz dzień',slotsDefault:'⏰ Wybierz godzinę',slotsBase:'⏰ Wybierz godzinę — ',
      formTitle:'📝 Twoje dane',lblName:'Imię i nazwisko *',lblPhone:'Telefon *',lblEmail:'E-mail',
      lblStreet:'Ulica i numer domu *',lblApt:'Numer mieszkania',lblPostal:'Kod pocztowy *',lblCity:'Miejscowość *',
      lblPayment:'Sposób płatności *',payTransfer:'Przelew na konto',payBlik:'BLIK',payCash:'Płatność gotówką',
      invoiceLabel:'Chcę otrzymać fakturę',
      consentLabel:'Wyrażam zgodę na przetwarzanie moich danych osobowych w celu realizacji zgłoszenia — zgodnie z <a href="/polityka-prywatnosci" target="_blank" rel="noopener">Polityką prywatności</a>. *',
      partnerLabel:'Zamówienie w ramach programu partnerskiego',
      lblPartnerCode:'Kod partnera *',partnerCodeHint:'Format: VC- i 4 cyfry, np. VC-4821.',
      recapPartner:'🤝 Kod partnera',
      lblNotes:'Uwagi',opt:'(opcjonalnie)',
      phName:'Anna Kowalska',phPhone:'+48 600 000 000',phEmail:'anna@example.com',
      phStreet:'ul. Floriańska 1',phApt:'np. 5',phPostal:'30-001',phCity:'Kraków',
      phNotes:'Kod do bramy, zwierzęta, dodatkowe info...',
      submitTxt:'Rezerwuję ten termin',submitSending:'Wysyłanie...',
      ctaSub:'Potwierdzimy szczegóły przez WhatsApp lub telefon',
      errMsg:'Błąd wysyłania. Spróbuj ponownie lub zadzwoń: +48 514 363 538',
      orderHead:'Twoje zamówienie',ordService:'🏠 Usługa',ordArea:'📏 Powierzchnia',ordExtras:'💎 Dodatki',ordFreq:'🔄 Częstotliwość',ordTotal:'💰 Razem',
      ordNight:'🌙 Dopłata nocna (+100%)',nightComment:'Dopłata nocna (+100%): TAK',
      f1:'✔ bez ukrytych dopłat',f2:'✔ własne środki w cenie',f3:'✔ możliwość zmiany terminu',
      successThanks:'Dziękujemy',successP:'Twoja prośba o rezerwację została wysłana. Skontaktujemy się z Tobą w ciągu <strong>15 minut</strong> przez WhatsApp lub telefon.',
      recapDate:'📅 Termin',recapTime:'⏰ Godzina',recapPhone:'📞 Telefon',waBtn:'💬 Otwórz WhatsApp',
      bonusNote:'✓ Bonus już wliczony — bez dopłat',
      MONTHS:['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
      WDAYS:['Pn','Wt','Śr','Cz','Pt','So','Nd'],
      LOCALE:'pl-PL'
    },
    uk:{
      h1:'Оберіть дату',
      sub:'Дату бронюємо лише після підтвердження — <strong style="color:#16a34a">без оплати на цьому етапі</strong>.',
      calTitle:'📅 Оберіть день',slotsDefault:'⏰ Оберіть час',slotsBase:'⏰ Оберіть час — ',
      formTitle:'📝 Ваші дані',lblName:"Ім'я та прізвище *",lblPhone:'Телефон *',lblEmail:'E-mail',
      lblStreet:'Вулиця та номер будинку *',lblApt:'Номер квартири',lblPostal:'Поштовий індекс *',lblCity:'Населений пункт *',
      lblPayment:'Спосіб оплати *',payTransfer:'Банківський переказ',payBlik:'BLIK',payCash:'Оплата готівкою',
      invoiceLabel:'Хочу отримати рахунок-фактуру',
      consentLabel:'Я даю згоду на обробку моїх персональних даних з метою обробки заявки — відповідно до <a href="/polityka-prywatnosci" target="_blank" rel="noopener">Політики конфіденційності</a>. *',
      partnerLabel:'Замовлення в рамках партнерської програми',
      lblPartnerCode:'Код партнера *',partnerCodeHint:'Формат: VC- і 4 цифри, напр. VC-4821.',
      recapPartner:'🤝 Код партнера',
      lblNotes:'Коментар',opt:"(необов'язково)",
      phName:'Олена Коваль',phPhone:'+48 600 000 000',phEmail:'olena@example.com',
      phStreet:'вул. Флоріанська 1',phApt:'напр. 5',phPostal:'30-001',phCity:'Краків',
      phNotes:'Код від брами, тварини, додаткова інформація...',
      submitTxt:'Бронюю цю дату',submitSending:'Надсилання...',
      ctaSub:'Підтвердимо деталі через WhatsApp або телефон',
      errMsg:'Помилка. Спробуйте ще раз або зателефонуйте: +48 514 363 538',
      orderHead:'Твоє замовлення',ordService:'🏠 Послуга',ordArea:'📏 Площа',ordExtras:'💎 Додатково',ordFreq:'🔄 Частота',ordTotal:'💰 Разом',
      ordNight:'🌙 Нічна доплата (+100%)',nightComment:'Нічна доплата (+100%): ТАК',
      f1:'✔ без прихованих доплат',f2:'✔ власні засоби включені',f3:'✔ можливість зміни дати',
      successThanks:'Дякуємо',successP:"Твоя заявка надіслана. Зв'яжемося протягом <strong>15 хвилин</strong> через WhatsApp або телефон.",
      recapDate:'📅 Дата',recapTime:'⏰ Час',recapPhone:'📞 Телефон',waBtn:'💬 Відкрити WhatsApp',
      bonusNote:'✓ Бонус вже включено — без доплат',
      MONTHS:['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
      WDAYS:['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
      LOCALE:'uk-UA'
    },
    ru:{
      h1:'Выберите дату',
      sub:'Дату бронируем только после подтверждения — <strong style="color:#16a34a">без оплаты на этом этапе</strong>.',
      calTitle:'📅 Выберите день',slotsDefault:'⏰ Выберите время',slotsBase:'⏰ Выберите время — ',
      formTitle:'📝 Ваши данные',lblName:'Имя и фамилия *',lblPhone:'Телефон *',lblEmail:'E-mail',
      lblStreet:'Улица и номер дома *',lblApt:'Номер квартиры',lblPostal:'Почтовый индекс *',lblCity:'Населённый пункт *',
      lblPayment:'Способ оплаты *',payTransfer:'Банковский перевод',payBlik:'BLIK',payCash:'Оплата наличными',
      invoiceLabel:'Хочу получить счёт-фактуру',
      consentLabel:'Я даю согласие на обработку моих персональных данных для обработки заявки — согласно <a href="/polityka-prywatnosci" target="_blank" rel="noopener">Политике конфиденциальности</a>. *',
      partnerLabel:'Заказ в рамках партнёрской программы',
      lblPartnerCode:'Код партнёра *',partnerCodeHint:'Формат: VC- и 4 цифры, напр. VC-4821.',
      recapPartner:'🤝 Код партнёра',
      lblNotes:'Комментарий',opt:'(необязательно)',
      phName:'Анна Иванова',phPhone:'+48 600 000 000',phEmail:'anna@example.com',
      phStreet:'ул. Флорианская 1',phApt:'напр. 5',phPostal:'30-001',phCity:'Краков',
      phNotes:'Код от ворот, животные, доп. информация...',
      submitTxt:'Бронирую эту дату',submitSending:'Отправка...',
      ctaSub:'Подтвердим детали через WhatsApp или по телефону',
      errMsg:'Ошибка отправки. Попробуйте снова или позвоните: +48 514 363 538',
      orderHead:'Ваш заказ',ordService:'🏠 Услуга',ordArea:'📏 Площадь',ordExtras:'💎 Дополнительно',ordFreq:'🔄 Частота',ordTotal:'💰 Итого',
      ordNight:'🌙 Ночная доплата (+100%)',nightComment:'Ночная доплата (+100%): ДА',
      f1:'✔ без скрытых доплат',f2:'✔ собственные средства в цене',f3:'✔ возможность изменить дату',
      successThanks:'Спасибо',successP:'Ваша заявка на бронирование отправлена. Свяжемся с вами в течение <strong>15 минут</strong> через WhatsApp или по телефону.',
      recapDate:'📅 Дата',recapTime:'⏰ Время',recapPhone:'📞 Телефон',waBtn:'💬 Открыть WhatsApp',
      bonusNote:'✓ Бонус уже включён — без доплат',
      MONTHS:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      WDAYS:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
      LOCALE:'ru-RU'
    },
    en:{
      h1:'Choose a date',
      sub:'We confirm the date only after you agree — <strong style="color:#16a34a">no payment at this stage</strong>.',
      calTitle:'📅 Choose a day',slotsDefault:'⏰ Choose a time',slotsBase:'⏰ Choose a time — ',
      formTitle:'📝 Your details',lblName:'Full name *',lblPhone:'Phone *',lblEmail:'E-mail',
      lblStreet:'Street and house number *',lblApt:'Apartment number',lblPostal:'Postal code *',lblCity:'City *',
      lblPayment:'Payment method *',payTransfer:'Bank transfer',payBlik:'BLIK',payCash:'Cash payment',
      invoiceLabel:"I'd like an invoice",
      consentLabel:'I consent to the processing of my personal data to handle this request — in accordance with the <a href="/polityka-prywatnosci" target="_blank" rel="noopener">Privacy Policy</a>. *',
      partnerLabel:'Order under the partner program',
      lblPartnerCode:'Partner code *',partnerCodeHint:'Format: VC- plus 4 digits, e.g. VC-4821.',
      recapPartner:'🤝 Partner code',
      lblNotes:'Notes',opt:'(optional)',
      phName:'Anna Smith',phPhone:'+48 600 000 000',phEmail:'anna@example.com',
      phStreet:'Floriańska St 1',phApt:'e.g. 5',phPostal:'30-001',phCity:'Kraków',
      phNotes:'Gate code, pets, extra info...',
      submitTxt:'Book this slot',submitSending:'Sending...',
      ctaSub:"We'll confirm via WhatsApp or phone",
      errMsg:'Sending failed. Please try again or call: +48 514 363 538',
      orderHead:'Your order',ordService:'🏠 Service',ordArea:'📏 Area',ordExtras:'💎 Extras',ordFreq:'🔄 Frequency',ordTotal:'💰 Total',
      ordNight:'🌙 Night surcharge (+100%)',nightComment:'Night surcharge (+100%): YES',
      f1:'✔ no hidden fees',f2:'✔ our own supplies included',f3:'✔ date can be changed',
      successThanks:'Thank you',successP:"Your booking request has been sent. We'll contact you within <strong>15 minutes</strong> via WhatsApp or phone.",
      recapDate:'📅 Date',recapTime:'⏰ Time',recapPhone:'📞 Phone',waBtn:'💬 Open WhatsApp',
      bonusNote:'✓ Bonus already included — no extra charge',
      MONTHS:['January','February','March','April','May','June','July','August','September','October','November','December'],
      WDAYS:['Mo','Tu','We','Th','Fr','Sa','Su'],
      LOCALE:'en-GB'
    }
  };

  function bk_t(k){ var l=typeof lang!=='undefined'?lang:'pl'; return (BK_TX[l]&&BK_TX[l][k]!==undefined)?BK_TX[l][k]:BK_TX.pl[k]; }

  /* ─── BONUS DATES ──────────────────────────────────── */
  var BK_BONUSES = {
    "2026-06-25":{pl:"Bezpłatna pielęgnacja luster i powierzchni chromowanych",uk:"Безкоштовна обробка дзеркал і хромованих поверхонь",en:"Free treatment of mirrors and chrome surfaces"},
    "2026-06-26":{pl:"Bezpłatna pielęgnacja luster i powierzchni chromowanych",uk:"Безкоштовна обробка дзеркал і хромованих поверхонь",en:"Free treatment of mirrors and chrome surfaces"},
    "2026-06-27":{pl:"Bezpłatna pielęgnacja luster i powierzchni chromowanych",uk:"Безкоштовна обробка дзеркал і хромованих поверхонь",en:"Free treatment of mirrors and chrome surfaces"},
    "2026-06-30":{pl:"Aromatyzacja pomieszczenia po sprzątaniu",uk:"Ароматизація приміщення після прибирання",en:"Room fragrance after cleaning"},
    "2026-07-04":{pl:"Pielęgnacja fartucha kuchennego w prezencie",uk:"Догляд за кухонним фартухом у подарунок",en:"Kitchen backsplash care as a gift"},
    "2026-07-05":{pl:"Pielęgnacja fartucha kuchennego w prezencie",uk:"Догляд за кухонним фартухом у подарунок",en:"Kitchen backsplash care as a gift"},
    "2026-07-06":{pl:"Pielęgnacja fartucha kuchennego w prezencie",uk:"Догляд за кухонним фартухом у подарунок",en:"Kitchen backsplash care as a gift"},
    "2026-07-09":{pl:"Priorytetowe okno rezerwacji — wczesny wybór godziny",uk:"Пріоритетне вікно запису — ранній вибір часу",en:"Priority booking window — early time selection"},
    "2026-07-12":{pl:"Bezpłatne czyszczenie wnętrza kuchenki mikrofalowej",uk:"Безкоштовне прибирання всередині мікрохвильової печі",en:"Free cleaning inside the microwave"},
    "2026-07-13":{pl:"Bezpłatne czyszczenie wnętrza kuchenki mikrofalowej",uk:"Безкоштовне прибирання всередині мікрохвильової печі",en:"Free cleaning inside the microwave"},
    "2026-07-14":{pl:"Bezpłatne czyszczenie wnętrza kuchenki mikrofalowej",uk:"Безкоштовне прибирання всередині мікрохвильової печі",en:"Free cleaning inside the microwave"},
    "2026-07-18":{pl:"Upominek dla domu po sprzątaniu",uk:"Комплімент для дому після прибирання",en:"Home compliment after cleaning"},
    "2026-07-22":{pl:"Szczególna uwaga na detale: klamki, włączniki, małe strefy",uk:"Особлива увага до деталей: ручки, вимикачі, малі зони",en:"Extra attention to details: handles, switches, small areas"},
    "2026-07-23":{pl:"Szczególna uwaga na detale: klamki, włączniki, małe strefy",uk:"Особлива увага до деталей: ручки, вимикачі, малі зони",en:"Extra attention to details: handles, switches, small areas"},
    "2026-07-24":{pl:"Szczególna uwaga na detale: klamki, włączniki, małe strefy",uk:"Особлива увага до деталей: ручки, вимикачі, малі зони",en:"Extra attention to details: handles, switches, small areas"},
    "2026-07-29":{pl:"Bezpłatna pielęgnacja powierzchni szklanych",uk:"Безкоштовна обробка скляних поверхонь",en:"Free treatment of glass surfaces"},
    "2026-08-03":{pl:"Dodatkowy czas na finalne wykończenie",uk:"Додатковий час на фінальну деталізацію",en:"Extra time for final detailing"},
    "2026-08-04":{pl:"Dodatkowy czas na finalne wykończenie",uk:"Додатковий час на фінальну деталізацію",en:"Extra time for final detailing"},
    "2026-08-05":{pl:"Dodatkowy czas na finalne wykończenie",uk:"Додатковий час на фінальну деталізацію",en:"Extra time for final detailing"},
    "2026-08-08":{pl:"Mini-organizacja jednej otwartej strefy",uk:"Міні-організація однієї відкритої зони",en:"Mini-organization of one open area"},
    "2026-08-13":{pl:"Wzmocniona pielęgnacja armatury sanitarnej",uk:"Посилений догляд за сантехнікою",en:"Enhanced sanitary fixtures care"},
    "2026-08-14":{pl:"Wzmocniona pielęgnacja armatury sanitarnej",uk:"Посилений догляд за сантехнікою",en:"Enhanced sanitary fixtures care"},
    "2026-08-15":{pl:"Wzmocniona pielęgnacja armatury sanitarnej",uk:"Посилений догляд за сантехнікою",en:"Enhanced sanitary fixtures care"},
    "2026-08-20":{pl:"Priorytetowa rezerwacja kolejnej wizyty",uk:"Пріоритетне бронювання наступного візиту",en:"Priority booking for next visit"},
    "2026-08-26":{pl:"Bezpłatna pielęgnacja frontów kuchennych",uk:"Безкоштовна обробка кухонних фасадів",en:"Free kitchen cabinet fronts treatment"},
    "2026-08-27":{pl:"Bezpłatna pielęgnacja frontów kuchennych",uk:"Безкоштовна обробка кухонних фасадів",en:"Free kitchen cabinet fronts treatment"},
    "2026-09-02":{pl:"Wykończenie premium — dekoracyjna aranżacja przestrzeni",uk:"Преміальний фінал прибирання — декоративне оформлення",en:"Premium finishing — decorative space arrangement"},
    "2026-09-06":{pl:"Czyszczenie trudno dostępnych stref w prezencie",uk:"Очищення важкодоступних зон у подарунок",en:"Cleaning hard-to-reach areas as a gift"},
    "2026-09-07":{pl:"Czyszczenie trudno dostępnych stref w prezencie",uk:"Очищення важкодоступних зон у подарунок",en:"Cleaning hard-to-reach areas as a gift"},
    "2026-09-08":{pl:"Czyszczenie trudno dostępnych stref w prezencie",uk:"Очищення важкодоступних зон у подарунок",en:"Cleaning hard-to-reach areas as a gift"},
    "2026-09-13":{pl:"Pielęgnacja listew przypodłogowych",uk:"Догляд за плінтусами",en:"Baseboard care included"},
    "2026-09-18":{pl:"Bezpłatne głębokie czyszczenie jednej małej strefy",uk:"Безкоштовне глибоке очищення однієї невеликої зони",en:"Free deep cleaning of one small area"},
    "2026-09-19":{pl:"Bezpłatne głębokie czyszczenie jednej małej strefy",uk:"Безкоштовне глибоке очищення однієї невеликої зони",en:"Free deep cleaning of one small area"},
    "2026-09-20":{pl:"Bezpłatne głębokie czyszczenie jednej małej strefy",uk:"Безкоsztowne głęboke czyszczenie jednej małej strefy",en:"Free deep cleaning of one small area"},
    "2026-09-24":{pl:"Upominek dla stałych klientów",uk:"Комплімент постійним клієнтам",en:"Gift for regular clients"},
    "2026-09-29":{pl:"Ostatnie dni bonusów sezonowych Vershy",uk:"Фінальні дні сезонних бонусів Vershy",en:"Last days of Vershy seasonal bonuses"},
    "2026-09-30":{pl:"Ostatnie dni bonusów sezonowych Vershy",uk:"Фінальні дні сезонних бонусів Vershy",en:"Last days of Vershy seasonal bonuses"}
  };

  function bk_getBonus(date) {
    var k = date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    return BK_BONUSES[k]||null;
  }

  /* ─── TIME SLOTS ───────────────────────────────────── */
  var BK_SLOTS = [
    {id:'s1',icon:'🌅',label:'09:00–11:00',tag:{pl:'Polecamy z rana!',uk:'Радимо вранці!',ru:'Рекомендуем с утра!',en:'Best in the morning!'}},
    {id:'s2',icon:'☀️',label:'11:00–13:00',tag:{pl:'Najczęściej wybierany',uk:'Найчастіше обирають',ru:'Чаще всего выбирают',en:'Most popular'}},
    {id:'s3',icon:'🌤',label:'13:00–15:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s4',icon:'🌇',label:'15:00–17:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s5',icon:'🌆',label:'17:00–19:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s6',icon:'🌃',label:'19:00–21:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s7',icon:'🌙',label:'po 21:00',tag:{pl:'+100% — wyjazd nocny',uk:'+100% — нічний виїзд',ru:'+100% — ночной выезд',en:'+100% — night visit'},night:true}
  ];

  /* ─── NIGHT SURCHARGE (po 21:00 → +100%) ───────────── */
  function bk_isNightSlot(){
    var s = BK_SLOTS.find(function(x){return x.id===bk_selectedSlot;});
    return !!(s && s.night);
  }
  function bk_finalPrice(basePrice){
    return bk_isNightSlot() ? basePrice*2 : basePrice;
  }

  /* ─── RENDER ORDER SUMMARY ─────────────────────────── */
  window.bk_renderOrder = function() {
    var d = window.bk_orderData;
    if(!d) return;
    var rows = [];
    if(d.service) { d.service.split('|').forEach(function(l){ rows.push([bk_t('ordService'), l.trim()]); }); }
    if(d.extras) rows.push([bk_t('ordExtras'), d.extras]);
    if(d.freq) rows.push([bk_t('ordFreq'), d.freq]);
    var nightOn = bk_isNightSlot();
    if(nightOn && d.price) rows.push([bk_t('ordNight'), '+'+d.price+' zł']);
    function _set(id, val, html) {
      var el = document.getElementById(id);
      if(!el) return;
      if(html) el.innerHTML = val; else el.textContent = val;
    }
    function _html(id, val) { var el=document.getElementById(id); if(el) el.innerHTML=val; }
    _html('bk-orderRows', rows.map(function(r){ return '<li><span>'+r[0]+'</span><strong>'+r[1]+'</strong></li>'; }).join(''));
    _set('bk-orderTotal', d.price ? bk_finalPrice(d.price)+' zł' : '— zł');
    _set('bk-order-head', bk_t('orderHead'));
    _set('bk-total-lbl', bk_t('ordTotal'));
    _set('bk-f1', bk_t('f1'));
    _set('bk-f2', bk_t('f2'));
    _set('bk-f3', bk_t('f3'));
  };

  /* ─── CALENDAR ─────────────────────────────────────── */
  function bk_renderCal() {
    var l = typeof lang!=='undefined'?lang:'pl';
    document.getElementById('bk-monthLabel').textContent = bk_t('MONTHS')[bk_viewMonth]+' '+bk_viewYear;

    // Weekday headers
    var wdEl = document.getElementById('bk-weekRow');
    wdEl.innerHTML = bk_t('WDAYS').map(function(d){ return '<div class="bk-wday">'+d+'</div>'; }).join('');

    var first = new Date(bk_viewYear, bk_viewMonth, 1);
    var startWD = (first.getDay()+6)%7;
    var daysInMonth = new Date(bk_viewYear, bk_viewMonth+1, 0).getDate();
    var today = new Date(); today.setHours(0,0,0,0);

    var html = '';
    for(var i=0;i<startWD;i++) html+='<button class="bk-day bk-empty" disabled></button>';
    for(var d=1;d<=daysInMonth;d++){
      var date = new Date(bk_viewYear, bk_viewMonth, d);
      var dow = date.getDay();
      var cls = 'bk-day';
      var disabled = '';
      if(date<today||dow===0){ cls+=' bk-none'; disabled='disabled'; }
      var bonus = (!disabled&&bk_getBonus(date));
      if(bonus) cls+=' bk-bonus';
      if(bk_selectedDate&&date.toDateString()===bk_selectedDate.toDateString()) cls+=' bk-selected';
      var star = bonus?'<span class="bk-star">🎁</span>':'';
      var dd=d,mm=bk_viewMonth,yy=bk_viewYear;
      html+='<button class="'+cls+'" '+disabled+' onclick="bk_pickDay('+yy+','+mm+','+dd+')"><span style="font-size:13px;font-weight:700">'+d+'</span>'+star+'</button>';
    }
    document.getElementById('bk-calDays').innerHTML = html;
    bk_updateBonus();
  }

  window.bk_pickDay = function(y,m,d){
    bk_selectedDate = new Date(y,m,d);
    bk_selectedSlot = null;
    bk_renderCal();
    bk_renderSlots();
    bk_updateBonus();
    bk_checkForm();
    var calEl = document.getElementById('bk-calDays'); if(calEl) calEl.classList.remove('bk-invalid');
  };

  function bk_updateBonus(){
    var banner = document.getElementById('bk-bonusBanner');
    if(!banner) return;
    if(bk_selectedDate){
      var b = bk_getBonus(bk_selectedDate);
      if(b){
        var l = typeof lang!=='undefined'?lang:'pl';
        document.getElementById('bk-bonusText').textContent='🎁 '+(b[l]||b.pl);
        document.getElementById('bk-bonusNote').textContent=bk_t('bonusNote');
        banner.classList.remove('bk-hidden');
        return;
      }
    }
    banner.classList.add('bk-hidden');
  }

  /* ─── SLOTS ────────────────────────────────────────── */
  function bk_renderSlots(){
    var l = typeof lang!=='undefined'?lang:'pl';
    var locale = bk_t('LOCALE');
    var title = bk_selectedDate
      ? bk_t('slotsBase')+bk_selectedDate.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'})
      : bk_t('slotsDefault');
    document.getElementById('bk-slots-title').textContent = title;

    document.getElementById('bk-slotsContainer').innerHTML = BK_SLOTS.map(function(s){
      var tag = s.tag[l]||'';
      var active = bk_selectedSlot===s.id?' bk-slot-active':'';
      var night = s.night?' bk-slot-night':'';
      var tagHtml = tag?'<span class="bk-slot-tag">'+tag+'</span>':'';
      return '<button class="bk-slot'+active+night+'" onclick="bk_pickSlot(\''+s.id+'\')">'
        +tagHtml
        +'<span style="font-size:14px;line-height:1">'+s.icon+'</span>'
        +'<span style="font-weight:700;font-size:13px;color:#1e293b;letter-spacing:.3px">'+s.label+'</span>'
        +'</button>';
    }).join('');
  }

  window.bk_pickSlot = function(id){
    bk_selectedSlot = id;
    bk_renderSlots();
    bk_checkForm();
    if(typeof window.bk_renderOrder === 'function') window.bk_renderOrder();
    var slotsEl = document.getElementById('bk-slotsContainer'); if(slotsEl) slotsEl.classList.remove('bk-invalid');
  };

  /* ─── FORM CHECK ───────────────────────────────────── */
  function bk_checkForm(){
    var partnerOk = true;
    if(bk_partnerOn){
      var codeEl = document.getElementById('bk-partner-code');
      partnerOk = !!(codeEl && /^VC-\d{4}$/.test(codeEl.value));
    }
    var consentEl = document.getElementById('bk-consent');
    var consentOk = !consentEl || consentEl.checked;
    var ok = bk_selectedDate && bk_selectedSlot && bk_selectedPayment
      && document.getElementById('bk-name').value.trim()
      && document.getElementById('bk-phone').value.trim()
      && document.getElementById('bk-street').value.trim()
      && document.getElementById('bk-postal').value.trim()
      && document.getElementById('bk-city').value.trim()
      && partnerOk && consentOk;
    // Not actually disabled (so a click can still trigger validation highlighting) —
    // just visually dimmed as a "not ready yet" hint.
    document.getElementById('bk-submitBtn').classList.toggle('bk-notready', !ok);
  }

  /* ─── VALIDATION HIGHLIGHT ──────────────────────────── */
  // The payment buttons' wrapper isn't consistently id'd across pages (only
  // mieszkan.html has id="bk-payGroup") — find it by relation to a known button instead.
  function bk_payGroupEl(){
    var opt = document.querySelector('.bk-pay-opt');
    return opt ? opt.parentElement : null;
  }

  function bk_clearInvalid(){
    ['bk-calDays','bk-slotsContainer','bk-consent-wrap'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('bk-invalid');
    });
    var payGroup = bk_payGroupEl(); if(payGroup) payGroup.classList.remove('bk-invalid');
    ['bk-name','bk-phone','bk-street','bk-postal','bk-city','bk-partner-code'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('bk-field-invalid');
    });
  }

  function bk_validateAndHighlight(){
    bk_clearInvalid();
    var firstInvalid = null;
    function markInvalid(el, isField){
      if(!el) return;
      el.classList.add(isField ? 'bk-field-invalid' : 'bk-invalid');
      if(!firstInvalid) firstInvalid = el;
    }
    var ok = true;
    if(!bk_selectedDate){ markInvalid(document.getElementById('bk-calDays')); ok = false; }
    if(!bk_selectedSlot){ markInvalid(document.getElementById('bk-slotsContainer')); ok = false; }
    if(!bk_selectedPayment){ markInvalid(bk_payGroupEl()); ok = false; }
    ['bk-name','bk-phone','bk-street','bk-postal','bk-city'].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.value.trim()){ markInvalid(el, true); ok = false; }
    });
    if(bk_partnerOn){
      var codeEl = document.getElementById('bk-partner-code');
      if(codeEl && !/^VC-\d{4}$/.test(codeEl.value)){ markInvalid(codeEl, true); ok = false; }
    }
    var consentEl = document.getElementById('bk-consent');
    if(consentEl && !consentEl.checked){ markInvalid(document.getElementById('bk-consent-wrap')); ok = false; }
    if(!ok && firstInvalid){
      firstInvalid.scrollIntoView({behavior:'smooth', block:'center'});
    }
    return ok;
  }

  /* ─── PAYMENT BUTTONS ──────────────────────────────── */
  document.querySelectorAll('.bk-pay-opt').forEach(function(btn){
    btn.addEventListener('click',function(){
      bk_selectedPayment = btn.dataset.value;
      document.querySelectorAll('.bk-pay-opt').forEach(function(b){ b.classList.toggle('bk-pay-active', b===btn); });
      bk_checkForm();
      var payEl = bk_payGroupEl(); if(payEl) payEl.classList.remove('bk-invalid');
    });
  });

  /* ─── INVOICE TOGGLE ───────────────────────────────── */
  document.getElementById('bk-invoiceBtn').addEventListener('click',function(){
    bk_invoiceOn = !bk_invoiceOn;
    this.classList.toggle('bk-chip-active', bk_invoiceOn);
  });

  /* ─── PRIVACY CONSENT CHECKBOX ─────────────────────── */
  var bk_consentInput = document.getElementById('bk-consent');
  if(bk_consentInput){
    bk_consentInput.addEventListener('change', function(){
      var wrap = document.getElementById('bk-consent-wrap');
      if(wrap) wrap.classList.remove('bk-invalid');
      bk_checkForm();
    });
  }

  /* ─── PARTNER PROGRAM TOGGLE (only on pages that include it) ─── */
  window.bk_partnerOn = bk_partnerOn;
  var bk_partnerBtn = document.getElementById('bk-partnerBtn');
  if(bk_partnerBtn){
    bk_partnerBtn.addEventListener('click',function(){
      bk_partnerOn = !bk_partnerOn;
      window.bk_partnerOn = bk_partnerOn;
      this.classList.toggle('bk-chip-active', bk_partnerOn);
      var wrap = document.getElementById('bk-partner-code-wrap');
      if(wrap){
        wrap.classList.toggle('bk-hidden', !bk_partnerOn);
        var codeEl = document.getElementById('bk-partner-code');
        if(bk_partnerOn && codeEl && !codeEl.value) codeEl.value = 'VC-';
      }
      bk_checkForm();
      if(typeof window.updateOrder === 'function') window.updateOrder();
      if(typeof window.updateSidebar === 'function') window.updateSidebar();
    });
  }
  var bk_partnerCodeInput = document.getElementById('bk-partner-code');
  if(bk_partnerCodeInput){
    bk_partnerCodeInput.addEventListener('input',function(){
      var v = bk_partnerCodeInput.value.toUpperCase();
      if(v.indexOf('VC-') !== 0){
        var digits = v.replace(/[^0-9]/g,'').slice(0,4);
        bk_partnerCodeInput.value = 'VC-'+digits;
      } else {
        var digits2 = v.slice(3).replace(/[^0-9]/g,'').slice(0,4);
        bk_partnerCodeInput.value = 'VC-'+digits2;
      }
      bk_checkForm();
    });
    bk_partnerCodeInput.addEventListener('focus',function(){
      if(bk_partnerCodeInput.value.length < 3) bk_partnerCodeInput.value = 'VC-';
    });
  }

  /* ─── INPUTS → CHECK ───────────────────────────────── */
  ['bk-name','bk-phone','bk-email','bk-street','bk-apt','bk-postal','bk-city','bk-notes'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('input', function(){
      el.classList.remove('bk-field-invalid');
      bk_checkForm();
    });
  });

  /* ─── MONTH NAV ────────────────────────────────────── */
  document.getElementById('bk-prevMonth').addEventListener('click',function(){
    var d = new Date(bk_viewYear, bk_viewMonth-1, 1);
    var minD = new Date(); minD.setDate(1); minD.setHours(0,0,0,0);
    if(d<minD) return;
    bk_viewYear=d.getFullYear(); bk_viewMonth=d.getMonth(); bk_renderCal();
  });
  document.getElementById('bk-nextMonth').addEventListener('click',function(){
    var d = new Date(bk_viewYear, bk_viewMonth+1, 1);
    bk_viewYear=d.getFullYear(); bk_viewMonth=d.getMonth(); bk_renderCal();
  });

  /* ─── SUBMIT ───────────────────────────────────────── */
  window.bk_submit = function(){
    if(!bk_validateAndHighlight()) return;
    var l = typeof lang!=='undefined'?lang:'pl';
    var locale = bk_t('LOCALE');
    var slotObj = BK_SLOTS.find(function(s){return s.id===bk_selectedSlot;});
    var slotLabel = slotObj?slotObj.label:'';
    var dateLabel = bk_selectedDate.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'});
    var d = window.bk_orderData||{};

    var name = document.getElementById('bk-name').value.trim();
    var phone = document.getElementById('bk-phone').value.trim();
    var email = document.getElementById('bk-email').value.trim();
    var street = document.getElementById('bk-street').value.trim();
    var apt = document.getElementById('bk-apt').value.trim();
    var postal = document.getElementById('bk-postal').value.trim();
    var city = document.getElementById('bk-city').value.trim();
    var notes = document.getElementById('bk-notes').value.trim();
    var payMap = {transfer:bk_t('payTransfer'),blik:bk_t('payBlik'),cash:bk_t('payCash')};
    var payLabel = bk_selectedPayment?(payMap[bk_selectedPayment]||bk_selectedPayment):'';
    var fullAddress = street+(apt?('/'+apt):'')+', '+postal+' '+city;

    var comment = 'REZERWACJA TERMINU (' + (document.title.split('|')[0] || '').trim() + ')\n';
    if(d.service) comment+='Usługa: '+d.service+(d.m2?' ('+d.m2+' m²)':'')+'\n';
    if(d.extras) comment+='Dodatki: '+d.extras+'\n';
    if(d.freq) comment+='Częstotliwość: '+d.freq+'\n';
    var nightOn = bk_isNightSlot();
    if(d.price) comment+='Szacunkowa cena: '+bk_finalPrice(d.price)+' zł\n';
    if(nightOn) comment+=bk_t('nightComment')+'\n';
    comment+='Data: '+dateLabel+'\n';
    comment+='Godzina: '+slotLabel+'\n';
    var bonus = bk_getBonus(bk_selectedDate);
    if(bonus) comment+='🎁 Bonus dnia: '+(bonus.pl)+'\n';
    comment+='Adres: '+fullAddress+'\n';
    comment+='Sposób płatności: '+payLabel+'\n';
    comment+='Faktura: '+(bk_invoiceOn?'TAK':'nie')+'\n';
    var partnerCode = '';
    if(bk_partnerOn){
      partnerCode = document.getElementById('bk-partner-code').value.trim();
      comment+='Kod partnera: '+partnerCode+'\n';
    }
    if(email) comment+='E-mail: '+email+'\n';
    if(notes) comment+='Uwagi: '+notes;

    var btn = document.getElementById('bk-submitBtn');
    btn.disabled = true;
    document.getElementById('bk-submit-txt').textContent = bk_t('submitSending');
    document.getElementById('bk-formError').style.display='none';

    fetch('/api/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:name, phone:phone, service:d.service||'Rezerwacja terminu', comment:comment, partnerCode:partnerCode})
    })
    .then(function(r){ if(!r.ok) throw new Error('submit failed'); return r.json(); })
    .then(function(res){
      if(!res || res.success !== true) throw new Error('submit failed');
      trackFormConversion(d.service || '');
      document.getElementById('bk-successName').textContent = bk_t('successThanks')+', '+(name.split(' ')[0]||'')+'!';
      document.getElementById('bk-success-p').innerHTML = bk_t('successP');
      document.getElementById('bk-recapDate').textContent = dateLabel;
      document.getElementById('bk-recapTime').textContent = slotLabel;
      document.getElementById('bk-recapPhone').textContent = phone;
      var partnerRow = document.getElementById('bk-recap-partner-row');
      if(partnerRow){
        if(partnerCode){
          document.getElementById('bk-r-partner').textContent = bk_t('recapPartner');
          document.getElementById('bk-recapPartner').textContent = partnerCode;
          partnerRow.classList.remove('bk-hidden');
        } else {
          partnerRow.classList.add('bk-hidden');
        }
      }
      document.getElementById('bk-wa-btn').textContent = bk_t('waBtn');
      var gridWrap = document.querySelector('.bk-grid-wrap');
      if(gridWrap) gridWrap.style.display='none';
      document.getElementById('bk-successView').classList.remove('bk-hidden');
      document.getElementById('bk-successView').scrollIntoView({behavior:'smooth',block:'start'});
    })
    .catch(function(){
      var errEl = document.getElementById('bk-formError');
      errEl.textContent = bk_t('errMsg');
      errEl.style.display='block';
      btn.disabled=false;
      document.getElementById('bk-submit-txt').textContent=bk_t('submitTxt');
    });
  };

  /* ─── LANGUAGE SYNC ────────────────────────────────── */
  // Override SL to also refresh booking section texts
  var _origSL = window.SL;
  window.SL = function(l){
    if(_origSL) _origSL(l);
    bk_applyTexts();
    bk_renderCal();
    bk_renderSlots();
    bk_renderOrder();
  };

  function bk_applyTexts(){
    var ids = {
      'bk-h1-txt':'h1','bk-sub-txt':'sub','bk-cal-title':'calTitle',
      'bk-form-title':'formTitle','bk-lbl-name':'lblName','bk-lbl-phone':'lblPhone',
      'bk-lbl-email':'lblEmail','bk-opt1':'opt','bk-lbl-street':'lblStreet',
      'bk-lbl-apt':'lblApt','bk-lbl-postal':'lblPostal','bk-lbl-city':'lblCity',
      'bk-lbl-payment':'lblPayment','bk-pay-transfer':'payTransfer','bk-pay-blik':'payBlik',
      'bk-pay-cash':'payCash','bk-invoice-label':'invoiceLabel',
      'bk-partner-label':'partnerLabel','bk-lbl-partner-code':'lblPartnerCode','bk-partner-code-hint':'partnerCodeHint',
      'bk-lbl-notes':'lblNotes','bk-opt2':'opt','bk-submit-txt':'submitTxt',
      'bk-cta-sub':'ctaSub','bk-r-date':'recapDate','bk-r-time':'recapTime',
      'bk-r-phone':'recapPhone','bk-wa-btn':'waBtn','bk-consent-label':'consentLabel'
    };
    var richIds = {'bk-sub-txt':1,'bk-consent-label':1};
    Object.keys(ids).forEach(function(id){
      var el = document.getElementById(id);
      if(el){ if(richIds[id]) el.innerHTML=bk_t(ids[id]); else el.textContent=bk_t(ids[id]); }
    });
    var phIds = {
      'bk-name':'phName','bk-phone':'phPhone','bk-email':'phEmail',
      'bk-street':'phStreet','bk-apt':'phApt','bk-postal':'phPostal',
      'bk-city':'phCity','bk-notes':'phNotes'
    };
    Object.keys(phIds).forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.placeholder=bk_t(phIds[id]);
    });
  }

  /* ─── INIT ─────────────────────────────────────────── */
  bk_renderCal();
  bk_renderSlots();
  bk_applyTexts();

})();
