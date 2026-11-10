#!/usr/bin/perl
# Builds the "pod klucz" post-renovation page set:
#   assets/js/remont-pod-klucz.js  = scripts/remont-pk-template.js + scripts/remont-pk-texts.json
#   and patches the static HTML of the 4 language pages (head/SEO, hero, calculator shell, scope section, FAQ, JSON-LD).
# Idempotent: every substitution targets either the original markup or the already-patched marker.
use strict; use warnings; use utf8;
use JSON::PP;
binmode STDOUT, ':utf8';

sub slurp { my $f = shift; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $s = <$h>; close $h; utf8::decode($s); return $s; }
sub spit  { my ($f, $s) = @_; utf8::encode($s); open my $h, '>:raw', $f or die "$f: $!"; print $h $s; close $h; }
sub esc   { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/>/&gt;/g; $s =~ s/"/&quot;/g; return $s; }
sub jesc  { my $s = shift; $s =~ s/\\/\\\\/g; $s =~ s/"/\\"/g; return $s; }   # for JSON-LD string values

my $json = JSON::PP->new->utf8(0)->canonical(1);
my $T = $json->decode(slurp('scripts/remont-pk-texts.json'));

# ---- scope-section markup (same string goes into the pages and into the JS) ----
my %scope;
for my $l (qw(pl uk ru en)) {
  my $t = $T->{$l};
  my $h = "\n  <div class=\"wrap\">\n";
  $h .= "    <div class=\"sec-lbl\" id=\"pk-lbl\">" . esc($t->{scopeLbl}) . "</div>\n";
  $h .= "    <h2 class=\"sec-title\" id=\"pk-h2\">$t->{scopeH2}</h2>\n";
  $h .= "    <p class=\"sec-sub\" id=\"pk-sub\">" . esc($t->{scopeSub}) . "</p>\n";
  $h .= "    <div class=\"pk-points\">\n";
  for my $p (@{$t->{points}}) {
    $h .= "      <div class=\"pk-point\"><span class=\"pk-ico\" aria-hidden=\"true\">$p->[0]</span><strong>" . esc($p->[1]) . "</strong><span>" . esc($p->[2]) . "</span></div>\n";
  }
  $h .= "    </div>\n";
  $h .= "    <h3 class=\"pk-h3\">" . esc($t->{incTitle}) . "</h3>\n";
  $h .= "    <ul class=\"svc-includes pk-list\">\n";
  $h .= "      <li>" . esc($_) . "</li>\n" for @{$t->{items}};
  $h .= "    </ul>\n";
  $h .= "    <h3 class=\"pk-h3\">" . esc($t->{exclTitle}) . "</h3>\n";
  $h .= "    <ul class=\"svc-includes pk-excl\">\n";
  $h .= "      <li>" . esc($_) . "</li>\n" for @{$t->{excl}};
  $h .= "    </ul>\n";
  $h .= "    <div class=\"svc-note\" id=\"pk-disclaimer\">" . esc($t->{disclaimer}) . "</div>\n";
  $h .= "  </div>\n";
  $scope{$l} = $h;
}

# ---- JS ----
my $tpl = slurp('scripts/remont-pk-template.js');
my $texts = $json->encode($T);
my $html  = $json->encode({ map { $_ => { scope => $scope{$_} } } keys %scope });
$tpl =~ s{/\*__TEXTS__\*/null}{$texts};
$tpl =~ s{/\*__HTML__\*/null}{$html};
spit('assets/js/remont-pod-klucz.js', $tpl);
print "JS written\n";

# ---- pages ----
my %file = (pl => 'sprzatanie-po-remoncie-krakow.html', uk => 'uk/sprzatanie-po-remoncie-krakow.html',
            ru => 'ru/sprzatanie-po-remoncie-krakow.html', en => 'en/sprzatanie-po-remoncie-krakow.html');
for my $l (qw(pl uk ru en)) {
  my $t = $T->{$l}; my $f = $file{$l};
  my $s = slurp($f); my $o = $s; my @log;
  my $n;
  sub cnt { my ($n, $name, $log) = @_; push @$log, "$name=" . ($n || 0); }

  $n = ($s =~ s{<title>[^<]*</title>}{"<title>" . esc($t->{title}) . "</title>"}e);                         cnt($n, 'title', \@log);
  $n = ($s =~ s{(<meta name="description" content=")[^"]*(")}{$1 . esc($t->{desc}) . $2}e);                 cnt($n, 'desc', \@log);
  $n = ($s =~ s{(<meta property="og:title" content=")[^"]*(")}{$1 . esc($t->{title}) . $2}e);               cnt($n, 'ogt', \@log);
  $n = ($s =~ s{(<meta property="og:description" content=")[^"]*(")}{$1 . esc($t->{ogDesc}) . $2}e);        cnt($n, 'ogd', \@log);

  # JSON-LD Service: description + base rate
  $n = ($s =~ s{(  "serviceType": [^\n]*\n  "name": [^\n]*\n  "description": ")[^"]*(")}{$1 . jesc($t->{jsonDesc}) . $2}e); cnt($n, 'ld-desc', \@log);
  if ($s !~ /"unitCode": "MTK"/) {
    $n = ($s =~ s{(  "areaServed": \{ "\@type": "City"[^\n]*\n)}{$1  "offers": { "\@type": "Offer", "priceCurrency": "PLN", "priceSpecification": { "\@type": "UnitPriceSpecification", "price": 55, "priceCurrency": "PLN", "unitCode": "MTK", "unitText": "m²" } },\n}); cnt($n, 'ld-offer', \@log);
  }
  # JSON-LD FAQ: first question rewritten, price question appended
  my $q0 = '    {"@type": "Question", "name": "' . jesc($t->{faq0q}) . '", "acceptedAnswer": {"@type": "Answer", "text": "' . jesc($t->{faq0a}) . '"}},';
  $n = ($s =~ s{    \{"\@type": "Question", "name": "[^\n]*?", "acceptedAnswer": \{"\@type": "Answer", "text": "[^\n]*?"\}\},(?=\r?\n    \{"\@type": "Question")}{$q0}); cnt($n, 'ld-faq0', \@log);
  my $faq6name = '"name": "' . jesc($t->{faq6q}) . '"';
  if (index($s, $faq6name) < 0) {
    my $q6 = ',' . "\n" . '    {"@type": "Question", "name": "' . jesc($t->{faq6q}) . '", "acceptedAnswer": {"@type": "Answer", "text": "' . jesc($t->{faq6a}) . '"}}';
    $n = ($s =~ s{(\}\})(\r?\n  \]\r?\n\}\r?\n</script>)}{$1$q6$2}); cnt($n, 'ld-faq6', \@log);
  }

  # same JSON-LD blocks, pretty-printed form used by the uk/ru/en pages
  if ($s !~ /"unitCode": "MTK"/) {
    $n = ($s =~ s{(  "areaServed": \{\r?\n    "\@type": "City",\r?\n    "name": "[^"]*"\r?\n  \},\r?\n)}{$1  "offers": {\n    "\@type": "Offer",\n    "priceCurrency": "PLN",\n    "priceSpecification": {\n      "\@type": "UnitPriceSpecification",\n      "price": 55,\n      "priceCurrency": "PLN",\n      "unitCode": "MTK",\n      "unitText": "m²"\n    }\n  },\n}); cnt($n, 'ld-offer-pp', \@log);
  }
  $n = ($s =~ s{("\@type": "Question",\s*"name": ")[^"]*(",\s*"acceptedAnswer": \{\s*"\@type": "Answer",\s*"text": ")[^"]*(")}{$1 . jesc($t->{faq0q}) . $2 . jesc($t->{faq0a}) . $3}e); cnt($n, 'ld-faq0-pp', \@log);
  if (index($s, $faq6name) < 0) {
    my $q6 = "    },\n    {\n      \"\@type\": \"Question\",\n      \"name\": \"" . jesc($t->{faq6q}) . "\",\n      \"acceptedAnswer\": {\n        \"\@type\": \"Answer\",\n        \"text\": \"" . jesc($t->{faq6a}) . "\"\n      }\n    }\n";
    $n = ($s =~ s{    \}\r?\n(  \],\r?\n  "inLanguage")}{$q6$1}); cnt($n, 'ld-faq6-pp', \@log);
  }

  # hero
  $n = ($s =~ s{(<div class="hero-badge" id="hero-badge"[^>]*>)[^<]*(</div>)}{$1 . $t->{badge} . $2}e);       cnt($n, 'badge', \@log);
  $n = ($s =~ s{(<h1 id="hero-h1"[^>]*>).*?(</h1>)}{$1 . $t->{h1} . $2}se);                                  cnt($n, 'h1', \@log);
  $n = ($s =~ s{(<p class="hero-sub" id="hero-sub"[^>]*>).*?(</p>)}{$1 . esc($t->{sub}) . $2}se);            cnt($n, 'sub', \@log);

  # calculator shell: furniture tabs hidden (one price model), texts
  $n = ($s =~ s{<div class="tabs-2">}{<div class="tabs-2" style="display:none" aria-hidden="true">});         cnt($n, 'tabs', \@log);
  $n = ($s =~ s{(<p id="tier-meta"[^>]*>).*?(</p>)}{$1 . $t->{meta} . $2}se);                                cnt($n, 'meta', \@log);
  $n = ($s =~ s{(<div class="price-card-title" id="calc-title">).*?(</div>)}{$1 . $t->{calcTitle} . $2}se); cnt($n, 'ctitle', \@log);
  $n = ($s =~ s{(<p id="calc-sub"[^>]*>).*?(</p>)}{$1 . esc($t->{calcSub}) . $2}se);                          cnt($n, 'csub', \@log);
  $n = ($s =~ s{(<p class="price-extras" id="calc-extras"[^>]*>).*?(</p>)}{$1 . esc($t->{calcExtras}) . $2}se); cnt($n, 'cextras', \@log);

  # window quick-card + window add-on column: windows are part of the package now (no second charge)
  $n = ($s =~ s{[ \t]*<button type="button" class="qa-card" onclick="remontQuickScrollTo\('\[data-name-id=\\'wl1\\'\]'\)">.*?</button>\r?\n}{}s); cnt($n, 'qa-win', \@log);
  $n = ($s =~ s{      <!-- OKNA -->.*?(?=      <!-- INNE -->)}{}s);                                           cnt($n, 'win-col', \@log);

  # scope section → "co obejmuje pod klucz"
  $n = ($s =~ s{(<section class="sec-alt" id="scope-section">).*?(</section>)}{$1 . $scope{$l} . $2}se);    cnt($n, 'scope', \@log);

  # FAQ: first answer + new price item
  $n = ($s =~ s{(<div class="faq-q" id="faq-q0" onclick="toggleFaq\(this\)">).*?( <span class="faq-arrow">)}{$1 . esc($t->{faq0q}) . $2}se); cnt($n, 'faq0q', \@log);
  $n = ($s =~ s{(<div class="faq-a" id="faq-a0">).*?(</div>)}{$1 . esc($t->{faq0a}) . $2}se);              cnt($n, 'faq0a', \@log);
  if ($s !~ /id="faq-q6"/) {
    my $item = "      <div class=\"faq-item\">\n        <div class=\"faq-q\" id=\"faq-q6\" onclick=\"toggleFaq(this)\">" . esc($t->{faq6q}) . " <span class=\"faq-arrow\">▼</span></div>\n        <div class=\"faq-a\" id=\"faq-a6\">" . esc($t->{faq6a}) . "</div>\n      </div>\n";
    $n = ($s =~ s{(<div class="faq-a" id="faq-a5">.*?</div>\r?\n      </div>\r?\n)}{$1$item}s);                   cnt($n, 'faq6', \@log);
  }

  # assets: new CSS version + script (after window-picker.js, same path prefix)
  $n = ($s =~ s{(remont\.css\?v=)\d+}{${1}3}); cnt($n, 'css', \@log);
  if ($s !~ /remont-pod-klucz\.js/) {
    $n = ($s =~ s{(<script src="([^"]*?)window-picker\.js\?v=\d+"></script>)}{$1\n<script src="$2remont-pod-klucz.js?v=1"></script>}); cnt($n, 'script', \@log);
  }

  # keep CRLF files CRLF
  if ($o =~ /\r\n/) { $s =~ s/\r?\n/\r\n/g; }
  spit($f, $s) if $s ne $o;
  print "$f: @log\n";
}
