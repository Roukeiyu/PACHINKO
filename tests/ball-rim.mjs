import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { ballOwnFactor, ballRimStyle } from '../src/ball-rim.js';
import { createTable, DRUM_SIDE_HITS, TABLE } from '../src/physics.js';
import { pocketCenter, triggeringGiftScale } from '../src/round.js';

assert.equal(ballOwnFactor({}), 1);
assert.equal(ballOwnFactor({ scoreFactor: 1, valueFactor: 1 }), 1);
assert.equal(ballOwnFactor({ scoreFactor: 2, valueFactor: 1 }), 2, 'a star on a normal launch is ×2');
assert.equal(ballOwnFactor({ scoreFactor: 1, valueFactor: 2 }), 2, 'a ×2 launch with no star is ×2');
assert.equal(ballOwnFactor({ scoreFactor: 2, valueFactor: 4 }), 8, 'launch ×N and stars multiply');
assert.equal(ballOwnFactor({ scoreFactor: 5, valueFactor: 2 }), 10, 'a purple star stacks with the launch factor');
assert.equal(ballOwnFactor({ scoreFactor: 0, valueFactor: 8 }), 8);

for (const [factor, tier] of [[1, 1], [1.5, 2], [2, 2], [3, 2], [4, 4], [5, 4], [7, 4], [8, 8], [10, 8], [40, 8]]) {
  assert.equal(ballRimStyle(factor).tier, tier, `×${factor} uses the ×${tier} rim`);
}
assert.equal(ballRimStyle(1).glow, null, 'the default rim is a plain light-gold line');
assert.equal(ballRimStyle(2).glow, null, '×2 is a solid orange rim');
assert.ok(ballRimStyle(4).glow, '×4 grows a halo');
assert.ok(ballRimStyle(8).glow, '×8 grows an outward halo');
assert.ok(ballRimStyle(1).span < ballRimStyle(2).span);
assert.ok(ballRimStyle(1).width < ballRimStyle(2).width);
assert.notEqual(ballRimStyle(1).color, ballRimStyle(2).color);
assert.notEqual(ballRimStyle(2).color, ballRimStyle(8).color);
assert.notEqual(ballRimStyle(4).color, ballRimStyle(8).color);
const eight = ballRimStyle(8);
const forty = ballRimStyle(40);
assert.equal(forty.tier, 8);
assert.ok(forty.extra > eight.extra && forty.glowScale > eight.glowScale, 'past ×8 the same rim glows a little harder');
assert.equal(ballRimStyle(1).gift, false);
console.log('PASS: ball rims follow launch ×N times stars, and anything above ×8 stays on the ×8 rim.');

const giftColors = { 1: '#c084fc', 2: '#9333ea', 4: '#6d28d9', 8: '#e879f9' };
const giftGlows = { 1: null, 2: null, 4: '#e9d5ff', 8: '#f5d0fe' };
for (const factor of [1, 2, 4, 8, 40]) {
  const player = ballRimStyle(factor);
  const gift = ballRimStyle(factor, true);
  assert.equal(gift.gift, true);
  assert.equal(gift.tier, player.tier);
  assert.equal(gift.span, player.span);
  assert.equal(gift.width, player.width);
  assert.equal(gift.radius, player.radius);
  assert.equal(gift.glowScale, player.glowScale);
  assert.equal(gift.extra, player.extra);
  assert.equal(gift.color, giftColors[gift.tier]);
  assert.equal(gift.glow, giftGlows[gift.tier]);
  assert.notEqual(gift.color, player.color);
}
assert.ok(ballRimStyle(1, true).span < ballRimStyle(2, true).span);
assert.ok(ballRimStyle(2, true).width < ballRimStyle(8, true).width);
assert.equal(ballRimStyle(1, true).glow, null, 'a ×1 gift rim is a plain purple line');
assert.equal(ballRimStyle(2, true).glow, null, 'a ×2 gift rim is a deeper solid purple');
assert.ok(ballRimStyle(4, true).glow, 'a ×4 gift rim grows a soft halo');
assert.ok(ballRimStyle(8, true).glow, 'a ×8 gift rim grows an outward halo');
const giftForty = ballRimStyle(40, true);
assert.equal(giftForty.tier, 8);
assert.ok(giftForty.glowScale > ballRimStyle(8, true).glowScale, 'a gift past ×8 keeps the violet rim and glows harder');
console.log('PASS: gift rims use the same tiers in purple, from a thin line to a magenta halo.');

function sink(game, ball) {
  Matter.Body.setStatic(ball.body, false);
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: game.collector.x, y: game.collector.y - 44 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 5 });
  for (let i = 0; i < 30 && game.balls.includes(ball); i++) game.step();
  assert.ok(!game.balls.includes(ball));
}
function hitDrum(game, index, valueFactor) {
  const ball = game.launch(1, valueFactor);
  const bumper = game.bumpers[index];
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: bumper.position.x, y: bumper.position.y + bumper.plugin.radius + 15 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: -8 });
  const before = game.rewards.hits[index];
  for (let i = 0; i < 20 && game.rewards.hits[index] === before; i++) game.step();
  Matter.Composite.remove(game.engine.world, ball.body);
  game.balls.splice(game.balls.indexOf(ball), 1);
}

{
  const carried = [];
  let drum;
  drum = createTable({ random: () => 0.25, giftScale: triggeringGiftScale, onSurprise: event => {
    if (event.kind !== 'emit' || event.source !== 'random') return;
    const ball = drum.balls.find(item => item.id === event.ballId);
    carried.push({ valueFactor: ball.valueFactor, scoreFactor: ball.scoreFactor, bonus: ball.bonus, factor: ballOwnFactor(ball) });
  } });
  for (let i = 0; i < DRUM_SIDE_HITS; i++) hitDrum(drum, 0, 8);
  for (let i = 0; i < 80 && carried.length < 8; i++) drum.step();
  assert.equal(carried.length, 8, 'the triggering ×8 multiplies how many gifts appear');
  assert.ok(carried.every(ball => ball.bonus && ball.valueFactor === 1 && ball.scoreFactor === 1 && ball.factor === 1));
  assert.ok(carried.every(ball => ballRimStyle(ball.factor, true).tier === 1));
}
{
  const clock = createTable();
  assert.equal(clock.queueClock(8), 96);
  clock.step();
  const gift = clock.balls.find(ball => ball.kind === 'clock');
  assert.ok(gift.bonus);
  assert.equal(gift.valueFactor, 1);
  assert.equal(gift.scoreFactor, 1);
  assert.equal(ballOwnFactor(gift), 1);
}
{
  const scores = [];
  const game = createTable({ starRandom: () => 0.5, onScore: event => scores.push(event) });
  const gift = game.launch();
  gift.bonus = true;
  gift.entered = true;
  gift.valueFactor = 1;
  const star = game.star;
  assert.equal(star.multiplier, 2);
  Matter.Body.setPosition(gift.body, { x: star.x, y: star.y });
  game.step();
  assert.equal(gift.scoreFactor, 2, 'a star doubles the gift ball that picked it up');
  assert.equal(ballOwnFactor(gift), 2);
  assert.equal(ballRimStyle(ballOwnFactor(gift), true).color, '#9333ea');
  const bumper = game.bumpers[0];
  Matter.Body.setPosition(gift.body, { x: bumper.position.x, y: bumper.position.y + bumper.plugin.radius + 15 });
  Matter.Body.setVelocity(gift.body, { x: 0, y: -8 });
  for (let i = 0; i < 20 && !scores.some(event => event.kind === 'hit'); i++) game.step();
  const hit = scores.find(event => event.kind === 'hit');
  assert.equal(hit.points, 2, 'the gift rim factor pays the bumper');
  assert.equal(hit.ownFactor, 2);
  Matter.Body.setPosition(gift.body, { x: pocketCenter(game.slots, 0), y: TABLE.scoreLine - 1 });
  Matter.Body.setVelocity(gift.body, { x: 0, y: 6 });
  for (let i = 0; i < 10 && game.balls.includes(gift); i++) game.step();
  const slot = scores.find(event => event.kind === 'slot');
  assert.ok(slot);
  assert.equal(slot.points, slot.basePoints * 2);
  assert.equal(slot.valueFactor, 1);
}
{
  const scores = [];
  const hole = createTable({ onScore: event => scores.push(event) });
  const gift = hole.launch();
  gift.bonus = true;
  gift.entered = true;
  gift.scoreFactor = 4;
  gift.valueFactor = 1;
  const cup = hole.holes[0];
  Matter.Body.setPosition(gift.body, { x: cup.x, y: cup.y });
  Matter.Body.setVelocity(gift.body, { x: 0, y: 0 });
  hole.step();
  assert.equal(scores[0].kind, 'jackpot');
  assert.equal(scores[0].points, 2000, 'the secret hole uses the gift ball star factor');
  assert.equal(scores[0].valueFactor, 1);
}
{
  const dropped = [];
  let jar;
  jar = createTable({ onSurprise: event => {
    if (event.kind !== 'emit' || event.source !== 'storage') return;
    const ball = jar.balls.find(item => item.id === event.ballId);
    dropped.push({ scoreFactor: ball.scoreFactor, valueFactor: ball.valueFactor, bonus: ball.bonus });
    Matter.Composite.remove(jar.engine.world, ball.body);
    jar.balls.splice(jar.balls.indexOf(ball), 1);
  } });
  const gift = jar.launch();
  gift.bonus = true;
  gift.scoreFactor = 4;
  gift.valueFactor = 8;
  sink(jar, gift);
  assert.equal(jar.collector.stored[0].refund, false, 'a gift still does not refund a ball');
  assert.equal(jar.collector.stored[0].scoreFactor, 4);
  assert.equal(jar.collector.refundable, 0);
  for (let n = 0; n < 19; n++) {
    const filler = jar.launch();
    filler.bonus = true;
    filler.scoreFactor = 1;
    sink(jar, filler);
  }
  for (let i = 0; i < 4000 && dropped.length < 20; i++) jar.step();
  assert.equal(dropped.length, 20);
  assert.equal(dropped.filter(ball => ball.scoreFactor === 4).length, 1);
  assert.ok(dropped.every(ball => ball.bonus && ball.valueFactor === 1));
  assert.equal(ballRimStyle(4, true).tier, 4);
}
console.log('PASS: gift balls stay ×1 unless they carry stars, and that factor scores like a launched ball.');
