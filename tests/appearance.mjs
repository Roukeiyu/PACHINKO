import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const url = process.env.TEST_URL || 'http://127.0.0.1:5173';
await mkdir('test-results', { recursive: true });
const references = new Map();
for (const autoDark of [false, true]) {
  const browser = await chromium.launch({ executablePath, args: [
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ...(autoDark ? ['--force-dark-mode', '--enable-features=WebContentsForceDark'] : []),
  ] });
  try {
    for (const mobile of [false, true]) for (const colorScheme of (autoDark ? ['dark'] : ['light', 'dark'])) {
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1180 }, colorScheme, isMobile: mobile, hasTouch: mobile });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => document.querySelector('#launch-label')?.textContent.includes('松开发射'));
      const key = `${mobile ? 'mobile' : 'desktop'}-${colorScheme}`;
      // Sample solid painted areas so the test catches real auto-dark recoloring
      // without depending on font antialiasing or translucent border compositing.
      const machine = await page.locator('.machine').boundingBox();
      const launch = await page.locator('#launch').boundingBox();
      const clips = [{ x: 0, y: 0 }, { x: machine.x + 4, y: machine.y + 45 }, { x: launch.x + 20, y: launch.y + 20 }];
      const samples = [];
      for (const clip of clips) samples.push(await page.screenshot({ clip: { ...clip, width: 4, height: 4 } }));
      if (autoDark) assert.ok(samples.every((sample, i) => sample.equals(references.get(key)[i])), `${key}: auto-dark must preserve page, machine and launch colors`);
      else references.set(key, samples);
      await page.screenshot({ path: `test-results/appearance-${key}-${autoDark ? 'forced' : 'normal'}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // Freeze the simulation with a non-modal, invisible settings dialog so we
      // can compare the board with/without its transparent spring hit target.
      await page.evaluate(() => { const dialog = document.querySelector('#settings'); dialog.show(); dialog.style.visibility = 'hidden'; });
      await page.waitForTimeout(50);
      const board = await page.locator('.board-wrap').screenshot();
      await page.locator('#plunger').evaluate(el => { el.style.visibility = 'hidden'; });
      assert.ok((await page.locator('.board-wrap').screenshot()).equals(board), `${key}: spring hit target must not paint over the board`);
      await page.evaluate(() => { document.querySelector('#plunger').style.visibility = ''; const dialog = document.querySelector('#settings'); dialog.close(); dialog.style.visibility = ''; });
      await page.locator('#plunger').hover();
      await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
      await page.waitForFunction(() => Number(document.querySelector('#ball-count').textContent) === 1);
      assert.deepEqual(errors, []);
      console.log(`PASS: ${key}, auto-dark=${autoDark}: palette, transparent spring, layout and launch.`);
      await page.close();
    }
  } finally { await browser.close(); }
}
// High-contrast colors remain available for interface text and focus rings;
// only the invisible canvas hit target opts out of color substitution.
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1180 }, colorScheme: 'dark', forcedColors: 'active' });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#launch-label')?.textContent.includes('松开发射'));
  await page.evaluate(() => { const dialog = document.querySelector('#settings'); dialog.show(); dialog.style.visibility = 'hidden'; });
  await page.waitForTimeout(50);
  const board = await page.locator('.board-wrap').screenshot();
  await page.locator('#plunger').evaluate(el => { el.style.visibility = 'hidden'; });
  assert.ok((await page.locator('.board-wrap').screenshot()).equals(board), 'high contrast must not obscure the spring');
  console.log('PASS: high-contrast mode keeps the canvas hit target invisible.');
} finally { await browser.close(); }
