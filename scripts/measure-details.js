const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function measureDetails() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      window.loadImage = (src) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, 1920, 1080);
            ctx.drawImage(img, 0, 0, 1920, 1080);
            resolve();
          };
          img.src = src;
        });
      };

      window.findBox = (fnStr, x, y, w, h) => {
        const fn = new Function('r', 'g', 'b', 'a', 'x', 'y', fnStr);
        const data = ctx.getImageData(x, y, w, h).data;
        let minX = w, minY = h, maxX = 0, maxY = 0, found = 0;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const idx = (j * w + i) * 4;
            if (fn(data[idx], data[idx+1], data[idx+2], data[idx+3], x + i, y + j)) {
              if (i < minX) minX = i;
              if (i > maxX) maxX = i;
              if (j < minY) minY = j;
              if (j > maxY) maxY = y;
              found++;
            }
          }
        }
        if (!found) return null;
        return { x: x + minX, y: y + minY, width: maxX - minX + 1, height: maxY - minY + 1, found };
      };
    </script>
  `);

  async function load(name) {
    const rawPath = path.join(RAW_DIR, name);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.evaluate((src) => window.loadImage(src), `data:image/png;base64,${b64}`);
  }

  // 04 details
  await load('04_create_it_support_form.png');
  const it04 = {
    // Orange button: "KIRIM SERVICE TICKET"
    submitBtn: await page.evaluate(() => window.findBox('return (r > 230 && g > 150 && b < 150);', 1300, 520, 280, 80)),
    // Detail textarea
    textarea: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 340, 410, 680, 145)),
    // Dropzone
    dropzone: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 340, 560, 680, 55)),
    // Category dropdown
    category: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 1010, 335, 300, 55)),
    // Priority options
    priority: await page.evaluate(() => window.findBox('return (r > 50 && r < 100 && g > 100 && b > 200) || (r > 200 && g > 220 && b > 250);', 1010, 380, 300, 50))
  };
  console.log('04 Details:', JSON.stringify(it04, null, 2));

  // 05 details
  await load('05_create_dev_ticket_form.png');
  const dev05 = {
    // Blue button: "KIRIM TIKET ORACLE"
    submitBtn: await page.evaluate(() => window.findBox('return (r > 100 && r < 150 && g > 180 && g < 220 && b > 230);', 1250, 670, 300, 70)),
    // Urgency radio buttons
    urgency: await page.evaluate(() => window.findBox('return (r > 200 && g > 210 && b > 245);', 400, 615, 1100, 60)),
    // Detail textarea
    textarea: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 400, 415, 1100, 145)),
    // Quick templates
    quickTpl: await page.evaluate(() => window.findBox('return (r > 230 && g > 230 && b > 230);', 410, 170, 320, 55))
  };
  console.log('05 Details:', JSON.stringify(dev05, null, 2));

  // 07 details
  await load('07_zoom_booking_calendar.png');
  const zoom07 = {
    titleInput: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 80, 290, 500, 55)),
    dateTimeInput: await page.evaluate(() => window.findBox('return (r < 240 && g < 240 && b < 240 && r > 210 && g > 210 && b > 210);', 80, 460, 500, 55)),
    submitBtn: await page.evaluate(() => window.findBox('return (r > 30 && r < 60 && g > 70 && g < 110 && b > 180);', 80, 760, 500, 60))
  };
  console.log('07 Details:', JSON.stringify(zoom07, null, 2));

  // 11 details
  await load('11_notification_and_profile.png');
  const prof11 = {
    tabArea: await page.evaluate(() => window.findBox('return (r > 230 && g > 230 && b > 240);', 630, 275, 450, 45)),
    saveBtn: await page.evaluate(() => window.findBox('return (r > 30 && r < 60 && g > 70 && g < 110 && b > 180);', 640, 730, 640, 65)),
    themeIcon: await page.evaluate(() => window.findBox('return (r > 100 && r < 140 && g > 110 && g < 150 && b > 130 && b < 170);', 1570, 15, 50, 40))
  };
  console.log('11 Details:', JSON.stringify(prof11, null, 2));

  await browser.close();
}

measureDetails().catch(console.error);
