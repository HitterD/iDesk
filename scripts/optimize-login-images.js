/**
 * One-off image optimizer for the login page and shared branding assets.
 * Uses the sharp copy already installed for the backend (no new dependency).
 *
 *   node scripts/optimize-login-images.js
 *
 * - Login slideshow photos -> WebP, max 1920x1080 (landscape crop).
 * - Logos -> WebP at ~2x their on-screen size.
 * - KB screenshots stay .png (articles link to them by path) and are
 *   re-encoded as palette PNG, only when that is actually smaller.
 */
const sharp = require('../apps/backend/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.resolve(__dirname, '../apps/frontend/public');
const PHOTO_WIDTH = 1920;
const PHOTO_HEIGHT = 1080;
const PHOTO_QUALITY = 78;
const LOGO_QUALITY = 90;

const PHOTOS = [
  'login-plants/sidoarjo-plant.png',
  'login-plants/sukodono-plant.png',
  'login-plants/semarang-plant.png',
  'login-plants/karawang-plant.png',
  'login-plants/marketing-office.jpeg',
];

// [source, max height in px] — 2x the largest rendered height.
const LOGOS = [
  ['logos/kapal-api-group.png', 104],
  ['logos/sja-logo.png', 104],
  ['idesk-logo.png', 160],
];

const KB_DIRS = ['kb/user-guide', 'kb/user-guide/raw', 'assets/kb-guide'];

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const webpPath = (rel) => rel.replace(/\.(png|jpe?g)$/i, '.webp');

async function toWebp(rel, pipeline) {
  const src = path.join(PUBLIC_DIR, rel);
  const out = path.join(PUBLIC_DIR, webpPath(rel));
  const info = await pipeline(sharp(src).rotate()).toFile(out);
  console.log(`${rel}: ${kb(fs.statSync(src).size)} -> ${kb(info.size)} (${info.width}x${info.height})`);
  fs.unlinkSync(src);
}

async function recompressPng(rel) {
  const src = path.join(PUBLIC_DIR, rel);
  const before = fs.statSync(src).size;
  const buf = await sharp(src).png({ palette: true, quality: 85, compressionLevel: 9, effort: 10 }).toBuffer();
  if (buf.length < before) fs.writeFileSync(src, buf);
  console.log(`${rel}: ${kb(before)} -> ${kb(Math.min(buf.length, before))}`);
}

async function main() {
  for (const rel of PHOTOS) {
    await toWebp(rel, (img) => img
      .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: 'cover', position: 'attention', withoutEnlargement: false })
      .webp({ quality: PHOTO_QUALITY, effort: 6 }));
  }
  for (const [rel, height] of LOGOS) {
    await toWebp(rel, (img) => img
      .resize({ height, withoutEnlargement: true })
      .webp({ quality: LOGO_QUALITY, alphaQuality: 100, effort: 6 }));
  }
  for (const dir of KB_DIRS) {
    for (const name of fs.readdirSync(path.join(PUBLIC_DIR, dir))) {
      if (name.endsWith('.png')) await recompressPng(`${dir}/${name}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
