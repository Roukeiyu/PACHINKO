import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
const ASPECT_2D = 760 / 900;
const ASPECT_3D = 1.24;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('ponpon-settings')) localStorage.setItem('ponpon-settings', JSON.stringify({ sound: false, calm: true, vibrate: false, music: false }));
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__ponpon);

  assert.equal(await page.locator('#full-window').isChecked(), false, 'the option starts off');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('full-window')), false);
  const resting = await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width);
  assert.ok(resting < 1440 - 40, `the default page keeps its side margins (${resting})`);

  await page.locator('#settings-button').click();
  assert.match(await page.locator('label[for="full-window"]').innerText(), /全屏幕宽度/);
  await page.locator('#full-window').check();
  await page.locator('#done-settings').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('full-window') && window.__ponpon.fullWindow === true);

  async function measure(label) {
    await page.waitForTimeout(160);
    return page.evaluate(({ label, aspect }) => {
      const shell = document.querySelector('.shell').getBoundingClientRect();
      const board = document.querySelector('#board').getBoundingClientRect();
      const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
      const score = document.querySelector('#score').getBoundingClientRect();
      const balls = document.querySelector('#ball-count').getBoundingClientRect();
      const canvas = document.querySelector('#board');
      const ready = window.__ponpon.rendering.readyBall;
      const plunger = document.querySelector('#plunger').getBoundingClientRect();
      const point = { x: board.left + ready.x * board.width, y: board.top + ready.y * board.height };
      const mode = canvas.dataset.renderer;
      const cssAspect = board.width / board.height;
      const bitmapAspect = canvas.width / canvas.height;
      return {
        label, mode,
        shellWidth: shell.width, shellLeft: shell.left,
        scroll: document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1,
        board: { x: board.x, y: board.y, width: board.width, height: board.height },
        sidebar: sidebar.width,
        beside: board.right <= sidebar.left + 2 && sidebar.right <= innerWidth + 1,
        inside: board.left >= -1 && board.top >= -1 && board.right <= innerWidth + 1 && board.bottom <= innerHeight + 1,
        score: score.width > 0 && score.height > 0 && balls.width > 0,
        cssAspect, bitmapAspect,
        aspectOk: Math.abs(cssAspect - aspect) < 0.03 && Math.abs(bitmapAspect - cssAspect) / cssAspect < 0.04,
        spring: point.x >= plunger.left - 12 && point.x <= plunger.right + 12 && point.y >= plunger.top - 12 && point.y <= plunger.bottom + 12,
        cameraAspect: mode === 'webgl' ? window.__ponpon.rendering.aspect : null,
        frameInside: mode === 'webgl' ? window.__ponpon.rendering.frame.every(p => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1) : true,
        saved: JSON.parse(localStorage.getItem('ponpon-settings')).fullWindow === true,
      };
    }, { label, aspect: (await page.locator('#board').getAttribute('data-renderer')) === 'webgl' ? ASPECT_3D : ASPECT_2D });
  }

  function check(fit) {
    assert.equal(fit.saved, true, `${fit.label}: the choice is stored`);
    assert.ok(Math.abs(fit.shellWidth - page.viewportSize().width) <= 1 && Math.abs(fit.shellLeft) <= 1, `${fit.label}: shell fills the window (${fit.shellWidth})`);
    assert.equal(fit.scroll, true, `${fit.label}: the page does not scroll`);
    assert.equal(fit.inside, true, `${fit.label}: the board stays inside the window`);
    assert.equal(fit.beside, true, `${fit.label}: the board sits beside the sidebar`);
    assert.ok(fit.sidebar >= 220 && fit.sidebar <= 320, `${fit.label}: sidebar width is ${fit.sidebar}`);
    assert.equal(fit.score, true, `${fit.label}: score and balls stay visible`);
    assert.equal(fit.aspectOk, true, `${fit.label}: aspect css ${fit.cssAspect} bitmap ${fit.bitmapAspect}`);
    assert.equal(fit.spring, true, `${fit.label}: the spring hit target still matches the table`);
    if (fit.mode === 'webgl') {
      assert.ok(Math.abs(fit.cameraAspect - fit.cssAspect) < 0.03, `${fit.label}: camera aspect ${fit.cameraAspect} vs ${fit.cssAspect}`);
      assert.equal(fit.frameInside, true, `${fit.label}: the 3D table stays inside the canvas`);
    }
  }

  const desktop = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 },
  ];
  for (const viewport of desktop) {
    await page.setViewportSize(viewport);
    check(await measure(`2d ${viewport.width}x${viewport.height}`));
  }

  await page.locator('#settings-button').click();
  await page.locator('#three-d').check();
  await page.locator('#done-settings').click();
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === 'webgl');
  for (const viewport of desktop) {
    await page.setViewportSize(viewport);
    check(await measure(`3d ${viewport.width}x${viewport.height}`));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(160);
  const phone = await page.evaluate(() => {
    const board = document.querySelector('#board').getBoundingClientRect();
    const card = document.querySelector('.score-card').getBoundingClientRect();
    return {
      full: document.documentElement.classList.contains('full-window'),
      card: card.width > 0 && getComputedStyle(document.querySelector('.score-card')).display !== 'none',
      board: board.width,
      overflow: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  assert.equal(phone.full, true, 'the saved choice stays on');
  assert.equal(phone.card, false, 'a narrow window uses the phone layout');
  assert.ok(phone.board >= 390 * 0.96, `phone board stays wide (${phone.board})`);
  assert.equal(phone.overflow, true, 'a narrow window does not spill sideways');

  await page.reload();
  await page.waitForFunction(() => window.__ponpon?.fullWindow === true);
  assert.equal(await page.locator('#full-window').isChecked(), true, 'refresh restores the choice');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#settings-button').click();
  await page.locator('#full-window').uncheck();
  await page.locator('#done-settings').click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('full-window'));
  const restored = await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().width);
  assert.ok(restored < 1440 - 40, `turning it off brings the margins back (${restored})`);
  assert.deepEqual(errors, []);
  console.log('PASS: full window width fills the desktop, keeps the board aspect, and leaves the phone layout alone.');
} finally { await browser.close(); }
