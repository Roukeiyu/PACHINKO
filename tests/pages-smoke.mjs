// Exercise the actual production build under GitHub Pages' repository subpath.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('dist');
const prefix = '/PACHINKO/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const file = resolve(root, path.slice(prefix.length) || 'index.html');
  if (relative(root, file).startsWith('..')) { res.writeHead(403).end(); return; }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
  const page = await browser.newPage();
  const epoch = Date.UTC(2026,9,9,12);
  await page.clock.setFixedTime(epoch);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => errors.push(req.url()));
  page.on('response', res => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  assert.equal(await page.locator('#board').getAttribute('data-renderer'), '2d');
  assert.equal(await page.locator('#three-d').isChecked(), false);
  assert.equal(await page.locator('#camera-angle').count(), 0);
  async function toggleAuto() {
    await page.locator('#settings-button').click();
    await page.locator('#auto').click();
    await page.locator('#done-settings').click();
  }
  await toggleAuto();
  await page.waitForFunction(() => Number(document.querySelector('#score').textContent.replaceAll(',', '')) > 0, null, { timeout: 30000 });
  await toggleAuto();
  await page.locator('#settings-button').click();
  await page.locator('[data-slots="9"]').click();
  await page.locator('.theme-choice[data-theme="flower"]').click();
  await page.locator('#three-d').check();
  assert.equal(await page.locator('#board').getAttribute('data-renderer'), 'webgl');
  await page.locator('#time-flow').check();
  await page.clock.setFixedTime(epoch + 330000);
  await page.waitForFunction(() => document.querySelector('#time-phase').textContent === '夜间');
  const night = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g).slice(0,3).map(Number));
  assert.ok(night[2] > night[0] && Math.max(...night) < 100, 'production CSS and canvas mode share the night palette');
  await page.locator('#done-settings').click();
  await page.reload();
  assert.equal(await page.locator('#settings .theme-choice[data-theme="flower"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.theme-card, .theme-pill').count(), 0);
  assert.equal(await page.locator('[data-slots="9"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => typeof window.__ponpon), 'undefined');
  assert.equal(await page.locator('#time-flow').isChecked(), true);
  assert.equal(await page.locator('#time-phase').textContent(), '夜间', 'the production build restores the saved cycle phase');
  assert.equal(await page.locator('#three-d').isChecked(), true);
  assert.equal(await page.locator('#board').getAttribute('data-renderer'), 'webgl');
  await page.locator('#settings-button').click(); await page.locator('#three-d').uncheck();
  await page.reload();
  assert.equal(await page.locator('#board').getAttribute('data-renderer'), '2d');
  assert.equal(await page.locator('#three-d').isChecked(), false);
  // Hidden GM shortcuts and mini-game scoring must work in the production
  // bundle too, without relying on development-only diagnostics or fixtures.
  const beforeMini=await page.locator('#score').textContent();
  await page.locator('#settings-button').click();
  for(let i=0;i<3;i++) await page.locator('#gm-dot').click();
  assert.equal(await page.locator('#gm-tools').isVisible(),true);
  await page.locator('[data-mini="pairs"]').click();
  assert.equal(await page.locator('#mini-grid button').count(),40);
  await page.evaluate(()=>{
    const pairs=new Map();
    for(const button of document.querySelectorAll('#mini-grid button')) {const group=pairs.get(button.textContent)||[];group.push(button);pairs.set(button.textContent,group);}
    for(const group of pairs.values()) for(const button of group) button.click();
  });
  assert.equal(await page.locator('#mini-score').textContent(),'1,000');
  assert.equal(await page.locator('#mini-result').isVisible(),true);
  assert.equal(Number((await page.locator('#score').textContent()).replaceAll(',','')),Number(beforeMini.replaceAll(',',''))+1000);
  await page.locator('#mini-return').click();
  assert.equal(await page.locator('#settings').evaluate(el=>el.open),true);
  assert.deepEqual(errors, []);
  console.log('PASS: production assets load under /PACHINKO/, a ball scores, 2D/3D switching and preferences persist, GM mini-games score correctly, and no browser errors occur.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
