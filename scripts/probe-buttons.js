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

  await page.setContent(`<!DOCTYPE html><html><body><canvas id="c" width="1920" height="1080"></canvas></body></html>`);

  async function getImageData(imgName) {
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

  // Probe 04 button:
  console.log('--- Probing 04 orange button ---');
  const d04 = await getImageData('04_create_it_support_form.png');
  // Find orange button: look for orange hue. In canvas data:
  // let's scan all pixels in x: 1200..1650, y: 500..650
  let minX = 1920, maxX = 0, minY = 1080, maxY = 0;
  for (let y = 500; y < 650; y++) {
    for (let x = 1200; x < 1650; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d04[idx], g = d04[idx+1], b = d04[idx+2];
      // orange button is #FB923C / #F97316: r ~ 240-255, g ~ 140-185, b ~ 100-145
      if (r > 235 && g >= 140 && g <= 185 && b >= 100 && b <= 145) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`04 Orange Button: x: ${minX}, y: ${minY}, width: ${maxX - minX}, height: ${maxY - minY}`);

  // Probe 05 blue button:
  console.log('--- Probing 05 blue button ---');
  const d05 = await getImageData('05_create_dev_ticket_form.png');
  minX = 1920; maxX = 0; minY = 1080; maxY = 0;
  for (let y = 650; y < 800; y++) {
    for (let x = 1200; x < 1650; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d05[idx], g = d05[idx+1], b = d05[idx+2];
      // blue button #3B82F6 or #60A5FA / cyan gradient
      if (r < 150 && g > 150 && b > 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`05 Blue Button: x: ${minX}, y: ${minY}, width: ${maxX - minX}, height: ${maxY - minY}`);

  // Probe 05 urgency radios:
  // The urgency section has radios: "Low (Minor/Cosmetic)", "Normal (Moderate)", "Urgent (Major Impact)", "Blocker (Critical)"
  // find container bounds around y: 580..700
  console.log('--- Probing 05 urgency radios ---');
  minX = 1920; maxX = 0; minY = 1080; maxY = 0;
  for (let y = 580; y < 700; y++) {
    for (let x = 300; x < 1650; x++) {
      const idx = (y * 1920 + x) * 4;
      const r = d05[idx], g = d05[idx+1], b = d05[idx+2];
      // Active radio "Normal (Moderate)" has light blue background: #EFF6FF (r: 239, g: 246, b: 255)
      // and blue border #3B82F6 (r: 59, g: 130, b: 246)
      if (r < 70 && g > 110 && g < 150 && b > 230) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`05 Active Radio (Normal Moderate): x: ${minX}, y: ${minY}, width: ${maxX - minX}, height: ${maxY - minY}`);

  await browser.close();
}

findExactCoordinates().catch(console.error);
