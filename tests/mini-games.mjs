import assert from 'node:assert/strict';
import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_TARGET, COMBO_MULTIPLIER_STEP, comboMultiplier, comboPoints, connectedBlocks, randomMiniGame } from '../src/mini-games.js';
import { secretPayout } from '../src/secret-wave.js';
assert.equal(COMBO_MULTIPLIER_STEP,.5);
assert.deepEqual([0,1,2,3,4].map(comboMultiplier),[1,1,1.5,2,2.5]);
assert.equal(comboPoints(25,2),38);
const seeded = seed => () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32; };
assert.equal(MINI_DURATION,30000);
assert.deepEqual(Object.values(MINI_GAMES).map(d=>[d.columns,d.rows]),[[8,5],[10,10],[4,4]]);
assert.deepEqual([0,.4,.9].map(r=>randomMiniGame(()=>r)),['pairs','blocks','moles']);
assert.throws(()=>createMiniGame('other'),RangeError);
for(let seed=0;seed<25;seed++) {
  const pairs=createMiniGame('pairs',{random:seeded(seed),now:100});
  assert.equal(pairs.state.board.length,40);
  const groups=Object.groupBy(pairs.state.board.map((c,i)=>({...c,index:i})),c=>c.pair);
  assert.equal(Object.keys(groups).length,20);assert.ok(Object.values(groups).every(g=>g.length===2));
  const mismatch=Object.values(groups).slice(0,2).map(g=>g[0].index);
  pairs.select(mismatch[0],101);pairs.select(mismatch[1],102);assert.equal(pairs.state.score,0);
  pairs.select(mismatch[1],103);assert.equal(pairs.state.selected,null);
  let streak=0;
  for(const group of Object.values(groups)) {
    assert.equal(pairs.select(group[0].index,1000),0);
    streak+=1;
    assert.equal(pairs.select(group[1].index,1000),comboPoints(50,streak));
    assert.equal(pairs.state.combo,streak);
    assert.equal(pairs.state.board[group[0].index],null);
  }
  const pairTotal=Array.from({length:20},(_,i)=>comboPoints(50,i+1)).reduce((a,b)=>a+b);
  assert.equal(pairs.state.score,pairTotal);assert.equal(pairs.state.status,'complete');
  assert.ok(pairTotal>BLOCK_TARGET,'matched pairs are not capped at the 1000 passing line');
  assert.equal(pairs.select(0,1001),0);assert.equal(pairs.state.score,pairTotal);
  const blocks=createMiniGame('blocks',{random:seeded(seed),now:100});
  let moves=0;
  while(blocks.state.status==='playing'&&moves++<100) {
    const index=blocks.state.board.findIndex((_,i)=>connectedBlocks(blocks.state.board,i).length>=3);
    assert.ok(index>=0,'refilled boards always have a legal move');
    const before=blocks.snapshot(),group=connectedBlocks(before.board,index);
    const points=blocks.select(index,1000);
    assert.ok(points>=comboPoints(group.length*10,1));
    assert.equal(blocks.state.score,before.score+points);
    assert.equal(blocks.state.board.length,100);
    assert.ok(blocks.state.board.every(c=>c.color>=0&&c.color<4));
  }
  assert.equal(blocks.state.status,'complete');assert.ok(blocks.state.score>=BLOCK_TARGET,'reaching the passing line can score past 1000');
  const moles=createMiniGame('moles',{random:seeded(seed),now:100});
  assert.equal(moles.state.molePlan.length,10);assert.equal(moles.state.molePlan.reduce((a,b)=>a+b),40);
  assert.ok(moles.state.molePlan.every(n=>n>=2&&n<=6));
  let time=101;
  for(let wave=1;wave<=10;wave++) {
    assert.equal(moles.state.wave,wave);
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
  assert.equal(game.select(0,30500),0);assert.equal(game.state.status,'timeout');assert.equal(game.state.score,score);
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
const cross=isolatedTrio(990);
assert.equal(cross.select(90,1),30);
assert.equal(cross.state.score,1020);assert.equal(cross.state.status,'complete');
assert.equal(cross.select(5,2),0);assert.equal(cross.state.score,1020,'a finished round keeps the overflow instead of clamping');
const stacked=isolatedTrio(990);
stacked.state.combo=2;
assert.equal(stacked.select(90,1),comboPoints(30,3));
assert.equal(stacked.state.score,990+comboPoints(30,3));
assert.equal(secretPayout(stacked.state.score,2),stacked.state.score*2,'secret ×2 applies to the full combo score');
assert.ok(secretPayout(stacked.state.score,2)>2000);
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
assert.ok(chain.state.combo>=2, 'a drop that joins three blocks counts as another combo');
assert.ok(chained>comboPoints(30,1));
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
console.log('PASS: combo multipliers, broken streaks, uncapped scores past 1000, drop chains, gravity, and secret ×2 on the full total.');
