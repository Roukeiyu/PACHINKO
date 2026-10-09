import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
import { CANON_NOTES, createCanon, noteFrequency } from '../src/canon.js';

function remove(game, ball) { Matter.Composite.remove(game.engine.world, ball.body); game.balls.splice(game.balls.indexOf(ball), 1); }
// Produce a real collision against the selected bumper, not a fake hit counter.
function hit(game, index) {
  const ball = game.launch(), bumper = game.bumpers[index];
  assert.ok(ball); ball.entered = true; ball.boosting = false;
  Matter.Body.setPosition(ball.body, { x: bumper.position.x, y: bumper.position.y + bumper.plugin.radius + 15 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: -8 });
  const before = game.rewards.hits[index];
  for (let i = 0; i < 20 && game.rewards.hits[index] === before; i++) game.step();
  assert.equal(game.rewards.hits[index], before + 1);
  remove(game, ball);
}

for (const power of [.2, .65, 1]) {
  const game = createTable(), ball = game.launch(power), initial = ball.body.velocity.y;
  game.step(); assert.ok(ball.body.velocity.y < initial, 'booster accelerates below the line');
  for (let i = 0; i < 100 && ball.boosting; i++) game.step();
  assert.ok(ball.cutoffY <= TABLE.boostEndY && ball.cutoffY > TABLE.boostEndY - 17);
  const cutoffVelocity = ball.body.velocity.y;
  for (let i = 0; i < 10; i++) game.step();
  assert.equal(ball.boosting, false);
  assert.ok(ball.body.velocity.y > cutoffVelocity, 'above the line, gravity slows ascent with no further boost');
}
const returnGame = createTable(), returnBall = returnGame.launch();
returnBall.entered = true; returnBall.boosting = false;
Matter.Body.setPosition(returnBall.body, { x: 713, y: 460 }); Matter.Body.setVelocity(returnBall.body, { x: 0, y: 8 });
let exited = false;
for (let i = 0; i < 100; i++) { returnGame.step(); if (returnBall.body.position.x < 650 && returnBall.body.position.y > TABLE.boostEndY) { exited = true; break; } }
assert.ok(exited); assert.equal(returnGame.stats.redirected, 1); assert.equal(returnGame.stats.returns, 0); assert.equal(returnBall.boosting, false);
assert.ok(returnBall.body.velocity.y > 0, 'return gate directs the ball down into play');
console.log('PASS: all power levels cut boost at the line; the one-way gate sends returning balls down-left without re-acceleration.');

const leftEvents = [], left = createTable({ random: () => .25, onSurprise: e => leftEvents.push(e) });
for (let i = 0; i < 9; i++) hit(left, 0);
assert.equal(left.stats.randomShots, 0); hit(left, 0); left.step();
assert.equal(left.stats.randomShots, 1); assert.equal(left.stats.bonusBalls, 1);
assert.equal(leftEvents.filter(e => e.kind === 'emit').length, 1);
assert.equal(leftEvents.find(e => e.kind === 'emit').angle, Math.PI / 2);
assert.ok(left.balls[0].bonus && left.balls[0].entered && !left.balls[0].boosting);
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
