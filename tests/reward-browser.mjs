import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', { recursive: true });
const errors = [];
async function setup(fallback = false, viewport = { width: 1440, height: 1180 }) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-10T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-10T12:00:01Z'));
  await page.addInitScript(fallback => {
    localStorage.setItem('ponpon-settings', JSON.stringify({ sound: false, calm: false, render3D: !fallback }));
    const originalContext = HTMLCanvasElement.prototype.getContext;
    if (fallback) HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.startsWith('webgl') ? null : originalContext.call(this, type, ...args); };
    window.__rewardLabels = [];
    const text = CanvasRenderingContext2D.prototype.fillText, clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) { if (args[2] === 760 && args[3] === 900) window.__rewardLabels = []; return clear.apply(this, args); };
    CanvasRenderingContext2D.prototype.fillText = function(value, x, y, ...args) { window.__rewardLabels.push({ value: String(value), x, y }); return text.call(this, value, x, y, ...args); };
  }, fallback);
  // Real Matter balls enter actual scoring sensors; no fake score callbacks.
  await page.route('**/src/physics.js*', async route => {
    const response = await route.fetch(); let body = await response.text();
    assert.ok(body.includes('return { engine, balls'));
    body = body.replace('return { engine, balls', `window.__rewardPhysics = {
      slot(multiplier) {
        const column = slotMultipliers(slots).indexOf(multiplier), ball = launch(); ball.entered = true;
        Body.setPosition(ball.body, {x: TABLE.left + (column + .5) * (TABLE.right - TABLE.left) / slots, y: TABLE.scoreLine-1});
        Body.setVelocity(ball.body, {x:0,y:6}); step();
      }, secret() {
        // Keep one real ball in play so the treasure effect is visible while
        // the new secret workflow waits for the remaining field to drain.
        const waiting=launch();waiting.entered=true;Body.setPosition(waiting.body,{x:350,y:200});Body.setVelocity(waiting.body,{x:0,y:0});
        const hole = holes[0], ball = launch(); ball.entered = true;
        Body.setPosition(ball.body, {x:hole.x-47,y:hole.y-2}); Body.setVelocity(ball.body,{x:5,y:-1});
        for(let i=0;i<45 && balls.includes(ball);i++) step();
      }, drain() {
        for(const ball of [...balls]) {ball.entered=true;Body.setPosition(ball.body,{x:347,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});}step();
      }
    }; return { engine, balls`);
    await route.fulfill({ response, body });
  });
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch(); let body = await response.text();
    const anchor = "const renderer = createRenderer($('#board'));"; assert.ok(body.includes(anchor));
    body = body.replace(anchor, anchor + `
      window.__rewardFixture = {
        reset() { fx.celebrations.length=fx.particles.length=fx.ripples.length=fx.popups.length=0;fx.shake=0;fx.slotGlows.fill(0); },
        theme(key, count) { state.slots=count;game.setSlots(count);fx.slotGlows=Array(count).fill(0);updateLayout(); },
        advance(ms) { updateEffects(ms); },
        night() { state.timeFlow=true;state.timeFlowStartedAt=Date.now()-330000;updateTimeFlow(performance.now(),true); },
        calm() { state.calm=true;updateCalm(); },
        snapshot() { return { bursts:fx.celebrations,popups:fx.popups,score:state.score,particles:fx.particles.length,rendering:renderer.snapshot() }; }
      };`);
    await route.fulfill({ response, body });
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.clock.runFor(50);
  assert.ok(await page.evaluate(() => window.__rewardFixture),`reward fixture failed to load: ${JSON.stringify(errors)}`);
  return page;
}
try {
  const fallback = await setup(true);
  const symbols = { 2:'🍒', 3:'🍊', 5:'🍇', 10:'🍍' };
  const upper = { animal:['🐰','🐻','🐱'] };
  for (const theme of Object.keys(upper)) for (const count of [5,7,9]) {
    await fallback.evaluate(({theme,count}) => window.__rewardFixture.theme(theme,count), {theme,count});
    await fallback.clock.runFor(50);
    const labels = await fallback.evaluate(() => window.__rewardLabels);
    const slots = labels.filter(l => l.y === 820), factors = count===5 ? [2,3,10,3,2] : count===7 ? [2,3,5,10,5,3,2] : [2,2,3,5,10,5,3,2,2];
    assert.deepEqual(slots.map(l => l.value), factors.map(m => symbols[m]), `${theme}/${count}: repeated multipliers always share a fruit`);
    for (const motif of upper[theme]) assert.ok(labels.some(l => l.value === motif && l.y < 400));
    assert.ok(upper[theme].every(icon => !slots.some(l => l.value === icon)), 'drums use a separate icon family');
  }
  await fallback.close();
  const page = await setup();
  assert.equal(await page.evaluate(() => window.__rewardFixture.snapshot().rendering.mode), 'webgl');
  await page.evaluate(() => { window.__rewardFixture.reset(); window.__rewardPhysics.slot(10); window.__rewardFixture.advance(700); });
  await page.clock.runFor(50);
  let state = await page.evaluate(() => window.__rewardFixture.snapshot());
  assert.equal(state.score, 100); assert.equal(state.bursts[0].scene, 'lucky');
  assert.ok(await page.evaluate(() => window.__rewardLabels.some(l => l.value.includes('全台金色庆典'))));
  await page.locator('#board').screenshot({ path:'test-results/reward-lucky-3d.png' });
  await page.evaluate(() => document.querySelector('#settings').showModal());
  const paused = await page.evaluate(() => window.__rewardFixture.snapshot().bursts[0].age);
  await page.clock.runFor(500);
  assert.equal(await page.evaluate(() => window.__rewardFixture.snapshot().bursts[0].age), paused, 'settings freeze the full-table effect and marquee');
  await page.evaluate(() => document.querySelector('#settings').close());
  await page.evaluate(() => { window.__rewardFixture.reset(); window.__rewardPhysics.slot(5); window.__rewardFixture.advance(700); });
  await page.clock.runFor(50);
  state = await page.evaluate(() => window.__rewardFixture.snapshot());
  assert.equal(state.score, 150); assert.equal(state.bursts[0].scene, 'stars');
  await page.locator('#board').screenshot({ path:'test-results/reward-x5-3d.png' });
  await page.evaluate(() => { window.__rewardFixture.reset(); window.__rewardPhysics.secret(); });
  await page.clock.runFor(50);
  state = await page.evaluate(() => window.__rewardFixture.snapshot());
  assert.equal(state.score, 650); assert.equal(state.bursts[0].scene, 'treasure');
  await page.evaluate(() => window.__rewardFixture.advance(4900));
  await page.clock.runFor(50);
  state = await page.evaluate(() => window.__rewardFixture.snapshot());
  assert.equal(state.bursts.length, 1); assert.ok(state.popups.some(p => p.text.includes('秘密洞') && p.life > 0));
  assert.ok(await page.locator('#toast').evaluate(el => el.classList.contains('show')));
  await page.locator('#board').screenshot({ path:'test-results/reward-treasure-late.png' });
  await page.evaluate(() => window.__rewardFixture.advance(600));
  await page.clock.runFor(50);
  assert.equal(await page.evaluate(() => window.__rewardFixture.snapshot().bursts.length), 0);
  await page.evaluate(()=>window.__rewardPhysics.drain());await page.clock.runFor(50);
  assert.equal(await page.locator('#mini-game').evaluate(el=>el.open),true);
  await page.clock.fastForward(30100);await page.locator('#mini-return').click();await page.clock.runFor(50);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { window.__rewardFixture.reset(); window.__rewardFixture.night(); window.__rewardPhysics.slot(10); window.__rewardFixture.advance(800); });
  await page.clock.runFor(50);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight+1));
  await page.screenshot({path:'test-results/reward-lucky-mobile-night.png',fullPage:true});
  await page.evaluate(() => window.__rewardFixture.calm());
  await page.clock.runFor(50);
  await page.screenshot({path:'test-results/reward-lucky-calm.png',fullPage:true});
  assert.deepEqual(errors, []);
  console.log('PASS: consistent fruits in the animal scene and 5/7/9 slots; actual 3D scoring produces Lucky/x5/treasure effects, long treasure text, settings pause, mobile/night rendering and reduced motion without browser errors.');
} finally { await browser.close(); }
