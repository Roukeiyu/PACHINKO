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

function describeSlot(count, column, multiplier, fresh, fromColumn, fromMultiplier) {
  return {
    kind: 'slot',
    column,
    fromColumn,
    fresh,
    fromMultiplier,
    toMultiplier: multiplier,
    luckyFrom: fromColumn === null ? false : isLucky(count, fromColumn, fromMultiplier),
    luckyTo: isLucky(count, column, multiplier),
  };
}

function paintRegions(count) {
  const multipliers = slotMultipliers(count);
  return slotFrame(count).regions.map(region => {
    if (region.kind !== 'slot') return { kind: 'drain', fresh: false, x0: region.x0, x1: region.x1 };
    const multiplier = multipliers[region.column];
    return { ...describeSlot(count, region.column, multiplier, false, region.column, multiplier), x0: region.x0, x1: region.x1 };
  });
}

// The old row is the middle of the new row. Anything added on the left grows
// out of the left wall, and the same number of pieces grows out of the right
// wall. 5→7 grows one payout slot per side while the slots already on the row
// narrow and the drains shrink. There is no side slope.
function morphRegions(fromCount, toCount, eased) {
  const fromFrame = slotFrame(fromCount);
  const toFrame = slotFrame(toCount);
  const fromMult = slotMultipliers(fromCount);
  const toMult = slotMultipliers(toCount);
  const fromRegions = fromFrame.regions;
  const toRegions = toFrame.regions;
  const extra = (toRegions.length - fromRegions.length) / 2;
  const regions = [];
  const place = (fromX0, fromX1, toX0, toX1, fields) => {
    regions.push({
      ...fields,
      x0: fromX0 + (toX0 - fromX0) * eased,
      x1: fromX1 + (toX1 - fromX1) * eased,
    });
  };
  const fieldsFor = (target, fresh, fromRegion) => {
    if (target.kind === 'drain') return { kind: 'drain', fresh };
    const toMultiplier = toMult[target.column];
    const fromMultiplier = fromRegion ? fromMult[fromRegion.column] : toMultiplier;
    const described = describeSlot(toCount, target.column, toMultiplier, fresh, fromRegion ? fromRegion.column : null, fromMultiplier);
    if (fromRegion) described.luckyFrom = isLucky(fromCount, fromRegion.column, fromMultiplier);
    return described;
  };
  for (let i = 0; i < extra; i++) {
    const target = toRegions[i];
    place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, target.x0, target.x1, fieldsFor(target, true, null));
  }
  fromRegions.forEach((region, index) => {
    const target = toRegions[extra + index];
    place(region.x0, region.x1, target.x0, target.x1, fieldsFor(target, false, region.kind === 'slot' ? region : null));
  });
  for (let i = 0; i < extra; i++) {
    const target = toRegions[toRegions.length - extra + i];
    place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, target.x0, target.x1, fieldsFor(target, true, null));
  }
  return regions;
}

// 7→9 and 5→9 carry the slots already on the row into the middle. New end
// slots grow from the walls. A mouth that lands on a 9-slot leak eases to
// that opening; a mouth that lands on a shared edge shrinks to a wall.
function morphToNine(fromCount, eased) {
  const fromFrame = slotFrame(fromCount);
  const toFrame = slotFrame(9);
  const fromMult = slotMultipliers(fromCount);
  const toMult = slotMultipliers(9);
  const toSlots = toFrame.regions.filter(region => region.kind === 'slot');
  const side = (9 - fromCount) / 2;
  const regions = [];
  const place = (fromX0, fromX1, toX0, toX1, fields) => {
    regions.push({
      ...fields,
      x0: fromX0 + (toX0 - fromX0) * eased,
      x1: fromX1 + (toX1 - fromX1) * eased,
    });
  };
  const slotFields = (column, fresh, fromColumn) => {
    const toMultiplier = toMult[column];
    const fromMultiplier = fromColumn === null ? toMultiplier : fromMult[fromColumn];
    const described = describeSlot(9, column, toMultiplier, fresh, fromColumn, fromMultiplier);
    if (fromColumn !== null) described.luckyFrom = isLucky(fromCount, fromColumn, fromMultiplier);
    return described;
  };
  const gapTarget = (leftColumn, rightColumn) => {
    const left = toSlots[leftColumn];
    const right = toSlots[rightColumn];
    const drain = toFrame.regions.find(region => region.kind === 'drain' && Math.abs(region.x0 - left.x1) < 1e-4);
    return drain ? [drain.x0, drain.x1] : [left.x1, right.x0];
  };
  for (let column = 0; column < side; column++) {
    const target = toSlots[column];
    place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, target.x0, target.x1, slotFields(column, true, null));
  }
  const lead = toSlots[side];
  const leadDrain = toFrame.regions.find(region => region.kind === 'drain' && Math.abs(region.x1 - lead.x0) < 1e-4);
  if (leadDrain) place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, leadDrain.x0, leadDrain.x1, { kind: 'drain', fresh: true });
  let carried = 0;
  let prevWasDrain = false;
  for (const region of fromFrame.regions) {
    if (region.kind === 'slot') {
      if (carried > 0 && !prevWasDrain) {
        const [toX0, toX1] = gapTarget(side + carried - 1, side + carried);
        place(region.x0, region.x0, toX0, toX1, { kind: 'drain', fresh: true });
      }
      const target = toSlots[side + carried];
      place(region.x0, region.x1, target.x0, target.x1, slotFields(target.column, false, region.column));
      carried += 1;
      prevWasDrain = false;
      continue;
    }
    const [toX0, toX1] = gapTarget(side + carried - 1, side + carried);
    place(region.x0, region.x1, toX0, toX1, { kind: 'drain', fresh: false });
    prevWasDrain = true;
  }
  const last = toSlots[side + fromCount - 1];
  const tailDrain = toFrame.regions.find(region => region.kind === 'drain' && Math.abs(region.x0 - last.x1) < 1e-4);
  if (tailDrain) place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, tailDrain.x0, tailDrain.x1, { kind: 'drain', fresh: true });
  for (let column = side + fromCount; column < 9; column++) {
    const target = toSlots[column];
    place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, target.x0, target.x1, slotFields(column, true, null));
  }
  return regions;
}

export function blendSlotLayout(fromCount, toCount, t) {
  const eased = slotTransitionEase(t);
  const same = fromCount === toCount || toCount < fromCount || (toCount - fromCount) % 2 !== 0;
  if (same || eased >= 1) {
    return { from: fromCount, to: toCount, eased: 1, regions: paintRegions(toCount) };
  }
  if (toCount === 9) return { from: fromCount, to: toCount, eased, regions: morphToNine(fromCount, eased) };
  if (toCount === 7) return { from: fromCount, to: toCount, eased, regions: morphToSeven(eased) };
  return { from: fromCount, to: toCount, eased, regions: morphRegions(fromCount, toCount, eased) };
}

// 5→7 grows one new end pocket from each wall. The five slots already on
// the row become the inner five. The four mouths between those slots stay
// open; the 5-row no longer has edge mouths to shrink.
function morphToSeven(eased) {
  const fromFrame = slotFrame(5);
  const toFrame = slotFrame(7);
  const fromMult = slotMultipliers(5);
  const toMult = slotMultipliers(7);
  const toSlots = toFrame.regions.filter(region => region.kind === 'slot');
  const toDrains = toFrame.regions.filter(region => region.kind === 'drain');
  const regions = [];
  const place = (fromX0, fromX1, toX0, toX1, fields) => {
    regions.push({
      ...fields,
      x0: fromX0 + (toX0 - fromX0) * eased,
      x1: fromX1 + (toX1 - fromX1) * eased,
    });
  };
  const slotFields = (column, fresh, fromColumn) => {
    const toMultiplier = toMult[column];
    const fromMultiplier = fromColumn === null ? toMultiplier : fromMult[fromColumn];
    const described = describeSlot(7, column, toMultiplier, fresh, fromColumn, fromMultiplier);
    if (fromColumn !== null) described.luckyFrom = isLucky(5, fromColumn, fromMultiplier);
    return described;
  };
  const outerLeft = toSlots[0];
  place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, outerLeft.x0, outerLeft.x1, slotFields(0, true, null));
  let carried = 0;
  let innerDrain = 0;
  for (const region of fromFrame.regions) {
    if (region.kind === 'slot') {
      const target = toSlots[1 + carried];
      place(region.x0, region.x1, target.x0, target.x1, slotFields(target.column, false, region.column));
      carried += 1;
      continue;
    }
    if (carried === 0 || carried === toSlots.length - 2) {
      const boundary = carried === 0 ? toSlots[1].x0 : toSlots[5].x1;
      place(region.x0, region.x1, boundary, boundary, { kind: 'drain', fresh: false });
      continue;
    }
    const target = toDrains[innerDrain];
    innerDrain += 1;
    place(region.x0, region.x1, target.x0, target.x1, { kind: 'drain', fresh: false });
  }
  const outerRight = toSlots[6];
  place(SLOT_ROW_RIGHT, SLOT_ROW_RIGHT, outerRight.x0, outerRight.x1, slotFields(6, true, null));
  return regions;
}
