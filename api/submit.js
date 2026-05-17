export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone, service, comment } = req.body;

  // Валидация
  if (!name || !phone) {
    return res.status(400).json({ error: "Imię i telefon są wymagane" });
  }

  // Получаем переменные окружения
  const RESEND_API_KEY = process.env.Resend_api_key;
  const TO_EMAIL = process.env.to_email;

  // Проверяем, что переменные заданы
  if (!RESEND_API_KEY) {
    console.error("Brak Resend_api_key w zmiennych środowiskowych");
    return res.status(500).json({ error: "Błąd konfiguracji serwera: brak klucza API" });
  }

  if (!TO_EMAIL) {
    console.error("Brak to_email w zmiennych środowiskowych");
    return res.status(500).json({ error: "Błąd konfiguracji serwera: brak adresu email" });
  }

  // Формируем письмо
  const emailContent = 
Nowe zgłoszenie ze strony Verschybalovy!

Imię: ${name}
Telefon: ${phone}
Usługa: ${service || "nie wybrano"}
Komentarz: ${comment || "brak"}
  ;

  try {
    // Отправляем через Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": Bearer ${RESEND_API_KEY},
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [TO_EMAIL],
        subject: Nowe zgłoszenie od ${name},
        text: emailContent
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", errorText);
      return res.status(500).json({ error: "Błąd wysyłania email: " + errorText });
    }

    return res.status(200).json({ success: true, message: "Zgłoszenie wysłane!" });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ error: "Wewnętrzny błąd serwera: " + error.message });
  }
}
