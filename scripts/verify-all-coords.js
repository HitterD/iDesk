const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const TEST_DIR = path.resolve('scripts/test_outputs');
if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });

// Complete definitions for all 12 images
const CONFIGS = {
  '01_login_page.png': [
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
  ],

  '02_my_tickets.png': [
    {
      num: 1,
      box: { x: 78, y: 165, width: 1764, height: 112, radius: 14 },
      badgePos: { x: 102, y: 155 },
      label: '1: Ringkasan Kartu Metrik (Total, Open, In Progress, Resolved)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 78, y: 298, width: 1764, height: 52, radius: 12 },
      badgePos: { x: 102, y: 288 },
      label: '2: Kotak Pencarian & Filter Status Tiket',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 1638, y: 92, width: 204, height: 46, radius: 10 },
      badgePos: { x: 1618, y: 115 },
      label: '3: Klik + New Ticket untuk Buat Permintaan',
      labelPos: 'left',
    },
    {
      num: 4,
      box: { x: 78, y: 372, width: 1764, height: 590, radius: 14 },
      badgePos: { x: 102, y: 362 },
      label: '4: Tabel Daftar Tiket (Klik Baris untuk Membuka Detail)',
      labelPos: 'right',
    },
  ],

  '03_create_ticket_selection.png': [
    {
      num: 1,
      box: { x: 395, y: 260, width: 545, height: 295, radius: 16 },
      badgePos: { x: 420, y: 245 },
      label: '1: 01 - Service Ticket (Komputer, Printer, Software Umum)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 975, y: 260, width: 545, height: 295, radius: 16 },
      badgePos: { x: 1000, y: 245 },
      label: '2: 03 - Access Request (E-Form Akses Jaringan / VPN)',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 395, y: 580, width: 545, height: 295, radius: 16 },
      badgePos: { x: 420, y: 565 },
      label: '3: 04 - Oracle / K2 Request (ERP Enterprise & Role Approval)',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 975, y: 580, width: 545, height: 295, radius: 16 },
      badgePos: { x: 1000, y: 565 },
      label: '4: 05/06 - Web & Mobile Developer (Bug & Fitur Aplikasi)',
      labelPos: 'right',
    },
  ],

  '04_create_it_support_form.png': [
    {
      num: 1,
      box: { x: 335, y: 195, width: 1245, height: 65, radius: 12 },
      badgePos: { x: 360, y: 185 },
      label: '1: Template Cepat (Email, Printer, Lambat, Jaringan, Login)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 335, y: 282, width: 1245, height: 165, radius: 12 },
      badgePos: { x: 360, y: 272 },
      label: '2: Uraikan Detail Kendala, Lokasi, & Pesan Error (Wajib)',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 335, y: 468, width: 1245, height: 112, radius: 12 },
      badgePos: { x: 360, y: 458 },
      label: '3: Lampirkan Berkas atau Tempelkan Screenshot (Ctrl + V)',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 335, y: 600, width: 1245, height: 148, radius: 12 },
      badgePos: { x: 360, y: 590 },
      label: '4: Tentukan Kategori, Perangkat, & Tingkat Prioritas',
      labelPos: 'right',
    },
    {
      num: 5,
      box: { x: 335, y: 768, width: 1245, height: 54, radius: 12 },
      badgePos: { x: 360, y: 758 },
      label: '5: Klik KIRIM SERVICE TIKET untuk Mengajukan Bantuan',
      labelPos: 'right',
    },
  ],

  '05_create_dev_ticket_form.png': [
    {
      num: 1,
      box: { x: 435, y: 205, width: 1050, height: 62, radius: 12 },
      badgePos: { x: 460, y: 195 },
      label: '1: Template Cepat (Login Issue, Role Update, Error, Sync)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 435, y: 288, width: 1050, height: 215, radius: 12 },
      badgePos: { x: 460, y: 278 },
      label: '2: Uraikan Modul Sistem, Nomor Dokumen, & Kode Error',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 435, y: 524, width: 1050, height: 88, radius: 12 },
      badgePos: { x: 460, y: 514 },
      label: '3: Pilih Tingkat Urgensi (Low, Normal, Urgent, Blocker)',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 435, y: 632, width: 1050, height: 54, radius: 12 },
      badgePos: { x: 460, y: 622 },
      label: '4: Klik Kirim Tiket atau Tekan Ctrl + Enter',
      labelPos: 'right',
    },
  ],

  '06_ticket_detail_chat_rating.png': [
    {
      num: 1,
      box: { x: 88, y: 92, width: 1184, height: 76, radius: 12 },
      badgePos: { x: 112, y: 82 },
      label: '1: Header Tiket & SLA Countdown Timer Penyelesaian',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 88, y: 188, width: 1184, height: 618, radius: 14 },
      badgePos: { x: 112, y: 178 },
      label: '2: Ruang Chat Interaktif dengan Teknisi (Bisa Paste Gambar)',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 1296, y: 92, width: 524, height: 714, radius: 14 },
      badgePos: { x: 1320, y: 82 },
      label: '3: Teknisi Bertugas & Tombol + Tambah Rekan Kolaborator',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 380, y: 230, width: 600, height: 350, radius: 16 },
      badgePos: { x: 405, y: 218 },
      label: '4: Rating Kepuasan Pengguna (Bintang 1-5 Saat Tiket Resolved)',
      labelPos: 'right',
    },
  ],

  '07_zoom_booking_calendar.png': [
    {
      num: 1,
      box: { x: 95, y: 178, width: 540, height: 78, radius: 12 },
      badgePos: { x: 115, y: 168 },
      label: '1: Masukkan Topik / Judul Meeting',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 95, y: 275, width: 540, height: 78, radius: 12 },
      badgePos: { x: 115, y: 265 },
      label: '2: Tentukan Tanggal & Jam Mulai Meeting',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 95, y: 372, width: 540, height: 78, radius: 12 },
      badgePos: { x: 115, y: 362 },
      label: '3: Pilih Durasi Meeting (30 s/d 120 Menit)',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 95, y: 468, width: 540, height: 60, radius: 12 },
      badgePos: { x: 115, y: 458 },
      label: '4: Toggle Berulang (Aktifkan jika Rapat Rutin)',
      labelPos: 'right',
    },
    {
      num: 5,
      box: { x: 95, y: 550, width: 540, height: 50, radius: 12 },
      badgePos: { x: 115, y: 540 },
      label: '5: Klik Buat Meeting 🎥 untuk Alokasi Lisensi Zoom Otomatis',
      labelPos: 'right',
    },
  ],

  '07b_zoom_booking_simulated.png': [
    {
      num: 1,
      box: { x: 95, y: 155, width: 545, height: 520, radius: 14 },
      badgePos: { x: 118, y: 145 },
      label: '1: Formulir Rapat Berulang Terisi Lengkap & Interval Terjadwal',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 95, y: 690, width: 545, height: 180, radius: 14 },
      badgePos: { x: 118, y: 680 },
      label: '2: Tambah Daftar Email Peserta & Deskripsi Agenda Rapat',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 665, y: 155, width: 1025, height: 715, radius: 14 },
      badgePos: { x: 688, y: 145 },
      label: '3: Monitoring Jadwal Meeting Real-time (Mendatang, Semua, Selesai)',
      labelPos: 'right',
    },
  ],

  '08_eform_access_list.png': [
    {
      num: 1,
      box: { x: 75, y: 145, width: 1770, height: 115, radius: 14 },
      badgePos: { x: 98, y: 135 },
      label: '1: Kartu Ringkasan Status Pengajuan (Menunggu, Diproses, Siap, Ditolak)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 1630, y: 82, width: 215, height: 46, radius: 10 },
      badgePos: { x: 1610, y: 105 },
      label: '2: Klik + Ajukan Akses untuk Membuat Permohonan Baru',
      labelPos: 'left',
    },
    {
      num: 3,
      box: { x: 75, y: 280, width: 1770, height: 680, radius: 14 },
      badgePos: { x: 98, y: 270 },
      label: '3: Tabel Riwayat Pengajuan Akses & Tracking Status Approval',
      labelPos: 'right',
    },
  ],

  '09_eform_access_new.png': [
    {
      num: 1,
      box: { x: 380, y: 310, width: 1160, height: 155, radius: 14 },
      badgePos: { x: 405, y: 298 },
      label: '1: Pilih Jenis Akses (Akses VPN, Akses Website, Akses Jaringan)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 380, y: 550, width: 1160, height: 95, radius: 14 },
      badgePos: { x: 405, y: 538 },
      label: '2: Tentukan Masa Berlaku Akses (+1 Bln s/d +12 Bln)',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 380, y: 665, width: 1160, height: 175, radius: 14 },
      badgePos: { x: 405, y: 652 },
      label: '3: Pilih Skenario Kebutuhan & Uraikan Alasan Operasional',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 380, y: 860, width: 1160, height: 55, radius: 12 },
      badgePos: { x: 405, y: 848 },
      label: '4: Klik Kirim Permohonan Akses untuk Approval Berjenjang HOD',
      labelPos: 'right',
    },
  ],

  '10_client_knowledge_base.png': [
    {
      num: 1,
      box: { x: 420, y: 215, width: 1080, height: 65, radius: 14 },
      badgePos: { x: 445, y: 202 },
      label: '1: Kotak Pencarian Pintar Solusi (Ketik: wifi, vpn, printer, outlook)',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 420, y: 300, width: 1080, height: 105, radius: 14 },
      badgePos: { x: 445, y: 288 },
      label: '2: Filter Kategori & Tagar Populer Solusi Mandiri',
      labelPos: 'right',
    },
    {
      num: 3,
      box: { x: 420, y: 425, width: 1080, height: 580, radius: 14 },
      badgePos: { x: 445, y: 412 },
      label: '3: Daftar Kartu Artikel Panduan & SOP Troubleshooting Mandiri',
      labelPos: 'right',
    },
  ],

  '11_notification_and_profile.png': [
    {
      num: 1,
      box: { x: 660, y: 350, width: 600, height: 260, radius: 14 },
      badgePos: { x: 685, y: 338 },
      label: '1: Tab Profile: Periksa Identitas & Update WhatsApp Aktif',
      labelPos: 'right',
    },
    {
      num: 2,
      box: { x: 805, y: 275, width: 145, height: 45, radius: 10 },
      badgePos: { x: 790, y: 298 },
      label: '2: Tab Password: Ubah Kata Sandi Akun',
      labelPos: 'left',
    },
    {
      num: 3,
      box: { x: 960, y: 275, width: 190, height: 45, radius: 10 },
      badgePos: { x: 980, y: 260 },
      label: '3: Tab Telegram & Notifikasi: Sambungkan Bot Alert',
      labelPos: 'right',
    },
    {
      num: 4,
      box: { x: 1720, y: 14, width: 44, height: 40, radius: 10 },
      badgePos: { x: 1700, y: 34 },
      label: '4: Sakelar Tema: Beralih Mode Terang (Light) / Gelap (Dark)',
      labelPos: 'left',
    },
  ],
};

async function renderAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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

            // 1. Draw Bounding Box with dashed outline and subtle red tint
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

              ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
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

              // Keep pill inside 1920x1080 canvas
              if (pillX < 10) pillX = 10;
              if (pillX + pillWidth > 1910) pillX = 1910 - pillWidth;
              if (pillY < 10) pillY = 10;
              if (pillY + pillHeight > 1070) pillY = 1070 - pillHeight;

              ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
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

  for (const [file, items] of Object.entries(CONFIGS)) {
    const rawPath = path.join(RAW_DIR, file);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    await page.evaluate((src, annotations) => window.renderAnnotations(src, annotations), dataUrl, items);

    const outPath = path.join(TEST_DIR, file);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Rendered: ${file}`);
  }

  await browser.close();
  console.log('All 12 images rendered to scripts/test_outputs/');
}

renderAll().catch(console.error);
