const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function detectRemaining() {
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

  // --- 08_eform_access_list.png ---
  console.log('--- Detecting 08 ---');
  const d08 = await getImg('08_eform_access_list.png');
  // 1. "Ajukan Akses" button (blue)
  let btn08 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 80; y < 160; y++) {
    for (let x = 1600; x < 1900; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d08[i], g = d08[i+1], b = d08[i+2];
      if (r < 70 && g > 70 && g < 140 && b > 190) {
        if (x < btn08.minX) btn08.minX = x;
        if (x > btn08.maxX) btn08.maxX = x;
        if (y < btn08.minY) btn08.minY = y;
        if (y > btn08.maxY) btn08.maxY = y;
      }
    }
  }
  console.log('08 Ajukan Akses button:', btn08);

  // 2. Metrics card row (y: 160..260)
  // Let's find top and bottom of metric card 1 (Total 1)
  let met08 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 140; y < 270; y++) {
    for (let x = 40; x < 1880; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d08[i], g = d08[i+1], b = d08[i+2];
      // card surface is white #fff
      if (r > 250 && g > 250 && b > 250) {
        if (x < met08.minX) met08.minX = x;
        if (x > met08.maxX) met08.maxX = x;
        if (y < met08.minY) met08.minY = y;
        if (y > met08.maxY) met08.maxY = y;
      }
    }
  }
  console.log('08 Metric cards row:', met08);

  // 3. Table card (y: 260..900)
  let tbl08 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 260; y < 900; y++) {
    for (let x = 40; x < 1880; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d08[i], g = d08[i+1], b = d08[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < tbl08.minX) tbl08.minX = x;
        if (x > tbl08.maxX) tbl08.maxX = x;
        if (y < tbl08.minY) tbl08.minY = y;
        if (y > tbl08.maxY) tbl08.maxY = y;
      }
    }
  }
  console.log('08 Table card:', tbl08);

  // --- 09_eform_access_new.png ---
  console.log('--- Detecting 09 ---');
  const d09 = await getImg('09_eform_access_new.png');
  // Right card: Summary card (Ringkasan Pengajuan)
  // Has blue button "Kirim Pengajuan" at the bottom
  let btn09 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 650; y < 750; y++) {
    for (let x = 1200; x < 1650; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d09[i], g = d09[i+1], b = d09[i+2];
      // disabled blue/gray button or blue button
      if (r > 130 && r < 180 && g > 150 && g < 200 && b > 210) {
        if (x < btn09.minX) btn09.minX = x;
        if (x > btn09.maxX) btn09.maxX = x;
        if (y < btn09.minY) btn09.minY = y;
        if (y > btn09.maxY) btn09.maxY = y;
      }
    }
  }
  console.log('09 Kirim Pengajuan button:', btn09);

  // Left column cards:
  // Card 1: Jenis Akses (y: 250..370)
  // Card 2: Identitas & Masa Berlaku (y: 390..660)
  // Card 3: Kebutuhan Akses (y: 680..960)
  // Right Card: Ringkasan (x: ~1200..1580, y: 250..770)
  // Let's find right card bounds
  let right09 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 240; y < 800; y++) {
    for (let x = 1180; x < 1620; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d09[i], g = d09[i+1], b = d09[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < right09.minX) right09.minX = x;
        if (x > right09.maxX) right09.maxX = x;
        if (y < right09.minY) right09.minY = y;
        if (y > right09.maxY) right09.maxY = y;
      }
    }
  }
  console.log('09 Right summary card:', right09);

  // Left card 1:
  let c1_09 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 240; y < 380; y++) {
    for (let x = 300; x < 1180; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d09[i], g = d09[i+1], b = d09[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < c1_09.minX) c1_09.minX = x;
        if (x > c1_09.maxX) c1_09.maxX = x;
        if (y < c1_09.minY) c1_09.minY = y;
        if (y > c1_09.maxY) c1_09.maxY = y;
      }
    }
  }
  console.log('09 Left Card 1 (Jenis Akses):', c1_09);

  // Left card 2:
  let c2_09 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 390; y < 670; y++) {
    for (let x = 300; x < 1180; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d09[i], g = d09[i+1], b = d09[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < c2_09.minX) c2_09.minX = x;
        if (x > c2_09.maxX) c2_09.maxX = x;
        if (y < c2_09.minY) c2_09.minY = y;
        if (y > c2_09.maxY) c2_09.maxY = y;
      }
    }
  }
  console.log('09 Left Card 2 (Identitas & Periode):', c2_09);

  // Left card 3:
  let c3_09 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 680; y < 980; y++) {
    for (let x = 300; x < 1180; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d09[i], g = d09[i+1], b = d09[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < c3_09.minX) c3_09.minX = x;
        if (x > c3_09.maxX) c3_09.maxX = x;
        if (y < c3_09.minY) c3_09.minY = y;
        if (y > c3_09.maxY) c3_09.maxY = y;
      }
    }
  }
  console.log('09 Left Card 3 (Kebutuhan Akses):', c3_09);

  // --- 10_client_knowledge_base.png ---
  console.log('--- Detecting 10 ---');
  const d10 = await getImg('10_client_knowledge_base.png');
  // Search box: y: 280..340
  // Spotlight banner: has blue button "Baca Sekarang"
  let btn10 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 420; y < 520; y++) {
    for (let x = 1350; x < 1600; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d10[i], g = d10[i+1], b = d10[i+2];
      // blue button #2563EB
      if (r < 70 && g > 80 && g < 140 && b > 190) {
        if (x < btn10.minX) btn10.minX = x;
        if (x > btn10.maxX) btn10.maxX = x;
        if (y < btn10.minY) btn10.minY = y;
        if (y > btn10.maxY) btn10.maxY = y;
      }
    }
  }
  console.log('10 Baca Sekarang button:', btn10);

  // Spotlight card container:
  let spot10 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 390; y < 550; y++) {
    for (let x = 300; x < 1600; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d10[i], g = d10[i+1], b = d10[i+2];
      // card has white or light gradient
      if (r > 248 && g > 248 && b > 248) {
        if (x < spot10.minX) spot10.minX = x;
        if (x > spot10.maxX) spot10.maxX = x;
        if (y < spot10.minY) spot10.minY = y;
        if (y > spot10.maxY) spot10.maxY = y;
      }
    }
  }
  console.log('10 Spotlight card container:', spot10);

  // Search input in 10:
  let search10 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 270; y < 330; y++) {
    for (let x = 350; x < 1550; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d10[i], g = d10[i+1], b = d10[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < search10.minX) search10.minX = x;
        if (x > search10.maxX) search10.maxX = x;
        if (y < search10.minY) search10.minY = y;
        if (y > search10.maxY) search10.maxY = y;
      }
    }
  }
  console.log('10 Search box:', search10);

  // Popular topics card in 10:
  let pop10 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 570; y < 860; y++) {
    for (let x = 350; x < 1550; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d10[i], g = d10[i+1], b = d10[i+2];
      if (r > 250 && g > 250 && b > 250) {
        if (x < pop10.minX) pop10.minX = x;
        if (x > pop10.maxX) pop10.maxX = x;
        if (y < pop10.minY) pop10.minY = y;
        if (y > pop10.maxY) pop10.maxY = y;
      }
    }
  }
  console.log('10 Popular topics container:', pop10);

  // --- 11 Theme toggle in navbar ---
  console.log('--- Detecting 11 theme toggle ---');
  const d11 = await getImg('11_notification_and_profile.png');
  let theme11 = { minX: 1920, maxX: 0, minY: 1080, maxY: 0 };
  for (let y = 10; y < 60; y++) {
    for (let x = 800; x < 860; x++) {
      const i = (y * 1920 + x) * 4;
      const r = d11[i], g = d11[i+1], b = d11[i+2];
      // circular button in navbar has border #E2E8F0
      if (r < 235 && g < 235 && b < 235) {
        if (x < theme11.minX) theme11.minX = x;
        if (x > theme11.maxX) theme11.maxX = x;
        if (y < theme11.minY) theme11.minY = y;
        if (y > theme11.maxY) theme11.maxY = y;
      }
    }
  }
  console.log('11 Theme toggle button:', theme11);

  await browser.close();
}

detectRemaining().catch(console.error);
