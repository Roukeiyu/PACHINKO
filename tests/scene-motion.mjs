import assert from 'node:assert/strict';
import { sceneMotionAt, project2DMotion } from '../src/scene-motion.js';
const resting = sceneMotionAt(123, {}, {});
assert.equal(resting.intensity, 0);
assert.deepEqual(project2DMotion(713,787,resting), {x:713/760,y:787/900});
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:2000},{}).intensity,0);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:3500},{}).intensity,.5);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:5000},{}).intensity,1);
assert.equal(sceneMotionAt(10,{}, {shake:1.5}).intensity,.3);
for (const chargeElapsed of [0,1999,2000,3500,4999,5000]) assert.equal(sceneMotionAt(100,{charging:true,chargeElapsed},{shake:12}).rotation,0,'no rotation before the rainbow charge is fully ready');
assert.equal(sceneMotionAt(100,{}, {shake:12}).rotation,0,'reward shake only translates the camera');
let varied = new Set(), previous=0;
for (let clock=0;clock<10000;clock++) {
  const motion=sceneMotionAt(clock,{charging:true,chargeElapsed:5000+clock},{shake:12});
  assert.ok(Math.abs(motion.x)<=7 && Math.abs(motion.y)<=5 && Math.abs(motion.rotation)<=3);
  assert.ok(Math.abs(motion.uiX)<=.45 && Math.abs(motion.uiY)<=.3);
  varied.add(motion.rotation.toFixed(1));
  assert.ok(Math.abs(motion.rotation-previous)<.01,'random camera targets ease continuously');previous=motion.rotation;
  assert.equal(sceneMotionAt(clock,{calm:true,charging:true,chargeElapsed:5000+clock},{shake:12}).rotation,0);
  assert.equal(sceneMotionAt(clock,{calm:true,charging:true,chargeElapsed:5000+clock},{shake:12}).intensity,0);
}
assert.ok(varied.size>20,'fully charged camera roll varies instead of following a periodic sine');
assert.notEqual(sceneMotionAt(500,{charging:true,chargeElapsed:6500,chargeSeed:1},{}).rotation,sceneMotionAt(500,{charging:true,chargeElapsed:6500,chargeSeed:2},{}).rotation,'each hold can choose different random targets');
const rotated=project2DMotion(400,450,{x:0,y:0,rotation:3});
assert.ok(rotated.x>380/760 && rotated.y>450/900,'the hit projection follows the rotating 2D drawing');
console.log('PASS: gradual scene motion, translation-only charge/reward shake, fully-ready random ±3° camera roll, subpixel UI displacement, matching 2D hit projection and reduced motion.');
