import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// All uploads live under backend/uploads. Avatars get their own
// sub-folder so they're easy to find/clean up independently of chat media.
export const UPLOAD_ROOT = path.resolve("uploads");
export const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");

for (const dir of [UPLOAD_ROOT, AVATAR_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Compress + save an avatar image buffer to local disk (replaces Cloudinary).
 * Avatars are resized down to a sane max (512px) and re-encoded as WebP,
 * which typically shrinks a multi-MB phone photo down to a few dozen KB.
 * Returns a relative URL like "/uploads/avatars/<uuid>.webp".
 */
export async function saveAvatarBuffer(buffer, originalMimetype = "") {
  const filename = `${uuidv4()}.webp`;
  const destPath = path.join(AVATAR_DIR, filename);

  try {
    await sharp(buffer)
      .rotate() // respect EXIF orientation from phone cameras
      .resize({ width: 512, height: 512, fit: "cover" })
      .webp({ quality: 82 })
      .toFile(destPath);
  } catch (err) {
    // If sharp can't process it (e.g. an unusual format), fall back to
    // storing the original bytes untouched rather than failing the request.
    console.warn("Avatar compression failed, storing original:", err.message);
    const ext = originalMimetype.includes("png") ? ".png" : ".jpg";
    const fallbackPath = path.join(AVATAR_DIR, `${uuidv4()}${ext}`);
    fs.writeFileSync(fallbackPath, buffer);
    return `/uploads/avatars/${path.basename(fallbackPath)}`;
  }

  return `/uploads/avatars/${filename}`;
}

/**
 * Delete a previously stored local upload given its public "/uploads/..."
 * URL (or full URL containing that path). Safe against path traversal:
 * resolves the final path and refuses to delete anything outside
 * UPLOAD_ROOT.
 */
export function deleteLocalUpload(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== "string") return;
  const marker = "/uploads/";
  const idx = urlOrPath.indexOf(marker);
  if (idx === -1) return;

  const relative = urlOrPath.slice(idx + marker.length);
  const resolved = path.resolve(UPLOAD_ROOT, relative);

  if (!resolved.startsWith(UPLOAD_ROOT)) return; // traversal guard
  if (!fs.existsSync(resolved)) return;

  try {
    fs.unlinkSync(resolved);
  } catch (err) {
    console.warn("Failed to delete local upload:", err.message);
  }
}

/**
 * Best-effort server-side compression safety net for chat media uploads.
 * The client already compresses images/video before sending (see
 * frontend/src/utils/compressFile.js), but a client could be old/modified,
 * so we re-compress images here too. Video/audio/PDF/other files are left
 * untouched (re-encoding video server-side without a dedicated media
 * pipeline like ffmpeg would be slow and is skipped intentionally).
 */
export async function maybeCompressImageFile(absoluteFilePath, mimetype) {
  if (!mimetype || !mimetype.startsWith("image/")) return;
  if (mimetype === "image/gif" || mimetype === "image/svg+xml") return; // preserve animation/vector

  try {
    const buffer = fs.readFileSync(absoluteFilePath);
    const compressed = await sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Only replace if we actually saved space.
    if (compressed.length < buffer.length) {
      const newPath = absoluteFilePath.replace(/\.[^/.]+$/, ".webp");
      fs.writeFileSync(newPath, compressed);
      if (newPath !== absoluteFilePath) fs.unlinkSync(absoluteFilePath);
      return path.basename(newPath);
    }
  } catch (err) {
    console.warn("Server-side image compression skipped:", err.message);
  }
  return null;
}
