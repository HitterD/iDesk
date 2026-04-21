const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const htmlPath = 'file:///' + path.join('C:\\iDesk\\docs\\iDesk_Blueprint.html').replace(/\\/g, '/');

    console.log('Loading HTML:', htmlPath);
    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('Generating PDF...');
    await page.pdf({
        path: 'C:\\iDesk\\docs\\iDesk_Blueprint.pdf',
        format: 'A4',
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:9px;color:#94a3b8;width:100%;text-align:center;padding:5px 0;">iDesk — Enterprise IT Helpdesk System Blueprint</div>',
        footerTemplate: '<div style="font-size:9px;color:#94a3b8;width:100%;text-align:center;padding:5px 0;">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>',
    });

    await browser.close();
    console.log('PDF generated successfully: C:\\iDesk\\docs\\iDesk_Blueprint.pdf');
})();
