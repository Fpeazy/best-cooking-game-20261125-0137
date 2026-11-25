// SATE BAKAR — the charcoal grill: heat that fades, doneness per skewer, stoking.
// A skewer is raw at 0, perfect at 70-95, burnt past 100. Heat drops over time;
// stoking (Space or the charcoal button) brings it back, briefly hotter.
export const GRILL_HEAT_MAX = 100;
export const PERFECT_LOW = 70;
export const PERFECT_HIGH = 95;
export const BURNT_AT = 100;

export function makeGrill() {
  return {
    heat: 82,
    slots: [null, null, null, null],
    stokeFlash: 0,
    smoke: 0,
  };
}

export function grillTick(g, dt) {
  // Charcoal cools slowly; a fresh stoke keeps it hot a little longer.
  g.heat = Math.max(18, g.heat - dt * 1.6);
  if (g.stokeFlash > 0) g.stokeFlash = Math.max(0, g.stokeFlash - dt);
  g.smoke += dt;
  for (const slot of g.slots) {
    if (!slot) continue;
    // Doneness rises with heat: hotter grill cooks faster.
    slot.done = Math.min(130, slot.done + dt * (g.heat / 100) * 11);
    slot.burnt = slot.done > BURNT_AT;
  }
}

export function stokeGrill(g) {
  g.heat = Math.min(GRILL_HEAT_MAX, g.heat + 26);
  g.stokeFlash = 0.6;
  return g.heat;
}

export function grillPlace(g, skewer) {
  const idx = g.slots.findIndex((s) => s === null);
  if (idx < 0) return -1;
  g.slots[idx] = { ...skewer, done: 0, burnt: false };
  return idx;
}

export function grillTake(g, idx) {
  if (idx < 0 || idx >= g.slots.length) return null;
  const slot = g.slots[idx];
  g.slots[idx] = null;
  return slot;
}

export function grillQuality(slot) {
  if (!slot) return 'empty';
  if (slot.burnt) return 'burnt';
  if (slot.done >= PERFECT_LOW && slot.done <= PERFECT_HIGH) return 'perfect';
  if (slot.done >= 40) return 'cooking';
  return 'raw';
}
