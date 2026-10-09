import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
import { CANON_NOTES, createCanon, noteFrequency } from '../src/canon.js';
import { chargeAt, chargePercent } from '../src/charge.js';

assert.equal(chargeAt(0), 0); assert.equal(chargeAt(-1), 0);
assert.ok(chargeAt(500) > .63 && chargeAt(500) < .64);
assert.ok(chargeAt(1500) > .95 && chargeAt(1500) < .96);
let previous = 0, previousGain = Infinity;
for (let ms = 100; ms <= 3400; ms += 100) {
  const charge = chargeAt(ms), gain = charge - previous;
  assert.ok(gain > 0 && gain < previousGain, 'charge rises with progressively smaller increments');
  assert.ok(chargePercent(charge) < 100, 'unfinished charge never displays 100%');
  previous = charge; previousGain = gain;
}
const fullAt = 500 * Math.log(1000);
assert.ok(chargeAt(fullAt - .1) < .999, 'remaining charge above 0.1% must not snap');
assert.equal(chargeAt(fullAt), 1, '99.9% snaps to exactly full power');
assert.equal(chargeAt(fullAt + 60000), 1);
assert.equal(chargePercent(.99899), 99.8); assert.equal(chargePercent(1), 100);
console.log('PASS: exponential charging slows toward full, snaps at 99.9%, and never displays 100% prematurely.');

function remove(game, ball) { Matter.Composite.remove(game.engine.world, ball.body); game.balls.splice(game.balls.indexOf(ball), 1); }
// Produce a real collision against the selected bumper, not a fake hit counter.
function hit(game, index) {
  const ball = game.launch(), bumper = game.bumpers[index];
  assert.ok(ball); ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: bumper.position.x, y: bumper.position.y + bumper.plugin.radius + 15 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: -8 });
  const before = game.rewards.hits[index];
  for (let i = 0; i < 20 && game.rewards.hits[index] === before; i++) game.step();
  assert.equal(game.rewards.hits[index], before + 1);
  remove(game, ball);
}

let lastRise = -1;
for (const power of [0, .01, .05, .1, .2, .4, .6]) {
  const game = createTable({ random: () => .5 }), ball = game.launch(power);
  let minY = TABLE.launchY, previousVelocity = ball.body.velocity.y;
  for (let i = 0; i < 400 && game.balls.includes(ball); i++) {
    game.step(); minY = Math.min(minY, ball.body.position.y);
    assert.ok(ball.body.velocity.y > previousVelocity, 'gravity must slow ascent from the first step, with no hidden boost');
    previousVelocity = ball.body.velocity.y;
    if (ball.body.velocity.y >= 0) break;
  }
  const rise = TABLE.launchY - minY;
  assert.ok(rise > lastRise, 'more charge produces a higher initial flight'); lastRise = rise;
  if (power === 0) assert.equal(rise, 0, 'zero charge has no launch energy');
  if (power === .01) assert.ok(rise < 2, '1% power can only make a tiny hop');
  if (power === .2) assert.ok(rise > 40 && rise < 100, '20% stays in the lower shooter');
  if (power <= .2) {
    for (let i = 0; i < 400 && game.balls.includes(ball); i++) game.step();
    assert.equal(game.stats.returns, 1, 'weak shots naturally return');
    assert.equal(game.stats.entered, 0); assert.equal(game.stats.scored, 0);
  }
}
const returnGame = createTable(), returnBall = returnGame.launch();
returnBall.entered = true;
Matter.Body.setPosition(returnBall.body, { x: 713, y: 460 }); Matter.Body.setVelocity(returnBall.body, { x: 0, y: 8 });
let exited = false;
for (let i = 0; i < 100; i++) { returnGame.step(); if (returnBall.body.position.x < 650 && returnBall.body.position.y > 570) { exited = true; break; } }
assert.ok(exited); assert.equal(returnGame.stats.redirected, 1); assert.equal(returnGame.stats.returns, 0);
assert.ok(returnBall.body.velocity.y > 0, 'return gate directs the ball down into play');
console.log('PASS: 0–60% launch heights increase with charge, 1% only hops, weak shots return, and the one-way gate redirects without re-acceleration.');

const leftEvents = [], left = createTable({ random: () => .25, onSurprise: e => leftEvents.push(e) });
for (let i = 0; i < 9; i++) hit(left, 0);
assert.equal(left.stats.randomShots, 0); hit(left, 0); left.step();
assert.equal(left.stats.randomShots, 1); assert.equal(left.stats.bonusBalls, 1);
assert.equal(leftEvents.filter(e => e.kind === 'emit').length, 1);
assert.equal(leftEvents.find(e => e.kind === 'emit').angle, Math.PI / 2);
assert.ok(left.balls[0].bonus && left.balls[0].entered);
remove(left, left.balls[0]); for (let i = 0; i < 10; i++) hit(left, 0); left.step();
assert.equal(left.stats.randomShots, 2, 'repeat milestones work without manual reset');

const right = createTable(); for (let i = 0; i < 9; i++) hit(right, 1);
assert.equal(right.bumpers[2].circleRadius, 39); hit(right, 1);
assert.equal(right.stats.enlargements, 1); assert.equal(right.bumpers[2].circleRadius, 58.5); assert.equal(right.bumpers[2].plugin.radius, 58.5);
const startedAt = right.clock;
for (let i = 0; i < 599; i++) right.step();
assert.equal(right.bumpers[2].circleRadius, 58.5, 'growth lasts the full five active seconds'); right.step();
assert.ok(Math.abs(right.clock - startedAt - 5000) < 1e-6); assert.equal(right.bumpers[2].circleRadius, 39);
assert.equal(right.rewards.enlargedUntil, 0);
console.log('PASS: left bumper grants one real ball every 10 hits; right bumper physically grows the center 1.5× for exactly 5 seconds.');

const events = [], center = createTable({ onSurprise: e => events.push(e) });
for (let i = 0; i < 99; i++) hit(center, 2);
assert.equal(center.stats.clockBursts, 0); hit(center, 2); const trigger = center.clock;
assert.equal(center.stats.clockBursts, 1);
for (let i = 0; i < 122; i++) center.step();
const shots = events.filter(e => e.kind === 'emit' && e.source === 'clock');
assert.equal(shots.length, 12); assert.equal(center.stats.bonusBalls, 12);
assert.deepEqual(shots.map(s => s.ordinal), Array.from({ length: 12 }, (_, i) => i));
for (let i = 0; i < 12; i++) {
  assert.ok(Math.abs(shots[i].angle - (-Math.PI / 2 + i * Math.PI / 6)) < 1e-8);
  assert.ok(Math.abs(shots[i].at - (trigger + i * 1000 / 12)) <= STEP + 1e-6, 'each clock position emits on schedule');
}
assert.ok(shots[11].at - trigger <= 1000);
assert.equal(new Set(shots.map(s => s.ballId)).size, 12, 'burst creates 12 separate physics bodies');
console.log(`PASS: center triggers at 100 hits, fires 12 physical balls clockwise from 12 o'clock in ${(shots[11].at - trigger).toFixed(1)}ms.`);

const canon = createCanon();
assert.deepEqual(Array.from({ length: 8 }, () => canon.next().name), ['F#5','E5','D5','C#5','B4','A4','B4','C#5']);
for (let i = 8; i < CANON_NOTES.length; i++) canon.next();
assert.equal(canon.next().name, CANON_NOTES[0]); assert.equal(noteFrequency('A4'), 440);
const music = createCanon(), musicalGame = createTable({ onHit: () => music.next() }); musicalGame.launch();
for (let i = 0; i < 1800; i++) musicalGame.step();
assert.ok(music.count > 0); assert.equal(music.count, musicalGame.stats.impacts);
console.log('PASS: Canon opening, looping, tuning and exactly one note advancement per physical obstacle impact.');
