const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function measureExact() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  async function getImageCards(fileName) {
    const filePath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(filePath).toString('base64');

    await page.setContent('<html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>');

    return await page.evaluate((data) => {
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

          // Let's find vertical cuts for cards
          const vSegments = [];
          for (let y = 70; y < 1050; y += 5) {
            let rowDiff = 0;
            const bg = getPx(20, y);
            for (let x = 80; x < 1840; x += 10) {
              const px = getPx(x, y);
              if (Math.abs(px[0] - bg[0]) > 30 || Math.abs(px[1] - bg[1]) > 30 || Math.abs(px[2] - bg[2]) > 30) {
                rowDiff++;
              }
            }
            vSegments.push({ y, diff: rowDiff });
          }

          resolve(vSegments.filter(s => s.diff > 15));
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64);
  }

  const res03 = await getImageCards('03_create_ticket_selection.png');
  console.log('03 rows:', res03.length, 'span:', res03[0]?.y, '->', res03[res03.length - 1]?.y);

  const res04 = await getImageCards('04_create_it_support_form.png');
  console.log('04 rows:', res04.length, 'span:', res04[0]?.y, '->', res04[res04.length - 1]?.y);

  const res07 = await getImageCards('07_zoom_booking_calendar.png');
  console.log('07 rows:', res07.length, 'span:', res07[0]?.y, '->', res07[res07.length - 1]?.y);

  const res09 = await getImageCards('09_eform_access_new.png');
  console.log('09 rows:', res09.length, 'span:', res09[0]?.y, '->', res09[res09.length - 1]?.y);

  const res11 = await getImageCards('11_notification_and_profile.png');
  console.log('11 rows:', res11.length, 'span:', res11[0]?.y, '->', res11[res11.length - 1]?.y);

  await browser.close();
}

measureExact().catch(console.error);
