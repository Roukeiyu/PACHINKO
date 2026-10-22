import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
import { PRESET_BOARD } from '../src/leaderboard.js';
import {
  START_BALLS, LOW_BALLS, LAUNCH_COST, BURST_COST, SECRET_BALLS, LUCKY_BALLS, SLOT_MACHINE_BALLS,
  DRUM_ENLARGE_BALLS, MINI_BALLS_FULL_SCORE, DRAIN_MIN_OPENING, DRAIN_WIDTH_SCALE, DRAIN_WALL, POCKET_WIDTH,
  BALL_DIAMETER, WIDE_DRAIN_OPENING,
  slotFrame, classifyBottom, pocketCenter, secretHoleBalls, shotCost, nextBallCost, clampBallCost, chooseSpendFactor, roundCanEnd, jarRefundable,
  BOARD_CROWD_LOCK, boardCrowdUnlock, crowdLaunchLocked, triggeringGiftScale,
  qualifiesForLeaderboard, freshRound, restoreRun,
} from '../src/round.js';

assert.equal(START_BALLS, 150);
assert.equal(LOW_BALLS, 10);
assert.equal(LAUNCH_COST, 1);
assert.equal(BURST_COST, 5);
assert.equal(LUCKY_BALLS, 0);
assert.equal(SLOT_MACHINE_BALLS, 0);
assert.equal(SECRET_BALLS, 20);
assert.equal(DRUM_ENLARGE_BALLS, 0);
assert.equal(MINI_BALLS_FULL_SCORE, 5600);
for (const score of [0, 1400, 5600, 1e9]) {
  assert.equal(secretHoleBalls(score).holeBalls, SECRET_BALLS);
  assert.equal(secretHoleBalls(score).miniBalls, 0, 'a secret visit pays the hole balls only');
}
assert.equal(secretHoleBalls({ valueFactor: 1 }).holeBalls, SECRET_BALLS);
assert.equal(secretHoleBalls({ valueFactor: 8 }).holeBalls, SECRET_BALLS * 8);
assert.equal(secretHoleBalls({ valueFactor: 8 }).miniBalls, 0, 'a multiplied secret visit still pays no mini-game balls');
assert.equal(BOARD_CROWD_LOCK, 100);
assert.equal(boardCrowdUnlock(), 50);
assert.equal(boardCrowdUnlock(), Math.floor(BOARD_CROWD_LOCK / 2));
assert.equal(crowdLaunchLocked(false, BOARD_CROWD_LOCK - 1), false);
assert.equal(crowdLaunchLocked(false, BOARD_CROWD_LOCK), true);
assert.equal(crowdLaunchLocked(true, boardCrowdUnlock()), true);
assert.equal(crowdLaunchLocked(true, boardCrowdUnlock() - 1), false);
assert.equal(triggeringGiftScale({ valueFactor: 4 }), 4);
assert.equal(triggeringGiftScale(null), 1);

for (const count of [5, 7, 9]) {
  const frame = slotFrame(count);
  assert.equal(frame.regions[0].x0, TABLE.left);
  assert.equal(frame.regions.at(-1).x1, TABLE.right);
  let edge = TABLE.left;
  for (const region of frame.regions) {
    assert.ok(Math.abs(region.x0 - edge) < 1e-6, `${count} regions tile`);
    assert.ok(region.x1 > region.x0);
    edge = region.x1;
  }
  assert.ok(Math.abs(edge - TABLE.right) < 1e-6);
  const slots = frame.regions.filter(region => region.kind === 'slot');
  const drains = frame.regions.filter(region => region.kind === 'drain');
  assert.equal(slots.length, count);
  assert.ok(frame.pocket - DRAIN_WALL * 2 >= 24, `${count} slots leave room for a ball`);
  if (count === 7 || count === 9) {
    assert.equal(frame.opening, WIDE_DRAIN_OPENING);
    assert.equal(frame.apron, 0);
    assert.ok(frame.opening >= BALL_DIAMETER + 6, `${count}-slot drains are wider than a ball`);
    assert.equal(drains.length, count - 1);
    assert.equal(frame.regions[0].kind, 'slot');
    assert.equal(frame.regions.at(-1).kind, 'slot');
    assert.equal(frame.regions[0].column, 0);
    assert.equal(frame.regions.at(-1).column, count - 1);
    assert.ok(Math.abs(frame.regions[0].x0 - TABLE.left) < 1e-6);
    assert.ok(Math.abs(frame.regions.at(-1).x1 - TABLE.right) < 1e-6);
  } else {
    const mouths = count + 1;
    const natural = (TABLE.right - TABLE.left - count * POCKET_WIDTH) / mouths;
    const baseline = Math.max(natural, DRAIN_MIN_OPENING);
    assert.ok(Math.abs(frame.opening - baseline * DRAIN_WIDTH_SCALE) < 1e-6, `${count} drain mouths are half of the previous width`);
    assert.ok(Math.abs(frame.pocket * count + frame.opening * mouths - (TABLE.right - TABLE.left)) < 1e-6, `${count} slots still fill the row`);
    assert.ok(frame.pocket > POCKET_WIDTH, `${count} slots receive the reclaimed drain width`);
    assert.equal(drains.length, count + 1);
    assert.equal(frame.apron, 0);
  }
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
for (const count of [7, 9]) {
  const frame = slotFrame(count);
  const drop = (x, vx = 0, y = 770) => {
    const game = createTable({ slots: count, random: () => 0.25 });
    const ball = game.launch(1);
    ball.entered = true;
    Matter.Body.setPosition(ball.body, { x, y });
    Matter.Body.setVelocity(ball.body, { x: vx, y: 1.4 });
    for (let i = 0; i < Math.round(7000 / STEP) && game.balls.length; i++) game.step();
    return game;
  };
  for (const drain of frame.regions.filter(region => region.kind === 'drain')) {
    const straight = drop((drain.x0 + drain.x1) / 2, 0);
    assert.equal(straight.balls.length, 0, `${count}-slot drain ${drain.index} must not hold a ball`);
    assert.equal(straight.stats.timeouts, 0);
    assert.equal(straight.stats.drains, 1, `${count}-slot drain ${drain.index} drops a centered ball`);
    for (const vx of [-1.2, 1.2]) {
      const game = drop((drain.x0 + drain.x1) / 2, vx);
      assert.equal(game.balls.length, 0, `${count}-slot drain ${drain.index} vx ${vx} must not hold a ball`);
      assert.equal(game.stats.timeouts, 0);
      assert.equal(game.stats.drains + game.stats.scored, 1);
    }
  }
  const left = frame.regions[0], right = frame.regions.at(-1);
  for (const [name, x] of [['left wall', left.x0 + 8], ['right wall', right.x1 - 8]]) {
    const game = drop(x);
    assert.equal(game.balls.length, 0, `${count}-slot ${name} must not hold a ball`);
    assert.equal(game.stats.timeouts, 0);
    assert.equal(game.stats.drains, 0, `${count}-slot ${name} scores the end slot`);
    assert.equal(game.stats.scored, 1);
  }
}
assert.equal(classifyBottom(TABLE.left - 1, 5), null);
assert.equal(classifyBottom(TABLE.right, 5), null);

assert.equal(roundCanEnd({}), true);
assert.equal(roundCanEnd({ balls: 1 }), false);
assert.equal(roundCanEnd({ onTable: 1 }), false);
assert.equal(roundCanEnd({ stored: 1 }), false);
assert.equal(jarRefundable([1, { scoreFactor: 2, refund: true }]), 2);
assert.equal(jarRefundable([{ scoreFactor: 5, refund: false }, { scoreFactor: 1 }]), 0, 'gift entries and unmarked objects do not return a ball');
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
assert.equal(restoreRun({ slots: 5, doubleBall: true }).doubleBall, false, 'double cost stays locked before 7 slots');
assert.equal(restoreRun({ slots: 5, ballCost: 8 }).ballCost, 1);
assert.equal(restoreRun({ slots: 7, score: 5000, balls: 40, doubleBall: true }).doubleBall, true);
assert.equal(restoreRun({ slots: 7, doubleBall: true }).ballCost, 2);
assert.equal(restoreRun({ slots: 7, ballCost: 8 }).ballCost, 2, '×4 and ×8 clamp back to ×2 before 9 slots');
assert.equal(restoreRun({ slots: 9, ballCost: 4 }).ballCost, 4);
assert.equal(restoreRun({ slots: 9, ballCost: 8 }).ballCost, 8);
assert.equal(restoreRun({ slots: 9, ballCost: 8 }).doubleBall, true);
assert.equal(restoreRun({ slots: 9, doubleBall: false }).doubleBall, false);
assert.equal(restoreRun({ slots: 9, doubleBall: false }).ballCost, 1);
assert.equal(freshRound().doubleBall, false);
assert.equal(freshRound().ballCost, 1);
assert.deepEqual([nextBallCost(1, 7), nextBallCost(2, 7)], [2, 1]);
assert.deepEqual([nextBallCost(1, 9), nextBallCost(2, 9), nextBallCost(4, 9), nextBallCost(8, 9)], [2, 4, 8, 1]);
assert.equal(clampBallCost(8, 5), 1);
assert.equal(shotCost(4), 4);
assert.equal(shotCost(8, true), 40);
assert.equal(chooseSpendFactor(5, 100, false), 1);
assert.equal(chooseSpendFactor(7, 10, false), 2);
assert.equal(chooseSpendFactor(7, 1, false), 1);
assert.equal(chooseSpendFactor(7, 9, true), 0);
assert.equal(chooseSpendFactor(7, 10, true), 2);
assert.equal(chooseSpendFactor(9, 8, false), 8);
assert.equal(chooseSpendFactor(9, 6, false), 4);
assert.equal(chooseSpendFactor(9, 3, false), 1);
assert.equal(chooseSpendFactor(9, 40, true), 8);
assert.equal(chooseSpendFactor(9, 20, true), 4);
assert.equal(chooseSpendFactor(9, 19, true), 0);
assert.equal(shotCost(2), 2);
assert.equal(shotCost(2, true), 10);
assert.equal(secretHoleBalls(1400).holeBalls, SECRET_BALLS);
assert.equal(secretHoleBalls(1400).miniBalls, 0);

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
