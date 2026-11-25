// SATE BAKAR — every pixel: night-warung canvas art, drawn fresh each frame.
// Full colour, warm charcoal glow, big chef, readable counters at a glance.
import { VIEW_W, VIEW_H, STATIONS, INGREDIENTS, GARNISHES, SAUCES, SHIFT_SECONDS, WIN_SCORE, MAX_WALKOUTS } from './config.js';
import { RECIPES, recipeById, nextStep } from './recipes.js';
import { grillQuality, PERFECT_LOW, PERFECT_HIGH } from './grill.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.fillStyle = color || '#fff';
  ctx.font = `${weight || 700} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function ingredientColor(id) {
  const ing = INGREDIENTS.find((i) => i.id === id);
  return ing ? ing.color : '#ccc';
}
function ingredientDark(id) {
  const ing = INGREDIENTS.find((i) => i.id === id);
  return ing ? ing.dark : '#888';
}

function drawSkewer(ctx, x, y, len, items, done, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  ctx.fillStyle = '#d9a05b';
  ctx.fillRect(-len / 2, -2, len, 4);
  const n = items.length || 1;
  for (let i = 0; i < n; i += 1) {
    const cx = -len / 2 + 14 + (i * (len - 28)) / Math.max(1, n - 1 || 1);
    const col = ingredientColor(items[i] || 'chicken');
    let fill = col;
    if (done > 0) {
      const burn = Math.min(1, done / 100);
      fill = burn > 0.95 ? '#2b1a12' : burn > 0.6 ? '#8a5a2b' : col;
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(cx - 3, -3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBackground(ctx, g, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#241239');
  grad.addColorStop(0.55, '#3a1c4d');
  grad.addColorStop(1, '#1a0f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // String lights across the top.
  ctx.strokeStyle = 'rgba(255,209,102,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.quadraticCurveTo(640, 58, 1280, 18);
  ctx.stroke();
  for (let i = 0; i < 16; i += 1) {
    const x = 40 + i * 78;
    const y = 22 + Math.sin((x / 1280) * Math.PI) * 34;
    const glow = 0.7 + 0.3 * Math.sin(t * 3 + i);
    ctx.fillStyle = ['#ffd166', '#ff6b6b', '#7ee081', '#4cc9f0'][i % 4];
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Warung awning stripes.
  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = i % 2 ? '#e63946' : '#fdf3d0';
    ctx.fillRect(i * 80, 0, 80, 14);
  }
  // Wooden counter band.
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(0, 280, VIEW_W, 190);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(0, 280, VIEW_W, 10);
  ctx.fillStyle = '#5a3418';
  for (let x = 0; x < VIEW_W; x += 90) ctx.fillRect(x, 300, 3, 160);
  // Floor.
  ctx.fillStyle = '#2a1a3a';
  ctx.fillRect(0, 470, VIEW_W, 250);
  ctx.fillStyle = '#33204a';
  for (let x = 0; x < VIEW_W; x += 120) ctx.fillRect(x, 470, 2, 250);
  // Grill glow on the floor.
  const glow = ctx.createRadialGradient(585, 380, 10, 585, 380, 260);
  glow.addColorStop(0, 'rgba(255,123,0,0.35)');
  glow.addColorStop(1, 'rgba(255,123,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(300, 120, 570, 520);
}

function drawTopBar(ctx, g) {
  ctx.fillStyle = 'rgba(10,5,20,0.85)';
  ctx.fillRect(0, 14, VIEW_W, 62);
  text(ctx, '🔥 SATE BAKAR', 24, 45, 30, '#ffd166', 'left', 900);
  text(ctx, 'Warung 60 Detik', 250, 46, 16, '#f8edeb', 'left', 600);
  // Timer — big, red under 10 seconds.
  const mm = Math.floor(g.timeLeft / 60);
  const ss = Math.floor(g.timeLeft % 60).toString().padStart(2, '0');
  const low = g.timeLeft <= 10 && g.phase === 'play';
  const pulse = low ? 1 + 0.12 * Math.sin(performance.now() / 120) : 1;
  ctx.save();
  ctx.translate(640, 45);
  ctx.scale(pulse, pulse);
  text(ctx, `${mm}:${ss}`, 0, 0, 34, low ? '#ff4757' : '#ffffff', 'center', 900);
  ctx.restore();
  text(ctx, `Skor ${g.score} / ${WIN_SCORE}`, 1000, 32, 20, '#ffffff', 'left', 800);
  text(ctx, `Koin ${g.coins}   Combo x${g.combo}   Saji ${g.served}`, 1000, 58, 16, '#ffd166', 'left', 600);
  // Shift progress.
  const prog = g.phase === 'title' ? 0 : 1 - g.timeLeft / SHIFT_SECONDS;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, 420, 68, 440, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#ff7b00';
  rr(ctx, 420, 68, 440 * prog, 6, 3);
  ctx.fill();
}

function drawOrders(ctx, g) {
  text(ctx, 'PESANAN', 24, 100, 15, '#ffd166', 'left', 800);
  const slots = [24, 340, 656];
  for (let i = 0; i < 3; i += 1) {
    const cust = g.customers.list[i];
    const x = slots[i];
    ctx.fillStyle = 'rgba(255,248,220,0.95)';
    rr(ctx, x, 112, 300, 158, 12);
    ctx.fill();
    if (!cust) {
      text(ctx, '— kosong —', x + 150, 190, 16, '#999', 'center', 600);
      continue;
    }
    const recipe = recipeById(cust.recipeId);
    text(ctx, cust.face, x + 34, 150, 34, '#000', 'center');
    text(ctx, cust.name, x + 62, 138, 17, '#222', 'left', 800);
    text(ctx, recipe.name, x + 62, 162, 15, '#7a3b00', 'left', 700);
    // Patience bar.
    ctx.fillStyle = '#e0d5c1';
    rr(ctx, x + 16, 182, 268, 12, 6);
    ctx.fill();
    ctx.fillStyle = cust.mood > 0.5 ? '#7ee081' : cust.mood > 0.25 ? '#ffd166' : '#e63946';
    rr(ctx, x + 16, 182, 268 * Math.max(0, cust.mood), 12, 6);
    ctx.fill();
    // Recipe steps as chips.
    let cx = x + 16;
    for (const step of recipe.steps) {
      const label = step.label;
      const w = 8 + label.length * 7.5;
      if (cx + w > x + 292) break;
      ctx.fillStyle = '#f0e6d2';
      rr(ctx, cx, 206, w, 24, 8);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + 4, 219);
      cx += w + 4;
    }
    text(ctx, `+${recipe.base} poin`, x + 284, 150, 13, '#b3541e', 'right', 700);
    if (cust.state === 'happy') {
      text(ctx, '✓ TERIMA KASIH!', x + 150, 246, 16, '#2d9d4e', 'center', 900);
    }
  }
  // Waiting customers by the serve window.
  let ax = 972;
  for (const cust of g.customers.list) {
    if (cust.state !== 'waiting') continue;
    text(ctx, cust.face, ax, 292, 30, '#000', 'center');
    ax += 34;
  }
}

function drawStationLabel(ctx, st, active) {
  ctx.fillStyle = active ? '#ffd166' : 'rgba(0,0,0,0.45)';
  rr(ctx, st.x + 8, st.y + 6, 76, 22, 8);
  ctx.fill();
  text(ctx, st.label, st.x + 46, st.y + 18, 12, active ? '#3a1c00' : '#fff', 'center', 800);
}

function drawStations(ctx, g, t) {
  // Ingredients counter.
  const ing = STATIONS.ingredients;
  drawStationLabel(ctx, ing, !!g.skewer && g.skewer.items.length < 3);
  INGREDIENTS.forEach((item, i) => {
    const x = ing.x + 12 + (i % 3) * 66;
    const y = ing.y + 38 + Math.floor(i / 3) * 52;
    ctx.fillStyle = item.color;
    rr(ctx, x, y, 58, 44, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y + 30, 58, 14);
    text(ctx, item.name, x + 29, y + 22, 13, '#3a1c00', 'center', 800);
  });
  // Chop board.
  const chop = STATIONS.chop;
  drawStationLabel(ctx, chop, !!g.skewer && !g.skewer.chopped);
  ctx.fillStyle = '#d9a05b';
  rr(ctx, chop.x + 15, chop.y + 40, 120, 80, 10);
  ctx.fill();
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 3;
  ctx.strokeRect(chop.x + 15, chop.y + 40, 120, 80);
  if (g.skewer && g.skewer.items.length > 0 && !g.skewer.chopped) {
    drawSkewer(ctx, chop.x + 75, chop.y + 80, 90, g.skewer.items, 0, -0.15);
    if (g.chef.chopProgress > 0) {
      ctx.fillStyle = '#fff';
      rr(ctx, chop.x + 25, chop.y + 128, 100, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#e63946';
      rr(ctx, chop.x + 25, chop.y + 128, 100 * g.chef.chopProgress, 10, 5);
      ctx.fill();
    }
    text(ctx, 'TAHAN KLIK / KLIK!', chop.x + 75, chop.y + 142, 11, '#fff', 'center', 700);
  } else {
    text(ctx, '🔪', chop.x + 75, chop.y + 80, 36, '#fff', 'center');
  }
  // Grill.
  const grill = STATIONS.grill;
  drawStationLabel(ctx, grill, g.grill.slots.some((s) => s !== null));
  const heatGlow = 0.25 + (g.grill.heat / 100) * 0.6 + (g.grill.stokeFlash > 0 ? 0.35 : 0);
  ctx.fillStyle = `rgba(255,${Math.round(90 + g.grill.heat)},0,${heatGlow})`;
  rr(ctx, grill.x + 10, grill.y + 36, 310, 92, 12);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  rr(ctx, grill.x + 10, grill.y + 36, 310, 92, 12);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(grill.x + 20 + i * 62, grill.y + 40);
    ctx.lineTo(grill.x + 20 + i * 62, grill.y + 124);
    ctx.stroke();
  }
  g.grill.slots.forEach((slot, i) => {
    const sx = grill.x + 52 + i * 72;
    const sy = grill.y + 82;
    if (slot) {
      drawSkewer(ctx, sx, sy, 56, slot.items, slot.done, 0);
      const q = grillQuality(slot);
      const col = q === 'burnt' ? '#e63946' : q === 'perfect' ? '#7ee081' : q === 'cooking' ? '#ffd166' : '#fff';
      ctx.fillStyle = '#111';
      rr(ctx, sx - 26, sy + 18, 52, 14, 5);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(sx - 24, sy + 20, 48 * Math.min(1, slot.done / 100), 10);
      text(ctx, q === 'perfect' ? 'SIAP!' : q === 'burnt' ? 'GOSONG' : `${Math.round(slot.done)}%`, sx, sy + 40, 11, col, 'center', 800);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  text(ctx, `Arang ${Math.round(g.grill.heat)}° — [Space] kipas`, grill.x + 165, grill.y + 152, 12, '#ffd166', 'center', 700);
  // Sauce station.
  const sauce = STATIONS.sauce;
  drawStationLabel(ctx, sauce, !!g.skewer && g.skewer.done > 0);
  SAUCES.forEach((s, i) => {
    const x = sauce.x + 12 + i * 46;
    const y = sauce.y + 40;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(x + 18, y + 20, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 14, y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, s.name, x + 18, y + 48, 11, '#fff', 'center', 700);
  });
  if (g.skewer && g.skewer.sauces.length > 0) {
    text(ctx, '✓ ' + g.skewer.sauces.join(' + '), sauce.x + 75, sauce.y + 108, 12, '#7ee081', 'center', 700);
  }
  // Plate counter.
  const plate = STATIONS.plate;
  drawStationLabel(ctx, plate, !!g.plate);
  ctx.fillStyle = '#fdf3d0';
  ctx.beginPath();
  ctx.ellipse(plate.x + 75, plate.y + 90, 58, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (g.plate) {
    drawSkewer(ctx, plate.x + 75, plate.y + 88, 80, g.plate.skewer.items, g.plate.skewer.done, -0.1);
    const gs = g.plate.skewer.garnishes;
    gs.forEach((gid, i) => {
      const garn = GARNISHES.find((a) => a.id === gid);
      if (!garn) return;
      ctx.fillStyle = garn.color;
      ctx.beginPath();
      ctx.arc(plate.x + 40 + i * 22, plate.y + 66, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    text(ctx, `${g.plate.taken.length} langkah`, plate.x + 75, plate.y + 138, 12, '#fff', 'center', 700);
  } else {
    text(ctx, '— kosong —', plate.x + 75, plate.y + 90, 13, '#999', 'center', 600);
  }
  // Garnish chips under the plate.
  GARNISHES.forEach((ga, i) => {
    const x = plate.x - 8 + i * 32;
    ctx.fillStyle = ga.color;
    rr(ctx, x, plate.y + 152, 28, 20, 6);
    ctx.fill();
  });
  // Serve window.
  const serve = STATIONS.serve;
  drawStationLabel(ctx, serve, !!g.plate);
  ctx.fillStyle = '#7ee081';
  rr(ctx, serve.x + 10, serve.y + 40, 130, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#1d7a35';
  rr(ctx, serve.x + 10, serve.y + 40, 130, 22, 10);
  ctx.fill();
  text(ctx, 'SAJIKAN!', serve.x + 75, serve.y + 86, 22, '#0b3d1a', 'center', 900);
  text(ctx, 'klik piring → sini', serve.x + 75, serve.y + 112, 11, '#0b3d1a', 'center', 600);
  // Recipe path line: pulsing arrows from the next station to the one after.
  drawPathLine(ctx, g, t);
}

function drawPathLine(ctx, g, t) {
  if (g.phase !== 'play') return;
  const cust = g.customers.list.find((c) => c.state === 'waiting');
  if (!cust) return;
  const recipeId = (g.plate && g.plate.skewer.recipeId) || (g.skewer && g.skewer.recipeId) || cust.recipeId;
  const recipe = recipeById(recipeId);
  if (!recipe) return;
  const taken = g.plate ? g.plate.taken : (g.skewer ? g.skewer.steps : []);
  const step = nextStep(taken, recipe);
  if (!step) return;
  const stationFor = { skewer: STATIONS.ingredients, chop: STATIONS.chop, grill: STATIONS.grill, sauce: STATIONS.sauce, garnish: STATIONS.plate }[step.kind];
  if (!stationFor) return;
  const cx = stationFor.x + stationFor.w / 2;
  const pulse = 0.6 + 0.4 * Math.sin(t * 5);
  const lineY = stationFor.y + stationFor.h + 8;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(cx - 40, lineY);
  ctx.lineTo(cx + 40, lineY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(cx + 48, lineY);
  ctx.lineTo(cx + 34, lineY - 7);
  ctx.lineTo(cx + 34, lineY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, `BERIKUTNYA: ${step.label}`, cx, lineY - 14, 13, '#ffd166', 'center', 800);
}

function drawChef(ctx, g, t) {
  const c = g.chef;
  const bob = c.moving ? Math.sin(c.walkPhase) * 4 : Math.sin(t * 2) * 2;
  const x = c.x;
  const y = c.y + bob;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, c.y + 78, 62, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = '#2b2b3a';
  ctx.fillRect(x - 26, y + 34, 20, 40);
  ctx.fillRect(x + 6, y + 34, 20, 40);
  // Apron body — big and bright.
  ctx.fillStyle = '#fdf3d0';
  rr(ctx, x - 48, y - 30, 96, 72, 18);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(x - 48, y - 30, 96, 14);
  text(ctx, 'SATE', x, y - 22, 13, '#fff', 'center', 900);
  // Arms.
  ctx.fillStyle = '#f2a65a';
  ctx.fillRect(x - 62, y - 24, 18, 52);
  ctx.fillRect(x + 44, y - 24, 18, 52);
  // Head + chef hat.
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(x, y - 52, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - 16, y - 72, 14, 0, Math.PI * 2);
  ctx.arc(x, y - 80, 16, 0, Math.PI * 2);
  ctx.arc(x + 16, y - 72, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 26, y - 76, 52, 12);
  // Face.
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x - 9, y - 54, 3, 0, Math.PI * 2);
  ctx.arc(x + 9, y - 54, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 46, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // Carried skewer above the head.
  if (g.skewer) {
    drawSkewer(ctx, x, y - 104, 84, g.skewer.items, g.skewer.done, -0.12);
    if (g.skewer.done > 0) text(ctx, `${Math.round(g.skewer.done)}% matang`, x, y - 122, 12, '#ffd166', 'center', 800);
  }
  // Name tag.
  text(ctx, 'KOKI WARUNG', x, y + 92, 12, '#ffd166', 'center', 800);
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const e of g.embers) {
    ctx.globalAlpha = Math.max(0, 1 - e.t / e.life);
    ctx.fillStyle = '#ff7b00';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Steam over the grill.
  const grill = STATIONS.grill;
  for (let i = 0; i < 3; i += 1) {
    const sx = grill.x + 90 + i * 80;
    const sy = grill.y + 30 - ((performance.now() / 40 + i * 40) % 40);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMessage(ctx, g) {
  if (g.messageT > 0 && g.message) {
    ctx.fillStyle = 'rgba(10,5,20,0.8)';
    const w = 20 + g.message.length * 9;
    rr(ctx, VIEW_W / 2 - w / 2, 492, w, 34, 10);
    ctx.fill();
    text(ctx, g.message, VIEW_W / 2, 510, 16, '#fff', 'center', 700);
  }
  if (g.flash) {
    const a = Math.min(1, g.flash.t);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(VIEW_W / 2, 300);
    ctx.rotate(-0.06);
    ctx.fillStyle = g.flash.color;
    rr(ctx, -220, -34, 440, 68, 12);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
    text(ctx, g.flash.text, 0, 2, 30, g.flash.color === '#ffd166' ? '#3a1c00' : '#fff', 'center', 900);
    ctx.restore();
  }
}

function drawOverlay(ctx, g) {
  ctx.fillStyle = 'rgba(10,5,20,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (g.phase === 'title') {
    text(ctx, '🔥', 640, 150, 90, '#ffd166', 'center');
    text(ctx, 'SATE BAKAR', 640, 250, 72, '#ffd166', 'center', 900);
    text(ctx, 'Warung 60 Detik', 640, 310, 30, '#fff', 'center', 700);
    text(ctx, 'Tusuk — Potong — Bakar — Saus — Sajikan. Ikuti urutan resepnya!', 640, 360, 20, '#f8edeb', 'center', 600);
    text(ctx, 'WASD / panah gerak  •  E pakai stasiun  •  Space kipas arang  •  Klik juga bisa', 640, 400, 18, '#ffd166', 'center', 600);
    text(ctx, 'Target: 600 poin sebelum waktu habis — 3 pelanggan kabur = kalah', 640, 440, 18, '#fff', 'center', 600);
    ctx.fillStyle = '#e63946';
    rr(ctx, 520, 480, 240, 56, 14);
    ctx.fill();
    text(ctx, '▶  MULAI MASAK', 640, 509, 22, '#fff', 'center', 900);
  } else if (g.phase === 'win') {
    text(ctx, '🏆', 640, 170, 90, '#ffd166', 'center');
    text(ctx, 'WARUNG LEGENDA!', 640, 270, 60, '#7ee081', 'center', 900);
    text(ctx, `Skor ${g.score}  •  ${g.served} piring tersaji  •  Combo terbaik x${g.bestCombo}  •  ${g.perfectServes} PERFECT`, 640, 340, 22, '#fff', 'center', 700);
    text(ctx, 'Pelanggan pulang bahagia. Tekan R untuk main lagi.', 640, 390, 18, '#ffd166', 'center', 600);
  } else {
    text(ctx, '😤', 640, 170, 90, '#ff6b6b', 'center');
    text(ctx, 'SHIFT GAGAL', 640, 270, 60, '#e63946', 'center', 900);
    text(ctx, `Skor ${g.score} (target ${WIN_SCORE})  •  ${g.served} piring tersaji  •  ${g.walkouts} pelanggan kabur`, 640, 340, 22, '#fff', 'center', 700);
    text(ctx, 'Tekan R untuk coba lagi — kali ini lebih cepat!', 640, 390, 18, '#ffd166', 'center', 600);
  }
}

export function renderGame(ctx, g, t) {
  drawBackground(ctx, g, t);
  drawTopBar(ctx, g);
  drawOrders(ctx, g);
  drawStations(ctx, g, t);
  drawParticles(ctx, g);
  drawChef(ctx, g, t);
  drawMessage(ctx, g);
  if (g.phase !== 'play') drawOverlay(ctx, g);
  // Controls hint, bottom-left.
  text(ctx, 'WASD gerak • E pakai • Space kipas • Klik stasiun • R ulang', 20, 700, 13, 'rgba(255,255,255,0.65)', 'left', 600);
  text(ctx, `Target ${WIN_SCORE} poin • Kabur ${g.walkouts}/${MAX_WALKOUTS}`, 1260, 700, 13, 'rgba(255,255,255,0.65)', 'right', 600);
}
