import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

const HEX = /^[a-f0-9]{64}$/i;
const SHAPES = [HEX, /^[A-Z0-9]{1,12}-KEY-[A-Z0-9]{8,24}$/i, /^BP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i];

/** Emailed invitation tokens are lowercase hex; organization keys (`SHARK-KEY-…`) are uppercase. */
export const normalizeInvitationCredential = (value: string) => {
  const compact = value.replace(/\s/g, '');
  return HEX.test(compact) ? compact.toLowerCase() : compact.toUpperCase();
};

/** Shape check only; CORECROW decides whether a credential is actually valid. */
export const isInvitationCredential = (value: string) => SHAPES.some((shape) => shape.test(normalizeInvitationCredential(value)));

export interface InvitationPreview {
  organization: { name: string; slug: string; iconData: string | null };
  kind: 'EMAIL' | 'CODE';
  expiresAt: string;
}

export const validateInvitation = (token: string) =>
  apiRequest<InvitationPreview>('/v1/invitations/validate', { method: 'POST', body: JSON.stringify({ token: normalizeInvitationCredential(token) }) });

/** Debounced server-side preview of the organization behind a credential. */
export function useInvitationPreview(value: string, enabled = true) {
  const [state, setState] = useState<{ status: 'idle' | 'checking' | 'valid' | 'invalid'; preview: InvitationPreview | null }>({ status: 'idle', preview: null });
  useEffect(() => {
    if (!enabled || !isInvitationCredential(value)) { setState({ status: 'idle', preview: null }); return; }
    let live = true;
    setState({ status: 'checking', preview: null });
    const timer = window.setTimeout(() => {
      validateInvitation(value)
        .then((preview) => { if (live) setState({ status: 'valid', preview }); })
        .catch(() => { if (live) setState({ status: 'invalid', preview: null }); });
    }, 350);
    return () => { live = false; window.clearTimeout(timer); };
  }, [value, enabled]);
  return state;
}
