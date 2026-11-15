/** Client-side image compression: keeps photos sharp while staying small enough for the free MongoDB tier. */
export interface CompressedImage {
  mime: string;
  dataBase64: string;
  size: number; // decoded bytes
}

const MAX_DIM = 1280;
const TARGET_BYTES = 280 * 1024; // target after compression
const AVATAR_DIM = 512;
const AVATAR_BYTES = 220 * 1024;

export async function compressImage(file: File): Promise<CompressedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.78;
  let out = canvas.toDataURL('image/jpeg', quality);
  // progressively lower quality until under target (never below 0.5)
  while (approxBytes(out) > TARGET_BYTES && quality > 0.5) {
    quality -= 0.08;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  const base64 = out.split(',')[1];
  return {
    mime: 'image/jpeg',
    dataBase64: base64,
    size: Math.round((base64.length * 3) / 4),
  };
}

/** Square-cropped, compressed avatar for profile photos. */
export async function compressAvatar(file: File): Promise<CompressedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  // center square crop
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_DIM;
  canvas.height = AVATAR_DIM;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_DIM, AVATAR_DIM);

  let quality = 0.8;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (approxBytes(out) > AVATAR_BYTES && quality > 0.5) {
    quality -= 0.08;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  const base64 = out.split(',')[1];
  return {
    mime: 'image/jpeg',
    dataBase64: base64,
    size: Math.round((base64.length * 3) / 4),
  };
}

/** ID-card photo (front side): keeps the full aspect ratio, sharper and larger than avatars. */
const ID_DIM = 1600;
const ID_BYTES = 1000 * 1024; // stays safely under the 1.5MB server limit after base64

export async function compressIdCard(file: File): Promise<CompressedImage> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  const scale = Math.min(1, ID_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (approxBytes(out) > ID_BYTES && quality > 0.55) {
    quality -= 0.06;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  const base64 = out.split(',')[1];
  return {
    mime: 'image/jpeg',
    dataBase64: base64,
    size: Math.round((base64.length * 3) / 4),
  };
}

function approxBytes(dataUrl: string): number {
  const b64 = dataUrl.split(',')[1] || '';
  return Math.round((b64.length * 3) / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
