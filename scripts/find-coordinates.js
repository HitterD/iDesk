const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function inspectImages() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.png'));
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(filePath).toString('base64');
    await page.setContent(`
      <html>
      <body style="margin:0;padding:0;">
        <canvas id="c" width="1920" height="1080"></canvas>
      </body>
      </html>
    `);
    const res = await page.evaluate(async (data) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + data; });
      ctx.drawImage(img, 0, 0);

      return {
        w: img.naturalWidth,
        h: img.naturalHeight,
      };
    }, b64);
    console.log(file, res);
  }

  await browser.close();
}

inspectImages().catch(console.error);
