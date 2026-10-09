// Reach the 99.9% snap threshold in exactly two seconds.
// Share this calculation between animation and release, independent of FPS.
export function chargeAt(elapsedMs) {
  if (elapsedMs >= 2000) return 1;
  const charge = -Math.expm1(-Math.max(0, elapsedMs) * Math.log(1000) / 2000);
  return charge >= .999 ? 1 : charge;
}

// Do not round an unfinished charge up to 100% in the label or progress bar.
export const chargePercent = charge => Math.floor(charge * 1000) / 10;

// Full charge takes two seconds; the next three seconds build the five-ball shot.
export function overchargeAt(elapsedMs) {
  const progress = Math.max(0, Math.min(1, (elapsedMs - 2000) / 3000));
  return progress * progress * (3 - 2 * progress);
}

export function chargeEffectsAt(elapsedMs) {
  const progress = Math.max(0, Math.min(1, elapsedMs / 2000));
  const overcharge = overchargeAt(elapsedMs);
  return {
    goldRadius: 46 * (1 - progress) ** .7,
    goldAlpha: Math.min(1, (1 - progress) * 8),
    coronaRadius: progress === 1 ? 22 + overcharge * 40 : 0,
    coronaAlpha: progress === 1 ? .16 + overcharge * .48 : 0,
    overcharge,
  };
}
