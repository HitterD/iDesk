# Simplifikasi Booking Zoom Client Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti flow booking Zoom di `/client/zoom-calendar` dengan form simpel satu-jam-langsung-pesan (tanpa pilih akun Zoom, recurring opsional ringkas), diikuti list booking existing di bawahnya. Halaman admin/agent/manager (`/zoom-calendar`, `/manager/zoom-calendar`) tidak berubah sama sekali.

**Architecture:** Endpoint baru `GET /zoom-booking/availability` melakukan dry-run terhadap logic conflict-check yang sudah ada di `createBooking` (tanpa menulis ke DB). Frontend dapat 1 halaman baru (`ClientZoomBookingPage`) + 2 komponen baru (`SimpleBookingForm`, `SimpleRecurringField`) + 1 hook baru (`useCheckAvailability`), me-reuse `ZoomMyBookingsView` 100% apa adanya. `CreateBookingDto.zoomAccountId` diubah dari required jadi optional di backend DTO dan frontend type — cascade fallback existing di `createBooking` sudah otomatis menangani kasus ini tanpa perubahan logic lain.

**Tech Stack:** NestJS + TypeORM + class-validator (backend), React + React Query + react-router-dom + Vitest (frontend).

## Global Constraints

- Tidak ada file `ZoomCalendarPage.tsx`, `ZoomBookingForm.tsx`, `ZoomAdminController`, atau service backend booking/cascade/rrule/conflict-check yang boleh diubah strukturnya — spec eksplisit melarang ini (`docs/superpowers/specs/2026-07-22-client-zoom-booking-simplify-design.md:16`).
- Endpoint availability check adalah **read-only dry-run** — tidak boleh menulis ke DB, tidak boleh reserve akun (spec baris 37).
- Route `/zoom-calendar` (admin/agent) dan `/manager/zoom-calendar` tetap pakai `ZoomCalendarPage` — hanya route `/client/zoom-calendar` (`AppRoutes.tsx:286`) yang diarahkan ke komponen baru.
- Judul booking: required, 5-100 karakter (sama seperti validasi `CreateBookingDto.title` di `booking.dto.ts:24-29`).
- Deskripsi: opsional, ≤500 karakter.
- Semua teks UI berbahasa Indonesia, konsisten dengan komponen existing (`ZoomBookingForm.tsx`, `ZoomMyBookingsView.tsx`).
- Race-condition window antara availability-check dan submit ditangani lewat error message dari `createBooking` apa adanya di submit handler, bukan locking (spec baris 37, 63).
- Availability query adalah trust boundary: `date` wajib kalender valid `YYYY-MM-DD`, `startTime` wajib `HH:mm`, dan `durationMinutes` wajib integer 30-240. Endpoint menolak input invalid dengan `BadRequestException` sebelum memanggil service.
- Durasi form wajib dari `GET /zoom-booking/settings/durations` melalui hook existing `useDurationOptions`; jangan pakai daftar konstanta lokal karena backend dapat mengubah `allowedDurations`.

## Plan Corrections — 2026-07-22

Bagian ini menggantikan langkah Task 2, Task 3, dan Task 6 yang bertentangan dengan global constraints atau membuat test gagal.

### Task 2 correction — service test fixture dan validasi durasi

`getSettings()` memanggil `settingsRepo.findOne()`, bukan `find()`. Test fixture harus menyediakan `findOne`, `create`, dan `save`; import entity dari `../../entities`; import `AuditService` dari `../../../audit/audit.service`. Gunakan helper tanggal lokal supaya test tidak basi:

```typescript
const futureDate = (days = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const settingsRepo = {
    findOne: jest.fn().mockResolvedValue({
        id: 'settings-1',
        advanceBookingDays: 30,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        blockedDates: [],
        allowedDurations: [30, 60, 90, 120],
    }),
    create: jest.fn(),
    save: jest.fn(),
};
```

Tambahkan setelah `const settings = await this.getSettings();` di `checkAvailability()`:

```typescript
        if (!settings.allowedDurations.includes(durationMinutes)) {
            return {
                available: false,
                reason: `Durasi harus salah satu dari: ${settings.allowedDurations.join(', ')} menit.`,
            };
        }
```

Ganti semua penggunaan tanggal statik dalam test availability dengan `futureDate()`. Test blocked-date harus mengatur `blockedDates: [date]` lalu memanggil method dengan `date`. Tambahkan test:

```typescript
    it('returns available:false when duration is not allowed', async () => {
        const result = await service.checkAvailability(futureDate(), '10:00', 180);
        expect(result).toEqual({
            available: false,
            reason: 'Durasi harus salah satu dari: 30, 60, 90, 120 menit.',
        });
    });
```

### Task 3 correction — validasi query endpoint

Tambahkan `BadRequestException` pada import `@nestjs/common`. Ganti implementasi route Task 3 dengan ini:

```typescript
    @Get('availability')
    @ApiOperation({ summary: 'Dry-run availability check for a date/time/duration (no account picked)' })
    @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'startTime', required: true, description: 'HH:mm' })
    @ApiQuery({ name: 'durationMinutes', required: true, example: 60 })
    async getAvailability(
        @Query('date') date: string,
        @Query('startTime') startTime: string,
        @Query('durationMinutes') durationMinutes: string,
    ) {
        const duration = Number(durationMinutes);
        const parsedDate = new Date(`${date}T00:00:00`);
        const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date)
            && !Number.isNaN(parsedDate.getTime())
            && `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}` === date;

        if (!dateIsValid || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
            || !Number.isInteger(duration) || duration < 30 || duration > 240) {
            throw new BadRequestException('Parameter availability tidak valid.');
        }

        return this.bookingService.checkAvailability(date, startTime, duration);
    }
```

Tambahkan controller tests selain happy path:

```typescript
    it.each([
        ['2026-02-30', '10:00', '60'],
        ['2026-08-01', '24:00', '60'],
        ['2026-08-01', '10:00', 'not-a-number'],
        ['2026-08-01', '10:00', '15'],
    ])('rejects invalid availability query: %s %s %s', async (date, startTime, duration) => {
        await expect(controller.getAvailability(date, startTime, duration))
            .rejects.toThrow('Parameter availability tidak valid.');
        expect(bookingService.checkAvailability).not.toHaveBeenCalled();
    });
```

### Task 6 correction — testable settings-driven form and race path

Replace the local `DURATION_OPTIONS` constant with `useDurationOptions()` from existing `../hooks`. Add `useEffect` import. Use this state synchronizer after the hooks:

```typescript
    const { data: durationOptions = [] } = useDurationOptions();

    useEffect(() => {
        if (durationOptions.length && !durationOptions.includes(duration)) {
            setDuration(durationOptions[0]);
        }
    }, [duration, durationOptions]);
```

Render `durationOptions.map((option) => <SelectItem key={option} value={String(option)}>{`${option} menit${option === 60 ? ' (1 jam)' : ''}`}</SelectItem>)`. No fixed frontend duration list remains.

Use independent success state, preserving success UI even when API response lacks `meeting.joinUrl`:

```typescript
    const [bookingSucceeded, setBookingSucceeded] = useState(false);
    const [successJoinUrl, setSuccessJoinUrl] = useState<string | null>(null);
```

After `mutateAsync(dto)`, normalize non-recurring and recurring response, then reset all form state only on success:

```typescript
            const createdBooking = Array.isArray(result) ? result[0] : result;
            toast.success('Booking berhasil dibuat! Link Zoom akan dikirim via email.');
            setSuccessJoinUrl(createdBooking?.meeting?.joinUrl ?? null);
            setBookingSucceeded(true);
            setTitle('');
            setDescription('');
            setBookingDate('');
            setStartTime('');
            setDuration(durationOptions.includes(60) ? 60 : (durationOptions[0] ?? 60));
            setParticipantEmails('');
            setIsRecurring(false);
            setFreq('WEEKLY');
            setIntervalVal(1);
            setUntil('');
```

Render success UI from `if (bookingSucceeded)`. `Buat Booking Baru` must execute `setBookingSucceeded(false); setSuccessJoinUrl(null);`.

Extract and export pure recurrence helper from `SimpleBookingForm.tsx`; form calls it in submit handler:

```typescript
export function buildRecurrencePattern(freq: string, interval: number, until: string): string {
    const untilClause = until ? `;UNTIL=${until.replace(/-/g, '')}T235959Z` : '';
    return `FREQ=${freq};INTERVAL=${interval}${untilClause}`;
}
```

Use `const recurrencePattern = isRecurring ? buildRecurrencePattern(freq, interval, until) : undefined;`. Add direct unit assertions:

```typescript
it('builds same RRule format as ZoomRecurringOptions flow', () => {
    expect(buildRecurrencePattern('WEEKLY', 2, '2026-08-31'))
        .toBe('FREQ=WEEKLY;INTERVAL=2;UNTIL=20260831T235959Z');
    expect(buildRecurrencePattern('DAILY', 1, ''))
        .toBe('FREQ=DAILY;INTERVAL=1');
});
```

Mock `ModernDatePicker` in `SimpleBookingForm.test.tsx`, so each test selects a valid date without depending on popover internals:

```typescript
vi.mock('@/components/ui/ModernDatePicker', () => ({
    ModernDatePicker: ({ onChange }: { onChange?: (date: Date) => void }) => (
        <button type="button" aria-label="Tanggal" onClick={() => onChange?.(new Date(Date.now() + 86_400_000))}>
            Pilih tanggal
        </button>
    ),
}));
```

Mock `useDurationOptions` to return `{ data: [30, 60, 90, 120] }` in `beforeEach`. Before every assertion for availability or submit, call:

```typescript
fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
fireEvent.change(screen.getByLabelText(/jam mulai/i), { target: { value: '10:00' } });
```

Add race regression test after submit test:

```typescript
it('keeps form values and shows backend race error when submit conflicts', async () => {
    mutateAsync.mockRejectedValueOnce({
        response: { data: { message: 'Gagal membuat jadwal: Semua akun penuh pada 2026-08-01' } },
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat mingguan tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tanggal' }));
    fireEvent.change(screen.getByLabelText(/jam mulai/i), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /book meeting/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(screen.getByLabelText(/judul/i)).toHaveValue('Rapat mingguan tim');
    expect(toast.error).toHaveBeenCalledWith('Gagal membuat jadwal: Semua akun penuh pada 2026-08-01');
});
```

Mock `sonner` in this test file with `toast: { error: vi.fn(), success: vi.fn() }`, and reset `mutateAsync`, `toast.error`, and `toast.success` in `beforeEach`. Replace broken availability badge interpolation with a real template literal:

```typescript
const availabilityClassName = availability.isLoading
    ? 'bg-muted/30'
    : availability.data?.available
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
        : 'border-red-500/30 bg-red-500/10 text-red-700';
```

Then render badge with `className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${availabilityClassName}`}`.

---

### Task 1: Backend — `zoomAccountId` jadi optional di DTO

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/dto/booking.dto.ts:18-22`
- Test: `apps/backend/src/modules/zoom-booking/dto/__tests__/booking.dto.spec.ts` (baru)

**Interfaces:**
- Produces: `CreateBookingDto.zoomAccountId?: string` (dipakai Task 2 controller & Task 3 service, sudah dikonsumsi tanpa perubahan oleh `createBooking()` yang sudah ada).

- [ ] **Step 1: Write failing test — DTO validasi lolos tanpa `zoomAccountId`**

```typescript
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBookingDto } from '../booking.dto';

describe('CreateBookingDto', () => {
    it('passes validation without zoomAccountId', async () => {
        const dto = plainToInstance(CreateBookingDto, {
            title: 'Weekly Sync Meeting',
            bookingDate: '2026-08-01',
            startTime: '09:00',
            durationMinutes: 60,
        });

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    });

    it('still fails validation without title', async () => {
        const dto = plainToInstance(CreateBookingDto, {
            zoomAccountId: 'acc-1',
            bookingDate: '2026-08-01',
            startTime: '09:00',
            durationMinutes: 60,
        });

        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/dto/__tests__/booking.dto.spec.ts`
Expected: FAIL on first test — `zoomAccountId` currently required, `errors` is non-empty.

- [ ] **Step 3: Make `zoomAccountId` optional**

In `apps/backend/src/modules/zoom-booking/dto/booking.dto.ts`, replace lines 18-22:

```typescript
export class CreateBookingDto {
    @ApiPropertyOptional({ description: 'Zoom account ID (opsional — auto-assign jika kosong)' })
    @IsString()
    @IsOptional()
    zoomAccountId?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/dto/__tests__/booking.dto.spec.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/zoom-booking/dto/booking.dto.ts apps/backend/src/modules/zoom-booking/dto/__tests__/booking.dto.spec.ts
git commit -m "feat(zoom-booking): make zoomAccountId optional in CreateBookingDto"
```

---

### Task 2: Backend — `checkAvailability` service method (dry-run)

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts` (add method after `createBooking`, i.e. after line 567)
- Test: `apps/backend/src/modules/zoom-booking/services/__tests__/zoom-booking.check-availability.spec.ts` (baru)

**Interfaces:**
- Consumes: `this.getSettings()` (existing, line 107-114), `this.accountRepo` (existing repo, `ZoomAccount[]` with `isActive: true`), `this.bookingRepo.createQueryBuilder` (existing pattern, lines 522-539).
- Produces: `async checkAvailability(date: string, startTime: string, durationMinutes: number): Promise<{ available: boolean; reason?: string }>` — consumed by Task 3 controller endpoint.

- [ ] **Step 1: Write failing test with mocked repos**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZoomBookingService } from '../zoom-booking.service';
import { ZoomBooking } from '../../entities/zoom-booking.entity';
import { ZoomAccount } from '../../entities/zoom-account.entity';
import { ZoomMeeting } from '../../entities/zoom-meeting.entity';
import { ZoomParticipant } from '../../entities/zoom-participant.entity';
import { ZoomSettings } from '../../entities/zoom-settings.entity';
import { ZoomAuditLog } from '../../entities/zoom-audit-log.entity';
import { DataSource } from 'typeorm';
import { AuditService } from '../../../../shared/audit/audit.service';
import { ZoomApiAdapter } from '../../adapters/zoom-api.adapter';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ZoomBookingService.checkAvailability', () => {
    let service: ZoomBookingService;
    let settingsRepo: { find: jest.Mock };
    let accountRepo: { find: jest.Mock };
    let bookingRepo: { createQueryBuilder: jest.Mock };

    const SETTINGS = {
        id: 's1',
        advanceBookingDays: 30,
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        blockedDates: [] as string[],
        slotStartTime: '08:00',
        slotEndTime: '18:00',
        slotIntervalMinutes: 30,
    };
    const ACCOUNTS = [{ id: 'acc-1', isActive: true }, { id: 'acc-2', isActive: true }];

    beforeEach(async () => {
        settingsRepo = { find: jest.fn().mockResolvedValue([SETTINGS]) };
        accountRepo = { find: jest.fn().mockResolvedValue(ACCOUNTS) };
        bookingRepo = {
            createQueryBuilder: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(null),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomBookingService,
                { provide: getRepositoryToken(ZoomBooking), useValue: bookingRepo },
                { provide: getRepositoryToken(ZoomAccount), useValue: accountRepo },
                { provide: getRepositoryToken(ZoomMeeting), useValue: {} },
                { provide: getRepositoryToken(ZoomParticipant), useValue: {} },
                { provide: getRepositoryToken(ZoomSettings), useValue: settingsRepo },
                { provide: getRepositoryToken(ZoomAuditLog), useValue: {} },
                { provide: DataSource, useValue: {} },
                { provide: AuditService, useValue: {} },
                { provide: ZoomApiAdapter, useValue: {} },
                { provide: EventEmitter2, useValue: { emit: jest.fn() } },
            ],
        }).compile();

        service = module.get(ZoomBookingService);
    });

    it('returns available:true when no account has a conflict', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toLocaleDateString('en-CA');

        const result = await service.checkAvailability(dateStr, '10:00', 60);
        expect(result).toEqual({ available: true });
    });

    it('returns available:false when every active account has a conflict', async () => {
        bookingRepo.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({ id: 'conflict-1' }),
        });
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toLocaleDateString('en-CA');

        const result = await service.checkAvailability(dateStr, '10:00', 60);
        expect(result.available).toBe(false);
        expect(result.reason).toBeDefined();
    });

    it('returns available:false for a blocked date', async () => {
        settingsRepo.find.mockResolvedValue([{ ...SETTINGS, blockedDates: ['2026-08-15'] }]);
        const result = await service.checkAvailability('2026-08-15', '10:00', 60);
        expect(result).toEqual({ available: false, reason: 'Tanggal 2026-08-15 diblokir.' });
    });

    it('returns available:false for a past date', async () => {
        const result = await service.checkAvailability('2020-01-01', '10:00', 60);
        expect(result.available).toBe(false);
        expect(result.reason).toContain('sudah lewat');
    });
});
```

(Sesuaikan nama file entity import di atas dengan path aktual jika berbeda — cek `apps/backend/src/modules/zoom-booking/entities/` sebelum menjalankan test bila import error.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/services/__tests__/zoom-booking.check-availability.spec.ts`
Expected: FAIL — `service.checkAvailability is not a function`.

- [ ] **Step 3: Implement `checkAvailability` in `zoom-booking.service.ts`**

Add this method directly after the closing brace of `createBooking` (after line 567):

```typescript
    /**
     * Dry-run availability check — mirrors createBooking's per-date validation
     * and conflict-check sequence (lines 480-544) without writing to the DB
     * or reserving any account. Used by the simplified client booking form's
     * real-time availability badge.
     */
    async checkAvailability(
        bookingDateStr: string,
        startTime: string,
        durationMinutes: number,
    ): Promise<{ available: boolean; reason?: string }> {
        const settings = await this.getSettings();
        const bookingDate = new Date(bookingDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
            return { available: false, reason: `Tanggal ${bookingDateStr} sudah lewat.` };
        }

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + settings.advanceBookingDays);
        if (bookingDate > maxDate) {
            return {
                available: false,
                reason: `Tanggal ${bookingDateStr} melebihi batas maksimal ${settings.advanceBookingDays} hari.`,
            };
        }

        const dayOfWeek = bookingDate.getDay();
        if (!settings.workingDays.includes(dayOfWeek)) {
            return { available: false, reason: `Tanggal ${bookingDateStr} bukan hari kerja.` };
        }

        if (settings.blockedDates.includes(bookingDateStr)) {
            return { available: false, reason: `Tanggal ${bookingDateStr} diblokir.` };
        }

        const [startHour, startMin] = startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMin + durationMinutes;
        const endTime = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;

        const allAccounts = await this.accountRepo.find({ where: { isActive: true } });
        if (!allAccounts.length) {
            return { available: false, reason: 'Tidak ada akun Zoom yang aktif.' };
        }

        for (const account of allAccounts) {
            const conflict = await this.bookingRepo
                .createQueryBuilder('booking')
                .where('booking.zoomAccountId = :accountId', { accountId: account.id })
                .andWhere('booking.bookingDate = :date', { date: bookingDateStr })
                .andWhere('booking.status IN (:...statuses)', { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] })
                .andWhere(
                    '(booking.startTime < :endTime AND booking.endTime > :startTime)',
                    { startTime, endTime }
                )
                .getOne();

            if (!conflict) {
                return { available: true };
            }
        }

        return { available: false, reason: `Semua akun penuh pada ${bookingDateStr}` };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/services/__tests__/zoom-booking.check-availability.spec.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/zoom-booking/services/zoom-booking.service.ts apps/backend/src/modules/zoom-booking/services/__tests__/zoom-booking.check-availability.spec.ts
git commit -m "feat(zoom-booking): add checkAvailability dry-run service method"
```

---

### Task 3: Backend — `GET /zoom-booking/availability` endpoint

**Files:**
- Modify: `apps/backend/src/modules/zoom-booking/controllers/zoom-booking.controller.ts` (add route after `getMergedCalendar`, i.e. after line 89)
- Test: `apps/backend/src/modules/zoom-booking/controllers/__tests__/zoom-booking.controller.availability.spec.ts` (baru)

**Interfaces:**
- Consumes: `ZoomBookingService.checkAvailability(date, startTime, durationMinutes)` (Task 2).
- Produces: `GET /zoom-booking/availability?date=YYYY-MM-DD&startTime=HH:mm&durationMinutes=60` → `{ available: boolean; reason?: string }`, consumed by Task 5 frontend hook.

- [ ] **Step 1: Write failing controller test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ZoomBookingController } from '../zoom-booking.controller';
import { ZoomBookingService } from '../../services/zoom-booking.service';
import { ZoomAccountService } from '../../services/zoom-account.service';
import { ZoomSettingsService } from '../../services/zoom-settings.service';

describe('ZoomBookingController.getAvailability', () => {
    let controller: ZoomBookingController;
    let bookingService: { checkAvailability: jest.Mock };

    beforeEach(async () => {
        bookingService = { checkAvailability: jest.fn().mockResolvedValue({ available: true }) };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ZoomBookingController],
            providers: [
                { provide: ZoomBookingService, useValue: bookingService },
                { provide: ZoomAccountService, useValue: {} },
                { provide: ZoomSettingsService, useValue: {} },
            ],
        }).compile();

        controller = module.get(ZoomBookingController);
    });

    it('delegates to checkAvailability with parsed query params', async () => {
        const result = await controller.getAvailability('2026-08-01', '10:00', '60');
        expect(bookingService.checkAvailability).toHaveBeenCalledWith('2026-08-01', '10:00', 60);
        expect(result).toEqual({ available: true });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/controllers/__tests__/zoom-booking.controller.availability.spec.ts`
Expected: FAIL — `controller.getAvailability is not a function`.

- [ ] **Step 3: Add route to controller**

In `apps/backend/src/modules/zoom-booking/controllers/zoom-booking.controller.ts`, insert after `getMergedCalendar` (after line 89, before `@Post()` on line 91):

```typescript
    @Get('availability')
    @ApiOperation({ summary: 'Dry-run availability check for a date/time/duration (no account picked)' })
    @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
    @ApiQuery({ name: 'startTime', required: true, description: 'HH:mm' })
    @ApiQuery({ name: 'durationMinutes', required: true, example: 60 })
    async getAvailability(
        @Query('date') date: string,
        @Query('startTime') startTime: string,
        @Query('durationMinutes') durationMinutes: string,
    ) {
        return this.bookingService.checkAvailability(date, startTime, parseInt(durationMinutes, 10));
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && npx jest src/modules/zoom-booking/controllers/__tests__/zoom-booking.controller.availability.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/zoom-booking/controllers/zoom-booking.controller.ts apps/backend/src/modules/zoom-booking/controllers/__tests__/zoom-booking.controller.availability.spec.ts
git commit -m "feat(zoom-booking): add GET /zoom-booking/availability endpoint"
```

---

### Task 4: Frontend — `zoomAccountId` optional di type + `useCheckAvailability` hook

**Files:**
- Modify: `apps/frontend/src/features/zoom-booking/types.ts:112-121`
- Create: `apps/frontend/src/features/zoom-booking/hooks/useCheckAvailability.ts`
- Modify: `apps/frontend/src/features/zoom-booking/hooks/index.ts` (add export)
- Test: `apps/frontend/src/features/zoom-booking/hooks/__tests__/useCheckAvailability.test.ts` (baru)

**Interfaces:**
- Consumes: `useDebounce<T>(value, delay)` from `apps/frontend/src/hooks/useDebounce.ts` (existing), `api` from `@/lib/api` (existing axios instance).
- Produces: `useCheckAvailability(date?: string, startTime?: string, durationMinutes?: number): { data?: { available: boolean; reason?: string }, isLoading: boolean }` — consumed by Task 6 `SimpleBookingForm`.

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCheckAvailability } from '../useCheckAvailability';
import api from '@/lib/api';

vi.mock('@/lib/api', () => ({
    default: { get: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useCheckAvailability', () => {
    beforeEach(() => {
        vi.mocked(api.get).mockReset();
    });

    it('does not fetch when fields are incomplete', () => {
        const { result } = renderHook(
            () => useCheckAvailability(undefined, '10:00', 60),
            { wrapper },
        );
        expect(result.current.data).toBeUndefined();
        expect(api.get).not.toHaveBeenCalled();
    });

    it('fetches availability once all fields are present', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { available: true } });
        const { result } = renderHook(
            () => useCheckAvailability('2026-08-01', '10:00', 60),
            { wrapper },
        );

        await waitFor(() => expect(result.current.data).toEqual({ available: true }));
        expect(api.get).toHaveBeenCalledWith(
            expect.stringContaining('/zoom-booking/availability'),
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/hooks/__tests__/useCheckAvailability.test.ts`
Expected: FAIL — module `../useCheckAvailability` does not exist.

- [ ] **Step 3: Create the hook**

`apps/frontend/src/features/zoom-booking/hooks/useCheckAvailability.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

interface AvailabilityResult {
    available: boolean;
    reason?: string;
}

/**
 * Real-time availability check for the simplified client booking form.
 * Debounces the (date, startTime, durationMinutes) tuple ~400ms before
 * hitting the dry-run GET /zoom-booking/availability endpoint.
 */
export function useCheckAvailability(
    date: string | undefined,
    startTime: string | undefined,
    durationMinutes: number | undefined,
) {
    const debouncedDate = useDebounce(date, 400);
    const debouncedStartTime = useDebounce(startTime, 400);
    const debouncedDuration = useDebounce(durationMinutes, 400);

    return useQuery<AvailabilityResult>({
        queryKey: ['zoom-availability', debouncedDate, debouncedStartTime, debouncedDuration],
        queryFn: async () => {
            const params = new URLSearchParams({
                date: debouncedDate!,
                startTime: debouncedStartTime!,
                durationMinutes: String(debouncedDuration!),
            });
            const response = await api.get(`/zoom-booking/availability?${params}`);
            return response.data;
        },
        enabled: !!debouncedDate && !!debouncedStartTime && !!debouncedDuration,
        staleTime: 0,
    });
}
```

- [ ] **Step 4: Add barrel export**

In `apps/frontend/src/features/zoom-booking/hooks/index.ts`, add:

```typescript
export { useCheckAvailability } from './useCheckAvailability';
```

(Read the file first to find the correct insertion point among existing exports before editing.)

- [ ] **Step 5: Make `zoomAccountId` optional in frontend type**

In `apps/frontend/src/features/zoom-booking/types.ts`, replace line 113:

```typescript
export interface CreateBookingDto {
    zoomAccountId?: string;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/hooks/__tests__/useCheckAvailability.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/types.ts apps/frontend/src/features/zoom-booking/hooks/useCheckAvailability.ts apps/frontend/src/features/zoom-booking/hooks/index.ts apps/frontend/src/features/zoom-booking/hooks/__tests__/useCheckAvailability.test.ts
git commit -m "feat(zoom-booking): add useCheckAvailability hook, make zoomAccountId optional in frontend type"
```

---

### Task 5: Frontend — `SimpleRecurringField` component

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/SimpleRecurringField.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/index.ts` (add export)
- Test: `apps/frontend/src/features/zoom-booking/components/__tests__/SimpleRecurringField.test.tsx` (baru)

**Interfaces:**
- Produces: `SimpleRecurringField` props `{ isRecurring: boolean; setIsRecurring: (v: boolean) => void; freq: string; setFreq: (v: string) => void; interval: number; setInterval: (v: number) => void; until: string; setUntil: (v: string) => void; }` — same shape as `ZoomRecurringOptions` minus `minDate`/`maxDate` (hardcoded internally same as `ZoomRecurringOptions.tsx:601`: `addDays(new Date(), 365)`). Consumed by Task 6 `SimpleBookingForm`.

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleRecurringField } from '../SimpleRecurringField';

function setup(isRecurring = false) {
    const props = {
        isRecurring,
        setIsRecurring: vi.fn(),
        freq: 'WEEKLY',
        setFreq: vi.fn(),
        interval: 1,
        setInterval: vi.fn(),
        until: '',
        setUntil: vi.fn(),
    };
    render(<SimpleRecurringField {...props} />);
    return props;
}

describe('SimpleRecurringField', () => {
    it('hides freq/interval/until fields when not recurring', () => {
        setup(false);
        expect(screen.queryByLabelText(/setiap/i)).not.toBeInTheDocument();
    });

    it('shows compact freq/interval/until row when toggled on', () => {
        setup(true);
        expect(screen.getByText(/setiap/i)).toBeInTheDocument();
    });

    it('calls setIsRecurring when the toggle is clicked', () => {
        const props = setup(false);
        fireEvent.click(screen.getByRole('switch'));
        expect(props.setIsRecurring).toHaveBeenCalledWith(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/SimpleRecurringField.test.tsx`
Expected: FAIL — module `../SimpleRecurringField` does not exist.

- [ ] **Step 3: Create the component**

`apps/frontend/src/features/zoom-booking/components/SimpleRecurringField.tsx`:

```typescript
import { format, parseISO, addDays } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';

interface SimpleRecurringFieldProps {
    isRecurring: boolean;
    setIsRecurring: (val: boolean) => void;
    freq: string;
    setFreq: (val: string) => void;
    interval: number;
    setInterval: (val: number) => void;
    until: string;
    setUntil: (val: string) => void;
}

export function SimpleRecurringField({
    isRecurring,
    setIsRecurring,
    freq,
    setFreq,
    interval,
    setInterval,
    until,
    setUntil,
}: SimpleRecurringFieldProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Berulang?</Label>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            </div>

            {isRecurring && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Setiap</span>
                    <Input
                        type="number"
                        min={1}
                        max={30}
                        value={interval}
                        onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                        className="h-8 w-16"
                        aria-label="Interval"
                    />
                    <Select value={freq} onValueChange={setFreq}>
                        <SelectTrigger className="h-8 w-28" aria-label="Frekuensi">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DAILY">Hari</SelectItem>
                            <SelectItem value="WEEKLY">Minggu</SelectItem>
                            <SelectItem value="MONTHLY">Bulan</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">sampai</span>
                    <ModernDatePicker
                        value={until ? parseISO(until) : undefined}
                        onChange={(date) => setUntil(date ? format(date, 'yyyy-MM-dd') : '')}
                        placeholder="Opsional"
                        minDate={new Date()}
                        maxDate={addDays(new Date(), 365)}
                        triggerClassName="h-8"
                    />
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Add barrel export**

In `apps/frontend/src/features/zoom-booking/components/index.ts`, add after the `ZoomRescheduleView` export (after line 27):

```typescript
export { SimpleRecurringField } from './SimpleRecurringField';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/SimpleRecurringField.test.tsx`
Expected: PASS, all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/SimpleRecurringField.tsx apps/frontend/src/features/zoom-booking/components/index.ts apps/frontend/src/features/zoom-booking/components/__tests__/SimpleRecurringField.test.tsx
git commit -m "feat(zoom-booking): add SimpleRecurringField compact recurring toggle"
```

---

### Task 6: Frontend — `SimpleBookingForm` component

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/components/index.ts` (add export)
- Test: `apps/frontend/src/features/zoom-booking/components/__tests__/SimpleBookingForm.test.tsx` (baru)

**Interfaces:**
- Consumes: `useCreateBooking`, `usePublicZoomSettings`, `useCheckAvailability` (Task 4) from `../hooks`; `SimpleRecurringField` (Task 5) from `./SimpleRecurringField`; `CreateBookingDto` type (now with optional `zoomAccountId`, Task 4) from `../types`.
- Produces: `SimpleBookingForm` component, no props (self-contained) — consumed by Task 7 `ClientZoomBookingPage`.

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimpleBookingForm } from '../SimpleBookingForm';
import * as hooks from '../../hooks';

vi.mock('../../hooks', async () => {
    const actual = await vi.importActual('../../hooks');
    return {
        ...actual,
        useCreateBooking: vi.fn(),
        usePublicZoomSettings: vi.fn(),
        useCheckAvailability: vi.fn(),
    };
});

function renderForm() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <SimpleBookingForm />
        </QueryClientProvider>,
    );
}

describe('SimpleBookingForm', () => {
    const mutateAsync = vi.fn();

    beforeEach(() => {
        vi.mocked(hooks.usePublicZoomSettings).mockReturnValue({
            data: { slotStartTime: '08:00', slotEndTime: '18:00', slotIntervalMinutes: 30, advanceBookingDays: 30, workingDays: [1,2,3,4,5], allowedDurations: [30,60,90,120] },
        } as any);
        vi.mocked(hooks.useCheckAvailability).mockReturnValue({
            data: { available: true }, isLoading: false,
        } as any);
        vi.mocked(hooks.useCreateBooking).mockReturnValue({
            mutateAsync, isPending: false, isSuccess: false,
        } as any);
    });

    it('renders without a Zoom account picker', () => {
        renderForm();
        expect(screen.queryByText(/zoom account/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/pilih akun/i)).not.toBeInTheDocument();
    });

    it('shows available badge when slot is free', async () => {
        renderForm();
        await waitFor(() => expect(screen.getByText(/tersedia/i)).toBeInTheDocument());
    });

    it('disables submit when slot is unavailable', async () => {
        vi.mocked(hooks.useCheckAvailability).mockReturnValue({
            data: { available: false, reason: 'Semua akun penuh' }, isLoading: false,
        } as any);
        renderForm();
        await waitFor(() => expect(screen.getByText(/semua akun penuh/i)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /book/i })).toBeDisabled();
    });

    it('submits without zoomAccountId in the payload', async () => {
        mutateAsync.mockResolvedValue({ meeting: { joinUrl: 'https://zoom.us/j/123' } });
        renderForm();

        fireEvent.change(screen.getByLabelText(/judul/i), { target: { value: 'Rapat mingguan tim' } });
        fireEvent.change(screen.getByLabelText(/jam mulai/i), { target: { value: '10:00' } });
        fireEvent.click(screen.getByRole('button', { name: /book/i }));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
        const dto = mutateAsync.mock.calls[0][0];
        expect(dto.zoomAccountId).toBeUndefined();
        expect(dto.title).toBe('Rapat mingguan tim');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/SimpleBookingForm.test.tsx`
Expected: FAIL — module `../SimpleBookingForm` does not exist.

- [ ] **Step 3: Create the component**

`apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx`:

```typescript
import { useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { Video, FileText, Clock, Users, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { useCreateBooking, usePublicZoomSettings, useCheckAvailability } from '../hooks';
import type { CreateBookingDto } from '../types';
import { SimpleRecurringField } from './SimpleRecurringField';

const DURATION_OPTIONS = [
    { value: 30,  label: '30 menit (0.5 jam)' },
    { value: 60,  label: '60 menit (1 jam)' },
    { value: 90,  label: '90 menit (1.5 jam)' },
    { value: 120, label: '120 menit (2 jam)' },
    { value: 180, label: '180 menit (3 jam)' },
    { value: 240, label: '240 menit (4 jam)' },
];

export function SimpleBookingForm() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [participantEmails, setParticipantEmails] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [freq, setFreq] = useState('WEEKLY');
    const [interval, setIntervalVal] = useState(1);
    const [until, setUntil] = useState('');
    const [successJoinUrl, setSuccessJoinUrl] = useState<string | null>(null);

    const { data: settings } = usePublicZoomSettings();
    const createBooking = useCreateBooking();
    const availability = useCheckAvailability(bookingDate || undefined, startTime || undefined, duration);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) { toast.error('Judul meeting wajib diisi'); return; }
        if (!bookingDate) { toast.error('Tanggal wajib dipilih'); return; }
        if (!startTime) { toast.error('Jam mulai wajib diisi'); return; }

        let recurrencePattern: string | undefined;
        if (isRecurring) {
            recurrencePattern = `FREQ=${freq};INTERVAL=${interval}`;
            if (until) {
                const untilDateStr = until.replace(/-/g, '');
                recurrencePattern += `;UNTIL=${untilDateStr}T235959Z`;
            }
        }

        const dto: CreateBookingDto = {
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: participantEmails
                .split(',')
                .map((em) => em.trim())
                .filter((em) => em.includes('@')),
            recurrencePattern,
        };

        try {
            const result = await createBooking.mutateAsync(dto);
            toast.success('Booking berhasil dibuat! Link Zoom akan dikirim via email.');
            setSuccessJoinUrl((result as any)?.meeting?.joinUrl ?? null);
            setTitle('');
            setDescription('');
            setBookingDate('');
            setStartTime('');
            setDuration(60);
            setParticipantEmails('');
            setIsRecurring(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membuat booking. Coba ubah jam dan submit ulang.');
        }
    };

    if (successJoinUrl !== null) {
        return (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div>
                    <h3 className="text-lg font-bold">Booking Berhasil!</h3>
                    <p className="text-sm text-muted-foreground mt-1">Link Zoom akan dikirim via email.</p>
                </div>
                {successJoinUrl && (
                    <Button className="gap-2" onClick={() => window.open(successJoinUrl, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                        Join Meeting Sekarang
                    </Button>
                )}
                <Button variant="outline" onClick={() => setSuccessJoinUrl(null)} className="w-full">
                    Buat Booking Baru
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5 inline mr-1" />
                    Judul *
                </Label>
                <Input
                    id="title"
                    aria-label="Judul"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Weekly Sync Meeting"
                    minLength={5}
                    maxLength={100}
                    className="h-9"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tanggal *</Label>
                    <ModernDatePicker
                        value={bookingDate ? parseISO(bookingDate) : undefined}
                        onChange={(date) => setBookingDate(format(date, 'yyyy-MM-dd'))}
                        placeholder="Pilih tanggal"
                        minDate={new Date()}
                        maxDate={addDays(new Date(), settings?.advanceBookingDays || 30)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="startTime" className="text-xs font-semibold">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        Jam Mulai *
                    </Label>
                    <Input
                        id="startTime"
                        aria-label="Jam Mulai"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-9"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Durasi *</Label>
                <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {DURATION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {bookingDate && startTime && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm border
                    ${availability.isLoading ? 'bg-muted/30' : availability.data?.available ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : 'bg-red-500/10 border-red-500/30 text-red-700'}">
                    {availability.isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            Mengecek ketersediaan...
                        </>
                    ) : availability.data?.available ? (
                        <>
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Jam ini tersedia
                        </>
                    ) : (
                        <>
                            <XCircle className="h-4 w-4 shrink-0" />
                            {availability.data?.reason || 'Jam ini tidak tersedia'}
                        </>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold">Deskripsi (Opsional)</Label>
                <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Agenda meeting..."
                    rows={3}
                    maxLength={500}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="participants" className="text-xs font-semibold">
                    <Users className="h-3.5 w-3.5 inline mr-1" />
                    Peserta (Opsional)
                </Label>
                <Input
                    id="participants"
                    value={participantEmails}
                    onChange={(e) => setParticipantEmails(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="h-9"
                />
            </div>

            <SimpleRecurringField
                isRecurring={isRecurring}
                setIsRecurring={setIsRecurring}
                freq={freq}
                setFreq={setFreq}
                interval={interval}
                setInterval={setIntervalVal}
                until={until}
                setUntil={setUntil}
            />

            <Button
                type="submit"
                disabled={createBooking.isPending || (bookingDate !== '' && startTime !== '' && availability.data?.available === false)}
                className="w-full font-semibold"
            >
                <Video className="h-4 w-4 mr-2" />
                {createBooking.isPending ? 'Membuat...' : 'Book Meeting'}
            </Button>
        </form>
    );
}
```

Catatan: string template class Tailwind di atas (blok badge availability) memakai interpolasi biasa — pastikan menuliskannya sebagai literal template `` `...${...}...` `` di file asli, bukan quoted string, karena classNames kondisional harus dievaluasi sebagai JS expression.

- [ ] **Step 4: Add barrel export**

In `apps/frontend/src/features/zoom-booking/components/index.ts`, add after the `SimpleRecurringField` export from Task 5:

```typescript
export { SimpleBookingForm } from './SimpleBookingForm';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/components/__tests__/SimpleBookingForm.test.tsx`
Expected: PASS, all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/components/SimpleBookingForm.tsx apps/frontend/src/features/zoom-booking/components/index.ts apps/frontend/src/features/zoom-booking/components/__tests__/SimpleBookingForm.test.tsx
git commit -m "feat(zoom-booking): add SimpleBookingForm for client portal"
```

---

### Task 7: Frontend — `ClientZoomBookingPage` + route wiring

**Files:**
- Create: `apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx`
- Modify: `apps/frontend/src/features/zoom-booking/pages/index.ts` (add export)
- Modify: `apps/frontend/src/routes/AppRoutes.tsx:60-61` (add lazy import), `:286` (swap component)
- Test: `apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx` (baru)

**Interfaces:**
- Consumes: `SimpleBookingForm` (Task 6), `ZoomMyBookingsView` (existing, unmodified) from `../components`.
- Produces: `ClientZoomBookingPage` component — wired into `/client/zoom-calendar` route.

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientZoomBookingPage } from '../ClientZoomBookingPage';

vi.mock('../../components', async () => {
    const actual = await vi.importActual('../../components');
    return {
        ...actual,
        SimpleBookingForm: () => <div data-testid="simple-booking-form" />,
        ZoomMyBookingsView: () => <div data-testid="my-bookings-view" />,
    };
});

describe('ClientZoomBookingPage', () => {
    it('renders header, booking form, and my-bookings list', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={queryClient}>
                <ClientZoomBookingPage />
            </QueryClientProvider>,
        );
        expect(screen.getByText(/booking zoom/i)).toBeInTheDocument();
        expect(screen.getByTestId('simple-booking-form')).toBeInTheDocument();
        expect(screen.getByTestId('my-bookings-view')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx`
Expected: FAIL — module `../ClientZoomBookingPage` does not exist.

- [ ] **Step 3: Create the page**

`apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx`:

```typescript
import { Video } from 'lucide-react';
import { SimpleBookingForm, ZoomMyBookingsView } from '../components';

export function ClientZoomBookingPage() {
    return (
        <div className="max-w-3xl mx-auto space-y-6 p-4 lg:p-6 animate-fade-in-up">
            <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" aria-hidden="true" />
                <h1 className="text-xl font-bold">Booking Zoom</h1>
            </div>

            <div className="rounded-lg border bg-card p-5">
                <SimpleBookingForm />
            </div>

            <ZoomMyBookingsView />
        </div>
    );
}
```

- [ ] **Step 4: Add barrel export**

In `apps/frontend/src/features/zoom-booking/pages/index.ts`, add:

```typescript
export { ClientZoomBookingPage } from './ClientZoomBookingPage';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire the route**

In `apps/frontend/src/routes/AppRoutes.tsx`, add after line 61 (the `ZoomSettingsPage` lazy import):

```typescript
const ClientZoomBookingPage = lazy(() => import('../features/zoom-booking/pages/ClientZoomBookingPage').then(m => ({ default: m.ClientZoomBookingPage })));
```

Then replace line 286 (inside the `/client` route block):

```typescript
                <Route path="zoom-calendar" element={<LazyRoute component={ClientZoomBookingPage} featureName="Zoom Calendar" requiredPageAccess="zoom_calendar" />} />
```

Do **not** touch line 267 (`/zoom-calendar` admin/agent route) or the manager route registration — both keep `ZoomCalendarPage`.

- [ ] **Step 7: Manual smoke check**

Run: `cd apps/frontend && npm run dev`, log in as a `USER` role, navigate to `/client/zoom-calendar`. Verify: no account picker visible anywhere, form shows Judul/Tanggal/Jam Mulai/Durasi/Deskripsi/Peserta/Berulang, availability badge appears after picking date+time, `ZoomMyBookingsView` list renders below. Then navigate as `ADMIN`/`AGENT` to `/zoom-calendar` and confirm the full calendar grid still renders unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/features/zoom-booking/pages/ClientZoomBookingPage.tsx apps/frontend/src/features/zoom-booking/pages/index.ts apps/frontend/src/routes/AppRoutes.tsx apps/frontend/src/features/zoom-booking/pages/__tests__/ClientZoomBookingPage.test.tsx
git commit -m "feat(zoom-booking): wire simplified ClientZoomBookingPage into /client/zoom-calendar route"
```

---

### Task 8: Regression check — admin/agent/manager Zoom pages unchanged

**Files:**
- None modified — verification only.

**Interfaces:**
- None — this task only runs existing test suites to confirm no regressions.

- [ ] **Step 1: Run existing zoom-booking backend test suite**

Run: `cd apps/backend && npx jest src/modules/zoom-booking`
Expected: All existing tests pass, including `zoom-settings.service.spec.ts` and (if `TEST_DATABASE_URL` is set) `zoom-booking.merged-calendar.integration.spec.ts`. No test targeting `ZoomCalendarPage`/`ZoomBookingForm`/`ZoomAdminController` behavior should have changed.

- [ ] **Step 2: Run existing zoom-booking frontend test suite**

Run: `cd apps/frontend && npx vitest run src/features/zoom-booking`
Expected: All existing tests pass unchanged, including `utils/__tests__/autoPickAccount.test.ts`.

- [ ] **Step 3: Manually verify explicit-account booking still works**

Using the admin/agent `/zoom-calendar` page (unchanged `ZoomBookingForm`), create a booking with an explicitly selected Zoom account. Confirm it succeeds — this exercises the `dto.zoomAccountId` truthy branch in `createBooking`'s `accountsToTry` logic (`zoom-booking.service.ts:515-520`), proving the DTO optionality change (Task 1) didn't break the explicit-account path.

- [ ] **Step 4: Commit (only if any fixes were needed)**

If Steps 1-3 all pass with no code changes, skip this commit — there is nothing to commit. If a regression was found and fixed, commit with:

```bash
git add -A
git commit -m "fix(zoom-booking): resolve regression found in admin/agent/manager flow"
```

---

## Self-Review

**Spec coverage:**
- Arsitektur (new files, new endpoint, DTO change) → Tasks 1-3 (backend), 4-7 (frontend). ✓
- Form fields & order (Judul/Tanggal/Jam/Durasi/Deskripsi/Peserta/Berulang) → Task 6 `SimpleBookingForm`. ✓
- No account field, account hidden always → Task 6 (no account UI), Task 1+3 (optional DTO + dry-run availability). ✓
- Real-time availability check with debounce + badge states → Task 4 (`useCheckAvailability`) + Task 6 (badge rendering). ✓
- Submit behavior (success → toast + Join Meeting + reset; race failure → toast + no reset) → Task 6 `handleSubmit`. ✓
- Layout (header + form card + reused `ZoomMyBookingsView`) → Task 7. ✓
- Testing requirements (smoke, functional, regression, race-condition) → Tasks 6-8 cover these directly.

**Placeholder scan:** No TBD/TODO/"add appropriate" phrasing found — all steps contain complete code.

**Type consistency:** `zoomAccountId?: string` matches across `booking.dto.ts` (Task 1) and `types.ts` (Task 4). `checkAvailability(date, startTime, durationMinutes)` signature matches between service (Task 2), controller (Task 3), and frontend hook's query params (Task 4). `SimpleRecurringField` prop names (`isRecurring`, `setIsRecurring`, `freq`, `setFreq`, `interval`, `setInterval`, `until`, `setUntil`) match between Task 5 definition and Task 6 usage.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-22-client-zoom-booking-simplify.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
