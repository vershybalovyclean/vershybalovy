export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, stars, text } = req.body;

  if (!name || !text) {
    return res.status(400).json({ error: "Imię i treść opinii są wymagane" });
  }

  const RESEND_API_KEY = process.env.Resend_api_key;
  const TO_EMAIL = process.env.to_email;

  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.error("Missing env variables");
    return res.status(500).json({ error: "Błąd konfiguracji serwera" });
  }

  const emailContent = "Prywatna opinia klienta (niska ocena, niepubliczna) ze strony Verschybalovy!\n\n" +
    "Imię: " + name + "\n" +
    "Ocena: " + (stars || "brak") + "/5\n" +
    "Treść: " + text;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [TO_EMAIL],
        subject: "Niska ocena (" + (stars || "?") + "★) od " + name,
        text: emailContent
      })
    });

    if (!resendResponse.ok) {
      return res.status(500).json({ error: "Błąd wysyłania email" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Wewnętrzny błąd serwera" });
  }
}
