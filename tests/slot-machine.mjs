import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createSlotMachine, SLOT_SYMBOLS, REEL_ICONS, SLOT_DISPLAY, slotBonusLabel, reelUnit, sampleReel, BALL_SYMBOL, ballPayout, REEL_WEIGHTS, BALL_ONE, BALL_PAIR, BALL_JACKPOT, luckyReelPay, pickReel, SINGLE_REEL_MS, SPIN_GAP_MS } from '../src/slot-machine.js';
import { reelIconSvg } from '../src/reel-icons.js';
import { createTable, STEP, TABLE } from '../src/physics.js';
import { pocketCenter } from '../src/round.js';
const choices = values => { let index = 0; return () => reelUnit(values[index++ % values.length]); };
function enter(machine, count, clock = 0) { for (let i = 0; i < count; i++) machine.recordEntry(clock); }
const outcomes = { 1: 0, 2: 0, 5: 0 };
assert.deepEqual(SLOT_SYMBOLS, ['星星', '弯月', '太阳', '行星', '彗星']);
assert.equal(new Set(REEL_ICONS.map(icon => icon.id)).size, 5);
for (const icon of REEL_ICONS) {
  const markup = reelIconSvg(REEL_ICONS.indexOf(icon));
  assert.match(markup, /<svg/i);
  assert.doesNotMatch(markup, /🍒|🍋|🔔|🍀|🍊|🍇|🍍|🍉/);
}
for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) {
  const events = [], machine = createSlotMachine({ random: choices([a,b,c]), onEvent: e => events.push(e) });
  enter(machine, 49); assert.equal(machine.state.spins, 0); assert.equal(machine.state.progress, 49);
  enter(machine, 1); assert.equal(machine.state.spins, 1); assert.equal(machine.state.progress, 0);
  machine.advance(899); assert.deepEqual(machine.state.stopped, [false,false,false]);
  machine.advance(900); assert.deepEqual(machine.state.stopped, [true,false,false]);
  machine.advance(1300); assert.deepEqual(machine.state.stopped, [true,true,false]);
  machine.advance(1699); assert.equal(machine.state.multiplier, 1, 'spinning does not grant a premature bonus');
  machine.advance(1700); assert.deepEqual(machine.state.reels, [a,b,c]);
  const expected = a === b && b === c ? 5 : a === b || b === c || a === c ? 2 : 1;
  assert.equal(machine.state.multiplier, expected);
  assert.equal(machine.state.result, expected); outcomes[expected]++;
  assert.equal(events.filter(e => e.kind === 'slot-result').length, 1);
  assert.equal(events.filter(e => e.kind === 'slot-reel').length, 3);
  if (expected > 1) {
    const deadline = 1700 + (expected === 5 ? 60000 : 180000);
    assert.equal(machine.state.activeUntil, deadline);
    machine.advance(deadline - .01); assert.equal(machine.state.multiplier, expected);
    machine.advance(deadline); assert.equal(machine.state.multiplier, 1, 'bonus expires on its exact deadline');
  }
}
assert.deepEqual(outcomes, { 1: 60, 2: 60, 5: 5 });
assert.equal(BALL_ONE, 1); assert.equal(BALL_PAIR, 10); assert.equal(BALL_JACKPOT, 100);
assert.equal(REEL_WEIGHTS[BALL_SYMBOL], 10); assert.equal(REEL_WEIGHTS.slice(0, 5).every(weight => weight === 18), true);
for (const [reels, balls, payout, multiplier] of [[[5, 0, 1], 1, 1, 1], [[5, 5, 0], 2, 10, 2], [[5, 5, 5], 3, 100, 5], [[0, 0, 0], 0, 0, 5], [[0, 0, 5], 1, 1, 2]]) {
  const events = [], machine = createSlotMachine({ random: choices(reels), onEvent: e => events.push(e) });
  enter(machine, 50); machine.advance(1700);
  const result = events.find(e => e.kind === 'slot-result');
  assert.deepEqual(result.reels, reels);
  assert.equal(result.balls, balls); assert.equal(result.ballPayout, payout); assert.equal(ballPayout(balls), payout);
  assert.equal(result.multiplier, multiplier); assert.equal(machine.state.multiplier, multiplier);
}
let seed = 1, ballReels = 0;
const roll = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let i = 0; i < 8000; i++) if (sampleReel(roll) === BALL_SYMBOL) ballReels++;
assert.ok(Math.abs(ballReels / 8000 - 0.1) < 0.02, `ball rate ${ballReels / 8000}`);
for (const [before, after, reel, multiplier, balls, payout] of [
  [[0, 0, 1], [0, 0, 0], 2, 5, 0, 0],
  [[0, 0, 0], [0, 0, 0], 0, 1, 0, 0],
  [[0, 0, 1], [0, 0, 2], 2, 1, 0, 0],
  [[0, 1, 2], [0, 1, 0], 2, 2, 0, 0],
  [[5, 0, 1], [5, 5, 1], 1, 2, 2, 10],
  [[5, 5, 5], [5, 5, 5], 0, 1, 0, 0],
  [[0, 1, 2], [0, 1, 5], 2, 1, 1, 1],
  [[5, 5, 0], [5, 5, 5], 2, 5, 3, 100],
]) {
  const pay = luckyReelPay(before, after, reel);
  assert.equal(pay.multiplier, multiplier, `${before} reel ${reel}`);
  assert.equal(pay.balls, balls);
  assert.equal(pay.ballPayout, payout);
  assert.equal(pay.paid, multiplier > 1 || payout > 0);
}
console.log('PASS: all 125 independent five-symbol outcomes, exact 50-entry trigger, staggered stops and precise 3/1-minute deadlines.');

const queued = createSlotMachine({ random: choices([0,0,0,1,1,2,2,3,4]) });
enter(queued, 175);
assert.equal(queued.state.spins, 1); assert.equal(queued.state.queued, 2); assert.equal(queued.state.progress, 25);
queued.advance(1700); assert.equal(queued.state.multiplier, 5);
queued.advance(2399); assert.equal(queued.state.spins, 1, 'completed reels stay visible before the next queued spin');
queued.advance(2400); assert.equal(queued.state.spins, 2);
queued.advance(4100); assert.equal(queued.state.result, 2); assert.equal(queued.state.multiplier, 5, 'a new pair cannot overwrite a live triple');
assert.equal(queued.state.pairUntil, 184100);
queued.advance(4800); queued.advance(6500);
assert.equal(queued.state.completed, 3); assert.equal(queued.state.result, 1);
assert.equal(queued.state.multiplier, 5, 'three different symbols do not cancel an existing bonus');
queued.advance(61700); assert.equal(queued.state.multiplier, 2, 'x2 resumes if it outlasts x5');
assert.equal(slotBonusLabel(queued.state, 61700), '进洞 ×2 · 02:03');
queued.advance(184100); assert.equal(queued.state.multiplier, 1);
assert.equal(slotBonusLabel(queued.state, 184100), '');
const refreshed = createSlotMachine({ random: choices([0,0,1]) });
enter(refreshed, 50); refreshed.advance(1700); enter(refreshed, 50, 3000); refreshed.advance(4700);
assert.equal(refreshed.state.pairUntil, 184700, 'repeat wins refresh the exact duration rather than add durations');
console.log('PASS: repeated milestones queue without losing entries, x5 has priority, x2 resumes, non-wins preserve bonuses and repeat wins refresh timers.');

function put(ball, x, y, vx = 0, vy = 0) {
  assert.ok(ball); ball.entered = true;
  Matter.Body.setPosition(ball.body, { x, y }); Matter.Body.setVelocity(ball.body, { x: vx, y: vy });
}
function slot(game, ball = game.launch()) {
  // Column 0 is a scoring pocket on every layout and is never the center LUCKY slot.
  put(ball, pocketCenter(game.slots, 0), TABLE.scoreLine - 1, 0, 6);
  for (let n = 0; n < 10 && game.balls.includes(ball); n++) game.step();
  assert.ok(!game.balls.includes(ball));
}
function hole(game, ball = game.launch()) {
  const h = game.holes[0];
  put(ball, h.x + Math.cos(h.facing) * 47, h.y + Math.sin(h.facing) * 47, -Math.cos(h.facing) * 5, -Math.sin(h.facing) * 5);
  for (let n = 0; n < 45 && game.balls.includes(ball); n++) game.step();
  assert.ok(!game.balls.includes(ball));
}
function advanceTo(game, deadline) { while (game.clock + STEP < deadline - 1e-6) game.step(); }
for (const [symbols, expected] of [[[0,0,1],2], [[4,4,4],5], [[0,1,2],1]]) {
  const scores = [], events = [];
  const game = createTable({ slotRandom: choices(symbols), onScore: e => scores.push(e), onSurprise: e => events.push(e), starRandom: () => .5 });
  for (let i = 0; i < 49; i++) slot(game);
  assert.equal(game.slotMachine.spins, 0);
  hole(game);
  assert.equal(game.stats.scored, 50); assert.equal(game.stats.jackpots, 1);
  assert.equal(game.slotMachine.entries, 50); assert.equal(game.slotMachine.spins, 1);
  assert.equal(scores.at(-1).points, 500, 'the fiftieth scoring entry precedes the slot result');
  while (game.slotMachine.spinning) game.step();
  assert.equal(game.slotMachine.multiplier, expected);
  const boosted = game.launch(), star = game.star;
  put(boosted, star.x, star.y); game.step(); assert.equal(boosted.scoreFactor, 2, 'the physical star is actually collected');
  slot(game, boosted);
  assert.equal(scores.at(-1).points, scores.at(-1).basePoints * 2 * expected);
  assert.equal(scores.at(-1).scoreFactor, 2); assert.equal(scores.at(-1).globalMultiplier, expected);
  game.setSlots(9); // Preserve the bonus, counter and upcoming spin state.
  assert.equal(game.slotMachine.entries, 51); assert.equal(game.slotMachine.multiplier, expected);
  hole(game); assert.equal(scores.at(-1).points, 500 * expected);
  const deadline = game.slotMachine.activeUntil;
  if (expected > 1) {
    advanceTo(game, deadline); assert.equal(game.slotMachine.multiplier, expected);
    game.step(); assert.equal(game.slotMachine.multiplier, 1);
    slot(game); assert.equal(scores.at(-1).points, scores.at(-1).basePoints);
  }
  assert.equal(game.slotMachine.entries, game.stats.scored);
  assert.ok(events.some(e => e.kind === 'slot-result' && e.multiplier === expected));
}
console.log('PASS: real slot and secret-hole entries earn spins once, bonuses multiply actual scores and stars, survive layout changes and expire on game time.');

const excluded = createTable();
const stored = excluded.launch(); put(stored, excluded.collector.x, excluded.collector.y - 44, 0, 5);
for (let i = 0; i < 30 && excluded.balls.includes(stored); i++) excluded.step();
assert.equal(excluded.stats.absorbed, 1); assert.equal(excluded.slotMachine.entries, 0);
const returned = excluded.launch(); Matter.Body.setPosition(returned.body, { x: TABLE.launchX, y: 820 }); Matter.Body.setVelocity(returned.body, { x: 0, y: 3 });
excluded.step(); assert.equal(excluded.stats.returns, 1); assert.equal(excluded.slotMachine.entries, 0);
const miss = excluded.launch(); put(miss, 615 - 48, 482 - 48, 3, 0);
for (let i = 0; i < 15; i++) excluded.step();
assert.equal(excluded.slotMachine.entries, 0, 'near misses and impacts cannot grant slot progress');
// The reels sit below the enlarged drum and the swinging bar, above the pockets.
const top = SLOT_DISPLAY.y - SLOT_DISPLAY.height / 2, bottom = SLOT_DISPLAY.y + SLOT_DISPLAY.height / 2;
const drum = excluded.bumpers[2];
assert.ok(top > drum.position.y + drum.plugin.baseRadius * 1.5 + 11, 'reels stay a ball radius below the enlarged center drum');
assert.ok(bottom < TABLE.slotTop, 'reels stay above the scoring row');
for (let n = 0; n < 1100; n++) {
  excluded.step();
  assert.ok(Math.max(...excluded.spinners[0].vertices.map(v => v.y)) < top, 'the swinging bar stays above the reels');
  if (excluded.star) assert.ok(Math.abs(excluded.star.x - SLOT_DISPLAY.x) >= SLOT_DISPLAY.width/2 + 26 || Math.abs(excluded.star.y - SLOT_DISPLAY.y) >= SLOT_DISPLAY.height/2 + 26, 'stars never hide behind the cabinet');
}
console.log('PASS: storage, returns, near misses and impacts give no progress; the fixed reel display clears the drum, bar and collectible stars.');

const queuedLucky = createSlotMachine({ random: () => 0.1 });
queuedLucky.recordLucky(0);
queuedLucky.recordLucky(0);
queuedLucky.recordLucky(0);
assert.equal(queuedLucky.state.spins, 1, 'a spinning reel is not replaced by the next LUCKY hit');
assert.equal(queuedLucky.state.luckyQueued, 2);
assert.equal(queuedLucky.state.stopped.filter(stopped => !stopped).length, 1);
queuedLucky.advance(SINGLE_REEL_MS - 1);
assert.equal(queuedLucky.state.spins, 1);
queuedLucky.advance(SINGLE_REEL_MS);
assert.equal(queuedLucky.state.spinning, false);
queuedLucky.advance(SINGLE_REEL_MS + SPIN_GAP_MS - 1);
assert.equal(queuedLucky.state.spins, 1, 'the queue waits out the same gap as a full spin');
queuedLucky.advance(SINGLE_REEL_MS + SPIN_GAP_MS);
assert.equal(queuedLucky.state.spins, 2);
assert.equal(queuedLucky.state.luckyQueued, 1);
console.log('PASS: LUCKY hits that arrive during a spin wait in order and do not interrupt it.');

const fullFirstDraws = [];
const fullFirstScript = [reelUnit(0), reelUnit(0), reelUnit(1), 0.9, reelUnit(0)];
let fullFirstIndex = 0;
const fullFirst = createSlotMachine({
  random: () => { const value = fullFirstScript[fullFirstIndex++]; fullFirstDraws.push(value); return value; },
  onEvent: () => {},
});
enter(fullFirst, 50);
fullFirst.recordLucky(0);
assert.equal(fullFirstDraws.length, 3, 'a full spin still consumes exactly three samples');
assert.equal(fullFirst.state.queued, 0);
assert.equal(fullFirst.state.luckyQueued, 1);
assert.equal(fullFirst.state.spinMode, 'all');
fullFirst.advance(1700);
assert.deepEqual(fullFirst.state.reels, [0, 0, 1]);
assert.equal(fullFirstDraws.length, 3, 'the waiting LUCKY spin does not draw until it starts');
fullFirst.advance(1700 + SPIN_GAP_MS);
assert.equal(fullFirst.state.spinMode, 'reel');
assert.equal(fullFirst.state.activeReel, pickReel(0.9));
assert.deepEqual(fullFirst.state.stopped, [true, true, false]);
assert.equal(fullFirstDraws.length, 5);
console.log('PASS: the 50-entry spin stays ahead of a LUCKY spin and still draws three symbols.');

function dropColumn(game, column) {
  const ball = game.launch();
  put(ball, pocketCenter(game.slots, column), TABLE.scoreLine - 1, 0, 6);
  for (let n = 0; n < 10 && game.balls.includes(ball); n++) game.step();
  assert.ok(!game.balls.includes(ball));
  return ball;
}
const centerScores = [];
const centerGame = createTable({ slots: 7, slotRandom: () => 0.9, onScore: event => centerScores.push(event) });
dropColumn(centerGame, 0);
assert.equal(centerGame.slotMachine.spins, 0, 'a side pocket does not turn a reel');
dropColumn(centerGame, 3);
assert.equal(centerScores.at(-1).globalMultiplier, 1, 'the LUCKY ball itself is scored before its reel stops');
assert.equal(centerGame.slotMachine.spins, 1);
assert.equal(centerGame.slotMachine.stopped.filter(stopped => !stopped).length, 1);
assert.equal(centerGame.slotMachine.activeReel, pickReel(0.9));
while (centerGame.slotMachine.spinning) centerGame.step();
assert.equal(centerGame.slotMachine.multiplier, 1, 'a reel that matches nothing does not change the score multiplier');
const nine = createTable({ slots: 9, slotRandom: () => 0.2 });
dropColumn(nine, 3);
dropColumn(nine, 5);
assert.equal(nine.slotMachine.spins, 0, 'the ×10 pockets beside center are labeled LUCKY but do not spin a reel');
dropColumn(nine, 4);
assert.equal(nine.slotMachine.spins, 1);
assert.equal(nine.slotMachine.stopped.filter(stopped => !stopped).length, 1);
const paying = [];
const payingGame = createTable({
  slots: 7,
  slotRandom() {
    const value = [0.9, reelUnit(0)][paying.length];
    paying.push(value);
    return value;
  },
});
dropColumn(payingGame, 3);
while (payingGame.slotMachine.spinning) payingGame.step();
assert.deepEqual(payingGame.slotMachine.reels, [0, 1, 0]);
assert.equal(payingGame.slotMachine.multiplier, 2);
dropColumn(payingGame, 0);
assert.equal(payingGame.slotMachine.spins, 1, 'the side pocket still does not queue another reel');
console.log('PASS: only the center LUCKY pocket turns one reel, and a changed matching symbol pays.');
