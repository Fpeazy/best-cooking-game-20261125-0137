// Take the 4 deterministic screenshots for SATE BAKAR.
// Usage: node take-shots.mjs  (serves game/ on :8080, screenshots into screenshots/)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const repo = '/home/hatch/workspace/makefun/best-cooking-game-20261125-0137-entry';
const shots = [
  { name: '1-cover.jpg', query: '?scene=cover' },
  { name: '2-grill.jpg', query: '?scene=grill' },
  { name: '3-plate.jpg', query: '?scene=plate' },
  { name: '4-serve.jpg', query: '?scene=serve' },
];

const server = spawn('node', ['serve.mjs', '8080'], { cwd: repo, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});

let failures = 0;
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  try {
    await page.goto(`http://localhost:8080/${shot.query}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__shotReady === true, { timeout: 60000 });
    const state = await page.evaluate(() => window.__shotState);
    console.log(`${shot.name}: state=${JSON.stringify(state)}`);
    const out = join(repo, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    const size = statSync(out).size;
    console.log(`  ${size} bytes ${size <= 262144 ? 'OK' : 'OVER 256 KiB'} | errors: ${errors.length}`);
    for (const e of errors) console.log(`  ${e}`);
    if (errors.length) failures += 1;
    if (size > 262144) failures += 1;
  } catch (e) {
    console.log(`${shot.name}: FAILED — ${e.message}`);
    failures += 1;
  }
  await page.close();
}
await browser.close();
server.kill();
console.log(failures === 0 ? 'ALL SHOTS OK' : `${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
