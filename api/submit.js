export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, service, comment } = req.body;

  if (!name  !phone  !service) {
    return res.status(400).json({ error: 'Proszę wypełnić wszystkie wymagane pola' });
  }

  const emailContent = 
Nowe zgłoszenie ze strony Verschybalovy!

Imię: ${name}
Telefon: ${phone}
Usługa: ${service}
Komentarz: ${comment || 'brak'};

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': Bearer ${process.env.Resend_api_key},
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vershybalovy <kontakt@vershybalovy.pl>',
        to: [process.env.to_email],
        subject: Nowe zgłoszenie od ${name},
        text: emailContent,
      }),
    });

    if (!resendResponse.ok) {
      return res.status(500).json({ error: 'Błąd wysyłania email' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
  }
}
