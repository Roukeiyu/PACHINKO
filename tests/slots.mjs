import assert from 'node:assert/strict';
import { SLOT_LAYOUTS, SLOT_UNLOCK_7, SLOT_UNLOCK_9, nextSlotCount, restoreSlots, slotMultipliers, slotsForScore } from '../src/slots.js';
import { SLOT_ROW_LEFT, SLOT_ROW_RIGHT, slotFrame } from '../src/round.js';
import { SLOT_TRANSITION_MS, blendSlotLayout, slotTransitionEase } from '../src/slot-transition.js';

assert.equal(SLOT_UNLOCK_7, 3000);
assert.equal(SLOT_UNLOCK_9, 10000);
assert.deepEqual([0, 2999, 3000, 9999, 10000, 50000].map(slotsForScore), [5, 5, 7, 7, 9, 9]);
assert.equal(restoreSlots(undefined), 5);
assert.equal(restoreSlots(7), 7);
assert.equal(restoreSlots(9), 9);
assert.equal(restoreSlots(3), 5);
assert.equal(nextSlotCount(5, 0), 5);
assert.equal(nextSlotCount(5, 3000), 7);
assert.equal(nextSlotCount(7, 0), 7, 'within a round a 7-slot table does not fall back');
assert.equal(nextSlotCount(7, 10000), 9);
assert.equal(nextSlotCount(9, 0), 9);
assert.deepEqual(slotMultipliers(5), [2, 3, 5, 3, 2]);
assert.deepEqual(slotMultipliers(7), [2, 3, 5, 10, 5, 3, 2]);
assert.deepEqual(slotMultipliers(9), [2, 3, 5, 10, 20, 10, 5, 3, 2]);
for (const count of [5, 7, 9]) {
  const row = SLOT_LAYOUTS[count];
  assert.equal(row[Math.floor(row.length / 2)], count === 5 ? 5 : count === 7 ? 10 : 20);
  assert.deepEqual(row, [...row].reverse(), 'layouts stay symmetric');
}
assert.equal(SLOT_TRANSITION_MS, 900);
assert.ok(SLOT_TRANSITION_MS >= 600 && SLOT_TRANSITION_MS <= 1200);
assert.equal(slotTransitionEase(0), 0);
assert.equal(slotTransitionEase(1), 1);
assert.equal(slotTransitionEase(0.5), 0.5);
for (const [from, to] of [[5, 7], [7, 9], [5, 9]]) {
  const start = blendSlotLayout(from, to, 0);
  const end = blendSlotLayout(from, to, 1);
  const mid = blendSlotLayout(from, to, 0.5);
  const almost = blendSlotLayout(from, to, 0.999);
  const old = slotFrame(from);
  const next = slotFrame(to);
  const visible = start.regions.filter(region => region.x1 - region.x0 > 0.01);
  assert.equal(visible.length, old.regions.length, `${from}→${to} starts on the old mouths`);
  visible.forEach((region, index) => {
    assert.equal(region.kind, old.regions[index].kind);
    assert.ok(Math.abs(region.x0 - old.regions[index].x0) < 1e-6);
    assert.ok(Math.abs(region.x1 - old.regions[index].x1) < 1e-6);
  });
  assert.equal(start.regions[0].kind, next.regions[0].kind);
  assert.ok(start.regions[0].x1 - start.regions[0].x0 < 1e-6, 'the new left piece starts shut');
  assert.equal(start.regions.at(-1).kind, next.regions.at(-1).kind);
  assert.ok(start.regions.at(-1).x1 - start.regions.at(-1).x0 < 1e-6, 'the new right piece starts shut');
  assert.ok(mid.regions[0].x1 - mid.regions[0].x0 > 1, 'the new left piece has grown by halfway');
  if (to === 9) {
    assert.equal(next.regions.filter(region => region.kind === 'drain').length, 0, `${from}→${to} removes the filler mouths`);
    const widths = next.regions.map(region => region.x1 - region.x0);
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1, `${from}→${to} ends on equal pockets`);
    const side = (to - from) / 2;
    old.regions.forEach((region, index) => {
      const during = mid.regions[side + index];
      assert.equal(during.kind, region.kind, `${from}→${to} keeps the old mouths while they move`);
      if (region.kind !== 'drain') return;
      const before = region.x1 - region.x0;
      assert.ok(during.x1 - during.x0 < before - 0.5, `${from}→${to} shrinks a striped drain`);
    });
  } else if (to === 7) {
    const endSlots = next.regions.filter(region => region.kind === 'slot');
    const endDrains = next.regions.filter(region => region.kind === 'drain');
    assert.equal(endDrains.length, 4, '5→7 keeps the four inner mouths');
    assert.equal(next.regions[0].kind, 'slot');
    assert.equal(next.regions[1].kind, 'slot', 'the left outer mouth closes');
    assert.equal(next.regions.at(-1).kind, 'slot');
    assert.equal(next.regions.at(-2).kind, 'slot', 'the right outer mouth closes');
    const outer = endSlots[0].x1 - endSlots[0].x0;
    const inner = endSlots[1].x1 - endSlots[1].x0;
    assert.ok(Math.abs(outer - (endSlots[6].x1 - endSlots[6].x0)) < 1, 'both end slots take the same freed width');
    assert.ok(outer > inner + 30, 'each end slot absorbs the mouth beside it');
    for (const drain of endDrains) assert.ok(Math.abs(drain.x1 - drain.x0 - next.opening) < 0.6);
    old.regions.forEach((region, index) => {
      const during = mid.regions[1 + index];
      assert.equal(during.kind, region.kind, '5→7 keeps the old mouths while they move');
      if (region.kind !== 'drain' || (index !== 0 && index !== old.regions.length - 1)) return;
      assert.ok(during.x1 - during.x0 < region.x1 - region.x0 - 0.5, '5→7 shrinks an edge mouth');
    });
  } else {
    const extra = (next.regions.length - old.regions.length) / 2;
    old.regions.forEach((region, index) => {
      const target = next.regions[extra + index];
      assert.equal(target.kind, region.kind, `${from}→${to} keeps the old mouths in the middle`);
      if (region.kind !== 'drain') return;
      const before = region.x1 - region.x0;
      const after = target.x1 - target.x0;
      const width = mid.regions[extra + index].x1 - mid.regions[extra + index].x0;
      const halfway = before + (after - before) * mid.eased;
      assert.ok(Math.abs(width - halfway) < 0.6, `${from}→${to} eases an existing drain toward its new width`);
      if (from === 5 && to === 7) assert.ok(after < before - 0.5, 'the five-slot drains narrow as the row gains end slots');
    });
  }
  let edge = start.regions[0].x0;
  for (const region of mid.regions) {
    assert.ok(Math.abs(region.x0 - edge) < 1e-4, `${from}→${to} mouths stay tiled`);
    assert.ok(region.x1 >= region.x0);
    edge = region.x1;
  }
  assert.ok(Math.abs(mid.regions[0].x0 - SLOT_ROW_LEFT) < 1e-4);
  assert.ok(Math.abs(edge - SLOT_ROW_RIGHT) < 1e-4);
  assert.equal(end.regions.length, next.regions.length);
  end.regions.forEach((region, index) => {
    assert.equal(region.kind, next.regions[index].kind);
    assert.ok(Math.abs(region.x0 - next.regions[index].x0) < 1e-6);
    assert.ok(Math.abs(region.x1 - next.regions[index].x1) < 1e-6);
  });
  if (to === 9 || to === 7) {
    const easedSlots = almost.regions.filter(region => region.kind === 'slot');
    const finalSlots = next.regions.filter(region => region.kind === 'slot');
    assert.equal(easedSlots.length, finalSlots.length);
    easedSlots.forEach((region, index) => {
      assert.ok(Math.abs(region.x0 - finalSlots[index].x0) < 3);
      assert.ok(Math.abs(region.x1 - finalSlots[index].x1) < 3);
    });
    const open = almost.regions.filter(region => region.kind === 'drain' && region.x1 - region.x0 >= 1);
    const closed = almost.regions.filter(region => region.kind === 'drain' && region.x1 - region.x0 < 1);
    if (to === 9) assert.equal(open.length, 0, `${from}→${to} has closed the striped drains`);
    else {
      assert.equal(open.length, 4, '5→7 keeps four inner mouths open through the ease');
      assert.ok(closed.length >= 2, '5→7 closes the two edge mouths');
    }
  } else {
    almost.regions.forEach((region, index) => {
      assert.equal(region.kind, next.regions[index].kind);
      assert.ok(Math.abs(region.x0 - next.regions[index].x0) < 3);
      assert.ok(Math.abs(region.x1 - next.regions[index].x1) < 3);
    });
  }
  const changing = mid.regions.find(region => region.kind === 'slot' && region.fromMultiplier !== region.toMultiplier);
  assert.ok(changing, `${from}→${to} eases at least one multiplier`);
}
console.log('PASS: slot thresholds, no downgrade, the 5/7/9 multiplier tables, and the drain transition.');
