// Phone vibration is independent of the sound mute. Browsers without
// navigator.vibrate, including iOS Safari, are skipped without an error.
export const HAPTIC_COLLISION_MS = 12;
export const HAPTIC_SLOT_MS = 28;
export const HAPTIC_LUCKY_MS = 55;
export const HAPTIC_JACKPOT_PATTERN = Object.freeze([40, 30, 80]);
export const HAPTIC_MIN_INTERVAL = 50;
export const HAPTIC_MIN_SPEED = 2;

const RANK = Object.freeze({ collision: 1, slot: 2, lucky: 3, jackpot: 4 });

export const patternDuration = pattern => typeof pattern === 'number' ? pattern : pattern.reduce((sum, part) => sum + part, 0);

function defaultVibrate(pattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  return navigator.vibrate(pattern);
}

export function createHaptics({ vibrate = defaultVibrate, now = () => performance.now() } = {}) {
  let enabled = true;
  let lastCollisionAt = -Infinity;
  let activeRank = 0;
  let activeUntil = -Infinity;
  function buzz(pattern, rank, at) {
    if (!enabled) return false;
    // A weaker pulse must not cut off a stronger one that is still running.
    if (rank < activeRank && at < activeUntil) return false;
    let accepted = false;
    try { if (typeof vibrate === 'function') accepted = vibrate(pattern) !== false; } catch { accepted = false; }
    if (!accepted) return false;
    activeRank = rank;
    activeUntil = at + patternDuration(pattern);
    return true;
  }
  return {
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) {
        activeRank = 0; activeUntil = -Infinity; lastCollisionAt = -Infinity;
        try { if (typeof vibrate === 'function') vibrate(0); } catch { /* cancelling is optional */ }
      }
    },
    get enabled() { return enabled; },
    collision(speed, at = now()) {
      if (!(speed >= HAPTIC_MIN_SPEED)) return false;
      if (at - lastCollisionAt < HAPTIC_MIN_INTERVAL) return false;
      const played = buzz(HAPTIC_COLLISION_MS, RANK.collision, at);
      if (played) lastCollisionAt = at;
      return played;
    },
    score(result, at = now()) {
      if (!result) return false;
      if (result.kind === 'jackpot') return buzz(HAPTIC_JACKPOT_PATTERN, RANK.jackpot, at);
      if (result.kind === 'slot' && (result.lucky || result.multiplier >= 10)) return buzz(HAPTIC_LUCKY_MS, RANK.lucky, at);
      if (result.kind === 'slot') return buzz(HAPTIC_SLOT_MS, RANK.slot, at);
      return false;
    },
    upgrade(at = now()) { return buzz(HAPTIC_JACKPOT_PATTERN, RANK.jackpot, at); },
    tap(ms = HAPTIC_COLLISION_MS, at = now()) { return buzz(ms, RANK.collision, at); },
  };
}
