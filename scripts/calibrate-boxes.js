const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function calibrate() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(filePath).toString('base64');
    
    // We can load the image into canvas and detect dark cards/buttons or sample key regions
    await page.setContent(`
      <html><body style="margin:0;overflow:hidden;">
        <canvas id="c" width="1920" height="1080"></canvas>
      </body></html>
    `);

    const result = await page.evaluate((data) => {
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          
          // Sample pixel data across columns and rows to find content margins
          const imgData = ctx.getImageData(0, 0, 1920, 1080).data;
          function getPixel(x, y) {
            const idx = (y * 1920 + x) * 4;
            return [imgData[idx], imgData[idx+1], imgData[idx+2], imgData[idx+3]];
          }

          // Scan horizontally at y=200, 300, 400, 500 to find card left and right bounds
          let minX = 1920, maxX = 0;
          for (let y = 100; y < 900; y += 50) {
            for (let x = 0; x < 1920; x += 10) {
              const [r, g, b] = getPixel(x, y);
              // if not the background color (check difference from corners)
              const bg = getPixel(10, 10);
              if (Math.abs(r - bg[0]) > 20 || Math.abs(g - bg[1]) > 20 || Math.abs(b - bg[2]) > 20) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
              }
            }
          }

          resolve({ minX, maxX });
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64);

    console.log(file, result);
  }

  await browser.close();
}

calibrate().catch(console.error);
