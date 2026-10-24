import { PAIR_ICON_LIST } from './pair-icons.js';
import { createStarGame, STAR_BOMB_PENALTY } from './mini-stars.js';
import { createAimGame, AIM_BALLS } from './mini-aim.js';
import { createSlingGame, SLING_TARGET, SLING_POINT, SLING_WIN_BONUS } from './mini-sling.js';
export { SLING_DURATION, SLING_TARGET, SLING_TOTAL, SLING_POINT, SLING_WIN_BONUS, createSlingGame } from './mini-sling.js';
export { STAR_DURATION, STAR_POINT, STAR_BOMB_PENALTY, STAR_BOARD_W, STAR_BOARD_H, STAR_BASKET_W, STAR_BASKET_Y, STAR_KEY_SPEED, starCatchHalf, createStarGame } from './mini-stars.js';
export { AIM_DURATION, AIM_BALLS, AIM_NORMAL_POINT, AIM_BONUS_POINT, AIM_REST_X, AIM_REST_Y, AIM_BOARD_W, AIM_BOARD_H, AIM_MAX_PULL, createAimGame } from './mini-aim.js';

export { PAIR_ICON_LIST };
// Sixteen of the existing icons. Each suit is dealt four times, so any two of
// the same suit match and each suit clears as two pairs.
export const PAIR_SUIT_COUNT = 16;
export const PAIR_COPIES = 4;
export const PAIR_SUITS = Object.freeze(PAIR_ICON_LIST.slice(0, PAIR_SUIT_COUNT));
export const MINI_DURATION = 30000;
// 消消乐 ends at this many cleared blocks, or when its own timer runs out.
// Clicked blocks and later cascade waves both count. A wave that crosses the
// line scores only the blocks that still fit, then stops.
// The board is already 10×10; this is the finish line, not the grid size.
export const BLOCK_CLEAR_TARGET = 200;
// Five pair-set fruits. Cherry, orange, grapes, watermelon, strawberry.
export const BLOCK_ICON_IDS = Object.freeze(['cherry', 'orange', 'grapes', 'watermelon', 'strawberry']);
export const BLOCK_ICONS = Object.freeze(BLOCK_ICON_IDS.map(id => PAIR_ICON_LIST.find(icon => icon.id === id)));
export const BLOCK_TYPE_COUNT = BLOCK_ICONS.length;
// Base points per cleared block, click or cascade. The round pays that total
// once, times the best single-click chain. Combo 1 is 1× and each later wave
// in that same click adds 0.5×. A full 200 with a 9-wave chain (the click plus
// the 8-wave guard) is 200 × 11 × 5 = 11000.
export const BLOCK_POINT = 11;
// Gravity locks input while tiles fall. 45s still covers an engaged 200-clear.
export const BLOCK_DURATION = 45000;
// First clear is combo 1 at 1×. Each further clear in the streak adds half a multiplier.
export const COMBO_MULTIPLIER_STEP = 0.5;
// Cascade loop guard only. It is not a combo cap. One click is wave 1, so the
// longest chain this guard can record is 9.
export const MAX_BLOCK_CHAINS = 8;
// Opening boards never contain a connected region this large.
export const BLOCK_GROUP_LIMIT = 12;
// Light hit shake, the same 1.5 step used for light reward shakes. Charge camera shake stays separate.
export const MINI_HIT_SHAKE = 1.5;
export const MINI_HIT_MS = 160;
// 8×8 is 16 suits × 4 cards. Any two of one suit match, so the board is still 32 pairs.
// Base 40 with the shared combo makes a perfect 32-streak worth 11200, plus the 200 clear bonus.
export const PAIR_POINT = 40;
export const PAIR_TARGET = 32;
export const PAIR_DURATION = 30000;
export const PAIR_CLEAR_BONUS = 200;
// Each 打地鼠 batch lasts this long, or until every mole in it is hit.
// The board then flips before the next batch is dealt. The round clock pauses
// for the flip, so the animation does not shorten the 30 seconds or the next 3.
export const MOLE_WAVE_MS = 3000;
export const MOLE_FLIP_MS = 320;
export const MINI_GAMES = Object.freeze({
  pairs: { title: '对对碰', rule: `64 张牌排成 8×8，16 种图案，每种 4 张，同花色任意两张都能配对。配完全部 ${PAIR_TARGET} 对，或玩满 ${PAIR_DURATION / 1000} 秒，先到先结算。每对 ${PAIR_POINT} 分。连续配对会累加连击，点错则连击重置。${PAIR_DURATION / 1000} 秒内配完，额外 +${PAIR_CLEAR_BONUS}。只翻开一张，或翻错，都不算有效操作。整局没有配成一对，秘密洞不发小球。`, columns: 8, rows: 8 },
  blocks: { title: '消消乐', rule: `上下左右相连的同色图案，至少 3 个才能消除。五种水果。每块 ${BLOCK_POINT} 分，点掉和连锁都计入 ${BLOCK_CLEAR_TARGET} 个。开局同色不超过 ${BLOCK_GROUP_LIMIT} 个。满 ${BLOCK_CLEAR_TARGET} 个或 ${BLOCK_DURATION / 1000} 秒就结算；多出的只算到 ${BLOCK_CLEAR_TARGET}。连击是这一次点击的波数：点掉为 1，每波连锁 +1，下次点击从 1 重计。结束时按最高连击乘算。没有可消的会洗牌。点不满 3 个不算有效操作。整局没有消除，秘密洞不发小球。`, columns: 10, rows: 10 },
  moles: { title: '打地鼠', rule: '点击地鼠，白菜留着！每只 25 分，共 10 轮、40 只；每轮最多 3 秒，打完或到点后洞口一起翻面，翻完才换轮。不是地鼠的格子都是白菜。连续打中会累加连击；打到白菜，或这一轮有地鼠漏掉，连击重置。只点白菜、重复点已经打过的地鼠，或翻面时点击，都不算有效操作。整局没有打中，秘密洞不发小球。', columns: 4, rows: 4 },
  stars: { title: '接星星', rule: `左右拖动篮子，或用方向键和 A D。接住星星得分，连续接住会连击。漏掉星星或接到炸弹，连击清零；炸弹再扣 ${STAR_BOMB_PENALTY} 分。30 秒，下落会变快。只接炸弹、或一个都没接住，不算有效操作。整局没有接住星星，秘密洞不发小球。`, columns: 0, rows: 0 },
  aim: { title: '弹珠瞄准', rule: `按住弹珠向后拉，松手射出。共 ${AIM_BALLS} 颗。打中滑动靶得分，小靶分更高，连续命中会连击。空球打断连击。打完 ${AIM_BALLS} 颗或 30 秒结束。只射出没打中，不算有效操作。整局没有打中，秘密洞不发小球。`, columns: 0, rows: 0 },
  sling: { title: '弹弓拆拆乐', rule: `按住左边弹珠向左下拉，沿虚线瞄准，松手拆塔。30 秒内击落 ${SLING_TARGET} 块就过关；每块 ${SLING_POINT} 分，过关再加 ${SLING_WIN_BONUS} 分。弹珠不限量，每 0.65 秒补一颗。整块落到台座下方才计分；塔内下移、滑动或晃动都不算。先拆支撑，再换角度补刀。达标立即结算；时间到也保留已得分。只发射没击落，不算有效操作，秘密洞不发小球。`, columns: 0, rows: 0 },
});
export const BLOCK_COLORS = Object.freeze(BLOCK_ICONS.map(icon => icon.name));
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
  // Catching a star, or hitting a target, is the only play that counts.
  // A bomb, a miss, or a shot that hits nothing leaves the round idle.
  if (state.kind === 'stars' || state.kind === 'aim') return state.played !== true || state.hit <= 0;
  const progress = state.kind === 'moles' ? state.hit : state.removed;
  return state.played !== true || state.score <= 0 || progress <= 0;
}
// The next game is uniform among the other games. An unknown previous uses the full pool.
export function randomMiniGame(random = Math.random, previous = null) {
  const kinds = Object.keys(MINI_GAMES);
  const pool = Object.hasOwn(MINI_GAMES, previous) ? kinds.filter(kind => kind !== previous) : kinds;
  return pool[integer(random, 0, pool.length - 1)];
}
// The card shown before a round exists. The rule text moves here; the clock starts only after confirm.
export function miniIntro(kind, { source = 'secret', ballGrant = 20, doubled = false } = {}) {
  if (!MINI_GAMES[kind]) throw new RangeError('Unknown mini-game');
  const time = kind === 'blocks' ? `${BLOCK_DURATION / 1000} 秒` : kind === 'moles' ? `${MINI_DURATION / 1000} 秒，每轮最多 3 秒` : kind === 'aim' ? '30 秒，或 5 颗弹珠' : `${PAIR_DURATION / 1000} 秒`;
  const goal = kind === 'sling' ? `击落 ${SLING_TARGET} 块过关，最多 30 秒` : kind === 'pairs' ? `配完 ${PAIR_TARGET} 对，或时间到` : kind === 'blocks' ? `点掉 ${BLOCK_CLEAR_TARGET} 块，或时间到` : kind === 'stars' ? '接住星星，躲开炸弹' : kind === 'aim' ? '打中滑动靶，或时间到' : '10 轮打完 40 只，或时间到';
  const grant = Math.max(0, Math.floor(Number(ballGrant)) || 0);
  const reward = source === 'gm'
    ? '试玩只记快乐积分。挂机未操作不发小球'
    : `本局得分计入快乐积分${doubled ? '，双球再 ×2' : ''}。有效操作另得 ${grant} 颗小球。挂机未操作，无小球奖励`;
  return { title: MINI_GAMES[kind].title, rule: MINI_GAMES[kind].rule, time, goal, reward };
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
  if (kind === 'stars') return createStarGame({ random, now });
  if (kind === 'aim') return createAimGame({ now });
  if (kind === 'sling') return createSlingGame({ now });
  if (!MINI_GAMES[kind]) throw new RangeError('Unknown mini-game');
  let nextId = 0, fxId = 0;
  const tile = (extra = {}) => ({ id: nextId++, color: integer(random, 0, BLOCK_TYPE_COUNT - 1), fall: 0, spawned: false, ...extra });
  const roundMs = kind === 'pairs' ? PAIR_DURATION : kind === 'blocks' ? BLOCK_DURATION : MINI_DURATION;
  const state = { kind, status: 'playing', score: 0, played: false, combo: 0, multiplier: 1, bestCombo: 0, bestMultiplier: 1, baseScore: 0, lastClearAt: null, inputLocked: false, payoutSettled: false, clearBonus: 0, startedAt: now, deadline: now + roundMs, revision: 0, selected: null, removed: 0, hit: 0, wave: 0, waveUntil: 0, flipFrom: 0, flipUntil: 0, board: [], molePlan: [], message: '', fx: null, motion: [], motionSeq: 0 };
  // A stuck board is shuffled back into a legal move. The last resort paints
  // three neighbors the same color so a round can never sit with nothing to tap.
  function reshuffle() {
    if (largestGroup() >= 3) return false;
    const colors = state.board.map(cell => cell.color);
    for (let guard = 0; guard < 40 && largestGroup() < 3; guard++) {
      const order = shuffle(colors, random);
      state.board.forEach((cell, index) => {
        cell.color = order[index];
        cell.fall = 0;
        cell.spawned = false;
      });
    }
    if (largestGroup() < 3) {
      const color = state.board[0].color;
      state.board[1].color = color;
      state.board[2].color = color;
    }
    return true;
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
  // Deal the next batch. The opening deal calls this directly. Later deals run
  // only after the flip that armFlip scheduled has reached flipUntil.
  function spawnWave(at) {
    if (missMoles()) { state.combo = 0; state.multiplier = 1; }
    state.flipFrom = 0; state.flipUntil = 0;
    if (state.wave === 10) { finish('complete'); return; }
    const count = state.molePlan[state.wave++];
    state.board = shuffle([...Array(count).fill('mole'), ...Array(16 - count).fill('cabbage')], random).map(type => ({ id: nextId++, type, hit: false }));
    state.waveUntil = at + MOLE_WAVE_MS; state.revision++;
  }
  function armFlip(at) {
    if (state.flipUntil) return;
    state.flipFrom = at;
    state.flipUntil = at + MOLE_FLIP_MS;
    state.deadline += MOLE_FLIP_MS;
    state.message = '洞口翻面，下一轮马上出来';
    state.revision++;
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
      const next = (state.board[oversized[0]].color + 1) % BLOCK_TYPE_COUNT;
      for (let i = 0; i < oversized.length; i += 2) state.board[oversized[i]] = tile({ color: next });
    }
  }
  if (kind === 'blocks') {
    for (let attempt = 0; attempt < 40; attempt++) {
      state.board = Array.from({ length: 100 }, () => tile());
      if (largestGroup() <= BLOCK_GROUP_LIMIT) break;
    }
    breakOversized();
    reshuffle();
    breakOversized();
    if (largestGroup() < 3) {
      const color = state.board[0].color;
      state.board[1].color = color;
      state.board[2].color = color;
    }
  }
  if (kind === 'moles') {
    let remaining=40;
    for (let round=0;round<10;round++) {
      const rest=9-round, count=integer(random,Math.max(2,remaining-rest*6),Math.min(6,remaining-rest*2));
      state.molePlan.push(count);remaining-=count;
    }
    spawnWave(now);
  }
  function expireCombo() {
    // The old 500ms window is gone. A block combo is the wave count of one click,
    // so the clock must not clear it while tiles are falling or afterwards.
  }
  // The fall animation blocks the next click. The lock still rejects input until the drop finishes.
  function setInputLock(locked, at) {
    state.inputLocked = !!locked;
    if (!state.inputLocked && kind === 'blocks' && state.status === 'playing' && state.combo > 0) state.lastClearAt = at;
  }
  function tick(at) {
    if (state.status !== 'playing') return;
    expireCombo(at);
    if (kind === 'moles' && state.status === 'playing') {
      if (state.flipUntil) {
        if (at >= state.flipUntil) spawnWave(state.flipUntil);
      } else if (at >= state.deadline && state.wave < 10) {
        finish('timeout');
      } else if (at >= state.waveUntil) {
        armFlip(state.waveUntil);
        if (at >= state.flipUntil) spawnWave(state.flipUntil);
      }
    }
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
  // Any connected 3+ after a fall is a cascade, including a group made only of
  // tiles that fell together or only of tiles that just spawned.
  function chainGroup() {
    let best = null;
    const seen = new Set();
    for (let i = 0; i < state.board.length; i++) {
      if (seen.has(i) || !state.board[i]) continue;
      const group = connectedBlocks(state.board, i);
      group.forEach(n => seen.add(n));
      if (group.length >= 3 && (!best || group.length > best.length)) best = group;
    }
    return best;
  }
  function select(index, at) {
    tick(at);
    if (state.status !== 'playing' || !Number.isInteger(index) || !state.board[index]) return 0;
    // A flip is a reset, not a swing. Ignore it so it cannot miss, score, or count as play.
    if (kind === 'moles' && state.flipUntil) return 0;
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
      if (largestGroup() < 3) {
        reshuffle();
        state.message = '没有可以消除的图案，已经重新洗牌';
        state.revision++;
        return 0;
      }
      const group = connectedBlocks(state.board,index);
      if (group.length < 3) { breakCombo('至少 3 块同色相连才能消除'); return 0; }
      state.motion = [];
      const cleared = [];
      let counted = 0;
      const scoreCells = cells => {
        const room = BLOCK_CLEAR_TARGET - state.removed;
        const used = Math.max(0, Math.min(cells.length, room));
        state.removed += used;
        counted += used;
        const gained = used * BLOCK_POINT;
        points += gained;
        state.score += gained;
        cleared.push(...cells);
        collapse(new Set(cells));
        return state.removed >= BLOCK_CLEAR_TARGET;
      };
      // This click starts its own chain. Wave 1 is the tap; each cascade is another wave.
      state.combo = 1;
      state.lastClearAt = at;
      state.multiplier = comboMultiplier(state.combo);
      let capped = scoreCells(group);
      let chains = 0;
      if (!capped) {
        for (let step = 0; step < MAX_BLOCK_CHAINS; step++) {
          const chain = chainGroup();
          if (!chain) break;
          chains += 1;
          state.combo += 1;
          state.multiplier = comboMultiplier(state.combo);
          capped = scoreCells(chain);
          if (capped) break;
        }
      }
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.bestMultiplier = comboMultiplier(state.bestCombo);
      const shuffled = !capped && reshuffle();
      if (state.motion.length) state.motionSeq += 1;
      state.message = `消除 ${counted} 块！基础 +${points}${chains ? ` · 连锁 ${chains}` : ''}${capped ? ` · 已到 ${BLOCK_CLEAR_TARGET} 块` : ''} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}${shuffled ? ' · 已重新洗牌' : ''}`;
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
    if (kind === 'moles' && !state.flipUntil && state.board.every(c=>c.type !== 'mole'||c.hit)) armFlip(at);
    return points;
  }
  return { state, tick, select, setInputLock, remaining: at => Math.max(0, Math.min(roundMs, state.deadline - at)), snapshot: () => structuredClone(state) };
}
