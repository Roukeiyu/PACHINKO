export const MINI_DURATION = 30000;
export const MINI_GAMES = Object.freeze({
  pairs: { title: '对对碰', rule: '找出相同图案，选中一对就会消失。每对 50 分，全部找完提前结束。', columns: 8, rows: 5 },
  blocks: { title: '消消乐', rule: '点击上下左右相连的同色方块，至少 3 块才能消除。每块 10 分，满 1000 分提前结束。', columns: 10, rows: 10 },
  moles: { title: '打地鼠', rule: '点击地鼠，白菜留着！每只 25 分，共 10 轮、40 只；每轮最多 3 秒，打完提前换轮。', columns: 4, rows: 4 },
});
export const PAIR_ICONS = Object.freeze(['🍒','🍊','🍇','🍍','🍓','🍋','🍉','🍎','🍐','🍑','🥝','🥭','🫐','🍈','🥥','🍌','🥕','🌽','🥑','🍅']);
export const BLOCK_COLORS = Object.freeze(['红','蓝','黄','绿']);
export const BLOCK_SYMBOLS = Object.freeze(['♥','●','✦','◆']);
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
  let nextId = 0;
  const tile = () => ({ id: nextId++, color: integer(random,0,3), fall: 0 });
  const state = { kind, status: 'playing', score: 0, startedAt: now, deadline: now + MINI_DURATION, revision: 0, selected: null, removed: 0, hit: 0, wave: 0, waveUntil: 0, board: [], molePlan: [], message: '' };
  function ensurePlayable() {
    if (state.board.some((_,i) => connectedBlocks(state.board,i).length >= 3)) return;
    // A board without a legal move must never trap the player. Refill three
    // adjacent top cells, using the same four-color pool as every new tile.
    const color = integer(random,0,3);
    for (let i=0;i<3;i++) state.board[i] = { ...tile(), color };
    state.message = '新方块已补上，继续消除吧';
  }
  function finish(status) { if (state.status !== 'playing') return; state.status = status; state.selected = null; state.revision++; }
  function nextWave(at) {
    if (state.wave === 10) { finish('complete'); return; }
    const count = state.molePlan[state.wave++];
    const cabbage = integer(random,2,Math.min(6,16-count));
    state.board = shuffle([...Array(count).fill('mole'),...Array(cabbage).fill('cabbage'),...Array(16-count-cabbage).fill('empty')],random).map(type=>({ id:nextId++,type,hit:false }));
    state.waveUntil = at + 3000; state.revision++;
  }
  if (kind === 'pairs') state.board = shuffle(PAIR_ICONS.flatMap((icon,pair)=>[{id:nextId++,pair,icon},{id:nextId++,pair,icon}]),random);
  if (kind === 'blocks') { state.board = Array.from({length:100},tile); ensurePlayable(); }
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
    if (kind === 'moles') while (state.status === 'playing' && at >= state.waveUntil) nextWave(state.waveUntil);
    if (state.status === 'playing' && at >= state.deadline) finish('timeout');
  }
  function select(index, at) {
    tick(at);
    if (state.status !== 'playing' || !Number.isInteger(index) || !state.board[index]) return 0;
    let points = 0;
    if (kind === 'pairs') {
      if (state.selected === index) state.selected = null;
      else if (state.selected === null) state.selected = index;
      else if (state.board[state.selected].pair === state.board[index].pair) {
        state.board[state.selected] = null; state.board[index] = null; state.selected = null;
        points = 50; state.removed += 2; state.message = '找到一对！+50';
      } else { state.selected = index; state.message = '换一个相同图案试试'; }
    }
    if (kind === 'blocks') {
      const group = connectedBlocks(state.board,index);
      if (group.length < 3) { state.message = '至少 3 块同色相连才能消除'; state.revision++; return 0; }
      points = group.length * 10; state.removed += group.length; state.message = `消除 ${group.length} 块！+${points}`;
      const removed = new Set(group), next = Array(100);
      for (let x=0;x<10;x++) {
        const kept=[];
        for (let y=0;y<10;y++) if (!removed.has(y*10+x)) kept.push({ ...state.board[y*10+x], oldY:y });
        const added = 10-kept.length;
        for (let y=0;y<10;y++) next[y*10+x] = y<added ? { ...tile(), fall:added } : { id:kept[y-added].id, color:kept[y-added].color, fall:y-kept[y-added].oldY };
      }
      state.board=next;ensurePlayable();
    }
    if (kind === 'moles') {
      const cell = state.board[index];
      if (cell.type !== 'mole' || cell.hit) { state.message = cell.type === 'cabbage' ? '白菜不计分，找地鼠吧' : '看看其他洞口'; state.revision++; return 0; }
      cell.hit = true; state.hit++; points = 25; state.message = '打中了！+25';
    }
    state.score += points; state.revision++;
    if ((kind === 'pairs' && state.removed === 40) || (kind === 'blocks' && state.score >= 1000)) finish('complete');
    if (kind === 'moles' && state.board.every(c=>c.type !== 'mole'||c.hit)) nextWave(at);
    return points;
  }
  return { state, tick, select, remaining:at=>Math.max(0,Math.min(MINI_DURATION,state.deadline-at)), snapshot:()=>structuredClone(state) };
}
