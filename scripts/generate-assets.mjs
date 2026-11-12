/**
 * Generates the app icon, adaptive icon layers and splash images from SVG using headless Chromium.
 *
 *   node scripts/generate-assets.mjs
 *
 * Requires Playwright with a Chromium build (`npm i -D playwright` or a global install).
 * The outputs in assets/images are committed, so running this is only needed to change the artwork.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets', 'images');
mkdirSync(out, { recursive: true });

const EMERALD_DARK = '#047857';
const EMERALD = '#10B981';
const MINT = '#A7F3D0';

/** The WorkEarn mark: a "W" (work) whose last stroke rises (earnings) plus a live dot. Drawn in a 1024 box. */
function mark({ w = '#FFFFFF', dot = MINT, scale = 1, dotRing = true }) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `
  <g transform="${t}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="238,338 372,704 512,452 652,704 786,338" stroke="${w}" stroke-width="92"/>
    ${dotRing ? `<circle cx="842" cy="206" r="68" fill="${dot}" opacity="0.28" stroke="none"/>` : ''}
    <circle cx="842" cy="206" r="40" fill="${dot}" stroke="none"/>
  </g>`;
}

const gradient = (id = 'g') => `
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${EMERALD_DARK}"/><stop offset="1" stop-color="${EMERALD}"/>
  </linearGradient></defs>`;

const svgs = {
  // Legacy / store icon: full-bleed square (Android masks it).
  'icon.png': { size: 1024, transparent: false, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${gradient()}<rect width="1024" height="1024" fill="url(#g)"/>${mark({})}</svg>` },
  // Adaptive icon foreground: mark kept inside the 66 % safe zone, transparent background.
  'adaptive-icon.png': { size: 1024, transparent: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark({ scale: 0.8 })}</svg>` },
  // Adaptive icon background: the gradient only.
  'adaptive-icon-background.png': { size: 1024, transparent: false, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${gradient()}<rect width="1024" height="1024" fill="url(#g)"/></svg>` },
  // Themed (monochrome) icon: single colour on transparent, the system tints it.
  'adaptive-icon-monochrome.png': { size: 1024, transparent: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark({ w: '#000000', dot: '#000000', scale: 0.8, dotRing: false })}</svg>` },
  // Splash icon on a light background.
  'splash-icon.png': { size: 1024, transparent: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark({ w: EMERALD_DARK, dot: EMERALD, scale: 0.9 })}</svg>` },
  // Splash icon on a dark background.
  'splash-icon-dark.png': { size: 1024, transparent: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark({ w: '#F1F5F3', dot: '#34D399', scale: 0.9 })}</svg>` },
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, { size, transparent, svg }] of Object.entries(svgs)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${svg}</body></html>`);
  await page.screenshot({ path: path.join(out, name), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.join('assets/images', name));
}
await browser.close();
