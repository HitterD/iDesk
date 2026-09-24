const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function measureAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  async function evalCanvas(file, fnString) {
    const rawPath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');
    return await page.evaluate((data, code) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(r => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, 1920, 1080).data;
          function getPx(x, y) {
            const idx = (Math.round(y) * 1920 + Math.round(x)) * 4;
            return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
          }
          const fn = new Function('getPx', code);
          r(fn(getPx));
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64, fnString);
  }

  // 03_create_ticket_selection.png
  const m03 = await evalCanvas('03_create_ticket_selection.png', `
    function findCard(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          // border line
          if (r < 235 && g < 238 && bPx < 242 && r > 210 && g > 215 && bPx > 220) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      service: findCard(350, 800, 220, 480),
      oracle: findCard(750, 1200, 220, 480),
      webDev: findCard(1100, 1600, 220, 480),
      access: findCard(900, 1600, 700, 960)
    };
  `);
  console.log('03 exact:', m03);

  // 04_create_it_support_form.png
  const m04 = await evalCanvas('04_create_it_support_form.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r > 230 && g > 130 && bPx < 120)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      quickTmpl: findBox(340, 1000, 170, 225),
      detailTextarea: findBox(340, 1000, 320, 540),
      attachment: findBox(340, 1000, 540, 630),
      categoryPriority: findBox(980, 1600, 310, 535),
      submitBtn: findBox(1300, 1600, 535, 600)
    };
  `);
  console.log('04 exact:', m04);

  // 05_create_dev_ticket_form.png
  const m05 = await evalCanvas('05_create_dev_ticket_form.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r < 100 && g > 120 && bPx > 180) || (r > 220 && g > 130 && bPx < 100)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      quickTmpl: findBox(420, 900, 170, 225),
      detailTextarea: findBox(420, 1500, 320, 560),
      urgencyRadios: findBox(420, 1500, 610, 680),
      submitBtn: findBox(1250, 1520, 670, 735)
    };
  `);
  console.log('05 exact:', m05);

  // 06_ticket_detail_chat_rating.png
  const m06 = await evalCanvas('06_ticket_detail_chat_rating.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if (r < 235 && g < 238 && bPx < 242 && r > 200) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      header: findBox(60, 1300, 70, 170),
      chatThread: findBox(60, 1300, 170, 860),
      rightPanel: findBox(1260, 1860, 70, 880),
      chatInput: findBox(60, 1860, 870, 980)
    };
  `);
  console.log('06 exact:', m06);

  // 07_zoom_booking_calendar.png
  const m07 = await evalCanvas('07_zoom_booking_calendar.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r < 70 && g > 70 && bPx > 150)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      topic: findBox(50, 580, 260, 340),
      datetime: findBox(50, 580, 420, 580),
      participants: findBox(50, 580, 590, 760),
      createBtn: findBox(50, 580, 760, 830),
      calendarCard: findBox(590, 1880, 180, 880)
    };
  `);
  console.log('07 exact:', m07);

  // 08_eform_access_list.png
  const m08 = await evalCanvas('08_eform_access_list.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r < 70 && g > 70 && bPx > 150)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      stats: findBox(50, 1880, 150, 250),
      newBtn: findBox(1650, 1880, 80, 150),
      table: findBox(50, 1880, 250, 900)
    };
  `);
  console.log('08 exact:', m08);

  // 09_eform_access_new.png
  const m09 = await evalCanvas('09_eform_access_new.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r > 100 && r < 160 && g > 120 && bPx > 190) || (r < 80 && g > 80 && bPx > 180)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      accessType: findBox(370, 1190, 230, 390),
      period: findBox(370, 1190, 400, 670),
      reason: findBox(370, 1190, 700, 950),
      summaryCard: findBox(1200, 1600, 230, 790)
    };
  `);
  console.log('09 exact:', m09);

  // 10_client_knowledge_base.png
  const m10 = await evalCanvas('10_client_knowledge_base.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if (r < 235 && g < 238 && bPx < 242 && r > 200) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      searchBar: findBox(400, 1520, 260, 320),
      popularTopics: findBox(400, 1520, 320, 500),
      spotlightAndGrid: findBox(400, 1520, 500, 950)
    };
  `);
  console.log('10 exact:', m10);

  // 11_notification_and_profile.png
  const m11 = await evalCanvas('11_notification_and_profile.png', `
    function findBox(startX, endX, startY, endY) {
      let b = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const [r, g, bPx] = getPx(x, y);
          if ((r < 235 && g < 238 && bPx < 242 && r > 200) || (r < 80 && g < 80 && bPx < 100 && y < 50)) {
            if (x < b.minX) b.minX = x;
            if (x > b.maxX) b.maxX = x;
            if (y < b.minY) b.minY = y;
            if (y > b.maxY) b.maxY = y;
          }
        }
      }
      return b;
    }
    return {
      profileCard: findBox(640, 1280, 220, 810),
      passwordTab: findBox(860, 980, 280, 330),
      telegramTab: findBox(980, 1100, 280, 330),
      themeMoon: findBox(1570, 1620, 15, 55)
    };
  `);
  console.log('11 exact:', m11);

  await browser.close();
}

measureAll().catch(console.error);
