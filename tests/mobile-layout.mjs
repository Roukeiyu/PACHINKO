import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { VIEW_DISTANCE, VIEW_LOOK_Y } from '../src/renderer.js';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('ponpon-settings', JSON.stringify({ sound: false, calm: true, vibrate: false, music: false })));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForTimeout(80);
  async function hudHeight() { return page.locator('.mobile-hud').evaluate(el => el.getBoundingClientRect().height); }
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(80);
    const scoreTop = await page.locator('#mobile-score').boundingBox();
    const stateTop = await page.locator('#shot-state').boundingBox();
    assert.ok(scoreTop.y + scoreTop.height <= stateTop.y + 1, `${width}: the total sits on its own top row`);
    assert.equal(await page.locator('.score-card').isVisible(), false, `${width}: the sidebar total stays hidden`);
    const base = await hudHeight();
    for (const text of ['0', '50,000', '999,999', '999,999,999']) {
      await page.locator('#mobile-score').evaluate((el, value) => { el.textContent = value; }, text);
      assert.equal(await hudHeight(), base, `${width}: HUD height stays ${base} at ${text}`);
      const fit = await page.locator('#mobile-score').evaluate(el => ({
        lines: el.getClientRects().length,
        overflow: el.scrollWidth - el.clientWidth,
        numeric: getComputedStyle(el).fontVariantNumeric,
        wrap: getComputedStyle(el).whiteSpace,
      }));
      assert.equal(fit.lines, 1, `${width}: ${text} stays on one line`);
      assert.ok(fit.overflow <= 1, `${width}: ${text} fits the reserved score width`);
      assert.match(fit.numeric, /tabular-nums/);
      assert.match(fit.wrap, /nowrap/);
    }
    const box2d = await page.locator('#board').boundingBox();
    assert.ok(box2d.width >= width * 0.96, `${width}: 2D canvas is nearly full width (${box2d.width})`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: no horizontal overflow`);
    await page.locator('#settings-button').click();
    await page.locator('#three-d').check();
    await page.locator('#done-settings').click();
    await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === 'webgl');
    await page.waitForTimeout(120);
    const fit3d = await page.evaluate(() => {
      const board = document.querySelector('#board').getBoundingClientRect();
      const near = window.__ponpon.rendering.near;
      const frame = window.__ponpon.rendering.frame;
      return { width: board.width, near, frameInside: frame.every(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1), margin: near.minX * board.width };
    });
    assert.ok(fit3d.width >= width * 0.96, `${width}: 3D canvas is nearly full width`);
    assert.ok(fit3d.near.width >= 0.95, `${width}: near edge covers ${fit3d.near.width} of the canvas`);
    assert.ok(fit3d.margin >= 4 && fit3d.margin <= 8, `${width}: side margin is ${fit3d.margin}px`);
    assert.equal(fit3d.frameInside, true, `${width}: the whole table stays inside the canvas`);
    await page.locator('#settings-button').click();
    await page.locator('#three-d').uncheck();
    await page.locator('#done-settings').click();
    await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === '2d');
  }
  async function scorePlaces() {
    return page.evaluate(() => {
      const shown = selector => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      const local = document.querySelector('.hud-score-row').getBoundingClientRect();
      const state = document.querySelector('#shot-state').getBoundingClientRect();
      return { local: shown('.hud-score-row'), card: shown('.score-card'), ownRow: shown('.hud-score-row') && local.bottom <= state.top + 1 };
    });
  }
  for (const viewport of [{ width: 740, height: 800 }, { width: 700, height: 500 }, { width: 1100, height: 420 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(60);
    const places = await scorePlaces();
    assert.equal(places.card, false, `${viewport.width}x${viewport.height}: no sidebar total`);
    assert.equal(places.local, true, `${viewport.width}x${viewport.height}: the board total is shown`);
    assert.equal(places.ownRow, true, `${viewport.width}x${viewport.height}: the board total keeps its own row`);
  }
  await page.setViewportSize({ width: 741, height: 900 });
  await page.waitForTimeout(60);
  const wide = await scorePlaces();
  assert.equal(wide.card, true, 'the sidebar total appears at the same breakpoint as the panel');
  assert.equal(wide.local, false, 'the board total hides once the sidebar shows it');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(80);
  const desktopScore = await scorePlaces();
  assert.equal(desktopScore.card, true);
  assert.equal(desktopScore.local, false, 'desktop shows the total only in the sidebar');
  const desktopPad = await page.locator('.machine').evaluate(el => parseFloat(getComputedStyle(el).paddingLeft));
  assert.ok(desktopPad > 8, 'desktop card padding stays in place');
  await page.locator('#settings-button').click();
  await page.locator('#three-d').check();
  await page.locator('#done-settings').click();
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === 'webgl');
  await page.waitForTimeout(120);
  const desktop = await page.evaluate(() => {
    const board = document.querySelector('#board').getBoundingClientRect();
    const rendering = window.__ponpon.rendering;
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    return { rendering, margin: rendering.near.minX * board.width, sidebar: sidebar.width, aspect: board.width / board.height };
  });
  assert.equal(desktop.rendering.distance, VIEW_DISTANCE);
  assert.equal(desktop.rendering.lookY, VIEW_LOOK_Y);
  assert.ok(desktop.rendering.near.width >= 0.95, `desktop near edge covers ${desktop.rendering.near.width}`);
  assert.ok(desktop.margin >= 4 && desktop.margin <= 8, `desktop side margin is ${desktop.margin}px`);
  assert.ok(desktop.rendering.frame.every(p => p.x > 0.004 && p.x < 0.996 && p.y > 0.004 && p.y < 0.996), 'desktop keeps the whole table inside the canvas');
  assert.ok(Math.abs(desktop.aspect - 1.24) < 0.04, `desktop 3D canvas aspect is ${desktop.aspect}`);
  assert.ok(desktop.sidebar > 200, 'the score sidebar stays beside the table');
  assert.deepEqual(errors, []);
  console.log('PASS: portrait score row stays fixed, and the 3D near edge fills both the phone and the desktop canvas.');
} finally { await browser.close(); }
