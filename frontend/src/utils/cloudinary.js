// Derived delivery sizes for a stored Cloudinary URL.
//
// The database holds one URL per image. Cloudinary renders any size from it on
// request, so a feed thumbnail is the same asset with a transformation spliced
// into the path - no extra storage. f_auto serves WebP/AVIF where supported,
// q_auto picks the quality, and any transformed delivery strips the photo's
// metadata (EXIF, GPS) from what the browser receives.

export const THUMB = "c_limit,w_400,f_auto,q_auto";
export const THUMB_2X = "c_limit,w_800,f_auto,q_auto";
export const FULL = "c_limit,w_1600,f_auto,q_auto";

export function cloudinaryVariant(url, transformation) {
  if (!url || !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  return url.replace("/image/upload/", `/image/upload/${transformation}/`);
}
