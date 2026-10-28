// Leaderboard API. Preset rows come from the game so the two lists cannot drift.
// Real rows live in leaderboard.json on the leaderboard-data branch, never on main.
import { SUBMIT_LIMIT_PER_MINUTE, RATE_WINDOW_MS, allowedOrigin, decodeBase64, encodeBase64, mergeTop, validateSubmission } from './rules.js';
import { handleProfile } from './profiles.js';

const buckets = new Map();

function cacheSeconds(env) {
  const value = Number(env.CACHE_SECONDS ?? 45);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function apiBase(env) {
  return String(env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/+$/, '');
}

function githubHeaders(env, json = false) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'ponpon-leaderboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function repoPath(env, suffix) {
  return `${apiBase(env)}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${suffix}`;
}

function allowSubmit(ip, now) {
  const recent = (buckets.get(ip) || []).filter(time => now - time < RATE_WINDOW_MS);
  if (recent.length >= SUBMIT_LIMIT_PER_MINUTE) {
    buckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  buckets.set(ip, recent);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value);
  return true;
}

function json(body, status, origin, extra) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  if (extra) for (const [key, value] of new Headers(extra)) if (value) headers.set(key, value);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function empty(status, origin, extra) {
  const headers = new Headers(extra);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return new Response(null, { status, headers });
}

function routeOf(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/top') return 'top';
  if (path === '/submit') return 'submit';
  if (path === '/register') return 'register';
  if (path === '/login') return 'login';
  if (path === '/logout') return 'logout';
  if (path === '/me') return 'me';
  if (path === '/round-result') return 'round';
  if (path === '/equip') return 'equip';
  return '';
}

function readEntries(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  return Array.isArray(entries) ? entries : [];
}

function applyScore(entries, submission, now) {
  const index = entries.findIndex(entry => entry && entry.runId === submission.runId);
  if (index >= 0) {
    const current = Number(entries[index].score) || 0;
    if (submission.score <= current) return { entries, updated: false, score: current };
    const next = entries.slice();
    next[index] = { ...entries[index], score: submission.score, updatedAt: now };
    return { entries: next, updated: true, score: submission.score };
  }
  return {
    entries: [...entries, { runId: submission.runId, name: submission.name, score: submission.score, updatedAt: now }],
    updated: true,
    score: submission.score,
  };
}

async function readBoard(env) {
  const url = `${repoPath(env, `/contents/${env.GITHUB_PATH}`)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders(env) });
  if (response.status === 404) {
    const detail = await response.text();
    const missingBranch = /no commit found|branch not found|not a valid ref/i.test(detail);
    return { entries: [], sha: null, missingBranch };
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`github read ${response.status} ${detail.slice(0, 180)}`);
  }
  const data = await response.json();
  const parsed = JSON.parse(decodeBase64(data.content || ''));
  return { entries: readEntries(parsed), sha: data.sha || null, missingBranch: false };
}

async function ensureBranch(env) {
  const headers = githubHeaders(env, true);
  const main = await fetch(repoPath(env, '/git/ref/heads/main'), { headers });
  if (!main.ok) throw new Error(`github main ref ${main.status}`);
  const mainData = await main.json();
  const created = await fetch(repoPath(env, '/git/refs'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${env.GITHUB_BRANCH}`, sha: mainData.object.sha }),
  });
  if (!created.ok && created.status !== 422) throw new Error(`github branch ${created.status}`);
}

async function writeBoard(env, entries, sha, message) {
  const body = { message, content: encodeBase64(`${JSON.stringify({ entries }, null, 2)}\n`), branch: env.GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const response = await fetch(repoPath(env, `/contents/${env.GITHUB_PATH}`), {
    method: 'PUT',
    headers: githubHeaders(env, true),
    body: JSON.stringify(body),
  });
  return response;
}

async function saveScore(env, submission) {
  const now = new Date().toISOString();
  const message = `score: ${submission.name} ${submission.score}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const board = await readBoard(env);
    if (board.missingBranch) await ensureBranch(env);
    const applied = applyScore(board.entries, submission, now);
    if (!applied.updated) return { updated: false, score: applied.score, name: submission.name };
    const response = await writeBoard(env, applied.entries, board.sha, message);
    if (response.ok) return { updated: true, score: applied.score, name: submission.name };
    if (response.status !== 409 && response.status !== 422) {
      const detail = await response.text();
      throw new Error(`github write ${response.status} ${detail.slice(0, 180)}`);
    }
  }
  throw new Error('github conflict');
}

function cacheKey(request) {
  return new Request(new URL('/top', request.url), { method: 'GET' });
}

async function readTop(request, env, ctx) {
  const seconds = cacheSeconds(env);
  const cache = seconds > 0 ? caches.default : null;
  const key = cacheKey(request);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { status: hit.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${seconds}` } });
  }
  const board = await readBoard(env);
  const payload = mergeTop(board.entries);
  const response = new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${seconds || 0}` },
  });
  if (cache) ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

async function clearTopCache(request) {
  await caches.default.delete(cacheKey(request));
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() || 'unknown';
}

export default {
  async fetch(request, env, ctx) {
    const originHeader = request.headers.get('Origin');
    const origin = allowedOrigin(originHeader);
    if (originHeader && !origin) return json({ ok: false, error: 'forbidden_origin' }, 403, '');
    const route = routeOf(new URL(request.url).pathname);
    if (!route) return json({ ok: false, error: 'not_found' }, 404, origin);
    if (request.method === 'OPTIONS') return empty(204, origin);
    if (route !== 'top' && route !== 'submit') {
      if (!env.DB) return json({ ok: false, error: 'not_configured' }, 503, origin);
      return handleProfile(request, env, route, origin, json);
    }
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_BRANCH || !env.GITHUB_PATH) {
      return json({ ok: false, error: 'not_configured' }, 503, origin);
    }
    try {
      if (route === 'top') {
        if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
        const response = await readTop(request, env, ctx);
        return json(await response.json(), response.status, origin, { 'Cache-Control': response.headers.get('Cache-Control') });
      }
      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
      if (!allowSubmit(clientIp(request), Date.now())) {
        return json({ ok: false, error: 'rate_limited' }, 429, origin, { 'Retry-After': '60' });
      }
      const raw = await request.text();
      if (raw.length > 2000) return json({ ok: false, error: 'invalid_json' }, 400, origin);
      let body;
      try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid_json' }, 400, origin); }
      const submission = validateSubmission(body);
      if (submission.error) return json({ ok: false, error: submission.error }, 400, origin);
      const saved = await saveScore(env, submission);
      if (saved.updated && cacheSeconds(env) > 0) ctx.waitUntil(clearTopCache(request));
      return json({ ok: true, ...saved }, 200, origin);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'leaderboard failed');
      return json({ ok: false, error: 'github_error' }, 502, origin);
    }
  },
};
