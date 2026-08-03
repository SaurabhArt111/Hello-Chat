import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// All uploads live under backend/uploads by default. This project stores
// files locally and serves them from /uploads via express.static().
//
// On a host with an ephemeral filesystem (e.g. Render's free/standard
// tiers), this directory gets wiped on every deploy/restart. Set UPLOAD_DIR
// to an absolute path pointing at a mounted persistent disk (e.g. Render's
// disk feature, mounted at something like /var/data) to survive restarts -
// see backend/.env.example.
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || "uploads");
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

function saveLocalBuffer(buffer, folder, filename) {
  const dir = path.join(UPLOAD_ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, filename);
  fs.writeFileSync(dest, buffer);
  return {
    url: `/uploads/${folder}/${filename}`, // resolved to an absolute URL by buildFileUrl() at the call site
    publicId: `local:${folder}/${filename}`,
    provider: "local",
  };
}

/**
 * Store an avatar image: re-encoded to WebP + capped at 512px (keeps phone
 * photos from turning into multi-MB avatars) then saved locally.
 */
export async function saveAvatarBuffer(buffer, originalMimetype = "") {
  let processed = buffer;
  try {
    processed = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    console.warn("Avatar compression failed, storing original:", err.message);
  }

  const filename = uuidv4();
  return saveLocalBuffer(processed, "avatars", `${filename}.webp`);
}

/**
 * Store a group logo (same treatment as an avatar).
 */
export async function saveGroupLogoBuffer(buffer) {
  let processed = buffer;
  try {
    processed = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("Group logo compression failed, storing original:", err.message);
  }

  const filename = `group-${uuidv4()}`;
  return saveLocalBuffer(processed, "groups", `${filename}.webp`);
}

/**
 * Store a chat-media attachment (image/video/audio/document). Images are
 * re-compressed server-side as a safety net (the client already compresses
 * before upload - see frontend/src/utils/compressFile.js - but a client
 * could be old/modified). Non-image files are stored as-is: video
 * re-encoding needs a real media pipeline (ffmpeg) and is out of scope for
 * a lightweight Node backend; Cloudinary's `auto` resource type
 * transparently handles video/raw/image without us branching on mimetype.
 */
export async function saveMessageMediaBuffer(buffer, { mimetype = "", originalname = "" } = {}) {
  const isImage = mimetype.startsWith("image/") && mimetype !== "image/gif" && mimetype !== "image/svg+xml";
  let processed = buffer;

  if (isImage) {
    try {
      const compressed = await sharp(buffer)
        .rotate()
        .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      if (compressed.length < buffer.length) processed = compressed;
    } catch (err) {
      console.warn("Server-side image compression skipped:", err.message);
    }
  }

  const ext = originalname.includes(".") ? originalname.split(".").pop().toLowerCase() : "";
  const filename = uuidv4();
  const resourceType = mimetype.startsWith("video/")
    ? "video"
    : mimetype.startsWith("audio/")
    ? "video" // Cloudinary stores audio under the "video" resource type
    : isImage
    ? "image"
    : "raw";

  const localExt = isImage ? "webp" : ext || "bin";
  return saveLocalBuffer(processed, "media", `${filename}.${localExt}`);
}

/**
 * Delete a previously stored file, given the publicId we saved alongside it
 * (Message.attachments[].publicId / User.avatarPublicId / etc). Handles
 * local storage only and never throws.
 */
export async function deleteStoredFile(publicId) {
  if (!publicId || typeof publicId !== "string") return;

  if (publicId.startsWith("local:")) {
    const relative = publicId.slice("local:".length);
    const resolved = path.resolve(UPLOAD_ROOT, relative);
    if (!resolved.startsWith(UPLOAD_ROOT)) return; // path traversal guard
    try {
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch (err) {
      console.warn("Failed to delete local upload:", err.message);
    }
    return;
  }

  return;
}
