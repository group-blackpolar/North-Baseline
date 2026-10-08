import { useEffect, useSyncExternalStore } from 'react';
import { apiRequest } from '@/lib/api';
import { sha256Hex } from '@/components/media-picker/logic.ts';
import { SignedUrlCache, type Signed } from '@/lib/signedUrlCache';

export interface NorthAsset {
  id: string; organizationId: string; ownerId: string; filename: string; mime: string; size: number; checksum: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'REJECTED' | 'QUARANTINED';
}
interface SignedRequest extends Signed { method: 'PUT' | 'GET'; headers: Record<string, string> }

/** True when CORECROW cannot store images yet (object storage or malware scanner not configured): callers may fall back to a legacy path. */
export const isStorageUnavailable = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  return typeof status === 'number' && status >= 500;
};

async function putToStorage(upload: SignedRequest, file: Blob) {
  // No credentials: the signed URL is the authorization, and it points at object storage, not at CORECROW.
  const sent = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  if (!sent.ok) throw new Error(`Storage rejected the upload (${sent.status})`);
}

// ─── Organization assets (ADR-015) ──────────────────────────────────────────────────────────────────────────
const orgBase = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}/assets`;

/**
 * Upload controller for CORECROW NORTH assets: reserve quota + signed PUT, send the bytes straight to object storage,
 * then confirm (the server inspects type/size/checksum/magic bytes and scans). The tenant is the one in the path;
 * CORECROW re-derives it from the caller's membership and checks `north.asset.create`.
 * A failure after the reservation deletes the asset so quota and objects are not left orphaned.
 */
export async function uploadAsset(organizationId: string, file: File): Promise<NorthAsset> {
  const { asset, upload } = await apiRequest<{ asset: NorthAsset; upload: SignedRequest }>(`${orgBase(organizationId)}/uploads`, {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size, checksum: await sha256Hex(file) }),
  });
  try {
    await putToStorage(upload, file);
    return await apiRequest<NorthAsset>(`${orgBase(organizationId)}/${asset.id}/confirm`, { method: 'POST' });
  } catch (error) {
    await deleteAsset(organizationId, asset.id).catch(() => undefined);
    throw error;
  }
}

export const deleteAsset = (organizationId: string, assetId: string) =>
  apiRequest<null>(`${orgBase(organizationId)}/${encodeURIComponent(assetId)}`, { method: 'DELETE' });

/** Short-lived signed URL for a READY asset (re-authorized with `north.asset.read` on every call). */
export async function readAssetUrl(organizationId: string, assetId: string): Promise<string> {
  return (await apiRequest<{ download: SignedRequest }>(`${orgBase(organizationId)}/${encodeURIComponent(assetId)}/read`)).download.url;
}

// ─── Signed URL caches ─────────────────────────────────────────────────────────────────────────────────────
function useSignedUrl(cache: SignedUrlCache, key: string | null): string | null {
  const url = useSyncExternalStore(cache.subscribe, () => (key ? cache.peek(key) : null), () => null);
  useEffect(() => { if (key) void cache.ensure(key); }, [cache, key, url]);
  return url;
}

/** Key = user id (so a different account never sees another's cached URL). */
const ownAvatarCache = new SignedUrlCache(async () => (await apiRequest<{ download: Signed | null }>('/v1/me/avatar')).download);
/** Key = `${organizationId}:${iconAssetId}`: replacing the icon changes the key, so no explicit invalidation is needed. */
const organizationIconCache = new SignedUrlCache(async (key) => (await apiRequest<{ download: Signed }>(`/v1/organizations/${encodeURIComponent(key.split(':')[0]!)}/icon`)).download);

export const useOwnAvatarUrl = (userId: string | null) => useSignedUrl(ownAvatarCache, userId);
export const useOrganizationIconUrl = (organizationId: string, iconAssetId: string | null | undefined) =>
  useSignedUrl(organizationIconCache, iconAssetId ? `${organizationId}:${iconAssetId}` : null);

// ─── Personal avatar ───────────────────────────────────────────────────────────────────────────────────────
/** Uploads and activates the caller's avatar, replacing the previous one. Every mounted avatar updates itself. */
export async function uploadOwnAvatar(userId: string, file: File): Promise<void> {
  const { avatar, upload } = await apiRequest<{ avatar: { id: string }; upload: SignedRequest }>('/v1/me/avatar/uploads', {
    method: 'POST',
    body: JSON.stringify({ mime: file.type, size: file.size, checksum: await sha256Hex(file) }),
  });
  await putToStorage(upload, file);
  await apiRequest(`/v1/me/avatar/${encodeURIComponent(avatar.id)}/confirm`, { method: 'POST' });
  await ownAvatarCache.ensure(userId, true); // keeps showing the old picture until the new URL arrives
}

export async function removeOwnAvatar(userId: string): Promise<void> {
  await apiRequest('/v1/me/avatar', { method: 'DELETE' });
  await ownAvatarCache.ensure(userId, true);
}
