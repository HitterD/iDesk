const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const RAW_DIR = path.resolve('apps/frontend/public/kb/user-guide/raw');
const TARGET_DIRS = [
  path.resolve('apps/frontend/public/kb/user-guide'),
  path.resolve('apps/backend/uploads/kb/user-guide'),
  path.resolve('docs/assets/user-guide')
];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 100% Clean numbered callouts with concise explanations — NO RED BOUNDING BOXES
const CALLOUTS = {
  '01_login_page.png': [
    {
      num: 1,
      x: 745,
      y: 556,
      label: '1: Masukkan NIK / Email Karyawan',
      pos: 'left'
    },
    {
      num: 2,
      x: 745,
      y: 646,
      label: '2: Masukkan Kata Sandi Default (123456)',
      pos: 'left'
    },
    {
      num: 3,
      x: 745,
      y: 748,
      label: '3: Klik Continue / Tekan Enter',
      pos: 'left'
    }
  ],

  '02_my_tickets.png': [
    {
      num: 1,
      x: 58,
      y: 80,
      label: '1: Metrik Status Tiket',
      pos: 'right'
    },
    {
      num: 2,
      x: 58,
      y: 268,
      label: '2: Cari & Filter Status',
      pos: 'right'
    },
    {
      num: 3,
      x: 1750,
      y: 78,
      label: '3: Buat Tiket Baru (+ New Ticket)',
      pos: 'left'
    },
    {
      num: 4,
      x: 58,
      y: 342,
      label: '4: Tabel Riwayat Tiket',
      pos: 'right'
    }
  ],

  '03_create_ticket_selection.png': [
    {
      num: 1,
      x: 384,
      y: 338,
      label: '1: Service Ticket (IT Support)',
      pos: 'left'
    },
    {
      num: 2,
      x: 955,
      y: 245,
      label: '2: Oracle / K2 ERP Request',
      pos: 'top'
    },
    {
      num: 3,
      x: 1350,
      y: 245,
      label: '3: Web / Mobile Dev Request',
      pos: 'top'
    },
    {
      num: 4,
      x: 1250,
      y: 735,
      label: '4: Access Request (E-Form VPN/WiFi)',
      pos: 'top'
    }
  ],

  '04_create_it_support_form.png': [
    {
      num: 1,
      x: 310,
      y: 195,
      label: '1: Template Masalah Cepat',
      pos: 'left'
    },
    {
      num: 2,
      x: 310,
      y: 360,
      label: '2: Subjek & Detail Kendala',
      pos: 'left'
    },
    {
      num: 3,
      x: 310,
      y: 580,
      label: '3: Lampiran File / Ctrl+V',
      pos: 'left'
    },
    {
      num: 4,
      x: 1610,
      y: 360,
      label: '4: Kategori & Prioritas',
      pos: 'right'
    },
    {
      num: 5,
      x: 1610,
      y: 568,
      label: '5: Kirim Service Ticket',
      pos: 'right'
    }
  ],

  '05_create_dev_ticket_form.png': [
    {
      num: 1,
      x: 380,
      y: 195,
      label: '1: Template Khusus ERP',
      pos: 'left'
    },
    {
      num: 2,
      x: 380,
      y: 360,
      label: '2: Modul, Dokumen & Pesan Error',
      pos: 'left'
    },
    {
      num: 3,
      x: 380,
      y: 645,
      label: '3: Tingkat Urgensi Tiket',
      pos: 'left'
    },
    {
      num: 4,
      x: 1540,
      y: 705,
      label: '4: Kirim Tiket (Ctrl+Enter)',
      pos: 'right'
    }
  ],

  '06_ticket_detail_chat_rating.png': [
    {
      num: 1,
      x: 58,
      y: 68,
      label: '1: Header Tiket & Status SLA',
      pos: 'right'
    },
    {
      num: 2,
      x: 80,
      y: 320,
      label: '2: Ruang Chat Dua Arah Langsung',
      pos: 'right'
    },
    {
      num: 3,
      x: 1500,
      y: 68,
      label: '3: Teknisi Bertugas & Kolaborator',
      pos: 'right'
    },
    {
      num: 4,
      x: 58,
      y: 845,
      label: '4: Balas Chat & Lampiran (Ctrl+V)',
      pos: 'right'
    }
  ],

  '07_zoom_booking_calendar.png': [
    {
      num: 1,
      x: 470,
      y: 380,
      label: '1: Topik / Judul Meeting Zoom',
      pos: 'right'
    },
    {
      num: 2,
      x: 470,
      y: 490,
      label: '2: Tanggal & Waktu Pelaksanaan',
      pos: 'right'
    },
    {
      num: 3,
      x: 470,
      y: 655,
      label: '3: Undangan Peserta & Rapat Berulang',
      pos: 'right'
    },
    {
      num: 4,
      x: 470,
      y: 795,
      label: '4: Konfirmasi Buat Meeting',
      pos: 'right'
    },
    {
      num: 5,
      x: 750,
      y: 220,
      label: '5: Kalender Jadwal & Ketersediaan Zoom',
      pos: 'right'
    }
  ],

  '07b_zoom_booking_simulated.png': [
    {
      num: 1,
      x: 470,
      y: 380,
      label: '1: Formulir Rapat Berulang Terisi',
      pos: 'right'
    },
    {
      num: 2,
      x: 470,
      y: 655,
      label: '2: Daftar Email Undangan Peserta',
      pos: 'right'
    },
    {
      num: 3,
      x: 750,
      y: 220,
      label: '3: Kalender Jadwal Terjadwal Otomatis',
      pos: 'right'
    }
  ],

  '08_eform_access_list.png': [
    {
      num: 1,
      x: 58,
      y: 80,
      label: '1: Metrik Status Permohonan',
      pos: 'right'
    },
    {
      num: 2,
      x: 1750,
      y: 78,
      label: '2: Ajukan Akses Baru',
      pos: 'left'
    },
    {
      num: 3,
      x: 59,
      y: 280,
      label: '3: Tabel Riwayat Permohonan & Approval',
      pos: 'right'
    }
  ],

  '09_eform_access_new.png': [
    {
      num: 1,
      x: 180,
      y: 310,
      label: '1: Pilih Jenis Akses (VPN/Web)',
      pos: 'left'
    },
    {
      num: 2,
      x: 180,
      y: 550,
      label: '2: Identitas & Masa Berlaku',
      pos: 'left'
    },
    {
      num: 3,
      x: 180,
      y: 830,
      label: '3: Alasan & Keperluan Akses',
      pos: 'left'
    },
    {
      num: 4,
      x: 1540,
      y: 500,
      label: '4: Ringkasan & Kirim Pengajuan',
      pos: 'right'
    }
  ],

  '10_client_knowledge_base.png': [
    {
      num: 1,
      x: 210,
      y: 285,
      label: '1: Pencarian Pintar (Ctrl+K)',
      pos: 'left'
    },
    {
      num: 2,
      x: 210,
      y: 455,
      label: '2: Spotlight Panduan Utama',
      pos: 'left'
    },
    {
      num: 3,
      x: 210,
      y: 695,
      label: '3: Topik Populer & SOP',
      pos: 'left'
    }
  ],

  '11_notification_and_profile.png': [
    {
      num: 1,
      x: 620,
      y: 450,
      label: '1: Data Diri & No. WhatsApp',
      pos: 'left'
    },
    {
      num: 2,
      x: 1300,
      y: 300,
      label: '2: Tab Ganti Password',
      pos: 'right'
    },
    {
      num: 3,
      x: 1300,
      y: 450,
      label: '3: Tab Notifikasi Telegram',
      pos: 'right'
    },
    {
      num: 4,
      x: 1640,
      y: 34,
      label: '4: Mode Terang / Gelap',
      pos: 'left'
    }
  ]
};

async function renderNumberedCallouts() {
  console.log('Rendering pristine numbered pin callouts with explanations (NO RED BOXES)...');

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
        window.drawCallouts = async (imgSrc, items) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgSrc;
          });

          // Draw base screenshot completely intact
          ctx.drawImage(img, 0, 0, 1920, 1080);

          for (const item of items) {
            ctx.save();
            const badgeRadius = 14;
            const badgeX = item.x;
            const badgeY = item.y;

            // 1. Draw Clean Compact Pill Label
            if (item.label) {
              ctx.font = '600 12px "Segoe UI", Inter, Arial, sans-serif';
              const textMetrics = ctx.measureText(item.label);
              const pillWidth = Math.round(textMetrics.width + 20);
              const pillHeight = 26;
              const pillRadius = 6;

              let pillX, pillY;
              const pos = item.pos || 'right';

              if (pos === 'left') {
                pillX = badgeX - badgeRadius - pillWidth - 6;
                pillY = badgeY - pillHeight / 2;
              } else if (pos === 'right') {
                pillX = badgeX + badgeRadius + 6;
                pillY = badgeY - pillHeight / 2;
              } else if (pos === 'top-left') {
                pillX = badgeX - pillWidth + badgeRadius;
                pillY = badgeY - badgeRadius - pillHeight - 6;
              } else if (pos === 'top-right') {
                pillX = badgeX - badgeRadius;
                pillY = badgeY - badgeRadius - pillHeight - 6;
              } else if (pos === 'bottom') {
                pillX = badgeX - pillWidth / 2;
                pillY = badgeY + badgeRadius + 6;
              } else { // 'top'
                pillX = badgeX - pillWidth / 2;
                pillY = badgeY - badgeRadius - pillHeight - 6;
              }

              // Keep inside screen
              if (pillX < 8) pillX = 8;
              if (pillX + pillWidth > 1912) pillX = 1912 - pillWidth;
              if (pillY < 8) pillY = 8;
              if (pillY + pillHeight > 1072) pillY = 1072 - pillHeight;

              // Pill shadow
              ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetY = 2;

              // Pill background & border
              ctx.fillStyle = '#0F172A';
              ctx.beginPath();
              ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
              ctx.fill();

              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 1;
              ctx.stroke();

              // Pill text
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#F8FAFC';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.label, pillX + 10, pillY + pillHeight / 2);
            }

            // 2. Draw Callout Badge (Number Pin)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;

            const grad = ctx.createLinearGradient(badgeX - badgeRadius, badgeY - badgeRadius, badgeX + badgeRadius, badgeY + badgeRadius);
            grad.addColorStop(0, '#F43F5E');
            grad.addColorStop(1, '#E11D48');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px "Segoe UI", Inter, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(item.num), badgeX, badgeY + 0.5);

            ctx.restore();
          }
        };
      </script>
    </body>
    </html>
  `);

  for (const [fileName, items] of Object.entries(CALLOUTS)) {
    const rawPath = path.join(RAW_DIR, fileName);
    if (!fs.existsSync(rawPath)) {
      console.warn(`Raw file not found: ${rawPath}`);
      continue;
    }

    const b64 = fs.readFileSync(rawPath).toString('base64');
    const dataUrl = `data:image/png;base64,${b64}`;

    await page.evaluate((src, annotations) => window.drawCallouts(src, annotations), dataUrl, items);

    const imgBuffer = await page.screenshot({ type: 'png' });

    for (const targetDir of TARGET_DIRS) {
      const outFilePath = path.join(targetDir, fileName);
      fs.writeFileSync(outFilePath, imgBuffer);
    }

    console.log(`Successfully annotated & saved: ${fileName} (${items.length} callouts)`);
  }

  await browser.close();
  console.log('\nAll 12 user guide images annotated with clean numbered callouts!');
}

renderNumberedCallouts().catch(console.error);
