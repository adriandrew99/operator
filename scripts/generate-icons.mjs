/**
 * Generate Nexus app icons from the master SVG logo.
 * Uses sharp to convert SVG → PNG at various sizes.
 *
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ACCENT = '#c2653a';
const BG = '#1a1918';

// Master SVG logo
function makeSvg(size) {
  // Scale the mountain path proportionally
  const s = size / 512;
  const r = Math.round(112 * s);

  // Mountain peak coordinates scaled
  const cx = size / 2;
  const topY = Math.round(110 * s);
  const botY = Math.round(350 * s);
  const outerLeft = Math.round(112 * s);
  const outerRight = Math.round(400 * s);
  const innerLeft = Math.round(192 * s);
  const innerRight = Math.round(320 * s);
  const notchY = Math.round(230 * s);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${ACCENT}"/>
  <path d="M${cx} ${topY} L${outerRight} ${botY} L${innerRight} ${botY} L${cx} ${notchY} L${innerLeft} ${botY} L${outerLeft} ${botY} Z" fill="white"/>
</svg>`;
}

// Maskable icon — extra padding for safe zone
function makeMaskableSvg(size) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  const s = inner / 512;
  const r = Math.round(112 * s);

  const cx = size / 2;
  const topY = pad + Math.round(110 * s);
  const botY = pad + Math.round(350 * s);
  const outerLeft = pad + Math.round(112 * s);
  const outerRight = pad + Math.round(400 * s);
  const innerLeft = pad + Math.round(192 * s);
  const innerRight = pad + Math.round(320 * s);
  const notchY = pad + Math.round(230 * s);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="${ACCENT}"/>
  <path d="M${cx} ${topY} L${outerRight} ${botY} L${innerRight} ${botY} L${cx} ${notchY} L${innerLeft} ${botY} L${outerLeft} ${botY} Z" fill="white"/>
</svg>`;
}

async function generate() {
  const publicIcons = join(ROOT, 'public', 'icons');
  if (!existsSync(publicIcons)) mkdirSync(publicIcons, { recursive: true });

  // --- PWA Icons ---
  await sharp(Buffer.from(makeSvg(192))).png().toFile(join(publicIcons, 'icon-192x192.png'));
  console.log('✓ public/icons/icon-192x192.png');

  await sharp(Buffer.from(makeSvg(512))).png().toFile(join(publicIcons, 'icon-512x512.png'));
  console.log('✓ public/icons/icon-512x512.png');

  await sharp(Buffer.from(makeMaskableSvg(512))).png().toFile(join(publicIcons, 'icon-512x512-maskable.png'));
  console.log('✓ public/icons/icon-512x512-maskable.png');

  // --- Apple Touch Icon (180x180) ---
  await sharp(Buffer.from(makeSvg(180))).png().toFile(join(publicIcons, 'apple-touch-icon.png'));
  console.log('✓ public/icons/apple-touch-icon.png');

  // --- Favicon ---
  await sharp(Buffer.from(makeSvg(32))).png().toFile(join(ROOT, 'src', 'app', 'favicon.ico'));
  console.log('✓ src/app/favicon.ico');

  // --- Tauri Icons ---
  const tauriIcons = join(ROOT, 'src-tauri', 'icons');
  if (!existsSync(tauriIcons)) mkdirSync(tauriIcons, { recursive: true });

  await sharp(Buffer.from(makeSvg(32))).png().toFile(join(tauriIcons, '32x32.png'));
  console.log('✓ src-tauri/icons/32x32.png');

  await sharp(Buffer.from(makeSvg(128))).png().toFile(join(tauriIcons, '128x128.png'));
  console.log('✓ src-tauri/icons/128x128.png');

  await sharp(Buffer.from(makeSvg(256))).png().toFile(join(tauriIcons, '128x128@2x.png'));
  console.log('✓ src-tauri/icons/128x128@2x.png');

  await sharp(Buffer.from(makeSvg(1024))).png().toFile(join(tauriIcons, 'icon.png'));
  console.log('✓ src-tauri/icons/icon.png');

  await sharp(Buffer.from(makeSvg(44))).png().toFile(join(tauriIcons, 'Square44x44Logo.png'));
  console.log('✓ src-tauri/icons/Square44x44Logo.png');

  await sharp(Buffer.from(makeSvg(150))).png().toFile(join(tauriIcons, 'Square150x150Logo.png'));
  console.log('✓ src-tauri/icons/Square150x150Logo.png');

  await sharp(Buffer.from(makeSvg(50))).png().toFile(join(tauriIcons, 'StoreLogo.png'));
  console.log('✓ src-tauri/icons/StoreLogo.png');

  console.log('\\n✅ All icons generated with mountain peak logo!');
}

generate().catch(console.error);
