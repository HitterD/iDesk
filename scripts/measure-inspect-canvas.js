const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function inspectExactElements() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  async function inspect(fileName, evaluatorFn) {
    const filePath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(filePath).toString('base64');
    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');
    return await page.evaluate((data, fnString) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, 1920, 1080).data;
          const fn = new Function('ctx', 'imgData', fnString);
          resolve(fn(ctx, imgData));
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64, evaluatorFn.toString().replace(/^[^{]*{\s*/, '').replace(/\s*}[^}]*$/, ''));
  }

  // 04_create_it_support_form.png
  const res04 = await inspect('04_create_it_support_form.png', () => {
    // Find orange submit button "KIRIM SERVICE TICKET" (rgb approx 249, 115, 22 or similar orange/amber)
    let btn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    // Find textarea with orange border (at line 400-540)
    let textarea = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    // Find quick template row (around y 180-220)
    let tmpl = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };

    for (let y = 150; y < 700; y += 2) {
      for (let x = 100; x < 1800; x += 2) {
        const idx = (y * 1920 + x) * 4;
        const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2];
        
        // Orange button
        if (r > 230 && g > 130 && g < 180 && b < 130) {
          if (x < btn.minX) btn.minX = x;
          if (x > btn.maxX) btn.maxX = x;
          if (y < btn.minY) btn.minY = y;
          if (y > btn.maxY) btn.maxY = y;
        }

        // Orange border of active textarea
        if (r > 220 && g > 140 && g < 180 && b < 100 && y > 350 && y < 650 && x < 1000) {
          if (x < textarea.minX) textarea.minX = x;
          if (x > textarea.maxX) textarea.maxX = x;
          if (y < textarea.minY) textarea.minY = y;
          if (y > textarea.maxY) textarea.maxY = y;
        }

        // Quick template pills (gray buttons around y=180-220)
        if (y >= 180 && y <= 215 && r > 240 && g > 240 && b > 240 && r < 255) {
          if (x < tmpl.minX) tmpl.minX = x;
          if (x > tmpl.maxX) tmpl.maxX = x;
          if (y < tmpl.minY) tmpl.minY = y;
          if (y > tmpl.maxY) tmpl.maxY = y;
        }
      }
    }
    return { btn, textarea, tmpl };
  });

  console.log('04 detected:', res04);

  // 06_ticket_detail_chat_rating.png
  const res06 = await inspect('06_ticket_detail_chat_rating.png', () => {
    // Find rating modal or chat container
    // Let's find white card borders or blue bubbles
    let rightPanel = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
    for (let y = 100; y < 800; y += 5) {
      for (let x = 1200; x < 1850; x += 5) {
        const idx = (y * 1920 + x) * 4;
        const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2];
        // non white / border
        if (r < 245 || g < 245 || b < 245) {
          if (x < rightPanel.minX) rightPanel.minX = x;
          if (x > rightPanel.maxX) rightPanel.maxX = x;
          if (y < rightPanel.minY) rightPanel.minY = y;
          if (y > rightPanel.maxY) rightPanel.maxY = y;
        }
      }
    }
    return { rightPanel };
  });
  console.log('06 detected:', res06);

  await browser.close();
}

inspectExactElements().catch(console.error);
