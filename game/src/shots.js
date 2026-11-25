// SATE BAKAR — staged screenshots: a deterministic autopilot plays the REAL game
// forward from a fresh seeded run, using the same action functions the player
// uses, and freezes the frame at the moment each scene asks for. Every number
// on screen (timer, score, combo, doneness) is the live state of that run.
import { makeGame, startGame, gameTick, actIngredient, actChop, actGrillPlace, actGrillTake, actSauce, actPlate, actGarnish, actServe, actStoke, actDiscard } from './kitchen.js';
import { spawnCustomer } from './customers.js';
import { recipeById } from './recipes.js';
import { grillQuality } from './grill.js';

const DT = 1 / 60;
const IDLE_KEYS = { left: false, right: false, up: false, down: false };

// Autopilot: cooks waiting customers' orders in recipe order, grilling up to
// two skewers in parallel. Each skewer carries its own recipe + step list.
function pilotTick(g) {
  // A plated dish: garnish what its recipe still needs, then serve.
  if (g.plate) {
    const recipe = recipeById(g.plate.skewer.recipeId);
    const garnishSteps = recipe.steps.filter((s) => s.kind === 'garnish');
    const doneG = g.plate.skewer.garnishes.length;
    if (doneG < garnishSteps.length) { actGarnish(g, garnishSteps[doneG].item); return; }
    actServe(g);
    return;
  }
  // Hand holds a cooked skewer: sauce it in recipe order, then plate it.
  if (g.skewer && g.skewer.done > 0) {
    const recipe = recipeById(g.skewer.recipeId);
    const sauceSteps = recipe.steps.filter((s) => s.kind === 'sauce');
    const doneS = g.skewer.sauces.length;
    if (doneS < sauceSteps.length) { actSauce(g, sauceSteps[doneS].item); return; }
    actPlate(g);
    return;
  }
  // A perfect skewer is on the grill and the hand is free: take it.
  const occupied = g.grill.slots.filter((s) => s).length;
  if (!g.skewer) {
    const perfect = g.grill.slots.findIndex((s) => s && grillQuality(s) === 'perfect');
    if (perfect >= 0) { actGrillTake(g, perfect); return; }
    const over = g.grill.slots.findIndex((s) => s && s.done > 96);
    if (over >= 0) { actGrillTake(g, over); return; }
  }
  // Hand holds a raw skewer: chop it, then put it on the grill — at most two
  // slots at once, so a free hand is always left to take a perfect skewer.
  // If a slot is already perfect and the grill is full, drop the raw skewer
  // and take the perfect one instead of letting it burn.
  if (g.skewer) {
    const perfect = g.grill.slots.findIndex((s) => s && grillQuality(s) === 'perfect');
    if (perfect >= 0 && occupied >= 2) { actDiscard(g); return; }
    if (!g.skewer.chopped) { actChop(g, DT * 4); return; }
    if (occupied < 2) { actGrillPlace(g); return; }
    return; // wait, holding the chopped skewer, for a slot to free up
  }
  // Empty hands: start the first waiting customer's order.
  const cust = g.customers.list.find((c) => c.state === 'waiting');
  if (!cust) return;
  const recipe = recipeById(cust.recipeId);
  const skewerSteps = recipe.steps.filter((s) => s.kind === 'skewer');
  for (const step of skewerSteps) actIngredient(g, step.item);
  if (g.skewer) g.skewer.recipeId = cust.recipeId;
}

function runFor(g, seconds, stopWhen) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (g.grill.heat < 55) actStoke(g);
    pilotTick(g);
    gameTick(g, IDLE_KEYS, DT);
    if (g.phase !== 'play') break;
    if (stopWhen && stopWhen(g)) break;
  }
  return g;
}

// Freeze the game at a staged moment and report the live state for the shot log.
function freeze(g) {
  return {
    phase: g.phase,
    score: g.score,
    coins: g.coins,
    combo: g.combo,
    served: g.served,
    timeLeft: Math.round(g.timeLeft),
    customers: g.customers.list.length,
    walkouts: g.walkouts,
    flash: g.flash ? g.flash.text : null,
    grillHeat: Math.round(g.grill.heat),
    grillSlots: g.grill.slots.map((s) => (s ? Math.round(s.done) : null)),
    grillBurnt: g.grill.slots.filter((s) => s && s.burnt).length,
    plateSteps: g.plate ? g.plate.taken.length : 0,
    streak: g.fun ? g.fun.streak : 0,
    streakBest: g.fun ? g.fun.streakBest : 0,
    rush: g.fun ? (g.fun.rush.active ? 'active' : (g.fun.rush.done ? 'done' : 'pending')) : 'none',
    rushTLeft: g.fun ? Math.ceil(g.fun.rush.tLeft) : 0,
    goldenServed: g.fun ? g.fun.goldenServed : false,
    goldenSpawn: g.fun ? g.fun.goldenSpawn : 0,
    rareName: g.fun ? g.fun.bonus.name : null,
    goldenTicket: g.customers.list.some((c) => c.golden),
    reactions: g.fun ? g.fun.reactions.length : 0,
  };
}

// Top every staged frame up to 3 waiting customers (unique names come from
// the session pool in customers.js), so no ticket ever reads "— kosong —".
function topUpOrders(g) {
  let guard = 0;
  while (g.customers.list.filter((c) => c.state === 'waiting').length < 3 && guard < 6) {
    spawnCustomer(g.customers, g.elapsed);
    guard += 1;
  }
}

// Feet-clear floor gaps between the dining tables (see render.js): the
// chef's legs span ±26 px, so a staged chef x must sit in [314,496] or
// [784,966]. Anything outside snaps to the nearest gap centre.
const FLOOR_GAPS = [[314, 496], [784, 966]];
function stageChefX(x) {
  for (const [lo, hi] of FLOOR_GAPS) {
    if (x >= lo && x <= hi) return x;
  }
  let best = 875;
  let bestD = Infinity;
  for (const [lo, hi] of FLOOR_GAPS) {
    const c = (lo + hi) / 2;
    if (Math.abs(x - c) < bestD) { bestD = Math.abs(x - c); best = c; }
  }
  return best;
}

export function stageScene(name) {
  const g = makeGame(7);
  startGame(g);
  if (name === 'grill') {
    // Freeze with a skewer sizzling and the chef holding the next chopped one.
    runFor(g, 40, (state) => state.elapsed > 25 && state.grill.slots.filter((s) => s && s.done > 40).length >= 1 && state.skewer && state.skewer.chopped);
    // Fail-state juice, earned for real: idle the pilot (no takes) while
    // stoking, so a slot cooks past 100 and burns. A burnt slot breaks the
    // combo in real play, so the combo is reset here too.
    for (let i = 0; i < Math.round(16 / DT); i += 1) {
      if (g.grill.heat < 55) actStoke(g);
      gameTick(g, IDLE_KEYS, DT);
      if (g.phase !== 'play') break;
      if (g.grill.slots.some((s) => s && s.done > 105)) break;
    }
    if (g.grill.slots.some((s) => s && s.burnt)) g.combo = 0;
    // Resume the pilot briefly so the chef is holding the next chopped skewer.
    runFor(g, 12, (state) => state.skewer && state.skewer.chopped);
    // Rush event, staged for real: if the rush has not started yet, idle
    // (stoking, no takes) until it does, so the banner is in the frame.
    // The grill state survives the idle — burnt slots stay burnt, the chef
    // keeps holding the chopped skewer — and topUpOrders refills tickets.
    if (!g.fun.rush.active && !g.fun.rush.done) {
      for (let i = 0; i < Math.round(30 / DT); i += 1) {
        if (g.grill.heat < 55) actStoke(g);
        gameTick(g, IDLE_KEYS, DT);
        if (g.phase !== 'play' || g.fun.rush.active) break;
      }
    }
  } else if (name === 'plate') {
    // Freeze mid-assembly: a plated dish with its first garnish on, and a
    // next step still remaining so the BERIKUTNYA path line is visible.
    runFor(g, 60, (state) => state.elapsed > 25 && state.plate && state.plate.skewer.garnishes.length >= 1
      && state.plate.taken.length < recipeById(state.plate.skewer.recipeId).steps.length);
  } else if (name === 'serve') {
    // Freeze on the PERFECT stamp, right after the GOLDEN order is served —
    // the golden ticket stays visible as a happy "ENAK!" ticket while the
    // stamp is up. The pilot serves perfect almost every time, so the
    // golden serve is normally a PERFECT one; if it is not, fall back to
    // the next PERFECT stamp (still a valid serve shot).
    runFor(g, 110, (state) => state.elapsed > 30 && state.fun.goldenServed && state.flash && state.flash.text.startsWith('PERFECT'));
    if (!g.flash && g.phase === 'play') runFor(g, 10, (state) => state.flash && state.flash.text.startsWith('PERFECT'));
  } else {
    // Cover: freeze on a PERFECT serve with the score GENUINELY near the
    // 1200 target — never 4x it, never faked — and with the PANAS! streak
    // meter lit (streak >= 2), so the fun is in the frame. Multipliers
    // make serves pay more now, so the threshold is 800: the first
    // PERFECT flash past it lands ~800-1250.
    runFor(g, 110, (state) => state.elapsed > 45 && state.score >= 800 && state.fun.streak >= 2 && state.flash && state.flash.text.startsWith('PERFECT'));
    if (!g.flash) runFor(g, 20, (state) => state.score >= 900 && state.flash && state.flash.text.startsWith('PERFECT'));
  }
  topUpOrders(g);
  // Chef staging: the chef's FEET (legs, ±26 px) must stand in a floor gap
  // between the dining tables — left table ends 288, middle 522-758, right
  // starts 992 — so the feet-clear gaps are [314,496] and [784,966].
  // stageChefX enforces that: a staged x outside both gaps snaps to the
  // nearest gap centre instead of silently landing the chef on a table.
  // Cover/grill: 480 (left gap, near the grill). Plate/serve: 875 (right
  // gap centre, clear of every table edge and every guest). The old plate
  // (1015) and serve (1100) positions put the chef ON the right table,
  // hiding the right guest — this guard makes that impossible to re-stage.
  g.chef.x = stageChefX(name === 'plate' || name === 'serve' ? 875 : 480);
  g.chef.targetX = null;
  // A clean frame: no transient hint bar over the chef.
  g.message = '';
  g.messageT = 0;
  return { game: g, state: freeze(g) };
}
