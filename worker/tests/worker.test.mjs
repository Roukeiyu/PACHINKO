import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { decodeBase64, encodeBase64, SCORE_MAX, SCORE_MIN, SUBMIT_LIMIT_PER_MINUTE } from '../src/rules.js';

const scriptPath = fileURLToPath(new URL('../src/index.js', import.meta.url));
const runId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function startGithub() {
  const state = { sha: 'sha-1', entries: null, gets: 0, puts: [], failPuts: 0, branchMissing: false, refs: 0 };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== 'Bearer test-token' || req.headers['user-agent'] !== 'ponpon-leaderboard') {
      send(401, { message: 'bad credentials' });
      return;
    }
    if (req.method === 'GET' && url.pathname.endsWith('/contents/leaderboard.json')) {
      state.gets += 1;
      if (!url.searchParams.get('ref') || url.searchParams.get('ref') === 'main') {
        send(400, { message: 'ref must be the data branch' });
        return;
      }
      if (state.branchMissing) {
        send(404, { message: 'No commit found for the ref leaderboard-data' });
        return;
      }
      if (state.entries === null) {
        send(404, { message: 'Not Found' });
        return;
      }
      send(200, { sha: state.sha, encoding: 'base64', content: encodeBase64(`${JSON.stringify({ entries: state.entries }, null, 2)}\n`) });
      return;
    }
    if (req.method === 'PUT' && url.pathname.endsWith('/contents/leaderboard.json')) {
      const body = JSON.parse(raw);
      if (state.failPuts > 0) {
        state.failPuts -= 1;
        send(409, { message: 'conflict' });
        return;
      }
      if (state.entries !== null && body.sha !== state.sha) {
        send(409, { message: 'sha mismatch' });
        return;
      }
      state.entries = JSON.parse(decodeBase64(body.content)).entries;
      state.sha = `sha-${state.puts.length + 2}`;
      state.puts.push(body);
      send(200, { content: { sha: state.sha } });
      return;
    }
    if (req.method === 'GET' && url.pathname.endsWith('/git/ref/heads/main')) {
      send(200, { object: { sha: 'main-sha' } });
      return;
    }
    if (req.method === 'POST' && url.pathname.endsWith('/git/refs')) {
      state.refs += 1;
      state.branchMissing = false;
      send(201, { ref: 'refs/heads/leaderboard-data' });
      return;
    }
    send(404, { message: `unexpected ${req.method} ${url.pathname}` });
  });
  server.listen(0, '127.0.0.1');
  return once(server, 'listening').then(() => ({
    state,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  }));
}

async function startWorker(apiBase, cacheSeconds = '0') {
  const worker = new Miniflare({
    modules: true,
    scriptPath,
    modulesRoot: fileURLToPath(new URL('../../', import.meta.url)),
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'], fallthrough: true }],
    compatibilityDate: '2026-08-01',
    bindings: {
      GITHUB_TOKEN: 'test-token',
      GITHUB_OWNER: 'Roukeiyu',
      GITHUB_REPO: 'PACHINKO',
      GITHUB_BRANCH: 'leaderboard-data',
      GITHUB_PATH: 'leaderboard.json',
      GITHUB_API_BASE: apiBase,
      CACHE_SECONDS: cacheSeconds,
    },
  });
  let address = 1;
  async function call(path, { method = 'GET', origin = 'https://roukeiyu.github.io', body, ip } = {}) {
    const headers = { Origin: origin, Accept: 'application/json', 'CF-Connecting-IP': ip || `203.0.113.${address}` };
    if (!ip) address += 1;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await worker.dispatchFetch(`https://leaderboard.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  }
  return { worker, call, close: () => worker.dispose() };
}

const github = await startGithub();
const app = await startWorker(github.base);
try {
  const preflight = await app.call('/top', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://roukeiyu.github.io');
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);

  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:8787', 'http://[::1]:5173']) {
    const local = await app.call('/submit', { method: 'OPTIONS', origin });
    assert.equal(local.status, 204, origin);
    assert.equal(local.headers.get('access-control-allow-origin'), origin);
  }

  const blocked = await app.call('/top', { origin: 'https://evil.example' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  assert.equal(github.state.gets, 0, 'a rejected origin never reads GitHub');

  const empty = await app.call('/top');
  assert.equal(empty.status, 200);
  assert.equal(empty.body.entries.length, 20);
  assert.equal(empty.body.entries[0].name, 'AAA');
  assert.equal(empty.body.entries[0].score, 101220);
  assert.equal(empty.body.entries.at(-1).name, 'Z');

  const rejected = [
    [{ runId: runId(1), name: '', score: 50000 }, 'invalid_name'],
    [{ runId: runId(1), name: 'ABCDEFGHIJKLM', score: 50000 }, 'invalid_name'],
    [{ runId: runId(1), name: 'KEN', score: SCORE_MIN - 10 }, 'invalid_score'],
    [{ runId: runId(1), name: 'KEN', score: 50005 }, 'invalid_score'],
    [{ runId: runId(1), name: 'KEN', score: SCORE_MAX + 10 }, 'invalid_score'],
    [{ runId: runId(1), name: 'KEN', score: '50000' }, 'invalid_score'],
    [{ runId: 'not a run', name: 'KEN', score: 50000 }, 'invalid_run'],
  ];
  for (const [body, error] of rejected) {
    const response = await app.call('/submit', { method: 'POST', body });
    assert.equal(response.status, 400, error);
    assert.equal(response.body.error, error);
  }
  assert.equal(github.state.puts.length, 0, 'invalid submissions do not write');

  const created = await app.call('/submit', { method: 'POST', body: { runId: runId(1), name: 'KEN\u0000', score: 52340 } });
  assert.equal(created.status, 200);
  assert.equal(created.body.updated, true);
  assert.equal(github.state.puts[0].message, 'score: KEN 52340');
  assert.equal(github.state.puts[0].branch, 'leaderboard-data');
  assert.equal(github.state.entries[0].name, 'KEN');
  assert.equal(github.state.entries[0].score, 52340);

  const lower = await app.call('/submit', { method: 'POST', body: { runId: runId(1), name: 'OTHER', score: 50000 } });
  assert.equal(lower.body.updated, false);
  assert.equal(lower.body.score, 52340);
  assert.equal(github.state.puts.length, 1);
  assert.equal(github.state.entries[0].name, 'KEN');

  const higher = await app.call('/submit', { method: 'POST', body: { runId: runId(1), name: 'RENAME', score: 60000 } });
  assert.equal(higher.body.updated, true);
  assert.equal(github.state.entries.filter(entry => entry.runId === runId(1)).length, 1);
  assert.equal(github.state.entries[0].name, 'KEN', 'the first name stays');
  assert.equal(github.state.entries[0].score, 60000);

  github.state.failPuts = 1;
  const retried = await app.call('/submit', { method: 'POST', body: { runId: runId(2), name: 'ACE', score: 70000 } });
  assert.equal(retried.status, 200);
  assert.equal(github.state.entries.some(entry => entry.runId === runId(2) && entry.score === 70000), true);

  for (let index = 0; index < 25; index++) {
    const response = await app.call('/submit', { method: 'POST', body: { runId: runId(100 + index), name: index % 2 ? `小${index}` : `P${index}`, score: 300000 - index * 10 } });
    assert.equal(response.status, 200, `row ${index}`);
  }
  assert.equal(github.state.entries.length, 27, 'every submission is kept, including rows outside the top 20');
  const top = await app.call('/top');
  assert.equal(top.body.entries.length, 20);
  assert.equal(top.body.entries[0].score, 300000);
  assert.equal(top.body.entries[19].score, 300000 - 19 * 10);
  assert.equal(top.body.entries.some(entry => entry.name === 'AAA'), false);
  assert.equal(top.headers.get('access-control-allow-origin'), 'https://roukeiyu.github.io');

  github.state.branchMissing = true;
  github.state.entries = null;
  const firstOnBranch = await app.call('/submit', { method: 'POST', body: { runId: runId(9), name: '小弹珠', score: SCORE_MIN } });
  assert.equal(firstOnBranch.status, 200);
  assert.equal(github.state.refs, 1);
  assert.equal(github.state.branchMissing, false);
  assert.equal(github.state.entries[0].name, '小弹珠');

  const limited = [];
  for (let index = 0; index < SUBMIT_LIMIT_PER_MINUTE + 1; index++) {
    limited.push(await app.call('/submit', { method: 'POST', ip: '198.51.100.10', body: { runId: runId(500 + index), name: 'LIM', score: 80000 + index * 10 } }));
  }
  assert.equal(limited.at(-2).status, 200);
  assert.equal(limited.at(-1).status, 429);
  assert.equal(limited.at(-1).body.error, 'rate_limited');
  assert.equal(limited.at(-1).headers.get('retry-after'), '60');
  assert.equal(limited.at(-1).headers.get('access-control-allow-origin'), 'https://roukeiyu.github.io');

  console.log('PASS: validation, higher score per run, preset merge, stored history, conflict retry, and CORS.');
} finally {
  await app.close();
  await github.close();
}

const cachedGithub = await startGithub();
const cached = await startWorker(cachedGithub.base, '45');
try {
  await cached.call('/top');
  await cached.call('/top');
  assert.equal(cachedGithub.state.gets, 1, 'the top list is cached');
  await cached.call('/submit', { method: 'POST', body: { runId: runId(7), name: 'CACHE', score: 90000 } });
  const fresh = await cached.call('/top');
  assert.ok(cachedGithub.state.gets >= 2, 'a new score drops the cache');
  assert.equal(fresh.body.entries.some(entry => entry.name === 'CACHE'), true);
  console.log('PASS: top responses stay cached until a higher score is stored.');
} finally {
  await cached.close();
  await cachedGithub.close();
}
