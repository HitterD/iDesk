const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function findExactCoordinates() {
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
            resolve({ w: img.width, h: img.height });
          };
          img.src = src;
        });
      };

      window.findCard = (x1, y1, x2, y2, bgR, bgG, bgB, tol = 5) => {
        const imgData = ctx.getImageData(x1, y1, x2 - x1, y2 - y1).data;
        const w = x2 - x1;
        const h = y2 - y1;
        let minX = w, minY = h, maxX = 0, maxY = 0, found = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx+1];
            const b = imgData[idx+2];
            if (Math.abs(r - bgR) <= tol && Math.abs(g - bgG) <= tol && Math.abs(b - bgB) <= tol) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              found++;
            }
          }
        }
        if (!found) return null;
        return { x: x1 + minX, y: y1 + minY, width: maxX - minX + 1, height: maxY - minY + 1, found };
      };

      // Find edge transition (e.g. from background to card border)
      window.findBorder = (dir, start, fixed, len, targetR, targetG, targetB, tol = 10) => {
        for (let i = 0; i < len; i++) {
          const curr = start + i;
          let p;
          if (dir === 'H') {
            p = ctx.getImageData(curr, fixed, 1, 1).data;
          } else {
            p = ctx.getImageData(fixed, curr, 1, 1).data;
          }
          if (Math.abs(p[0] - targetR) <= tol && Math.abs(p[1] - targetG) <= tol && Math.abs(p[2] - targetB) <= tol) {
            return curr;
          }
        }
        return null;
      };
    </script>
  `);

  async function load(name) {
    const rawPath = path.join(RAW_DIR, name);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate((src) => window.loadImage(src), `data:image/png;base64,${b64}`);
  }

  // Helper to dump detected bounding boxes
  const results = {};

  // 01
  await load('01_login_page.png');
  results['01'] = {
    nik: await page.evaluate(() => window.findCard(750, 480, 1170, 560, 255, 255, 255)),
    pass: await page.evaluate(() => window.findCard(750, 580, 1170, 660, 255, 255, 255)),
    btn: await page.evaluate(() => window.findCard(750, 680, 1170, 770, 43, 84, 187, 30))
  };

  // 02
  await load('02_my_tickets.png');
  results['02'] = {
    stats: await page.evaluate(() => window.findCard(40, 140, 1880, 280, 255, 255, 255)),
    filter: await page.evaluate(() => window.findCard(40, 280, 1880, 360, 255, 255, 255)),
    newBtn: await page.evaluate(() => window.findCard(1680, 80, 1870, 150, 37, 99, 235, 40)),
    table: await page.evaluate(() => window.findCard(40, 360, 1880, 960, 255, 255, 255))
  };

  // 03
  await load('03_create_ticket_selection.png');
  results['03'] = {
    // 4 cards in top row: Service, Oracle, Web Dev
    c1: await page.evaluate(() => window.findCard(370, 230, 800, 460, 255, 255, 255)),
    c2: await page.evaluate(() => window.findCard(800, 230, 1220, 460, 255, 255, 255)),
    c3: await page.evaluate(() => window.findCard(1220, 230, 1550, 460, 255, 255, 255)),
    // Access request card in bottom section:
    accessCard: await page.evaluate(() => window.findCard(950, 740, 1550, 930, 255, 255, 255))
  };

  // 04
  await load('04_create_it_support_form.png');
  results['04'] = {
    mainCard: await page.evaluate(() => window.findCard(300, 220, 1620, 660, 255, 255, 255)),
    quickTpl: await page.evaluate(() => window.findCard(340, 160, 1000, 230, 255, 255, 255)),
    sendBtn: await page.evaluate(() => window.findCard(1300, 530, 1600, 610, 245, 158, 11, 60))
  };

  // 05
  await load('05_create_dev_ticket_form.png');
  results['05'] = {
    mainCard: await page.evaluate(() => window.findCard(300, 220, 1620, 770, 255, 255, 255)),
    sendBtn: await page.evaluate(() => window.findCard(1260, 670, 1520, 740, 56, 189, 248, 60))
  };

  // 06
  await load('06_ticket_detail_chat_rating.png');
  results['06'] = {
    header: await page.evaluate(() => window.findCard(40, 70, 1280, 165, 255, 255, 255)),
    chatThread: await page.evaluate(() => window.findCard(40, 165, 1280, 875, 255, 255, 255)),
    chatBar: await page.evaluate(() => window.findCard(40, 880, 1280, 980, 255, 255, 255)),
    rightPanel: await page.evaluate(() => window.findCard(1270, 70, 1880, 890, 255, 255, 255))
  };

  // 07
  await load('07_zoom_booking_calendar.png');
  results['07'] = {
    formCard: await page.evaluate(() => window.findCard(70, 180, 600, 850, 255, 255, 255)),
    submitBtn: await page.evaluate(() => window.findCard(80, 760, 590, 840, 37, 99, 235, 50)),
    calendarCard: await page.evaluate(() => window.findCard(590, 180, 1870, 890, 255, 255, 255))
  };

  // 07b
  await load('07b_zoom_booking_simulated.png');
  results['07b'] = {
    formCard: await page.evaluate(() => window.findCard(70, 180, 600, 850, 255, 255, 255)),
    calendarCard: await page.evaluate(() => window.findCard(590, 180, 1870, 890, 255, 255, 255))
  };

  // 08
  await load('08_eform_access_list.png');
  results['08'] = {
    stats: await page.evaluate(() => window.findCard(40, 140, 1880, 260, 255, 255, 255)),
    newBtn: await page.evaluate(() => window.findCard(1680, 90, 1880, 160, 37, 99, 235, 50)),
    table: await page.evaluate(() => window.findCard(40, 250, 1880, 900, 255, 255, 255))
  };

  // 09
  await load('09_eform_access_new.png');
  results['09'] = {
    leftCards: await page.evaluate(() => window.findCard(350, 200, 1200, 960, 255, 255, 255)),
    rightCard: await page.evaluate(() => window.findCard(1190, 230, 1580, 790, 255, 255, 255)),
    submitBtn: await page.evaluate(() => window.findCard(1200, 660, 1570, 750, 120, 140, 200, 50))
  };

  // 10
  await load('10_client_knowledge_base.png');
  results['10'] = {
    search: await page.evaluate(() => window.findCard(380, 260, 1540, 330, 255, 255, 255)),
    cards: await page.evaluate(() => window.findCard(380, 330, 1540, 510, 255, 255, 255)),
    articles: await page.evaluate(() => window.findCard(380, 500, 1540, 960, 255, 255, 255))
  };

  // 11
  await load('11_notification_and_profile.png');
  results['11'] = {
    mainCard: await page.evaluate(() => window.findCard(600, 160, 1320, 830, 255, 255, 255)),
    saveBtn: await page.evaluate(() => window.findCard(650, 730, 1270, 810, 37, 99, 235, 50))
  };

  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

findExactCoordinates().catch(console.error);
