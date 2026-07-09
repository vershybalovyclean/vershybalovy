// VershClean — analytics helpers (GA4 events for phone clicks and booking conversions)
function trackFormConversion(serviceName) {
  if(typeof gtag === 'undefined') return;
  gtag('event', 'generate_lead', {
    'event_category': 'booking_form',
    'event_label': serviceName || 'rezerwacja',
    'value': 1
  });
}

function trackPhoneClick(phone) {
  if(typeof gtag === 'undefined') return;
  gtag('event', 'phone_call', {
    'event_category': 'contact',
    'event_label': phone || 'phone_click',
    'value': 1
  });
}

// Track all phone number clicks
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="tel:"]').forEach(function(el) {
    el.addEventListener('click', function() {
      trackPhoneClick(this.href.replace('tel:', ''));
    });
  });
});
