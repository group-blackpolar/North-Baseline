/** Capa demo: organizaciones/workspaces mock persistidos.
 *  TODO: CoreCrow Organization + Workspace API — sustituir getDemo* por fetch reales. */

export interface DemoOrganization {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  description?: string;
  initials: string;
  kind: 'personal' | 'demo' | 'custom';
}

export interface DemoWorkspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string | null;
}

const STORAGE_KEY = 'north-demo-orgs-v1';

// IDs canónicos
export const PERSONAL_ORG_ID = 'personal';
export const SHARK_ORG_ID = 'shark';
export const PERSONAL_WS_ID = 'personal-ws';
export const SHARK_WS_ID = 'shark-ws';

// Utilidades
export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function generateInviteToken(prefix = 'NORTH'): string {
  const block = () =>
    Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 34)]).join('');
  return `${prefix}-${block()}-${block()}`;
}

// Organizaciones sembradas (siempre presentes)
const SEED_ORGS: DemoOrganization[] = [
  {
    id: PERSONAL_ORG_ID,
    name: 'Personal',
    slug: 'personal',
    avatarUrl: null,
    initials: 'P',
    kind: 'personal',
  },
  {
    id: SHARK_ORG_ID,
    name: 'SHARK',
    slug: 'shark',
    avatarUrl: null,
    description: 'Maritime Imports Intelligence',
    initials: 'S',
    kind: 'demo',
  },
];

const SEED_WORKSPACES: DemoWorkspace[] = [
  {
    id: PERSONAL_WS_ID,
    organizationId: PERSONAL_ORG_ID,
    name: 'Personal Workspace',
    slug: 'personal',
    description: 'Tu espacio personal',
  },
  {
    id: SHARK_WS_ID,
    organizationId: SHARK_ORG_ID,
    name: 'SHARK Workspace',
    slug: 'shark',
    description: 'Panama maritime import intelligence',
  },
];

// Persistencia de orgs custom (creadas vía modal)
interface CustomStore {
  orgs: DemoOrganization[];
  workspaces: DemoWorkspace[];
}

function readCustom(): CustomStore {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && Array.isArray(raw.orgs) && Array.isArray(raw.workspaces)) {
      return raw as CustomStore;
    }
  } catch {
    /* storage no disponible */
  }
  return { orgs: [], workspaces: [] };
}

function writeCustom(store: CustomStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota excedida */
  }
}

// API pública del store demo
export function getDemoOrganizations(): DemoOrganization[] {
  return [...SEED_ORGS, ...readCustom().orgs];
}

export function getDemoWorkspaces(organizationId: string): DemoWorkspace[] {
  return [...SEED_WORKSPACES, ...readCustom().workspaces].filter(
    (ws) => ws.organizationId === organizationId
  );
}

export function isDemoOrganization(organizationId: string): boolean {
  return getDemoOrganizations().some((org) => org.id === organizationId);
}

export function createDemoOrganization(input: {
  name: string;
  description?: string;
  avatarUrl?: string | null;
}): { org: DemoOrganization; workspace: DemoWorkspace; token: string } {
  const id = `org-${crypto.randomUUID().slice(0, 8)}`;
  const org: DemoOrganization = {
    id,
    name: input.name,
    slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    avatarUrl: input.avatarUrl ?? null,
    description: input.description,
    initials: initialsFor(input.name) || 'N',
    kind: 'custom',
  };
  const workspace: DemoWorkspace = {
    id: `ws-${id}`,
    organizationId: id,
    name: `${input.name} Workspace`,
    slug: org.slug,
  };
  const store = readCustom();
  writeCustom({ orgs: [...store.orgs, org], workspaces: [...store.workspaces, workspace] });
  return { org, workspace, token: generateInviteToken(initialsFor(input.name) || 'NORTH') };
}

export function joinDemoOrganization(token: string): { org: DemoOrganization; workspace: DemoWorkspace } {
  const normalized = token.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
    throw new Error('INVALID_TOKEN');
  }
  const name = normalized.split('-')[0];
  const existing = getDemoOrganizations().find((org) => org.name.toUpperCase() === name);
  if (existing) {
    return { org: existing, workspace: getDemoWorkspaces(existing.id)[0] };
  }
  const created = createDemoOrganization({ name });
  return { org: created.org, workspace: created.workspace };
}