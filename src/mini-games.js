export const MINI_DURATION = 30000;
// Passing line for 消消乐. Reaching it ends the round early; the score is not clamped.
export const BLOCK_TARGET = 1000;
// First clear is combo 1 at 1×. Each further clear in the streak adds half a multiplier.
export const COMBO_MULTIPLIER_STEP = 0.5;
export const MAX_BLOCK_CHAINS = 8;
// Light hit shake, the same 1.5 step used for light reward shakes. Charge camera shake stays separate.
export const MINI_HIT_SHAKE = 1.5;
export const MINI_HIT_MS = 160;
export const MINI_GAMES = Object.freeze({
  pairs: { title: '对对碰', rule: '找出相同图案，选中一对就会消失。每对 50 分，全部找完提前结束。连续配对会累加连击，翻错则连击重置。', columns: 8, rows: 5 },
  blocks: { title: '消消乐', rule: `点击上下左右相连的同色方块，至少 3 块才能消除。每块 10 分，达到 ${BLOCK_TARGET} 分提前结束，得分可以更高。连续消除会累加连击；点不掉或断连会重置。掉落后新拼出的同色连接也算连击。`, columns: 10, rows: 10 },
  moles: { title: '打地鼠', rule: '点击地鼠，白菜留着！每只 25 分，共 10 轮、40 只；每轮最多 3 秒，打完提前换轮。连续打中会累加连击；打到白菜、空洞，或这一轮有地鼠漏掉，连击重置。', columns: 4, rows: 4 },
});
export const PAIR_ICONS = Object.freeze(['🍒','🍊','🍇','🍍','🍓','🍋','🍉','🍎','🍐','🍑','🥝','🥭','🫐','🍈','🥥','🍌','🥕','🌽','🥑','🍅']);
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
export const randomMiniGame = (random = Math.random) => Object.keys(MINI_GAMES)[integer(random,0,2)];
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
  const state = { kind, status: 'playing', score: 0, combo: 0, multiplier: 1, startedAt: now, deadline: now + MINI_DURATION, revision: 0, selected: null, removed: 0, hit: 0, wave: 0, waveUntil: 0, board: [], molePlan: [], message: '', fx: null };
  function ensurePlayable() {
    if (state.board.some((_,i) => connectedBlocks(state.board,i).length >= 3)) return;
    const color = integer(random,0,3);
    for (let i=0;i<3;i++) state.board[i] = tile({ color });
    state.message = '新方块已补上，继续消除吧';
  }
  function finish(status) { if (state.status !== 'playing') return; state.status = status; state.selected = null; state.revision++; }
  function missMoles() { return state.board.some(cell => cell?.type === 'mole' && !cell.hit); }
  function nextWave(at) {
    if (missMoles()) { state.combo = 0; state.multiplier = 1; }
    if (state.wave === 10) { finish('complete'); return; }
    const count = state.molePlan[state.wave++];
    const cabbage = integer(random,2,Math.min(6,16-count));
    state.board = shuffle([...Array(count).fill('mole'),...Array(cabbage).fill('cabbage'),...Array(16-count-cabbage).fill('empty')],random).map(type=>({ id:nextId++,type,hit:false }));
    state.waveUntil = at + 3000; state.revision++;
  }
  if (kind === 'pairs') state.board = shuffle(PAIR_ICONS.flatMap((icon,pair)=>[{id:nextId++,pair,icon},{id:nextId++,pair,icon}]),random);
  if (kind === 'blocks') { state.board = Array.from({length:100},()=>tile()); ensurePlayable(); }
  if (kind === 'moles') {
    let remaining=40;
    for (let round=0;round<10;round++) {
      const rest=9-round, count=integer(random,Math.max(2,remaining-rest*6),Math.min(6,remaining-rest*2));
      state.molePlan.push(count);remaining-=count;
    }
    nextWave(now);
  }
  function tick(at) {
    if (state.status !== 'playing') return;
    if (kind === 'moles' && state.status === 'playing' && at >= state.waveUntil) nextWave(state.waveUntil);
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
  }
  function breakCombo(message) {
    state.combo = 0; state.multiplier = 1; state.message = message;
    state.fx = { id: ++fxId, kind, broken: true, points: 0, combo: 0, multiplier: 1, cells: [], chains: 0 };
    state.revision++;
  }
  function collapse(removed) {
    const next = Array(100);
    for (let x=0;x<10;x++) {
      const kept=[];
      for (let y=0;y<10;y++) if (!removed.has(y*10+x)) kept.push({ ...state.board[y*10+x], oldY:y });
      const added = 10-kept.length;
      for (let y=0;y<10;y++) next[y*10+x] = y<added ? tile({ fall:added, spawned:true }) : { id:kept[y-added].id, color:kept[y-added].color, fall:y-kept[y-added].oldY, spawned:false };
    }
    state.board = next;
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
        points = comboPoints(50, state.combo);
        state.score += points;
        state.message = `找到一对！+${points} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
        state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells, icons, chains:0 };
      } else { state.selected = index; breakCombo('翻错了，连击重置'); return 0; }
    }
    if (kind === 'blocks') {
      const group = connectedBlocks(state.board,index);
      if (group.length < 3) { breakCombo('至少 3 块同色相连才能消除'); return 0; }
      const cleared=[...group];
      state.removed += group.length;
      collapse(new Set(group));
      state.combo += 1; state.multiplier = comboMultiplier(state.combo);
      points = comboPoints(group.length * 10, state.combo);
      state.score += points;
      let chains=0;
      for (let step=0; step<MAX_BLOCK_CHAINS; step++) {
        const chain=chainGroup();
        if (!chain) break;
        chains += 1; state.removed += chain.length; cleared.push(...chain);
        collapse(new Set(chain));
        state.combo += 1; state.multiplier = comboMultiplier(state.combo);
        const gained = comboPoints(chain.length * 10, state.combo);
        points += gained; state.score += gained;
      }
      ensurePlayable();
      state.message = `消除 ${cleared.length} 块！+${points}${chains?` · 连锁 ${chains}`:''} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
      state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells:cleared, chains };
    }
    if (kind === 'moles') {
      const cell = state.board[index];
      if (cell.type !== 'mole' || cell.hit) {
        if (cell.hit) { state.message = '这只已经打过了'; state.revision++; return 0; }
        breakCombo(cell.type === 'cabbage' ? '白菜不计分，连击重置' : '打空了，连击重置');
        return 0;
      }
      cell.hit = true; state.hit++; state.combo += 1; state.multiplier = comboMultiplier(state.combo);
      points = comboPoints(25, state.combo); state.score += points;
      state.message = `打中了！+${points} · ${state.combo} 连击 ${formatComboMultiplier(state.combo)}`;
      state.fx = { id:++fxId, kind, broken:false, points, combo:state.combo, multiplier:state.multiplier, cells:[index], chains:0 };
    }
    state.revision++;
    if ((kind === 'pairs' && state.removed === 40) || (kind === 'blocks' && state.score >= BLOCK_TARGET)) finish('complete');
    if (kind === 'moles' && state.board.every(c=>c.type !== 'mole'||c.hit)) nextWave(at);
    return points;
  }
  return { state, tick, select, remaining:at=>Math.max(0,Math.min(MINI_DURATION,state.deadline-at)), snapshot:()=>structuredClone(state) };
}
