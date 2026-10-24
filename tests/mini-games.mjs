import assert from 'node:assert/strict';
import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_CLEAR_TARGET, BLOCK_DURATION, BLOCK_POINT, BLOCK_GROUP_LIMIT, BLOCK_TYPE_COUNT, BLOCK_ICON_IDS, BLOCK_ICONS, COMBO_MULTIPLIER_STEP, comboMultiplier, comboPoints, connectedBlocks, randomMiniGame, miniGameIdle, miniIntro, AFK_BALL_TEXT, PAIR_POINT, PAIR_TARGET, PAIR_DURATION, PAIR_CLEAR_BONUS, PAIR_ICON_LIST, PAIR_SUITS, PAIR_SUIT_COUNT, PAIR_COPIES, MOLE_WAVE_MS, MOLE_FLIP_MS, STAR_DURATION, STAR_POINT, STAR_BOMB_PENALTY, STAR_BASKET_Y, AIM_DURATION, AIM_BALLS, AIM_REST_X, AIM_REST_Y, AIM_NORMAL_POINT, AIM_BONUS_POINT } from '../src/mini-games.js';
import { secretPayout } from '../src/secret-wave.js';
assert.equal(COMBO_MULTIPLIER_STEP,.5);
assert.deepEqual([0,1,2,3,4].map(comboMultiplier),[1,1,1.5,2,2.5]);
assert.equal(comboPoints(25,2),38);
const seeded = seed => () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32; };
assert.equal(MINI_DURATION,30000);
assert.equal(BLOCK_CLEAR_TARGET,200);
assert.equal(BLOCK_DURATION,45000);
assert.equal(BLOCK_POINT,11);
assert.equal(BLOCK_TYPE_COUNT,5);
assert.deepEqual(BLOCK_ICON_IDS,['cherry','orange','grapes','watermelon','strawberry']);
assert.equal(BLOCK_ICONS.length,5);
assert.ok(BLOCK_ICONS.every(icon=>PAIR_ICON_LIST.includes(icon)&&icon.svg.includes('<svg')));
assert.equal(PAIR_POINT,40);assert.equal(PAIR_TARGET,32);assert.equal(PAIR_DURATION,30000);assert.equal(PAIR_CLEAR_BONUS,200);assert.equal(BLOCK_GROUP_LIMIT,12);
assert.equal(PAIR_ICON_LIST.length,32);assert.equal(new Set(PAIR_ICON_LIST.map(icon=>icon.id)).size,32);
assert.equal(PAIR_SUIT_COUNT,16);assert.equal(PAIR_COPIES,4);assert.equal(PAIR_SUITS.length,16);
assert.equal(new Set(PAIR_SUITS.map(icon=>icon.id)).size,16);assert.ok(PAIR_SUITS.every(icon=>PAIR_ICON_LIST.includes(icon)));
assert.deepEqual(Object.values(MINI_GAMES).map(d=>[d.columns,d.rows]),[[8,8],[10,10],[4,4],[0,0],[0,0],[0,0]]);
assert.equal(AFK_BALL_TEXT,'挂机未操作 · 无小球奖励');
const pairsCard=miniIntro('pairs',{source:'secret',ballGrant:20,doubled:false});
assert.equal(pairsCard.title,'对对碰');assert.equal(pairsCard.rule,MINI_GAMES.pairs.rule);assert.equal(pairsCard.time,'30 秒');assert.equal(pairsCard.goal,'配完 32 对，或时间到');
assert.equal(pairsCard.reward,'本局得分计入快乐积分。有效操作另得 20 颗小球。挂机未操作，无小球奖励');
assert.equal(miniIntro('pairs',{source:'secret',ballGrant:160,doubled:true}).reward,'本局得分计入快乐积分，双球再 ×2。有效操作另得 160 颗小球。挂机未操作，无小球奖励');
assert.equal(miniIntro('blocks').time,'45 秒');assert.equal(miniIntro('blocks').goal,'点掉 200 块，或时间到');assert.equal(miniIntro('blocks').rule,MINI_GAMES.blocks.rule);
assert.equal(miniIntro('moles').time,'30 秒，每轮最多 3 秒');assert.equal(miniIntro('moles').goal,'10 轮打完 40 只，或时间到');
assert.equal(miniIntro('stars').time,'30 秒');assert.equal(miniIntro('stars').goal,'接住星星，躲开炸弹');
assert.ok(miniIntro('stars').rule.includes(String(STAR_BOMB_PENALTY)));
assert.equal(miniIntro('aim').time,'30 秒，或 5 颗弹珠');assert.equal(miniIntro('aim').goal,'打中滑动靶，或时间到');
assert.equal(miniIntro('moles',{source:'gm',doubled:true}).reward,'试玩只记快乐积分。挂机未操作不发小球');
assert.throws(()=>miniIntro('other'),RangeError);
assert.deepEqual([0,.17,.34,.51,.68,.85].map(r=>randomMiniGame(()=>r)),['pairs','blocks','moles','stars','aim','sling']);
assert.equal(randomMiniGame(()=>0,'nope'),'pairs','an unknown previous still uses the full pool');
assert.equal(randomMiniGame(()=>0,'pairs'),'blocks');
assert.equal(randomMiniGame(()=>.99,'pairs'),'sling');
assert.equal(randomMiniGame(()=>0,'blocks'),'pairs');
assert.equal(randomMiniGame(()=>.99,'blocks'),'sling');
assert.equal(randomMiniGame(()=>0,'moles'),'pairs');
assert.equal(randomMiniGame(()=>.99,'moles'),'sling');
assert.equal(randomMiniGame(()=>0,'stars'),'pairs');
assert.equal(randomMiniGame(()=>.99,'stars'),'sling');
assert.equal(randomMiniGame(()=>0,'aim'),'pairs');
assert.equal(randomMiniGame(()=>.99,'aim'),'sling');
for (const previous of Object.keys(MINI_GAMES)) {
  for (let i=0;i<30;i++) assert.notEqual(randomMiniGame(Math.random,previous),previous,'the next mini-game is never the previous one');
}
assert.throws(()=>createMiniGame('other'),RangeError);
for(let seed=0;seed<25;seed++) {
  const pairs=createMiniGame('pairs',{random:seeded(seed),now:100});
  assert.equal(pairs.state.board.length,64);
  assert.equal(pairs.state.deadline,100+PAIR_DURATION);
  const groups=Object.groupBy(pairs.state.board.map((c,i)=>({...c,index:i})),c=>c.pair);
  assert.equal(Object.keys(groups).length,PAIR_SUIT_COUNT);assert.ok(Object.values(groups).every(g=>g.length===PAIR_COPIES&&new Set(g.map(c=>c.icon)).size===1));
  assert.equal(new Set(pairs.state.board.map(cell=>cell.icon)).size,PAIR_SUIT_COUNT);
  const mismatch=Object.values(groups).slice(0,2).map(g=>g[0].index);
  pairs.select(mismatch[0],101);pairs.select(mismatch[1],102);assert.equal(pairs.state.score,0);
  pairs.select(mismatch[1],103);assert.equal(pairs.state.selected,null);
  let streak=0;
  for(const group of Object.values(groups)) {
    for(let copy=0;copy<PAIR_COPIES;copy+=2) {
      assert.equal(pairs.select(group[copy].index,1000),0);
      streak+=1;
      assert.equal(pairs.select(group[copy+1].index,1000),comboPoints(PAIR_POINT,streak),'the two cards left after a suit’s first pair still match');
      assert.equal(pairs.state.combo,streak);
      assert.equal(pairs.state.board[group[copy].index],null);
      assert.equal(pairs.state.board[group[copy+1].index],null);
    }
  }
  const pairTotal=Array.from({length:PAIR_TARGET},(_,i)=>comboPoints(PAIR_POINT,i+1)).reduce((a,b)=>a+b);
  assert.equal(pairTotal,11200);
  assert.equal(pairs.state.score,pairTotal+PAIR_CLEAR_BONUS);assert.equal(pairs.state.clearBonus,PAIR_CLEAR_BONUS);assert.equal(pairs.state.status,'complete');
  assert.equal(pairs.state.removed,PAIR_TARGET*2);
  assert.equal(pairs.state.board.filter(Boolean).length,0);
  assert.ok(pairTotal>1000,'matched pairs are not capped');
  assert.equal(pairs.select(0,1001),0);assert.equal(pairs.state.score,pairTotal+PAIR_CLEAR_BONUS);
  const blocks=createMiniGame('blocks',{random:seeded(seed),now:100});
  assert.equal(blocks.state.deadline,100+BLOCK_DURATION);
  let moves=0;
    while(blocks.state.status==='playing'&&moves++<250) {
    const index=blocks.state.board.findIndex((_,i)=>connectedBlocks(blocks.state.board,i).length>=3);
    assert.ok(index>=0,'refilled boards always have a legal move');
    const before=blocks.snapshot(),group=connectedBlocks(before.board,index);
    const room=BLOCK_CLEAR_TARGET-before.removed;
    const points=blocks.select(index,1000+moves);
    const gained=blocks.state.removed-before.removed;
    assert.ok(gained>=Math.min(group.length,room),'a click counts its own blocks and any cascade');
    assert.equal(points,gained*BLOCK_POINT);
    assert.equal(blocks.state.removed,Math.min(BLOCK_CLEAR_TARGET,before.removed+gained));
    if(blocks.state.status==='complete') assert.equal(blocks.state.removed,BLOCK_CLEAR_TARGET);
    assert.ok(blocks.state.removed<=BLOCK_CLEAR_TARGET);
    if(blocks.state.status==='playing') {
      assert.equal(blocks.state.score,before.score+points);
      assert.equal(blocks.state.combo>=1,true);
    }
    assert.equal(blocks.state.board.length,100);
    assert.ok(blocks.state.board.every(c=>c&&c.color>=0&&c.color<BLOCK_TYPE_COUNT));
    for(let x=0;x<10;x++) assert.equal(blocks.state.board.filter((_,i)=>i%10===x).length,10,'every column stays full after a clear');
  }
  assert.equal(blocks.state.status,'complete','200 cleared blocks end the round before the timer');
  assert.equal(blocks.state.removed,BLOCK_CLEAR_TARGET);
  assert.equal(blocks.state.baseScore,BLOCK_CLEAR_TARGET*BLOCK_POINT);
  assert.equal(blocks.state.baseScore%BLOCK_POINT,0);
  assert.equal(blocks.state.score,Math.round(blocks.state.baseScore*blocks.state.bestMultiplier));
  const moles=createMiniGame('moles',{random:seeded(seed),now:100});
  assert.equal(moles.state.molePlan.length,10);assert.equal(moles.state.molePlan.reduce((a,b)=>a+b),40);
  assert.ok(moles.state.molePlan.every(n=>n>=2&&n<=6));
  let time=101;
  for(let wave=1;wave<=10;wave++) {
    assert.equal(moles.state.wave,wave);
    assert.equal(moles.state.board.every(cell=>cell.type==='mole'||cell.type==='cabbage'),true);
    assert.equal(moles.state.board.filter(cell=>cell.type==='empty').length,0);
    assert.equal(moles.state.board.filter(cell=>cell.type==='cabbage').length,16-moles.state.board.filter(cell=>cell.type==='mole').length);
    const cabbage=moles.state.board.findIndex(c=>c.type==='cabbage');
    assert.equal(moles.select(cabbage,time),0);
    assert.equal(moles.state.combo,0,'a cabbage swing breaks the streak');
    const indices=moles.state.board.flatMap((c,i)=>c.type==='mole'?[i]:[]);
    for(const [j,index] of indices.entries()) {
      assert.equal(moles.select(index,time++),comboPoints(25,j+1));
      if(j<indices.length-1) assert.equal(moles.select(index,time),0,'repeat clicks never score twice');
      assert.equal(moles.state.combo,j+1,'a repeat click does not break the streak');
    }
    const stamp=moles.state.board.map(cell=>cell.id).join();
    assert.ok(moles.state.flipUntil>time,'clearing a batch arms the flip before the next batch');
    moles.tick(moles.state.flipUntil-1);
    assert.equal(moles.state.wave,wave,'the next batch waits until the flip finishes');
    assert.equal(moles.state.board.map(cell=>cell.id).join(),stamp);
    const during=moles.state.score, duringCombo=moles.state.combo, duringPlayed=moles.state.played;
    assert.equal(moles.select(0,moles.state.flipUntil-1),0,'a click during the flip is ignored');
    assert.equal(moles.state.score,during);assert.equal(moles.state.combo,duringCombo);assert.equal(moles.state.played,duringPlayed);
    moles.tick(moles.state.flipUntil);
    if(wave<10) assert.equal(moles.state.wave,wave+1);
  }
  assert.equal(moles.state.status,'complete');assert.equal(moles.state.hit,40);assert.ok(moles.state.score>0);
}
const noHit=createMiniGame('moles');
for(let round=1;round<=9;round++){
  const end=noHit.state.waveUntil;
  noHit.tick(end);
  assert.equal(noHit.state.wave,round,'a timed batch flips before it deals');
  assert.equal(noHit.state.flipUntil,end+MOLE_FLIP_MS);
  assert.equal(noHit.state.deadline,MINI_DURATION+round*MOLE_FLIP_MS,'the round clock pauses for each flip');
  const flipEnd=noHit.state.flipUntil;
  noHit.tick(flipEnd);
  assert.equal(noHit.state.wave,round+1);
  assert.equal(noHit.state.flipUntil,0);
  assert.equal(noHit.state.waveUntil,flipEnd+MOLE_WAVE_MS,'the next batch gets its own 3 seconds after the flip');
}
noHit.tick(noHit.state.waveUntil);
noHit.tick(noHit.state.flipUntil);
assert.equal(noHit.state.status,'complete');assert.equal(noHit.state.score,0);assert.equal(noHit.state.hit,0);assert.equal(noHit.state.played,false);assert.equal(miniGameIdle(noHit.state),true);
const jumped=createMiniGame('moles',{now:0});
jumped.tick(16000);assert.equal(jumped.state.wave,2,'one tick advances at most one mole wave');assert.equal(jumped.state.status,'playing');
jumped.tick(jumped.state.deadline);assert.equal(jumped.state.status,'timeout');assert.equal(jumped.state.score,0);
for(const kind of ['pairs','blocks']) {
  const game=createMiniGame(kind,{random:seeded(4),now:500});
  if(kind==='pairs'){const partner=game.state.board.findIndex((c,i)=>i>0&&c.pair===game.state.board[0].pair);game.select(0,501);game.select(partner,502);}
  else {const index=game.state.board.findIndex((_,i)=>connectedBlocks(game.state.board,i).length>=3);game.select(index,501);}
  const score=game.state.score;assert.ok(score>0);
  assert.equal(game.select(0,game.state.deadline),0);assert.equal(game.state.status,'timeout');
  if(kind==='pairs') assert.equal(game.state.score,score);
  else assert.equal(game.state.score,Math.round(score*comboMultiplier(game.state.bestCombo)));
}
const edge=Array.from({length:100},(_,i)=>({color:i%4}));edge[9].color=edge[10].color=5;
assert.equal(connectedBlocks(edge,9).length,1,'rows never wrap at the right edge');
edge[0].color=edge[11].color=6;
assert.equal(connectedBlocks(edge,0).length,1,'diagonal blocks do not count as adjacent');
function quietBlocks(score = 0) {
  let armed = false, n = 0;
  const game = createMiniGame('blocks', {
    random: () => {
      if (!armed) return 0.37;
      n += 1;
      return [0.45, 0.85][(n - 1) % 2];
    },
    now: 0,
  });
  game.state.score = score;
  game.state.board.forEach((cell, index) => {
    const x = index % 10, y = Math.floor(index / 10);
    cell.color = (x + y) % 2;
    cell.fall = 0;
    cell.spawned = false;
  });
  game.arm = () => { armed = true; };
  return game;
}
function isolatedTrio(score) {
  const game = quietBlocks(score);
  game.state.board[90].color = 3;
  game.state.board[91].color = 3;
  game.state.board[92].color = 3;
  game.arm();
  return game;
}
const cross = isolatedTrio(0);
cross.state.removed = BLOCK_CLEAR_TARGET - 3;
cross.state.score = (BLOCK_CLEAR_TARGET - 3) * BLOCK_POINT;
for (const index of [90, 91, 92, 93, 94, 95]) cross.state.board[index].color = 3;
assert.equal(connectedBlocks(cross.state.board, 90).length, 6);
assert.equal(cross.select(90, 1), 3 * BLOCK_POINT, 'a clear past the target scores only the blocks that fit');
assert.equal(cross.state.removed, BLOCK_CLEAR_TARGET);
assert.equal(cross.state.baseScore, BLOCK_CLEAR_TARGET * BLOCK_POINT);
assert.equal(cross.state.status, 'complete');
assert.equal(cross.state.combo, 1, 'filling the target on the click does not start a cascade');
assert.equal(cross.state.fx.chains, 0);
assert.equal(cross.state.score, Math.round(BLOCK_CLEAR_TARGET * BLOCK_POINT * cross.state.bestMultiplier));
assert.equal(cross.state.message.includes(`已到 ${BLOCK_CLEAR_TARGET} 块`), true);
const lonely = isolatedTrio(0);
assert.equal(lonely.select(90, 1), 3 * BLOCK_POINT);
const missIndex = lonely.state.board.findIndex((_, i) => connectedBlocks(lonely.state.board, i).length < 3);
assert.ok(missIndex >= 0);
assert.equal(lonely.select(missIndex, 2), 0);
assert.equal(lonely.state.score, 3 * BLOCK_POINT, 'a miss adds nothing');
const early = isolatedTrio(0);
assert.equal(early.select(90, 10), 3 * BLOCK_POINT);
assert.equal(early.state.status, 'playing');
early.tick(early.state.deadline);
assert.equal(early.state.status, 'timeout', 'the timer ends a round that has not cleared 200 blocks');
assert.equal(early.state.removed, 3);
assert.equal(early.state.baseScore, 3 * BLOCK_POINT);
function restamp(game) {
  game.state.board.forEach((cell, index) => {
    const x = index % 10, y = Math.floor(index / 10);
    cell.color = (x + y) % 2;
    cell.fall = 0;
    cell.spawned = false;
  });
  game.state.board[90].color = 3;
  game.state.board[91].color = 3;
  game.state.board[92].color = 3;
}
const streak = isolatedTrio(0);
assert.equal(streak.select(90, 1000), 3 * BLOCK_POINT);
assert.equal(streak.state.combo, 1);
restamp(streak);
const continued = streak.select(90, 1001);
assert.equal(continued, 3 * BLOCK_POINT);
assert.equal(streak.state.combo, 1, 'a new click starts its own combo instead of extending a time window');
assert.equal(streak.state.multiplier, 1);
const miss = streak.state.board.findIndex((_, i) => connectedBlocks(streak.state.board, i).length < 3);
assert.ok(miss >= 0);
assert.equal(streak.select(miss, 1002), 0, 'a click that cannot clear breaks the combo');
assert.equal(streak.state.combo, 0);
assert.equal(streak.state.lastClearAt, null);
restamp(streak);
assert.equal(streak.select(90, 5000), 3 * BLOCK_POINT);
assert.equal(streak.state.combo, 1, 'a later clear starts at 1');
streak.tick(9000);
assert.equal(streak.state.combo, 1, 'the combo stays until the next click');
assert.equal(streak.state.bestCombo, 1);
const stacked = isolatedTrio(0);
stacked.state.score = 100;
stacked.state.combo = 4;
assert.equal(stacked.select(90, 1), 3 * BLOCK_POINT, 'a preset streak without a fresh clear does not continue');
assert.equal(stacked.state.combo, 1);
assert.equal(stacked.state.score, 100 + 3 * BLOCK_POINT);
stacked.tick(stacked.state.deadline);
assert.equal(stacked.state.score, Math.round((100 + 3 * BLOCK_POINT) * comboMultiplier(stacked.state.bestCombo)));
assert.equal(secretPayout(stacked.state.score, 2), stacked.state.score * 2, 'secret ×2 applies after the end multiplier');
const lasting=createMiniGame('pairs',{random:seeded(1),now:0});
lasting.tick(PAIR_DURATION-1);assert.equal(lasting.state.status,'playing','pairs stay open until the 30 second mark');
lasting.tick(PAIR_DURATION);assert.equal(lasting.state.status,'timeout');
const missed=createMiniGame('pairs',{random:()=>.2,now:0});
const mate=missed.state.board.findIndex((cell,index)=>index>0&&cell.pair===missed.state.board[0].pair);
missed.select(0,1);missed.select(mate,2);assert.equal(missed.state.combo,1);
const other=missed.state.board.findIndex(cell=>cell&&cell.pair!==missed.state.board.find(Boolean)?.pair);
const wrong=missed.state.board.findIndex((cell,index)=>cell&&index!==other&&cell.pair!==missed.state.board[other].pair);
missed.select(other,3);missed.select(wrong,4);assert.equal(missed.state.combo,0);assert.equal(missed.state.multiplier,1);
const chain = quietBlocks(0);
for (const y of [6, 7, 8]) chain.state.board[y * 10].color = 2;
chain.state.board[90].color = 3;
chain.state.board[91].color = 3;
chain.state.board[92].color = 3;
chain.arm();
const stackIds = [6, 7, 8].map(y => chain.state.board[y * 10].id);
const chained = chain.select(90, 1);
assert.equal(chain.state.removed, 6, 'the click and the fallen trio both count');
assert.equal(chained, 6 * BLOCK_POINT, 'every cleared block scores, including the cascade');
assert.equal(chain.state.combo, 2, 'the click is wave 1 and the cascade is wave 2');
assert.equal(chain.state.fx.chains, 1);
assert.equal(stackIds.every(id => chain.state.board.some(cell => cell.id === id)), false, 'the fallen group does not stay on the board');
assert.equal(chain.state.status, 'playing');
assert.ok(chain.state.motion.length >= 2, 'a cascade is a later gravity step');
assert.ok(chain.state.motion[1].pops.length >= 3);
assert.ok(chain.state.motion.every(step => step.moves.every(move => move.distance > 0 && move.toY > move.fromY)));
assert.ok(chain.state.motion[0].moves.some(move => move.spawned && move.fromY < 0));
assert.equal(chain.state.board.length, 100);
assert.ok(chain.state.board.every(cell => cell), 'a cascade refill leaves no empty cells');
restamp(chain);
const afterChain = chain.select(90, 2);
assert.equal(afterChain, 3 * BLOCK_POINT);
assert.equal(chain.state.combo, 1, 'the next click resets the combo');
assert.equal(chain.state.bestCombo, 2, 'the best chain is kept for the end multiplier');
const gravity = isolatedTrio(0);
gravity.state.board.forEach((cell, index) => { cell.color = (index % 10 + Math.floor(index / 10)) % 2; cell.fall = 0; cell.spawned = false; });
gravity.state.board[90].color = 3; gravity.state.board[91].color = 3; gravity.state.board[92].color = 3;
const before=gravity.snapshot();
gravity.select(90,1);
for (let x=0;x<10;x++) {
  const removed=new Set([90,91,92]);
  const kept=before.board.filter((cell,index)=>index%10===x&&!removed.has(index)).map(cell=>cell.id);
  const after=gravity.state.board.filter((cell,index)=>index%10===x).slice(10-kept.length).map(cell=>cell.id);
  assert.deepEqual(after,kept,'gravity keeps the remaining column in its original order');
}
const opening=gravity.state.motion[0];
assert.deepEqual(opening.pops.map(pop=>pop.index).sort((a,b)=>a-b),[90,91,92]);
const fallen=opening.moves.find(move=>move.id===before.board[80].id);
assert.equal(fallen.fromY,8);
assert.equal(fallen.toY,9);
assert.equal(fallen.to,90);
assert.equal(fallen.distance,1);
assert.equal(fallen.spawned,false);
for (let x=0;x<3;x++) {
  const arrivals=opening.moves.filter(move=>move.spawned&&move.to%10===x);
  assert.equal(arrivals.length,1);
  assert.equal(arrivals[0].toY,0);
  assert.equal(arrivals[0].fromY,-1);
  assert.equal(arrivals[0].distance,1);
  const column=opening.moves.filter(move=>move.to%10===x).map(move=>move.toY);
  assert.deepEqual(column,[...column].sort((a,b)=>a-b),'a column drops from top to bottom');
}
assert.equal(opening.moves.some(move=>move.to%10>2),false);
const held = isolatedTrio(0);
assert.equal(held.select(90, 1000), 3 * BLOCK_POINT);
held.setInputLock(true, 1000);
held.tick(5000);
assert.equal(held.state.combo, 1, 'the combo waits while tiles are falling');
held.setInputLock(false, 2000);
held.tick(9000);
assert.equal(held.state.combo, 1, 'a block combo does not expire on a timer');
function maxGroup(board) {
  let best = 0; const seen = new Set();
  for (let i = 0; i < board.length; i++) {
    if (!board[i] || seen.has(i)) continue;
    const group = connectedBlocks(board, i);
    group.forEach(n => seen.add(n));
    best = Math.max(best, group.length);
  }
  return best;
}
for (let seed = 0; seed < 30; seed++) {
  const fresh = createMiniGame('blocks', { random: seeded(300 + seed), now: 0 });
  assert.ok(maxGroup(fresh.state.board) <= BLOCK_GROUP_LIMIT, 'opening boards do not contain a huge same-color region');
  const index = fresh.state.board.findIndex((_, i) => connectedBlocks(fresh.state.board, i).length >= 3);
  fresh.select(index, 1);
  assert.equal(fresh.state.status, 'playing', 'one opening click cannot finish 消消乐');
  assert.ok(fresh.state.removed < BLOCK_CLEAR_TARGET);
  assert.ok(fresh.state.board.every(cell => cell.color >= 0 && cell.color < BLOCK_TYPE_COUNT));
}
const flood = createMiniGame('blocks', { random: () => 0, now: 0 });
flood.state.board.forEach(cell => { cell.color = 0; cell.fall = 0; cell.spawned = false; });
for (let x = 0; x < 3; x++) flood.state.board[90 + x].color = 1;
const clicked = connectedBlocks(flood.state.board, 90).length;
const gained = flood.select(90, 1);
assert.equal(clicked, 3);
assert.ok(flood.state.removed > clicked, 'the cascade counts toward the clear target');
assert.equal(flood.state.removed, BLOCK_CLEAR_TARGET);
assert.equal(gained, BLOCK_CLEAR_TARGET * BLOCK_POINT);
assert.ok(flood.state.combo > 1, 'each cascade wave raises the combo');
assert.equal(flood.state.status, 'complete');
assert.equal(MINI_GAMES.moles.rule.includes('空洞'), false);
assert.equal(MINI_GAMES.pairs.rule.includes('16 种图案，每种 4 张，同花色任意两张都能配对'), true);
assert.equal(MINI_GAMES.pairs.rule.includes(String(PAIR_TARGET)), true);
const sameSuit=createMiniGame('pairs',{random:seeded(3),now:0});
const suit=Object.values(Object.groupBy(sameSuit.state.board.map((cell,index)=>({...cell,index})),cell=>cell.icon))[0];
assert.equal(suit.length,PAIR_COPIES);assert.equal(new Set(suit.map(cell=>cell.pair)).size,1);
sameSuit.select(suit[0].index,1);
assert.equal(sameSuit.select(suit[2].index,2),PAIR_POINT,'any two cards of the same suit match');
assert.equal(sameSuit.state.board[suit[1].index].icon,sameSuit.state.board[suit[3].index].icon);
sameSuit.select(suit[1].index,3);
assert.equal(sameSuit.select(suit[3].index,4),comboPoints(PAIR_POINT,2),'after the first pair, the remaining two still match');
assert.equal(MINI_GAMES.blocks.rule.includes('连锁都计入 200'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('45 秒'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('从 1 重计'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('五种水果'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('洗牌'), true);
assert.equal(MINI_GAMES.pairs.rule.includes('没有配成一对'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('没有消除'), true);
assert.equal(MINI_GAMES.moles.rule.includes('没有打中'), true);
const glance=createMiniGame('pairs',{random:seeded(9),now:0});
glance.select(0,1);assert.equal(glance.state.played,false,'opening one card is not a scoring action');
glance.tick(PAIR_DURATION);assert.equal(glance.state.status,'timeout');assert.equal(glance.state.score,0);assert.equal(glance.state.removed,0);assert.equal(miniGameIdle(glance.state),true);
const mismatched=createMiniGame('pairs',{random:seeded(8),now:0});
const suits=Object.values(Object.groupBy(mismatched.state.board.map((cell,index)=>({...cell,index})),cell=>cell.pair));
mismatched.select(suits[0][0].index,1);mismatched.select(suits[1][0].index,2);
assert.equal(mismatched.state.played,false);assert.equal(mismatched.state.score,0);assert.equal(miniGameIdle(mismatched.state),true);
assert.equal(mismatched.select(suits[0][1].index,3),0);
assert.ok(mismatched.select(suits[0][2].index,4)>0);assert.equal(mismatched.state.played,true);assert.equal(miniGameIdle(mismatched.state),false);
const stuck = quietBlocks(0);
assert.equal(maxGroup(stuck.state.board), 1);
stuck.arm();
assert.equal(stuck.select(0, 1), 0, 'shuffling a dead board is not a scoring click');
assert.equal(stuck.state.played, false);
assert.equal(stuck.state.score, 0);
assert.ok(maxGroup(stuck.state.board) >= 3, 'a board with no group is shuffled into a move');
assert.equal(stuck.state.message.includes('洗牌'), true);
const untouched=isolatedTrio(0);
assert.equal(connectedBlocks(untouched.state.board,0).length,1);
assert.equal(untouched.select(0,1),0);assert.equal(untouched.state.played,false,'a block tap under 3 is not play');
assert.equal(untouched.select(90,2),3*BLOCK_POINT);assert.equal(untouched.state.played,true);assert.equal(untouched.state.removed,3);assert.equal(miniGameIdle(untouched.state),false);
const swing=createMiniGame('moles',{random:seeded(5),now:0});
const cabbageOnly=swing.state.board.findIndex(cell=>cell.type==='cabbage');
assert.equal(swing.select(cabbageOnly,1),0);assert.equal(swing.state.played,false);assert.equal(swing.state.hit,0);
const mole=swing.state.board.findIndex(cell=>cell.type==='mole'&&!cell.hit);
assert.ok(swing.select(mole,2)>0);assert.equal(swing.state.played,true);assert.equal(swing.state.hit,1);
assert.equal(swing.select(mole,3),0,'a repeat hit does not score');assert.equal(swing.state.played,true);assert.equal(miniGameIdle(swing.state),false);
const idleMoles=createMiniGame('moles',{random:seeded(6),now:0});
idleMoles.tick(idleMoles.state.waveUntil);
assert.ok(idleMoles.state.flipUntil>0);
const idleBefore=idleMoles.snapshot();
assert.equal(idleMoles.select(0,idleMoles.state.flipUntil-1),0);
assert.equal(idleMoles.state.played,false,'a flip click is not a scoring action');
assert.equal(idleMoles.state.hit,idleBefore.hit);
assert.equal(idleMoles.state.combo,idleBefore.combo);
assert.equal(miniGameIdle(idleMoles.state),true);
idleMoles.tick(MINI_DURATION);assert.equal(idleMoles.state.played,false);assert.equal(idleMoles.state.score,0);assert.equal(idleMoles.state.hit,0);

function playStars(seed, place) {
  const game = createMiniGame('stars', { random: seeded(seed), now: 0 });
  let t = 0;
  while (game.state.status === 'playing' && t < STAR_DURATION) {
    const next = Math.min(t + 16, STAR_DURATION);
    for (const item of game.state.items) {
      if (item.resolved || item.y >= STAR_BASKET_Y) continue;
      const yNext = item.y + item.vy * (next - t) / 1000;
      if (yNext >= STAR_BASKET_Y) place(game, item);
    }
    game.tick(next);
    t = next;
  }
  game.tick(STAR_DURATION);
  return game.state;
}
for (let seed = 1; seed <= 24; seed++) {
  const perfect = playStars(seed, (game, item) => {
    if (item.kind === 'star') game.setBasket(item.x);
    else game.setBasket(item.x < 160 ? 280 : 40);
  });
  assert.equal(perfect.score, 10841, `seed ${seed} perfect star catch`);
  assert.equal(perfect.hit, 49);
  assert.equal(perfect.bombs, 0);
  assert.equal(perfect.missed, 0);
  assert.equal(perfect.status, 'timeout');
  assert.equal(miniGameIdle(perfect), false);
}
const catchAll = playStars(1, (game, item) => game.setBasket(item.x));
assert.equal(catchAll.score, 939);
assert.equal(catchAll.hit, 49);
assert.equal(catchAll.bombs, 9);
const dodgedGame = createMiniGame('stars', { random: () => 0.99, now: 0 });
dodgedGame.setBasket(48);
dodgedGame.tick(STAR_DURATION);
assert.equal(dodgedGame.state.hit, 0);
assert.equal(dodgedGame.state.played, false);
assert.equal(miniGameIdle(dodgedGame.state), true, 'a basket parked off the stars is idle');
const oneStar = createMiniGame('stars', { random: seeded(4), now: 0 });
oneStar.tick(900);
const falling = oneStar.state.items.find(item => item.kind === 'star');
oneStar.setBasket(falling.x);
oneStar.tick(STAR_DURATION);
assert.ok(oneStar.state.hit >= 1);
assert.equal(miniGameIdle(oneStar.state), false);
const bombOnly = createMiniGame('stars', { random: seeded(4), now: 0 });
let bombAt = 0;
while (bombOnly.state.status === 'playing' && bombAt < STAR_DURATION) {
  const next = Math.min(bombAt + 16, STAR_DURATION);
  for (const item of bombOnly.state.items) {
    if (!item.resolved && item.kind === 'bomb' && item.y < STAR_BASKET_Y && item.y + item.vy * (next - bombAt) / 1000 >= STAR_BASKET_Y) bombOnly.setBasket(item.x);
    if (!item.resolved && item.kind === 'star' && item.y < STAR_BASKET_Y && item.y + item.vy * (next - bombAt) / 1000 >= STAR_BASKET_Y) bombOnly.setBasket(item.x < 160 ? 280 : 40);
  }
  bombOnly.tick(next);
  bombAt = next;
}
assert.equal(bombOnly.state.hit, 0);
assert.ok(bombOnly.state.bombs > 0);
assert.equal(bombOnly.state.played, false);
assert.equal(miniGameIdle(bombOnly.state), true, 'catching only bombs is not play');
assert.ok(bombOnly.state.score >= 0);
assert.equal(STAR_POINT, 17);

const aimShots = [
  { releaseAt: 1440, dx: 24, dy: -86 },
  { releaseAt: 5544, dx: 24, dy: -86 },
  { releaseAt: 8568, dx: 24, dy: -86 },
  { releaseAt: 11112, dx: -12, dy: -86 },
  { releaseAt: 13480, dx: 0, dy: -86 },
];
const aim = createMiniGame('aim', { now: 0 });
for (const shot of aimShots) {
  aim.tick(shot.releaseAt);
  aim.setAim({ x: AIM_REST_X - shot.dx, y: AIM_REST_Y - shot.dy });
  assert.equal(aim.release(), true);
}
aim.tick(AIM_DURATION);
assert.equal(aim.state.score, 10805);
assert.equal(aim.state.hit, 15);
assert.equal(aim.state.fired, AIM_BALLS);
assert.equal(aim.state.status, 'complete');
assert.equal(miniGameIdle(aim.state), false);
const aimIdle = createMiniGame('aim', { now: 0 });
aimIdle.tick(AIM_DURATION);
assert.equal(aimIdle.state.hit, 0);
assert.equal(aimIdle.state.fired, 0);
assert.equal(aimIdle.state.status, 'timeout');
assert.equal(miniGameIdle(aimIdle.state), true, 'never shooting is idle');
const aimMiss = createMiniGame('aim', { now: 0 });
aimMiss.setAim({ x: AIM_REST_X, y: AIM_REST_Y + 10 });
assert.equal(aimMiss.release(), false, 'a tiny pull spends no ball');
aimMiss.setAim({ x: AIM_REST_X - 80, y: AIM_REST_Y });
assert.equal(aimMiss.release(), false, 'a flat pull is rejected');
aimMiss.setAim({ x: AIM_REST_X, y: AIM_REST_Y + 20 });
assert.equal(aimMiss.release(), true);
aimMiss.tick(AIM_DURATION);
assert.equal(aimMiss.state.hit, 0, 'one empty shot is not a target hit');
assert.equal(aimMiss.state.played, false);
assert.equal(miniGameIdle(aimMiss.state), true);
assert.equal(AIM_NORMAL_POINT, 133);
assert.equal(AIM_BONUS_POINT, 206);
console.log('PASS: combo multipliers, broken streaks, a 200-block cap, timer finish, counted cascades, gravity order, secret ×2 on the full total, idle rounds, star and aim ceilings, and no repeated mini-game.');
