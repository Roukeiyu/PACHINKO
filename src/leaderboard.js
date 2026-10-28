// Front-end leaderboard. Preset rows are a fixed list: generated once, never reshuffled.
// VITE_LEADERBOARD_URL is the worker origin, without a path. Requests go to /top and /submit.
// No token is sent. An empty URL, or a failed request, keeps using this browser's saved rows.

export const LEADERBOARD_LIMIT = 20;
export const LEADERBOARD_QUALIFY_SCORE = 50000;
export const NAME_MAX_LENGTH = 12;
export const LEADERBOARD_STORAGE_KEY = 'ponpon-leaderboard';
export const LEADERBOARD_OUTBOX_KEY = 'ponpon-leaderboard-outbox';

export const LEADERBOARD_ERRORS = {
  offline: '排行榜连不上，名字先记在这台设备上，连上后再送',
  rate_limited: '排行榜这会儿太忙，名字先记着，待会儿再送',
  github_error: '排行榜没送成，名字先记着，待会儿再送',
  not_configured: '排行榜还没准备好，名字先记着，待会儿再送',
  invalid_score: '这局分数没有达到排行榜的要求',
  invalid_name: '这个名字排行榜没有收下',
  invalid_run: '这一局的编号排行榜没有收下',
};

// Rank 1 is 101220 and rank 20 is 50010. The eighteen scores between them were
// drawn once from a seeded generator, then frozen. Every value is a multiple of 10.
export const PRESET_BOARD = Object.freeze([
  Object.freeze({ name: 'AAA', score: 101220 }),
  Object.freeze({ name: 'KEN', score: 98450 }),
  Object.freeze({ name: 'QWERTY', score: 96950 }),
  Object.freeze({ name: '小弹珠', score: 92870 }),
  Object.freeze({ name: 'ASS', score: 88160 }),
  Object.freeze({ name: 'ASDF', score: 84970 }),
  Object.freeze({ name: 'ZZZ', score: 82160 }),
  Object.freeze({ name: 'JJJJ', score: 79970 }),
  Object.freeze({ name: '???', score: 78320 }),
  Object.freeze({ name: 'ACE7', score: 77090 }),
  Object.freeze({ name: '夜猫子', score: 73570 }),
  Object.freeze({ name: 'R2D2', score: 71530 }),
  Object.freeze({ name: 'PON99', score: 67500 }),
  Object.freeze({ name: 'Q', score: 63870 }),
  Object.freeze({ name: 'HIROSHI', score: 59950 }),
  Object.freeze({ name: '8BIT', score: 57240 }),
  Object.freeze({ name: '快乐星', score: 55400 }),
  Object.freeze({ name: 'PLAYER1', score: 53240 }),
  Object.freeze({ name: 'MIKU', score: 51560 }),
  Object.freeze({ name: 'Z', score: 50010 }),
]);

export function createRunId() {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeName(value) {
  const name = String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  const chars = [...name];
  if (chars.length < 1 || chars.length > NAME_MAX_LENGTH) return null;
  return chars.join('');
}

export function rankEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'en'));
}

export function topEntries(entries, limit = LEADERBOARD_LIMIT) {
  return rankEntries(entries).slice(0, limit);
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* private mode or a non-browser test */ }
  return memoryStorage();
}

function retryableFailure(code, status) {
  if (!status) return true;
  if (status === 429 || status >= 500) return true;
  return code === 'offline' || code === 'rate_limited' || code === 'github_error' || code === 'not_configured';
}

function remoteUrls(url) {
  const base = String(url || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  return { top: `${base}/top`, submit: `${base}/submit` };
}

function asScore(value) {
  const score = Math.floor(Number(value));
  return Number.isSafeInteger(score) && score > 0 ? score : 0;
}

function normalize(entry) {
  const name = sanitizeName(entry?.name);
  const score = asScore(entry?.score);
  if (!name || !score) return null;
  const runId = entry?.runId ? String(entry.runId).slice(0, 80) : '';
  return { name, score, runId };
}

export function createLeaderboard({ url = '', storage, fetchImpl, presets = PRESET_BOARD } = {}) {
  const store = resolveStorage(storage);
  const request = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const endpoint = remoteUrls(url);

  function readSaved() {
    try {
      const parsed = JSON.parse(store.getItem(LEADERBOARD_STORAGE_KEY) || '{"entries":[]}');
      const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
      return entries.map(normalize).filter(Boolean);
    } catch {
      return [];
    }
  }

  function writeSaved(entries) {
    store.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify({ entries }));
  }

  function readOutbox() {
    try {
      const parsed = JSON.parse(store.getItem(LEADERBOARD_OUTBOX_KEY) || '[]');
      return (Array.isArray(parsed) ? parsed : []).map(normalize).filter(item => item.runId);
    } catch {
      return [];
    }
  }

  function writeOutbox(entries) {
    if (!entries.length) {
      if (typeof store.removeItem === 'function') store.removeItem(LEADERBOARD_OUTBOX_KEY);
      else store.setItem(LEADERBOARD_OUTBOX_KEY, '[]');
      return;
    }
    store.setItem(LEADERBOARD_OUTBOX_KEY, JSON.stringify(entries));
  }

  function queuePending(entry) {
    const pending = readOutbox().filter(item => item.runId !== entry.runId);
    pending.push({ runId: entry.runId, name: entry.name, score: entry.score });
    writeOutbox(pending);
  }

  function dropPending(runId) {
    writeOutbox(readOutbox().filter(item => item.runId !== runId));
  }

  function localTop() {
    return topEntries([...presets.map(entry => ({ name: entry.name, score: entry.score, runId: '' })), ...readSaved()]);
  }

  function markPending(rows) {
    const pending = new Set(readOutbox().map(item => item.runId));
    return rows.map(row => ({ ...row, pending: Boolean(row.runId && pending.has(row.runId)) }));
  }

  // A just-submitted row has to show even when /top is stale or never received
  // the post. Server rows stay first so a confirmed remote score wins ties.
  function withSaved(rows) {
    const seen = new Set();
    const merged = [];
    for (const row of [...rows, ...readSaved()]) {
      const key = row.runId || `preset:${row.name}:${row.score}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    return markPending(topEntries(merged));
  }

  async function fetchTop() {
    if (endpoint && request) {
      try {
        const response = await request(endpoint.top, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!response?.ok) throw new Error('leaderboard request failed');
        const data = await response.json();
        const rows = Array.isArray(data) ? data : data?.entries;
        if (!Array.isArray(rows)) throw new Error('leaderboard response was not a list');
        return withSaved(rows.map(normalize).filter(Boolean));
      } catch {
        return markPending(localTop());
      }
    }
    return markPending(localTop());
  }

  async function postScore(entry, keepalive) {
    let response;
    try {
      response = await request(endpoint.submit, {
        method: 'POST',
        credentials: 'omit',
        keepalive,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: entry.runId, name: entry.name, score: entry.score }),
      });
    } catch {
      const error = new Error('offline');
      error.code = 'offline';
      throw error;
    }
    if (!response?.ok) {
      let code = 'offline';
      try {
        const data = await response.json();
        if (data?.error) code = String(data.error);
      } catch { /* a non-JSON failure is still a failed submit */ }
      const error = new Error(code);
      error.code = code;
      error.status = response.status;
      throw error;
    }
  }

  async function submit(entry, { keepalive = false, remote = true } = {}) {
    const name = sanitizeName(entry?.name);
    const score = asScore(entry?.score);
    const runId = String(entry?.runId || '').slice(0, 80);
    if (!name || !score || !runId) return null;
    const saved = readSaved();
    const existing = saved.find(item => item.runId === runId);
    if (existing) existing.score = score;
    else saved.push({ runId, name, score });
    writeSaved(saved);
    const stored = { ...(existing || saved[saved.length - 1]) };
    if (!(remote && endpoint && request)) {
      dropPending(runId);
      return { ok: true, pending: false, entry: stored };
    }
    try {
      await postScore(stored, keepalive);
      dropPending(runId);
      return { ok: true, pending: false, entry: stored };
    } catch (error) {
      const code = error.code || 'offline';
      const pending = retryableFailure(code, error.status);
      if (pending) queuePending(stored);
      else dropPending(runId);
      return { ok: false, pending, error: code, entry: stored };
    }
  }

  async function flush({ keepalive = false } = {}) {
    if (!endpoint || !request) return { ok: true, sent: 0, pending: 0 };
    const left = [];
    let sent = 0;
    for (const item of readOutbox()) {
      try {
        await postScore(item, keepalive);
        sent += 1;
      } catch (error) {
        if (retryableFailure(error.code || 'offline', error.status)) left.push(item);
      }
    }
    writeOutbox(left);
    return { ok: left.length === 0, sent, pending: left.length };
  }

  function forget(runId) {
    const id = String(runId || '');
    if (!id) return;
    writeSaved(readSaved().filter(item => item.runId !== id));
    dropPending(id);
  }

  return { fetchTop, submit, flush, forget, readSaved, readOutbox };
}
