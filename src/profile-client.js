import { workerUrl } from './worker-url.js';

const SESSION_KEY = 'ponpon-session';
const OUTBOX_KEY = 'ponpon-fruit-outbox';

function browserStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* private mode */ }
  return null;
}

export function createProfileClient({ url = workerUrl(), storage = browserStorage(), fetchImpl } = {}) {
  const request = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const base = String(url || '').replace(/\/+$/, '');
  const store = storage;

  function token() {
    try { return store?.getItem(SESSION_KEY) || ''; } catch { return ''; }
  }
  function setToken(value) {
    if (!store) return;
    if (value) store.setItem(SESSION_KEY, value);
    else store.removeItem(SESSION_KEY);
  }
  function readOutbox() {
    try { return JSON.parse(store?.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
  }
  function writeOutbox(items) {
    if (!store) return;
    if (!items.length) store.removeItem(OUTBOX_KEY);
    else store.setItem(OUTBOX_KEY, JSON.stringify(items));
  }

  async function send(path, { method = 'GET', body, auth = false } = {}) {
    if (!base || !request) {
      const error = new Error('offline');
      error.code = 'offline';
      throw error;
    }
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && token()) headers.Authorization = `Bearer ${token()}`;
    let response;
    try {
      response = await request(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      const error = new Error('offline');
      error.code = 'offline';
      error.cause = cause;
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'request_failed');
      error.code = data.error || 'request_failed';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  return {
    enabled: Boolean(base),
    token,
    setToken,
    readOutbox,
    writeOutbox,
    register: (name, pin) => send('/register', { method: 'POST', body: { name, pin } }),
    login: (name, pin) => send('/login', { method: 'POST', body: { name, pin } }),
    logout: () => send('/logout', { method: 'POST', auth: true }).catch(() => ({ ok: true })),
    me: () => send('/me', { auth: true }),
    round: (runId, fruits, score) => send('/round-result', { method: 'POST', auth: true, body: { runId, fruits, ...(score == null ? {} : { score }) } }),
    equip: skin => send('/equip', { method: 'POST', auth: true, body: { skin } }),
  };
}

export const PROFILE_ERRORS = {
  invalid_name: '名字要 1 到 12 个字',
  invalid_pin: '请输入 4 位数字密码',
  invalid_login: '名字或密码不对',
  name_taken: '这个名字已经有人用了',
  locked: '密码试太多次，15 分钟后再来',
  rate_limited: '操作太频繁，等一会儿',
  skin_locked: '这个皮肤还没解锁',
  offline: '档案服务连不上，先以游客玩',
  unauthorized: '登录已失效，请再登一次',
};
