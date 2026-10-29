# Vercel Preview — чек-лист (этап 6, только по отдельному разрешению)

Preview защищён паролем (`middleware.js`) — проверять в браузере после ввода пароля; для curl передавать cookie/заголовок, который выставляет middleware.
Все адреса ниже — относительно Preview-хоста. «Ожидание» = критерий прохождения.

## 1. Маршруты и HTTP-статусы (curl -sI, без следования редиректам)
| Запрос | Ожидание |
|---|---|
| `/`, `/uk`, `/ru`, `/en` | 200 (главные на 4 языках; `/uk` не должен редиректить на `/uk/` или `/uk/index`) |
| `/<slug>` и `/uk|ru|en/<slug>` для 7 страниц (mieszkan, remont, wyprowadzka, trudne, okien, poznaj-nas, program-partnerski) | 200 |
| `/regulamin`, `/polityka-prywatnosci`, `/polityka-cookies`, `/zalacznik-nr-1-zakres-uslug` и их `/uk|ru|en/…` | 200, в `<head>` `noindex,follow` |
| `/uk/`, `/uk/index`, `/uk/index.html`, `/uk/regulamin.html` | 308 → `/uk` / `/uk` / `/uk` / `/uk/regulamin` (без цепочек) |
| `/uk/nieistnieje`, `/ru/x`, `/en/x`, `/x` | **404** (не 200 и не 301), тело — 404.html, нужный язык показывается по префиксу |
| `/poznaj-nas` (rewrite) и старые redirect-slug'и (`/sprzatanie-mieszkan-krakow` и др.) | как раньше (200 / 308) |
| `/docs/…`, `/scripts/…`, `/scripts/i18n/prerender.html` | редирект на `/` (не отдаются) |
| `/sitemap.xml`, `/robots.txt` | 200; sitemap на Preview — см. раздел 6 |

## 2. Canonical / hreflang / lang (по 32 страницам; можно скриптом scripts/i18n/check.html против Preview-хоста)
- `<html lang>` = язык URL; `canonical` = сам URL на домене `https://www.vershclean.pl` (так задумано, не Preview-хост);
- ровно 5 `link rel=alternate hreflang` (pl, uk, ru, en, x-default → PL), набор одинаков на всех 4 версиях страницы, взаимные;
- `og:url`, `og:locale`, абсолютные `og:image`/`twitter:image`, JSON-LD парсится (Rich Results Test / validator.schema.org).

## 3. Ресурсы
- DevTools → Network на `/uk/…`, `/ru/…`, `/en/…`: ни одного 404 (css, js, fonts, img, видео «окна.mp4» и др. на poznaj-nas, favicon, manifest);
- в консоли нет ошибок JS; иконки услуг-карточек в index/poznaj-nas грузятся с корневых путей.

## 4. Формы (БЕЗ отправки; на Preview не создавать заявки)
- Подписи, подсказки, ошибки валидации (имя 1 символ, неверный телефон) — на языке страницы;
- ссылка в согласии ведёт на `/<lang>/polityka-prywatnosci`; калькулятор: итоги = польской странице при тех же выборах; календарь, слоты, extras;
- DevTools → Network: при проверке нет запросов на `/api/submit`.

## 5. Cookie Consent и GTM
- Баннер на языке страницы; ссылки «Политика конфиденциальности» и «Настройки cookies» → `/<lang>/polityka-prywatnosci` и `/<lang>/polityka-cookies#customize`; панель настроек на `/<lang>/polityka-cookies` работает;
- до согласия GTM/gtag не грузятся, после «ОК» — грузятся (Network: `googletagmanager.com/gtm.js?id=GTM-PLMP4PG5`);
- **GTM (чтение, нужен доступ к контейнеру):** в Preview-режиме Tag Assistant открыть `/uk/…`; убедиться, что Google tag и события `generate_lead`, `phone_call` срабатывают; в триггерах/переменных нет условий «Page Path равно польскому slug»; `page_location` в GA4 DebugView = `/uk/...`; `landing_page` (cookie-consent) = `/uk/...`.

## 6. Sitemap и индексация
- Шаг A (первый deploy): `sitemap.xml` остаётся прежним (8 польских URL); новые адреса в нём отсутствуют;
- Шаг Б (после проверки Production, п.1–3 зелёные, все 32 URL отвечают 200): скопировать `scripts/i18n/sitemap.multilang.xml` → `sitemap.xml`, отдельный commit/deploy, затем отправить sitemap в Search Console;
- автопроверка перед шагом Б: каждый `<loc>` и каждый `xhtml:link href` → 200.
