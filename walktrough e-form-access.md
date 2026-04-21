# Walkthrough: E-Form Access Portal (VPN MVP)
> Dokumentasi implementasi berdasarkan **Implementation Plan 5**. 
> Gunakan dokumen ini untuk mereview alur kerja, logika bisnis, dan struktur antarmuka.

---

## 🏗️ 1. Arsitektur & Database (Backend Core)

Sistem dibangun dengan struktur modul terpisah (`eform-request`) yang terintegrasi dengan layanan inti iDesk.

### Entitas Utama:
1.  **`EFormRequest`**: Menyimpan data utama pengajuan, status alur (`DRAFT` s/d `CONFIRMED`), dan data formulir dalam format JSONB.
2.  **`EFormApproval`**: Mencatat setiap langkah persetujuan secara berurutan (*sequential*).
3.  **`EFormSignature`**: Menyimpan data tanda tangan digital (Base64 PNG) beserta identitas penandatangan dan *role*-nya.
4.  **`EFormCredential`**: Menyimpan data akun VPN yang telah dienkripsi secara aman.

### Keamanan Data:
*   **Enkripsi**: Menggunakan standar industri **AES-256-GCM**. Kredensial VPN tidak pernah disimpan dalam bentuk teks biasa di database.
*   **Akses Terbatas**: Hanya pemohon (*requester*) yang sah yang dapat memicu proses dekripsi untuk melihat kredensial mereka sendiri.

---

## 🧩 2. Komponen Antarmuka (Frontend UI)

Komponen dirancang untuk memberikan pengalaman digital yang modern dan intuitif.

### Komponen Inti:
*   **`SignaturePad.tsx`**: Kanvas responsif untuk tanda tangan digital dengan fitur *clear* dan *lock*.
*   **`ManagerSelector.tsx`**: Pencarian pengguna secara *real-time* yang mencakup seluruh karyawan untuk menentukan alur persetujuan.
*   **`EformStatusPipeline.tsx`**: Bar visual yang menunjukkan posisi pengajuan (User -> Mgr 1 -> GM -> ICT).
*   **`CredentialViewer.tsx`**: Penampil data rahasia dengan hitung mundur otomatis (60 detik) sebelum disembunyikan kembali.
*   **`TermsAndConditions.tsx`**: Menampilkan syarat dan ketentuan dinamis yang diambil langsung dari pengaturan server.

---

## 🔄 3. Alur Kerja (End-to-End Workflow)

Berikut adalah langkah-langkah yang kini sudah aktif dalam sistem:

### Tahap 1: Pengajuan (User/Client)
1.  User masuk ke menu **E-Form Access**.
2.  Mengklik **"+ New VPN Request"**.
3.  **Wizard Step 1**: Mengisi detail (Tujuan Akses, Tanggal, Alasan).
4.  **Wizard Step 2**: Membaca dan menyetujui T&C dinamis.
5.  **Wizard Step 3**: Memilih Atasan Langsung dan menandatangani secara digital.
6.  **Submit**: Sistem mengirimkan notifikasi *real-time* ke Atasan yang dipilih.

### Tahap 2: Persetujuan Atasan Langsung (Manager 1)
1.  Manager menerima notifikasi dan membuka link detail pengajuan.
2.  Manager mereview data dan alasan pengajuan.
3.  Manager **memilih GM/Director** sebagai pemberi persetujuan tahap kedua.
4.  Manager menandatangani pengajuan dan mengklik **"Approve & Lanjutkan"**.

### Tahap 3: Persetujuan GM (Manager 2)
1.  GM menerima notifikasi persetujuan lanjutan.
2.  GM memberikan tanda tangan digital sebagai otoritas final tingkat departemen.
3.  Status berubah menjadi **`PENDING_ICT`**.

### Tahap 4: Penyediaan Akses (ICT Agent/Admin)
1.  Tim ICT melihat daftar pengajuan di dashboard mereka.
2.  Agent memasukkan *username* dan *password* VPN sementara.
3.  Sistem mengenkripsi data tersebut dan mengubah status menjadi **`CONFIRMED`**.
4.  User pemohon menerima notifikasi bahwa akses sudah siap.

### Tahap 5: Pengambilan Kredensial (User)
1.  User membuka halaman detail pengajuan yang sudah selesai.
2.  Mengklik tombol **"Lihat Kredensial VPN Aman"**.
3.  Data muncul selama 60 detik untuk disalin ke aplikasi VPN (seperti FortiClient/AnyConnect).

---

## 📑 4. Fitur Tambahan
*   **Download PDF**: Menghasilkan dokumen legal formal yang memuat seluruh data pengajuan dan semua tanda tangan digital yang terlibat.
*   **Audit Trail**: Catatan kronologis di sidebar yang menunjukkan siapa yang menyetujui dan kapan waktu pastinya.
*   **Dynamic Settings**: Admin dapat mengubah isi teks Syarat & Ketentuan tanpa perlu menyentuh kode program.

---

## 📝 5. Area Review & Masukan (Feedback)

Silakan berikan masukan Anda pada poin-pon berikut:
1.  **Layout**: Apakah susunan kolom informasi di halaman detail sudah rapi?
2.  **Wizard**: Apakah 3 tahap pembuatan pengajuan terlalu panjang atau sudah pas?
3.  **Data Form**: Apakah ada kolom tambahan yang perlu diminta (misal: Nomor HP, Jenis Perangkat)?
4.  **Visual**: Apakah skema warna (Biru/Amber/Green) untuk setiap status sudah representatif?

---
*Status: Menunggu feedback pengguna untuk iterasi perbaikan desain.*
