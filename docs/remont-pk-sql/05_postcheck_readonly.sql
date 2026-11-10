-- 05 POST-CHECK (read-only). Expected: price_per_m2 55, tiers 0, name_pl 'Sprzątanie po remoncie pod klucz', included_n = previous + 1;
-- the Owner "Услуги" list shows "от 55 zł"; a new order for 80 m2 = 4 400,00 zł, 100 m2 = 5 500,00 zł.
select slug, name_pl, name_ru, pricing_mode, price_per_m2, base_price, jsonb_array_length(coalesce(area_tiers,'[]'::jsonb)) as tiers, jsonb_array_length(included) as included_n, is_active, updated_at
from services where slug in ('sprzatanie-po-remoncie','remont-z-meblami') order by slug;
select r.id, r.created_at, r.price, r.area_m2, r.service_label, left(coalesce(r.internal_notes,''),60) as note
from requests r join services s on s.id = r.service_id where s.slug = 'sprzatanie-po-remoncie' order by r.created_at desc limit 20;  -- orders accepted in the switch window
