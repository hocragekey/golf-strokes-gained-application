import { expect, test, type Page } from '@playwright/test';

async function addNineHoleCourse(page: Page, name: string) {
  await page.getByRole('link', { name: 'Courses' }).click();
  await page.getByRole('button', { name: 'Add course' }).click();
  await page.getByLabel('Course name').fill(name);
  await page.getByLabel('Holes').selectOption('9');
  await page.getByLabel('Hole 2 par').selectOption('3');
  await page.getByLabel('Hole 2 yards').fill('165');
  await page.getByRole('button', { name: 'Add course' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function enterTwoHoles(page: Page) {
  await page.getByRole('link', { name: 'Enter round' }).first().click();
  await page.getByLabel('Hole 1 score').fill('5');
  await page.getByLabel('Hole 1 teeResult').selectOption('right');
  await page.getByLabel('Hole 1 approachYards').fill('165');
  await page.getByLabel('Hole 1 approachLie').selectOption('rough');
  await page.getByLabel('Hole 1 missDirection').selectOption('short');
  await page.getByLabel('Hole 1 shortGameShots').fill('1');
  await page.getByLabel('Hole 1 shortGameYards').fill('15');
  await page.getByLabel('Hole 1 shortGameLie').selectOption('sand');
  await page.getByLabel('Hole 1 firstPuttFeet').fill('4');
  await page.getByLabel('Hole 1 putts').fill('1');

  await page.getByLabel('Hole 2 score').fill('4');
  await page.getByLabel('Hole 2 gir').check();
  await page.getByLabel('Hole 2 firstPuttFeet').fill('35');
  await page.getByLabel('Hole 2 putts').fill('3');
  await page.getByRole('button', { name: 'Calculate strokes gained' }).click();
}

test('records a round and shows strokes gained, then works offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await addNineHoleCourse(page, 'Riverside Nine');

  await page.getByRole('link', { name: 'Enter round' }).first().click();
  await page.getByLabel('Hole 1 score').fill('4');
  await page.getByRole('button', { name: 'Calculate strokes gained' }).click();
  await expect(page.getByText('1 hole need attention')).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await enterTwoHoles(page);
  await expect(page.getByRole('heading', { name: 'Riverside Nine' })).toBeVisible();
  await expect(page.getByText(/9 \(\+2\)/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Strokes gained by category' })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
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
});
