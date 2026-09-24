const fs = require('fs');
const puppeteer = require('puppeteer');

async function test04() {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('apps/frontend/public/kb/user-guide/raw/04_create_it_support_form.png').toString('base64');
  await page.setContent('<html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>');
  const res = await page.evaluate((data) => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const img = new Image();
    return new Promise(r => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, 1920, 1080).data;
        function getPx(x, y) {
          const idx = (y * 1920 + x) * 4;
          return [data[idx], data[idx+1], data[idx+2]];
        }
        
        // Orange button (approx rgb 251, 146, 60 or similar)
        let orangeBtn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 500; y < 650; y++) {
          for (let x = 950; x < 1650; x++) {
            const [pr, pg, pb] = getPx(x, y);
            if (pr > 220 && pg > 140 && pg < 200 && pb > 100 && pb < 160) {
              if (x < orangeBtn.minX) orangeBtn.minX = x;
              if (x > orangeBtn.maxX) orangeBtn.maxX = x;
              if (y < orangeBtn.minY) orangeBtn.minY = y;
              if (y > orangeBtn.maxY) orangeBtn.maxY = y;
            }
          }
        }

        // Dropzone / Lampirkan (around y 550 to 650, x 340 to 1000)
        let dropzone = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 550; y < 630; y++) {
          for (let x = 340; x < 1000; x++) {
            const [pr, pg, pb] = getPx(x, y);
            // border color is orange/dashed
            if (pr > 220 && pg > 140 && pb < 100) {
              if (x < dropzone.minX) dropzone.minX = x;
              if (x > dropzone.maxX) dropzone.maxX = x;
              if (y < dropzone.minY) dropzone.minY = y;
              if (y > dropzone.maxY) dropzone.maxY = y;
            }
          }
        }

        r({ orangeBtn, dropzone });
      };
      img.src = 'data:image/png;base64,' + data;
    });
  }, b64);
  console.log('04 details:', res);
  await browser.close();
}
test04();
