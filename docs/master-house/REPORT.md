# ENGINEERING REPORT — SHARK Master House: dashboards, matrix layout, performance, assistant, chat bug

Repos: `North-BP` (this) and `CoreCrow-BP` (`docs/master-house.md` has the metric audit, measurements and tool table). Authority: the user's request; tenant/permission rules of `AGENTS.md` unchanged.

## 1. Diagnosis

| Area | Finding |
| --- | --- |
| Chat shows "something went wrong" until reload | CORS headers were lost on the hijacked SSE reply (browser blocked a completed run); plus truncation at 100 events and a retry budget that ignored progress. Root cause confirmed from the production nginx log and reproduced by a test that fails without the fix. |
| Dashboards | The eight panels already existed in production with old basic components (table/metric/bar/donut with fixed heights). Layout rows were `minmax(2rem, auto)`: every component set its own height, so the page grew with content and a move could stretch the layout downwards. |
| Drag & drop | The Studio already had a 12-column grid, undo/redo, keyboard moves and serialized autosave. Defects: collisions pushed the whole stack down without limit; rows were content-sized so the ghost and the published page disagreed; text could be selected while dragging. |
| Panel switching | `PublishedPanel` was not keyed by panel id: grid sort/page-size/search leaked from one panel to the next (components share ids like `table`). |
| Charts | Bar/line/donut used an older hook that dropped the last result on every filter change and had no cross-filter. |
| Data consistency | Master/House TEUs and metric tons are BL-level values repeated per container (and blank on 33 % of rows): a plain SUM overstates by 29–39 %. The production dataset also keeps 5 % exact-duplicate rows (weights +4.9 %). See `CoreCrow-BP/docs/master-house.md`. |
| Performance | Aggregates sorted the full 1.5 kB JSON row of 193 k rows (290 MB external sort): 4–10 s per query, ~12 queries per dashboard. |

## 2. Changes

**CORECROW** (`feat/master-house-engine`): SSE CORS/batch fix; `SUM distinctBy` (MAX per key) and `groupBy` up to 6; projected-CTE aggregates + `work_mem`;
section layout `rowHeight`/`fit`, `org_brand`, `link`/`list` `panelSlug`, grid `year`/`rank`/`heat`, `filter_bar.labels`, bar `drill`/`categoryFormat` (all additive; `openapi.*` regenerated);
`describePublished`; assistant `views.*` tools, confirmed actions, recoverable tool errors; multi-panel provisioner with 429 retry; the Master House definition; tests.

**NORTH** (`feat/master-house-layout`): fixed-matrix renderer (desktop), compact filter bar, charts that fill their cell and keep the last valid result, cross-filter and drill-down,
expand-to-dialog, in-app navigation links, organization brand component, grid rank/year/heat, bounded collision policy in the Studio, assistant directives + action cards, chat recovery.

## 3. Final organization (category `master-house`, existing slugs, nothing duplicated)

| # | Subcategory → panel | Filters | Main content |
| --- | --- | --- | --- |
| 01 | `dashboard-information` → `overview` | – | logo (org brand), `IMPORTS MASTER-HOUSE`, purpose, coverage KPIs computed from the data (first/last record, containers, Master/House BLs, House weight), Report Navigation (7 links), units card |
| 02 | `search-by` → `master-house-consignee` | Master/House Consignee, Entry Port, Departure Port, Month/Year (+Year), Country of Origin | table (≈58 %, sparkline + actions), weight map, containers-per-origin bars with port drill-down, carrier donut |
| 03 | `master-consignee-list` → `master-consignees` | Master Consignee, Port of Arrival, Carrier, Month/Year, Country, Port of Departure | table (Containers, Master TEUs, Weight), map, origin bars + drill, carrier donut |
| 04 | `house-consignee-list` → `house-consignees` | House Consignee, Port of Arrival, Carrier, Month/Year, Country, Port of Departure | table, **Weight per Month (MT)** area chart (calendar axis, oldest first), origin bars + drill, carrier donut |
| 05 | `search-by-port-of-departure` → `port-of-departure` | Master Consignee, Bill Type, Month/Year, Port of Arrival, BL Number, Port of Departure | Master TEUs KPI, consignee × ports table, origin bars + drill, consignee bars, containers per year, carrier and entry-port donuts |
| 06 | `consignees-and-cargo-table` → `consignees-cargo` | House Consignee, Departure Port, Country, Month/Year | KPIs (weight, containers, consignees) + wide table (Year, Month, consignee, carrier, port, country, containers, House metric tons) |
| 07 | `consignees-table` → `consignees` | Master/House Consignee, Master Country, Master Port of Departure, Month/Year | KPIs + wide Master↔House table |
| 08 | `top-freight-forwarders` → `top-freight-forwarders` | Master Consignee, Month/Year, Top Country | KPIs, ranking (position, containers/TEUs with heat, sort by either, 15/25/50/100 per page), top-10 bars |

`Standalone` and the other legacy entries were not touched.

## 4. The matrix

* Desktop sections can declare `rowHeight` (px) and `fit`: the page is exactly `rows × rowHeight` (or stretched to the viewport, never below that), components **fill their cell and scroll inside it**; tablet/mobile keep the previous reading-order flow.
* Studio collisions (`resolvePlacement`): *free* → move; *swap* when the target overlaps exactly one item that fits in the mover's old cell; *push* only while the layout does not grow past its existing bottom; otherwise *rejected* (layout unchanged, red ghost, announced to screen readers). Moves/resizes are clamped to the 12 columns; Escape cancels and clears state; body text selection is disabled during a gesture; keyboard moves use the same rule; undo/redo, autosave per breakpoint, ETag handling and restore-from-revision are unchanged.
* Fixed `rowHeight` in the Studio canvas matches the published page (WYSIWYG).

## 5. Measurements

See `CoreCrow-BP/docs/master-house.md`: cold dashboard load of the same bindings **35.9 s → 10.6 s (3.4×)** across the eight panels (real API, local PostgreSQL, 193 k rows); production SQL probes 4.3 s → 1.1 s, 8.1 s → 2.0 s, 10.1 s → 2.3 s.
Layout (real Chrome pane, real data): at 1366×768, 1440×900 and 1920×1080 filters + table + charts fit without outer scroll (scroll height = client height), no cell overflows; at 768×1024 the stacked flow has no horizontal overflow.

## 5b. Release (2026-10-11)

CORECROW PR #16 → `9061bac` (automatic deploy, health `operational`, no migration); NORTH PR #19 → `9ce84d9` (manual deploy workflow, release `north-9ce84d9…` active, previous `north-66cc0e6…` kept for rollback).
Production content: pre-run dump, then the eight panels provisioned and published at revision 3 (see `CoreCrow-BP/docs/master-house.md`, "Provisioning runbook"). Production cold latencies are listed there.

## 6. Verified / pending

Verified: NORTH `pnpm lint` (0 errors), `pnpm test` (104/104), `pnpm build`; CORECROW `pnpm lint`, `pnpm build`, `pnpm test:unit` (88), the full integration suite against an isolated PostgreSQL 16 (analytics contracts incl. distinctBy vs ground truth, assistant tools/permissions/tenant isolation/confirmed actions, SSE stream regression);
end to end locally with the real API and real data: eight panels provisioned and published, filters, drill-down, assistant search (China / May 2026) applying filters on screen, missing-field answer, action card confirm → category created.

Not verified: the assistant against the live Gemini API (a scripted provider exercised the real tools and stream); browser render time/memory (the embedded pane does not paint while hidden, so DOM metrics were used, not screenshots); screen readers; the E2E suite does not exist; the Studio drag gestures were verified through the pure placement logic (16 unit tests) and the harness page loading, not by pointer-driven E2E.

## 7. Limitations and next steps

* Re-import the workbook with "skip exact duplicates" (5 % weight overstatement today).
* Pending actions are not restored after a page reload (they expire in 10 minutes); the run that proposed them is.
* `Year` and `Month / Year` are one control; the reference showed two.
* The SHARK logo asset was not provided: the information page shows the organization icon (`org_brand`); upload the logo as the organization icon.
* Mutation tools cover categories/subcategories only; permission/assignment administration through the assistant is not implemented.
* PostgreSQL tuning on the VPS (`shared_buffers` 128 MB) and an automated backup job remain open (see `CURRENT_STATE.md`).
