const fs = require('fs');
const puppeteer = require('puppeteer');

async function test09() {
  const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const page = await browser.newPage();
  const b64 = fs.readFileSync('apps/frontend/public/kb/user-guide/raw/09_eform_access_new.png').toString('base64');
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
        
        // Find "Kirim Pengajuan" button (blue/purple at right)
        let submitBtn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 600; y < 750; y++) {
          for (let x = 600; x < 1800; x++) {
            const [pr, pg, pb] = getPx(x, y);
            // bluish / purple button
            if (pr > 100 && pr < 160 && pg > 120 && pg < 180 && pb > 190) {
              if (x < submitBtn.minX) submitBtn.minX = x;
              if (x > submitBtn.maxX) submitBtn.maxX = x;
              if (y < submitBtn.minY) submitBtn.minY = y;
              if (y > submitBtn.maxY) submitBtn.maxY = y;
            }
          }
        }

        // Find "Akses VPN" button at top left
        let vpnBtn = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
        for (let y = 250; y < 350; y++) {
          for (let x = 150; x < 600; x++) {
            const [pr, pg, pb] = getPx(x, y);
            // blue selected border
            if (pr > 30 && pr < 80 && pg > 80 && pg < 150 && pb > 180) {
              if (x < vpnBtn.minX) vpnBtn.minX = x;
              if (x > vpnBtn.maxX) vpnBtn.maxX = x;
              if (y < vpnBtn.minY) vpnBtn.minY = y;
              if (y > vpnBtn.maxY) vpnBtn.maxY = y;
            }
          }
        }

        r({ submitBtn, vpnBtn });
      };
      img.src = 'data:image/png;base64,' + data;
    });
  }, b64);
  console.log('09 details:', res);
  await browser.close();
}
test09();
