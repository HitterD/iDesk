const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function measureExact() {
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

      // Scan horizontal line
      window.scanH = (y, x1, x2) => {
        const data = ctx.getImageData(x1, y, x2 - x1, 1).data;
        const res = [];
        for (let i = 0; i < data.length; i += 4) {
          res.push([data[i], data[i+1], data[i+2]]);
        }
        return res;
      };

      // Scan vertical line
      window.scanV = (x, y1, y2) => {
        const data = ctx.getImageData(x, y1, 1, y2 - y1).data;
        const res = [];
        for (let i = 0; i < data.length; i += 4) {
          res.push([data[i], data[i+1], data[i+2]]);
        }
        return res;
      };

      // Find bounding box of color condition
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
              if (j > maxY) maxY = j;
              found++;
            }
          }
        }
        if (!found) return null;
        return { x: x + minX, y: y + minY, width: maxX - minX + 1, height: maxY - minY + 1, found };
      };
    </script>
  `);

  async function load(fileName) {
    const rawPath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.evaluate((src) => window.loadImage(src), `data:image/png;base64,${b64}`);
  }

  // Measure 01_login_page.png
  console.log('--- 01_login_page.png ---');
  await load('01_login_page.png');
  // Find white card:
  const card01 = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', 700, 200, 550, 600);
  });
  console.log('Login Card:', card01);
  // Find blue button (Continue):
  const btn01 = await page.evaluate(() => {
    return window.findBox('return r > 40 && r < 60 && g > 70 && g < 110 && b > 160;', 750, 700, 420, 80);
  });
  console.log('Continue button:', btn01);
  // Find input borders
  const inputNik = await page.evaluate(() => {
    return window.findBox('return r > 220 && r < 240 && g > 220 && g < 240 && b > 220 && b < 240;', 750, 520, 420, 60);
  });
  console.log('NIK input border:', inputNik);

  // Measure 04_create_it_support_form.png
  console.log('\n--- 04_create_it_support_form.png ---');
  await load('04_create_it_support_form.png');
  // Orange button
  const itBtn = await page.evaluate(() => {
    return window.findBox('return r > 240 && g > 150 && g < 195 && b > 100 && b < 140;', 1200, 500, 400, 150);
  });
  console.log('IT Kirim button:', itBtn);
  // Textarea border (Detail Masalah)
  const itTextarea = await page.evaluate(() => {
    return window.findBox('return r > 210 && r < 235 && g > 210 && g < 235 && b > 210 && b < 235;', 340, 410, 680, 150);
  });
  console.log('IT Textarea border:', itTextarea);
  // Attachment dropzone border
  const itDropzone = await page.evaluate(() => {
    return window.findBox('return r > 210 && r < 240 && g > 210 && g < 240 && b > 210 && b < 240;', 340, 560, 680, 60);
  });
  console.log('IT Dropzone border:', itDropzone);
  // Right side panel (Priority / Category card)
  const itPrio = await page.evaluate(() => {
    // Look for the priority options container
    return window.findBox('return r > 210 && r < 235 && g > 220 && g < 245 && b > 240;', 1000, 380, 300, 100);
  });
  console.log('IT Priority container:', itPrio);

  // Measure 05_create_dev_ticket_form.png
  console.log('\n--- 05_create_dev_ticket_form.png ---');
  await load('05_create_dev_ticket_form.png');
  const devBtn = await page.evaluate(() => {
    return window.findBox('return r > 100 && r < 140 && g > 180 && g < 220 && b > 230;', 1200, 650, 400, 100);
  });
  console.log('Dev Submit Button:', devBtn);
  const devTextarea = await page.evaluate(() => {
    return window.findBox('return r > 210 && r < 235 && g > 210 && g < 235 && b > 210 && b < 235;', 400, 410, 1150, 150);
  });
  console.log('Dev Textarea border:', devTextarea);

  // Measure 06_ticket_detail_chat_rating.png
  console.log('\n--- 06_ticket_detail_chat_rating.png ---');
  await load('06_ticket_detail_chat_rating.png');
  const chatBar = await page.evaluate(() => {
    // The chat input box border or container at bottom
    return window.findBox('return r > 220 && r < 245 && g > 220 && g < 245 && b > 220 && b < 245;', 30, 890, 1260, 95);
  });
  console.log('Chat input bar container:', chatBar);
  const chatSendBtn = await page.evaluate(() => {
    return window.findBox('return r > 40 && r < 60 && g > 70 && g < 110 && b > 160;', 1400, 890, 100, 60);
  });
  console.log('Chat send button:', chatSendBtn);

  // Measure 07_zoom_booking_calendar.png
  console.log('\n--- 07_zoom_booking_calendar.png ---');
  await load('07_zoom_booking_calendar.png');
  const zoomBtn = await page.evaluate(() => {
    return window.findBox('return r > 30 && r < 60 && g > 70 && g < 110 && b > 180;', 70, 750, 500, 80);
  });
  console.log('Zoom Submit Button:', zoomBtn);

  // Measure 08_eform_access_list.png
  console.log('\n--- 08_eform_access_list.png ---');
  await load('08_eform_access_list.png');
  const eformNewBtn = await page.evaluate(() => {
    return window.findBox('return r > 30 && r < 60 && g > 70 && g < 110 && b > 180;', 1680, 90, 200, 60);
  });
  console.log('+ Ajukan Akses Button:', eformNewBtn);

  // Measure 09_eform_access_new.png
  console.log('\n--- 09_eform_access_new.png ---');
  await load('09_eform_access_new.png');
  const eformSubmit = await page.evaluate(() => {
    return window.findBox('return r > 130 && r < 170 && g > 150 && g < 185 && b > 205 && b < 235;', 1200, 660, 360, 80);
  });
  console.log('E-Form Kirim Pengajuan button:', eformSubmit);

  // Measure 11_notification_and_profile.png
  console.log('\n--- 11_notification_and_profile.png ---');
  await load('11_notification_and_profile.png');
  const saveBtn = await page.evaluate(() => {
    return window.findBox('return r > 30 && r < 60 && g > 70 && g < 110 && b > 180;', 320, 720, 400, 80);
  });
  console.log('Profile Save Changes Button:', saveBtn);
  const passTab = await page.evaluate(() => {
    return window.findBox('return r > 235 && g > 235 && b > 245;', 440, 270, 150, 50);
  });
  console.log('Profile Tab area:', passTab);

  await browser.close();
}

measureExact().catch(console.error);
