# Личные кабинеты временно отключены на публичном сайте (13.10.2026)

Кабинеты клиента и партнёра **не удалены**: код, данные Supabase и интеграции не тронуты. С публичных страниц убраны только точки входа, а в проекте `vershy-admin` закрыты прямые ссылки.

## Что изменено на сайте (этот репозиторий)

Во всех 12 HTML-страницах:
- Удалён блок `.hdr-login` в шапке (кнопка 👤 и выпадающее меню «Kabinet klienta / Kabinet partnera / Zarejestruj się / Zostań partnerem»).
- Пункт «Zarejestruj się» в мобильном меню (`#hng11`) заменён на «WhatsApp» (`https://wa.me/48514363538`).
- Нижняя мобильная панель: вкладка «Konto» (`#mtb-lbl-account`) заменена на «Zadzwoń» (`tel:`, `data-vc-call`). На `trudne-przypadki-sprzatanie-krakow.html` там уже была вкладка «Zadzwoń», поэтому вместо неё стоит «Partner» (`/program-partnerski`). Всплывающее меню `#mtb-account-menu` удалено.
- Убраны теги `<script>` для `assets/js/client-session.js` и `assets/js/site-auth-ui.js`. Файлы остались в репозитории. Без `client-session.js` форма заказа ведёт себя как для гостя (подстановка данных вошедшего клиента отключена).
- В словарях переводов `mtbAccount` / `mtb_account` теперь содержат «Zadzwoń / Call / Подзвонити / Позвонить» (или «Partner…»), а `hng11` — «WhatsApp». Остальные ключи `login_*`, `loginClient` и т. п. оставлены, они ни на что не влияют.

`assets/css/base.css`: у `.burger` и `.hdr-nav` добавлен `margin-left:auto` — раньше это выравнивание делал блок `.hdr-login`. Версии `base.css` и `site-texts-sync.js` в HTML повышены до `20261013a`.

`assets/js/site-texts-sync.js`: ссылки `mailto:` с атрибутом `data-vc-fixed-mail` больше не перезаписываются общей почтой компании.

`program-partnerski.html`: добавлен `mailto:partnerzy@vershclean.pl` (строка под формой и кнопка после отправки формы с готовым текстом письма).

## Убраны рекламные блоки мойки окон (13.10.2026)

Удалены баннеры «Mycie okien» (фон `hero-service.jpg`, сезонные цены, кнопка «Dodaj mycie okien do zamówienia») со страниц:
- `sprzatanie-mieszkan-i-domow-krakow.html` (`#win-upsell-section`),
- `sprzatanie-po-remoncie-krakow.html` (`#win-upsell-section`),
- `sprzatanie-po-wyprowadzce-krakow.html` (`#win-upsell-section` и плашка `#combo-section` «Łącz usługi i oszczędzaj −10%»).

Вместе с блоками удалены их JS-подписи (мультиязычные тексты banner'ов) и правила порядка `#win-upsell-section` / `#combo-section` в `mieszkan-mobile.css`, `remont.css`, `wyprowadzce.css`.

Не тронуты: мойка окон как платная доп. услуга (пункты `toggleAddWindow`, расчёт по м², `window-picker.js`, тарифы), быстрые карточки «Mycie okien — Dodaj» на мобильных, отдельная страница `mycie-okien.html`. Картинка `hero-service.jpg` осталась: её используют другие страницы. Из скриптов синхронизации и общих шаблонов баннеры не восстанавливаются: таких упоминаний нет.

## Отменена скидка −10% за сочетание мойки окон с уборкой (окончательное решение)

Удалено: автоматический расчёт скидки в калькуляторах `sprzatanie-po-wyprowadzce-krakow`, `sprzatanie-po-remoncie-krakow` и `sprzatanie-mieszkan-i-domow-krakow` (строка скидки в боковой панели и ограничение «−5% при партнёрском коде»); логика «okna −10%» (срок до 30.09.2026) в устаревших блоках `index.html` и `poznaj-nas.html` (форма, `updatePriceSummary`, `calcUpdatePrice`, плашка «dzień roboczy + okna»); плашка «Łącz usługi i oszczędzaj» на `mycie-okien.html`; фраза «rabat 10%» в описании услуги на главной и `poznaj-nas`; все тексты PL/UK/RU/EN (`combo_*`, `win_combo_discount_lbl`, `discount_lbl`, `calcWinDiscLabel`, `upsell_*`); мёртвые CSS-правила `.combo-banner*`, `.ac-combo-*`. Сервер (`api/submit.js`) цену не считает, а принимает от страницы; сумма заказа на страницах и раньше формировалась без этой скидки, теперь интерфейс с ней совпадает.

Не затронуты: скидка за регулярность (2×/3×/4×), «dzień roboczy», промокоды, акция Halloween.

## Партнёрская форма (`/program-partnerski#dolacz`)

Форма теперь реально отправляет заявку: `POST /api/submit` с `formType: "partner"` (ветка `handlePartnerSignup` в `api/submit.js`).
- Письмо на `partnerzy@vershclean.pl` (переопределяется env `partner_to_email`), тема «Nowe zgłoszenie partnerskie — Vershy Property Care», `Reply-To` = e-mail заявителя (если указан и корректен). Отправитель по умолчанию `Vershy Property Care <noreply@mail.vershclean.pl>` (env `partner_from_email`): домен `mail.vershclean.pl` подтверждён в Resend по README `vershy-admin`, но проверьте, что ключ `Resend_api_key` относится к тому же аккаунту.
- Уведомление в Telegram (тема «Требует внимания») через существующий `notify-owner-event` (`site_contact`).
- В Google Sheets и Supabase заявка не пишется.
- Успех показывается только после ответа сервера `success: true`; повторная отправка блокируется; при ошибке показывается сообщение с адресом `partnerzy@`.
- Защита: honeypot (`website`), серверная валидация и ограничение длины, очистка управляющих символов. Лимита частоты запросов нет.
- Заявка не создаёт аккаунт, договор, код или комиссию.

Для обычных заявок `api/submit.js` добавлено только необязательное: `Reply-To` (если клиент указал корректный e-mail) и env `resend_from` для отправителя (по умолчанию как раньше, `onboarding@resend.dev`).

## Что изменено в `vershy-admin` (отдельный репозиторий)

Файл `vercel.json` (ветка `disable-client-partner-cabinets`, коммит `0751c3c`, пока не запушен):
- `/client/*` → `https://vershclean.pl/`
- `/partner/*` → `https://vershclean.pl/program-partnerski`
- весь хост `kabinet.vershclean.pl` → `https://vershclean.pl/`

Страницы владельца, менеджера и клинера (`admin.` / `panel.`), а также `rate.html` не затронуты.

## Как вернуть кабинеты

1. Сайт: откатить коммит с этой правкой (`git revert <hash>`) или вернуть из истории блоки, перечисленные выше. После отката повысить версии `base.css` и `site-texts-sync.js` в HTML, чтобы сбросить кеш браузеров. Если блок `.hdr-login` вернётся, удалить `margin-left:auto` у `.burger` в `base.css`.
2. `vershy-admin`: удалить `vercel.json` или откатить коммит `0751c3c`, затем задеплоить.
