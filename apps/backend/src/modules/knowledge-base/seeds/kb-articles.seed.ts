import { DataSource } from 'typeorm';
import { Article, ArticleStatus, ArticleVisibility } from '../entities/article.entity';

export const seedKBArticles = async (dataSource: DataSource) => {
    const articleRepo = dataSource.getRepository(Article);

    const articles = [
        {
            title: 'Cara Mengatasi Komputer Tidak Bisa Connect ke Jaringan WiFi',
            content: `## Gejala
Komputer atau laptop tidak dapat terhubung ke jaringan WiFi kantor, muncul pesan "Can't connect to this network" atau "Limited connectivity".

## Penyebab Umum
1. Driver WiFi adapter yang outdated
2. Konfigurasi IP yang salah
3. WiFi adapter yang disabled
4. Masalah pada router atau access point

## Langkah Perbaikan

### Step 1: Restart WiFi Adapter
1. Klik kanan pada ikon Network di system tray
2. Pilih "Open Network & Internet settings"
3. Klik "Change adapter options"
4. Klik kanan pada WiFi adapter → Disable
5. Tunggu 10 detik, lalu klik kanan → Enable

### Step 2: Forget dan Reconnect Network
1. Buka Settings → Network & Internet → WiFi
2. Klik "Manage known networks"
3. Pilih jaringan yang bermasalah → Forget
4. Scan ulang dan connect kembali dengan password yang benar

### Step 3: Reset Network Settings
Jika masih bermasalah, jalankan command berikut di Command Prompt (Run as Administrator):
\`\`\`
netsh winsock reset
netsh int ip reset
ipconfig /release
ipconfig /renew
ipconfig /flushdns
\`\`\`
Restart komputer setelah menjalankan command di atas.

### Step 4: Update Driver WiFi
1. Buka Device Manager
2. Expand "Network adapters"
3. Klik kanan pada WiFi adapter → Update driver
4. Pilih "Search automatically for drivers"

## Catatan
Jika semua langkah di atas tidak berhasil, kemungkinan ada masalah hardware pada WiFi adapter. Hubungi tim IT Support untuk pengecekan lebih lanjut.`,
            category: 'Network',
            tags: ['wifi', 'network', 'troubleshooting', 'connectivity'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Reset Password Email Office 365',
            content: `## Pendahuluan
Artikel ini menjelaskan cara reset password email Office 365 untuk karyawan yang lupa password atau password expired.

## Metode 1: Self-Service Password Reset

### Langkah-langkah:
1. Buka browser dan akses https://portal.office.com
2. Masukkan email perusahaan Anda
3. Klik link "Can't access your account?"
4. Pilih "Work or school account"
5. Masukkan email dan captcha
6. Pilih metode verifikasi:
   - SMS ke nomor HP terdaftar
   - Email ke email alternatif
   - Microsoft Authenticator app
7. Masukkan kode verifikasi yang diterima
8. Buat password baru (minimal 8 karakter, kombinasi huruf besar, kecil, angka, dan simbol)

## Metode 2: Reset oleh Admin IT

Jika self-service tidak tersedia:
1. Kirim email ke it-support@company.com
2. Atau buat tiket di sistem helpdesk
3. Sertakan informasi:
   - Nama lengkap
   - Email address
   - Nomor HP untuk verifikasi
4. Admin akan mereset password dan mengirimkan password sementara
5. Login dan segera ganti password sementara

## Kebijakan Password
- Minimal 8 karakter
- Harus mengandung huruf besar dan kecil
- Harus mengandung angka
- Harus mengandung karakter spesial (!@#$%^&*)
- Tidak boleh sama dengan 5 password terakhir
- Password expired setiap 90 hari

## Tips Keamanan
- Jangan share password dengan siapapun
- Gunakan password manager untuk menyimpan password
- Aktifkan Multi-Factor Authentication (MFA)
- Logout dari perangkat yang tidak digunakan`,
            category: 'Email',
            tags: ['password', 'office365', 'email', 'reset', 'security'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Cara Mengatasi Printer Tidak Terdeteksi',
            content: `## Masalah
Printer tidak muncul di daftar printer atau tidak bisa print dengan pesan error "Printer not found" atau "Printer offline".

## Checklist Awal
- [ ] Pastikan printer dalam keadaan ON
- [ ] Cek kabel USB/network cable terpasang dengan benar
- [ ] Pastikan printer dan komputer berada di jaringan yang sama (untuk network printer)
- [ ] Cek apakah ada paper jam atau error pada printer

## Solusi untuk Printer USB

### Step 1: Cek USB Connection
1. Cabut kabel USB dari printer dan komputer
2. Tunggu 30 detik
3. Pasang kembali ke port USB yang berbeda
4. Tunggu Windows mendeteksi printer

### Step 2: Reinstall Printer Driver
1. Buka Settings → Devices → Printers & scanners
2. Pilih printer yang bermasalah → Remove device
3. Klik "Add a printer or scanner"
4. Tunggu Windows mencari printer
5. Jika tidak ditemukan, klik "The printer that I want isn't listed"
6. Pilih "Add a local printer or network printer with manual settings"

## Solusi untuk Network Printer

### Step 1: Cek Koneksi Jaringan
1. Pastikan bisa ping IP address printer
   \`\`\`
   ping 192.168.1.100
   \`\`\`
2. Jika tidak reply, cek kabel network dan konfigurasi IP printer

### Step 2: Add Printer by IP Address
1. Buka Settings → Devices → Printers & scanners
2. Klik "Add a printer or scanner"
3. Klik "The printer that I want isn't listed"
4. Pilih "Add a printer using TCP/IP address"
5. Masukkan IP address printer
6. Pilih driver yang sesuai

### Step 3: Restart Print Spooler Service
Jalankan di Command Prompt (Admin):
\`\`\`
net stop spooler
del /Q /F /S "%systemroot%\\System32\\spool\\PRINTERS\\*.*"
net start spooler
\`\`\`

## Daftar IP Printer Kantor
| Lokasi | Model | IP Address |
|--------|-------|------------|
| Lantai 1 - Lobby | HP LaserJet Pro M404 | 192.168.1.101 |
| Lantai 2 - Finance | Canon iR-ADV C3525 | 192.168.1.102 |
| Lantai 3 - HR | Epson L6190 | 192.168.1.103 |
| Lantai 4 - IT | HP Color LaserJet Pro M454 | 192.168.1.104 |

## Kontak Support
Jika masalah belum teratasi, hubungi IT Support ext. 1234 atau buat tiket di helpdesk.`,
            category: 'Hardware',
            tags: ['printer', 'hardware', 'troubleshooting', 'driver'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Instalasi VPN untuk Remote Working',
            content: `## Tentang VPN Perusahaan
VPN (Virtual Private Network) digunakan untuk mengakses jaringan internal perusahaan secara aman saat bekerja dari luar kantor.

## Persyaratan
- Windows 10/11 atau macOS 10.14+
- Koneksi internet yang stabil
- Akun VPN dari IT Department
- Microsoft Authenticator app terinstall di smartphone

## Download VPN Client

### Windows
1. Download GlobalProtect dari: https://vpn.company.com
2. Atau hubungi IT Support untuk installer

### macOS
1. Download dari App Store: "GlobalProtect"
2. Atau download dari portal VPN

## Langkah Instalasi

### Windows
1. Jalankan installer GlobalProtect
2. Klik Next → Next → Install
3. Tunggu proses instalasi selesai
4. Klik Finish

### macOS
1. Buka file .pkg yang didownload
2. Ikuti wizard instalasi
3. Berikan permission yang diminta
4. Restart jika diperlukan

## Cara Koneksi VPN

1. Buka aplikasi GlobalProtect
2. Masukkan Portal Address: **vpn.company.com**
3. Klik Connect
4. Masukkan credentials:
   - Username: email perusahaan (tanpa @company.com)
   - Password: password email Anda
5. Buka Microsoft Authenticator di HP
6. Approve notifikasi yang muncul
7. Tunggu hingga status "Connected"

## Verifikasi Koneksi
Setelah connected, coba akses:
- Intranet: http://intranet.company.local
- File Server: \\\\fileserver\\shared

## Troubleshooting

### "Connection Failed"
1. Pastikan internet aktif
2. Coba disconnect dan connect ulang
3. Restart aplikasi GlobalProtect
4. Restart komputer

### "Authentication Failed"
1. Pastikan username dan password benar
2. Cek apakah password email expired
3. Pastikan Microsoft Authenticator sudah setup dengan benar

### Koneksi Lambat
1. Coba disconnect dan pilih server terdekat
2. Hindari aktivitas bandwidth tinggi (streaming, download besar)
3. Gunakan koneksi internet yang lebih stabil

## Kebijakan Penggunaan VPN
- Gunakan hanya untuk keperluan kerja
- Jangan share credentials VPN
- Disconnect saat tidak digunakan
- Laporkan jika ada aktivitas mencurigakan`,
            category: 'Network',
            tags: ['vpn', 'remote', 'security', 'network', 'work-from-home'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Cara Backup Data ke OneDrive',
            content: `## Mengapa Backup Penting?
Backup data secara rutin melindungi file penting Anda dari:
- Kerusakan hardware (harddisk rusak)
- Serangan ransomware/virus
- Kehilangan atau pencurian laptop
- Kesalahan penghapusan file

## OneDrive untuk Business
Setiap karyawan mendapat 1TB storage OneDrive yang terintegrasi dengan akun Office 365.

## Setup OneDrive di Windows

### Step 1: Sign In
1. Klik ikon OneDrive di system tray (awan biru)
2. Jika belum login, masukkan email perusahaan
3. Masukkan password dan approve MFA

### Step 2: Pilih Folder untuk Sync
1. Klik ikon OneDrive → Settings
2. Tab "Backup" → Manage backup
3. Pilih folder yang ingin di-backup:
   - ✅ Desktop
   - ✅ Documents
   - ✅ Pictures
4. Klik "Start backup"

### Step 3: Verifikasi Sync
1. Buka File Explorer
2. Lihat folder OneDrive di sidebar
3. File dengan ✅ hijau = sudah tersync
4. File dengan 🔄 = sedang sync
5. File dengan ❌ = error, perlu dicek

## Cara Manual Upload

1. Buka File Explorer
2. Drag & drop file ke folder OneDrive
3. Atau klik kanan file → Send to → OneDrive

## Akses File dari Browser

1. Buka https://onedrive.com
2. Login dengan akun Office 365
3. Akses semua file yang sudah di-sync

## Restore File yang Terhapus

1. Buka OneDrive di browser
2. Klik "Recycle bin" di sidebar
3. Pilih file yang ingin di-restore
4. Klik "Restore"

Note: File di Recycle bin akan dihapus permanen setelah 93 hari.

## Tips Backup

### Do's ✅
- Backup file penting secara rutin
- Buat folder terstruktur
- Gunakan nama file yang jelas
- Cek status sync secara berkala

### Don'ts ❌
- Jangan simpan file terlalu besar (>10GB per file)
- Jangan backup file software/installer
- Jangan simpan data sensitif tanpa enkripsi
- Jangan share folder berisi data confidential

## Quota dan Limit
- Storage: 1TB per user
- Max file size: 250GB
- Max path length: 400 characters
- Restricted characters: \\ / : * ? " < > |

## Butuh Bantuan?
Hubungi IT Support jika:
- OneDrive tidak bisa sync
- Storage penuh
- Perlu restore file lebih dari 93 hari`,
            category: 'Software',
            tags: ['backup', 'onedrive', 'cloud', 'data-protection', 'office365'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Keamanan: Mengenali Email Phishing',
            content: `## Apa itu Phishing?
Phishing adalah serangan cyber dimana pelaku mengirim email palsu yang menyamar sebagai organisasi terpercaya untuk mencuri data sensitif seperti password, kartu kredit, atau informasi pribadi.

## Ciri-ciri Email Phishing

### 1. Alamat Pengirim Mencurigakan
❌ support@micros0ft.com (angka 0 bukan huruf o)
❌ admin@company.com.malicious.com
✅ support@microsoft.com

### 2. Subject yang Mendesak
- "URGENT: Your account will be suspended!"
- "Action Required: Verify your identity NOW"
- "You've won $1,000,000!"

### 3. Link yang Mencurigakan
Hover mouse di atas link (jangan klik!) untuk melihat URL sebenarnya:
❌ https://microsoft-login.malicious.com/verify
✅ https://login.microsoftonline.com

### 4. Attachment Berbahaya
Waspada dengan attachment:
- .exe, .bat, .cmd, .scr
- .zip atau .rar yang tidak diharapkan
- .doc/.xls yang minta enable macro

### 5. Grammar dan Typo
Email resmi jarang memiliki kesalahan grammar yang banyak.

## Contoh Email Phishing

\`\`\`
From: IT-Support@c0mpany.com
Subject: URGENT: Password Expired!!!

Dear User,

Your password will be expired in 24 hour. 
Click here to verify your account: [Verify Now]

If you not verify, your account will be DELETED!

Best Regard,
IT Support Team
\`\`\`

**Red flags:**
- Alamat pengirim salah (c0mpany bukan company)
- Grammar buruk ("will be expired", "24 hour")
- Ancaman mendesak
- Link mencurigakan

## Apa yang Harus Dilakukan?

### Jika Menerima Email Mencurigakan:
1. ❌ JANGAN klik link apapun
2. ❌ JANGAN download attachment
3. ❌ JANGAN reply dengan informasi pribadi
4. ✅ Laporkan ke IT Security: security@company.com
5. ✅ Forward email sebagai attachment
6. ✅ Delete email dari inbox

### Jika Sudah Terlanjur Klik:
1. SEGERA ganti password akun yang bersangkutan
2. Hubungi IT Support: ext. 1234
3. Scan komputer dengan antivirus
4. Monitor akun untuk aktivitas mencurigakan

## Tips Keamanan

1. **Selalu verifikasi pengirim**
   - Cek alamat email dengan teliti
   - Jika ragu, hubungi pengirim via channel lain

2. **Gunakan Multi-Factor Authentication**
   - Aktifkan MFA untuk semua akun penting

3. **Update software secara rutin**
   - Windows Update
   - Browser terbaru
   - Antivirus up-to-date

4. **Jangan share informasi sensitif via email**
   - Password
   - Nomor kartu kredit
   - Data pribadi

## Reporting
Laporkan email phishing ke:
- Email: security@company.com
- Portal: https://security.company.com/report
- Ext: 1234 (IT Security Team)`,
            category: 'Security',
            tags: ['security', 'phishing', 'email', 'awareness', 'cyber-security'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Security Team',
        },
        {
            title: 'Cara Menggunakan Microsoft Teams untuk Meeting',
            content: `## Pendahuluan
Microsoft Teams adalah platform kolaborasi yang digunakan perusahaan untuk chat, meeting, dan berbagi file.

## Membuat Meeting Baru

### Via Calendar
1. Buka Microsoft Teams
2. Klik "Calendar" di sidebar
3. Klik "+ New meeting"
4. Isi detail meeting:
   - Title: Nama meeting
   - Attendees: Email peserta
   - Date & Time: Waktu meeting
   - Channel (opsional): Jika meeting di channel tertentu
5. Klik "Send"

### Via Chat
1. Buka chat dengan peserta
2. Klik ikon video/kamera
3. Pilih "Meet now" untuk langsung meeting
4. Atau "Schedule a meeting" untuk jadwalkan

## Join Meeting

### Dari Calendar
1. Buka Teams → Calendar
2. Klik meeting yang dijadwalkan
3. Klik "Join"

### Dari Link
1. Klik link meeting dari email/chat
2. Pilih "Open Microsoft Teams" atau "Continue on browser"
3. Klik "Join now"

## Fitur Selama Meeting

### Audio & Video
- 🎤 Mute/Unmute microphone
- 📷 Turn on/off camera
- 🔊 Speaker settings

### Screen Sharing
1. Klik ikon "Share" (kotak dengan panah)
2. Pilih yang ingin di-share:
   - Entire screen
   - Window (aplikasi tertentu)
   - PowerPoint Live
   - Whiteboard

### Chat dalam Meeting
- Klik ikon chat untuk mengirim pesan
- Gunakan untuk share link atau notes

### Participants
- Lihat daftar peserta
- Mute peserta (host only)
- Invite additional people

### Recording
1. Klik "..." (More actions)
2. Pilih "Start recording"
3. Recording akan tersimpan di OneDrive/SharePoint

## Meeting Etiquette

### Do's ✅
- Mute mic saat tidak berbicara
- Gunakan background blur jika perlu
- Tepat waktu
- Prepare materi sebelum meeting

### Don'ts ❌
- Multitasking saat meeting penting
- Interrupt pembicara
- Meeting di tempat berisik tanpa mute
- Lupa unmute saat berbicara

## Troubleshooting

### Audio Tidak Terdengar
1. Cek volume komputer
2. Cek audio settings di Teams
3. Pastikan speaker/headset terpilih dengan benar
4. Leave dan rejoin meeting

### Video Tidak Muncul
1. Cek apakah camera di-block
2. Cek privacy settings Windows
3. Restart Teams
4. Update driver webcam

### Meeting Lag/Patah-patah
1. Turn off video untuk hemat bandwidth
2. Close aplikasi lain
3. Gunakan koneksi internet yang lebih stabil
4. Kurangi jumlah tab browser

## Tips Pro
- Gunakan keyboard shortcuts:
  - Ctrl+Shift+M: Mute/unmute
  - Ctrl+Shift+O: Camera on/off
  - Ctrl+Shift+E: Screen share
- Blur background: Settings → Effects → Blur
- Virtual background: Settings → Effects → Pilih gambar`,
            category: 'Software',
            tags: ['teams', 'meeting', 'collaboration', 'microsoft', 'video-call'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Troubleshooting: Komputer Lambat / Hang',
            content: `## Gejala
- Komputer response lambat
- Aplikasi not responding
- Cursor freeze/hang
- Loading lama saat buka aplikasi

## Quick Fix

### Step 1: Restart Komputer
Langkah paling sederhana tapi sering efektif:
1. Simpan semua pekerjaan
2. Klik Start → Power → Restart
3. Tunggu komputer restart completely

### Step 2: Close Aplikasi yang Tidak Digunakan
1. Klik kanan Taskbar → Task Manager
2. Tab "Processes"
3. Sort by "Memory" atau "CPU"
4. Pilih aplikasi yang tidak digunakan → End task

## Diagnosa Lanjutan

### Cek Resource Usage
1. Buka Task Manager (Ctrl+Shift+Esc)
2. Tab "Performance"
3. Identifikasi bottleneck:
   - **CPU 100%**: Proses berat berjalan
   - **Memory 90%+**: RAM tidak cukup
   - **Disk 100%**: HDD/SSD overloaded

### Solusi Berdasarkan Masalah

#### CPU 100%
1. Cek proses yang menggunakan CPU tinggi
2. Jika browser: tutup tab yang tidak perlu
3. Jika antivirus: tunggu scan selesai
4. Jika unknown process: bisa jadi malware, laporkan ke IT

#### Memory 90%+
1. Close aplikasi berat (Chrome, Outlook, Teams)
2. Restart komputer
3. Kurangi startup programs
4. Jika sering terjadi, mungkin perlu upgrade RAM

#### Disk 100%
1. Restart komputer
2. Disable Windows Search indexing sementara
3. Cek Windows Update
4. Jika HDD, pertimbangkan upgrade ke SSD

## Optimasi Berkala

### Bersihkan Disk
1. Buka "Disk Cleanup"
2. Pilih drive C:
3. Centang semua opsi
4. Klik OK → Delete Files

### Disable Startup Programs
1. Task Manager → Tab "Startup"
2. Disable program yang tidak perlu:
   - ❌ Spotify
   - ❌ Discord
   - ❌ Adobe Creative Cloud (jika tidak dipakai)
   - ✅ Biarkan Antivirus
   - ✅ Biarkan OneDrive

### Update Windows
1. Settings → Windows Update
2. Check for updates
3. Install semua update
4. Restart jika diminta

### Scan Malware
1. Windows Security → Virus & threat protection
2. Quick scan atau Full scan
3. Hapus threats yang ditemukan

## Kapan Harus Hubungi IT?
- Masalah persist setelah semua langkah di atas
- Komputer sering crash/BSOD
- Muncul error aneh atau popup mencurigakan
- Performance drop drastis tiba-tiba
- Komputer sudah lebih dari 5 tahun

## Spesifikasi Minimum untuk Kerja
| Komponen | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Storage | 256 GB SSD | 512 GB SSD |
| Processor | Intel i5 Gen 8 | Intel i5 Gen 10+ |

Jika spesifikasi di bawah minimum, pertimbangkan request upgrade ke IT.`,
            category: 'Hardware',
            tags: ['performance', 'troubleshooting', 'slow-computer', 'optimization'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
    ];

    for (const articleData of articles) {
        const existing = await articleRepo.findOne({ where: { title: articleData.title } });
        if (!existing) {
            const article = articleRepo.create(articleData);
            await articleRepo.save(article);
            console.log(`✅ Created article: ${articleData.title}`);
        } else {
            console.log(`⏭️ Skipped (exists): ${articleData.title}`);
        }
    }

    console.log('\n🎉 KB Articles seeding completed!');
};
