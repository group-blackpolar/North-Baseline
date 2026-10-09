// Framework-free helpers for the organization context (unit-tested with `node --test`).

type Visible = { id: string; name?: string; slug?: string; status?: string; iconData?: string | null; iconAssetId?: string | null; avatarUrl?: string | null; description?: string | null };

/** True when nothing a person can see about the organization changed. */
export function shallowEqualOrganization(a: Visible, b: Visible) {
  return a.id === b.id && a.name === b.name && a.slug === b.slug && a.status === b.status
    && (a.iconData ?? null) === (b.iconData ?? null) && (a.iconAssetId ?? null) === (b.iconAssetId ?? null)
    && (a.avatarUrl ?? null) === (b.avatarUrl ?? null) && (a.description ?? null) === (b.description ?? null);
}
