import assert from 'node:assert/strict';
import { createMiniGame, MINI_GAMES, MINI_DURATION, connectedBlocks, randomMiniGame } from '../src/mini-games.js';
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
  for(const group of Object.values(groups)) {
    assert.equal(pairs.select(group[0].index,1000),0);assert.equal(pairs.select(group[1].index,1000),50);
    assert.equal(pairs.state.board[group[0].index],null);
  }
  assert.equal(pairs.state.score,1000);assert.equal(pairs.state.status,'complete');
  assert.equal(pairs.select(0,1001),0);assert.equal(pairs.state.score,1000);
  const blocks=createMiniGame('blocks',{random:seeded(seed),now:100});
  let moves=0;
  while(blocks.state.status==='playing'&&moves++<100) {
    const index=blocks.state.board.findIndex((_,i)=>connectedBlocks(blocks.state.board,i).length>=3);
    assert.ok(index>=0,'refilled boards always have a legal move');
    const before=blocks.snapshot(),group=connectedBlocks(before.board,index),removed=new Set(group);
    const points=blocks.select(index,1000);
    assert.equal(points,group.length*10);assert.equal(blocks.state.board.length,100);
    assert.ok(blocks.state.board.every(c=>c.color>=0&&c.color<4));
    for(let x=0;x<10;x++) {
      const kept=before.board.filter((c,i)=>i%10===x&&!removed.has(i)).map(c=>c.id);
      const after=blocks.state.board.filter((c,i)=>i%10===x).slice(10-kept.length).map(c=>c.id);
      assert.deepEqual(after,kept,'gravity keeps the remaining column in its original order');
    }
  }
  assert.equal(blocks.state.status,'complete');assert.ok(blocks.state.score>=1000);
  const moles=createMiniGame('moles',{random:seeded(seed),now:100});
  assert.equal(moles.state.molePlan.length,10);assert.equal(moles.state.molePlan.reduce((a,b)=>a+b),40);
  assert.ok(moles.state.molePlan.every(n=>n>=2&&n<=6));
  let time=101;
  for(let wave=1;wave<=10;wave++) {
    assert.equal(moles.state.wave,wave);
    const cabbage=moles.state.board.findIndex(c=>c.type==='cabbage');
    assert.equal(moles.select(cabbage,time),0);
    const indices=moles.state.board.flatMap((c,i)=>c.type==='mole'?[i]:[]);
    for(const [j,index] of indices.entries()) {
      assert.equal(moles.select(index,time++),25);
      if(j<indices.length-1) assert.equal(moles.select(index,time),0,'repeat clicks never score twice');
    }
  }
  assert.equal(moles.state.status,'complete');assert.equal(moles.state.hit,40);assert.equal(moles.state.score,1000);
}
const noHit=createMiniGame('moles');
for(let round=1;round<=9;round++){noHit.tick(round*3000);assert.equal(noHit.state.wave,round+1);}
noHit.tick(30000);assert.equal(noHit.state.status,'complete');assert.equal(noHit.state.score,0);
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
console.log('PASS: 40 visible cards/20 pairs, 4-color connected groups and gravity/refill, 1000-point completion, 10 variable waves totalling 40 moles, cabbage/repeat-click guards and exact 30-second partial-score settlement.');
