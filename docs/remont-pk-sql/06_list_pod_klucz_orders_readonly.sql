-- 06 READ-ONLY: every order accepted under the POD KLUCZ tariff (55 zł/m2). Run before/after a rollback and in the post-switch window.
-- After a catalog rollback these orders keep their stored price (requests.price / request_services.price) and must be honoured by the team as quoted;
-- the only risk is that Owner changing the AREA of such an order recalculates that row by the old tiers - do not edit area on them (re-apply 02 first if an edit is needed).
select r.id, r.created_at, r.status, r.client_name, r.area_m2, r.price, r.service_label, left(coalesce(r.internal_notes,''), 80) as soiling_note
from requests r
where r.internal_notes like 'Pod klucz —%' or r.service_label ilike '%pod klucz%'
   or (r.service_id = (select id from services where slug = 'sprzatanie-po-remoncie') and r.created_at >= '2026-11-10')
order by r.created_at desc;
