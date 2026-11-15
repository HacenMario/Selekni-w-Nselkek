const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 500 * 1024; // 500KB decoded per image
export const MAX_IMAGES = 10;

export interface DecodedImage {
  mime: string;
  size: number;
  data: Buffer;
}

export function decodeImages(images: { mime: string; dataBase64: string }[] | undefined): { images: DecodedImage[]; error?: string } {
  const out: DecodedImage[] = [];
  if (!images || images.length === 0) return { images: out };
  if (images.length > MAX_IMAGES) return { images: out, error: `Maximum ${MAX_IMAGES} images` };
  for (const img of images) {
    if (!ALLOWED_MIME.includes(img.mime)) return { images: out, error: `Unsupported image type: ${img.mime}` };
    const buf = Buffer.from(img.dataBase64, 'base64');
    if (buf.length > MAX_SIZE) return { images: out, error: 'Image too large after compression (max 500KB)' };
    if (buf.length === 0) return { images: out, error: 'Empty image' };
    out.push({ mime: img.mime, size: buf.length, data: buf });
  }
  return { images: out };
}

/** Decode a base64 avatar (profile picture) — same constraints as offer images. */
export function decodeAvatar(
  input: { mime: string; dataBase64: string } | undefined,
  maxSize: number,
  label = 'Image too large (max 300KB)'
): { data?: DecodedImage; error?: string } {
  if (!input) return {};
  if (!ALLOWED_MIME.includes(input.mime)) return { error: `Unsupported image type: ${input.mime}` };
  const buf = Buffer.from(input.dataBase64, 'base64');
  if (buf.length === 0) return { error: 'Empty image' };
  if (buf.length > maxSize) return { error: label };
  return { data: { mime: input.mime, size: buf.length, data: buf } };
}

/** Decode the ID-card photo (front side) — larger allowance, cleared from DB after review. */
export function decodeIdCard(input: { mime: string; dataBase64: string } | undefined): { data?: DecodedImage; error?: string } {
  return decodeAvatar(input, 1500 * 1024, 'ID card image too large (max 1.5MB)');
}
