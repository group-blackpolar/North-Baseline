# NORTH design system (living reference)

Plan and rationale: `GBP/docs/tasks/TASK_NORTH_DESIGN_SYSTEM.md`. Gallery: `dev/playground.html` (dev server, never bundled). Real-app harness: `dev/harness.html`.

## Tokens (`src/index.css`)
Surfaces L0 `background` · L1 `surface` · L2 `.np-card` · L3 `shadow-pop/overlay`. Borders `border` / `border-hover` / `border-selected`.
Radius 6/8/10/14/16, shadows `xs soft pop overlay`, z-index `--z-sticky|navigation|drawer|popover|modal|toast`, motion
`--duration-fast|normal|slow` + `--ease-standard|enter|exit` (mirrored in `src/lib/motion.ts`), `--touch-min` (44px on coarse pointers).
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
| `Icon` | Phosphor wrapper: sizes `xs..2xl`, `regular` for actions, `duotone` for identity only |

## Overlays and the density zoom
Desktop renders the shell with `zoom: 0.7`. Overlays therefore portal into `.north-app-shell` (`portal.ts`), not `<body>`;
verified at 1440 px for Tooltip and Dialog. Any new overlay must use `portalContainer()`.

## Responsive
`useShellMode()` -> `phone <768 | tablet <1024 | compact <1280 | desktop <1680 | wide`; `useIsCompactShell()` = phone or tablet.
