import imageCompression from "browser-image-compression";

// Hard cap enforced everywhere a file is picked, before it ever touches
// the network. Keep this in sync with the backend's multer limits
// (see backend/src/middleware/upload.js and uploadMiddleware.js).
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

export class FileTooLargeError extends Error {
  constructor(sizeBytes) {
    super(
      `File is ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB, which is over the 50MB limit.`
    );
    this.name = "FileTooLargeError";
  }
}

/**
 * Compress a file client-side before upload, except PDFs (which are already
 * a compact, "final" format and shouldn't be re-encoded).
 *
 * - Images: compressed via browser-image-compression (downscaled + re-encoded,
 *   usually a large win for phone-camera photos).
 * - Audio: already compressed by MediaRecorder (webm/opus or mp4/aac) at
 *   record time, nothing further to do client-side.
 * - Video: intentionally NOT re-encoded here. Real video transcoding in the
 *   browser requires a WASM codec pipeline (e.g. ffmpeg.wasm) which in turn
 *   needs cross-origin-isolation headers (COOP/COEP) configured on whatever
 *   host serves the built app. Since that's an infra requirement outside
 *   this app's control, doing it "quietly" here would silently break on
 *   hosts that don't set those headers. We instead just enforce the size
 *   limit and pass the file through as recorded/selected (most phones
 *   already record H.264/HEVC, which is already reasonably compressed).
 *   If you want real client-side video compression, wire up ffmpeg.wasm
 *   here and set the COOP/COEP headers on your host.
 *
 * Always throws FileTooLargeError if the final file exceeds MAX_UPLOAD_BYTES.
 */
export async function compressFileForUpload(file, onProgress) {
  if (!file) return file;

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  let result = file;

  if (isImage && !isPdf) {
    try {
      result = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        onProgress,
        // GIFs would lose animation if re-encoded; leave them alone.
        fileType: file.type === "image/gif" ? file.type : undefined,
      });
      // browser-image-compression drops the original filename sometimes;
      // make sure downstream code (FormData, previews) still sees one.
      if (!result.name) {
        result = new File([result], file.name, { type: result.type });
      }
    } catch (err) {
      console.warn("Client-side image compression failed, using original:", err);
      result = file;
    }
  }

  if (result.size > MAX_UPLOAD_BYTES) {
    throw new FileTooLargeError(result.size);
  }

  return result;
}
