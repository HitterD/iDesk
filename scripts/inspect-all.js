const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function inspectImages() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      window.loadImage = (src) => {
        return new Promise((resolve, reject) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, 1920, 1080);
            ctx.drawImage(img, 0, 0, 1920, 1080);
            resolve();
          };
          img.onerror = reject;
          img.src = src;
        });
      };

      window.findBox = (filterFnStr, region) => {
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const fn = new Function('r', 'g', 'b', 'a', 'x', 'y', filterFnStr);
        
        const rx = region ? region.x : 0;
        const ry = region ? region.y : 0;
        const rw = region ? region.w : 1920;
        const rh = region ? region.h : 1080;
        
        const imgData = ctx.getImageData(rx, ry, rw, rh);
        const data = imgData.data;
        
        let minX = rw, minY = rh, maxX = 0, maxY = 0;
        let count = 0;
        
        for (let y = 0; y < rh; y++) {
          for (let x = 0; x < rw; x++) {
            const idx = (y * rw + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            const gx = rx + x;
            const gy = ry + y;
            
            if (fn(r, g, b, a, gx, gy)) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              count++;
            }
          }
        }
        
        if (count === 0) return null;
        return {
          x: rx + minX,
          y: ry + minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          count
        };
      };

      // Get color at point
      window.getPixel = (x, y) => {
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        const p = ctx.getImageData(x, y, 1, 1).data;
        return [p[0], p[1], p[2], p[3]];
      };
    </script>
  `);

  async function load(fileName) {
    const rawPath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.evaluate((src) => window.loadImage(src), `data:image/png;base64,${b64}`);
  }

  // --- 04_create_it_support_form.png ---
  console.log('=== 04_create_it_support_form.png ===');
  await load('04_create_it_support_form.png');
  // Orange button
  const itBtn = await page.evaluate(() => {
    return window.findBox('return r > 230 && g > 150 && g < 195 && b > 100 && b < 160;', { x: 1200, y: 500, w: 500, h: 200 });
  });
  console.log('04 Orange Button (Kirim Service Ticket):', itBtn);

  // Template buttons container
  const itTpl = await page.evaluate(() => {
    return window.findBox('return r > 235 && r < 255 && g < 235 && b < 235;', { x: 340, y: 170, w: 700, h: 60 });
  });
  console.log('04 Template buttons:', itTpl);

  // Error alert banner
  const itErr = await page.evaluate(() => {
    return window.findBox('return r > 240 && g > 200 && b > 200 && (r - g > 20);', { x: 330, y: 240, w: 1000, h: 60 });
  });
  console.log('04 Error alert:', itErr);

  // Main white card
  const itCard = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', { x: 300, y: 200, w: 1300, h: 500 });
  });
  console.log('04 White Card:', itCard);

  // --- 05_create_dev_ticket_form.png ---
  console.log('\n=== 05_create_dev_ticket_form.png ===');
  await load('05_create_dev_ticket_form.png');
  // Dev blue button
  const devBtn = await page.evaluate(() => {
    return window.findBox('return r > 100 && r < 140 && g > 180 && g < 220 && b > 230;', { x: 1200, y: 650, w: 400, h: 100 });
  });
  console.log('05 Dev Blue Button (Kirim Tiket Oracle):', devBtn);

  // Priority radio container
  const devPrio = await page.evaluate(() => {
    return window.findBox('return (r > 200 && g > 210 && b > 245) || (r > 245 && g > 220 && b > 200);', { x: 410, y: 600, w: 1100, h: 80 });
  });
  console.log('05 Dev Priority buttons:', devPrio);

  // --- 06_ticket_detail_chat_rating.png ---
  console.log('\n=== 06_ticket_detail_chat_rating.png ===');
  await load('06_ticket_detail_chat_rating.png');
  const chatInput = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', { x: 50, y: 880, w: 1250, h: 100 });
  });
  console.log('06 Chat input bar:', chatInput);
  const chatSend = await page.evaluate(() => {
    return window.findBox('return r > 30 && r < 60 && g > 70 && g < 110 && b > 180;', { x: 1400, y: 880, w: 100, h: 80 });
  });
  console.log('06 Chat Send button:', chatSend);

  // --- 07_zoom_booking_calendar.png ---
  console.log('\n=== 07_zoom_booking_calendar.png ===');
  await load('07_zoom_booking_calendar.png');
  // Form card on left
  const zoomFormCard = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', { x: 60, y: 180, w: 520, h: 700 });
  });
  console.log('07 Zoom Form Card (Left):', zoomFormCard);

  // Zoom Blue Submit Button
  const zoomBtn = await page.evaluate(() => {
    return window.findBox('return r > 30 && r < 60 && g > 70 && g < 110 && b > 180;', { x: 70, y: 750, w: 500, h: 100 });
  });
  console.log('07 Zoom Submit Button:', zoomBtn);

  // Zoom Calendar Card on right
  const zoomCalCard = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', { x: 580, y: 180, w: 1300, h: 700 });
  });
  console.log('07 Zoom Calendar Card (Right):', zoomCalCard);

  // --- 11_notification_and_profile.png ---
  console.log('\n=== 11_notification_and_profile.png ===');
  await load('11_notification_and_profile.png');
  const profCard = await page.evaluate(() => {
    return window.findBox('return r === 255 && g === 255 && b === 255;', { x: 600, y: 150, w: 750, h: 700 });
  });
  console.log('11 Profile Card:', profCard);

  // Theme switch at top right
  const themeSwitch = await page.evaluate(() => {
    return window.findBox('return r > 230 && g > 235 && b > 245;', { x: 1550, y: 10, w: 80, h: 50 });
  });
  console.log('11 Theme Switch:', themeSwitch);

  await browser.close();
}

inspectImages().catch(console.error);
