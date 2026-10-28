import assert from 'node:assert/strict';
import { sceneMotionAt, sceneMotionSample, project2DMotion, CHARGE_SHAKE_X, CHARGE_SHAKE_Y, CHARGE_SHAKE_BOOST_X, CHARGE_SHAKE_BOOST_Y, CHARGE_SHAKE_ROTATION, REWARD_SHAKE_X, REWARD_SHAKE_Y, SOFT_LAUNCH_SCALE } from '../src/scene-motion.js';
import { CHARGE_DURATION, OVERCHARGE_DURATION, BURST_READY_AT } from '../src/charge.js';
const chargePeakX = CHARGE_SHAKE_X + CHARGE_SHAKE_BOOST_X, chargePeakY = CHARGE_SHAKE_Y + CHARGE_SHAKE_BOOST_Y;
assert.equal(chargePeakX, 5.5);
assert.equal(chargePeakY, 4);
assert.equal(CHARGE_SHAKE_ROTATION, 0);
const resting = sceneMotionAt(123, {}, {});
assert.equal(resting.intensity, 0);
assert.deepEqual(project2DMotion(713,787,resting), {x:713/760,y:787/900});
const midCharge = CHARGE_DURATION + OVERCHARGE_DURATION / 2;
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:CHARGE_DURATION},{}).intensity,0);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:midCharge},{}).intensity,.5);
assert.equal(sceneMotionAt(10,{charging:true,chargeElapsed:BURST_READY_AT},{}).intensity,1);
assert.equal(sceneMotionAt(10,{}, {shake:1.5}).intensity,.3);
for (const chargeElapsed of [0, CHARGE_DURATION - 1, CHARGE_DURATION, midCharge, BURST_READY_AT - 1, BURST_READY_AT, BURST_READY_AT + 100, 10000, 60000]) {
  assert.equal(sceneMotionAt(100,{charging:true,chargeElapsed},{shake:12}).rotation,0,'camera never rotates, even during long holds');
}
let maxX=0, maxY=0, rewardX=0, rewardY=0;
for (let clock=0;clock<10000;clock++) {
  const motion=sceneMotionAt(clock,{charging:true,chargeElapsed:BURST_READY_AT+clock},{});
  assert.ok(Math.abs(motion.x)<=chargePeakX+1e-9 && Math.abs(motion.y)<=chargePeakY+1e-9);
  assert.equal(motion.rotation,CHARGE_SHAKE_ROTATION);
  assert.ok(Math.abs(motion.uiX)<=.45 && Math.abs(motion.uiY)<=.3);
  maxX=Math.max(maxX,Math.abs(motion.x));maxY=Math.max(maxY,Math.abs(motion.y));
  const both=sceneMotionAt(clock,{charging:true,chargeElapsed:BURST_READY_AT+clock},{shake:12});
  assert.ok(Math.abs(both.x)<=Math.max(chargePeakX,REWARD_SHAKE_X)+1e-9 && Math.abs(both.y)<=Math.max(chargePeakY,REWARD_SHAKE_Y)+1e-9,'charge and reward shakes are not stacked');
  const calm=sceneMotionAt(clock,{calm:true,charging:true,chargeElapsed:BURST_READY_AT+clock},{shake:12});
  for (const value of Object.values(calm)) assert.ok(value===0,'calm mode disables all motion');
  const reward=sceneMotionAt(clock,{}, {shake:12});
  assert.equal(reward.rotation,0);
  assert.ok(Math.abs(reward.x)<=REWARD_SHAKE_X && Math.abs(reward.y)<=REWARD_SHAKE_Y,'ordinary reward shake keeps its existing amplitude');
  rewardX=Math.max(rewardX,Math.abs(reward.x));rewardY=Math.max(rewardY,Math.abs(reward.y));
}
assert.ok(maxX>chargePeakX-0.01 && maxY>chargePeakY-0.01,'full rainbow shake reaches the halved charge peaks');
assert.ok(rewardX>REWARD_SHAKE_X-0.01 && rewardY>REWARD_SHAKE_Y-0.01,'reward shake still reaches 7 by 5');
let previous=sceneMotionAt(10,{charging:true,chargeElapsed:CHARGE_DURATION},{});
const maxDu = 1.5 * (10 / OVERCHARGE_DURATION);
const maxStep = Math.max(Math.abs(Math.sin(.01 * 47)) * (CHARGE_SHAKE_X + 3 * CHARGE_SHAKE_BOOST_X), Math.abs(Math.cos(.01 * 41)) * (CHARGE_SHAKE_Y + 3 * CHARGE_SHAKE_BOOST_Y)) * maxDu + 1e-4;
for (let chargeElapsed=CHARGE_DURATION + 10;chargeElapsed<=BURST_READY_AT + 100;chargeElapsed+=10) {
  const motion=sceneMotionAt(10,{charging:true,chargeElapsed},{});
  assert.ok(motion.x>=previous.x && motion.y>=previous.y,'displacement grows with charge');
  assert.ok(motion.x-previous.x<=maxStep && motion.y-previous.y<=maxStep,'charge grows without snapping');
  previous=motion;
}
for (const [x,y] of [[713,787],[686,724],[741,884],[0,0],[760,900]]) {
  const shifted=project2DMotion(x,y,{x:chargePeakX,y:-chargePeakY,rotation:CHARGE_SHAKE_ROTATION});
  assert.deepEqual(shifted,{x:(x+chargePeakX)/760,y:(y-chargePeakY)/900},'hit targets follow translation without rotation');
}
const full = { charging: true, chargeElapsed: BURST_READY_AT };
let violent = false;
for (let clock = 30000; clock < 32000; clock += 50) {
  const from = sceneMotionSample(clock, full, {});
  const to = sceneMotionSample(clock + 50, full, {});
  if (Math.hypot(to.x - from.x, to.y - from.y) > 6) violent = true;
}
assert.ok(violent, 'a 50ms hitch can ask the fast charge wave for a large jump');
const held = sceneMotionAt(40000, full, {});
const hitched = sceneMotionAt(40050, full, {});
assert.ok(Math.abs(hitched.x - held.x) <= 4.6 && Math.abs(hitched.y - held.y) <= 4.6, 'a slow frame cannot snap the board across the shake');
let chargeOnly = 0;
for (let clock = 50000; clock < 51000; clock++) {
  const motion = sceneMotionAt(clock, { ...full, softLaunch: true }, {});
  chargeOnly = Math.max(chargeOnly, Math.abs(motion.x), Math.abs(motion.y));
}
assert.ok(chargeOnly <= chargePeakX * SOFT_LAUNCH_SCALE + 1e-6, 'reduced launch shake stays near 28% of the charge peak');
assert.ok(chargeOnly > chargePeakX * SOFT_LAUNCH_SCALE * 0.85, 'reduced launch shake still reaches its lighter peak');
let softMax = 0;
for (let clock = 60000; clock < 61000; clock++) {
  const motion = sceneMotionAt(clock, { ...full, softLaunch: true }, { shake: 12 });
  softMax = Math.max(softMax, Math.abs(motion.x), Math.abs(motion.y));
  assert.ok(Math.abs(motion.x) <= Math.max(chargePeakX * SOFT_LAUNCH_SCALE, REWARD_SHAKE_X) + 1e-6);
  assert.ok(Math.abs(motion.uiX) <= .45 * SOFT_LAUNCH_SCALE + 1e-6);
}
assert.ok(softMax > chargePeakX * SOFT_LAUNCH_SCALE * 0.5, 'reduced launch shake is still visible');
assert.ok(softMax <= REWARD_SHAKE_X + 1e-6, 'charge and reward shakes stay inside the reward cap');
console.log('PASS: charge shake peaks at 5.5 by 4, reward shake stays at 7 by 5, no camera rotation, matching hit projection and reduced motion.');
