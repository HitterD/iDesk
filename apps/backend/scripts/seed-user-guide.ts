import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import * as fs from 'fs';

// Load environment variables from apps/backend/.env
config({ path: join(__dirname, '../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'idesk',
    synchronize: false,
    logging: true,
});

const ARTICLE_TITLE = 'Panduan Lengkap Penggunaan Portal User iDesk: Dari Login Hingga Layanan IT';
const ARTICLE_CATEGORY = 'General';
const ARTICLE_TAGS = ['Panduan User', 'Portal iDesk', 'Tiket Bantuan', 'Oracle K2', 'Web Dev', 'Mobile Dev', 'E-Form Access', 'Zoom Booking'];
const ARTICLE_IMAGES = [
    '/uploads/kb/01_login_page.png',
    '/uploads/kb/02_my_tickets.png',
    '/uploads/kb/03_ticket_chat_room.png',
    '/uploads/kb/04_create_selection.png',
    '/uploads/kb/05_form_it_support.png',
    '/uploads/kb/06_form_oracle_k2.png',
    '/uploads/kb/07_form_web_dev.png',
    '/uploads/kb/08_form_mobile_dev.png',
    '/uploads/kb/09_eform_access_list.png',
    '/uploads/kb/10_eform_access_new.png',
    '/uploads/kb/11_zoom_calendar.png',
    '/uploads/kb/12_knowledge_base.png',
];

const ARTICLE_CONTENT = `
# Panduan Lengkap Penggunaan Portal User iDesk: Dari Login Hingga Layanan IT

Selamat datang di **iDesk Portal**! Panduan ini dirancang untuk membantu seluruh karyawan dalam memanfaatkan sistem layanan IT terpadu PT Santos Jaya Abadi secara mandiri, cepat, dan efisien.

---

## Bab 1: Akses Portal & Cara Login

Untuk memulai, akses portal iDesk melalui peramban web (*browser*) Anda pada alamat resmi: **https://idesk.santos.co.id/login**.

![01. Halaman Login Portal iDesk|Tampilan Halaman Login iDesk](/uploads/kb/01_login_page.png){align=center size=100}

### Step 1: Memasukkan Kredensial Akun
1. Masukkan **NIK** atau **Alamat Email Perusahaan** (contoh: \`user.spj@idesk.com\`) pada kolom **NIK / EMAIL**.
2. Masukkan kata sandi (*password*) Anda pada kolom **PASSWORD**.
3. Centang opsi **Keep session active** jika Anda menggunakan perangkat kantor pribadi.
4. Klik tombol **Continue** atau tekan tombol **Enter** pada keyboard.

> **Catatan Keamanan:**
> Jangan pernah membagikan password akun iDesk Anda kepada siapa pun, termasuk staf IT. Jika lupa kata sandi, hubungi admin IT Helpdesk.

---

## Bab 2: Memahami Dashboard "Tiket Saya"

Setelah berhasil masuk, Anda akan langsung diarahkan ke halaman **My Tickets** (\`/client/my-tickets\`).

![02. Dashboard Tiket Saya|Ringkasan Status Tiket & Daftar Permintaan Aktif](/uploads/kb/02_my_tickets.png){align=center size=100}

### Fitur Utama Dashboard Tiket:
- **Kartu Ringkasan (Statistik)**:
  - **TOTAL**: Jumlah seluruh tiket yang pernah Anda ajukan.
  - **OPEN**: Tiket baru yang sedang menunggu alokasi teknisi.
  - **IN PROGRESS**: Tiket yang sedang ditangani secara aktif oleh tim IT.
  - **RESOLVED**: Tiket yang telah selesai ditangani.
- **Pencarian Cepat**: Cari tiket berdasarkan judul masalah atau ID tiket spesifik.
- **Filter Tab Status**: Klik tombol status (*All Status, Open, In Progress, Resolved*) untuk memfilter daftar tiket secara instan.
- **Tombol "+ New Ticket"**: Tombol biru di sudut kanan atas untuk membuat pengajuan baru.

---

## Bab 3: Membuat Tiket Sesuai Kebutuhan Layanan

Klik tombol **+ New Ticket** di dashboard untuk membuka menu pilihan kebutuhan layanan IT.

![03. Pilihan Jenis Kebutuhan Tiket|Katalog Menu Pengajuan Tiket iDesk](/uploads/kb/04_create_selection.png){align=center size=100}

Pilihlah modul yang sesuai dengan kendala yang Anda alami:

---

### 3.1 Service Ticket (General IT Support)
Gunakan opsi ini untuk masalah perangkat keras, printer, instalasi software umum, gangguan jaringan internet/LAN, atau email kantor.

![04. Formulir Service Ticket|Formulir Pengajuan IT Support Umum](/uploads/kb/05_form_it_support.png){align=center size=100}

### Step 2: Mengisi Formulir Service Ticket
1. **Title / Judul Masalah**: Tuliskan ringkasan singkat kendala (contoh: *Printer di Dept Finance tidak merespon*).
2. **Category & Priority**: Pilih kategori masalah (*Hardware, Software, Network, Email*) dan tingkat urgensi (*Low, Medium, High, Critical*).
3. **Deskripsi Kendala**: Jelaskan kronologi masalah, pesan error yang muncul, dan lokasi kerja Anda.
4. **Lampiran (*Attachments*)**: Unggah screenshot pesan error atau foto kendala untuk mempercepat proses investigasi oleh teknisi.
5. Klik **Kirim Tiket**.

---

### 3.2 Oracle / K2 Enterprise System Request
Pilih opsi ini jika Anda mengalami kendala pada sistem ERP Oracle, modul approval K2, data transaksi ERP, atau permintaan hak akses peran (*role*) Oracle.

![05. Formulir Oracle & K2 Request|Form Pengajuan Bantuan Sistem ERP Oracle dan K2](/uploads/kb/06_form_oracle_k2.png){align=center size=100}

### Step 3: Mengisi Permintaan Oracle / K2
1. Tentukan modul sistem terkait (contoh: *Oracle Financials, SCM, K2 Workflow*).
2. Lampirkan kode transaksi / nomor dokumen yang mengalami error.
3. Cantumkan screenshot pesan sistem yang muncul di Oracle/K2.

---

### 3.3 Web Developer Request
Pilih opsi ini untuk pelaporan bug pada portal web internal, intranet, atau permintaan fitur baru pada sistem aplikasi web.

![06. Formulir Web Developer Request|Form Permintaan Pengembangan & Perbaikan Aplikasi Web](/uploads/kb/07_form_web_dev.png){align=center size=100}

### Step 4: Mengisi Permintaan Web Developer
1. Cantumkan URL halaman web yang bermasalah.
2. Jelaskan langkah-langkah yang menyebabkan terjadinya error (*Steps to Reproduce*).
3. Sertakan tangkapan layar console browser jika memungkinkan.

---

### 3.4 Mobile Developer Request
Pilih opsi ini jika Anda mengalami kendala aplikasi mobile kantor pada perangkat Android/iOS (misal: crash aplikasi, gagal sinkronisasi data mobile, atau update versi APK).

![07. Formulir Mobile Developer Request|Form Permintaan Dukungan Aplikasi Mobile](/uploads/kb/08_form_mobile_dev.png){align=center size=100}

---

## Bab 4: Ruang Chat Tiket & Komunikasi dengan Tim IT

Setiap tiket yang diajukan memiliki **Ruang Interaksi Langsung (*Chat & Timeline*)** yang menghubungkan Anda dengan teknisi penanggung jawab.

![08. Ruang Chat & Detail Tiket|Tampilan Live Chat & Riwayat Penanganan Tiket](/uploads/kb/03_ticket_chat_room.png){align=center size=100}

### Kemampuan di Halaman Detail Tiket:
- **Live Chat Real-Time**: Berkirim pesan instan dengan teknisi IT tanpa perlu bolak-balik via email atau WhatsApp.
- **Kirim Lampiran & Screenshot**: Unggah file atau gambar tambahan saat proses perbaikan berlangsung.
- **Timeline Progres**: Pantau status perubahan dari *Open* → *In Progress* → *Resolved*.
- **Informasi Petugas**: Mengetahui siapa teknisi yang sedang menangani tiket Anda.

---

## Bab 5: Pengajuan Hak Akses Sistem (E-Form Access)

Menu **E-Form Access** (\`/client/eform-access\`) digunakan untuk mengajukan izin akses jaringan khusus, WiFi tamu, VPN kantor, atau akses direktori/folder server yang memerlukan persetujuan atasan (*Approval*).

![09. Daftar Pengajuan E-Form Access|Daftar Permintaan Hak Akses](/uploads/kb/09_eform_access_list.png){align=center size=100}

Klik tombol **+ Request Access** untuk membuka formulir pengajuan baru:

![10. Formulir Pengajuan Akses Baru|Formulir Permintaan Hak Akses E-Form](/uploads/kb/10_eform_access_new.png){align=center size=100}

### Step 5: Alur Pengajuan E-Form Access
1. Pilih jenis akses yang dibutuhkan (*WiFi, VPN, Shared Folder, Web Access*).
2. Tentukan periode waktu akses (*Permanen* atau *Sementara* beserta tanggal berakhir).
3. Tuliskan alasan bisnis / justifikasi kebutuhan akses tersebut.
4. Pilih atasan / manager yang akan memberikan persetujuan (*Approver*).
5. Klik **Submit Request** dan pantau status approval secara transparan di dashboard E-Form.

---

## Bab 6: Reservasi Ruangan & Jadwal Zoom Meeting

Melalui menu **Zoom Calendar** (\`/client/zoom-calendar\`), Anda dapat melihat ketersediaan jadwal meeting dan melakukan reservasi akun Zoom premium milik kantor secara tertib.

![11. Kalender Zoom Booking|Tampilan Kalender Jadwal Meeting & Akun Zoom](/uploads/kb/11_zoom_calendar.png){align=center size=100}

### Step 6: Cara Melakukan Booking Zoom
1. Pilih tanggal dan slot jam meeting yang masih kosong (*tersedia*).
2. Masukkan topik / judul rapat beserta estimasi jumlah peserta.
3. Sistem akan otomatis memverifikasi ketersediaan dan membuatkan link meeting Zoom yang dapat Anda bagikan ke peserta rapat.

---

## Bab 7: Pusat Bantuan & Solusi Mandiri (Knowledge Base)

Sebelum membuat tiket, Anda disarankan memeriksa menu **Help Center / Knowledge Base** (\`/client/kb\`).

![12. Knowledge Base & Pusat Panduan Mandiri|Pencarian Solusi Cepat Tanpa Menunggu Teknisi](/uploads/kb/12_knowledge_base.png){align=center size=100}

### Keuntungan Memanfaatkan Knowledge Base:
- **Pencarian Cepat**: Cukup ketikkan kata kunci kendala Anda (contoh: *Outlook*, *VPN*, *Password Reset*, *WiFi*).
- **Panduan Terstruktur**: Setiap artikel disusun langkah demi langkah lengkap dengan screenshot dan checklist interaktif.
- **Tersedia 24/7**: Solusi dapat diterapkan langsung kapan saja tanpa harus menunggu antrean penanganan teknisi.

---

## Ringkasan Tips Penggunaan iDesk

1. **Selalu sertakan detail jelas dan screenshot** pada tiket agar tim IT dapat langsung mengidentifikasi akar permasalahan tanpa banyak tanya balik.
2. **Pantau notifikasi di sudut kanan atas** (ikon lonceng dan badge pesan) untuk pembaruan status tiket Anda.
3. **Berikan konfirmasi / ulasan** setelah kendala dinyatakan selesai oleh teknisi untuk membantu peningkatan kualitas layanan IT Support.
`.trim();

async function seedUserGuide() {
    try {
        console.log('Connecting to database...');
        await AppDataSource.initialize();
        console.log('Database connected successfully.');

        // Check if article already exists
        const existing = await AppDataSource.query(
            'SELECT id FROM articles WHERE title = $1',
            [ARTICLE_TITLE]
        );

        if (existing && existing.length > 0) {
            console.log('Updating existing article:', existing[0].id);
            await AppDataSource.query(
                `UPDATE articles SET 
                    content = $1, 
                    category = $2, 
                    tags = $3, 
                    images = $4,
                    status = 'published', 
                    visibility = 'public', 
                    "updatedAt" = NOW()
                 WHERE id = $5`,
                [
                    ARTICLE_CONTENT,
                    ARTICLE_CATEGORY,
                    ARTICLE_TAGS.join(','),
                    JSON.stringify(ARTICLE_IMAGES),
                    existing[0].id,
                ]
            );
            console.log('Article updated successfully with ID:', existing[0].id);
        } else {
            console.log('Inserting new article...');
            const insertResult = await AppDataSource.query(
                `INSERT INTO articles (
                    id, title, content, category, tags, images, status, visibility, "viewCount", "helpfulCount", "authorName", "createdAt", "updatedAt"
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, 'published', 'public', 1, 0, 'IT Santos Helpdesk', NOW(), NOW()
                ) RETURNING id`,
                [
                    ARTICLE_TITLE,
                    ARTICLE_CONTENT,
                    ARTICLE_CATEGORY,
                    ARTICLE_TAGS.join(','),
                    JSON.stringify(ARTICLE_IMAGES),
                ]
            );
            console.log('Article inserted successfully with ID:', insertResult[0].id);
        }

        await AppDataSource.destroy();
        console.log('Seed completed.');
    } catch (err) {
        console.error('Error seeding article:', err);
    }
}

seedUserGuide();
