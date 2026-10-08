// Pure logic of NorthMediaPicker. No React, no `@/` imports: unit-tested with `node --test` (see logic.test.ts).

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // matches the CORECROW image class default
export const MAX_WORK_SIDE = 4096; // working-canvas cap so phone photos do not exhaust memory
export const MAX_OUTPUT_SIDE = 2048;

export type MediaErrorCode = 'format' | 'size' | 'empty' | 'heic';

export interface FileLike { type: string; size: number }

/** Client-side pre-check only; CORECROW re-validates the real type, size and checksum. */
export function validateImage(file: FileLike, accept: readonly string[] = IMAGE_MIME, maxBytes = DEFAULT_MAX_BYTES): MediaErrorCode | null {
  if (file.size === 0) return 'empty';
  if (!accept.includes(file.type)) return 'format';
  if (file.size > maxBytes) return 'size';
  return null;
}

/** Real image type from magic bytes, so a renamed file cannot pass on its extension/MIME alone. */
export function sniffImageMime(b: Uint8Array): (typeof IMAGE_MIME)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** HEIC/HEIF (iOS Photos originals): an ISO-BMFF `ftyp` box with a HEIF brand. Browsers other than Safari cannot decode it. */
export function isHeif(b: Uint8Array): boolean {
  if (b.length < 12 || String.fromCharCode(...b.slice(4, 8)) !== 'ftyp') return false;
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(String.fromCharCode(...b.slice(8, 12)));
}

export interface Rejection<T> { file: T; code: MediaErrorCode | 'count' }

/** Merges `incoming` into the current selection honouring validation, `multiple` and `maxFiles`. */
export function mergeSelection<T extends FileLike>(
  current: T[], incoming: T[], opts: { multiple: boolean; maxFiles: number; accept?: readonly string[]; maxBytes?: number },
): { next: T[]; rejected: Rejection<T>[] } {
  const limit = opts.multiple ? Math.max(1, opts.maxFiles) : 1;
  const base = opts.multiple ? current : [];
  const next = [...base];
  const rejected: Rejection<T>[] = [];
  for (const file of incoming) {
    const code = validateImage(file, opts.accept, opts.maxBytes);
    if (code) rejected.push({ file, code });
    else if (next.length >= limit) rejected.push({ file, code: 'count' });
    else next.push(file);
  }
  return { next, rejected };
}

/** Crop window in source pixels: the largest `aspect` rectangle that fits, shrunk by `zoom` (>=1), centred on (cx, cy) and clamped inside the source. */
export function cropWindow(srcW: number, srcH: number, aspect: number, zoom: number, cx: number, cy: number) {
  const fitW = srcW / srcH > aspect ? srcH * aspect : srcW;
  const sw = fitW / Math.max(1, zoom);
  const sh = sw / aspect;
  const sx = Math.min(Math.max(cx - sw / 2, 0), srcW - sw);
  const sy = Math.min(Math.max(cy - sh / 2, 0), srcH - sh);
  return { sx, sy, sw, sh };
}

/** Scales (w, h) down so the longest side is <= max; never upscales. */
export function fitSide(w: number, h: number, max: number) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

export type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'notfound' | 'busy' | 'unsupported' | 'error' | 'interrupted';

/** Maps a getUserMedia failure to a UI state. */
export function classifyCameraError(error: unknown): CameraState {
  switch ((error as { name?: string } | null)?.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError': return 'notfound';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'busy';
    default: return 'error';
  }
}

/** Releases every track. Safe to call twice or with null. */
export function stopStream(stream: { getTracks(): { stop(): void }[] } | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Lowercase hex SHA-256, the checksum CORECROW binds to a signed upload. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
