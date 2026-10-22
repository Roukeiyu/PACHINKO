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

// 7→9 and 5→9 do not keep the old drain/slot alternation. The carried slots
// ease into the middle of the equal nine, the striped mouths shrink to the
// shared edges, and the new end slots grow out of the side walls.
function morphToNine(fromCount, eased) {
  const fromFrame = slotFrame(fromCount);
  const toFrame = slotFrame(9);
  const fromMult = slotMultipliers(fromCount);
  const toMult = slotMultipliers(9);
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
  for (let i = 0; i < side; i++) {
    const target = toFrame.regions[i];
    place(SLOT_ROW_LEFT, SLOT_ROW_LEFT, target.x0, target.x1, slotFields(i, true, null));
  }
  let slotSeen = 0;
  for (const region of fromFrame.regions) {
    if (region.kind === 'slot') {
      const column = side + slotSeen;
      const target = toFrame.regions[column];
      place(region.x0, region.x1, target.x0, target.x1, slotFields(column, false, region.column));
      slotSeen += 1;
      continue;
    }
    const boundary = slotSeen === 0
      ? toFrame.regions[side].x0
      : toFrame.regions[side + slotSeen - 1].x1;
    place(region.x0, region.x1, boundary, boundary, { kind: 'drain', fresh: false });
  }
  for (let i = 0; i < side; i++) {
    const column = 9 - side + i;
    const target = toFrame.regions[column];
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
  return { from: fromCount, to: toCount, eased, regions: morphRegions(fromCount, toCount, eased) };
}
