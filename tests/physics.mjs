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
    assert.ok(ball.body.velocity.y < -12 && ball.boosting, 'spring starts upward, with the lower-lane booster engaged');
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
  for (const kind of ['bumper', 'rail', 'spinner', 'diamond', 'pin', 'deflector']) assert.ok(game.stats.hits[kind] > 0, `${kind} participates in physical trajectories`);
  assert.ok(outcomes.every(r => r.kind === 'jackpot' ? r.points === 500 : [2, 3, 5, 10].includes(r.multiplier) && r.points === r.multiplier * 10));
  for (const k of Object.keys(totals)) totals[k] += game.stats[k];
  console.log(`PASS: ${slots} slots, ${JSON.stringify(game.stats)}, ${columns.size} distinct scoring slots.`);
}
assert.ok(totals.jackpots > 0 && totals.jackpots < 36, 'physical bonus cups should be attainable and uncommon (<10% in seeded sample)');

// Approach the remaining right cup from its real, narrow mouth. Capture scores exactly
// once, while a trajectory just outside the cup does not receive a jackpot.
{
  const scores = [], game = createTable({ onScore: score => scores.push(score) });
  assert.equal(game.holes.length, 1, 'only the right secret hole remains');
  const h = game.holes[0], direction = -1;
  assert.ok(h.x > TABLE.width / 2);
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
// Real contacts must rotate the triangle once and launch the same ball along
// the displayed direction, without awarding the removed left-hole jackpot.
{
  const scores = [], events = [], game = createTable({ onScore: s => scores.push(s), onSurprise: e => events.push(e) });
  const platform = game.deflectors[0];
  const angles = [0, Math.PI / 3, -Math.PI / 3];
  for (let hit = 0; hit < 6; hit++) {
    const ball = game.launch(); ball.entered = true; ball.boosting = false;
    Matter.Body.setPosition(ball.body, { x: platform.position.x, y: platform.position.y - 60 });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 8 });
    for (let step = 0; step < 30 && platform.plugin.hits === hit; step++) game.step();
    assert.equal(platform.plugin.hits, hit + 1, 'one contact advances once');
    assert.equal(platform.plugin.angle, angles[hit % 3]);
    assert.ok(Math.abs(Math.atan2(ball.body.velocity.y, ball.body.velocity.x) - angles[hit % 3]) < .001, 'outgoing velocity follows the arrow');
    assert.ok(game.balls.includes(ball), 'the platform returns the original ball');
    assert.ok(!Matter.Collision.collides(ball.body, platform), 'rotating the platform must not trap the ball');
    game.step(); assert.equal(platform.plugin.hits, hit + 1, 'separation does not produce a duplicate contact');
    Matter.Composite.remove(game.engine.world, ball.body); game.balls.splice(game.balls.indexOf(ball), 1);
  }
  assert.equal(events.filter(e => e.kind === 'deflect').length, 6);
  assert.equal(scores.length, 0, 'left platform does not award hole points');
  console.log('PASS: six physical triangle contacts cycle through three outgoing directions without duplicate hits or capture.');
}
const scores = [], game = createTable({ onScore: score => scores.push(score) });
const ball = game.launch();
Matter.Body.setPosition(ball.body, { x: TABLE.launchX, y: 820 }); Matter.Body.setVelocity(ball.body, { x: 0, y: 3 });
game.step(); assert.equal(scores.length, 0); assert.equal(game.stats.returns, 1, 'falling in shooter lane returns without scoring');
game.launch(); game.setSlots(9); assert.equal(game.balls.length, 0); assert.equal(game.slots, 9);
console.log(`PASS: right bonus cup, near misses, lane return and slot changes. ${totals.jackpots}/360 bonus entries; fixed physics step ${STEP.toFixed(2)}ms.`);
