# Panduan Lengkap Solusi SSL iDesk (Zero-Install di Semua HP & PC)

Dokumen ini menjelaskan penyebab masalah **`NET::ERR_CERT_AUTHORITY_INVALID`** saat membuka `https://idesk.santos.co.id` di perangkat lain / HP, serta langkah-langkah solusi permanen **tanpa perlu menginstal sertifikat di perangkat pengguna**.

---

## 1. Penyebab Teknis (Root Cause)

Dari hasil investigasi sertifikat SSL pada `idesk.santos.co.id`:
- **Subject**: `CN=*.santos.co.id`
- **Issuer (Penerbit)**: `CN=SJA-ROOT-CA, DC=sja, DC=com` (Enterprise CA Internal Active Directory)
- **Status DNS Publik**: Domain `santos.co.id` dikelola di **Rumahweb** (`nsid1.rumahweb.com` s/d `nsid4.rumahweb.org`).
- **Status DNS Intranet**: Domain `idesk.santos.co.id` dipetakan secara internal ke `10.10.6.13` via Domain Controller SJA (`192.168.2.14`).

### Kenapa di PC Anda Aman?
Karena PC Anda (PC IT/Administrator) sudah memiliki sertifikat **`SJA-ROOT-CA`** di dalam penyimpanan Windows:
`Certificates (Local Computer) -> Trusted Root Certification Authorities`.

### Kenapa di HP & Komputer Lain Tidak Aman (`NET::ERR_CERT_AUTHORITY_INVALID`)?
Browser di seluruh dunia (Chrome di Android, Safari di iPhone, Edge/Chrome di PC lain) secara bawaan **hanya percaya pada lembaga sertifikat publik dunia** (seperti Let's Encrypt, DigiCert, Sectigo, Google Trust Services). 
Browser **tidak mengenal** siapa `SJA-ROOT-CA`, sehingga koneksi langsung diblokir dengan peringatan *"Your connection is not private"*.

---

## 2. Solusi Utama: Zero-Install di Semua HP & PC (Via Rumahweb & Nginx Proxy Manager)

Agar **semua HP Android, iPhone, laptop pribadi, dan PC kantor langsung menampilkan gembok aman otomatis TANPA PERLU MENGINSTAL APAPUN**, server harus menggunakan sertifikat publik resmi untuk wildcard `*.santos.co.id`.

### Langkah 1: Dapatkan Sertifikat Wildcard dari Rumahweb / cPanel
1. Login ke **Client Area Rumahweb** atau **cPanel** hosting domain `santos.co.id`.
2. Masuk ke menu **Security -> SSL/TLS** atau **Let's Encrypt SSL**.
3. Lakukan penerbitan (issue) sertifikat untuk:
   - `*.santos.co.id` (Wildcard)
   - `santos.co.id`
   *(Karena DNS `santos.co.id` berada di Rumahweb, validasi Let's Encrypt DNS-01 akan berjalan otomatis tanpa kendala)*.
4. Unduh atau salin 2 file kunci:
   - **Private Key** (biasanya bernama `privkey.pem` atau `private.key`).
   - **Certificate Fullchain** (berisi sertifikat domain + Intermediate CA bundle, biasanya bernama `fullchain.pem` atau gabungan `certificate.crt` + `ca_bundle.crt`).

### Langkah 2: Upload Sertifikat ke Nginx Proxy Manager (NPM)
1. Buka dashboard web **Nginx Proxy Manager** (misal: `http://10.10.6.13:81` atau URL NPM Anda).
2. Di navigasi atas, klik menu **SSL Certificates**.
3. Klik tombol **Add SSL Certificate** di pojok kanan atas, lalu pilih **Custom**.
4. Isi form:
   - **Name**: `santos.co.id - Public Wildcard`
   - **Certificate Key**: Upload file `privkey.pem` / paste isi Private Key.
   - **Certificate**: Upload file `fullchain.pem` / paste isi Certificate + Intermediate CA.
5. Klik **Save**.

### Langkah 3: Terapkan ke Proxy Host `idesk.santos.co.id`
1. Di Nginx Proxy Manager, buka menu **Hosts -> Proxy Hosts**.
2. Cari baris `idesk.santos.co.id` (dan `ipop.santos.co.id`), klik tombol titik tiga di kanan -> pilih **Edit**.
3. Buka tab **SSL**:
   - Pada dropdown **SSL Certificate**, ubah pilihan ke: `santos.co.id - Public Wildcard`.
   - Pastikan **Force SSL** dalam posisi **ON** (hijau).
   - Pastikan **HTTP/2 Support** dalam posisi **ON** (hijau).
4. Klik **Save**.

🎉 **HASIL AKHIR**: Detik itu juga, setiap orang yang membuka `https://idesk.santos.co.id` dari HP (Android & iPhone) maupun komputer manapun akan **langsung aman (Gembok Hijau)** tanpa perlu konfigurasi atau instalasi apapun di perangkat mereka!

---

## 3. Solusi Darurat / Sementara (Jika Belum Sempat Akses Rumahweb Hari Ini)

Jika hari ini ada user PC yang mendesak harus mengakses iDesk sebelum sertifikat Rumahweb dipasang, telah disediakan file sertifikat dan skrip installer otomatis di repository:

### Untuk Komputer Windows Lain:
1. Bagikan folder: [deploy/ssl/](file:///f:/Program%20Bagas/SynologyDrive/iDesk-main/deploy/ssl)
   - `SJA-ROOT-CA.crt`
   - `install-cert.bat`
2. Di komputer lain, cukup **Klik Kanan `install-cert.bat` -> pilih "Run as administrator"**.
3. Buka kembali browser, halaman `https://idesk.santos.co.id` langsung aman.

### Untuk HP Android / iPhone (Manual):
1. Kirim file [SJA-ROOT-CA.crt](file:///f:/Program%20Bagas/SynologyDrive/iDesk-main/deploy/ssl/SJA-ROOT-CA.crt) ke HP (via WhatsApp / Email / Google Drive).
2. **iPhone**: Buka file -> Install Profile -> Buka `Settings -> General -> About -> Certificate Trust Settings` -> Aktifkan `Enable Full Trust for Root Certificates` pada `SJA-ROOT-CA`.
3. **Android**: Buka `Pengaturan -> Keamanan -> Enkripsi & Kredensial -> Instal dari penyimpanan -> Sertifikat CA` -> Pilih file `SJA-ROOT-CA.crt`.
