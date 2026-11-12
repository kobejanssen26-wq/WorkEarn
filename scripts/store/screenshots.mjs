/**
 * Renders the REAL app screens (react-native-web build of the production code, in-memory sql.js database filled with
 * sample data by src/preview/seed.ts) in headless Chromium and writes Play Store screenshots (1080 x 1920 PNG).
 *
 *   node scripts/store/screenshots.mjs [outDir]
 *
 * Requires Playwright with Chromium. These are renderings of the app's UI code on the web platform, not captures from an
 * Android device: fonts and shadows can differ slightly. Replace them with device screenshots if you prefer.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'store', 'screenshots'));
const dist = path.join(os.tmpdir(), 'workearn-web-dist');
mkdirSync(outDir, { recursive: true });
mkdirSync(path.join(root, 'public'), { recursive: true });
copyFileSync(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join(root, 'public', 'sql-wasm.wasm'));

console.log('Exporting the web build ...');
const exp = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dist], { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' } });
if (exp.status !== 0) process.exit(exp.status ?? 1);

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html'); // SPA fallback
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// 405 x 720 CSS pixels at 2.6667 = exactly 1080 x 1920. "Now" is fixed so the sample data is deterministic.
const NOW = new Date('2026-11-12T10:42:00+01:00');
const shots = [
  { file: '01-live-earnings.png', path: '/?demo=1', scheme: 'light' },
  { file: '02-stop-summary.png', path: '/?demo=1', scheme: 'light', action: async (page) => (await page.getByLabel('Stop', { exact: true }).click(), await page.waitForTimeout(500)) },
  { file: '03-calendar.png', path: '/calendar?demo=1', scheme: 'light', action: async (page) => (await page.getByLabel(/^Tuesday 10 November/).first().click().catch(() => {}), await page.waitForTimeout(300)) },
  { file: '04-statistics.png', path: '/statistics?demo=1', scheme: 'dark' },
  { file: '05-history.png', path: '/history?demo=1', scheme: 'dark' },
  { file: '06-employer-pay-rules.png', path: '/employers/1?demo=1', scheme: 'light' },
  { file: '07-dark-live-earnings.png', path: '/?demo=1', scheme: 'dark' },
  { file: '08-nl-live-earnings.png', path: '/?demo=1&lang=nl', scheme: 'light' },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const context = await browser.newContext({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, colorScheme: shot.scheme, timezoneId: 'Europe/Brussels', locale: 'en-GB' });
  await context.clock.setFixedTime(NOW);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('  page error:', e.message));
  await page.goto(base + shot.path, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.innerText.trim().length > 40, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  if (shot.action) await shot.action(page);
  await page.screenshot({ path: path.join(outDir, shot.file) });
  console.log('wrote', path.relative(root, path.join(outDir, shot.file)));
  await context.close();
}
await browser.close();
server.close();
