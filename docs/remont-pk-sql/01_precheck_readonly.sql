-- 01 PRE-CHECK (read-only). Run on PRODUCTION right before the switch. Expected:
--  * the two rows still carry the backed-up updated_at (nobody edited the catalog since the backup);
--  * no requests / request_services / promotions / promo codes reference the two services (checked 10.11.2026: all 0).
select slug, name, price_per_m2, base_price, jsonb_array_length(coalesce(area_tiers,'[]'::jsonb)) as tiers, is_active, updated_at,
       (updated_at = '2026-08-11T12:04:43.141814+00:00'::timestamptz) as unchanged_since_backup
from services where slug in ('sprzatanie-po-remoncie','remont-z-meblami') order by slug;
select 'requests' k, count(*) n from requests r join services s on s.id=r.service_id where s.slug in ('sprzatanie-po-remoncie','remont-z-meblami')
union all select 'request_services', count(*) from request_services x join services s on s.id=x.service_id where s.slug in ('sprzatanie-po-remoncie','remont-z-meblami')
union all select 'promotions', count(*) from promotions p join services s on s.id=p.service_id where s.slug in ('sprzatanie-po-remoncie','remont-z-meblami')
union all select 'promo_codes', count(*) from marketing_promo_codes p join services s on s.id=p.service_id where s.slug in ('sprzatanie-po-remoncie','remont-z-meblami');
