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
            title: 'Panduan Instalasi & Penggunaan WatchGuard Mobile VPN with SSL (WG SSL)',
            content: `## Tentang WatchGuard SSL VPN (WG SSL)
WatchGuard Mobile VPN with SSL (WG SSL) digunakan oleh seluruh karyawan untuk mengakses jaringan internal kantor, file server, database Oracle, dan aplikasi internal secara aman saat bekerja dari luar kantor (WFH / Remote).

## Persyaratan
- Laptop/PC dengan sistem operasi Windows 10/11 atau macOS
- Koneksi internet publik yang stabil
- Akun domain Windows/Active Directory yang aktif
- File installer WatchGuard SSL VPN Client

## Langkah Unduh & Instalasi

### Step 1: Unduh Installer WatchGuard SSL VPN
1. Buka browser dan akses portal SSL VPN Firebox kantor:
\`\`\`
https://vpn.perusahaan.com/sslvpn.html
\`\`\`
*(Atau gunakan installer yang telah disediakan di folder Shared IT)*
2. Login menggunakan username dan password domain Anda.
3. Klik tombol **Download** untuk mengunduh file installer \`MobileVPN_with_SSL.exe\`.

### Step 2: Instalasi Client di Windows
1. Klik kanan pada file installer \`MobileVPN_with_SSL.exe\` → Pilih **Run as administrator**
2. Ikuti instruksi wizard instalasi: Klik **Next** → Setujui License Agreement → **Next** → **Install**
3. Izinkan instalasi driver **TAP-Windows Adapter V9** jika muncul notifikasi dari Windows Security.
4. Klik **Finish** setelah instalasi selesai.

## Langkah Menghubungkan VPN (Koneksi)

### Step 1: Buka WatchGuard Mobile VPN with SSL
1. Cari dan buka aplikasi **WatchGuard Mobile VPN with SSL** dari Start Menu.
2. Pada jendela login WatchGuard, masukkan konfigurasi berikut:
   - **Server**: \`vpn.perusahaan.com\` *(atau IP Publik Firebox kantor)*
   - **User Name**: username domain Anda (contoh: \`budi.santoso\`)
   - **Password**: password akun Windows/Domain Anda
3. Klik tombol **Connect**.

### Step 2: Periksa Indikator Status (Traffic Light)
Perhatikan ikon WatchGuard pada System Tray di pojok kanan bawah taskbar Windows:
- 🔴 **Merah**: VPN terputus (*Disconnected*).
- 🟡 **Kuning**: Sedang melakukan autentikasi / inisialisasi koneksi (*Connecting*).
- 🟢 **Hijau**: Berhasil terhubung (*Connected*). Anda sudah dapat mengakses jaringan kantor.

## Verifikasi Akses Internal
Setelah ikon berubah menjadi hijau, lakukan tes koneksi ke resource internal:
1. Akses File Server: Buka File Explorer dan ketik \`\\\\10.10.1.5\\SharedDepartment\`
2. Akses Web Intranet / Oracle / Dashboard iDesk internal.

## Troubleshooting Kendala Umum WG SSL

### 1. Error: "Virtual Adapter Failure" atau Status Kuning Macet
**Penyebab:** Driver TAP Adapter dinonaktifkan oleh Windows atau bentrok dengan VPN lain.
**Solusi:**
1. Buka Run (\`Win + R\`) → ketik \`ncpa.cpl\` → Enter.
2. Cari adapter bernama **WatchGuard SSL VPN** atau **TAP-Windows Adapter V9**.
3. Jika statusnya *Disabled*, klik kanan lalu pilih **Enable**.
4. Restart aplikasi WatchGuard SSL VPN dengan klik kanan → **Run as administrator**.

### 2. Error: "Authentication Failed"
- Pastikan penulisan username dan password tidak ada spasi tambahan.
- Pastikan Caps Lock tidak aktif.
- Jika password baru saja diubah di Office 365 / Windows, gunakan password baru tersebut.

### 3. Koneksi Terputus Tiba-tiba
- WatchGuard memiliki fitur *idle timeout*. Jika tidak ada aktivitas jaringan dalam waktu tertentu, VPN akan otomatis disconnect.
- Cukup klik kanan ikon WatchGuard di system tray → Pilih **Connect** kembali.`,
            category: 'Network',
            tags: ['vpn', 'wg-ssl', 'watchguard', 'remote', 'network', 'wfh'],
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
        {
            title: 'Panduan Akses Folder Shared Network Drive (File Server)',
            content: `## Gejala & Kebutuhan
Karyawan perlu mengakses dokumen bersama departemen di server lokal (Shared Drive / Map Network Drive), namun muncul error "Network path was not found" atau folder tidak muncul di File Explorer.

## Langkah Mapping Network Drive

### Step 1: Pastikan Terhubung ke Jaringan Kantor
- Jika di kantor: Pastikan terhubung ke kabel LAN atau WiFi kantor.
- Jika WFH / Remote: Pastikan **VPN GlobalProtect** sudah dalam status "Connected".

### Step 2: Buka This PC dan Map Network Drive
1. Buka File Explorer (tekan tombol Windows + E)
2. Klik kanan pada "This PC" di panel sebelah kiri → Pilih **Map network drive...**
3. Pilih Drive Letter (misal: Z: atau Y:)
4. Pada kolom **Folder**, ketik alamat server departemen Anda:
\`\`\`
\\\\10.10.1.5\\SharedDepartment
\`\`\`
*(Ganti IP / nama folder sesuai instruksi tim IT)*
5. Centang opsi "Reconnect at sign-in"
6. Klik **Finish**

### Step 3: Masukkan Kredensial Domain
1. Saat diminta username & password, gunakan format: \`DOMAIN\\username\`
2. Masukkan password akun Windows Anda
3. Centang "Remember my credentials" → Klik OK

## Solusi Error Umum
- **Error: "The network location cannot be reached"**: Cek status koneksi LAN/VPN Anda.
- **Error: "Access Denied"**: Anda belum memiliki izin akses ke folder tersebut. Silakan buat form pengajuan E-Form Access di iDesk.`,
            category: 'Network',
            tags: ['shared-drive', 'network', 'file-server', 'mapping', 'folder'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Cara Mengatasi Outlook Error Not Responding atau Tidak Bisa Kirim Email',
            content: `## Gejala
- Microsoft Outlook macet (*Not Responding*) saat dibuka
- Email tertahan di Outbox dan tidak terkirim
- Muncul peringatan "Mailbox is full" atau "Enter Network Password" berulang kali

## Solusi Cepat

### Step 1: Buka Outlook dalam Safe Mode
1. Tekan tombol \`Windows + R\` pada keyboard untuk membuka dialog Run
2. Ketik perintah berikut dan tekan Enter:
\`\`\`
outlook.exe /safe
\`\`\`
3. Pilih profile default (Outlook) dan klik OK.
4. Jika Outlook terbuka normal dalam safe mode, masalah disebabkan oleh add-in pihak ketiga yang bermasalah.

### Step 2: Disable Add-in yang Tidak Perlu
1. Buka menu **File** → **Options** → **Add-ins**
2. Pada bagian bawah (Manage), pilih **COM Add-ins** lalu klik **Go...**
3. Hapus centang pada add-in yang tidak dipakai (misal antivirus scanner add-in atau third-party toolbar)
4. Klik OK lalu restart Outlook secara normal.

### Step 3: Cek Ukuran Email di Outbox
Email dengan lampiran file besar (>25MB) seringkali menyebabkan Outbox macet:
1. Putuskan sementara koneksi internet (set Outlook ke *Work Offline* di tab Send/Receive)
2. Buka folder **Outbox**, hapus atau pindahkan email berlampiran besar ke Drafts
3. Matikan *Work Offline* dan klik **Send/Receive All Folders**.

## Tips Pemeliharaan
- Bersihkan folder *Deleted Items* dan *Junk Email* secara berkala.
- Arsipkan email lama ke arsip online / file PST jika kapasitas mailbox hampir penuh.`,
            category: 'Software',
            tags: ['outlook', 'email', 'office', 'software', 'troubleshooting'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Mengaktifkan Multi-Factor Authentication (MFA) Microsoft Authenticator',
            content: `## Pendahuluan
Multi-Factor Authentication (MFA) adalah lapisan keamanan wajib untuk melindungi akun email dan data perusahaan dari peretasan dan kebocoran data.

## Langkah Aktivasi

### Step 1: Unduh Aplikasi Microsoft Authenticator
1. Unduh aplikasi **Microsoft Authenticator** resmi dari Google Play Store (Android) atau Apple App Store (iOS) pada smartphone Anda.

### Step 2: Konfigurasi Akun di Komputer
1. Buka browser dan kunjungi: \`https://aka.ms/mfasetup\`
2. Login menggunakan email dan password kantor Anda
3. Pada halaman "More information required", klik **Next**
4. Pilih metode **Authenticator app** → Klik **Next**
5. Pada layar komputer akan muncul QR Code setup.

### Step 3: Pindai QR Code di Smartphone
1. Buka aplikasi Microsoft Authenticator di smartphone
2. Pilih tanda **+ (Tambah Akun)** → Pilih **Work or school account**
3. Pilih **Scan QR code** dan arahkan kamera ke layar monitor komputer
4. Masukkan nomor verifikasi 2-digit yang muncul di layar komputer ke aplikasi smartphone.

## Catatan Penting
- Jangan pernah menyetujui prompt verifikasi di handphone jika Anda sedang tidak melakukan login.
- Jika Anda mengganti handphone, segera hubungi IT Support untuk reset konfigurasi MFA akun Anda.`,
            category: 'Security',
            tags: ['mfa', 'security', 'authenticator', 'password', 'login'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Pengajuan Perangkat Kerja dan Hak Akses Sistem (E-Form)',
            content: `## Kapan Menggunakan Layanan Ini?
Gunakan menu **Request Center** di iDesk jika Anda membutuhkan:
1. Penggantian/peminjaman laptop, monitor, keyboard, atau mouse (**Hardware Requests**)
2. Permintaan hak akses akun baru, folder server, atau VPN (**E-Form Access**)
3. Pelaporan barang hilang atau penemuan barang di area kantor (**Lost & Found**)

## Alur Pengajuan

### 1. Hardware Request
1. Masuk ke menu **Request Center → Hardware Requests**
2. Klik tombol **+ New Request**
3. Pilih kategori barang dan masukkan justifikasi kebutuhan kerja Anda
4. Kirim pengajuan untuk diproses dan dijadwalkan oleh tim IT Hardware.

### 2. E-Form Hak Akses Sistem
1. Masuk ke menu **Request Center → E-Form Access**
2. Pilih jenis akses (contoh: Akses VPN, Shared Folder, Email Domain, atau Software)
3. Isi data pengaju dan atasan langsung
4. Lakukan tanda tangan digital langsung pada layar
5. Tiket akan diverifikasi oleh Atasan dan Admin IT sebelum kredensial diserahkan.

## Estimasi Waktu Proses (SLA)
| Jenis Pengajuan | Estimasi Waktu Kerja |
|-----------------|----------------------|
| Reset Password / Akses Standar | 1 - 2 Jam Kerja |
| Pengajuan Akses Folder / VPN | 1x24 Jam Kerja |`,
            category: 'General',
            tags: ['eform', 'access', 'guidelines', 'idesk'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'IT Support Team',
        },
        {
            title: 'Panduan Lengkap Penggunaan Portal User iDesk Enterprise',
            content: `## Selamat Datang di iDesk Enterprise Platform
Portal Layanan Mandiri iDesk Enterprise dirancang untuk mempermudah seluruh karyawan (**Role: USER / Client**) dalam mengajukan bantuan IT, memesan ruang Zoom meeting, mengajukan E-Form akses sistem, hingga memanfaatkan solusi mandiri troubleshooting secara cepat dan terintegrasi.

---

## 1. Akses & Login Sistem

Untuk mengakses portal iDesk, buka browser Anda dan kunjungi URL resmi sistem:
- **URL Resmi Portal**: \`https://idesk.santos.co.id/login\`

![Halaman Login Portal iDesk](/kb/user-guide/01_login_page.png)

### 📌 Langkah Login:
1. Masukkan **NIK Karyawan** atau **Email Perusahaan** terdaftar (Contoh: \`user.spj@idesk.com\`).
2. Masukkan **Kata Sandi** akun Anda.
3. Tekan tombol **\`Continue\`** atau tekan tombol keyboard **\`Enter\`** untuk langsung masuk.

---

## 2. Dashboard Tiket Saya (My Tickets)

Setelah berhasil masuk, Anda akan diarahkan ke halaman utama **My Tickets (\`/client/my-tickets\`)** yang berfungsi sebagai dashboard pemantauan tiket layanan Anda.

![Dashboard Tiket Saya](/kb/user-guide/02_my_tickets.png)

### 📊 Fitur Utama Dashboard:
1. **Bento Stat Cards**: Menampilkan ringkasan jumlah tiket berstatus *Open* (Menunggu), *In Progress* (Diproses), dan *Resolved* (Selesai).
2. **Kotak Pencarian & Filter**: Mempermudah pelacakan tiket berdasarkan kata kunci, judul permohonan, maupun status penanganan.
3. **Daftar Tiket Interaktif**: Klik pada salah satu baris tiket untuk membuka ruang percakapan (*chat*), melacak histori penanganan, dan memantau status SLA teknisi.

---

## 3. Pembuatan Tiket Layanan & Bantuan

Untuk membuat tiket baru, klik tombol **\`+ Buat Tiket Baru\`** pada sudut kanan atas dashboard. Anda akan diarahkan ke halaman pemilihan kategori permohonan (**\`/client/create\`**).

![Pilihan Kategori Pembuatan Tiket](/kb/user-guide/03_create_ticket_selection.png)

### 3.1 Pilihan Divisi Layanan:
1. 🎫 **Service Ticket (General Support)**: Layanan IT kantor umum, mencakup permasalahan komputer, laptop, software standar, printer, email, dan jaringan lokal.
2. 🌐 **Access Request (E-Form Access)**: Permohonan izin akses akun VPN, jaringan khusus, atau sistem kerja terproteksi.
3. 📦 **Oracle / K2 Request (Enterprise System)**: Bantuan modul sistem ERP Oracle EBS, update peran (*role*) K2 Workflow, maupun kendala validasi data bisnis.
4. 💻 **Web Developer Request**: Permintaan perbaikan bug, penambahan fitur, atau integrasi pada portal web internal perusahaan.
5. 📱 **Mobile Developer Request**: Laporan kendala aplikasi mobile Android/iOS, error sinkronisasi data lapangan, atau update versi APK.

---

### 3.2 Formulir Tiket IT Support Umum
Jika Anda memilih kartu **Service Ticket**, Anda akan diarahkan ke formulir pembuatan tiket IT Support (**\`/client/create?type=service\`**).

![Formulir Tiket IT Support](/kb/user-guide/04_create_it_support_form.png)

### 📌 Panduan Pengisian:
1. **Template Cepat (*Quick Template*)**: Gunakan tombol template (\`Email Issue\`, \`Printer Fault\`, \`Slow System\`, \`No Network\`, \`Software Error\`, \`Login Issue\`) untuk pengisian otomatis.
2. **Subject / Judul Tiket (Wajib)**: Tuliskan ringkasan kendala dengan jelas (misal: *"Komputer tidak bisa terhubung ke printer lantai 2"*).
3. **Detail Masalah (Wajib)**: Jelaskan kronologi kejadian dan pesan error yang muncul.
4. **Lampiran Berkas**: Klik tombol **\`Lampirkan\`** atau tekan kombinasi **\`Ctrl + V\`** untuk menempelkan tangkapan layar (*screenshot*) error secara langsung.
5. **Prioritas & Perangkat**: Tentukan urgensi kendala (*Low*, *Medium*, *High*, *Critical*) serta spesifikasi perangkat terkait.
6. **Kirim Tiket**: Tekan tombol **\`KIRIM SERVICE TIKET\`** untuk mengirim permohonan ke antrean teknisi.

---

### 3.3 Formulir Tiket Oracle K2, Web, & Mobile Dev
Untuk kebutuhan sistem perusahaan atau pengembangan perangkat lunak, pilih formulir khusus pengembang (**\`/client/create?type=oracle-request\`**).

![Formulir Dev & Enterprise Request](/kb/user-guide/05_create_dev_ticket_form.png)

- **Template Khusus**: Dilengkapi template siap pakai seperti \`Login Issue\`, \`Role Update\`, \`System Error\`, dan \`Sync Error\`.
- **Pintasan Keyboard Cepat**: Tekan kombinasi tombol **\`Ctrl + Enter\`** pada keyboard untuk mengirim tiket langsung tanpa mouse.

---

## 4. Pelacakan Tiket, Chat Interaktif, & Rating Kepuasan

Setelah tiket terkirim, Anda dapat berkomunikasi langsung dengan teknisi pada halaman **Ticket Detail (\`/client/tickets/:id\`)**.

![Detail Tiket & Ruang Chat](/kb/user-guide/06_ticket_detail_chat_rating.png)

### 🌟 Fitur Halaman Detail Tiket:
1. **SLA Countdown Timer**: Memantau batas waktu respon pertama (*First Response SLA*) dan estimasi penyelesaian (*Resolution SLA*).
2. **Ruang Chat Real-Time**: Kirim pesan klarifikasi, tanyakan status perbaikan, atau lampirkan foto/file tambahan.
3. **Kolaborator Tim**: Tambahkan rekan kerja divisi Anda menggunakan tombol \`+ Tambah\` agar dapat ikut memantau tiket.
4. **Rating Kepuasan (1-5 Bintang)**: Berikan umpan balik dan penilaian bintang saat tiket telah berstatus *Resolved*.

---

## 5. Pemesanan Ruang Meeting Zoom (Zoom Calendar)

Portal iDesk menyediakan integrasi jadwal meeting virtual melalui menu **Zoom Calendar (\`/client/zoom-calendar\`)**.

![Tata Letak Pemesanan Ruang Zoom](/kb/user-guide/07_zoom_booking_calendar.png)

### 📌 Prosedur 5 Langkah Pemesanan Ruang Zoom:
1. **Isi Topik / Judul Meeting**: Masukkan agenda meeting pada kolom *Judul meeting*.
2. **Tentukan Tanggal & Jam Mulai**: Pilih hari pelaksanaan dan dropdown waktu mulai (contoh: \`09:00\`).
3. **Pilih Durasi Meeting**: Tentukan estimasi durasi (misal: \`60 menit (1 jam)\`). Sistem akan menampilkan rentang ketersediaan waktu.
4. **Aktifkan Opsi Berulang / Recurring (Jika Rutin)**: Aktifkan sakelar toggle *Berulang?* jika meeting diadakan mingguan/bulanan.
5. **Klik "Buat meeting 🎥"**: Sistem iDesk akan otomatis mengalokasikan akun lisensi Zoom resmi dan menghasilkan tautan meeting (*Join URL*), *Meeting ID*, serta *Passcode*.

---

### 💡 Simulasi Formulir Pemesanan & Opsi Berulang (Recurring)

Berikut adalah contoh simulasi formulir pemesanan Zoom yang telah diisi lengkap dengan opsi jadwal berulang aktif serta sinkronisasi daftar meeting:

![Simulasi Formulir Zoom Terisi Lengkap](/kb/user-guide/07b_zoom_booking_simulated.png)

- **Sinkronisasi Otomatis**: Daftar jadwal meeting Anda di panel kanan akan langsung terupdate pada tab *Mendatang*, *Semua*, atau *Selesai*.

---

## 6. Pengajuan E-Form Akses Jaringan & Sistem

Permintaan izin akses khusus dikelola melalui portal **E-Form Access (\`/client/eform-access\`)**.

### 6.1 Memantau Status Pengajuan E-Form
![Daftar E-Form Access](/kb/user-guide/08_eform_access_list.png)

- Pantau ringkasan status formulir: *Menunggu Atasan*, *Diproses ICT*, *Akses Siap*, maupun *Ditolak*.
- Tekan tombol **\`+ Ajukan Akses\`** untuk membuat permohonan baru.

---

### 6.2 Formulir Pengajuan Akses Baru
Halaman pengajuan akses baru (**\`/client/eform-access/new\`**) memiliki alur validasi formulir terstruktur.

![Formulir Pengajuan E-Form Akses Baru](/kb/user-guide/09_eform_access_new.png)

1. **Pilih Jenis Akses**: *Akses VPN*, *Akses Website*, atau *Akses Jaringan*.
2. **Masa Berlaku**: Tentukan periode izin akses (\`+1 Bln\`, \`+3 Bln\`, \`+6 Bln\`, \`+12 Bln\`).
3. **Alasan & Kebutuhan**: Uraikan justifikasi operasional pekerjaan.
4. **Approval Otomatis**: Permohonan akan otomatis diteruskan secara berjenjang ke email Head of Department (HOD) Anda.

---

## 7. Pusat Bantuan & Solusi Mandiri (Knowledge Base)

Gunakan portal **Knowledge Base (\`/client/kb\`)** untuk menemukan panduan penanganan mandiri (*Self-Resolution*).

![Pusat Bantuan Knowledge Base](/kb/user-guide/10_client_knowledge_base.png)

- Cari artikel berdasarkan kata kunci (\`wifi\`, \`vpn\`, \`printer\`, \`outlook\`, \`password\`, \`teams\`).
- Manfaatkan filter kategori dan tag populer untuk menemukan solusi instan.

---

## 8. Notifikasi & Pengaturan Profil Pengguna

Kelola data akun dan saluran notifikasi Anda pada menu **Profile (\`/client/profile\`)**.

![Pengaturan Profil Pengguna](/kb/user-guide/11_notification_and_profile.png)

1. **Tab Profile**: Periksa data kepegawaian dan perbarui nomor WhatsApp aktif.
2. **Tab Password**: Ubah kata sandi login secara berkala.
3. **Tab Telegram**: Hubungkan iDesk Bot untuk menerima update tiket instan di ponsel pintar.
4. **Tema Tampilan**: Ubah tema antarmuka antara **Light Mode** dan **Dark Mode** via tombol toggle di kanan atas.`,
            category: 'General',
            tags: ['user-guide', 'panduan', 'tutorial', 'portal', 'idesk', 'client'],
            status: ArticleStatus.PUBLISHED,
            visibility: ArticleVisibility.PUBLIC,
            authorName: 'iDesk Administrator',
        },
    ];

    // Delete obsolete old VPN article if present
    await articleRepo.delete({ title: 'Panduan Instalasi VPN untuk Remote Working' });

    for (const articleData of articles) {
        const existing = await articleRepo.findOne({ where: { title: articleData.title } });
        if (!existing) {
            const article = articleRepo.create(articleData);
            await articleRepo.save(article);
            console.log(`✅ Created article: ${articleData.title}`);
        } else {
            Object.assign(existing, articleData);
            await articleRepo.save(existing);
            console.log(`🔄 Updated article: ${articleData.title}`);
        }
    }

    console.log('\n🎉 KB Articles seeding completed!');
};
