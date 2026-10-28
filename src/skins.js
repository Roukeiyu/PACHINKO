// Fruit ball skins. Counts are lifetime slot landings of that fruit.
// Thresholds come from 150-shot rounds on the current board (3 seeds each):
// 5 slots land about 87 cherries, 46 oranges and 34 grapes, and no pineapple
// or watermelon. 7 slots add about 25 pineapples. 9 slots add about 15
// watermelons. A round starts at 5 slots and only reaches watermelon after
// 10000 points, so the watermelon skins stay a long climb.
import { COLLECTION_TYPES } from './collections.js';

export const FRUIT_IDS = Object.freeze(COLLECTION_TYPES.map(type => type.id));
// A real round can add gift balls, but not hundreds of one fruit.
export const FRUIT_ROUND_CAP = 500;
export const FRUIT_ROUND_TOTAL_CAP = 1500;

export const BALL_SKINS = Object.freeze([
  Object.freeze({ id: 'cherry', fruit: 2, tier: 1, need: 80, name: '樱桃', mark: '🍒', edge: '#b42323', mid: '#ffd5d5', glow: '#ff8d8d', flat: '#e24b4b' }),
  Object.freeze({ id: 'cherry-gloss', fruit: 2, tier: 2, need: 200, name: '樱桃糖霜', mark: '🍒', edge: '#c81e4a', mid: '#fff0f3', glow: '#ff9ab0', flat: '#ff5a7a' }),
  Object.freeze({ id: 'orange', fruit: 3, tier: 1, need: 40, name: '橙子', mark: '🍊', edge: '#c2410c', mid: '#ffedd5', glow: '#fdba74', flat: '#f97316' }),
  Object.freeze({ id: 'orange-gloss', fruit: 3, tier: 2, need: 120, name: '橙子糖霜', mark: '🍊', edge: '#9a3412', mid: '#fff7ed', glow: '#fed7aa', flat: '#fb923c' }),
  Object.freeze({ id: 'grape', fruit: 5, tier: 1, need: 30, name: '葡萄', mark: '🍇', edge: '#6b21a8', mid: '#f3e8ff', glow: '#d8b4fe', flat: '#7e22ce' }),
  Object.freeze({ id: 'grape-gloss', fruit: 5, tier: 2, need: 90, name: '葡萄糖霜', mark: '🍇', edge: '#581c87', mid: '#faf5ff', glow: '#e9d5ff', flat: '#9333ea' }),
  Object.freeze({ id: 'pineapple', fruit: 10, tier: 1, need: 20, name: '菠萝', mark: '🍍', edge: '#a16207', mid: '#fef9c3', glow: '#fde047', flat: '#eab308' }),
  Object.freeze({ id: 'pineapple-gloss', fruit: 10, tier: 2, need: 70, name: '菠萝糖霜', mark: '🍍', edge: '#854d0e', mid: '#fefce8', glow: '#fef08a', flat: '#facc15' }),
  Object.freeze({ id: 'watermelon', fruit: 20, tier: 1, need: 30, name: '西瓜', mark: '🍉', edge: '#9f1239', mid: '#dcfce7', glow: '#86efac', flat: '#16a34a' }),
  Object.freeze({ id: 'watermelon-gloss', fruit: 20, tier: 2, need: 100, name: '西瓜糖霜', mark: '🍉', edge: '#14532d', mid: '#f0fdf4', glow: '#bbf7d0', flat: '#22c55e' }),
]);

export function skinById(id) {
  return BALL_SKINS.find(skin => skin.id === id) || null;
}

export function emptyFruit() {
  return Object.fromEntries(FRUIT_IDS.map(id => [id, 0]));
}

export function normalizeFruit(source) {
  const counts = emptyFruit();
  for (const id of FRUIT_IDS) {
    const value = source?.[id] ?? source?.[String(id)] ?? 0;
    counts[id] = Number.isSafeInteger(value) && value > 0 ? value : 0;
  }
  return counts;
}

export function skinUnlocked(skin, counts) {
  return (counts?.[skin.fruit] || 0) >= skin.need;
}

export function skinCatalog(counts, equipped = '') {
  const have = normalizeFruit(counts);
  return BALL_SKINS.map(skin => ({
    id: skin.id,
    fruit: skin.fruit,
    tier: skin.tier,
    name: skin.name,
    mark: skin.mark,
    need: skin.need,
    have: have[skin.fruit],
    unlocked: skinUnlocked(skin, have),
    equipped: equipped === skin.id,
  }));
}

export function fruitDelta(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_json' };
  const fruits = body.fruits;
  if (!fruits || typeof fruits !== 'object' || Array.isArray(fruits)) return { error: 'invalid_fruit' };
  const known = new Set(FRUIT_IDS.map(String));
  for (const key of Object.keys(fruits)) if (!known.has(String(key))) return { error: 'invalid_fruit' };
  const delta = emptyFruit();
  let total = 0;
  for (const id of FRUIT_IDS) {
    const raw = fruits[id] ?? fruits[String(id)] ?? 0;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > FRUIT_ROUND_CAP) return { error: 'invalid_fruit' };
    delta[id] = raw;
    total += raw;
  }
  if (total === 0) return { error: 'empty_round' };
  if (total > FRUIT_ROUND_TOTAL_CAP) return { error: 'invalid_fruit' };
  return { fruits: delta };
}
