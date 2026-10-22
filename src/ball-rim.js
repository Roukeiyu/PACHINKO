import { ballValue } from './round.js';

// The rim shows this ball's own multiplier: the launch ×N times every star it
// has picked up. The field multiplier and other balls do not change it.
export function ballOwnFactor(ball) {
  const stars = Math.floor(Number(ball?.scoreFactor));
  const starFactor = Number.isInteger(stars) && stars > 0 ? stars : 1;
  return starFactor * ballValue(ball?.valueFactor);
}

// ×1 is a thin light-gold line. ×2 is the solid orange ring. ×4 adds a soft
// halo. ×8 is orange-red with a wider halo. Anything past ×8 keeps that rim
// and strengthens the halo a little.
const RIMS = {
  1: { tier: 1, color: '#e6c878', glow: null, span: 0.24, glowScale: 1, width: 2.6, radius: 14.7 },
  2: { tier: 2, color: '#e2891c', glow: null, span: 0.46, glowScale: 1, width: 3.4, radius: 15.7 },
  4: { tier: 4, color: '#f2b13a', glow: '#ffe1a0', span: 0.56, glowScale: 1, width: 3.6, radius: 16.0 },
  8: { tier: 8, color: '#e44522', glow: '#ff6a3a', span: 0.72, glowScale: 1.16, width: 4.0, radius: 16.4 },
};

export function ballRimStyle(factor) {
  const value = Math.max(1, Number(factor) || 1);
  const tier = value >= 8 ? 8 : value >= 4 ? 4 : value > 1 ? 2 : 1;
  const base = RIMS[tier];
  const extra = tier === 8 && value > 8 ? Math.min(0.45, (value - 8) / 32) : 0;
  return {
    ...base,
    factor: value,
    extra,
    span: Math.min(1, base.span + extra * 0.2),
    glowScale: base.glowScale + extra * 0.45,
    radius: base.radius + extra * 1.4,
    width: base.width + extra * 0.6,
  };
}
