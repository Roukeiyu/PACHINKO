// Mini-game score already includes combo. The visit multiplier is applied after that, with no score cap.
export const secretPayout = (gameScore, waveMultiplier = 1) => gameScore * waveMultiplier;
// One secret visit: the first hole opens the wait, and every later hole before
// the mini-game starts belongs to that same visit. Two entries double the
// visit once. A third hole keeps ×2; it does not stack and does not open another game.
export function createSecretWave() {
  let entries = 0;
  let multiplier = 1;
  let firstPoints = 0;
  return {
    get entries() { return entries; },
    get multiplier() { return multiplier; },
    enter(points) {
      entries += 1;
      if (entries === 1) {
        firstPoints = points;
        multiplier = 1;
        return { pay: points, retro: 0, doubledNow: false, startWait: true };
      }
      let retro = 0;
      let doubledNow = false;
      if (multiplier === 1) {
        multiplier = 2;
        retro = firstPoints;
        doubledNow = true;
      }
      return { pay: points * multiplier, retro, doubledNow, startWait: false };
    },
    reset() {
      entries = 0;
      multiplier = 1;
      firstPoints = 0;
    },
  };
}
