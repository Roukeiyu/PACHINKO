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
  if (count === 9) {
    const widths = slots.map(slot => slot.x1 - slot.x0);
    const drainWidths = drains.map(drain => drain.x1 - drain.x0);
    const leakAfter = [1, 3, 4, 6];
    assert.equal(frame.opening, WIDE_DRAIN_OPENING);
    assert.equal(frame.mouths, 4);
    assert.equal(frame.apron, 0);
    assert.equal(drains.length, 4, '9 slots keep four leak mouths');
    assert.ok(Math.abs(frame.pocket - (TABLE.right - TABLE.left - 4 * WIDE_DRAIN_OPENING) / 9) < 1e-6);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1, `9 slot widths ${widths.map(width => width.toFixed(3)).join(', ')} stay within 1px`);
    assert.ok(Math.max(...drainWidths) - Math.min(...drainWidths) < 1, 'the four 9-slot leaks stay equal');
    drains.forEach((drain, index) => {
      assert.ok(Math.abs(drain.x1 - drain.x0 - WIDE_DRAIN_OPENING) < 0.6, `9-slot leak ${index} stays 32px`);
      assert.ok(Math.abs(drain.x0 - slots[leakAfter[index]].x1) < 1e-6, `leak ${index} follows slot ${leakAfter[index]}`);
      assert.ok(Math.abs(drain.x1 - slots[leakAfter[index] + 1].x0) < 1e-6);
    });
    for (const pair of [[0, 1], [2, 3], [5, 6], [7, 8]]) {
      assert.ok(Math.abs(slots[pair[0]].x1 - slots[pair[1]].x0) < 1e-6, `slots ${pair.join('|')} share a plain wall`);
    }
    assert.equal(frame.regions[0].column, 0);
    assert.equal(frame.regions.at(-1).column, count - 1);
    assert.equal(classifyBottom(347, 9).column, 4, 'the center leak pair still leaves the lucky slot in the middle');
  } else if (count === 7) {
    const widths = slots.map(slot => slot.x1 - slot.x0);
    assert.equal(frame.opening, WIDE_DRAIN_OPENING);
    assert.equal(frame.mouths, 4);
    assert.equal(frame.apron, 0);
    assert.ok(Math.abs(frame.pocket - (TABLE.right - TABLE.left - 4 * WIDE_DRAIN_OPENING) / 7) < 1e-6);
    assert.ok(frame.opening >= BALL_DIAMETER + 6, '7-slot inner drains are wider than a ball');
    assert.equal(drains.length, 4, '7 slots keep the four inner mouths');
    assert.equal(frame.regions[0].kind, 'slot');
    assert.equal(frame.regions[1].kind, 'slot', 'the left outer mouth is gone');
    assert.equal(frame.regions.at(-1).kind, 'slot');
    assert.equal(frame.regions.at(-2).kind, 'slot', 'the right outer mouth is gone');
    assert.equal(frame.regions[0].column, 0);
    assert.equal(frame.regions.at(-1).column, 6);
    assert.ok(Math.abs(frame.regions[0].x0 - TABLE.left) < 1e-6);
    assert.ok(Math.abs(frame.regions.at(-1).x1 - TABLE.right) < 1e-6);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1, `7 slot widths ${widths.map(width => width.toFixed(3)).join(', ')} stay within 1px`);
    assert.ok(Math.abs(slots[0].x1 - slots[1].x0) < 1e-6, 'the left end slot meets the next slot');
    assert.ok(Math.abs(slots[5].x1 - slots[6].x0) < 1e-6, 'the right end slot meets the previous slot');
    drains.forEach((drain, index) => {
      assert.ok(Math.abs(drain.x1 - drain.x0 - WIDE_DRAIN_OPENING) < 0.6, `inner mouth ${index} stays 32px`);
      assert.ok(Math.abs(drain.x0 - slots[index + 1].x1) < 1e-6);
      assert.ok(Math.abs(drain.x1 - slots[index + 2].x0) < 1e-6);
    });
    assert.equal(classifyBottom(slots[0].x1 - 16, 7).column, 0, 'the freed left mouth scores the end slot');
    assert.equal(classifyBottom(slots[6].x0 + 16, 7).column, 6, 'the freed right mouth scores the end slot');
  } else {
    const span = TABLE.right - TABLE.left;
    const legacyMouths = count + 1;
    const natural = (span - count * POCKET_WIDTH) / legacyMouths;
    const opening = Math.max(natural, DRAIN_MIN_OPENING) * DRAIN_WIDTH_SCALE;
    const pocket = (span - 4 * opening) / count;
    const widths = slots.map(slot => slot.x1 - slot.x0);
    const drainWidths = drains.map(drain => drain.x1 - drain.x0);
    assert.equal(frame.mouths, 4);
    assert.equal(frame.apron, 0);
    assert.ok(Math.abs(frame.opening - opening) < 1e-6, '5-slot inner mouths keep half of the old six-mouth budget');
    assert.ok(Math.abs(frame.pocket - pocket) < 1e-6, 'the freed wall mouths are shared by every scoring slot');
    assert.ok(frame.pocket > POCKET_WIDTH, '5 slots still receive the reclaimed drain width');
    assert.equal(drains.length, 4, '5 slots keep the four mouths between the pockets');
    assert.equal(frame.regions[0].kind, 'slot');
    assert.equal(frame.regions[1].kind, 'drain', 'the first striped mouth now sits between ×2 and ×3');
    assert.equal(frame.regions.at(-1).kind, 'slot');
    assert.equal(frame.regions.at(-2).kind, 'drain', 'the last striped mouth now sits between ×3 and ×2');
    assert.equal(frame.regions[0].column, 0);
    assert.equal(frame.regions.at(-1).column, 4);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1, `5 slot widths ${widths.map(width => width.toFixed(3)).join(', ')} stay within 1px`);
    assert.ok(Math.max(...drainWidths) - Math.min(...drainWidths) < 1, 'the four inner mouths stay equal');
    drains.forEach((drain, index) => {
      assert.ok(Math.abs(drain.x1 - drain.x0 - opening) < 1e-6, `inner mouth ${index} keeps the old width`);
      assert.ok(Math.abs(drain.x0 - slots[index].x1) < 1e-6);
      assert.ok(Math.abs(drain.x1 - slots[index + 1].x0) < 1e-6);
    });
    assert.equal(classifyBottom(TABLE.left + opening / 2, 5).kind, 'slot');
    assert.equal(classifyBottom(TABLE.left + opening / 2, 5).column, 0, 'the freed left mouth scores the end slot');
    assert.equal(classifyBottom(TABLE.right - opening / 2, 5).kind, 'slot');
    assert.equal(classifyBottom(TABLE.right - opening / 2, 5).column, 4, 'the freed right mouth scores the end slot');
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
for (const count of [5, 7, 9]) {
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
  if (count === 5) {
    for (const [column, x] of [[0, TABLE.left + frame.opening / 2], [4, TABLE.right - frame.opening / 2]]) {
      const game = drop(x);
      assert.equal(game.stats.timeouts, 0, `5-slot former outer mouth ${column} settles`);
      assert.equal(game.balls.length, 0);
      assert.equal(game.stats.drains, 0, `5-slot former outer mouth ${column} scores`);
      assert.equal(game.stats.scored, 1);
    }
  }
  if (count === 7) {
    const slots7 = frame.regions.filter(region => region.kind === 'slot');
    for (const [column, x] of [[0, slots7[0].x1 - 16], [6, slots7[6].x0 + 16]]) {
      const game = drop(x);
      assert.equal(game.stats.timeouts, 0, `7-slot former outer mouth ${column} settles`);
      assert.equal(game.balls.length, 0);
      assert.equal(game.stats.drains, 0, `7-slot former outer mouth ${column} scores`);
      assert.equal(game.stats.scored, 1);
    }
  }
  if (count === 9) {
    for (let column = 0; column < count; column++) {
      const game = drop(pocketCenter(count, column));
      assert.equal(game.balls.length, 0, `9-slot pocket ${column} must not hold a ball`);
      assert.equal(game.stats.timeouts, 0, `9-slot pocket ${column} settles`);
      assert.equal(game.stats.drains, 0);
      assert.equal(game.stats.scored, 1);
    }
    const slots9 = frame.regions.filter(region => region.kind === 'slot');
    for (const pair of [[0, 1], [2, 3], [5, 6], [7, 8]]) {
      for (const x of [slots9[pair[0]].x1 - 16, slots9[pair[1]].x0 + 16]) {
        const game = drop(x);
        assert.equal(game.stats.timeouts, 0, `9-slot beside wall ${pair.join('|')} settles`);
        assert.equal(game.balls.length, 0);
        assert.equal(game.stats.drains, 0, `9-slot beside wall ${pair.join('|')} scores`);
        assert.equal(game.stats.scored, 1);
      }
    }
  }
}
{
  const nine = createTable({ slots: 9, random: () => 0.2 });
  const frame = slotFrame(9);
  const nineSlots = frame.regions.filter(region => region.kind === 'slot');
  assert.equal(nine.dividers.length, 12, '9 slots keep one wall on each closed gap and two lips on each leak');
  const centers = nine.dividers.map(body => body.position.x).sort((a, b) => a - b);
  const lip = DRAIN_WALL;
  for (const pair of [[0, 1], [2, 3], [5, 6], [7, 8]]) {
    const edge = nineSlots[pair[0]].x1;
    assert.ok(centers.some(x => Math.abs(x - edge) < 0.51), `a plain wall sits between slots ${pair.join('|')}`);
  }
  for (const drain of frame.regions.filter(region => region.kind === 'drain')) {
    assert.equal(centers.some(x => x > drain.x0 + 1 && x < drain.x1 - 1), false, 'a 9-slot leak stays open');
    assert.ok(centers.some(x => Math.abs(x - (drain.x0 - lip / 2)) < 0.51), 'a lip sits inside the pocket left of a 9-slot leak');
    assert.ok(centers.some(x => Math.abs(x - (drain.x1 + lip / 2)) < 0.51), 'a lip sits inside the pocket right of a 9-slot leak');
  }
  const seven = createTable({ slots: 7, random: () => 0.2 });
  const sevenFrame = slotFrame(7);
  const sevenSlots = sevenFrame.regions.filter(region => region.kind === 'slot');
  assert.equal(seven.dividers.length, 10, '7 slots keep one wall on each closed end and two lips on each inner mouth');
  const sevenCenters = seven.dividers.map(body => body.position.x).sort((a, b) => a - b);
  assert.ok(Math.abs(sevenCenters[0] - sevenSlots[0].x1) < 0.51, 'the left end wall sits on the closed gap');
  assert.ok(Math.abs(sevenCenters.at(-1) - sevenSlots[5].x1) < 0.51, 'the right end wall sits on the closed gap');
  for (const drain of sevenFrame.regions.filter(region => region.kind === 'drain')) {
    assert.equal(sevenCenters.some(x => x > drain.x0 + 1 && x < drain.x1 - 1), false, 'an inner mouth stays open');
  }
  const five = createTable({ slots: 5, random: () => 0.2 });
  const fiveFrame = slotFrame(5);
  assert.equal(five.dividers.length, 8, '5 slots keep two lips on each of the four inner mouths');
  const fiveCenters = five.dividers.map(body => body.position.x).sort((a, b) => a - b);
  for (const drain of fiveFrame.regions.filter(region => region.kind === 'drain')) {
    assert.equal(fiveCenters.some(x => x > drain.x0 + 1 && x < drain.x1 - 1), false, 'an inner mouth stays open');
    assert.ok(fiveCenters.some(x => Math.abs(x - (drain.x0 - lip / 2)) < 0.51), 'a lip sits inside the pocket left of the mouth');
    assert.ok(fiveCenters.some(x => Math.abs(x - (drain.x1 + lip / 2)) < 0.51), 'a lip sits inside the pocket right of the mouth');
  }
  assert.ok(fiveCenters[0] > TABLE.left + lip, 'no lip is planted on the left cabinet wall');
  assert.ok(fiveCenters.at(-1) < TABLE.right - lip, 'no lip is planted on the right cabinet wall');
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
  if (drain) {
    const before = scored.length;
    const ball = game.launch(1);
    ball.entered = true;
    Matter.Body.setPosition(ball.body, { x: (drain.x0 + drain.x1) / 2, y: TABLE.scoreLine - 1 });
    Matter.Body.setVelocity(ball.body, { x: 0, y: 6 });
    game.step();
    assert.equal(scored.length, before, 'a drain mouth does not score');
    assert.equal(drained.length, 1);
    assert.equal(game.stats.drains, 1);
  } else {
    assert.equal(count, 9);
    assert.equal(game.stats.drains, 0, '9 slots have nothing to drain through');
  }
  const paused = game.launchBurst();
  assert.ok(paused);
  assert.equal(game.pendingLaunches, 4);
  assert.equal(game.setEmissionPaused(true), 4);
  assert.equal(game.pendingLaunches, 0);
}
assert.throws(() => slotFrame(4), RangeError);
assert.ok(POCKET_WIDTH >= DRAIN_WALL * 2 + 22);
console.log('PASS: ball economy constants, drain geometry, pocket scoring, and round end rules.');
