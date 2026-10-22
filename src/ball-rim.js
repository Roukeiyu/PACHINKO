import { ballValue } from './round.js';

// The rim shows this ball's own multiplier: the launch ×N times every star it
// has picked up. The field multiplier and other balls do not change it.
// A gift uses the same product. Fresh drum and clock gifts are ×1; a jar
// release keeps the stored star factor and drops the launch ×N.
export function ballOwnFactor(ball) {
  const stars = Math.floor(Number(ball?.scoreFactor));
  const starFactor = Number.isInteger(stars) && stars > 0 ? stars : 1;
  return starFactor * ballValue(ball?.valueFactor);
}

// ×1 is a thin line. ×2 is a heavier solid ring. ×4 adds a soft halo. ×8 is
// a hot ring with a wider halo. Anything past ×8 keeps that rim and
// strengthens the halo a little. Player balls use gold and orange. Gift balls
// use the same shapes in purple, so the lavender fill stays readable.
const RIMS = {
  1: { tier: 1, color: '#e6c878', glow: null, span: 0.24, glowScale: 1, width: 2.6, radius: 14.7 },
  2: { tier: 2, color: '#e2891c', glow: null, span: 0.46, glowScale: 1, width: 3.4, radius: 15.7 },
  4: { tier: 4, color: '#f2b13a', glow: '#ffe1a0', span: 0.56, glowScale: 1, width: 3.6, radius: 16.0 },
  8: { tier: 8, color: '#e44522', glow: '#ff6a3a', span: 0.72, glowScale: 1.16, width: 4.0, radius: 16.4 },
};
const GIFT_RIMS = {
  1: { tier: 1, color: '#c084fc', glow: null, span: 0.24, glowScale: 1, width: 2.6, radius: 14.7 },
  2: { tier: 2, color: '#9333ea', glow: null, span: 0.46, glowScale: 1, width: 3.4, radius: 15.7 },
  4: { tier: 4, color: '#6d28d9', glow: '#e9d5ff', span: 0.56, glowScale: 1, width: 3.6, radius: 16.0 },
  8: { tier: 8, color: '#e879f9', glow: '#f5d0fe', span: 0.72, glowScale: 1.16, width: 4.0, radius: 16.4 },
};

export function ballRimStyle(factor, gift = false) {
  const value = Math.max(1, Number(factor) || 1);
  const tier = value >= 8 ? 8 : value >= 4 ? 4 : value > 1 ? 2 : 1;
  const base = (gift ? GIFT_RIMS : RIMS)[tier];
  const extra = tier === 8 && value > 8 ? Math.min(0.45, (value - 8) / 32) : 0;
  return {
    ...base,
    gift: gift === true,
    factor: value,
    extra,
    span: Math.min(1, base.span + extra * 0.2),
    glowScale: base.glowScale + extra * 0.45,
    radius: base.radius + extra * 1.4,
    width: base.width + extra * 0.6,
  };
}
