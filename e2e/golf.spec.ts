import { expect, test, type Page } from '@playwright/test';

async function answerHoleOne(page: Page) {
  const tap = (name: string) => page.getByRole('button', { name, exact: true }).click();
  await page.getByLabel('Yards').fill('410');
  await tap('Next');
  await tap('5 Bogey');
  await tap('Right');
  await page.getByLabel('Yards left').fill('165');
  await tap('Next');
  await page.getByLabel('Approach yards').fill('165');
  await tap('Rough');
  await tap('Next');
  await tap('1');
  await page.getByLabel('Short-game yards').fill('15');
  await tap('Bunker');
  await tap('Next');
  await tap('1');
  await page.getByLabel('First putt').fill('4');
  await tap('Next');
  await tap('None');
}

test('records a round with no course setup, then works offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Improve your golf game' })).toBeVisible();
  await page.getByRole('link', { name: 'Enter a round' }).click();

  await page.getByLabel('Course (optional)').fill('Riverside Nine');
  await page.getByRole('button', { name: '9 holes' }).click();
  await page.getByRole('button', { name: 'Start with hole 1' }).click();
  await answerHoleOne(page);
  await expect(page.getByText('5 R 1 165 / s15 / 4')).toBeVisible();

  // Hole 2 via the optional card-line shortcut.
  await page.getByRole('button', { name: 'Next hole' }).click();
  await page.getByRole('button', { name: 'Par 3', exact: true }).click();
  await page.getByLabel('Yards').fill('165');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Type the card line instead').click();
  await page.getByLabel('Card line').fill('4 3 35');
  await page.getByLabel('Card line').press('Enter');
  await expect(page.getByText('Looks good.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish after 2 holes' }).click();

  await expect(page.getByRole('heading', { name: 'Riverside Nine' })).toBeVisible();
  await expect(page.getByText(/9 \(\+2\)/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Strokes gained by category' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice this first' })).toBeVisible();

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Practice priorities' })).toBeVisible();

  // The service worker precaches the app shell; data lives in IndexedDB.
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Practice priorities' })).toBeVisible();
  await page.getByRole('link', { name: 'Rounds', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Riverside Nine/ })).toBeVisible();
  await context.setOffline(false);
});

test('shows the card guide without signing in', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'How to mark your scorecard' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Example front nine/ })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code linking to the card guide' })).toBeVisible();
});

test('sync API refuses requests without a Google token', async ({ request }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Needs a deployed environment');
  const res = await request.get('/api/sync');
  expect(res.status()).toBe(401);
});
