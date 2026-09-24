const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function inspect() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Function to load image and probe colors
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <canvas id="c" width="1920" height="1080"></canvas>
      </body>
    </html>
  `);

  async function loadImg(imgName) {
    const rawPath = path.join(RAW_DIR, imgName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate(async (src) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = src; });
      ctx.drawImage(img, 0, 0, 1920, 1080);
    }, `data:image/png;base64,${b64}`);
  }

  // Probe 03_create_ticket_selection.png: find bounding box of the 3 top cards and bottom cards
  console.log('--- Analyzing 03_create_ticket_selection.png ---');
  await loadImg('03_create_ticket_selection.png');
  const cards03 = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 1920, 1080);
    const data = imgData.data;

    function getPixel(x, y) {
      const idx = (y * 1920 + x) * 4;
      return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
    }

    // Scan horizontal line at y=320 (middle of top cards)
    // The background is around #F8FAFC (248, 250, 252) or gray, while cards are white (255, 255, 255) with border
    const y320 = [];
    for (let x = 100; x < 1800; x++) {
      const [r, g, b] = getPixel(x, 320);
      y320.push({ x, r, g, b });
    }

    // Find cards by scanning border/background transition at y=320
    // Look for where pixel is pure white or near white compared to background
    return {
      bgSample: getPixel(100, 320),
      card1Mid: getPixel(400, 320),
      gapSample: getPixel(625, 320),
      // Scan y=200..500 at x=400 to find top and bottom of top card
      vScanCard1: Array.from({length: 300}, (_, i) => {
        const y = 200 + i;
        const [r, g, b] = getPixel(400, y);
        return { y, r, g, b };
      }).filter((p, i, a) => i === 0 || i === a.length - 1 || Math.abs(p.r - a[i-1].r) > 10 || Math.abs(p.g - a[i-1].g) > 10),
      // Scan x=150..1600 at y=320 to find card left and right edges
      hScanCards: Array.from({length: 1500}, (_, i) => {
        const x = 150 + i;
        const [r, g, b] = getPixel(x, 320);
        return { x, r, g, b };
      }).filter((p, i, a) => i === 0 || i === a.length - 1 || Math.abs(p.r - a[i-1].r) > 15 || Math.abs(p.g - a[i-1].g) > 15)
    };
  });

  console.log('Card 1 vScan transitions:', JSON.stringify(cards03.vScanCard1));
  console.log('hScan transitions count:', cards03.hScanCards.length);
  // print first 15 transitions
  console.log('First transitions in hScan:', cards03.hScanCards.slice(0, 15));

  await browser.close();
}

inspect().catch(console.error);
