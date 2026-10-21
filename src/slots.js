// Within one round the slot count follows the happiness score and never steps backward.
// A new round starts at 5. Refresh continues the saved round instead of a fresh table.
export const SLOT_UNLOCK_7 = 3000;
export const SLOT_UNLOCK_9 = 10000;

// Center pockets are the special slots: ×5 / ×10 / ×20.
// Neighbors step down toward the rails. The same number always means the same fruit.
export const SLOT_LAYOUTS = Object.freeze({
  5: Object.freeze([2, 3, 5, 3, 2]),
  7: Object.freeze([2, 3, 5, 10, 5, 3, 2]),
  9: Object.freeze([2, 3, 5, 10, 20, 10, 5, 3, 2]),
});

export const slotMultipliers = count => SLOT_LAYOUTS[count] || SLOT_LAYOUTS[7];

export function slotsForScore(score) {
  const value = Number.isFinite(score) ? score : 0;
  if (value >= SLOT_UNLOCK_9) return 9;
  if (value >= SLOT_UNLOCK_7) return 7;
  return 5;
}

export function restoreSlots(saved) {
  return saved === 7 || saved === 9 ? saved : 5;
}

// The higher of the saved unlock and the tier this score has earned.
export function nextSlotCount(current, score) {
  return Math.max(restoreSlots(current), slotsForScore(score));
}
