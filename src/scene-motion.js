import { overchargeAt } from './charge.js';

export const SCENE_ROTATION_LIMIT = 5;
export function sceneMotionAt(clock, state, fx) {
  const charge = state.charging ? overchargeAt(state.chargeElapsed) : 0;
  const intensity = state.calm ? 0 : Math.max(charge, Math.max(0, Math.min(1, (fx.shake || 0) / 5)));
  const t = clock / 1000;
  return {
    intensity, x: Math.sin(t * 47) * intensity * 7, y: Math.cos(t * 41) * intensity * 5,
    rotation: Math.sin(t * 17) * intensity * SCENE_ROTATION_LIMIT,
    uiX: Math.sin(t * 37) * intensity * .45, uiY: Math.cos(t * 31) * intensity * .3,
  };
}
export function project2DMotion(x, y, motion, width = 760, height = 900) {
  const angle = motion.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - width / 2, dy = y - height / 2;
  return { x: (width / 2 + motion.x + dx * c - dy * s) / width,
    y: (height / 2 + motion.y + dx * s + dy * c) / height };
}
