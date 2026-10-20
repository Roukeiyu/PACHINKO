import assert from 'node:assert/strict';
import { PRESET_BOARD, LEADERBOARD_LIMIT, LEADERBOARD_QUALIFY_SCORE, sanitizeName, createLeaderboard } from '../src/leaderboard.js';

const scores = PRESET_BOARD.map(entry => entry.score);
assert.equal(PRESET_BOARD.length, 20);
assert.equal(scores[0], 101220);
assert.equal(scores.at(-1), 50010);
assert.ok(scores.every((score, index) => score % 10 === 0 && (index === 0 || score < scores[index - 1])));
assert.ok(PRESET_BOARD.every(entry => [...entry.name].length >= 1 && [...entry.name].length <= 12));
assert.deepEqual(PRESET_BOARD.map(entry => entry.score), scores, 'the preset list is fixed across reads');
assert.equal(LEADERBOARD_QUALIFY_SCORE, 50000);

assert.equal(sanitizeName('  KEN  '), 'KEN');
assert.equal(sanitizeName('小弹珠'), '小弹珠');
assert.equal(sanitizeName('<img src=x>'), '<img src=x>');
assert.equal(sanitizeName(''), null);
assert.equal(sanitizeName('   '), null);
assert.equal(sanitizeName('ABCDEFGHIJKLM'), null);
assert.equal([...sanitizeName('一二三四五六七八九十十一')].length, 12);

function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

const local = createLeaderboard({ storage: memory() });
assert.equal((await local.fetchTop()).length, LEADERBOARD_LIMIT);
assert.equal((await local.fetchTop())[0].name, 'AAA');
assert.equal((await local.fetchTop())[19].name, 'Z');
for (let i = 0; i < 30; i++) await local.submit({ runId: `r${i}`, name: `P${i}`, score: 200000 - i * 10 });
assert.equal(local.readSaved().length, 30, 'rows past the top 20 stay stored');
assert.equal((await local.fetchTop()).length, 20);
assert.equal((await local.fetchTop())[0].score, 200000);
assert.equal((await local.fetchTop()).some(entry => entry.score === 200000 - 29 * 10), false);
assert.equal(local.readSaved().some(entry => entry.score === 200000 - 29 * 10), true);
await local.submit({ runId: 'r0', name: 'RENAME', score: 210000 });
assert.equal(local.readSaved().filter(entry => entry.runId === 'r0').length, 1);
assert.equal(local.readSaved().find(entry => entry.runId === 'r0').name, 'P0');
assert.equal(local.readSaved().find(entry => entry.runId === 'r0').score, 210000);

const calls = [];
const remote = createLeaderboard({
  url: 'https://leaderboard.example/scores',
  storage: memory(),
  fetchImpl: async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    if (init.method === 'GET') return { ok: true, json: async () => [{ name: 'SRV', score: 42 }] };
    return { ok: false, status: 503, json: async () => ({}) };
  },
});
assert.deepEqual((await remote.fetchTop()).map(entry => entry.name), ['SRV']);
assert.equal(calls[0].headers.Authorization, undefined);
assert.equal(calls[0].headers.authorization, undefined);
await remote.submit({ runId: 'run', name: '<img src=x>', score: 60000 });
assert.equal(remote.readSaved()[0].name, '<img src=x>');
assert.equal(calls.at(-1).method, 'POST');
assert.equal(calls.at(-1).headers.Authorization, undefined);
const failed = createLeaderboard({
  url: 'https://leaderboard.example/scores',
  storage: memory(),
  fetchImpl: async () => { throw new Error('offline'); },
});
assert.equal((await failed.fetchTop())[0].name, 'AAA', 'a failed request falls back to the local board');
console.log('PASS: fixed preset ranks, saved rows beyond 20, name limits, and token-free fetch with local fallback.');
