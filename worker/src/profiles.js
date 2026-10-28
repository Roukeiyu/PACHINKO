// Player profiles live in D1. The PIN is a salted PBKDF2 hash. Sessions are
// opaque tokens; only the SHA-256 of the token is stored.
import { sanitizeName } from '../../src/leaderboard.js';
import { isRunId } from './rules.js';
import { SCORE_MAX } from './rules.js';
import { BALL_SKINS, FRUIT_IDS, SHINE_SCORE, SHINE_SKIN, emptyFruit, fruitDelta, normalizeFruit, skinById, skinCatalog, skinUnlocked } from '../../src/skins.js';

export const PIN_ITERATIONS = 100_000;
export const PIN_LOCK_MS = 15 * 60 * 1000;
export const PIN_FAILS = 5;
export const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
export const AUTH_LIMIT_PER_MINUTE = 8;
const AUTH_WINDOW_MS = 60_000;
const authBuckets = new Map();

const DUMMY_SALT = 'cG9ucG9uLXBpbi1kdW1teQ==';

function bytesToHex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function nameKey(name) {
  return name.toLocaleLowerCase('en-US');
}

export function validPin(value) {
  return typeof value === 'string' && /^[0-9]{4}$/.test(value);
}

async function pbkdf2(pin, saltBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: PIN_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}

async function hashPin(pin, saltBytes) {
  return bytesToHex(await pbkdf2(pin, saltBytes));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function allowAuth(ip, now) {
  const recent = (authBuckets.get(ip) || []).filter(time => now - time < AUTH_WINDOW_MS);
  if (recent.length >= AUTH_LIMIT_PER_MINUTE) {
    authBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  authBuckets.set(ip, recent);
  if (authBuckets.size > 5000) authBuckets.delete(authBuckets.keys().next().value);
  return true;
}

async function readFruit(db, profileId) {
  const rows = await db.prepare('SELECT fruit_id, count FROM fruit_counts WHERE profile_id = ?').bind(profileId).all();
  const counts = emptyFruit();
  for (const row of rows.results || []) counts[row.fruit_id] = row.count;
  return normalizeFruit(counts);
}

function shineOn(row) {
  return row?.shine_unlocked === 1;
}

function publicProfile(row, fruits) {
  const unlocked = shineOn(row);
  const equipped = skinById(row.equipped_skin) ? row.equipped_skin : '';
  return {
    name: row.name,
    fruits,
    equipped,
    shineUnlocked: unlocked,
    shineJustUnlocked: row.shineJustUnlocked === true,
    skins: skinCatalog(fruits, equipped, unlocked),
  };
}

function parseScore(value) {
  if (value == null) return { score: null };
  if (typeof value !== 'number' || !Number.isInteger(value) || value % 10 !== 0 || value < 0 || value > SCORE_MAX) return { error: 'invalid_score' };
  return { score: value };
}

async function issueSession(db, profileId, now) {
  const token = randomToken();
  await db.prepare('INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), profileId, now + SESSION_MS).run();
  return token;
}

async function readSession(db, request, now) {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(header);
  if (!match) return null;
  const row = await db.prepare(`
    SELECT sessions.profile_id, sessions.expires_at, profiles.name, profiles.equipped_skin, profiles.shine_unlocked
    FROM sessions JOIN profiles ON profiles.id = sessions.profile_id
    WHERE sessions.token_hash = ?
  `).bind(await sha256Hex(match[1])).first();
  if (!row || row.expires_at <= now) return null;
  return row;
}

async function verifyPin(pin, row) {
  const actual = await hashPin(pin, row ? base64ToBytes(row.pin_salt) : base64ToBytes(DUMMY_SALT));
  return row ? safeEqual(actual, row.pin_hash) : false;
}

export async function handleProfile(request, env, route, origin, json) {
  const db = env.DB;
  const now = Date.now();
  if (route === 'logout') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
    const header = request.headers.get('Authorization') || '';
    const match = /^Bearer\s+([0-9a-f]{64})$/i.exec(header);
    if (match) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(match[1])).run();
    return json({ ok: true }, 200, origin);
  }
  if (route === 'me') {
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
    const session = await readSession(db, request, now);
    if (!session) return json({ ok: false, error: 'unauthorized' }, 401, origin);
    const fruits = await readFruit(db, session.profile_id);
    return json({ ok: true, ...publicProfile(session, fruits) }, 200, origin);
  }
  if (route === 'register' || route === 'login') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allowAuth(ip, now)) return json({ ok: false, error: 'rate_limited' }, 429, origin, { 'Retry-After': '60' });
    let body;
    try { body = JSON.parse(await request.text()); } catch { return json({ ok: false, error: 'invalid_json' }, 400, origin); }
    const name = sanitizeName(body?.name);
    if (!name) return json({ ok: false, error: 'invalid_name' }, 400, origin);
    if (!validPin(body?.pin)) return json({ ok: false, error: 'invalid_pin' }, 400, origin);
    const key = nameKey(name);
    const existing = await db.prepare('SELECT * FROM profiles WHERE name_key = ?').bind(key).first();
    if (route === 'register') {
      if (existing) return json({ ok: false, error: 'name_taken' }, 409, origin);
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO profiles (id, name, name_key, pin_salt, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, name, key, bytesToBase64(salt), await hashPin(body.pin, salt), now).run();
      const token = await issueSession(db, id, now);
      const profile = publicProfile({ name, equipped_skin: '' }, emptyFruit());
      return json({ ok: true, token, ...profile }, 201, origin);
    }
    if (existing && existing.pin_locked_until > now) return json({ ok: false, error: 'locked' }, 423, origin);
    const matches = await verifyPin(body.pin, existing);
    if (!existing || !matches) {
      if (existing) {
        const fails = existing.pin_fails + 1;
        const locked = fails >= PIN_FAILS ? now + PIN_LOCK_MS : 0;
        await db.prepare('UPDATE profiles SET pin_fails = ?, pin_locked_until = ? WHERE id = ?').bind(locked ? 0 : fails, locked, existing.id).run();
        if (locked) return json({ ok: false, error: 'locked' }, 423, origin);
      }
      return json({ ok: false, error: 'invalid_login' }, 401, origin);
    }
    await db.prepare('UPDATE profiles SET pin_fails = 0, pin_locked_until = 0 WHERE id = ?').bind(existing.id).run();
    const token = await issueSession(db, existing.id, now);
    const fruits = await readFruit(db, existing.id);
    return json({ ok: true, token, ...publicProfile(existing, fruits) }, 200, origin);
  }
  const session = await readSession(db, request, now);
  if (!session) return json({ ok: false, error: 'unauthorized' }, 401, origin);
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ ok: false, error: 'invalid_json' }, 400, origin); }
  if (route === 'equip') {
    const skin = body?.skin === '' || body?.skin == null ? '' : String(body.skin);
    if (skin) {
      const found = skinById(skin);
      const fruits = await readFruit(db, session.profile_id);
      const allowed = found?.id === SHINE_SKIN.id ? shineOn(session) : found && skinUnlocked(found, fruits);
      if (!allowed) return json({ ok: false, error: 'skin_locked' }, 403, origin);
    }
    await db.prepare('UPDATE profiles SET equipped_skin = ? WHERE id = ?').bind(skin, session.profile_id).run();
    const fruits = await readFruit(db, session.profile_id);
    return json({ ok: true, ...publicProfile({ name: session.name, equipped_skin: skin, shine_unlocked: session.shine_unlocked }, fruits) }, 200, origin);
  }
  if (route === 'round') {
    if (!isRunId(body?.runId)) return json({ ok: false, error: 'invalid_run' }, 400, origin);
    const score = parseScore(body?.score);
    if (score.error) return json({ ok: false, error: score.error }, 400, origin);
    const parsed = fruitDelta(body);
    if (parsed.error && !(parsed.error === 'empty_round' && score.score != null)) return json({ ok: false, error: parsed.error }, 400, origin);
    const fruitsIn = parsed.fruits || emptyFruit();
    const already = await db.prepare('SELECT 1 AS ok FROM round_credits WHERE profile_id = ? AND run_id = ?').bind(session.profile_id, body.runId).first();
    const prior = await db.prepare('SELECT shine_unlocked FROM profiles WHERE id = ?').bind(session.profile_id).first();
    let shineJustUnlocked = false;
    if (!already) {
      const statements = [db.prepare('INSERT INTO round_credits (profile_id, run_id, created_at) VALUES (?, ?, ?)').bind(session.profile_id, body.runId, now)];
      for (const id of FRUIT_IDS) {
        if (!fruitsIn[id]) continue;
        statements.push(db.prepare(`
          INSERT INTO fruit_counts (profile_id, fruit_id, count) VALUES (?, ?, ?)
          ON CONFLICT(profile_id, fruit_id) DO UPDATE SET count = count + excluded.count
        `).bind(session.profile_id, id, fruitsIn[id]));
      }
      if (score.score != null) {
        shineJustUnlocked = !prior?.shine_unlocked && score.score >= SHINE_SCORE;
        statements.push(db.prepare('UPDATE profiles SET best_score = MAX(best_score, ?), shine_unlocked = CASE WHEN shine_unlocked = 1 OR ? >= ? THEN 1 ELSE 0 END WHERE id = ?')
          .bind(score.score, score.score, SHINE_SCORE, session.profile_id));
      }
      await db.batch(statements);
    }
    const fruits = await readFruit(db, session.profile_id);
    const shineUnlocked = shineJustUnlocked || shineOn(prior) || shineOn(session);
    return json({ ok: true, updated: !already, ...publicProfile({ ...session, shine_unlocked: shineUnlocked ? 1 : 0, shineJustUnlocked }, fruits) }, 200, origin);
  }
  return json({ ok: false, error: 'not_found' }, 404, origin);
}

export { BALL_SKINS };
