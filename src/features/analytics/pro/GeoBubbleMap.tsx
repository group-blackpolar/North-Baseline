import { WarningCircle } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { analyticsRows, bindingIdOf, useBindingResult, useBindingSource } from './bindingSource';
import { CONTINENT_COLOR, CONTINENT_ORDER, LAT_BOTTOM, locateCountry, MAP_HEIGHT, MAP_WIDTH, normalizeCountry, project, type Continent } from './countryGeo';
import { asNumber, formatValue, localizedText } from './format';

type Props = Record<string, unknown>;
type Ring = number[][];

// The land outline is built once per page load from the bundled 1:110m Natural Earth topology.
let landPathCache: string | null = null;
function landPath(): string {
  if (landPathCache) return landPathCache;
  const topology = land110 as unknown as Topology;
  const collection = feature(topology, topology.objects.land as never) as unknown as { features?: Array<{ geometry: { type: string; coordinates: number[][][][] | number[][][] } }>; geometry?: { type: string; coordinates: number[][][][] | number[][][] } };
  const geometries = collection.features?.map((item) => item.geometry) ?? (collection.geometry ? [collection.geometry] : []);
  const rings: Ring[] = [];
  for (const geometry of geometries) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : (geometry.coordinates as number[][][][]);
    for (const polygon of polygons) for (const ring of polygon) rings.push(ring);
  }
  landPathCache = rings
    .filter((ring) => ring.some(([, lat]) => lat! > LAT_BOTTOM))
    .map((ring) => ring.map(([lon, lat], index) => { const [x, y] = project(lat!, lon!); return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('') + 'Z')
    .join('');
  return landPathCache;
}

type Place = { name: string; value: number; secondary: number | null; x: number; y: number; continent: Continent };

/**
 * Country bubble map. The bound result is already aggregated by country; bubbles sit on a representative point of each
 * country (geographic reference data), sized by the primary measure. Countries without a known location (for example
 * "NOT DECLARED") are listed as unlocated instead of being drawn.
 */
export default function GeoBubbleMap({ props, bindings, locales }: { props: Props; bindings: Record<string, unknown>; locales: string[] }) {
  const { t, locale } = useI18n();
  const source = useBindingSource();
  const data = useBindingResult(bindingIdOf(bindings, 'data'));
  const regionKey = typeof props.regionKey === 'string' ? props.regionKey : '';
  const valueKey = typeof props.valueKey === 'string' ? props.valueKey : '';
  const secondaryKey = typeof props.secondaryKey === 'string' ? props.secondaryKey : null;
  const valueLabel = localizedText(props.valueLabel, locales) || t('map.value');
  const secondaryLabel = localizedText(props.secondaryLabel, locales) || t('map.secondary');
  const title = localizedText(props.title, locales);
  const [hover, setHover] = useState<Place | null>(null);

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

  const percent = (value: number) => formatValue(model && model.grand ? (value / model.grand) * 100 : 0, 'percent', locale, 1);
  const select = (place: Place) => { if (source?.applyFilter && source.canFilter?.(regionKey)) source.applyFilter(regionKey, place.name); };
  const interactive = Boolean(source?.applyFilter && source.canFilter?.(regionKey));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title ? <h3 className="mb-2 font-display text-[0.95rem] font-semibold text-text">{title}</h3> : null}
      {data.status === 'error' ? (
        <div role="alert" className="flex min-h-32 flex-1 items-center justify-center gap-2 text-xs text-error"><WarningCircle className="size-4" aria-hidden="true" />{t('analytics.error')}</div>
      ) : !model ? <Skeleton className="min-h-40 flex-1" /> : model.list.length === 0 ? (
        <p role="status" className="flex min-h-32 flex-1 items-center justify-center text-xs text-text-muted">{t('analytics.empty')}</p>
      ) : (
        <div className={cn('@container flex min-h-0 flex-1 flex-col gap-3', data.refreshing && 'opacity-70 transition-opacity')}>
          <div className="relative min-h-0 min-w-0">
            <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={title || t('map.aria')} className="h-auto w-full">
              <path d={landPath()} fill="var(--color-surface-hover)" stroke="var(--color-border)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              {[...model.list].reverse().map((place) => {
                const radius = 4 + Math.sqrt(place.value / model.max) * 22;
                const active = hover?.name === place.name;
                return (
                  <circle key={place.name} cx={place.x} cy={place.y} r={radius} fill={CONTINENT_COLOR[place.continent]} fillOpacity={active ? 0.85 : 0.55} stroke={CONTINENT_COLOR[place.continent]} strokeWidth={active ? 2 : 1} vectorEffect="non-scaling-stroke"
                    className={cn('transition-[fill-opacity] duration-150', interactive && 'cursor-pointer')} tabIndex={0} role={interactive ? 'button' : 'img'}
                    aria-label={`${place.name}: ${formatValue(place.value, 'number', locale)} ${valueLabel}`}
                    onMouseEnter={() => setHover(place)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(place)} onBlur={() => setHover(null)}
                    onClick={() => select(place)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(place); } }} />
                );
              })}
            </svg>
            {hover ? (
              <div className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs shadow-pop" style={{ left: `${Math.min(78, (hover.x / MAP_WIDTH) * 100)}%`, top: `${Math.max(2, (hover.y / MAP_HEIGHT) * 100 - 6)}%` }}>
                <p className="mb-1 font-medium text-text">{hover.name}</p>
                <p className="flex justify-between gap-3 text-text-secondary"><span>{valueLabel}</span><span className="tabular-nums text-text">{formatValue(hover.value, 'number', locale)}</span></p>
                {hover.secondary !== null ? <p className="flex justify-between gap-3 text-text-secondary"><span>{secondaryLabel}</span><span className="tabular-nums text-text">{formatValue(hover.secondary, 'decimal', locale)}</span></p> : null}
                <p className="flex justify-between gap-3 text-text-secondary"><span>{t('map.share')}</span><span className="tabular-nums text-text">{percent(hover.value)}</span></p>
              </div>
            ) : null}
          </div>
          <ul className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1.5 text-xs @[520px]:grid-cols-3" aria-label={t('map.legend')}>
            {CONTINENT_ORDER.filter((continent) => model.byContinent.has(continent)).sort((a, b) => (model.byContinent.get(b) ?? 0) - (model.byContinent.get(a) ?? 0)).map((continent) => (
              <li key={continent} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: CONTINENT_COLOR[continent] }} />
                <span className="min-w-0 flex-1 truncate text-text-secondary">{t(`map.continent.${continent}` as 'map.continent.asia')}</span>
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
