import assert from 'node:assert/strict';
import { sceneMotionAt, project2DMotion } from '../src/scene-motion.js';
const resting = sceneMotionAt(123, {}, {});
assert.equal(resting.intensity, 0);
assert.deepEqual(project2DMotion(713,787,resting), {x:713/760,y:787/900});
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:2000},{}).intensity,0);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:3500},{}).intensity,.5);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:5000},{}).intensity,1);
assert.equal(sceneMotionAt(10,{}, {shake:1.5}).intensity,.3);
let left=false,right=false;
for (let clock=0;clock<2000;clock++) {
  const motion=sceneMotionAt(clock,{charging:true,chargeElapsed:9000},{shake:12});
  assert.ok(Math.abs(motion.x)<=7 && Math.abs(motion.y)<=5 && Math.abs(motion.rotation)<=5);
  assert.ok(Math.abs(motion.uiX)<=.45 && Math.abs(motion.uiY)<=.3);
  left ||= motion.rotation < -4.99; right ||= motion.rotation > 4.99;
  assert.equal(sceneMotionAt(clock,{calm:true,charging:true,chargeElapsed:9000},{shake:12}).intensity,0);
}
assert.ok(left&&right,'automatic rotation reaches both sides without exceeding five degrees');
const rotated=project2DMotion(400,450,{x:0,y:0,rotation:5});
assert.ok(rotated.x>380/760 && rotated.y>450/900,'the hit projection follows the rotating 2D drawing');
console.log('PASS: gradual scene motion, ±5° rotation, subpixel UI displacement, matching 2D hit projection and reduced motion.');
