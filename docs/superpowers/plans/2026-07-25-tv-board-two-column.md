# TV Board Two-Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TV Board publik hanya menampilkan kolom Open dan In Progress dengan rasio 40:60, auto-scroll berfungsi saat tiket banyak, dan kartu menonjolkan assignee serta menampilkan department requester.

**Architecture:** Backend `TvBoardService` berhenti query dan mengirim tiket RESOLVED, lalu menambah `requesterDepartment` dari relasi `user.department`. Frontend mengunci tinggi halaman ke `100dvh` supaya kolom benar-benar overflow (ini akar masalah auto-scroll — hook `useColumnAutoScroll` sudah benar), memakai grid 5 kolom dengan span 2:3, dan merombak bagian bawah kartu.

**Tech Stack:** NestJS + TypeORM + Jest (backend), React + Vite + Tailwind + Vitest + Testing Library (frontend).

## Global Constraints

- Spec sumber: `docs/superpowers/specs/2026-07-25-tv-board-two-column-design.md`.
- Department memakai `department.code`, fallback `department.name`, null bila keduanya kosong.
- `useColumnAutoScroll.ts` TIDAK boleh diubah — hooknya sudah benar.
- Gaya auto-scroll tetap: turun → jeda → naik → jeda, 40px/detik, jeda 2500ms, per kolom independen.
- Ukuran kartu tetap di semua lebar layar — dilarang menambah breakpoint `2xl:` untuk memperbesar teks.
- Dilarang menampilkan hitungan resolved dalam bentuk apa pun.
- Semua teks UI berbahasa Indonesia.
- Perintah test backend: `npm test` di `apps/backend`. Perintah test frontend: `npm test` di `apps/frontend`.
- Semua perintah dijalankan dari root repo `F:/Program Bagas/SynologyDrive/iDesk-main` dengan `cd` eksplisit ke `apps/backend` atau `apps/frontend`.

---

### Task 1: Backend — hapus kolom Resolved, tambah `requesterDepartment`

**Files:**
- Modify: `apps/backend/src/modules/tv-board/tv-board.service.ts`
- Modify: `apps/backend/src/modules/tv-board/tv-board.service.spec.ts:49-111`
- Modify: `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts:20`

**Interfaces:**
- Consumes: `Ticket` entity (relasi `user`, `assignedTo`), `User.department` → `Department { name, code }`.
- Produces:
  ```ts
  export interface TvBoardCard {
      id: string;
      description: string;
      requesterName: string;
      requesterDepartment: string | null;
      assignedToName: string | null;
      priority: string;
      slaTarget: string | null;
      isOverdue: boolean;
      isOracleRequest: boolean;
  }

  export interface TvBoardData {
      siteName: string;
      siteCode: string;
      open: TvBoardCard[];
      inProgress: TvBoardCard[];
      waitingVendorCount: number;
  }
  ```
  Field `resolved` hilang dari `TvBoardData`. Ini dipakai Task 2 lewat `useTvBoardSocket.ts`.

- [ ] **Step 1: Tulis test yang gagal**

Ganti seluruh blok `describe('getBoardData', ...)` di `apps/backend/src/modules/tv-board/tv-board.service.spec.ts` (baris 49-117) dengan:

```ts
    describe('getBoardData', () => {
        it('groups tickets into open/inProgress columns and counts waiting vendor', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                {
                    id: 't1',
                    status: TicketStatus.TODO,
                    description: 'Printer rusak',
                    user: { fullName: 'Budi', department: { code: 'FIN', name: 'Finance' } },
                    assignedTo: null,
                    priority: TicketPriority.MEDIUM,
                    slaTarget: null,
                    isOverdue: false,
                    ticketType: TicketType.ORACLE_REQUEST,
                },
                {
                    id: 't2',
                    status: TicketStatus.IN_PROGRESS,
                    description: 'Permintaan K2 lama',
                    user: { fullName: 'Ani', department: { code: null, name: 'Human Resource' } },
                    assignedTo: { fullName: 'Agen Oracle' },
                    priority: TicketPriority.HIGH,
                    slaTarget: new Date('2026-07-25'),
                    isOverdue: true,
                    category: 'ORACLE_REQUEST',
                },
            ]);
            ticketRepo.count.mockResolvedValue(3);

            const data = await service.getBoardData('site-1');

            expect(data.siteCode).toBe('SPJ');
            expect(data.open).toHaveLength(1);
            expect(data.open[0]).toMatchObject({ id: 't1', requesterName: 'Budi', isOracleRequest: true });
            expect(data.inProgress).toHaveLength(1);
            expect(data.inProgress[0]).toMatchObject({ id: 't2', assignedToName: 'Agen Oracle', isOverdue: true, isOracleRequest: true });
            expect(data.waitingVendorCount).toBe(3);
        });

        it('never queries or returns resolved tickets', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });

            const data = await service.getBoardData('site-1');

            expect(data).not.toHaveProperty('resolved');
            const query = ticketRepo.find.mock.calls[0][0];
            const statuses = query.where.map((filter: { status: TicketStatus }) => filter.status);
            expect(statuses).toEqual([TicketStatus.TODO, TicketStatus.IN_PROGRESS]);
        });

        it('maps requester department using code, falling back to name, then null', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });
            ticketRepo.find.mockResolvedValue([
                {
                    id: 'a',
                    status: TicketStatus.TODO,
                    description: 'Pakai code',
                    user: { fullName: 'Budi', department: { code: 'IT', name: 'Information Technology' } },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
                {
                    id: 'b',
                    status: TicketStatus.TODO,
                    description: 'Code kosong, pakai name',
                    user: { fullName: 'Ani', department: { code: '', name: 'Human Resource' } },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
                {
                    id: 'c',
                    status: TicketStatus.TODO,
                    description: 'Tanpa department',
                    user: { fullName: 'Cici' },
                    assignedTo: null,
                    priority: TicketPriority.LOW,
                    slaTarget: null,
                    isOverdue: false,
                },
            ]);

            const data = await service.getBoardData('site-1');

            expect(data.open.map((card) => card.requesterDepartment)).toEqual(['IT', 'Human Resource', null]);
        });

        it('loads the department relation so requesterDepartment can be resolved', async () => {
            siteRepo.findOne.mockResolvedValue({ id: 'site-1', name: 'Sampoerna Jaya', code: 'SPJ' });

            await service.getBoardData('site-1');

            expect(ticketRepo.find.mock.calls[0][0].relations).toContain('user.department');
        });

        it('throws NotFoundException when site does not exist', async () => {
            siteRepo.findOne.mockResolvedValue(null);
            await expect(service.getBoardData('missing')).rejects.toThrow(NotFoundException);
        });
    });
```

Blok `afterEach(() => { jest.useRealTimers(); });` di baris 45-47 boleh tetap ada — tidak ada test yang memakai fake timers lagi, tapi menghapusnya tidak wajib dan tidak berbahaya.

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
cd apps/backend && npx jest src/modules/tv-board/tv-board.service.spec.ts
```

Expected: FAIL. Test `never queries or returns resolved tickets` gagal karena `data` masih punya properti `resolved` dan `statuses` masih berisi tiga status. Test department gagal karena `requesterDepartment` bernilai `undefined`.

- [ ] **Step 3: Ubah interface di `tv-board.service.ts`**

Ganti baris 7-25:

```ts
export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    requesterDepartment: string | null;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
}
```

- [ ] **Step 4: Ubah query dan projection di `getBoardData`**

Ganti isi method mulai dari perhitungan `weekStart` (baris 53) sampai akhir method (baris 94) dengan:

```ts
        const tickets = await this.ticketRepo.find({
            where: [
                { siteId, status: TicketStatus.TODO },
                { siteId, status: TicketStatus.IN_PROGRESS },
            ],
            relations: ['user', 'user.department', 'assignedTo'],
            order: { createdAt: 'ASC' },
        });

        const waitingVendorCount = await this.ticketRepo.count({
            where: { siteId, status: TicketStatus.WAITING_VENDOR },
        });

        const toCard = (t: Ticket): TvBoardCard => ({
            id: t.id,
            description: t.description,
            requesterName: t.user?.fullName ?? 'Unknown',
            requesterDepartment:
                t.user?.department?.code || t.user?.department?.name || null,
            assignedToName: t.assignedTo?.fullName ?? null,
            priority: t.priority,
            slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
            isOverdue: t.isOverdue,
            isOracleRequest:
                t.ticketType === TicketType.ORACLE_REQUEST ||
                t.category === 'ORACLE_REQUEST',
        });

        return {
            siteName: site.name,
            siteCode: site.code,
            open: tickets.filter((t) => t.status === TicketStatus.TODO).map(toCard),
            inProgress: tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).map(toCard),
            waitingVendorCount,
        };
    }
}
```

`||` dipakai (bukan `??`) supaya `code` bernilai string kosong ikut jatuh ke `name`.

- [ ] **Step 5: Hapus import `Between` yang tidak terpakai**

Ganti baris 3:

```ts
import { Repository } from 'typeorm';
```

- [ ] **Step 6: Bersihkan fixture gateway spec**

Di `apps/backend/src/modules/tv-board/tv-board.gateway.spec.ts`, hapus baris 20 (`resolved: [],`) dari mock `getBoardData`.

- [ ] **Step 7: Jalankan test untuk memastikan lulus**

```bash
cd apps/backend && npx jest src/modules/tv-board
```

Expected: PASS, semua test di `tv-board.service.spec.ts` dan `tv-board.gateway.spec.ts` hijau.

- [ ] **Step 8: Verifikasi tidak ada referensi `resolved` yang tersisa di modul**

```bash
cd apps/backend && grep -rn "resolved" src/modules/tv-board/
```

Expected: tidak ada baris keluar (kecuali `resolveSiteIdByToken`, yang merupakan kata berbeda dan boleh muncul).

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/tv-board/
git commit -m "feat(tv-board): drop resolved column, add requester department"
```

---

### Task 2: Frontend — dua kolom 40:60 dan perbaikan auto-scroll

**Files:**
- Modify: `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts:4-22`
- Modify: `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` (COLUMNS `:9-37`, root/wrapper `:172-173`, columnData `:158-162`, grid `:206`, section `:212-236`)
- Modify: `apps/frontend/src/features/public/hooks/__tests__/useColumnAutoScroll.test.ts`
- Modify: `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`
- JANGAN diubah: `apps/frontend/src/features/public/hooks/useColumnAutoScroll.ts`

**Interfaces:**
- Consumes: `TvBoardData` dari Task 1 — tanpa `resolved`, dengan `requesterDepartment`.
- Produces: tipe frontend `TvBoardCard` dan `TvBoardData` yang mencerminkan payload Task 1. Task 3 memakai `card.requesterDepartment`.

- [ ] **Step 1: Tulis test auto-scroll yang gagal**

Tambahkan `it` baru di dalam `describe('stepAutoScroll', ...)` pada `apps/frontend/src/features/public/hooks/__tests__/useColumnAutoScroll.test.ts`, setelah test yang sudah ada:

```ts
    it('scrolls down at 40px per second when content overflows', () => {
        expect(stepAutoScroll(
            { phase: 'down', scrollTop: 0, elapsedMs: 0 },
            1000,
            500,
        )).toEqual({ phase: 'down', scrollTop: 40, elapsedMs: 0 });
    });
```

- [ ] **Step 2: Tulis test halaman yang gagal**

Ganti seluruh isi `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx` dengan:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { BentoTvBoardPage } from '../BentoTvBoardPage';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({
            data: {
                siteName: 'Sampoerna Jaya',
                siteCode: 'SPJ',
                open: [
                    { id: 't1', description: 'Akses Oracle gagal', requesterName: 'Budi', requesterDepartment: 'FIN', assignedToName: null, priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: true },
                    { id: 't2', description: 'Printer rusak', requesterName: 'Cici', requesterDepartment: null, assignedToName: 'Agen B', priority: 'CRITICAL', slaTarget: '2026-07-25T00:00:00.000Z', isOverdue: true, isOracleRequest: false },
                ],
                inProgress: [
                    { id: 't3', description: 'Jaringan lambat', requesterName: 'Muhammad Bagas Saputra Wijaya', requesterDepartment: 'IT', assignedToName: 'Agen A', priority: 'HIGH', slaTarget: null, isOverdue: false, isOracleRequest: false },
                ],
                waitingVendorCount: 2,
            },
        })),
    },
}));

vi.mock('../../hooks/useTvBoardSocket', () => ({
    useTvBoardSocket: () => ({ boardData: null, isConnected: true }),
}));

function renderBoard(entry = '/tv/abc-token') {
    return render(
        <MemoryRouter initialEntries={[entry]}>
            <Routes>
                <Route path="/tv/:token" element={<BentoTvBoardPage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('BentoTvBoardPage', () => {
    it('renders only Open and In Progress columns', async () => {
        renderBoard();

        expect(await screen.findByText('Sampoerna Jaya')).toBeInTheDocument();
        expect(screen.getByText(/Open/)).toBeInTheDocument();
        expect(screen.getByText(/In Progress/)).toBeInTheDocument();
        expect(screen.queryByText(/Resolved/)).not.toBeInTheDocument();
        expect(screen.queryByText('(Minggu ini)')).not.toBeInTheDocument();
        expect(screen.getByText(/Waiting Vendor: 2/)).toBeInTheDocument();
    });

    it('gives Open 2 of 5 grid columns and In Progress 3 of 5', async () => {
        renderBoard();

        const openSection = (await screen.findByText('Open')).closest('section');
        const inProgressSection = (await screen.findByText('In Progress')).closest('section');
        expect(openSection?.className).toContain('md:col-span-2');
        expect(inProgressSection?.className).toContain('md:col-span-3');
    });

    it('locks page height so columns overflow instead of the page', async () => {
        const { container } = renderBoard();
        await screen.findByText('Sampoerna Jaya');

        const root = container.firstElementChild as HTMLElement;
        expect(root.className).toContain('h-[100dvh]');
        expect(root.className).toContain('overflow-hidden');
        expect(root.className).not.toContain('min-h-[100dvh]');
    });

    it('shows overdue indicator (red border) on overdue card but not on normal card', async () => {
        renderBoard();

        const overdueCard = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        const normalCard = (await screen.findByText('Akses Oracle gagal')).closest('div[data-testid="tv-board-card"]');
        expect(overdueCard?.className).toContain('border-red-600');
        expect(normalCard?.className).not.toContain('border-red-600');
    });

    it('shows the Oracle/K2 badge', async () => {
        renderBoard();
        expect(await screen.findByText('ORACLE / K2')).toBeInTheDocument();
    });

    it('shows error page for invalid token', async () => {
        const api = (await import('@/lib/api')).default;
        (api.get as any).mockRejectedValueOnce({ response: { status: 404 } });

        renderBoard('/tv/bad-token');

        expect(await screen.findByText(/Link tidak valid/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

```bash
cd apps/frontend && npx vitest run --pool=forks src/features/public
```

Expected: FAIL. `renders only Open and In Progress columns` gagal karena teks "Resolved" masih ada. `gives Open 2 of 5 grid columns` gagal karena `md:col-span-2` belum ada. `locks page height` gagal karena root masih `min-h-[100dvh]`. Test `scrolls down at 40px per second` seharusnya PASS — hook memang sudah benar, dan test ini mengunci perilakunya agar tidak rusak.

- [ ] **Step 4: Perbarui tipe socket**

Di `apps/frontend/src/features/public/hooks/useTvBoardSocket.ts`, ganti baris 4-22:

```ts
export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    requesterDepartment: string | null;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
}
```

- [ ] **Step 5: Ubah konfigurasi COLUMNS**

Di `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`, ganti baris 9-37:

```tsx
const COLUMNS: Array<{
    key: 'open' | 'inProgress';
    title: string;
    icon: React.ElementType;
    headerAccent: string;
    span: string;
    emptyMessage: string;
}> = [
    {
        key: 'open',
        title: 'Open',
        icon: Inbox,
        headerAccent: 'border-t-4 border-slate-400',
        span: 'md:col-span-2',
        emptyMessage: 'Tidak ada tiket dalam antrean Open',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        icon: CircleDot,
        headerAccent: 'border-t-4 border-blue-500',
        span: 'md:col-span-3',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
    },
];
```

- [ ] **Step 6: Hapus import `CheckCircle2`**

Ganti baris 3:

```tsx
import { Clock, Inbox, CircleDot, AlertTriangle, User, UserCheck } from 'lucide-react';
```

- [ ] **Step 7: Ubah `columnData`**

Ganti baris 158-162:

```tsx
    const columnData: Record<'open' | 'inProgress', TvBoardCard[]> = {
        open: data.open,
        inProgress: data.inProgress,
    };
```

- [ ] **Step 8: Kunci tinggi halaman**

Ganti baris 172-173:

```tsx
        <div className="h-[100dvh] overflow-hidden bg-[#edf2f7] p-4 font-sans text-slate-900 md:p-6">
            <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-4 md:gap-6">
```

Ini akar perbaikan auto-scroll: dengan tinggi tetap, `min-h-0 flex-1` pada grid memaksa kolom menyusut ke tinggi tersedia, sehingga `scrollHeight - clientHeight` di `useColumnAutoScroll.ts:69` akhirnya bernilai positif.

- [ ] **Step 9: Ubah grid dan section**

Ganti baris 206 (pembuka grid):

```tsx
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
```

Lalu ganti blok `<section ...>` beserta header kolom di baris 212-226 dengan:

```tsx
                            <section
                                key={column.key}
                                className={`flex min-h-0 flex-col rounded-[24px] bg-slate-100/80 p-1 ring-1 ring-slate-200/80 motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${column.span} ${column.headerAccent}`}
                            >
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white">
                                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-5">
                                        <div className="flex items-center gap-2">
                                            <ColumnIcon className="h-4 w-4 text-slate-500" />
                                            <h2 className="text-base font-bold text-slate-900">{column.title}</h2>
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums text-slate-900">{items.length}</span>
                                    </div>
```

`min-h-[280px]` dihapus karena memaksa tinggi minimum yang melawan `min-h-0` dan menahan kolom agar tidak menyusut. Blok kondisional `column.key === 'resolved'` dengan teks `(Minggu ini)` ikut hilang.

- [ ] **Step 10: Jalankan test untuk memastikan lulus**

```bash
cd apps/frontend && npx vitest run --pool=forks src/features/public
```

Expected: PASS semua, kecuali test yang meng-assert department/assignee (belum ada di Task 2 — memang belum ditulis).

- [ ] **Step 11: Verifikasi TypeScript bersih**

```bash
cd apps/frontend && npx tsc -b --noEmit
```

Expected: exit code 0, tanpa error. Kalau ada error "Property 'resolved' does not exist", berarti masih ada referensi tersisa — cari dengan `grep -rn "resolved" src/features/public/`.

- [ ] **Step 12: Commit**

```bash
git add apps/frontend/src/features/public/
git commit -m "feat(tv-board): two columns at 40:60 with working auto-scroll"
```

---

### Task 3: Kartu — assignee menonjol dan requester dua baris

**Files:**
- Modify: `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx` (helper baru sebelum `TvBoardCardView`, badan kartu `:39-90`)
- Modify: `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`

**Interfaces:**
- Consumes: `card.requesterDepartment` dari Task 1/2.
- Produces: helper lokal `getInitials(name: string): string` dan `getAvatarColor(name: string): string` di dalam `BentoTvBoardPage.tsx`. Keduanya tidak diekspor — hanya dipakai kartu.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan `describe` baru di akhir `apps/frontend/src/features/public/pages/__tests__/BentoTvBoardPage.smoke.test.tsx`, di dalam `describe('BentoTvBoardPage', ...)`:

```tsx
    it('shows requester name and department on separate lines', async () => {
        renderBoard();

        const requester = await screen.findByText('Muhammad Bagas Saputra Wijaya');
        expect(requester).toHaveAttribute('title', 'Muhammad Bagas Saputra Wijaya');
        expect(requester.className).toContain('truncate');
        expect(screen.getByText('IT')).toBeInTheDocument();
    });

    it('omits the department line when the requester has none', async () => {
        renderBoard();

        const card = (await screen.findByText('Printer rusak')).closest('div[data-testid="tv-board-card"]');
        expect(card).not.toBeNull();
        expect(card?.querySelector('[data-testid="tv-board-department"]')).toBeNull();
    });

    it('shows assignee initials and name prominently', async () => {
        renderBoard();

        const assignee = await screen.findByText('Agen A');
        expect(assignee.className).toContain('font-bold');
        const card = assignee.closest('div[data-testid="tv-board-card"]');
        expect(card?.textContent).toContain('AA');
    });

    it('flags unassigned tickets in amber', async () => {
        renderBoard();

        const unassigned = await screen.findByText('Belum ditugaskan');
        expect(unassigned.className).toContain('text-amber');
    });
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

```bash
cd apps/frontend && npx vitest run --pool=forks src/features/public/pages
```

Expected: FAIL. Teks `IT` dan `Belum ditugaskan` tidak ditemukan; nama assignee belum `font-bold`; inisial `AA` belum ada.

- [ ] **Step 3: Tambahkan helper inisial dan warna**

Di `apps/frontend/src/features/public/pages/BentoTvBoardPage.tsx`, sisipkan tepat sebelum `function TvBoardCardView` (baris 39):

```tsx
const AVATAR_COLORS = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-violet-600',
    'bg-orange-600',
    'bg-cyan-700',
    'bg-rose-600',
];

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = (hash * 31 + name.charCodeAt(i)) % 2147483647;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
```

Hash dipakai supaya satu orang selalu dapat warna sama di setiap render dan di setiap TV.

- [ ] **Step 4: Rombak bagian bawah kartu**

Di `TvBoardCardView`, ganti paragraf deskripsi (`<p className="mb-5 line-clamp-3 ...">`) beserta seluruh blok footer lama sesudahnya — yaitu `<div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">` dan kedua `<span>` di dalamnya — dengan:

```tsx
                <p className="mb-4 line-clamp-3 text-lg font-bold leading-snug tracking-[-0.01em] text-slate-900">
                    {card.description}
                </p>

                <div className="flex min-w-0 items-start gap-1.5">
                    <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-slate-600" title={card.requesterName}>
                            {card.requesterName}
                        </p>
                        {card.requesterDepartment && (
                            <p
                                data-testid="tv-board-department"
                                className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                            >
                                {card.requesterDepartment}
                            </p>
                        )}
                    </div>
                </div>

                {card.assignedToName ? (
                    <div className="mt-3 flex min-w-0 items-center gap-2.5 border-t border-slate-100 pt-3">
                        <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(card.assignedToName)}`}
                        >
                            {getInitials(card.assignedToName)}
                        </span>
                        <span className="min-w-0 truncate text-sm font-bold text-slate-900" title={card.assignedToName}>
                            {card.assignedToName}
                        </span>
                    </div>
                ) : (
                    <div className="mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400">
                            <UserCheck className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold text-amber-600">Belum ditugaskan</span>
                    </div>
                )}
```

Nama assignee juga `truncate` dengan `title` — assignee bisa bernama panjang sama seperti requester.

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

```bash
cd apps/frontend && npx vitest run --pool=forks src/features/public
```

Expected: PASS semua test di `BentoTvBoardPage.smoke.test.tsx` dan `useColumnAutoScroll.test.ts`.

- [ ] **Step 6: Jalankan test dan build lengkap frontend**

```bash
cd apps/frontend && npm test && npx tsc -b --noEmit
```

Expected: seluruh suite frontend hijau, tsc exit code 0.

- [ ] **Step 7: Jalankan test lengkap backend**

```bash
cd apps/backend && npm test
```

Expected: seluruh suite backend hijau. Kalau ada spec lain di luar modul tv-board yang menyentuh `TvBoardData.resolved`, perbaiki di sini — cari dengan `grep -rn "TvBoardData" src/`.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/public/
git commit -m "feat(tv-board): highlight assignee, show requester department"
```

---

## Verifikasi Manual

Setelah Task 3 selesai, jalankan aplikasi dan buka `/tv/<token>` di browser dengan viewport tinggi 1080px:

1. Hanya dua kolom terlihat, Open lebih sempit daripada In Progress (rasio kira-kira 40:60).
2. Halaman tidak punya scrollbar sendiri — hanya kolom yang scroll.
3. Isi kolom dengan lebih dari 10 tiket: kolom bergulir turun pelan, berhenti di bawah, lalu naik lagi.
4. Nama assignee terbaca dari jarak beberapa meter; tiket tanpa assignee menampilkan "Belum ditugaskan" berwarna amber.
5. Requester bernama panjang terpotong rapi dengan `…`, kode department tampil di baris bawahnya.

## Non-goals

- Tidak mengubah `useColumnAutoScroll.ts`.
- Tidak mengubah kanban internal di `apps/frontend/src/features/ticket-board/`.
- Tidak mengubah endpoint, token, atau kontrol akses TV Board.
