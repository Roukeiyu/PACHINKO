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
  await page.waitForFunction(() => window.__ponpon?.pins === 28);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.locator('#launch').hover();
  await page.mouse.down(); await page.waitForTimeout(1100); await page.mouse.up();
  await page.waitForFunction(() => window.__ponpon.positions.some(p => p.x > 680 && p.y < 650));
  await page.waitForFunction(() => window.__ponpon.stats.entered > 0);
  assert.equal(await page.locator('#ball-count').textContent(), '1');
  assert.equal(await page.evaluate(() => window.__ponpon.audioState), 'running');
  await page.locator('#auto').click();
  await page.waitForFunction(() => window.__ponpon.score > 0, null, { timeout: 30000 });
  await page.locator('#auto').click();
  console.log('PASS: ball launches from lower right, exits the lane, lands and awards points; audio is unlocked.');
  await page.locator('#auto').click();
  await page.locator('#power').focus(); await page.keyboard.press('Home');
  assert.equal(await page.locator('#power-value').textContent(), '1%');
  let weakShots = 0;
  const returnsBefore = await page.evaluate(() => window.__ponpon.stats.returns);
  for (let i = 0; i < 45; i++) {
    const weak = await page.evaluate(() => window.__ponpon.positions.filter(p => p.power === .01));
    weakShots += weak.length;
    assert.ok(weak.every(p => p.y > 784 && !p.entered), '1% in the actual UI cannot fly up the lane');
    await page.waitForTimeout(60);
  }
  assert.ok(weakShots > 0, 'automatic mode really launched at 1%');
  assert.ok(await page.evaluate(before => window.__ponpon.stats.returns > before, returnsBefore), 'weak automatic shots return');
  await page.keyboard.press('End'); await page.locator('#auto').click();
  console.log('PASS: the 1% automatic slider produces only a tiny hop and natural return.');
  for (const slots of [5, 9, 7]) {
    await page.locator('#settings-button').click();
    await page.locator(`[data-slots="${slots}"]`).click();
    await page.locator('#done-settings').click();
    const before = await page.evaluate(() => window.__ponpon.score);
    await page.locator('#auto').click();
    await page.waitForFunction(previous => window.__ponpon.score > previous, before, { timeout: 30000 });
    await page.locator('#auto').click();
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
  await page.locator('body').click({position:{x:1,y:1}});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.locator('#auto').click();
  await page.waitForFunction(() => window.__ponpon.score > 0, null, { timeout: 30000 });
  await page.locator('#auto').click();
  console.log('PASS: mobile layout has no horizontal overflow and gameplay works.');
  assert.deepEqual(errors, []);
  console.log('PASS: no browser runtime errors.');
} finally {
  await browser.close();
}
