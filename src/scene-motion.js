import { overchargeAt } from './charge.js';

export function sceneMotionAt(clock, state, fx) {
  const charge = state.charging ? overchargeAt(state.chargeElapsed) : 0;
  const intensity = state.calm ? 0 : Math.max(charge, Math.max(0, Math.min(1, (fx.shake || 0) / 5)));
  const t = clock / 1000;
  // Rainbow charge smoothly adds displacement while the camera stays level.
  const chargeBoost = charge * charge;
  return {
    intensity,
    x: Math.sin(t * 47) * intensity * (7 + 4 * chargeBoost),
    y: Math.cos(t * 41) * intensity * (5 + 3 * chargeBoost),
    rotation: 0,
    uiX: Math.sin(t * 37) * intensity * .45, uiY: Math.cos(t * 31) * intensity * .3,
  };
}
export function project2DMotion(x, y, motion, width = 760, height = 900) {
  return { x: (x + motion.x) / width, y: (y + motion.y) / height };
}
