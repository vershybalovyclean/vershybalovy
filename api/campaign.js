// GET /api/campaign — Halloween campaign status by the SERVER clock. The site (assets/js/nav.js) asks it so the
// seasonal look follows the same instant api/submit.js uses for gifts, whatever the visitor's own clock says.
import { HALLOWEEN_CUTOFF_MS, isHalloweenCampaignOpen } from "./_halloween.js";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const now = Date.now();
  // Never cached anywhere: the answer flips at one exact moment.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    active: isHalloweenCampaignOpen(now),
    now,
    cutoff: HALLOWEEN_CUTOFF_MS
  });
}
