import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

/**
 * Single source of truth for Cloudinary configuration.
 *
 * Why Cloudinary and not local disk:
 * Render's web services (and most PaaS free/standard tiers) have an
 * EPHEMERAL filesystem - anything written to disk (backend/uploads) is
 * wiped on every deploy, restart, or scale event. Storing chat media,
 * avatars, and group logos on local disk means they silently disappear
 * (404) days or hours after being uploaded, which is exactly the bug
 * this project shipped with. Cloudinary (or any object storage - S3,
 * Backblaze, etc) keeps files independent of the app server's lifecycle.
 *
 * isConfigured() lets the rest of the app fail loudly and early instead
 * of silently writing to a doomed local path if someone forgets to set
 * the env vars in production.
 */
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export default cloudinary;
