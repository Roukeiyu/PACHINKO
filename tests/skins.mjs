import assert from 'node:assert/strict';
import { BALL_SKINS, FRUIT_ROUND_CAP, boardTheme, fruitDelta, skinCatalog, skinIdFromQuery, skinUnlocked } from '../src/skins.js';

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
console.log('PASS: fruit skins unlock from lifetime counts and reject oversized round deltas.');
