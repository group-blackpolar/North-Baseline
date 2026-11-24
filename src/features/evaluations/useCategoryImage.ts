import { useEffect, useState } from 'react';
import { readAssetUrl } from '@/lib/assets';
import { categoriesApi } from './api';

/** Signed URL of a category image (a North asset of the organization); null while loading or when there is none / it cannot be read. */
export function useCategoryImage(organizationId: string, assetId: string | null, categoryId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    // A saved category's image is read through the category (people taking exams have no access to the asset library); an unsaved upload preview uses the asset itself.
    const read = () => (categoryId ? categoriesApi.image(organizationId, categoryId).then((response) => response.download.url) : readAssetUrl(organizationId, assetId!));
    const sign = () => { if (assetId) read().then((next) => { if (live) setUrl(next); }).catch(() => undefined); };
    sign();
    const timer = assetId ? window.setInterval(sign, 4 * 60_000) : undefined; // signed URLs are short-lived
    return () => { live = false; window.clearInterval(timer); };
  }, [organizationId, assetId, categoryId]);
  return url;
}
