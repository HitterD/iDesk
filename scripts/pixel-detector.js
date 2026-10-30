const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const DEBUG_DIR = path.resolve('scripts/debug-crops');

if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

async function analyzeAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>`);

  async function getCorners(imgName, checkFunc) {
    const rawPath = path.join(RAW_DIR, imgName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate(async (src, funcStr) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = src; });
      ctx.drawImage(img, 0, 0, 1920, 1080);
      const imgData = ctx.getImageData(0, 0, 1920, 1080);
      const evalFunc = new Function('imgData', 'ctx', funcStr);
      return evalFunc(imgData, ctx);
    }, `data:image/png;base64,${b64}`, checkFunc.toString().slice(checkFunc.toString().indexOf('{') + 1, -1));
  }

  // Probe 03
  const res03 = await getCorners('03_create_ticket_selection.png', function(imgData, ctx) {
    // Find all card borders:
    // A card has a white background (approx 255,255,255) surrounded by border #E2E8F0 (approx 226,232,240)
    // and page background is #F8FAFC (248, 250, 252) or similar
    const d = imgData.data;
    function getP(x, y) {
      const i = (y * 1920 + x) * 4;
      return [d[i], d[i+1], d[i+2]];
    }

    // Let's find borders around y=360
    const spans = [];
    let inCard = false;
    let startX = 0;
    for (let x = 100; x < 1800; x++) {
      const [r, g, b] = getP(x, 360);
      // is white or near white?
      const isWhite = (r > 250 && g > 250 && b > 250);
      if (isWhite && !inCard) {
        inCard = true;
        startX = x;
      } else if (!isWhite && inCard) {
        inCard = false;
        spans.push({ startX, endX: x, width: x - startX });
      }
    }

    // Also find vertical span of card 1 at x = (startX + endX)/2 of first span
    let vSpan = null;
    if (spans.length > 0) {
      const midX = Math.round((spans[0].startX + spans[0].endX) / 2);
      let topY = 0, botY = 0;
      for (let y = 200; y < 600; y++) {
        const [r, g, b] = getP(midX, y);
        const isWhite = (r > 250 && g > 250 && b > 250);
        if (isWhite && topY === 0) topY = y;
        if (!isWhite && topY !== 0 && botY === 0) {
          botY = y;
          break;
        }
      }
      vSpan = { topY, botY, height: botY - topY };
    }

    // Check bottom row cards at y=800
    const bottomSpans = [];
    inCard = false;
    startX = 0;
    for (let x = 100; x < 1800; x++) {
      const [r, g, b] = getP(x, 800);
      const isWhite = (r > 250 && g > 250 && b > 250);
      if (isWhite && !inCard) {
        inCard = true;
        startX = x;
      } else if (!isWhite && inCard) {
        inCard = false;
        bottomSpans.push({ startX, endX: x, width: x - startX });
      }
    }

    let botVSpan = null;
    if (bottomSpans.length > 0) {
      const midX = Math.round((bottomSpans[0].startX + bottomSpans[0].endX) / 2);
      let topY = 0, botY = 0;
      for (let y = 650; y < 1000; y++) {
        const [r, g, b] = getP(midX, y);
        const isWhite = (r > 250 && g > 250 && b > 250);
        if (isWhite && topY === 0) topY = y;
        if (!isWhite && topY !== 0 && botY === 0) {
          botY = y;
          break;
        }
      }
      botVSpan = { topY, botY, height: botY - topY };
    }

    return { topCards: spans, topVSpan: vSpan, bottomCards: bottomSpans, botVSpan };
  });

  console.log('03_create_ticket_selection.png detected cards:', JSON.stringify(res03, null, 2));

  // Probe 04_create_it_support_form.png
  const res04 = await getCorners('04_create_it_support_form.png', function(imgData, ctx) {
    const d = imgData.data;
    function getP(x, y) {
      const i = (y * 1920 + x) * 4;
      return [d[i], d[i+1], d[i+2]];
    }

    // 1. Find the orange button "KIRIM SERVICE TICKET"
    // Orange button color is roughly orange (#F97316 or #EA580C or similar: r > 200, g around 100-160, b < 100)
    let btnBox = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 500; y < 750; y++) {
      for (let x = 1000; x < 1700; x++) {
        const [r, g, b] = getP(x, y);
        if (r > 220 && g > 100 && g < 180 && b < 100) {
          if (x < btnBox.minX) btnBox.minX = x;
          if (x > btnBox.maxX) btnBox.maxX = x;
          if (y < btnBox.minY) btnBox.minY = y;
          if (y > btnBox.maxY) btnBox.maxY = y;
        }
      }
    }

    // 2. Find the form main white container
    // Scan at y=400 across x
    let formMinX = 0, formMaxX = 0;
    for (let x = 100; x < 1800; x++) {
      const [r, g, b] = getP(x, 400);
      if (r > 250 && g > 250 && b > 250 && formMinX === 0) formMinX = x;
      if (r < 245 && formMinX !== 0 && formMaxX === 0) formMaxX = x;
    }

    // 3. Find Category/Device/Software column left edge
    // Scan at y=360 (inside "Pilih Kategori" select box)
    // The select box has border and light bg
    // 4. Find Subject field and Detail textarea
    // Detail textarea contains blue counter (431 / 5000 karakter)
    // Find attachment dropzone box
    return {
      orangeBtn: { ...btnBox, width: btnBox.maxX - btnBox.minX, height: btnBox.maxY - btnBox.minY },
      formContainer: { formMinX, formMaxX, width: formMaxX - formMinX }
    };
  });
  console.log('04_create_it_support_form.png analysis:', JSON.stringify(res04, null, 2));

  await browser.close();
}

analyzeAll().catch(console.error);
