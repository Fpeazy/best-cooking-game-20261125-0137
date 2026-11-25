// SATE BAKAR — customers: order tickets, patience meters, walkouts, tips.
// Pressure grows over the shift: new orders arrive faster and patience shrinks.
// One order per shift is the golden "Pesanan Emas": the shift's rare bonus
// recipe, worth a +100 tip — the chase moment.
import { RECIPES, allRecipes } from './recipes.js';

const FACES = ['😀', '😊', '😋', '🤤', '😎', '🥰'];
const NAMES = ['Budi', 'Sari', 'Agus', 'Rina', 'Dewi', 'Joko', 'Maya', 'Rudi'];

export function makeCustomers(rng, fun) {
  return {
    list: [],
    served: 0,
    walkouts: 0,
    tips: 0,
    spawnTimer: 0,
    nextId: 1,
    rng,
    fun: fun || null,
    usedNames: [], // names already used this session: never repeat in one frame
    spawnCount: 0, // customers spawned this shift: drives the golden order
  };
}

export function spawnCustomer(c, elapsed) {
  c.spawnCount += 1;
  // The golden order: one per shift — the 4th or 5th customer — always the
  // shift's rare bonus recipe. It gets extra patience so the player can
  // actually chase and cook it.
  const isGolden = !!c.fun && c.spawnCount === c.fun.goldenSpawn;
  let recipe;
  if (isGolden) {
    recipe = allRecipes().find((r) => r.id === 'langka');
  } else {
    const bonus = allRecipes().find((r) => r.id === 'langka');
    recipe = (bonus && c.rng() < 0.2) ? bonus : RECIPES[Math.floor(c.rng() * RECIPES.length)];
  }
  // Later in the shift patience is shorter and orders come faster.
  const patienceMax = Math.max(28, 52 - elapsed * 0.16) * (isGolden ? 1.3 : 1);
  const face = FACES[Math.floor(c.rng() * FACES.length)];
  // Unique name per session: draw from the names not yet used; reshuffle the
  // pool only once every name has been used, so one frame never repeats a name.
  let pool = NAMES.filter((n) => !c.usedNames.includes(n));
  if (pool.length === 0) { c.usedNames = []; pool = NAMES.slice(); }
  const name = pool[Math.floor(c.rng() * pool.length)];
  c.usedNames.push(name);
  const customer = {
    id: c.nextId,
    name,
    face,
    recipeId: recipe.id,
    patience: patienceMax,
    patienceMax,
    state: 'waiting',
    mood: 1,
    golden: isGolden,
  };
  c.nextId += 1;
  c.list.push(customer);
  return customer;
}

export function ensureCustomers(c, elapsed, dt, rushActive) {
  if (c.list.length < 3) {
    c.spawnTimer -= dt;
    if (c.spawnTimer <= 0) {
      spawnCustomer(c, elapsed);
      // Spawn gap shrinks as the shift goes on: 9s early, ~4s late.
      // During JAM RAMAI the warung floods: ~4.5s early, 2s floor.
      const base = rushActive ? 4.5 : 9;
      const floor = rushActive ? 2 : 4;
      c.spawnTimer = Math.max(floor, base - elapsed * 0.045);
    }
  }
}

// Returns the ticket slots that walked out this tick, so the kitchen can
// flash the KABUR! reaction over the right slot. During JAM RAMAI patience
// drains 1.5x faster.
export function tickCustomers(c, dt, rushActive) {
  const walked = [];
  for (let i = 0; i < c.list.length; i += 1) {
    const cust = c.list[i];
    if (cust.state !== 'waiting') continue;
    cust.patience -= dt * (rushActive ? 1.5 : 1);
    cust.mood = cust.patience / cust.patienceMax;
    if (cust.patience <= 0) {
      cust.state = 'left';
      c.walkouts += 1;
      walked.push(i);
    }
  }
  c.list = c.list.filter((cust) => cust.state === 'waiting' || cust.state === 'happy');
  // Happy customers linger a moment, then leave satisfied.
  for (const cust of c.list) {
    if (cust.state === 'happy') cust.happyT = (cust.happyT || 0) + dt;
  }
  c.list = c.list.filter((cust) => cust.state !== 'happy' || (cust.happyT || 0) < 2.5);
  return walked;
}

// Serve the plate to the first waiting customer whose recipe matches it.
// Returns the score earned (0 when nobody wants that dish).
export function serveCustomer(c, recipeId, perfect, elapsed) {
  const idx = c.list.findIndex((cust) => cust.state === 'waiting' && cust.recipeId === recipeId);
  if (idx < 0) return { score: 0, customer: null };
  const cust = c.list[idx];
  const recipe = RECIPES.find((r) => r.id === recipeId) || allRecipes().find((r) => r.id === recipeId);
  const speedBonus = Math.round((cust.patience / cust.patienceMax) * 40);
  const score = recipe.base + speedBonus + (perfect ? 50 : 0);
  cust.state = 'happy';
  c.served += 1;
  c.tips += speedBonus;
  return { score, customer: cust };
}
