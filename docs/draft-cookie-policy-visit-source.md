# DRAFT — уточнение политики cookies об учёте источников посещений

Статус: ЧЕРНОВИК. Опубликованные `polityka-cookies.html` (PL/uk/ru/en) и тексты баннера (`assets/js/cookie-consent.js`, TX.*.cats.ads) НЕ изменены. Применять только после отдельного разрешения Owner.

Что меняется по сути: запись `vc_first_touch` теперь может содержать не только данные рекламного клика, но и источник визита из рекомендации AI-сервиса (домен-источник из UTM-метки или из адреса страницы-источника). Запись по-прежнему делается в localStorage только при согласии на «Reklamowe pliki cookie», до 90 дней, и используется только для отнесения заявки к источнику.

## Минимальная замена в п. «Reklamowe pliki cookie» (polityka-cookies.html, строка 72/73)

Заменить фрагмент в скобках:

- PL: было `(identyfikator kliknięcia i parametry kampanii, vc_first_touch, przechowywany do 90 dni)` → стало `(identyfikator kliknięcia, parametry kampanii lub nazwa serwisu, z którego przyszedł użytkownik, np. asystent AI, vc_first_touch, przechowywany do 90 dni)`; и `nasz zapis źródła wizyty z reklamy` → `nasz zapis źródła wizyty (z reklamy lub z polecenia w serwisie AI)`.
- UK: `(ідентифікатор кліку, параметри кампанії або назва сервісу, з якого прийшов користувач, напр. AI-асистент, vc_first_touch, зберігається до 90 днів)`; `наш запис джерела візиту (з реклами або з рекомендації в AI-сервісі)`.
- RU: `(идентификатор клика, параметры кампании или название сервиса, из которого пришёл пользователь, напр. AI-ассистент, vc_first_touch, хранится до 90 дней)`; `наша запись источника визита (из рекламы или из рекомендации в AI-сервисе)`.
- EN: `(click identifier, campaign parameters or the name of the service the visitor came from, e.g. an AI assistant, vc_first_touch, stored for up to 90 days)`; `our record of the source of a visit (from an ad or from a recommendation in an AI service)`.

## Баннер (cats.ads, одна фраза)

- PL: `nasz zapis źródła wizyty z reklamy` → `nasz zapis źródła wizyty (reklama lub polecenie AI)`
- UK/RU/EN — аналогично по смыслу.

Дополнительно, не требуется: новых cookies, новых категорий согласия, изменений в Polityce prywatności об обработчиках (данные остаются в нашей заявке).
