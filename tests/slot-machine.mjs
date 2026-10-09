import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createSlotMachine, SLOT_SYMBOLS, SLOT_DISPLAY, slotBonusLabel } from '../src/slot-machine.js';
import { createTable, STEP, TABLE } from '../src/physics.js';
const choices = values => { let index = 0; return () => (values[index++ % values.length] + .5) / 5; };
function enter(machine, count, clock = 0) { for (let i = 0; i < count; i++) machine.recordEntry(clock); }
const outcomes = { 1: 0, 2: 0, 5: 0 };
assert.equal(new Set(SLOT_SYMBOLS).size, 5);
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
  put(ball, 347, TABLE.scoreLine - 1, 0, 6);
  for (let n = 0; n < 10 && game.balls.includes(ball); n++) game.step();
  assert.ok(!game.balls.includes(ball));
}
function hole(game, ball = game.launch()) {
  const h = game.holes[0]; put(ball, h.x - 47, h.y - 2, 5, -1);
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
// Display stays clear of the enlarged center drum and the swinging physical bar.
const top = SLOT_DISPLAY.y - SLOT_DISPLAY.height / 2, bottom = SLOT_DISPLAY.y + SLOT_DISPLAY.height / 2;
assert.ok(top > excluded.bumpers[2].position.y + excluded.bumpers[2].plugin.baseRadius * 1.5 + 18);
for (let n = 0; n < 1100; n++) {
  excluded.step(); assert.ok(Math.min(...excluded.spinners[0].vertices.map(v => v.y)) > bottom);
  if (excluded.star) assert.ok(Math.abs(excluded.star.x - SLOT_DISPLAY.x) >= SLOT_DISPLAY.width/2 + 26 || Math.abs(excluded.star.y - SLOT_DISPLAY.y) >= SLOT_DISPLAY.height/2 + 26, 'stars never hide behind the cabinet');
}
console.log('PASS: storage, returns, near misses and impacts give no progress; the fixed reel display clears the drum, bar and collectible stars.');
