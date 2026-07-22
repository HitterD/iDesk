# User Notification Center Access — Design Spec

**Tanggal:** 2026-07-22  
**Status:** Approved

## Masalah

`NotificationPopover` mengarahkan semua role ke `/notifications`. Untuk role `USER`, route notification center berada di `/client/notifications`. Klik **View All** dari client portal masuk ke fallback role route dan berakhir unauthorized.

Link **Notification Settings** juga menunjuk `/admin/settings`, sementara route admin/agent aktual adalah `/settings`. User tidak memiliki halaman notification settings khusus.

## Temuan Riset

- `apps/frontend/src/components/notifications/NotificationPopover.tsx:87` hardcode `to="/notifications"`.
- `apps/frontend/src/routes/AppRoutes.tsx:285` mendefinisikan route user pada `/client/notifications`.
- `apps/frontend/src/components/notifications/utils/notificationRouter.ts:73-75` sudah menyediakan `getNotificationCenterPath(role)`: USER ke `/client/notifications`, selain USER ke `/notifications`.
- `apps/frontend/src/components/notifications/NotificationPopover.tsx:144` hardcode `/admin/settings`.
- `apps/frontend/src/routes/AppRoutes.tsx:183` mendefinisikan settings admin/agent pada `/settings`; tidak ada route settings untuk client.

## Keputusan

Pakai helper route yang sudah ada dan tidak buat notification settings baru.

## Perubahan

### `apps/frontend/src/components/notifications/NotificationPopover.tsx`

1. Import `getNotificationCenterPath` dari `utils/notificationRouter`.
2. Ganti link **View All** menjadi `to={getNotificationCenterPath(userRole)}`.
3. Render link **Notification Settings** hanya untuk role selain `USER`.
4. Ubah tujuan settings non-USER dari `/admin/settings` menjadi `/settings`.

## Aliran Data

1. `useAuth()` memberi role aktif.
2. `NotificationPopover` mengubah role menjadi `UserRole`.
3. Klik **View All** memanggil `getNotificationCenterPath(userRole)`.
4. USER masuk `/client/notifications`; non-USER masuk `/notifications`.
5. USER tidak menerima link settings yang tidak punya route sah.

## Error Handling dan Security

- Tidak ubah backend, API, auth, atau `PageAccessGuard`.
- Route tetap dijaga `ProtectedRoute` dan page access existing.
- Menyembunyikan link bukan pengganti authorization; guard tetap sumber enforcement.

## Testing

Tambah test unit kecil untuk `getNotificationCenterPath` bila test setup frontend tersedia:

- USER menghasilkan `/client/notifications`.
- ADMIN, AGENT, dan MANAGER menghasilkan `/notifications`.

Smoke check manual:

- Login USER, klik lonceng lalu **View All**, notification center client tampil tanpa unauthorized.
- Login non-USER, **View All** tetap membuka `/notifications`.
- USER tidak melihat **Notification Settings**.
- Non-USER melihat link settings dan menuju `/settings`.

## Di Luar Scope

- Halaman notification settings untuk USER.
- Perubahan permission preset atau backend notification endpoint.
- Refactor route lain yang belum salah.
