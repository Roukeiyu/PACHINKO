import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, STEP } from '../src/physics.js';

function put(ball, x, y, vx = 0, vy = 0) {
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x, y });
  Matter.Body.setVelocity(ball.body, { x: vx, y: vy });
}
function collect(game, ball) {
  const star = game.star;
  assert.ok(star);
  put(ball, star.x, star.y);
  game.step();
  assert.equal(game.star, null, 'the collected star disappears immediately');
  return star;
}
function scoreSlot(game, ball) {
  put(ball, 347, 864, 0, 6);
  for (let i = 0; i < 10 && game.balls.includes(ball); i++) game.step();
  assert.ok(!game.balls.includes(ball));
}

const scores = [], events = [];
const game = createTable({ starRandom: () => .5, onScore: s => scores.push(s), onSurprise: e => events.push(e) });
const initial = game.star;
assert.ok(initial && initial.x < 650 && initial.y < 797);
for (let i = 0; i < 2400; i++) game.step();
assert.equal(game.star, initial, 'an uncollected star persists without timed replacement');
game.setSlots(9);
assert.equal(game.star, initial, 'changing slots cannot replace an uncollected star');

const boosted = game.launch();
collect(game, boosted);
assert.equal(boosted.scoreFactor, 2);
put(boosted, 350, 100);
for (let i = 0; i < 59; i++) game.step();
assert.equal(game.star, null, 'next star waits for the pickup effect');
for (let i = 0; i < 2 && !game.star; i++) game.step();
assert.ok(game.star && game.star.id !== initial.id);
assert.ok(game.star.x !== initial.x || game.star.y !== initial.y, 'next star uses a different position');
assert.ok(Math.hypot(game.star.x - boosted.body.position.x, game.star.y - boosted.body.position.y) > 60, 'new star does not spawn on a live ball');
collect(game, boosted);
assert.equal(boosted.scoreFactor, 4, 'two pickups double this ball twice');
scoreSlot(game, boosted);
assert.equal(scores[0].scoreFactor, 4);
assert.equal(scores[0].points, scores[0].basePoints * 4);
const ordinary = game.launch();
assert.equal(ordinary.scoreFactor, 1, 'new balls do not inherit another ball’s stars');
scoreSlot(game, ordinary);
assert.equal(scores[1].points, scores[1].basePoints);
assert.equal(events.filter(e => e.kind === 'star').length, 2);
console.log('PASS: one persistent star, pickup-only respawn, per-ball stacking, and multiplied slot scoring.');

// Two balls can reach one collectible together; only one receives the reward.
const multi = createTable({ starRandom: () => .4 });
const a = multi.launch(); put(a, multi.star.x - 8, multi.star.y);
const b = multi.launch(); put(b, multi.star.x + 8, multi.star.y);
multi.step();
assert.equal(multi.star, null);
assert.deepEqual([a.scoreFactor, b.scoreFactor].sort(), [1, 2]);

const jackpotScores = [], jackpot = createTable({ starRandom: () => .6, onScore: s => jackpotScores.push(s) });
const lucky = jackpot.launch(); collect(jackpot, lucky);
const h = jackpot.holes[0];
put(lucky, h.x - 47, h.y - 2, 5, -1);
for (let i = 0; i < 45; i++) jackpot.step();
assert.equal(jackpotScores.length, 1);
assert.equal(jackpotScores[0].kind, 'jackpot');
assert.equal(jackpotScores[0].points, 1000);
assert.equal(jackpotScores[0].scoreFactor, 2);
console.log('PASS: simultaneous contact rewards only one ball, and the secret hole applies the collected multiplier.');

// Spawn samples are collectible without an overlap or hidden physical body.
for (const fraction of [0, .1, .25, .5, .75, .9, .999]) {
  const sample = createTable({ starRandom: () => fraction });
  const star = sample.star, probe = Matter.Bodies.circle(star.x, star.y, 22);
  const obstacles = [...sample.walls, ...sample.pins, ...sample.rails, ...sample.bumpers, ...sample.diamonds, ...sample.spinners, ...sample.guards];
  for (let i = 0; i < 624; i++) {
    sample.step(STEP);
    assert.equal(sample.star, star);
    assert.ok(!Matter.Query.collides(probe, obstacles).length, 'star remains accessible across a full movement cycle');
  }
  const ball = sample.launch(); collect(sample, ball);
  assert.equal(ball.scoreFactor, 2);
}
console.log('PASS: star positions avoid obstacles throughout their motion and can all be collected.');
