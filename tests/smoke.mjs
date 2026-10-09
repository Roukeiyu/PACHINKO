import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, headless: true, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1180 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('test-results', { recursive: true });
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__ponpon?.pins === 95);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.locator('#launch').click();
  await page.waitForFunction(() => window.__ponpon.positions.some(p => p.y > 170));
  assert.equal(await page.locator('#ball-count').textContent(), '1');
  assert.equal(await page.evaluate(() => window.__ponpon.audioState), 'running');
  await page.waitForFunction(() => window.__ponpon.score > 0 && window.__ponpon.activeBalls === 0, null, { timeout: 30000 });
  console.log('PASS: real ball travels through pins, lands and awards points; audio is unlocked.');
  for (const slots of [5, 9, 7]) {
    await page.locator('#settings-button').click();
    await page.locator(`[data-slots="${slots}"]`).click();
    await page.locator('#done-settings').click();
    const before = await page.evaluate(() => window.__ponpon.score);
    await page.locator('#launch').click();
    await page.waitForFunction(previous => window.__ponpon.score > previous && window.__ponpon.activeBalls === 0, before, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__ponpon.slots), slots);
    console.log(`PASS: ${slots} slots receive a physical ball and score.`);
  }
  for (const theme of ['dessert', 'flower', 'animal']) {
    await page.locator(`.theme-pill[data-theme="${theme}"]`).click();
    assert.equal(await page.evaluate(() => window.__ponpon.theme), theme);
  }
  await page.locator('#auto').click();
  await page.waitForFunction(() => window.__ponpon.activeBalls >= 3);
  await page.screenshot({ path: 'test-results/playing.png', fullPage: true });
  await page.locator('#auto').click();
  const count = await page.locator('#ball-count').textContent();
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#ball-count').textContent(), count);
  console.log('PASS: all three themes and automatic launch/pause.');
  await page.locator('#settings-button').click();
  await page.locator('[data-slots="9"]').click();
  await page.locator('.theme-choice[data-theme="flower"]').click();
  await page.locator('#calm').check();
  await page.screenshot({ path: 'test-results/settings.png' });
  await page.keyboard.press('Escape');
  await page.locator('#sound-button').click();
  await page.reload();
  await page.waitForFunction(() => window.__ponpon?.slots === 9 && window.__ponpon.theme === 'flower');
  assert.equal(await page.locator('#sound-button').getAttribute('aria-label'), '开启音效');
  assert.ok(Number((await page.locator('#best').textContent()).replaceAll(',', '')) > 0);
  await page.locator('#settings-button').click();
  assert.equal(await page.locator('#calm').isChecked(), true);
  const beforeModal = await page.locator('#ball-count').textContent();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#ball-count').textContent(), beforeModal);
  await page.keyboard.press('Escape');
  console.log('PASS: settings and best score persist; dialog prevents keyboard launching.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.locator('#launch').click();
  await page.waitForFunction(() => window.__ponpon.score > 0, null, { timeout: 30000 });
  console.log('PASS: mobile layout has no horizontal overflow and gameplay works.');
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime errors.');
} finally {
  await browser.close();
}
