import multer from "multer";

/**
 * One shared multer config for every upload route (avatars, group logos,
 * chat media). Previously this project had THREE near-identical multer
 * configs (upload.js, uploadMiddleware.js, groupLogoUploadMiddleware.js),
 * two of which wrote straight to local disk - the root cause of files
 * disappearing on Render (see utils/mediaStorage.js for the full story).
 *
 * We always use memoryStorage now: the file buffer is handed to
 * utils/mediaStorage.js, which uploads it to Cloudinary (or, only in local
 * dev without Cloudinary configured, writes it to disk itself). Routes
 * never touch the filesystem directly anymore.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB - client already compresses before this
});

const IMAGE_TYPES = /jpeg|jpg|png|gif|webp/;

/** Same as `upload`, but rejects non-image files (used for avatars/group logos). */
export const imageOnlyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extOk = IMAGE_TYPES.test(file.originalname.toLowerCase());
    const mimeOk = IMAGE_TYPES.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

export default upload;
