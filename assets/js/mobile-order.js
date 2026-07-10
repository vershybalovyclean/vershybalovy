// VershClean — mobile order-summary expand/collapse (bottom sheet)
function toggleMobOrder(force){
  var open = typeof force === 'boolean' ? force : !document.body.classList.contains('mob-order-open');
  document.body.classList.toggle('mob-order-open', open);
}
