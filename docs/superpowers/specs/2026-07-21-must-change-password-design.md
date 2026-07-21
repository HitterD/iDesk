# Wajib Ganti Password — Design Spec

**Tanggal:** 2026-07-21
**Status:** Approved

## Masalah

User dengan password default `123456` (data lama/seed di DB production) dan user
yang baru pertama kali login harus dipaksa mengganti passwordnya. Saat login,
muncul popup card non-dismissible "must change password", dan user harus set
password baru sebelum bisa lanjut.

## Temuan Riset

- **Tidak ada** kode yang membuat user dengan password `123456`. User baru dibuat
  dengan password random (`user-crud.service.ts:198`, `user-import.service.ts:182`).
  Password `123456` berasal dari data lama/seed di DB.
- User entity **belum punya** field penanda. Ada `lastActiveAt` (di-update tiap
  login, `auth.service.ts:215`).
- Dua jalur login: **email+password lokal** dan **NIK/HRIS** (password diverifikasi
  ke HRIS gateway, bukan DB lokal — `auth.service.ts:135`). User HRIS sering
  `password` lokal kosong → flag ini tidak relevan untuk mereka.
- `POST /auth/change-password` butuh `currentPassword` + `newPassword` (min 8,
  `change-password.dto.ts:11`). Login response = `{ user, expiresIn, expiresAt }`.

## Keputusan Desain

- **Pendekatan A**: kolom flag eksplisit `mustChangePassword`, satu sumber kebenaran.
- **Enforcement**: frontend-only gate (popup non-dismissible). TIDAK ada backend
  hard-block. Cukup untuk internal helpdesk (mayoritas user non-teknis).
- **Endpoint**: reuse `POST /auth/change-password` apa adanya. Password lama
  auto-fill dari state login (user baru saja mengetiknya di form login).
- **Aturan password baru**: min 8 (ikut endpoint existing) + tidak boleh `123456`.

## Perubahan

### 1. Data Model — `apps/backend/src/modules/users/entities/user.entity.ts`

Tambah kolom:
```ts
@Column({ default: false })
mustChangePassword: boolean;
```

Migration baru:
- `ALTER TABLE users ADD COLUMN "mustChangePassword" boolean NOT NULL DEFAULT false`
- Set `true` untuk user existing yang password-nya `123456`. Karena bcrypt tak bisa
  di-query via SQL, migration mengambil semua user dengan `password` lokal non-null,
  `bcrypt.compare('123456', hash)` per user, lalu update yang match.
- `down()`: drop kolom.

### 2. Set flag `true` di 4 jalur create/reset

- `user-crud.service.ts:createUser` — tambah `mustChangePassword: true` saat create.
- `user-crud.service.ts:createAgent` — sama.
- `user-import.service.ts:importUsers` (create branch, sekitar baris 185) — sama.
- `user-password.service.ts:resetPassword` — set `mustChangePassword: true` bersama
  update password.

### 3. Login mengirim flag — `apps/backend/src/modules/auth/application/auth.service.ts`

`login()` mengembalikan objek `user` (sudah tanpa password). Pastikan
`mustChangePassword` ikut ter-include di objek user yang dikirim ke frontend.
`validateUserWithDetails` / `validateNikUser` sudah `const { password, ...result }`
— flag otomatis ikut selama kolom ada di entity.

### 4. Reset flag saat ganti password

- `auth.service.ts:changePassword` — saat update password sukses, set
  `mustChangePassword: false`.
- `user-password.service.ts:updatePassword` — terima/terapkan `mustChangePassword: false`
  (opsi: ubah `updatePassword` agar sekaligus clear flag, atau tambah di
  `auth.service.changePassword` via `usersService.update`). Implementasi memilih
  clear flag di jalur `changePassword` agar hanya ganti-password sadar-flag yang
  meng-clear, bukan semua update password.

### 5. Frontend

- `apps/frontend/src/stores/useAuth.ts` — tambah `mustChangePassword?: boolean` di
  interface `User`.
- `apps/frontend/src/features/auth/pages/BentoLoginPage.tsx` — setelah `login(user)`
  sukses, jika `user.mustChangePassword` → tampilkan `MustChangePasswordDialog`
  (jangan navigate dulu). Simpan password login untuk auto-fill `currentPassword`.
- **Komponen baru** `MustChangePasswordDialog`:
  - Modal non-dismissible: tanpa tombol X, klik overlay tidak menutup, tanpa Cancel.
  - Field: [password baru] [konfirmasi password baru]. `currentPassword` auto-fill
    dari password login (hidden / tidak ditampilkan).
  - Submit → `POST /auth/change-password` dengan `{ currentPassword, newPassword }`.
  - Sukses → `updateUser({ mustChangePassword: false })` + navigate sesuai role
    (pakai logika role-routing yang sama seperti di `BentoLoginPage.handleSubmit`).
  - Validasi klien: min 8, tidak boleh `123456`, `newPassword === konfirmasi`.
  - Tampilkan error dari response (mis. currentPassword salah — edge case bila
    password login ternyata beda).

### 6. Testing

- **Migration self-check** (script/test kecil): user password `123456` → flag `true`;
  user password lain → flag `false`.
- **`auth.service.changePassword`**: setelah ganti sukses, flag user jadi `false`.
- **`createUser` / `resetPassword`**: user hasil create/reset punya `mustChangePassword: true`.
- **`MustChangePasswordDialog`**: submit valid memanggil `api.post('/auth/change-password', ...)`;
  reject bila password `123456`, bila konfirmasi tidak cocok, bila < 8 char.

## Di Luar Scope (Skipped)

- Backend hard-block guard (jalur B). Tambah jika perlu cegah bypass via panggilan
  API langsung.
- Endpoint `change-password-forced` baru. Reuse endpoint existing sudah cukup.
- Kebijakan kompleksitas password (huruf besar/angka/simbol). Cukup min 8 + bukan `123456`.
- User NIK/HRIS tanpa password lokal — di luar cakupan (auth via HRIS gateway).
