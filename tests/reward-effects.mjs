import assert from 'node:assert/strict';
import { celebrateReward, advanceCelebrations, rewardProfile } from '../src/reward-effects.js';

const makeFx = () => ({ celebrations: [], particles: [], ripples: [], shake: 0 });
const result = multiplier => ({ kind: 'slot', multiplier, x: 350, y: 865 });
const events = [2, 3, 5, 10].map(result).concat([{ kind: 'jackpot', x: 615, y: 482 }, { kind: 'clock', x: 350, y: 367 }]);
let previous = { particles: 0, duration: 0, radius: 0, notes: 0 };
for (const event of events) {
  const fx = makeFx(), profile = celebrateReward(fx, event, false, () => .5);
  const firstWave = fx.particles.length;
  advanceCelebrations(fx, 159, false, () => .5);
  assert.equal(fx.particles.length, firstWave, 'secondary waves are delayed');
  advanceCelebrations(fx, 641, false, () => .5);
  assert.equal(fx.particles.length, profile.count * profile.waves, 'every scheduled wave fires once');
  assert.ok(fx.particles.length > previous.particles, 'larger rewards emit richer bursts');
  assert.ok(profile.duration > previous.duration && profile.radius > previous.radius && profile.notes.length > previous.notes);
  previous = { particles: fx.particles.length, duration: profile.duration, radius: profile.radius, notes: profile.notes.length };
  assert.ok(fx.particles.every(p => Number.isFinite(p.vx) && Number.isFinite(p.vy) && p.size <= 5));
  advanceCelebrations(fx, profile.duration, false);
  assert.equal(fx.celebrations.length, 0, 'finished choreography is cleaned up');
  const count = fx.particles.length;
  advanceCelebrations(fx, 5000, false);
  assert.equal(fx.particles.length, count, 'finished celebrations cannot emit again');
}
assert.equal(new Set([2, 3, 5, 10].map(m => rewardProfile(result(m)).shape)).size, 4);
console.log('PASS: four distinct slot styles scale up through the secret hole to the largest 50-hit celebration.');

for (const event of events) {
  const fx = makeFx(); celebrateReward(fx, event, true);
  advanceCelebrations(fx, 900, true);
  assert.ok(fx.particles.length <= 8 && fx.ripples.length === 1);
  assert.equal(fx.shake, 0, 'calm mode has no screen shake');
}
const toggled = makeFx(); celebrateReward(toggled, events.at(-1), false);
advanceCelebrations(toggled, 300, true);
assert.equal(toggled.particles.length, 28, 'enabling calm mode cancels remaining waves');

const busy = makeFx(); celebrateReward(busy, events.at(-1), false);
for (let i = 0; i < 100; i++) celebrateReward(busy, result(10), false);
advanceCelebrations(busy, 800, false);
assert.ok(busy.particles.length <= 360 && busy.ripples.length <= 100 && busy.celebrations.length <= 16);
assert.ok(busy.celebrations.some(b => b.kind === 'clock'), 'ordinary scores cannot evict the central celebration');
console.log('PASS: reduced motion suppresses extra waves, multiball effects stay bounded, and the central celebration keeps priority.');
