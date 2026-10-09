// Bottom rewards use one fruit family in every theme and slot layout.
// Use the base multiplier: global bonuses scale every label together.
export const SLOT_ICONS = Object.freeze({ 2: '🍒', 3: '🍊', 5: '🍇', 10: '🍍' });
export const slotIcon = multiplier => SLOT_ICONS[multiplier] || SLOT_ICONS[2];
export const slotColorIndex = multiplier => ({ 2: 0, 3: 1, 5: 2, 10: 3 })[multiplier] ?? 0;
