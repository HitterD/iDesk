# Settings Page Redesign & Completion

**Date:** 2026-05-01
**Branch:** feature/notification-command-center
**Status:** Approved for implementation

---

## Overview

Revamp halaman Settings (`BentoSettingsPage`) dengan tiga tujuan:
1. Hapus tab **Access Forms** yang sudah tidak terpakai
2. Tambah dua tab baru: **Business Hours** dan **Sound Settings**
3. Polish visual ke gaya **Clean Card** (enterprise, light/dark konsisten)

Halaman aktif di routing: `BentoSettingsPage` (`/settings`). File lama `SettingsPage.tsx` tidak ada di router dan akan dihapus.

---

## Scope

### Yang Berubah

| File | Aksi |
|------|------|
| `features/settings/pages/BentoSettingsPage.tsx` | Modify — hapus tab, tambah tab, redesign sidebar & content |
| `features/settings/pages/SettingsPage.tsx` | **Delete** — tidak dipakai di routing |
| `features/settings/pages/AccessTypeSettings.tsx` | **Delete** — hanya dipakai di BentoSettingsPage, tidak ada consumer lain |

### Yang Tidak Berubah
- Semua komponen form (`ProfileSettingsForm`, `SecuritySettingsForm`, `NotificationSettings`, `TelegramSettingsForm`) — sudah functional, tidak perlu disentuh
- Semua admin tab lazy components (SLA, Storage, IP Whitelist, Zoom) — sudah functional
- Routing di `AppRoutes.tsx` — tidak perlu diubah

---

## Tab Structure

### Personal (semua user terautentikasi)
1. **Profile** — `ProfileSettingsForm` (existing)
2. **Security** — `SecuritySettingsForm` (existing) + tambah password strength indicator
3. **Notifications** — `NotificationSettings` (existing)
4. **Telegram** — `TelegramSettingsForm` (existing)
5. **Appearance** — theme toggle dark/light (existing)

### Administration (ADMIN only)
1. **SLA Settings** — `BentoSlaSettingsPage` lazy (existing)
2. **Storage** — `StorageSettingsPage` lazy (existing)
3. **Business Hours** — `BusinessHoursSettings` lazy (**BARU**)
4. **Sound Settings** — `SoundSettingsPage` lazy (**BARU**)
5. **IP Whitelist** — `IpWhitelistSettings` lazy (existing)
6. **Zoom Settings** — `ZoomSettingsPage` lazy (existing)

**Dihapus:** `Access Forms` tab (value `access-forms`, komponen `AccessTypeSettingsTab`)

---

## Visual Design System

### Arah Desain: Clean Card (Enterprise)

Konsisten untuk light mode dan dark mode. Tidak menggunakan glassmorphism/blur — pilihan user adalah Clean Card yang lebih professional dan readable.

### Sidebar (`w-72`)

```
Background:   bg-slate-50/80 dark:bg-slate-800/40
Border:       border-r border-slate-200 dark:border-slate-700
Padding:      p-6
```

**Section header:**
```
text-xs font-bold uppercase tracking-wider
text-slate-400 dark:text-slate-500
mb-3 px-2
```

**Tab item (inactive):**
```
flex items-center gap-3 px-3 py-2.5 rounded-xl
text-sm font-medium
text-slate-600 dark:text-slate-400
hover:bg-slate-100 dark:hover:bg-slate-800/60
hover:text-slate-900 dark:hover:text-white
transition-colors duration-150
```

**Tab item (active):**
```
bg-blue-50 dark:bg-blue-950/40
text-blue-700 dark:text-blue-400
border-l-2 border-blue-600 dark:border-blue-500
font-semibold
```

**Icon container:**
```
w-7 h-7 rounded-md
bg-slate-200/80 dark:bg-slate-700/60 (inactive)
bg-blue-100 dark:bg-blue-900/50 (active)
flex items-center justify-center
```

### Content Area

**Tab wrapper card:**
```
bg-white dark:bg-slate-900
rounded-2xl
border border-slate-200 dark:border-slate-700
shadow-sm
p-8
```

**Tab entrance animation:**
```
animate-in fade-in slide-in-from-bottom-2 duration-300
```

**Loading skeleton (standardized):**
```tsx
<div className="flex items-center justify-center h-64">
  <div className="flex flex-col items-center gap-3">
    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    <p className="text-sm text-slate-400">Memuat...</p>
  </div>
</div>
```

### Password Strength Indicator (Security Tab)

Tambahan minor pada `SecuritySettingsForm` — tampilkan strength bar di bawah field "Kata Sandi Baru":
- Merah: < 8 karakter
- Kuning: 8+ karakter tapi tidak ada angka/simbol
- Hijau: 8+ karakter, ada angka atau simbol

Implementasi: pure derived state dari `watch('newPassword')`, tanpa library tambahan.

---

## Lazy Loading Pattern

Semua tab admin menggunakan pola yang sama:

```tsx
const BusinessHoursTab = lazy(() =>
  import('../components/BusinessHoursSettings').then(m => ({ default: m.BusinessHoursSettings }))
);
const SoundSettingsTab = lazy(() =>
  import('./SoundSettingsPage').then(m => ({ default: m.SoundSettingsPage }))
);
```

Dibungkus `<Suspense>` dengan loading skeleton standardized di atas.

---

## Files to Delete

- `apps/frontend/src/features/settings/pages/SettingsPage.tsx` — tidak ada route, tidak diimport di mana pun
- `apps/frontend/src/features/settings/pages/AccessTypeSettings.tsx` — hanya diimport oleh BentoSettingsPage, tidak ada consumer lain setelah tab dihapus

---

## Out of Scope

- Tidak ada perubahan pada backend
- Tidak ada perubahan routing (`AppRoutes.tsx`)
- Tidak ada perubahan pada komponen form (semua sudah functional)
- Tidak ada perubahan pada `DynamicFormBuilderModal.tsx` dan komponen eform lainnya

---

## Implementation Order

1. Hapus `SettingsPage.tsx`
2. Edit `BentoSettingsPage.tsx`:
   a. Hapus import dan tab `access-forms`
   b. Tambah lazy import `BusinessHoursSettings` dan `SoundSettingsPage`
   c. Tambah tab trigger di sidebar (Administration section)
   d. Tambah tab content dengan Suspense
   e. Redesign sidebar styling (Clean Card)
   f. Standardize loading skeleton semua admin tabs
3. Tambah password strength indicator di `SecuritySettingsForm`

---

## Success Criteria

- [ ] Tab Access Forms tidak muncul di sidebar
- [ ] Tab Business Hours dan Sound Settings muncul dan load dengan benar (admin only)
- [ ] `SettingsPage.tsx` dihapus, tidak ada TypeScript error
- [ ] Sidebar styling menggunakan Clean Card (active item: blue-50 bg + left border)
- [ ] Semua tab admin memiliki loading skeleton yang konsisten
- [ ] Password strength indicator tampil di Security tab
- [ ] Light mode dan dark mode keduanya terlihat baik
