import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  assert.equal(await page.evaluate(() => window.__ponpon.audioState), undefined, 'loading the page never creates or starts audio');
  const measures = await page.evaluate(async () => {
    const { renderMusic, createBackgroundMusic } = await import('/src/music.js');
    const measurements = [];
    for (const rate of [44100, 48000]) {
      const { intro, loop, introDuration, loopDuration } = await renderMusic(rate);
      const a = intro.getChannelData(0), b = loop.getChannelData(0);
      let peak = 0, energy = 0, stereo = 0, minimumWindowRms = Infinity;
      for (let i = 0; i < b.length; i++) {
        peak = Math.max(peak, Math.abs(b[i])); energy += b[i] ** 2;
        stereo += (b[i] - loop.getChannelData(1)[i]) ** 2;
      }
      for (let start = 0; start < b.length; start += rate / 4) {
        let sum = 0, end = Math.min(b.length, start + rate / 4);
        for (let i = start; i < end; i++) sum += b[i] ** 2;
        minimumWindowRms = Math.min(minimumWindowRms, Math.sqrt(sum / (end - start)));
      }
      measurements.push({ rate, introDuration, loopDuration, introLength: intro.length, loopLength: loop.length,
        peak, rms: Math.sqrt(energy / b.length), stereo: Math.sqrt(stereo / b.length), minimumWindowRms,
        seam: Math.abs(b[0] - b.at(-1)), transition: Math.abs(b[0] - a.at(-1)) });
    }
    // Render the actual playback controller through two complete B repetitions.
    const ctx = new OfflineAudioContext(2, 44100 * 61, 44100);
    const player = createBackgroundMusic(ctx); player.setEnabled(true, .5);
    const deadline = performance.now() + 10000;
    while (!player.status.ready && !player.status.error && performance.now() < deadline) await new Promise(r => setTimeout(r, 10));
    if (!player.status.ready) throw new Error(player.status.error || 'Music preparation timed out');
    const status = player.status, output = await ctx.startRendering(), data = output.getChannelData(0);
    const first = Math.round((status.startedAt + status.introDuration) * ctx.sampleRate);
    const length = Math.round(status.loopDuration * ctx.sampleRate);
    let difference = 0, loopRms = 0, beforeStart = 0;
    for (let i = 0; i < first; i++) if (i < status.startedAt * ctx.sampleRate) beforeStart = Math.max(beforeStart, Math.abs(data[i]));
    for (let i = 0; i < length; i++) { difference = Math.max(difference, Math.abs(data[first+i] - data[first+length+i])); loopRms += data[first+i] ** 2; }
    return { measurements, scheduled: { difference, loopRms: Math.sqrt(loopRms / length), beforeStart, finalSection: player.status.section } };
  });
  for (const m of measures.measurements) {
    assert.ok(Math.abs(m.introDuration - 20/3) <= 1/m.rate);
    assert.ok(Math.abs(m.loopDuration - 80/3) <= 1/m.rate);
    assert.equal(m.introLength, Math.round(m.introDuration*m.rate));
    assert.equal(m.loopLength, Math.round(m.loopDuration*m.rate));
    assert.ok(m.peak > .2 && m.peak <= .651, 'the musical signal stays below clipping');
    assert.ok(m.rms > .03 && m.minimumWindowRms > .005, 'no silent gap anywhere in the loop');
    assert.ok(m.stereo > .005, 'stereo accompaniment survives rendering');
    assert.ok(m.seam < .004, `smooth B→B sample seam at ${m.rate}: ${m.seam}`);
    assert.ok(m.transition < .004, `smooth A→B sample seam at ${m.rate}: ${m.transition}`);
  }
  assert.ok(measures.scheduled.difference < .00001, 'the real controller repeats B with identical audio and no replayed A');
  assert.ok(measures.scheduled.loopRms > .005);
  assert.equal(measures.scheduled.beforeStart, 0);
  assert.equal(measures.scheduled.finalSection, 'B');
  console.log('PASS: A→B→B audio scheduling, sample continuity, stereo signal, headroom and no silent gaps at 44.1/48 kHz.', JSON.stringify(measures));

  await page.locator('#settings-button').click();
  await page.waitForFunction(() => window.__ponpon.music?.ready);
  assert.equal(await page.evaluate(() => window.__ponpon.audioState), 'running');
  assert.equal(await page.evaluate(() => window.__ponpon.music.section), 'A');
  const startedAt = await page.evaluate(() => window.__ponpon.music.startedAt);
  await page.locator('#music-volume').fill('18');
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.__ponpon.musicVolume), .18);
  assert.ok(Math.abs(await page.evaluate(() => window.__ponpon.music.gain) - .18 * .24) < .001);
  await page.locator('#music').uncheck(); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.__ponpon.music.enabled), false);
  assert.ok(await page.evaluate(() => window.__ponpon.music.gain < .001));
  assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'), 'true', 'music can be disabled while effects remain enabled');
  await page.locator('#music').check();
  await page.waitForFunction(() => window.__ponpon.music.section === 'B', null, { timeout: 10000 });
  await page.locator('#done-settings').click();
  await page.locator('#sound-button').click(); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.__ponpon.music.enabled), false, 'global mute includes background music');
  assert.ok(await page.evaluate(() => window.__ponpon.music.gain < .001));
  await page.locator('#sound-button').click();
  assert.equal(await page.evaluate(() => window.__ponpon.music.section), 'B');
  assert.equal(await page.evaluate(() => window.__ponpon.music.startedAt), startedAt, 'toggling music and mute never repeats A');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__ponpon.audioState === 'suspended');
  const pausedAt = await page.evaluate(() => window.__ponpon.music.elapsed);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__ponpon.music.elapsed), pausedAt, 'audio clock and music freeze while hidden');
  await page.evaluate(() => {
    delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => window.__ponpon.audioState === 'running');
  assert.equal(await page.evaluate(() => window.__ponpon.music.startedAt), startedAt);
  await page.locator('#settings-button').click(); await page.locator('#music').uncheck();
  await page.reload();
  assert.equal(await page.evaluate(() => window.__ponpon.audioState), undefined, 'reload waits for another user gesture');
  await page.locator('#settings-button').click();
  assert.equal(await page.locator('#music').isChecked(), false);
  assert.equal(await page.locator('#music-volume').inputValue(), '18');
  assert.equal(await page.evaluate(() => window.__ponpon.music.ready), false, 'saved disabled music does not render');
  await page.locator('#music').check();
  await page.waitForFunction(() => window.__ponpon.music?.section === 'A');
  assert.deepEqual(errors, []);
  console.log('PASS: first-gesture playback, independent music switch/volume, global mute, background pause/resume and saved preferences.');
} finally { await browser.close(); }
