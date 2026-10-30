const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function findCards() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  async function getBoundingBoxes(fileName) {
    const filePath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(filePath).toString('base64');
    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');
    return await page.evaluate((data) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, 1920, 1080).data;

          function getPx(x, y) {
            const idx = (Math.round(y) * 1920 + Math.round(x)) * 4;
            return [imgData[idx], imgData[idx+1], imgData[idx+2]];
          }

          // Let's sample specific known features
          // In 07_zoom_booking_calendar.png:
          // Blue button "Buat meeting" at bottom of left panel:
          let btn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
          for (let y = 600; y < 900; y++) {
            for (let x = 30; x < 600; x++) {
              const [r, g, b] = getPx(x, y);
              // santos blue button: r: 30-50, g: 70-90, b: 160-190
              if (r >= 20 && r <= 60 && g >= 60 && g <= 100 && b >= 150 && b <= 200) {
                if (x < btn.minX) btn.minX = x;
                if (x > btn.maxX) btn.maxX = x;
                if (y < btn.minY) btn.minY = y;
                if (y > btn.maxY) btn.maxY = y;
              }
            }
          }

          // White card left
          let leftCard = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
          // White card right (calendar)
          let calCard = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
          for (let y = 200; y < 800; y += 4) {
            for (let x = 30; x < 1900; x += 4) {
              const [r, g, b] = getPx(x, y);
              if (r > 250 && g > 250 && b > 250) { // pure white card surface
                if (x < 600) {
                  if (x < leftCard.minX) leftCard.minX = x;
                  if (x > leftCard.maxX) leftCard.maxX = x;
                  if (y < leftCard.minY) leftCard.minY = y;
                  if (y > leftCard.maxY) leftCard.maxY = y;
                } else {
                  if (x < calCard.minX) calCard.minX = x;
                  if (x > calCard.maxX) calCard.maxX = x;
                  if (y < calCard.minY) calCard.minY = y;
                  if (y > calCard.maxY) calCard.maxY = y;
                }
              }
            }
          }

          resolve({ btn, leftCard, calCard });
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64);
  }

  const res = await getBoundingBoxes('07_zoom_booking_calendar.png');
  console.log('07 zoom detected:', res);

  await browser.close();
}

findCards().catch(console.error);
