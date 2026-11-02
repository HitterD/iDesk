# Redesign Aplikasi Desktop SJA Notification Suite

**Tanggal:** 2026-09-12
**Cakupan:** `apps/sja-notification-app/` — seluruh aplikasi desktop WinForms, termasuk Remote Desktop.
**Di luar cakupan:** portal web iDesk (`apps/frontend/`), backend, logika notifikasi, autentikasi, izin, protokol remote.

---

## 1. Masalah

Keluhan awal: tampilan kaku, tidak bersih, palet warna buruk, terasa "AI slop".

Penyebabnya bukan warna yang salah pilih. `FluentTheme.cs` sudah memuat token bernama Apple
(`ThemeAccent` = `0,113,227`, `StatusOnline` = `52,199,89`). Masalahnya struktural:

1. **Tiga palet hidup bersamaan dalam satu berkas.** `FluentTheme.cs` memuat blok Slate
   (`FluentTheme.cs:18-36`), blok Zinc (`:39-50`), dan blok Apple (`:53-75`). Ketiganya dipakai
   bersamaan oleh pemanggil yang berbeda.
2. **Warna ditulis ulang sebagai literal di luar token.** Hijau "online" muncul dalam tiga nilai
   berbeda: `16,185,129` (`RemoteDeviceBrowserForm.cs:301`), `52,211,153`
   (`RemotePrivacyOverlayForm.cs:319`), dan `52,199,89` (`FluentTheme.cs:169`).
3. **Token prioritas memakai palet Tailwind, bukan Apple.** `FluentTheme.cs:176-198`.
4. **Setiap elemen digambar sebagai kartu berbingkai dengan bobot hampir sama**, sehingga tidak ada
   hierarki visual.
5. **Status koneksi tampil di tiga tempat sekaligus.**
6. **Tiga bahasa desain di fitur Remote.** `RemoteDeviceBrowserForm` bertema penuh dan berlangganan
   `ThemeChanged` (`:126`); `RemoteViewerForm` gelap permanen tanpa token warna sama sekali
   (`:86,103,111,120,212`); `RemotePrivacyOverlayForm` memakai palet slate/amber/blue sendiri
   (`:112-227`).
7. **Font tidak deterministik.** `FluentTheme.cs:243` mencoba `SF Pro Display` dan `SF Pro Text`
   lebih dulu, sehingga komputer yang punya font Apple terpasang menampilkan tipografi berbeda dari
   komputer lain.

Kerja ini karena itu adalah perbaikan hierarki, kepadatan, dan konsistensi token — bukan penggantian
warna.

---

## 2. Prinsip

1. **Satu sumber kebenaran warna.** Setiap warna berasal dari `FluentTheme`. Tidak ada
   `Color.FromArgb(...)` literal di berkas form.
2. **Netral dulu, aksen belakangan.** Dasar netral; satu biru aksen; hijau/amber/merah hanya untuk
   status yang bermakna.
3. **Bingkai dibelanjakan sesuai peran.** Border, isian, radius, dan bayangan menandai "objek
   terpisah". Tidak semuanya jadi kartu.
4. **Terbaca lebih dulu, efek belakangan.** Dengan akrilik mati, tampilan harus tetap selesai.
5. **Konvensi Windows dipertahankan.** Kontrol jendela di kanan, huruf sistem Windows, toggle gaya
   Windows 11. Proporsi dan ketenangan yang diambil dari Apple, bukan dekorasinya.
6. **Redesign tidak menambah perilaku.** Tidak ada layar baru, tidak ada data yang tidak ada
   sumbernya.

---

## 3. Sistem token

### 3.1 Konsolidasi `FluentTheme.cs`

Nilai di dalam `FluentTheme.cs` diganti; **nama properti dipertahankan** sehingga seluruh pemanggil
ikut berubah tanpa disentuh. Properti warisan yang tidak lagi dipakai dihapus setelah dipastikan nol
referensi lewat `Grep`.

| Yang dihapus | Alasan |
|---|---|
| Blok Slate `:18-36` (kecuali `NavyBrand` untuk logo) | digantikan token adaptif |
| Blok Zinc `:39-50` | digantikan token adaptif |
| `PriorityUrgent/High/Normal/Success` `:176-198` | nilai Tailwind, diganti nilai palet status |

`GetPriorityTheme` (`:200-226`) dan `GetPriorityDisplayLabel` (`:228-236`) tetap ada dengan tanda
tangan sama; hanya nilainya yang berubah.

### 3.2 Palet

Ditulis sebagai pasangan terang/gelap adaptif, mengikuti pola properti `Theme*` yang sudah ada.

| Token | Terang | Gelap |
|---|---|---|
| Canvas | `#F5F5F7` | `#1C1C1E` |
| Sidebar | `#F1F1F4` | `#202022` |
| Surface | `#FFFFFF` | `#252527` |
| Surface lembut | `#FAFAFA` | `#2B2B2E` |
| Sumur input | `#F2F2F5` | `#1A1A1C` |
| Hairline | `rgba(0,0,0,.09)` | `rgba(255,255,255,.11)` |
| Teks utama | `#1D1D1F` | `#F5F5F7` |
| Teks sekunder | `#5E5E63` | `#AEAEB2` |
| Teks redup | `#8E8E93` | `#8E8E93` |
| Aksen | `#0071E3` | `#0A84FF` |
| Online | `#248A3D` | `#30D158` |
| Perhatian | `#B25000` | `#FF9F0A` |
| Kritis | `#C9252D` | `#FF6961` |

Aksen dipakai untuk: item navigasi aktif, tombol utama, tanda centang pada pilihan aktif, toggle
menyala, cincin fokus. Tidak untuk yang lain.

### 3.3 Skala

- **Sudut:** 6 / 8 / 10 / 12 / pil
- **Jarak:** 4 / 8 / 12 / 16 / 20 / 24
- **Tipografi:** 12 / 13 / 14 / 16 / 20 / 26 px

### 3.4 Tipografi

`GetBestFontFamily` (`FluentTheme.cs:241-257`) kehilangan dua kandidat pertama. Urutan baru:
`Segoe UI Variable Text`, `Segoe UI`, `Arial`. Ini membuat tipografi sama di semua komputer dan
menegakkan keputusan "huruf sistem Windows".

### 3.5 Ikon

`GetMenuIcon` (`FluentTheme.cs:589-777`) dipertahankan — 22 ikon vektor GDI+ pada kisi 16×16 sudah
merupakan satu keluarga yang konsisten. Yang dikerjakan:

- Stroke diseragamkan pada `1.3f` dengan ujung membulat (sebagian ikon saat ini mencampur
  `DrawRectangle` bersudut tajam dengan garis berujung bulat).
- Merah yang dikunci di ikon `exit` (`:725`) diganti token kritis.
- Ikon yang kurang ditambahkan untuk permukaan baru.
- **Glyph di dalam teks dibuang:** `"Ganti Profil ▾"` (`MainWindowForm.cs:869`),
  `"Masuk & Hubungkan Perangkat ➔"` (`:720`), `"💻"` (`RemoteViewerForm.cs:109`), `"📁"` (`:170`),
  `"⛶"` (`:156`), `"🗖"`/`"🗗"` (`:132-145`), serta awalan emoji status 🟡🟢🔴✓.
- Ikon hanya muncul di sidebar, item menu, dan indikator status. Tombol bicara lewat katanya.

---

## 4. Struktur aplikasi

### 4.1 Satu jendela, tiga halaman

`HistoryForm.cs` dan `SettingsForm.cs` dihapus. Menu tray "Notification history" dan "Settings"
membuka jendela utama pada halaman yang sesuai. Sebelumnya `HistoryForm.cs:341-352` berperilaku beda
dari `HistoryControlPanel.cs:187-209` untuk aksi yang sama.

### 4.2 Titlebar

Hanya nama aplikasi + minimize + close. Pil status gateway, tombol gerigi, dan tombol tema
dikeluarkan dari titlebar (`MainWindowForm.cs:308-402`): status pindah ke kaki sidebar, Settings jadi
halaman, tema jadi setelan.

### 4.3 Sidebar

Lebar tetap ±194 px. Dua kelompok:

1. **Halaman dalam aplikasi:** Home, History, Settings.
2. **Membuka jendela lain:** Remote Desktop, iDesk Portal — diberi label kelompok dan ikon tautan
   luar.

Kaki sidebar memuat identitas pengguna dan satu indikator status gateway.

### 4.4 Home

Tiga notifikasi terbaru dari data riwayat yang sudah ada, ditambah tombol "View all notifications".
Kartu identitas, kartu besar portal, dan dua kotak bento (`MainWindowForm.cs:961-1309`) dihapus —
ketiganya mengulang hal yang sudah ada di kepala halaman dan sidebar.

Tidak ada statistik dan tidak ada penanda belum-dibaca; keduanya tidak punya sumber data.

### 4.5 History

`NotificationStreamCanvas` dipertahankan (satu kontrol, baris tervirtualisasi, tanpa handle jendela
anak). Tinggi baris **84 → 72 px**, jarak 8 px tetap. Klik baris tetap membuka browser
(`HistoryControlPanel.cs:187-209`) — aplikasi tidak punya layar detail dan tidak ditambahkan, karena
itu perilaku baru, bukan redesign.

Chip abu-abu pada setiap baris dihapus; prioritas ditandai hanya saat bermakna.

### 4.6 Settings

Satu daftar panjang berkelompok, label di kiri dan kontrol di kanan, tanpa tab. Kelompok mengikuti
yang sudah ada di `SettingsControlPanel.cs`: Tampilan & Tema (`:100`), Notifikasi & Suara (`:160`),
Sistem & Jaringan (`:307`). Toggle memakai gaya Windows 11 dengan warna aksen, bukan hijau macOS.

### 4.7 Dropdown

Satu gaya panel melayang untuk semua: submenu tray, pemilih di Settings, menu per baris. Radius 8,
baris 34 px, slot centang di kiri untuk pilihan aktif, bayangan sama. `GlassDropdownList`
(`GlassControls.cs:469`) dan `FluentMenuRenderer.cs` disetel ke spesifikasi yang sama.

### 4.8 Popup notifikasi

Judul maksimal 2 baris, cuplikan pesan ±3 baris, keterangan lampiran jelas, satu aksi utama. Aturan
durasi, suara, dan kemunculan tidak diubah. Batang merah selebar popup dihapus.

### 4.9 Konfirmasi

Empat konfirmasi berpindah dari `MessageBox` ke dialog beringkai aplikasi: hapus riwayat
(`HistoryControlPanel.cs:84`), keluar akun (`MainWindowForm.cs:1697`), dan dua di tray
(`TrayApplicationContext.cs:606,625`). `MessageBox` untuk pesan galat sistem tetap dibiarkan — di
situ tampilan bawaan Windows justru membantu karena terbaca sebagai pesan sistem.

---

## 5. Remote Desktop

Remote ikut disesuaikan. Tata letak dirapikan, fitur dan protokol tidak diubah.

### 5.1 `RemoteDeviceBrowserForm.cs` (758 baris)

- Sebelas literal warna (`:301-308`, `:614-618`, `:664-665`) diganti token. Nilai-nilai itu adalah
  Tailwind emerald-500 dan slate-400, tidak cocok dengan palet aplikasi.
- Kartu perangkat: tinggi 88 px dipertahankan (kartu, bukan baris daftar), tetapi hierarki dirapikan
  mengikuti prinsip §2.3.
- **Kondisi gagal-muat digambar.** Saat ini kegagalan hanya masuk log (`:490`) dan layar tetap
  kosong tanpa keterangan. Ditambahkan bingkai kosong dengan keterangan dan tombol coba lagi,
  memakai bingkai yang sama dengan kondisi "tidak ada hasil" (`:549`).
- **Pesan gerbang akses disatukan.** Sekarang ada dua redaksi untuk hal yang sama
  (`MainWindowForm.cs:883` dan `:1558`), dan yang kedua sampai ke pengguna berawalan "Gagal membuka
  browser perangkat:" karena dilempar sebagai exception lalu ditangkap di `:1572-1576`. Satu redaksi,
  ditampilkan apa adanya. Logika gerbang (`RemoteAccessPolicy.cs`) tidak disentuh.

### 5.2 `RemoteViewerForm.cs` (841 baris)

- **Kaca jendela ganda diperbaiki.** `FormBorderStyle.Sizable` (`:83`) menghadirkan kaca Windows
  asli sementara `:125-190` menggambar titlebar sendiri — pengguna melihat dua baris tombol.
  Diubah jadi `FormBorderStyle.None` seperti jendela lain, dengan tepi resize lewat `WM_NCHITTEST`.
- **Delapan tombol titlebar dipisah.** Titlebar: nama perangkat + minimize/maximize/close. Aksi
  sesi turun ke satu baris toolbar dengan lebar mengikuti teks, menggantikan lebar mati
  110/115/130/140 px yang dihitung `Width - N` (`:127-204`) dan akan bertabrakan setelah label jadi
  Inggris. Toggle "Overlay" dan "Konten" jadi segmented control, bukan tombol yang labelnya berubah.
- **Tetap gelap, tapi dari token.** Enam literal (`:86,87,103,111,120,212`) diganti token gelap.
  Layar video memang lebih terbaca di atas dasar gelap dan itu konvensi alat remote; bedanya warnanya
  kini satu keluarga dengan aplikasi.
- **Status dipisah dari teks tampilan.** `:513` bercabang lewat
  `_lblStatus.Text.StartsWith("🟡")`. Begitu diterjemahkan, cabang itu tidak pernah kena lagi.
  Status jadi field enum tersendiri; label hanya menampilkannya. Alur koneksi, autentikasi, dan
  transfer file tidak disentuh.
- Fullscreen (`:236-259`) menyembunyikan toolbar, bukan membiarkannya makan 52 px.

### 5.3 `RemotePrivacyOverlayForm.cs` (499 baris)

- Lima belas literal warna (`:112-227`) diganti token. Catatan: `:112` menuliskan ulang nilai
  `NavyBrand` tanpa memakai tokennya.
- Tiga `new Font("Segoe UI", ...)` mentah (`:125-127`) diganti `FluentTheme.GetFont`. Kebocoran
  `Font` di `:199-253` (setiap `FluentTheme.Body` mengalokasikan `Font` baru lewat `GetFont`, lalu
  hanya `.FontFamily` diambil) diperbaiki.
- **Lima URL Unsplash dibuang** (`:84-88`). Ini layar yang dilihat karyawan saat komputernya
  dikendalikan; foto stok acak dari internet menambah ketergantungan jaringan pada layar yang justru
  soal privasi. Diganti gambar pelindung yang sudah digambar sendiri di `:102-138`, dirapikan.
  Mekanisme slideshow tetap ada agar perusahaan bisa memasukkan materinya sendiri.
- **`AcceptButton` dilepas** (`:243`). Saat ini Enter langsung memberi kendali komputer. Ini gerbang
  persetujuan, jadi izin harus lewat klik yang disengaja. Hitungan mundur yang otomatis memberi izin
  saat habis (`:476`) **tidak** diubah — itu tampaknya disengaja untuk sesi tanpa pendamping.
- Lebar tombol yang ditambal manual untuk label pasca-persetujuan (`:321-322`) diganti lebar
  mengikuti teks.

---

## 6. Bahasa

Seluruh label antarmuka menjadi Inggris, termasuk Remote. Setengah aplikasi berbahasa Inggris dan
setengahnya Indonesia lebih buruk daripada keduanya.

**Tidak diterjemahkan:** isi notifikasi — judul, pesan, prioritas, nama pengirim berasal dari server.

**Tidak dibuat:** berkas sumber teks terpusat / `.resx`. Dukungan dua bahasa tidak diminta; label
tetap literal di tempat konstruksinya, mengikuti pola yang ada.

**Prasyarat teknis** (bukan opsional — tanpa ini terjemahan merusak fungsi):

| Lokasi | Masalah | Tindakan |
|---|---|---|
| `RemoteViewerForm.cs:513` | logika membaca teks tampilan | status jadi enum |
| `RemotePrivacyOverlayForm.cs:247,472` | teks tombol menyisipkan detik | format terpisah dari label |
| `RemotePrivacyOverlayForm.cs:321` | lebar tombol ditambal manual | lebar mengikuti teks |
| `RemoteViewerForm.cs:127-204` | lebar tombol mati | tata letak mengikuti teks |

---

## 7. Cara membuktikan hasilnya

`Program.cs` sudah punya enam flag render tanpa menjalankan aplikasi penuh: `--test-render-main`
(`:60`), `-tray` (`:91`), `-popup` (`:120`), `-settings` (`:180`), `-history` (`:209`), `-remote`
(`:249`). Flag ditambahkan untuk permukaan yang belum tercakup: sign-in, dialog alur masuk, viewer,
privacy overlay, dan kondisi kosong/terputus.

Setiap permukaan dirender terang dan gelap. Tanpa ini, tidak ada dasar untuk menyatakan sebuah layar
selesai selain menebak.

Pengujian yang berlaku:

- **Smoke:** aplikasi terbuka, setiap halaman tampil, tidak ada exception.
- **Visual:** PNG terang dan gelap untuk setiap permukaan.
- **Regresi:** riwayat termuat dan klik baris membuka URL; popup muncul dengan aturan durasi yang
  sama; toggle startup masih menulis kunci Run; peralihan tema masih menjangkau semua jendela.
- **Remote:** browser perangkat memuat daftar, gerbang peran masih menolak akun non-operator,
  viewer terhubung, overlay privasi tampil dan click-through masih bekerja.

---

## 8. Yang tidak berubah

- Logika notifikasi: aturan durasi, suara, kemunculan.
- Autentikasi, penyimpanan sesi, `RemoteAccessPolicy.cs`.
- Protokol remote: P2P, relay WebSocket, transfer file, `RemoteHostEngine.cs`.
- Hitungan mundur persetujuan otomatis di privacy overlay.
- `MessageBox` untuk galat sistem.
- Isi notifikasi yang berasal dari server.
- Portal web iDesk dan `DESIGN.md`-nya — itu sistem desain terpisah (Plus Jakarta Sans,
  Sapphire/Ivory, bento grid) dan bukan cakupan aplikasi desktop.

---

## 9. Berkas yang terdampak

| Berkas | Baris | Sifat perubahan |
|---|---|---|
| `FluentTheme.cs` | 845 | Konsolidasi token, font, ikon |
| `MainWindowForm.cs` | — | Titlebar, sidebar, Home, dialog |
| `HistoryControlPanel.cs` | — | Kepadatan baris, kondisi kosong, konfirmasi |
| `SettingsControlPanel.cs` | — | Daftar berkelompok |
| `TrayApplicationContext.cs` | — | Menu, submenu, konfirmasi |
| `GlassControls.cs` | 955 | Dropdown, toggle, tombol |
| `FluentMenuRenderer.cs` | — | Diselaraskan dengan dropdown |
| `RemoteDeviceBrowserForm.cs` | 758 | Token, kondisi gagal, pesan gerbang |
| `RemoteViewerForm.cs` | 841 | Kaca jendela, toolbar, token, status enum |
| `RemotePrivacyOverlayForm.cs` | 499 | Token, font, wallpaper, AcceptButton |
| `Program.cs` | — | Flag render tambahan |
| `HistoryForm.cs` | — | **Dihapus** |
| `SettingsForm.cs` | — | **Dihapus** |
| `LoginForm.cs` | — | **Dihapus** (kode mati, tidak pernah diinstansiasi) |

Berkas yang melewati 800 baris ditinjau saat implementasi; pemecahan dilakukan bila perubahan
menambah panjangnya, bukan sebagai refactor terpisah.

---

## 10. Rujukan visual

`.design-preview/sja-notifier-v1.html` — pratinjau HTML yang sudah disetujui, memuat: jendela utama
(Home/History/Settings yang bisa diklik), sign in, tiga dialog alur masuk, menu tray dan dropdown
dalam keadaan terbuka, dua varian popup, serta kondisi kosong dan terputus.

Berkas itu adalah proksi visual, bukan kode produksi, dan tidak di-commit (`.gitignore:71`).
Pratinjau belum memuat permukaan Remote; permukaan Remote mengikuti spesifikasi token dan tata letak
di §5.
