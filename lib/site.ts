/**
 * Resolve the app's public origin for OG meta + share links.
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL (explicit override)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (set by Vercel for the prod deployment)
 *   3. VERCEL_URL (set per deployment, including previews)
 *   4. localhost fallback for dev
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return ensureProtocol(explicit);

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3004";
}

function ensureProtocol(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}
