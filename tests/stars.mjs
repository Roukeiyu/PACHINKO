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
assert.equal(game.star, initial, 'an uncollected star stays in place before its deadline');
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
console.log('PASS: one star at a time, delayed pickup respawn, per-ball stacking, and multiplied slot scoring.');

// Deadlines use simulation time and expire on the exact 30 s / 10 s boundary.
function advanceTo(game, deadline) {
  while (game.clock + STEP < deadline - 1e-6) game.step();
}
function waitForStar(game) {
  for (let i = 0; i < 61 && !game.star; i++) game.step();
  assert.ok(game.star);
}
const timedScores = [], timedEvents = [];
const timed = createTable({ starRandom: () => .3, onScore: s => timedScores.push(s), onSurprise: e => timedEvents.push(e) });
const expired = timed.star;
assert.equal(expired.expiresAt - expired.born, 30000);
advanceTo(timed, expired.expiresAt);
assert.equal(timed.star, expired);
timed.step();
assert.notEqual(timed.star.id, expired.id);
assert.ok(timed.star.x !== expired.x || timed.star.y !== expired.y);
assert.equal(timed.star.multiplier, 2);
assert.equal(timed.rewards.ordinaryStars, 0, 'expiration does not count as a pickup');
assert.equal(timedEvents.length, 0, 'expiration grants no pickup reward');

function collectTenOrdinary() {
  for (let n = 1; n <= 10; n++) {
    waitForStar(timed);
    assert.equal(timed.star.multiplier, 2);
    const ball = timed.launch();
    collect(timed, ball);
    scoreSlot(timed, ball);
  }
  waitForStar(timed);
  assert.equal(timed.star.multiplier, 5, 'each ten ordinary pickups unlocks one purple star across balls');
}
collectTenOrdinary();
assert.equal(timed.rewards.ordinaryStars, 10);
const purple = timed.star;
assert.equal(purple.expiresAt - purple.born, 10000);
advanceTo(timed, purple.expiresAt);
assert.equal(timed.star, purple);
timed.step();
assert.equal(timed.star.multiplier, 2, 'an expired purple star returns to ordinary stars');
assert.ok(timed.star.x !== purple.x || timed.star.y !== purple.y);
assert.equal(timed.rewards.ordinaryStars, 10);

collectTenOrdinary();
const purpleBall = timed.launch();
collect(timed, purpleBall);
assert.equal(purpleBall.scoreFactor, 5);
assert.equal(timedEvents.at(-1).multiplier, 5);
assert.equal(timed.rewards.ordinaryStars, 20, 'purple pickups do not count toward the next milestone');
// Move clear of the next spawn, then verify that ordinary and purple boosts stack.
put(purpleBall, 350, 100);
waitForStar(timed);
assert.equal(timed.star.multiplier, 2, 'a collected purple star returns to ordinary stars');
collect(timed, purpleBall);
assert.equal(purpleBall.scoreFactor, 10);
scoreSlot(timed, purpleBall);
assert.equal(timedScores.at(-1).points, timedScores.at(-1).basePoints * 10);
assert.equal(timed.rewards.ordinaryStars, 21);
console.log('PASS: exact star deadlines, repeating ten-pickup milestones, purple timeout/pickup recovery, and ×5 scoring.');

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
