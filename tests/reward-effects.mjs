import assert from 'node:assert/strict';
import { celebrateReward, advanceCelebrations, rewardProfile, rewardSceneAt, marqueePoint, LUCKY_LAP_DURATION, activeRewardScenes } from '../src/reward-effects.js';

const makeFx = () => ({ celebrations: [], particles: [], ripples: [], shake: 0 });
const result = multiplier => ({ kind: 'slot', multiplier, x: 350, y: 865 });
const events = [2, 3, 5, 10].map(result).concat([{ kind: 'jackpot', x: 615, y: 482 }, { kind: 'clock', x: 350, y: 367 }]);
let previous = { particles: 0, duration: 0, radius: 0, notes: 0 };
for (const event of events) {
  const fx = makeFx(), profile = celebrateReward(fx, event, false, () => .5);
  const firstWave = fx.particles.length;
  advanceCelebrations(fx, 159, false, () => .5);
  assert.equal(fx.particles.length, firstWave, 'secondary waves are delayed');
  advanceCelebrations(fx, (profile.waveInterval ?? 160) * Math.max(1, profile.waves), false, () => .5);
  assert.equal(fx.particles.length, profile.count * profile.waves, 'every scheduled wave fires once');
  assert.ok(fx.particles.length > previous.particles, 'larger rewards emit richer bursts');
  assert.ok(profile.duration > 0 && profile.radius > previous.radius && profile.notes.length > previous.notes);
  previous = { particles: fx.particles.length, duration: profile.duration, radius: profile.radius, notes: profile.notes.length };
  assert.ok(fx.particles.every(p => Number.isFinite(p.vx) && Number.isFinite(p.vy) && p.size <= 5));
  advanceCelebrations(fx, profile.duration, false);
  assert.equal(fx.celebrations.length, 0, 'finished choreography is cleaned up');
  const count = fx.particles.length;
  advanceCelebrations(fx, 5000, false);
  assert.equal(fx.particles.length, count, 'finished celebrations cannot emit again');
}
assert.equal(new Set([2, 3, 5, 10].map(m => rewardProfile(result(m)).shape)).size, 4);
console.log('PASS: four distinct slot styles scale up through the secret hole to the largest 30-hit celebration.');

for (const event of events) {
  const fx = makeFx(); celebrateReward(fx, event, true);
  advanceCelebrations(fx, 900, true);
  assert.ok(fx.particles.length <= 8 && fx.ripples.length === 1);
  assert.equal(fx.shake, 0, 'calm mode has no screen shake');
}
const toggled = makeFx(); celebrateReward(toggled, events.at(-1), false);
advanceCelebrations(toggled, 300, true);
assert.equal(toggled.particles.length, 28, 'enabling calm mode cancels remaining waves');

const busy = makeFx(); celebrateReward(busy, events.at(-1), false); celebrateReward(busy, events.at(-2), false);
for (let i = 0; i < 100; i++) celebrateReward(busy, result(10), false);
advanceCelebrations(busy, 800, false);
assert.ok(busy.particles.length <= 360 && busy.ripples.length <= 100 && busy.celebrations.length <= 16);
assert.ok(busy.celebrations.some(b => b.kind === 'clock'), 'ordinary scores cannot evict the central celebration');
console.log('PASS: reduced motion suppresses extra waves, multiball effects stay bounded, and the central celebration keeps priority.');

const treasure = makeFx(); celebrateReward(treasure, events.at(-2), false, () => .5);
advanceCelebrations(treasure, 699, false, () => .5); assert.equal(treasure.particles.length, 20);
advanceCelebrations(treasure, 1, false, () => .5); assert.equal(treasure.particles.length, 40);
advanceCelebrations(treasure, 4300, false, () => .5);
assert.equal(treasure.celebrations.length, 1, 'treasure remains visible after five active seconds');
assert.equal(treasure.particles.length, 80, 'four spaced waves fire exactly once');
const paused = treasure.celebrations[0].age;
advanceCelebrations(treasure, 0, false); assert.equal(treasure.celebrations[0].age, paused);
advanceCelebrations(treasure, 500, false); assert.equal(treasure.celebrations.length, 0);
assert.ok(busy.celebrations.some(b => b.kind === 'jackpot'), 'ordinary multiball scores preserve the long treasure effect');

const lucky = makeFx(); celebrateReward(lucky, result(10), false);
const burst = lucky.celebrations[0];
let previousProgress = -1;
for (let age = 0; age <= 3800; age += 100) {
  burst.age = age; const frame = rewardSceneAt(burst), point = marqueePoint(frame.progress);
  assert.equal(frame.scene, 'lucky'); assert.ok(frame.progress >= previousProgress);
  assert.ok(point.x >= 23 && point.x <= 744 && point.y >= 27 && point.y <= 885);
  assert.equal(frame.marquee, age < LUCKY_LAP_DURATION, 'the chase stops after a single lap');
  previousProgress = frame.progress;
}
assert.deepEqual(marqueePoint(0), marqueePoint(1), 'one full circuit returns to its starting lamp');
assert.deepEqual(marqueePoint(2), marqueePoint(1), 'extra time cannot start a second lap');
assert.equal(rewardSceneAt(burst, true).marquee, false, 'reduced motion suppresses the chase');
assert.equal(rewardSceneAt(burst).alpha, 0, 'scenery fades completely at its deadline');
const field = makeFx();
celebrateReward(field, result(5), false); assert.equal(field.celebrations[0].scene, 'stars');
celebrateReward(field, { ...result(2), globalMultiplier: 5 }, false);
assert.equal(field.celebrations[1].scene, null, 'a boosted x2 slot does not become the Lucky slot');
for (let i = 0; i < 20; i++) celebrateReward(field, result(5), false);
assert.equal(activeRewardScenes(field.celebrations).length, 1, 'concurrent wins coalesce their tabletop scenery');
console.log('PASS: 5.5-second treasure with spaced waves, one clockwise Lucky lap, tabletop x5 scenery, pause/reduced-motion behavior and bounded multiball overlays.');
