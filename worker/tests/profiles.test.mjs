import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { PIN_FAILS } from '../src/profiles.js';

const scriptPath = fileURLToPath(new URL('../src/index.js', import.meta.url));
const migration = ['0001_profiles.sql', '0002_shine.sql', '0003_gm.sql'].map(name => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');
const runId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const worker = new Miniflare({
  modules: true,
  scriptPath,
  modulesRoot: fileURLToPath(new URL('../../', import.meta.url)),
  modulesRules: [{ type: 'ESModule', include: ['**/*.js'], fallthrough: true }],
  compatibilityDate: '2026-08-01',
  d1Databases: { DB: 'ponpon-profiles-test' },
  bindings: {
    GITHUB_TOKEN: 'test-token',
    GITHUB_OWNER: 'Roukeiyu',
    GITHUB_REPO: 'PACHINKO',
    GITHUB_BRANCH: 'leaderboard-data',
    GITHUB_PATH: 'leaderboard.json',
    CACHE_SECONDS: '0',
  },
});

const db = await worker.getD1Database('DB');
for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) await db.prepare(statement).run();

let address = 1;
async function call(path, { method = 'GET', body, token, ip } = {}) {
  const headers = { Origin: 'https://roukeiyu.github.io', Accept: 'application/json', 'CF-Connecting-IP': ip || `203.0.113.${address}` };
  if (!ip) address += 1;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await worker.dispatchFetch(`https://leaderboard.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

try {
  const missing = await call('/me');
  assert.equal(missing.status, 401);

  const badPin = await call('/register', { method: 'POST', body: { name: '小圆', pin: '12' } });
  assert.equal(badPin.status, 400);
  assert.equal(badPin.body.error, 'invalid_pin');

  const created = await call('/register', { method: 'POST', body: { name: '小圆', pin: '1234', isGm: true, is_gm: 1 } });
  assert.equal(created.status, 201);
  assert.equal(created.body.isGm, false, 'register cannot grant GM');
  assert.equal(created.body.name, '小圆');
  assert.equal(created.body.fruits[2], 0);
  assert.equal(created.body.equipped, '');
  assert.equal(created.body.skins.find(skin => skin.id === 'cherry').unlocked, false);
  const token = created.body.token;
  assert.match(token, /^[0-9a-f]{64}$/);

  const taken = await call('/register', { method: 'POST', body: { name: '小圆', pin: '9999' } });
  assert.equal(taken.status, 409);
  const folded = await call('/register', { method: 'POST', body: { name: 'KEN', pin: '1111' } });
  assert.equal(folded.status, 201);
  const again = await call('/register', { method: 'POST', body: { name: 'ken', pin: '2222' } });
  assert.equal(again.status, 409);

  const me = await call('/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.body.name, '小圆');

  for (let attempt = 0; attempt < PIN_FAILS; attempt++) {
    const wrong = await call('/login', { method: 'POST', ip: '198.51.100.20', body: { name: '小圆', pin: '0000' } });
    assert.equal(wrong.status, attempt === PIN_FAILS - 1 ? 423 : 401);
  }
  const locked = await call('/login', { method: 'POST', ip: '198.51.100.21', body: { name: '小圆', pin: '1234' } });
  assert.equal(locked.status, 423);
  assert.equal(locked.body.error, 'locked');

  await db.prepare('UPDATE profiles SET pin_fails = 0, pin_locked_until = 0 WHERE name = ?').bind('小圆').run();
  const logged = await call('/login', { method: 'POST', body: { name: '小圆', pin: '1234' } });
  assert.equal(logged.status, 200);
  const session = logged.body.token;

  const round = await call('/round-result', { method: 'POST', token: session, body: { runId: runId(1), fruits: { 2: 3, 20: 1 } } });
  assert.equal(round.status, 200);
  assert.equal(round.body.updated, true);
  assert.equal(round.body.fruits[2], 3);
  assert.equal(round.body.fruits[20], 1);
  assert.equal(round.body.skins.find(skin => skin.id === 'cherry').unlocked, false);

  const retry = await call('/round-result', { method: 'POST', token: session, body: { runId: runId(1), fruits: { 2: 3, 20: 1 } } });
  assert.equal(retry.body.updated, false);
  assert.equal(retry.body.fruits[2], 3, 'the same run does not add fruit twice');

  const huge = await call('/round-result', { method: 'POST', token: session, body: { runId: runId(2), fruits: { 2: 900 } } });
  assert.equal(huge.status, 400);

  const lockedSkin = await call('/equip', { method: 'POST', token: session, body: { skin: 'cherry' } });
  assert.equal(lockedSkin.status, 403);
  await call('/round-result', { method: 'POST', token: session, body: { runId: runId(3), fruits: { 2: 80 } } });
  const equipped = await call('/equip', { method: 'POST', token: session, body: { skin: 'cherry' } });
  assert.equal(equipped.status, 200);
  assert.equal(equipped.body.equipped, 'cherry');
  assert.equal((await call('/me', { token: session })).body.equipped, 'cherry');

  await call('/logout', { method: 'POST', token: session });
  assert.equal((await call('/me', { token: session })).status, 401);

  const other = await call('/login', { method: 'POST', body: { name: 'KEN', pin: '1111' } });
  assert.equal(other.body.fruits[2], 0, 'another profile does not see the first collection');
  const back = await call('/login', { method: 'POST', body: { name: '小圆', pin: '1234' } });
  assert.equal(back.body.fruits[2], 83);
  assert.equal(back.body.equipped, 'cherry');

  const live = back.body.token;
  const shy = await call('/round-result', { method: 'POST', token: live, body: { runId: runId(8), fruits: { 2: 1 }, score: 1000005 } });
  assert.equal(shy.status, 400);
  assert.equal(shy.body.error, 'invalid_score');
  const almost = await call('/round-result', { method: 'POST', token: live, body: { runId: runId(8), fruits: { 2: 1 }, score: 999990 } });
  assert.equal(almost.status, 200);
  assert.equal(almost.body.shineUnlocked, false);
  const denied = await call('/equip', { method: 'POST', token: live, body: { skin: 'shine' } });
  assert.equal(denied.status, 403);
  const legend = await call('/round-result', { method: 'POST', token: live, body: { runId: runId(9), score: 1000000, fruits: { 2: 1 } } });
  assert.equal(legend.body.shineJustUnlocked, true);
  assert.equal(legend.body.shineUnlocked, true);
  const repeat = await call('/round-result', { method: 'POST', token: live, body: { runId: runId(9), score: 1000000, fruits: { 2: 1 } } });
  assert.equal(repeat.body.updated, false);
  assert.equal(repeat.body.shineJustUnlocked, false);
  assert.equal(repeat.body.fruits[2], legend.body.fruits[2]);
  const worn = await call('/equip', { method: 'POST', token: live, body: { skin: 'shine' } });
  assert.equal(worn.body.equipped, 'shine');
  assert.equal(worn.body.isGm, false);
  await db.prepare('UPDATE profiles SET is_gm = 1 WHERE name = ?').bind('小圆').run();
  const promoted = await call('/me', { token: live });
  assert.equal(promoted.body.isGm, true);
  const stillGuest = await call('/me', { token: other.body.token });
  assert.equal(stillGuest.body.isGm, false, 'another profile stays a normal account');
  console.log('PASS: register, PIN lock, idempotent fruit, skins, and separate profiles.');
} finally {
  await worker.dispose();
}
