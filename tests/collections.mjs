import assert from 'node:assert/strict';
import { restoreCollections, collectSlot, COLLECTION_TYPES } from '../src/collections.js';
const empty = Object.fromEntries(COLLECTION_TYPES.map(({ id }) => [id, 0]));
const counts = restoreCollections();
assert.deepEqual(counts, empty);
collectSlot(counts, { kind: 'slot', column: 0, multiplier: 2, globalMultiplier: 5, scoreFactor: 25 });
collectSlot(counts, { kind: 'slot', column: 6, multiplier: 2 });
assert.equal(counts[2], 2, 'same fruit shares a count; bonuses do not multiply quantity');
assert.equal(collectSlot(counts, { kind: 'jackpot', multiplier: 2 }), null);
assert.equal(collectSlot(counts, { kind: 'return', multiplier: 2 }), null);
assert.equal(collectSlot(counts, { kind: 'slot', multiplier: 99 }), null);
assert.equal(counts[2], 2, 'only valid fruit slots collect');
assert.deepEqual(restoreCollections(JSON.parse(JSON.stringify(counts))), counts, 'counts survive serialization');
assert.deepEqual(restoreCollections({ 2: -1, 3: 1.5, 5: '20', 10: 40 }), { ...empty, 10: 40 });
assert.deepEqual(restoreCollections({ 2: 4, 3: 1, 5: 9, 10: 2 }), { 2: 4, 3: 1, 5: 9, 10: 2, 20: 0 }, 'old saves keep their counts and gain the new fruit at zero');
for (const saved of [null, false, 0, 'bad']) assert.deepEqual(restoreCollections(saved), empty);
const maximum = restoreCollections({ 2: Number.MAX_SAFE_INTEGER });
collectSlot(maximum, { kind: 'slot', multiplier: 2 });
assert.equal(maximum[2], Number.MAX_SAFE_INTEGER);
console.log('PASS: shared fruit counts, one collection per slot entry, old-save migration and safe saved progress.');

const { createTable, TABLE, slotMultipliers } = await import('../src/physics.js');
const { pocketCenter } = await import('../src/round.js');
const { default: Matter } = await import('matter-js');
function drop(game, column, factor = 1) {
  const ball = game.launch(); assert.ok(ball); ball.entered = true; ball.scoreFactor = factor;
  Matter.Body.setPosition(ball.body, { x: pocketCenter(game.slots, column), y: TABLE.scoreLine - 1 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 6 }); game.step();
}
for (const slots of [5, 7, 9]) for (const multiplier of new Set(slotMultipliers(slots))) {
  const stock = restoreCollections({ [multiplier]: 7 }), events = [];
  const game = createTable({ slots, collections: stock, onScore: e => events.push(e) });
  game.slotMachine.tripleUntil = 60000;
  const column = slotMultipliers(slots).indexOf(multiplier);
  drop(game, column, 2);
  assert.equal(events.length, 1); assert.equal(stock[multiplier], 8);
  assert.equal(events[0].points, multiplier * 10 * 2 * 5, 'slot points ignore the collection count');
  assert.equal(events[0].collection.count, 8);
  assert.equal(events[0].collection.bonus, undefined);
  drop(game, slotMultipliers(slots).lastIndexOf(multiplier), 2);
  assert.equal(stock[multiplier], 9);
  assert.equal(events[1].points, multiplier * 10 * 2 * 5, 'the matching slot on the other side still does not gain a collection bonus');
  for (let i = 0; i < 20; i++) game.step(); assert.equal(events.length, 2, 'settled balls cannot collect again');
  game.setSlots(slots === 5 ? 9 : 5); assert.equal(stock[multiplier], 9, 'layout changes preserve counts');
}
{
  const stock = restoreCollections({ 2: 100 }), events = [];
  // Keep the random star away from the cup approach: this fixture tests the
  // collection bonus, not an additional physical star pickup on the way in.
  const game = createTable({ collections: stock, starRandom: () => .5, onScore: e => events.push(e) });
  game.slotMachine.tripleUntil = 60000;
  const ball = game.launch(); ball.entered = true; ball.scoreFactor = 2;
  const cup = game.holes[0];
  Matter.Body.setPosition(ball.body, { x: cup.x + Math.cos(cup.facing) * 47, y: cup.y + Math.sin(cup.facing) * 47 });
  Matter.Body.setVelocity(ball.body, { x: -Math.cos(cup.facing) * 5, y: -Math.sin(cup.facing) * 5 });
  for (let i = 0; i < 45 && game.balls.includes(ball); i++) game.step();
  assert.equal(events[0].kind, 'jackpot'); assert.equal(events[0].points, 500 * 2 * 5);
  assert.equal(events[0].collection, null);
  assert.equal(stock[2], 100, 'the secret hole awards no fruit');
}
console.log('PASS: slot entries in 5/7/9 layouts record fruit without changing the score, including star and global multipliers.');
