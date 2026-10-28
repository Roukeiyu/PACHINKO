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
// One run, not a lifetime total. The live top score is about 101220.
export const SHINE_SCORE = 1_000_000;
export const SHINE_SKIN = Object.freeze({ id: 'shine', fruit: 0, tier: 3, legendary: true, need: SHINE_SCORE, name: '闪耀皮肤', mark: '✦' });

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
  if (id === SHINE_SKIN.id) return SHINE_SKIN;
  return BALL_SKINS.find(skin => skin.id === id) || null;
}

export function devRevealOverride() {
  if (!import.meta.env?.DEV) return false;
  try {
    return new URLSearchParams(globalThis.location?.search || '').get('reveal') === 'shine';
  } catch {
    return false;
  }
}

export function skinIdFromQuery(raw) {
  if (!raw) return '';
  const id = String(raw).trim().toLowerCase().replaceAll('_', '-');
  return skinById(id) ? id : '';
}

// Dev builds only: ?skin=watermelon_gloss or ?skin=watermelon-gloss.
export function devSkinOverride() {
  if (!import.meta.env?.DEV) return '';
  try {
    return skinIdFromQuery(new URLSearchParams(globalThis.location?.search || '').get('skin'));
  } catch {
    return '';
  }
}

export function activeSkinId(equipped = '') {
  return devSkinOverride() || equipped || '';
}

const DEFAULT_BOARD = Object.freeze({
  id: 'default',
  hueLock: false,
  motifs: ['🐰', '🐻', '🐱'],
  bg: '#fbf3e9',
  pin: '#b2c3a1',
  accent: '#e994a4',
  colors: Object.freeze(['#e6ecca', '#f8dfb1', '#efc2cb', '#d5e6d3', '#f6dba7', '#efc2cb', '#e6ecca']),
  wall: '#aebf99',
  wallEdge: '#dce6ce',
  wallSide: '#829d78',
  floor: '#b6bea5',
  field: '#ffffff29',
  fieldEdge: '#c3c4a93b',
  lane: '#d9e6d299',
  ink: '#69815d',
  slotInk: '#4c6648',
  motif: '',
});

const GLOSS_BOARDS = Object.freeze({
  'cherry-gloss': { bg: '#fff0f3', pin: '#e7a3ad', accent: '#d4536c', wall: '#f0c3cb', wallEdge: '#ffe4ea', wallSide: '#c47b8a', floor: '#e7c9cf', field: '#fff5f729', fieldEdge: '#e7b4c03b', ink: '#7a3144', slotInk: '#5c2433', colors: ['#ffd0d8', '#ffe1c4', '#f3c4e0', '#ffd9a8', '#ffb7c5', '#f3c4e0', '#ffd0d8'], motif: 'cherry' },
  'orange-gloss': { bg: '#fff6e8', pin: '#f0b56a', accent: '#e07a2f', wall: '#f3d0a0', wallEdge: '#fff1dc', wallSide: '#c48a4e', floor: '#ead4b0', field: '#fff8ec29', fieldEdge: '#e7c49a3b', ink: '#7a4516', slotInk: '#5c3210', colors: ['#ffe0bf', '#ffd09a', '#f7c8a0', '#ffe7a3', '#ffc48a', '#f7c8a0', '#ffe0bf'], motif: 'orange' },
  'grape-gloss': { bg: '#f7f1fb', pin: '#c9aee0', accent: '#8d5cc4', wall: '#dcc8ee', wallEdge: '#f6eeff', wallSide: '#8d74aa', floor: '#d4c6e4', field: '#f8f2ff29', fieldEdge: '#cbb6e03b', ink: '#4d2d6e', slotInk: '#3a2154', colors: ['#ead8f8', '#f0d4c4', '#d7c2f2', '#e7d4a8', '#c9b0ea', '#d7c2f2', '#ead8f8'], motif: 'grape' },
  'pineapple-gloss': { bg: '#f8f6d4', pin: '#c9c45a', accent: '#b8891a', wall: '#e4e09a', wallEdge: '#fbf8d8', wallSide: '#8f8a3e', floor: '#ddd8a4', field: '#fbfae429', fieldEdge: '#d5cf8a3b', ink: '#5c5420', slotInk: '#3f3a14', colors: ['#f4efb0', '#f6e0a8', '#e7e49a', '#f3d98a', '#e4d56a', '#e7e49a', '#f4efb0'], motif: 'pineapple' },
  'watermelon-gloss': { bg: '#f3fff5', pin: '#7dba86', accent: '#e25b6a', wall: '#b7e0bc', wallEdge: '#e7ffea', wallSide: '#4f8a5c', floor: '#c5e2c8', field: '#f4fff629', fieldEdge: '#9dcea63b', ink: '#245c34', slotInk: '#1c4026', colors: ['#d8f5de', '#ffd0c8', '#c8efd0', '#ffe0b0', '#f7b7c0', '#c8efd0', '#d8f5de'], motif: 'watermelon' },
  shine: { bg: '#12142e', pin: '#f6e7a8', accent: '#9ad7ff', wall: '#3a3474', wallEdge: '#efe7ff', wallSide: '#2a245c', floor: '#1c1848', field: '#ffffff14', fieldEdge: '#ffe7a866', lane: '#3a347488', ink: '#f7f1ff', slotInk: '#24143a', colors: ['#ffe4f2', '#fff3c4', '#dff4ff', '#efe4ff', '#ffe1c2', '#e7fff1', '#ffe4f2'], motif: 'shine' },
});

function rgb(hex) {
  const raw = hex.slice(1);
  return [0, 2, 4].map(index => parseInt(raw.slice(index, index + 2), 16));
}

function mix(hex, target, t) {
  const a = rgb(hex), b = rgb(target);
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * t).toString(16).padStart(2, '0')).join('')}`;
}

const NIGHT_AMOUNT = Object.freeze({ day: 0, dawn: 0.22, dusk: 0.4, night: 0.62 });

function nightBoard(day, phase) {
  const amount = NIGHT_AMOUNT[phase] ?? 0;
  if (!amount) return day;
  const shadow = day.motif === 'shine' ? '#070814' : day.motif === 'grape' ? '#120818' : day.motif === 'watermelon' ? '#06140c' : day.motif === 'pineapple' ? '#161404' : '#1a0c10';
  const slotAmount = amount * 0.42;
  return {
    ...day,
    bg: mix(day.bg, shadow, amount),
    pin: mix(day.pin, shadow, amount * 0.85),
    accent: mix(day.accent, shadow, amount * 0.55),
    wall: mix(day.wall, shadow, amount * 0.8),
    wallEdge: mix(day.wallEdge, shadow, amount * 0.7),
    wallSide: mix(day.wallSide, shadow, amount * 0.75),
    floor: mix(day.floor, shadow, amount * 0.8),
    field: day.field,
    fieldEdge: day.fieldEdge,
    ink: mix(day.ink, '#fff6ea', amount * 0.72),
    slotInk: mix(day.slotInk, '#1a120c', amount * 0.15),
    colors: day.colors.map(color => mix(color, shadow, slotAmount)),
  };
}

const boardCache = new Map();

export function boardTheme(skinId, phase = 'day') {
  const skin = skinById(skinId);
  const gloss = skin?.id === 'shine' || skin?.tier === 2 ? GLOSS_BOARDS[skin.id] : null;
  if (!gloss) return DEFAULT_BOARD;
  const key = `${skin.id}:${phase}`;
  if (!boardCache.has(key)) {
    const day = { ...DEFAULT_BOARD, ...gloss, id: skin.id, hueLock: true, motifs: DEFAULT_BOARD.motifs };
    boardCache.set(key, Object.freeze(nightBoard(day, phase)));
  }
  return boardCache.get(key);
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

export function skinCatalog(counts, equipped = '', shineUnlocked = false) {
  const have = normalizeFruit(counts);
  const fruit = BALL_SKINS.map(skin => ({
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
  fruit.push({
    id: SHINE_SKIN.id,
    fruit: 0,
    tier: 3,
    legendary: true,
    name: shineUnlocked ? SHINE_SKIN.name : '？？？',
    mark: shineUnlocked ? SHINE_SKIN.mark : '?',
    need: SHINE_SCORE,
    have: shineUnlocked ? SHINE_SCORE : 0,
    unlocked: shineUnlocked === true,
    equipped: equipped === SHINE_SKIN.id,
  });
  return fruit;
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
