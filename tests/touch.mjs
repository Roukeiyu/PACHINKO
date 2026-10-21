import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { CHARGE_DURATION } from '../src/charge.js';
import { START_BALLS } from '../src/round.js';
const almostFull = Math.round(CHARGE_DURATION * .6);
const partialHold = Math.round(CHARGE_DURATION * .28);

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  // Native touch events still drive the real controls; hold time is deterministic
  // even when a software WebGL frame or browser command takes several seconds.
  const epoch = Date.UTC(2026,9,9,12);
  await page.clock.install({time:epoch}); await page.clock.pauseAt(epoch);
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173'); await page.clock.fastForward(50);
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
    const elements = ['.mobile-title', '#launch-label', '.brand-name', '#collection-button', '#board'];
    return elements.every(selector => {
      const el = document.querySelector(selector);
      return getComputedStyle(el).userSelect === 'none' && !el.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true })) && !el.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })) && !el.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    });
  });
  assert.ok(protections, 'all interface labels, logos and canvas block selection, drag and callouts');
  console.log('PASS: long presses do not select text; selection, dragging and context-menu events are canceled across the game.');
  await touchStart('#launch');
  assert.ok(await page.evaluate(() => window.__ponpon.charging && window.__ponpon.charge === 0), 'each press starts at zero');
  await page.clock.fastForward(almostFull);
  assert.equal(await count(), START_BALLS, 'holding must not fire prematurely');
  assert.ok(await page.evaluate(() => window.__ponpon.charging && window.__ponpon.charge > .97 && window.__ponpon.charge < .995), '60% of the charge window is about 98.4% power');
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.clock.runFor(400);
  assert.equal(await count(), START_BALLS - 1, 'touch release must fire exactly once, not again on synthesized click');
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 0, 'release clears the charge');
  assert.ok(await page.evaluate(() => window.__ponpon.positions.some(p => p.power > .97 && p.power < .995)), 'the shot uses the same exponential curve as the display');
  assert.equal(await page.evaluate(() => getSelection().toString()), '');
  await page.clock.runFor(1500);
  assert.equal(await page.evaluate(() => window.__ponpon.stats.entered), 1);
  assert.ok(await page.evaluate(() => window.__ponpon.canonNotes > 0 && window.__ponpon.canonNotes === window.__ponpon.stats.impacts));
  // Capture after release: software WebGL screenshots can take several seconds
  // and would otherwise turn this short hold into the five-ball burst.
  await page.screenshot({ path: 'test-results/mobile-launched.png', fullPage: true });
  console.log('PASS: mobile hold charges without firing; release launches once through the physical lane.');

  await touchStart('#plunger');
  assert.ok(await page.evaluate(() => window.__ponpon.charge === 0), 'the spring also starts a fresh charge from zero');
  await page.clock.fastForward(200);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.__ponpon.charging), false);
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 0, 'canceling clears the charge');
  assert.equal(await count(), START_BALLS - 1, 'an interrupted gesture must cancel, not launch');
  await touchStart('#plunger'); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.clock.runFor(400);
  assert.equal(await count(), START_BALLS - 2, 'the right-hand spring is a working touch target');
  await touchStart('#table-charge');
  assert.equal(await page.evaluate(() => window.__ponpon.charging), true, 'holding the middle of the 2D board charges');
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.__ponpon.charging), false, 'a canceled board hold does not launch');
  assert.equal(await count(), START_BALLS - 2, 'canceling the board hold spends nothing');
  const badgeBox = await page.locator('#double-ball').boundingBox();
  const launchBox = await page.locator('#launch').boundingBox();
  assert.ok(Math.abs(badgeBox.width - badgeBox.height) <= 1 && badgeBox.width >= 40, 'the multiplier control is a round button at least 40px across');
  assert.ok(badgeBox.x < launchBox.x + 24 && badgeBox.y < launchBox.y + 8, 'the badge sits on the launch button’s top-left corner');
  await touchStart('#double-ball');
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.clock.runFor(40);
  assert.equal(await page.evaluate(() => window.__ponpon.charging), false, 'tapping the locked badge does not charge');
  assert.equal(await page.evaluate(() => window.__ponpon.ballCost), 1);
  assert.equal(await count(), START_BALLS - 2, 'the badge tap does not spend a ball');
  await page.evaluate(() => window.__ponpon.setRender3D(true));
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === 'webgl');
  await touchStart('#table-charge');
  assert.equal(await page.evaluate(() => window.__ponpon.charging), true, 'holding the middle of the 3D board charges');
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.evaluate(() => window.__ponpon.charging), false);
  await page.evaluate(() => window.__ponpon.setRender3D(false));
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === '2d');
  await page.clock.runFor(600);
  await page.locator('#launch').focus();
  const beforeHold = await count();
  await page.keyboard.down('Space');
  assert.ok(await page.evaluate(() => window.__ponpon.charge === 0), 'keyboard charging starts from zero');
  await page.clock.fastForward(CHARGE_DURATION);
  assert.equal(await page.evaluate(() => window.__ponpon.charge), 1, 'holding through 99.9% snaps to full charge');
  assert.match(await page.locator('#launch-label').textContent(), /100%/);
  // A ball already in flight can reach the jar or a reel payout while the key is held.
  // Either one adds balls back. The hold itself must not spend another.
  assert.ok(await count() >= beforeHold, 'holding through full charge does not spend a ball');
  const held = await count();
  await page.keyboard.up('Space'); await page.clock.runFor(400);
  assert.equal(await count(), held - 1, 'keyboard release fires exactly once even when launch button has focus');
  assert.ok(await page.evaluate(() => window.__ponpon.positions.some(p => p.power === 1)), 'a full-charge release actually uses 100% power');
  await page.locator('#launch').focus();
  const beforeEnter = await count();
  await page.keyboard.down('Enter');
  assert.equal(await page.evaluate(() => window.__ponpon.charging), true, 'Enter starts a charge instead of a zero-power click');
  assert.equal(await count(), beforeEnter, 'Enter keydown must not fire immediately');
  await page.clock.fastForward(partialHold);
  const beforeEnterRelease = await count();
  await page.keyboard.up('Enter');
  const enterPower = await page.evaluate(() => window.__ponpon.positions.at(-1).power);
  await page.evaluate(() => document.querySelector('#launch').click());
  await page.clock.runFor(400);
  assert.equal(await count(), beforeEnterRelease - 1, 'Enter release fires once and the synthetic click does not repeat it');
  assert.ok(enterPower > .5 && enterPower < 1, 'the Enter shot keeps the held power');
  console.log('PASS: canceled gestures, right-hand spring tapping and keyboard charge/release.');

  await page.clock.resume();
  await page.locator('#settings-button').tap();
  const before = await page.evaluate(() => window.__ponpon.positions);
  const starBefore = await page.evaluate(() => window.__ponpon.star);
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => window.__ponpon.positions), before, 'settings must pause physical motion');
  assert.deepEqual(await page.evaluate(() => window.__ponpon.star), starBefore, 'settings also pause star respawning');
  assert.equal(await page.locator('[data-slots]').count(), 0);
  await page.screenshot({ path: 'test-results/mobile-settings.png', fullPage: true });
  await page.locator('#done-settings').tap();
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 5);
  assert.equal(await page.locator('[data-theme]').count(), 0);
  for (const [width, height] of [[320,568], [390,664], [390,844], [430,932], [844,390]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => { const r = document.querySelector('#launch').getBoundingClientRect(); const c = document.querySelector('canvas').getBoundingClientRect(); return { pageHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth, launchBottom: r.bottom, launchHeight: r.height, viewport: innerHeight, ratio: c.width / c.height }; });
    assert.ok(layout.pageHeight <= layout.viewport + 1, `${width}×${height}: the full mobile game fits without vertical scrolling`);
    assert.equal(layout.overflow, false, `${width}×${height}: no horizontal overflow`);
    assert.ok(layout.launchBottom <= layout.viewport + 1, `${width}×${height}: launch control must be visible without scrolling (${JSON.stringify(layout)})`);
    assert.ok(layout.launchHeight >= 44, 'touch targets at least 44px high');
    assert.ok(Math.abs(layout.ratio - 760 / 900) < .002, 'orientation changes preserve physics aspect ratio');
    assert.equal(await page.locator('.hud-best').evaluate(el => getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0), true, `${width}×${height}: best score is visible on the phone HUD`);
    assert.equal(await page.locator('#mobile-best').textContent(), await page.locator('#best').textContent());
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
