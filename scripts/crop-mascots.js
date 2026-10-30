const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function cropMascots() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  const imgPath = path.resolve('iDesk Karakter/Mail dan Synology Karakter.png');
  const b64 = fs.readFileSync(imgPath).toString('base64');

  // Calculate tight bboxes for both
  const bboxes = await page.evaluate(async (src) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    function getBbox(xMin, xMax) {
      let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = xMin; x < xMax; x++) {
          const a = data[(y * img.width + x) * 4 + 3];
          if (a > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }

    return {
      mail: getBbox(0, 935),
      synology: getBbox(940, img.width),
    };
  }, 'data:image/png;base64,' + b64);

  console.log('Bboxes:', bboxes);

  for (const [name, rect] of Object.entries(bboxes)) {
    const pad = 12;
    const cropX = Math.max(0, rect.x - pad);
    const cropY = Math.max(0, rect.y - pad);
    const cropW = rect.width + pad * 2;
    const cropH = rect.height + pad * 2;

    await page.setViewport({ width: cropW, height: cropH });
    await page.setContent('<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:transparent;"><canvas id="c"></canvas></body></html>');

    const cropB64 = await page.evaluate(async (src, cx, cy, cw, ch) => {
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = src; });
      const c = document.getElementById('c');
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
      return c.toDataURL('image/png');
    }, 'data:image/png;base64,' + b64, cropX, cropY, cropW, cropH);

    const buf = Buffer.from(cropB64.replace(/^data:image\/png;base64,/, ''), 'base64');
    const dest = path.resolve('apps/frontend/public/characters', `mascot-${name}.png`);
    fs.writeFileSync(dest, buf);
    console.log(`Saved mascot-${name}.png (${cropW}x${cropH}) to ${dest}`);
  }

  await browser.close();
}

cropMascots().catch(err => {
  console.error(err);
  process.exit(1);
});
