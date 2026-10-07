# NORTH design system (living reference)

Plan and rationale: `GBP/docs/tasks/TASK_NORTH_DESIGN_SYSTEM.md`. Gallery: `dev/playground.html` (dev server, never bundled). Real-app harness: `dev/harness.html`.

## Tokens (`src/index.css`)
Surfaces L0 `background` · L1 `surface` · L2 `.np-card` · L3 `shadow-pop/overlay`. Borders `border` / `border-hover` / `border-selected`.
Radius 6/8/10/14/16, shadows `xs soft pop overlay`, z-index `--z-sticky|navigation|drawer|popover|modal|toast`, motion
`--duration-fast|normal|slow` + `--ease-standard|enter|exit` (CSS only; the `motion` library was dropped because nothing needed it - add it back only with a real consumer), `--touch-min` (44px on coarse pointers).
Never use literal `z-50`/`z-[100]` in new code; use `z-(--z-modal)`.

## Primitives (`src/components/ui`)
| Component | Notes |
| --- | --- |
| `Button` | variants `primary accent secondary ghost outline destructive`; sizes `sm md lg icon icon-sm`; `loading`; press scale .97; >= 44px on touch |
| `IconButton` | `label` (aria + tooltip) and `icon` required |
| `Tooltip` / `TooltipProvider` | Radix; disabled on coarse pointers; labels only, never essential info |
| `Sheet` | `side` left/right/bottom; Radix focus trap, scroll lock, Esc; safe-area footer |
| `Dialog` | centered on desktop, bottom `Sheet` on phone/tablet portrait (`useIsCompactShell`) |
| `Status` + `STATUS_TONE` | dot + label, tones `neutral active pending info error` |
| `PageHeader` | title, description, actions (wrap on narrow widths) |
| `Card` | `selected` ring; hover lift only for `a`/`button`/`role=button` |
| `EmptyState` | duotone icon, primary + secondary action |
| `Skeleton`, `SkeletonRows`, `SkeletonCard` | no global spinners |
| `DialogFrame` | bare modal frame for content with its own heading/footer (Views editors, Formas send dialog, organization modal); same behaviour as `Dialog` |
| `ResponsiveList` | `table` on tablet/desktop, stacked cards on phone (`useShellMode() === 'phone'`) |
| `ResponsiveFilters` | inline controls on desktop; `Filters (n)` button + bottom sheet (Clear/Apply) on phone |
| `Icon` | Phosphor wrapper: sizes `xs..2xl`, `regular` for actions, `duotone` for identity only |

## Overlays and the density zoom
Desktop renders the shell with `zoom: 0.7`. Overlays therefore portal into `.north-app-shell` (`portal.ts`), not `<body>`;
verified at 1440 px for Tooltip and Dialog. Any new overlay must use `portalContainer()`.

## Responsive
`useShellMode()` -> `phone <768 | tablet <1024 | compact <1280 | desktop <1680 | wide`; `useIsCompactShell()` = phone or tablet.

## Charts (`src/components/charts`)
`palette.ts` (`--chart-1..8` tokens, axis/grid props, `formatNumber`, `compact`), `NorthChartTooltip` (the only tooltip),
`NorthLegend`, `Sparkline` (plain SVG), `RadialProgress`. Recharts stays underneath; `components/dashboard/charts.tsx`,
`AnalyticsVisuals.tsx` and `ApiHealthView.tsx` consume the module. Never put hex colours or `contentStyle` in a chart.

## Mobile shell (`src/components/mobile`, `src/lib/shellNavigation.ts`, `src/lib/overlayHistory.ts`)
Phone and portrait tablet (< 1024 px) render `MobileHeader` + `NavigationDrawer` + `TabSwitcher` instead of the rails, breadcrumb,
tab strip and layout switcher; the stored split layout is ignored there. Rails and drawer call the same
`useOrganizationNavigation` / `useCategoryNavigation` hooks. Drawers/sheets that navigate must wrap the action in the `go()`
returned by `useOverlayHistory` (it pops the Back-button marker first). The content column keeps its tree position across
modes, so a resize does not remount the workspace.

## Dev tools
`dev/harness.html?path=/seminsa` (real app, mocked API) and `dev/playground.html?theme=dark` (primitives gallery).
The browser pane only advances animations and `matchMedia` events when it paints: take a screenshot after resizing or clicking
before asserting on drawers/sheets.

## Loading without flicker (reusable strategy)
- **Delayed skeleton:** `useDelayedFlag(active, 150, 280)` and `<DelayedSkeleton loading minHeight fallback>`: a skeleton appears only if loading lasts > 150 ms and, once shown, stays >= 280 ms. Until then an empty box of `minHeight` keeps the layout (no shift, no flash). Fast responses never show a loader.
- **Keep previous data:** a reload (filter, refresh, pagination) leaves the current rows/cards on screen, dimmed (`opacity-60`, `aria-busy`), and replaces them when the new data arrives. Implemented in `useCursorList` (no longer clears items on refetch), `PlatformTable`, `DocumentList`, the platform Dashboard/Billing screens (skeleton only when there is no data yet). Failures still drop the data (fail closed); `DocumentList` keeps rows and shows a non-destructive banner with Retry.
- **Real-shape skeletons** (`components/ui/skeleton.tsx`): `SkeletonMetricCard`, `SkeletonDocumentCard`, `SkeletonAdminCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonDocumentDetail`, `WorkspaceSkeleton`.
- **Arrival:** containers that mount when data is ready use `np-fade-in` (opacity only, mount-only, so in-place refreshes do not re-animate).
- **Organization switching:** `OrganizationRail` and `NotificationProvider` now live outside the `key={activeOrganization.id}` boundary (`AppShell`), so the rail stays on screen; tenant state (workspace, catalog, tabs, layout) still remounts exactly as before. While the navigation loads, the content area shows `WorkspaceSkeleton` (`SplitContent`, `opening`), and a URL-driven org change uses `SwitchingShell` (real rail + skeleton) instead of the grey generic shell. Measured with 107 frames at 900 ms latency: no frame without the rail and no frame without content or skeleton.
- **Errors:** `ErrorState` (block or compact banner + Retry) in Formas list/detail and the tenant Administration lists.

## Motion added (all `<= 280 ms`, subtle)
| What | How |
| --- | --- |
| Accordion (drawer categories, desktop sidebar groups) | `Collapse` (grid 0fr<->1fr, 180 ms), closed content `inert` |
| Stagger of cards (Formas, Administration, platform tables) | `np-stagger` + `--i`, 40 ms step, capped at 8 items |
| Screen/tab change | `useScreenTransition`: 170 ms fade + 4 px rise via Web Animations API on the existing node (no remount, state preserved) |
| Tab row exit in the phone switcher | row `Collapse`s (180 ms) then the unchanged `closeTab()` runs |
| Pressed feedback | `np-press` (scale .98 + stronger background) on org rail, drawer rows; `np-press-flat` (background only) on sidebar rows, tab rows, group options, legend toggles; clickable `.np-card` scales .985 on `:active` |
| Toast | `np-toast` rise 180 ms |
Reduced motion: the global `prefers-reduced-motion` rule now also zeroes `animation-delay`, so staggered items never wait; `useScreenTransition` and the tab-row exit skip their animation entirely; `Collapse`, press and fade collapse to instant through the same rule.

## Toasts (`components/notifications/ToastHost.tsx`)
Shown for notifications pushed from this tab (the bell keeps the history); 4.5 s, 7 s for errors (`role="alert"`). Phone: bottom centre, `calc(env(safe-area-inset-bottom) + 1rem + height of [data-bottom-bar])` (the Formas editor save bar sets `data-bottom-bar`). Desktop: bottom right, 1.5 rem. `NotificationProvider` now sits above the organization switch so a toast raised while creating/joining an organization survives the switch. The unused `WelcomeToast.tsx` was removed.

**Tenant-context risk (documented, not redesigned):** notifications are user-scoped (localStorage, shared across organizations) and a toast is not cleared when the active organization changes. Today only three emitters exist and none carries data of the organization being left: *organization created* (name of the new one), *invitation accepted* (no name) and *local logout* (generic). **Rule for new emitters:** a toast/notification that names tenant data (document references, client names, member emails) must not be pushed through `push()` as-is; either keep that text out of it or add a tenant scope and clear it on switch before shipping such a feature. Persisting generic messages (organization created, settings updated, connection restored) across a switch is intended.

## Fonts
- **Current (self-hosted):** `public/fonts/manrope-latin-var.woff2` (24.8 kB, Manrope v20, wght 200-800) and `geist-mono-latin-var.woff2` (23.1 kB, Geist Mono v6, wght 100-900), latin subset (covers Spanish accents, n-tilde, inverted marks and English), official Google Fonts builds, with their SIL OFL 1.1 texts next to them (`OFL-Manrope.txt`, `OFL-Geist.txt`). `@font-face` (swap) lives in `src/index.css`, both files are `<link rel="preload">`ed in `index.html`, and Google Fonts is no longer requested anywhere (verified: zero `fonts.googleapis.com` / `fonts.gstatic.com` requests on Login, shell, Formas and Administration). Non-latin scripts are not supported by the subset; add the other Google subsets with their `unicode-range` if ever needed.
- **Before self-hosting:** three families requested from Google Fonts (Manrope, Geist Mono, Inter) with `display=swap`; Inter was never in the font stack as a primary and is no longer requested; the CSS stylesheet is render-blocking and text swapped from a generic fallback (visible reflow).
- **Then (intermediate):** Inter dropped; metric-matched fallbacks (`Manrope Fallback` = Arial at 102 % with ascent 104.5 % / descent 29.4 %, `Geist Mono Fallback` = Courier New) measured in-browser, so the swap barely moves text. `viewport-fit=cover` added so `env(safe-area-inset-*)` works on notched phones.

## Bundle (current state, not optimised)
`dist/assets/index-*.js` ~1.39 MB uncompressed / ~373 kB gzip. Candidates for lazy loading / code splitting: **charts** (Recharts, used by dashboards and published panels), **Administration** (platform-admin + access-admin screens), **Formas** (documents workspace and editor). Treat as its own performance Task.

## Explicitly out of this batch (follow-ups)
Drag/swipe gestures; bundle splitting; `visualViewport`/virtual keyboard handling for the Formas editor; full offline state; full mobile accessibility and screen-reader audit.

## Density zoom (`zoom: 0.7`) - diagnosis, not a change
- **Why:** commit `0ac91f4` (2026-09-30, "scale authenticated workspace to 70 percent") makes NORTH look denser at 100 % browser zoom; `af0aeb3` turns it off below 1024 px. It compensates for a UI sized for ~100 % (14 px body, many `text-xs`/`text-[10-11px]`) that felt too large for a data-heavy workspace.
- **Where:** `.north-app-shell` in `src/index.css` (width/height compensated by 142.857 vw/vh), applied in `App.tsx` (loading skeleton, no-organization state, workspace), `PlatformAdminView` (via `.north-app-shell-host > .h-screen/.w-screen`), `ShowcaseView`, and the dev playground. Login and the terms screens are outside the shell and render unzoomed.
- **What depends on it:** every shell dimension token (`--shell-*` are "before density"), `h-screen`/`w-screen` overrides, and overlays, which must portal *inside* the shell (`components/ui/portal.ts`) to share its coordinate space.
- **Cost:** effective type is 0.7x (12 px `text-xs` renders ~8.4 px, 14 px body ~9.8 px), which is below comfortable/accessible sizes; `zoom` is non-standard CSS with historical engine differences (Firefox only supports it since 126), and it complicates Motion/layout measurement, popover/tooltip positioning, chart sizing, pointer coordinates and screenshots.
- **If removed:** all hard-coded sizes, `--shell-*` widths, the `h-screen` overrides and the portal strategy change; every screen would look ~43 % larger unless type/spacing are re-scaled.
- **Recommendation:** replace it with real density tokens (a root font-size/`rem` scale plus component density: row height, padding, icon size) applied per breakpoint, then drop `.north-app-shell` zoom and the compensation CSS. Do it as its own Task with a visual-regression pass; until then keep it as is.

## Animated tab indicator - follow-up
Not implemented (current behaviour: the active tab changes colour/border with a CSS transition). Recommended order when revisited: (1) remove or replace `zoom` first, then (2) a single absolutely positioned indicator driven by CSS variables (`--tab-x`, `--tab-w`) set from the active tab's `offsetLeft/offsetWidth` (layout-box values, unaffected by transforms) and animated with `transform`/`width` transitions - no new dependency; (3) Motion `layoutId` only if the shell needs richer shared-layout animation anywhere else. Avoid `getBoundingClientRect` under `zoom`.

## Manual QA checklist (real devices, after deploy)
Phone (iOS Safari + Android Chrome): organization switch; category and subcategory navigation; tabs (switcher sheet, close, new); Home; Formas (list cards, filters sheet, detail actions sheet, editor with keyboard, sticky save bar vs home indicator); Profile; Settings; Administration (tenant: users/invitations/groups/permissions; platform: sections via the header menu); dialogs and bottom sheets (focus, scroll lock, swipe/Back closes); inputs with keyboard (no zoom on focus, nothing hidden behind the keyboard); scroll (single scroll region, no rubber-band glitches); charts (tap tooltips, legends); tables vs cards; rotate portrait/landscape with a drawer open and with unsaved input.
Tablet: portrait (drawer shell) and landscape (>= 1024 px rails): drawer behaviour, navigation density, workspace width, split layouts only in landscape.

## Harness limitations (dev only)
`dev/harness.ts` mocks a fixed organization list and a `content/resolve` that always answers with the Formas panel. Therefore *create organization* ends in "not found" (the new organization is not in the mocked list), and navigating to a category without a panel from a panel URL can bounce back to Formas. These are harness artefacts and do not affect production; the harness is not meant to become a backend.

## Safe areas (manual QA)
`viewport-fit=cover` is on, so `env(safe-area-inset-*)` is live. Check on iPhone with notch/Dynamic Island and on Android: Login, Terms, Formas, bottom actions (editor save bar), toasts, the mobile header.

## Known gaps
- No automated frontend tests; introduce a test harness / Vitest as its own Task (it needs a dependency-workflow decision).
- `package-lock.json` is tracked next to `pnpm-lock.yaml` and still lists `lucide-react`; it is unused by CI and deploy and predates this task. Remove it in a separate cleanup.
- Horizontal-bar category axis is 84 px on phone (`useLabelAxisWidth`); tick density is not otherwise tuned.
- Analytic tables (`AnalyticsDataGrid`, `SimpleTable`, `ViewsPreview`) keep horizontal scroll on phone by design.
- Hand-rolled overlays `ErrorOverlay` and `SessionLockOverlay` are blocking by design.
- Under `prefers-reduced-motion` the global CSS rule makes all CSS animation/transition effectively instant (sheets, dialogs, tooltips, press scale); `animate-spin` spinners stop at one iteration.
