const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');

async function detect() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Function to inspect pixel regions and bounding boxes
  async function inspectImage(file, probes) {
    const filePath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(filePath).toString('base64');

    await page.setContent(`
      <html><body style="margin:0;"><canvas id="c" width="1920" height="1080"></canvas></body></html>
    `);

    const results = await page.evaluate((data, probeList) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d');
      const img = new Image();
      return new Promise(resolve => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const out = {};
          const imgData = ctx.getImageData(0, 0, 1920, 1080).data;
          function getPx(x, y) {
            const idx = (Math.round(y) * 1920 + Math.round(x)) * 4;
            return [imgData[idx], imgData[idx+1], imgData[idx+2], imgData[idx+3]];
          }

          for (const p of probeList) {
            // Find edges around the approximate center or probe region
            // probe: { name, approxBox: { x, y, w, h } }
            const { x, y, w, h } = p.approxBox;
            // Let's sample corners and center
            out[p.name] = {
              centerPx: getPx(x + w/2, y + h/2),
              box: { x, y, w, h }
            };
          }
          resolve(out);
        };
        img.src = 'data:image/png;base64,' + data;
      });
    }, b64, probes);

    return results;
  }

  // Let's inspect 02_my_tickets.png
  console.log('--- 02_my_tickets.png ---');
  // In 02_my_tickets:
  // Top navbar is y: 0 to 64.
  // Page title "Tiket Saya" & "+ New Ticket" is around y: 90 to 150.
  // Stat cards: Total, Open, In Progress, Resolved are around y: 160 to 280.
  // Search bar & filters are around y: 300 to 360.
  // Table is around y: 380 to 950.
  const res02 = await inspectImage('02_my_tickets.png', [
    { name: 'newTicketBtn', approxBox: { x: 1650, y: 95, w: 160, h: 42 } },
    { name: 'statCards', approxBox: { x: 80, y: 165, w: 1760, h: 120 } },
    { name: 'searchAndFilter', approxBox: { x: 80, y: 305, w: 1760, h: 48 } },
    { name: 'table', approxBox: { x: 80, y: 375, w: 1760, h: 580 } },
  ]);
  console.log('02:', JSON.stringify(res02, null, 2));

  await browser.close();
}

detect().catch(console.error);
