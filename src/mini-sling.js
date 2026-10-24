import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite, Events } = Matter;
export const SLING_DURATION = 30000;
export const SLING_BOARD_W = 320;
export const SLING_BOARD_H = 420;
export const SLING_TARGET = 14;
export const SLING_TOTAL = 24;
export const SLING_POINT = 180;
export const SLING_WIN_BONUS = 1200;
export const SLING_X = 160;
export const SLING_Y = 365;
export const SLING_SPEED = 15;
export const SLING_RELOAD = 400;
export const SLING_AREA = Object.freeze({ left: 22, right: 298, top: 70, bottom: 290 });
export const SLING_COLUMNS = Object.freeze([50, 94, 138, 182, 226, 270]);
export const SLING_BLOCK_W = 32;
export const SLING_BLOCK_H = 30;
export const SLING_FALL_MS = 600;
const STEP = 1000 / 120;
const LIFE = 2200;

// Separating-axis check against the same rectangle drawn by the view. The
// tile must fully clear it, including rotated corners; its center is not enough.
export function outsideSlingArea(vertices) {
  const a = SLING_AREA, corners = [{ x:a.left,y:a.top },{ x:a.right,y:a.top },{ x:a.right,y:a.bottom },{ x:a.left,y:a.bottom }];
  const axes = [{ x:1,y:0 },{ x:0,y:1 }];
  for (let i=0;i<2;i++) { const p=vertices[i],q=vertices[i+1]; axes.push({ x:p.y-q.y,y:q.x-p.x }); }
  return axes.some(axis => {
    const tile=vertices.map(p=>p.x*axis.x+p.y*axis.y), platform=corners.map(p=>p.x*axis.x+p.y*axis.y);
    return Math.max(...tile)<Math.min(...platform)-1e-6 || Math.min(...tile)>Math.max(...platform)+1e-6;
  });
}

export function createSlingGame({ now = 0 } = {}) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 8, velocityIterations: 8 });
  const blocks = [], shots = [], pending = new Set(), byBody = new Map();
  let disposed = false, fxId = 0, impactId = 0;
  const state = {
    kind: 'sling', status: 'playing', score: 0, played: false, hit: 0, removed: 0,
    combo: 0, bestCombo: 0, multiplier: 1, bestMultiplier: 1, fired: 0,
    startedAt: now, deadline: now + SLING_DURATION, lastSim: now, nextShotAt: now,
    originX: SLING_X, originY: SLING_Y, pull: null, blocks: [], shots: [], impacts: [], escapes: [], launchAt: -1000,
    selected: null, board: [], revision: 0, fx: null, won: false,
    message: `横向选点，松手向上打 · 打出边框 ${SLING_TARGET} 块过关`,
  };
  // A top-down platform: tiles rest on its plane with no screen-down gravity.
  // Linear damping slows glancing impacts, but all momentum transfers are real.
  for (let row = 0; row < 4; row++) for (let col = 0; col < SLING_COLUMNS.length; col++) {
    const x = SLING_COLUMNS[col], y = 105 + row * 40;
    const body = Bodies.rectangle(x, y, SLING_BLOCK_W, SLING_BLOCK_H, { density: 0.001, friction: 0.2, restitution: 0.3, frictionAir: 0.04 });
    const block = { id: blocks.length, body, down: false, color: (row + col) % 4 };
    blocks.push(block); byBody.set(body.id, block); Composite.add(engine.world, body);
  }
  function onCollision({ pairs }) {
    for (const { bodyA, bodyB } of pairs) for (const [target, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
      const b = byBody.get(target.id);
      if (!b || b.down) continue;
      if (Math.hypot(target.velocity.x - other.velocity.x, target.velocity.y - other.velocity.y) >= 2.8) pending.add(b);
    }
  }
  Events.on(engine, 'collisionStart', onCollision);

  function sync() {
    state.blocks = blocks.map(b => ({ id: b.id, x: b.body.position.x, y: b.body.position.y, angle: b.body.angle, down: b.down, color: b.color,
      scale: b.down ? Math.max(0,1-(state.lastSim-b.exitAt)/SLING_FALL_MS) : 1 }));
    state.shots = shots.map(s => ({ x: s.body.position.x, y: s.body.position.y, vy: s.body.velocity.y }));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; Events.off(engine, 'collisionStart', onCollision);
    Composite.clear(engine.world, false); Engine.clear(engine);
    shots.length = 0; pending.clear(); state.pull = null; state.shots = [];
    if (state.status === 'playing') state.status = 'aborted';
  }
  function finish(status) {
    if (state.status !== 'playing') return;
    state.won = state.removed >= SLING_TARGET;
    if (state.won) state.score += SLING_WIN_BONUS;
    state.status = status; state.revision++; sync(); dispose();
  }
  function clearAim() { state.pull = null; }
  function setAim(point) {
    if (disposed || state.status !== 'playing' || state.lastSim + 1e-6 < state.nextShotAt || !point || !Number.isFinite(point.x)) return;
    state.originX = Math.max(16, Math.min(SLING_BOARD_W - 16, point.x));
    state.pull = { x: state.originX };
  }
  function release() {
    if (disposed || state.status !== 'playing' || !state.pull || state.lastSim + 1e-6 < state.nextShotAt) return false;
    const body = Bodies.circle(state.originX, SLING_Y, 10, { label: 'sling-shot', density: 0.004, friction: 0.1, restitution: 0.45, frictionAir: 0.001 });
    Body.setVelocity(body, { x: 0, y: -SLING_SPEED });
    Composite.add(engine.world, body); shots.push({ body, born: state.lastSim });
    state.fired++; state.nextShotAt = state.lastSim + SLING_RELOAD; state.launchAt = state.lastSim;
    clearAim(); state.message = '向上击打！换一列继续拆 · 整块打出边框才计分';
    state.revision++; sync(); return true;
  }
  function step() {
    Engine.update(engine, STEP);
    if (pending.size) {
      for (const b of pending) {
        state.impacts.push({ id: ++impactId, x: b.body.position.x, y: b.body.position.y, at: state.lastSim });
      }
      state.message = `碰撞连锁！换个落点 · 整块推出边框才得分`;
      state.revision++; pending.clear();
    }
    state.impacts = state.impacts.filter(i => state.lastSim - i.at < 320).slice(-24);
    state.escapes = state.escapes.filter(i => state.lastSim - i.at < 600);
    let gained = 0;
    for (const b of blocks) {
      if (!b.down && outsideSlingArea(b.body.vertices)) {
        b.down = true; b.exitAt = state.lastSim; gained++;
        // The falling copy shrinks around this fixed center. It immediately
        // leaves the plane's physics and cannot bounce back or score twice.
        Composite.remove(engine.world,b.body); byBody.delete(b.body.id);
        state.escapes.push({ id: b.id, x: b.body.position.x, y: b.body.position.y, at: state.lastSim });
      }
    }
    if (gained) {
      state.removed += gained; state.hit = state.removed; state.played = true;
      state.score += gained * SLING_POINT;
      state.message = `出界 ${state.removed}/${SLING_TARGET} · +${gained * SLING_POINT} 分`;
      state.fx = { id: ++fxId, kind: 'sling', points: gained * SLING_POINT, combo: 1, cells: [], broken: false };
      state.revision++;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], p = s.body.position;
      if (state.lastSim - s.born >= LIFE || p.x < -40 || p.x > 360 || p.y < -40 || p.y > 450) { Composite.remove(engine.world, s.body); shots.splice(i, 1); }
    }
    if (state.removed >= SLING_TARGET) finish('complete');
  }
  function tick(at) {
    if (disposed || state.status !== 'playing' || !Number.isFinite(at)) return;
    const until = Math.min(at, state.deadline);
    while (state.lastSim + STEP <= until + 1e-6 && state.status === 'playing') { state.lastSim += STEP; step(); }
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
    sync();
  }
  sync();
  return { state, tick, setAim, release, clearAim, dispose, stop() { finish('aborted'); },
    select() { return 0; }, setInputLock() {},
    remaining: at => Math.max(0, Math.min(SLING_DURATION, state.deadline - at)), snapshot: () => structuredClone(state),
  };
}
