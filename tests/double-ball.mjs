import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP, DRUM_SIDE_HITS } from '../src/physics.js';
import { BALL_ONE, BALL_PAIR, BALL_JACKPOT, REEL_TOP, SLOT_DISPLAY, ballPayout } from '../src/slot-machine.js';
import {
  BALL_COST_MULTIPLIER, SECRET_BALLS, DRUM_ENLARGE_BALLS, shotCost, tablePoints, secretHoleBalls, pocketCenter, restoreRun,
} from '../src/round.js';

assert.equal(BALL_COST_MULTIPLIER, 2);
assert.equal(shotCost(BALL_COST_MULTIPLIER), 2);
assert.equal(shotCost(BALL_COST_MULTIPLIER, true), 10);
assert.equal(ballPayout(1), BALL_ONE);
assert.equal(ballPayout(2), BALL_PAIR);
assert.equal(ballPayout(3), BALL_JACKPOT);
assert.deepEqual([BALL_ONE, BALL_PAIR, BALL_JACKPOT], [1, 10, 100]);
assert.equal(tablePoints(10, 2, 2, 5), 200);
assert.equal(DRUM_ENLARGE_BALLS, 0);
assert.equal(secretHoleBalls(0).holeBalls, SECRET_BALLS);
assert.equal(secretHoleBalls(0).miniBalls, 0);
assert.equal(secretHoleBalls(5600).miniBalls, 0);
assert.equal(secretHoleBalls(1400).miniBalls, 0);

const layout = createTable();
assert.equal(layout.bumpers[2].position.y, 410, 'the center drum moves down into the old reel gap');
assert.equal(REEL_TOP, 724);
assert.ok(SLOT_DISPLAY.y > layout.bumpers[2].position.y + layout.bumpers[2].plugin.baseRadius * 1.5);
assert.ok(layout.pins.some(pin => pin.position.x === 310 && pin.position.y === 704));
assert.ok(layout.pins.some(pin => pin.position.x === 390 && pin.position.y === 704));
assert.equal(layout.pins.some(pin => pin.position.y === 730 && (pin.position.x === 310 || pin.position.x === 390)), false);
let spinnerTop = Infinity;
for (let t = 0; t <= 9000; t += STEP) {
  layout.step();
  spinnerTop = Math.min(spinnerTop, ...layout.spinners[0].vertices.map(vertex => vertex.y));
}
const enlargedBottom = layout.bumpers[2].position.y + layout.bumpers[2].plugin.baseRadius * 1.5;
assert.ok(spinnerTop - enlargedBottom >= 11, `enlarged drum stays a ball radius clear of the spinner (${spinnerTop - enlargedBottom})`);

const doubled = [];
const scoreGame = createTable({ slots: 5, onScore: result => doubled.push(result) });
const valued = scoreGame.launch(1, 2);
assert.equal(valued.valueFactor, 2);
valued.entered = true;
valued.scoreFactor = 2;
const column = 2;
Matter.Body.setPosition(valued.body, { x: pocketCenter(5, column), y: TABLE.scoreLine - 1 });
Matter.Body.setVelocity(valued.body, { x: 0, y: 6 });
scoreGame.step();
assert.equal(doubled[0].valueFactor, 2);
assert.equal(doubled[0].points, doubled[0].basePoints * 2 * 2);
assert.equal(doubled[0].points, tablePoints(doubled[0].basePoints, 2, 2, 1));

for (const factor of [4, 8]) {
  const scored = [];
  const higher = createTable({ slots: 5, onScore: result => scored.push(result) });
  const ball = higher.launch(1, factor);
  assert.equal(ball.valueFactor, factor);
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: pocketCenter(5, 2), y: TABLE.scoreLine - 1 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 6 });
  higher.step();
  assert.equal(scored[0].valueFactor, factor);
  assert.equal(scored[0].points, scored[0].basePoints * factor);
  assert.equal(scored[0].points, tablePoints(scored[0].basePoints, 1, factor, 1));
}

const burst = createTable();
assert.ok(burst.launchBurst(2));
assert.equal(burst.balls[0].valueFactor, 2);
assert.equal(burst.pendingLaunches, 4);
assert.equal(burst.setEmissionPaused(true), 8, 'a paused ×2 burst refunds the balls that were spent');

const released = [];
const jar = createTable({ onSurprise: event => {
  if (event.kind !== 'emit' || event.source !== 'storage') return;
  const ball = jar.balls.find(item => item.id === event.ballId);
  released.push({ scoreFactor: ball.scoreFactor, valueFactor: ball.valueFactor });
} });
const stored = jar.launch(1, 2);
stored.entered = true;
stored.scoreFactor = 3;
stored.valueFactor = 2;
Matter.Body.setPosition(stored.body, { x: jar.collector.x, y: jar.collector.y - 44 });
Matter.Body.setVelocity(stored.body, { x: 0, y: 5 });
for (let i = 0; i < 30 && jar.balls.includes(stored); i++) jar.step();
assert.equal(jar.collector.stored.length, 1, 'a ×2 ball counts as one stored ball');
assert.equal(jar.collector.stored[0], 3, 'only the star factor is kept');
for (let n = 0; n < 19; n++) {
  const filler = jar.launch();
  filler.entered = true;
  Matter.Body.setPosition(filler.body, { x: jar.collector.x, y: jar.collector.y - 44 });
  Matter.Body.setVelocity(filler.body, { x: 0, y: 5 });
  for (let i = 0; i < 30 && jar.balls.includes(filler); i++) jar.step();
}
for (let i = 0; i < 800 && released.length < 20; i++) jar.step();
assert.equal(released.length, 20);
assert.equal(released.filter(ball => ball.scoreFactor === 3).length, 1);
assert.ok(released.every(ball => ball.valueFactor === 1), 'the jar releases normal balls');

const costlyJar = createTable();
const paidBall = costlyJar.launch(1, 8);
paidBall.entered = true;
paidBall.scoreFactor = 5;
Matter.Body.setPosition(paidBall.body, { x: costlyJar.collector.x, y: costlyJar.collector.y - 44 });
Matter.Body.setVelocity(paidBall.body, { x: 0, y: 5 });
for (let i = 0; i < 30 && costlyJar.balls.includes(paidBall); i++) costlyJar.step();
assert.equal(costlyJar.collector.stored.length, 1, 'an ×8 ball still counts as one stored ball');
assert.equal(costlyJar.collector.stored[0], 5, 'the jar keeps the star factor and drops ×8');

const holeScores = [];
const hole = createTable({ onScore: result => holeScores.push(result) });
const secret = hole.launch(1, 2);
secret.entered = true;
const cup = hole.holes[0];
hole.nudge(secret, cup.x - 40, cup.y, 0);
hole.step();
if (hole.balls.includes(secret)) hole.nudge(secret, cup.x, cup.y, 0);
hole.step();
assert.equal(holeScores[0].kind, 'jackpot');
assert.equal(holeScores[0].basePoints, 500);
assert.equal(holeScores[0].points, 1000);
assert.equal(holeScores[0].valueFactor, 2);
assert.equal(secretHoleBalls(1400).holeBalls, 10);
assert.equal(secretHoleBalls(1400).miniBalls, 0, 'the mini-game score does not add balls, and ×N does not scale them');

function hit(game, index) {
  const ball = game.launch(1, 2);
  const bumper = game.bumpers[index];
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: bumper.position.x, y: bumper.position.y + bumper.plugin.radius + 15 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: -8 });
  const before = game.rewards.hits[index];
  for (let i = 0; i < 20 && game.rewards.hits[index] === before; i++) game.step();
  Matter.Composite.remove(game.engine.world, ball.body);
  game.balls.splice(game.balls.indexOf(ball), 1);
}
const gifts = [];
const drum = createTable({ onSurprise: event => gifts.push(event) });
for (let i = 0; i < DRUM_SIDE_HITS; i++) hit(drum, 0);
drum.step();
const gift = gifts.find(event => event.kind === 'emit' && event.source === 'random');
assert.ok(gift);
assert.equal(drum.balls.find(ball => ball.id === gift.ballId).valueFactor, 1, 'a drum gift is a normal ball');

for (const slots of [5, 7, 9]) {
  const scores = [];
  const game = createTable({ slots, onScore: result => scores.push(result) });
  const ball = game.launch(1, 2);
  ball.entered = true;
  const center = (slots - 1) / 2;
  Matter.Body.setPosition(ball.body, { x: pocketCenter(slots, center), y: 760 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 3 });
  for (let i = 0; i < 240 && !scores.length && game.balls.includes(ball); i++) game.step();
  assert.equal(scores[0]?.column, center, `${slots} slots: the center LUCKY pocket stays reachable under the reels`);
  assert.equal(scores[0].valueFactor, 2);
  assert.equal(game.stats.timeouts, 0);
}

const carried = createTable();
assert.equal(carried.restoreCarried([{ scoreFactor: 4, valueFactor: 2 }, { valueFactor: 2 }]), 2);
assert.equal(carried.balls[0].scoreFactor, 4);
assert.equal(carried.balls[0].valueFactor, 2);
assert.equal(carried.balls[1].valueFactor, 2);
assert.equal(restoreRun({ slots: 7, doubleBall: true, balls: 3 }).ballCost, 2);
assert.equal(restoreRun({ slots: 9, ballCost: 8, balls: 3 }).ballCost, 8);

console.log('PASS: double-cost shots, unscaled ball gifts, jar storage, secret-hole points, and the lowered reels.');
