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
    assert.equal(await page.locator('.reward-card').isVisible(), false, `${width}: reward panel starts collapsed`);
    assert.equal(await page.locator('#info-toggle').isVisible(), true, `${width}: the info toggle stays reachable`);
    assert.equal(await page.locator('#double-ball-label').textContent(), '', `${width}: ×1 leaves the round multiplier blank`);
    assert.equal(await page.locator('#double-ball').getAttribute('data-factor'), '1', `${width}: the blank circle is still ×1`);
    const badge = await page.locator('#double-ball').boundingBox();
    assert.ok(badge.width >= 40 && Math.abs(badge.width - badge.height) <= 1, `${width}: the multiplier circle stays a 40px touch target`);
    const beforeOpen = await page.locator('#board').boundingBox();
    await page.locator('#info-toggle').click();
    assert.equal(await page.locator('.reward-card').isVisible(), true, `${width}: the drawer shows the reward table`);
    assert.equal(await page.locator('#leaderboard-button').isVisible(), true, `${width}: the drawer keeps the leaderboard`);
    const opened = await page.locator('#board').boundingBox();
    assert.equal(Math.round(opened.width), Math.round(beforeOpen.width), `${width}: opening the drawer does not resize the board`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: open drawer does not scroll sideways`);
    await page.locator('#info-close').click();
    assert.equal(await page.locator('.reward-card').isVisible(), false, `${width}: the drawer closes`);
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
  const inset2d = await page.evaluate(() => document.querySelector('.machine').getBoundingClientRect().left - document.querySelector('.intro').getBoundingClientRect().left);
  assert.ok(inset2d > 20, `2D machine stays inset from the title (${inset2d}px)`);
  await page.waitForFunction(() => window.__ponpon.star);
  const reward = await page.evaluate(() => {
    const star = window.__ponpon.star;
    const dashboard = document.querySelector('.reward-dashboard');
    return {
      goals: window.__ponpon.rewards.goals,
      counts: [0, 1, 2].map(i => document.querySelector(`#reward-${i}`).textContent),
      timer: document.querySelector('#reward-timer').textContent,
      how: document.querySelector('.how-card').textContent,
      slotFirst: dashboard.firstElementChild.classList.contains('reward-slot'),
      noStarRow: !document.querySelector('#reward-star'),
      noHoleRow: !document.querySelector('#reward-hole'),
      multiplier: document.querySelector('#global-multiplier-value').textContent,
      multiplierTime: document.querySelector('#global-multiplier-time').textContent,
      starMultiplier: star.multiplier,
    };
  });
  assert.deepEqual(reward.goals, [5, 5, 30]);
  const reelMarkup = await page.locator('.reward-reels').innerHTML();
  assert.match(reelMarkup, /<svg/i, 'the sidebar reels use the astronomy icons');
  assert.doesNotMatch(reelMarkup, /🍒|🍋|🔔|🍀/);
  assert.deepEqual(reward.counts, ['0/5', '0/5', '0/30']);
  assert.match(reward.timer, /满 5 次，只放大中央 10 秒/);
  assert.match(reward.how, /左右鼓满 5 次/);
  assert.match(reward.how, /右鼓只放大中央 10 秒/);
  assert.match(reward.how, /\+1\/\+10\/\+100/);
  assert.match(await page.locator('#reward-slot-caption').textContent(), /\+1\/\+10\/\+100/);
  assert.equal(reward.slotFirst, true, 'the slot row leads the reward list');
  assert.equal(reward.noStarRow, true);
  assert.equal(reward.noHoleRow, true);
  assert.equal(reward.multiplier, `×${reward.starMultiplier}`);
  assert.match(reward.multiplierTime, /^星 \d+s$/);
  await page.evaluate(() => window.__ponpon.previewReels([5, 1, 2], 17));
  await page.waitForFunction(() => document.querySelector('#reward-slot-count').textContent === '17/50');
  assert.equal(await page.locator('.reward-reels i.is-ball').count(), 1, 'the sidebar reel mirrors the ball icon');
  await page.evaluate(() => window.__ponpon.previewReelSpin([0, 1, 2], 1, 'spin', 5));
  await page.waitForFunction(() => document.querySelector('.reward-reels i[data-reel="1"]').classList.contains('is-spinning'));
  assert.equal(await page.locator('.reward-reels i.is-spinning').count(), 1);
  await page.evaluate(() => window.__ponpon.previewJar(7));
  await page.waitForFunction(() => document.querySelector('#reward-jar').textContent === '7/20');
  await page.evaluate(() => window.__ponpon.setSlotMultiplier(2));
  await page.waitForFunction(expected => document.querySelector('#global-multiplier-value').textContent === expected, `×${reward.starMultiplier * 2}`);
  assert.match(await page.locator('#reward-slot-caption').textContent(), /^\d{2}:\d{2}$/);
  assert.equal(await page.locator('#global-multiplier').evaluate(el => el.classList.contains('is-changed')), true);
  assert.equal(await page.locator('#hole-points').textContent(), '+1000');
  await page.locator('#settings-button').click();
  await page.locator('#three-d').check();
  await page.locator('#done-settings').click();
  await page.waitForFunction(() => document.querySelector('#board')?.dataset.renderer === 'webgl');
  await page.waitForTimeout(120);
  const desktop = await page.evaluate(() => {
    const board = document.querySelector('#board').getBoundingClientRect();
    const rendering = window.__ponpon.rendering;
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    const intro = document.querySelector('.intro').getBoundingClientRect();
    const machine = document.querySelector('.machine').getBoundingClientRect();
    return { rendering, boardWidth: board.width, margin: rendering.near.minX * board.width, sidebar: sidebar.width, aspect: board.width / board.height, machineLeft: machine.left, introLeft: intro.left, introRight: intro.right, sidebarRight: sidebar.right, sidebarLeft: sidebar.left, machineRight: machine.right };
  });
  assert.equal(desktop.rendering.distance, VIEW_DISTANCE);
  assert.equal(desktop.rendering.lookY, VIEW_LOOK_Y);
  assert.ok(desktop.rendering.near.width >= 0.95, `desktop near edge covers ${desktop.rendering.near.width}`);
  assert.ok(desktop.margin >= 4 && desktop.margin <= desktop.boardWidth * 0.02, `desktop side margin is ${desktop.margin}px`);
  assert.ok(Math.abs(desktop.machineLeft - desktop.introLeft) <= 1, '3D board starts at the title edge');
  assert.ok(Math.abs(desktop.sidebarRight - desktop.introRight) <= 1, '3D sidebar ends with the title');
  assert.ok(Math.abs(desktop.sidebarLeft - desktop.machineRight - 22) <= 2, '3D keeps the sidebar gutter');
  assert.ok(desktop.rendering.frame.every(p => p.x > 0.004 && p.x < 0.996 && p.y > 0.004 && p.y < 0.996), 'desktop keeps the whole table inside the canvas');
  assert.ok(Math.abs(desktop.aspect - 1.24) < 0.04, `desktop 3D canvas aspect is ${desktop.aspect}`);
  assert.ok(desktop.sidebar > 200, 'the score sidebar stays beside the table');
  assert.deepEqual(errors, []);
  console.log('PASS: portrait score row stays fixed, and the 3D near edge fills both the phone and the desktop canvas.');
} finally { await browser.close(); }
