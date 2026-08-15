export default async function handler(req, res) {
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  const PLACE_ID = process.env.GOOGLE_PLACE_ID;

  res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");

  if (!API_KEY || !PLACE_ID) {
    return res.status(200).json({ reviews: [], rating: null, total: null });
  }

  try {
    const url = "https://places.googleapis.com/v1/places/" + encodeURIComponent(PLACE_ID);
    const r = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews"
      }
    });
    const data = await r.json();

    if (!r.ok || data.error) {
      console.error("Places API error", data.error || data);
      return res.status(200).json({ reviews: [], rating: null, total: null });
    }

    const reviews = (data.reviews || []).map(function (rv) {
      return {
        name: (rv.authorAttribution && rv.authorAttribution.displayName) || "",
        stars: rv.rating,
        date: (rv.publishTime || "").slice(0, 10),
        text: (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || ""
      };
    });

    return res.status(200).json({
      reviews: reviews,
      rating: data.rating || null,
      total: data.userRatingCount || null
    });
  } catch (error) {
    console.error("Google reviews fetch failed", error);
    return res.status(200).json({ reviews: [], rating: null, total: null });
  }
}
