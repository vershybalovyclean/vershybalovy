// VershClean — booking calendar widget (.bk-* namespace)
(function(){
  /* ─── BOOKING DATA & STATE ─────────────────────────── */
  var bk_lang = typeof lang !== 'undefined' ? lang : 'pl';
  window.bk_orderData = null;
  var bk_selectedDate = null;
  var bk_selectedSlot = null;
  var bk_selectedPayment = null;
  var bk_invoiceOn = false;
  // Marketing photo consent (Блок 10, GO §5) — null = not yet chosen (required,
  // but the CHOICE itself may be "deny"; refusal never blocks the booking).
  // Same mandatory-radio-group pattern as bk_selectedPayment above, not a
  // pre-checked checkbox — neither option is selected by default.
  var bk_marketingConsent = null;
  var bk_partnerOn = false;
  var bk_promoOn = false;
  var bk_promoApplied = null; // {discount_type, discount_value, min_order_amount} once a valid code is confirmed
  var bk_usingSavedAddress = false;
  var bk_savedAddressText = '';
  var bk_savedPropertyId = null;
  var bk_clientToken = null;
  var bk_isAuthenticated = false;
  // Same anon/publishable key already used server-side in api/submit.js (Supabase_anon_key) —
  // safe to embed client-side, it's the public half by design (RLS + narrow RPC grants gate it).
  var BK_SUPABASE_URL = "https://qwwerfvyscrzwvadgudn.supabase.co";
  var BK_SUPABASE_ANON_KEY = "sb_publishable_DoLfCe_aAMX1mqG1eE7w9A_R06qfDXp";
  var bk_viewYear, bk_viewMonth;
  var bk_blockedDates = {}; // isoDate -> true, from cabinet's Календарь → заблокированные даты

  // Phase 3 (24.09): reads the first-touch ad/UTM attribution captured by
  // assets/js/cookie-consent.js (vc_first_touch) — booking.js is the only flow that
  // ever creates a real requests row (see scheduledDate below), so it's the only place
  // this needs forwarding to /api/submit. Returns {} if nothing was ever captured
  // (organic/direct visit, or localStorage unavailable) — never blocks the booking.
  // cookie-consent.js only stores it with ad_storage consent; vcGetFirstTouch() also
  // returns the current page's not-yet-stored value.
  function bk_getFirstTouch(){
    try {
      if(typeof window.vcGetFirstTouch === 'function') return window.vcGetFirstTouch() || {};
      var raw = localStorage.getItem('vc_first_touch');
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  var now = new Date();
  bk_viewYear = now.getFullYear();
  bk_viewMonth = now.getMonth();

  // Cabinet-side day-off/holiday blocks (blocked_dates table) — publicly readable by
  // design specifically for this. Fails open (calendar behaves as before) if the
  // fetch fails, same fallback approach as the rest of the site's Supabase reads.
  fetch(BK_SUPABASE_URL + '/rest/v1/blocked_dates?select=blocked_date', {
    headers: { 'apikey': BK_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + BK_SUPABASE_ANON_KEY }
  })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      rows.forEach(function(row){ bk_blockedDates[row.blocked_date] = true; });
      if(Object.keys(bk_blockedDates).length) bk_renderCal();
    })
    .catch(function(){});

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
      lblMarketingConsent:'Zgoda na zdjęcia w marketingu *',
      marketingConsentLabel:'Zgadzam się, aby Vershy Property Care wykorzystywał zanonimizowane zdjęcia „przed/po” wykonanego sprzątania w portfolio i materiałach reklamowych. Zdjęcia nie będą zawierać wizerunku osób, dokumentów, adresu ani innych danych pozwalających zidentyfikować klienta. Zgodę można wycofać.',
      marketingConsentAllow:'Zgadzam się',marketingConsentDeny:'Nie zgadzam się',
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
      successRegP:'Twoje zgłoszenie na regularne sprzątanie zostało przyjęte. Menedżer skontaktuje się z Tobą w ciągu <strong>15 minut</strong> przez WhatsApp lub telefon i uzgodni terminy oraz godziny wszystkich wizyt. Dopiero potem potwierdzimy zamówienie.',recapDateReg:'📅 Preferowany termin 1. wizyty',recapTimeReg:'⏰ Preferowana godzina',
      myOrdersBtn:'📋 Zobacz moje zamówienia',
      bonusNote:'✓ Bonus już wliczony — bez dopłat',
      slotNight:'po 21:00',
      slotExpired:'Wybrana godzina jest już niedostępna (rezerwacja min. 2 godziny wcześniej). Wybierz inny termin.',
      errName:'Podaj imię i nazwisko (min. 2 znaki).',
      errPhone:'Podaj poprawny numer telefonu, np. +48 600 123 456 lub 600 123 456.',
      errEmail:'Podaj poprawny adres e-mail (np. anna@example.com) lub zostaw pole puste.',
      errPostal:'Podaj kod pocztowy w formacie 00-000.',
      errTooLong:'Jedno z pól jest za długie. Skróć tekst i spróbuj ponownie.',
      errNotAccepted:'Zamówienie NIE zostało przyjęte.',
      errWa:'Wyślij zamówienie samodzielnie przez WhatsApp',
      savedAddrLabel:'Adres',manualAddrOpt:'✏️ Inny adres (wpisz ręcznie)',
      promoEmpty:'⚠️ Wpisz kod promocyjny',promoInvalid:'❌ Nieprawidłowy lub wygasły kod',
      promoMin:'❌ Kod wymaga zamówienia od {min} zł',promoApplied:'✅ Kod zastosowany: ',
      promoError:'❌ Błąd sprawdzania kodu, spróbuj ponownie',
      partnerValid:'✅ Kod partnera prawidłowy',partnerInvalid:'❌ Taki kod nie istnieje',
      ordBase:'🧾 Cena usług',ordPromo:'🏷️ Kod promocyjny',
      hwDatesLong:'📅 Promocja dotyczy terminów sprzątania {dates}',hwDatesShort:'dla terminów {dates}',
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
      lblMarketingConsent:'Згода на фото в маркетингу *',
      marketingConsentLabel:'Дозволяю Vershy Property Care використовувати знеособлені фотографії „до/після“ виконаного прибирання в портфоліо та рекламних матеріалах. Фотографії не міститимуть зображення людей, документів, адреси або інших даних, що дозволяють ідентифікувати клієнта. Згоду можна відкликати.',
      marketingConsentAllow:'Дозволяю',marketingConsentDeny:'Не дозволяю',
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
      successRegP:"Твою заявку на регулярне прибирання отримано. Керівниця зв'яжеться з тобою протягом <strong>15 хвилин</strong> через WhatsApp або телефон і погодить дати й час усіх візитів. Після цього ми підтвердимо замовлення.",recapDateReg:'📅 Бажана дата 1-го візиту',recapTimeReg:'⏰ Бажаний час',
      myOrdersBtn:'📋 Переглянути мої замовлення',
      bonusNote:'✓ Бонус вже включено — без доплат',
      slotNight:'після 21:00',
      slotExpired:'Обраний час уже недоступний (бронювання мін. за 2 години). Оберіть інший час.',
      errName:'Вкажіть ім\'я та прізвище (мін. 2 символи).',
      errPhone:'Вкажіть коректний номер телефону, напр. +48 600 123 456 або 600 123 456.',
      errEmail:'Вкажіть коректну адресу e-mail (напр. anna@example.com) або залиште поле порожнім.',
      errPostal:'Вкажіть поштовий індекс у форматі 00-000.',
      errTooLong:'Одне з полів задовге. Скоротіть текст і спробуйте ще раз.',
      errNotAccepted:'Замовлення НЕ прийнято.',
      errWa:'Надішліть замовлення самостійно у WhatsApp',
      savedAddrLabel:'Адреса',manualAddrOpt:'✏️ Інша адреса (ввести вручну)',
      promoEmpty:'⚠️ Введіть промокод',promoInvalid:'❌ Недійсний або прострочений код',
      promoMin:'❌ Код діє для замовлення від {min} zł',promoApplied:'✅ Код застосовано: ',
      promoError:'❌ Помилка перевірки коду, спробуйте ще раз',
      ordBase:'🧾 Вартість послуг',ordPromo:'🏷️ Промокод',
      hwDatesLong:'📅 Акція діє для дат прибирання {dates}',hwDatesShort:'для дат {dates}',
      partnerValid:'✅ Код партнера дійсний',partnerInvalid:'❌ Такого коду не існує',
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
      lblMarketingConsent:'Согласие на фото в маркетинге *',
      marketingConsentLabel:'Разрешаю Vershy Property Care использовать обезличенные фотографии „до/после“ выполненной уборки в портфолио и рекламных материалах. Фотографии не будут содержать изображения людей, документов, адреса или других данных, позволяющих идентифицировать клиента. Согласие можно отозвать.',
      marketingConsentAllow:'Разрешаю',marketingConsentDeny:'Не разрешаю',
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
      successRegP:'Ваша заявка на регулярную уборку получена. Управляющая свяжется с вами в течение <strong>15 минут</strong> через WhatsApp или телефон и согласует даты и время всех визитов. После этого мы подтвердим заказ.',recapDateReg:'📅 Желаемая дата 1-го визита',recapTimeReg:'⏰ Желаемое время',
      myOrdersBtn:'📋 Смотреть мои заказы',
      bonusNote:'✓ Бонус уже включён — без доплат',
      slotNight:'после 21:00',
      slotExpired:'Выбранное время уже недоступно (бронирование мин. за 2 часа). Выберите другое время.',
      errName:'Укажите имя и фамилию (мин. 2 символа).',
      errPhone:'Укажите корректный номер телефона, напр. +48 600 123 456 или 600 123 456.',
      errEmail:'Укажите корректный адрес e-mail (напр. anna@example.com) или оставьте поле пустым.',
      errPostal:'Укажите почтовый индекс в формате 00-000.',
      errTooLong:'Одно из полей слишком длинное. Сократите текст и попробуйте снова.',
      errNotAccepted:'Заказ НЕ принят.',
      errWa:'Отправьте заказ самостоятельно в WhatsApp',
      savedAddrLabel:'Адрес',manualAddrOpt:'✏️ Другой адрес (ввести вручную)',
      promoEmpty:'⚠️ Введите промокод',promoInvalid:'❌ Недействительный или просроченный код',
      promoMin:'❌ Код действует для заказа от {min} zł',promoApplied:'✅ Код применён: ',
      promoError:'❌ Ошибка проверки кода, попробуйте ещё раз',
      ordBase:'🧾 Стоимость услуг',ordPromo:'🏷️ Промокод',
      hwDatesLong:'📅 Акция действует для дат уборки {dates}',hwDatesShort:'для дат {dates}',
      partnerValid:'✅ Код партнёра действителен',partnerInvalid:'❌ Такого кода не существует',
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
      lblMarketingConsent:'Marketing photo consent *',
      marketingConsentLabel:'I allow Vershy Property Care to use de-identified "before/after" photos of the completed cleaning in its portfolio and advertising materials. The photos will not show people, documents, addresses, or other information that could identify the client. Consent can be withdrawn.',
      marketingConsentAllow:'I allow',marketingConsentDeny:"I don't allow",
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
      successRegP:"Your regular cleaning request has been received. Our manager will contact you within <strong>15 minutes</strong> via WhatsApp or phone to agree the dates and times of all visits. We will confirm the order after that.",recapDateReg:'📅 Preferred date of the 1st visit',recapTimeReg:'⏰ Preferred time',
      myOrdersBtn:'📋 View my orders',
      bonusNote:'✓ Bonus already included — no extra charge',
      slotNight:'after 21:00',
      slotExpired:'The selected time is no longer available (bookings at least 2 hours ahead). Please choose another time.',
      errName:'Enter your full name (at least 2 characters).',
      errPhone:'Enter a valid phone number, e.g. +48 600 123 456 or 600 123 456.',
      errEmail:'Enter a valid e-mail address (e.g. anna@example.com) or leave it empty.',
      errPostal:'Enter the postal code in the format 00-000.',
      errTooLong:'One of the fields is too long. Shorten the text and try again.',
      errNotAccepted:'Your order has NOT been accepted.',
      errWa:'Send the order yourself via WhatsApp',
      savedAddrLabel:'Address',manualAddrOpt:'✏️ Another address (enter manually)',
      promoEmpty:'⚠️ Enter a promo code',promoInvalid:'❌ Invalid or expired code',
      promoMin:'❌ This code requires an order of at least {min} zł',promoApplied:'✅ Code applied: ',
      promoError:'❌ Could not check the code, please try again',
      partnerValid:'✅ Partner code is valid',partnerInvalid:'❌ This code does not exist',
      ordBase:'🧾 Services price',ordPromo:'🏷️ Promo code',
      hwDatesLong:'📅 The offer applies to cleaning dates {dates}',hwDatesShort:'for dates {dates}',
      MONTHS:['January','February','March','April','May','June','July','August','September','October','November','December'],
      WDAYS:['Mo','Tu','We','Th','Fr','Sa','Su'],
      LOCALE:'en-GB'
    }
  };

  function bk_t(k){ var l=typeof lang!=='undefined'?lang:'pl'; return (BK_TX[l]&&BK_TX[l][k]!==undefined)?BK_TX[l][k]:BK_TX.pl[k]; }

  // Fixed-price area bracket label, e.g. bk_rangeLabel(45) → "do 45 m²" (PL),
  // "до 45 m²" (UK/RU), "up to 45 m²" (EN). Pass 'pl' for the team-facing text.
  window.bk_rangeLabel = function(maxM2, forceLang){
    var l = forceLang || (typeof lang!=='undefined'?lang:'pl');
    var word = {pl:'do ',uk:'до ',ru:'до ',en:'up to '}[l] || 'do ';
    var unit = (l === 'uk' || l === 'ru') ? ' м²' : ' m²';
    return word + maxM2 + unit;
  };

  /* ─── BONUS DATES ──────────────────────────────────── */
  // Daily date bonuses (add "YYYY-MM-DD":{pl,uk,ru,en} entries here). The
  // June–September 2026 entries expired and were removed.
  var BK_BONUSES = {
  };

  function bk_getBonus(date) {
    var k = date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    return BK_BONUSES[k]||null;
  }

  /* ─── TIME SLOTS ───────────────────────────────────── */
  var BK_SLOTS = [
    {id:'s1',icon:'🌅',label:'09:00–11:00',start:'09:00',tag:{pl:'Polecamy z rana!',uk:'Радимо вранці!',ru:'Рекомендуем с утра!',en:'Best in the morning!'}},
    {id:'s2',icon:'☀️',label:'11:00–13:00',start:'11:00',tag:{pl:'Najczęściej wybierany',uk:'Найчастіше обирають',ru:'Чаще всего выбирают',en:'Most popular'}},
    {id:'s3',icon:'🌤',label:'13:00–15:00',start:'13:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s4',icon:'🌇',label:'15:00–17:00',start:'15:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s5',icon:'🌆',label:'17:00–19:00',start:'17:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s6',icon:'🌃',label:'19:00–21:00',start:'19:00',tag:{pl:'',uk:'',ru:'',en:''}},
    {id:'s7',icon:'🌙',label:'po 21:00',labelKey:'slotNight',start:'21:00',tag:{pl:'+100% — wyjazd nocny',uk:'+100% — нічний виїзд',ru:'+100% — ночной выезд',en:'+100% — night visit'},night:true}
  ];

  // Visitor-facing slot label (translated where the label is a phrase, e.g.
  // "po 21:00"); the order text sent to the team always uses s.label (PL).
  function bk_slotDisplayLabel(s){
    return s.labelKey ? bk_t(s.labelKey) : s.label;
  }

  function bk_isoDate(d){
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  /* ─── SLOT AVAILABILITY (Europe/Warsaw, min. 120 min lead time) ─────────
     Calendar cells are plain dates in the business's own timezone, so "today"
     and "now" are taken in Europe/Warsaw, never from the visitor's device
     timezone. A slot is bookable only if it starts at least BK_MIN_LEAD_MIN
     minutes from now. Re-checked at submit time (bk_validateAndHighlight). */
  var BK_TZ = 'Europe/Warsaw';
  var BK_MIN_LEAD_MIN = 120;
  function bk_warsawNow(){
    try {
      var p = {};
      new Intl.DateTimeFormat('en-CA', {timeZone:BK_TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'})
        .formatToParts(new Date()).forEach(function(x){ p[x.type] = x.value; });
      return { iso: p.year+'-'+p.month+'-'+p.day, minutes: (parseInt(p.hour,10)%24)*60 + parseInt(p.minute,10) };
    } catch(e) {
      var n = new Date();
      return { iso: bk_isoDate(n), minutes: n.getHours()*60 + n.getMinutes() };
    }
  }
  function bk_slotAvailable(isoDate, slot){
    if(!isoDate || !slot) return true;
    var now = bk_warsawNow();
    if(isoDate < now.iso) return false;
    if(isoDate > now.iso) return true;
    var startMin = parseInt(slot.start.slice(0,2),10)*60 + parseInt(slot.start.slice(3,5),10);
    return startMin - now.minutes >= BK_MIN_LEAD_MIN;
  }
  function bk_anySlotAvailable(isoDate){
    return BK_SLOTS.some(function(s){ return bk_slotAvailable(isoDate, s); });
  }
  function bk_selectedSlotStillValid(){
    if(!bk_selectedDate || !bk_selectedSlot) return true;
    var s = BK_SLOTS.find(function(x){ return x.id === bk_selectedSlot; });
    return bk_slotAvailable(bk_isoDate(bk_selectedDate), s);
  }

  /* ─── HALLOWEEN GIFT ELIGIBILITY (26.10–07.11.2026 inclusive) ──────────
     Eligibility is always keyed to the CLEANING date the client picks on the
     calendar below (bk_selectedDate), never to today's date — a client
     booking today for a date inside the window still qualifies; a client
     booking today for a date outside it does not. Pages that implement a
     Halloween gift (see sprzatanie-mieszkan-i-domow-krakow.html /
     sprzatanie-po-wyprowadzce-krakow.html) hook in via the three optional
     window.bk_halloween* functions below — booking.js itself stays generic
     and carries no page-specific gift logic. */
  var HW_GIFT_START = '2026-10-26';
  var HW_GIFT_END = '2026-11-07';
  function bk_isHalloweenEligible(isoDate){
    return !!isoDate && isoDate >= HW_GIFT_START && isoDate <= HW_GIFT_END;
  }
  window.bk_isHalloweenEligible = bk_isHalloweenEligible;

  // Visitor-facing note on the gift date condition ("dla terminów 26.10–07.11"),
  // built from the same HW_GIFT_START/END as the eligibility rule so the text can
  // never drift from it. Display only — never affects what goes into the order.
  function bk_hwDatesText(){
    function dm(iso){ return iso.slice(8,10)+'.'+iso.slice(5,7); }
    return dm(HW_GIFT_START)+'–'+dm(HW_GIFT_END);
  }
  window.bk_hwDatesNote = function(short){
    return bk_t(short ? 'hwDatesShort' : 'hwDatesLong').replace('{dates}', bk_hwDatesText());
  };
  window.bk_hwEligibleNow = function(){
    return bk_isHalloweenEligible(bk_selectedDate ? bk_isoDate(bk_selectedDate) : null);
  };

  /* ─── NIGHT SURCHARGE (po 21:00 → +100%) ───────────── */
  function bk_isNightSlot(){
    var s = BK_SLOTS.find(function(x){return x.id===bk_selectedSlot;});
    return !!(s && s.night);
  }
  function bk_finalPrice(basePrice){
    var p = bk_isNightSlot() ? basePrice*2 : basePrice;
    if(bk_promoApplied){
      if(bk_promoApplied.discount_type === 'percent') p = p * (1 - bk_promoApplied.discount_value/100);
      else if(bk_promoApplied.discount_type === 'fixed') p = Math.max(0, p - bk_promoApplied.discount_value);
      p = Math.round(p);
    }
    return p;
  }
  // Snapshot promo discount amount for structured storage — mirrors bk_finalPrice's
  // own math exactly (without touching it) so requests.promo_discount_amount always
  // matches what was actually subtracted from price at booking time, not a later
  // recompute against the promo code's current conditions.
  function bk_promoDiscountAmount(basePrice){
    if(!bk_promoApplied) return 0;
    var p = bk_isNightSlot() ? basePrice*2 : basePrice;
    var after = p;
    if(bk_promoApplied.discount_type === 'percent') after = p * (1 - bk_promoApplied.discount_value/100);
    else if(bk_promoApplied.discount_type === 'fixed') after = Math.max(0, p - bk_promoApplied.discount_value);
    return Math.round(p) - Math.round(after);
  }

  /* ─── RENDER ORDER SUMMARY ─────────────────────────── */
  /* ─── ORDER SUMMARY BLOCK (before the submit button) ─────────────────
     None of the 4 booking pages has the #bk-orderRows/#bk-orderTotal markup
     bk_renderOrder() writes to, so the final amount (night +100%, promo) was
     never shown before submitting. Created once, right above #bk-submitBtn.
     Display only: the total is the same bk_finalPrice(d.price) sent as `price`. */
  function bk_ensureSummary(){
    if(document.getElementById('bk-orderTotal')) return;
    var btn = document.getElementById('bk-submitBtn');
    if(!btn || !btn.parentNode) return;
    var box = document.createElement('div');
    box.id = 'bk-summary';
    box.className = 'bk-summary';
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<div class="bk-summary-head" id="bk-order-head"></div>'
      + '<ul id="bk-orderRows" class="bk-summary-rows"></ul>'
      + '<div class="bk-summary-total"><span id="bk-total-lbl"></span><strong id="bk-orderTotal"></strong></div>';
    btn.parentNode.insertBefore(box, btn);
  }

  window.bk_renderOrder = function() {
    var d = window.bk_orderData;
    if(!d) return;
    bk_ensureSummary();
    var rows = [];
    if(d.service) { d.service.split('|').forEach(function(l){ rows.push([bk_t('ordService'), l.trim()]); }); }
    if(d.extras) rows.push([bk_t('ordExtras'), d.extras]);
    if(d.freq) rows.push([bk_t('ordFreq'), d.freq]);
    if(typeof window.bk_halloweenGiftLine === 'function'){
      var hwLine = window.bk_halloweenGiftLine(window.bk_hwEligibleNow());
      if(hwLine) rows.push(['🎃 Halloween', hwLine]);
    }
    var nightOn = bk_isNightSlot();
    var promoAmt = (d.price && bk_promoApplied) ? bk_promoDiscountAmount(d.price) : 0;
    // Base price row only when something is added/subtracted from it, so the
    // arithmetic (base + night − promo = total) is visible to the client.
    if(d.price && (nightOn || promoAmt > 0)) rows.push([bk_t('ordBase'), d.price+' zł']);
    if(nightOn && d.price) rows.push([bk_t('ordNight'), '+'+d.price+' zł']);
    if(promoAmt > 0) rows.push([bk_t('ordPromo')+' '+bk_promoApplied.code, '−'+promoAmt+' zł']);
    function _set(id, val, html) {
      var el = document.getElementById(id);
      if(!el) return;
      if(html) el.innerHTML = val; else el.textContent = val;
    }
    function _html(id, val) { var el=document.getElementById(id); if(el) el.innerHTML=val; }
    function _esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    _html('bk-orderRows', rows.map(function(r){ return '<li><span>'+_esc(r[0])+'</span><strong>'+_esc(r[1])+'</strong></li>'; }).join(''));
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
    var todayIso = bk_warsawNow().iso;

    var html = '';
    for(var i=0;i<startWD;i++) html+='<button class="bk-day bk-empty" disabled></button>';
    for(var d=1;d<=daysInMonth;d++){
      var date = new Date(bk_viewYear, bk_viewMonth, d);
      var dIso = bk_isoDate(date);
      var dow = date.getDay();
      var cls = 'bk-day';
      var disabled = '';
      // Past days (Warsaw date) and today once no slot is ≥120 min ahead.
      var pastOrFull = dIso < todayIso || (dIso === todayIso && !bk_anySlotAvailable(dIso));
      if(pastOrFull||dow===0||bk_blockedDates[dIso]){ cls+=' bk-none'; disabled='disabled'; }
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
    // Re-render immediately so a page-level Halloween gift pick (made before any
    // date was selected) shows/hides its GRATIS line as soon as the picked date
    // moves in or out of the eligibility window — not only at final submit.
    if(typeof window.bk_renderOrder === 'function') window.bk_renderOrder();
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

    var selIso = bk_selectedDate ? bk_isoDate(bk_selectedDate) : null;
    document.getElementById('bk-slotsContainer').innerHTML = BK_SLOTS.map(function(s){
      var tag = s.tag[l]||'';
      var active = bk_selectedSlot===s.id?' bk-slot-active':'';
      var night = s.night?' bk-slot-night':'';
      var off = !bk_slotAvailable(selIso, s);
      // Night slot: the +100% surcharge is shown as a readable second line inside
      // the button (was an 8px corner badge); other slots keep their small tag.
      var tagHtml = (tag&&!off&&!s.night)?'<span class="bk-slot-tag">'+tag+'</span>':'';
      var surchargeHtml = (s.night&&tag)?'<span class="bk-slot-surcharge">'+tag+'</span>':'';
      return '<button type="button" class="bk-slot'+active+night+(off?' bk-slot-off':'')+'"'+(off?' disabled aria-disabled="true"':'')+' onclick="bk_pickSlot(\''+s.id+'\')">'
        +tagHtml
        +'<span style="font-size:14px;line-height:1">'+s.icon+'</span>'
        +'<span style="font-weight:700;font-size:13px;color:#1e293b;letter-spacing:.3px">'+bk_slotDisplayLabel(s)+'</span>'
        +surchargeHtml
        +'</button>';
    }).join('');
  }

  window.bk_pickSlot = function(id){
    var s = BK_SLOTS.find(function(x){ return x.id === id; });
    if(bk_selectedDate && !bk_slotAvailable(bk_isoDate(bk_selectedDate), s)) return;
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
      && bk_marketingConsent !== null
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

  /* ─── FIELD FORMAT RULES ───────────────────────────── */
  // Same rules are enforced again server-side in api/submit.js (this client check is
  // only for fast feedback — it can always be bypassed).
  // Phone: Polish numbers (9 digits, optionally +48 / 0048 / 48 prefix) or any other
  // international number in E.164 shape (+ and 8–15 digits). Spaces, dashes, dots and
  // parentheses are allowed as separators.
  function bk_phoneValid(raw){
    var s = String(raw || '').trim();
    if(!s || s.length > 30 || !/^[+\d\s().\-]+$/.test(s)) return false;
    if(s.indexOf('+') > 0 || s.lastIndexOf('+') > 0) return false; // "+" only as the first character
    var d = s.replace(/\D/g, '');
    var plus = s.charAt(0) === '+';
    if(plus || d.indexOf('00') === 0){
      if(!plus) d = d.slice(2);                                  // 0048… / 00380… → drop the 00 prefix
      if(d.indexOf('48') === 0) return /^48[1-9]\d{8}$/.test(d); // Poland: 9-digit national number
      return /^[1-9]\d{7,14}$/.test(d);                          // other countries (E.164)
    }
    if(d.length === 11 && d.indexOf('48') === 0) return /^48[1-9]\d{8}$/.test(d);
    return /^[1-9]\d{8}$/.test(d);                               // Polish national number
  }
  function bk_emailValid(v){
    v = String(v || '').trim();
    return v.length <= 254 && /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\".]{2,}$/.test(v);
  }
  // Polish postal code XX-XXX; five digits typed without the dash are accepted and fixed.
  function bk_postalNormalize(v){
    v = String(v || '').trim();
    return /^\d{5}$/.test(v) ? v.slice(0, 2) + '-' + v.slice(2) : v;
  }
  function bk_postalValid(v){ return /^\d{2}-\d{3}$/.test(v); }

  /* ─── VALIDATION HIGHLIGHT ──────────────────────────── */
  // The payment buttons' wrapper isn't consistently id'd across pages (only
  // mieszkan.html has id="bk-payGroup") — find it by relation to a known button instead.
  function bk_payGroupEl(){
    var opt = document.querySelector('.bk-pay-opt');
    return opt ? opt.parentElement : null;
  }

  function bk_clearInvalid(){
    ['bk-calDays','bk-slotsContainer','bk-consent-wrap','bk-marketingConsentGroup'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('bk-invalid');
    });
    var payGroup = bk_payGroupEl(); if(payGroup) payGroup.classList.remove('bk-invalid');
    ['bk-name','bk-phone','bk-email','bk-street','bk-postal','bk-city','bk-partner-code'].forEach(function(id){
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
    // Submit-time re-check: the page may have been open long enough for the
    // chosen slot to fall inside the 120-min lead time (or the day to pass).
    var slotExpired = false;
    if(bk_selectedSlot && !bk_selectedSlotStillValid()){
      slotExpired = true;
      bk_selectedSlot = null;
      if(bk_selectedDate && !bk_anySlotAvailable(bk_isoDate(bk_selectedDate))) bk_selectedDate = null;
      bk_renderCal();
      bk_renderSlots();
      if(typeof window.bk_renderOrder === 'function') window.bk_renderOrder();
    }
    if(!bk_selectedDate){ markInvalid(document.getElementById('bk-calDays')); ok = false; }
    if(!bk_selectedSlot){ markInvalid(document.getElementById('bk-slotsContainer')); ok = false; }
    if(!bk_selectedPayment){ markInvalid(bk_payGroupEl()); ok = false; }
    if(bk_marketingConsent === null){ markInvalid(document.getElementById('bk-marketingConsentGroup')); ok = false; }
    ['bk-name','bk-phone','bk-street','bk-postal','bk-city'].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.value.trim()){ markInvalid(el, true); ok = false; }
    });
    // Format checks (only for fields that are filled in — empty required fields are
    // already highlighted above, empty optional ones stay optional).
    var fmtMsgs = [];
    var nameEl = document.getElementById('bk-name');
    if(nameEl && nameEl.value.trim() && nameEl.value.trim().length < 2){ markInvalid(nameEl, true); ok = false; fmtMsgs.push(bk_t('errName')); }
    var phoneEl = document.getElementById('bk-phone');
    if(phoneEl && phoneEl.value.trim() && !bk_phoneValid(phoneEl.value)){ markInvalid(phoneEl, true); ok = false; fmtMsgs.push(bk_t('errPhone')); }
    var emailEl = document.getElementById('bk-email');
    if(emailEl && emailEl.value.trim() && !bk_emailValid(emailEl.value)){ markInvalid(emailEl, true); ok = false; fmtMsgs.push(bk_t('errEmail')); }
    var postalEl = document.getElementById('bk-postal');
    if(postalEl && !bk_usingSavedAddress && postalEl.value.trim()){
      var postalFixed = bk_postalNormalize(postalEl.value);
      if(bk_postalValid(postalFixed)) postalEl.value = postalFixed;
      else { markInvalid(postalEl, true); ok = false; fmtMsgs.push(bk_t('errPostal')); }
    }
    if(bk_partnerOn){
      var codeEl = document.getElementById('bk-partner-code');
      if(codeEl && !/^VC-\d{4}$/.test(codeEl.value)){ markInvalid(codeEl, true); ok = false; }
      // Kod, który serwer już sprawdził i nie rozpoznał (bk_checkPartnerCode), nie przechodzi dalej — zamiast po cichu zapisać zamówienie
      // bez partnera. Brak wyniku sprawdzenia (sieć / jeszcze trwa) nie blokuje zamówienia.
      else if(codeEl && bk_partnerCodeValid === false){ markInvalid(codeEl, true); ok = false; fmtMsgs.push(bk_t('partnerInvalid')); }
    }
    var consentEl = document.getElementById('bk-consent');
    if(consentEl && !consentEl.checked){ markInvalid(document.getElementById('bk-consent-wrap')); ok = false; }
    var errEl = document.getElementById('bk-formError');
    if(slotExpired) fmtMsgs.unshift(bk_t('slotExpired'));
    if(errEl){
      if(fmtMsgs.length){ errEl.style.whiteSpace = 'pre-line'; errEl.textContent = fmtMsgs.join('\n'); errEl.style.display = 'block'; }
      else errEl.style.display = 'none';
    }
    if(!ok && firstInvalid){
      firstInvalid.scrollIntoView({behavior:'smooth', block:'center'});
    }
    return ok;
  }

  /* ─── PAYMENT BUTTONS ──────────────────────────────── */
  // :not(.bk-consent-photo-opt) — the marketing-photo-consent buttons below reuse this
  // same class purely for shared button styling (no separate CSS rule exists for them),
  // so without this exclusion this handler also binds to them and clicking consent
  // overwrites bk_selectedPayment with 'allow'/'deny' and un-highlights the real choice.
  document.querySelectorAll('.bk-pay-opt:not(.bk-consent-photo-opt)').forEach(function(btn){
    btn.addEventListener('click',function(){
      bk_selectedPayment = btn.dataset.value;
      document.querySelectorAll('.bk-pay-opt:not(.bk-consent-photo-opt)').forEach(function(b){ b.classList.toggle('bk-pay-active', b===btn); });
      bk_checkForm();
      var payEl = bk_payGroupEl(); if(payEl) payEl.classList.remove('bk-invalid');
    });
  });

  /* ─── MARKETING PHOTO CONSENT ──────────────────────── */
  document.querySelectorAll('.bk-consent-photo-opt').forEach(function(btn){
    btn.addEventListener('click',function(){
      bk_marketingConsent = btn.dataset.value === 'allow';
      document.querySelectorAll('.bk-consent-photo-opt').forEach(function(b){ b.classList.toggle('bk-pay-active', b===btn); });
      bk_checkForm();
      var grp = document.getElementById('bk-marketingConsentGroup'); if(grp) grp.classList.remove('bk-invalid');
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
  // Live existence check — same RPC api/submit.js already uses server-side
  // (resolve_partner_id, granted to anon, returns only the id — never the
  // partner's name/phone/commission) — so the client sees right away whether
  // a code is real, instead of silently booking unattributed on a typo.
  var bk_partnerCheckTimer = null;
  var bk_partnerCodeValid = null; // null = not checked yet, true/false = last result
  function bk_checkPartnerCode(){
    var input = document.getElementById('bk-partner-code');
    var res = document.getElementById('bk-partner-result');
    var code = input ? input.value.trim().toUpperCase() : '';
    if(!/^VC-\d{4}$/.test(code)){
      bk_partnerCodeValid = null;
      if(res) res.textContent = '';
      return;
    }
    fetch(BK_SUPABASE_URL + '/rest/v1/rpc/resolve_partner_id', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey': BK_SUPABASE_ANON_KEY, 'Authorization':'Bearer '+BK_SUPABASE_ANON_KEY },
      body: JSON.stringify({ code: code })
    }).then(function(r){ return r.ok ? r.json() : null; }).then(function(id){
      // A stale response for an already-edited-again field would show the
      // wrong verdict — bail if the input no longer matches what we checked.
      if(!input || input.value.trim().toUpperCase() !== code) return;
      bk_partnerCodeValid = !!id;
      if(res){
        if(id){ res.textContent = bk_t('partnerValid'); res.style.color = '#16a34a'; }
        else { res.textContent = bk_t('partnerInvalid'); res.style.color = '#dc2626'; }
      }
    }).catch(function(){
      bk_partnerCodeValid = null;
      if(res) res.textContent = '';
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
      bk_partnerCodeValid = null;
      var res = document.getElementById('bk-partner-result');
      if(res) res.textContent = '';
      clearTimeout(bk_partnerCheckTimer);
      bk_partnerCheckTimer = setTimeout(bk_checkPartnerCode, 400);
      bk_checkForm();
    });
    bk_partnerCodeInput.addEventListener('focus',function(){
      if(bk_partnerCodeInput.value.length < 3) bk_partnerCodeInput.value = 'VC-';
    });
  }

  /* ─── ?ref= AUTO-ATTRIBUTION (e.g. vershclean.pl/?ref=VC-4821, a partner's own
     shared link) — opens the partner section and fills the code, same as if the
     client had typed it in by hand. Only on pages that have the partner UI. ─── */
  (function(){
    var refParam = new URLSearchParams(location.search).get('ref');
    if(!refParam || !bk_partnerBtn || !bk_partnerCodeInput) return;
    var digits = refParam.toUpperCase().replace(/[^0-9]/g,'').slice(0,4);
    if(digits.length !== 4) return;
    bk_partnerOn = true;
    window.bk_partnerOn = true;
    bk_partnerBtn.classList.add('bk-chip-active');
    var wrap = document.getElementById('bk-partner-code-wrap');
    if(wrap) wrap.classList.remove('bk-hidden');
    bk_partnerCodeInput.value = 'VC-' + digits;
    bk_checkForm();
    bk_checkPartnerCode();
  })();

  /* ─── PROMO CODE TOGGLE + LIVE CHECK (only on pages that include it) ─── */
  var bk_promoBtn = document.getElementById('bk-promoBtn');
  if(bk_promoBtn){
    bk_promoBtn.addEventListener('click',function(){
      bk_promoOn = !bk_promoOn;
      this.classList.toggle('bk-chip-active', bk_promoOn);
      var wrap = document.getElementById('bk-promo-code-wrap');
      if(wrap) wrap.classList.toggle('bk-hidden', !bk_promoOn);
      if(!bk_promoOn){
        // Turning the section off drops any already-applied discount — re-opening
        // requires checking the code again, same as re-typing a partner code.
        bk_promoApplied = null;
        var res = document.getElementById('bk-promo-result');
        if(res) res.textContent = '';
        bk_renderOrder();
      }
    });
  }
  var bk_promoCheckBtn = document.getElementById('bk-promo-check-btn');
  if(bk_promoCheckBtn){
    bk_promoCheckBtn.addEventListener('click',function(){
      var input = document.getElementById('bk-promo-code');
      var res = document.getElementById('bk-promo-result');
      var code = input ? input.value.trim().toUpperCase() : '';
      bk_promoApplied = null;
      if(!code){
        if(res){ res.textContent = bk_t('promoEmpty'); res.style.color = '#dc2626'; }
        bk_renderOrder();
        return;
      }
      bk_promoCheckBtn.disabled = true;
      var prevTxt = bk_promoCheckBtn.textContent;
      bk_promoCheckBtn.textContent = '…';
      fetch(BK_SUPABASE_URL + '/rest/v1/rpc/validate_promo_code', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'apikey': BK_SUPABASE_ANON_KEY, 'Authorization':'Bearer '+BK_SUPABASE_ANON_KEY },
        body: JSON.stringify({ p_code: code })
      }).then(function(r){ return r.ok ? r.json() : []; }).then(function(rows){
        var row = rows && rows[0];
        var d = window.bk_orderData || {};
        if(!row){
          if(res){ res.textContent = bk_t('promoInvalid'); res.style.color = '#dc2626'; }
        } else if(row.min_order_amount && d.price && d.price < row.min_order_amount){
          if(res){ res.textContent = bk_t('promoMin').replace('{min}', row.min_order_amount); res.style.color = '#dc2626'; }
        } else {
          bk_promoApplied = { discount_type: row.discount_type, discount_value: row.discount_value, min_order_amount: row.min_order_amount, code: code };
          var label = row.discount_type === 'percent' ? ('-'+row.discount_value+'%') : ('-'+row.discount_value+' zł');
          if(res){ res.textContent = bk_t('promoApplied')+label; res.style.color = '#16a34a'; }
        }
        bk_renderOrder();
      }).catch(function(){
        if(res){ res.textContent = bk_t('promoError'); res.style.color = '#dc2626'; }
      }).finally(function(){
        bk_promoCheckBtn.disabled = false;
        bk_promoCheckBtn.textContent = prevTxt;
      });
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
  var bk_submitting = false;
  var bk_lastFingerprint = '';
  var bk_requestId = '';
  function bk_newRequestId(){
    try { if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); } catch(e) {}
    var b = new Uint8Array(16);
    try { window.crypto.getRandomValues(b); } catch(e) { for(var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 v4
    var h = Array.prototype.map.call(b, function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  window.bk_submit = function(){
    if(bk_submitting) return;
    if(!bk_validateAndHighlight()) return;
    var l = typeof lang!=='undefined'?lang:'pl';
    var locale = bk_t('LOCALE');
    var slotObj = BK_SLOTS.find(function(s){return s.id===bk_selectedSlot;});
    var slotLabel = slotObj?slotObj.label:'';               // PL — order text for the team
    var slotDisplay = slotObj?bk_slotDisplayLabel(slotObj):''; // visitor's language — recap
    var dateLabel = bk_selectedDate.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'});
    var d = window.bk_orderData||{};
    var hwEligible = bk_isHalloweenEligible(bk_isoDate(bk_selectedDate));
    if(typeof window.bk_applyHalloweenGiftToAddons === 'function'){
      // Returning false means the page found a required gift choice missing
      // (e.g. eligible date but no "pick 1 free add-on" radio selected yet) and
      // has already highlighted/scrolled to it itself — abort this submit the
      // same way bk_validateAndHighlight()'s own false return does below.
      if(window.bk_applyHalloweenGiftToAddons(hwEligible, d) === false) return;
    }

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
    var fullAddress = bk_usingSavedAddress ? bk_savedAddressText : (street+(apt?('/'+apt):'')+', '+postal+' '+city);

    // Usługa i Kod partnera NIE trafiają tutaj — trafiają do Telegrama i tak
    // jako osobne, górne pola tej samej wiadomości (patrz submit.js), więc
    // powtarzanie ich tu tylko dublowałoby tekst.
    var comment = 'REZERWACJA TERMINU (' + (document.title.split('|')[0] || '').trim() + ')\n';
    // Area: pages send either an exact area (area / areaM2) or, for fixed-price
    // tiers, only the chosen bracket (areaRange, PL, e.g. "do 45 m²") — a bracket
    // is never reported as an actual measured area.
    if(d.areaRange) comment+='Zakres metrażu: '+d.areaRange+'\n';
    else if(d.area) comment+='Powierzchnia: '+d.area+'\n';
    else if(typeof d.areaM2 === 'number' && d.areaM2 > 0) comment+='Powierzchnia: '+d.areaM2+' m²\n';
    if(d.extras) comment+='Dodatki: '+d.extras+'\n';
    if(d.freq) comment+='Częstotliwość: '+d.freq+'\n';
    var nightOn = bk_isNightSlot();
    if(d.price) comment+='Szacunkowa cena: '+bk_finalPrice(d.price)+' zł\n';
    // The comment is read by the Polish-speaking team: its labels are always Polish (the visitor-language texts stay on screen only).
    if(nightOn) comment+=BK_TX.pl.nightComment+'\n';
    comment+='Data: '+dateLabel+'\n';
    comment+='Godzina: '+slotLabel+'\n';
    var bonus = bk_getBonus(bk_selectedDate);
    if(bonus) comment+='🎁 Bonus dnia: '+(bonus.pl)+'\n';
    if(typeof window.bk_halloweenGiftLine === 'function'){
      var hwCommentLine = window.bk_halloweenGiftLine(hwEligible);
      if(hwCommentLine) comment+='🎃 Halloween GRATIS: '+hwCommentLine+'\n';
    }
    comment+='Adres: '+fullAddress+'\n';
    var payLabelPl = bk_selectedPayment ? (({transfer:BK_TX.pl.payTransfer,blik:BK_TX.pl.payBlik,cash:BK_TX.pl.payCash})[bk_selectedPayment] || bk_selectedPayment) : '';
    comment+='Sposób płatności: '+payLabelPl+'\n';
    comment+='Faktura: '+(bk_invoiceOn?'TAK':'nie')+'\n';
    var partnerCode = '';
    if(bk_partnerOn){
      partnerCode = document.getElementById('bk-partner-code').value.trim();
      // Kod partnera trafia do Telegrama osobno (patrz submit.js) — nie
      // dublujemy go tutaj.
    }
    var promoCode = (bk_promoOn && bk_promoApplied) ? bk_promoApplied.code : '';
    if(promoCode) comment+='Kod promocyjny: '+promoCode+'\n';
    if(email) comment+='E-mail: '+email+'\n';
    // Prawdziwa uwaga klienta NIE trafia tutaj — jest wysyłana osobno jako
    // clientNote, żeby "Komentarz:" w Telegramie pokazywał wyłącznie to,
    // co klient faktycznie napisał, a nie całe to podsumowanie zamówienia.

    // Duplicate-submit protection: the lock above (bk_submitting) stops double clicks and
    // Enter-key repeats while a request is in flight; requestId makes a retry of the SAME
    // order idempotent on the server (it is used as requests.id, a repeat of an already
    // saved order is answered with success without creating a second row or notifying
    // anyone again). Any change to the order content produces a new id.
    var fingerprint = [name, phone, email, fullAddress, bk_isoDate(bk_selectedDate), bk_selectedSlot, bk_selectedPayment,
      d.serviceSlug || '', d.price || 0, notes, JSON.stringify(d.addons || []), promoCode, partnerCode].join('\u0001');
    if(fingerprint !== bk_lastFingerprint){ bk_lastFingerprint = fingerprint; bk_requestId = bk_newRequestId(); }

    bk_submitting = true;
    var btn = document.getElementById('bk-submitBtn');
    btn.disabled = true;
    document.getElementById('bk-submit-txt').textContent = bk_t('submitSending');
    document.getElementById('bk-formError').style.display='none';

    fetch('/api/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({
        name:name, phone:phone, service:d.service||'Rezerwacja terminu', comment:comment, clientNote:notes, partnerCode:partnerCode,
        promoCode:promoCode, serviceSlug:d.serviceSlug||'',
        requestId:bk_requestId, postalCode:(bk_usingSavedAddress ? '' : postal),
        email:email||'', address:fullAddress,
        scheduledDate:bk_isoDate(bk_selectedDate), scheduledTime:(slotObj?slotObj.start:''),
        price:d.price?bk_finalPrice(d.price):null,
        clientToken:bk_clientToken||'', propertyId:bk_savedPropertyId||'',
        clientLanguage: (typeof localStorage!=='undefined' && localStorage.getItem('vc_lang')) || bk_lang || 'pl',
        // Structured booking-time snapshot — raw values the page already computed
        // for pricing/display, sent alongside (not instead of) comment/extras/freq
        // so the admin side can store them in the same model a manual request uses,
        // without parsing the display strings above.
        addons: Array.isArray(d.addons) ? d.addons : [],
        areaM2: (typeof d.areaM2 === 'number' && d.areaM2 > 0) ? d.areaM2 : null,
        // Chosen fixed-price bracket (PL, e.g. "do 45 m²"), separate from areaM2.
        // Not stored by api/submit yet — it already reaches the team via the
        // service label and the "Zakres metrażu" line of the order text.
        areaRange: d.areaRange || null,
        freqTimes: (typeof d.freqTimes === 'number' && d.freqTimes > 0) ? d.freqTimes : 1,
        // Monthly plan of a regular order (amounts already computed by the calculator); the server only splits the monthly total across visits.
        regularPlan: d.regularPlan || null,
        serviceLines: Array.isArray(d.serviceLines) ? d.serviceLines : null,
        paymentMethod: bk_selectedPayment || null,
        invoiceRequested: !!bk_invoiceOn,
        marketingPhotoConsent: bk_marketingConsent,
        promoDiscountAmount: d.price ? bk_promoDiscountAmount(d.price) : 0
      }, bk_getFirstTouch()))
    })
    .then(function(r){
      if(!r.ok){
        return r.json().catch(function(){ return null; }).then(function(j){
          var e = new Error('submit failed'); e.status = r.status; e.code = j && j.code; throw e;
        });
      }
      return r.json();
    })
    .then(function(res){
      if(!res || res.success !== true) throw new Error('submit failed');
      // analyticsLabel keeps the GA4 event_label exactly as before the area/range
      // detail was added to `service` (analytics unchanged in this batch).
      trackFormConversion(d.analyticsLabel || d.service || '');
      document.getElementById('bk-successName').textContent = bk_t('successThanks')+', '+(name.split(' ')[0]||'')+'!';
      // Regular (monthly series) order: the visit dates are agreed by the manager afterwards — say so, and label the chosen date as a preference.
      var bkRegular = !!d.regularPlan;
      document.getElementById('bk-success-p').innerHTML = bk_t(bkRegular ? 'successRegP' : 'successP');
      if(bkRegular){
        document.getElementById('bk-r-date').textContent = bk_t('recapDateReg');
        document.getElementById('bk-r-time').textContent = bk_t('recapTimeReg');
      }
      document.getElementById('bk-recapDate').textContent = dateLabel;
      document.getElementById('bk-recapTime').textContent = slotDisplay;
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
      bk_applyWaBtnState();
      var gridWrap = document.querySelector('.bk-grid-wrap');
      if(gridWrap) gridWrap.style.display='none';
      // Service pages with their own inline calculator (see submitOrder() in
      // e.g. sprzatanie-mieszkan-i-domow-krakow.html) keep a separate, always-
      // visible order-summary sidebar with its own "Złóż zamówienie" button
      // (#sb-cta desktop, #mob-cta-btn mobile bar) — that card lives outside
      // .bk-grid-wrap entirely, so hiding gridWrap above never touched it and
      // it stayed clickable right next to the "Dziękujemy" success message.
      // Pages without this calculator simply don't have these ids — no-op there.
      // 'order-cta' is the same button, just under a different id on the
      // po-remoncie page specifically (sb-cta/mob-cta-btn elsewhere).
      ['sb-cta', 'mob-cta-btn', 'order-cta'].forEach(function(id){
        var el = document.getElementById(id);
        if(el) el.disabled = true;
      });
      document.getElementById('bk-successView').classList.remove('bk-hidden');
      document.getElementById('bk-successView').scrollIntoView({behavior:'smooth',block:'start'});
    })
    .catch(function(err){
      var errEl = document.getElementById('bk-formError');
      // The server re-validates every field (api/submit.js) and answers 400 with a
      // machine-readable `code`; show the matching message in the visitor's language
      // and mark the field. Anything else (network, 5xx) keeps the generic message.
      var code = err && err.code;
      var fieldByCode = {invalid_name:'bk-name', invalid_phone:'bk-phone', invalid_email:'bk-email', invalid_postal:'bk-postal'};
      var keyByCode = {invalid_name:'errName', invalid_phone:'errPhone', invalid_email:'errEmail', invalid_postal:'errPostal', too_long:'errTooLong'};
      errEl.style.whiteSpace = 'pre-line';
      // Validation problem -> its own message. Anything else (network, database down):
      // say plainly that the order was NOT accepted, then the generic "try again / call".
      errEl.textContent = keyByCode[code] ? bk_t(keyByCode[code]) : bk_t('errNotAccepted') + '\n' + bk_t('errMsg');
      errEl.style.display='block';
      // Not a validation problem (network down, server/database unavailable): the order was
      // NOT confirmed. Besides "try again / call", offer a second reliable channel — the
      // same order as a prefilled WhatsApp message — so the lead cannot be lost.
      if(!keyByCode[code]){
        try {
          var waText = (comment + '\nImię: ' + name + '\nTelefon: ' + phone + (email ? '\nE-mail: ' + email : '')).slice(0, 1500);
          var waLink = document.createElement('a');
          waLink.id = 'bk-err-wa';
          waLink.href = 'https://wa.me/48514363538?text=' + encodeURIComponent(waText);
          waLink.target = '_blank';
          waLink.rel = 'noopener';
          waLink.textContent = '💬 ' + bk_t('errWa');
          waLink.style.cssText = 'display:block;margin-top:8px;font-weight:700;text-decoration:underline;color:inherit';
          errEl.appendChild(waLink);
        } catch(e) { /* the plain error text above is enough */ }
      }
      var badField = fieldByCode[code] && document.getElementById(fieldByCode[code]);
      if(badField){ badField.classList.add('bk-field-invalid'); badField.scrollIntoView({behavior:'smooth', block:'center'}); }
      bk_submitting = false;
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
      'bk-lbl-marketing-consent':'lblMarketingConsent','bk-marketing-consent-label':'marketingConsentLabel',
      'bk-marketing-consent-allow':'marketingConsentAllow','bk-marketing-consent-deny':'marketingConsentDeny',
      'bk-partner-label':'partnerLabel','bk-lbl-partner-code':'lblPartnerCode','bk-partner-code-hint':'partnerCodeHint',
      'bk-lbl-notes':'lblNotes','bk-opt2':'opt','bk-submit-txt':'submitTxt',
      'bk-cta-sub':'ctaSub','bk-r-date':'recapDate','bk-r-time':'recapTime',
      'bk-r-phone':'recapPhone','bk-consent-label':'consentLabel'
    };
    var richIds = {'bk-sub-txt':1,'bk-consent-label':1,'bk-marketing-consent-label':1};
    Object.keys(ids).forEach(function(id){
      var el = document.getElementById(id);
      if(el){ if(richIds[id]) el.innerHTML=bk_t(ids[id]); else el.textContent=bk_t(ids[id]); }
    });
    bk_applyWaBtnState();
    var savedLbl = document.getElementById('bk-saved-addr-label');
    if(savedLbl) savedLbl.textContent = bk_t('savedAddrLabel');
    var manualOpt = document.getElementById('bk-saved-addr-manual');
    if(manualOpt) manualOpt.textContent = bk_t('manualAddrOpt');
    // Halloween gift boxes on the pages carry a .bk-hw-dates line (date condition).
    document.querySelectorAll('.bk-hw-dates').forEach(function(el){ el.textContent = window.bk_hwDatesNote(false); });
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

  // Confirmation-screen action button: guests get the WhatsApp deep link
  // (unchanged); a client who was already logged in when they booked gets a
  // link straight to their own orders list instead — a WhatsApp handoff
  // makes no sense when we already know exactly who they are and the order
  // is sitting in their cabinet. #myrequests matches the client cabinet's
  // own panel id once it supports hash-based deep links (see client.js).
  function bk_applyWaBtnState(){
    var btn = document.getElementById('bk-wa-btn');
    if(!btn) return;
    if(bk_isAuthenticated){
      btn.textContent = bk_t('myOrdersBtn');
      btn.href = 'https://kabinet.vershclean.pl/client/dashboard.html#myrequests';
      btn.removeAttribute('target');
      btn.removeAttribute('rel');
    } else {
      btn.textContent = bk_t('waBtn');
      btn.href = 'https://wa.me/48514363538';
      btn.target = '_blank';
      btn.rel = 'noreferrer';
    }
  }

  /* ─── LOGGED-IN CLIENT: prefill + saved-address picker ─
     window.vcGetClientSession (assets/js/client-session.js) resolves the
     cookie the client cabinet mirrors onto .vershclean.pl. Guests (no
     cookie, or vcGetClientSession missing/rejects) fall straight through —
     the form behaves exactly as before. */
  function bk_buildSavedAddressUI(properties){
    var streetInput = document.getElementById('bk-street');
    if(!streetInput) return;
    var streetWrap = streetInput.closest('div');
    if(!streetWrap || !streetWrap.parentNode) return;
    var manualWraps = ['bk-street','bk-apt','bk-postal','bk-city'].map(function(id){
      var el = document.getElementById(id);
      return el ? el.closest('div') : null;
    }).filter(Boolean);

    var wrap = document.createElement('div');
    wrap.id = 'bk-saved-addr-wrap';
    wrap.style.cssText = 'grid-column:1/-1;display:flex;flex-direction:column;gap:6px';
    var label = document.createElement('label');
    label.id = 'bk-saved-addr-label';
    label.htmlFor = 'bk-saved-addr-select';
    label.style.cssText = 'font-size:13px;font-weight:600;color:#334155';
    label.textContent = bk_t('savedAddrLabel');
    var select = document.createElement('select');
    select.id = 'bk-saved-addr-select';
    select.className = 'bk-input';
    properties.forEach(function(p){
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = '📍 ' + p.address + (p.area ? ' (' + p.area + ' m²)' : '');
      select.appendChild(opt);
    });
    var manualOpt = document.createElement('option');
    manualOpt.value = 'manual';
    manualOpt.id = 'bk-saved-addr-manual';
    manualOpt.textContent = bk_t('manualAddrOpt');
    select.appendChild(manualOpt);
    wrap.appendChild(label);
    wrap.appendChild(select);
    streetWrap.parentNode.insertBefore(wrap, streetWrap);

    // While a saved address is picked, the hidden manual inputs hold placeholder
    // values (see below). `injected` remembers exactly what was written there and
    // `manualStash` whatever the client had typed before, so switching to
    // "Inny adres" removes only our placeholders and restores the client's own
    // input — it never wipes text the client entered.
    var ADDR_IDS = ['bk-street','bk-apt','bk-postal','bk-city'];
    var injected = null;
    var manualStash = null;
    function readAddr(){
      var v = {};
      ADDR_IDS.forEach(function(id){ var el = document.getElementById(id); v[id] = el ? el.value : ''; });
      return v;
    }
    function writeAddr(v){
      ADDR_IDS.forEach(function(id){ var el = document.getElementById(id); if(el) el.value = v[id] || ''; });
    }

    function applySelection(){
      if(select.value === 'manual'){
        bk_usingSavedAddress = false;
        bk_savedAddressText = '';
        bk_savedPropertyId = null;
        if(injected){
          var cur = readAddr();
          var restored = {};
          ADDR_IDS.forEach(function(id){
            // Field still holds our placeholder → put back the client's own value
            // (or empty); a field the client already edited stays as it is.
            restored[id] = (cur[id] === injected[id]) ? ((manualStash && manualStash[id]) || '') : cur[id];
          });
          writeAddr(restored);
          injected = null;
          manualStash = null;
        }
        manualWraps.forEach(function(el){ el.style.display = ''; });
      } else {
        var prop = properties.find(function(p){ return p.id === select.value; });
        if(!injected) manualStash = readAddr(); // first switch into saved mode
        bk_usingSavedAddress = true;
        bk_savedAddressText = prop ? prop.address : '';
        bk_savedPropertyId = prop ? prop.id : null;
        manualWraps.forEach(function(el){ el.style.display = 'none'; });
        // bk_checkForm()/bk_validateAndHighlight() still read these hidden inputs'
        // .value — keep them non-empty so a saved address doesn't block the "ready"
        // state. bk_submit() ignores this placeholder and sends bk_savedAddressText.
        injected = {'bk-street': bk_savedAddressText, 'bk-apt': '', 'bk-postal': '00-000', 'bk-city': '—'};
        writeAddr(injected);
      }
      bk_checkForm();
    }
    select.addEventListener('change', applySelection);
    applySelection();
  }

  function bk_initClientSession(){
    if(typeof window.vcGetClientSession !== 'function') return;
    window.vcGetClientSession().then(function(session){
      if(!session) return;
      bk_clientToken = session.token;
      bk_isAuthenticated = true;
      var nameEl = document.getElementById('bk-name');
      var phoneEl = document.getElementById('bk-phone');
      var emailEl = document.getElementById('bk-email');
      if(nameEl && !nameEl.value.trim() && session.name) nameEl.value = session.name;
      if(phoneEl && !phoneEl.value.trim() && session.phone) phoneEl.value = session.phone;
      if(emailEl && !emailEl.value.trim() && session.email) emailEl.value = session.email;
      bk_checkForm();
      if(session.properties && session.properties.length) bk_buildSavedAddressUI(session.properties);
    }).catch(function(){});
  }

  /* ─── INIT ─────────────────────────────────────────── */
  // Input hints and length limits are applied here (not in the page HTML) so every
  // page that includes booking.js gets the same rules; the server enforces the same
  // limits. Editing a field also clears its red "invalid" highlight.
  (function bk_initFieldRules(){
    var rules = {
      'bk-name':   {maxlength:'120', autocomplete:'name'},
      'bk-phone':  {maxlength:'30',  inputmode:'tel', autocomplete:'tel'},
      'bk-email':  {maxlength:'254', inputmode:'email', autocomplete:'email'},
      'bk-street': {maxlength:'150', autocomplete:'address-line1'},
      'bk-apt':    {maxlength:'20'},
      'bk-postal': {maxlength:'6',   autocomplete:'postal-code'},
      'bk-city':   {maxlength:'80',  autocomplete:'address-level2'},
      'bk-notes':  {maxlength:'2000'}
    };
    Object.keys(rules).forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      Object.keys(rules[id]).forEach(function(a){ el.setAttribute(a, rules[id][a]); });
      el.addEventListener('input', function(){ el.classList.remove('bk-field-invalid'); });
    });
  })();
  bk_renderCal();
  bk_renderSlots();
  bk_applyTexts();
  bk_initClientSession();

})();
