// Password-gates preview deployments (staging branch, PR previews) so the full
// site/functions can be tested live without being reachable or indexable by anyone
// who doesn't have the credentials. Skips the check entirely in Production, so this
// file staying in the repo after a merge to main can never lock out real visitors.
export const config = {
  matcher: "/((?!_vercel).*)"
};

export default function middleware(req) {
  if (process.env.VERCEL_ENV === "production") {
    return;
  }

  const user = process.env.STAGING_USER;
  const pass = process.env.STAGING_PASS;

  // No credentials configured on Vercel → fail closed (deny everyone),
  // never fall back to a password baked into the repo.
  if (user && pass) {
    const auth = req.headers.get("authorization");
    if (auth) {
      const [scheme, encoded] = auth.split(" ");
      if (scheme === "Basic" && encoded) {
        const decoded = atob(encoded);
        const sepIndex = decoded.indexOf(":");
        const u = decoded.slice(0, sepIndex);
        const p = decoded.slice(sepIndex + 1);
        if (u === user && p === pass) {
          return;
        }
      }
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Staging"' }
  });
}
