import { WarningCircle } from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { analyticsRows, bindingIdOf, useBindingResult, useBindingSource } from './bindingSource';
import { CONTINENT_COLOR, CONTINENT_ORDER, locateCountry, normalizeCountry, type Continent } from './countryGeo';
import { COUNTRY_SHAPES, MAP_H as MAP_HEIGHT, MAP_W as MAP_WIDTH, polygonKey, projectPoint as project } from './worldMap';
import { asNumber, formatValue, localizedText } from './format';

type Props = Record<string, unknown>;

type Place = { name: string; value: number; secondary: number | null; x: number; y: number; continent: Continent };

/**
 * Country bubble map. The bound result is already aggregated by country; bubbles sit on a representative point of each
 * country (geographic reference data), sized by the primary measure. Countries without a known location (for example
 * "NOT DECLARED") are listed as unlocated instead of being drawn.
 */
export default function GeoBubbleMap({ props, bindings, locales }: { props: Props; bindings: Record<string, unknown>; locales: string[] }) {
  const { t, locale } = useI18n();
  const source = useBindingSource();
  const regionKey = typeof props.regionKey === 'string' ? props.regionKey : '';
  const interactive = Boolean(source?.toggleFilter && source.canFilter?.(regionKey));
  // The map emits selections on its own region field: it keeps showing every country and highlights the selected ones.
  const data = useBindingResult(bindingIdOf(bindings, 'data'), {}, interactive ? { exceptField: regionKey } : {});
  const selected = new Set((source?.selectedValues?.(regionKey) ?? []).map(String));
  const valueKey = typeof props.valueKey === 'string' ? props.valueKey : '';
  const secondaryKey = typeof props.secondaryKey === 'string' ? props.secondaryKey : null;
  const valueLabel = localizedText(props.valueLabel, locales) || t('map.value');
  const secondaryLabel = localizedText(props.secondaryLabel, locales) || t('map.secondary');
  const title = localizedText(props.title, locales);
  const [hover, setHover] = useState<Place | null>(null);
  // Zoom and pan are a different window onto the same projection: nothing is stretched, coordinates are never changed.
  const [view, setView] = useState({ k: 1, cx: MAP_WIDTH / 2, cy: MAP_HEIGHT / 2 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const frame = (() => { const w = MAP_WIDTH / view.k; const h = MAP_HEIGHT / view.k; return { x: Math.max(0, Math.min(MAP_WIDTH - w, view.cx - w / 2)), y: Math.max(0, Math.min(MAP_HEIGHT - h, view.cy - h / 2)), w, h }; })();
  const zoom = (factor: number) => setView((current) => { const k = Math.max(1, Math.min(6, current.k * factor)); return k === 1 ? { k, cx: MAP_WIDTH / 2, cy: MAP_HEIGHT / 2 } : { ...current, k }; });

  const model = useMemo(() => {
    if (!data.response) return null;
    const places = new Map<string, Place & { spellings: Map<string, number> }>();
    let unlocated = 0;
    let grand = 0;
    const unlocatedNames: string[] = [];
    for (const row of analyticsRows(data.response)) {
      const name = typeof row[regionKey] === 'string' ? row[regionKey] as string : null;
      const value = asNumber(row[valueKey]);
      if (!name || value === null) continue;
      grand += value;
      const located = locateCountry(name);
      if (!located) { unlocated += value; unlocatedNames.push(name); continue; }
      const key = normalizeCountry(name);
      const secondary = secondaryKey ? asNumber(row[secondaryKey]) : null;
      const [x, y] = project(located.lat, located.lon);
      const existing = places.get(key);
      // The same country can appear under two spellings (encoding variants): merge, keep the dominant spelling for filtering.
      if (existing) { existing.value += value; existing.secondary = existing.secondary === null && secondary === null ? null : (existing.secondary ?? 0) + (secondary ?? 0); existing.spellings.set(name, (existing.spellings.get(name) ?? 0) + value); }
      else places.set(key, { name, value, secondary, x, y, continent: located.continent, spellings: new Map([[name, value]]) });
    }
    const list = [...places.values()].map((place) => ({ ...place, name: [...place.spellings.entries()].sort((a, b) => b[1] - a[1])[0]![0] })).sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...list.map((place) => place.value));
    const byContinent = new Map<Continent, number>();
    for (const place of list) byContinent.set(place.continent, (byContinent.get(place.continent) ?? 0) + place.value);
    return { list, max, grand, unlocated, unlocatedNames, byContinent };
  }, [data.response, regionKey, secondaryKey, valueKey]);

  const byShape = useMemo(() => new Map((model?.list ?? []).map((place) => [polygonKey(place.name), place])), [model]);
  const percent = (value: number) => formatValue(model && model.grand ? (value / model.grand) * 100 : 0, 'percent', locale, 1);
  const select = (place: Place) => { if (interactive) source!.toggleFilter!(regionKey, place.name); };
  const isSelected = (place: Place) => selected.has(place.name);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title ? <h3 className="mb-2 font-display text-[0.95rem] font-semibold text-text">{title}</h3> : null}
      {data.status === 'error' ? (
        <div role="alert" className="flex min-h-32 flex-1 items-center justify-center gap-2 text-xs text-error"><WarningCircle className="size-4" aria-hidden="true" />{t('analytics.error')}</div>
      ) : !model ? <Skeleton className="min-h-40 flex-1" /> : model.list.length === 0 ? (
        <p role="status" className="flex min-h-32 flex-1 items-center justify-center text-xs text-text-muted">{t('analytics.empty')}</p>
      ) : (
        <div className={cn('@container flex min-h-0 flex-1 flex-col', data.refreshing && 'opacity-70 transition-opacity')}>
          <div className="relative min-h-0 min-w-0 flex-1">
            <svg viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} role="img" aria-label={title || t('map.aria')} className={cn('h-full max-h-full w-full touch-none', view.k > 1 && 'cursor-grab active:cursor-grabbing')} preserveAspectRatio="xMidYMid meet"
              onPointerDown={(event) => { if (view.k > 1) { drag.current = { x: event.clientX, y: event.clientY, cx: frame.x + frame.w / 2, cy: frame.y + frame.h / 2 }; } }}
              onPointerMove={(event) => { const start = drag.current; if (!start) return; const rect = event.currentTarget.getBoundingClientRect(); const unit = frame.w / Math.max(1, rect.width); setView((current) => ({ ...current, cx: start.cx - (event.clientX - start.x) * unit, cy: start.cy - (event.clientY - start.y) * unit })); }}
              onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
              {COUNTRY_SHAPES.map((shape) => {
                const place = byShape.get(shape.key);
                const chosen = Boolean(place && isSelected(place));
                return (
                  <path key={shape.name} d={shape.d} vectorEffect="non-scaling-stroke" strokeWidth={chosen ? 1.2 : 0.5}
                    fill={chosen ? 'color-mix(in srgb, var(--color-accent) 28%, var(--color-surface))' : place ? 'color-mix(in srgb, var(--color-text-muted) 30%, var(--color-surface))' : 'color-mix(in srgb, var(--color-text-muted) 16%, var(--color-surface))'}
                    stroke={chosen ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text-muted) 40%, var(--color-surface))'}
                    className={cn(place && interactive && 'cursor-pointer transition-[fill] duration-150 hover:[fill:color-mix(in_srgb,var(--color-accent)_18%,var(--color-surface))]')}
                    onMouseEnter={place ? () => setHover(place) : undefined} onMouseLeave={place ? () => setHover(null) : undefined} onClick={place ? () => select(place) : undefined}>
                    <title>{shape.name}</title>
                  </path>
                );
              })}
              {[...model.list].reverse().map((place) => {
                const radius = 4 + Math.sqrt(place.value / model.max) * 22;
                const active = hover?.name === place.name;
                const chosen = isSelected(place);
                const dimmed = selected.size > 0 && !chosen;
                return (
                  <circle key={place.name} cx={place.x} cy={place.y} r={radius} fill={CONTINENT_COLOR[place.continent]} fillOpacity={chosen ? 0.9 : dimmed ? 0.18 : active ? 0.85 : 0.55} stroke={chosen ? 'var(--color-text)' : CONTINENT_COLOR[place.continent]} strokeWidth={chosen ? 2.5 : active ? 2 : 1} vectorEffect="non-scaling-stroke"
                    className={cn('transition-[fill-opacity] duration-150', interactive && 'cursor-pointer')} tabIndex={0} role={interactive ? 'button' : 'img'} aria-pressed={interactive ? chosen : undefined}
                    aria-label={`${place.name}: ${formatValue(place.value, 'number', locale)} ${valueLabel}`}
                    onMouseEnter={() => setHover(place)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(place)} onBlur={() => setHover(null)}
                    onClick={() => select(place)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(place); } }} />
                );
              })}
            </svg>
            <div className="absolute right-1 top-1 flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-xs">
              <button type="button" aria-label={t('map.zoomIn')} onClick={() => zoom(1.6)} disabled={view.k >= 6} className="grid size-6 place-items-center text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-40">+</button>
              <button type="button" aria-label={t('map.zoomOut')} onClick={() => zoom(1 / 1.6)} disabled={view.k <= 1} className="grid size-6 place-items-center border-t border-border text-sm text-text-secondary hover:bg-surface-hover disabled:opacity-40">−</button>
            </div>
            {hover ? (
              <div className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs shadow-pop" style={{ left: `${Math.max(0, Math.min(78, ((hover.x - frame.x) / frame.w) * 100))}%`, top: `${Math.max(2, Math.min(80, ((hover.y - frame.y) / frame.h) * 100 - 6))}%` }}>
                <p className="mb-1 font-medium text-text">{hover.name}</p>
                <p className="flex justify-between gap-3 text-text-secondary"><span>{valueLabel}</span><span className="tabular-nums text-text">{formatValue(hover.value, 'number', locale)}</span></p>
                {hover.secondary !== null ? <p className="flex justify-between gap-3 text-text-secondary"><span>{secondaryLabel}</span><span className="tabular-nums text-text">{formatValue(hover.secondary, 'decimal', locale)}</span></p> : null}
                <p className="flex justify-between gap-3 text-text-secondary"><span>{t('map.share')}</span><span className="tabular-nums text-text">{percent(hover.value)}</span></p>
              </div>
            ) : null}
          </div>
          <ul className="flex shrink-0 flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[0.66rem] leading-tight" aria-label={t('map.legend')}>
            {CONTINENT_ORDER.filter((continent) => model.byContinent.has(continent)).sort((a, b) => (model.byContinent.get(b) ?? 0) - (model.byContinent.get(a) ?? 0)).map((continent) => (
              <li key={continent} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: CONTINENT_COLOR[continent] }} />
                <span className="truncate text-text-secondary">{t(`map.continent.${continent}` as 'map.continent.asia')}</span>
                <span className="tabular-nums font-medium text-text">{percent(model.byContinent.get(continent) ?? 0)}</span>
              </li>
            ))}
            {model.unlocated > 0 ? <li className="flex items-center gap-2 text-text-muted" title={model.unlocatedNames.join(', ')}><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-dashed border-text-muted" /><span className="min-w-0 flex-1 truncate">{t('map.unlocated')}</span><span className="tabular-nums">{percent(model.unlocated)}</span></li> : null}
          </ul>
        </div>
      )}
    </div>
  );
}
