// SATE BAKAR — the kitchen state machine: one skewer at a time through the
// ordered recipe path, grill doneness, sauce, plating and serving.
// Every HUD number the player sees is read from this state, never invented.
import { makeRng, SHIFT_SECONDS, WIN_SCORE, MAX_WALKOUTS, GRILL_SLOTS } from './config.js';
import { RECIPES, recipeById, validatePath } from './recipes.js';
import { makeCustomers, ensureCustomers, tickCustomers, serveCustomer } from './customers.js';
import { makeGrill, grillTick, stokeGrill, grillPlace, grillTake, grillQuality } from './grill.js';
import { makeChef, chefTick, chefWalkTo, chefNearStation } from './chef.js';
import { audioChop, audioPlace, audioDing, audioFail, audioServe, audioStoke } from './audio.js';

export function makeGame(seed) {
  const rng = makeRng(seed || 20261125);
  return {
    rng,
    phase: 'title',
    elapsed: 0,
    timeLeft: SHIFT_SECONDS,
    score: 0,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    served: 0,
    failed: 0,
    walkouts: 0,
    customers: makeCustomers(rng),
    grill: makeGrill(),
    chef: makeChef(),
    skewer: null, // chef's skewer: { items:[], chopped, done, burnt, sauces:[], garnishes:[], steps:[], recipeId }
    plate: null, // plated dish: { taken:[steps], skewer }
    message: '',
    messageT: 0,
    flash: null, // { text, color, t }
    particles: [],
    embers: [],
    audio: null,
    targetRecipeId: null,
    perfectServes: 0,
  };
}

export function startGame(g) {
  g.phase = 'play';
  g.elapsed = 0;
  g.timeLeft = SHIFT_SECONDS;
  g.score = 0;
  g.coins = 0;
  g.combo = 0;
  g.bestCombo = 0;
  g.served = 0;
  g.failed = 0;
  g.walkouts = 0;
  g.customers = makeCustomers(g.rng);
  g.grill = makeGrill();
  g.chef = makeChef();
  g.skewer = null;
  g.plate = null;
  g.message = 'Shift dimulai! Layani pelanggan!';
  g.messageT = 3;
  g.flash = null;
  g.targetRecipeId = RECIPES[0].id;
}

function say(g, text, seconds) {
  g.message = text;
  g.messageT = seconds || 2.5;
}

function burst(g, x, y, color, n) {
  for (let i = 0; i < (n || 12); i += 1) {
    g.particles.push({
      x, y,
      vx: (g.rng() - 0.5) * 260,
      vy: -40 - g.rng() * 160,
      life: 0.6 + g.rng() * 0.5,
      t: 0,
      color,
      size: 3 + g.rng() * 5,
    });
  }
}

// --- the ordered actions (the same functions the mouse, the keyboard and the
// staged scenes all call, so a staged shot is real play, not a picture) ---

export function actIngredient(g, id) {
  if (g.phase !== 'play') return false;
  if (g.plate) { say(g, 'Piring sudah terisi — sajikan dulu!', 2); return false; }
  if (!g.skewer) {
    const first = g.customers.list.find((c) => c.state === 'waiting');
    g.skewer = { items: [], chopped: false, done: 0, burnt: false, sauces: [], garnishes: [], steps: [], recipeId: first ? first.recipeId : null };
  }
  if (g.skewer.items.length >= 3) { say(g, 'Tusuk sudah penuh (3 bahan)!', 2); return false; }
  if (g.skewer.chopped || g.skewer.done > 0) { say(g, 'Sudah dipotong / dibakar — mulai tusuk baru.', 2); return false; }
  g.skewer.items.push(id);
  g.skewer.steps.push({ kind: 'skewer', item: id });
  if (g.audio) audioPlace(g.audio);
  return true;
}

export function actChop(g, dt) {
  if (g.phase !== 'play' || !g.skewer || g.skewer.chopped) return false;
  g.chef.chopProgress += dt * 2.2;
  if (g.chef.chopProgress >= 1) {
    g.chef.chopProgress = 0;
    g.skewer.chopped = true;
    g.skewer.steps.push({ kind: 'chop' });
    if (g.audio) audioChop(g.audio);
    burst(g, 325, 360, '#f2a65a', 8);
    return true;
  }
  return false;
}

export function actGrillPlace(g) {
  if (g.phase !== 'play' || !g.skewer || !g.skewer.chopped) {
    say(g, g.skewer ? 'Potong dulu di talenan!' : 'Tusuk bahan dulu!', 2);
    return -1;
  }
  const idx = grillPlace(g.grill, g.skewer);
  if (idx < 0) { say(g, 'Panggangan penuh!', 2); return -1; }
  g.skewer = null;
  if (g.audio) audioPlace(g.audio);
  return idx;
}

export function actGrillTake(g, idx) {
  if (g.phase !== 'play') return false;
  if (g.skewer) { say(g, 'Tangan sudah penuh!', 2); return false; }
  const slot = grillTake(g.grill, idx);
  if (!slot) return false;
  g.skewer = slot;
  g.skewer.steps.push({ kind: 'grill' });
  const q = grillQuality(slot);
  if (q === 'burnt') {
    say(g, 'GOSONG! Sate hangus — buang dan mulai lagi.', 2.5);
    g.skewer = null;
    g.combo = 0;
    g.failed += 1;
    if (g.audio) audioFail(g.audio);
    return false;
  }
  if (g.audio) audioPlace(g.audio);
  return true;
}

export function actSauce(g, id) {
  if (g.phase !== 'play' || !g.skewer || g.skewer.done <= 0) {
    say(g, 'Bakar sate dulu sebelum disaus!', 2);
    return false;
  }
  if (g.skewer.sauces.includes(id)) { say(g, 'Saus itu sudah ada.', 1.5); return false; }
  g.skewer.sauces.push(id);
  g.skewer.steps.push({ kind: 'sauce', item: id });
  if (g.audio) audioPlace(g.audio);
  burst(g, 845, 360, '#a4713b', 8);
  return true;
}

export function actPlate(g) {
  if (g.phase !== 'play' || !g.skewer || g.skewer.done <= 0) {
    say(g, 'Butuh sate matang untuk dipiring!', 2);
    return false;
  }
  if (g.plate) { say(g, 'Piring sudah terisi!', 2); return false; }
  g.plate = { taken: g.skewer.steps.slice(), skewer: g.skewer };
  g.skewer = null;
  if (g.audio) audioPlace(g.audio);
  return true;
}

export function actGarnish(g, id) {
  if (g.phase !== 'play' || !g.plate) {
    say(g, 'Taruh sate di piring dulu!', 2);
    return false;
  }
  if (g.plate.skewer.garnishes.includes(id)) return false;
  g.plate.skewer.garnishes.push(id);
  g.plate.taken.push({ kind: 'garnish', item: id });
  if (g.audio) audioPlace(g.audio);
  return true;
}

export function actStoke(g) {
  if (g.phase !== 'play') return false;
  const heat = stokeGrill(g.grill);
  if (g.audio) audioStoke(g.audio);
  burst(g, 585, 330, '#ff7b00', 14);
  say(g, `Arang dikipas! Panas ${Math.round(heat)}°`, 1.2);
  return true;
}

export function actDiscard(g) {
  g.skewer = null;
  g.plate = null;
  g.chef.chopProgress = 0;
  say(g, 'Dibuang — mulai dari awal.', 1.5);
}

// Serving: the plate's ordered steps must equal a waiting customer's recipe
// steps exactly. A perfect grill (70-95) earns the PERFECT stamp + combo.
export function actServe(g) {
  if (g.phase !== 'play' || !g.plate) {
    say(g, 'Tidak ada piring siap saji!', 2);
    return { score: 0 };
  }
  const taken = g.plate.taken;
  let match = null;
  for (const cust of g.customers.list) {
    if (cust.state !== 'waiting') continue;
    const recipe = recipeById(cust.recipeId);
    const v = validatePath(taken, recipe);
    if (v.ok && v.complete) { match = { cust, recipe }; break; }
  }
  if (!match) {
    g.failed += 1;
    g.combo = 0;
    g.flash = { text: 'SALAH URUTAN!', color: '#e63946', t: 1.4 };
    g.plate = null;
    if (g.audio) audioFail(g.audio);
    say(g, 'Pesanan salah — ikuti garis resep!', 2.5);
    return { score: 0 };
  }
  const perfect = g.plate.skewer.done >= 70 && g.plate.skewer.done <= 95;
  const res = serveCustomer(g.customers, match.recipe.id, perfect, g.elapsed);
  const earned = res.score;
  g.score += earned;
  g.coins += earned;
  g.served += 1;
  if (perfect) {
    g.combo += 1;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    g.perfectServes += 1;
    g.flash = { text: `PERFECT + COMBO x${g.combo}`, color: '#ffd166', t: 1.6 };
    burst(g, 1185, 360, '#ffd166', 22);
    if (g.audio) audioServe(g.audio);
  } else {
    g.combo = 0;
    g.flash = { text: `TERSAJI +${earned}`, color: '#7ee081', t: 1.2 };
    if (g.audio) audioDing(g.audio);
  }
  g.plate = null;
  return { score: earned, perfect };
}

export function gameTick(g, keys, dt) {
  if (g.phase === 'play') {
    g.elapsed += dt;
    g.timeLeft = Math.max(0, SHIFT_SECONDS - g.elapsed);
    ensureCustomers(g.customers, g.elapsed, dt);
    tickCustomers(g.customers, dt);
    grillTick(g.grill, dt);
    g.walkouts = g.customers.walkouts;
    if (g.messageT > 0) g.messageT -= dt;
    if (g.flash) {
      g.flash.t -= dt;
      if (g.flash.t <= 0) g.flash = null;
    }
    // Embers drift up from the grill, forever.
    if (g.rng() < dt * 6) {
      g.embers.push({ x: 460 + g.rng() * 250, y: 300, vy: 30 + g.rng() * 40, vx: (g.rng() - 0.5) * 20, t: 0, life: 2 + g.rng() * 2, size: 2 + g.rng() * 3 });
    }
    if (g.timeLeft <= 0) {
      // The shift is the full 120 seconds: win by reaching the target when
      // the clock runs out, lose by falling short or losing 3 customers.
      g.phase = g.score >= WIN_SCORE ? 'win' : 'lose';
    } else if (g.walkouts >= MAX_WALKOUTS) {
      g.phase = 'lose';
    }
  }
  chefTick(g.chef, keys, dt);
  for (const p of g.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }
  g.particles = g.particles.filter((p) => p.t < p.life);
  for (const e of g.embers) { e.t += dt; e.y -= e.vy * dt; e.x += e.vx * dt; }
  g.embers = g.embers.filter((e) => e.t < e.life);
  return g;
}

// Nearest station to the chef, for the E key.
export function nearestStation(g, stations) {
  let best = null;
  let bestD = Infinity;
  for (const [key, st] of Object.entries(stations)) {
    const d = Math.abs(g.chef.x - (st.x + st.w / 2));
    if (d < bestD) { bestD = d; best = key; }
  }
  return bestD < 200 ? best : null;
}
