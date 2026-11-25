// SATE BAKAR — the fun systems: streak, rush hour, golden order, rare
// ingredient + bonus recipe, customer reactions. Everything here is real
// game state, deterministic per seed — no wall clock, no network.
import { makeRng, INGREDIENTS } from './config.js';
import { setBonusRecipe } from './recipes.js';

export const RUSH_AT = 55;
export const RUSH_DUR = 25;
export const GOLDEN_TIP = 100;
const STREAK_MULT = [1, 1, 2, 3, 4]; // index = consecutive PERFECT serves, capped at x4

// The shift's rare ingredient + bonus recipe: one deterministic random
// variable per shift, drawn from the seed. The bonus recipe is the
// "Pesanan Emas" dish — base 200, built on the rare ingredient.
export function bonusRecipeFor(seed) {
  const rng = makeRng(seed);
  const rare = INGREDIENTS[Math.floor(rng() * INGREDIENTS.length)];
  return {
    id: 'langka',
    name: `Sate ${rare.name} Langka`,
    color: '#ffd166',
    rareId: rare.id,
    steps: [
      { kind: 'skewer', item: rare.id, label: `Tusuk ${rare.name}` },
      { kind: 'chop', label: 'Potong' },
      { kind: 'grill', label: 'Bakar' },
      { kind: 'sauce', item: 'sambal', label: 'Sambal' },
      { kind: 'garnish', item: 'krupuk', label: 'Krupuk' },
    ],
    base: 200,
  };
}

export function makeFun(seed) {
  const s = seed || 20261125;
  const bonus = bonusRecipeFor(s);
  setBonusRecipe(bonus);
  const rng = makeRng(s ^ 0x9e3779b9);
  return {
    streak: 0,
    streakBest: 0,
    rush: { at: RUSH_AT, dur: RUSH_DUR, active: false, done: false, tLeft: 0 },
    goldenSpawn: 4 + Math.floor(rng() * 2), // the 4th or 5th customer of the shift
    goldenServed: false,
    bonus,
    reactions: [], // { slot, text, kind, t } — walkout flashes over ticket slots
  };
}

export function resetFun(f) {
  if (!f) return;
  f.streak = 0;
  f.streakBest = 0;
  f.rush.active = false;
  f.rush.done = false;
  f.rush.tLeft = 0;
  f.goldenServed = false;
  f.reactions = [];
}

export function streakMult(streak) { return STREAK_MULT[Math.min(streak, 4)]; }
export function rushActive(f) { return !!f && f.rush.active; }

// Once per shift, at a fixed elapsed time: the rush window opens —
// customers flood in, patience drains faster, every point doubles.
export function funTick(g, dt) {
  const f = g.fun;
  if (!f) return;
  if (!f.rush.done && !f.rush.active && g.elapsed >= f.rush.at) {
    f.rush.active = true;
    f.rush.tLeft = f.rush.dur;
    g.message = '🔥 JAM RAMAI! Semua poin x2 — layani secepatnya!';
    g.messageT = 3;
  }
  if (f.rush.active) {
    f.rush.tLeft -= dt;
    if (f.rush.tLeft <= 0) {
      f.rush.active = false;
      f.rush.done = true;
      g.message = 'Jam ramai selesai — napas dulu!';
      g.messageT = 2.5;
    }
  }
  for (const r of f.reactions) r.t -= dt;
  f.reactions = f.reactions.filter((r) => r.t > 0);
}

export function funBreakStreak(g) { if (g.fun) g.fun.streak = 0; }

export function funOnWalkout(g, slot) {
  if (!g.fun) return;
  g.fun.reactions.push({ slot, text: '💢 KABUR!', kind: 'angry', t: 2.2 });
  funBreakStreak(g);
}

// Apply streak / rush / golden multipliers to a serve. Returns the final
// points plus what made them, so the flash text can show it honestly.
export function funOnServe(g, cust, perfect, earned) {
  const f = g.fun;
  let mult = 1;
  let golden = false;
  if (f) {
    if (perfect) {
      f.streak += 1;
      f.streakBest = Math.max(f.streakBest, f.streak);
    } else {
      f.streak = 0;
    }
    mult = streakMult(f.streak);
    if (f.rush.active) mult *= 2;
    if (cust && cust.golden) {
      golden = true;
      f.goldenServed = true;
    }
  }
  let out = Math.round(earned * mult);
  if (golden) out += GOLDEN_TIP;
  return { earned: out, mult, golden };
}
