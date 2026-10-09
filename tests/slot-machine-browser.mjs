import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1180 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const outcomes = [0,0,1,4,4,4];
    window.__testSlotRandom = () => (outcomes.shift() + .5) / 5;
    const original = CanvasRenderingContext2D.prototype.fillText, clear = CanvasRenderingContext2D.prototype.clearRect;
    window.__canvasLabels = [];
    CanvasRenderingContext2D.prototype.clearRect = function(...args) { window.__canvasLabels = []; return clear.apply(this, args); };
    CanvasRenderingContext2D.prototype.fillText = function(value, ...args) { window.__canvasLabels.push(String(value)); return original.call(this, value, ...args); };
  });
  // Test-only access to the real game's launcher and Matter bodies. Every entry
  // still follows the production physics, score callback and UI update path.
  await page.route('**/src/physics.js', async route => {
    const response = await route.fetch(); let body = await response.text();
    assert.ok(body.includes('slotRandom = Math.random') && body.includes('return { engine, balls'));
    body = body.replace('slotRandom = Math.random', 'slotRandom = () => window.__testSlotRandom()');
    body = body.replace('return { engine, balls', `window.__slotFixture = {
      enter(count, withStar = false) {
        for (let i = 0; i < count; i++) {
          const ball = launch(); ball.entered = true;
          if (withStar) { Body.setPosition(ball.body, {x: activeStar.x, y: activeStar.y}); Body.setVelocity(ball.body, {x:0,y:0}); step(); }
          Body.setPosition(ball.body, {x:347,y:TABLE.scoreLine-1}); Body.setVelocity(ball.body, {x:0,y:6}); step();
        }
      }, advanceTo(deadline) { while (clock + 1e-6 < deadline) step(Math.min(STEP, deadline - clock)); }
    }; return { engine, balls`);
    await route.fulfill({ response, body });
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__slotFixture);
  await page.evaluate(() => window.__slotFixture.enter(49));
  assert.equal(await page.evaluate(() => window.__ponpon.slotMachine.progress), 49);
  assert.equal(await page.evaluate(() => window.__ponpon.slotMachine.spins), 0);
  await page.evaluate(() => window.__slotFixture.enter(1));
  assert.match(await page.locator('#slot-status').textContent(), /正在转动/);
  await page.screenshot({ path: 'test-results/slot-machine-spinning.png', fullPage: true });
  await page.waitForFunction(() => window.__ponpon.slotMachine.completed === 1);
  await page.waitForFunction(() => document.querySelector('#machine-caption').textContent.includes('×2'));
  assert.equal(await page.locator('#hole-points').textContent(), '+1000');
  await page.waitForFunction(() => window.__canvasLabels.includes('×20') && window.__canvasLabels.includes('+1000'));
  await page.screenshot({ path: 'test-results/slot-machine-x2.png', fullPage: true });
  await page.evaluate(() => window.__slotFixture.enter(50));
  await page.waitForFunction(() => window.__ponpon.slotMachine.completed === 2);
  await page.waitForFunction(() => document.querySelector('#machine-caption').textContent.includes('×5'));
  assert.equal(await page.locator('#hole-points').textContent(), '+2500');
  await page.waitForFunction(() => window.__canvasLabels.includes('×50') && window.__canvasLabels.includes('+2500'));
  assert.match(await page.locator('#slot-status').textContent(), /持续 1 分钟/);
  const before = await page.evaluate(() => window.__ponpon.score);
  await page.evaluate(() => window.__slotFixture.enter(1, true));
  assert.equal(await page.evaluate(() => window.__ponpon.score), before + 1000, 'actual score UI includes a collected x2 star and global x5');
  await page.locator('#settings-button').click();
  const paused = await page.evaluate(() => ({ state: window.__ponpon.slotMachine, clock: window.__ponpon.gameClock }));
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => ({ state: window.__ponpon.slotMachine, clock: window.__ponpon.gameClock })), paused, 'settings pause both reel state and bonus time');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#done-settings').click();
  const hidden = await page.evaluate(() => ({ state: window.__ponpon.slotMachine, clock: window.__ponpon.gameClock }));
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => ({ state: window.__ponpon.slotMachine, clock: window.__ponpon.gameClock })), hidden, 'background visibility freezes the countdown too');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#settings-button').click();
  await page.locator('[data-slots="9"]').click(); await page.locator('[data-theme="flower"]').click(); await page.locator('#calm').check(); await page.locator('#done-settings').click();
  assert.equal(await page.evaluate(() => window.__ponpon.slotMachine.entries), 101);
  assert.equal(await page.evaluate(() => window.__ponpon.slotMachine.multiplier), 5);
  await page.screenshot({ path: 'test-results/slot-machine-x5.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1));
  await page.screenshot({ path: 'test-results/slot-machine-mobile.png', fullPage: true });
  const until = await page.evaluate(() => window.__ponpon.slotMachine.tripleUntil);
  await page.evaluate(time => window.__slotFixture.advanceTo(time), until);
  await page.waitForFunction(() => window.__ponpon.slotMachine.multiplier === 2);
  await page.waitForFunction(() => window.__canvasLabels.includes('×20'));
  assert.equal(await page.locator('#hole-points').textContent(), '+1000');
  const pairUntil = await page.evaluate(() => window.__ponpon.slotMachine.pairUntil);
  await page.evaluate(time => window.__slotFixture.advanceTo(time), pairUntil);
  await page.waitForFunction(() => window.__canvasLabels.includes('×10') && window.__canvasLabels.includes('+500'));
  assert.equal(await page.locator('#hole-points').textContent(), '+500');
  assert.equal(await page.locator('#machine-caption').textContent(), 'THE HAPPY LITTLE PACHINKO');
  assert.deepEqual(errors, []);
  console.log('PASS: real game/UI spins after 50 scores, shows x2/x5 labels and correct points, pauses in settings, retains state through layout/theme settings and restores expired bonuses on desktop/mobile.');
} finally { await browser.close(); }
