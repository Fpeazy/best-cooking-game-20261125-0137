// SATE BAKAR — entry point: canvas setup, the frame loop, mouse + keyboard
// wiring to the kitchen actions, and the staged-shot mode (?scene=...).
import { VIEW_W, VIEW_H, STATIONS, INGREDIENTS, SAUCES, GARNISHES } from './config.js';
import { makeGame, startGame, gameTick, actIngredient, actChop, actGrillPlace, actGrillTake, actSauce, actPlate, actGarnish, actServe, actStoke, actDiscard, nearestStation } from './kitchen.js';
import { makeInput, attachInput } from './input.js';
import { makeAudio, audioUnlock } from './audio.js';
import { renderGame } from './render.js';
import { stageScene } from './shots.js';
import { recipeById } from './recipes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function fitCanvas() {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
}
fitCanvas();

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
const seed = Number(params.get('seed') || 7);

let game;
let shotState = null;
if (scene) {
  const staged = stageScene(scene);
  game = staged.game;
  shotState = staged.state;
} else {
  game = makeGame(seed);
}
game.audio = makeAudio();
window.__game = game; // live state for play-testing and debugging
const input = makeInput();
attachInput(input, canvas);

let chopping = false;

function stationAt(x, y) {
  for (const [key, st] of Object.entries(STATIONS)) {
    if (x >= st.x && x <= st.x + st.w && y >= st.y && y <= st.y + st.h) return key;
  }
  return null;
}

function handleClick(x, y) {
  if (game.phase === 'title') {
    if (x >= 520 && x <= 760 && y >= 480 && y <= 536) {
      audioUnlock(game.audio);
      startGame(game);
    }
    return;
  }
  if (game.phase !== 'play') return;
  audioUnlock(game.audio);
  const st = stationAt(x, y);
  // Ingredient chips.
  const ing = STATIONS.ingredients;
  for (let i = 0; i < INGREDIENTS.length; i += 1) {
    const cx = ing.x + 12 + (i % 3) * 66;
    const cy = ing.y + 38 + Math.floor(i / 3) * 52;
    if (x >= cx && x <= cx + 58 && y >= cy && y <= cy + 44) {
      actIngredient(game, INGREDIENTS[i].id);
      return;
    }
  }
  // Sauce chips.
  const sauce = STATIONS.sauce;
  for (let i = 0; i < SAUCES.length; i += 1) {
    const cx = sauce.x + 12 + i * 46;
    const cy = sauce.y + 40;
    if (x >= cx && x <= cx + 40 && y >= cy && y <= cy + 44) {
      actSauce(game, SAUCES[i].id);
      return;
    }
  }
  // Garnish chips under the plate counter.
  const plate = STATIONS.plate;
  for (let i = 0; i < GARNISHES.length; i += 1) {
    const gx = plate.x - 8 + i * 32;
    const gy = plate.y + 152;
    if (x >= gx && x <= gx + 28 && y >= gy && y <= gy + 20) {
      actGarnish(game, GARNISHES[i].id);
      return;
    }
  }
  if (st === 'chop') { chopping = true; return; }
  if (st === 'grill') {
    // A click on a slot takes the skewer; a click on the grill body stokes it.
    const grill = STATIONS.grill;
    let took = false;
    game.grill.slots.forEach((slot, i) => {
      const sx = grill.x + 52 + i * 72;
      const sy = grill.y + 82;
      if (slot && Math.abs(x - sx) < 30 && Math.abs(y - sy) < 30) {
        actGrillTake(game, i);
        took = true;
      }
    });
    if (!took) {
      if (game.skewer && game.skewer.chopped && game.skewer.done <= 0) actGrillPlace(game);
      else actStoke(game);
    }
    return;
  }
  if (st === 'plate') { actPlate(game); return; }
  if (st === 'serve') { actServe(game); return; }
  if (st === 'sauce') { return; }
  if (st === 'ingredients') { return; }
}

function interactNearest() {
  const key = nearestStation(game, STATIONS);
  if (!key) return;
  const cust = game.customers.list.find((c) => c.state === 'waiting');
  if (key === 'ingredients' && cust) {
    const recipe = recipeById(cust.recipeId);
    const next = recipe.steps.find((s) => s.kind === 'skewer' && !game.skewer?.items.includes(s.item));
    if (next) actIngredient(game, next.item);
  } else if (key === 'chop') {
    chopping = true;
  } else if (key === 'grill') {
    const idx = game.grill.slots.findIndex((s) => s && s.done >= 70);
    if (idx >= 0) actGrillTake(game, idx);
    else if (game.skewer) actGrillPlace(game);
    else actStoke(game);
  } else if (key === 'sauce' && cust) {
    const recipe = recipeById(cust.recipeId);
    const next = recipe.steps.find((s) => s.kind === 'sauce' && !game.skewer?.sauces.includes(s.item));
    if (next) actSauce(game, next.item);
  } else if (key === 'plate') {
    actPlate(game);
  } else if (key === 'serve') {
    actServe(game);
  }
}

window.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R') && game.phase !== 'title') startGame(game);
  if ((e.key === 'x' || e.key === 'X') && game.phase === 'play') actDiscard(game);
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!scene) {
    while (input.clicks.length > 0) {
      const c = input.clicks.shift();
      handleClick(c.x, c.y);
    }
    if (input.interactPressed) { interactNearest(); input.interactPressed = false; }
    if (input.stokePressed) { actStoke(game); input.stokePressed = false; }
    if (chopping) {
      const done = actChop(game, dt);
      if (done || !game.skewer || game.skewer.chopped) chopping = false;
    }
    if (input.chopHeld && game.skewer && !game.skewer.chopped) {
      const st = stationAt(game.chef.x, 375);
      if (st === 'chop' || true) actChop(game, dt);
    }
    gameTick(game, input.keys, dt);
    if (statusEl) {
      statusEl.textContent = `Skor ${game.score}, waktu ${Math.ceil(game.timeLeft)} detik, ${game.served} piring tersaji.`;
    }
  }
  renderGame(ctx, game, now / 1000);
  if (scene) {
    window.__shotState = shotState;
    window.__shotReady = true;
  } else {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);
