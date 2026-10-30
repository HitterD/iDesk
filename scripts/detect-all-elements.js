const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function detectAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>`);

  async function getImg(imgName) {
    const rawPath = path.join(RAW_DIR, imgName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    return page.evaluate(async (src) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      await new Promise(r => { img.onload = r; img.src = src; });
      ctx.drawImage(img, 0, 0, 1920, 1080);
      return ctx.getImageData(0, 0, 1920, 1080).data;
    }, `data:image/png;base64,${b64}`);
  }

  // --- 02_my_tickets.png ---
  console.log('Detecting 02_my_tickets...');
  const d02 = await getImg('02_my_tickets.png');
  // New ticket button in 02: blue button #3B82F6 or #2563EB or purple
  let b3 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 70; y < 160; y++) {
    for (let x = 1650; x < 1900; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d02[i], g = d02[i+1], b = d02[i+2];
      // blue button #2563EB or #3B82F6
      if (r < 70 && g > 90 && g < 150 && b > 210) {
        if (x < b3.minX) b3.minX = x;
        if (x > b3.maxX) b3.maxX = x;
        if (y < b3.minY) b3.minY = y;
        if (y > b3.maxY) b3.maxY = y;
      }
    }
  }
  console.log('02 + New Ticket Button:', b3);

  // --- 04_create_it_support_form.png ---
  console.log('Detecting 04_create_it_support_form...');
  const d04 = await getImg('04_create_it_support_form.png');
  // Subject input: gray background or border
  // Detail input:
  // Dropzone:
  let drop4 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 540; y < 630; y++) {
    for (let x = 320; x < 1000; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d04[i], g = d04[i+1], b = d04[i+2];
      // dropzone border amber #F59E0B / #FBBF24 (r: 245, g: 158..190, b: 11..50)
      if (r > 230 && g > 150 && g < 210 && b < 100) {
        if (x < drop4.minX) drop4.minX = x;
        if (x > drop4.maxX) drop4.maxX = x;
        if (y < drop4.minY) drop4.minY = y;
        if (y > drop4.maxY) drop4.maxY = y;
      }
    }
  }
  console.log('04 Dropzone:', drop4);

  // Column right (Category/Device/Software + Priority)
  // Let's find radio "Normal (Moderate)" in 04
  let radio04 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 350; y < 500; y++) {
    for (let x = 1200; x < 1650; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d04[i], g = d04[i+1], b = d04[i+2];
      if (r < 70 && g > 110 && g < 150 && b > 230) {
        if (x < radio04.minX) radio04.minX = x;
        if (x > radio04.maxX) radio04.maxX = x;
        if (y < radio04.minY) radio04.minY = y;
        if (y > radio04.maxY) radio04.maxY = y;
      }
    }
  }
  console.log('04 Active Radio Normal Moderate:', radio04);

  // --- 06_ticket_detail_chat_rating.png ---
  console.log('Detecting 06_ticket_detail...');
  const d06 = await getImg('06_ticket_detail_chat_rating.png');
  // Find chat send button (blue circle with airplane icon)
  let send06 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 880; y < 960; y++) {
    for (let x = 1350; x < 1550; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d06[i], g = d06[i+1], b = d06[i+2];
      // blue button #2563EB or #3B82F6
      if (r < 60 && g > 80 && g < 140 && b > 210) {
        if (x < send06.minX) send06.minX = x;
        if (x > send06.maxX) send06.maxX = x;
        if (y < send06.minY) send06.minY = y;
        if (y > send06.maxY) send06.maxY = y;
      }
    }
  }
  console.log('06 Send Button:', send06);

  // Find Right Panel bounds in 06 (Assigned Agent card, status, SLA)
  // Right panel background is #F8FAFC or white with border around x: 1400..1880 or similar
  // Let's scan horizontally at y=250 from x=1200 to x=1900
  let panelLeft06 = 0, panelRight06 = 0;
  for (let x = 1200; x < 1900; x++) {
    const i = (250 * 1920 + x) * 4;
    const r = d06[i], g = d06[i+1], b = d06[i+2];
    // border of right panel
    if (r < 235 && g < 235 && b < 235 && panelLeft06 === 0) {
      panelLeft06 = x;
    }
  }
  console.log('06 Panel Left edge at y=250:', panelLeft06);

  // --- 07_zoom_booking_calendar.png ---
  console.log('Detecting 07_zoom_booking...');
  const d07 = await getImg('07_zoom_booking_calendar.png');
  // Find "Buat meeting" button (dark blue/purple)
  let btn07 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 750; y < 850; y++) {
    for (let x = 50; x < 600; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d07[i], g = d07[i+1], b = d07[i+2];
      // blue button #2563EB or #1D4ED8
      if (r < 60 && g > 70 && g < 130 && b > 180) {
        if (x < btn07.minX) btn07.minX = x;
        if (x > btn07.maxX) btn07.maxX = x;
        if (y < btn07.minY) btn07.minY = y;
        if (y > btn07.maxY) btn07.maxY = y;
      }
    }
  }
  console.log('07 Buat meeting button:', btn07);

  // Find Calendar container in 07:
  // Calendar has a border or white surface around x: 500..1880
  let cal07 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let x = 450; x < 1900; x++) {
    const i = (350 * 1920 + x) * 4;
    const r = d07[i], g = d07[i+1], b = d07[i+2];
    if (r > 250 && g > 250 && b > 250) {
      if (x < cal07.minX) cal07.minX = x;
      if (x > cal07.maxX) cal07.maxX = x;
    }
  }
  for (let y = 180; y < 900; y++) {
    const i = (y * 1920 + 800) * 4;
    const r = d07[i], g = d07[i+1], b = d07[i+2];
    if (r > 250 && g > 250 && b > 250) {
      if (y < cal07.minY) cal07.minY = y;
      if (y > cal07.maxY) cal07.maxY = y;
    }
  }
  console.log('07 Calendar box:', cal07);

  // --- 11_notification_and_profile.png ---
  console.log('Detecting 11_profile...');
  const d11 = await getImg('11_notification_and_profile.png');
  // Find "Save Changes" button (blue #2563EB)
  let btn11 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 700; y < 850; y++) {
    for (let x = 600; x < 1400; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d11[i], g = d11[i+1], b = d11[i+2];
      if (r < 60 && g > 70 && g < 130 && b > 180) {
        if (x < btn11.minX) btn11.minX = x;
        if (x > btn11.maxX) btn11.maxX = x;
        if (y < btn11.minY) btn11.minY = y;
        if (y > btn11.maxY) btn11.maxY = y;
      }
    }
  }
  console.log('11 Save Changes button:', btn11);

  // Tab Password and Telegram in 11:
  // Find tab active Profile (blue #2563EB), and other tabs around y: 280..330
  let tabProfile = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 270; y < 330; y++) {
    for (let x = 600; x < 800; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d11[i], g = d11[i+1], b = d11[i+2];
      if (r < 60 && g > 70 && g < 130 && b > 180) {
        if (x < tabProfile.minX) tabProfile.minX = x;
        if (x > tabProfile.maxX) tabProfile.maxX = x;
        if (y < tabProfile.minY) tabProfile.minY = y;
        if (y > tabProfile.maxY) tabProfile.maxY = y;
      }
    }
  }
  console.log('11 Tab Profile active:', tabProfile);

  await browser.close();
}

detectAll().catch(console.error);
