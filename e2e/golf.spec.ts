import { expect, test, type Page } from '@playwright/test';

async function answerHoleOne(page: Page) {
  const tap = (name: string) => page.getByRole('button', { name, exact: true }).click();
  await page.getByLabel('Yards').fill('410');
  await tap('Next');
  await tap('5 Bogey');
  await tap('Right');
  await page.getByLabel('Approach yards').fill('165');
  await tap('Rough');
  await tap('Next');
  await tap('Missed short');
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
  await expect(page.getByText('5 R 165r Sh 1@15s 1@4')).toBeVisible();

  // Hole 2 via the optional card-line shortcut.
  await page.getByRole('button', { name: 'Next hole' }).click();
  await page.getByRole('button', { name: 'Par 3', exact: true }).click();
  await page.getByLabel('Yards').fill('165');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Type the card line instead').click();
  await page.getByLabel('Card line').fill('4 ✓ 3@35');
  await page.getByLabel('Card line').press('Enter');
  await expect(page.getByText('Looks good.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish after 2 holes' }).click();

  await expect(page.getByRole('heading', { name: 'Riverside Nine' })).toBeVisible();
  await expect(page.getByText(/9 \(\+2\)/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Strokes gained by category' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice this first' })).toBeVisible();

  // The next round at the same course is pre-filled from the first one.
  await page.getByRole('link', { name: 'New round' }).click();
  await page.getByLabel('Course (optional)').fill('Riverside Nine');
  await page.getByRole('button', { name: 'Start with hole 1' }).click();
  await expect(page.getByRole('button', { name: 'Par 4 · 410 yds' })).toBeVisible();

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Practice priorities' })).toBeVisible();

  // The service worker precaches the app shell; data lives in IndexedDB.
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline · everything still works')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Practice priorities' })).toBeVisible();
  await page.getByRole('link', { name: 'Rounds', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Riverside Nine/ })).toBeVisible();
  await context.setOffline(false);
});

test('prints the card guide', async ({ page }) => {
  await page.goto('/guide');
  await expect(page.getByRole('heading', { name: 'What to mark on your card' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '1st putt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pocket stat sheet' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR code linking to the card guide' })).toBeVisible();
});
