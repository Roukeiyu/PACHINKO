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
assert.equal(storage.collector.remaining,40);storage.setEmissionPaused(true);
for(let i=0;i<600;i++)storage.step();assert.equal(storage.stats.storageDrops,0);assert.equal(storage.collector.remaining,40,'earned drops remain stored during the secret wait');
storage.setEmissionPaused(false);
for(let i=0;i<40;i++)storage.step();assert.ok(storage.stats.storageDrops>0&&storage.stats.storageDrops<4,'earned drops resume their original spacing');
console.log('PASS: actual secret entry locks every launcher, cancels pending charged shots, preserves earned stored drops and resumes their release schedule.');
