import * as fs from 'fs';
import * as path from 'path';
const PDFDocument = require('pdfkit');

async function generateSpecPdf() {
    const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        info: {
            Title: 'Dokumen Spesifikasi Resmi Pembaruan iDesk - Ticketing, SLA, Handover & Kanban',
            Author: 'Antigravity AI / iDesk Engineering Team',
            Subject: 'System Update Specification Document',
            Keywords: 'iDesk, Ticketing, Oracle K2, Web Dev, Mobile Dev, SLA Extension, Ticket Handover, Kanban Board',
        }
    });

    const outputPath = path.resolve(__dirname, '../../../../docs/Spesifikasi_Update_iDesk_Ticketing_SLA_Kanban.pdf');
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    const primaryColor = '#1E3A8A'; // Blue 900
    const accentColor = '#2563EB';  // Blue 600
    const darkTextColor = '#0F172A'; // Slate 900
    const mutedTextColor = '#475569'; // Slate 600
    const borderColor = '#CBD5E1'; // Slate 300
    const tagBg = '#EFF6FF';       // Blue 50
    const tagBorder = '#BFDBFE';   // Blue 200

    // Header & Footer helper
    const drawHeader = (pageTitle: string) => {
        doc.save();
        doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
           .text('iDesk Enterprise Helpdesk Platform', 40, 20, { align: 'left' });
        doc.fillColor(mutedTextColor).fontSize(8).font('Helvetica')
           .text(pageTitle, 200, 20, { align: 'right', width: 355 });
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, 32).lineTo(555, 32).stroke();
        doc.restore();
    };

    const drawFooter = (currentPage: number, totalPages: number) => {
        doc.save();
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, 800).lineTo(555, 800).stroke();
        doc.fillColor(mutedTextColor).fontSize(8).font('Helvetica')
           .text('Dokumen Spesifikasi Resmi Pembaruan Fitur iDesk • Confirmed & Approved', 40, 808, { align: 'left' });
        doc.text(`Halaman ${currentPage} dari ${totalPages}`, 400, 808, { align: 'right', width: 155 });
        doc.restore();
    };

    // ================= PAGE 1 =================
    doc.rect(40, 45, 515, 138).fillAndStroke('#F8FAFC', borderColor);
    doc.rect(40, 45, 6, 138).fill(accentColor);

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(18)
       .text('DOKUMEN SPESIFIKASI TEKNIS PEMBARUAN SISTEM', 60, 62);
    doc.fontSize(13).fillColor(accentColor)
       .text('iDesk Helpdesk — Multi-Queue, Form Request, Smart SLA, Handover & Kanban', 60, 86);
    
    doc.fontSize(8.5).font('Helvetica').fillColor(mutedTextColor)
       .text('Versi Dokumen: 2.4.0-FINAL | Tanggal: September 2026 | Status: User Confirmed & Ready', 60, 112)
       .text('Target Pengguna: IT Support, Oracle/K2 Team, Web Dev Team, Mobile Dev Team, Management & User', 60, 126)
       .text('Referensi Visual: 5 Tangkapan Layar (Request Center, Form Request, Modal SLA, Modal Handover, Kanban Board)', 60, 140)
       .text('Dokumen Basis: f:/Program Bagas/SynologyDrive/iDesk-main/docs/Spesifikasi_Update_iDesk_Ticketing_SLA_Kanban.pdf', 60, 154);

    doc.y = 198;

    // Executive Summary Box
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('1. EXECUTIVE SUMMARY & LATAR BELAKANG PEMBARUAN', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(9).lineGap(2.5)
       .text('Pembaruan platform iDesk ini dirancang untuk membagi penanganan tiket ke dalam 4 divisi spesifik (IT Support, Oracle/K2, Web Developer, dan Mobile Developer), menyederhanakan pengisian formulir tiket dengan template cepat & tingkat urgensi, menyediakan dialog perpanjangan SLA langsung di halaman detail tiket model chat, menyediakan alur penerusan tiket (handover) antar tim secara akuntabel, serta menghadirkan papan Kanban interaktif untuk masing-masing antrean kerja agent.', { width: 515 });

    doc.y += 12;

    // 5 Key Pillars
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('2. RINGKASAN 5 PILAR UTAMA PEMBARUAN', 40, doc.y);
    doc.y += 6;

    const pillars = [
        { num: 'P1', title: 'Multi-Queue Request Center (4 Streams)', desc: 'Pemisahan modul antrean tiket: (1) IT Support Tickets, (2) Oracle K2 Request, (3) Web Developer Request, dan (4) Mobile Developer Request dengan routing mandiri dan isolasi permission role.' },
        { num: 'P2', title: 'Form Pengisian Tiket Modern (Sesuai Gambar 2)', desc: 'Antarmuka submit request user dengan Tombol Template Cepat (UI Bug, API Error, Fitur Baru, Slow Web), Subject (0/200), Detail Masalah (0/5000), Upload/Paste Lampiran (Maks 5x10MB), 4 Urgency Level, dan shortcut Ctrl+Enter.' },
        { num: 'P3', title: 'Perpanjangan Target SLA di Chat Detail (Sesuai Gambar 3)', desc: 'Modal perpanjangan SLA dari chat detail. Pilihan durasi kilat (+4 Jam, +1 Hari Kerja, +2 Hari Kerja, dsb), DatePicker manual WIB, 6 kategori alasan keterlambatan, dan pencatatan otomatis ke System Message Event & log audit.' },
        { num: 'P4', title: 'Fitur Penerusan Tiket Antar Tim (Sesuai Gambar 4)', desc: 'Handover tiket antar tim (Web Dev -> Oracle/Dev, Mobile Dev, Ops Support) dengan tag alasan cepat, catatan teknis tambahan, serta otomatis meng-unassign PIC lama ke antrean tim baru.' },
        { num: 'P5', title: 'Universal Kanban Board untuk Seluruh Agent (Sesuai Gambar 5)', desc: 'Papan Kanban visual terisolasi per antrean modul (Open, In Progress, Waiting Vendor, Resolved) dengan drag-and-drop, filter cepat (Semua, Tugas Saya, Overdue, Critical, Site Selector), dan toggle Kanban/Table.' }
    ];

    pillars.forEach((p) => {
        const cardY = doc.y;
        doc.rect(40, cardY, 515, 50).fillAndStroke('#FFFFFF', borderColor);
        doc.rect(40, cardY, 30, 50).fill(accentColor);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(p.num, 43, cardY + 19, { width: 24, align: 'center' });
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9.5).text(p.title, 78, cardY + 7);
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(8).lineGap(1.5).text(p.desc, 78, cardY + 20, { width: 468 });
        doc.y = cardY + 54;
    });

    // ================= PAGE 2 =================
    doc.addPage();
    drawHeader('Pilar 1: Multi-Queue & Pilar 2: Form Pengisian Tiket');

    doc.y = 48;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('3. SPESIFIKASI DETAIL PILAR 1: MULTI-QUEUE REQUEST CENTER', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Sidebar kiri menampilkan menu Request Center dengan 4 divisi antrean tiket yang terintegrasi penuh:', { width: 515 });

    doc.y += 6;

    const queues = [
        { name: 'IT Support Tickets', icon: 'Ticket', route: '/tickets/list', role: 'Ops Support / ICT Team', desc: 'Melayani troubleshooting hardware, printer, network/LAN/WiFi, instalasi OS, peripheral, dan permintaan IT umum.' },
        { name: 'Oracle K2 Request', icon: 'Database', route: '/tickets/oracle-k2', role: 'Oracle & K2 ERP Team', desc: 'Melayani penanganan modul Oracle ERP, permission/role K2, locking user login Oracle, dan transaksi database.' },
        { name: 'Web Developer Request', icon: 'Code2', route: '/tickets/web-developer', role: 'Web Development Team', desc: 'Melayani bug tampilan UI/UX portal, error API endpoint backend, permintaan fitur baru web portal, dan timeout server.' },
        { name: 'Mobile Developer Request', icon: 'Smartphone', route: '/tickets/mobile-developer', role: 'Mobile App Team', desc: 'Melayani force close/crash aplikasi iOS/Android, kendala sinkronisasi data mobile, push notification, dan rilis APK/IPA.' }
    ];

    queues.forEach((q) => {
        const qY = doc.y;
        doc.rect(40, qY, 515, 42).fillAndStroke(tagBg, tagBorder);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(`• ${q.name}`, 50, qY + 6);
        doc.fillColor(accentColor).font('Helvetica').fontSize(7.5).text(`Route: ${q.route} | Tim Penanggung Jawab: ${q.role}`, 200, qY + 7);
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(8).text(q.desc, 50, qY + 20, { width: 495 });
        doc.y = qY + 46;
    });

    doc.y += 8;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('4. SPESIFIKASI DETAIL PILAR 2: FORM PENGISIAN TIKET USER (GAMBAR 2)', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Form pengisian tiket dirancang dengan standar UX responsif dan informatif:', { width: 515 });

    doc.y += 6;

    const formElements = [
        { comp: 'Header & Sub-header', spec: 'Menampilkan nama modul (Web Developer Request) dan deskripsi layanan ("Web Applications & Portal Development Support").' },
        { comp: 'Template Cepat (Quick Pills)', spec: 'Tombol preset 1-klik: "UI Bug", "API Error", "Fitur Baru", "Slow Web" yang otomatis mengisi Subjek & Deskripsi awal.' },
        { comp: 'Subject / Judul Tiket', spec: 'Wajib diisi (*). Maksimal 200 karakter dengan live counter (0 / 200) dan placeholder panduan.' },
        { comp: 'Detail Masalah / Kebutuhan', spec: 'Wajib diisi (*). Textarea lapang maksimal 5.000 karakter (0 / 5000) dengan placeholder spesifikasi URL & reproduksi error.' },
        { comp: 'Lampiran Berkas', spec: 'Mendukung drag-and-drop, jelajah berkas, dan tempel langsung gambar (Ctrl + V). Maksimal 5 file, 10MB per file.' },
        { comp: 'Issue Urgency / Prioritas', spec: 'Pilihan radio/pill 4 level: LOW (Hijau), MEDIUM (Biru - Default), HIGH (Oranye), CRITICAL (Merah).' },
        { comp: 'Aksi & Pintasan', spec: 'Tombol submit "KIRIM TIKET WEB DEV" didukung pintasan keyboard instan "Ctrl + Enter".' }
    ];

    formElements.forEach((f) => {
        const fY = doc.y;
        doc.rect(40, fY, 515, 24).fillAndStroke('#FFFFFF', borderColor);
        doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(8).text(f.comp, 50, fY + 7, { width: 135 });
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).text(f.spec, 190, fY + 7, { width: 355 });
        doc.y = fY + 28;
    });

    // ================= PAGE 3 =================
    doc.addPage();
    drawHeader('Pilar 3: Perpanjangan Target SLA & Pilar 4: Forwarding Tiket');

    doc.y = 48;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('5. SPESIFIKASI DETAIL PILAR 3: PERPANJANGAN TARGET SLA (GAMBAR 3)', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Fitur Perpanjangan Target SLA dapat diakses di bilah aksi (Quick Actions) halaman detail tiket (model chat):', { width: 515 });

    doc.y += 6;

    const slaFeatures = [
        { section: '1. Pemilihan Target Deadline Baru', detail: 'Tersedia 5 preset tombol durasi kerja (+4 Jam, +1 Hari Kerja, +2 Hari Kerja, +3 Hari Kerja, +1 Minggu) serta pemilih tanggal & jam manual WIB. Dilengkapi panel perbandingan visual: [Target Sebelumnya]  ==>  [Target Diperpanjang Ke].' },
        { section: '2. 6 Kategori Alasan Penundaan', detail: 'Grid pilihan visual interaktif dengan 6 kategori resmi:\n• Menunggu User (Menunggu konfirmasi, kelengkapan data, atau respon user)\n• Menunggu Vendor (Menunggu pengiriman sparepart, servis pihak ke-3, RMA)\n• Persetujuan Manajerial (Memerlukan persetujuan biaya, pergantian unit, otorisasi)\n• Kompleksitas Teknis (Kendala teknis mendalam butuh investigasi lanjut)\n• Dependensi Eksternal (Gangguan ISP/jaringan, server pusat, listrik/gedung)\n• Alasan Lainnya (Hambatan operasional lain yang telah disepakati)' },
        { section: '3. Penjelasan Rinci Penundaan', detail: 'Textarea wajib diisi (*) hingga 1.000 karakter (0 / 1000) untuk mencatat detail kendala spesifik.' },
        { section: '4. Keputusan Kebijakan (Hasil Grill)', detail: 'Disepakati: Penyesuaian SLA langsung otomatis aktif mengupdate deadline tiket & memicu System Event Message di chat riwayat tiket tanpa perlu approval berjenjang, dan tercatat permanen di audit log.' }
    ];

    slaFeatures.forEach((s) => {
        const sY = doc.y;
        const blockHeight = s.section.startsWith('2.') ? 76 : 38;
        doc.rect(40, sY, 515, blockHeight).fillAndStroke('#FFFFFF', borderColor);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text(s.section, 50, sY + 5);
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).lineGap(1.5).text(s.detail, 50, sY + 16, { width: 495 });
        doc.y = sY + blockHeight + 4;
    });

    doc.y += 6;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('6. SPESIFIKASI DETAIL PILAR 4: PENERUSAN TIKET KE TIM LAIN (GAMBAR 4)', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Fitur "Teruskan Tiket ke Tim Lain" memfasilitasi eskalasi dan perpindahan tanggung jawab tiket antar divisi:', { width: 515 });

    doc.y += 6;

    const forwardSpecs = [
        { item: 'Visual Handover Summary', desc: 'Menampilkan arah perpindahan secara jelas: [Tim Saat Ini]  ==>  [Tim Tujuan].' },
        { item: 'Pilihan Tim Tujuan', desc: 'Pilihan tim: (1) Oracle / Developer Team, (2) Mobile Developer Team, (3) Ops Support / ICT Team, (4) Web Developer Team.' },
        { item: 'Tag Alasan Penerusan', desc: 'Tag pilihan cepat: "Terkait aplikasi Mobile", "Terkait aplikasi Oracle / K2", "Masalah infrastruktur / perangkat", "Butuh kode / akses developer", "Salah routing awal", "Lainnya".' },
        { item: 'Keterangan Tambahan', desc: 'Catatan opsional maksimal 500 karakter untuk detail handover teknis.' },
        { item: 'Aturan PIC (Hasil Grill)', desc: 'Disepakati: Saat diteruskan, PIC lama otomatis di-unassign sehingga tiket masuk ke antrean unassigned tim tujuan, status tetap aktif, dan tercatat di timeline audit.' }
    ];

    forwardSpecs.forEach((fw) => {
        const fwY = doc.y;
        doc.rect(40, fwY, 515, 24).fillAndStroke(tagBg, tagBorder);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text(fw.item, 50, fwY + 7, { width: 135 });
        doc.fillColor(darkTextColor).font('Helvetica').fontSize(7.5).text(fw.desc, 190, fwY + 7, { width: 355 });
        doc.y = fwY + 28;
    });

    // ================= PAGE 4 =================
    doc.addPage();
    drawHeader('Pilar 5: Universal Kanban Board & Arsitektur Teknis');

    doc.y = 48;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('7. SPESIFIKASI DETAIL PILAR 5: UNIVERSAL KANBAN BOARD (GAMBAR 5)', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Tampilan Kanban Board interaktif tersedia untuk seluruh modul antrean tiket bagi seluruh agent:', { width: 515 });

    doc.y += 6;

    const kanbanSpecs = [
        { col: '1. Struktur Kolom Status', val: '4 Jalur Alur Kerja Utama:\n• Open (Tiket baru masuk / unassigned)\n• In Progress (Sedang dikerjakan aktif oleh agent)\n• Waiting Vendor (Tertunda menunggu respon pihak ke-3 / sparepart)\n• Resolved (Masalah terselesaikan, menunggu konfirmasi penutupan)' },
        { col: '2. Kartu Tiket (Kanban Card)', val: 'Menampilkan Nomor Tiket, Badge Kategori, Prioritas (Low, Medium, High, Critical), Judul Masalah, Ringkasan Deskripsi, Target Deadline SLA, Pemohon, dan Avatar PIC Agent.' },
        { col: '3. Filter & Pencarian Cepat', val: 'Search bar real-time, filter "Semua", "Tugas Saya", counter "Overdue", counter "Critical", serta Multi-Site Selector.' },
        { col: '4. Drag-and-Drop & WebSocket', val: 'Perpindahan status via Drag-and-Drop yang terhubung langsung ke WebSocket gateway untuk sinkronisasi real-time antar agent.' },
        { col: '5. Pola Tampilan (Hasil Grill)', val: 'Disepakati: Papan Kanban terisolasi per antrean modul (masing-masing modul memiliki Kanban & Table view mandiri) untuk menjaga fokus pengerjaan tim.' }
    ];

    kanbanSpecs.forEach((k) => {
        const kY = doc.y;
        const kHeight = k.col.startsWith('1.') ? 52 : 28;
        doc.rect(40, kY, 515, kHeight).fillAndStroke('#FFFFFF', borderColor);
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text(k.col, 50, kY + 6, { width: 135 });
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).lineGap(1.5).text(k.val, 190, kY + 6, { width: 355 });
        doc.y = kY + kHeight + 4;
    });

    doc.y += 6;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('8. ARSITEKTUR DATABASE, API ENDPOINT & KEAMANAN SISTEM', 40, doc.y);
    doc.y += 5;

    doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(8.5).text('Tabel & Entity Terkait:', 40, doc.y);
    doc.y += 4;
    doc.font('Helvetica').fontSize(7.5).fillColor(mutedTextColor).lineGap(2)
       .text('• `tickets`: Kolom `handlingTeam`, `category`, `priority`, `slaTarget`, `assignedToId`, `status`, `siteId`.', 45, doc.y)
       .text('• `sla_adjustments`: Kolom `ticketId`, `type`, `minutes`, `reasonCategory`, `reasonText`, `previousTarget`, `newTarget`, `actorId`.', 45, doc.y + 11)
       .text('• `ticket_messages` & `audit_logs`: Mencatat event sistem otomatis untuk perubahan SLA dan penerusan tiket.', 45, doc.y + 22);

    doc.y += 34;

    const endpoints = [
        { method: 'POST', path: '/tickets/create', desc: 'Membuat tiket baru sesuai modul dengan validasi lampiran & prioritas.' },
        { method: 'POST', path: '/tickets/:id/sla/extend', desc: 'Memperpanjang target SLA tiket dengan mencatat kategori & rincian alasan penundaan.' },
        { method: 'POST', path: '/tickets/:id/forward', desc: 'Meneruskan tiket ke tim penanganan lain dan meng-unassign PIC lama.' },
        { method: 'PATCH', path: '/tickets/:id/status', desc: 'Mengubah status tiket (digunakan pada drag-and-drop kartu Kanban Board).' },
        { method: 'GET', path: '/tickets/oracle-k2 /web-dev /mobile-dev', desc: 'Mengambil data tiket spesifik modul dengan filter site, search, status, dan penugasan.' }
    ];

    endpoints.forEach((ep) => {
        const epY = doc.y;
        doc.rect(40, epY, 515, 18).fillAndStroke(tagBg, tagBorder);
        doc.fillColor(ep.method === 'POST' ? '#1D4ED8' : ep.method === 'PATCH' ? '#D97706' : '#059669')
           .font('Helvetica-Bold').fontSize(7.5).text(ep.method, 50, epY + 5, { width: 45 });
        doc.fillColor(darkTextColor).font('Courier-Bold').fontSize(7).text(ep.path, 100, epY + 5, { width: 175 });
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7).text(ep.desc, 280, epY + 5, { width: 265 });
        doc.y = epY + 21;
    });

    // ================= PAGE 5 =================
    doc.addPage();
    drawHeader('Matriks Akses & Lembar Pengesahan Spesifikasi');

    doc.y = 48;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('9. MATRIKS HAK AKSES PERAN (ROLE-BASED ACCESS CONTROL)', 40, doc.y);
    doc.y += 6;

    const rbacHeaders = ['Fitur / Modul', 'USER', 'AGENT (ICT)', 'AGENT (DEV)', 'MANAGER', 'ADMIN'];
    const rbacData = [
        ['Buat Tiket (Semua Modul)', ' Ya', ' Ya', ' Ya', ' Ya', ' Ya'],
        ['Lihat Antrean IT Support', 'Hanya Milik Sendiri', ' Penuh', ' Terbatas', ' Penuh', ' Penuh'],
        ['Lihat Antrean Oracle / K2', 'Hanya Milik Sendiri', ' Terbaca', ' Penuh (Oracle)', ' Penuh', ' Penuh'],
        ['Lihat Antrean Web Dev', 'Hanya Milik Sendiri', ' Terbaca', ' Penuh (Web Dev)', ' Penuh', ' Penuh'],
        ['Lihat Antrean Mobile Dev', 'Hanya Milik Sendiri', ' Terbaca', ' Penuh (Mobile)', ' Penuh', ' Penuh'],
        ['Perpanjang Target SLA', ' Tidak', ' Ya (Otomatis)', ' Ya (Otomatis)', ' Penuh (Override)', ' Penuh (Override)'],
        ['Teruskan Tiket (Handover)', ' Tidak', ' Ya (Unassign PIC)', ' Ya (Unassign PIC)', ' Ya', ' Ya'],
        ['Papan Kanban & Drag-Drop', ' Tidak', ' Ya (Per Modul)', ' Ya (Per Modul)', ' Ya', ' Ya'],
        ['Export Laporan PDF/Excel', ' Tidak', ' Terbatas', ' Terbatas', ' Penuh', ' Penuh'],
    ];

    const tableTop = doc.y;
    doc.rect(40, tableTop, 515, 18).fill(primaryColor);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
    doc.text(rbacHeaders[0], 50, tableTop + 5, { width: 140 });
    doc.text(rbacHeaders[1], 195, tableTop + 5, { width: 55, align: 'center' });
    doc.text(rbacHeaders[2], 255, tableTop + 5, { width: 75, align: 'center' });
    doc.text(rbacHeaders[3], 335, tableTop + 5, { width: 75, align: 'center' });
    doc.text(rbacHeaders[4], 415, tableTop + 5, { width: 65, align: 'center' });
    doc.text(rbacHeaders[5], 485, tableTop + 5, { width: 60, align: 'center' });

    let rbacY = tableTop + 18;
    rbacData.forEach((row, index) => {
        const bg = index % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(40, rbacY, 515, 18).fillAndStroke(bg, borderColor);
        doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(7.5).text(row[0], 50, rbacY + 5, { width: 140 });
        doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7);
        doc.text(row[1], 195, rbacY + 5, { width: 55, align: 'center' });
        doc.text(row[2], 255, rbacY + 5, { width: 75, align: 'center' });
        doc.text(row[3], 335, rbacY + 5, { width: 75, align: 'center' });
        doc.text(row[4], 415, rbacY + 5, { width: 65, align: 'center' });
        doc.text(row[5], 485, rbacY + 5, { width: 60, align: 'center' });
        rbacY += 18;
    });

    doc.y = rbacY + 14;
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('10. KESIMPULAN & PENGESAHAN SPESIFIKASI', 40, doc.y);
    doc.y += 5;
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(8.5).lineGap(2)
       .text('Dokumen spesifikasi ini telah diselaraskan melalui sesi review & drill-down interaktif. Seluruh arsitektur, antarmuka pengguna, logika bisnis SLA, alur handover, dan sistem Kanban pada aplikasi iDesk telah didefinisikan secara presisi dan terverifikasi.', { width: 515 });

    doc.y += 20;

    // Signature boxes
    const sigY = doc.y;
    const sigWidth = 155;
    const sigHeight = 80;

    // Box 1
    doc.rect(40, sigY, sigWidth, sigHeight).stroke(borderColor);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text('Dipersiapkan Oleh:', 50, sigY + 8);
    doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).text('Lead Developer / AI Architect', 50, sigY + 19);
    doc.strokeColor(borderColor).dash(2, { space: 2 }).moveTo(50, sigY + 60).lineTo(185, sigY + 60).stroke().undash();
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(7).text('Engineering & Development Team', 50, sigY + 65);

    // Box 2
    doc.rect(215, sigY, sigWidth, sigHeight).stroke(borderColor);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text('Diverifikasi Oleh:', 225, sigY + 8);
    doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).text('ICT & Support Operations Lead', 225, sigY + 19);
    doc.strokeColor(borderColor).dash(2, { space: 2 }).moveTo(225, sigY + 60).lineTo(360, sigY + 60).stroke().undash();
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(7).text('Product Owner / IT Support', 225, sigY + 65);

    // Box 3
    doc.rect(390, sigY, sigWidth, sigHeight).stroke(borderColor);
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text('Disetujui Oleh:', 400, sigY + 8);
    doc.fillColor(mutedTextColor).font('Helvetica').fontSize(7.5).text('IT Manager / Head of Technology', 400, sigY + 19);
    doc.strokeColor(borderColor).dash(2, { space: 2 }).moveTo(400, sigY + 60).lineTo(535, sigY + 60).stroke().undash();
    doc.fillColor(darkTextColor).font('Helvetica').fontSize(7).text('Management Approval', 400, sigY + 65);

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawFooter(i + 1, totalPages);
    }

    doc.end();

    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            console.log(`Successfully generated updated PDF spec at ${outputPath}`);
            resolve(outputPath);
        });
        writeStream.on('error', reject);
    });
}

generateSpecPdf().catch(err => {
    console.error('Error generating PDF:', err);
    process.exit(1);
});
