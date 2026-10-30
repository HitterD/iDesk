const sharp = require('../apps/backend/node_modules/sharp');
const path = require('path');
const fs = require('fs');

async function processLogos() {
  const root = path.resolve(__dirname, '..');
  const inputPath = path.join(root, 'login picture/iDesk Logo.png');
  const outDir = path.join(root, 'apps/frontend/public');

  if (!fs.existsSync(inputPath)) {
    console.error('Source logo file not found:', inputPath);
    process.exit(1);
  }

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const isWhite = (idx) => data[idx] > 240 && data[idx + 1] > 240 && data[idx + 2] > 240;

  // 1. Flood-fill from outer image borders to make the entire exterior background transparent
  const visited = new Uint8Array(w * h);
  const queue = [];

  // Seed all 4 borders
  for (let x = 0; x < w; x++) {
    queue.push(x, 0);
    queue.push(x, h - 1);
    visited[x] = 1;
    visited[(h - 1) * w + x] = 1;
  }
  for (let y = 0; y < h; y++) {
    queue.push(0, y);
    queue.push(w - 1, y);
    visited[y * w] = 1;
    visited[y * w + (w - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    const idx = (cy * w + cx) * 4;

    if (isWhite(idx)) {
      data[idx + 3] = 0; // set alpha transparent
      const neighbors = [
        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nIdx = ny * w + nx;
          if (!visited[nIdx]) {
            visited[nIdx] = 1;
            if (isWhite(nIdx * 4)) {
              queue.push(nx, ny);
            }
          }
        }
      }
    }
  }

  // 2. Clear inner enclosed counters of letters ('D' and 'e' in text region y > 500)
  // This leaves the laptop screen (y < 490) completely solid white while letter loops become transparent.
  const compVisited = new Uint8Array(w * h);
  for (let y = 500; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (compVisited[idx] || data[idx * 4 + 3] === 0 || !isWhite(idx * 4)) continue;

      const comp = [];
      const q = [x, y];
      compVisited[idx] = 1;
      let qh = 0;

      while (qh < q.length) {
        const cx = q[qh++];
        const cy = q[qh++];
        comp.push(cy * w + cx);

        const neighbors = [
          [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            if (!compVisited[nIdx] && data[nIdx * 4 + 3] > 0 && isWhite(nIdx * 4)) {
              compVisited[nIdx] = 1;
              q.push(nx, ny);
            }
          }
        }
      }

      for (const pIdx of comp) {
        data[pIdx * 4 + 3] = 0;
      }
    }
  }

  // 3. Generate Full Logo (Laptop + iDesk Text)
  const fullOut = path.join(outDir, 'idesk-logo.png');
  const resFull = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .png({ compressionLevel: 9 })
    .toFile(fullOut);
  console.log(`[OK] Generated idesk-logo.png (${resFull.width}x${resFull.height})`);

  // 4. Generate Icon-Only Logo (Laptop + 3 Badges, y: 200..495)
  const laptopH = 495 - 200;
  const laptopBuf = Buffer.alloc(w * laptopH * 4);
  for (let y = 200; y < 495; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = ((y - 200) * w + x) * 4;
      laptopBuf[dstIdx] = data[srcIdx];
      laptopBuf[dstIdx + 1] = data[srcIdx + 1];
      laptopBuf[dstIdx + 2] = data[srcIdx + 2];
      laptopBuf[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  const iconOut = path.join(outDir, 'idesk-icon.png');
  const resIcon = await sharp(laptopBuf, { raw: { width: w, height: laptopH, channels: 4 } })
    .trim()
    .png({ compressionLevel: 9 })
    .toFile(iconOut);
  console.log(`[OK] Generated idesk-icon.png (${resIcon.width}x${resIcon.height})`);

  console.log('Finished processing iDesk logos successfully.');
}

processLogos().catch(err => {
  console.error('Error processing logos:', err);
  process.exit(1);
});
