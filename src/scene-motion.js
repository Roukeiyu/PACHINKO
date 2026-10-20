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

export function sceneMotionAt(clock, state, fx) {
  const charge = state.calm || !state.charging ? 0 : overchargeAt(state.chargeElapsed);
  const reward = state.calm ? 0 : Math.max(0, Math.min(1, (fx.shake || 0) / 5));
  const intensity = Math.max(charge, reward);
  const t = clock / 1000;
  const chargeBoost = charge * charge;
  const sinX = Math.sin(t * 47), cosY = Math.cos(t * 41);
  const chargeX = sinX * charge * (CHARGE_SHAKE_X + CHARGE_SHAKE_BOOST_X * chargeBoost);
  const chargeY = cosY * charge * (CHARGE_SHAKE_Y + CHARGE_SHAKE_BOOST_Y * chargeBoost);
  const rewardX = sinX * reward * REWARD_SHAKE_X;
  const rewardY = cosY * reward * REWARD_SHAKE_Y;
  return {
    intensity,
    x: larger(chargeX, rewardX),
    y: larger(chargeY, rewardY),
    rotation: CHARGE_SHAKE_ROTATION,
    uiX: Math.sin(t * 37) * intensity * .45, uiY: Math.cos(t * 31) * intensity * .3,
  };
}
export function project2DMotion(x, y, motion, width = 760, height = 900) {
  return { x: (x + motion.x) / width, y: (y + motion.y) / height };
}
