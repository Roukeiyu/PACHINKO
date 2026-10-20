// Five classic symbols stay equally likely with each other. The ball is rarer:
// 18 each and 10 for the ball, so one reel shows a ball about one time in ten.
export const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🔔', '⭐', '🍀']);
export const BALL_SYMBOL = 5;
export const CLASSIC_REEL_WEIGHT = 18;
export const BALL_REEL_WEIGHT = 10;
export const REEL_WEIGHTS = Object.freeze([
  CLASSIC_REEL_WEIGHT, CLASSIC_REEL_WEIGHT, CLASSIC_REEL_WEIGHT,
  CLASSIC_REEL_WEIGHT, CLASSIC_REEL_WEIGHT, BALL_REEL_WEIGHT,
]);
export const BALL_ONE = 10;
export const BALL_PAIR = 25;
export const BALL_JACKPOT = 100;
export const SINGLE_REEL_MS = 900;
export const SPIN_GAP_MS = 700;
// Three separate squares sit in the gap under the enlarged center drum and
// above the swinging bar. The progress bar is the only caption.
export const REEL_SIZE = 30;
export const REEL_GAP = 8;
export const REEL_STRIDE = REEL_SIZE + REEL_GAP;
export const REEL_TOP = 446;
export const REEL_Y = REEL_TOP + REEL_SIZE / 2;
export const PROGRESS_GAP = 4;
export const PROGRESS_HEIGHT = 6;
export const PROGRESS_TOP = REEL_TOP + REEL_SIZE + PROGRESS_GAP;
export const SLOT_DISPLAY = Object.freeze({
  x: 350,
  y: (REEL_TOP + PROGRESS_TOP + PROGRESS_HEIGHT) / 2,
  width: REEL_STRIDE * 2 + REEL_SIZE,
  height: PROGRESS_TOP + PROGRESS_HEIGHT - REEL_TOP,
});
export function reelBox(index) {
  return { x: SLOT_DISPLAY.x + (index - 1) * REEL_STRIDE, y: REEL_Y, size: REEL_SIZE };
}
const REEL_TOTAL = REEL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
const PAIR_MS = 180000;
const TRIPLE_MS = 60000;
export function ballPayout(count) {
  if (count >= 3) return BALL_JACKPOT;
  if (count === 2) return BALL_PAIR;
  if (count === 1) return BALL_ONE;
  return 0;
}
// Midpoint of a symbol's weight bucket, in [0, 1). Tests aim a reel with this.
export function reelUnit(index) {
  let start = 0;
  for (let i = 0; i < index; i++) start += REEL_WEIGHTS[i];
  return (start + REEL_WEIGHTS[index] / 2) / REEL_TOTAL;
}
export function sampleReel(random) {
  let roll = random() * REEL_TOTAL;
  for (let i = 0; i < REEL_WEIGHTS.length; i++) {
    if (roll < REEL_WEIGHTS[i]) return i;
    roll -= REEL_WEIGHTS[i];
  }
  return REEL_WEIGHTS.length - 1;
}
// One uniform draw in [0, 1) picks which of the three reels a LUCKY ball turns.
export function pickReel(unit) {
  return Math.min(2, Math.floor(unit * 3));
}
// A one-reel stop pays only the reward the reel that just landed is part of,
// and only when its symbol actually changed. Landing the same icon again pays
// nothing, even if the three reels are already a triple. Moving the unmatched
// reel does not pay the pair the other two already show. Balls pay only when
// the new icon is itself a ball; the amount is the ball count across all three.
export function luckyReelPay(before, after, reel) {
  const symbol = after[reel];
  if (before[reel] === symbol) return { multiplier: 1, balls: 0, ballPayout: 0, paid: false, duration: 0 };
  const matches = after.filter((value, index) => index !== reel && value === symbol).length;
  const multiplier = matches >= 2 ? 5 : matches === 1 ? 2 : 1;
  const balls = symbol === BALL_SYMBOL ? after.filter(value => value === BALL_SYMBOL).length : 0;
  const payout = ballPayout(balls);
  return {
    multiplier, balls, ballPayout: payout, paid: multiplier > 1 || payout > 0,
    duration: multiplier === 5 ? TRIPLE_MS : multiplier === 2 ? PAIR_MS : 0,
  };
}
export function createSlotMachine({ random = Math.random, onEvent = () => {} } = {}) {
  const fresh = () => ({ entries: 0, goal: 50, progress: 0, queued: 0, luckyQueued: 0, order: [],
    spins: 0, completed: 0, reels: [0, 1, 2], target: [0, 1, 2], before: [0, 1, 2],
    stopped: [true, true, true], spinning: false, spinMode: 'all', activeReel: -1,
    startedAt: 0, stopAt: [0, 0, 0], nextSpinAt: 0, result: 1,
    pairUntil: 0, tripleUntil: 0, multiplier: 1, activeUntil: 0 });
  const state = fresh();
  function refreshBonus(clock) {
    if (clock + 1e-6 >= state.pairUntil) state.pairUntil = 0;
    if (clock + 1e-6 >= state.tripleUntil) state.tripleUntil = 0;
    state.multiplier = state.tripleUntil ? 5 : state.pairUntil ? 2 : 1;
    state.activeUntil = state.tripleUntil || state.pairUntil;
  }
  function start(clock) {
    if (!state.order.length || state.spinning || clock + 1e-6 < state.nextSpinAt) return;
    const mode = state.order.shift();
    state.spins++; state.spinning = true; state.startedAt = clock; state.spinMode = mode;
    state.before = [...state.reels];
    if (mode === 'reel') {
      state.luckyQueued--;
      const reel = pickReel(random());
      const symbol = sampleReel(random);
      state.target = [...state.reels];
      state.target[reel] = symbol;
      state.stopped = [true, true, true];
      state.stopped[reel] = false;
      state.stopAt = [0, 0, 0];
      state.stopAt[reel] = clock + SINGLE_REEL_MS;
      state.activeReel = reel;
      onEvent({ kind: 'slot-start', at: clock, spin: state.spins, mode: 'reel', reel });
      return;
    }
    state.queued--;
    state.activeReel = -1;
    state.target = Array.from({ length: 3 }, () => sampleReel(random));
    state.stopped = [false, false, false];
    state.stopAt = [SINGLE_REEL_MS, 1300, 1700].map(delay => clock + delay);
    onEvent({ kind: 'slot-start', at: clock, spin: state.spins, mode: 'all' });
  }
  function advance(clock) {
    refreshBonus(clock);
    if (state.spinning && state.spinMode === 'reel') {
      const index = state.activeReel;
      if (index >= 0 && !state.stopped[index] && clock + 1e-6 >= state.stopAt[index]) {
        const at = state.stopAt[index];
        state.reels[index] = state.target[index];
        state.stopped[index] = true;
        onEvent({ kind: 'slot-reel', reel: index, at });
        const pay = luckyReelPay(state.before, state.reels, index);
        state.spinning = false; state.completed++; state.activeReel = -1; state.result = pay.multiplier;
        if (pay.multiplier === 5) state.tripleUntil = at + TRIPLE_MS;
        if (pay.multiplier === 2) state.pairUntil = at + PAIR_MS;
        state.nextSpinAt = at + SPIN_GAP_MS;
        refreshBonus(clock);
        onEvent({ kind: 'slot-result', mode: 'reel', paid: pay.paid, reel: index, at,
          reels: [...state.reels], multiplier: pay.multiplier, balls: pay.balls,
          ballPayout: pay.ballPayout, duration: pay.duration });
      }
    } else if (state.spinning) {
      for (let i = 0; i < 3; i++) if (!state.stopped[i] && clock + 1e-6 >= state.stopAt[i]) {
        state.reels[i] = state.target[i]; state.stopped[i] = true;
        onEvent({ kind: 'slot-reel', reel: i, at: state.stopAt[i] });
      }
      if (state.stopped.every(Boolean)) {
        const at = state.stopAt[2], distinct = new Set(state.reels).size;
        const balls = state.reels.filter(reel => reel === BALL_SYMBOL).length;
        state.spinning = false; state.completed++; state.result = distinct === 1 ? 5 : distinct === 2 ? 2 : 1;
        if (state.result === 5) state.tripleUntil = at + TRIPLE_MS;
        if (state.result === 2) state.pairUntil = at + PAIR_MS;
        state.nextSpinAt = at + SPIN_GAP_MS;
        refreshBonus(clock);
        onEvent({ kind: 'slot-result', mode: 'all', paid: state.result > 1 || ballPayout(balls) > 0,
          at, reels: [...state.reels], multiplier: state.result,
          balls, ballPayout: ballPayout(balls),
          duration: state.result === 5 ? TRIPLE_MS : state.result === 2 ? PAIR_MS : 0 });
      }
    }
    start(clock);
  }
  return {
    state,
    recordEntry(clock) {
      state.entries++; state.progress = state.entries % state.goal;
      if (!state.progress) { state.queued++; state.order.push('all'); }
      start(clock);
    },
    recordLucky(clock) {
      state.luckyQueued++;
      state.order.push('reel');
      start(clock);
    },
    advance,
    reset() { Object.assign(state, fresh()); },
  };
}
export function slotBonusLabel(state, clock) {
  if (state.multiplier === 1) return '';
  const seconds = Math.max(0, Math.ceil((state.activeUntil - clock) / 1000));
  return `进洞 ×${state.multiplier} · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
