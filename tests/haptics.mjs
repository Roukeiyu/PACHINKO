import assert from 'node:assert/strict';
import { createHaptics, HAPTIC_COLLISION_MS, HAPTIC_SLOT_MS, HAPTIC_LUCKY_MS, HAPTIC_JACKPOT_PATTERN, HAPTIC_MIN_INTERVAL, HAPTIC_MIN_SPEED, patternDuration } from '../src/haptics.js';

const calls = [];
const vibrate = pattern => { calls.push(pattern); return true; };
const haptics = createHaptics({ vibrate });

assert.equal(haptics.collision(HAPTIC_MIN_SPEED - .01, 0), false);
assert.deepEqual(calls, [], 'a slow contact does not buzz');
assert.equal(haptics.collision(HAPTIC_MIN_SPEED, 0), true);
assert.deepEqual(calls, [HAPTIC_COLLISION_MS]);
assert.equal(haptics.collision(12, HAPTIC_MIN_INTERVAL - 1), false, 'collision pulses are throttled');
assert.equal(calls.length, 1);
assert.equal(haptics.collision(12, HAPTIC_MIN_INTERVAL), true);
assert.deepEqual(calls.at(-1), HAPTIC_COLLISION_MS);

assert.equal(haptics.score({ kind: 'slot', multiplier: 2 }, HAPTIC_MIN_INTERVAL), true, 'a pocket overrides the lighter collision');
assert.deepEqual(calls.at(-1), HAPTIC_SLOT_MS);
assert.equal(haptics.collision(20, HAPTIC_MIN_INTERVAL + 10), false, 'a collision does not cut off the pocket pulse');
assert.equal(haptics.score({ kind: 'slot', multiplier: 10 }, HAPTIC_MIN_INTERVAL + 10), true);
assert.deepEqual(calls.at(-1), HAPTIC_LUCKY_MS);
assert.equal(haptics.score({ kind: 'slot', multiplier: 3 }, HAPTIC_MIN_INTERVAL + 20), false, 'an ordinary pocket does not cut off Lucky');
assert.equal(haptics.score({ kind: 'jackpot' }, HAPTIC_MIN_INTERVAL + 20), true);
assert.deepEqual(calls.at(-1), HAPTIC_JACKPOT_PATTERN);
const jackpotEnds = HAPTIC_MIN_INTERVAL + 20 + patternDuration(HAPTIC_JACKPOT_PATTERN);
assert.equal(haptics.score({ kind: 'slot', multiplier: 10 }, jackpotEnds - 1), false, 'Lucky does not cut off the secret hole');
assert.equal(haptics.collision(30, jackpotEnds - 1), false);
assert.equal(haptics.score({ kind: 'slot', multiplier: 5 }, jackpotEnds), true, 'a pocket can play again after the stronger pattern ends');

haptics.setEnabled(false);
assert.deepEqual(calls.at(-1), 0, 'turning vibration off cancels the motor');
const stopped = calls.length;
assert.equal(haptics.collision(20, jackpotEnds + 100), false);
assert.equal(haptics.score({ kind: 'jackpot' }, jackpotEnds + 100), false);
assert.equal(calls.length, stopped, 'mute is not involved; the vibration switch alone blocks pulses');
haptics.setEnabled(true);
assert.equal(haptics.score({ kind: 'jackpot' }, jackpotEnds + 100), true);

const broken = createHaptics({ vibrate() { throw new Error('blocked'); } });
assert.equal(broken.collision(8, 0), false);
assert.equal(broken.score({ kind: 'jackpot' }, 0), false);
assert.doesNotThrow(() => broken.setEnabled(false));
const missing = createHaptics({ vibrate: undefined });
assert.equal(missing.collision(8, 0), false);
assert.equal(missing.score({ kind: 'slot', multiplier: 10 }, 0), false);

console.log('PASS: vibration grades, collision throttle, stronger pulses overriding weaker ones, and silent skip when vibrate is missing or throws.');
