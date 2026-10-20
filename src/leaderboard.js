// Front-end leaderboard. Preset rows are a fixed list: generated once, never reshuffled.
// A configured VITE_LEADERBOARD_URL is optional. No token is sent with requests.

export const LEADERBOARD_LIMIT = 20;
export const LEADERBOARD_QUALIFY_SCORE = 50000;
export const NAME_MAX_LENGTH = 12;
export const LEADERBOARD_STORAGE_KEY = 'ponpon-leaderboard';

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
  const endpoint = String(url || '').trim();

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

  function localTop() {
    return topEntries([...presets.map(entry => ({ name: entry.name, score: entry.score, runId: '' })), ...readSaved()]);
  }

  async function fetchTop() {
    if (endpoint && request) {
      try {
        const response = await request(endpoint, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!response?.ok) throw new Error('leaderboard request failed');
        const data = await response.json();
        const rows = Array.isArray(data) ? data : data?.entries;
        if (!Array.isArray(rows)) throw new Error('leaderboard response was not a list');
        return topEntries(rows.map(normalize).filter(Boolean));
      } catch {
        return localTop();
      }
    }
    return localTop();
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
    const stored = existing || saved[saved.length - 1];
    if (remote && endpoint && request) {
      try {
        const response = await request(endpoint, {
          method: 'POST',
          credentials: 'omit',
          keepalive,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, name: stored.name, score: stored.score }),
        });
        if (!response?.ok) throw new Error('leaderboard submit failed');
      } catch { /* the local row is already stored */ }
    }
    return { ...stored };
  }

  return { fetchTop, submit, readSaved };
}
