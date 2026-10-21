// One round spends balls as lives. Every tunable number in that economy lives here.
import { LEADERBOARD_LIMIT, LEADERBOARD_QUALIFY_SCORE, topEntries } from './leaderboard.js';

export const START_BALLS = 150;
export const LOW_BALLS = 10;
export const LAUNCH_COST = 1;
export const BURST_COST = 5;
// Paid shots spend this many balls per physical ball. ×2 unlocks at 7 slots.
// ×4 and ×8 unlock at 9 slots. The button cycles the unlocked steps.
export const BALL_COST_MULTIPLIER = 2;
export const BALL_COST_LADDER = Object.freeze([1, 2, 4, 8]);

export function ballCostOptions(slots) {
  if (slots >= 9) return BALL_COST_LADDER;
  if (slots >= 7) return BALL_COST_LADDER.slice(0, 2);
  return [1];
}

export function clampBallCost(factor, slots) {
  const options = ballCostOptions(slots);
  const value = Math.floor(Number(factor));
  if (options.includes(value)) return value;
  let best = options[0];
  for (const option of options) if (Number.isFinite(value) && option <= value) best = option;
  return best;
}

export function nextBallCost(current, slots) {
  const options = ballCostOptions(slots);
  const value = clampBallCost(current, slots);
  return options[(options.indexOf(value) + 1) % options.length];
}

export function ballValue(raw) {
  const value = Math.floor(Number(raw));
  if (!Number.isSafeInteger(value) || value < 1) return 1;
  return value;
}

export function shotCost(valueFactor = 1, burst = false) {
  return (burst ? BURST_COST : LAUNCH_COST) * ballValue(valueFactor);
}

// Sim policy. 7 slots stays on ×2. 9 slots prefers ×8 when that shot can be
// paid, otherwise ×4. A single shot that cannot pay the preferred tier falls
// back to ×1. An unaffordable burst does not fire.
export function chooseSpendFactor(slots, spendable, burst = false) {
  const hand = Math.max(0, Math.floor(Number(spendable) || 0));
  const preferred = slots >= 9 ? [8, 4] : slots >= 7 ? [2] : [1];
  for (const factor of preferred) {
    if (hand >= shotCost(factor, burst)) return factor;
  }
  if (burst) return 0;
  return hand >= shotCost(1, false) ? 1 : 0;
}

// Points scored on the table (slots and the secret hole's 500). The paid
// multiplier stacks with the star factor and the reel multiplier.
export function tablePoints(basePoints, scoreFactor = 1, valueFactor = 1, globalMultiplier = 1) {
  return basePoints * scoreFactor * ballValue(valueFactor) * globalMultiplier;
}

// Ball gifts follow the ball that triggered them. Reel icons pay +1 / +10 / +100
// before that multiplier. The secret hole pays SECRET_BALLS times the opening
// ball's ×N. The mini-game still adds happiness points only, so miniBalls stays 0.
// A numeric argument is a legacy score and does not scale the package.
// Pass { valueFactor } for the ball that opened the visit.
export function secretHoleBalls(scoreOrOptions) {
  const factor = scoreOrOptions && typeof scoreOrOptions === 'object'
    ? ballValue(scoreOrOptions.valueFactor)
    : 1;
  return { holeBalls: SECRET_BALLS * factor, miniBalls: 0 };
}

// Live balls at or above this count lock the player's launch until the board
// drains below half of it. Gift and burst balls are not refused.
export const BOARD_CROWD_LOCK = 100;

export function boardCrowdUnlock() {
  return Math.floor(BOARD_CROWD_LOCK / 2);
}

export function crowdLaunchLocked(locked, ballCount) {
  const n = Math.max(0, Math.floor(Number(ballCount) || 0));
  if (locked) return n >= boardCrowdUnlock();
  return n >= BOARD_CROWD_LOCK;
}

// Center-drum progress and drum/jar gift counts use the triggering ball's ×N.
export function triggeringGiftScale(ball) {
  return ballValue(ball?.valueFactor);
}

// Scoring slots pay happiness points only. They do not put balls back.
// Stars and a pair/triple on the reels change those points only.
// Ball icons on the reels pay balls separately (see slot-machine.js).
export const SLOT_MACHINE_BALLS = 0;
export const LUCKY_BALLS = 0;
// The whole secret-hole visit. The mini-game pays points only.
export const SECRET_BALLS = 20;

// Perfect 32-pair clear (10×(1+2+…+33) = 5600). The balance sim samples
// mini-game happiness from this cap. Mini-games no longer pay balls.
export const MINI_BALLS_FULL_SCORE = 5600;

// Drums. The left drum and the clock already launch real balls; those balls
// are their ball reward. Enlarge only grows the center and adds nothing.
export const DRUM_RANDOM_BALLS = 0;
export const DRUM_ENLARGE_BALLS = 0;
export const DRUM_CLOCK_BALLS = 0;

// Bottom geometry. The slot row is TABLE.left … TABLE.right (616px).
// The mouth budget starts from POCKET_WIDTH pockets and never begins below
// DRAIN_MIN_OPENING. DRAIN_WIDTH_SCALE then halves every mouth and returns
// that width to the scoring slots, so the row still fills the span.
export const SLOT_ROW_LEFT = 39;
export const SLOT_ROW_RIGHT = 655;
export const POCKET_WIDTH = 36;
export const DRAIN_MIN_OPENING = 28;
export const DRAIN_WIDTH_SCALE = 0.5;
export const DRAIN_WALL = 6;
export const DRAIN_FLOOR = 894;

export function slotFrame(count) {
  if (count !== 5 && count !== 7 && count !== 9) throw new RangeError('Slots must be 5, 7, or 9');
  const span = SLOT_ROW_RIGHT - SLOT_ROW_LEFT;
  const mouths = count + 1;
  let opening = (span - count * POCKET_WIDTH) / mouths;
  if (opening < DRAIN_MIN_OPENING) opening = DRAIN_MIN_OPENING;
  opening *= DRAIN_WIDTH_SCALE;
  const pocket = (span - mouths * opening) / count;
  const regions = [];
  let x = SLOT_ROW_LEFT;
  for (let column = 0; column < count; column++) {
    const drainEnd = x + opening;
    regions.push({ kind: 'drain', index: column, x0: x, x1: drainEnd });
    const pocketEnd = drainEnd + pocket;
    regions.push({ kind: 'slot', column, x0: drainEnd, x1: pocketEnd });
    x = pocketEnd;
  }
  regions.push({ kind: 'drain', index: count, x0: x, x1: SLOT_ROW_RIGHT });
  return { count, opening, pocket, mouths, regions };
}

export function classifyBottom(x, count) {
  if (x < SLOT_ROW_LEFT || x >= SLOT_ROW_RIGHT) return null;
  const regions = slotFrame(count).regions;
  for (const region of regions) if (x >= region.x0 && x < region.x1) return region;
  return regions[regions.length - 1];
}

export function pocketCenter(count, column) {
  const slot = slotFrame(count).regions.find(region => region.kind === 'slot' && region.column === column);
  if (!slot) throw new RangeError('column out of range');
  return (slot.x0 + slot.x1) / 2;
}

// Every one of these has to be clear. A ball still on the table, in the tank,
// waiting to drop, or tied to a secret visit keeps the round alive.
export function roundCanEnd({ balls = 0, onTable = 0, stored = 0, pendingDrops = 0, pendingLaunches = 0, secretPending = false, miniOpen = false } = {}) {
  return balls <= 0 && onTable <= 0 && stored <= 0 && pendingDrops <= 0 && pendingLaunches <= 0 && !secretPending && !miniOpen;
}

export function qualifiesForLeaderboard(score, rows) {
  const value = Math.floor(Number(score) || 0);
  if (value >= LEADERBOARD_QUALIFY_SCORE) return true;
  if (value <= 0) return false;
  const top = topEntries(rows);
  if (top.length < LEADERBOARD_LIMIT) return true;
  return value > top[LEADERBOARD_LIMIT - 1].score;
}

export function freshRound(best = 0) {
  return {
    score: 0,
    balls: START_BALLS,
    slots: 5,
    launches: 0,
    bestCombo: 0,
    bestSlot: 0,
    bestBefore: Number.isFinite(best) ? best : 0,
    over: false,
    nameDecided: false,
    ballCost: 1,
    doubleBall: false,
  };
}

function savedBallCost(saved, slots) {
  if (Number.isFinite(Number(saved.ballCost))) return clampBallCost(saved.ballCost, slots);
  if (saved.doubleBall === true) return clampBallCost(BALL_COST_MULTIPLIER, slots);
  return 1;
}

export function restoreRun(saved, best = 0) {
  const fresh = freshRound(best);
  if (!saved || typeof saved !== 'object') return fresh;
  const slots = saved.slots === 5 || saved.slots === 7 || saved.slots === 9 ? saved.slots : 5;
  const balls = Math.floor(Number(saved.balls));
  const ballCost = savedBallCost(saved, slots);
  return {
    score: Math.max(0, Math.floor(Number(saved.score) || 0)),
    balls: Number.isSafeInteger(balls) && balls >= 0 ? balls : START_BALLS,
    slots,
    launches: Math.max(0, Math.floor(Number(saved.launches) || 0)),
    bestCombo: Math.max(0, Math.floor(Number(saved.bestCombo) || 0)),
    bestSlot: Math.max(0, Math.floor(Number(saved.bestSlot) || 0)),
    bestBefore: Number.isFinite(Number(saved.bestBefore)) ? Number(saved.bestBefore) : fresh.bestBefore,
    over: saved.over === true,
    nameDecided: saved.nameDecided === true,
    ballCost,
    doubleBall: ballCost > 1,
  };
}
