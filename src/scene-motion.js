import { overchargeAt } from './charge.js';

// Charge shake only. Reward shake stays on REWARD_SHAKE_X/Y.
// The old full-rainbow peaks were 11 by 8 table units (base 7/5 plus boost 4/3).
// CHARGE_SHAKE_SCALE halves that curve to 5.5 by 4. Do not turn this back up to
// sell 3D depth; depth comes from perspective and rail height.
export const CHARGE_SHAKE_SCALE = 0.5;
export const REWARD_SHAKE_X = 7;
export const REWARD_SHAKE_Y = 5;
export const CHARGE_SHAKE_X = REWARD_SHAKE_X * CHARGE_SHAKE_SCALE;
export const CHARGE_SHAKE_Y = REWARD_SHAKE_Y * CHARGE_SHAKE_SCALE;
export const CHARGE_SHAKE_BOOST_X = 4 * CHARGE_SHAKE_SCALE;
export const CHARGE_SHAKE_BOOST_Y = 3 * CHARGE_SHAKE_SCALE;
export const CHARGE_SHAKE_ROTATION = 0;

const larger = (chargeOffset, rewardOffset) => Math.abs(chargeOffset) >= Math.abs(rewardOffset) ? chargeOffset : rewardOffset;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
// About one painted frame of the 7.5Hz wave. A hitch longer than this must not
// teleport the board to the opposite side of the sine.
const SHAKE_FRAME_S = 1 / 60;
const SHAKE_HITCH_S = 0.025;
const SHAKE_STEP = 4.6;
export const SOFT_LAUNCH_SCALE = 0.28;

const motionMemory = { clock: null, x: 0, y: 0 };

export function sceneMotionSample(clock, state = {}, fx = {}) {
  const charge = state.calm || !state.charging ? 0 : overchargeAt(state.chargeElapsed);
  const reward = state.calm ? 0 : Math.max(0, Math.min(1, (fx.shake || 0) / 5));
  const intensity = Math.max(charge, reward);
  const t = clock / 1000;
  const chargeBoost = charge * charge;
  const sinX = Math.sin(t * 47), cosY = Math.cos(t * 41);
  const soft = state.softLaunch ? SOFT_LAUNCH_SCALE : 1;
  const chargeCapX = (CHARGE_SHAKE_X + CHARGE_SHAKE_BOOST_X) * soft;
  const chargeCapY = (CHARGE_SHAKE_Y + CHARGE_SHAKE_BOOST_Y) * soft;
  const chargeX = clamp(sinX * charge * (CHARGE_SHAKE_X + CHARGE_SHAKE_BOOST_X * chargeBoost) * soft, chargeCapX);
  const chargeY = clamp(cosY * charge * (CHARGE_SHAKE_Y + CHARGE_SHAKE_BOOST_Y * chargeBoost) * soft, chargeCapY);
  const rewardX = sinX * reward * REWARD_SHAKE_X;
  const rewardY = cosY * reward * REWARD_SHAKE_Y;
  const shown = state.softLaunch && charge >= reward ? intensity * soft : intensity;
  return {
    intensity: shown,
    x: clamp(larger(chargeX, rewardX), REWARD_SHAKE_X),
    y: clamp(larger(chargeY, rewardY), REWARD_SHAKE_Y),
    rotation: CHARGE_SHAKE_ROTATION,
    uiX: Math.sin(t * 37) * shown * .45,
    uiY: Math.cos(t * 31) * shown * .3,
  };
}

export function sceneMotionAt(clock, state, fx) {
  const sample = sceneMotionSample(clock, state, fx);
  const previous = motionMemory.clock;
  let x = sample.x, y = sample.y;
  const dt = previous == null ? 0 : (clock - previous) / 1000;
  if (previous != null && dt > SHAKE_HITCH_S && dt < 0.12) {
    const step = SHAKE_STEP * Math.min(dt, SHAKE_FRAME_S) / SHAKE_FRAME_S;
    x = motionMemory.x + clamp(sample.x - motionMemory.x, step);
    y = motionMemory.y + clamp(sample.y - motionMemory.y, step);
  }
  motionMemory.clock = clock;
  motionMemory.x = x;
  motionMemory.y = y;
  return { ...sample, x, y };
}
export function project2DMotion(x, y, motion, width = 760, height = 900) {
  return { x: (x + motion.x) / width, y: (y + motion.y) / height };
}
