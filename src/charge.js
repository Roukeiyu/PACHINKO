// Tune these two holds. Everything else (UI copy, glow, shake, tests) follows them.
// CHARGE_DURATION: press time until launch power snaps to 100%.
// OVERCHARGE_DURATION: extra hold after that before the five-ball burst unlocks.
export const CHARGE_DURATION = 600;
export const OVERCHARGE_DURATION = 900;
export const BURST_READY_AT = CHARGE_DURATION + OVERCHARGE_DURATION;

// The curve reaches 99.9% at CHARGE_DURATION, then snaps to full power.
// Math.log(1000) is that 99.9% threshold, not the length of the hold.
// Share this calculation between animation and release, independent of FPS.
export function chargeAt(elapsedMs) {
  if (elapsedMs >= CHARGE_DURATION) return 1;
  const charge = -Math.expm1(-Math.max(0, elapsedMs) * Math.log(1000) / CHARGE_DURATION);
  return charge >= .999 ? 1 : charge;
}

// Do not round an unfinished charge up to 100% in the label or progress bar.
export const chargePercent = charge => Math.floor(charge * 1000) / 10;

// After full power, OVERCHARGE_DURATION of extra hold builds the five-ball shot.
export function overchargeAt(elapsedMs) {
  const progress = Math.max(0, Math.min(1, (elapsedMs - CHARGE_DURATION) / OVERCHARGE_DURATION));
  return progress * progress * (3 - 2 * progress);
}

export function chargeEffectsAt(elapsedMs) {
  const progress = Math.max(0, Math.min(1, elapsedMs / CHARGE_DURATION));
  const overcharge = overchargeAt(elapsedMs);
  return {
    goldRadius: 46 * (1 - progress) ** .7,
    goldAlpha: Math.min(1, (1 - progress) * 8),
    coronaRadius: progress === 1 ? 22 + overcharge * 40 : 0,
    coronaAlpha: progress === 1 ? .16 + overcharge * .48 : 0,
    overcharge,
  };
}
