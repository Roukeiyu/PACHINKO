import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
// The fixed, left/right mirrored layout remains identical across new games.
const fixedPositions = createTable({ random: seeded(1) }).pins.map(p => ({ ...p.position }));
for (const seed of [0, 1, 100]) {
  const game = createTable({ random: seeded(seed) });
  assert.equal(game.pins.length, 28);
  const positions = game.pins.map(p => ({ ...p.position }));
  assert.deepEqual(positions, fixedPositions, 'random gameplay must not change pin placement');
  for (const p of positions) assert.ok(positions.some(q => q.x === 700 - p.x && q.y === p.y), 'each pin has a same-height counterpart across the vertical x=350 axis');
  for (const slots of [5, 9, 7]) { game.setSlots(slots); assert.deepEqual(game.pins.map(p => p.position), fixedPositions, 'changing slots preserves pin positions'); }
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    assert.ok(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) >= 58, 'pins leave a passage for balls');
  }
  for (let row = 0; row < 7; row++) assert.ok(positions.some(p => Math.floor((p.y - 150) / 87) === row), 'every horizontal band has pins');
  const probes = positions.map(p => Matter.Bodies.circle(p.x, p.y, 29));
  const extremes = [0, 3].map(() => ({ min: Infinity, max: -Infinity }));
  const angles = [0, 3].map(index => game.rails[index].angle);
  for (let tick = 0; tick < 624; tick++) {
    game.step();
    for (const [i, index] of [0, 3].entries()) {
      const rail = game.rails[index], m = rail.plugin.motion;
      const dx = rail.position.x - m.x, dy = rail.position.y - m.y;
      const travel = dx * Math.cos(angles[i]) + dy * Math.sin(angles[i]);
      extremes[i].min = Math.min(extremes[i].min, travel);
      extremes[i].max = Math.max(extremes[i].max, travel);
      assert.ok(Math.abs(dy * Math.cos(angles[i]) - dx * Math.sin(angles[i])) < 1e-8, 'motion follows the rail long edge, not the screen horizontal');
      assert.equal(rail.angle, angles[i], 'sliding does not rotate the rail');
      assert.ok(Math.abs(travel) <= m.amplitude + 1e-6);
    }
    if (tick % 12 === 0) {
      const obstacles = [...game.rails, ...game.walls, ...game.bumpers, ...game.diamonds, ...game.spinners, ...game.guards];
      assert.ok(probes.every(p => obstacles.every(o => !Matter.Collision.collides(p, o))), 'fixed pins leave ball clearance around obstacles throughout their movement');
    }
  }
  assert.ok(extremes.every(e => e.max - e.min > 67), 'both rails reach both ends of their travel');
  assert.deepEqual(game.pins.map(p => p.position), positions, 'pins remain still during play');
}
console.log('PASS: fixed pins retain left/right mirror symmetry across new games and slot changes, and clear moving obstacles throughout their travel.');
{
  const game = createTable({ random: seeded(5) }), ball = game.launch();
  Matter.Body.setPosition(ball.body, { x: 713, y: 350 });
  Matter.Body.setVelocity(ball.body, { x: -8, y: 0 });
  for (let i = 0; i < 15; i++) game.step();
  assert.ok(ball.body.position.x > 690, 'upper shooter wall keeps the shot inside the lane');
  assert.ok(game.stats.hits.wall > 0, 'restored divider physically blocks the ball');
}
{
  const game = createTable({ random: seeded(5) }), ball = game.launch();
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: 55, y: 335 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 8 });
  for (let i = 0; i < 30 && !game.stats.hits.wall; i++) game.step();
  assert.ok(game.stats.hits.wall > 0 && ball.body.position.y < 400, 'left guard physically intercepts a descending ball');
}
console.log('PASS: left guard blocks descending balls and the restored upper divider contains the shooter lane.');
const totals = { scored: 0, jackpots: 0, returns: 0, timeouts: 0 };
// Sample several launch/reward sequences per slot count on the fixed layout.
for (const slots of [5, 7, 9]) for (const seedOffset of [0, 100, 200]) {
  const outcomes = [], columns = new Set();
  const game = createTable({ slots, random: seeded(42 + slots + seedOffset), onScore: result => { outcomes.push(result); if (result.kind === 'slot') columns.add(result.column); } });
  let escaped = 0;
  for (let shot = 0; shot < 120; shot++) {
    const ball = game.launch(.65 + (shot % 15) * .025);
    assert.ok(ball); assert.ok(ball.body.position.x > 680 && ball.body.position.y > 760, 'must spawn in lower right shooter lane');
    assert.ok(ball.body.velocity.y < -20, 'charged shots receive an initial upward spring impulse');
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
  assert.ok(outcomes.every(r => {
    let factor = r.scoreFactor;
    if (!Number.isInteger(factor) || factor < 1) return false;
    for (const prime of [2, 5]) while (factor % prime === 0) factor /= prime;
    return factor === 1 && r.points === r.basePoints * r.scoreFactor && (r.kind === 'jackpot' ? r.basePoints === 500 : [2, 3, 5, 10].includes(r.multiplier) && r.basePoints === r.multiplier * 10);
  }));
  for (const k of Object.keys(totals)) totals[k] += game.stats[k];
  console.log(`PASS: ${slots} slots, sequence ${seedOffset}, ${JSON.stringify(game.stats)}, ${columns.size} distinct scoring slots.`);
}
assert.ok(totals.jackpots > 0 && totals.jackpots < 108, 'physical bonus cups should be attainable and uncommon (<10% in seeded sample)');

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
  const scores = [], events = [], game = createTable({ random: seeded(1234), onScore: s => scores.push(s), onSurprise: e => events.push(e) });
  const platform = game.deflectors[0];
  const headings = new Set(), quadrants = new Set();
  for (let hit = 0; hit < 32; hit++) {
    const previous = platform.plugin.angle;
    const ball = game.launch(); ball.entered = true;
    Matter.Body.setPosition(ball.body, { x: platform.position.x, y: platform.position.y - 60 });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 8 });
    for (let step = 0; step < 30 && platform.plugin.hits === hit; step++) game.step();
    assert.equal(platform.plugin.hits, hit + 1, 'one contact advances once');
    const angle = platform.plugin.angle;
    const difference = Math.abs(Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous)));
    assert.ok(difference >= 25 * Math.PI / 180 - 1e-6, 'each hit visibly changes direction');
    headings.add(Math.round(angle * 180 / Math.PI));
    quadrants.add(Math.floor(angle / (Math.PI / 2)));
    assert.ok(Math.abs(ball.body.velocity.x - Math.cos(angle) * 12.5) < .001 && Math.abs(ball.body.velocity.y - Math.sin(angle) * 12.5) < .001, 'outgoing velocity follows the arrow');
    assert.ok(game.balls.includes(ball), 'the platform returns the original ball');
    assert.ok(!Matter.Collision.collides(ball.body, platform), 'rotating the platform must not trap the ball');
    game.step(); assert.equal(platform.plugin.hits, hit + 1, 'separation does not produce a duplicate contact');
    Matter.Composite.remove(game.engine.world, ball.body); game.balls.splice(game.balls.indexOf(ball), 1);
  }
  assert.ok(headings.size >= 24, 'continuous angles must not fall back to a small set of presets');
  assert.equal(quadrants.size, 4, 'random headings cover the full circle');
  assert.equal(events.filter(e => e.kind === 'deflect').length, 32);
  assert.equal(scores.length, 0, 'left platform does not award hole points');
  console.log(`PASS: 32 triangle contacts produce ${headings.size} distinct headings across all quadrants without duplicate hits or capture.`);
}
// The shifted upper-left rail intercepts a diagonal approach to the triangle.
{
  const game = createTable(), ball = game.launch();
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: 260, y: 270 });
  Matter.Body.setVelocity(ball.body, { x: -5, y: 6 });
  for (let step = 0; step < 60 && !game.stats.hits.rail; step++) game.step();
  assert.ok(game.stats.hits.rail > 0, 'upper-left rail blocks a diagonal route toward the triangle');
  assert.equal(game.stats.hits.deflector, 0, 'the rail intercepts before the triangle');
  console.log('PASS: shifted upper-left rail intercepts the approach to the triangle.');
}
const scores = [], game = createTable({ onScore: score => scores.push(score) });
const ball = game.launch();
Matter.Body.setPosition(ball.body, { x: TABLE.launchX, y: 820 }); Matter.Body.setVelocity(ball.body, { x: 0, y: 3 });
game.step(); assert.equal(scores.length, 0); assert.equal(game.stats.returns, 1, 'falling in shooter lane returns without scoring');
game.launch(); game.setSlots(9); assert.equal(game.balls.length, 0); assert.equal(game.slots, 9);
console.log(`PASS: right bonus cup, near misses, lane return and slot changes. ${totals.jackpots}/1080 bonus entries; fixed physics step ${STEP.toFixed(2)}ms.`);
