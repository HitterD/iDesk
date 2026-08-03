# Blueprint Path Alignment Design

## Tujuan

Perbarui referensi implementasi pada `Development%20Document%20iDesk%20V1%20-%20Sesuai%20Blueprint.md` agar menunjuk struktur iDesk saat ini.

## Cakupan

- Ubah seluruh nilai pada kolom `Halaman / Endpoint Utama` menjadi `Lokasi Implementasi`.
- Cantumkan source frontend, nama page, route UI, source backend, dan endpoint API utama bila tersedia.
- Gunakan path repo absolut-relatif dari root project.
- Tidak mengubah daftar fitur, status, deskripsi, atau bukti screenshot.

## Format

Setiap sel memakai satu baris ringkas:

```md
`apps/frontend/src/features/admin/pages/AuditLogPage.tsx` (`AuditLogPage`) · `/audit-logs` · `apps/backend/src/modules/audit/audit.controller.ts` · `/v1/audit`
```

Bagian yang tidak memiliki page atau controller khusus tidak ditulis. Endpoint memakai prefix versi `/v1`, sesuai URI versioning backend.

## Sumber Kebenaran

- Frontend page dan route: `apps/frontend/src/routes/AppRoutes.tsx`.
- Backend controller: anotasi `@Controller()` pada `apps/backend/src/modules/**`.
- Prefix versi API: `apps/backend/src/main.ts`.

## Validasi

- Setiap path source harus ada di repository.
- Setiap route UI harus terdaftar pada `AppRoutes.tsx`.
- Setiap endpoint harus cocok dengan controller terkait dan prefix `/v1`.
- Tidak ada referensi lama `features/...` atau nama controller tanpa path lengkap pada tabel bagian 3.
