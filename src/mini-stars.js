// 接星星. A basket slides along the bottom. Stars and bombs fall in a ramp
// that gets faster across 30 seconds. Pointer control is instant; arrow keys
// and A/D move at STAR_KEY_SPEED. The combo curve matches comboPoints.

export const STAR_DURATION = 30000;
export const STAR_BOARD_W = 320;
export const STAR_BOARD_H = 420;
export const STAR_BASKET_W = 78;
export const STAR_BASKET_Y = 392;
export const STAR_ITEM_R = 14;
export const STAR_CATCH_PAD = 0.65;
// A perfect catch of the 49 stars that reach the basket, with no miss and no
// bomb, is one combo worth 10841.
export const STAR_POINT = 17;
export const STAR_BOMB_PENALTY = 80;
export const STAR_SPAWN_START = 700;
export const STAR_SPAWN_END = 320;
export const STAR_FALL_START = 210;
export const STAR_FALL_END = 360;
export const STAR_LEAD = 280;
export const STAR_KEY_SPEED = 280;
// Spawn index 5, 11, 17… is a bomb. The rest are stars.
export const STAR_BOMB_EVERY = 6;
const STEP = 16;

export const starCatchHalf = () => STAR_BASKET_W / 2 + STAR_ITEM_R * STAR_CATCH_PAD;

const comboValue = combo => combo > 0 ? 1 + (combo - 1) * 0.5 : 1;
const pointsFor = (base, combo) => Math.round(base * comboValue(combo));
const clampBasket = x => {
  const edge = STAR_BASKET_W / 2;
  return Math.min(STAR_BOARD_W - edge, Math.max(edge, x));
};
const spawnGap = elapsed => {
  const t = Math.min(1, Math.max(0, elapsed / STAR_DURATION));
  return STAR_SPAWN_START + (STAR_SPAWN_END - STAR_SPAWN_START) * t;
};
const fallSpeed = elapsed => {
  const t = Math.min(1, Math.max(0, elapsed / STAR_DURATION));
  return STAR_FALL_START + (STAR_FALL_END - STAR_FALL_START) * t;
};

export function createStarGame({ random = Math.random, now = 0 } = {}) {
  let fxId = 0;
  const state = {
    kind: 'stars', status: 'playing', score: 0, played: false, combo: 0, multiplier: 1,
    bestCombo: 0, bestMultiplier: 1, hit: 0, removed: 0, bombs: 0, missed: 0,
    basketX: STAR_BOARD_W / 2, hold: 0, items: [], startedAt: now, deadline: now + STAR_DURATION,
    lastSim: now, nextSpawn: now + STAR_LEAD, spawnIndex: 0, message: '接住落下的星星',
    revision: 0, fx: null, selected: null, board: [],
  };
  function finish(status) {
    if (state.status !== 'playing') return;
    state.status = status;
    state.hold = 0;
    state.revision++;
  }
  function setBasket(x) {
    if (state.status !== 'playing' || !Number.isFinite(x)) return;
    state.hold = 0;
    state.basketX = clampBasket(x);
  }
  function setHold(dir) {
    if (state.status !== 'playing') return;
    state.hold = dir < 0 ? -1 : dir > 0 ? 1 : 0;
  }
  function spawn(at) {
    const elapsed = at - state.startedAt;
    const bad = state.spawnIndex % STAR_BOMB_EVERY === STAR_BOMB_EVERY - 1;
    const margin = STAR_ITEM_R + 6;
    const x = margin + random() * (STAR_BOARD_W - margin * 2);
    state.items.push({ id: state.spawnIndex, kind: bad ? 'bomb' : 'star', x, y: -STAR_ITEM_R, vy: fallSpeed(elapsed), resolved: false });
    state.spawnIndex += 1;
  }
  function resolveItem(item) {
    item.resolved = true;
    const caught = Math.abs(item.x - state.basketX) <= starCatchHalf();
    if (item.kind === 'star' && caught) {
      state.combo += 1;
      state.multiplier = comboValue(state.combo);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.bestMultiplier = comboValue(state.bestCombo);
      const points = pointsFor(STAR_POINT, state.combo);
      state.score += points;
      state.hit += 1;
      state.played = true;
      state.message = `接住星星 +${points} · ${state.combo} 连击`;
      state.fx = { id: ++fxId, kind: 'stars', broken: false, points, combo: state.combo, multiplier: state.multiplier, cells: [], chains: 0 };
      state.revision++;
      return;
    }
    if (item.kind === 'star') {
      state.combo = 0;
      state.multiplier = 1;
      state.missed += 1;
      state.message = '星星漏掉了，连击清零';
      state.fx = { id: ++fxId, kind: 'stars', broken: true, points: 0, combo: 0, multiplier: 1, cells: [], chains: 0 };
      state.revision++;
      return;
    }
    if (caught) {
      state.combo = 0;
      state.multiplier = 1;
      state.bombs += 1;
      state.score = Math.max(0, state.score - STAR_BOMB_PENALTY);
      state.message = `接到炸弹，连击清零，-${STAR_BOMB_PENALTY}`;
      state.fx = { id: ++fxId, kind: 'stars', broken: true, points: 0, combo: 0, multiplier: 1, cells: [], chains: 0 };
      state.revision++;
    }
  }
  function step(dt) {
    if (state.hold) state.basketX = clampBasket(state.basketX + state.hold * STAR_KEY_SPEED * dt / 1000);
    for (const item of state.items) {
      if (item.resolved) continue;
      item.y += item.vy * dt / 1000;
      if (item.y >= STAR_BASKET_Y) resolveItem(item);
    }
  }
  function advance(until) {
    while (state.lastSim < until - 1e-6) {
      let dt = Math.min(STEP, until - state.lastSim);
      if (state.nextSpawn <= state.deadline && state.nextSpawn > state.lastSim) dt = Math.min(dt, state.nextSpawn - state.lastSim);
      step(dt);
      state.lastSim += dt;
      if (state.nextSpawn <= state.lastSim + 1e-6 && state.nextSpawn <= state.deadline) {
        const spawned = state.nextSpawn;
        spawn(spawned);
        state.nextSpawn = spawned + spawnGap(spawned - state.startedAt);
      }
    }
  }
  function tick(at) {
    if (state.status !== 'playing') return;
    advance(Math.min(at, state.deadline));
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
  }
  return {
    state, tick, setBasket, setHold,
    select() { return 0; },
    setInputLock() {},
    remaining: at => Math.max(0, Math.min(STAR_DURATION, state.deadline - at)),
    snapshot: () => structuredClone(state),
  };
}
