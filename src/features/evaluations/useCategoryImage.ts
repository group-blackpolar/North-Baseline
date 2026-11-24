import { useEffect, useState } from 'react';
import { readAssetUrl } from '@/lib/assets';

/** Signed URL of a category image (a North asset of the organization); null while loading or when there is none / it cannot be read. */
export function useCategoryImage(organizationId: string, assetId: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    const sign = () => { if (assetId) readAssetUrl(organizationId, assetId).then((next) => { if (live) setUrl(next); }).catch(() => undefined); };
    sign();
    const timer = assetId ? window.setInterval(sign, 4 * 60_000) : undefined; // signed URLs are short-lived
    return () => { live = false; window.clearInterval(timer); };
  }, [organizationId, assetId]);
  return url;
}
