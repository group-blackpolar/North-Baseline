// Reference geography for country-level maps: one representative point and continent per country name as it appears in
// customs/maritime datasets (English short names). This is geographic reference data, not result data; names that are
// not in the table (e.g. "NOT DECLARED") are reported as unlocated instead of being placed anywhere.
export type Continent = 'asia' | 'northAmerica' | 'southAmerica' | 'europe' | 'africa' | 'oceania';
export type CountryPoint = { lat: number; lon: number; continent: Continent };

const AS = 'asia', NA = 'northAmerica', SA = 'southAmerica', EU = 'europe', AF = 'africa', OC = 'oceania';
const point = (lat: number, lon: number, continent: Continent): CountryPoint => ({ lat, lon, continent });

const TABLE: Record<string, CountryPoint> = {
  'ARGENTINA': point(-34, -64, SA), 'ARUBA': point(12.5, -70, NA), 'AUSTRALIA': point(-25, 134, OC), 'AUSTRIA': point(47.5, 14.5, EU),
  'BAHAMAS': point(25, -77.4, NA), 'BANGLADESH': point(23.7, 90.3, AS), 'BARBADOS': point(13.2, -59.5, NA), 'BELGIUM': point(50.6, 4.7, EU),
  'BRAZIL': point(-10, -52, SA), 'BULGARIA': point(42.7, 25.5, EU), 'CAMBODIA': point(12.6, 104.9, AS), 'CANADA': point(56, -96, NA),
  'CHILE': point(-33, -71, SA), 'CHINA': point(35, 103, AS), 'COLOMBIA': point(4.5, -73, SA), 'COSTA RICA': point(9.9, -84, NA),
  'COTE DIVOIRE': point(7.5, -5.5, AF), 'CROATIA': point(45.1, 15.2, EU), 'CUBA': point(21.5, -79.5, NA), 'CURACAO': point(12.2, -69, NA),
  'CYPRUS': point(35, 33, EU), 'DENMARK': point(56, 10, EU), 'DJIBOUTI': point(11.8, 42.6, AF), 'DOMINICAN REPUBLIC': point(19, -70.5, NA),
  'ECUADOR': point(-1.5, -78, SA), 'EGYPT': point(26.5, 30, AF), 'EL SALVADOR': point(13.7, -88.9, NA), 'ESTONIA': point(58.7, 25.5, EU),
  'FINLAND': point(64, 26, EU), 'FRANCE': point(46.5, 2.5, EU), 'GERMANY': point(51, 10, EU), 'GHANA': point(7.9, -1, AF),
  'GREECE': point(39, 22, EU), 'GUATEMALA': point(15.5, -90.3, NA), 'GUYANA': point(5, -59, SA), 'HONDURAS': point(14.8, -86.6, NA),
  'HONG KONG': point(22.3, 114.2, AS), 'HUNGARY': point(47, 19.5, EU), 'INDIA': point(21, 78, AS), 'INDONESIA': point(-2, 118, AS),
  'IRELAND': point(53, -8, EU), 'ISRAEL': point(31.4, 35, AS), 'ITALY': point(42.8, 12.5, EU), 'JAMAICA': point(18.1, -77.3, NA),
  'JAPAN': point(36, 138, AS), 'JORDAN': point(31, 36.5, AS), 'KOREA (REPUBLIC OF)': point(36.5, 127.8, AS), 'LATVIA': point(56.9, 24.9, EU),
  'LEBANON': point(33.9, 35.9, AS), 'LITHUANIA': point(55.3, 23.9, EU), 'MALAYSIA': point(4, 109.5, AS), 'MEXICO': point(23.6, -102.5, NA),
  'MOROCCO': point(31.8, -7, AF), 'MYANMAR': point(21.5, 96, AS), 'NETHERLANDS': point(52.2, 5.5, EU), 'NETHERLANDS ANTILLES': point(12.2, -69, NA),
  'NEW ZEALAND': point(-41, 174, OC), 'NICARAGUA': point(12.9, -85, NA), 'NORWAY': point(61, 9, EU), 'OMAN': point(21, 57, AS),
  'PAKISTAN': point(30, 70, AS), 'PANAMA': point(8.5, -80.1, NA), 'PARAGUAY': point(-23.4, -58.4, SA), 'PERU': point(-9.2, -75, SA),
  'PHILIPPINES': point(12.8, 122, AS), 'POLAND': point(52, 19, EU), 'PORTUGAL': point(39.6, -8, EU), 'PUERTO RICO': point(18.2, -66.5, NA),
  'QATAR': point(25.3, 51.2, AS), 'ROMANIA': point(45.9, 25, EU), 'SAINT KITTS AND NEVIS': point(17.3, -62.7, NA), 'SAUDI ARABIA': point(24, 45, AS),
  'SINGAPORE': point(1.35, 103.8, AS), 'SLOVAKIA': point(48.7, 19.7, EU), 'SLOVENIA': point(46.1, 14.8, EU), 'SOUTH AFRICA': point(-29, 24, AF),
  'SPAIN': point(40, -3.7, EU), 'SRI LANKA': point(7.8, 80.7, AS), 'SURINAME': point(4, -56, SA), 'SWEDEN': point(62, 15, EU),
  'TAIWAN, PROVINCE OF CHINA': point(23.7, 121, AS), 'TAIWAN': point(23.7, 121, AS), 'THAILAND': point(15, 101, AS), 'TRINIDAD AND TOBAGO': point(10.5, -61.3, NA),
  'TUNISIA': point(34, 9, AF), 'TURKIYE': point(39, 35, AS), 'TURKEY': point(39, 35, AS), 'TURKS AND CAICOS ISLANDS': point(21.7, -71.8, NA),
  'UKRAINE': point(49, 31.5, EU), 'UNITED ARAB EMIRATES': point(24, 54, AS), 'UNITED KINGDOM': point(54, -2, EU),
  'UNITED STATES OF AMERICA': point(39.8, -98.6, NA), 'UNITED STATES': point(39.8, -98.6, NA), 'URUGUAY': point(-33, -56, SA),
  'VENEZUELA (BOLIVARIAN REPUBLIC OF)': point(7, -66, SA), 'VIET NAM': point(16, 106, AS), 'VIETNAM': point(16, 106, AS),
};

// Encoding damage seen in source files ("T�RKIYE"): only listed, verified aliases are repaired.
const ALIASES: Record<string, string> = { 'TRKIYE': 'TURKIYE' };

export function normalizeCountry(name: string): string {
  const folded = name.normalize('NFD').replace(/\p{M}+/gu, '').toUpperCase().replace(/[^A-Z0-9 (),.-]/g, '').replace(/\s+/g, ' ').trim();
  return ALIASES[folded] ?? folded;
}

export const locateCountry = (name: string): CountryPoint | null => TABLE[normalizeCountry(name)] ?? null;

export const CONTINENT_ORDER: Continent[] = ['asia', 'northAmerica', 'southAmerica', 'europe', 'africa', 'oceania'];
export const CONTINENT_COLOR: Record<Continent, string> = { asia: '#2F6FED', northAmerica: '#EC4F8B', southAmerica: '#F5B83D', europe: '#8B5CF6', africa: '#22A06B', oceania: '#27B6D6' };

// Equirectangular projection clipped to the latitudes that contain land, so the map fills its box.
export const MAP_WIDTH = 1000;
export const LAT_TOP = 84;
export const LAT_BOTTOM = -57;
export const MAP_HEIGHT = Math.round((MAP_WIDTH * (LAT_TOP - LAT_BOTTOM)) / 360);
export const project = (lat: number, lon: number): [number, number] => [((lon + 180) / 360) * MAP_WIDTH, ((LAT_TOP - Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat))) / (LAT_TOP - LAT_BOTTOM)) * MAP_HEIGHT];
