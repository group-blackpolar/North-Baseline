const ICON_SIDE = 512;
export const ICON_MAX_BYTES = 256 * 1024;

/** Scales any image to fit 512x512 and encodes it as WebP (PNG fallback) so it satisfies the server limits (legacy icon and managed asset alike). */
export async function toIconBlob(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const scale = Math.min(1, ICON_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality?: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.9, 0.75, 0.6]) {
    const blob = await encode('image/webp', quality);
    if (blob?.type === 'image/webp' && blob.size <= ICON_MAX_BYTES) return blob;
  }
  const png = await encode('image/png');
  if (!png || png.size > ICON_MAX_BYTES) throw new Error('too-big');
  return png;
}

export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});
