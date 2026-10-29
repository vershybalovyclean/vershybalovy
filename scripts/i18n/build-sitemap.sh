#!/bin/sh
# Строит scripts/i18n/sitemap.multilang.xml (в деплой НЕ попадает; публикуется отдельным шагом после проверки, что все адреса отвечают 200): 8 индексируемых страниц × 4 языка, у каждого url — xhtml:link alternates (pl/uk/ru/en + x-default -> PL).
# lastmod/changefreq/priority берутся из строк ниже (значения польских страниц из действующего sitemap). Юридические страницы (noindex) в sitemap не входят.
cd "$(dirname "$0")/../.." || exit 1
B=https://www.vershclean.pl
LIST='index|2026-10-29|weekly|1.0
sprzatanie-mieszkan-i-domow-krakow|2026-10-29|weekly|0.9
sprzatanie-po-remoncie-krakow|2026-10-29|weekly|0.9
sprzatanie-po-wyprowadzce-krakow|2026-10-29|weekly|0.9
trudne-przypadki-sprzatanie-krakow|2026-10-22|weekly|0.8
mycie-okien|2026-10-22|weekly|0.8
poznaj-nas|2026-10-29|monthly|0.6
program-partnerski|2026-10-29|monthly|0.6'
url() { # slug lang
  if [ "$1" = index ]; then [ "$2" = pl ] && echo "$B/" || echo "$B/$2"; else [ "$2" = pl ] && echo "$B/$1" || echo "$B/$2/$1"; fi
}
{
echo '<?xml version="1.0" encoding="UTF-8"?>'
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
echo "$LIST" | while IFS='|' read -r s lm cf pr; do
  for l in pl uk ru en; do
    echo '  <url>'
    echo "    <loc>$(url "$s" $l)</loc>"
    for a in pl uk ru en; do echo "    <xhtml:link rel=\"alternate\" hreflang=\"$a\" href=\"$(url "$s" $a)\"/>"; done
    echo "    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"$(url "$s" pl)\"/>"
    echo "    <lastmod>$lm</lastmod>"
    echo "    <changefreq>$cf</changefreq>"
    echo "    <priority>$pr</priority>"
    echo '  </url>'
  done
done
echo '</urlset>'
} > scripts/i18n/sitemap.multilang.xml
