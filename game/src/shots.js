// SATE BAKAR — staged screenshots: a deterministic autopilot plays the REAL game
// forward from a fresh seeded run, using the same action functions the player
// uses, and freezes the frame at the moment each scene asks for. Every number
// on screen (timer, score, combo, doneness) is the live state of that run.
import { makeGame, startGame, gameTick, actIngredient, actChop, actGrillPlace, actGrillTake, actSauce, actPlate, actGarnish, actServe, actStoke, actDiscard } from './kitchen.js';
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
    plateSteps: g.plate ? g.plate.taken.length : 0,
  };
}

export function stageScene(name) {
  const g = makeGame(7);
  startGame(g);
  if (name === 'grill') {
    // Freeze with a skewer sizzling and the chef holding the next chopped one.
    runFor(g, 40, (state) => state.elapsed > 25 && state.grill.slots.filter((s) => s && s.done > 40).length >= 1 && state.skewer && state.skewer.chopped);
  } else if (name === 'plate') {
    // Freeze mid-assembly: a plated dish with its first garnish on, mid-shift.
    runFor(g, 60, (state) => state.elapsed > 25 && state.plate && state.plate.skewer.garnishes.length >= 1);
  } else if (name === 'serve') {
    // Freeze on the PERFECT stamp, right after a perfect serve, mid-shift.
    runFor(g, 90, (state) => state.elapsed > 30 && state.flash && state.flash.text.startsWith('PERFECT'));
  } else {
    // Cover: mid-rush — late shift, score on the board, a perfect serve landing.
    runFor(g, 100, (state) => state.elapsed > 100 && state.flash && state.flash.text.startsWith('PERFECT'));
    if (!g.flash) runFor(g, 20, (state) => state.flash && state.flash.text.startsWith('PERFECT'));
  }
  // Keep the chef near the grill for the cover, near the plate otherwise.
  g.chef.x = name === 'plate' ? 1015 : name === 'serve' ? 1100 : 585;
  g.chef.targetX = null;
  // A clean frame: no transient hint bar over the chef.
  g.message = '';
  g.messageT = 0;
  return { game: g, state: freeze(g) };
}
