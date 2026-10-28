import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:5174';
const worker = process.env.PROFILE_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: process.env.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : ['--no-sandbox', '--disable-dev-shm-usage'],
});
await mkdir('/opt/cursor/artifacts', { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('ponpon-settings', JSON.stringify({ sound: false, calm: true, music: false, vibrate: false, collections: { 2: 19, 3: 4 } })));
  await page.route('**/src/physics.js*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace('return { engine, balls', `window.__collectionFixture={
      slot(multiplier){
        const column=slotMultipliers(slots).indexOf(multiplier);
        const ball=launch();ball.entered=true;
        Body.setPosition(ball.body,{x:collector.outlets[column].x,y:TABLE.scoreLine-1});
        Body.setVelocity(ball.body,{x:0,y:6});step();
      }
    };return { engine, balls`);
    await route.fulfill({ response, body });
  });
  const epoch = Date.UTC(2026, 9, 10, 12);
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(epoch + 1000);
  await page.goto(base);
  await page.clock.runFor(40);
  assert.equal(errors.join('\n'), '');
  assert.equal(await page.locator('#profile-chip').textContent(), '游客');

  await page.locator('#profile-chip').click();
  await page.screenshot({ path: '/opt/cursor/artifacts/profile-entry.png' });
  const stamp = String(Date.now()).slice(-6);
  const first = `圆${stamp}`;
  const second = `方${stamp}`;
  await page.locator('#profile-mode').click();
  await page.locator('#profile-name').fill(first);
  await page.locator('#profile-pin').fill('1234');
  await page.locator('#profile-submit').click();
  await page.waitForFunction(name => document.querySelector('#profile-chip').textContent === name, first);
  assert.equal(await page.evaluate(() => window.__ponpon.collections[2]), 0, 'logging in does not import this browser\'s guest fruit');

  await page.evaluate(() => window.__collectionFixture.slot(2));
  await page.clock.runFor(30);
  await page.evaluate(() => window.__ponpon.endRound());
  await page.waitForFunction(async (url) => {
    const token = localStorage.getItem('ponpon-session');
    const response = await fetch(`${url}/me`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const data = await response.json();
    return data.fruits?.[2] === 1;
  }, worker);
  assert.equal(await page.evaluate(() => window.__ponpon.collections[2]), 1);

  const token = await page.evaluate(() => localStorage.getItem('ponpon-session'));
  await page.evaluate(async ({ url, token }) => {
    await fetch(`${url}/round-result`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId: '00000000-0000-4000-8000-000000000099', fruits: { 2: 80 } }),
    });
  }, { url: worker, token });
  await page.reload();
  await page.clock.runFor(40);
  await page.waitForFunction(name => document.querySelector('#profile-chip').textContent === name, first);
  await page.evaluate(() => window.__ponpon.collections);
  await page.locator('#collection-button').click();
  await page.locator('[data-collection="2"] .skin-equip').first().click();
  await page.waitForFunction(() => window.__ponpon.equippedSkin === 'cherry');
  await page.screenshot({ path: '/opt/cursor/artifacts/collection-skins-2d.png' });
  await page.locator('#collection-return').click();
  await page.screenshot({ path: '/opt/cursor/artifacts/ball-skin-2d.png', clip: { x: 860, y: 280, width: 520, height: 700 } });
  await page.locator('#settings-button').click();
  await page.locator('#three-d').check();
  await page.locator('#done-settings').click();
  await page.clock.runFor(80);
  await page.locator('#collection-button').click();
  await page.screenshot({ path: '/opt/cursor/artifacts/collection-skins-3d.png' });
  await page.locator('#collection-return').click();
  await page.screenshot({ path: '/opt/cursor/artifacts/ball-skin-3d.png', clip: { x: 700, y: 180, width: 700, height: 760 } });

  await page.locator('#profile-chip').click();
  await page.locator('#profile-logout').click();
  await page.waitForFunction(() => document.querySelector('#profile-chip').textContent === '游客');
  assert.equal(await page.evaluate(() => localStorage.getItem('ponpon-session')), null);
  assert.equal(await page.evaluate(() => window.__ponpon.collections[2]), 19, 'logout restores the guest counts');

  await page.locator('#profile-chip').click();
  await page.locator('#profile-mode').click();
  await page.locator('#profile-name').fill(second);
  await page.locator('#profile-pin').fill('5678');
  await page.locator('#profile-submit').click();
  await page.waitForFunction(name => document.querySelector('#profile-chip').textContent === name, second);
  assert.equal(await page.evaluate(() => window.__ponpon.collections[2]), 0);
  assert.equal(await page.evaluate(() => window.__ponpon.equippedSkin), '');

  await page.locator('#profile-chip').click();
  await page.locator('#profile-logout').click();
  await page.waitForFunction(() => document.querySelector('#profile-chip').textContent === '游客');
  await page.locator('#profile-chip').click();
  if ((await page.locator('#profile-submit').textContent()) !== '登录') await page.locator('#profile-mode').click();
  await page.locator('#profile-name').fill(first);
  await page.locator('#profile-pin').fill('1234');
  await page.locator('#profile-submit').click();
  await page.waitForFunction(() => window.__ponpon.collections[2] === 81 && window.__ponpon.equippedSkin === 'cherry');
  assert.equal(errors.join('\n'), '');
  console.log('PASS: register, saved fruit, logout, a second player, and the original profile.');
} finally {
  await browser.close();
}
