// Each of the three reels independently samples the same five equally likely symbols.
export const SLOT_SYMBOLS = Object.freeze(['🍒', '🍋', '🔔', '⭐', '🍀']);
export const SLOT_DISPLAY = Object.freeze({ x: 350, y: 466, width: 252, height: 44 });
export function createSlotMachine({ random = Math.random, onEvent = () => {} } = {}) {
  const state = { entries: 0, goal: 50, progress: 0, queued: 0, spins: 0, completed: 0,
    reels: [0, 1, 2], target: [0, 1, 2], stopped: [true, true, true], spinning: false,
    startedAt: 0, stopAt: [0, 0, 0], nextSpinAt: 0, result: 1,
    pairUntil: 0, tripleUntil: 0, multiplier: 1, activeUntil: 0 };
  function refreshBonus(clock) {
    if (clock + 1e-6 >= state.pairUntil) state.pairUntil = 0;
    if (clock + 1e-6 >= state.tripleUntil) state.tripleUntil = 0;
    state.multiplier = state.tripleUntil ? 5 : state.pairUntil ? 2 : 1;
    state.activeUntil = state.tripleUntil || state.pairUntil;
  }
  function start(clock) {
    if (!state.queued || state.spinning || clock + 1e-6 < state.nextSpinAt) return;
    state.queued--; state.spins++; state.spinning = true; state.startedAt = clock;
    state.target = Array.from({ length: 3 }, () => Math.min(4, Math.max(0, Math.floor(random() * 5))));
    state.stopped = [false, false, false]; state.stopAt = [900, 1300, 1700].map(delay => clock + delay);
    onEvent({ kind: 'slot-start', at: clock, spin: state.spins });
  }
  function advance(clock) {
    refreshBonus(clock);
    if (state.spinning) {
      for (let i = 0; i < 3; i++) if (!state.stopped[i] && clock + 1e-6 >= state.stopAt[i]) {
        state.reels[i] = state.target[i]; state.stopped[i] = true;
        onEvent({ kind: 'slot-reel', reel: i, at: state.stopAt[i] });
      }
      if (state.stopped.every(Boolean)) {
        const at = state.stopAt[2], distinct = new Set(state.reels).size;
        state.spinning = false; state.completed++; state.result = distinct === 1 ? 5 : distinct === 2 ? 2 : 1;
        if (state.result === 5) state.tripleUntil = at + 60000;
        if (state.result === 2) state.pairUntil = at + 180000;
        state.nextSpinAt = at + 700;
        refreshBonus(clock);
        onEvent({ kind: 'slot-result', at, reels: [...state.reels], multiplier: state.result,
          duration: state.result === 5 ? 60000 : state.result === 2 ? 180000 : 0 });
      }
    }
    start(clock);
  }
  return {
    state,
    recordEntry(clock) {
      state.entries++; state.progress = state.entries % state.goal;
      if (!state.progress) state.queued++;
      start(clock);
    },
    advance,
  };
}
export function slotBonusLabel(state, clock) {
  if (state.multiplier === 1) return '';
  const seconds = Math.max(0, Math.ceil((state.activeUntil - clock) / 1000));
  return `进洞 ×${state.multiplier} · ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
