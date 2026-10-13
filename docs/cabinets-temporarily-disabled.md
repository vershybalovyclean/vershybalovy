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

Не тронуты: мойка окон как доп. услуга (пункты `toggleAddWindow`, расчёт по м², `window-picker.js`), быстрые карточки «Mycie okien — Dodaj» на мобильных, цены, логика скидки −10% при сочетании окон с уборкой (`win_combo_discount` в калькуляторе `wyprowadzce`), отдельная страница `mycie-okien.html`. Картинка `hero-service.jpg` осталась: её используют другие страницы. Из скриптов синхронизации и общих шаблонов банеры не восстанавливаются: таких упоминаний нет.

## Что изменено в `vershy-admin` (отдельный репозиторий)

Файл `vercel.json` (ветка `disable-client-partner-cabinets`, коммит `0751c3c`, пока не запушен):
- `/client/*` → `https://vershclean.pl/`
- `/partner/*` → `https://vershclean.pl/program-partnerski`
- весь хост `kabinet.vershclean.pl` → `https://vershclean.pl/`

Страницы владельца, менеджера и клинера (`admin.` / `panel.`), а также `rate.html` не затронуты.

## Как вернуть кабинеты

1. Сайт: откатить коммит с этой правкой (`git revert <hash>`) или вернуть из истории блоки, перечисленные выше. После отката повысить версии `base.css` и `site-texts-sync.js` в HTML, чтобы сбросить кеш браузеров. Если блок `.hdr-login` вернётся, удалить `margin-left:auto` у `.burger` в `base.css`.
2. `vershy-admin`: удалить `vercel.json` или откатить коммит `0751c3c`, затем задеплоить.
