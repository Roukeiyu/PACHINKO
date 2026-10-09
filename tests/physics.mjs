import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const totals = { scored: 0, jackpots: 0, returns: 0, timeouts: 0 };
for (const slots of [5, 7, 9]) {
  const outcomes = [], columns = new Set();
  const game = createTable({ slots, random: seeded(42 + slots), onScore: result => { outcomes.push(result); if (result.kind === 'slot') columns.add(result.column); } });
  let escaped = 0;
  for (let shot = 0; shot < 120; shot++) {
    const ball = game.launch(.2 + (shot % 17) / 20);
    assert.ok(ball); assert.ok(ball.body.position.x > 680 && ball.body.position.y > 760, 'must spawn in lower right shooter lane');
    assert.ok(ball.body.velocity.y < -24, 'plunger gives upward momentum');
    for (let step = 0; step < 5500 && game.balls.length; step++) {
      game.step();
      for (const b of game.balls) if (b.body.position.x < 30 || b.body.position.x > 734 || b.body.position.y < 36) escaped++;
    }
    assert.equal(game.balls.length, 0, 'every ball must settle or visibly return');
  }
  assert.equal(escaped, 0, 'fast balls must not tunnel through side or top walls');
  assert.ok(game.stats.entered >= 116, 'shooter lane must reliably lead to the playing field');
  assert.ok(game.stats.scored >= 100, 'the large majority of launches must resolve into scoring');
  assert.ok(game.stats.timeouts <= 3, 'obstacle layout must not trap balls');
  assert.ok(columns.size >= slots - 1, 'multiple routes must reach almost all slots');
  for (const kind of ['bumper', 'rail', 'spinner', 'diamond', 'pin']) assert.ok(game.stats.hits[kind] > 0, `${kind} participates in physical trajectories`);
  assert.ok(outcomes.every(r => r.kind === 'jackpot' ? r.points === 500 : [2, 3, 5, 10].includes(r.multiplier) && r.points === r.multiplier * 10));
  for (const k of Object.keys(totals)) totals[k] += game.stats[k];
  console.log(`PASS: ${slots} slots, ${JSON.stringify(game.stats)}, ${columns.size} distinct scoring slots.`);
}
assert.ok(totals.jackpots > 0 && totals.jackpots < 36, 'physical bonus cups should be attainable and uncommon (<10% in seeded sample)');

// Approach each cup from its real, narrow mouth. Ensure capture scores exactly
// once, while a trajectory just outside the cup does not receive a jackpot.
for (const index of [0, 1]) {
  const scores = [], game = createTable({ onScore: score => scores.push(score) });
  const h = game.holes[index], direction = index === 0 ? 1 : -1;
  const ball = game.launch(); ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: h.x + direction * 47, y: h.y - 2 });
  Matter.Body.setVelocity(ball.body, { x: -direction * 5, y: -1 });
  for (let i = 0; i < 45; i++) game.step();
  assert.equal(scores.length, 1); assert.equal(scores[0].points, 500);
  const miss = game.launch(); miss.entered = true;
  Matter.Body.setPosition(miss.body, { x: h.x + direction * 48, y: h.y - 48 });
  Matter.Body.setVelocity(miss.body, { x: -direction * 3, y: 0 });
  for (let i = 0; i < 15; i++) game.step();
  assert.equal(scores.length, 1, 'near misses cannot count as cup entry');
}
const scores = [], game = createTable({ onScore: score => scores.push(score) });
const ball = game.launch();
Matter.Body.setPosition(ball.body, { x: TABLE.launchX, y: 820 }); Matter.Body.setVelocity(ball.body, { x: 0, y: 3 });
game.step(); assert.equal(scores.length, 0); assert.equal(game.stats.returns, 1, 'falling in shooter lane returns without scoring');
game.launch(); game.setSlots(9); assert.equal(game.balls.length, 0); assert.equal(game.slots, 9);
console.log(`PASS: both bonus cups, near misses, lane return and slot changes. ${totals.jackpots}/360 bonus entries; fixed physics step ${STEP.toFixed(2)}ms.`);
