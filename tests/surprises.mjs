import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP, LAUNCH_SQUASH, DRUM_SIDE_HITS, DRUM_CENTER_HITS, ENLARGE_MS, CLOCK_LAUNCH_TILT } from '../src/physics.js';
import { CANON_NOTES, createCanon, noteFrequency } from '../src/canon.js';
import { chargeAt, chargePercent, CHARGE_DURATION } from '../src/charge.js';

assert.equal(chargeAt(0), 0); assert.equal(chargeAt(-1), 0);
assert.ok(chargeAt(CHARGE_DURATION * .25) > .82 && chargeAt(CHARGE_DURATION * .25) < .83);
assert.ok(chargeAt(CHARGE_DURATION * .75) > .994 && chargeAt(CHARGE_DURATION * .75) < .995);
let previous = 0, previousGain = Infinity;
for (let step = 1; step <= 19; step++) {
  const charge = chargeAt(CHARGE_DURATION * step / 20), gain = charge - previous;
  assert.ok(gain > 0 && gain < previousGain, 'charge rises with progressively smaller increments');
  assert.ok(chargePercent(charge) < 100, 'unfinished charge never displays 100%');
  previous = charge; previousGain = gain;
}
const fullAt = CHARGE_DURATION;
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
  const originY = ball.body.position.y;
  assert.equal(originY, TABLE.launchY + power * LAUNCH_SQUASH, 'the seated ball leaves from the compressed spring');
  let minY = originY, previousVelocity = ball.body.velocity.y;
  for (let i = 0; i < 400 && game.balls.includes(ball); i++) {
    game.step(); minY = Math.min(minY, ball.body.position.y);
    assert.ok(ball.body.velocity.y > previousVelocity, 'gravity must slow ascent from the first step, with no hidden boost');
    previousVelocity = ball.body.velocity.y;
    if (ball.body.velocity.y >= 0) break;
  }
  const rise = originY - minY;
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

assert.deepEqual(createTable().rewards.goals, [DRUM_SIDE_HITS, DRUM_SIDE_HITS, DRUM_CENTER_HITS]);
assert.equal(DRUM_SIDE_HITS, 5); assert.equal(DRUM_CENTER_HITS, 30); assert.equal(ENLARGE_MS, 10000);
const leftEvents = [], left = createTable({ random: () => .25, onSurprise: e => leftEvents.push(e) });
for (let i = 0; i < DRUM_SIDE_HITS - 1; i++) hit(left, 0);
assert.equal(left.stats.randomShots, 0); hit(left, 0); left.step();
assert.equal(left.stats.randomShots, 1); assert.equal(left.stats.bonusBalls, 1);
assert.equal(leftEvents.filter(e => e.kind === 'emit').length, 1);
assert.equal(leftEvents.find(e => e.kind === 'emit').angle, Math.PI / 2);
assert.ok(left.balls[0].bonus && left.balls[0].entered);
remove(left, left.balls[0]); for (let i = 0; i < DRUM_SIDE_HITS; i++) hit(left, 0); left.step();
assert.equal(left.stats.randomShots, 2, 'repeat milestones work without manual reset');

const right = createTable(); for (let i = 0; i < DRUM_SIDE_HITS - 1; i++) hit(right, 1);
assert.equal(right.bumpers[2].circleRadius, 39); hit(right, 1);
assert.equal(right.stats.enlargements, 1); assert.equal(right.bumpers[2].circleRadius, 58.5); assert.equal(right.bumpers[2].plugin.radius, 58.5);
const startedAt = right.clock;
const enlargeSteps = Math.round(ENLARGE_MS / STEP);
for (let i = 0; i < enlargeSteps - 1; i++) right.step();
assert.equal(right.bumpers[2].circleRadius, 58.5, 'growth lasts the full ten active seconds'); right.step();
assert.ok(Math.abs(right.clock - startedAt - ENLARGE_MS) < 1e-6); assert.equal(right.bumpers[2].circleRadius, 39);
assert.equal(right.rewards.enlargedUntil, 0);
assert.equal(right.stats.bonusBalls, 0, 'enlarge launches no physical ball');
console.log('PASS: left bumper grants one real ball every 5 hits; right bumper physically grows the center 1.5× for exactly 10 seconds.');

const events = [], center = createTable({ onSurprise: e => events.push(e) });
for (let i = 0; i < 29; i++) hit(center, 2);
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
console.log(`PASS: center triggers at 30 hits, fires 12 physical balls clockwise from 12 o'clock in ${(shots[11].at - trigger).toFixed(1)}ms.`);

assert.equal(CLOCK_LAUNCH_TILT, 15 * Math.PI / 180);
const bellShot = 12.5;
// The old 12 o'clock gift left straight up the outward radius. It meets the
// center peg and the bell on that same line and keeps bouncing there.
const trapped = createTable({ slots: 5, random: () => .5 });
const trappedBell = trapped.bumpers[2];
const trappedBall = trapped.launch();
assert.ok(trappedBall);
trappedBall.entered = true;
trappedBall.bonus = true;
trappedBall.kind = 'clock';
const trappedRadius = trappedBell.plugin.radius + 26;
Matter.Body.setPosition(trappedBall.body, { x: trappedBell.position.x, y: trappedBell.position.y - trappedRadius });
Matter.Body.setVelocity(trappedBall.body, { x: 0, y: -bellShot });
let stayedAbove = true;
for (let i = 0; i < Math.round(1200 / STEP); i++) {
  trapped.step();
  const live = trapped.balls.find(ball => ball.id === trappedBall.id);
  if (!live || Math.abs(live.body.position.x - trappedBell.position.x) > 24 || live.body.position.y > trappedBell.position.y) { stayedAbove = false; break; }
}
assert.equal(stayedAbove, false, 'a ball bouncing above the bell is pushed out of that column within 1.2s');
assert.equal(trapped.stats.clockBursts, 0, 'leaving the column does not by itself fire the clock');

const tilted = [];
const freed = createTable({
  slots: 5,
  random: () => .5,
  onSurprise(event) {
    if (event.kind !== 'emit' || event.source !== 'clock') return;
    const ball = freed.balls.find(item => item.id === event.ballId);
    tilted.push({ id: ball.id, ordinal: event.ordinal, slot: event.angle, vx: ball.body.velocity.x, vy: ball.body.velocity.y, bonus: ball.bonus, valueFactor: ball.valueFactor });
  },
});
assert.equal(freed.queueClock(1), 12);
for (let i = 0; i < 140 && tilted.length < 12; i++) freed.step();
assert.equal(tilted.length, 12);
for (const shot of tilted) {
  const launch = shot.slot + CLOCK_LAUNCH_TILT;
  assert.ok(Math.abs(shot.vx - Math.cos(launch) * bellShot) < 1e-6, 'clock speed is the outward ray turned 15° clockwise');
  assert.ok(Math.abs(shot.vy - Math.sin(launch) * bellShot) < 1e-6);
  assert.equal(shot.bonus, true);
  assert.equal(shot.valueFactor, 1);
}
const top = tilted[0];
assert.equal(top.ordinal, 0);
assert.ok(top.vx > 2, 'the 12 o\'clock gift has horizontal speed');
const freedBell = freed.bumpers[2];
let leftColumn = Math.abs(freed.balls.find(ball => ball.id === top.id).body.position.x - freedBell.position.x) > 40;
for (let i = 0; i < Math.round(2000 / STEP) && !leftColumn; i++) {
  freed.step();
  const live = freed.balls.find(ball => ball.id === top.id);
  leftColumn = !live || Math.abs(live.body.position.x - freedBell.position.x) > 40 || live.body.position.y > freedBell.position.y;
}
assert.equal(leftColumn, true, 'the tilted 12 o\'clock gift leaves the column above the bell within 2 seconds');
console.log('PASS: a 15° clockwise tilt carries the 12 o\'clock clock gift off the bell instead of bouncing above it.');

let scaled;
const clockFactors = [];
let clockGift = 0;
scaled = createTable({
  random: () => 0.25,
  centerHitWeight: ball => ball.valueFactor,
  giftScale: ball => (ball.valueFactor > 1 ? ball.valueFactor : 1),
  onSurprise(event) {
    if (event.kind === 'clock') clockGift = event.balls;
    if (event.kind !== 'emit' || event.source !== 'clock') return;
    clockFactors.push(scaled.balls.find(ball => ball.id === event.ballId).valueFactor);
  },
});
const centerBumper = scaled.bumpers[2];
for (let i = 0; i < 26; i++) hit(scaled, 2);
assert.equal(scaled.rewards.hits[2], 26, 'a ×1 hit still adds 1 when the center hook is installed');
const heavy = scaled.launch(1, 4);
assert.ok(heavy);
heavy.entered = true;
Matter.Body.setPosition(heavy.body, { x: centerBumper.position.x, y: centerBumper.position.y + centerBumper.plugin.radius + 15 });
Matter.Body.setVelocity(heavy.body, { x: 0, y: -8 });
for (let i = 0; i < 20 && scaled.rewards.hits[2] === 26; i++) scaled.step();
assert.equal(scaled.rewards.hits[2], 30, 'a ×4 ball advances the center drum by 4 and reaches 30');
assert.equal(scaled.stats.clockBursts, 1);
assert.equal(clockGift, 48, 'the ×4 ball multiplies the 12-ball clock into 48 balls');
remove(scaled, heavy);
for (let i = 0; i < 600 && clockFactors.length < 48; i++) scaled.step();
assert.equal(clockFactors.length, 48);
assert.equal(clockFactors.every(factor => factor === 1), true, 'multiplied clock balls are still ×1');
const leftScaled = createTable({
  random: () => 0.25,
  giftScale: ball => (ball.valueFactor > 1 ? ball.valueFactor : 1),
});
for (let i = 0; i < DRUM_SIDE_HITS - 1; i++) hit(leftScaled, 0);
const leftBall = leftScaled.launch(1, 2);
assert.ok(leftBall);
leftBall.entered = true;
const leftBumper = leftScaled.bumpers[0];
Matter.Body.setPosition(leftBall.body, { x: leftBumper.position.x, y: leftBumper.position.y + leftBumper.plugin.radius + 15 });
Matter.Body.setVelocity(leftBall.body, { x: 0, y: -8 });
const leftBefore = leftScaled.rewards.hits[0];
for (let i = 0; i < 20 && leftScaled.rewards.hits[0] === leftBefore; i++) leftScaled.step();
assert.equal(leftScaled.rewards.hits[0], leftBefore + 1, 'the left drum still advances by 1 per hit');
assert.equal(leftScaled.stats.randomShots, 2, 'a ×2 ball doubles the left-drum gift');
for (let i = 0; i < 20 && leftScaled.stats.bonusBalls < 2; i++) leftScaled.step();
assert.equal(leftScaled.stats.bonusBalls, 2);
assert.equal(leftScaled.balls.filter(ball => ball.kind === 'random').every(ball => ball.valueFactor === 1), true);
console.log('PASS: sim hooks scale center progress and gift counts without changing ×1 balls or the left-drum meter.');

const queued = createTable();
assert.equal(queued.queueClock(8), 96);
assert.equal(queued.pendingShotCount, 96, 'a ×8 clock queues every ball');
assert.equal(queued.queueJar(8), 160);
assert.equal(queued.pendingDropCount, 160, 'a ×8 jar release queues every drop');
assert.ok(queued.launch(1), 'player shots still launch while gifts are only queued');
queued.step();
assert.equal(queued.pendingShotCount + queued.stats.bonusBalls >= 96, true, 'queued clock balls are not discarded');
console.log('PASS: multiplied clock and jar gifts stay queued, and a player shot does not drop them.');

const canon = createCanon();
assert.deepEqual(Array.from({ length: 8 }, () => canon.next().name), ['F#5','E5','D5','C#5','B4','A4','B4','C#5']);
for (let i = 8; i < CANON_NOTES.length; i++) canon.next();
assert.equal(canon.next().name, CANON_NOTES[0]); assert.equal(noteFrequency('A4'), 440);
const music = createCanon(), musicalGame = createTable({ onHit: () => music.next() }); musicalGame.launch();
for (let i = 0; i < 1800; i++) musicalGame.step();
assert.ok(music.count > 0); assert.equal(music.count, musicalGame.stats.impacts);
console.log('PASS: Canon opening, looping, tuning and exactly one note advancement per physical obstacle impact.');
