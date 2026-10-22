import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { START_BALLS, BURST_COST, SECRET_BALLS, ROUND_IDLE_MS } from '../src/round.js';
import { PAIR_DURATION, BLOCK_DURATION, MINI_DURATION, AFK_BALL_TEXT, connectedBlocks, MOLE_FLIP_MS } from '../src/mini-games.js';
import { BURST_READY_AT } from '../src/charge.js';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}');
    saved.sound = false;
    saved.calm = true;
    saved.vibrate = false;
    saved.music = false;
    localStorage.setItem('ponpon-settings', JSON.stringify(saved));
  });
  const epoch = Date.UTC(2026, 9, 10, 12);
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(epoch + 1000);
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.clock.runFor(40);
  assert.match(await page.locator('#reward-slot-caption').textContent(), /\+1\/\+10\/\+100/);
  assert.equal(await page.locator('#double-ball').isDisabled(), true, 'double cost stays locked at 5 slots');
  assert.match(await page.locator('#double-ball-note').textContent(), /3000 分解锁 ×2/);
  assert.match(await page.locator('#double-ball').getAttribute('aria-label'), /10000 分解锁 ×4/);
  assert.equal(await page.locator('#ball-count').textContent(), String(START_BALLS));
  assert.equal(await page.locator('#mobile-balls').textContent(), String(START_BALLS));
  const spent = await page.evaluate(() => {
    const before = window.__ponpon.available;
    const score = window.__ponpon.score;
    const ok = window.__ponpon.dropSlot(0);
    return { ok, before, after: window.__ponpon.available, score: window.__ponpon.score - score, drains: window.__ponpon.stats.drains };
  });
  assert.equal(spent.ok, true);
  assert.equal(spent.after, spent.before, 'a scoring pocket does not return a ball');
  assert.equal(spent.score, 20);
  const missed = await page.evaluate(() => {
    const before = window.__ponpon.available;
    const score = window.__ponpon.score;
    window.__ponpon.dropDrain();
    return { before, after: window.__ponpon.available, score: window.__ponpon.score - score, drains: window.__ponpon.stats.drains };
  });
  assert.equal(missed.after, missed.before, 'a drain does not return a ball');
  assert.equal(missed.score, 0, 'a drain does not score');
  assert.equal(missed.drains, 1);

  await page.evaluate(stock => window.__ponpon.setStock(stock), BURST_COST - 1);
  await page.locator('#launch').focus();
  await page.keyboard.down('Space');
  await page.clock.fastForward(BURST_READY_AT + 50);
  await page.keyboard.up('Space');
  await page.clock.runFor(80);
  assert.equal(await page.evaluate(() => window.__ponpon.available), BURST_COST - 1, 'a short stock cannot start a five-ball burst');
  assert.equal(await page.evaluate(() => window.__ponpon.stats.launches), 2, 'the refused burst does not launch');

  await page.evaluate(() => window.__ponpon.setStock(0));
  assert.equal(await page.evaluate(() => window.__ponpon.holdBall()), true);
  await page.clock.runFor(60);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false, 'a ball on the table blocks game over');
  await page.locator('#settings-button').click();
  for (let i = 0; i < 3; i++) await page.locator('#gm-dot').click();
  await page.locator('[data-mini="pairs"]').click();
  await page.evaluate(() => window.__ponpon.releaseWave());
  await page.clock.runFor(80);
  assert.equal(await page.locator('#mini-game').evaluate(el => el.open), true);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false, 'an open mini-game blocks game over');
  await page.locator('#mini-return').click({ force: true }).catch(() => {});
  await page.evaluate(() => { document.querySelector('#mini-game').close(); });
  await page.clock.runFor(80);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true);
  await page.keyboard.press('Escape');
  await page.clock.runFor(50);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true, 'escape cannot dismiss the settlement');
  assert.equal(await page.evaluate(() => window.__ponpon.over), true);
  assert.equal(await page.locator('#launch-label').textContent(), '本局结束');

  const best = await page.locator('#best').textContent();
  await page.locator('#play-again').click();
  await page.clock.runFor(30);
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 5);
  assert.equal(await page.evaluate(() => window.__ponpon.score), 0);
  assert.equal(await page.evaluate(() => window.__ponpon.available), START_BALLS);
  assert.equal(await page.locator('#best').textContent(), best, 'a new round keeps the saved record');
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false);

  await page.addInitScript(() => {
    if (sessionStorage.getItem('ponpon-stale-run-applied')) return;
    sessionStorage.setItem('ponpon-stale-run-applied', '1');
    const saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}');
    saved.keepProgress = false;
    saved.run = { score: 9999, balls: 7, slots: 9, over: true, launches: 12, bestCombo: 4, bestSlot: 10, runId: 'stale-run' };
    localStorage.setItem('ponpon-settings', JSON.stringify(saved));
  });
  await page.reload();
  await page.clock.runFor(40);
  assert.equal(await page.evaluate(() => window.__ponpon.keepProgress), false);
  assert.equal(await page.evaluate(() => window.__ponpon.available), START_BALLS, 'refresh with keep-progress off starts a fresh stock');
  assert.equal(await page.evaluate(() => window.__ponpon.score), 0, 'refresh with keep-progress off starts a fresh score');
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 5, 'refresh with keep-progress off returns to 5 slots');
  assert.equal(await page.evaluate(() => window.__ponpon.over), false);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false, 'an ended run is not restored when keep-progress is off');
  assert.equal(await page.locator('#mini-game').evaluate(el => el.open), false, 'a refresh does not restore an in-progress mini-game');

  await page.evaluate(() => { window.__ponpon.setStock(64); window.__ponpon.grant(2500); });
  await page.locator('#settings-button').click();
  for (let i = 0; i < 3; i++) await page.locator('#gm-dot').click();
  assert.equal(await page.locator('#keep-progress').isChecked(), false, 'keep-progress defaults off');
  await page.locator('#keep-progress').check();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ponpon-settings')).run.score), 2500, 'turning keep-progress on saves the current run');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.clock.runFor(40);
  assert.equal(await page.evaluate(() => window.__ponpon.available), 64, 'keep-progress restores the ball stock');
  assert.equal(await page.evaluate(() => window.__ponpon.score), 2500, 'keep-progress restores the score');
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 5, '2500 has not unlocked 7 slots');
  assert.equal(await page.evaluate(() => window.__ponpon.keepProgress), true);
  const beforeSecret = await page.evaluate(() => window.__ponpon.available);
  const miniWait = Math.max(PAIR_DURATION, BLOCK_DURATION, MINI_DURATION) + MOLE_FLIP_MS * 10 + 2000;
  async function missOnce() {
    const board = await page.evaluate(() => window.__ponpon.miniGame);
    if (board.kind === 'moles') {
      const index = board.board.findIndex(cell => cell.type === 'cabbage');
      await page.locator(`[data-cell="${index}"]`).evaluate(el => el.click());
    } else if (board.kind === 'pairs') {
      const groups = Object.values(Object.groupBy(board.board.map((cell, index) => ({ ...cell, index })), cell => cell.pair));
      await page.locator(`[data-cell="${groups[0][0].index}"]`).evaluate(el => el.click());
      await page.locator(`[data-cell="${groups[1][0].index}"]`).evaluate(el => el.click());
    } else if (board.kind === 'stars') {
      await idleStars(page);
    } else if (board.kind === 'aim') {
      await page.clock.fastForward(miniWait);
    } else {
      const index = board.board.findIndex((_, cell) => connectedBlocks(board.board, cell).length < 3);
      if (index >= 0) await page.locator(`[data-cell="${index}"]`).evaluate(el => el.click());
    }
    await page.clock.runFor(40);
  }
  async function scoreOnce() {
    const board = await page.evaluate(() => window.__ponpon.miniGame);
    if (board.kind === 'moles') {
      const index = board.board.findIndex(cell => cell.type === 'mole' && !cell.hit);
      await page.locator(`[data-cell="${index}"]`).evaluate(el => el.click());
    } else if (board.kind === 'pairs') {
      const groups = Object.values(Object.groupBy(board.board.map((cell, index) => ({ ...cell, index })), cell => cell.pair));
      await page.locator(`[data-cell="${groups[0][0].index}"]`).evaluate(el => el.click());
      await page.locator(`[data-cell="${groups[0][1].index}"]`).evaluate(el => el.click());
    } else if (board.kind === 'stars') {
      for (let step = 0; step < 40 && !((await page.evaluate(() => window.__ponpon.miniGame)).hit > 0); step++) {
        const live = await page.evaluate(() => window.__ponpon.miniGame);
        const star = live.items.find(item => item.kind === 'star' && !item.resolved);
        if (star) await parkBasket(page, star.x);
        await page.clock.fastForward(200);
      }
    } else if (board.kind === 'aim') {
      const elapsed = board.lastSim - board.startedAt;
      await page.clock.fastForward(Math.max(0, 1440 - elapsed));
      await dragAim(page, 24, -86);
      await page.clock.fastForward(1600);
    } else {
      const index = board.board.findIndex((_, cell) => connectedBlocks(board.board, cell).length >= 3);
      await page.locator(`[data-cell="${index}"]`).evaluate(el => el.click());
      for (let step = 0; step < 40; step++) {
        if (await page.locator('#mini-game').getAttribute('data-busy') !== '1') break;
        await page.clock.runFor(80);
      }
    }
    await page.clock.runFor(40);
  }
  async function parkBasket(target, x) {
    await target.evaluate(x => {
      const field = document.querySelector('#mini-field');
      const rect = field.getBoundingClientRect();
      const cx = rect.left + (x / 320) * rect.width;
      const cy = rect.top + rect.height * 0.9;
      const opts = { bubbles: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      field.dispatchEvent(new PointerEvent('pointerdown', opts));
      field.dispatchEvent(new PointerEvent('pointerup', opts));
    }, x);
  }
  async function dragAim(target, dx, dy) {
    await target.evaluate(({ dx, dy }) => {
      const field = document.querySelector('#mini-field');
      const rect = field.getBoundingClientRect();
      const client = (x, y) => ({ x: rect.left + (x / 320) * rect.width, y: rect.top + (y / 420) * rect.height });
      const rest = client(160, 372);
      const pulled = client(160 - dx, 372 - dy);
      const opts = (x, y) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true });
      field.dispatchEvent(new PointerEvent('pointerdown', opts(rest.x, rest.y)));
      field.dispatchEvent(new PointerEvent('pointermove', opts(pulled.x, pulled.y)));
      field.dispatchEvent(new PointerEvent('pointerup', opts(pulled.x, pulled.y)));
    }, { dx, dy });
  }
  async function idleStars(target) {
    for (let i = 0; i < 320; i++) {
      const snap = await target.evaluate(() => window.__ponpon.miniGame);
      if (!snap || snap.status !== 'playing') break;
      const stars = (snap.items || []).filter(item => !item.resolved && item.kind === 'star' && item.y + item.vy * 0.2 >= 392);
      let x = snap.basketX;
      if (stars.length) {
        x = 48;
        for (let c = 48; c <= 272; c += 8) if (stars.every(item => Math.abs(item.x - c) > 80)) { x = c; break; }
      }
      await parkBasket(target, x);
      await target.clock.fastForward(160);
    }
  }
  async function confirmMini() {
    assert.equal(await page.locator('#mini-game').getAttribute('data-phase'), 'intro');
    assert.equal(await page.evaluate(() => window.__ponpon.miniGame), null);
    await page.locator('#mini-start').click();
    await page.clock.runFor(40);
  }
  assert.equal(await page.evaluate(() => window.__ponpon.dropHole()), true);
  await page.clock.runFor(80);
  assert.equal(await page.locator('#mini-game').evaluate(el => el.open), true);
  await confirmMini();
  const idleKind = await page.evaluate(() => window.__ponpon.miniGame.kind);
  assert.equal(await page.evaluate(() => window.__ponpon.lastMiniGame), idleKind);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ponpon-settings')).run.lastMiniGame), idleKind, 'keep-progress remembers the mini-game that just started');
  await missOnce();
  assert.equal(await page.evaluate(() => window.__ponpon.miniGame.played), false, 'a miss does not count as play');
  await page.clock.fastForward(miniWait);
  await page.clock.runFor(40);
  assert.equal(await page.locator('#mini-result-balls').textContent(), AFK_BALL_TEXT);
  assert.equal(await page.evaluate(() => window.__ponpon.miniGame.played), false);
  assert.equal(await page.evaluate(() => window.__ponpon.miniGame.score), 0);
  assert.equal(await page.evaluate(() => window.__ponpon.available), beforeSecret, 'an idle secret visit pays no balls');
  await page.locator('#mini-return').click();
  await page.clock.runFor(40);
  assert.notEqual(await page.locator('#toast').textContent(), `+${SECRET_BALLS} 球`);
  assert.equal(await page.evaluate(() => window.__ponpon.available), beforeSecret);

  await page.reload();
  await page.clock.runFor(40);
  assert.equal(await page.evaluate(() => window.__ponpon.lastMiniGame), idleKind, 'a reload restores the last mini-game while keep-progress is on');
  assert.equal(await page.evaluate(() => window.__ponpon.dropHole()), true);
  await page.clock.runFor(80);
  await confirmMini();
  const playedKind = await page.evaluate(() => window.__ponpon.miniGame.kind);
  assert.notEqual(playedKind, idleKind, 'the mini-game after a reload is not the saved one');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ponpon-settings')).run.lastMiniGame), playedKind);
  await scoreOnce();
  assert.equal(await page.evaluate(() => window.__ponpon.miniGame.played), true);
  await page.clock.fastForward(miniWait);
  await page.clock.runFor(40);
  assert.equal(await page.locator('#mini-result-balls').textContent(), `+${SECRET_BALLS} 球`);
  assert.equal(await page.evaluate(() => window.__ponpon.available), beforeSecret + SECRET_BALLS, 'one scoring action keeps the secret-hole balls');
  await page.locator('#mini-return').click();
  await page.clock.runFor(40);
  assert.equal(await page.locator('#toast').textContent(), `+${SECRET_BALLS} 球`);

  assert.equal(await page.evaluate(() => window.__ponpon.dropHole()), true);
  await page.clock.runFor(80);
  await confirmMini();
  const thirdKind = await page.evaluate(() => window.__ponpon.miniGame.kind);
  assert.notEqual(thirdKind, playedKind, 'two secret visits in one page never repeat');
  await page.clock.fastForward(miniWait);
  await page.clock.runFor(40);
  assert.equal(await page.locator('#mini-result-balls').textContent(), AFK_BALL_TEXT);
  assert.equal(await page.evaluate(() => window.__ponpon.available), beforeSecret + SECRET_BALLS, 'the following idle visit adds nothing more');
  await page.locator('#mini-return').click();
  await page.clock.runFor(40);

  await page.locator('#settings-button').click();
  for (let i = 0; i < 3; i++) await page.locator('#gm-dot').click();
  await page.locator('#keep-progress').uncheck();
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('ponpon-settings')));
  assert.equal(cleared.keepProgress, false, 'turning keep-progress off is saved');
  assert.equal(Object.hasOwn(cleared, 'run'), false, 'turning keep-progress off clears the saved run');
  await page.reload();
  await page.clock.runFor(40);
  assert.equal(await page.evaluate(() => window.__ponpon.available), START_BALLS, 'the next refresh starts fresh after the toggle is switched off');
  assert.equal(await page.evaluate(() => window.__ponpon.score), 0);
  assert.equal(await page.evaluate(() => window.__ponpon.slots), 5);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false);

  await page.evaluate(() => { window.__ponpon.grant(120718); window.__ponpon.setStock(0); window.__ponpon.previewJar(8); });
  await page.clock.runFor(80);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true, 'gift balls in a partial jar do not hold the round open');
  assert.equal(await page.locator('#name-entry').evaluate(el => el.open), true, 'a qualifying score still asks for a name');
  assert.equal(await page.evaluate(() => window.__ponpon.collector.count), 8);
  assert.equal(await page.evaluate(() => window.__ponpon.available), 0);
  await page.keyboard.press('Escape');
  await page.clock.runFor(40);
  assert.equal(await page.locator('#name-entry').evaluate(el => el.open), false, 'escape skips the name prompt');
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true, 'the result stays up under the name prompt');
  await page.keyboard.press('Escape');
  await page.clock.runFor(40);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true, 'a second escape cannot leave an ended round with no dialog');
  assert.equal(await page.evaluate(() => window.__ponpon.over), true);
  assert.equal(await page.locator('#launch-label').textContent(), '本局结束');
  await page.locator('#play-again').click();
  await page.clock.runFor(30);
  assert.equal(await page.evaluate(() => window.__ponpon.over), false);

  await page.evaluate(() => window.__ponpon.setStock(0));
  const queued = await page.evaluate(() => window.__ponpon.queueClock(8));
  assert.equal(queued, 96);
  await page.clock.runFor(50);
  const burst = await page.evaluate(() => ({
    over: window.__ponpon.over,
    balls: window.__ponpon.activeBalls,
    pending: window.__ponpon.pendingShots,
    open: document.querySelector('#settlement').open,
  }));
  assert.equal(burst.over, false, 'an ×8 clock burst does not end the round between shots');
  assert.equal(burst.open, false);
  assert.ok(burst.pending > 0 || burst.balls > 0, 'the burst is still queued or on the table');
  await page.evaluate(() => window.__ponpon.restart());
  await page.clock.runFor(40);

  await page.locator('#settings-button').click();
  await page.evaluate(() => { window.__ponpon.setStock(0); window.__ponpon.previewJar(8); });
  await page.clock.runFor(80);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false, 'settings hold the normal end until the watchdog');
  await page.clock.fastForward(ROUND_IDLE_MS - 400);
  await page.clock.runFor(20);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false, 'the watchdog waits the full 3 seconds');
  await page.clock.fastForward(700);
  await page.clock.runFor(40);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), true, 'a quiet table with only gift balls ends after 3 seconds');
  assert.equal(await page.evaluate(() => window.__ponpon.over), true);
  assert.equal(await page.locator('#launch-label').textContent(), '本局结束');
  await page.locator('#play-again').click();
  await page.clock.runFor(30);
  await page.locator('#close-settings').click();
  await page.clock.runFor(20);
  assert.equal(await page.locator('#settlement').evaluate(el => el.open), false);
  assert.equal(await page.evaluate(() => window.__ponpon.over), false);
  assert.equal(await page.evaluate(() => window.__ponpon.available), START_BALLS);

  assert.deepEqual(errors, []);
  console.log('PASS: ball spend and return, drains, blocked game over, restart, and keep-progress refresh.');

  const paid = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  paid.on('pageerror', error => errors.push(error.message));
  await paid.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}');
    saved.sound = false;
    saved.calm = true;
    saved.vibrate = false;
    saved.music = false;
    localStorage.setItem('ponpon-settings', JSON.stringify(saved));
  });
  await paid.clock.install({ time: epoch });
  await paid.clock.pauseAt(epoch + 1000);
  await paid.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await paid.clock.runFor(40);
  await paid.evaluate(() => window.__ponpon.presentSlot([5, 0, 1]));
  await paid.clock.runFor(20);
  assert.match(await paid.locator('#toast').textContent(), /\+1 球/);
  assert.equal(await paid.evaluate(() => window.__ponpon.available), START_BALLS + 1);
  await paid.evaluate(() => window.__ponpon.presentSlot([5, 5, 0]));
  await paid.clock.runFor(20);
  assert.match(await paid.locator('#toast').textContent(), /\+10 球/);
  assert.equal(await paid.evaluate(() => window.__ponpon.available), START_BALLS + 11);
  await paid.evaluate(() => window.__ponpon.presentSlot([5, 5, 5]));
  await paid.clock.runFor(20);
  assert.match(await paid.locator('#toast').textContent(), /大奖 \+100 球/);
  assert.equal(await paid.evaluate(() => window.__ponpon.available), START_BALLS + 111);
  await paid.evaluate(() => window.__ponpon.grant(5000));
  await paid.waitForFunction(() => window.__ponpon.slots >= 7);
  assert.equal(await paid.locator('#double-ball').isDisabled(), false);
  await paid.locator('#double-ball').click();
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '2');
  assert.match(await paid.locator('#double-ball-note').textContent(), /单发 2 · 五连发 10/);
  assert.match(await paid.locator('#double-ball-note').textContent(), /10000 分解锁 ×4 ×8/);
  assert.match(await paid.locator('#toast').textContent(), /球消耗 ×2/);
  const shot = await paid.evaluate(() => window.__ponpon.tryLaunch(0.8, false));
  assert.equal(shot.valueFactor, 2);
  assert.equal(shot.doubleBall, true);
  assert.equal(shot.available, START_BALLS + 111 - 2);
  await paid.clock.runFor(40);
  assert.equal(await paid.locator('#global-multiplier-value').textContent(), '×1', 'a paid ball does not change the field multiplier');
  assert.equal(await paid.locator('#global-multiplier-time').evaluate(el => el.hidden), true);
  await paid.clock.runFor(3000);
  await paid.evaluate(() => window.__ponpon.setStock(1));
  const last = await paid.evaluate(() => window.__ponpon.tryLaunch(0.4, false));
  assert.equal(last.valueFactor, 1, 'the last ball launches at normal cost');
  assert.match(await paid.locator('#toast').textContent(), /只剩 1 颗/);
  await paid.evaluate(() => window.__ponpon.setStock(9));
  const blocked = await paid.evaluate(() => window.__ponpon.tryLaunch(1, true));
  assert.equal(blocked.pending, 0);
  assert.equal(blocked.available, 9, 'a short ×2 burst does not fire');
  assert.match(await paid.locator('#toast').textContent(), /×2 五连发需要 10 颗球/);
  await paid.evaluate(() => window.__ponpon.setSlots(9));
  await paid.locator('#double-ball').click();
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '4');
  assert.match(await paid.locator('#double-ball-note').textContent(), /单发 4 · 五连发 20/);
  assert.doesNotMatch(await paid.locator('#double-ball-note').textContent(), /解锁 ×4/);
  await paid.locator('#double-ball').click();
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '8');
  const beforeEight = await paid.evaluate(() => { window.__ponpon.previewJar(0); window.__ponpon.setStock(40); return window.__ponpon.available; });
  await paid.clock.runFor(300);
  const eight = await paid.evaluate(() => window.__ponpon.tryLaunch(0.7, false));
  assert.equal(eight.valueFactor, 8);
  assert.equal(eight.ballCost, 8);
  assert.equal(eight.available, beforeEight - 8, 'an ×8 shot spends eight balls and launches one');
  await paid.locator('#double-ball').click();
  await paid.locator('#double-ball').click();
  await paid.locator('#double-ball').click();
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '4');
  await paid.evaluate(() => { window.__ponpon.previewJar(0); window.__ponpon.setStock(19); });
  const blockedFour = await paid.evaluate(() => window.__ponpon.tryLaunch(1, true));
  assert.equal(blockedFour.pending, 0);
  assert.equal(blockedFour.available, 19);
  assert.match(await paid.locator('#toast').textContent(), /×4 五连发需要 20 颗球/);
  await paid.evaluate(() => { window.__ponpon.previewJar(0); window.__ponpon.setStock(3); });
  await paid.clock.runFor(300);
  const short = await paid.evaluate(() => window.__ponpon.tryLaunch(0.5, false));
  assert.equal(short.valueFactor, 1, 'a short ×4 stock still launches one normal ball');
  assert.match(await paid.locator('#toast').textContent(), /不够 ×4/);
  await paid.locator('#double-ball').click();
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '8');
  await paid.locator('#settings-button').click();
  for (let i = 0; i < 3; i++) await paid.locator('#gm-dot').click();
  await paid.locator('#keep-progress').check();
  await paid.reload();
  await paid.clock.runFor(40);
  assert.equal(await paid.evaluate(() => window.__ponpon.ballCost), 8, 'keep-progress restores the ×8 tier');
  assert.equal(await paid.evaluate(() => window.__ponpon.slots), 9);
  assert.equal(await paid.locator('#double-ball').getAttribute('data-factor'), '8');
  assert.deepEqual(errors, []);
  console.log('PASS: reel ball gifts are +1/+10/+100 and cost tiers cycle ×2, then ×4 and ×8 at 9 slots.');
} finally { await browser.close(); }
