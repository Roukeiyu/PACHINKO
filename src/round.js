// One round spends balls as lives. Every tunable number in that economy lives here.
import { LEADERBOARD_LIMIT, LEADERBOARD_QUALIFY_SCORE, topEntries } from './leaderboard.js';

export const START_BALLS = 100;
export const LOW_BALLS = 10;
export const LAUNCH_COST = 1;
export const BURST_COST = 5;

// Scoring slots pay happiness points only. They do not put balls back.
// Stars and a pair/triple on the reels change those points only.
// Ball icons on the reels pay balls separately (see slot-machine.js).
export const SLOT_MACHINE_BALLS = 0;
export const LUCKY_BALLS = 0;
// One payment when a secret-hole visit finishes, after its mini-game.
export const SECRET_BALLS = 10;

export const MINI_BALLS_MIN = 5;
export const MINI_BALLS_MAX = 30;
// Top of the 5–30 curve: a perfect 32-pair clear (10×(1+2+…+33) = 5600).
// A clean full board reaches 30 balls; shorter clears stay lower on the same line.
export const MINI_BALLS_FULL_SCORE = 5600;

// Drums. The left drum and the clock already launch real balls; those balls
// are their ball reward. Enlarge launches nothing, so it pays stock directly.
export const DRUM_RANDOM_BALLS = 0;
export const DRUM_ENLARGE_BALLS = 4;
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

export function miniGameBalls(score) {
  const value = Math.max(0, Number(score) || 0);
  const t = Math.min(1, value / MINI_BALLS_FULL_SCORE);
  return Math.round(MINI_BALLS_MIN + (MINI_BALLS_MAX - MINI_BALLS_MIN) * t);
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
  };
}

export function restoreRun(saved, best = 0) {
  const fresh = freshRound(best);
  if (!saved || typeof saved !== 'object') return fresh;
  const slots = saved.slots === 5 || saved.slots === 7 || saved.slots === 9 ? saved.slots : 5;
  const balls = Math.floor(Number(saved.balls));
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
  };
}
