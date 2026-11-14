import { expect, test, type ConsoleMessage } from '@playwright/test';

/**
 * RM-081 smoke against the built bundle served with the production CSP. No backend: the API is unreachable on purpose,
 * so these checks cover what must hold before login (the shell loads, the CSP is respected, the saved theme paints first).
 * The authenticated flows (login, organization switch, published panel, import) need a local CoreCrow and stay a follow-up.
 */
const cspViolations = (messages: ConsoleMessage[]) => messages.filter((m) => /content security policy/i.test(m.text()));

test('the app loads without CSP violations', async ({ page }) => {
  const messages: ConsoleMessage[] = [];
  page.on('console', (message) => messages.push(message));
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(cspViolations(messages).map((m) => m.text())).toEqual([]);
});

test('the saved theme is applied before first paint (BUG-005)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('north-theme-v1', 'midnight'));
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('midnight');
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
});

for (const [name, width, height] of [['1366x768', 1366, 768], ['1920x1080', 1920, 1080], ['390x844', 390, 844]] as const) {
  test(`no horizontal document scroll at ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('density and motion preferences are applied before first paint (UX-01b)', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('north-density-v1', 'comfortable'); localStorage.setItem('north-motion-v1', 'reduced'); localStorage.setItem('north-theme-v1', 'system'); });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.density)).toBe('comfortable');
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});

test('auto density is compact on a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.density)).toBe('compact');
});
