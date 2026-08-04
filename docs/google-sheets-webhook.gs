function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Data', 'Imię', 'Telefon', 'Usługa', 'Kod partnera', 'Komentarz']);
  }

  sheet.appendRow([
    data.date || new Date().toISOString(),
    data.name || '',
    data.phone || '',
    data.service || '',
    data.partnerCode || '',
    data.comment || ''
  ]);

  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
