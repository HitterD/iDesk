const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const DEBUG_DIR = path.resolve('scripts/debug_crops');
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

async function inspectLayouts() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(filePath).toString('base64');
    
    await page.setContent(`
      <html><body style="margin:0;overflow:hidden;background:#111;">
        <canvas id="c" width="1920" height="1080"></canvas>
      </body></html>
    `);

    // Let's render the image with a subtle 100px grid overlay and save a 50% downscaled preview
    await page.evaluate(async (data, fname) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + data; });
      ctx.drawImage(img, 0, 0);

      // Draw grid
      ctx.lineWidth = 1;
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.15)';

      for (let x = 0; x < 1920; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1080);
        ctx.stroke();
        ctx.fillText(String(x), x + 4, 30);
      }

      for (let y = 0; y < 1080; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1920, y);
        ctx.stroke();
        ctx.fillText(String(y), 10, y + 14);
      }
    }, b64, file);

    const outPath = path.join(DEBUG_DIR, file);
    await page.screenshot({ path: outPath });
    console.log(`Saved grid preview: ${file}`);
  }

  await browser.close();
}

inspectLayouts().catch(console.error);
