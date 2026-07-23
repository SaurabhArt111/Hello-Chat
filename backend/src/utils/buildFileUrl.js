/**
 * Builds an absolute URL for a file served from this backend (uploads,
 * group logos, avatars, etc).
 *
 * Why this exists: with `app.set("trust proxy", 1)` in server.js,
 * `req.protocol` correctly reports "https" behind Render's proxy - but we
 * force https explicitly here too (outside local dev) so a proxy/header
 * misconfiguration can never again silently save "http://" URLs to the
 * database. Once an http:// URL is saved, every browser on an https:// page
 * (e.g. the Vercel frontend) blocks it as mixed content, which is exactly
 * what broke voice notes, video, and images previously.
 */
export function buildFileUrl(req, relativePath) {
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const isLocalDev = process.env.NODE_ENV !== "production";
  const protocol = isLocalDev ? req.protocol : "https";
  const host = req.get("host");
  return `${protocol}://${host}${path}`;
}
