const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const OUT_DIR = path.resolve('scripts/debug-grid');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function createGridOverlays() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0;overflow:hidden;background:#000;">
        <canvas id="c" width="1920" height="1080"></canvas>
        <script>
          window.drawWithGrid = async (src) => {
            const canvas = document.getElementById('c');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            await new Promise(r => { img.onload = r; img.src = src; });
            ctx.drawImage(img, 0, 0, 1920, 1080);

            // Draw grid lines every 50px (subtle) and 100px (stronger)
            for (let x = 0; x <= 1920; x += 50) {
              const is100 = (x % 100 === 0);
              ctx.strokeStyle = is100 ? 'rgba(0, 180, 255, 0.45)' : 'rgba(0, 180, 255, 0.20)';
              ctx.lineWidth = is100 ? 1 : 0.5;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, 1080);
              ctx.stroke();

              if (is100) {
                ctx.fillStyle = '#00f';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(String(x), x + 2, 10);
                ctx.fillText(String(x), x + 2, 540);
                ctx.fillText(String(x), x + 2, 1070);
              }
            }

            for (let y = 0; y <= 1080; y += 50) {
              const is100 = (y % 100 === 0);
              ctx.strokeStyle = is100 ? 'rgba(0, 180, 255, 0.45)' : 'rgba(0, 180, 255, 0.20)';
              ctx.lineWidth = is100 ? 1 : 0.5;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(1920, y);
              ctx.stroke();

              if (is100) {
                ctx.fillStyle = '#00f';
                ctx.font = 'bold 9px monospace';
                ctx.fillText(String(y), 4, y - 2);
                ctx.fillText(String(y), 960, y - 2);
                ctx.fillText(String(y), 1880, y - 2);
              }
            }
          };
        </script>
      </body>
    </html>
  `);

  const files = [
    '02_my_tickets.png',
    '03_create_ticket_selection.png',
    '04_create_it_support_form.png',
    '05_create_dev_ticket_form.png',
    '06_ticket_detail_chat_rating.png',
    '07_zoom_booking_calendar.png',
    '08_eform_access_list.png',
    '09_eform_access_new.png',
    '10_client_knowledge_base.png',
    '11_notification_and_profile.png'
  ];

  for (const f of files) {
    const rawPath = path.join(RAW_DIR, f);
    if (!fs.existsSync(rawPath)) continue;
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.evaluate((src) => window.drawWithGrid(src), `data:image/png;base64,${b64}`);
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, f), buf);
    console.log('Saved grid overlay for:', f);
  }

  await browser.close();
}

createGridOverlays().catch(console.error);
