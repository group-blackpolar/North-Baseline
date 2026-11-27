import assert from 'node:assert/strict';
import test from 'node:test';
import { locateCountry, normalizeCountry, project, MAP_HEIGHT, MAP_WIDTH } from './countryGeo.ts';

test('country names are matched after folding case, accents and listed encoding damage', () => {
  assert.equal(normalizeCountry('Türkiye'), 'TURKIYE');
  assert.equal(normalizeCountry('T�RKIYE'), 'TURKIYE');
  assert.equal(locateCountry('china')?.continent, 'asia');
  assert.equal(locateCountry('KOREA (REPUBLIC OF)')?.continent, 'asia');
  assert.equal(locateCountry('UNITED STATES OF AMERICA')?.continent, 'northAmerica');
});

test('unknown places are never located', () => {
  assert.equal(locateCountry('NOT DECLARED'), null);
  assert.equal(locateCountry(''), null);
});

test('projection maps the globe into the map box', () => {
  assert.deepEqual(project(0, -180).map(Math.round), [0, Math.round((84 / 141) * MAP_HEIGHT)]);
  const [x, y] = project(-90, 180);
  assert.equal(x, MAP_WIDTH);
  assert.equal(y, MAP_HEIGHT, 'latitudes below the clip land on the bottom edge');
});

test('Spanish customs names resolve to the same place as the English ones, and non-countries stay unlocated', () => {
  for (const [es, en] of [['Estados Unidos (Los)', 'UNITED STATES OF AMERICA'], ['ESPA\u00d1A', 'SPAIN'], ['PA\u00cdSES BAJOS (HOLANDA)', 'NETHERLANDS'], ['RUSIA, (LA) FEDERACI\u00d3N DE', 'RUSSIAN FEDERATION'], ['COREA (LA REP\u00daBLICA DE)', 'KOREA (REPUBLIC OF)'], ['TAIW\u00c1N (PROVINCIA DE CHINA)', 'TAIWAN']] as const) {
    assert.ok(locateCountry(en), en);
    assert.deepEqual(locateCountry(es), locateCountry(en), es);
  }
  assert.equal(locateCountry('ZONA LIBRE DE COLON'), null);
  assert.equal(locateCountry('NO DISPONIBLE'), null);
});
