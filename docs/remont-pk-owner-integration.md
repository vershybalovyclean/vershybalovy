# POD KLUCZ — интеграция с Owner-кабинетом (10.11.2026, локально)

## Путь заявки
калькулятор → `bk_orderData` → `booking.js` → `POST /api/submit` → Supabase `requests` (+ `request_services`) → Owner.

| Поле заказа | Что сохраняется |
|---|---|
| `requests.price` | итог = база (55 × м²) + допуслуги, как отправил сайт; сервер цену не пересчитывает |
| `requests.area_m2` | площадь (80) |
| `requests.service_id` | услуга `sprzatanie-po-remoncie` (по slug) |
| `requests.service_label` | только обычное название + площадь («Sprzątanie po remoncie pod klucz · 80 m²»); уровень и справочная строка цены в название НЕ входят (передаются отдельно: `cleaningLevel`, `serviceNotes` — последнее только для экрана заказа на сайте) |
| `request_services` | одна строка: slug, `area_m2`, `price` = база, qty 1 |
| `request_addons` | только выбранные допуслуги; окна НЕ передаются (`windows: null`) — двойного начисления нет |
| `requests.internal_notes` | (новое, существующая колонка) «Pod klucz — poziom zabrudzenia: … (light/standard/heavy)» |
| Telegram/e-mail | строка «Poziom zabrudzenia: …» в тексте заявки |

## Что показывает Owner
- Карточка заказа: название услуги берётся из каталога (`localizedCatalogName(req.services)`), `service_label` — только запасной вариант. Поэтому уровень в названии не виден; он виден в «Заметки» (internal_notes).
- Цена и строка услуги открываются из сохранённых значений (`isStoredRowUntouched`) — старый тариф не подставляется, пока строку не меняют.
- **Риск:** при изменении площади/количества в форме заявки цена строки пересчитывается по `services.area_tiers` каталога. Сейчас там старые ступени (проверено read-only публичным ключом): 35 м² → 690, 80 м² → 1390, 100 м² → 1540, 150 м² → 2290 вместо 1925 / 4400 / 5500 / 8250.

## Нужное изменение (данные, не код) — ждёт согласования
Owner-кабинет → «Услуги» → «Уборка после ремонта» (`sprzatanie-po-remoncie`): оставить режим «по площади», **убрать все ступени**, в поле «цена за м²» поставить **55**. Проверено на `OrdersCore.areaTierPrice`: тогда 35/50/80/100/150 м² = 1925/2750/4400/5500/8250. Изменение кода Owner-кабинета не требуется. Запись `remont-z-meblami` для новых заказов больше не используется (оставить для старых заказов).

Защита записи: если база отклонит вставку именно из-за колонки `internal_notes` (права/схема), `api/submit.js` повторяет вставку без неё — заявка не теряется, уровень остаётся в тексте Telegram/e-mail.

Не делалось: никакие записи в Supabase.

## Скидка 5% / надбавка 25%
Автоматически не применяются. Owner вводит их вручную существующими полями заявки (ручная скидка, «Доплата за сложность» `complexity_multiplier`).

## Файлы сайта, затронутые этим шагом
`assets/js/booking.js` (+`cleaningLevel`, строка в тексте заявки), `api/submit.js` (валидация enum, `internal_notes`), `scripts/remont-pk-template.js`, `scripts/remont-pk-texts.json`, `assets/js/remont-pod-klucz.js` (сборка), `regulamin.html` ×4, `scripts/i18n/legal/regulamin.js`.
