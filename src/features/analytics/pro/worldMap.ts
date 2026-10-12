// World geometry shared by the geographic components: real country polygons (Natural Earth 1:110m through world-atlas) drawn with the
// Natural Earth projection. Built once per page load. Antarctica is left out so the map spends its height on inhabited latitudes.
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import countries110 from 'world-atlas/countries-110m.json';
import { normalizeCountry } from './countryGeo';

export const MAP_W = 1000;

type CountryFeature = { id?: string | number; properties: { name: string }; geometry: Geometry };

// Names in the Natural Earth data that differ from the names customs datasets use (both sides are normalized first).
const POLYGON_ALIASES: Record<string, string> = {
  'SOUTH KOREA': 'KOREA (REPUBLIC OF)', 'VIETNAM': 'VIET NAM', 'TAIWAN': 'TAIWAN, PROVINCE OF CHINA', 'TURKEY': 'TURKIYE',
  'VENEZUELA': 'VENEZUELA (BOLIVARIAN REPUBLIC OF)', 'DOMINICAN REP.': 'DOMINICAN REPUBLIC', 'COTE D\'IVOIRE': 'COTE DIVOIRE', 'CTE D\'IVOIRE': 'COTE DIVOIRE',
  'UNITED STATES OF AMERICA': 'UNITED STATES OF AMERICA', 'RUSSIA': 'RUSSIAN FEDERATION', 'CZECHIA': 'CZECH REPUBLIC', 'BOSNIA AND HERZ.': 'BOSNIA AND HERZEGOVINA',
  'DEM. REP. CONGO': 'CONGO (DEMOCRATIC REPUBLIC OF THE)', 'IRAN': 'IRAN (ISLAMIC REPUBLIC OF)', 'SYRIA': 'SYRIAN ARAB REPUBLIC', 'LAOS': 'LAO PEOPLES DEMOCRATIC REPUBLIC',
  'BOLIVIA': 'BOLIVIA (PLURINATIONAL STATE OF)', 'TANZANIA': 'TANZANIA, UNITED REPUBLIC OF', 'MOLDOVA': 'MOLDOVA (REPUBLIC OF)', 'N. MACEDONIA': 'NORTH MACEDONIA',
};

export const polygonKey = (name: string) => { const key = normalizeCountry(name); return POLYGON_ALIASES[key] ?? key; };

const collection = (() => {
  const topology = countries110 as unknown as Topology;
  const all = feature(topology, topology.objects.countries as never) as unknown as FeatureCollection<Geometry, { name: string }>;
  return { type: 'FeatureCollection' as const, features: all.features.filter((item) => (item as CountryFeature).id !== '010') };
})();

const projection = geoNaturalEarth1().fitWidth(MAP_W, collection);
const [[, top], [, bottom]] = geoPath(projection).bounds(collection);
projection.translate([projection.translate()[0], projection.translate()[1] - top]);
export const MAP_H = Math.ceil(bottom - top);

const pathOf = geoPath(projection);
export const COUNTRY_SHAPES = collection.features.map((item) => ({ key: polygonKey(item.properties.name), name: item.properties.name, d: pathOf(item) ?? '' })).filter((shape) => shape.d);

/** Pixel position of a real coordinate on the map (undefined only for coordinates the projection cannot place). */
export const projectPoint = (lat: number, lon: number): [number, number] => projection([lon, lat]) ?? [0, 0];
