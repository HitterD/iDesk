const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function measure() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  async function getExactBox(file, detectFn) {
    const rawPath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');
    return await page.evaluate((data, fnCode) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(r => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, 1920, 1080).data;
          function getPx(x, y) {
            const idx = (Math.round(y) * 1920 + Math.round(x)) * 4;
            return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
          }
          const fn = new Function('getPx', 'w', 'h', fnCode);
          r(fn(getPx, 1920, 1080));
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64, detectFn.toString().replace(/^[^{]*{\s*/, '').replace(/\s*}[^}]*$/, ''));
  }

  // 1. Measure 02_my_tickets.png
  const m02 = await getExactBox('02_my_tickets.png', () => {
    // Stat cards: look for border of first stat card (Total) and last (Resolved)
    // Background is #F8FAFC / white. Let's find border line around y: 160-280
    let statBox = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 150; y < 290; y++) {
      for (let x = 60; x < 1860; x++) {
        const [r, g, b] = getPx(x, y);
        // Card border color is subtle gray (e.g. rgb 226, 232, 240 / slate-200)
        if (r < 235 && g < 238 && b < 242 && r > 210 && g > 215 && b > 220) {
          if (x < statBox.minX) statBox.minX = x;
          if (x > statBox.maxX) statBox.maxX = x;
          if (y < statBox.minY) statBox.minY = y;
          if (y > statBox.maxY) statBox.maxY = y;
        }
      }
    }

    // New Ticket button: exact blue button at top right
    let newBtn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 80; y < 160; y++) {
      for (let x = 1650; x < 1880; x++) {
        const [r, g, b] = getPx(x, y);
        // blue button rgb(37, 99, 235) or similar
        if (r < 80 && g > 70 && g < 150 && b > 180) {
          if (x < newBtn.minX) newBtn.minX = x;
          if (x > newBtn.maxX) newBtn.maxX = x;
          if (y < newBtn.minY) newBtn.minY = y;
          if (y > newBtn.maxY) newBtn.maxY = y;
        }
      }
    }

    // Search bar input box
    let searchBox = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 280; y < 350; y++) {
      for (let x = 60; x < 1860; x++) {
        const [r, g, b] = getPx(x, y);
        if (r < 235 && g < 238 && b < 242 && r > 210 && g > 215 && b > 220) {
          if (x < searchBox.minX) searchBox.minX = x;
          if (x > searchBox.maxX) searchBox.maxX = x;
          if (y < searchBox.minY) searchBox.minY = y;
          if (y > searchBox.maxY) searchBox.maxY = y;
        }
      }
    }

    // Table container
    let tableBox = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 350; y < 980; y++) {
      for (let x = 60; x < 1860; x++) {
        const [r, g, b] = getPx(x, y);
        if (r < 235 && g < 238 && b < 242 && r > 210 && g > 215 && b > 220) {
          if (x < tableBox.minX) tableBox.minX = x;
          if (x > tableBox.maxX) tableBox.maxX = x;
          if (y < tableBox.minY) tableBox.minY = y;
          if (y > tableBox.maxY) tableBox.maxY = y;
        }
      }
    }

    return { statBox, newBtn, searchBox, tableBox };
  });

  console.log('02_my_tickets exact:', m02);

  await browser.close();
}

measure().catch(console.error);
