import assert from 'node:assert/strict';
import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_CLEAR_TARGET, BLOCK_POINT, BLOCK_GROUP_LIMIT, COMBO_WINDOW_MS, COMBO_MULTIPLIER_STEP, comboMultiplier, comboPoints, connectedBlocks, randomMiniGame, PAIR_POINT, PAIR_TARGET, PAIR_DURATION, PAIR_CLEAR_BONUS, PAIR_ICON_LIST } from '../src/mini-games.js';
import { secretPayout } from '../src/secret-wave.js';
assert.equal(COMBO_MULTIPLIER_STEP,.5);
assert.deepEqual([0,1,2,3,4].map(comboMultiplier),[1,1,1.5,2,2.5]);
assert.equal(comboPoints(25,2),38);
const seeded = seed => () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32; };
assert.equal(MINI_DURATION,30000);
assert.equal(PAIR_POINT,20);assert.equal(PAIR_TARGET,32);assert.equal(PAIR_DURATION,30000);assert.equal(PAIR_CLEAR_BONUS,200);assert.equal(BLOCK_GROUP_LIMIT,12);
assert.equal(PAIR_ICON_LIST.length,32);assert.equal(new Set(PAIR_ICON_LIST.map(icon=>icon.id)).size,32);
assert.deepEqual(Object.values(MINI_GAMES).map(d=>[d.columns,d.rows]),[[8,8],[10,10],[4,4]]);
assert.deepEqual([0,.4,.9].map(r=>randomMiniGame(()=>r)),['pairs','blocks','moles']);
assert.throws(()=>createMiniGame('other'),RangeError);
for(let seed=0;seed<25;seed++) {
  const pairs=createMiniGame('pairs',{random:seeded(seed),now:100});
  assert.equal(pairs.state.board.length,64);
  assert.equal(pairs.state.deadline,100+PAIR_DURATION);
  const groups=Object.groupBy(pairs.state.board.map((c,i)=>({...c,index:i})),c=>c.pair);
  assert.equal(Object.keys(groups).length,32);assert.ok(Object.values(groups).every(g=>g.length===2));
  assert.equal(new Set(pairs.state.board.map(cell=>cell.icon)).size,32);
  const mismatch=Object.values(groups).slice(0,2).map(g=>g[0].index);
  pairs.select(mismatch[0],101);pairs.select(mismatch[1],102);assert.equal(pairs.state.score,0);
  pairs.select(mismatch[1],103);assert.equal(pairs.state.selected,null);
  let streak=0;
  const ordered=Object.values(groups);
  for(const group of ordered.slice(0,PAIR_TARGET)) {
    assert.equal(pairs.select(group[0].index,1000),0);
    streak+=1;
    assert.equal(pairs.select(group[1].index,1000),comboPoints(PAIR_POINT,streak));
    assert.equal(pairs.state.combo,streak);
    assert.equal(pairs.state.board[group[0].index],null);
  }
  const pairTotal=Array.from({length:PAIR_TARGET},(_,i)=>comboPoints(PAIR_POINT,i+1)).reduce((a,b)=>a+b);
  assert.equal(pairTotal,5600);
  assert.equal(pairs.state.score,pairTotal+PAIR_CLEAR_BONUS);assert.equal(pairs.state.clearBonus,PAIR_CLEAR_BONUS);assert.equal(pairs.state.status,'complete');
  assert.equal(pairs.state.removed,PAIR_TARGET*2);
  assert.equal(pairs.state.board.filter(Boolean).length,0);
  assert.ok(pairTotal>1000,'matched pairs are not capped');
  assert.equal(pairs.select(0,1001),0);assert.equal(pairs.state.score,pairTotal+PAIR_CLEAR_BONUS);
  const blocks=createMiniGame('blocks',{random:seeded(seed),now:100});
  let moves=0;
  while(blocks.state.status==='playing'&&moves++<100) {
    const index=blocks.state.board.findIndex((_,i)=>connectedBlocks(blocks.state.board,i).length>=3);
    assert.ok(index>=0,'refilled boards always have a legal move');
    const before=blocks.snapshot(),group=connectedBlocks(before.board,index);
    const room=BLOCK_CLEAR_TARGET-before.removed;
    const points=blocks.select(index,1000+moves);
    const counted=Math.min(group.length,room);
    assert.ok(points>=counted*BLOCK_POINT);
    assert.equal(points%BLOCK_POINT,0);
    assert.equal(blocks.state.removed,Math.min(BLOCK_CLEAR_TARGET,before.removed+counted));
    if(blocks.state.status==='complete') assert.equal(points,counted*BLOCK_POINT,'the click that fills the cap does not keep chaining');
    assert.ok(blocks.state.removed<=BLOCK_CLEAR_TARGET);
    if(blocks.state.status==='playing') assert.equal(blocks.state.score,before.score+points);
    assert.equal(blocks.state.board.length,100);
    assert.ok(blocks.state.board.every(c=>c.color>=0&&c.color<4));
  }
  assert.equal(blocks.state.status,'complete','50 cleared blocks end the round before the timer');
  assert.equal(blocks.state.removed,BLOCK_CLEAR_TARGET);
  assert.ok(blocks.state.baseScore>=BLOCK_CLEAR_TARGET*BLOCK_POINT);
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
  }
  assert.equal(moles.state.status,'complete');assert.equal(moles.state.hit,40);assert.ok(moles.state.score>0);
}
const noHit=createMiniGame('moles');
for(let round=1;round<=9;round++){noHit.tick(round*3000);assert.equal(noHit.state.wave,round+1);}
noHit.tick(30000);assert.equal(noHit.state.status,'complete');assert.equal(noHit.state.score,0);
const jumped=createMiniGame('moles',{now:0});
jumped.tick(16000);assert.equal(jumped.state.wave,2,'one tick advances at most one mole wave');assert.equal(jumped.state.status,'playing');
jumped.tick(30000);assert.equal(jumped.state.status,'timeout');assert.equal(jumped.state.score,0);
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
function paintBlocks(score, colors) {
  const game=createMiniGame('blocks',{random:()=>0,now:0});
  game.state.score=score;
  game.state.board.forEach((cell,index)=>{ cell.color=colors[index]??(index%10+Math.floor(index/10))%4; cell.fall=0; cell.spawned=false; });
  return game;
}
function isolatedTrio(score) {
  const game=paintBlocks(score, []);
  game.state.board[90].color=3; game.state.board[91].color=3; game.state.board[92].color=3;
  return game;
}
const cross=isolatedTrio(0);
cross.state.removed=47; cross.state.score=470;
cross.state.board.forEach(cell => { cell.color = 0; });
for (const index of [90, 91, 92, 93, 94, 95]) cross.state.board[index].color = 3;
assert.equal(connectedBlocks(cross.state.board,90).length,6);
assert.equal(cross.select(90,1),30,'a clear past 50 scores only the blocks that fit');
assert.equal(cross.state.removed,BLOCK_CLEAR_TARGET);
assert.equal(cross.state.baseScore,500);
assert.equal(cross.state.status,'complete');
assert.equal(cross.state.score,Math.round(500*cross.state.bestMultiplier));
const lonely=isolatedTrio(0);
lonely.select(90,1);
const missIndex=lonely.state.board.findIndex((_,i)=>connectedBlocks(lonely.state.board,i).length<3);
assert.ok(missIndex>=0);assert.equal(lonely.select(missIndex,2),0);assert.equal(lonely.state.score,30,'a miss adds nothing');
const early=isolatedTrio(0);
assert.equal(early.select(90,10),30);
assert.equal(early.state.status,'playing');
early.tick(early.state.deadline);
assert.equal(early.state.status,'timeout','the timer ends a round that has not cleared 50 blocks');
assert.equal(early.state.removed,3);
assert.equal(early.state.baseScore,30);
const streak=isolatedTrio(0);
assert.equal(streak.select(90,1000),30);assert.equal(streak.state.combo,1);
streak.state.board[80].color=3;streak.state.board[81].color=3;streak.state.board[82].color=3;
const continued=streak.select(80,1400);assert.ok(continued>=30&&continued%10===0);assert.equal(streak.state.combo,2);assert.equal(streak.state.multiplier,1.5);
const miss=streak.state.board.findIndex((_,i)=>connectedBlocks(streak.state.board,i).length<3);
assert.ok(miss>=0);assert.equal(streak.select(miss,1500),0,'a click that cannot clear breaks the window');
assert.equal(streak.state.combo,0);assert.equal(streak.state.lastClearAt,null);
streak.state.board[70].color=2;streak.state.board[71].color=2;streak.state.board[72].color=2;
const restarted=streak.select(70,2000);assert.ok(restarted>=30&&restarted%10===0);assert.equal(streak.state.combo,1,'a later clear starts at 1');
assert.equal(streak.state.bestCombo,2);
streak.tick(2000+COMBO_WINDOW_MS+1);
assert.equal(streak.state.combo,0);assert.equal(streak.state.bestCombo,2,'the peak survives the window');
const stacked=isolatedTrio(990);
stacked.state.combo=2;
assert.equal(stacked.select(90,1),30,'a preset streak without a fresh clear does not continue');
assert.equal(stacked.state.combo,1);assert.equal(stacked.state.score,1020);
stacked.tick(stacked.state.deadline);
assert.equal(stacked.state.score,Math.round(1020*comboMultiplier(1)));
assert.equal(secretPayout(stacked.state.score,2),stacked.state.score*2,'secret ×2 applies after the end multiplier');
const lasting=createMiniGame('pairs',{random:seeded(1),now:0});
lasting.tick(PAIR_DURATION-1);assert.equal(lasting.state.status,'playing','pairs stay open until the 30 second mark');
lasting.tick(PAIR_DURATION);assert.equal(lasting.state.status,'timeout');
const missed=createMiniGame('pairs',{random:()=>.2,now:0});
const mate=missed.state.board.findIndex((cell,index)=>index>0&&cell.pair===missed.state.board[0].pair);
missed.select(0,1);missed.select(mate,2);assert.equal(missed.state.combo,1);
const other=missed.state.board.findIndex(cell=>cell&&cell.pair!==missed.state.board.find(Boolean)?.pair);
const wrong=missed.state.board.findIndex((cell,index)=>cell&&index!==other&&cell.pair!==missed.state.board[other].pair);
missed.select(other,3);missed.select(wrong,4);assert.equal(missed.state.combo,0);assert.equal(missed.state.multiplier,1);
const chain=createMiniGame('blocks',{random:()=>0,now:0});
chain.state.board.forEach((cell,index)=>{ cell.color=(index%10+Math.floor(index/10))%4; cell.fall=0; cell.spawned=false; });
const paint=(x,y,color)=>{ chain.state.board[y*10+x].color=color; };
paint(0,6,1);paint(0,7,1);paint(0,8,2);paint(0,9,1);paint(1,8,2);paint(2,8,2);
const chained=chain.select(80,1);
assert.equal(chain.state.combo,1,'a drop chain adds base points and does not raise the click combo');
assert.ok(chained>chain.state.removed*BLOCK_POINT,'cascade points stay outside the click count');
assert.equal(chain.state.status,'playing');
assert.ok(chain.state.fx.chains>=1);
const gravity=createMiniGame('blocks',{random:()=>0,now:0});
gravity.state.board.forEach((cell,index)=>{ cell.color=(index%10+Math.floor(index/10))%4; cell.fall=0; cell.spawned=false; });
gravity.state.board[90].color=3;gravity.state.board[91].color=3;gravity.state.board[92].color=3;
const before=gravity.snapshot();
gravity.select(90,1);
for (let x=0;x<10;x++) {
  const removed=new Set([90,91,92]);
  const kept=before.board.filter((cell,index)=>index%10===x&&!removed.has(index)).map(cell=>cell.id);
  const after=gravity.state.board.filter((cell,index)=>index%10===x).slice(10-kept.length).map(cell=>cell.id);
  assert.deepEqual(after,kept,'gravity keeps the remaining column in its original order');
}
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
  assert.ok(fresh.state.removed <= BLOCK_GROUP_LIMIT);
}
const flood = createMiniGame('blocks', { random: () => 0, now: 0 });
flood.state.board.forEach(cell => { cell.color = 0; cell.fall = 0; cell.spawned = false; });
for (let x = 0; x < 3; x++) flood.state.board[90 + x].color = 1;
const clicked = connectedBlocks(flood.state.board, 90).length;
const gained = flood.select(90, 1);
assert.equal(flood.state.status, 'playing', 'one click plus its cascade cannot end the round');
assert.equal(flood.state.removed, clicked, 'only the clicked blocks count toward the cap');
assert.ok(gained > clicked * BLOCK_POINT, 'the cascade still adds base score');
assert.equal(flood.state.combo, 1);
assert.equal(MINI_GAMES.moles.rule.includes('空洞'), false);
assert.equal(MINI_GAMES.pairs.rule.includes('32'), true);
assert.equal(MINI_GAMES.blocks.rule.includes('掉落连锁照样加基础分'), true);
console.log('PASS: combo multipliers, broken streaks, a 50-block cap, timer finish, drop chains, gravity, and secret ×2 on the full total.');
