const fs = require('fs');
const puppeteer = require('puppeteer');

async function check() {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('apps/frontend/public/kb/user-guide/raw/11_notification_and_profile.png').toString('base64');
  await page.setContent('<html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>');
  const res = await page.evaluate((data) => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const img = new Image();
    return new Promise(r => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, 1920, 100).data;
        let moon = { minX: 1920, maxX: 0, minY: 100, maxY: 0 };
        for (let y = 10; y < 60; y++) {
          for (let x = 1500; x < 1900; x++) {
            const idx = (y * 1920 + x) * 4;
            if (imgData[idx] < 100 && imgData[idx+1] < 100 && imgData[idx+2] < 120) {
              if (x < moon.minX) moon.minX = x;
              if (x > moon.maxX) moon.maxX = x;
              if (y < moon.minY) moon.minY = y;
              if (y > moon.maxY) moon.maxY = y;
            }
          }
        }
        r({ moon });
      };
      img.src = 'data:image/png;base64,' + data;
    });
  }, b64);
  console.log('11 moon probe:', res);
  await browser.close();
}
check();
