/**
 * Builds the Google Play feature graphic (1024 x 500) and the 512 x 512 store icon.
 *
 *   node scripts/store/feature-graphic.mjs
 *
 * Needs store/screenshots/01-live-earnings.png and 04-statistics.png (run scripts/store/screenshots.mjs first),
 * Playwright with Chromium, and Python/Pillow is NOT required (the icon is rendered by the browser as well).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const store = path.join(root, 'store');
mkdirSync(store, { recursive: true });
const b64 = (file) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const font = (w) => pathToFileUrl(path.join(root, 'node_modules', '@expo-google-fonts', 'inter', w.dir, `Inter_${w.dir}.ttf`));
const pathToFileUrl = (p) => `file://${p}`;

const live = b64(path.join(store, 'screenshots', '01-live-earnings.png'));
const stats = b64(path.join(store, 'screenshots', '04-statistics.png'));
const icon = b64(path.join(root, 'assets', 'images', 'icon.png'));

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:500;src:url(${font({ dir: '500Medium' })})}
@font-face{font-family:Inter;font-weight:700;src:url(${font({ dir: '700Bold' })})}
*{box-sizing:border-box;margin:0}
body{width:1024px;height:500px;overflow:hidden;font-family:Inter,system-ui,sans-serif;position:relative;
  background:linear-gradient(120deg,#033f30 0%,#065f46 45%,#10b981 120%)}
.c1{position:absolute;right:-120px;top:-180px;width:520px;height:520px;border-radius:50%;background:rgba(255,255,255,.07)}
.c2{position:absolute;left:-140px;bottom:-220px;width:460px;height:460px;border-radius:50%;background:rgba(255,255,255,.06)}
.copy{position:absolute;left:60px;top:78px;width:470px;color:#fff}
.brand{display:flex;align-items:center;gap:18px}
.brand img{width:76px;height:76px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.brand b{font-size:50px;letter-spacing:-1.2px;font-weight:700}
h1{margin-top:30px;font-size:35px;line-height:1.18;letter-spacing:-.6px;font-weight:700}
h1 span{color:#a7f3d0}
ul{margin-top:26px;list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:10px}
li{font-size:16px;font-weight:500;padding:9px 15px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22)}
.phone{position:absolute;border-radius:30px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.45);border:5px solid #0b1210;background:#0b1210}
.phone img{display:block;width:100%}
.p1{left:640px;top:62px;width:262px;height:466px;transform:rotate(-3deg);z-index:2}
.p2{left:808px;top:104px;width:236px;height:420px;transform:rotate(5deg);z-index:1;opacity:.96}
</style></head><body>
<div class="c1"></div><div class="c2"></div>
<div class="copy">
  <div class="brand"><img src="${icon}"><b>WorkEarn</b></div>
  <h1>Your time.<br>Your money. <span>Live.</span></h1>
  <ul><li>Live earnings</li><li>Pay rules &amp; bonuses</li><li>Private &amp; offline</li></ul>
</div>
<div class="phone p2"><img src="${stats}"></div>
<div class="phone p1"><img src="${live}"></div>
</body></html>`;

const file = path.join(os.tmpdir(), 'workearn-feature-graphic.html');
writeFileSync(file, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await page.goto(pathToFileUrl(file));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(store, 'feature-graphic-1024x500.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
console.log('wrote store/feature-graphic-1024x500.png');

// 512 x 512 store icon from the same artwork as the app icon (full-bleed square; Play applies its own mask)
const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await iconPage.setContent(`<body style="margin:0"><img src="${icon}" style="width:512px;height:512px;display:block"></body>`);
await iconPage.waitForTimeout(200);
await iconPage.screenshot({ path: path.join(store, 'icon-512.png'), clip: { x: 0, y: 0, width: 512, height: 512 } });
console.log('wrote store/icon-512.png');
await browser.close();
