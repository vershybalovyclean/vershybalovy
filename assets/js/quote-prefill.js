// VershClean — prefill a page's area calculator from ?m2= after arriving from the homepage quick-quote widget
function vpcGetParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Finds the first row whose label bound (parsed from "do 35 m²" / "90+ m²" text) covers m2,
// selects it via its existing header onclick, and fills+triggers its existing input if present.
function vpcSelectByArea(rowSel, lblSel, hdrSel, inputSel, m2) {
  if (!m2 || m2 <= 0) return;
  var rows = document.querySelectorAll(rowSel);
  var chosen = null, openRow = null;
  for (var i = 0; i < rows.length; i++) {
    var lbl = rows[i].querySelector(lblSel);
    if (!lbl) continue;
    var isOpen = lbl.textContent.indexOf('+') !== -1;
    if (isOpen) { if (!openRow) openRow = rows[i]; continue; } // remember the first open-ended row as fallback
    var match = lbl.textContent.match(/(\d+)/);
    var bound = match ? parseInt(match[1], 10) : null;
    if (bound !== null && m2 <= bound) { chosen = rows[i]; break; }
  }
  if (!chosen) chosen = openRow; // m2 exceeds every fixed tier — use the "90+" row

  if (!chosen) return;
  var hdr = chosen.querySelector(hdrSel);
  if (hdr) hdr.click();
  // Run after the page's own row-selection setTimeout (e.g. acSelect's focus timer)
  // so our value isn't touched by any deferred init still in flight.
  setTimeout(function () {
    var inp = chosen.querySelector(inputSel);
    if (inp) {
      inp.value = m2;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    chosen.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}
