// Framework-free landing types and editor helpers (unit-tested with `node --test`).
export type LandingMode = 'STANDARD' | 'PANEL' | 'NONE';
export interface LandingRule { role?: string; groupId?: string; panelId: string }
export interface LandingPolicy { mode: LandingMode; defaultPanelId: string | null; updatedAt: string | null; rules: LandingRule[] }
export interface LandingTarget { categorySlug: string; subcategorySlug: string; panelSlug: string }
export interface LandingResolution { mode: LandingMode; source: 'rule' | 'default' | 'none'; target: LandingTarget | null }

/** Pure helpers for the editor (unit-tested). */
export function moveRule<T>(rules: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= rules.length) return [...rules];
  const next = [...rules];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
export const ruleKey = (rule: Pick<LandingRule, 'role' | 'groupId'>) => (rule.role ? `r:${rule.role}` : `g:${rule.groupId}`);
/** True when the draft can be sent: PANEL needs a default and every rule needs an audience and a panel, once each. */
export function isLandingDraftValid(policy: LandingPolicy) {
  if (policy.mode === 'PANEL' && !policy.defaultPanelId) return false;
  const keys = new Set<string>();
  for (const rule of policy.rules) {
    if (!rule.panelId || Boolean(rule.role) === Boolean(rule.groupId)) return false;
    const key = ruleKey(rule);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}
