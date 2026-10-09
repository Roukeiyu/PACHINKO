// Exponential approach: about 63% at 0.5s, 95% at 1.5s, and full at 3.45s.
// Share this calculation between animation and release, independent of FPS.
export function chargeAt(elapsedMs) {
  const charge = -Math.expm1(-Math.max(0, elapsedMs) / 500);
  return charge >= .999 ? 1 : charge;
}

// Do not round an unfinished charge up to 100% in the label or progress bar.
export const chargePercent = charge => Math.floor(charge * 1000) / 10;
