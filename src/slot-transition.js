import { SLOT_ROW_LEFT, SLOT_ROW_RIGHT, slotFrame } from './round.js';
import { slotMultipliers } from './slots.js';

// Long enough to read the new mouths growing in, short enough that a ball
// already falling through the row is not waiting on the picture.
export const SLOT_TRANSITION_MS = 900;

export function slotTransitionEase(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return x * x * (3 - 2 * x);
}

function isLucky(count, column, multiplier) {
  return multiplier >= 10 || (count === 5 && column === (count - 1) / 2);
}

function paintRegions(count) {
  const multipliers = slotMultipliers(count);
  return slotFrame(count).regions.map(region => {
    if (region.kind !== 'slot') {
      return { kind: 'drain', fresh: false, x0: region.x0, x1: region.x1 };
    }
    const multiplier = multipliers[region.column];
    const lucky = isLucky(count, region.column, multiplier);
    return {
      kind: 'slot',
      column: region.column,
      fromColumn: region.column,
      fresh: false,
      fromMultiplier: multiplier,
      toMultiplier: multiplier,
      luckyFrom: lucky,
      luckyTo: lucky,
      x0: region.x0,
      x1: region.x1,
    };
  });
}

// 5→7 and 7→9 each add one drain and one slot on both sides. A direct 5→9
// adds two of each. Fresh mouths start shut against the side walls and grow
// inward; the mouths that already existed slide and narrow toward the inner
// part of the new row.
function morphRegions(fromCount, toCount, eased) {
  const side = (toCount - fromCount) / 2;
  const fromFrame = slotFrame(fromCount);
  const toFrame = slotFrame(toCount);
  const fromMult = slotMultipliers(fromCount);
  const toMult = slotMultipliers(toCount);
  const toRegions = toFrame.regions;
  const regions = [];
  const place = (fromX0, fromX1, toX0, toX1, fields) => {
    regions.push({
      ...fields,
      x0: fromX0 + (toX0 - fromX0) * eased,
      x1: fromX1 + (toX1 - fromX1) * eased,
    });
  };
  for (let i = 0; i < side; i++) {
    const drain = toRegions[i * 2];
    const slot = toRegions[i * 2 + 1];
    const multiplier = toMult[slot.column];
    place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, drain.x0, drain.x1, { kind: 'drain', fresh: true });
    place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, slot.x0, slot.x1, {
      kind: 'slot',
      column: slot.column,
      fromColumn: null,
      fresh: true,
      fromMultiplier: multiplier,
      toMultiplier: multiplier,
      luckyFrom: false,
      luckyTo: isLucky(toCount, slot.column, multiplier),
    });
  }
  fromFrame.regions.forEach((region, index) => {
    const target = toRegions[side * 2 + index];
    if (region.kind === 'drain') {
      place(region.x0, region.x1, target.x0, target.x1, { kind: 'drain', fresh: false });
      return;
    }
    const fromMultiplier = fromMult[region.column];
    const toMultiplier = toMult[target.column];
    place(region.x0, region.x1, target.x0, target.x1, {
      kind: 'slot',
      column: target.column,
      fromColumn: region.column,
      fresh: false,
      fromMultiplier,
      toMultiplier,
      luckyFrom: isLucky(fromCount, region.column, fromMultiplier),
      luckyTo: isLucky(toCount, target.column, toMultiplier),
    });
  });
  const rightStart = toRegions.length - side * 2;
  for (let i = 0; i < side; i++) {
    const slot = toRegions[rightStart + i * 2];
    const drain = toRegions[rightStart + i * 2 + 1];
    const multiplier = toMult[slot.column];
    place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, slot.x0, slot.x1, {
      kind: 'slot',
      column: slot.column,
      fromColumn: null,
      fresh: true,
      fromMultiplier: multiplier,
      toMultiplier: multiplier,
      luckyFrom: false,
      luckyTo: isLucky(toCount, slot.column, multiplier),
    });
    place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, drain.x0, drain.x1, { kind: 'drain', fresh: true });
  }
  return regions;
}

export function blendSlotLayout(fromCount, toCount, t) {
  const eased = slotTransitionEase(t);
  const same = fromCount === toCount || toCount < fromCount || (toCount - fromCount) % 2 !== 0;
  if (same || eased >= 1) {
    return { from: fromCount, to: toCount, eased: 1, regions: paintRegions(toCount) };
  }
  return { from: fromCount, to: toCount, eased, regions: morphRegions(fromCount, toCount, eased) };
}
