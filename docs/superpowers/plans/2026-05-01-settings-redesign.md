# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hapus tab Access Forms, tambah tab Business Hours & Sound Settings, redesign sidebar Clean Card, tambah password strength indicator, hapus file-file yang tidak terpakai.

**Architecture:** Semua perubahan ada di `BentoSettingsPage.tsx` (halaman aktif di `/settings`) dan `SecuritySettingsForm.tsx`. Tidak ada perubahan backend, routing, atau komponen form lainnya. Dua file lama dihapus tanpa pengganti.

**Tech Stack:** React 18, Radix UI Tabs, Tailwind CSS, TanStack Query, react-hook-form, Lucide React

---

### Task 1: Hapus file yang tidak terpakai

**Files:**
- Delete: `apps/frontend/src/features/settings/pages/SettingsPage.tsx`
- Delete: `apps/frontend/src/features/settings/pages/AccessTypeSettings.tsx`

- [ ] **Step 1: Verifikasi tidak ada consumer lain**

```bash
grep -rn "SettingsPage\|AccessTypeSettings" apps/frontend/src --include="*.tsx" --include="*.ts" | grep -v "BentoSettingsPage\|\.tsx:export\|\.tsx:import.*from '\."
```

Expected: tidak ada output (hanya self-definition dan BentoSettingsPage yang akan segera kita edit).

- [ ] **Step 2: Hapus kedua file**

```bash
rm apps/frontend/src/features/settings/pages/SettingsPage.tsx
rm apps/frontend/src/features/settings/pages/AccessTypeSettings.tsx
```

- [ ] **Step 3: Verifikasi TypeScript tidak error**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error terkait file yang dihapus.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(settings): remove unused SettingsPage and AccessTypeSettings files"
```

---

### Task 2: Hapus tab Access Forms dari BentoSettingsPage

**Files:**
- Modify: `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`

- [ ] **Step 1: Hapus lazy import AccessTypeSettings**

Di `BentoSettingsPage.tsx`, hapus baris ini (sekitar line 14-15):

```tsx
// HAPUS baris ini:
const AccessTypeSettingsTab = lazy(() => import('./AccessTypeSettings').then(m => ({ default: m.AccessTypeSettings })));
```

- [ ] **Step 2: Hapus tab trigger Access Forms dari sidebar**

Cari dan hapus object `{ value: 'access-forms', icon: FileText, label: 'Access Forms' }` dari array tabs Administration:

```tsx
// SEBELUM — array Administration tabs:
{[
    { value: 'sla', icon: Clock, label: 'SLA Settings' },
    { value: 'storage', icon: HardDrive, label: 'Storage' },
    { value: 'access-forms', icon: FileText, label: 'Access Forms' },  // ← HAPUS ini
    { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
    { value: 'zoom', icon: Video, label: 'Zoom Settings' },
]}

// SETELAH:
{[
    { value: 'sla', icon: Clock, label: 'SLA Settings' },
    { value: 'storage', icon: HardDrive, label: 'Storage' },
    { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
    { value: 'zoom', icon: Video, label: 'Zoom Settings' },
]}
```

- [ ] **Step 3: Hapus Tabs.Content block access-forms**

Hapus seluruh block ini (sekitar line 182-192):

```tsx
// HAPUS seluruh block ini:
{user?.role === 'ADMIN' && (
    <Tabs.Content value="access-forms" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <AccessTypeSettingsTab />
        </Suspense>
    </Tabs.Content>
)}
```

- [ ] **Step 4: Hapus import FileText jika tidak dipakai**

Cek apakah `FileText` masih dipakai di file. Jika tidak, hapus dari import:

```tsx
// SEBELUM:
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, Loader2, HardDrive, FileText, Shield, Video } from 'lucide-react';

// SETELAH (jika FileText tidak terpakai):
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, Loader2, HardDrive, Shield, Video } from 'lucide-react';
```

- [ ] **Step 5: Verifikasi TypeScript tidak error**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx
git commit -m "feat(settings): remove access-forms tab from settings page"
```

---

### Task 3: Tambah tab Business Hours dan Sound Settings

**Files:**
- Modify: `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`

- [ ] **Step 1: Tambah lazy imports baru**

Di bawah import `ZoomSettingsTab` (sekitar line 16), tambahkan:

```tsx
const BusinessHoursTab = lazy(() => import('../components/BusinessHoursSettings').then(m => ({ default: m.BusinessHoursSettings })));
const SoundSettingsTab = lazy(() => import('./SoundSettingsPage').then(m => ({ default: m.SoundSettingsPage })));
```

- [ ] **Step 2: Tambah icon Volume2 dan CalendarClock ke import lucide**

```tsx
// SEBELUM:
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, Loader2, HardDrive, Shield, Video } from 'lucide-react';

// SETELAH:
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, CalendarClock, Loader2, HardDrive, Shield, Video, Volume2 } from 'lucide-react';
```

- [ ] **Step 3: Tambah tab triggers di sidebar Administration**

```tsx
// SEBELUM:
{[
    { value: 'sla', icon: Clock, label: 'SLA Settings' },
    { value: 'storage', icon: HardDrive, label: 'Storage' },
    { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
    { value: 'zoom', icon: Video, label: 'Zoom Settings' },
]}

// SETELAH:
{[
    { value: 'sla', icon: Clock, label: 'SLA Settings' },
    { value: 'storage', icon: HardDrive, label: 'Storage' },
    { value: 'business-hours', icon: CalendarClock, label: 'Business Hours' },
    { value: 'sound', icon: Volume2, label: 'Sound Settings' },
    { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
    { value: 'zoom', icon: Video, label: 'Zoom Settings' },
]}
```

- [ ] **Step 4: Tambah Tabs.Content untuk Business Hours**

Tambahkan setelah block `storage` Tabs.Content dan sebelum block `ip-whitelist`:

```tsx
{user?.role === 'ADMIN' && (
    <Tabs.Content value="business-hours" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-400">Memuat...</p>
                </div>
            </div>
        }>
            <BusinessHoursTab />
        </Suspense>
    </Tabs.Content>
)}
```

- [ ] **Step 5: Tambah Tabs.Content untuk Sound Settings**

Tambahkan langsung setelah block `business-hours`:

```tsx
{user?.role === 'ADMIN' && (
    <Tabs.Content value="sound" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-400">Memuat...</p>
                </div>
            </div>
        }>
            <SoundSettingsTab />
        </Suspense>
    </Tabs.Content>
)}
```

- [ ] **Step 6: Verifikasi TypeScript tidak error**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx
git commit -m "feat(settings): add Business Hours and Sound Settings tabs"
```

---

### Task 4: Redesign sidebar Clean Card + standardize loading skeleton

**Files:**
- Modify: `apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx`

- [ ] **Step 1: Update sidebar container styling**

Ganti className container sidebar dari:

```tsx
<div className="w-full md:w-72 bg-slate-50/50 dark:bg-slate-800/30 border-r border-slate-200/50 dark:border-slate-700/50 p-6 flex flex-col gap-8 flex-shrink-0">
```

Menjadi:

```tsx
<div className="w-full md:w-72 bg-white/80 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-700/80 p-5 flex flex-col gap-6 flex-shrink-0">
```

- [ ] **Step 2: Update section header styling**

Ganti className h3 section header (ada 2: Personal dan Administration) dari:

```tsx
<h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-3">
```

Menjadi:

```tsx
<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-2">
```

- [ ] **Step 3: Update semua Tabs.Trigger styling di sidebar**

Ganti className Tabs.Trigger di **kedua** Tabs.List (Personal dan Administration):

```tsx
// SEBELUM:
className="group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm text-left outline-none"

// SETELAH:
className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors duration-150 border-l-2 border-transparent data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-500 data-[state=active]:font-semibold text-left outline-none"
```

- [ ] **Step 4: Ganti icon rendering menjadi icon container**

Ganti:

```tsx
<tab.icon className="w-4 h-4 group-data-[state=active]:text-primary opacity-70 group-data-[state=active]:opacity-100 transition-opacity" />
{tab.label}
```

Menjadi:

```tsx
<div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-blue-100 dark:group-data-[state=active]:bg-blue-900/50 transition-colors duration-150">
    <tab.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-data-[state=active]:text-blue-600 dark:group-data-[state=active]:text-blue-400 transition-colors duration-150" />
</div>
{tab.label}
```

- [ ] **Step 5: Standardize semua loading skeleton admin tabs**

Ganti semua `Suspense fallback` yang menggunakan `Loader2 className="w-8 h-8 animate-spin text-primary"` dengan skeleton yang konsisten:

```tsx
// Ganti SEMUA fallback ini (ada di SLA, Storage, IP Whitelist, Zoom — dan sudah konsisten di Business Hours/Sound dari Task 3):
<div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
</div>

// MENJADI:
<div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Memuat...</p>
    </div>
</div>
```

Ada 4 lokasi yang perlu diubah: sla, storage, ip-whitelist, zoom.

- [ ] **Step 6: Update content area padding**

Ganti className div content area dari:

```tsx
<div className="flex-1 p-8 md:p-10 lg:p-12 overflow-y-auto">
```

Menjadi:

```tsx
<div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/10">
```

- [ ] **Step 7: Verifikasi TypeScript tidak error**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/settings/pages/BentoSettingsPage.tsx
git commit -m "feat(settings): redesign sidebar with Clean Card style, standardize loading skeletons"
```

---

### Task 5: Tambah password strength indicator ke SecuritySettingsForm

**Files:**
- Modify: `apps/frontend/src/features/settings/components/SecuritySettingsForm.tsx`

- [ ] **Step 1: Tambah helper function getPasswordStrength**

Tambahkan sebelum `export const SecuritySettingsForm`:

```tsx
const getPasswordStrength = (pwd: string): { level: number; label: string; colorBar: string; colorText: string } => {
    if (!pwd) return { level: 0, label: '', colorBar: '', colorText: '' };
    const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    if (pwd.length < 8) return { level: 1, label: 'Lemah', colorBar: 'bg-red-500', colorText: 'text-red-500' };
    if (!hasNumberOrSymbol) return { level: 2, label: 'Sedang', colorBar: 'bg-yellow-500', colorText: 'text-yellow-500' };
    return { level: 3, label: 'Kuat', colorBar: 'bg-green-500', colorText: 'text-green-500' };
};
```

- [ ] **Step 2: Derive strength di dalam komponen**

Di dalam `SecuritySettingsForm`, setelah `const newPassword = watch('newPassword');`, tambahkan:

```tsx
const passwordStrength = getPasswordStrength(newPassword || '');
```

- [ ] **Step 3: Render strength indicator setelah input Kata Sandi Baru**

Tambahkan setelah `{errors.newPassword && ...}` di block "Kata Sandi Baru":

```tsx
{newPassword && (
    <div className="space-y-1.5 mt-2">
        <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                        i <= passwordStrength.level
                            ? passwordStrength.colorBar
                            : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                />
            ))}
        </div>
        <p className={`text-[11px] font-medium ${passwordStrength.colorText}`}>
            Kekuatan kata sandi: {passwordStrength.label}
        </p>
    </div>
)}
```

- [ ] **Step 4: Verifikasi TypeScript tidak error**

```bash
cd apps/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/settings/components/SecuritySettingsForm.tsx
git commit -m "feat(settings): add password strength indicator to security form"
```

---

### Task 6: Verifikasi akhir

- [ ] **Step 1: Jalankan TypeScript check penuh**

```bash
cd apps/frontend && npx tsc --noEmit
```

Expected: exit code 0, no errors.

- [ ] **Step 2: Cek tidak ada import yang tertinggal dari file yang dihapus**

```bash
grep -rn "AccessTypeSettings\|from.*SettingsPage['\"]" apps/frontend/src --include="*.tsx" --include="*.ts"
```

Expected: tidak ada output.

- [ ] **Step 3: Verifikasi manual di browser (checklist)**

Buka `/settings` sebagai ADMIN dan verifikasi:
- [ ] Tab "Access Forms" tidak muncul di sidebar
- [ ] Tab "Business Hours" muncul dan kontennya load (jam kerja, hari aktif, dll)
- [ ] Tab "Sound Settings" muncul dan kontennya load
- [ ] Sidebar active item tampil dengan background biru + left border biru
- [ ] Hover state sidebar smooth (bg-slate-100)
- [ ] Icon di sidebar ada dalam container square rounded-md
- [ ] Semua loading skeleton konsisten (spinner kecil + teks "Memuat...")
- [ ] Dark mode sidebar terlihat benar
- [ ] Tab Security → input password → strength indicator muncul (merah/kuning/hijau)
- [ ] Light mode semua tab terlihat benar

- [ ] **Step 4: Final commit jika ada adjustment kecil**

```bash
git add -A
git commit -m "fix(settings): final adjustments after manual verification"
```
