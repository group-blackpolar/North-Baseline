/** Image formats accepted for document attachments (jpg/jpeg, png, webp), validated again by the server by file signature. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const BY_EXTENSION: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const BY_TYPE: Record<string, string> = { 'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp' };

/** Canonical mime for a picked file, from its type or (some mobile pickers leave it empty) its extension; null if unsupported. */
export function imageMime(file: { name: string; type: string }): string | null {
  const byType = BY_TYPE[file.type.toLowerCase()];
  if (byType) return byType;
  if (file.type) return null;
  return BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}
