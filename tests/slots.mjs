import assert from 'node:assert/strict';
import { SLOT_LAYOUTS, SLOT_UNLOCK_7, SLOT_UNLOCK_9, nextSlotCount, restoreSlots, slotMultipliers, slotsForScore } from '../src/slots.js';

assert.equal(SLOT_UNLOCK_7, 5000);
assert.equal(SLOT_UNLOCK_9, 20000);
assert.deepEqual([0, 4999, 5000, 19999, 20000, 50000].map(slotsForScore), [5, 5, 7, 7, 9, 9]);
assert.equal(restoreSlots(undefined), 5);
assert.equal(restoreSlots(7), 7);
assert.equal(restoreSlots(9), 9);
assert.equal(restoreSlots(3), 5);
assert.equal(nextSlotCount(5, 0), 5);
assert.equal(nextSlotCount(5, 5000), 7);
assert.equal(nextSlotCount(7, 0), 7, 'within a round a 7-slot table does not fall back');
assert.equal(nextSlotCount(7, 20000), 9);
assert.equal(nextSlotCount(9, 0), 9);
assert.deepEqual(slotMultipliers(5), [2, 3, 5, 3, 2]);
assert.deepEqual(slotMultipliers(7), [2, 3, 5, 10, 5, 3, 2]);
assert.deepEqual(slotMultipliers(9), [2, 3, 5, 10, 20, 10, 5, 3, 2]);
for (const count of [5, 7, 9]) {
  const row = SLOT_LAYOUTS[count];
  assert.equal(row[Math.floor(row.length / 2)], count === 5 ? 5 : count === 7 ? 10 : 20);
  assert.deepEqual(row, [...row].reverse(), 'layouts stay symmetric');
}
console.log('PASS: slot thresholds, no downgrade, and the 5/7/9 multiplier tables.');
