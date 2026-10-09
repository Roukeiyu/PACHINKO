import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  const session = await page.context().newCDPSession(page);
  const count = () => page.locator('#ball-count').textContent().then(Number);
  async function touchStart(selector) {
    const r = await page.locator(selector).boundingBox();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + r.width / 2, y: r.y + r.height / 2 }] });
  }
  await touchStart('.mobile-title'); await page.waitForTimeout(900);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.evaluate(() => getSelection().toString()), '', 'long-pressing interface text cannot select it');
  const protections = await page.evaluate(() => {
    const elements = ['.mobile-title', '#launch-label', '.brand-name', '.theme-name', '#board'];
    return elements.every(selector => {
      const el = document.querySelector(selector);
      return getComputedStyle(el).userSelect === 'none' && !el.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })) && !el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })) && !el.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    });
  });
  assert.ok(protections, 'all interface labels, logos and canvas block selection, drag and callouts');
  console.log('PASS: long presses do not select text; selection, dragging and context-menu events are canceled across the game.');
  await touchStart('#launch');
  assert.ok(await page.evaluate(() => window.__ponpon.charging && window.__ponpon.charge < .1), 'each press starts at zero');
  await page.waitForTimeout(600);
  assert.equal(await count(), 0, 'holding must not fire prematurely');
  assert.ok(await page.evaluate(() => window.__ponpon.charging && window.__ponpon.charge > .83 && window.__ponpon.charge < .95), '600ms reaches about 87% on the two-second exponential curve');
  await page.screenshot({ path: 'test-results/mobile-charging.png', fullPage: true });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  assert.equal(await count(), 1, 'touch release must fire exactly once, not again on synthesized click');
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 0, 'release clears the charge');
  assert.ok(await page.evaluate(() => window.__ponpon.positions.some(p => p.power > .83 && p.power < .97)), 'the shot uses the same exponential curve as the display');
  assert.equal(await page.evaluate(() => getSelection().toString()), '');
  await page.waitForFunction(() => window.__ponpon.stats.entered === 1);
  assert.ok(await page.evaluate(() => window.__ponpon.canonNotes > 0 && window.__ponpon.canonNotes === window.__ponpon.stats.impacts));
  console.log('PASS: mobile hold charges without firing; release launches once through the physical lane.');

  await touchStart('#plunger');
  assert.ok(await page.evaluate(() => window.__ponpon.charge < .1), 'the spring also starts a fresh charge from zero');
  await page.waitForTimeout(200);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.__ponpon.charging), false);
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 0, 'canceling clears the charge');
  assert.equal(await count(), 1, 'an interrupted gesture must cancel, not launch');
  await page.locator('#plunger').tap(); await page.waitForTimeout(400);
  assert.equal(await count(), 2, 'the right-hand spring is a working touch target');
  await page.waitForTimeout(600);
  await page.locator('#launch').focus();
  await page.keyboard.down('Space');
  assert.ok(await page.evaluate(() => window.__ponpon.charge < .1), 'keyboard charging starts from zero');
  await page.waitForTimeout(2050);
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 1, 'holding through 99.9% snaps to full charge');
  assert.match(await page.locator('#launch-label').textContent(), /100%/);
  assert.equal(await count(), 2);
  await page.keyboard.up('Space'); await page.waitForTimeout(400);
  assert.equal(await count(), 3, 'keyboard release fires exactly once even when launch button has focus');
  assert.ok(await page.evaluate(() => window.__ponpon.positions.some(p => p.power === 1)), 'a full-charge release actually uses 100% power');
  console.log('PASS: canceled gestures, right-hand spring tapping and keyboard charge/release.');

  await page.locator('#settings-button').tap();
  const before = await page.evaluate(() => window.__ponpon.positions);
  const starBefore = await page.evaluate(() => window.__ponpon.star);
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => window.__ponpon.positions), before, 'settings must pause physical motion');
  assert.deepEqual(await page.evaluate(() => window.__ponpon.star), starBefore, 'settings also pause star respawning');
  await page.locator('[data-slots="9"]').tap(); await page.locator('.theme-choice[data-theme="dessert"]').tap();
  await page.screenshot({ path: 'test-results/mobile-settings.png', fullPage: true });
  await page.locator('#done-settings').tap();
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 9);
  assert.equal(await page.evaluate(() => window.__ponpon.theme), 'dessert');
  for (const [width, height] of [[320,568], [390,664], [390,844], [430,932], [844,390]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => { const r = document.querySelector('#launch').getBoundingClientRect(); const c = document.querySelector('canvas').getBoundingClientRect(); return { pageHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth, launchBottom: r.bottom, launchHeight: r.height, viewport: innerHeight, ratio: c.width / c.height }; });
    assert.ok(layout.pageHeight <= layout.viewport + 1, `${width}×${height}: the full mobile game fits without vertical scrolling`);
    assert.equal(layout.overflow, false, `${width}×${height}: no horizontal overflow`);
    assert.ok(layout.launchBottom <= layout.viewport + 1, `${width}×${height}: launch control must be visible without scrolling (${JSON.stringify(layout)})`);
    assert.ok(layout.launchHeight >= 44, 'touch targets at least 44px high');
    assert.ok(Math.abs(layout.ratio - 760 / 900) < .002, 'orientation changes preserve physics aspect ratio');
    await page.screenshot({ path: `test-results/h5-${width}x${height}.png`, fullPage: true });
  }
  await page.locator('#compact-settings').tap();
  assert.equal(await page.locator('#settings').evaluate(el => el.open), true, 'settings remain available in landscape');
  await page.locator('#close-settings').tap();
  await page.locator('#compact-sound').tap();
  assert.equal(await page.locator('#compact-sound').getAttribute('aria-label'), '开启声音');
  assert.deepEqual(errors, []);
  console.log('PASS: settings pause; H5 portrait at 320/390/430px and landscape retain visible controls, aspect ratio and no overflow.');
} finally { await browser.close(); }
