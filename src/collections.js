// The book stores a count per fruit. It no longer changes slot score.
// Older saves used the same ids (2/3/5/10). A new center fruit is 20.
export const COLLECTION_TYPES = Object.freeze([
  Object.freeze({ id: 2, name: '樱桃' }),
  Object.freeze({ id: 3, name: '橙子' }),
  Object.freeze({ id: 5, name: '葡萄' }),
  Object.freeze({ id: 10, name: '菠萝' }),
  Object.freeze({ id: 20, name: '西瓜' }),
]);

export function restoreCollections(saved) {
  const source = saved && typeof saved === 'object' ? saved : {};
  return Object.fromEntries(COLLECTION_TYPES.map(({ id }) => {
    const value = source[id] ?? source[String(id)];
    return [id, Number.isSafeInteger(value) && value >= 0 ? value : 0];
  }));
}

export function collectSlot(collections, result) {
  if (result.kind !== 'slot' || !COLLECTION_TYPES.some(type => type.id === result.multiplier)) return null;
  const key = result.multiplier;
  const before = collections[key] ?? 0;
  const count = Math.min(Number.MAX_SAFE_INTEGER, before + 1);
  collections[key] = count;
  return { id: key, multiplier: key, before, count };
}
