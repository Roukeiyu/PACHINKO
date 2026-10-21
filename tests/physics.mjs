import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
import { reelBox } from '../src/slot-machine.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
// The two marked centerline positions always contain real, active spring studs.
for (const slots of [5, 7, 9]) {
  const hits = [], game = createTable({ slots, onHit: hit => hits.push(hit) });
  const positions = game.kickers.map(k => ({ ...k.position }));
  assert.deepEqual(positions, [{ x: 350, y: 50 }, { x: 350, y: 690 }]);
  for (const [index, kicker] of game.kickers.entries()) {
    game.setSlots(slots);
    const ball = game.launch(); ball.entered = true;
    const side = index === 0 ? 1 : -1;
    Matter.Body.setPosition(ball.body, { x: kicker.position.x, y: kicker.position.y + side * 34 });
    Matter.Body.setVelocity(ball.body, { x: 0, y: -side * 3 });
    for (let step = 0; step < 20 && !hits.some(h => h.kind === 'kicker' && h.index === index); step++) game.step();
    assert.ok(hits.some(h => h.kind === 'kicker' && h.index === index), 'physical contact triggers impact feedback');
    assert.ok(ball.body.velocity.y * side > 5, 'the stud actively kicks the ball away');
    assert.ok(kicker.plugin.glow > 0, 'contact lights up the stud');
    assert.deepEqual(game.rewards.hits, [0, 0, 0], 'studs do not advance the three large bumper rewards');
  }
  assert.deepEqual(game.kickers.map(k => k.position), positions, 'slot changes and impacts preserve both fixed obstacles');
}
console.log('PASS: both fixed centerline spring studs actively rebound balls and trigger feedback in all slot layouts.');
// The fixed, left/right mirrored layout remains identical across new games.
const fixedPositions = createTable({ random: seeded(1) }).pins.map(p => ({ ...p.position }));
for (const seed of [0, 1, 100]) {
  const game = createTable({ random: seeded(seed) });
  assert.equal(game.pins.length, 26);
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
      const obstacles = [...game.rails, ...game.walls, ...game.bumpers, ...game.kickers, ...game.diamonds, ...game.spinners, ...game.guards];
      assert.ok(probes.every(p => obstacles.every(o => !Matter.Collision.collides(p, o))), 'fixed pins leave ball clearance around obstacles throughout their movement');
    }
  }
  assert.ok(extremes.every(e => e.max - e.min > 67), 'both rails reach both ends of their travel');
  assert.deepEqual(game.pins.map(p => p.position), positions, 'pins remain still during play');
}
console.log('PASS: fixed pins retain left/right mirror symmetry across new games and slot changes, and clear moving obstacles throughout their travel.');
{
  const game = createTable({ random: seeded(3) });
  assert.equal(game.diamonds.length, 2);
  assert.deepEqual(game.pins.map(p => [p.position.x, p.position.y]).filter(([x, y]) => y > 690 && x > 280 && x < 420), [], 'the two pegs beside the lower spring are gone');
  const reels = [0, 1, 2].map(index => { const box = reelBox(index); return Matter.Bodies.rectangle(box.x, box.y, box.size, box.size, { isStatic: true }); });
  const neighbours = [...game.pins, ...game.kickers, ...reels];
  const limits = game.diamonds.map(() => ({ min: Infinity, max: -Infinity }));
  const spins = game.diamonds.map(() => ({ first: null, last: null }));
  for (let tick = 0; tick < Math.ceil(6000 / STEP); tick++) {
    game.step();
    game.diamonds.forEach((diamond, index) => {
      const motion = diamond.plugin.motion;
      const travel = diamond.position.y - motion.y;
      limits[index].min = Math.min(limits[index].min, travel);
      limits[index].max = Math.max(limits[index].max, travel);
      assert.ok(Math.abs(diamond.position.x - motion.x) < 1e-6, 'diamonds travel vertically');
      assert.ok(Math.abs(travel) <= motion.amplitude + 1e-6);
      assert.equal(Matter.Query.collides(diamond, neighbours).length, 0, 'a moving diamond stays clear of pegs, the pink stud and the reels');
      if (!spins[index].first) spins[index].first = diamond.angle;
      spins[index].last = diamond.angle;
    });
    const travelSum = (game.diamonds[0].position.y - game.diamonds[0].plugin.motion.y) + (game.diamonds[1].position.y - game.diamonds[1].plugin.motion.y);
    assert.ok(Math.abs(travelSum) < 1e-6, 'the two diamonds stay opposite in phase');
  }
  assert.ok(limits.every(limit => limit.min < -19 && limit.max > 19), 'both diamonds reach both ends of the ±20 travel');
  const turned = spins.map(spin => spin.last - spin.first);
  assert.ok(turned[0] > Math.PI * 2.5 && turned[1] < -Math.PI * 2.5, 'each diamond turns more than a full opposite rotation in 6s');
  const rising = createTable({ random: seeded(3) });
  while (rising.clock + STEP < 1500) rising.step();
  const diamond = rising.diamonds[0];
  const before = diamond.position.y;
  const ball = rising.launch();
  ball.entered = true;
  const top = Math.min(...diamond.vertices.map(vertex => vertex.y));
  Matter.Body.setPosition(ball.body, { x: diamond.position.x, y: top - 10 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
  const ballY = ball.body.position.y;
  rising.step();
  assert.ok(diamond.position.y < before, 'this sample is the upward stroke');
  assert.ok(ball.body.position.y < ballY, 'the rising diamond carries the ball up instead of letting it sink through');
  assert.ok(ball.body.velocity.y < 0, 'the kinematic velocity leaves the ball moving upward');
  const parked = { y: diamond.position.y, angle: diamond.angle, clock: rising.clock };
  rising.setEmissionPaused(true);
  rising.step();
  assert.notEqual(rising.diamonds[0].position.y, parked.y, 'secret drain still simulates, so the diamonds keep their cycle');
  const frozenY = rising.diamonds[0].position.y;
  const frozenAngle = rising.diamonds[0].angle;
  const frozenClock = rising.clock;
  rising.advanceEnlarge(4000);
  assert.equal(rising.clock, frozenClock);
  assert.equal(rising.diamonds[0].position.y, frozenY, 'a wall-clock pause does not move the diamonds without a physics step');
  assert.equal(rising.diamonds[0].angle, frozenAngle);
}
console.log('PASS: lower diamonds travel ±20px out of phase, spin opposite ways, push a resting ball, and freeze when physics does.');
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
  const game = createTable({ slots, random: seeded(42 + slots + seedOffset), slotRandom: seeded(4242 + slots + seedOffset), onScore: result => { outcomes.push(result); if (result.kind === 'slot') columns.add(result.column); } });
  let escaped = 0;
  for (let shot = 0; shot < 120; shot++) {
    const ball = game.launch(.65 + (shot % 15) * .025);
    assert.ok(ball); assert.ok(ball.body.position.x > 680 && ball.body.position.y > 760, 'must spawn in lower right shooter lane');
    assert.ok(ball.body.velocity.y < -20, 'charged shots receive an initial upward spring impulse');
    // Milestones emit new reward balls after launch; allow their own 45-second
    // lifetime too, while keeping the timeout-count and containment checks below.
    for (let step = 0; step < Math.ceil(90000 / STEP) && (game.balls.length || game.collector.remaining); step++) {
      game.step();
      for (const b of game.balls) if (b.body.position.x < 30 || b.body.position.x > 734 || b.body.position.y < 36) escaped++;
    }
    assert.equal(game.balls.length, 0, 'every ball must score, enter storage or visibly return');
    assert.equal(game.collector.remaining, 0, 'all queued storage drops must emerge and settle');
  }
  assert.equal(escaped, 0, 'fast balls must not tunnel through side or top walls');
  assert.ok(game.stats.entered >= 116, 'shooter lane must reliably lead to the playing field');
  assert.ok(game.stats.scored >= 10, 'scoring pockets stay reachable after drain mouths open');
  assert.ok(game.stats.scored + game.stats.absorbed + game.stats.drains + game.stats.returns >= 100, 'every launch still resolves on the board');
  assert.ok(game.stats.timeouts <= 3, 'obstacle layout must not trap balls');
  assert.ok(columns.size >= slots - 1, 'multiple routes must reach almost all slots');
  for (const kind of ['bumper', 'rail', 'spinner', 'diamond', 'pin', 'deflector']) assert.ok(game.stats.hits[kind] > 0, `${kind} participates in physical trajectories`);
  assert.ok(outcomes.every(r => {
    let factor = r.scoreFactor;
    if (!Number.isInteger(factor) || factor < 1) return false;
    for (const prime of [2, 5]) while (factor % prime === 0) factor /= prime;
    return factor === 1 && [1, 2, 5].includes(r.globalMultiplier) && r.points === r.basePoints * r.scoreFactor * r.globalMultiplier && (r.kind === 'jackpot' ? r.basePoints === 500 : [2, 3, 5, 10, 20].includes(r.multiplier) && r.basePoints === r.multiplier * 10);
  }));
  assert.equal(game.slotMachine.entries, game.stats.scored, 'each actual scoring entry advances the slot machine once');
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
  // Approach below the now-symmetric upper bumper so this probes the rail.
  Matter.Body.setPosition(ball.body, { x: 250, y: 290 });
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
{
  const kept = createTable();
  kept.launch();
  assert.equal(kept.balls.length, 1);
  kept.setSlots(7, { keepBalls: true });
  assert.equal(kept.balls.length, 1, 'a score upgrade leaves the ball on the new mouths');
  assert.equal(kept.slots, 7);
  kept.setSlots(9);
  assert.equal(kept.balls.length, 0, 'an explicit slot change still clears the table');
}
console.log(`PASS: right bonus cup, near misses, lane return and slot changes. ${totals.jackpots}/1080 bonus entries; fixed physics step ${STEP.toFixed(2)}ms.`);

// A ball whose center reaches the cup scores immediately. While the hole is
// ignoring that ball, the same overlap must not score: the ball is ejected.
{
  const scored = [], table = createTable({ slots: 7, onScore: s => scored.push(s) });
  const h = table.holes[0];
  const sunk = table.launch(); sunk.entered = true;
  Matter.Body.setPosition(sunk.body, { x: h.x, y: h.y });
  Matter.Body.setVelocity(sunk.body, { x: 0, y: 0 });
  table.step();
  assert.equal(scored.length, 1); assert.equal(scored[0].kind, 'jackpot'); assert.equal(scored[0].basePoints, 500);
  const phased = table.launch(); phased.entered = true; phased.ignoreHoleUntil = 1e12;
  Matter.Body.setPosition(phased.body, { x: h.x, y: h.y });
  Matter.Body.setVelocity(phased.body, { x: -4, y: .4 });
  for (let i = 0; i < 30; i++) table.step();
  assert.equal(scored.length, 1, 'a hole that is not accepting this ball must not score it');
  assert.ok(table.balls.includes(phased), 'rejection leaves the ball in play');
  assert.ok(Math.hypot(phased.body.position.x - h.x, phased.body.position.y - h.y) > 40, 'rejection carries the ball out of the cup');
  assert.equal(phased.body.collisionFilter.group, -2, 'the hole ring stays inactive for the short phase');
}
// The right-wall cusp and the top seam used to rattle forever: capture only saw
// the center inside r=18, and contact kept the old speed timer at zero.
function release(table, ball) {
  if (!table.balls.includes(ball)) return;
  Matter.Composite.remove(table.engine.world, ball.body);
  table.balls.splice(table.balls.indexOf(ball), 1);
}
function stillWedged(table, ball, hole, ms = 2500) {
  const markAt = Math.round(500 / STEP), doneAt = Math.round(ms / STEP);
  let mark = null;
  for (let i = 0; i < doneAt; i++) {
    table.step();
    if (!table.balls.includes(ball)) return false;
    if (i === markAt) mark = { x: ball.body.position.x, y: ball.body.position.y };
  }
  const r = Math.hypot(ball.body.position.x - hole.x, ball.body.position.y - hole.y);
  const drifted = Math.hypot(ball.body.position.x - mark.x, ball.body.position.y - mark.y);
  return r < 70 && drifted < 14;
}
{
  const samples = [
    { name: 'right cusp', x: 657, y: 463, vx: 0, vy: 0 },
    { name: 'top seam', x: 618.5, y: 443, vx: 0, vy: 2 },
    { name: 'mouth tangent', x: 615, y: 448, vx: -5, vy: 0 },
  ];
  const hole = { x: 615, y: 482 };
  for (let deg = 0; deg < 360; deg += 45) for (const speed of [2, 8]) for (const tangent of [0, 1]) {
    const a = deg * Math.PI / 180;
    samples.push({
      name: `ring ${deg}/${speed}/${tangent ? 'tangent' : 'in'}`,
      x: hole.x + Math.cos(a) * 42, y: hole.y + Math.sin(a) * 42,
      vx: Math.cos(a + Math.PI / 2 * tangent + Math.PI * (1 - tangent)) * speed,
      vy: Math.sin(a + Math.PI / 2 * tangent + Math.PI * (1 - tangent)) * speed,
    });
  }
  for (const dy of [-28, 0, 28]) for (const speed of [2, 7]) {
    samples.push({ name: `mouth ${dy}/${speed}`, x: hole.x - 52, y: hole.y + dy, vx: speed, vy: dy / 52 * speed });
  }
  for (const sample of samples) {
    const scored = [], table = createTable({ slots: 7, random: () => 0, onScore: s => scored.push(s) });
    const h = table.holes[0];
    const ball = table.launch(); ball.entered = true;
    Matter.Body.setPosition(ball.body, { x: sample.x, y: sample.y });
    Matter.Body.setVelocity(ball.body, { x: sample.vx, y: sample.vy });
    assert.equal(stillWedged(table, ball, h), false, `${sample.name} must sink or leave the rim`);
    assert.ok(scored.filter(s => s.kind === 'jackpot').length <= 1, `${sample.name} scores the hole at most once`);
    release(table, ball);
  }
  const parked = createTable({ slots: 7, random: () => 0 });
  const wedged = parked.launch(); wedged.entered = true;
  Matter.Body.setPosition(wedged.body, { x: 657, y: 463 });
  Matter.Body.setVelocity(wedged.body, { x: 0, y: 0 });
  parked.step();
  parked.setSlots(5);
  assert.equal(parked.balls.length, 0, 'switching slots removes a ball sitting in the cusp');
  console.log(`PASS: secret-hole rim scan (${samples.length} angles and speeds) sinks or ejects, and slot changes clear a wedged ball.`);
}
// A ball balanced away from the hole and the storage cup is the global dwell case.
{
  const table = createTable({ slots: 7, random: () => 0 });
  const ball = table.launch(); ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: 150, y: 136.9 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
  let left = false;
  for (let i = 0; i < Math.round(2200 / STEP); i++) {
    table.step();
    if (!table.balls.includes(ball) || Math.hypot(ball.body.position.x - 150, ball.body.position.y - 136.9) > 24) { left = true; break; }
  }
  assert.ok(left, 'a ball that dwells for 1.5s away from storage receives a freeing shove');
  const cup = table.launch(); cup.entered = true;
  Matter.Body.setPosition(cup.body, { x: table.collector.x + 20, y: table.collector.y });
  Matter.Body.setVelocity(cup.body, { x: 0, y: 0 });
  table.step();
  assert.equal(table.stats.absorbed, 1, 'a center already inside the storage cup is stored, not nudged downward');
  for (const slots of [5, 7, 9]) {
    const drops = createTable({ slots, random: () => .5 });
    for (const outlet of drops.collector.outlets) {
      const dropped = drops.launch(); dropped.entered = true;
      Matter.Body.setPosition(dropped.body, { x: outlet.x, y: outlet.y + 21 });
      Matter.Body.setVelocity(dropped.body, { x: 0, y: .8 });
      assert.equal(stillWedged(drops, dropped, { x: outlet.x, y: outlet.y }, 2200), false, `${slots} slots outlet ${outlet.column} must not trap a drop`);
      release(drops, dropped);
    }
  }
  console.log('PASS: dwell nudge frees a resting ball, storage keeps its cup, and drop outlets do not trap.');
}
