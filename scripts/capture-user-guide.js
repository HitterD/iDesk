/**
 * capture-user-guide.js
 * Automates screenshots of iDesk user portal using Playwright.
 * Credentials read from process.env.IDESK_USER and process.env.IDESK_PASS.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'https://idesk.santos.co.id';

const OUTPUT_DIRS = [
  path.resolve(__dirname, '../apps/frontend/public/kb/user-guide'),
  path.resolve(__dirname, '../apps/backend/uploads/kb/user-guide'),
  path.resolve(__dirname, '../docs/assets/user-guide'),
];

// Ensure output directories exist
for (const dir of OUTPUT_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveScreenshot(page, filename, options = {}) {
  const primaryPath = path.join(OUTPUT_DIRS[0], filename);
  await page.screenshot({ path: primaryPath, fullPage: false, ...options });
  console.log(`Saved screenshot: ${filename} (${primaryPath})`);

  // Copy to other output directories
  for (let i = 1; i < OUTPUT_DIRS.length; i++) {
    const destPath = path.join(OUTPUT_DIRS[i], filename);
    fs.copyFileSync(primaryPath, destPath);
  }
}

async function main() {
  const username = process.argv[2] || process.env.IDESK_USER;
  const password = process.argv[3] || process.env.IDESK_PASS;

  if (!username || !password) {
    console.error('Usage: node scripts/capture-user-guide.js <username> <password>');
    console.error('Or set IDESK_USER and IDESK_PASS environment variables.');
    process.exit(1);
  }

  console.log(`Starting Playwright with Chrome at: ${CHROME_PATH}`);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Helper to ensure Light Mode is active
  async function ensureLightMode() {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });
  }

  console.log('\n--- Step 1: Login Page ---');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(500);

  // Fill in login credentials
  const identifierInput = page.locator('input[placeholder*="NIK"], input[placeholder*="email" i], input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  await identifierInput.fill(username);
  await passwordInput.fill(password);

  // Check 'Keep session active' if available
  const rememberCheckbox = page.locator('input[type="checkbox"]').first();
  if (await rememberCheckbox.count() > 0) {
    const isChecked = await rememberCheckbox.isChecked();
    if (!isChecked) {
      await rememberCheckbox.check();
    }
  }

  await page.waitForTimeout(500);
  await saveScreenshot(page, '01_login_page.png');

  // Perform login
  console.log('\nSubmitting login...');
  const submitBtn = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Masuk")').first();
  await submitBtn.click();

  // Wait for dashboard navigation
  await page.waitForURL('**/client/**', { timeout: 15000 });
  await ensureLightMode();
  await page.waitForTimeout(1500);

  console.log('Logged in successfully. Current URL:', page.url());

  // Step 2: My Tickets Dashboard
  console.log('\n--- Step 2: My Tickets Dashboard ---');
  await page.goto(`${BASE_URL}/client/my-tickets`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '02_my_tickets.png');

  // Check for any existing ticket IDs to use for Step 4 (Chat & Detail)
  const ticketLinks = await page.$$eval('a[href*="/client/tickets/"], tr[data-ticket-id]', (els) => {
    return els.map((el) => {
      const href = el.getAttribute('href') || '';
      return href || el.getAttribute('data-ticket-id');
    });
  });
  console.log('Found ticket links/IDs:', ticketLinks);

  // Step 3: Create Ticket Selection
  console.log('\n--- Step 3: Create Ticket Category Selection ---');
  await page.goto(`${BASE_URL}/client/create`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(800);
  await saveScreenshot(page, '03_create_ticket_selection.png');

  // Step 4: Form Service Ticket (General IT Support)
  console.log('\n--- Step 4: Form Service Ticket ---');
  await page.goto(`${BASE_URL}/client/create?type=service`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(800);

  // Fill in realistic simulation data for Plant SPJ
  try {
    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="detail" i], textarea[placeholder*="deskripsi" i], textarea').first();
    if (await descInput.count() > 0) {
      await descInput.fill(
        'Printer label barcode di Line Packing 3 Plant Sidoarjo (SPJ) tidak dapat mencetak label batch produksi sejak pukul 08:30 WIB. Lampu indikator berkedip merah dan status di layar monitor PC muncul pesan "Printer Offline / Paper Jam". Kabel USB dan power sudah dicoba lepas-pasang namun tetap tidak terdeteksi oleh sistem packing. Mohon bantuan teknisi IT on-site SPJ untuk pengecekan fisik perangkat dan driver printer. Terima kasih.'
      );
    }

    const deviceInput = page.locator('input[name="device"], input[placeholder*="perangkat" i], input[placeholder*="device" i], input[placeholder*="lokasi" i]').first();
    if (await deviceInput.count() > 0) {
      await deviceInput.fill('Line Packing 3 - Plant Sidoarjo (SPJ)');
    }
  } catch (e) {
    console.log('Notice while filling service form:', e.message);
  }

  await page.waitForTimeout(600);
  await saveScreenshot(page, '04_create_it_support_form.png');

  // Step 5: Form Dev / Oracle Request
  console.log('\n--- Step 5: Form Dev / Oracle / Enterprise Request ---');
  await page.goto(`${BASE_URL}/client/create?type=oracle-request`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(800);

  try {
    const descInput = page.locator('textarea[name="description"], textarea[placeholder*="detail" i], textarea[placeholder*="deskripsi" i], textarea').first();
    if (await descInput.count() > 0) {
      await descInput.fill(
        'Gagal melakukan proses submit approval K2 untuk dokumen Purchase Order Raw Material #PO-SPJ-2026-09-0012. Saat menekan tombol Approve, muncul notifikasi error "Workflow server response timeout (Error Code: K2-504)". Dokumen tersebut mendesak untuk penerimaan biji kopi di gudang Plant SPJ hari ini. Mohon bantuan tim ERP Oracle / K2 Developer untuk memeriksa status antrean workflow. Terima kasih.'
      );
    }
  } catch (e) {
    console.log('Notice while filling dev form:', e.message);
  }

  await page.waitForTimeout(600);
  await saveScreenshot(page, '05_create_dev_ticket_form.png');

  // Step 6: Ticket Detail & Chat Room
  console.log('\n--- Step 6: Ticket Detail, Timeline & Chat ---');
  let ticketDetailUrl = null;
  // If we found an existing ticket link from My Tickets
  if (ticketLinks && ticketLinks.length > 0) {
    const validLink = ticketLinks.find((l) => l && l.includes('/client/tickets/'));
    if (validLink) {
      ticketDetailUrl = validLink.startsWith('http') ? validLink : `${BASE_URL}${validLink.startsWith('/') ? '' : '/'}${validLink}`;
    }
  }

  if (ticketDetailUrl) {
    console.log('Navigating to existing ticket:', ticketDetailUrl);
    await page.goto(ticketDetailUrl, { waitUntil: 'networkidle' });
    await ensureLightMode();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '06_ticket_detail_chat_rating.png');
  } else {
    // If no existing ticket link found directly, let's check my-tickets table rows
    await page.goto(`${BASE_URL}/client/my-tickets`, { waitUntil: 'networkidle' });
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForURL('**/client/tickets/**', { timeout: 8000 }).catch(() => {});
      await ensureLightMode();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, '06_ticket_detail_chat_rating.png');
    } else {
      console.log('No ticket rows found in My Tickets.');
    }
  }

  // Step 7: Zoom Booking Calendar (Clean)
  console.log('\n--- Step 7: Zoom Booking Calendar (Clean) ---');
  await page.goto(`${BASE_URL}/client/zoom-calendar`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '07_zoom_booking_calendar.png');

  // Step 7b: Zoom Booking Calendar (Simulated Form Filled)
  console.log('\n--- Step 7b: Zoom Booking Calendar (Simulated Form) ---');
  try {
    const topicInput = page.locator('input[name="topic"], input[placeholder*="judul" i], input[placeholder*="meeting" i], input[placeholder*="topik" i]').first();
    if (await topicInput.count() > 0) {
      await topicInput.fill('Weekly Coordination Meeting - Operasional Plant Sidoarjo (SPJ)');
    }

    // Toggle recurring if present
    const recurringSwitch = page.locator('button[role="switch"], input[type="checkbox"][id*="recurring" i]').first();
    if (await recurringSwitch.count() > 0) {
      const state = await recurringSwitch.getAttribute('aria-checked');
      if (state !== 'true') {
        await recurringSwitch.click();
      }
    }

    const participantInput = page.locator('input[placeholder*="peserta" i], input[placeholder*="email" i], input[placeholder*="tambah" i]').first();
    if (await participantInput.count() > 0) {
      await participantInput.fill('manager.spj@santos.co.id');
    }
  } catch (e) {
    console.log('Notice while simulating zoom booking:', e.message);
  }

  await page.waitForTimeout(600);
  await saveScreenshot(page, '07b_zoom_booking_simulated.png');

  // Step 8: E-Form Access List
  console.log('\n--- Step 8: E-Form Access List ---');
  await page.goto(`${BASE_URL}/client/eform-access`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '08_eform_access_list.png');

  // Step 9: E-Form Access New Form
  console.log('\n--- Step 9: E-Form Access New Form ---');
  await page.goto(`${BASE_URL}/client/eform-access/new`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(800);

  try {
    // Fill reason / justification
    const reasonInput = page.locator('textarea[name="justification"], textarea[name="reason"], textarea[placeholder*="alasan" i], textarea[placeholder*="kebutuhan" i], textarea').first();
    if (await reasonInput.count() > 0) {
      await reasonInput.fill(
        'Dibutuhkan akses VPN dan folder server bersama (Shared Folder Dept Produksi) untuk pemantauan data telemetri mesin roasting & sinkronisasi data operasional harian Plant Sidoarjo saat bekerja dari jarak jauh maupun dinas luar kota.'
      );
    }
  } catch (e) {
    console.log('Notice while filling eform access form:', e.message);
  }

  await page.waitForTimeout(600);
  await saveScreenshot(page, '09_eform_access_new.png');

  // Step 10: Knowledge Base
  console.log('\n--- Step 10: Knowledge Base ---');
  await page.goto(`${BASE_URL}/client/kb`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '10_client_knowledge_base.png');

  // Step 11: Notification & Profile
  console.log('\n--- Step 11: Notification & Profile ---');
  await page.goto(`${BASE_URL}/client/profile`, { waitUntil: 'networkidle' });
  await ensureLightMode();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '11_notification_and_profile.png');

  console.log('\nAll 12 screenshots captured and synchronized successfully!');
  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error in capture-user-guide:', err);
  process.exit(1);
});
