const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function analyzeAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Helper to find button / card boundaries using canvas pixel scanning
  async function findCardBounds(fileName, startY, endY) {
    const filePath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(filePath).toString('base64');

    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');

    return await page.evaluate((data, sY, eY) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, 1920, 1080).data;
          function getPx(x, y) {
            const idx = (Math.round(y) * 1920 + Math.round(x)) * 4;
            return [imgData[idx], imgData[idx+1], imgData[idx+2]];
          }

          // Scan rows from sY to eY to find key card sections
          const detectedRows = [];
          for (let y = sY; y <= eY; y += 10) {
            let rowDiffCount = 0;
            const bg = getPx(20, y);
            for (let x = 100; x < 1820; x += 15) {
              const px = getPx(x, y);
              if (Math.abs(px[0] - bg[0]) > 25 || Math.abs(px[1] - bg[1]) > 25 || Math.abs(px[2] - bg[2]) > 25) {
                rowDiffCount++;
              }
            }
            if (rowDiffCount > 10) {
              detectedRows.push(y);
            }
          }

          resolve({
            firstRow: detectedRows[0],
            lastRow: detectedRows[detectedRows.length - 1],
            count: detectedRows.length
          });
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64, startY, endY);
  }

  const files = [
    '02_my_tickets.png',
    '03_create_ticket_selection.png',
    '04_create_it_support_form.png',
    '05_create_dev_ticket_form.png',
    '06_ticket_detail_chat_rating.png',
    '07_zoom_booking_calendar.png',
    '07b_zoom_booking_simulated.png',
    '08_eform_access_list.png',
    '09_eform_access_new.png',
    '10_client_knowledge_base.png',
    '11_notification_and_profile.png'
  ];

  for (const f of files) {
    const res = await findCardBounds(f, 70, 1050);
    console.log(`${f}: vertical span ${res.firstRow} -> ${res.lastRow}`);
  }

  await browser.close();
}

analyzeAll().catch(console.error);
