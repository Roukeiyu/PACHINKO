import { PAIR_ICON_LIST } from './pair-icons.js';

export { PAIR_ICON_LIST };
// Sixteen of the existing icons. Each suit is dealt four times, so any two of
// the same suit match and each suit clears as two pairs.
export const PAIR_SUIT_COUNT = 16;
export const PAIR_COPIES = 4;
export const PAIR_SUITS = Object.freeze(PAIR_ICON_LIST.slice(0, PAIR_SUIT_COUNT));
export const MINI_DURATION = 30000;
// 消消乐 ends at this many cleared blocks, or when its own timer runs out.
// The last clear that crosses the line only scores the blocks that fit.
// The board is already 10×10; this is the finish line, not the grid size.
export const BLOCK_CLEAR_TARGET = 100;
export const BLOCK_POINT = 10;
// Gravity locks input while tiles fall, so 100 clears get a longer clock than the other games.
export const BLOCK_DURATION = 45000;
// Another correct click inside this window continues the 消消乐 streak.
export const COMBO_WINDOW_MS = 500;
// First clear is combo 1 at 1×. Each further clear in the streak adds half a multiplier.
export const COMBO_MULTIPLIER_STEP = 0.5;
// Cascade loop guard only. It is not a combo cap.
export const MAX_BLOCK_CHAINS = 8;
// Opening boards never contain a connected region this large. A fresh tap
// therefore cannot reach the 100-block cap by itself.
export const BLOCK_GROUP_LIMIT = 12;
// Light hit shake, the same 1.5 step used for light reward shakes. Charge camera shake stays separate.
export const MINI_HIT_SHAKE = 1.5;
export const MINI_HIT_MS = 160;
// 8×8 is 16 suits × 4 cards. Any two of one suit match, so the board is still 32 pairs.
// Base 20 with the shared combo makes a perfect 32-streak worth 5600, plus the clear bonus.
export const PAIR_POINT = 20;
export const PAIR_TARGET = 32;
export const PAIR_DURATION = 30000;
export const PAIR_CLEAR_BONUS = 200;
export const MINI_GAMES = Object.freeze({
  pairs: { title: '对对碰', rule: `64 张牌排成 8×8，16 种图案，每种 4 张，同花色任意两张都能配对。配完全部 ${PAIR_TARGET} 对，或玩满 ${PAIR_DURATION / 1000} 秒，先到先结算。每对 ${PAIR_POINT} 分。连续配对会累加连击，点错则连击重置。${PAIR_DURATION / 1000} 秒内配完，额外 +${PAIR_CLEAR_BONUS}。只翻开一张，或翻错，都不算有效操作。整局没有配成一对，秘密洞不发小球。`, columns: 8, rows: 8 },
  blocks: { title: '消消乐', rule: `点击上下左右相连的同色方块，至少 3 块才能消除。每块 ${BLOCK_POINT} 分。只有自己点掉的块计入 ${BLOCK_CLEAR_TARGET} 块；掉落连锁照样加基础分，但不计入这 ${BLOCK_CLEAR_TARGET} 块，也不会因此结束。开局同色相连不超过 ${BLOCK_GROUP_LIMIT} 块。点掉的块累计到 ${BLOCK_CLEAR_TARGET}，或玩满 ${BLOCK_DURATION / 1000} 秒，先到先结算。一次点击超过剩余块数时，只把点掉的块算到 ${BLOCK_CLEAR_TARGET}。${COMBO_WINDOW_MS / 1000} 秒内再点出消除，连击 +1；超过 ${COMBO_WINDOW_MS / 1000} 秒，或点了消不掉的地方，连击归零。连击和倍率没有上限。掉落连锁不加连击。结束时按本局最高连击一次性乘算。点了消不掉的地方不算有效操作。整局没有一次消除，秘密洞不发小球。`, columns: 10, rows: 10 },
  moles: { title: '打地鼠', rule: '点击地鼠，白菜留着！每只 25 分，共 10 轮、40 只；每轮最多 3 秒，打完提前换轮。不是地鼠的格子都是白菜。连续打中会累加连击；打到白菜，或这一轮有地鼠漏掉，连击重置。只点白菜，或重复点已经打过的地鼠，都不算有效操作。整局没有打中，秘密洞不发小球。', columns: 4, rows: 4 },
});
export const BLOCK_COLORS = Object.freeze(['红','蓝','黄','绿']);
export const BLOCK_SYMBOLS = Object.freeze(['♥','●','✦','◆']);
export const comboMultiplier = combo => combo > 0 ? 1 + (combo - 1) * COMBO_MULTIPLIER_STEP : 1;
export const comboPoints = (base, combo) => Math.round(base * comboMultiplier(combo));
export const formatComboMultiplier = combo => {
  const value = comboMultiplier(combo);
  return Number.isInteger(value) ? `×${value}` : `×${value.toFixed(1)}`;
};
const integer = (random, low, high) => low + Math.min(high - low, Math.floor(random() * (high - low + 1)));
function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = integer(random, 0, i); [result[i],result[j]] = [result[j],result[i]]; }
  return result;
}
// Shown instead of the secret-hole ball grant when the round had no scoring action.
export const AFK_BALL_TEXT = '挂机未操作 · 无小球奖励';
// A scoring action is the only thing that counts as play: a finished pair, a
// clear of at least 3 blocks, or a hit on a mole that has not been hit yet.
// One card, a mismatch, a block tap under 3, a cabbage, or a repeat hit do not.
export function miniGameIdle(state) {
  if (!state) return true;
  const progress = state.kind === 'moles' ? state.hit : state.removed;
  return state.played !== true || state.score <= 0 || progress <= 0;
}
// The next game is uniform among the other two. An unknown previous uses the full pool.
export function randomMiniGame(random = Math.random, previous = null) {
  const kinds = Object.keys(MINI_GAMES);
  const pool = Object.hasOwn(MINI_GAMES, previous) ? kinds.filter(kind => kind !== previous) : kinds;
  return pool[integer(random, 0, pool.length - 1)];
}
export function connectedBlocks(board, index) {
  if (!board[index]) return [];
  const color = board[index].color, found = new Set([index]), queue = [index];
  while (queue.length) {
    const at = queue.pop(), x = at % 10, y = Math.floor(at / 10);
    for (const next of [x ? at - 1 : -1, x < 9 ? at + 1 : -1, y ? at - 10 : -1, y < 9 ? at + 10 : -1]) {
      if (next >= 0 && !found.has(next) && board[next]?.color === color) { found.add(next); queue.push(next); }
    }
  }
  return [...found];
}
export function createMiniGame(kind, { random = Math.random, now = 0 } = {}) {
  if (!MINI_GAMES[kind]) throw new RangeError('Unknown mini-game');
  let nextId = 0, fxId = 0;
  const tile = (extra = {}) => ({ id: nextId++, color: integer(random,0,3), fall: 0, spawned: false, ...extra });
  const roundMs = kind === 'pairs' ? PAIR_DURATION : kind === 'blocks' ? BLOCK_DURATION : MINI_DURATION;
  const state = { kind, status: 'playing', score: 0, played: false, combo: 0, multiplier: 1, bestCombo: 0, bestMultiplier: 1, baseScore: 0, lastClearAt: null, inputLocked: false, payoutSettled: false, clearBonus: 0, startedAt: now, deadline: now + roundMs, revision: 0, selected: null, removed: 0, hit: 0, wave: 0, waveUntil: 0, board: [], molePlan: [], message: '', fx: null, motion: [], motionSeq: 0 };
  function ensurePlayable() {
    if (state.board.some((_,i) => connectedBlocks(state.board,i).length >= 3)) return;
    const color = integer(random,0,3);
    for (let i=0;i<3;i++) state.board[i] = tile({ color });
    state.message = '新方块已补上，继续消除吧';
  }
  function settleBlocks() {
    if (kind !== 'blocks' || state.payoutSettled) return;
    state.baseScore = state.score;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.bestMultiplier = comboMultiplier(state.bestCombo);
    state.score = Math.round(state.baseScore * state.bestMultiplier);
    state.payoutSettled = true;
  }
  function finish(status) { if (state.status !== 'playing') return; settleBlocks(); state.status = status; state.selected = null; state.revision++; }
  function missMoles() { return state.board.some(cell => cell?.type === 'mole' && !cell.hit); }
  function nextWave(at) {
    if (missMoles()) { state.combo = 0; state.multiplier = 1; }
    if (state.wave === 10) { finish('complete'); return; }
    const count = state.molePlan[state.wave++];
    state.board = shuffle([...Array(count).fill('mole'), ...Array(16 - count).fill('cabbage')], random).map(type => ({ id: nextId++, type, hit: false }));
    state.waveUntil = at + 3000; state.revision++;
  }
  if (kind === 'pairs') state.board = shuffle(PAIR_SUITS.flatMap((icon, suit) => Array.from({ length: PAIR_COPIES }, () => ({ id: nextId++, pair: suit, icon: icon.id, name: icon.name }))), random);
  function largestGroup() {
    let best = 0; const seen = new Set();
    for (let i = 0; i < state.board.length; i++) {
      if (seen.has(i) || !state.board[i]) continue;
      const group = connectedBlocks(state.board, i);
      group.forEach(n => seen.add(n));
      if (group.length > best) best = group.length;
    }
    return best;
  }
  function breakOversized() {
    for (let guard = 0; guard < 80 && largestGroup() > BLOCK_GROUP_LIMIT; guard++) {
      const seen = new Set();
      let oversized = null;
      for (let i = 0; i < 100; i++) {
        if (seen.has(i)) continue;
        const group = connectedBlocks(state.board, i);
        group.forEach(n => seen.add(n));
        if (group.length > BLOCK_GROUP_LIMIT) { oversized = group; break; }
      }
      if (!oversized) break;
      const next = (state.board[oversized[0]].color + 1) % 4;
      for (let i = 0; i < oversized.length; i += 2) state.board[oversized[i]] = tile({ color: next });
    }
  }
  if (kind === 'blocks') {
    for (let attempt = 0; attempt < 40; attempt++) {
      state.board = Array.from({ length: 100 }, () => tile());
      if (largestGroup() <= BLOCK_GROUP_LIMIT) break;
    }
    breakOversized();
    ensurePlayable();
    breakOversized();
  }
  if (kind === 'moles') {
    let remaining=40;
    for (let round=0;round<10;round++) {
      const rest=9-round, count=integer(random,Math.max(2,remaining-rest*6),Math.min(6,remaining-rest*2));
      state.molePlan.push(count);remaining-=count;
    }
    nextWave(now);
  }
  function expireCombo(at) {
    if (state.inputLocked || kind !== 'blocks' || state.combo <= 0 || state.lastClearAt == null) return;
    if (at - state.lastClearAt > COMBO_WINDOW_MS) {
      state.combo = 0; state.multiplier = 1; state.revision++;
    }
  }
  // The fall animation blocks the next click. Hold the combo until the board accepts input again.
  function setInputLock(locked, at) {
    state.inputLocked = !!locked;
    if (!state.inputLocked && kind === 'blocks' && state.status === 'playing' && state.combo > 0) state.lastClearAt = at;
  }
  function tick(at) {
    if (state.status !== 'playing') return;
    expireCombo(at);
    if (kind === 'moles' && state.status === 'playing' && at >= state.waveUntil) nextWave(state.waveUntil);
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
  }
  function breakCombo(message) {
    state.combo = 0; state.multiplier = 1; state.lastClearAt = null; state.message = message;
    state.fx = { id: ++fxId, kind, broken: true, points: 0, combo: 0, multiplier: 1, cells: [], chains: 0 };
    state.revision++;
  }
  function collapse(removed) {
    const pops = [], moves = [], next = Array(100);
    for (let x=0;x<10;x++) {
      const kept=[];
      for (let y=0;y<10;y++) {
        const index=y*10+x;
        if (removed.has(index)) pops.push({ index, id: state.board[index].id, color: state.board[index].color });
        else kept.push({ ...state.board[index], oldY:y });
      }
      const added = 10-kept.length;
      for (let y=0;y<10;y++) {
        if (y<added) {
          const cell = tile({ fall:added, spawned:true });
          next[y*10+x] = cell;
          // fromY is above the board, so a same-distance drop keeps the new stack spaced one row apart.
          moves.push({ id:cell.id, color:cell.color, from:(y-added)*10+x, to:y*10+x, fromY:y-added, toY:y, distance:added, spawned:true });
        } else {
          const source = kept[y-added];
          const fall = y-source.oldY;
          next[y*10+x] = { id:source.id, color:source.color, fall, spawned:false };
          if (fall>0) moves.push({ id:source.id, color:source.color, from:source.oldY*10+x, to:y*10+x, fromY:source.oldY, toY:y, distance:fall, spawned:false });
        }
      }
    }
    state.board = next;
    state.motion.push({ pops, moves, board: next.map(cell => ({ id: cell.id, color: cell.color })) });
  }
  function chainGroup() {
    let best=null; const seen=new Set();
    for (let i=0;i<100;i++) {
      if (seen.has(i)) continue;
      const group=connectedBlocks(state.board,i);
      group.forEach(n=>seen.add(n));
      if (group.length<3) continue;
      const moved=group.some(n=>state.board[n].fall>0 && !state.board[n].spawned);
      const stayed=group.some(n=>state.board[n].fall<=0 && !state.board[n].spawned);
      const spawnedOnto=group.some(n=>state.board[n].spawned) && stayed;
      if ((moved && stayed) || spawnedOnto) if (!best || group.length>best.length) best=group;
    }
    return best;
  }
  function select(index, at) {
    tick(at);
    if (state.status !== 'playing' || !Number.isInteger(index) || !state.board[index]) return 0;
    let points = 0;
    if (kind === 'pairs') {
      if (state.selected === index) state.selected = null;
      else if (state.selected === null) state.selected = index;
      else if (state.board[state.selected].pair === state.board[index].pair) {
        const cells=[state.selected,index];
        const icons=[state.board[state.selected].icon, state.board[index].icon];
        state.board[state.selected] = null; state.board[index] = null; state.selected = null;
        state.removed += 2; state.combo += 1; state.multiplier = comboMultiplier(state.combo);
        points = comboPoints(PAIR_POINT, state.combo);
        state.score += points;
        state.message = `找到一对！+${points} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
        state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells, icons, chains:0 };
      } else { state.selected = index; breakCombo('翻错了，连击重置'); return 0; }
    }
    if (kind === 'blocks') {
      const group = connectedBlocks(state.board,index);
      if (group.length < 3) { breakCombo('至少 3 块同色相连才能消除'); return 0; }
      state.motion = [];
      const cleared = [];
      let counted = 0;
      const scoreCells = (cells, countTowardCap) => {
        const room = countTowardCap ? BLOCK_CLEAR_TARGET - state.removed : cells.length;
        const used = Math.max(0, Math.min(cells.length, room));
        if (countTowardCap) { state.removed += used; counted += used; }
        const gained = used * BLOCK_POINT;
        points += gained;
        state.score += gained;
        cleared.push(...cells);
        collapse(new Set(cells));
        return countTowardCap && state.removed >= BLOCK_CLEAR_TARGET;
      };
      let capped = scoreCells(group, true);
      const continuing = state.combo > 0 && state.lastClearAt != null && at - state.lastClearAt <= COMBO_WINDOW_MS;
      state.combo = continuing ? state.combo + 1 : 1;
      state.lastClearAt = at;
      state.multiplier = comboMultiplier(state.combo);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.bestMultiplier = comboMultiplier(state.bestCombo);
      let chains = 0;
      if (!capped) {
        for (let step = 0; step < MAX_BLOCK_CHAINS; step++) {
          const chain = chainGroup();
          if (!chain) break;
          chains += 1;
          scoreCells(chain, false);
        }
      }
      if (!capped) ensurePlayable();
      if (state.motion.length) state.motionSeq += 1;
      state.message = `消除 ${counted} 块！基础 +${points}${chains ? ` · 连锁 ${chains}` : ''}${capped ? ` · 已到 ${BLOCK_CLEAR_TARGET} 块` : ''} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
      state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells:cleared, chains };
    }
    if (kind === 'moles') {
      const cell = state.board[index];
      if (cell.type !== 'mole' || cell.hit) {
        if (cell.hit) { state.message = '这只已经打过了'; state.revision++; return 0; }
        breakCombo('白菜不计分，连击重置');
        return 0;
      }
      cell.hit = true; state.hit++; state.combo += 1; state.multiplier = comboMultiplier(state.combo);
      points = comboPoints(25, state.combo); state.score += points;
      state.message = `打中了！+${points} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
      state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells:[index], chains:0 };
    }
    if (points > 0) state.played = true;
    state.revision++;
    if (kind === 'blocks' && state.removed >= BLOCK_CLEAR_TARGET) finish('complete');
    if (kind === 'pairs' && state.removed >= PAIR_TARGET * 2) {
      state.clearBonus = PAIR_CLEAR_BONUS;
      state.score += PAIR_CLEAR_BONUS;
      state.message = `全部配对！额外 +${PAIR_CLEAR_BONUS}`;
      finish('complete');
    }
    if (kind === 'moles' && state.board.every(c=>c.type !== 'mole'||c.hit)) nextWave(at);
    return points;
  }
  return { state, tick, select, setInputLock, remaining: at => Math.max(0, Math.min(roundMs, state.deadline - at)), snapshot: () => structuredClone(state) };
}
