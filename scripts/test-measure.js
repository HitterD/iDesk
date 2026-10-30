const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('https://idesk.santos.co.id/login', { waitUntil: 'networkidle2', timeout: 15000 });

    const boxes = await page.evaluate(() => {
      const email = document.querySelector('input#identifier, input[name="identifier"], input[placeholder*="NIK"], input[type="text"]');
      const pass = document.querySelector('input#password, input[name="password"], input[type="password"]');
      const btn = document.querySelector('button[type="submit"]');
      const getBox = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      };
      return { email: getBox(email), pass: getBox(pass), btn: getBox(btn) };
    });
    console.log('Login DOM boxes:', JSON.stringify(boxes, null, 2));
    await browser.close();
  } catch (err) {
    console.error('Error measuring login:', err.message);
  }
})();
