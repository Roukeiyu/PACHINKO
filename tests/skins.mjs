import assert from 'node:assert/strict';
import { BALL_SKINS, FRUIT_ROUND_CAP, SHINE_SCORE, boardTheme, fruitDelta, skinCatalog, skinIdFromQuery, skinUnlocked } from '../src/skins.js';

const cherry = BALL_SKINS.find(skin => skin.id === 'cherry');
const cherryGloss = BALL_SKINS.find(skin => skin.id === 'cherry-gloss');
const melon = BALL_SKINS.find(skin => skin.id === 'watermelon');
const melonGloss = BALL_SKINS.find(skin => skin.id === 'watermelon-gloss');
assert.equal(cherry.need, 80);
assert.equal(cherryGloss.need, 200);
assert.equal(melon.need, 30);
assert.equal(melonGloss.need, 100);
assert.ok(cherry.need < melon.need * 4, 'cherry stays the early unlock');
assert.ok(BALL_SKINS.every(skin => skin.tier === 1 || BALL_SKINS.some(other => other.fruit === skin.fruit && other.tier === 1 && other.need < skin.need)));

const counts = { 2: 80, 3: 0, 5: 0, 10: 0, 20: 0 };
assert.equal(skinUnlocked(cherry, counts), true);
assert.equal(skinUnlocked(cherryGloss, counts), false);
const catalog = skinCatalog(counts, 'cherry');
assert.equal(catalog.find(skin => skin.id === 'cherry').equipped, true);
assert.equal(catalog.find(skin => skin.id === 'watermelon').unlocked, false);

assert.equal(fruitDelta({ fruits: { 2: 1 } }).fruits[2], 1);
assert.equal(fruitDelta({ fruits: { 2: 0, 9: 1 } }).error, 'invalid_fruit');
assert.equal(fruitDelta({ fruits: { 2: FRUIT_ROUND_CAP + 1 } }).error, 'invalid_fruit');
assert.equal(fruitDelta({ fruits: { 2: 0 } }).error, 'empty_round');
assert.equal(skinIdFromQuery('watermelon_gloss'), 'watermelon-gloss');
assert.equal(skinIdFromQuery('nope'), '');
assert.equal(boardTheme('cherry', 'day').hueLock, false);
const day = boardTheme('watermelon-gloss', 'day');
const night = boardTheme('watermelon-gloss', 'night');
assert.equal(day.hueLock, true);
assert.equal(day.motif, 'watermelon');
assert.notEqual(day.bg, night.bg);
assert.notEqual(day.bg, boardTheme('', 'day').bg);
assert.equal(SHINE_SCORE, 1_000_000);
assert.equal(skinIdFromQuery('shine'), 'shine');
assert.equal(boardTheme('shine', 'day').motif, 'shine');
assert.equal(boardTheme('shine', 'day').hueLock, true);
assert.notEqual(boardTheme('shine', 'day').bg, boardTheme('shine', 'night').bg);
assert.equal(skinCatalog(counts, '', false).find(skin => skin.id === 'shine').unlocked, false);
assert.equal(skinCatalog(counts, 'shine', true).find(skin => skin.id === 'shine').equipped, true);

function channels(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}
function luminance(hex) {
  const linear = channels(hex).map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (light + 0.05) / (dark + 0.05);
}
assert.ok(contrast(night.ink, night.bg) >= 7, `watermelon night labels need contrast, got ${contrast(night.ink, night.bg).toFixed(2)}`);
assert.ok(luminance(night.bg) < 0.08, 'watermelon night stays dark');
const shineNight = boardTheme('shine', 'night');
assert.ok(contrast(shineNight.ink, shineNight.bg) >= 7);
const pine = boardTheme('pineapple-gloss', 'day').colors;
const apart = (a, b) => Math.hypot(...channels(a).map((value, index) => (value - channels(b)[index]) * 255));
assert.ok(apart(pine[2], pine[1]) > 80, 'pineapple ×5 is not the same yellow as ×3');
assert.ok(apart(pine[2], pine[3]) > 80, 'pineapple ×5 is not the same yellow as ×10');
console.log('PASS: fruit skins unlock from lifetime counts and reject oversized round deltas.');
