// Headless stress of the live board. Not part of npm test.
// Measures one ×8 clock (96), two and three overlapping clocks, and a ×8 jar on top.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const URL = process.env.TEST_URL || 'http://127.0.0.1:5173';
const CHROME = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';
const OUT = '/tmp/stress-board.json';
const SHOT = '/opt/cursor/artifacts/crowd-lock-fireworks.png';

const round = (value, digits = 1) => value == null || Number.isNaN(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits;

function summarize(read) {
  const band = (min, max) => read.bands?.find(row => row.min === min && row.max === max) || null;
  const pack = row => row && row.frames ? {
    frames: row.frames,
    fps: round(row.fps),
    fps1: round(row.fps1),
    frameP95: round(row.frameP95),
    frameP99: round(row.frameP99),
    stepAvg: round(row.stepAvg, 2),
    stepP95: round(row.stepP95, 2),
    stepP99: round(row.stepP99, 2),
  } : null;
  return {
    fps: round(read.fps),
    fps1: round(read.fps1),
    frameP95: round(read.frameP95),
    frameP99: round(read.frameP99),
    stepAvg: round(read.stepAvg, 2),
    stepP95: round(read.stepP95, 2),
    stepP99: round(read.stepP99, 2),
    heapMB: read.heap == null ? null : round(read.heap / 1048576),
    peak: read.peak,
    balls: read.balls,
    pendingShots: read.pendingShots,
    pendingDrops: read.pendingDrops,
    lost: read.lost,
    outs: read.outs,
    timeouts: read.timeouts,
    crowdLocked: read.crowdLocked,
    bands: {
      under40: pack(band(0, 40)),
      b40: pack(band(40, 60)),
      b60: pack(band(60, 100)),
      b100: pack(band(100, 180)),
      b180: pack(band(180, 10000)),
    },
  };
}

async function boot(browser, { width, height, full, mode, throttle }) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}');
    saved.sound = false;
    saved.music = false;
    saved.vibrate = false;
    saved.calm = false;
    saved.keepProgress = false;
    delete saved.run;
    localStorage.setItem('ponpon-settings', JSON.stringify(saved));
  });
  const client = await page.context().newCDPSession(page);
  if (throttle) await client.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ponpon && window.__ponpon.queueClock);
  if (mode === '3d') {
    const ok = await page.evaluate(() => window.__ponpon.setRender3D(true));
    if (!ok) throw new Error('3D renderer did not start');
  } else await page.evaluate(() => window.__ponpon.setRender3D(false));
  // Sealing the secret hole keeps a burst from pausing itself, so the overlap
  // is the crowded board rather than the mini-game wait.
  await page.evaluate(() => window.__ponpon.sealHole(true));
  await page.evaluate(on => window.__ponpon.setFullWindow(on), full);
  await page.waitForTimeout(250);
  return page;
}

async function measure(page, ms) {
  await page.evaluate(() => window.__ponpon.perfStart());
  await page.waitForTimeout(ms);
  return summarize(await page.evaluate(() => window.__ponpon.perfRead()));
}

const scenarios = [
  { id: 'x8', ms: 9000, async fire(page) { await page.evaluate(() => window.__ponpon.queueClock(8)); } },
  { id: 'x8x2', ms: 10500, async fire(page) {
    await page.evaluate(() => window.__ponpon.queueClock(8));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__ponpon.queueClock(8));
  } },
  { id: 'x8x3', ms: 12000, async fire(page) {
    await page.evaluate(() => window.__ponpon.queueClock(8));
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.__ponpon.queueClock(8));
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.__ponpon.queueClock(8));
  } },
  { id: 'x8x3-jar', ms: 14000, async fire(page) {
    await page.evaluate(() => { window.__ponpon.queueClock(8); window.__ponpon.queueJar(8); });
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.__ponpon.queueClock(8));
    await page.waitForTimeout(1100);
    await page.evaluate(() => window.__ponpon.queueClock(8));
  } },
];

const views = [
  { id: '2d-normal', mode: '2d', full: false, width: 1280, height: 860 },
  { id: '2d-full', mode: '2d', full: true, width: 1600, height: 1000 },
  { id: '3d-normal', mode: '3d', full: false, width: 1280, height: 860 },
  { id: '3d-full', mode: '3d', full: true, width: 1600, height: 1000 },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-precise-memory-info'],
});
const probe = await boot(browser, views[0]);
const gl = await probe.evaluate(() => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl');
  const ext = context?.getExtension('WEBGL_debug_renderer_info');
  return {
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    renderer: ext ? context.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    mode: window.__ponpon.rendering.mode,
  };
});
await probe.close();

const rows = [];
const preview = await boot(browser, views[0]);
await preview.evaluate(() => { window.__ponpon.queueClock(8); window.__ponpon.queueClock(8); });
await preview.waitForFunction(() => window.__ponpon.crowdLocked && document.querySelector('#launch').classList.contains('is-crowd-locked'), { timeout: 12000 });
await preview.waitForTimeout(800);
const previewUi = await preview.evaluate(() => {
  const before = window.__ponpon.available;
  const launch = window.__ponpon.tryLaunch(0.8, false);
  const canvas = document.querySelector('#crowd-fireworks');
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 3; i < data.length; i += 32) if (data[i] > 16) lit += 1;
  return {
    balls: window.__ponpon.activeBalls,
    locked: window.__ponpon.crowdLocked,
    disabled: document.querySelector('#launch').disabled,
    label: document.querySelector('#launch-label').textContent,
    banner: !document.querySelector('#crowd-banner').hidden,
    classLocked: document.querySelector('#launch').classList.contains('is-crowd-locked'),
    plunger: document.querySelector('#plunger').disabled,
    spent: before - launch.available,
    lit,
  };
});
await mkdir('/opt/cursor/artifacts', { recursive: true });
await preview.screenshot({ path: SHOT });
await preview.close();
console.log('preview', JSON.stringify(previewUi));
let shot = true;

for (const view of views) {
  for (const scenario of scenarios) {
    const page = await boot(browser, view);
    await page.evaluate(() => window.__ponpon.perfStart());
    await scenario.fire(page);
    await page.waitForTimeout(scenario.ms);
    const read = summarize(await page.evaluate(() => window.__ponpon.perfRead()));
    const ui = await page.evaluate(() => {
      const before = window.__ponpon.available;
      const launch = window.__ponpon.tryLaunch(0.8, false);
      const canvas = document.querySelector('#crowd-fireworks');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 3; i < data.length; i += 32) if (data[i] > 16) lit += 1;
      return {
        disabled: document.querySelector('#launch').disabled,
        label: document.querySelector('#launch-label').textContent,
        banner: !document.querySelector('#crowd-banner').hidden,
        classLocked: document.querySelector('#launch').classList.contains('is-crowd-locked'),
        spent: before - launch.available,
        lit,
        mode: window.__ponpon.rendering.mode,
        full: window.__ponpon.fullWindow,
      };
    });
    if (!shot && view.id === '2d-normal' && scenario.id === 'x8x2' && ui.banner) {
      await mkdir('/opt/cursor/artifacts', { recursive: true });
      await page.screenshot({ path: SHOT });
      shot = true;
    }
    rows.push({ view: view.id, scenario: scenario.id, throttle: 1, ...read, ui });
    console.log(`${view.id} ${scenario.id} fps ${read.fps} low ${read.fps1} peak ${read.peak} lost ${read.lost} lock ${read.crowdLocked}`);
    await page.close();
  }
}

for (const view of [views[0], views[2]]) {
  const scenario = scenarios[3];
  const page = await boot(browser, { ...view, throttle: 4 });
  await page.evaluate(() => window.__ponpon.perfStart());
  await scenario.fire(page);
  await page.waitForTimeout(scenario.ms);
  const read = summarize(await page.evaluate(() => window.__ponpon.perfRead()));
  rows.push({ view: view.id, scenario: scenario.id, throttle: 4, ...read });
  console.log(`${view.id} ${scenario.id} throttle4 fps ${read.fps} low ${read.fps1} peak ${read.peak} lost ${read.lost}`);
  await page.close();
}

await browser.close();
const report = { gl, preview: previewUi, rows, shot };
await writeFile(OUT, JSON.stringify(report, null, 2));
console.log('wrote', OUT, 'shot', shot);
