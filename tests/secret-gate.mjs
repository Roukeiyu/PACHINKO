import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP } from '../src/physics.js';
let game;const scores=[];
game=createTable({random:()=>.5,onScore:result=>{scores.push(result);if(result.kind==='jackpot')game.setEmissionPaused(true);}});
const first=game.launchBurst();assert.equal(game.pendingLaunches,4);
first.entered=true;Matter.Body.setPosition(first.body,game.holes[0]);Matter.Body.setVelocity(first.body,{x:0,y:0});
game.step();assert.equal(scores[0].kind,'jackpot');assert.equal(game.emissionPaused,true);assert.equal(game.pendingLaunches,0);
assert.equal(game.launch(1),null);assert.equal(game.launchBurst(),null);
for(let i=0;i<120;i++)game.step();assert.equal(game.stats.launches,1,'secret lock cancels un-fired burst shots');
game.setEmissionPaused(false);assert.ok(game.launch(.1));
const storage=createTable({random:()=>.5});
for(let n=0;n<20;n++){
 const ball=storage.launch();ball.entered=true;Matter.Body.setPosition(ball.body,{x:100,y:606});Matter.Body.setVelocity(ball.body,{x:0,y:5});
 for(let i=0;i<30&&storage.balls.includes(ball);i++)storage.step();
}
assert.equal(storage.collector.remaining,20);storage.setEmissionPaused(true);
for(let i=0;i<600;i++)storage.step();assert.equal(storage.stats.storageDrops,0);assert.equal(storage.collector.remaining,20,'earned drops remain stored during the secret wait');
storage.setEmissionPaused(false);
for(let i=0;i<40;i++)storage.step();assert.ok(storage.stats.storageDrops>0&&storage.stats.storageDrops<4,'earned drops resume their original spacing');
const held=createTable({random:()=>.5});
assert.equal(held.forceEnlarge(),58.5);
held.rewards.burstUntil=held.clock+1200;
const burstLeft=held.rewards.burstUntil-held.clock;
const enlargeLeft=held.rewards.enlargedUntil-held.clock;
held.setEmissionPaused(true);
const pausedSteps=Math.round(3000/STEP);
for(let i=0;i<pausedSteps;i++)held.step();
const enlargeNow=held.rewards.enlargedUntil-held.clock;
assert.ok(Math.abs(enlargeNow-(enlargeLeft-pausedSteps*STEP))<1e-3,'center enlarge keeps counting while secret emission is paused');
assert.equal(held.bumpers[2].plugin.radius,58.5,'the drum stays large until its own 10s elapses');
assert.ok(Math.abs((held.rewards.burstUntil-held.clock)-burstLeft)<1e-4,'clock-burst pips still freeze while emission is paused');
const drum=held.bumpers[2],spinner=held.spinners[0];
let minGap=Infinity,overlaps=0;
for(let i=0;i<=40;i++){
  const angle=Math.sin(i/40*Math.PI*2)*.85;
  Matter.Body.setAngle(spinner,angle);
  const dx=spinner.position.x-drum.position.x,dy=spinner.position.y-drum.position.y,dist=Math.hypot(dx,dy);
  const ux=-dx/dist,uy=-dy/dist,c=Math.cos(angle),s=Math.sin(angle);
  const support=Math.abs(ux*c+uy*s)*61+Math.abs(-ux*s+uy*c)*6.5;
  minGap=Math.min(minGap,dist-drum.plugin.radius-support);
  overlaps+=Matter.Query.collides(drum,[spinner]).length;
}
assert.ok(minGap>18,`enlarged center drum stays clear of the spinner (${minGap.toFixed(2)}px)`);
assert.equal(overlaps,0,'the grown drum does not intersect the spinner');
assert.equal(drum.plugin.radius,58.5);
const rest=Math.ceil(enlargeNow/STEP);
for(let i=0;i<rest;i++)held.step();
assert.equal(held.rewards.enlargedUntil,0,'enlarge expires during the secret pause');
assert.equal(held.bumpers[2].plugin.radius,39,'the center drum shrinks without waiting for balls to finish draining');
assert.equal(held.emissionPaused,true);
const wall=createTable({random:()=>.5});
assert.equal(wall.forceEnlarge(),58.5);
const wallLeft=wall.rewards.enlargedUntil-wall.clock;
const wallClock=wall.clock;
const wallBalls=wall.balls.length;
wall.advanceEnlarge(4000);
assert.equal(wall.clock,wallClock,'wall-clock enlarge does not advance the simulation clock');
assert.ok(Math.abs((wall.rewards.enlargedUntil-wall.clock)-(wallLeft-4000))<1e-6,'settings and mini-game pauses still age the enlarge');
assert.equal(wall.bumpers[2].plugin.radius,58.5);
assert.equal(wall.balls.length,wallBalls,'aging the enlarge does not step the balls');
wall.advanceEnlarge(wallLeft-4000+25);
assert.equal(wall.rewards.enlargedUntil,0,'a wall-clock pause shrinks the drum when 10s elapse');
assert.equal(wall.bumpers[2].plugin.radius,39);
assert.equal(wall.advanceEnlarge(1000),false);
const reasons=[];
const returns=createTable({random:()=>.5,onReturn:event=>reasons.push(event.reason)});
const weak=returns.launch(0);
for(let i=0;i<80&&returns.balls.includes(weak);i++)returns.step();
assert.equal(reasons.at(-1),'weak');
const out=returns.launch();out.entered=true;Matter.Body.setPosition(out.body,{x:700,y:980});Matter.Body.setVelocity(out.body,{x:0,y:0});
returns.step();assert.equal(reasons.at(-1),'out');
const timeout=returns.launch();timeout.entered=true;timeout.born=returns.clock-45001;
Matter.Body.setPosition(timeout.body,{x:200,y:400});Matter.Body.setVelocity(timeout.body,{x:0,y:0});
returns.step();assert.equal(reasons.at(-1),'timeout');assert.equal(returns.stats.timeouts,1);
console.log('PASS: actual secret entry locks every launcher, cancels pending charged shots, preserves earned stored drops and resumes their release schedule. The center enlarge keeps expiring during that pause, clock-burst pips stay frozen, and returns report weak/out/timeout.');

// A secret visit used to let a ball keep tapping the center drum while shots
// were held. The meter filled, and the 12-shot clock appeared when the
// mini-game ended. The visit itself must not move the meter or arm a clock.
{
  const visit = createTable({ random: () => 0.4, centerHitWeight: ball => {
    const raw = Math.floor(Number(ball?.valueFactor));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  } });
  visit.rewards.hits[2] = 4;
  const farmer = visit.launch();
  farmer.entered = true;
  farmer.valueFactor = 8;
  Matter.Body.setPosition(farmer.body, { x: 350, y: 340 });
  Matter.Body.setVelocity(farmer.body, { x: 0, y: 1 });
  const hole = visit.holes[0];
  const secret = visit.launch();
  secret.entered = true;
  secret.valueFactor = 8;
  Matter.Body.setPosition(secret.body, { x: hole.x, y: hole.y });
  Matter.Body.setVelocity(secret.body, { x: 0, y: 0 });
  visit.step();
  assert.equal(visit.stats.jackpots, 1, 'the placed ball still opens the secret hole');
  const hitsAtStart = visit.rewards.hits[2];
  const pendingAtStart = visit.pendingShotCount;
  const clocksAtStart = visit.stats.clockBursts;
  visit.setEmissionPaused(true);
  for (let i = 0; i < Math.round(4000 / STEP); i++) visit.step();
  visit.setEmissionPaused(false);
  for (let i = 0; i < Math.round(2000 / STEP); i++) visit.step();
  assert.equal(visit.rewards.hits[2], hitsAtStart, 'a secret visit does not advance the center drum');
  assert.equal(visit.stats.clockBursts, clocksAtStart, 'a secret visit fires no clock');
  assert.equal(visit.pendingShotCount, pendingAtStart, 'a secret visit does not queue clock shots');
  const still = visit.balls.find(ball => ball.id === farmer.id);
  if (still) assert.ok(Math.abs(still.body.position.x - 350) > 24 || still.body.position.y > 400, 'the ball above the bell is not left in that column');
  console.log('PASS: finishing a secret visit leaves the clock meter and pending shots unchanged.');
}
