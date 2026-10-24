import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createMiniGame, randomMiniGame, miniGameIdle, miniIntro, MINI_GAMES, SLING_DURATION, SLING_TARGET, SLING_TOTAL, SLING_POINT, SLING_WIN_BONUS } from '../src/mini-games.js';
import { SLING_AREA, SLING_BLOCK_W, SLING_BLOCK_H, SLING_FALL_MS, SLING_RELOAD, SLING_X, SLING_Y, SLING_MAX_ANGLE, outsideSlingArea } from '../src/mini-sling.js';
const fire=(g,point={x:72,y:268})=>{g.setAim(point);return g.release();};
const tile=(x,y,angle=0)=>Matter.Bodies.rectangle(x,y,SLING_BLOCK_W,SLING_BLOCK_H,{angle});
const a=SLING_AREA,platform=Matter.Bodies.rectangle((a.left+a.right)/2,(a.top+a.bottom)/2,a.right-a.left,a.bottom-a.top);
for(const [x,y,angle,expected] of [[a.left-12,160,0,false],[a.left-16,160,0,false],[a.left-17,160,0,true],[160,60,0,false],[160,53,0,true],[a.left-23,160,Math.PI/4,true],[a.left-22,160,Math.PI/4,false],[a.left-12,58,Math.PI/4,true],[a.left-11,59,Math.PI/4,false]]) {
  assert.equal(outsideSlingArea(tile(x,y,angle).vertices),expected,`whole rotated tile boundary ${x},${y},${angle}`);
}
assert.equal(Object.keys(MINI_GAMES).length,5);
assert.equal(miniIntro('sling').goal,`全部推出 ${SLING_TARGET} 块，最多 30 秒`);
assert.equal(randomMiniGame(()=>.999),'sling');assert.notEqual(randomMiniGame(()=>.999,'sling'),'sling');
const idle=createMiniGame('sling',{now:100}),initial=idle.snapshot();
assert.equal(initial.blocks.length,SLING_TOTAL);idle.tick(100+SLING_DURATION-1);
assert.equal(idle.state.status,'playing');assert.deepEqual(idle.state.blocks,initial.blocks,'zero-gravity platform stays still without input');
idle.tick(100+SLING_DURATION);assert.equal(idle.state.status,'timeout');assert.equal(idle.state.removed,0);
assert.equal(idle.remaining(100+SLING_DURATION),0);assert.equal(miniGameIdle(idle.state),true);assert.equal(fire(idle),false);

function play(strategy,cadence=100,interval=500) {
  const game=createMiniGame('sling'),counted=new Map();let clock=0;
  function advance(until) {
    while(clock<until && game.state.status==='playing') {
      clock=Math.min(until,clock+cadence);game.tick(clock);
      for(const b of game.state.blocks) if(b.down) {
        assert.equal(Matter.Collision.collides(tile(b.x,b.y,b.angle),platform),null,'a scored tile has fully left the drawn platform');
        const previous=counted.get(b.id);
        if(previous){assert.equal(b.x,previous.x);assert.equal(b.y,previous.y);assert.equal(b.angle,previous.angle);assert.ok(b.scale<=previous.scale,'each fallen piece shrinks about its own fixed center');}
        counted.set(b.id,{...b});
      }
      assert.equal(game.state.removed,counted.size,'a piece scores once even while shrinking');
    }
  }
  for(let shot=0;shot*interval<SLING_DURATION && game.state.status==='playing';shot++) {
    advance(shot*interval);if(game.state.status==='playing')fire(game,strategy(game.state,shot));
  }
  advance(SLING_DURATION);return game;
}
const nearest=s=>s.blocks.filter(b=>!b.down).sort((a,b)=>b.y-a.y)[0];
const sweep=(s,n)=>{const angle=[-50,-35,-22,-10,0,10,22,35,50][n%9]*Math.PI/180;return{x:SLING_X+Math.sin(angle)*200,y:SLING_Y-Math.cos(angle)*200};};
for(const strategy of [nearest,sweep]) {
  const g=play(strategy);assert.equal(g.state.status,'complete');assert.equal(g.state.removed,25);
  assert.equal(g.state.blocks.filter(b=>!b.down).length,0,'including the last corner block');
  assert.ok(g.state.lastSim<SLING_DURATION);assert.equal(g.state.score,25*SLING_POINT+SLING_WIN_BONUS);
  const frozen=g.snapshot();g.tick(100000);fire(g);g.stop();assert.deepEqual(g.snapshot(),frozen);
}
const straight=play(()=>({x:160,y:100}));assert.equal(straight.state.status,'timeout');assert.ok(straight.state.removed<25);
assert.deepEqual(play(nearest,17).snapshot(),play(nearest,100).snapshot(),'fixed physics cadence');
const bounds=createMiniGame('sling');for(const point of [{x:-1000,y:365},{x:1000,y:1000},{x:160,y:10}]){bounds.setAim(point);assert.equal(bounds.state.originX,160);assert.equal(bounds.state.originY,365);assert.ok(Math.abs(bounds.state.aimAngle)<=SLING_MAX_ANGLE);assert.ok(bounds.state.pull.dy<0);}bounds.dispose();
const one=createMiniGame('sling');assert.equal(fire(one),true);assert.equal(one.state.shots[0].x,160);assert.equal(one.state.shots[0].y,365);assert.ok(one.state.shots[0].vy<0);one.tick(100);
assert.ok(one.state.shots[0].y<SLING_Y,'projectile moves upward from the bottom');
assert.equal(fire(one),false,'reload prevents duplicate release');one.tick(SLING_RELOAD-1);assert.equal(fire(one),false);
one.tick(SLING_RELOAD);assert.equal(fire(one,{x:116,y:268}),true,'rapid repeat is available exactly after reload');one.dispose();
const partial=createMiniGame('sling');fire(partial);let fallAt=0;
for(;fallAt<2000&&!partial.state.blocks.some(b=>b.down);fallAt+=10)partial.tick(fallAt);
partial.tick(fallAt+20);
const falling=partial.state.blocks.find(b=>b.down);assert.ok(falling&&falling.scale>0&&falling.scale<1);
const pose={...falling};partial.tick(fallAt+SLING_FALL_MS);
const gone=partial.state.blocks.find(b=>b.id===falling.id);assert.equal(gone.scale,0);assert.equal(gone.x,pose.x);assert.equal(gone.y,pose.y);
partial.tick(SLING_DURATION);assert.ok(partial.state.removed>0&&partial.state.removed<SLING_TARGET);
assert.equal(partial.state.score,partial.state.removed*SLING_POINT);assert.equal(partial.state.shots.length,0);
const missed=createMiniGame('sling');fire(missed,{x:-1000,y:365});missed.tick(SLING_DURATION);assert.equal(missed.state.removed,0);assert.equal(miniGameIdle(missed.state),true);
const canceled=createMiniGame('sling');canceled.setAim({x:72,y:268});canceled.clearAim();assert.equal(canceled.release(),false);assert.equal(canceled.state.fired,0);
fire(canceled);canceled.tick(200);canceled.stop();const stopped=canceled.snapshot();canceled.tick(20000);assert.deepEqual(canceled.snapshot(),stopped);assert.equal(canceled.state.status,'aborted');assert.equal(canceled.state.shots.length,0);
const disposed=createMiniGame('sling');disposed.dispose();assert.equal(fire(disposed),false);
const retry=createMiniGame('sling');assert.equal(retry.state.score,0);assert.equal(retry.state.fired,0);assert.equal(retry.state.removed,0);assert.ok(retry.state.blocks.every(b=>!b.down&&b.scale===1));retry.dispose();
console.log('PASS: top-down collisions, whole/rotated boundary exits, fixed-center shrink and one score, fixed-turret 5x5 full clears versus straight spam, idle stability, 30s deadline, reload, stop and clean replay.');
