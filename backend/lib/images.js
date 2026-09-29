// The one image pipeline: sharp normalizes the upload, Cloudinary stores it.
//
// MongoDB never holds image bytes - only the returned URL (plus dimensions).
// Delivery sizes are derived later from that one stored URL with Cloudinary
// URL transformations (see frontend/src/utils/cloudinary.js), so thumbnails
// cost no extra storage.

const sharp = require("sharp");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MAX_DIMENSION = 1920;

// Phone uploads: HEIC/HEIF often arrive with a generic or empty MIME type, so
// accept them by extension too.
const HEIC_EXTENSION = /\.(heic|heif)$/i;

function isAcceptedImage(file) {
  return file.mimetype.startsWith("image/") || HEIC_EXTENSION.test(file.originalname || "");
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    uploadStream.end(buffer);
  });
}

// Resize to fit 1920px, re-encode as JPEG, and upload. Returns Cloudinary's
// upload result (`secure_url`, `width`, `height`, ...).
//
// autoOrient: apply the EXIF orientation before re-encoding. Re-encoding drops
//   EXIF, so without this a portrait phone photo is stored sideways.
// allowHeic: sharp's bundled libvips cannot decode iPhone HEIC (HEVC). When
//   sharp rejects the input, hand the original bytes to Cloudinary, which
//   decodes HEIC, applies EXIF orientation, and stores a size-limited JPEG.
async function uploadImage(buffer, { folder, publicId, autoOrient = false, allowHeic = false }) {
  const options = {
    folder,
    public_id: publicId,
    resource_type: "image",
    transformation: [
      { width: MAX_DIMENSION, height: MAX_DIMENSION, crop: "limit" },
      { quality: "auto:good" }
    ]
  };

  let processed;
  try {
    let pipeline = sharp(buffer);
    if (autoOrient) pipeline = pipeline.rotate();
    processed = await pipeline
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    if (!allowHeic) throw err;
    return uploadBuffer(buffer, { ...options, format: "jpg" });
  }

  return uploadBuffer(processed, options);
}

module.exports = { uploadImage, isAcceptedImage };
