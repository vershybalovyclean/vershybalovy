-- 02 SWITCH (PRODUCTION; run only on the Owner's explicit command, right after the site deploy).
-- Renames the existing record in place, removes the old area tiers, sets one rate of 55 zł/m2. Same values the Owner "Услуги" form would save.
-- Optimistic guard: touches the row only if it is still exactly the backed-up version (0 rows updated = someone changed it - stop and look).
update services set
  name = 'Sprzątanie po remoncie pod klucz',
  name_pl = 'Sprzątanie po remoncie pod klucz',
  name_uk = 'Прибирання після ремонту під ключ',
  name_ru = 'Уборка после ремонта под ключ',
  name_en = 'Turnkey post-renovation cleaning',
  pricing_mode = 'per_area',
  area_tiers = NULL,
  price_per_m2 = 55,
  base_price = 55,
  description = 'Единая ставка 55 zł/м². Мытьё окон в стандартных условиях доступа включено. При лёгком загрязнении — скидка до 5% после оценки; при сильном — надбавка до 25% по согласованию с клиентом. Сумма предварительная, подтверждается до начала работ.',
  included = included || '["Мытьё окон в стандартных условиях доступа"]'::jsonb,
  updated_at = now()
where slug = 'sprzatanie-po-remoncie' and updated_at = '2026-08-11T12:04:43.141814+00:00'::timestamptz and price_per_m2 = 15;
-- expected result: UPDATE 1
select slug, name, name_ru, price_per_m2, base_price, area_tiers, jsonb_array_length(included) as included_n, is_active from services where slug = 'sprzatanie-po-remoncie';
