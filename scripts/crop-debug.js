const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');

async function crop() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  const rawPath = path.resolve('apps/frontend/public/kb/user-guide/raw/06_ticket_detail_chat_rating.png');
  const b64 = fs.readFileSync(rawPath).toString('base64');
  await page.setContent(`<img src="data:image/png;base64,${b64}" style="margin:0;padding:0;display:block;">`);
  await page.screenshot({ path: path.resolve('scratch/crop_06_airplane.png'), clip: { x: 1200, y: 860, width: 80, height: 80 } });
  await browser.close();
  console.log('Cropped 06 airplane!');
}

crop().catch(console.error);
