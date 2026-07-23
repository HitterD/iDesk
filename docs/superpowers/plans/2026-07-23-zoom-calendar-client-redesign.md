# Zoom Calendar Client Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesain halaman Client Zoom Booking (`/client/zoom-calendar`) dari layout terpusat 1 kolom menjadi 2-kolom split-screen (Kiri: Form Booking dengan custom time/duration selector | Kanan: Daftar Zoom Meeting lengkap yang default ke "Semua").

**Architecture:** Mengubah layout utama `ClientZoomBookingPage.tsx` menjadi CSS Grid 12 kolom (`lg:col-span-5` dan `lg:col-span-7`), mengintegrasikan `ZoomTimeSelect` dan merapikan dropdown durasi pada `SimpleBookingForm.tsx`, serta memperbarui default tab `ZoomMyBookingsView.tsx` menjadi `'all'`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, React Query, `date-fns`.

---

### Task 1: Redesain Layout Grid 2 Kolom di `ClientZoomBookingPage.tsx`

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx`

- [ ] **Step 1: Edit `ClientZoomBookingPage.tsx` untuk menggunakan grid 2-kolom**

Ubah file `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx` menjadi:

```tsx
import { Video, Calendar } from 'lucide-react';
import { SimpleBookingForm, ZoomMyBookingsView } from '../components';

export function ClientZoomBookingPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-6 animate-fade-in-up">
            {/* Header Page */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Video aria-hidden="true" className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Booking Zoom</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Buat jadwal meeting Zoom baru dan kelola seluruh daftar meeting Anda
                        </p>
                    </div>
                </div>
            </div>

            {/* Split Grid View (40% Kiri - 60% Kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Kolom Kiri: Form Booking Card */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card p-5 shadow-sm sticky top-6">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Form Booking Zoom</h2>
                    </div>
                    <SimpleBookingForm />
                </div>

                {/* Kolom Kanan: Panel Daftar Zoom Lengkap */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                    <ZoomMyBookingsView />
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Jalankan typecheck frontend**

Run: `npx tsc --noEmit -p apps/frontend/tsconfig.json`
Expected: Output 0 errors.

---

### Task 2: Integrasi Custom Time Select & Duration Select pada `SimpleBookingForm.tsx`

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`

- [ ] **Step 1: Update `SimpleBookingForm.tsx` menggunakan `ZoomTimeSelect` dan opsi jam/durasi yang presisi**

Modifikasi bagian pemanggilan jam dan durasi pada `SimpleBookingForm.tsx` untuk mengimpor `ZoomTimeSelect` dan meng-generate opsi waktu `00:00` sampai `23:30`:

```tsx
// Opsi time slots 00:00 - 23:30
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0');
    const min = i % 2 === 0 ? '00' : '30';
    return { time: `${hour}:${min}` };
});
```

Dan gantikan input `startTime` pada JSX dengan:

```tsx
<ZoomTimeSelect
    label="Jam Mulai *"
    value={startTime}
    onChange={(t) => setStartTime(t)}
    options={TIME_OPTIONS}
    placeholder="Pilih jam"
/>
```

Serta poles dropdown `Durasi` menggunakan item yang membulat (*soft rounded pills*) dengan tanda centang (*checkmark*).

- [ ] **Step 2: Jalankan typecheck frontend**

Run: `npx tsc --noEmit -p apps/frontend/tsconfig.json`
Expected: Output 0 errors.

---

### Task 3: Ubah Default Tab menjadi "Semua" (`'all'`) pada `ZoomMyBookingsView.tsx`

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx`

- [ ] **Step 1: Set `defaultTab` ke `'all'` pada `ZoomMyBookingsView.tsx`**

Buka `apps/frontend/src/features/zoom-booking/components/ZoomMyBookingsView.tsx` dan ubah:

```tsx
- const [tab, setTab] = useState<BookingTab>('upcoming');
+ const [tab, setTab] = useState<BookingTab>('all');
```

Serta pastikan kontainer utama daftar meeting memiliki scrollbar yang nyaman dan tampilan card yang bersih.

- [ ] **Step 2: Jalankan typecheck frontend**

Run: `npx tsc --noEmit -p apps/frontend/tsconfig.json`
Expected: Output 0 errors.

---

### Task 4: Verifikasi & Test Build Frontend

- [ ] **Step 1: Build frontend**

Run: `npm run build --prefix apps/frontend`
Expected: Build sukses tanpa error.
