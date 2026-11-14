# NORTH engineering instructions

## Ownership and boundaries

This repository owns the NORTH web/desktop client, workspace experience, reusable UI, navigation, tabs, layouts, frontend state, i18n and typed CORECROW API consumption. It does not own authoritative identity, organizations, membership, authorization, entitlements, business services or persistence. Never add direct PostgreSQL access or a convenience backend that bypasses CORECROW.

Personal Workspace is not an organization. Client-side visibility, demo roles, fallback data and `PermissionContext.can()` are never authorization. CORECROW must authorize protected operations and derive tenant context from authoritative membership.

## UI and state model

- Trace navigation through `src/App.tsx`, the provider hierarchy, catalog IDs, `TabsContext`, and `ViewsRenderer` before changing it.
- Preserve the current organization-remount boundary (`key={activeOrganization.id}`) unless a Task explicitly redesigns state ownership; organization, workspace, catalog and tab state must not leak across tenants.
- The shell is one navigation sidebar (`src/components/navigation/NavSidebar.tsx`, decision UX-01c in `GBP.docs/03-PRODUCTS/NORTH/UX-REDESIGN.md`) -> tabs -> workspace content. The sidebar holds the logo, the organization switcher (`OrganizationSwitcher`), the catalog tree (categories as groups, subcategories as rows) and the user; it is always dark (`.north-nav-dark`) whatever the theme. The old Organization Rail, `CategoryRail` and `ContextSidebar` no longer exist; do not bring them back without a new decision.
- Category or subcategory changes must not create arbitrary new tabs. Use the established intentional tab/navigation flow and browser-like active/close behavior.
- Keep feature screens under `src/features/<feature>` and reusable shell/UI under `src/components`. Reuse CSS tokens, shared primitives, Phosphor icons (`@/components/ui/icon`), `cn()`, `@/` imports and current light/dark/midnight themes.
- Add both Spanish and English locale entries for user-facing shell text. Keep mock/demo behavior isolated and visibly non-authoritative.

## Contracts, tooling and validation

Coordinate CORECROW-facing contract changes with the backend owner, including schema/OpenAPI and compatibility review. Authentication, session, permission, organization, billing, audit and deployment work requires explicit security and tenant analysis.

Use pnpm 9.15 and Node 22 for CI parity; do not mix npm and pnpm lockfile changes. Run `pnpm lint` and `pnpm build`. When changing `src-tauri`, also run relevant Rust/Tauri checks supported by the repository. There is currently no automated frontend test suite, so add focused tests when practical and report any remaining verification gap. Preserve the manual verified deployment, atomic release switch and rollback behavior. Never inspect or expose local `.env` values.

The shared CodeGraph index is at `../.codegraph`. When working from the GBP workspace and that index exists, use `codegraph explore` from the workspace root before broad text search for code-path questions.
