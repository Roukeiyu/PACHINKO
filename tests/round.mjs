import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE } from '../src/physics.js';
import { PRESET_BOARD } from '../src/leaderboard.js';
import {
  START_BALLS, LOW_BALLS, LAUNCH_COST, BURST_COST, SECRET_BALLS, LUCKY_BALLS, SLOT_MACHINE_BALLS,
  MINI_BALLS_MIN, MINI_BALLS_MAX, MINI_BALLS_FULL_SCORE, DRAIN_MIN_OPENING, DRAIN_WIDTH_SCALE, DRAIN_WALL, POCKET_WIDTH,
  slotFrame, classifyBottom, pocketCenter, miniGameBalls, roundCanEnd,
  qualifiesForLeaderboard, freshRound, restoreRun,
} from '../src/round.js';

assert.equal(START_BALLS, 100);
assert.equal(LOW_BALLS, 10);
assert.equal(LAUNCH_COST, 1);
assert.equal(BURST_COST, 5);
assert.equal(LUCKY_BALLS, 0);
assert.equal(SLOT_MACHINE_BALLS, 0);
assert.equal(SECRET_BALLS, 10);
assert.equal(MINI_BALLS_FULL_SCORE, 5600);
assert.equal(miniGameBalls(0), MINI_BALLS_MIN);
assert.equal(miniGameBalls(MINI_BALLS_FULL_SCORE), MINI_BALLS_MAX);
assert.equal(miniGameBalls(1e9), MINI_BALLS_MAX);
assert.ok(miniGameBalls(900) > MINI_BALLS_MIN && miniGameBalls(900) < MINI_BALLS_MAX);
assert.ok(miniGameBalls(840) < miniGameBalls(5600));

for (const count of [5, 7, 9]) {
  const frame = slotFrame(count);
  assert.equal(frame.regions[0].x0, TABLE.left);
  assert.equal(frame.regions.at(-1).x1, TABLE.right);
  const mouths = count + 1;
  const natural = (TABLE.right - TABLE.left - count * POCKET_WIDTH) / mouths;
  const baseline = Math.max(natural, DRAIN_MIN_OPENING);
  assert.ok(Math.abs(frame.opening - baseline * DRAIN_WIDTH_SCALE) < 1e-6, `${count} drain mouths are half of the previous width`);
  assert.ok(Math.abs(frame.pocket * count + frame.opening * mouths - (TABLE.right - TABLE.left)) < 1e-6, `${count} slots still fill the row`);
  assert.ok(frame.pocket > POCKET_WIDTH, `${count} slots receive the reclaimed drain width`);
  assert.ok(frame.pocket - DRAIN_WALL * 2 >= 24, `${count} slots leave room for a ball`);
  const slots = frame.regions.filter(region => region.kind === 'slot');
  const drains = frame.regions.filter(region => region.kind === 'drain');
  assert.equal(slots.length, count);
  assert.equal(drains.length, count + 1);
  slots.forEach((slot, column) => {
    assert.equal(classifyBottom(pocketCenter(count, column), count).column, column);
    assert.equal(classifyBottom((slot.x0 + slot.x1) / 2, count).kind, 'slot');
  });
  for (const drain of drains) {
    const mid = (drain.x0 + drain.x1) / 2;
    assert.equal(classifyBottom(mid, count).kind, 'drain');
  }
  assert.equal(classifyBottom(347, count).column, (count - 1) / 2);
}
assert.equal(classifyBottom(TABLE.left - 1, 5), null);
assert.equal(classifyBottom(TABLE.right, 5), null);

assert.equal(roundCanEnd({}), true);
assert.equal(roundCanEnd({ balls: 1 }), false);
assert.equal(roundCanEnd({ onTable: 1 }), false);
assert.equal(roundCanEnd({ stored: 1 }), false);
assert.equal(roundCanEnd({ pendingDrops: 1 }), false);
assert.equal(roundCanEnd({ pendingLaunches: 1 }), false);
assert.equal(roundCanEnd({ secretPending: true }), false);
assert.equal(roundCanEnd({ miniOpen: true }), false);

assert.equal(qualifiesForLeaderboard(49999, PRESET_BOARD), false);
assert.equal(qualifiesForLeaderboard(50000, PRESET_BOARD), true);
assert.equal(qualifiesForLeaderboard(50011, [{ score: 10 }, { score: 50011 }]), true);
assert.equal(freshRound(80).slots, 5);
assert.equal(freshRound(80).balls, START_BALLS);
assert.equal(freshRound(80).bestBefore, 80);
assert.equal(restoreRun(undefined, 10).slots, 5, 'an old save without a round starts over');
assert.equal(restoreRun({ slots: 9, score: 20, balls: 7 }).slots, 9);
assert.equal(restoreRun({ slots: 9, score: 20, balls: 7 }).score, 20);
assert.equal(restoreRun({ balls: -3 }).balls, START_BALLS);

for (const count of [5, 7, 9]) {
  const scored = [], drained = [];
  const game = createTable({ slots: count, onScore: event => scored.push(event), onDrain: event => drained.push(event) });
  for (let column = 0; column < count; column++) {
    const ball = game.launch(1);
    ball.entered = true;
    Matter.Body.setPosition(ball.body, { x: pocketCenter(count, column), y: TABLE.scoreLine - 1 });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 6 });
    game.step();
    assert.equal(scored.at(-1)?.column, column, `${count} slots pocket ${column} scores`);
    assert.equal(scored.at(-1).multiplier, [count === 5 ? [2, 3, 5, 3, 2] : count === 7 ? [2, 3, 5, 10, 5, 3, 2] : [2, 3, 5, 10, 20, 10, 5, 3, 2]][0][column]);
  }
  const drain = slotFrame(count).regions.find(region => region.kind === 'drain');
  const before = scored.length;
  const ball = game.launch(1);
  ball.entered = true;
  Matter.Body.setPosition(ball.body, { x: (drain.x0 + drain.x1) / 2, y: TABLE.scoreLine - 1 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 6 });
  game.step();
  assert.equal(scored.length, before, 'a drain mouth does not score');
  assert.equal(drained.length, 1);
  assert.equal(game.stats.drains, 1);
  const paused = game.launchBurst();
  assert.ok(paused);
  assert.equal(game.pendingLaunches, 4);
  assert.equal(game.setEmissionPaused(true), 4);
  assert.equal(game.pendingLaunches, 0);
}
assert.throws(() => slotFrame(4), RangeError);
assert.ok(POCKET_WIDTH >= DRAIN_WALL * 2 + 22);
console.log('PASS: ball economy constants, drain geometry, pocket scoring, and round end rules.');
