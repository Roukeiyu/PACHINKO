import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
function feed(game, factor = 1) {
  const ball = game.launch(); assert.ok(ball);
  ball.entered = true; ball.scoreFactor = factor;
  Matter.Body.setPosition(ball.body, { x: game.collector.x, y: game.collector.y - 44 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 5 });
  for (let i = 0; i < 30 && game.balls.includes(ball); i++) game.step();
  assert.ok(!game.balls.includes(ball), 'a descending ball enters the actual upward-facing cup and is removed');
  assert.ok(!Matter.Composite.allBodies(game.engine.world).includes(ball.body), 'stored balls no longer collide');
  return ball;
}
for (const slots of [5, 7, 9]) {
  const game = createTable({ slots, random: seeded(7), starRandom: seeded(8) });
  const initial = game.bumpers.map(b => ({ ...b.position }));
  assert.equal(initial[0].y, initial[1].y);
  assert.equal(initial[0].x + initial[1].x, initial[2].x * 2, 'upper bumpers mirror the center axis');
  for (const count of [9, 5, 7, slots]) { game.setSlots(count); assert.deepEqual(game.bumpers.map(b => b.position), initial); }
  const miss = game.launch(); miss.entered = true;
  Matter.Body.setPosition(miss.body, { x: game.collector.x + 65, y: game.collector.y });
  Matter.Body.setVelocity(miss.body, { x: 0, y: 0 });
  game.step(); assert.equal(game.stats.absorbed, 0, 'nearby balls are not sucked through invisible walls');
  game.setSlots(slots);
}
console.log('PASS: upper bumpers retain exact mirror symmetry; the storage cup only collects actual entrants.');

for (const slots of [5, 7, 9]) {
  const events = [], scores = [];
  let game;
  game = createTable({ slots, random: seeded(100 + slots), starRandom: seeded(200), onScore: s => scores.push(s), onSurprise: event => {
    events.push(event);
    if (event.kind === 'emit' && event.source === 'storage') {
      const ball = game.balls.find(b => b.id === event.ballId);
      assert.ok(ball.bonus && ball.entered && ball.body.velocity.y > 0);
      assert.equal(ball.body.position.y, 95, 'drops originate just beneath the top mouths');
      assert.equal(ball.scoreFactor, event.scoreFactor);
      const obstacles = Matter.Composite.allBodies(game.engine.world).filter(body => body.label !== 'ball');
      assert.equal(Matter.Query.collides(ball.body, obstacles).length, 0, 'a new ball never overlaps a wall, stud or pin');
      // Isolate the release schedule from further bumper rewards and re-collection.
      Matter.Composite.remove(game.engine.world, ball.body);
      game.balls.splice(game.balls.indexOf(ball), 1);
    }
  } });
  for (let i = 0; i < 19; i++) feed(game, i === 0 ? 4 : 1);
  assert.equal(game.collector.stored.length, 19); assert.equal(game.stats.storageBursts, 0);
  assert.equal(game.collector.remaining, 0); assert.equal(scores.length, 0, 'storing does not award points');
  feed(game);
  assert.equal(game.collector.stored.length, 0); assert.equal(game.stats.storageBursts, 1);
  assert.equal(game.collector.remaining, 40); assert.equal(game.stats.absorbed, 20);
  // Layout changes retain both stock and queued rewards, with updated mouths.
  game.setSlots(slots === 5 ? 9 : 5); assert.equal(game.collector.remaining, 40);
  game.setSlots(slots); assert.equal(game.collector.outlets.length, slots);
  for (let i = 0; i < 800 && game.collector.remaining; i++) game.step();
  const drops = events.filter(e => e.kind === 'emit' && e.source === 'storage');
  assert.equal(drops.length, 40); assert.equal(game.stats.storageDrops, 40);
  assert.equal(game.collector.remaining, 0);
  assert.equal(new Set(drops.map(d => d.ballId)).size, 40);
  assert.equal(drops.filter(d => d.scoreFactor === 4).length, 2, 'each stored star multiplier is copied to exactly two drops');
  const counts = Array.from({ length: slots }, (_, column) => drops.filter(d => d.column === column).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, 'all mouths receive balanced quantities');
  for (let i = 0; i < drops.length; i += slots) assert.equal(new Set(drops.slice(i, i + slots).map(d => d.column)).size, Math.min(slots, drops.length - i), 'each shuffled round visits every mouth once');
  assert.ok(new Set(drops.map(d => d.x)).size > 30, 'mouth positions have random variation');
  for (let i = 1; i < drops.length; i++) assert.ok(drops[i].at - drops[i - 1].at >= 80 - STEP && drops[i].at - drops[i - 1].at <= 140 + STEP);
  assert.ok(drops.at(-1).at - drops[0].at > 3000, '40 balls emerge gradually');
  console.log(`PASS: ${slots} mouths absorb 20, emit exactly 40 balanced random drops, and retain stars and queued drops through layout changes.`);
}

const scores = [], storedIds = [], dropIds = [], returned = [];
const live = createTable({ random: seeded(42), starRandom: seeded(43), onScore: e => scores.push(e), onReturn: e => returned.push(e.ballId), onSurprise: e => {
  if (e.kind === 'store') storedIds.push(e.ballId);
  if (e.kind === 'emit' && e.source === 'storage') dropIds.push(e.ballId);
} });
for (let i = 0; i < 20; i++) feed(live);
for (let i = 0; i < 12000 && (live.balls.length || live.collector.remaining); i++) live.step();
assert.equal(dropIds.length, 40);
assert.ok(dropIds.every(id => scores.some(s => s.ballId === id) || storedIds.includes(id) || returned.includes(id)), 'all released balls physically score, enter storage or return');
assert.ok(scores.some(s => dropIds.includes(s.ballId)), 'stored rewards can actually reach scoring slots');
assert.equal(live.balls.length, 0); assert.equal(live.collector.remaining, 0);
assert.equal(live.stats.launches + live.stats.bonusBalls, live.stats.scored + live.stats.absorbed + live.stats.returns, 'each physical ball settles exactly once');
const partial = live.collector.stored.length;
live.setSlots(9); assert.equal(live.collector.stored.length, partial, 'partial stock survives a layout change');
console.log('PASS: top drops traverse the real board, resolve without missing balls, and score normally.');
