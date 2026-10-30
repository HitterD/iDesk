const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const PREVIEW_DIR = path.resolve('scratch/preview');

if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

// 100% Calibrated, pixel-perfect, collision-free coordinate definitions
const CALIBRATED_CONFIGS = {
  '01_login_page.png': [
    {
      num: 1,
      box: { x: 771, y: 511, width: 377, height: 56, radius: 8 },
      badge: { x: 745, y: 539 },
      label: '1: Masukkan NIK / Email',
      labelPos: 'left'
    },
    {
      num: 2,
      box: { x: 771, y: 601, width: 377, height: 56, radius: 8 },
      badge: { x: 745, y: 629 },
      label: '2: Masukkan Kata Sandi Default (123456)',
      labelPos: 'left'
    },
    {
      num: 3,
      box: { x: 771, y: 700, width: 377, height: 52, radius: 8 },
      badge: { x: 745, y: 726 },
      label: '3: Klik Continue / Tekan Enter',
      labelPos: 'left'
    }
  ],

  '02_my_tickets.png': [
    {
      num: 1,
      box: { x: 58, y: 154, width: 1804, height: 122, radius: 12 },
      badge: { x: 80, y: 154 },
      label: '1: Ringkasan Metrik Tiket',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 58, y: 292, width: 1804, height: 60, radius: 10 },
      badge: { x: 80, y: 292 },
      label: '2: Pencarian Cepat & Filter Status',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 1715, y: 94, width: 147, height: 46, radius: 8 },
      badge: { x: 1715, y: 94 },
      label: '3: Buat Tiket Baru (+ New Ticket)',
      labelPos: 'bottom-left'
    },
    {
      num: 4,
      box: { x: 58, y: 368, width: 1804, height: 580, radius: 12 },
      badge: { x: 80, y: 368 },
      label: '4: Daftar Tiket (Klik Baris untuk Membuka Detail)',
      labelPos: 'top-right'
    }
  ],

  '03_create_ticket_selection.png': [
    {
      num: 1,
      box: { x: 382, y: 260, width: 418, height: 180, radius: 12 },
      badge: { x: 382, y: 260 },
      label: '1: Service Ticket (Hardware / Software)',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 812, y: 260, width: 418, height: 180, radius: 12 },
      badge: { x: 812, y: 260 },
      label: '2: Oracle / K2 Request (ERP & Workflow)',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 1242, y: 260, width: 296, height: 180, radius: 12 },
      badge: { x: 1242, y: 260 },
      label: '3: Web / Mobile Dev Request',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 968, y: 765, width: 570, height: 155, radius: 12 },
      badge: { x: 968, y: 765 },
      label: '4: Access Request (E-Form VPN / WiFi)',
      labelPos: 'top-right'
    }
  ],

  '04_create_it_support_form.png': [
    {
      num: 1,
      box: { x: 348, y: 174, width: 622, height: 50, radius: 10 },
      badge: { x: 348, y: 174 },
      label: '1: Template Masalah Cepat',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 348, y: 310, width: 668, height: 236, radius: 10 },
      badge: { x: 348, y: 310 },
      label: '2: Uraikan Masalah & Detail Kendala',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 348, y: 556, width: 668, height: 62, radius: 10 },
      badge: { x: 348, y: 556 },
      label: '3: Lampirkan Berkas / Screenshot (Ctrl+V)',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 1025, y: 310, width: 550, height: 230, radius: 10 },
      badge: { x: 1025, y: 310 },
      label: '4: Kategori, Perangkat, & Prioritas',
      labelPos: 'top-right'
    },
    {
      num: 5,
      box: { x: 1294, y: 590, width: 273, height: 48, radius: 8 },
      badge: { x: 1294, y: 590 },
      label: '5: Klik Kirim Service Ticket',
      labelPos: 'top-left'
    }
  ],

  '05_create_dev_ticket_form.png': [
    {
      num: 1,
      box: { x: 412, y: 174, width: 300, height: 50, radius: 10 },
      badge: { x: 412, y: 174 },
      label: '1: Template Khusus Masalah ERP',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 412, y: 310, width: 1096, height: 236, radius: 10 },
      badge: { x: 412, y: 310 },
      label: '2: Uraikan Modul Sistem & Kode Error',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 412, y: 604, width: 1096, height: 72, radius: 10 },
      badge: { x: 412, y: 604 },
      label: '3: Tentukan Tingkat Urgensi Tiket',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 1303, y: 700, width: 200, height: 48, radius: 8 },
      badge: { x: 1303, y: 700 },
      label: '4: Kirim Tiket Oracle (Ctrl + Enter)',
      labelPos: 'top-left'
    }
  ],

  '06_ticket_detail_chat_rating.png': [
    {
      num: 1,
      box: { x: 58, y: 80, width: 1205, height: 80, radius: 10 },
      badge: { x: 80, y: 80 },
      label: '1: Header Tiket & SLA Target Waktu',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 58, y: 172, width: 1205, height: 700, radius: 12 },
      badge: { x: 80, y: 172 },
      label: '2: Ruang Chat Dua Arah dengan Teknisi',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 1276, y: 80, width: 586, height: 808, radius: 12 },
      badge: { x: 1296, y: 80 },
      label: '3: Teknisi Bertugas & Kolaborator',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 58, y: 928, width: 1205, height: 52, radius: 10 },
      badge: { x: 80, y: 928 },
      label: '4: Balas Pesan, Lampiran & Tempel Screenshot',
      labelPos: 'top-right'
    }
  ],

  '07_zoom_booking_calendar.png': [
    {
      num: 1,
      box: { x: 88, y: 254, width: 494, height: 88, radius: 10 },
      badge: { x: 88, y: 254 },
      label: '1: Topik / Judul Meeting Zoom',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 88, y: 412, width: 494, height: 168, radius: 10 },
      badge: { x: 88, y: 412 },
      label: '2: Tanggal, Waktu Mulai & Durasi',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 88, y: 584, width: 494, height: 174, radius: 10 },
      badge: { x: 88, y: 584 },
      label: '3: Email Peserta & Jadwal Berulang',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 79, y: 822, width: 503, height: 48, radius: 8 },
      badge: { x: 79, y: 822 },
      label: '4: Konfirmasi Buat Meeting',
      labelPos: 'top-right'
    },
    {
      num: 5,
      box: { x: 602, y: 194, width: 1256, height: 686, radius: 12 },
      badge: { x: 622, y: 194 },
      label: '5: Kalender Jadwal & Ketersediaan Ruang',
      labelPos: 'top-right'
    }
  ],

  '07b_zoom_booking_simulated.png': [
    {
      num: 1,
      box: { x: 88, y: 194, width: 494, height: 680, radius: 12 },
      badge: { x: 108, y: 194 },
      label: '1: Formulir Rapat Berulang Terisi Lengkap',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 88, y: 586, width: 494, height: 130, radius: 10 },
      badge: { x: 108, y: 586 },
      label: '2: Email Peserta Undangan Rapat',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 602, y: 194, width: 1256, height: 686, radius: 12 },
      badge: { x: 622, y: 194 },
      label: '3: Monitoring Kalender Real-time',
      labelPos: 'top-right'
    }
  ],

  '08_eform_access_list.png': [
    {
      num: 1,
      box: { x: 56, y: 146, width: 1807, height: 104, radius: 12 },
      badge: { x: 76, y: 146 },
      label: '1: Ringkasan Status Pengajuan Akses',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 1708, y: 106, width: 154, height: 40, radius: 8 },
      badge: { x: 1708, y: 106 },
      label: '2: Ajukan Akses Baru',
      labelPos: 'bottom-left'
    },
    {
      num: 3,
      box: { x: 56, y: 256, width: 1807, height: 624, radius: 12 },
      badge: { x: 76, y: 256 },
      label: '3: Tabel Riwayat Permohonan & Approval',
      labelPos: 'top-right'
    }
  ],

  '09_eform_access_new.png': [
    {
      num: 1,
      box: { x: 366, y: 252, width: 822, height: 136, radius: 10 },
      badge: { x: 366, y: 252 },
      label: '1: Pilih Jenis Akses (VPN / Web / Jaringan)',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 366, y: 400, width: 822, height: 268, radius: 10 },
      badge: { x: 366, y: 400 },
      label: '2: Identitas & Masa Berlaku Akses',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 366, y: 684, width: 822, height: 276, radius: 10 },
      badge: { x: 366, y: 684 },
      label: '3: Kebutuhan Akses & Alasan Operasional',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 1201, y: 418, width: 368, height: 350, radius: 12 },
      badge: { x: 1201, y: 418 },
      label: '4: Ringkasan & Kirim Pengajuan',
      labelPos: 'top-right'
    }
  ],

  '10_client_knowledge_base.png': [
    {
      num: 1,
      box: { x: 406, y: 274, width: 1107, height: 48, radius: 10 },
      badge: { x: 406, y: 274 },
      label: '1: Pencarian Pintar Solusi (Ctrl+K)',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 406, y: 330, width: 1107, height: 168, radius: 12 },
      badge: { x: 406, y: 330 },
      label: '2: Tagar Populer & Kategori Solusi',
      labelPos: 'top-right'
    },
    {
      num: 3,
      box: { x: 406, y: 508, width: 1107, height: 442, radius: 12 },
      badge: { x: 406, y: 508 },
      label: '3: Katalog Artikel SOP Mandiri',
      labelPos: 'top-right'
    }
  ],

  '11_notification_and_profile.png': [
    {
      num: 1,
      box: { x: 647, y: 370, width: 625, height: 440, radius: 12 },
      badge: { x: 647, y: 370 },
      label: '1: Data Diri & Nomor WhatsApp',
      labelPos: 'top-right'
    },
    {
      num: 2,
      box: { x: 888, y: 284, width: 108, height: 38, radius: 8 },
      badge: { x: 888, y: 284 },
      label: '2: Ganti Password',
      labelPos: 'top-left'
    },
    {
      num: 3,
      box: { x: 1004, y: 284, width: 112, height: 38, radius: 8 },
      badge: { x: 1004, y: 284 },
      label: '3: Notifikasi Telegram',
      labelPos: 'top-right'
    },
    {
      num: 4,
      box: { x: 1582, y: 18, width: 34, height: 34, radius: 8 },
      badge: { x: 1582, y: 18 },
      label: '4: Mode Terang / Gelap',
      labelPos: 'bottom-left'
    }
  ]
};

async function testRender() {
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

          for (const item of items) {
            ctx.save();
            const { x, y, width, height, radius = 8 } = item.box;

            // 1. Draw Clean Bounding Box:
            ctx.shadowColor = 'rgba(244, 63, 94, 0.35)';
            ctx.shadowBlur = 6;
            ctx.strokeStyle = '#F43F5E';
            ctx.lineWidth = 2.0;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, radius);
            ctx.stroke();

            // Subtle highlight tint
            ctx.fillStyle = 'rgba(244, 63, 94, 0.03)';
            ctx.fill();
            ctx.setLineDash([]);

            // 2. Draw Callout Badge:
            const badgeRadius = 15;
            let badgeX = item.badge.x;
            let badgeY = item.badge.y;

            // Soft badge shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            // Gradient fill
            const grad = ctx.createLinearGradient(badgeX - badgeRadius, badgeY - badgeRadius, badgeX + badgeRadius, badgeY + badgeRadius);
            grad.addColorStop(0, '#F43F5E');
            grad.addColorStop(1, '#E11D48');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            // White border
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // White text inside badge
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 15px "Segoe UI", Inter, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(item.num), badgeX, badgeY + 0.5);

            // 3. Draw Clean Compact Pill Label:
            if (item.label) {
              ctx.font = '600 12px "Segoe UI", Inter, Arial, sans-serif';
              const textMetrics = ctx.measureText(item.label);
              const pillWidth = Math.round(textMetrics.width + 18);
              const pillHeight = 24;
              const pillRadius = 6;

              let pillX, pillY;
              const pos = item.labelPos || 'top-right';

              if (pos === 'left') {
                pillX = badgeX - badgeRadius - pillWidth - 6;
                pillY = badgeY - pillHeight / 2;
              } else if (pos === 'right' || pos === 'top-right') {
                pillX = badgeX + badgeRadius + 6;
                pillY = badgeY - pillHeight / 2;
              } else if (pos === 'bottom-left') {
                pillX = badgeX - pillWidth + badgeRadius;
                pillY = badgeY + badgeRadius + 6;
              } else if (pos === 'bottom-right') {
                pillX = badgeX - badgeRadius;
                pillY = badgeY + badgeRadius + 6;
              } else if (pos === 'top-left') {
                pillX = badgeX - pillWidth + badgeRadius;
                pillY = badgeY - badgeRadius - pillHeight - 6;
              } else { // 'top'
                pillX = badgeX - pillWidth / 2;
                pillY = badgeY - badgeRadius - pillHeight - 6;
              }

              // Keep inside screen
              if (pillX < 6) pillX = 6;
              if (pillX + pillWidth > 1914) pillX = 1914 - pillWidth;
              if (pillY < 6) pillY = 6;
              if (pillY + pillHeight > 1074) pillY = 1074 - pillHeight;

              ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetY = 2;

              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
              ctx.fill();

              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#F8FAFC';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.label, pillX + 9, pillY + pillHeight / 2);
            }

            ctx.restore();
          }
        };
      </script>
    </body>
    </html>
  `);

  for (const [fileName, items] of Object.entries(CALIBRATED_CONFIGS)) {
    const rawPath = path.join(RAW_DIR, fileName);
    const b64 = fs.readFileSync(rawPath).toString('base64');
    await page.evaluate((src, ann) => window.renderAnnotations(src, ann), `data:image/png;base64,${b64}`, items);
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(PREVIEW_DIR, fileName), buf);
    console.log(`Rendered calibrated preview: ${fileName}`);
  }

  await browser.close();
}

testRender().catch(console.error);
