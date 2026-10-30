const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const CROPS_DIR = path.resolve('scripts/debug-crops');
if (!fs.existsSync(CROPS_DIR)) fs.mkdirSync(CROPS_DIR, { recursive: true });

async function cropRects() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;overflow:hidden;"><canvas id="c"></canvas></body></html>`);

  async function crop(imgName, rects) {
    const rawPath = path.join(RAW_DIR, imgName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    
    for (const [name, rect] of Object.entries(rects)) {
      await page.evaluate(async (src, r) => {
        const c = document.getElementById('c');
        c.width = r.width;
        c.height = r.height;
        const ctx = c.getContext('2d');
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = src; });
        // draw slice from img into canvas
        ctx.drawImage(img, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
      }, `data:image/png;base64,${b64}`, rect);

      const buf = await page.screenshot({ type: 'png' });
      const outPath = path.join(CROPS_DIR, `${imgName.replace('.png','')}_${name}.png`);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved crop: ${outPath}`);
    }
  }

  // Test crops for 03_create_ticket_selection.png
  console.log('--- Cropping 03 ---');
  await crop('03_create_ticket_selection.png', {
    card1_service_ticket: { x: 384, y: 246, width: 388, height: 195 },
    card2_oracle_k2: { x: 792, y: 246, width: 388, height: 195 },
    card3_web_dev: { x: 1200, y: 246, width: 388, height: 195 },
    card4_access_req: { x: 976, y: 736, width: 556, height: 195 }
  });

  // Test crops for 04_create_it_support_form.png
  console.log('--- Cropping 04 ---');
  await crop('04_create_it_support_form.png', {
    templates: { x: 310, y: 160, width: 680, height: 65 },
    subject_and_detail: { x: 348, y: 312, width: 635, height: 236 },
    dropzone: { x: 348, y: 560, width: 635, height: 56 },
    right_column: { x: 1005, y: 312, width: 580, height: 215 },
    orange_btn: { x: 1320, y: 546, width: 270, height: 50 }
  });

  // Test crops for 05_create_dev_ticket_form.png
  console.log('--- Cropping 05 ---');
  await crop('05_create_dev_ticket_form.png', {
    templates: { x: 380, y: 155, width: 350, height: 68 },
    subject_and_detail: { x: 412, y: 312, width: 1096, height: 236 },
    urgency_radios: { x: 412, y: 590, width: 1096, height: 86 },
    blue_submit_btn: { x: 1280, y: 688, width: 230, height: 48 }
  });

  await browser.close();
}

cropRects().catch(console.error);
