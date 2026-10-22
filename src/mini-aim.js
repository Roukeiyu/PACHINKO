// 弹珠瞄准. Five slingshot shots on a 320×420 board. Targets slide on a
// fixed sine, so the same pull at the same moment always lands the same way.
// Walls bounce. Targets are sensors: the ball keeps going, and each lane
// scores at most once per ball. The combo curve matches comboPoints.

export const AIM_DURATION = 30000;
export const AIM_BALLS = 5;
export const AIM_BOARD_W = 320;
export const AIM_BOARD_H = 420;
export const AIM_REST_X = 160;
export const AIM_REST_Y = 372;
export const AIM_BALL_R = 9;
export const AIM_GRAVITY = 540;
export const AIM_RESTITUTION = 0.84;
export const AIM_MAX_PULL = 86;
export const AIM_POWER = 7.4;
export const AIM_MIN_PULL = 16;
// vy is negative when the shot goes up. Shallower than this is rejected.
export const AIM_MIN_VY = -90;
export const AIM_BALL_LIFE = 4500;
// A five-ball ceiling rake (two lanes plus the bonus on every ball, one combo)
// sums to about 10800. A shot released ~160ms off that rhythm is far lower.
export const AIM_NORMAL_POINT = 133;
export const AIM_BONUS_POINT = 206;
const STEP = 8;

// Narrow, fast lanes. A vertical shot only scores when that lane is crossing
// the ball's x, so timing (and a little English) is the skill.
export const AIM_LANES = Object.freeze([
  { id: 0, y: 68, w: 52, h: 18, amp: 118, freq: 0.0028, phase: 0.4, bonus: false },
  { id: 1, y: 146, w: 34, h: 16, amp: 128, freq: 0.0041, phase: 2.4, bonus: false },
  { id: 2, y: 222, w: 22, h: 14, amp: 136, freq: 0.0062, phase: 4.7, bonus: true },
]);

const comboValue = combo => combo > 0 ? 1 + (combo - 1) * 0.5 : 1;
const pointsFor = (base, combo) => Math.round(base * comboValue(combo));

export function aimTargets(elapsed) {
  return AIM_LANES.map(lane => ({
    id: lane.id, bonus: lane.bonus, y: lane.y, w: lane.w, h: lane.h,
    x: AIM_BOARD_W / 2 + Math.sin(elapsed * lane.freq + lane.phase) * lane.amp,
  }));
}

function overlaps(ball, lane) {
  const left = lane.x - lane.w / 2, right = lane.x + lane.w / 2;
  const top = lane.y - lane.h / 2, bottom = lane.y + lane.h / 2;
  const cx = Math.max(left, Math.min(ball.x, right));
  const cy = Math.max(top, Math.min(ball.y, bottom));
  const dx = ball.x - cx, dy = ball.y - cy;
  return dx * dx + dy * dy <= AIM_BALL_R * AIM_BALL_R;
}

export function createAimGame({ now = 0 } = {}) {
  let fxId = 0;
  const state = {
    kind: 'aim', status: 'playing', score: 0, played: false, combo: 0, multiplier: 1,
    bestCombo: 0, bestMultiplier: 1, hit: 0, removed: 0, fired: 0, resolved: 0,
    startedAt: now, deadline: now + AIM_DURATION, lastSim: now,
    originX: AIM_REST_X, originY: AIM_REST_Y, pull: null, ball: null,
    targets: aimTargets(0), message: '向后拉，松手射出', revision: 0, fx: null,
    selected: null, board: [],
  };
  function finish(status) {
    if (state.status !== 'playing') return;
    state.status = status;
    state.pull = null;
    state.ball = null;
    state.revision++;
  }
  function setAim(point) {
    if (state.status !== 'playing' || state.ball || state.fired >= AIM_BALLS || !point) return;
    let dx = AIM_REST_X - point.x;
    let dy = AIM_REST_Y - point.y;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, AIM_MAX_PULL / len);
    dx *= scale;
    dy *= scale;
    state.pull = { dx, dy };
    state.originX = Math.min(AIM_BOARD_W - AIM_BALL_R, Math.max(AIM_BALL_R, AIM_REST_X - dx));
    state.originY = Math.min(AIM_BOARD_H - AIM_BALL_R, Math.max(AIM_BALL_R, AIM_REST_Y - dy));
  }
  function clearAim() {
    if (state.ball) return;
    state.pull = null;
    state.originX = AIM_REST_X;
    state.originY = AIM_REST_Y;
  }
  function release() {
    if (state.status !== 'playing' || state.ball || state.fired >= AIM_BALLS || !state.pull) return false;
    const { dx, dy } = state.pull;
    const len = Math.hypot(dx, dy);
    if (len < AIM_MIN_PULL) {
      clearAim();
      state.message = '再拉远一点';
      state.revision++;
      return false;
    }
    const vx = dx * AIM_POWER;
    const vy = dy * AIM_POWER;
    if (vy > AIM_MIN_VY) {
      clearAim();
      state.message = '要往上射';
      state.revision++;
      return false;
    }
    state.ball = { x: state.originX, y: state.originY, vx, vy, age: 0, hits: 0, hitLanes: [] };
    state.fired += 1;
    state.pull = null;
    state.message = `第 ${state.fired} 颗`;
    state.revision++;
    return true;
  }
  function scoreLane(lane) {
    state.ball.hitLanes.push(lane.id);
    state.ball.hits += 1;
    state.combo += 1;
    state.multiplier = comboValue(state.combo);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.bestMultiplier = comboValue(state.bestCombo);
    const base = lane.bonus ? AIM_BONUS_POINT : AIM_NORMAL_POINT;
    const points = pointsFor(base, state.combo);
    state.score += points;
    state.hit += 1;
    state.played = true;
    state.message = `${lane.bonus ? '小靶' : '打中'} +${points} · ${state.combo} 连击`;
    state.fx = { id: ++fxId, kind: 'aim', broken: false, points, combo: state.combo, multiplier: state.multiplier, cells: [], chains: 0 };
    state.revision++;
  }
  function settleBall() {
    const missed = state.ball.hits === 0;
    state.ball = null;
    state.resolved += 1;
    state.originX = AIM_REST_X;
    state.originY = AIM_REST_Y;
    if (missed) {
      state.combo = 0;
      state.multiplier = 1;
      state.message = '这颗没打中，连击清零';
      state.fx = { id: ++fxId, kind: 'aim', broken: true, points: 0, combo: 0, multiplier: 1, cells: [], chains: 0 };
      state.revision++;
    }
    if (state.fired >= AIM_BALLS && state.status === 'playing') finish('complete');
  }
  function integrate(dt) {
    const ball = state.ball;
    if (!ball) return;
    const seconds = dt / 1000;
    ball.vy += AIM_GRAVITY * seconds;
    ball.x += ball.vx * seconds;
    ball.y += ball.vy * seconds;
    ball.age += dt;
    const r = AIM_BALL_R;
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * AIM_RESTITUTION; }
    else if (ball.x > AIM_BOARD_W - r) { ball.x = AIM_BOARD_W - r; ball.vx = -Math.abs(ball.vx) * AIM_RESTITUTION; }
    if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * AIM_RESTITUTION; }
    const lanes = aimTargets(state.lastSim + dt - state.startedAt)
      .sort((a, b) => ball.vy < 0 ? b.y - a.y : a.y - b.y);
    for (const lane of lanes) if (!ball.hitLanes.includes(lane.id) && overlaps(ball, lane)) scoreLane(lane);
    if (ball.y > AIM_BOARD_H + r || ball.age >= AIM_BALL_LIFE) settleBall();
  }
  function advance(until) {
    while (state.lastSim < until - 1e-6) {
      const dt = Math.min(STEP, until - state.lastSim);
      if (state.ball) integrate(dt);
      state.lastSim += dt;
    }
    state.targets = aimTargets(state.lastSim - state.startedAt);
  }
  function tick(at) {
    if (state.status !== 'playing') return;
    advance(Math.min(at, state.deadline));
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
  }
  return {
    state, tick, setAim, release, clearAim,
    select() { return 0; },
    setInputLock() {},
    remaining: at => Math.max(0, Math.min(AIM_DURATION, state.deadline - at)),
    snapshot: () => structuredClone(state),
  };
}
