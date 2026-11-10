-- 04 DEACTIVATE remont-z-meblami for NEW orders (PRODUCTION; separate Owner command, after the switch is verified).
-- The record and every FK stay intact (0 requests / lines / promos reference it - checked 10.11.2026). The site's resolveServiceId does not
-- filter by is_active, so a cached old page that still posts this slug is still saved correctly.
update services set is_active = false, updated_at = now() where slug = 'remont-z-meblami' and is_active = true;
-- expected result: UPDATE 1
select slug, is_active from services where slug = 'remont-z-meblami';
