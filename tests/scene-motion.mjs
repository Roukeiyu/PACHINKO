import assert from 'node:assert/strict';
import { sceneMotionAt, project2DMotion } from '../src/scene-motion.js';
const resting = sceneMotionAt(123, {}, {});
assert.equal(resting.intensity, 0);
assert.deepEqual(project2DMotion(713,787,resting), {x:713/760,y:787/900});
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:1000},{}).intensity,0);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:2000},{}).intensity,.5);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:3000},{}).intensity,1);
assert.equal(sceneMotionAt(10,{}, {shake:1.5}).intensity,.3);
for (const chargeElapsed of [0,999,1000,2000,2999,3000,3100,10000,60000]) {
  assert.equal(sceneMotionAt(100,{charging:true,chargeElapsed},{shake:12}).rotation,0,'camera never rotates, even during long holds');
}
let maxX=0, maxY=0;
for (let clock=0;clock<10000;clock++) {
  const motion=sceneMotionAt(clock,{charging:true,chargeElapsed:3000+clock},{shake:12});
  assert.ok(Math.abs(motion.x)<=11 && Math.abs(motion.y)<=8);
  assert.equal(motion.rotation,0);
  assert.ok(Math.abs(motion.uiX)<=.45 && Math.abs(motion.uiY)<=.3);
  maxX=Math.max(maxX,Math.abs(motion.x));maxY=Math.max(maxY,Math.abs(motion.y));
  const calm=sceneMotionAt(clock,{calm:true,charging:true,chargeElapsed:3000+clock},{shake:12});
  for (const value of Object.values(calm)) assert.ok(value===0,'calm mode disables all motion');
  const reward=sceneMotionAt(clock,{}, {shake:12});
  assert.equal(reward.rotation,0);
  assert.ok(Math.abs(reward.x)<=7 && Math.abs(reward.y)<=5,'ordinary reward shake keeps its existing amplitude');
}
assert.ok(maxX>10.99 && maxY>7.99,'full rainbow shake is stronger in both axes');
let previous=sceneMotionAt(10,{charging:true,chargeElapsed:1000},{});
for (let chargeElapsed=1010;chargeElapsed<=3100;chargeElapsed+=10) {
  const motion=sceneMotionAt(10,{charging:true,chargeElapsed},{});
  assert.ok(motion.x>=previous.x && motion.y>=previous.y,'displacement grows with charge');
  assert.ok(motion.x-previous.x<.12 && motion.y-previous.y<.12,'charge grows without snapping');
  previous=motion;
}
for (const [x,y] of [[713,787],[686,724],[741,884],[0,0],[760,900]]) {
  const shifted=project2DMotion(x,y,{x:11,y:-8,rotation:0});
  assert.deepEqual(shifted,{x:(x+11)/760,y:(y-8)/900},'hit targets follow translation without rotation');
}
console.log('PASS: stronger gradual translation-only charge, no camera rotation during long holds, unchanged reward/UI shake, matching hit projection and reduced motion.');
