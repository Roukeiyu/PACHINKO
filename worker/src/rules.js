// Shared checks. Kept out of the worker entry so the entry only exports a fetch handler.
import { LEADERBOARD_QUALIFY_SCORE, PRESET_BOARD, sanitizeName, topEntries } from '../../src/leaderboard.js';

export const SCORE_MIN = LEADERBOARD_QUALIFY_SCORE;
export const SCORE_MAX = 999_999_990;
export const SUBMIT_LIMIT_PER_MINUTE = 5;
export const RATE_WINDOW_MS = 60_000;
export const PAGE_ORIGIN = 'https://roukeiyu.github.io';

const UUID_RUN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FALLBACK_RUN = /^run-[a-z0-9]{4,16}-[a-z0-9]{4,16}$/i;

export function isRunId(value) {
  return typeof value === 'string' && (UUID_RUN.test(value) || FALLBACK_RUN.test(value));
}

export function allowedOrigin(origin) {
  if (!origin || origin === 'null') return '';
  if (origin === PAGE_ORIGIN) return origin;
  try {
    const url = new URL(origin);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (url.protocol === 'http:' && local) return origin;
  } catch { /* not a URL */ }
  return '';
}

export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(content) {
  const binary = atob(String(content).replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function rankable(entry) {
  const name = sanitizeName(entry?.name);
  const score = Number(entry?.score);
  if (!name || !Number.isInteger(score) || score <= 0) return null;
  return { name, score, runId: typeof entry.runId === 'string' ? entry.runId : '' };
}

export function mergeTop(stored) {
  const real = stored.map(rankable).filter(Boolean);
  const presets = PRESET_BOARD.map(entry => ({ name: entry.name, score: entry.score, runId: '' }));
  return { entries: topEntries([...presets, ...real]) };
}

export function validateSubmission(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_json' };
  const name = sanitizeName(body.name);
  if (!name) return { error: 'invalid_name' };
  if (!isRunId(body.runId)) return { error: 'invalid_run' };
  const score = body.score;
  if (typeof score !== 'number' || !Number.isInteger(score) || score % 10 !== 0 || score < SCORE_MIN || score > SCORE_MAX) {
    return { error: 'invalid_score' };
  }
  return { name, runId: body.runId, score };
}
