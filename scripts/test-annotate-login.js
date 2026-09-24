const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const OUT_DIR = path.resolve('apps/frontend/public/kb/user-guide');

async function testAnnotateLogin() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const rawImagePath = path.join(RAW_DIR, '01_login_page.png');
  const base64Image = fs.readFileSync(rawImagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${base64Image}`;

  const annotations = [
    {
      num: 1,
      box: { x: 773, y: 532, width: 374, height: 50, radius: 10 },
      badgePos: { x: 748, y: 557 },
      label: '1: Masukkan NIK / Email Karyawan',
      labelPos: 'left',
    },
    {
      num: 2,
      box: { x: 773, y: 622, width: 374, height: 50, radius: 10 },
      badgePos: { x: 748, y: 647 },
      label: '2: Masukkan Kata Sandi Default (123456)',
      labelPos: 'left',
    },
    {
      num: 3,
      box: { x: 773, y: 724, width: 374, height: 48, radius: 10 },
      badgePos: { x: 748, y: 748 },
      label: '3: Klik Continue / Tekan Enter',
      labelPos: 'left',
    },
  ];

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body, html { margin: 0; padding: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="c" width="1920" height="1080"></canvas>
      <script>
        window.renderAnnotations = async (imgSrc, items) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgSrc;
          });

          // Draw base screenshot
          ctx.drawImage(img, 0, 0, 1920, 1080);

          // Draw each annotation
          for (const item of items) {
            ctx.save();

            // 1. Draw Bounding Box
            if (item.box) {
              const { x, y, width, height, radius = 10 } = item.box;
              ctx.shadowColor = 'rgba(239, 68, 68, 0.45)';
              ctx.shadowBlur = 10;
              ctx.strokeStyle = '#EF4444';
              ctx.lineWidth = 2.5;
              ctx.setLineDash([7, 5]);
              ctx.beginPath();
              ctx.roundRect(x, y, width, height, radius);
              ctx.stroke();

              ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
              ctx.fill();
              ctx.setLineDash([]);
            }

            // 2. Draw Callout Badge (Red Circle with White Number)
            const badgeX = item.badgePos.x;
            const badgeY = item.badgePos.y;
            const badgeRadius = 18;

            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3;

            const grad = ctx.createLinearGradient(badgeX - badgeRadius, badgeY - badgeRadius, badgeX + badgeRadius, badgeY + badgeRadius);
            grad.addColorStop(0, '#F43F5E');
            grad.addColorStop(1, '#E11D48');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3.5;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px "Segoe UI", Inter, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(item.num), badgeX, badgeY + 0.5);

            // 3. Draw Floating Pill Label
            if (item.label) {
              ctx.font = '600 13.5px "Segoe UI", Inter, Arial, sans-serif';
              const textMetrics = ctx.measureText(item.label);
              const pillWidth = textMetrics.width + 24;
              const pillHeight = 30;
              const pillRadius = 8;

              let pillX, pillY;
              if (item.labelPos === 'right') {
                pillX = badgeX + badgeRadius + 10;
                pillY = badgeY - pillHeight / 2;
              } else if (item.labelPos === 'bottom') {
                pillX = badgeX - pillWidth / 2;
                pillY = badgeY + badgeRadius + 10;
              } else if (item.labelPos === 'left') {
                pillX = badgeX - badgeRadius - pillWidth - 10;
                pillY = badgeY - pillHeight / 2;
              } else {
                pillX = badgeX - pillWidth / 2;
                pillY = badgeY - badgeRadius - pillHeight - 10;
              }

              ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetY = 2;

              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
              ctx.fill();

              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#F8FAFC';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.label, pillX + 12, pillY + pillHeight / 2);
            }

            ctx.restore();
          }
        };
      </script>
    </body>
    </html>
  `);

  await page.evaluate((src, items) => window.renderAnnotations(src, items), dataUrl, annotations);

  const outputPath = path.join(OUT_DIR, '01_login_page.png');
  await page.screenshot({ path: outputPath, type: 'png' });
  console.log('Annotated login page saved successfully to:', outputPath);

  await browser.close();
}

testAnnotateLogin().catch(console.error);
