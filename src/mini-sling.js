import Matter from 'matter-js';

// A self-contained Matter world, stepped by the existing foreground game clock.
// Bodies never leave this round; no runner, DOM timer or main-table state is used.
const { Engine, Bodies, Body, Composite } = Matter;
export const SLING_DURATION = 30000;
export const SLING_BOARD_W = 320;
export const SLING_BOARD_H = 420;
export const SLING_TARGET = 14;
export const SLING_TOTAL = 24;
export const SLING_POINT = 180;
export const SLING_WIN_BONUS = 1200;
export const SLING_X = 58;
export const SLING_Y = 298;
export const SLING_MAX_PULL = 46;
export const SLING_GRAVITY = 1.2;
export const SLING_POWER = 0.29;
export const SLING_FALL_Y = 342; // Bottom edge of all three tower platforms.
const STEP = 1000 / 120;
const RELOAD = 650;
const LIFE = 3200;

export function createSlingGame({ now = 0 } = {}) {
  const engine = Engine.create({ gravity: { x: 0, y: SLING_GRAVITY }, positionIterations: 8, velocityIterations: 8 });
  const blocks = [], shots = [];
  let disposed = false, fxId = 0;
  const state = {
    kind: 'sling', status: 'playing', score: 0, played: false, hit: 0, removed: 0,
    combo: 0, bestCombo: 0, multiplier: 1, bestMultiplier: 1, fired: 0,
    startedAt: now, deadline: now + SLING_DURATION, lastSim: now, nextShotAt: now,
    originX: SLING_X, originY: SLING_Y, pull: null, blocks: [], shots: [],
    selected: null, board: [], revision: 0, fx: null, won: false,
    message: `整块落到台座下方才算 · 击落 ${SLING_TARGET} 块过关`,
  };
  const platforms = [188, 240, 292].map(x => Bodies.rectangle(x, 335, 50, 14, { isStatic: true, friction: 0.6, label: 'platform' }));
  const floor = Bodies.rectangle(160, 435, 800, 20, { isStatic: true, friction: 0.8 });
  for (let tower = 0; tower < 3; tower++) {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
      const x = 176 + tower * 52 + col * 24, y = 316 - row * 24;
      const body = Bodies.rectangle(x, y, 23, 24, { density: 0.001, friction: 0.55, frictionStatic: 0.8, restitution: 0.05, slop: 0.02 });
      blocks.push({ id: blocks.length, body, down: false, color: (row + tower) % 4 });
    }
  }
  Composite.add(engine.world, [...platforms, floor, ...blocks.map(b => b.body)]);
  // Settle the stacks before play. Idle contact corrections cannot score.
  for (let i = 0; i < 120; i++) Engine.update(engine, STEP);

  function sync() {
    state.blocks = blocks.map(b => ({ id: b.id, x: b.body.position.x, y: b.body.position.y, angle: b.body.angle, down: b.down, color: b.color }));
    state.shots = shots.map(s => ({ x: s.body.position.x, y: s.body.position.y }));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    shots.length = 0;
    state.pull = null;
    state.shots = [];
    if (state.status === 'playing') state.status = 'aborted';
  }
  function finish(status) {
    if (state.status !== 'playing') return;
    state.won = state.removed >= SLING_TARGET;
    if (state.won) state.score += SLING_WIN_BONUS;
    state.status = status;
    state.revision++;
    sync();
    dispose();
  }
  function clearAim() {
    state.pull = null;
    state.originX = SLING_X;
    state.originY = SLING_Y;
  }
  function setAim(point) {
    if (disposed || state.status !== 'playing' || state.lastSim + 1e-6 < state.nextShotAt || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    let dx = SLING_X - point.x, dy = SLING_Y - point.y;
    // Aim to the right, level or upward. Dragging over the sling does not
    // spend a ball; the release explains the intended gesture.
    const length = Math.hypot(dx, dy) || 1, scale = Math.min(1, SLING_MAX_PULL / length);
    dx *= scale; dy *= scale;
    state.pull = { dx, dy };
    state.originX = SLING_X - dx;
    state.originY = SLING_Y - dy;
  }
  function release() {
    if (disposed || state.status !== 'playing' || !state.pull || state.lastSim + 1e-6 < state.nextShotAt) return false;
    const { dx, dy } = state.pull;
    if (dx < 8 || Math.hypot(dx, dy) < 12 || dy > 8) {
      clearAim(); state.message = '把弹珠向左下拉，再松手飞向方块'; state.revision++; return false;
    }
    const body = Bodies.circle(state.originX, state.originY, 11, { density: 0.003, friction: 0.4, restitution: 0.3, frictionAir: 0.001 });
    Body.setVelocity(body, { x: dx * SLING_POWER, y: dy * SLING_POWER });
    Composite.add(engine.world, body);
    shots.push({ body, born: state.lastSim });
    state.fired++;
    state.nextShotAt = state.lastSim + RELOAD;
    clearAim();
    state.message = '换角度拆支撑 · 整块落到台座下方才计分';
    state.revision++;
    sync();
    return true;
  }
  function step(dt) {
    Engine.update(engine, dt);
    let gained = 0;
    for (const block of blocks) {
      // The entire body must clear the platforms' bottom edge. Sliding,
      // rocking or settling onto a lower row inside a tower does not count.
      const fallen = block.body.bounds.min.y > SLING_FALL_Y;
      if (!block.down && state.fired > 0 && fallen) {
        block.down = true;
        gained++;
      }
    }
    if (gained) {
      state.removed += gained; state.hit = state.removed; state.played = true;
      state.score += gained * SLING_POINT;
      state.message = `击落 ${state.removed}/${SLING_TARGET} · +${gained * SLING_POINT} 分`;
      state.fx = { id: ++fxId, kind: 'sling', points: gained * SLING_POINT, combo: 1, cells: [], broken: false };
      state.revision++;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i], p = shot.body.position;
      if (state.lastSim - shot.born >= LIFE || p.x < -50 || p.x > SLING_BOARD_W + 50 || p.y > SLING_BOARD_H + 30) {
        Composite.remove(engine.world, shot.body); shots.splice(i, 1);
      }
    }
    // Fallen pieces keep colliding until they leave the little playfield.
    for (const b of blocks) if (b.down && !b.retired && (b.body.position.y > 450 || Math.abs(b.body.position.x - 160) > 260)) {
      Composite.remove(engine.world, b.body); b.retired = true;
    }
    if (state.removed >= SLING_TARGET) finish('complete');
  }
  function tick(at) {
    if (disposed || state.status !== 'playing' || !Number.isFinite(at)) return;
    const until = Math.min(at, state.deadline);
    // Leave any fraction of a step for the next tick, so screen refresh rate
    // cannot change the collision solver's step sizes or the towers' balance.
    while (state.lastSim + STEP <= until + 1e-6 && state.status === 'playing') {
      state.lastSim += STEP;
      step(STEP);
    }
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
    sync();
  }
  sync();
  return { state, tick, setAim, release, clearAim, dispose, stop() { finish('aborted'); },
    select() { return 0; }, setInputLock() {},
    remaining: at => Math.max(0, Math.min(SLING_DURATION, state.deadline - at)),
    snapshot: () => structuredClone(state),
  };
}
