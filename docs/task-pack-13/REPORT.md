# Task Pack 13 — Engineering report

Repos: NORTH (`north-task-pack-12` worktree) and CORECROW (`corecrow-task-pack-12` worktree), branch `feature/task-pack-12`.
Everything below was verified by reading code/contracts and by `tsc`, lint, build and unit tests. **No authenticated
browser walkthrough was possible** (no credentials in the session): items marked *unverified in browser* need a manual pass.

## A. Bug fix report

### A1. Administration needs two clicks (Task 1) — fixed
- **Cause (verified in code, not assumed):** `PublishedRouteIntent` (`src/App.tsx`) treated a panel URL as "already resolved"
  while the active tab owned that panel, but never recorded it in `resolvedPathRef`. Opening Home leaves the URL on
  `/org/home/…/panel`. Clicking Administration swaps the tab to an admin screen (no panel, **URL unchanged**), so
  `alreadyResolved` flips to `false`, the effect re-runs, sees a never-resolved panel URL and calls `navigate(home)`.
  On the second click `resolvedPathRef` had been written, so it worked.
  Sequence: `click Administration → tab=adm-overview → alreadyResolved=false → effect resolves stale URL → navigate(Home)`.
- **Fix:** (1) record the URL as handled when it is `alreadyResolved`; reset the memo when the route stops being a panel
  (so Back to a panel URL re-resolves). (2) `navigateToPublishedTarget` now leaves the organization root URL
  (`/{org}`) on an explicit click into a screen without a published panel, so no stale panel URL survives (also makes
  reload on Administration land on the persisted admin tab instead of reopening the old panel). Boot-time `replace` is
  untouched so deep links are never overwritten. No timers/delays/retries.
- Files: `src/App.tsx`, `src/lib/publishedNavigation.ts`.
- *Unverified in browser:* the listed entry cases (from Profile, other org, deep link, reload, right after login).

### A2. Billing & Usage access (Task 2) — hardened; root cause only partly provable
- Verified: CORECROW `GET/PATCH /v1/organizations/:id/billing` authorize `billing.read` / `billing.manage`; roles OWNER,
  ADMIN, BILLING_ADMIN hold them (`policy.ts`). The screen itself already separates loading / forbidden (403/404) /
  error and shows an honest "quotas unavailable" panel (there is **no** usage endpoint).
- Found: the same stale-URL bounce as A1 also hit Billing when entered from a non-admin screen, and a **failed permission
  discovery** (network) left every entry with a `requiredPermission` (Billing, Audit, …) disabled forever with no
  explanation.
- Fix: A1, plus `PermissionContext.canNavigate()` — navigation hints stay enabled when discovery failed (CORECROW still
  authorizes every request). Used by `CategoryRail`, `Sidebar`, `NavigationDrawer`.
- Files: `src/context/PermissionContext.tsx`, `src/views/Sidebar.tsx`, `src/components/organization/CategoryRail.tsx`,
  `src/components/mobile/NavigationDrawer.tsx`.
- Platform Billing is a separate surface (`/workspace/admin`, `/v1/platform/billing/*`); unchanged.

## B. UI/UX audit (Task 3) — findings log

Method: code-level sweep of shared components (no authenticated screenshots available).

| Component | Problem | Severity | File | Fix | Status |
|---|---|---|---|---|---|
| Language selector | Dropdown used literal `z-10`; can sit under panels | Medium | `components/LanguageSelector.tsx` | `z-(--z-popover)` | Fixed (tsc/build) |
| Views structure pane | Native `window.confirm`/`alert` for archive/duplicate (blocking, unstyled, contradicts repo rule) | Medium | `features/views/ViewsStructurePane.tsx` | `ConfirmDialog` + inline error | Fixed |
| Overlays in fullscreen | Portals mounted in the shell, invisible while an element is fullscreen | High (new feature) | `components/ui/portal.ts` | Mount inside `document.fullscreenElement` | Fixed |
| Popovers | No shared anchored popover; ad-hoc absolutes can be clipped by `overflow` | Medium | `components/ui/popover.tsx` (new) | Portal + flip + viewport clamp + Esc/outside | Added; used by facets |
| Nav entries | Disabled forever after failed permission discovery | High | see A2 | `canNavigate` | Fixed |
| Documents detail | 3× `window.confirm` | Low | `features/documents/DocumentDetail.tsx` | — | **Open** (use `ConfirmDialog`) |
| Absolute dropdowns | `PersonalHome`, `DocumentEditor` use local `z-20` + absolute (clipping risk inside overflow parents) | Low | files named | — | **Open** (migrate to `Popover`) |
| Whole-app 100 % zoom comfort, sidebar hover shift, responsive tables, contrast, focus | Cannot be judged without a rendered authenticated session | — | — | — | **Not verified** |

## C. Administration

- **Administration / Billing:** see A.
- **Audit management (Task 4):** CORECROW's `AuditLog` is append-only evidence; there is **no** archive, purge or
  retention contract and adding a destructive one needs a migration + retention policy (architectural decision, not done).
  Implemented the safe, honest part: **"Hide from my view"** in Administration → Audit (multi-select, confirm, per-event
  button in the detail sheet, "show hidden" toggle, restore). It is a per-browser, per-organization preference
  (`auditModel.ts`), never labelled as deletion, and the screen states that events remain retained in CORECROW. No
  button implies permanent deletion. The Members/Invitations screens have no separate audit tab: audit is one center
  with category filters (`member`, `invitation`, …).
  - Proposal for server-side archive/purge: `POST /v1/organizations/:id/audit/:eventId/archive` (`audit.manage`, sets
    `archivedAt/By`, excluded from default list, still returned with `includeArchived=true`, audited);
    `POST /v1/platform/audit/purge` (superadmin, retention-policy window, dry-run first, refuses security categories and
    events whose actor is the caller, writes a non-purgeable `audit.purge` event). Needs `AuditLog.archivedAt`, a
    `RetentionPolicy` table and a migration review.
- **Legacy split view (Task 5):** removed `SplitContent`, `LayoutSwitcher`, `ResizeHandle`, `LayoutContext`, the
  `north-layout-v2` reader, panel/layout locale keys. Replaced by `WorkspaceContent` (single workspace area) and a slim
  `AssistantBar` that keeps Cuervo in the same 40 px right edge. Tabs, org rail and category navigation untouched; the
  stale stored mode is simply never read.

## D. Dashboard foundation (Task 6)
- Reused (already existed): `MetricCard`, `DashboardCard`, `FilterBar`, bar/stacked/line/area/donut charts, sortable data
  grid, 12-column responsive grid whose layout is **persisted in the View document** (`sections[].components[].layout`
  per desktop/tablet/mobile) — no second page architecture was created.
- Added: `components/dashboard/metrics.tsx` (`TrendCard`, `ComparisonCard`, `ProgressIndicator`, `StatusPanel`,
  `percentChange`/`formatDelta`; null-safe, theme tokens only), `AnalyticsScatterChart`.
- Pending: map visualization (no geo dataset support), pivot table, wiring the new metric cards to published component
  types (needs CORECROW component schema additions: `trend_metric`, `comparison`, `progress`).

## E. Universal filter engine (Task 7)
- `features/filters/filterModel.ts` (pure, tested): definition → control mode (`multi`/`single`/`text`/`range`),
  selection → CORECROW filters using **only operators the binding allows**, chips, restore per panel (sessionStorage,
  cleared on sign-out), serializable selections (foundation for saved presets).
- `FacetSelect` (popover with search, real values, counts, checkboxes, selected pinned on top, retry/empty/loading
  states, debounced search), `FilterBar` (facets, date/number ranges, text, removable chips, clear all, responsive sheet).
- Integrated in `PublishedPanel`: filters are derived from each binding's `filterDefinitions`; one selection applies to
  every binding that defines the field; results update live; showcase (no facet endpoint) degrades to text inputs.
- **CORECROW changes:** `IN` operator (bounded list, ≤100) in `query-contract.ts`/`query-service.ts`/schemas, and
  `POST /v1/organizations/:orgId/panels/:panelId/analytics-bindings/:bindingId/facets` — same panel/audience
  authorization as `results`, only for fields the binding allow-lists, binding base filters + other runtime filters
  applied, own selection excluded from counts (standard faceting), ≤100 values, rate-limited. OpenAPI regenerated.
- Limits: AND semantics only (no OR groups); `NOT IN`/`IS EMPTY` need `NE`/`EQ null` UI; no saved-preset UI; Query
  Explorer does not offer `IN` yet; facet counts for very high cardinality are capped at 100 (UI says so).

## F. Presentation mode (Task 8)
- **Fullscreen:** Fullscreen API on the panel; filters stay interactive; overlays follow the fullscreen element; Esc exits
  with state intact.
- **Presentation:** one scene per section on a 16:9 stage, title, frozen filter snapshot, last data refresh, keyboard
  (←/→, PgUp/PgDn, Home/End, F, Esc), dots, optional 15 s auto-advance (off by default), `aria-roledescription=slide`.
  The dashboard's own selections are never modified; exit returns to the same state.
- Not done: scene configuration persisted in the View, PDF export, per-scene titles beyond the first heading.

## G. Endpoint gap matrix (Task 9) — routes verified in `src/routes/v1.ts`

| Capability | NORTH component | Endpoint | Status | Missing work | Pri |
|---|---|---|---|---|---|
| Permission discovery | `PermissionContext` | `GET /v1/organizations/:id/permissions` | EXISTS / WORKING | — | — |
| Org billing read/update | `BillingScreen` | `GET/PATCH /v1/organizations/:id/billing` | EXISTS / WORKING | — | — |
| Subscriptions / invoices / entitlements | `BillingScreen` | `GET /organizations/:id/subscriptions`, `/entitlements` | EXISTS / WORKING | — | — |
| Usage / quotas | `BillingScreen` ("unavailable") | none | MISSING | `GET /organizations/:id/usage` | P2 |
| Platform billing | `PlatformAdminView` | `GET /platform/billing/summary`, `/platform/organizations/:id/billing[/status]` | EXISTS / WORKING | — | — |
| Org audit read | `AuditCenter` | `GET /organizations/:id/audit` (`limit`,`before`) | EXISTS / WORKING | server-side filters (action/actor/date), `includeArchived` | P1 |
| Audit archive / purge / retention | `AuditCenter` | none | MISSING | see C (needs migration) | P1 |
| Platform audit | platform admin | `GET /platform/audit` | EXISTS / WORKING | — | — |
| Members, invitations, groups, grants | `AccessAdminView` | `/organizations/:id/members|invitations|groups|…` | EXISTS / WORKING | — | — |
| Navigation / taxonomy / archive | catalog, Views | `/organizations/:id/navigation`, `…/archive` | EXISTS / WORKING | — | — |
| Panel draft/publish/revisions | Views | `/organizations/:id/panels/:panelId/(draft|publish|revisions…)` | EXISTS / WORKING | — | — |
| Templates, search | Views | `/north/templates…`, `/north/search` | EXISTS / NOT INTEGRATED (search) | wire search | P2 |
| Dataset query | Query Explorer | `POST …/datasets/:id/query` | EXISTS / WORKING | `IN` added this pack | — |
| Binding results | published renderer | `POST …/analytics-bindings/:id/results` | EXISTS / WORKING | `IN` allowed | — |
| **Facet values** | `FacetSelect` | `POST …/analytics-bindings/:id/facets` | **ADDED** (this pack) | showcase equivalent (`/showcase/…`), deploy | P1 |
| Dataset-level facets (Query Explorer) | — | `AGGREGATE` query works | PARTIALLY IMPLEMENTED | UI | P2 |
| Calculated fields / dependencies | Queries | none verified | MISSING | design | P2 |
| Saved filter presets | filter engine | none | MISSING | `GET/PUT /organizations/:id/panels/:panelId/filter-presets` (per user, tenant-scoped, ≤20, audited) | P2 |
| Conditional requests / ETag on views | — | ETags on NORTH content documented in CURRENT_STATE | EXISTS (not audited here) | verify client `If-None-Match` | P2 |

Request/response for the added facets endpoint: body `{fieldId, search?, filters[≤10], limit 1–100 (default 50)}` →
`{bindingId, fieldId, values:[{value,count}], truncated, executedAt}`; errors 404 (panel/binding/audience, generic),
403 (ACL panels), 422 `BINDING_FILTER_NOT_ALLOWED`; no cache (counts depend on filters); no new tables.

## H. Quality assurance
- NORTH: `pnpm lint` (0 errors; pre-existing warnings), `pnpm build` (tsc -b + vite) OK, `pnpm test` 65/65
  (adds `filterModel.test.ts`), dev server boots with no console errors (login page only).
- CORECROW: `pnpm lint`, `pnpm build`, `pnpm test:unit` 64/64 (adds `tests/query-contract.test.ts`), `pnpm openapi` regenerated.
- **Not run:** CORECROW integration tests (need an isolated `*_test` database), SQL execution of `IN` / facets against a
  real Postgres, authenticated browser walkthrough, visual regression (none configured), responsive/a11y audit in a
  browser, bundle-size profiling (Vite reports chunks >500 kB — pre-existing).
- Task 10 (performance): no profiling done; observations only — facet search is debounced (250 ms), text filters
  350 ms, in-flight requests are aborted, presentation mounts one scene at a time.
