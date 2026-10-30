const fs = require('fs');
const puppeteer = require('puppeteer');

async function test05() {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('apps/frontend/public/kb/user-guide/raw/05_create_dev_ticket_form.png').toString('base64');
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
        
        // Blue button KIRIM TIKET ORACLE
        let blueBtn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 675; y < 740; y++) {
          for (let x = 1200; x < 1600; x++) {
            const [pr, pg, pb] = getPx(x, y);
            // light blue / sky blue button rgb(125, 178, 240)
            if (pr < 160 && pg > 160 && pb > 210) {
              if (x < blueBtn.minX) blueBtn.minX = x;
              if (x > blueBtn.maxX) blueBtn.maxX = x;
              if (y < blueBtn.minY) blueBtn.minY = y;
              if (y > blueBtn.maxY) blueBtn.maxY = y;
            }
          }
        }

        // Textarea with orange border
        let textarea = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 350; y < 600; y++) {
          for (let x = 350; x < 1600; x++) {
            const [pr, pg, pb] = getPx(x, y);
            if (pr > 220 && pg > 140 && pb < 100) {
              if (x < textarea.minX) textarea.minX = x;
              if (x > textarea.maxX) textarea.maxX = x;
              if (y < textarea.minY) textarea.minY = y;
              if (y > textarea.maxY) textarea.maxY = y;
            }
          }
        }

        r({ blueBtn, textarea });
      };
      img.src = 'data:image/png;base64,' + data;
    });
  }, b64);
  console.log('05 details:', res);
  await browser.close();
}
test05();
