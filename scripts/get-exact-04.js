const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function getPreciseRects() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>`);

  async function analyze(imgName, queryFunc) {
    const rawPath = path.join(RAW_DIR, imgName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate(async (src, qStr) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = src; });
      ctx.drawImage(img, 0, 0, 1920, 1080);
      const imgData = ctx.getImageData(0, 0, 1920, 1080);
      const fn = new Function('imgData', 'ctx', qStr);
      return fn(imgData, ctx);
    }, `data:image/png;base64,${b64}`, queryFunc.toString().slice(queryFunc.toString().indexOf('{') + 1, -1));
  }

  // Exact bounds for 04_create_it_support_form.png
  const exact04 = await analyze('04_create_it_support_form.png', function(imgData, ctx) {
    const d = imgData.data;
    function getP(x, y) {
      const i = (y * 1920 + x) * 4;
      return [d[i], d[i+1], d[i+2]];
    }

    // 1. Orange button: "KIRIM SERVICE TICKET"
    // find all pixels where r > 240, g between 130 and 190, b between 70 and 130
    let btn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 500; y < 650; y++) {
      for (let x = 1200; x < 1700; x++) {
        const [r, g, b] = getP(x, y);
        // Orange button background #F97316 or orange tone
        if (r > 230 && g >= 140 && g <= 200 && b >= 70 && b <= 150) {
          if (x < btn.minX) btn.minX = x;
          if (x > btn.maxX) btn.maxX = x;
          if (y < btn.minY) btn.minY = y;
          if (y > btn.maxY) btn.maxY = y;
        }
      }
    }

    // 2. White main card: find border #E2E8F0 or transition from gray background
    // Gray background is around r: 248, g: 250, b: 252. Card border has r < 235
    let card = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let x = 200; x < 1800; x++) {
      const [r, g, b] = getP(x, 450);
      if (r > 252 && g > 252 && b > 252) { // pure white card surface
        if (x < card.minX) card.minX = x;
        if (x > card.maxX) card.maxX = x;
      }
    }
    for (let y = 200; y < 800; y++) {
      const [r, g, b] = getP(500, y);
      if (r > 252 && g > 252 && b > 252) {
        if (y < card.minY) card.minY = y;
        if (y > card.maxY) card.maxY = y;
      }
    }

    // 3. Subject input: find its border or background
    // Subject input is at x around 350-1000, y around 340-400
    // 4. Detail textarea: y around 420-560
    // 5. Attachment dropzone: y around 570-620
    // Let's find attachment dropzone
    let dropzone = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 550; y < 630; y++) {
      for (let x = 340; x < 1020; x++) {
        const [r, g, b] = getP(x, y);
        // dropzone has light amber/yellow border or background
        if (r > 240 && g > 220 && b < 210) {
          if (x < dropzone.minX) dropzone.minX = x;
          if (x > dropzone.maxX) dropzone.maxX = x;
          if (y < dropzone.minY) dropzone.minY = y;
          if (y > dropzone.maxY) dropzone.maxY = y;
        }
      }
    }

    // 6. Template pills row
    // y around 170-220
    let templates = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 170; y < 220; y++) {
      for (let x = 300; x < 1100; x++) {
        const [r, g, b] = getP(x, y);
        // pills have border #E2E8F0
        if (r < 235 && g < 235 && b < 235) {
          if (x < templates.minX) templates.minX = x;
          if (x > templates.maxX) templates.maxX = x;
          if (y < templates.minY) templates.minY = y;
          if (y > templates.maxY) templates.maxY = y;
        }
      }
    }

    return { btn, card, dropzone, templates };
  });

  console.log('Exact 04 elements:', exact04);

  await browser.close();
}

getPreciseRects().catch(console.error);
