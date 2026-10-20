import assert from 'node:assert/strict';
import { createSecretWave, secretPayout } from '../src/secret-wave.js';

const wave = createSecretWave();
const first = wave.enter(500);
assert.deepEqual(first, { pay: 500, retro: 0, doubledNow: false, startWait: true });
assert.equal(wave.multiplier, 1);
assert.equal(wave.entries, 1);

const second = wave.enter(500);
assert.deepEqual(second, { pay: 1000, retro: 500, doubledNow: true, startWait: false });
assert.equal(wave.multiplier, 2, 'the second ball of the same visit doubles once');

const third = wave.enter(1000);
assert.deepEqual(third, { pay: 2000, retro: 0, doubledNow: false, startWait: false });
assert.equal(wave.multiplier, 2, 'a third ball keeps ×2 and does not open another visit');
const paid = first.pay + second.retro + second.pay + third.pay;
assert.equal(paid, 2 * (500 + 500 + 1000));

wave.reset();
assert.equal(wave.multiplier, 1);
assert.equal(wave.entries, 0);
const again = wave.enter(500 * 2);
assert.equal(again.pay, 1000);
assert.equal(again.startWait, true);
const starred = wave.enter(500);
assert.equal(starred.retro, 1000, 'the retroactive double uses the first ball’s already scored points');
assert.equal(starred.pay, 1000);
assert.equal(wave.enter(500 * 5).pay, 5000);

assert.equal(secretPayout(1020, 2), 2040);
assert.equal(secretPayout(1050, wave.multiplier), 2100, '×2 multiplies the full combo score and does not clamp it first');
console.log('PASS: a second secret hole in the same visit doubles entry points once; later holes stay at ×2 and do not start another game.');
