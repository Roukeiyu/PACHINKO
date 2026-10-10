// Collections are keyed by the original slot fruit, independent of temporary
// score multipliers, theme changes, and repeated slots in a layout.
export const COLLECTION_TYPES = Object.freeze([
  Object.freeze({ multiplier: 2, name: '樱桃' }),
  Object.freeze({ multiplier: 3, name: '橙子' }),
  Object.freeze({ multiplier: 5, name: '葡萄' }),
  Object.freeze({ multiplier: 10, name: '菠萝' }),
]);
export function restoreCollections(saved) {
  return Object.fromEntries(COLLECTION_TYPES.map(({ multiplier }) => {
    const value = saved?.[multiplier];
    return [multiplier, Number.isSafeInteger(value) && value >= 0 ? value : 0];
  }));
}
export function collectSlot(collections, result) {
  if (result.kind !== 'slot' || !COLLECTION_TYPES.some(type => type.multiplier === result.multiplier)) return null;
  const key = result.multiplier, before = collections[key];
  collections[key] = Math.min(Number.MAX_SAFE_INTEGER, before + 1);
  const previousLevel = collectionStatus(before).level;
  const status = collectionStatus(collections[key]);
  return { multiplier: key, before, ...status, upgraded: status.level > previousLevel };
}

export const COLLECTION_GOALS = Object.freeze([20, 50, 100]);
const BONUS = Object.freeze([1, 1.5, 2, 3]);
export function collectionStatus(count = 0) {
  const level = COLLECTION_GOALS.filter(goal => count >= goal).length;
  return { count, level, bonus: BONUS[level], next: COLLECTION_GOALS[level] ?? null };
}
