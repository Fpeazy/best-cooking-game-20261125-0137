// Real play-test: drives the LIVE game in Chromium with real mouse clicks
// (no staged scenes), once to WIN (serve well for the full shift) and once to
// LOSE (idle: three customers walk out). Prints the live state each step.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const repo = '/home/hatch/workspace/makefun/best-cooking-game-20261125-0137-entry';
const server = spawn('node', ['serve.mjs', '8080'], { cwd: repo, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});

const ING = { chicken: [51, 360], beef: [117, 360], tofu: [183, 360], tempeh: [51, 412], mushroom: [117, 412] };
const SAUCE = { peanut: [800, 360], kecap: [846, 360], sambal: [892, 360] };
const GARN = { ketupat: [932, 460], onion: [964, 460], chili: [996, 460], cucumber: [1028, 460], krupuk: [1060, 460] };

async function snap(page) {
  return page.evaluate(() => {
    const g = window.__game;
    return {
      phase: g.phase, score: g.score, served: g.served, timeLeft: Math.round(g.timeLeft),
      walkouts: g.walkouts, combo: g.combo,
      skewer: g.skewer ? { items: g.skewer.items, chopped: g.skewer.chopped, done: Math.round(g.skewer.done), sauces: g.skewer.sauces } : null,
      plate: g.plate ? { taken: g.plate.taken.length, garnishes: g.plate.skewer.garnishes } : null,
      grill: g.grill.slots.map((s) => (s ? Math.round(s.done) : null)),
      heat: Math.round(g.grill.heat),
      orders: g.customers.list.filter((c) => c.state === 'waiting').map((c) => c.recipeId),
    };
  });
}

async function playToWin(page) {
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.click(640, 509); // MULAI MASAK
    await page.waitForTimeout(600);
    const ph = await page.evaluate(() => window.__game?.phase);
    if (ph === 'play') break;
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const s = await snap(page);
    if (s.phase !== 'play') { console.log('WIN RUN end:', JSON.stringify(s)); return s; }
    if (s.heat < 55) await page.keyboard.press(' ');
    if (s.plate) {
      const next = await page.evaluate(() => {
        const g = window.__game;
        if (!g?.plate?.skewer) return null;
        const rec = { ayam: ['ketupat', 'onion'], sapi: ['cucumber'], tahu: ['krupuk'], campur: ['onion'] }[g.plate.skewer.recipeId] || [];
        return rec.find((x) => !g.plate.skewer.garnishes.includes(x)) || null;
      });
      if (next) { const [x, y] = GARN[next]; await page.mouse.click(x, y); }
      else await page.mouse.click(1185, 375); // SAJIKAN
      await page.waitForTimeout(150);
      continue;
    }
    if (s.skewer && s.skewer.done > 0) {
      const nextSauce = await page.evaluate(() => {
        const g = window.__game;
        if (!g?.skewer) return null;
        const rec = { ayam: ['peanut', 'kecap'], sapi: ['kecap'], tahu: ['sambal'], campur: ['peanut', 'kecap'] }[g.skewer.recipeId] || [];
        return rec.find((x) => !g.skewer.sauces.includes(x)) || null;
      });
      if (nextSauce) { const [x, y] = SAUCE[nextSauce]; await page.mouse.click(x, y); }
      else await page.mouse.click(1015, 375); // plate counter
      await page.waitForTimeout(150);
      continue;
    }
    // Take a perfect skewer off the grill if the hand is free.
    const perfectIdx = s.grill.findIndex((d) => d !== null && d >= 70 && d <= 95);
    if (perfectIdx >= 0 && !s.skewer) {
      await page.mouse.click(472 + perfectIdx * 72, 372);
      await page.waitForTimeout(150);
      continue;
    }
    if (s.skewer) {
      if (!s.skewer.chopped) {
        await page.mouse.click(325, 375); // chop board (sets chopping)
        await page.waitForTimeout(500);
      } else {
        await page.mouse.click(585, 375); // grill body: place skewer
      }
      await page.waitForTimeout(150);
      continue;
    }
    // Empty hands: grill a second skewer in parallel while the first cooks
    // (up to 2 slots), so throughput — and the score — roughly doubles.
    const occupied = s.grill.filter((d) => d !== null).length;
    if (s.orders.length > 0 && occupied < 2) {
      const items = await page.evaluate(() => {
        const g = window.__game;
        const first = g?.customers.list.find((c) => c.state === 'waiting');
        if (!first) return ['chicken'];
        return { ayam: ['chicken'], sapi: ['beef', 'mushroom'], tahu: ['tofu', 'tempeh'], campur: ['chicken', 'beef', 'tofu'] }[first.recipeId];
      });
      for (const it of items) { const [x, y] = ING[it]; await page.mouse.click(x, y); await page.waitForTimeout(120); }
      continue;
    }
    await page.waitForTimeout(300);
  }
  const s = await snap(page);
  console.log('WIN RUN timeout:', JSON.stringify(s));
  return s;
}

async function playToLose(page) {
  await page.goto('http://localhost:8080/', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  // Click start, retrying until the title screen actually leaves.
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.click(640, 509);
    await page.waitForTimeout(600);
    const ph = await page.evaluate(() => window.__game?.phase);
    if (ph === 'play') break;
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const s = await snap(page);
    if (s.phase !== 'play') { console.log('LOSE RUN end:', JSON.stringify(s)); return s; }
    await page.waitForTimeout(1000);
  }
  const s = await snap(page);
  console.log('LOSE RUN timeout:', JSON.stringify(s));
  return s;
}

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));

const win = await playToWin(page);
console.log('WIN TEST:', win.phase === 'win' ? 'PASS' : `FAIL (phase=${win.phase} score=${win.score})`);
const lose = await playToLose(page);
console.log('LOSE TEST:', lose.phase === 'lose' ? 'PASS' : `FAIL (phase=${lose.phase})`);
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
server.kill();
process.exit(win.phase === 'win' && lose.phase === 'lose' && errors.length === 0 ? 0 : 1);
