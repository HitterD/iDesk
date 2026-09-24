const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function getExactBoxes() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent('<canvas id="c" width="1920" height="1080"></canvas>');

  async function evalInPage(name, scriptFn) {
    const rawPath = path.join(RAW_DIR, name);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate((src, fnStr) => {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById('c');
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, 1920, 1080);
          ctx.drawImage(img, 0, 0);
          const f = new Function('ctx', fnStr);
          res(f(ctx));
        };
        img.src = 'data:image/png;base64,' + src;
      });
    }, b64, scriptFn.toString().replace(/^[^{]*{\s*/, '').replace(/\s*}[^}]*$/, ''));
  }

  // 1. 01_login_page.png
  console.log('--- 01_login_page.png ---');
  const b01 = await evalInPage('01_login_page.png', () => {
    // Exact borders of NIK input, Password input, Continue button
    // NIK input:
    // border color is around #E2E8F0 or #CBD5E1
    // let's scan from y=500 to 570, x=770 to 1150
    function findInput(yStart, yEnd) {
      let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
      for (let y = yStart; y <= yEnd; y++) {
        for (let x = 760; x <= 1160; x++) {
          const p = ctx.getImageData(x, y, 1, 1).data;
          // input background is #F8FAFC or white #FFFFFF, border is #E2E8F0 (226, 232, 240)
          if (p[0] >= 220 && p[0] <= 245 && p[1] >= 225 && p[1] <= 245 && p[2] >= 235 && p[2] <= 250) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }
    // Continue button has blue #2B54BB (43, 84, 187)
    let bMinX = 1920, bMaxX = 0, bMinY = 1080, bMaxY = 0;
    for (let y = 700; y <= 790; y++) {
      for (let x = 760; x <= 1160; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] < 70 && p[1] > 60 && p[1] < 120 && p[2] > 160) {
          bMinX = Math.min(bMinX, x); bMaxX = Math.max(bMaxX, x);
          bMinY = Math.min(bMinY, y); bMaxY = Math.max(bMaxY, y);
        }
      }
    }
    return {
      nik: findInput(510, 570),
      pass: findInput(600, 660),
      btn: { x: bMinX, y: bMinY, width: bMaxX - bMinX + 1, height: bMaxY - bMinY + 1 }
    };
  });
  console.log('01:', b01);

  // 2. 02_my_tickets.png
  console.log('\n--- 02_my_tickets.png ---');
  const b02 = await evalInPage('02_my_tickets.png', () => {
    // New Ticket button: blue #2563EB
    let bMinX = 1920, bMaxX = 0, bMinY = 1080, bMaxY = 0;
    for (let y = 80; y <= 150; y++) {
      for (let x = 1680; x <= 1870; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] < 50 && p[1] > 80 && p[1] < 120 && p[2] > 200) {
          bMinX = Math.min(bMinX, x); bMaxX = Math.max(bMaxX, x);
          bMinY = Math.min(bMinY, y); bMaxY = Math.max(bMaxY, y);
        }
      }
    }
    return {
      newBtn: { x: bMinX, y: bMinY, width: bMaxX - bMinX + 1, height: bMaxY - bMinY + 1 }
    };
  });
  console.log('02:', b02);

  // 3. 03_create_ticket_selection.png
  console.log('\n--- 03_create_ticket_selection.png ---');
  const b03 = await evalInPage('03_create_ticket_selection.png', () => {
    // Card 1: Service ticket card
    // Cards have white background with gray border #E2E8F0
    function findCardExact(startX, startY, endX, endY) {
      let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const p = ctx.getImageData(x, y, 1, 1).data;
          // Card border is ~220-235
          if (p[0] >= 220 && p[0] <= 235 && p[1] >= 225 && p[1] <= 238 && p[2] >= 230 && p[2] <= 245) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }
    return {
      c1: findCardExact(370, 240, 810, 460),
      c2: findCardExact(800, 240, 1240, 460),
      c3: findCardExact(1230, 240, 1560, 460),
      accessCard: findCardExact(950, 770, 1560, 950)
    };
  });
  console.log('03:', b03);

  // 4. 04_create_it_support_form.png
  console.log('\n--- 04_create_it_support_form.png ---');
  const b04 = await evalInPage('04_create_it_support_form.png', () => {
    // Submit button exact:
    let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
    for (let y = 570; y <= 650; y++) {
      for (let x = 1250; x <= 1650; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] > 230 && p[1] > 140 && p[2] < 160) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      submitBtn: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  });
  console.log('04:', b04);

  // 5. 05_create_dev_ticket_form.png
  console.log('\n--- 05_create_dev_ticket_form.png ---');
  const b05 = await evalInPage('05_create_dev_ticket_form.png', () => {
    // Blue submit button "KIRIM TIKET ORACLE":
    let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
    for (let y = 700; y <= 800; y++) {
      for (let x = 1250; x <= 1650; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] < 160 && p[1] > 170 && p[2] > 220) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      submitBtn: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  });
  console.log('05:', b05);

  // 6. 06_ticket_detail_chat_rating.png
  console.log('\n--- 06_ticket_detail_chat_rating.png ---');
  const b06 = await evalInPage('06_ticket_detail_chat_rating.png', () => {
    // Chat input bar exact border:
    let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
    for (let y = 880; y <= 980; y++) {
      for (let x = 30; x <= 1300; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        // The chat textarea box has white fill and border #E2E8F0
        if (p[0] === 255 && p[1] === 255 && p[2] === 255 && y > 895 && y < 980) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      chatInput: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  });
  console.log('06:', b06);

  // 7. 07_zoom_booking_calendar.png
  console.log('\n--- 07_zoom_booking_calendar.png ---');
  const b07 = await evalInPage('07_zoom_booking_calendar.png', () => {
    // Submit button:
    let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
    for (let y = 820; y <= 900; y++) {
      for (let x = 60; x <= 550; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] < 60 && p[1] > 60 && p[1] < 120 && p[2] > 160) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      submitBtn: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  });
  console.log('07:', b07);

  // 8. 09_eform_access_new.png
  console.log('\n--- 09_eform_access_new.png ---');
  const b09 = await evalInPage('09_eform_access_new.png', () => {
    let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
    for (let y = 680; y <= 770; y++) {
      for (let x = 1200; x <= 1580; x++) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        if (p[0] > 120 && p[0] < 170 && p[1] > 140 && p[1] < 190 && p[2] > 200) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      submitBtn: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  });
  console.log('09:', b09);

  await browser.close();
}

getExactBoxes().catch(console.error);
