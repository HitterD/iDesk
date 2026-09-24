const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function scanY() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>`);

  async function getD(name) {
    const rawPath = path.join(RAW_DIR, name);
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

  // 04_create_it_support_form.png
  console.log('--- Scanning 04 ---');
  const d04 = await getD('04_create_it_support_form.png');
  // Find orange button "KIRIM SERVICE TICKET"
  // Scan x from 1200 to 1600, y from 500 to 650
  let btn04 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 500; y < 650; y++) {
    for (let x = 1200; x < 1600; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d04[idx], g = d04[idx+1], b = d04[idx+2];
      // Orange button background #FB923C / #F97316 (r ~ 240..255, g ~ 150..190, b ~ 100..150)
      if (r > 240 && g > 150 && g < 200 && b > 100 && b < 160) {
        if (x < btn04.minX) btn04.minX = x;
        if (x > btn04.maxX) btn04.maxX = x;
        if (y < btn04.minY) btn04.minY = y;
        if (y > btn04.maxY) btn04.maxY = y;
      }
    }
  }
  console.log('04 Orange Button EXACT:', btn04, 'width:', btn04.maxX - btn04.minX, 'height:', btn04.maxY - btn04.minY);

  // Find Attachment dropzone: search for yellow/amber border around y: 550..650, x: 300..1000
  let drop4 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 550; y < 650; y++) {
    for (let x = 300; x < 1000; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d04[idx], g = d04[idx+1], b = d04[idx+2];
      // amber border #F59E0B / #FBBF24 (r: 240..255, g: 150..200, b: 20..80)
      if (r > 235 && g > 150 && g < 210 && b < 80) {
        if (x < drop4.minX) drop4.minX = x;
        if (x > drop4.maxX) drop4.maxX = x;
        if (y < drop4.minY) drop4.minY = y;
        if (y > drop4.maxY) drop4.maxY = y;
      }
    }
  }
  console.log('04 Attachment Dropzone EXACT:', drop4, 'width:', drop4.maxX - drop4.minX, 'height:', drop4.maxY - drop4.minY);

  // Find Textarea "Detail Masalah" container bounds:
  // Textarea has amber/yellow border or background
  let text4 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 380; y < 600; y++) {
    for (let x = 300; x < 1000; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d04[idx], g = d04[idx+1], b = d04[idx+2];
      if (r > 240 && g > 170 && g < 220 && b < 90) {
        if (x < text4.minX) text4.minX = x;
        if (x > text4.maxX) text4.maxX = x;
        if (y < text4.minY) text4.minY = y;
        if (y > text4.maxY) text4.maxY = y;
      }
    }
  }
  console.log('04 Textarea Detail EXACT:', text4, 'width:', text4.maxX - text4.minX, 'height:', text4.maxY - text4.minY);

  // Find Subject input box (y: 330..390)
  let subj4 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 330; y < 390; y++) {
    for (let x = 300; x < 1000; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d04[idx], g = d04[idx+1], b = d04[idx+2];
      // input background is #F8FAFC or #F1F5F9 (gray)
      if (r > 240 && r < 250 && g > 240 && g < 250 && b > 240 && b < 252) {
        if (x < subj4.minX) subj4.minX = x;
        if (x > subj4.maxX) subj4.maxX = x;
        if (y < subj4.minY) subj4.minY = y;
        if (y > subj4.maxY) subj4.maxY = y;
      }
    }
  }
  console.log('04 Subject input EXACT:', subj4, 'width:', subj4.maxX - subj4.minX, 'height:', subj4.maxY - subj4.minY);

  // 05_create_dev_ticket_form.png
  console.log('--- Scanning 05 ---');
  const d05 = await getD('05_create_dev_ticket_form.png');
  let btn05 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 700; y < 800; y++) {
    for (let x = 1200; x < 1600; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d05[idx], g = d05[idx+1], b = d05[idx+2];
      // blue button #60A5FA / #3B82F6 (r: 100..160, g: 170..215, b: 230..255)
      if (r > 100 && r < 170 && g > 170 && g < 220 && b > 225) {
        if (x < btn05.minX) btn05.minX = x;
        if (x > btn05.maxX) btn05.maxX = x;
        if (y < btn05.minY) btn05.minY = y;
        if (y > btn05.maxY) btn05.maxY = y;
      }
    }
  }
  console.log('05 Blue Button EXACT:', btn05, 'width:', btn05.maxX - btn05.minX, 'height:', btn05.maxY - btn05.minY);

  // 05 Urgency radio cards (y: 610..680, x: 400..1520)
  let urg05 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 610; y < 680; y++) {
    for (let x = 400; x < 1550; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d05[idx], g = d05[idx+1], b = d05[idx+2];
      // radio cards have border #E2E8F0 (r: 220..235)
      if (r < 235 && g < 235 && b < 235) {
        if (x < urg05.minX) urg05.minX = x;
        if (x > urg05.maxX) urg05.maxX = x;
        if (y < urg05.minY) urg05.minY = y;
        if (y > urg05.maxY) urg05.maxY = y;
      }
    }
  }
  console.log('05 Urgency radios container EXACT:', urg05, 'width:', urg05.maxX - urg05.minX, 'height:', urg05.maxY - urg05.minY);

  await browser.close();
}

scanY().catch(console.error);
