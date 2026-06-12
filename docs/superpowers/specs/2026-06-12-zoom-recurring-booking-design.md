# Zoom Recurring Booking Design

## 1. Overview
Fitur ini memungkinkan pengguna untuk membuat *booking* Zoom secara berulang (recurring) dengan pola yang dinamis. Jika jadwal pilihan bertabrakan, sistem secara otomatis akan mencoba menggunakan akun Zoom lain yang kosong.

## 2. Requirements & Constraints
1. **Recurrence Pattern**: Advanced (Mendukung pola kompleks seperti harian, mingguan di hari tertentu, dan berhenti pada tanggal tertentu atau setelah X kali pengulangan).
2. **Conflict Handling**: Auto-Switch Account (Jika akun utama penuh pada salah satu jadwal, sistem otomatis mencarikan akun Zoom lain yang tersedia di jam yang sama).
3. **Editing Behavior**: Connected Series (Jadwal yang dibuat memiliki identitas seri. Edit/Delete mendukung mode: "Hanya jadwal ini", "Jadwal ini dan seterusnya", "Semua jadwal").

## 3. Data Model Changes

### Tabel `zoom_bookings`
Perlu penambahan beberapa kolom untuk mendukung *Connected Series*:
- `seriesId` (UUID, nullable): Identifier unik untuk mengikat semua jadwal dalam satu seri.
- `recurrencePattern` (JSON/String, nullable): Menyimpan metadata aturan *recurring* (misal: RRule string seperti `FREQ=WEEKLY;BYDAY=TU,TH;COUNT=10`). Format RRULE (iCalendar RFC 5545) sangat disarankan karena standard.

### Mengapa App-Side Recurrence?
Alih-alih menggunakan fitur recurring native dari Zoom API (type 8), kita akan menggunakan App-Side Recurrence (meng-generate N *bookings* individual di database kita, lalu memanggil Zoom API `type: 2` sebanyak N kali). 
**Alasan:**
1. Mempermudah *Auto-Switch Account*. Jika satu seri terdiri dari 5 jadwal, jadwal ke-3 bisa menggunakan akun Zoom B (karena Zoom A penuh), sementara sisanya menggunakan akun Zoom A. Zoom API native tidak mendukung 1 seri beda akun.
2. Sinkronisasi status yang lebih mudah dikontrol di database internal (iDesk).

## 4. System Flow (Auto-Switch Account)

1. **Input**: User memasukkan detail booking (Topik, Jam, Durasi) + Aturan Recurring (misal: Setiap Selasa, 4x pertemuan) + Akun Preferensi (Akun Zoom 1).
2. **Generation**: Backend menghasilkan 4 daftar tanggal: `[T1, T2, T3, T4]`.
3. **Availability Check**:
   - T1: Zoom 1 kosong -> Pilih Zoom 1
   - T2: Zoom 1 penuh -> Cek Zoom 2 -> Kosong -> Pilih Zoom 2
   - T3: Zoom 1 kosong -> Pilih Zoom 1
   - T4: Semua Zoom (1 & 2) penuh -> Tanggal ini digagalkan/dibatalkan (atau user dikonfirmasi).
4. **Execution**: Backend memanggil Zoom API secara paralel/batch untuk membuat 3 meeting. Jika ada yang gagal, di-rollback atau disesuaikan.
5. **Persistence**: 3 record disimpan ke `zoom_bookings` dengan `seriesId` yang sama, namun `zoomAccountId` bisa berbeda-beda.

## 5. UI/UX Changes
1. **Booking Form (`ZoomBookingForm.tsx`)**:
   - Tambah toggle "Berulang / Recurring".
   - Jika aktif, munculkan komponen builder Recurring (Pilih pola: Daily/Weekly/Monthly, pilih End condition).
2. **Booking Detail (`ZoomBookingDetailView.tsx`)**:
   - Tampilkan informasi bahwa ini bagian dari *Series*.
   - Jika diedit/dihapus, munculkan Dialog konfirmasi: ("This event", "This and following", "All events").

## 6. Reschedule Logic (Retaining Zoom Meeting Link)
Untuk menjaga agar Link dan Meeting ID Zoom tidak berubah saat terjadi *reschedule* (yang bisa membingungkan pengguna jika mereka sudah membagikan link tersebut), kita menggunakan kombinasi pendekatan berikut:

1. **Strict Account Retention (Backend):**
   Pada endpoint reschedule (`PATCH /api/zoom-booking/:id/reschedule`), fitur Auto-Switch Account **dimatikan**. Backend wajib menggunakan `zoomAccountId` yang sama. Jika akun tersebut penuh di waktu yang baru, backend menolak *request* tersebut dan mengeluarkan *error* spesifik (mencegah link berubah).
   
2. **UI Time Blocking (Frontend):**
   Untuk mencegah *error* di atas dan memberikan *User Experience* yang baik, UI Kalender pada modal/tampilan *Reschedule* akan mem-filter ketersediaan waktu (availability) **hanya berdasarkan `zoomAccountId` milik jadwal yang sedang diedit**. Slot waktu di mana akun tersebut sudah terpakai akan di-disable (abu-abu).

## 7. Open Questions / Edge Cases
- **Batas Maksimal**: Apakah ada batas maksimal pengulangan dalam satu pembuatan seri? (Saran: maksimal 50 jadwal per request untuk mencegah *timeout* Zoom API).
- **Notifikasi Email**: Apakah peserta akan menerima 5 email undangan terpisah (karena ada 5 meeting ID Zoom yang berbeda)? Ataukah dirangkum dalam 1 email berisi daftar link? (Saran: Dirangkum 1 email di backend).
